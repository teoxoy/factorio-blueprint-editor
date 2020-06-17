/*
** $Id: ltable.c,v 2.71 2012/05/23 15:37:09 roberto Exp $
** Lua tables (hash)
** See Copyright Notice in lua.h
*/


/*
** Implementation of tables (aka arrays, objects, or hash tables).
** Tables keep its elements in two parts: an array part and a hash part.
** Non-negative integer keys are all candidates to be kept in the array
** part. The actual size of the array is the largest `n' such that at
** least half the slots between 0 and n are in use.
** Hash uses a mix of chained scatter table with Brent's variation.
** A main invariant of these tables is that, if an element is not
** in its main position (i.e. the `original' position that its hash gives
** to it), then the colliding element is in its own main position.
** Hence even when the load factor reaches 100%, performance remains good.
*/

#include <string.h>

#define ltable_c
#define LUA_CORE

#include "lua.h"

#include "ldebug.h"
#include "ldo.h"
#include "lgc.h"
#include "lmem.h"
#include "lobject.h"
#include "lstate.h"
#include "lstring.h"
#include "ltable.h"
#include "lvm.h"


/*
** max size of array part is 2^MAXBITS
*/
#if LUAI_BITSINT >= 32
#define MAXBITS		30
#else
#define MAXBITS		(LUAI_BITSINT-2)
#endif

#define MAXABITS	LUA_MAX_SEQUENTIAL_ARRAY_SIZE_BITS
#define MAXASIZE	(1 << MAXABITS)


#define hashpow2(t,n)		(gnode(t, lmod((n), sizenode(t))))

#define hashstr(t,str)		hashpow2(t, (str)->tsv.hash)
#define hashboolean(t,p)	hashpow2(t, p)


/*
** for some types, it is better to avoid modulus by power of 2, as
** they tend to have many 2 factors.
*/
#define hashmod(t,n)	(gnode(t, ((n) % ((sizenode(t)-1)|1))))


#define hashpointer(t,p)	hashmod(t, IntPoint(p))


#define dummynode		(&dummynode_)

#define isdummy(n)		((n) == dummynode)

static const Node dummynode_ = {
  {NILCONSTANT},  /* value */
  {{NILCONSTANT, NULL}}, /* key */
  NULL, NULL /* next, prev */
};


/*
** hash for lua_Numbers
*/
static Node *hashnum (const Table *t, lua_Number n) {
  int i;
  luai_hashnum(i, n);
  if (i < 0) {
    if (cast(unsigned int, i) == 0u - i)  /* use unsigned to avoid overflows */
      i = 0;  /* handle INT_MIN */
    i = -i;  /* must be a positive value */
  }
  return hashmod(t, i);
}



/*
** returns the `main' position of an element in a table (that is, the index
** of its hash value)
*/
static Node *mainposition (const Table *t, const TValue *key) {
  switch (ttype(key)) {
    case LUA_TNUMBER:
      return hashnum(t, nvalue(key));
    case LUA_TLNGSTR: {
      TString *s = rawtsvalue(key);
      if (s->tsv.extra == 0) {  /* no hash? */
        s->tsv.hash = luaS_hash(getstr(s), s->tsv.len, s->tsv.hash);
        s->tsv.extra = 1;  /* now it has its hash */
      }
      return hashstr(t, rawtsvalue(key));
    }
    case LUA_TSHRSTR:
      return hashstr(t, rawtsvalue(key));
    case LUA_TBOOLEAN:
      return hashboolean(t, bvalue(key));
    case LUA_TLIGHTUSERDATA:
      return hashpointer(t, pvalue(key));
    case LUA_TLCF:
      return hashpointer(t, fvalue(key));
    default:
      return hashpointer(t, gcvalue(key));
  }
}


