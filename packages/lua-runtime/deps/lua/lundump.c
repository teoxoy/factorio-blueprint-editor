/*
** $Id: lundump.c,v 2.22 2012/05/08 13:53:33 roberto Exp $
** load precompiled Lua chunks
** See Copyright Notice in lua.h
*/

#include <string.h>

#define lundump_c
#define LUA_CORE

#include "lua.h"

#include "ldebug.h"
#include "ldo.h"
#include "lfunc.h"
#include "lmem.h"
#include "lobject.h"
#include "lstring.h"
#include "lundump.h"
#include "lzio.h"
#include "lopcodes.h"

typedef struct {
 lua_State* L;
 ZIO* Z;
 Mbuffer* b;
 const char* name;
} LoadState;

static l_noret error(LoadState* S, const char* why)
{
 luaO_pushfstring(S->L,"%s: %s precompiled chunk",S->name,why);
 luaD_throw(S->L,LUA_ERRSYNTAX);
}

#define LoadMem(S,b,n,size)	LoadBlock(S,b,(n)*(size))
#define LoadByte(S)		(lu_byte)LoadChar(S)
#define LoadVar(S,x)		LoadMem(S,&x,1,sizeof(x))
#define LoadVector(S,b,n,size)	LoadMem(S,b,n,size)

#define bytecode_assert(S,cond) if (!(cond)) error(S, "invalid bytecode in");

static void verify_jump(LoadState* S, int pc, Instruction inst, Proto* f)
{
  bytecode_assert(S, GETARG_A(inst) <= f->maxstacksize);
  // verify jump is at least within func body, this does allow jumps which violate var-initialization rules still
  // but at most you get something that was already on the Lua stack
  bytecode_assert(S, pc + 1 + GETARG_sBx(inst) <= f->sizecode);
  bytecode_assert(S, pc + 1 + GETARG_sBx(inst) >= 0);
}

