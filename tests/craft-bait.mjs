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
 RemoteCatalog.CraftBatch=100;RemoteCatalog.CraftTarget=100;RemoteCatalog.ChestBusy=false;RemoteCatalog.ChestAutoWorker=nil
end
assert(not RemoteCatalog.CraftEnabled and #calls==0,'craft must start OFF')
inventory=75
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
assert(#calls==1 and string.find(RemoteCatalog.CraftInfo.Text,'Target reached',1,true),'delayed replicated inventory gain must confirm without crafting extra batches')
reset();behavior=function(amount) coroutine.yield('in-flight');inventory+=amount;return true end
assert(RemoteCatalog.SetCraftEnabled(true) and #calls==1)
RemoteCatalog.SetCraftEnabled(false)
assert(not RemoteCatalog.SetCraftEnabled(true),'in-flight stop/restart cannot overlap requests')
drain();assert(#calls==1 and not RemoteCatalog.CraftWorker and not RemoteCatalog.CraftEnabled and string.find(RemoteCatalog.CraftInfo.Text,'cleanup complete',1,true),'cancelled request must finish with a clear OFF status')
reset();behavior=function(amount) coroutine.yield('replicating');inventory+=amount;return true end
assert(RemoteCatalog.SetCraftEnabled(true));gui.Parent=nil;drain()
assert(#calls==1 and not RemoteCatalog.CraftWorker,'GUI removal must finish without another request')
return 'Auto Craft Bait: top-up, batch repeat, cooldown bounds, inventory confirmation, range, ownership, stale context, cancellation and concurrency passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'craft-bait',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