/*
** returns the index for `key' if `key' is an appropriate key to live in
** the array part of the table, -1 otherwise.
*/
static int arrayindex (const TValue *key) {
  if (ttisnumber(key)) {
    lua_Number n = nvalue(key);
    int k;
    lua_number2int(k, n);
    if (luai_numeq(cast_num(k), n))
      return k;
  }
  return -1;  /* `key' did not match some condition */
}


/*
** returns the index of a `key' for table traversals. First goes all
** elements in the array part, then elements in the hash part. The
** beginning of a traversal is signaled by -1.
*/
static int findindex (lua_State *L, Table *t, StkId key) {
  int i;
  if (ttisnil(key)) return -1;  /* first iteration */
  i = arrayindex(key);
  if (0 < i && i <= t->sizearray)  /* is `key' inside array part? */
    return i-1;  /* yes; that's the index (corrected to C) */
  else {
    Node *n = mainposition(t, key);
    for (;;) {  /* check whether `key' is somewhere in the chain */
      /* key may be dead already, but it is ok to use it in `next' */
      if (luaV_rawequalobj(gkey(n), key) ||
            (ttisdeadkey(gkey(n)) && iscollectable(key) &&
             deadvalue(gkey(n)) == gcvalue(key))) {
        i = cast_int(n - gnode(t, 0));  /* key index in hash table */
        /* hash elements are numbered after array ones */
        return i + t->sizearray;
      }
      else n = gnext(n);
      if (n == NULL)
        luaG_runerror(L, "invalid key to " LUA_QL("next"));  /* key not found */
    }
  }
}


int luaH_next (lua_State *L, Table *t, StkId key) {
  int found = findindex(L, t, key);  /* find original element */
  int i;
  Node *n;

  for (i = found + 1; i < t->sizearray; i++) {  /* try first array part */
    if (!ttisnil(&t->array[i])) {  /* a non-nil value? */
      setnvalue(key, cast_num(i+1));
      setobj2s(L, key+1, &t->array[i]);
      return 1;
    }
  }

  if (found >= t->sizearray)
    n = gnode(t, found - t->sizearray)->next; // We have a predecessor in the hash part
  else
    n = t->firstadded; // Either there is no predecessor, or it is numeric

  while (n)
  {
    if (!ttisnil(gval(n))) {
      setobj2s(L, key, gkey(n));
      setobj2s(L, key+1, gval(n));
      return 1;
    }
    n = n->next;
  }
  return 0;  /* no more elements */
}

int luaH_size (Table *t, int fuzzy) {
  int result = 0;
  int found = -1;

  if (!fuzzy)
  {
    for (int i = found + 1; i < t->sizearray; i++)
      if (!ttisnil(&t->array[i])) /* a non-nil value? */
        ++result;
  }
  else
    result += t->sizearray;

  Node *n;
  if (found >= t->sizearray)
    n = gnode(t, found - t->sizearray)->next; // We have a predecessor in the hash part
  else
    n = t->firstadded; // Either there is no predecessor, or it is numeric

  while (n)
  {
    if (!ttisnil(gval(n)))
      ++result;
    n = n->next;
  }

  return result;
}


/*
** {=============================================================
** Rehash
** ==============================================================
*/

static void setarrayvector (lua_State *L, Table *t, int size) {
  int i;
  luaM_reallocvector(L, t->array, t->sizearray, size, TValue);
  for (i=t->sizearray; i<size; i++)
     setnilvalue(&t->array[i]);
  t->sizearray = size;
}


static void setnodevector (lua_State *L, Table *t, int size) {
  int lsize;
  if (size == 0) {  /* no elements to hash part? */
    t->node = cast(Node *, dummynode);  /* use common `dummynode' */
    lsize = 0;
  }
  else {
    int i;
    lsize = luaO_ceillog2(size);
    if (lsize > MAXBITS)
      luaG_runerror(L, "table overflow");
    size = twoto(lsize);
    t->node = luaM_newvector(L, size, Node);
    for (i=0; i<size; i++) {
      Node *n = gnode(t, i);
      gnext(n) = NULL;
      setnilvalue(gkey(n));
      setnilvalue(gval(n));
      n->next = NULL;
      n->prev = NULL;
    }
  }
  t->lsizenode = cast_byte(lsize);
  t->lastfree = gnode(t, size);  /* all positions are free */
}