static void luai_verifycode(LoadState* S, Proto* f)
{
  // verify all instructions refer to in-range register, upval, and constant indexes
  // this is *not* meant to be bulletproof against multi-instruction constructs that
  // lead to misuse within the lua stack, but should catch reading off the end of
  // const/upval/funcproto lists with nonsensical arguments to VM opcodes.
  for (size_t i = 0; i < f->sizecode; i++)
  {
    Instruction inst = f->code[i];
    OpCode op = GET_OPCODE(inst);
    switch (op)
    {
      case OP_LOADK: // A Bx	R(A) := Kst(Bx)
        bytecode_assert(S, GETARG_A(inst) <= f->maxstacksize);
        bytecode_assert(S, GETARG_Bx(inst) <= f->sizek);
        break;

      case OP_LOADKX:// A 	R(A) := Kst(extra arg)
        bytecode_assert(S, GETARG_A(inst) <= f->maxstacksize);
        inst = f->code[++i];
        bytecode_assert(S, GET_OPCODE(inst) == OP_EXTRAARG);
        bytecode_assert(S, GETARG_Ax(inst) <= f->sizek)
        break;

      case OP_LOADBOOL:// A B C	R(A) := (Bool)B; if (C) pc++
        bytecode_assert(S, GETARG_A(inst) <= f->maxstacksize);
        bytecode_assert(S, GETARG_B(inst) == 0 || GETARG_B(inst) == 1);
        bytecode_assert(S, GETARG_C(inst) == 0 || GETARG_C(inst) == 1);
        // any op is valid next (unlike other skips), so validate as normal
        // commonly used with an opposite LOADBOOL so that a test/jmp pair
        // immediately before runs only one of them
        break;

      case OP_LOADNIL:// A B	R(A), R(A+1), ..., R(A+B) := nil
        bytecode_assert(S, GETARG_A(inst) <= f->maxstacksize);
        bytecode_assert(S, GETARG_A(inst) + GETARG_B(inst) <= f->maxstacksize);
        break;

      case OP_GETUPVAL:// A B	R(A) := UpValue[B]
        bytecode_assert(S, GETARG_A(inst) <= f->maxstacksize);
        bytecode_assert(S, GETARG_B(inst) <= f->sizeupvalues);
        break;

      case OP_GETTABUP://	A B C	R(A) := UpValue[B][RK(C)]
        bytecode_assert(S, GETARG_A(inst) <= f->maxstacksize);
        bytecode_assert(S, GETARG_B(inst) <= f->sizeupvalues);
        bytecode_assert(S, ISK(GETARG_C(inst)) ? INDEXK(GETARG_C(inst)) <= f->sizek : GETARG_C(inst) <= f->maxstacksize);
        break;

      case OP_SELF:// A B C	R(A+1) := R(B); R(A) := R(B)[RK(C)]
        bytecode_assert(S, GETARG_A(inst) + 1 <= f->maxstacksize);
        // fallthrough
      case OP_GETTABLE:// A B C	R(A) := R(B)[RK(C)]
        bytecode_assert(S, GETARG_A(inst) <= f->maxstacksize);
        bytecode_assert(S, GETARG_B(inst) <= f->maxstacksize);
        bytecode_assert(S, ISK(GETARG_C(inst)) ? INDEXK(GETARG_C(inst)) <= f->sizek : GETARG_C(inst) <= f->maxstacksize);
        break;

      case OP_SETTABUP:// A B C	UpValue[A][RK(B)] := RK(C)
        bytecode_assert(S, GETARG_A(inst) <= f->sizeupvalues);
        bytecode_assert(S, ISK(GETARG_B(inst)) ? INDEXK(GETARG_B(inst)) <= f->sizek : GETARG_B(inst) <= f->maxstacksize);
        bytecode_assert(S, ISK(GETARG_C(inst)) ? INDEXK(GETARG_C(inst)) <= f->sizek : GETARG_C(inst) <= f->maxstacksize);
        break;

      case OP_SETUPVAL:// A B	UpValue[B] := R(A)
        bytecode_assert(S, GETARG_A(inst) <= f->maxstacksize);
        bytecode_assert(S, GETARG_B(inst) <= f->sizeupvalues);
        break;

      case OP_NEWTABLE:// A B C	R(A) := {} (size = B,C)
        bytecode_assert(S, GETARG_A(inst) <= f->maxstacksize);
        break;

      case OP_SETTABLE://	A B C	R(A)[RK(B)] := RK(C)
      case OP_ADD:// A B C	R(A) := RK(B) + RK(C)
      case OP_SUB:// A B C	R(A) := RK(B) - RK(C)
      case OP_MUL:// A B C	R(A) := RK(B) * RK(C)
      case OP_DIV:// A B C	R(A) := RK(B) / RK(C)
      case OP_MOD:// A B C	R(A) := RK(B) % RK(C)
      case OP_POW:// A B C	R(A) := RK(B) ^ RK(C)
        bytecode_assert(S, GETARG_A(inst) <= f->maxstacksize);
        bytecode_assert(S, ISK(GETARG_B(inst)) ? INDEXK(GETARG_B(inst)) <= f->sizek : GETARG_B(inst) <= f->maxstacksize);
        bytecode_assert(S, ISK(GETARG_C(inst)) ? INDEXK(GETARG_C(inst)) <= f->sizek : GETARG_C(inst) <= f->maxstacksize);
        break;

      case OP_MOVE://	A B	R(A) := R(B)
      case OP_UNM: // A B	R(A) := -R(B)
      case OP_NOT: //	A B	R(A) := not R(B)
      case OP_LEN: //	A B	R(A) := length of R(B)
        bytecode_assert(S, GETARG_A(inst) <= f->maxstacksize);
        bytecode_assert(S, GETARG_B(inst) <= f->maxstacksize);
        break;

      case OP_CONCAT://	A B C	R(A) := R(B).. ... ..R(C)
        bytecode_assert(S, GETARG_A(inst) <= f->maxstacksize);
        bytecode_assert(S, GETARG_B(inst) <= f->maxstacksize);
        bytecode_assert(S, GETARG_C(inst) <= f->maxstacksize);
        bytecode_assert(S, GETARG_B(inst) < GETARG_C(inst));
        break;

      case OP_JMP:// A sBx	pc+=sBx; if (A) close all upvalues >= R(A) + 1
        verify_jump(S, i, inst, f);
        break;

      case OP_EQ:/*	A B C	if ((RK(B) == RK(C)) ~= A) then pc++		*/
      case OP_LT:/*	A B C	if ((RK(B) <  RK(C)) ~= A) then pc++		*/
      case OP_LE:/*	A B C	if ((RK(B) <= RK(C)) ~= A) then pc++		*/
        bytecode_assert(S, GETARG_A(inst) == 0 || GETARG_A(inst) == 1);
        bytecode_assert(S, ISK(GETARG_B(inst)) ? INDEXK(GETARG_B(inst)) <= f->sizek : GETARG_B(inst) <= f->maxstacksize);
        bytecode_assert(S, ISK(GETARG_C(inst)) ? INDEXK(GETARG_C(inst)) <= f->sizek : GETARG_C(inst) <= f->maxstacksize);
        inst = f->code[++i];
        bytecode_assert(S, GET_OPCODE(inst) == OP_JMP);
        verify_jump(S, i, inst, f);
        break;

      case OP_TEST:/*	A C	if not (R(A) <=> C) then pc++			*/
        bytecode_assert(S, GETARG_A(inst) <= f->maxstacksize);
        bytecode_assert(S, GETARG_C(inst) == 0 || GETARG_C(inst) == 1);
        inst = f->code[++i];
        bytecode_assert(S, GET_OPCODE(inst) == OP_JMP);
        verify_jump(S, i, inst, f);
        break;

      case OP_TESTSET:/*	A B C	if (R(B) <=> C) then R(A) := R(B) else pc++	*/
        bytecode_assert(S, GETARG_A(inst) <= f->maxstacksize);
        bytecode_assert(S, GETARG_B(inst) <= f->maxstacksize);
        bytecode_assert(S, GETARG_C(inst) == 0 || GETARG_C(inst) == 1);
        inst = f->code[++i];
        bytecode_assert(S, GET_OPCODE(inst) == OP_JMP);
        verify_jump(S, i, inst, f);
        break;

      case OP_CALL://	A B C	R(A), ... ,R(A+C-2) := R(A)(R(A+1), ... ,R(A+B-1)) if B=0 use top, if C=0 return var num results and set top
        if (GETARG_C(inst) == 0 || GETARG_C(inst) == 1) // C=1 call for 0 results
        {
          // at least function in a valid register
          bytecode_assert(S, GETARG_A(inst) <= f->maxstacksize);
        }
        else
        {
          // full return list in valid registers
          bytecode_assert(S, GETARG_A(inst) + GETARG_C(inst) - 2 <= f->maxstacksize);
        }
        // fallthrough
      case OP_TAILCALL://	A B C	return R(A)(R(A+1), ... ,R(A+B-1)) if B=0 use top
        if (GETARG_B(inst) == 0 || GETARG_B(inst) == 1) // B=1 call with 0 args
        {
          // at least function in a valid register
          bytecode_assert(S, GETARG_A(inst) <= f->maxstacksize);
        }
        else
        {
          // full arg list in valid registers
          bytecode_assert(S, GETARG_A(inst) + GETARG_B(inst) - 1 <= f->maxstacksize);
        }
        break;

      case OP_RETURN:// A B	return R(A), ... ,R(A+B-2)	if B=0 use actual top
        if (GETARG_B(inst) == 0)
        {
          // at least *start* in a valid register
          bytecode_assert(S, GETARG_A(inst) <= f->maxstacksize);
        }
        else if (GETARG_B(inst) != 1) // B=1 returns no results, ignoring A entirely
        {
          bytecode_assert(S, GETARG_A(inst) + GETARG_B(inst) - 2 <= f->maxstacksize);
        }
        break;

      case OP_FORLOOP:// A sBx	R(A)+=R(A+2); if R(A) <?= R(A+1) then { pc+=sBx; R(A+3)=R(A) }
        bytecode_assert(S, GETARG_A(inst) + 3 <= f->maxstacksize);
        verify_jump(S, i, inst, f); // verifies R(A) and pc+=sBx
        break;

      case OP_FORPREP:// A sBx	R(A)-=R(A+2); pc+=sBx
        bytecode_assert(S, GETARG_A(inst) + 2 <= f->maxstacksize);
        verify_jump(S, i, inst, f); // verifies R(A) and pc+=sBx
        break;

      case OP_TFORCALL:// A C	R(A+3), ... ,R(A+2+C) := R(A)(R(A+1), R(A+2))
        bytecode_assert(S, GETARG_A(inst) <= f->maxstacksize);
        bytecode_assert(S, GETARG_A(inst) + 2 <= f->maxstacksize);
        bytecode_assert(S, GETARG_A(inst) + GETARG_C(inst) + 2 <= f->maxstacksize);
        inst = f->code[++i];
        //OP_TFORLOOP: A sBx	if R(A+1) ~= nil then { R(A)=R(A+1); pc += sBx }
        bytecode_assert(S, GET_OPCODE(inst) == OP_TFORLOOP);
        bytecode_assert(S, GETARG_A(inst) + 1 <= f->maxstacksize);
        verify_jump(S, i, inst, f); // verifies R(A) and pc+=sBx
        break;

      case OP_SETLIST:// A B C	R(A)[(C-1)*FPF+i] := R(A+i), 1 <= i <= B if B=0 use top, if C=0 use EXTRAARG
        if (GETARG_B(inst) == 0)
        {
          // at least *start* in a valid register
          bytecode_assert(S, GETARG_A(inst) <= f->maxstacksize);
        }
        else
        {
          bytecode_assert(S, GETARG_A(inst) + GETARG_B(inst) <= f->maxstacksize);
        }        
        // any C is valid, but if it's 0, verify EXTRAARG
        if (GETARG_C(inst) == 0)
        {
          inst = f->code[++i];
          bytecode_assert(S, GET_OPCODE(inst) == OP_EXTRAARG);
        }
        break;

      case OP_CLOSURE:// A Bx	R(A) := closure(KPROTO[Bx])
        bytecode_assert(S, GETARG_A(inst) <= f->maxstacksize);
        bytecode_assert(S, GETARG_Bx(inst) <= f->sizep);
        break;

      case OP_VARARG:// A B	R(A), R(A+1), ..., R(A+B-2) = vararg, if B==0 then actual num of vararg and set top
        // start in a valid register
        bytecode_assert(S, GETARG_A(inst) <= f->maxstacksize);
        if (GETARG_B(inst) != 0)
        {
          bytecode_assert(S, GETARG_B(inst) != 1); // vararg for no results is nonsense, it sets no registers
          bytecode_assert(S, GETARG_A(inst) + GETARG_B(inst) - 2 <= f->maxstacksize);
        }
        break;

      case OP_TFORLOOP: // TFORLOOP will always be immediately after TFORCALL and verified/consumed by it, it should never appear on its own
      case OP_EXTRAARG: // EXTRAARG will always be consumed by the instruction before it, it should never appear on its own
      default:          // invalid opcodes
        bytecode_assert(S, 0);
        break;
    }
  }
}


