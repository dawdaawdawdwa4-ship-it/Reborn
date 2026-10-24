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
-- A goal-clipped request is not evidence of a lower chest/transport batch limit.
for _,batch in ipairs({30,'Max'}) do
 reset();quantity=95;RemoteCatalog.ChestGoal=nil;RemoteCatalog.ChestStockTarget=100;RemoteCatalog.ChestAutoBatch=batch
 request=function(amount)
  if #calls==1 then return false,{error='TOO_FAST',success=false} end
  RemoteCatalog.SetChestAuto(false);quantity+=amount;return true
 end
 onWait=function() if #calls==1 then quantity=0 end end
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(#calls==2 and calls[1].Amount==5 and calls[2].Amount==30,'recalculated top-up deficits must use the chosen batch, not the old clipped amount: '..tostring(batch))
end
reset();RemoteCatalog.ChestGoal=nil;RemoteCatalog.ChestStockTarget=100;RemoteCatalog.ChestAutoBatch='Max'
request=function(amount)
 if #calls==1 then return false,{error='AMOUNT_TOO_LARGE',success=false} end
 if #calls==3 then RemoteCatalog.SetChestAuto(false) end
 quantity+=amount;return true
end
onWait=function() if #calls==1 then quantity=95 elseif #calls==2 then quantity=0 end end
assert(RemoteCatalog.SetChestAuto(true));drain()
assert(#calls==3 and calls[1].Amount==30 and calls[2].Amount==5 and calls[3].Amount==15,'a clipped success must not replace the reduced batch currently being tested')
reset();quantity=95;RemoteCatalog.ChestGoal=nil;RemoteCatalog.ChestStockTarget=100
request=function(amount) if amount>2 then return false,{error='AMOUNT_TOO_LARGE',success=false} end;quantity+=amount;return true end
assert(RemoteCatalog.SetChestAuto(true));drain()
assert(#calls==4 and calls[1].Amount==5 and calls[2].Amount==2 and calls[3].Amount==2 and calls[4].Amount==1 and quantity==100,'real amount rejections must reduce the actual request size, including a clipped request')
-- Pre-dispatch snapshots must be discarded after any pause transition or Stop.
do
 local count,ready,approach,message,refresh=RemoteCatalog.CarrotCount,RemoteCatalog.ChestRequestReady,RemoteCatalog.ApproachChest,RemoteCatalog.ChestAutoMessage,RemoteCatalog.RefreshChestActions
 local function hooks(stage)
  local blocked,reads=false,0
  RemoteCatalog.CarrotCount=function(item)
   reads+=1;local old=count(item)
   if not blocked and (stage=='target' and reads==1 or stage=='inventory' and reads==2) then blocked=true;coroutine.yield();return old end
   return old
  end
  RemoteCatalog.ChestRequestReady=function(binding)
   if stage=='ready' and not blocked then blocked=true;coroutine.yield() end
   return ready(binding)
  end
  RemoteCatalog.ApproachChest=function(...)
   if stage=='approach' and not blocked then blocked=true;coroutine.yield() end
   return approach(...)
  end
  RemoteCatalog.ChestAutoMessage=function(text,color)
   message(text,color)
   if stage=='message' and not blocked and text:find('Taking ',1,true)==1 then blocked=true;coroutine.yield() end
  end
  RemoteCatalog.RefreshChestActions=function()
   refresh()
   if stage=='ui' and not blocked and RemoteCatalog.ChestRequestPending then blocked=true;coroutine.yield() end
  end
  return function() return blocked end
 end
 local function restore()
  RemoteCatalog.CarrotCount,RemoteCatalog.ChestRequestReady,RemoteCatalog.ApproachChest,RemoteCatalog.ChestAutoMessage,RemoteCatalog.RefreshChestActions=count,ready,approach,message,refresh
 end
 for _,stage in ipairs({'target','inventory','approach','ready','message','ui'}) do
  reset();quantity=stage=='target' and 100 or 95;RemoteCatalog.ChestGoal=nil;RemoteCatalog.ChestStockTarget=100
  local blocked=hooks(stage)
  assert(RemoteCatalog.SetChestAuto(true) and blocked() and #calls==0)
  local current=worker
  assert(RemoteCatalog.SetChestPaused(true));local epoch=RemoteCatalog.ChestPauseEpoch
  assert(RemoteCatalog.SetChestPaused(true) and RemoteCatalog.ChestPauseEpoch==epoch)
  quantity=stage=='inventory' and 100 or 0
  assert(RemoteCatalog.SetChestPaused(false) and worker==current);drain()
  local expected=stage=='inventory' and 0 or 4
  assert(#calls==expected and quantity==100 and RemoteCatalog.ChestAutoTotal==(stage=='inventory' and 0 or 100),'Resume must use fresh stock without skipping an unfinished top-up or taking extra: '..stage)
  if expected>0 then assert(calls[1].Amount==30 and calls[4].Amount==10,'an abandoned small request must not tune the batch down') end
  assert(RemoteCatalog.ChestHistory[1].Requests==expected and not RemoteCatalog.ChestBusy and not RemoteCatalog.ChestRequestPending,'discarded preparation must not count as a request or retain the busy lock')
  restore()
 end
 for _,stage in ipairs({'target','inventory','approach','ready','message','ui'}) do
  reset();RemoteCatalog.ChestStockTarget=100;local blocked=hooks(stage)
  assert(RemoteCatalog.SetChestAuto(true) and blocked() and #calls==0)
  RemoteCatalog.SetChestAuto(false);drain()
  assert(#calls==0 and RemoteCatalog.ChestHistory[1].Requests==0 and not RemoteCatalog.ChestBusy and not RemoteCatalog.ChestRequestPending,'Stop must prevent dispatch after a pending '..stage)
  restore()
 end
end
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
return 'Chest resilience: uncertain transport, capacity/context failures, slot skip, late confirmation, bounded metadata recovery, fresh Pause/Resume snapshots, Stop before dispatch, unclipped batch tuning and manual cleanup passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'chest-resilience',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
