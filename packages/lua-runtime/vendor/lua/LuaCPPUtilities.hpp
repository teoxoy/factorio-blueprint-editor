#pragma once
#include "lua.h"
#include <string>

inline const char* lua_pushstring(lua_State* L, const std::string& s)
{ return lua_pushlstring(L, s.c_str(), s.size()); }

inline const char* lua_pushstring(lua_State* L, std::string_view s)
{ return lua_pushlstring(L, s.data(), s.size()); }

inline void  lua_getfield(lua_State* L, int idx, const std::string& k)
{ lua_getlfield(L, idx, k.c_str(), k.size()); }

inline void  lua_setfield(lua_State* L, int idx, const std::string& k)
{ lua_setlfield(L, idx, k.c_str(), k.size()); }
