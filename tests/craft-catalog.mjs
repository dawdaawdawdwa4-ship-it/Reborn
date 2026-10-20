import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const catalog=main.slice(main.indexOf('-- CRAFT CATALOG BEGIN'),main.indexOf('-- CRAFT CATALOG END'));
const names=main.slice(main.indexOf('function RemoteCatalog.CraftRecipes()'),main.indexOf('-- CRAFT CATALOG BEGIN'));
const code=`
local gui={Parent=true}
local RemoteCatalog={ModuleCache={},CraftRecipeSearch={Text=''},CraftCatalogLabel={},CraftCatalogButton={}}
RemoteCatalog.CloseMenus=function() end
local message
RemoteCatalog.CraftMessage=function(text) message=text end
RemoteCatalog.CraftRecorder=function() return nil end
RemoteCatalog.CraftRecorders=function() return {} end
local native=typeof
local function typeof(value) return type(value)=='table' and value._kind or native(value) end
local root={}
local game={GetService=function() return root end}
local calls={}
local function module(name,data,inside)
 return {_kind='Instance',Name=name,Data=data,IsA=function(_,class) return class=='ModuleScript' end,IsDescendantOf=function(_,ancestor) return inside~=false and ancestor==root end}
end
local modules={}
local getrenv
local function getloadedmodules() return modules end
local function require(value) table.insert(calls,value);if value.Failed then error('unavailable') end;return value.Data end
${names}
${catalog}
local found={}
local data={CraftingRecipes={bait={toolName='bait',ingredients={{item='worm',amount=1}}},wood={output={item='woodPlank',amount=2},requiredItems={{item='wood',amount=1}}}},ItemMeta={stone={craftingRecipe={materials={rock=1}}}},inventory={toolName='notARecipe',amount=3},callback=function() error('must not call exports') end}
data.cycle=data
RemoteCatalog.ReadCraftRecipes(data,found)
assert(found.bait and found.woodPlank and found.stone and not found.worm and not found.wood and not found.notARecipe,'catalog must extract recipe output names without listing ingredients or ordinary inventory')
local keyed={}
RemoteCatalog.ReadCraftRecipes({bait={ingredients={worm=1}},testRecipe={ingredients={wood=1}}},keyed,true)
assert(keyed.bait and keyed.testRecipe,'recipe module root maps must support key-based output IDs')
local huge={};local nextNode=huge
for _=1,20 do nextNode.child={};nextNode=nextNode.child end
nextNode.Recipes={unbounded={toolName='unbounded',ingredients={}}}
local bounded={};RemoteCatalog.ReadCraftRecipes(huge,bounded);assert(not bounded.unbounded,'deep arbitrary data must stay bounded')
local recipe=module('crafting-recipes',{Recipes={bait={toolName='bait',ingredients={}},testRecipe={toolName='testRecipe',ingredients={}}}})
local unrelated=module('CraftController',{Recipes={bad={toolName='bad',ingredients={}}}})
local foreign=module('recipes',{Recipes={foreign={toolName='foreign',ingredients={}}}},false)
local failed=module('item-meta',{});failed.Failed=true
modules={recipe,unrelated,foreign,failed,recipe}
assert(RemoteCatalog.LoadCraftCatalog() and #calls==2 and calls[1]==recipe and calls[2]==failed,'only loaded relevant ReplicatedStorage modules may be read; duplicates and unrelated controllers must be ignored')
assert(RemoteCatalog.CraftCatalog.bait and RemoteCatalog.CraftCatalog.testRecipe and not RemoteCatalog.CraftCatalog.foreign and RemoteCatalog.CraftCatalogFailures==1)
local options=RemoteCatalog.CraftRecipes();assert(#options==2 and options[1]=='bait' and options[2]=='testRecipe','catalog names must merge with learned/default recipes without duplicates')
RemoteCatalog.CraftRecipeSearch.Text='TEST_recipe'
options=RemoteCatalog.CraftRecipeOptions();assert(#options==1 and options[1]=='testRecipe','search must normalize spaces, underscores and case')
RemoteCatalog.CraftRecipeSearch.Text='missing';assert(#RemoteCatalog.CraftRecipeOptions()==0)
RemoteCatalog.CraftRecipeSearch.Text=''
for n=1,100 do RemoteCatalog.CraftCatalog['recipe'..n]=true end
assert(#RemoteCatalog.CraftRecipeOptions()==60,'large recipe lists must cap rendered options and remain searchable')
local before=RemoteCatalog.CraftCatalog
modules={};RemoteCatalog.ModuleCache={}
assert(not RemoteCatalog.LoadCraftCatalog() and RemoteCatalog.CraftCatalog==before,'missing data must preserve the existing catalog')
RemoteCatalog.ModuleCache={['ReplicatedStorage.TS.item.item-meta']={items={cacheRecipe={craftingRecipe={ingredients={}}}}}}
assert(RemoteCatalog.LoadCraftCatalog() and RemoteCatalog.CraftCatalog.cacheRecipe,'already-cached item metadata must work without module enumeration')
RemoteCatalog.CraftWorker=1;local count=#calls
assert(not RemoteCatalog.LoadCraftCatalog() and #calls==count,'active crafting must lock catalog reloads')
RemoteCatalog.CraftWorker=nil
local original=require
local runtimeCalls=0
getrenv=function() return {require=function(mod) runtimeCalls+=1;return original(mod) end} end
modules={recipe}
assert(RemoteCatalog.LoadCraftCatalog() and runtimeCalls==1,'module reads must use the game require environment when available')
modules={};RemoteCatalog.ModuleCache={}
local metadata=module('crafting-recipes',{newRecipe={ingredients={wood=1}}})
root.GetDescendants=function() return {metadata,unrelated} end
assert(RemoteCatalog.LoadCraftCatalog() and RemoteCatalog.CraftCatalog.newRecipe and not RemoteCatalog.CraftCatalog.bad,'metadata fallback must find unloaded recipe data without requiring arbitrary controllers')
return 'Recipe catalog: cached/loaded/metadata discovery, schema extraction, ingredient exclusion, bounds, search, render cap, failures, deduplication and run locks passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'craft-catalog',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