static void LoadBlock(LoadState* S, void* b, size_t size)
{
 if (luaZ_read(S->Z,b,size)!=0) error(S,"truncated");
}

static int LoadChar(LoadState* S)
{
 char x;
 LoadVar(S,x);
 return x;
}

static int LoadInt(LoadState* S)
{
 int x;
 LoadVar(S,x);
 if (x<0) error(S,"corrupted");
 return x;
}

static lua_Number LoadNumber(LoadState* S)
{
 lua_Number x;
 LoadVar(S,x);
 return x;
}

static TString* LoadString(LoadState* S)
{
 size_t size;
 LoadVar(S,size);
 if (size==0)
  return NULL;
 else
 {
  char* s=luaZ_openspace(S->L,S->b,size);
  LoadBlock(S,s,size*sizeof(char));
  return luaS_newlstr(S->L,s,size-1);		/* remove trailing '\0' */
 }
}

static void LoadCode(LoadState* S, Proto* f)
{
 int n=LoadInt(S);
 f->code=luaM_newvector(S->L,n,Instruction);
 f->sizecode=n;
 LoadVector(S,f->code,n,sizeof(Instruction));
}

static void LoadFunction(LoadState* S, Proto* f);

static void LoadConstants(LoadState* S, Proto* f)
{
 int i,n;
 n=LoadInt(S);
 f->k=luaM_newvector(S->L,n,TValue);
 f->sizek=n;
 for (i=0; i<n; i++) setnilvalue(&f->k[i]);
 for (i=0; i<n; i++)
 {
  TValue* o=&f->k[i];
  int t=LoadChar(S);
  switch (t)
  {
   case LUA_TNIL:
	setnilvalue(o);
	break;
   case LUA_TBOOLEAN:
	setbvalue(o,LoadChar(S));
	break;
   case LUA_TNUMBER:
	setnvalue(o,LoadNumber(S));
	break;
   case LUA_TSTRING:
	setsvalue2n(S->L,o,LoadString(S));
	break;
    default: lua_assert(0);
  }
 }
 n=LoadInt(S);
 f->p=luaM_newvector(S->L,n,Proto*);
 f->sizep=n;
 for (i=0; i<n; i++) f->p[i]=NULL;
 for (i=0; i<n; i++)
 {
  f->p[i]=luaF_newproto(S->L);
  LoadFunction(S,f->p[i]);
 }
}