void luaH_resize (lua_State *L, Table *t, int nasize, int nhsize) {
  int i;
  int oldasize = t->sizearray;
  int oldhsize = t->lsizenode;

  if (nasize > MAXASIZE)
    nasize = MAXASIZE;

  Node* n = t->firstadded;
  Node *nold = t->node;  /* save old hash ... */
  if (nasize > oldasize)  /* array part must grow? */
    setarrayvector(L, t, nasize);
  /* create new hash part with appropriate size */
  setnodevector(L, t, nhsize);
  if (nasize < oldasize) {  /* array part must shrink? */
    t->sizearray = nasize;
    /* re-insert elements from vanishing slice */
    for (i=nasize; i<oldasize; i++) {
      if (!ttisnil(&t->array[i]))
        luaH_setint(L, t, i + 1, &t->array[i]);
    }
    /* shrink array */
    luaM_reallocvector(L, t->array, oldasize, nasize, TValue);
  }
  t->firstadded = NULL;
  t->lastadded = NULL;
  /* re-insert elements from hash part */
  while (n) {
    if (!ttisnil(gval(n))) {
      /* doesn't need barrier/invalidate cache, as entry was
         already present in the table */
      setobjt2t(L, luaH_set(L, t, gkey(n)), gval(n));
    }
    n = n->next;
  }
  if (!isdummy(nold))
    luaM_freearray(L, nold, cast(size_t, twoto(oldhsize))); /* free old array */
}


void luaH_resizearray (lua_State *L, Table *t, int nasize) {
  int nsize = isdummy(t->node) ? 0 : sizenode(t);
  luaH_resize(L, t, nasize, nsize);
}

/** Resize the arrray and hash part so that it fits the data.
 * numkey is the largest numeric key that needs to fit the array part
 * (numkey <= MAXASIZE) or 0 if we are not rehashing because of numeric keys. */
static void rehash (lua_State *L, Table *t, int numkey) {
  int nasize;
  int nhsize;
  Node* n;

  nasize = numkey==0 ? t->sizearray : twoto(luaO_ceillog2(numkey > t->sizearray ? numkey : t->sizearray));

  nhsize = 0;
  n = t->firstadded;
  while (n) {
    if (!ttisnil(gval(n)))
      ++nhsize;
    n = n->next;
  }
  luaH_resize(L, t, nasize, nhsize + 1); /* The +1 here makes sure that we have space for the new key (if there was one) */
}



/*
** }=============================================================
*/

void disconnectnode (Table *t, Node *n) {
    if (n->prev)
      n->prev->next = n->next;
    else if (t->firstadded == n)
      t->firstadded = n->next;

    if (n->next)
      n->next->prev = n->prev;
    else if (t->lastadded == n)
      t->lastadded = n->prev;

    n->next = NULL;
    n->prev = NULL;
}

void appendnode (Table *t, Node *n) {
  n->prev = t->lastadded;
  n->next = NULL;
  lua_assert(t->lastadded != n);
  if (t->lastadded) t->lastadded->next = n;
  if (!t->firstadded) t->firstadded = n;
  t->lastadded = n;
}

void checknilnode (Table *t, Node* n) {
  if (!ttisnil(gval(n)))
    /* If the node was not deleted then we don't need to move the node anywhere */
    return;

  /* If on the other hand the node had nil, then we reconnect it as a last one. */
  disconnectnode(t, n);
  appendnode(t, n);

}

