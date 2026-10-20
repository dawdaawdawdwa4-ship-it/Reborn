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
local materialData=module('recipes',{Recipes={bait={toolName='bait',outputAmount=1,ingredients={worm=2}}}})
modules={materialData};RemoteCatalog.ModuleCache={}
assert(RemoteCatalog.LoadCraftCatalog() and RemoteCatalog.CraftMaterials.bait.OutputAmount==1 and RemoteCatalog.CraftMaterials.bait.Ingredients[1].Item=='worm','catalog commits must retain validated materials alongside recipe names')
local preservedMaterials=RemoteCatalog.CraftMaterials
modules={}
assert(not RemoteCatalog.LoadCraftCatalog() and RemoteCatalog.CraftMaterials==preservedMaterials,'a failed scan must preserve material data with the existing catalog')
modules={};RemoteCatalog.ModuleCache={}
local metadata=module('crafting-recipes',{newRecipe={ingredients={wood=1}}})
root.GetDescendants=function() return {metadata,unrelated} end
assert(RemoteCatalog.LoadCraftCatalog() and RemoteCatalog.CraftCatalog.newRecipe and not RemoteCatalog.CraftCatalog.bad,'metadata fallback must find unloaded recipe data without requiring arbitrary controllers')
-- Partial loaded exports must not hide unopened station recipes; shared
-- failures/identities must not be required twice during metadata discovery.
modules={recipe,failed};calls={}
root.GetDescendants=function() return {recipe,failed,metadata,unrelated,foreign} end
assert(RemoteCatalog.LoadCraftCatalog() and RemoteCatalog.CraftCatalog.bait and RemoteCatalog.CraftCatalog.newRecipe,'metadata discovery must supplement a nonempty loaded recipe list')
assert(#calls==3 and RemoteCatalog.CraftCatalogFailures==1 and RemoteCatalog.CraftCatalogAttempts==3,'shared discovery must not retry failed/loaded modules or count duplicates')
assert(string.find(RemoteCatalog.CraftCatalogStatus,'Partial scan',1,true),'partial scan failures must be visible instead of claiming complete coverage')
local cachedData={Recipes={cached={ingredients={}}}}
local cachedModule=module('recipes',cachedData)
cachedModule.GetFullName=function() return 'ReplicatedStorage.recipes' end
RemoteCatalog.ModuleCache={['ReplicatedStorage.recipes']=cachedData};modules={cachedModule}
root.GetDescendants=function() return {cachedModule} end;calls={}
assert(RemoteCatalog.LoadCraftCatalog() and #calls==0 and RemoteCatalog.CraftCatalogSources==1 and RemoteCatalog.CraftCatalogAttempts==1,'cached exports must not be required or parsed again through module discovery')
RemoteCatalog.ModuleCache={};modules={recipe};local broken={}
for n=1,60 do local value=module('recipes',{});value.Failed=true;table.insert(broken,value) end
root.GetDescendants=function() return broken end;calls={}
assert(RemoteCatalog.LoadCraftCatalog() and #calls==32 and RemoteCatalog.CraftCatalog.bait,'failed reads must share the 32-attempt budget with successful loaded exports')
assert(RemoteCatalog.CraftCatalogLimited and RemoteCatalog.CraftCatalogFailures==31 and RemoteCatalog.CraftCatalogAttempts==32 and string.find(RemoteCatalog.CraftCatalogStatus,'limit reached',1,true),'truncation and failed reads must appear in diagnostics/status')
local preserved=RemoteCatalog.CraftCatalog
modules=broken;calls={}
assert(not RemoteCatalog.LoadCraftCatalog() and #calls==32 and RemoteCatalog.CraftCatalog==preserved,'failed modules alone must stop at the budget and preserve the previous catalog')
modules={};RemoteCatalog.ModuleCache={}
for n=1,40 do RemoteCatalog.ModuleCache['ReplicatedStorage.recipes'..n]={Recipes={['cached'..n]={ingredients={}}}} end
calls={};assert(RemoteCatalog.LoadCraftCatalog() and RemoteCatalog.CraftCatalogSources==32 and RemoteCatalog.CraftCatalogAttempts==32 and RemoteCatalog.CraftCatalogLimited and #calls==0,'cached tables must consume the same budget as module reads')
RemoteCatalog.ModuleCache={};modules={recipe,metadata};calls={}
getrenv=function() return {require=function(mod) gui.Parent=nil;return original(mod) end} end
assert(not RemoteCatalog.LoadCraftCatalog() and #calls==1 and not RemoteCatalog.CraftCatalogLoading,'destroying the GUI during a module read must stop subsequent reads and release the loading lock')
return 'Recipe catalog: cached/loaded/metadata discovery, partial-list completion, shared attempt budget, failure/cached/module deduplication, cleanup, schemas, search and run locks passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'craft-catalog',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
