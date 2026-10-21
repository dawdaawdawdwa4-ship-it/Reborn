import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const core=main.slice(main.indexOf('-- CRAFT BAIT BEGIN'),main.indexOf('-- CRAFT BAIT END'));
const wait=main.slice(main.indexOf('function RemoteCatalog.WaitChestInventory'),main.indexOf('function RemoteCatalog.ChestAutoMessage'));
const code=`
local gui={Parent=true}
local COLORS={on=1,off=2,text=3,muted=4}
local RemoteCatalog={CraftToggle={},CraftLearnButton={},CraftInfo={},CloseMenus=function() end}
local island={}
local a,b={Parent=island},{Parent=island}
local distance={}
local rootPosition=setmetatable({},{__sub=function(_,pos) return {Magnitude=distance[pos.Bench] or 0} end})
local player={Character={FindFirstChild=function() return {Position=rootPosition} end}}
local function getPlayerIsland() return island end
local function getPartPosition(bench) return {Bench=bench} end
local inventory,trace,workers={}, {}, {}
local task={spawn=function(fn) local co=coroutine.create(fn);table.insert(workers,co);local ok,e=coroutine.resume(co);assert(ok,e) end,wait=function(dt) return coroutine.yield(dt) end}
local bindings={bait={Item='bait',Workbench=a},testRecipe={Item='testRecipe',Workbench=b}}
local behavior=function(amount,binding) inventory[binding.Item]=(inventory[binding.Item] or 0)+amount;return true end
local recorder={CraftBinding=bindings.bait,CraftBindings=bindings,CanUseCraftBinding=function(_,binding) return not binding.Invalid end,CraftItem=function(_,amount,binding) assert(amount>=1 and amount<=100);table.insert(trace,{Item=binding.Item,Amount=amount,Binding=binding});return behavior(amount,binding) end}
RemoteCatalog.LiveRecorder=function() return recorder end
RemoteCatalog.CarrotCount=function(item) return inventory[item] or 0 end
RemoteCatalog.ChestTooFast=function(response) return type(response)=='table' and response.error=='TOO_FAST' end
RemoteCatalog.ChestResultText=function(response) return type(response)=='table' and response.error or tostring(response) end
${wait}
${core}
local function step()
 for _,co in ipairs(table.clone(workers)) do if coroutine.status(co)~='dead' then local ok,e=coroutine.resume(co);assert(ok,e) end end
end
local function drain()
 for _=1,1000 do if not RemoteCatalog.CraftWorker then return end;step() end
 error('queue failed to settle')
end
local function reset()
 if RemoteCatalog.CraftWorker then RemoteCatalog.SetCraftEnabled(false);drain() end
 inventory={};trace={};workers={};distance={}
 for _,binding in pairs(bindings) do binding.Invalid=nil end
 recorder.CraftBindings=bindings
 RemoteCatalog.CraftQueue={};RemoteCatalog.CraftQueueDone=0;RemoteCatalog.CraftQueueSelected=nil
 RemoteCatalog.CraftItem='bait';RemoteCatalog.CraftMode='Make amount';RemoteCatalog.CraftBatch=100;RemoteCatalog.CraftTarget=100
 RemoteCatalog.ChestBusy=false;RemoteCatalog.ChestAutoWorker=nil
 behavior=function(amount,binding) inventory[binding.Item]=(inventory[binding.Item] or 0)+amount;return true end
end
local function add(item,target,mode,batch)
 RemoteCatalog.CraftItem=item;RemoteCatalog.CraftTarget=target or 100;RemoteCatalog.CraftMode=mode or 'Make amount';RemoteCatalog.CraftBatch=batch or 100
 return RemoteCatalog.AddCraftQueueJob()
end
assert(#RemoteCatalog.CraftQueue==0 and not RemoteCatalog.CraftWorker,'queue must start empty and OFF')
assert(not RemoteCatalog.SetCraftEnabled(true,true) and #trace==0,'empty queue cannot start')
assert(add('bait',250) and add('testRecipe',100))
assert(#trace==0 and #RemoteCatalog.CraftQueue==2 and not RemoteCatalog.CraftQueue[1].Binding,'adding descriptors cannot craft or retain request contexts')
assert(RemoteCatalog.CraftQueue[1].Item=='bait' and RemoteCatalog.CraftQueue[1].Target==250,'configured queue must copy the current recipe settings')
assert(RemoteCatalog.SetCraftEnabled(true,true));local started=#workers
assert(RemoteCatalog.SetCraftEnabled(true,true) and #workers==started,'double start must use one worker')
assert(not RemoteCatalog.AddCraftQueueJob() and not RemoteCatalog.EditCraftQueue(true),'running queue must lock edits')
drain()
assert(#trace==4 and trace[1].Item=='bait' and trace[2].Item=='bait' and trace[3].Amount==50 and trace[4].Item=='testRecipe','finish each recipe, including the smaller last batch, before changing recipe')
assert(inventory.bait==250 and inventory.testRecipe==100 and RemoteCatalog.CraftQueueDone==2 and RemoteCatalog.CraftQueueTotal==350 and not RemoteCatalog.CraftQueueRunning,'queue totals must include confirmed positive gain only')
assert(#RemoteCatalog.CraftQueue==2 and string.find(RemoteCatalog.CraftInfo.Text,'Queue finished',1,true),'completed queue must remain available for an explicit repeat')
reset();inventory.bait=100
assert(add('bait',100,'Top up stock') and add('testRecipe',100))
assert(RemoteCatalog.SetCraftEnabled(true,true));drain()
assert(#trace==1 and trace[1].Item=='testRecipe' and RemoteCatalog.CraftQueueDone==2,'already-met top-up jobs must complete without spending materials')
reset();assert(add('bait') and add('bait'));assert(RemoteCatalog.SetCraftEnabled(true,true));drain()
assert(inventory.bait==200,'duplicate Make amount jobs must each make their own additional amount')
reset();assert(add('bait') and add('testRecipe'))
bindings.testRecipe.Invalid=true
assert(not RemoteCatalog.SetCraftEnabled(true,true) and #trace==0,'all jobs must pass context validation before the first request')
reset();assert(not add('bait',100,'Continuous') and #RemoteCatalog.CraftQueue==0,'infinite jobs must be rejected from finite queues')
assert(not add('unknown') and #trace==0,'unlearned recipes must not be invented')
reset();for _=1,8 do assert(add('bait')) end
assert(not add('bait') and #RemoteCatalog.CraftQueue==8,'queue must be capped at eight jobs')
assert(RemoteCatalog.EditCraftQueue(false) and #RemoteCatalog.CraftQueue==7)
assert(RemoteCatalog.EditCraftQueue(true) and #RemoteCatalog.CraftQueue==0 and #trace==0)
reset();assert(add('bait') and add('testRecipe'))
behavior=function(amount,binding) if binding.Item=='bait' then return false,{error='MISSING_MATERIALS'} end;error('must not advance after rejection') end
assert(RemoteCatalog.SetCraftEnabled(true,true));drain()
assert(#trace==1 and RemoteCatalog.CraftQueueDone==0 and RemoteCatalog.CraftQueueTotal==0 and string.find(RemoteCatalog.CraftInfo.Text,'job 1 / 2',1,true),'material failure must stop the queue with the failed job, without advancing')
reset();assert(add('bait') and add('testRecipe'));behavior=function() return true end
assert(RemoteCatalog.SetCraftEnabled(true,true));drain()
assert(#trace==1 and RemoteCatalog.CraftQueueTotal==0,'accepted request without inventory gain must not advance the queue')
reset();assert(add('bait') and add('testRecipe'))
behavior=function(amount,binding) if #trace==1 then return false,{error='TOO_FAST'} end;inventory[binding.Item]=(inventory[binding.Item] or 0)+amount;return true end
assert(RemoteCatalog.SetCraftEnabled(true,true));drain()
assert(#trace==3 and trace[1].Item=='bait' and trace[2].Item=='bait' and trace[2].Amount==100 and trace[3].Item=='testRecipe','cooldown must retry the same recipe/batch before advancing')
reset();assert(add('bait') and add('testRecipe'))
behavior=function(amount,binding) coroutine.yield('in-flight');inventory[binding.Item]=(inventory[binding.Item] or 0)+amount;return true end
assert(RemoteCatalog.SetCraftEnabled(true,true) and #trace==1)
RemoteCatalog.SetCraftEnabled(false)
assert(not RemoteCatalog.SetCraftEnabled(true,true),'Stop/restart must await the outstanding request')
drain();assert(#trace==1 and RemoteCatalog.CraftQueueDone==0 and not RemoteCatalog.CraftQueueRunning,'Stop cannot launch the next queued recipe')
reset();assert(add('bait') and add('testRecipe'))
assert(RemoteCatalog.SetCraftEnabled(true,true) and RemoteCatalog.CraftQueueDone==1)
-- Mutating external configuration must not alter this run's frozen jobs or bindings.
RemoteCatalog.CraftQueue[2].Item='bait';RemoteCatalog.CraftQueue[2].Target=10000
local captured=bindings.testRecipe
recorder.CraftBindings={bait=bindings.bait,testRecipe={Item='testRecipe',Workbench={}}}
drain();assert(#trace==2 and trace[2].Binding==captured and inventory.testRecipe==100,'running queue must use the original captured binding and job configuration')
reset();assert(add('bait') and add('testRecipe'));distance[b]=30
assert(RemoteCatalog.SetCraftEnabled(true,true));for _=1,30 do step() end
assert(#trace==1 and RemoteCatalog.CraftQueueIndex==2 and RemoteCatalog.CraftEnabled,'next workbench outside reach must wait without consuming materials')
distance[b]=0;drain();assert(#trace==2)
reset();assert(add('bait') and add('testRecipe'));assert(RemoteCatalog.SetCraftEnabled(true,true));bindings.testRecipe.Invalid=true
drain();assert(#trace==1 and RemoteCatalog.CraftQueueDone==1,'context expiration before the next job must stop remaining work')
reset();assert(add('bait'));local job=RemoteCatalog.CraftQueue[1]
for _,bad in ipairs({{[1]=job,[3]=job}, {job,false}, {job,job,job,job,job,job,job,job,job}}) do
 RemoteCatalog.CraftQueue=bad;assert(not RemoteCatalog.SetCraftEnabled(true,true) and #trace==0,'malformed or oversized queue must send nothing')
end
reset();assert(add('bait',250) and add('testRecipe'))
assert(RemoteCatalog.SetCraftEnabled(true,true) and #trace==1)
assert(RemoteCatalog.SetCraftPaused(true));for _=1,30 do step() end
assert(#trace==1 and RemoteCatalog.CraftQueueTotal==100 and RemoteCatalog.CraftQueueIndex==1,'Pause must keep worker/job/progress and send no additional request')
assert(RemoteCatalog.SetCraftPaused(false));drain()
assert(#trace==4 and inventory.bait==250 and inventory.testRecipe==100,'Resume must finish remaining quantities without restarting the first job')
reset();assert(add('bait',250) and add('testRecipe'))
behavior=function(amount,binding) coroutine.yield('in-flight');inventory[binding.Item]=(inventory[binding.Item] or 0)+amount;return true end
assert(RemoteCatalog.SetCraftEnabled(true,true));assert(RemoteCatalog.SetCraftPaused(true));step()
for _=1,10 do step() end
assert(#trace==1 and RemoteCatalog.CraftQueueTotal==100 and RemoteCatalog.CraftPaused,'Pause must permit confirmation of the in-flight batch while holding the next request')
RemoteCatalog.SetCraftEnabled(false);drain()
assert(#trace==1 and not RemoteCatalog.CraftPaused and not RemoteCatalog.CraftWorker,'Stop from Pause must cancel the rest of the queue')
-- Editing is descriptor-only, explicit and blocked through every active/IO state.
reset();assert(add('bait',250) and add('testRecipe',100))
assert(RemoteCatalog.SelectCraftQueueJob(1) and RemoteCatalog.CraftTarget==250 and RemoteCatalog.CraftItem=='bait' and #trace==0)
RemoteCatalog.CraftTarget=500;RemoteCatalog.CraftBatch=25;RemoteCatalog.CraftMode='Top up stock'
assert(RemoteCatalog.CraftQueue[1].Target==250,'changing the form cannot mutate the queued job before Apply')
assert(RemoteCatalog.ApplyCraftQueueJob() and RemoteCatalog.CraftQueue[1].Target==500 and RemoteCatalog.CraftQueue[1].Batch==25 and RemoteCatalog.CraftQueue[1].Mode=='Top up stock')
local saved=RemoteCatalog.CraftQueue[1]
RemoteCatalog.CraftMode='Continuous'
assert(not RemoteCatalog.ApplyCraftQueueJob() and RemoteCatalog.CraftQueue[1]==saved,'invalid edits must retain the original descriptor')
assert(not RemoteCatalog.MoveCraftQueueJob(-1) and not RemoteCatalog.MoveCraftQueueJob(0) and not RemoteCatalog.SelectCraftQueueJob(3) and not RemoteCatalog.SelectCraftQueueJob(1.5))
assert(RemoteCatalog.MoveCraftQueueJob(1) and RemoteCatalog.CraftQueueSelected==2 and RemoteCatalog.CraftQueue[2]==saved)
assert(not RemoteCatalog.MoveCraftQueueJob(1),'moving past the end must preserve every job')
assert(RemoteCatalog.SelectCraftQueueJob(1));RemoteCatalog.CraftTarget=250
assert(RemoteCatalog.ApplyCraftQueueJob())
for _,field in ipairs({'CraftWorker','CraftEnabled','CraftPresetBusy','CraftCatalogLoading','CraftLearning'}) do
 RemoteCatalog[field]=true
 assert(not RemoteCatalog.SelectCraftQueueJob(2) and not RemoteCatalog.MoveCraftQueueJob(1) and not RemoteCatalog.ApplyCraftQueueJob() and not RemoteCatalog.EditCraftQueue(false),'running/paused/finishing/loading states must reject direct edit callbacks')
 RemoteCatalog[field]=nil
end
RemoteCatalog.Recorder=recorder;recorder.LearnCraftOnly=true;assert(not RemoteCatalog.ApplyCraftQueueJob());recorder.LearnCraftOnly=nil;RemoteCatalog.Recorder=nil
assert(RemoteCatalog.SetCraftEnabled(true,true));drain()
assert(trace[1].Item=='testRecipe' and inventory.testRecipe==250 and inventory.bait==500,'the next explicit run must execute edited order, quantities and mode')
assert(RemoteCatalog.SelectCraftQueueJob(1) and RemoteCatalog.EditCraftQueue(false) and #RemoteCatalog.CraftQueue==1 and RemoteCatalog.CraftQueue[1].Item=='bait' and not RemoteCatalog.CraftQueueSelected,'Remove selected must remove the chosen index and clear the edit cursor')
RemoteCatalog.CraftQueue={{Item='unlearned',Mode='Make amount',Batch=100,Target=100}}
assert(RemoteCatalog.SelectCraftQueueJob(1));RemoteCatalog.CraftTarget=250
assert(RemoteCatalog.ApplyCraftQueueJob() and RemoteCatalog.CraftQueue[1].Target==250,'loaded recipes may be edited before learning; Run still validates their bindings')
local count=#trace
assert(not RemoteCatalog.SetCraftEnabled(true,true) and #trace==count)
reset();assert(add('bait') and add('testRecipe'))
behavior=function(amount,binding) coroutine.yield('in-flight');inventory[binding.Item]=(inventory[binding.Item] or 0)+amount;return true end
assert(RemoteCatalog.SetCraftEnabled(true,true));gui.Parent=nil
assert(not RemoteCatalog.ApplyCraftQueueJob() and not RemoteCatalog.SelectCraftQueueJob(1),'destroyed UI must reject queue editing')
drain()
assert(#trace==1 and not RemoteCatalog.CraftQueueRunning and not RemoteCatalog.CraftWorker,'GUI removal must cancel the remaining queue')
return 'Craft queue: order, partial batches, top-up, repeated recipes, preflight, frozen jobs, Stop, material/no-gain/cooldown failures, range, stale context, caps and cleanup passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'craft-queue',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
