import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const core=main.slice(main.indexOf('-- CRAFT BAIT BEGIN'),main.indexOf('-- CRAFT BAIT END'));
const wait=main.slice(main.indexOf('function RemoteCatalog.WaitChestInventory'),main.indexOf('function RemoteCatalog.ChestAutoMessage'));
const code=`
local gui={Parent=true}
local COLORS={on=1,off=2}
local RemoteCatalog={CraftToggle={},CraftLearnButton={},CraftInfo={},CloseMenus=function() end}
local island={};local bench={Parent=island};local distance=0
local position=setmetatable({},{__sub=function() return {Magnitude=distance} end})
local root={Position=position}
local player={Character={FindFirstChild=function() return root end}}
local function getPlayerIsland() return island end
local function getPartPosition() return position end
local worker
local task={spawn=function(fn) worker=coroutine.create(fn);local ok,e=coroutine.resume(worker);assert(ok,e) end,wait=function(dt) return coroutine.yield(dt) end}
local inventory,calls,valid,pending=0,{},true,false
local behavior=function(amount) inventory+=amount;return true end
local recorder={CraftBinding={Workbench=bench},CanUseCraftBinding=function() return valid end,CraftBait=function(_,amount) table.insert(calls,amount);return behavior(amount) end,Stop=function(self) self.Stopped=true end}
RemoteCatalog.LiveRecorder=function() return recorder end
RemoteCatalog.CarrotCount=function() if pending then return nil,'pending' end;return inventory end
RemoteCatalog.ChestTooFast=function(value) return type(value)=='table' and value.error=='TOO_FAST' end
RemoteCatalog.ChestResultText=function(value) return type(value)=='table' and value.error or tostring(value) end
${wait}
${core}
local function step() if coroutine.status(worker)~='dead' then local ok,e=coroutine.resume(worker);assert(ok,e) end end
local function drain() for _=1,500 do if coroutine.status(worker)=='dead' then return end;step() end;error('craft failed to settle') end
local function reset()
 if worker and coroutine.status(worker)~='dead' then RemoteCatalog.SetCraftEnabled(false);drain() end
 inventory=0;calls={};valid=true;pending=false;bench.Parent=island;distance=0
 behavior=function(amount) inventory+=amount;return true end
 RemoteCatalog.CraftItem="bait";RemoteCatalog.CraftMode="Top up stock";RemoteCatalog.CraftBatch=100;RemoteCatalog.CraftTarget=100;RemoteCatalog.ChestBusy=false;RemoteCatalog.ChestAutoWorker=nil
end
assert(not RemoteCatalog.CraftEnabled and #calls==0 and RemoteCatalog.CraftMode=='Make amount','craft must start OFF with Make amount selected')
-- Reported regression: already owning 3770 must not block making 100 more.
inventory=3770
assert(RemoteCatalog.SetCraftEnabled(true));drain()
assert(#calls==1 and calls[1]==100 and inventory==3870 and string.find(RemoteCatalog.CraftInfo.Text,'Made +100',1,true),'Make amount must ignore existing stock and count only this run')
reset();RemoteCatalog.CraftMode='Make amount';RemoteCatalog.CraftTarget=500;inventory=3770
assert(RemoteCatalog.SetCraftEnabled(true));drain()
assert(#calls==5 and inventory==4270,'larger run must use separate batches capped at one hundred')
for _,amount in ipairs(calls) do assert(amount==100,'every request must respect the crafting limit') end
reset();RemoteCatalog.CraftMode='Make amount';RemoteCatalog.CraftTarget=250;inventory=3770
assert(RemoteCatalog.SetCraftEnabled(true))
assert(RemoteCatalog.CraftMaterialRun and RemoteCatalog.CraftMaterialRun.Item=='bait' and RemoteCatalog.CraftMaterialRun.Target==250 and RemoteCatalog.CraftMaterialRun.Confirmed==100,'material estimates must receive the frozen active job and actual confirmed progress')
RemoteCatalog.CraftMode='Top up stock';RemoteCatalog.CraftTarget=100
-- Mode/amount are frozen even if external code changes the configuration mid-run.
drain();assert(#calls==3 and calls[1]==100 and calls[2]==100 and calls[3]==50 and inventory==4020,'Make amount needs a smaller last batch and frozen run settings')
assert(RemoteCatalog.CraftMaterialRun==nil,'completed workers must clear the active material estimate')
reset();inventory=3770
assert(RemoteCatalog.SetCraftEnabled(true));drain()
assert(#calls==0 and string.find(RemoteCatalog.CraftInfo.Text,'Choose Make amount',1,true),'Top up stock must explain why existing stock prevents a request')
assert(string.find(RemoteCatalog.CraftDiagnosticReport(),'Stock target already met',1,true),'craft diagnostics must explain the reported high-stock case without requests')
reset();inventory=3770;RemoteCatalog.CraftTarget=5000
assert(RemoteCatalog.SetCraftEnabled(true));drain()
assert(inventory==5000 and #calls==13 and calls[13]==30,'Top up stock must support targets above existing 3770 and cap each batch')
for _,amount in ipairs(calls) do assert(amount<=100) end
reset();RemoteCatalog.CraftMode='Make amount';inventory=3770;valid=false
local report=RemoteCatalog.CraftDiagnosticReport()
assert(string.find(report,'Craft request ready: false',1,true) and string.find(report,'Press Learn recipe',1,true) and #calls==0,'craft report must distinguish missing craft binding from a bait-use binding without sending')
valid=true
report=RemoteCatalog.CraftDiagnosticReport()
assert(string.find(report,'Craft request ready: true',1,true) and string.find(report,'Item inventory: 3770',1,true),'craft report must use actual crafting readiness and stock')
reset();RemoteCatalog.CraftBatch=101
assert(not RemoteCatalog.SetCraftEnabled(true) and #calls==0,'invalid batches above one hundred must never send')
reset();RemoteCatalog.CraftMode='unknown'
assert(not RemoteCatalog.SetCraftEnabled(true) and #calls==0,'invalid craft mode must never send')
reset();inventory=75
assert(RemoteCatalog.SetCraftEnabled(true));drain()
assert(#calls==1 and calls[1]==25 and inventory==100 and not RemoteCatalog.CraftEnabled,'craft only inventory deficit and stop on target')
reset();RemoteCatalog.CraftBatch=25
assert(RemoteCatalog.SetCraftEnabled(true));local original=worker
assert(RemoteCatalog.SetCraftEnabled(true) and worker==original,'double ON must remain serialized')
drain();assert(#calls==4 and inventory==100,'repeat chosen batch until target')
reset();inventory=100;assert(RemoteCatalog.SetCraftEnabled(true));drain();assert(#calls==0,'existing target sends nothing')
reset();behavior=function() return true end
assert(RemoteCatalog.SetCraftEnabled(true));drain()
assert(#calls==1 and string.find(RemoteCatalog.CraftInfo.Text,'No confirmed',1,true),'accepted response without quantity gain must stop')
reset();behavior=function() return false,{error='MISSING_MATERIALS',success=false} end
assert(RemoteCatalog.SetCraftEnabled(true));drain();assert(#calls==1 and string.find(RemoteCatalog.CraftInfo.Text,'MISSING_MATERIALS',1,true),'rejected craft must not repeat or claim inventory')
reset();behavior=function() return false,{error='TOO_FAST',success=false} end
assert(RemoteCatalog.SetCraftEnabled(true));drain()
assert(#calls==6 and not RemoteCatalog.CraftEnabled,'cooldown retries must stop after five, without reducing batch')
for _,amount in ipairs(calls) do assert(amount==100) end
reset();behavior=function(amount) if #calls<3 then return false,{error='TOO_FAST'} end;inventory+=amount;return true end
assert(RemoteCatalog.SetCraftEnabled(true));drain();assert(#calls==3 and inventory==100,'recover cooldown and confirm actual gain')
reset();distance=30
assert(RemoteCatalog.SetCraftEnabled(true) and #calls==0 and RemoteCatalog.CraftEnabled,'range wait must remain ON without requests')
for _=1,15 do step() end
assert(#calls==0);distance=0;drain();assert(#calls==1,'moving in range resumes without restart')
reset();bench.Parent={}
assert(RemoteCatalog.SetCraftEnabled(true));for _=1,15 do step() end
assert(#calls==0,'foreign island workbench must never send')
RemoteCatalog.SetCraftEnabled(false);assert(not RemoteCatalog.SetCraftEnabled(true),'restart must wait for cleanup');drain()
reset();valid=false
assert(not RemoteCatalog.SetCraftEnabled(true) and #calls==0,'stale binding cannot start')
reset();RemoteCatalog.ChestBusy=true
assert(RemoteCatalog.SetCraftEnabled(true));for _=1,10 do step() end;assert(#calls==0,'inventory confirmation must not overlap chest withdrawals')
RemoteCatalog.ChestBusy=false;drain();assert(#calls==1)
reset();pending=true
assert(RemoteCatalog.SetCraftEnabled(true));drain();assert(#calls==0,'unreadable inventory must send nothing')
reset();pending=true
assert(RemoteCatalog.SetCraftEnabled(true) and #calls==0)
distance=30;pending=false
for _=1,12 do step() end
assert(#calls==0 and RemoteCatalog.CraftEnabled,'moving away during quantity replication must recheck reach before any send')
distance=0;drain();assert(#calls==1)
reset();behavior=function() return true end
assert(RemoteCatalog.SetCraftEnabled(true) and #calls==1)
for _=1,5 do step() end
inventory=100;drain()
assert(#calls==1 and string.find(RemoteCatalog.CraftInfo.Text,'Stock target reached',1,true),'delayed replicated inventory gain must confirm without crafting extra batches')
reset();behavior=function(amount) coroutine.yield('in-flight');inventory+=amount;return true end
assert(RemoteCatalog.SetCraftEnabled(true) and #calls==1)
RemoteCatalog.SetCraftEnabled(false)
assert(not RemoteCatalog.SetCraftEnabled(true),'in-flight stop/restart cannot overlap requests')
drain();assert(#calls==1 and not RemoteCatalog.CraftWorker and not RemoteCatalog.CraftEnabled and string.find(RemoteCatalog.CraftInfo.Text,'cleanup complete',1,true),'cancelled request must finish with a clear OFF status')
-- Generic recipes keep inventory, observed bench and request envelope isolated.
reset()
local oldBait=recorder.CraftBinding
oldBait.Item='bait'
local other={Item='testRecipe',Workbench=bench}
recorder.CraftBindings={bait=oldBait,testRecipe=other}
local inventoryReads={}
local oldCount=RemoteCatalog.CarrotCount
RemoteCatalog.CarrotCount=function(item) table.insert(inventoryReads,item);return inventory end
recorder.CraftItem=function(_,amount,binding) assert(binding==other and amount<=100);table.insert(calls,amount);inventory+=amount;return true end
RemoteCatalog.CraftItem='testRecipe';RemoteCatalog.CraftTarget=250
assert(RemoteCatalog.SetCraftEnabled(true))
RemoteCatalog.CraftItem='bait';recorder.CraftBindings.testRecipe={Item='testRecipe',Workbench={}}
drain()
assert(inventory==250 and #calls==3 and calls[3]==50,'recipe and binding must remain fixed for the active run')
for _,item in ipairs(inventoryReads) do assert(item=='testRecipe','must confirm only the selected recipe inventory') end
RemoteCatalog.CraftItem='unknown'
assert(not RemoteCatalog.SetCraftEnabled(true),'unlearned recipes must never be synthesized')
recorder.CraftItem=nil;recorder.CraftBindings=nil;RemoteCatalog.CarrotCount=oldCount
reset()
local externalBinding={Item='testRecipe',Workbench=bench,Remote={Parent=true},Valid=true}
local external={CraftBinding={Item='stale',Remote={Parent=nil}},CraftBindings={testRecipe=externalBinding},CanUseCraftBinding=function(_,binding) return binding.Valid==true end,CraftItem=function() return true end}
getgenv=function() return {RebornCapture=external} end
RemoteCatalog.CraftItem='testRecipe'
local found,selected=RemoteCatalog.CraftRecorder()
assert(found==external and selected==externalBinding,'valid independent recipe must remain discoverable when another recipe remote has expired')
assert(table.find(RemoteCatalog.CraftRecipes(),'testRecipe'),'dynamic recipe list must include usable external recordings')
-- A foreign recorder with junk bindings is data, never a crash of the recipe list.
external.CraftBindings[7]={Valid=true};external.CraftBindings.broken='not a table'
local junkOk,junkList=pcall(RemoteCatalog.CraftRecipes)
assert(junkOk and table.find(junkList,'testRecipe') and not table.find(junkList,7) and not table.find(junkList,'broken'),'non-string names and non-table bindings from another script are ignored')
external.CraftBindings[7]=nil;external.CraftBindings.broken=nil
getgenv=nil
reset();RemoteCatalog.CraftMode='Continuous';inventory=3770
assert(RemoteCatalog.SetCraftEnabled(true))
for _=1,40 do step() end
assert(#calls>=3 and RemoteCatalog.CraftEnabled,'Continuous must keep crafting past the finite amount or inventory target')
local requests=#calls
RemoteCatalog.SetCraftEnabled(false);drain()
assert(#calls==requests and not RemoteCatalog.CraftWorker,'Stop must cancel Continuous without a later request')
reset();RemoteCatalog.CraftMode='Continuous';behavior=function(amount) if #calls>2 then return false,{error='MISSING_MATERIALS'} end;inventory+=amount;return true end
assert(RemoteCatalog.SetCraftEnabled(true));drain()
assert(#calls==3 and not RemoteCatalog.CraftEnabled,'Continuous must stop when materials run out rather than retrying indefinitely')
reset()
local savedBinding=recorder.CraftBinding
RemoteCatalog.StartCapture=function() return recorder end
recorder.Stopped=false
assert(RemoteCatalog.BeginCraftLearning())
local justLearned={Item='testRecipe',Workbench=bench}
recorder.CraftBinding=justLearned;recorder.CraftBindings={testRecipe=justLearned}
recorder.LearnCraftOnly=false;recorder.Stopped=true
recorder.CraftItem=function(_,amount,binding) assert(binding==justLearned);table.insert(calls,amount);inventory+=amount;return true end
RemoteCatalog.CraftMode='Make amount'
assert(RemoteCatalog.SetCraftEnabled(true));drain()
assert(RemoteCatalog.CraftItem=='testRecipe' and #calls==1 and inventory==100,'Start immediately after learning must use the newly observed recipe without waiting for a UI tick')
recorder.CraftBinding=savedBinding;recorder.CraftBindings=nil;recorder.CraftItem=nil;RemoteCatalog.StartCapture=nil
reset();behavior=function(amount) coroutine.yield('replicating');inventory+=amount;return true end
assert(RemoteCatalog.SetCraftEnabled(true));gui.Parent=nil;drain()
assert(#calls==1 and not RemoteCatalog.CraftWorker,'GUI removal must finish without another request')
return 'Auto Craft: learned recipe isolation, Continuous, Make amount at 3770 stock, 100/request cap, top-up, batch repeat, cooldown bounds, inventory confirmation, range, ownership, stale context, cancellation and concurrency passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'craft-bait',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