static void LoadUpvalues(LoadState* S, Proto* f)
{
 int i,n;
 n=LoadInt(S);
 f->upvalues=luaM_newvector(S->L,n,Upvaldesc);
 f->sizeupvalues=n;
 for (i=0; i<n; i++) f->upvalues[i].name=NULL;
 for (i=0; i<n; i++)
 {
  f->upvalues[i].instack=LoadByte(S);
  f->upvalues[i].idx=LoadByte(S);
 }
}

static void LoadDebug(LoadState* S, Proto* f)
{
 int i,n;
 f->source=LoadString(S);
 n=LoadInt(S);
 f->lineinfo=luaM_newvector(S->L,n,int);
 f->sizelineinfo=n;
 LoadVector(S,f->lineinfo,n,sizeof(int));
 n=LoadInt(S);
 f->locvars=luaM_newvector(S->L,n,LocVar);
 f->sizelocvars=n;
 for (i=0; i<n; i++) f->locvars[i].varname=NULL;
 for (i=0; i<n; i++)
 {
  f->locvars[i].varname=LoadString(S);
  f->locvars[i].startpc=LoadInt(S);
  f->locvars[i].endpc=LoadInt(S);
 }
 n=LoadInt(S);
 for (i=0; i<n; i++) f->upvalues[i].name=LoadString(S);
}

