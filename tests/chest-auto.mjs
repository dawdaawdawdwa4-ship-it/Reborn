import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const source=main.slice(main.indexOf('-- CHEST AUTO BEGIN'),main.indexOf('-- CHEST AUTO END'));
const code=`
local gui={Parent=true}
local COLORS={on=1,off=2}
local RemoteCatalog={ChestAutoButton={},ChestResultLabel={},Navigation={Stop=function(owner) assert(owner=="Chest") end}}
local worker
local task={spawn=function(fn) worker=coroutine.create(fn);local ok,err=coroutine.resume(worker);assert(ok,err) end,wait=function(dt) coroutine.yield(dt) end}
local inventory,chest,calls,readable=0,75,{},true
local valid,reached=true,true
local binding={Amount=30}
local recorder={ChestBinding=binding,CanUseChestBinding=function() return valid end}
RemoteCatalog.LiveRecorder=function() return recorder end
RemoteCatalog.SelectedChestTargets=function() return {{Recorder=recorder,Binding=binding}} end
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
gui.Parent=true;valid=true;readable=true;reached=true
local a,b={Amount=30,Id='A'},{Amount=12,Id='B'}
local remaining={A=75,B=23}
local sent={}
inventory=0
RemoteCatalog.SelectedChestTargets=function() return {{Recorder=recorder,Binding=a},{Recorder=recorder,Binding=b}} end
RemoteCatalog.WithdrawCarrots=function(amount,owner,selected)
 assert(owner==recorder and (selected==a or selected==b),'auto must pass the exact chest binding to replay')
 table.insert(sent,selected.Id)
 if remaining[selected.Id]<amount then return false,{reason='empty'} end
 remaining[selected.Id]-=amount;inventory+=amount;return true
end
assert(RemoteCatalog.SetChestAuto(true));drain()
assert(inventory==98 and remaining.A==0 and remaining.B==0 and RemoteCatalog.ChestAutoTotal==98,'multi chest auto must collect both full and partial stacks')
assert(sent[1]=='A' and sent[2]=='B','auto must rotate between chests rather than blocking behind the first one')
remaining={A=0,B=9};inventory=0;sent={}
assert(RemoteCatalog.SetChestAuto(true));drain()
assert(inventory==9 and remaining.B==0,'empty first chest must not stop another chest')
remaining={A=100,B=9};inventory=0;sent={}
recorder.CanUseChestBinding=function(_,selected) return selected~=a end
assert(RemoteCatalog.SetChestAuto(true));drain()
assert(inventory==9 and remaining.A==100,'invalid first chest must be skipped while other chests continue')
for _,id in ipairs(sent) do assert(id=='B','invalid chest must never send') end
recorder.CanUseChestBinding=function() return true end
RemoteCatalog.ApproachChest=function(_,_,selected) return selected~=a,'out of range' end
remaining={A=100,B=9};inventory=0;sent={}
assert(RemoteCatalog.SetChestAuto(true))
for i=1,80 do if coroutine.status(worker)=='suspended' then local ok,err=coroutine.resume(worker);assert(ok,err) end end
assert(inventory==9 and remaining.A==100 and RemoteCatalog.ChestAutoEnabled,'unreachable chest must not block a reachable one')
RemoteCatalog.SetChestAuto(false);drain()
RemoteCatalog.ApproachChest=function() return true end
local slots={['A:0']=30,['A:5']=17,['A:11']=2,['B:12']=30,['B:3']=4}
local expanded={}
for _,chest in ipairs({'A','B'}) do
 for slot=0,12 do table.insert(expanded,{Recorder=recorder,Binding={Amount=30,Probe=true,Key=chest..':'..slot}}) end
end
RemoteCatalog.SelectedChestTargets=function() return expanded end
inventory=0
local requests={}
RemoteCatalog.WithdrawCarrots=function(amount,owner,binding)
 local key=binding.Key
 if not requests[key] then assert(amount==1,'unverified slots must start with a one-item request') end
 requests[key]=(requests[key] or 0)+1
 local available=slots[key] or 0
 if available<amount then return false,{reason='empty or insufficient'} end
 slots[key]=available-amount;inventory+=amount;return true
end
assert(RemoteCatalog.SetChestAuto(true));drain()
assert(inventory==83 and RemoteCatalog.ChestAutoTotal==83,'whole-chest mode must drain every nonempty carrot slot including both index boundaries')
for _,remaining in pairs(slots) do assert(remaining==0,'a carrot stack was left behind') end
assert(requests['A:1']==1 and requests['B:0']==1,'empty probe slots must be skipped without repeated retries')
-- Walk mode must drain all slots in one physical chest before travelling again.
local physicalA,physicalB={},{}
local routed={
 {Recorder=recorder,Binding={Chest=physicalA,Slot=0,Amount=5,Key='A:0'}},
 {Recorder=recorder,Binding={Chest=physicalA,Slot=1,Amount=5,Key='A:1'}},
 {Recorder=recorder,Binding={Chest=physicalB,Slot=0,Amount=5,Key='B:0'}},
}
RemoteCatalog.ChestTravel='Walk'
RemoteCatalog.SelectedChestTargets=function() return routed end
slots={['A:0']=10,['A:1']=10,['B:0']=10};inventory=0
local visits={}
RemoteCatalog.WithdrawCarrots=function(amount,_,binding)
 table.insert(visits,binding.Chest)
 if slots[binding.Key]<amount then return false,'empty' end
 slots[binding.Key]-=amount;inventory+=amount;return true
end
assert(RemoteCatalog.SetChestAuto(true));drain()
local leftA=false
for _,chest in ipairs(visits) do
 if chest==physicalB then leftA=true end
 assert(not leftA or chest~=physicalA,'Walk must not bounce back to a chest after each batch')
end
assert(inventory==30 and string.find(RemoteCatalog.ChestLastDetail,'Pass finished: 30 carrots',1,true),'completed pass must report the confirmed total')
-- An unreachable current chest must release its preference so another can run.
RemoteCatalog.ApproachChest=function(_,_,binding) return binding.Chest~=physicalA,'out of range' end
slots={['A:0']=10,['A:1']=10,['B:0']=10};inventory=0
assert(RemoteCatalog.SetChestAuto(true))
for i=1,100 do if coroutine.status(worker)=='suspended' then local ok,err=coroutine.resume(worker);assert(ok,err) end end
assert(inventory==10 and RemoteCatalog.ChestAutoEnabled,'blocked Walk chest must not starve reachable targets')
RemoteCatalog.SetChestAuto(false);drain()
return 'Chest Auto Max: batches/remainder, inventory confirmation, range wait/resume, one worker, bounded no-progress, Stop/in-flight restart, errors/session/GUI cleanup passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'chest-auto',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
