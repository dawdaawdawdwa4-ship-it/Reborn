import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const materials=main.slice(main.indexOf('-- CRAFT MATERIALS BEGIN'),main.indexOf('-- CRAFT MATERIALS END'));
const validate=main.slice(main.indexOf('function RemoteCatalog.ValidateCraftPreset('),main.indexOf('function RemoteCatalog.ValidateCraftPresets('));
const code=`
local gui={Parent=true}
local RemoteCatalog={CraftQueue={},CraftMaterialsLabel={},CraftMaterialsScope='Whole queue'}
local inventory,reads={},{}
RemoteCatalog.CarrotCount=function(item) reads[item]=(reads[item] or 0)+1;return inventory[item] end
${materials}
${validate}
local function has(text,part) return string.find(text,part,1,true)~=nil end
local function job(item,target,mode,batch) return {Item=item,Target=target or 100,Mode=mode or 'Make amount',Batch=batch or 100} end
local function recipe(item,inputs,yield)
 RemoteCatalog.CraftMaterials[item]=RemoteCatalog.ReadCraftMaterials({outputAmount=yield or 1},inputs)
end
local function row(plan,item) for _,value in ipairs(plan.Rows) do if value.Item==item then return value end end end
local function reset()
 RemoteCatalog.CraftQueue={};RemoteCatalog.CraftMaterials={};RemoteCatalog.CraftWorker=nil;RemoteCatalog.CraftEnabled=false
 inventory={bait=0,food=0,worm=150,wood=20};reads={}
 recipe('bait',{worm=2});recipe('food',{worm=1,wood=1})
end
reset()
assert(has(RemoteCatalog.CraftQueueMaterialReport(),'Queue empty'))
RemoteCatalog.CraftQueue={job('bait'),job('food')}
local plan=RemoteCatalog.CraftQueueMaterialPlan()
assert(plan.Complete and #plan.Jobs==2 and plan.MissingTypes==2 and plan.UnknownTypes==0)
assert(row(plan,'worm').Need==300 and row(plan,'worm').Have==150 and row(plan,'worm').Missing==150,'shared inventory must be consumed once across jobs')
assert(row(plan,'wood').Need==100 and row(plan,'wood').Missing==80)
assert(reads.worm==1 and reads.bait==1 and reads.food==1,'each item must be read only once per report')
assert(inventory.worm==150 and inventory.bait==0 and RemoteCatalog.CraftQueue[1].Target==100,'planning cannot consume inventory or alter jobs')
local report=RemoteCatalog.CraftQueueMaterialReport()
assert(has(report,'Estimated 2 / 2') and has(report,'worm · use 300 · have 150 · queue output 0 · missing in order 150'))
RemoteCatalog.RefreshCraftMaterials();assert(RemoteCatalog.CraftMaterialsLabel.Text==report)
-- Repeated top-ups share projected stock; Make amount always remains additional.
reset();inventory.bait=50
RemoteCatalog.CraftQueue={job('bait',100,'Top up stock'),job('bait',100,'Top up stock'),job('bait')}
plan=RemoteCatalog.CraftQueueMaterialPlan()
assert(plan.Jobs[1].Desired==50 and plan.Jobs[2].Desired==0 and plan.Jobs[3].Desired==100 and row(plan,'worm').Need==300,'repeated top-ups cannot charge twice for the same target')
-- Earlier outputs can feed later jobs; later output cannot fix an earlier shortage.
reset();recipe('worm',{wood=1});inventory.wood=100;inventory.worm=0
RemoteCatalog.CraftQueue={job('worm'),job('bait')}
plan=RemoteCatalog.CraftQueueMaterialPlan()
assert(row(plan,'worm').Need==200 and row(plan,'worm').Produced==100 and row(plan,'worm').Missing==100)
RemoteCatalog.CraftQueue={job('bait'),job('worm')}
plan=RemoteCatalog.CraftQueueMaterialPlan()
assert(row(plan,'worm').Missing==200,'future output cannot retroactively supply earlier jobs')
recipe('food',{bait=1});inventory.bait=100
RemoteCatalog.CraftQueue={job('food'),job('bait',100,'Top up stock')}
plan=RemoteCatalog.CraftQueueMaterialPlan()
assert(plan.Jobs[2].Desired==100,'a later top-up must see output stock consumed by an earlier job')
-- Costs round per chosen request batch and never credit potential output surplus.
reset();recipe('bait',{worm=2},3);RemoteCatalog.CraftQueue={job('bait',100,'Make amount',25),job('bait',250,'Top up stock',100)}
plan=RemoteCatalog.CraftQueueMaterialPlan()
assert(plan.Jobs[1].Crafts==36 and plan.Jobs[2].Desired==150 and plan.Jobs[2].Crafts==51 and row(plan,'worm').Need==174)
-- Unknown stock and metadata remain unknown, with clearly bounded prefix totals.
reset();inventory.worm=nil;RemoteCatalog.CraftQueue={job('bait'),job('food')}
plan=RemoteCatalog.CraftQueueMaterialPlan()
assert(plan.Complete and plan.UnknownTypes==1 and row(plan,'worm').Missing==nil and row(plan,'worm').Need==300)
inventory.bait=nil;RemoteCatalog.CraftQueue={job('bait',100,'Top up stock'),job('food')}
plan=RemoteCatalog.CraftQueueMaterialPlan()
assert(not plan.Complete and #plan.Jobs==0 and has(plan.Reason,'inventory unreadable'))
reset();RemoteCatalog.CraftQueue={job('bait'),job('unknown'),job('food')}
plan=RemoteCatalog.CraftQueueMaterialPlan()
assert(not plan.Complete and #plan.Jobs==1 and row(plan,'worm').Need==200)
assert(has(RemoteCatalog.CraftQueueMaterialReport(),'PARTIAL') and has(RemoteCatalog.CraftQueueMaterialReport(),'No full-queue total available'))
for _,bad in ipairs({{Ingredients={{Item='worm',Amount=1}}},{Error='Multiple recipe variants'},true,{OutputAmount=1,Ingredients={{Item='worm',Amount=-1}}},{OutputAmount=1,Ingredients={{Item='bait',Amount=1}}}}) do
 RemoteCatalog.CraftMaterials.bait=bad;RemoteCatalog.CraftQueue={job('bait'),job('food')}
 plan=RemoteCatalog.CraftQueueMaterialPlan();assert(not plan.Complete and #plan.Jobs==0 and #plan.Rows==0,'unsupported recipes cannot leave partial deductions for a failed job')
end
reset();inventory.bait=100;RemoteCatalog.CraftMaterials.bait=nil;RemoteCatalog.CraftQueue={job('bait',100,'Top up stock')}
assert(RemoteCatalog.CraftQueueMaterialPlan().Complete and #RemoteCatalog.CraftQueueMaterialPlan().Rows==0,'already-met targets need no metadata and spend no materials')
for _,bad in ipairs({{}, {[1]=job('bait'),[3]=job('food')},{job('bait',100,'Continuous')},{job('bait',123)},{job('bait'),false}}) do
 RemoteCatalog.CraftQueue=bad;assert(not RemoteCatalog.CraftQueueMaterialPlan().Complete,'invalid and empty queues must not claim a full estimate')
end
reset();for _=1,8 do table.insert(RemoteCatalog.CraftQueue,job('bait',10000)) end
recipe('bait',{worm=1000000000});plan=RemoteCatalog.CraftQueueMaterialPlan()
assert(plan.Complete and row(plan,'worm').Need==80000000000000,'eight largest valid jobs must remain in the safe integer range')
table.insert(RemoteCatalog.CraftQueue,job('bait'));assert(not RemoteCatalog.CraftQueueMaterialPlan().Complete)
RemoteCatalog.CraftQueue={job('bait')};RemoteCatalog.CarrotCount=function() error('inventory unavailable') end
plan=RemoteCatalog.CraftQueueMaterialPlan();assert(plan.Complete and row(plan,'worm').Missing==nil,'count failures must stay unknown in advisory results')
for _,flag in ipairs({'CraftWorker','CraftEnabled','CraftPresetBusy','CraftCatalogLoading'}) do
 RemoteCatalog[flag]=true;reads={}
 plan=RemoteCatalog.CraftQueueMaterialPlan();assert(not plan.Complete and #plan.Rows==0 and next(reads)==nil,'active/finishing/loading work cannot be presented as a remaining-run estimate')
 RemoteCatalog[flag]=nil
end
gui.Parent=nil;RemoteCatalog.CraftMaterialsLabel.Text='destroyed';RemoteCatalog.RefreshCraftMaterials()
assert(RemoteCatalog.CraftMaterialsLabel.Text=='destroyed')
return 'Queue materials: shared stock, order/dependencies, repeated top-up, per-batch rounding, no surplus credit, snapshot isolation, unknown/prefix/invalid data, large totals, loading/worker locks and cleanup passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'craft-queue-materials',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
