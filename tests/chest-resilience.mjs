import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const core=main.slice(main.indexOf('-- CHEST AUTO BEGIN'),main.indexOf('-- CHEST AUTO END'));
const manual=main.slice(main.indexOf('function RemoteCatalog.WithdrawSelectedCarrots('),main.indexOf('-- CHEST PROFILES BEGIN'));
const guard=main.slice(main.indexOf('-- CHEST CONVEYOR GUARD BEGIN'),main.indexOf('-- CHEST CONVEYOR GUARD END'));
const code=`
local gui={Parent=true}
local COLORS={on=1,off=2}
local RemoteCatalog={ChestAutoButton={},ChestResultLabel={},ChestIntro={},Navigation={Stop=function() end}}
local task={}
local worker,clock,quantity,readable,usable,reachable,calls,onWait,request
local a={Chest={Name='chestSmall'},Item='potatoSalad',Amount=30,Slot=1}
local b={Chest=a.Chest,Item='potatoSalad',Amount=30,Slot=2}
local targets={}
local owner={CanUseChestBinding=function() return usable end}
RemoteCatalog.SelectedChestTargets=function() return targets end
RemoteCatalog.OwnedTools=function() return {{Name='potatoSalad'}} end
RemoteCatalog.BaitCount=function() return readable and quantity or nil end
RemoteCatalog.ApproachChest=function() return reachable,'out of range' end
RemoteCatalog.ChestRequestReady=function() return reachable,'Stand within 20 studs' end
RemoteCatalog.ChestResultText=function(value)
 if type(value)=='table' then return tostring(value.error or value.code or value.reason) end
 return tostring(value)
end
RemoteCatalog.ChestClock=function() return clock end
RemoteCatalog.WithdrawCarrots=function(amount,_,binding)
 local entry={Amount=amount,Slot=binding.Slot,At=clock};table.insert(calls,entry)
 return request(amount,binding)
end
task.wait=function(dt) clock+=dt;if onWait then onWait(dt) end;return coroutine.yield(dt) end
task.spawn=function(fn) worker=coroutine.create(fn);local ok,e=coroutine.resume(worker);assert(ok,e) end
${guard}
${core}
${manual}
local function step()
 if worker and coroutine.status(worker)~='dead' then local ok,e=coroutine.resume(worker);assert(ok,e) end
end
local function drain()
 for _=1,1000 do if not worker or coroutine.status(worker)=='dead' then return end;step() end
 error('worker did not settle')
end
local function reset()
 assert(not RemoteCatalog.ChestAutoWorker,'previous worker leaked')
 clock=0;quantity=0;readable=true;usable=true;reachable=true;calls={};onWait=nil;gui.Parent=true
 targets={{Recorder=owner,Binding=a}}
 RemoteCatalog.ChestGoal=30;RemoteCatalog.ChestAutoBatch=30;RemoteCatalog.ChestStockTarget=nil
 RemoteCatalog.ChestRepeat=false;RemoteCatalog.ChestTravel='Stay';RemoteCatalog.ChestOrder='Same stack'
 RemoteCatalog.ChestRateDelay=nil;RemoteCatalog.ChestRequestAt=nil;RemoteCatalog.ChestRateFloor=nil;RemoteCatalog.ChestRateCeiling=nil
 request=function(amount) quantity+=amount;return true end
end
local function has(text,part) return string.find(text,part,1,true)~=nil end
reset()
request=function() error('transport failed after send') end
assert(RemoteCatalog.SetChestAuto(true));drain()
assert(#calls==1 and calls[1].Amount==30 and RemoteCatalog.ChestAutoTotal==0 and RemoteCatalog.ChestHistory[1].Outcome=='Needs review','thrown transport failure must stop after one request without shrinking or crediting inventory')
for _,scenario in ipairs({
 {Kind='transport',Response='connection closed'},
 {Response={success=false,error='INVENTORY_FULL'},Outcome='Blocked'},
 {Response={success=false,error='INVALID_SESSION'},Outcome='Blocked'},
 {Response={success=false,error='PERMISSION_DENIED'},Outcome='Blocked'},
 {Response={success=false,error='INSUFFICIENT_PERMISSIONS'},Outcome='Blocked'},
 {Response={success=false,error='UNKNOWN_FAILURE'},Outcome='Blocked'},
}) do
 reset()
 request=function() quantity+=7;return false,scenario.Response,scenario.Kind end
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(#calls==1 and calls[1].Amount==30 and RemoteCatalog.ChestAutoTotal==0 and RemoteCatalog.ChestHistory[1].Outcome==(scenario.Outcome or 'Needs review'),'non-amount failures must not replay requests or misattribute an uncertain result')
end
reset();targets={{Recorder=owner,Binding=a},{Recorder=owner,Binding=b}}
request=function(amount,binding) if binding==a then return false,{success=false,error='INVALID_SLOT'} end;quantity+=amount;return true end
assert(RemoteCatalog.SetChestAuto(true));drain()
assert(#calls==2 and calls[1].Slot==1 and calls[2].Slot==2 and calls[2].Amount==30 and RemoteCatalog.ChestAutoTotal==30,'a stale slot must be skipped once without reducing the batch for another slot')
reset()
local settleAt
request=function(amount) settleAt=clock+3.2;return true end
onWait=function() if settleAt and clock>=settleAt then quantity=30 end end
assert(RemoteCatalog.SetChestAuto(true) and RemoteCatalog.ChestConfirming=='potatoSalad')
assert(has(RemoteCatalog.ChestIntro.Text,'Confirming potatoSalad'),'delayed confirmation must remain visible in the action status')
drain()
assert(#calls==1 and RemoteCatalog.ChestAutoTotal==30 and clock>=3.2 and clock<5 and not RemoteCatalog.ChestConfirming,'late replication must confirm the original request without any retry')
reset();request=function() return true end
assert(RemoteCatalog.SetChestAuto(true));drain()
assert(#calls==1 and clock>=5-1e-6 and RemoteCatalog.ChestHistory[1].Outcome=='Needs review' and has(RemoteCatalog.ChestLastDetail,'batch not reduced'),'accepted requests with no gain must wait, stop and retain their batch')
reset();readable=false
onWait=function() if clock>=2.6 then readable=true end end
assert(RemoteCatalog.SetChestAuto(true) and has(RemoteCatalog.ChestIntro.Text,'Waiting for potatoSalad quantity'),'pre-request metadata waiting must be visible without pretending a withdrawal is in flight')
drain()
assert(#calls==1 and calls[1].At>=2.6 and RemoteCatalog.ChestAutoTotal==30,'temporary pre-request metadata loss must recover beyond the first two-second check without restarting')
reset();readable=false
assert(RemoteCatalog.SetChestAuto(true));drain()
assert(#calls==0 and clock<10 and has(RemoteCatalog.ChestLastDetail,'three checks'),'persistent pre-request metadata loss must remain bounded and send nothing')
assert(not RemoteCatalog.ChestInventoryWaiting,'metadata recovery state must clear after cleanup')
reset();readable=false
onWait=function() if clock>=.2 then readable=true;reachable=false end end
assert(RemoteCatalog.SetChestAuto(true))
for _=1,10 do step() end
assert(#calls==0 and RemoteCatalog.ChestAutoEnabled,'moving away while inventory metadata settles must defer requests without shrinking the batch')
reachable=true;drain();assert(#calls==1 and calls[1].Amount==30 and RemoteCatalog.ChestAutoTotal==30)
reset();readable=false
onWait=function() readable=true;usable=false end
assert(RemoteCatalog.SetChestAuto(true));drain()
assert(#calls==0,'a session expiring during inventory waiting must never be dispatched')
reset();request=function() return true end
assert(RemoteCatalog.SetChestAuto(true));RemoteCatalog.SetChestPaused(true)
for _=1,5 do step() end
assert(RemoteCatalog.ChestAutoPaused and RemoteCatalog.ChestBusy and #calls==1,'Pause must retain the in-flight confirmation lock')
quantity=30;drain()
assert(RemoteCatalog.ChestAutoTotal==30 and #calls==1,'an accepted in-flight transfer may finish confirmation while paused')
reset();request=function() return true end
assert(RemoteCatalog.SetChestAuto(true));RemoteCatalog.SetChestAuto(false);quantity=30;drain()
assert(#calls==1 and RemoteCatalog.ChestAutoTotal==0 and not RemoteCatalog.ChestBusy and not RemoteCatalog.ChestConfirming,'Stop must discard late confirmation and release both request and status state')
reset()
request=function(amount) task.wait(.5);quantity+=amount;return true end
assert(RemoteCatalog.SetChestAuto(true) and RemoteCatalog.ChestRequestPending=='potatoSalad' and has(RemoteCatalog.ChestIntro.Text,'Waiting for server'),'in-flight requests must be distinguished from waiting for inventory confirmation')
RemoteCatalog.SetChestAuto(false)
assert(not RemoteCatalog.SetChestAuto(true) and RemoteCatalog.ChestRequestPending,'Stop must retain the in-flight lock until the server call returns')
drain()
assert(#calls==1 and not RemoteCatalog.ChestRequestPending and not RemoteCatalog.ChestBusy,'late server return must clear pending state without dispatching again')
-- Manual sweep uses the same failure classification and does not advance to
-- another slot after a transport error that may already have moved items.
reset();targets={{Recorder=owner,Binding=a},{Recorder=owner,Binding=b}}
request=function() return false,'network failure','transport' end
local manualResult
task.spawn(function() manualResult=table.pack(RemoteCatalog.WithdrawSelectedCarrots()) end);drain()
assert(not manualResult[1] and #calls==1 and has(string.lower(manualResult[2]),'check inventory'),'manual transport failure must stop the sweep before another slot')
local cycle={error='AMOUNT_TOO_LARGE'};cycle.value=cycle
assert(RemoteCatalog.ChestFailureKind(cycle)=='amount' and RemoteCatalog.ChestFailureKind({value={error='INVENTORY_FULL'},reason='insufficient items'})=='capacity','error classification must handle cycles and prioritize capacity over amount hints')
assert(RemoteCatalog.ChestFailureKind({error='SERVER_RESTARTING'})=='unknown','unknown server errors must not be guessed to mean empty')
return 'Chest resilience: uncertain transport, capacity/context failures, slot skip, late confirmation, bounded metadata recovery, range/session rechecks, Pause/Stop and manual cleanup passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'chest-resilience',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