Table *luaH_new (lua_State *L) {
  Table *t = &luaC_newobj(L, LUA_TTABLE, sizeof(Table), NULL, 0)->h;
  t->metatable = NULL;
  t->flags = cast_byte(~0);
  t->array = NULL;
  t->sizearray = 0;
  t->firstadded = NULL;
  t->lastadded = NULL;
  setnodevector(L, t, 0);
  return t;
}


void luaH_free (lua_State *L, Table *t) {
  if (!isdummy(t->node))
    luaM_freearray(L, t->node, cast(size_t, sizenode(t)));
  luaM_freearray(L, t->array, t->sizearray);
  luaM_free(L, t);
}


static Node *getfreepos (Table *t) {
  while (t->lastfree > t->node) {
    t->lastfree--;
    if (ttisnil(gkey(t->lastfree)))
      return t->lastfree;
  }
  return NULL;  /* could not find a free place */
}



/*
** inserts a new key into a hash table; first, check whether key's main
** position is free. If not, check whether colliding node is in its main
** position or not: if it is not, move colliding node to an empty place and
** put new key in its main position; otherwise (colliding node is in its main
** position), new key goes to an empty position.
*/
TValue *luaH_newkey (lua_State *L, Table *t, const TValue *key) {
  Node *mp;
  if (ttisnil(key)) luaG_runerror(L, "table index is nil");
  else if (ttisnumber(key) && luai_numisnan(L, nvalue(key)))
    luaG_runerror(L, "table index is NaN");
  mp = mainposition(t, key);
  if (!ttisnil(gval(mp)) || isdummy(mp)) {  /* main position is taken? */
    Node *othern;
    Node *n = getfreepos(t);  /* get a free place */
    if (n == NULL) {  /* cannot find a free place? */
      rehash(L, t, 0);  /* grow table */
      /* whatever called 'newkey' take care of TM cache and GC barrier */
      return luaH_set(L, t, key);  /* insert key into grown table */
    }
    lua_assert(!n->next && !n->prev);
    lua_assert(!isdummy(n));
    othern = mainposition(t, gkey(mp));
    if (othern != mp) {  /* is colliding node out of its main position? */
      /* yes; move colliding node into free position */
      while (gnext(othern) != mp) othern = gnext(othern);  /* find previous */
      gnext(othern) = n;  /* redo the chain with `n' in place of `mp' */
      *n = *mp;  /* copy colliding node into free pos. (mp->next also goes) */

      if (mp->prev)
        mp->prev->next = n;
      else if (mp == t->firstadded)
        t->firstadded = n;

      if (mp->next)
        mp->next->prev = n;
      else if (mp == t->lastadded)
        t->lastadded = n;
      mp->prev = mp->next = NULL;

      gnext(mp) = NULL;  /* now `mp' is free */
      setnilvalue(gval(mp));
    }
    else {  /* colliding node is in its own main position */
      /* new node will go into free position */
      gnext(n) = gnext(mp);  /* chain new position */
      gnext(mp) = n;
      mp = n;
    }
  }
  if (mp->prev || mp->next) {
    /* if the node was used before we will need to disconnect it from the insertion
     * chain before connecting it again */
    disconnectnode(t, mp);
  }
  else if (t->firstadded == mp) {
    lua_assert(t->lastadded == mp);
    t->firstadded = t->lastadded = NULL;
  }

  appendnode(t, mp);

  setobj2t(L, gkey(mp), key);
  luaC_barrierback(L, obj2gco(t), key);
  lua_assert(ttisnil(gval(mp)));
  return gval(mp);
}


/*
** search function for integers
* If L is NULL, then the caller promisses that they won't try to write to the value.
*/
const TValue *luaH_getint (lua_State *L, Table *t, int key) {
  if (key >= 1 && key <= MAXASIZE) {
    if (key > t->sizearray) {
      if (L)
        rehash(L, t, key);
      else
        return luaO_nilobject;
    }

    lua_assert(key >=1 && key <= t->sizearray);
    return &t->array[key-1];
  }
  else {
    lua_assert(key < 1 || key > MAXASIZE);
    lua_Number nk = cast_num(key);
    Node *n = hashnum(t, nk);
    do {  /* check whether `key' is somewhere in the chain */
      if (ttisnumber(gkey(n)) && luai_numeq(nvalue(gkey(n)), nk))
      {
        checknilnode(t, n);
        return gval(n);  /* that's it */
      }
      else n = gnext(n);
    } while (n);
    return luaO_nilobject;
  }
}