static void LoadFunction(LoadState* S, Proto* f)
{
 f->linedefined=LoadInt(S);
 f->lastlinedefined=LoadInt(S);
 f->numparams=LoadByte(S);
 f->is_vararg=LoadByte(S);
 f->maxstacksize=LoadByte(S);
 LoadCode(S,f);
 LoadConstants(S,f);
 LoadUpvalues(S,f);
 LoadDebug(S,f);
}

/* the code below must be consistent with the code in luaU_header */
#define N0	LUAC_HEADERSIZE
#define N1	(sizeof(LUA_SIGNATURE)-sizeof(char))
#define N2	N1+2
#define N3	N2+6

static void LoadHeader(LoadState* S)
{
 lu_byte h[LUAC_HEADERSIZE];
 lu_byte s[LUAC_HEADERSIZE];
 luaU_header(h);
 memcpy(s,h,sizeof(char));			/* first char already read */
 LoadBlock(S,s+sizeof(char),LUAC_HEADERSIZE-sizeof(char));
 if (memcmp(h,s,N0)==0) return;
 if (memcmp(h,s,N1)!=0) error(S,"not a");
 if (memcmp(h,s,N2)!=0) error(S,"version mismatch in");
 if (memcmp(h,s,N3)!=0) error(S,"incompatible"); else error(S,"corrupted");
}

/*
** load precompiled chunk
*/
Closure* luaU_undump (lua_State* L, ZIO* Z, Mbuffer* buff, const char* name)
{
 LoadState S;
 Closure* cl;
 if (*name=='@' || *name=='=')
  S.name=name+1;
 else if (*name==LUA_SIGNATURE[0])
  S.name="binary string";
 else
  S.name=name;
 S.L=L;
 S.Z=Z;
 S.b=buff;
 LoadHeader(&S);
 cl=luaF_newLclosure(L,1);
 setclLvalue(L,L->top,cl); incr_top(L);
 cl->l.p=luaF_newproto(L);
 LoadFunction(&S,cl->l.p);
 if (cl->l.p->sizeupvalues != 1)
 {
  Proto* p=cl->l.p;
  cl=luaF_newLclosure(L,cl->l.p->sizeupvalues);
  cl->l.p=p;
  setclLvalue(L,L->top-1,cl);
 }
 luai_verifycode(&S,cl->l.p);
 return cl;
}

#define MYINT(s)	(s[0]-'0')
#define VERSION		MYINT(LUA_VERSION_MAJOR)*16+MYINT(LUA_VERSION_MINOR)
#define FORMAT		0		/* this is the official format */

/*
* make header for precompiled chunks
* if you change the code below be sure to update LoadHeader and FORMAT above
* and LUAC_HEADERSIZE in lundump.h
*/
void luaU_header (lu_byte* h)
{
 int x=1;
 memcpy(h,LUA_SIGNATURE,sizeof(LUA_SIGNATURE)-sizeof(char));
 h+=sizeof(LUA_SIGNATURE)-sizeof(char);
 *h++=cast_byte(VERSION);
 *h++=cast_byte(FORMAT);
 *h++=cast_byte(*(char*)&x);			/* endianness */
 *h++=cast_byte(sizeof(int));
 *h++=cast_byte(sizeof(size_t));
 *h++=cast_byte(sizeof(Instruction));
 *h++=cast_byte(sizeof(lua_Number));
 *h++=cast_byte(((lua_Number)0.5)==0);		/* is lua_Number integral? */
 memcpy(h,LUAC_TAIL,sizeof(LUAC_TAIL)-sizeof(char));
}
