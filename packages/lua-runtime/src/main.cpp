#include <stdlib.h>
#include <lua/lua.h>
#include <lua/lualib.h>
#include <lua/lauxlib.h>
#include <lua-rapidjson/rapidjson.hpp>
#include <stdio.h>
#include <string.h>
#include <string>

typedef bool isLualibFn(const char*);
isLualibFn* isLualib;

typedef char* getFileFn(const char*, const char*, bool);
getFileFn* getFile;

extern "C" {
    void passIsLualibFnPtr(isLualibFn ptr) {
        isLualib = *ptr;
    }
    void passGetFileFnPtr(getFileFn ptr) {
        getFile = *ptr;
    }
}

int scriptLog(lua_State* L) {
    const char *text = luaL_checkstring(L, 1);

    lua_Debug ar;
    lua_getstack(L, 1, &ar);
    lua_getinfo(L, "S", &ar);
    printf("Log in module '%s': %s\n", ar.source, text);

    return 0;
}

int getTableSize(lua_State* L) {
    luaL_checktype(L, -1, LUA_TTABLE);
    lua_pushnumber(L, lua_tablesize(L, -1, 0));
    return 1;
}

// #define fatal(fmt, ...) (fprintf(stderr, fmt, __VA_ARGS__), fflush(stderr), abort())

void load_module(lua_State* L, const char* name, const char* content) {
    if (luaL_loadbufferx(L, content, strlen(content), name, "t") || lua_pcall(L, 0, 1, 0)) {
        luaL_error(L, "Error occurred in module '%s': %s\n", name, lua_tostring(L, -1));
    }
}

const char* getModName(lua_State* L, const char* moduleName) {
    if (isLualib(moduleName)) {
        return "lualib";
    }
    lua_getglobal(L, "__MOD_NAME__");
    const char *__MOD_NAME__ = luaL_checkstring(L, -1);
    lua_pop(L, -1);
    return __MOD_NAME__;
}

void require(lua_State* L, bool errOnNotFound) {
    const char *name = luaL_checkstring(L, 1);
    lua_pop(L, 1); /* remove name */

    const char *__MOD_NAME__ = getModName(L, name);

    std::string cacheKeyStr(std::string(name) + __MOD_NAME__);
    const char *identifier = cacheKeyStr.c_str();

    lua_getglobal(L, "package"); /* package */
    lua_getfield(L, -1, "loaded"); /* package.loaded */
    lua_remove(L, -2); /* remove package */
    lua_getfield(L, -1, identifier); /* package.loaded[name] */

    if (lua_toboolean(L, -1)) /* is it there? */
        return; /* package is already loaded */
    /* else must load package */
    lua_pop(L, 1); /* remove 'getfield' result */

    char *content = getFile(name, __MOD_NAME__, errOnNotFound);
    load_module(L, identifier, content);
    free(content);

    if (lua_isnil(L, -1)) { /* module did not set a value? */
        lua_pop(L, 1); /* remove nil */
        lua_pushboolean(L, 1); /* use true as result */
    }

    lua_setfield(L, -2, identifier); /* package.loaded[name] = returned value */
    lua_getfield(L, -1, identifier); /* return value */
}

int packageRequire(lua_State* L) {
    require(L, true);
    return 1;
}

int packageOptRequire(lua_State* L) {
    require(L, false);
    return 1;
}

extern "C" {
    const char* run(const char* script) {
        lua_State* L = luaL_newstate();
        luaL_openlibs(L);

        luaopen_rapidjson(L);
        lua_setglobal(L, "rapidjson");

        lua_pushcfunction(L, scriptLog);
        lua_rawsetglobal(L, "log");

        lua_pushcfunction(L, getTableSize);
        lua_rawsetglobal(L, "table_size");

        lua_newtable(L);
        lua_rawsetglobal(L, "package");
        // Setup global "package" as: package.loaded = {}
        lua_getglobal(L, "package");
        lua_pushstring(L, "loaded");
        lua_newtable(L);
        lua_rawset(L, -3);
        lua_pop(L, 1);

        lua_pushcfunction(L, packageRequire);
        lua_rawsetglobal(L, "require");

        lua_pushcfunction(L, packageOptRequire);
        lua_rawsetglobal(L, "optrequire");

        load_module(L, "main", script);
        const char* data = lua_tostring(L, -1);

        lua_close(L);

        return data;
    }
}