/*
** search function for short strings
*/
const TValue *luaH_getstr (Table *t, TString *key) {
  Node *n = hashstr(t, key);
  lua_assert(key->tsv.tt == LUA_TSHRSTR);
  do {  /* check whether `key' is somewhere in the chain */
    if (ttisshrstring(gkey(n)) && eqshrstr(rawtsvalue(gkey(n)), key)) {
      checknilnode(t, n);
      return gval(n);  /* that's it */
    }
    else n = gnext(n);
  } while (n);
  return luaO_nilobject;
}


/*
** main search function
*/
const TValue *luaH_get (lua_State *L, Table *t, const TValue *key) {
  switch (ttype(key)) {
    case LUA_TNIL: return luaO_nilobject;
    case LUA_TSHRSTR: return luaH_getstr(t, rawtsvalue(key));
    case LUA_TNUMBER: {
      int k;
      lua_Number n = nvalue(key);
      lua_number2int(k, n);
      if (luai_numeq(cast_num(k), nvalue(key))) /* index is int? */
        return luaH_getint(L, t, k);  /* use specialized version */
      /* else go through */
    }
    default: {
      Node *n = mainposition(t, key);
      do {  /* check whether `key' is somewhere in the chain */
        if (luaV_rawequalobj(gkey(n), key)) {
          checknilnode(t, n);
          return gval(n);  /* that's it */
        }
        else n = gnext(n);
      } while (n);
      return luaO_nilobject;
    }
  }
}


/*
** beware: when using this function you probably need to check a GC
** barrier and invalidate the TM cache.
*/
TValue *luaH_set (lua_State *L, Table *t, const TValue *key) {
  const TValue *p = luaH_get(L, t, key);
  if (p != luaO_nilobject)
    return cast(TValue *, p);
  else return luaH_newkey(L, t, key);
}


void luaH_setint (lua_State *L, Table *t, int key, TValue *value) {
  const TValue *p = luaH_getint(L, t, key);
  TValue *cell;
  if (p != luaO_nilobject)
    cell = cast(TValue *, p);
  else {
    TValue k;
    setnvalue(&k, cast_num(key));
    cell = luaH_newkey(L, t, &k);
  }
  setobj2t(L, cell, value);
}


