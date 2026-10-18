import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const source=main.slice(main.indexOf('-- CHEST AUTO BEGIN'),main.indexOf('-- CHEST AUTO END'));
const code=`
local gui={Parent=true}
local COLORS={on=1,off=2}
local RemoteCatalog={ChestAutoButton={},ChestResultLabel={}}
local worker
local task={spawn=function(fn) worker=coroutine.create(fn);local ok,err=coroutine.resume(worker);assert(ok,err) end,wait=function(dt) coroutine.yield(dt) end}
local inventory,chest,calls,readable=0,75,{},true
local valid,reached=true,true
local binding={Amount=30}
local recorder={ChestBinding=binding,CanUseChestBinding=function() return valid end}
RemoteCatalog.LiveRecorder=function() return recorder end
RemoteCatalog.OwnedTools=function() return {{Name='carrotHarvested'},{Name='carrotSeeds'},{Name='bait'}} end
RemoteCatalog.BaitCount=function() return readable and inventory or nil end
RemoteCatalog.ChestResultText=function(v) return type(v)=='table' and v.reason or tostring(v) end
RemoteCatalog.ApproachChest=function() return reached,'out of range' end
local function request(amount)
 table.insert(calls,amount)
 if amount>chest then return false,{reason='insufficient items'} end
 chest-=amount;inventory+=amount;return true
end
RemoteCatalog.WithdrawCarrots=request
${source}
local function drain()
 for i=1,500 do
  if not worker or coroutine.status(worker)=='dead' then return end
  local ok,err=coroutine.resume(worker);assert(ok,err)
 end
 error('worker failed to settle')
end
assert(not RemoteCatalog.ChestAutoEnabled and not RemoteCatalog.ChestAutoWorker,'must not start on load')
assert(RemoteCatalog.SetChestAuto(true))
local originalWorker=worker
assert(RemoteCatalog.SetChestAuto(true) and worker==originalWorker,'double ON must not create a second worker')
drain()
assert(inventory==75 and chest==0 and RemoteCatalog.ChestAutoTotal==75 and not RemoteCatalog.ChestAutoEnabled,'Auto Max must collect full batches and the smaller remaining stack')
assert(#calls<20 and calls[1]==30 and not RemoteCatalog.ChestBusy and not RemoteCatalog.ChestAutoWorker,'withdrawal must be bounded, serialized and clean up')
-- An accepted response without inventory movement must not imply transfer.
calls={};inventory=0;RemoteCatalog.WithdrawCarrots=function(amount) table.insert(calls,amount);return true end
assert(RemoteCatalog.SetChestAuto(true));drain()
assert(RemoteCatalog.ChestAutoTotal==0 and not RemoteCatalog.ChestAutoEnabled and #calls<=8,'no progress must back off to one and stop after bounded retries')
-- Unreadable quantities send nothing.
readable=false;calls={}
assert(RemoteCatalog.SetChestAuto(true));drain()
assert(#calls==0 and not RemoteCatalog.ChestAutoEnabled,'unreadable inventory must stop before sending')
readable=true
-- Range/path waits send no requests, and can resume once approach succeeds.
reached=false;calls={};chest=60;inventory=0;RemoteCatalog.WithdrawCarrots=request
assert(RemoteCatalog.SetChestAuto(true) and #calls==0 and RemoteCatalog.ChestAutoEnabled)
assert(coroutine.resume(worker) and #calls==0,'out-of-range wait must not issue requests')
reached=true;drain();assert(inventory==60 and chest==0,'approach completion must allow withdrawal')
-- A cancelled approach must not release a lock subsequently owned by manual withdrawal.
reached=false
assert(RemoteCatalog.SetChestAuto(true))
RemoteCatalog.SetChestAuto(false)
RemoteCatalog.ChestBusy=true -- a manual request can start while the old approach is cancelling
assert(coroutine.resume(worker))
assert(RemoteCatalog.ChestBusy,'old worker cleanup must not release another request lock')
RemoteCatalog.ChestBusy=false;reached=true
-- Stop during an in-flight request must prevent another request or immediate overlapping restart.
calls={};inventory=0
RemoteCatalog.WithdrawCarrots=function(amount) table.insert(calls,amount);task.wait(.1);inventory+=amount;return true end
assert(RemoteCatalog.SetChestAuto(true) and #calls==1)
RemoteCatalog.SetChestAuto(false)
assert(not RemoteCatalog.SetChestAuto(true),'restart must wait for an in-flight worker to finish')
drain();assert(#calls==1 and not RemoteCatalog.ChestBusy and not RemoteCatalog.ChestAutoWorker and not RemoteCatalog.ChestAutoEnabled,'stopped request must clean up without sending again')
-- Exceptions, session changes and GUI destruction must release the worker.
RemoteCatalog.WithdrawCarrots=function() error('transport failed') end
assert(RemoteCatalog.SetChestAuto(true));drain()
assert(not RemoteCatalog.ChestBusy and not RemoteCatalog.ChestAutoWorker and string.find(RemoteCatalog.ChestLastDetail,'transport failed',1,true))
RemoteCatalog.WithdrawCarrots=request;chest=100;inventory=0
assert(RemoteCatalog.SetChestAuto(true));local before=#calls
valid=false;drain();assert(#calls==before and not RemoteCatalog.ChestAutoEnabled,'session invalidation must stop additional sends')
valid=true;chest=100
assert(RemoteCatalog.SetChestAuto(true));before=#calls;gui.Parent=nil;drain()
assert(#calls==before and not RemoteCatalog.ChestAutoWorker and not RemoteCatalog.ChestBusy,'GUI removal must stop sends and release state')
return 'Chest Auto Max: batches/remainder, inventory confirmation, range wait/resume, one worker, bounded no-progress, Stop/in-flight restart, errors/session/GUI cleanup passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'chest-auto',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
