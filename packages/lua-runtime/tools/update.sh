#!/bin/bash

mkdir tmp
cd tmp

# Update lua
git clone \
  --depth 1 \
  --filter=blob:none \
  --no-checkout \
  https://github.com/wube/Factorio.git \
;
cd Factorio
git checkout 15de4cda20f48bb4c83bc80dcc19447bd7247236 -- libraries/Lua
cd libraries/Lua
rm CMakeLists.txt
rm README
rm override_printf.h
sed -i 's|<Lua/LuaCPPUtilities.hpp>|"LuaCPPUtilities.hpp"|g' lua.hpp
cd ../../..
cp -r Factorio/libraries/Lua/. ../vendor/lua

# Update rapidjson
git clone \
  --depth 1 \
  --filter=blob:none \
  --no-checkout \
  https://github.com/Tencent/rapidjson.git \
;
cd rapidjson
git checkout ac0fc79c76fc92783d2a5267082a1f8f9c28df22 -- include/rapidjson
cd ..
cp -r rapidjson/include/rapidjson/. ../vendor/rapidjson

# Update lua-rapidjson
git clone \
  --depth 1 \
  --filter=blob:none \
  --no-checkout \
  https://github.com/xpol/lua-rapidjson.git \
;
cd lua-rapidjson
git checkout e969cd739ac01499957e2f80794c8697c7f18a4b -- src
find src -type f | xargs sed -i 's|[<"]lua.hpp[">]|<lua/lua.hpp>|g'
cd ..
cp -r lua-rapidjson/src/. ../vendor/lua-rapidjson

cd ..
rm -rf tmp