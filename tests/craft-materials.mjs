import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const helpers=main.slice(main.indexOf('-- CRAFT MATERIALS BEGIN'),main.indexOf('-- CRAFT MATERIALS END'));
const parser=main.slice(main.indexOf('function RemoteCatalog.ReadCraftRecipes('),main.indexOf('function RemoteCatalog.CraftRecipeModule('));
const code=`
local gui={Parent=true}
local RemoteCatalog={CraftItem='bait',CraftMode='Make amount',CraftTarget=100,CraftBatch=100,CraftMaterialsLabel={}}
local inventory={bait=3770,wood=10,worm=15}
RemoteCatalog.CarrotCount=function(item) return inventory[item] end
${helpers}
${parser}
local function contains(text,part) return string.find(text,part,1,true)~=nil end
local found,materials={},{}
RemoteCatalog.ReadCraftRecipes({Recipes={bait={output={toolName='bait',amount=2},ingredients={{item='worm',amount=2},{itemType='wood',quantity=1},{itemName='worm',count=1}}}}},found,false,materials)
assert(found.bait and materials.bait.OutputAmount==2 and #materials.bait.Ingredients==2,'recipe parsing must retain explicit output yield and validated ingredient costs')
assert(materials.bait.Ingredients[1].Item=='wood' and materials.bait.Ingredients[2].Amount==3,'duplicate ingredients must aggregate without treating nested output descriptors as other variants')
RemoteCatalog.CraftMaterials=materials
local report=RemoteCatalog.CraftMaterialReport()
assert(contains(report,'Planned: 100 more bait · 50 crafts × 2 output') and contains(report,'wood · need 50 · have 10 · missing 40') and contains(report,'worm · need 150 · have 15 · missing 135'),'Make amount must ignore existing output stock and calculate full missing materials')
assert(contains(report,'Craftable from readable materials: 10 output items'),'available materials must show the limiting ingredient rather than summing independent capacities')
RemoteCatalog.CraftMode='Top up stock';RemoteCatalog.CraftTarget=3800
report=RemoteCatalog.CraftMaterialReport()
assert(contains(report,'Planned: 30 more bait · 15 crafts') and contains(report,'worm · need 45'),'Top up must use the current deficit')
RemoteCatalog.CraftTarget=100;report=RemoteCatalog.CraftMaterialReport()
assert(contains(report,'Planned: 0 more bait') and contains(report,'worm · need 0 · have 15 · missing 0'),'an already-met top-up must require no materials')
RemoteCatalog.CraftMode='Continuous';RemoteCatalog.CraftBatch=25
report=RemoteCatalog.CraftMaterialReport()
assert(contains(report,'Next batch: 25 more bait · 13 crafts') and contains(report,'worm · need 39'),'Continuous must estimate the next chosen batch and round required crafts up')
RemoteCatalog.CraftWorker=1;RemoteCatalog.CraftQueueRunning=true
RemoteCatalog.CraftMaterialRun={Item='bait',Mode='Make amount',Target=100,Batch=100,Confirmed=25}
RemoteCatalog.CraftItem='different';RemoteCatalog.CraftTarget=500
report=RemoteCatalog.CraftMaterialReport()
assert(contains(report,'Recipe: bait · Make amount') and contains(report,'Remaining: 75 more bait · 38 crafts') and contains(report,'Current queue job only'),'active jobs must use frozen settings and confirmed progress, not mutable selection or future queue jobs')
RemoteCatalog.CraftPaused=true;RemoteCatalog.RefreshCraftMaterials()
assert(RemoteCatalog.CraftMaterialsLabel.Text==report,'paused jobs must retain the same material estimate')
RemoteCatalog.CraftMaterialRun.Confirmed=102
assert(contains(RemoteCatalog.CraftMaterialReport(),'Remaining: 0 more bait'),'a final output stack that overshoots must clamp remaining materials to zero')
RemoteCatalog.CraftWorker=nil;RemoteCatalog.CraftQueueRunning=false;RemoteCatalog.CraftItem='bait';RemoteCatalog.CraftMode='Make amount';RemoteCatalog.CraftTarget=100
inventory.wood=nil;report=RemoteCatalog.CraftMaterialReport()
assert(contains(report,'wood · need 50 · have unknown · missing unknown') and contains(report,'1 unreadable') and not contains(report,'Craftable from readable materials:'),'unreadable inventory must not mean zero stock or claim a craftable total')
inventory.wood=10
RemoteCatalog.CraftMode='Top up stock';local savedOutput=inventory.bait;inventory.bait=nil
report=RemoteCatalog.CraftMaterialReport()
assert(contains(report,'output inventory unreadable') and not contains(report,'Output quantity unknown'),'unknown output inventory must not misreport a known recipe yield as unknown')
inventory.bait=savedOutput;RemoteCatalog.CraftMode='Make amount'
for _,bad in ipairs({-1,1.5,math.huge,0/0,'10'}) do inventory.wood=bad;assert(RemoteCatalog.CraftMaterialCount('wood')==nil) end
RemoteCatalog.CarrotCount=function() error('inventory unavailable') end
assert(contains(RemoteCatalog.CraftMaterialReport(),'have unknown'),'inventory errors must remain local to the advisory view')
RemoteCatalog.CarrotCount=function(item) return inventory[item] end;inventory.wood=10
RemoteCatalog.CraftMaterials.bait=RemoteCatalog.ReadCraftMaterials({}, {worm=3,wood={amount=1}})
report=RemoteCatalog.CraftMaterialReport()
assert(contains(report,'Output quantity unknown; showing per-craft costs only') and contains(report,'worm · need 3') and not contains(report,'50 crafts'),'unknown recipe yield must never default to one or create a total estimate')
RemoteCatalog.CraftMode='Top up stock';inventory.bait=nil
assert(contains(RemoteCatalog.CraftMaterialReport(),'output inventory unreadable'),'unreadable output stock must not fabricate a top-up deficit')
for _,ingredients in ipairs({{}, {worm=-1}, {worm=0}, {worm=1.5}, {worm='2'}, {{item='worm'}}, {{item='worm',amount=1,alternatives={}}}, {['bad\\nname']=2}}) do
 assert(RemoteCatalog.ReadCraftMaterials({},ingredients).Error,'malformed/unsupported ingredient lists must fail without partial totals')
end
local huge={};for n=1,65 do huge['item'..n]=1 end
assert(RemoteCatalog.ReadCraftMaterials({},huge).Error,'large cost maps must remain bounded')
assert(RemoteCatalog.ReadCraftMaterials({outputAmount=0},{worm=1}).Error,'invalid explicit output yield must not be ignored')
assert(RemoteCatalog.ReadCraftMaterials({cost=10},{worm=1}).Error,'unknown additional costs must not be silently omitted')
local variants={}
RemoteCatalog.RememberCraftMaterials(variants,'bait',{outputAmount=1},{worm=1})
RemoteCatalog.RememberCraftMaterials(variants,'bait',{outputAmount=1},{worm=1})
assert(not variants.bait.Error,'identical recipe exports must not create a false variant conflict')
RemoteCatalog.RememberCraftMaterials(variants,'bait',{outputAmount=1},{worm=2})
RemoteCatalog.RememberCraftMaterials(variants,'bait',{outputAmount=1},{worm=1})
assert(contains(variants.bait.Error,'Multiple recipe variants'),'different material costs must stay ambiguous regardless of later discovery order')
RemoteCatalog.CraftMaterials=variants
assert(contains(RemoteCatalog.CraftMaterialReport(),'No total estimated'),'ambiguous variants must not choose arbitrary cheap costs')
RemoteCatalog.CraftMaterials={};RemoteCatalog.RefreshCraftMaterials()
assert(contains(RemoteCatalog.CraftMaterialsLabel.Text,'Press Load all recipes first'),'missing metadata must explain how to obtain it without fabricating a request')
gui.Parent=nil;RemoteCatalog.CraftMaterialsLabel.Text='destroyed';RemoteCatalog.RefreshCraftMaterials()
assert(RemoteCatalog.CraftMaterialsLabel.Text=='destroyed','UI cleanup must prevent updates')
return 'Craft materials: recipe metadata, explicit/unknown yields, duplicates/variants, full/top-up/continuous/remaining costs, shortages, inventory failures, bounds and cleanup passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'craft-materials',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