// insert a list of values from stack to the table, 
// with sequential integer keys in the table starting at `firstkey`,
// and values from the stack starting at `firstval`
void luaH_setlist(lua_State *L, Table *t, unsigned int firstkey, StkId firstval, unsigned int count)
{
  if (firstkey < 1)
    luaG_runerror(L, "invalid firstkey to " LUA_QL("setlist"));
  // if SETLIST follows an open CALL (or similar) that ends up returning zero results
  // count will still be zero. There is nothing to do in this case.
  if (count == 0)
    return;
  if (count < 1)
    luaG_runerror(L, "invalid count to " LUA_QL("setlist"));


  int i = 0;
  int last = firstkey + count - 1;

  // if any part of this list can be array part, resize the array to fit it
  int newasize = t->sizearray;
  if (firstkey <= (1 << LUA_MAX_SEQUENTIAL_ARRAY_SIZE_BITS) && last > t->sizearray)
    newasize = last <= (1 << LUA_MAX_SEQUENTIAL_ARRAY_SIZE_BITS) ? last : (1 << LUA_MAX_SEQUENTIAL_ARRAY_SIZE_BITS);

  // how much overflows into hash part?
  int hgrow = 0;
  if (firstkey > newasize)
  {
    hgrow = count;
  }
  else if (firstkey < newasize && last > newasize)
  {
    hgrow = last - newasize;
  }

  // does the overflow require rehashing?
  int newhsize = sizenode(t);
  if (hgrow > 0)
  {
    // if lastfree is too tight, just assume it's full and go to the next bigger size...
    if ((t->lastfree - t->node) < hgrow*2)
    {
      newhsize += hgrow;
    }
    else // otherwise count the freespace to see if there's enough
    {
      int neededspace = hgrow;
      Node* lastfree = t->lastfree;
      while (lastfree > t->node) {
        lastfree--;
        if (ttisnil(gkey(lastfree)))
        {
          neededspace--;
          if (neededspace == 0)
            break;
        }
      }
      if (neededspace > 0)
      {
        newhsize += neededspace;
      }
    }
  }
  
  // resize will always rehash anyway, so do it all at once, and only if really needed
  if (newasize > t->sizearray || newhsize > sizenode(t))
    luaH_resize(L, t, newasize, newhsize);
  
  // if any fits in array part, just copy them in
  while (i < count && firstkey+i <= t->sizearray)
  {
    setobj2t(L, &t->array[firstkey + i - 1], firstval + i);
    luaC_barrierback(L, obj2gco(t), firstval + i);
    i++;
  }

  // any left for hash part?
  while (i < count)
  {
    lua_Number nk = cast_num(firstkey + i);
    Node *n = hashnum(t, nk);
    TValue *p = NULL;
    do {  /* check whether `key' is somewhere in the chain */
      if (ttisnumber(gkey(n)) && luai_numeq(nvalue(gkey(n)), nk))
      {
        checknilnode(t, n);
        p = gval(n);  /* that's it */
        break;
      }
      else n = gnext(n);
    } while (n);

    if (!p)
    {
      TValue k;
      setnvalue(&k, nk);
      p = luaH_newkey(L, t, &k);
    }
    setobj2t(L, p, firstval + i);
    luaC_barrierback(L, obj2gco(t), firstval + i);
    i++;
  }
}

static int unbound_search (Table *t, unsigned int j) {
  unsigned int i = j;  /* i is zero or a present index */
  j++;
  /* find `i' and `j' such that i is present and j is not */
  while (!ttisnil(luaH_getint(NULL, t, j))) {
    i = j;
    j *= 2;
    if (j > cast(unsigned int, MAX_INT)) {  /* overflow? */
      /* table was built with bad purposes: resort to linear search */
      i = 1;
      while (!ttisnil(luaH_getint(NULL, t, i))) i++;
      return i - 1;
    }
  }
  /* now do a binary search between them */
  while (j - i > 1) {
    unsigned int m = (i+j)/2;
    if (ttisnil(luaH_getint(NULL, t, m))) j = m;
    else i = m;
  }
  return i;
}


/*
** Try to find a boundary in table `t'. A `boundary' is an integer index
** such that t[i] is non-nil and t[i+1] is nil (and 0 if t[1] is nil).
*/
int luaH_getn (Table *t) {
  unsigned int j = t->sizearray;
  if (j > 0 && ttisnil(&t->array[j - 1])) {
    /* there is a boundary in the array part: (binary) search for it */
    unsigned int i = 0;
    while (j - i > 1) {
      unsigned int m = (i+j)/2;
      if (ttisnil(&t->array[m - 1])) j = m;
      else i = m;
    }
    return i;
  }
  /* else must find a boundary in hash part */
  else if (isdummy(t->node))  /* hash part is empty? */
    return j;  /* that is easy... */
  else return unbound_search(t, j);
}



#if defined(LUA_DEBUG)

Node *luaH_mainposition (const Table *t, const TValue *key) {
  return mainposition(t, key);
}

int luaH_isdummy (Node *n) { return isdummy(n); }

#endif
