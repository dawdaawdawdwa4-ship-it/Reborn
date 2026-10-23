import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8').replaceAll('\r\n','\n');
const controls=main.slice(main.indexOf('local function setBaitEnabled(state)'),main.indexOf('RemoteCatalog.LearnBaitButton=button('));
const apply=main.slice(main.indexOf("local function applyBait()"),main.indexOf("local function setBaitEnabled(state)"));
const run=main.slice(main.indexOf('local function run(myCycle)'),main.indexOf('-- Controls\n'));
const code=`
local recoveries=0
local RemoteCatalog={BaitSignalAvailable=function() return type(firesignal)=="function" end,AcceptFreshBaitBinding=function() return nil end,RecoverFishingCast=function() recoveries+=1;return true end,EquipFishingRod=function() return false,"No rod" end}
local baitEnabled,baitBusy,baitCycleId=false,false,0
local gui={Parent=true}
local baitToggle,baitInfo={},{}
local COLORS={on=1,off=2,good=3,muted=4}
local function setStatus() end
local calls=0
local function applyBait()
 calls+=1
 if calls<3 then return false,'Waiting for the current cast to finish' end
 return true,'accepted'
end
local worker
local task={spawn=function(callback) worker=coroutine.create(callback);assert(coroutine.resume(worker)) end,wait=function(delay) coroutine.yield(delay) end}
${controls}
setBaitEnabled(true)
assert(calls==1 and RemoteCatalog.BaitPending,'bait due during a cast must reserve the next cast gap')
assert(coroutine.resume(worker));assert(calls==2 and RemoteCatalog.BaitPending,'reservation must survive a long cast')
assert(coroutine.resume(worker));assert(calls==3 and not RemoteCatalog.BaitPending,'successful bait must release fishing during its 60-second timer')
setBaitEnabled(false);assert(not RemoteCatalog.BaitPending,'manual OFF must clear queued bait')
-- A transient application exception must not strand the switch or cast reservation.
do
 local attempts=0
 applyBait=function() attempts+=1;if attempts==1 then error('temporary client error') end;return true,'accepted' end
 setBaitEnabled(true)
 assert(baitEnabled and not RemoteCatalog.BaitPending and string.find(RemoteCatalog.BaitLastResult,'temporary client error',1,true),'unexpected errors must leave a retrying worker with no stale cast reservation')
 for i=1,5 do assert(coroutine.resume(worker)) end
 assert(attempts==2 and not RemoteCatalog.BaitPending,'worker must retry after a transient exception')
 setBaitEnabled(false)
end
-- Execute the actual fishing loop with a pending application and no bobber.
local enabled,cycleId=true,1
local harvestEnabled,woodEnabled,mineEnabled=false,false,false
local function running() return enabled end
local function getBobber() return nil end
local function hasRodEquipped() error('queued bait must prevent a new cast') end
baitEnabled=true;RemoteCatalog.BaitPending=true
task.wait=function() enabled=false end
${run}
run(1)
assert(not enabled,'queued bait must yield instead of casting')
-- Existing casts must still be allowed to finish while bait is queued.
enabled=true
local tugChecks=0
local existingBobber={Parent=true}
getBobber=function() return existingBobber end
local function waitForTug() tugChecks+=1;return false,false end
-- Rebind the real run function to this existing-bobber fixture.
${run.replace('local function run(myCycle)','local function runExisting(myCycle)')}
runExisting(1)
assert(tugChecks==1,'pending bait must not block finishing the existing cast')
-- Missing inventory must release the cast reservation and preserve Fishing.
do
 local player={Character={FindFirstChild=function() return nil end},FindFirstChildOfClass=function() return nil end}
 RemoteCatalog.OwnedTools=function() return {} end
 enabled=true;RemoteCatalog.BaitPending=true
 ${apply}
 local applied,reason=applyBait()
 assert(not applied and reason=='bait tool not found' and RemoteCatalog.BaitOutOfStock and not RemoteCatalog.BaitPending and enabled,'empty bait inventory must never stop fishing or reserve new casts')
end
local rodChecks=0
getBobber=function() return nil end
hasRodEquipped=function() rodChecks+=1;return false end
enabled=true;run(1)
assert(rodChecks==1,'Fishing must proceed past the bait queue when inventory is empty')
do
 local quantity=16
 local bait={Name='bait'}
 local char={FindFirstChild=function() return bait end}
 local player={Character=char}
 local recorder={BaitBinding={Target=bait}}
 RemoteCatalog.BaitCount=function() return quantity end
 RemoteCatalog.AcceptFreshBaitBinding=function() return recorder end
 RemoteCatalog.LiveRecorder=function() return recorder end
 RemoteCatalog.PrepareBaitLearning=function() end
 local attempts=0
 RemoteCatalog.WithBaitTool=function() attempts+=1;return false,'Bait use unconfirmed' end
 ${apply}
 RemoteCatalog.BaitTransport='game food request'
 assert(not applyBait() and attempts==1,'first unconfirmed attempt must establish a count sample')
 assert(RemoteCatalog.BaitTryToolActivation,'unconfirmed native use must allow tool activation on the next retry')
 assert(RemoteCatalog.BaitNativeFailed and RemoteCatalog.BaitNativeFailed.Tool==bait,'native success without consumption must block repeated unconfirmed food requests')
 quantity=15;recorder.BaitBinding={Target=bait}
 local confirmed,detail=applyBait()
 assert(confirmed and detail=='bait consumption confirmed' and attempts==1,'fresh captured use plus decreased quantity between retries must confirm without consuming more bait')
 player.Character={FindFirstChild=function() return bait end};quantity=14;recorder.BaitBinding={Target=bait}
 RemoteCatalog.BaitDirectSignalFailed=true
 RemoteCatalog.BaitTransport='Tool:Activate'
 assert(not applyBait() and attempts==2,'a different character must not inherit consumption confirmation')
 assert(not RemoteCatalog.BaitDirectSignalFailed,'a new character must get a fresh activation attempt rather than inheriting the old signal failure')
 assert(not RemoteCatalog.BaitTryToolActivation,'unconfirmed tool use must allow the mouse method on a later retry')
 firesignal=function() end
 assert(not applyBait() and not RemoteCatalog.BaitTrySignal and not RemoteCatalog.BaitTryToolActivation,'failed tool activation must leave mouse input a turn instead of looping only signals/tools')
 RemoteCatalog.BaitTransport='Tool.Activated signal'
 assert(not applyBait() and not RemoteCatalog.BaitTrySignal and RemoteCatalog.BaitTryToolActivation,'failed signal activation must try the standard Tool method next')
 firesignal=nil
end
-- A newly captured request during failed normal input has not failed replay.
do
 local bait={Name='bait'}
 local character={FindFirstChild=function() return bait end}
 local player={Character=character}
 local recorder={}
 local original={Remote={Parent=true},Target=bait}
 local captured={Remote={Parent=true},Target=bait}
 local quantity=175
 RemoteCatalog.BaitCount=function() return quantity end
 RemoteCatalog.LiveRecorder=function() return recorder.BaitBinding and recorder or nil end
 RemoteCatalog.BaitFailedBinding=original
 RemoteCatalog.BaitSample=nil
 RemoteCatalog.AcceptFreshBaitBinding=function() return recorder.BaitBinding and recorder or nil end
 RemoteCatalog.WithBaitTool=function()
  recorder.BaitBinding=captured -- outgoing hook learns while normal input is in flight
  RemoteCatalog.BaitTransport='host mouse bait click'
  return false,'Bait use unconfirmed'
 end
 ${apply}
 assert(not applyBait() and RemoteCatalog.BaitFailedBinding==original,'unconfirmed input must not blacklist a captured request which was never replayed')
 quantity=174
 local ok,reason=applyBait()
 assert(ok and reason=='bait consumption confirmed','late consumption with a fresh captured request must confirm without another use')
 -- If replay itself fails, blacklist the attempted template, not a newer one observed in flight.
 RemoteCatalog.BaitSample=nil
 RemoteCatalog.WithBaitTool=function()
  RemoteCatalog.BaitAttemptedBinding=captured
  recorder.BaitBinding={Remote={Parent=true},Target=bait}
  RemoteCatalog.BaitTransport='learned request test'
  return false,'Bait use unconfirmed'
 end
 assert(not applyBait() and RemoteCatalog.BaitFailedBinding==captured and RemoteCatalog.BaitFailedBinding~=recorder.BaitBinding,'only the actually attempted binding must be marked failed')
end
-- ManualActivationOnly must select the engine first, and Tool replacement must not restart fallback.
do
 local bait={Name='bait',ManualActivationOnly=true}
 local char={FindFirstChild=function() return bait end}
 local player={Character=char}
 firesignal=function() end -- API exists but silently does nothing on this account.
 RemoteCatalog.AcceptFreshBaitBinding=function() return nil end
 RemoteCatalog.LiveRecorder=function() return nil end
 RemoteCatalog.BaitCount=function() return 43 end
 RemoteCatalog.BaitInputCharacter=nil
 RemoteCatalog.BaitSample=nil
 local attempts=0
 RemoteCatalog.WithBaitTool=function()
  attempts+=1
  if attempts==1 then
   assert(RemoteCatalog.BaitTryToolActivation and not RemoteCatalog.BaitTrySignal,'manual-only bait must use real engine activation before a synthetic signal')
   RemoteCatalog.BaitTransport='Tool:Activate'
  else
   assert(not RemoteCatalog.BaitTrySignal and not RemoteCatalog.BaitTryToolActivation,'replacement bait must retain the next mouse fallback, not restart the signal route')
   RemoteCatalog.BaitTransport='host mouse bait click'
  end
  return false,'Bait use unconfirmed'
 end
 ${apply}
 assert(not applyBait(),'no consumption must not be confirmed')
 local old=bait
 bait={Name='bait',ManualActivationOnly=true}
 assert(not applyBait() and attempts==2 and RemoteCatalog.BaitInputTool==bait,'same-character inventory rebuild must preserve fallback progress')
 assert(RemoteCatalog.BaitTrySignal,'after a failed mouse attempt, the signal method must still get a turn')
 firesignal=nil
end
-- Manual learning must accept the last bait disappearing before Auto Bait is re-enabled.
do
 local bait={Name='bait',Parent=nil}
 local character={FindFirstChild=function() return nil end}
 local player={Character=character,FindFirstChildOfClass=function() return nil end}
 local binding={Target=bait,ObservedAt=os.clock()}
 RemoteCatalog.OwnedTools=function() return {} end
 RemoteCatalog.AcceptFreshBaitBinding=function() return {BaitBinding=binding} end
 RemoteCatalog.BaitSample={Character=character,Tool=bait,Count=1,Binding={},At=os.clock()-30,Manual=true}
 ${apply}
 local ok,detail=applyBait()
 assert(ok and detail=='bait consumption confirmed' and RemoteCatalog.BaitOutOfStock,'captured manual consumption of the last bait must confirm before the empty-inventory branch')
 assert(not applyBait(),'one manual use must never be confirmed a second time')
end
-- Timeouts must keep Fishing enabled, including after bait runs out.
do
 local enabled=true
 local function running() return enabled end
 local CONFIG={BiteTimeout=30,ActionCooldown=0,CastTimeout=1,MaxFailedCasts=1}
 local lastAction=-100
 local stats={casts=0}
 local function updateBoard() end
 local function setEnabled() error('retry must not switch Fishing OFF') end
 local mode='bite'
 local existingBobber={Parent=true}
 local function getBobber() if mode=='bite' then return existingBobber end end
 local function waitForTug() return false,true end
 local function hasRodEquipped() return true end
 local clicks=0
 local function clickOnce() clicks+=1;return true end
 local function waitUntil() return false end
 local waited
 local task={wait=function(delay) waited=delay;enabled=false end}
 baitBusy=false;baitEnabled=true;RemoteCatalog.BaitPending=false;RemoteCatalog.BaitOutOfStock=true
 ${run.replace('local function run(myCycle)','local function retryRun(myCycle)')}
 retryRun(1)
 assert(clicks==0 and recoveries==1 and waited==1,'bite timeout must recover the cast without disabling Fishing')
 enabled=true;mode='cast';clicks=0
 retryRun(1)
 assert(clicks==1 and waited==2,'failed casts must back off without disabling Fishing')
end
-- Repeated reel attempts against the same bobber are one missed cast.
do
 local enabled=true
 local function running() return enabled end
 local CONFIG={ActionCooldown=0,ReelSettleDelay=.01,ReelTimeout=.7}
 local lastAction=-100
 local bobber={Parent=true}
 local stats={bites=0}
 local function getBobber() return bobber end
 local function waitForTug() return true,false end
 local function clickOnce() return true end
 local function updateBoard() end
 local attempts,misses=0,0
 local function waitUntil() attempts+=1;return false end
 local function registerMiss() misses+=1 end
 local task={wait=function(delay) if attempts>=2 then enabled=false end end}
 baitBusy=false
 ${run.replace('local function run(myCycle)','local function repeatedReel(myCycle)')}
 repeatedReel(1)
 assert(attempts==2 and misses==1 and stats.bites==1,'one bobber must not inflate bite/miss counts on retries')
end
-- A reached catch goal exits the real fishing loop before another input.
do
 local enabled=true
 local function running() return enabled end
 local CONFIG={ActionCooldown=0,ReelSettleDelay=.01,ReelTimeout=.7}
 local lastAction=-100
 local bobber={Parent=true}
 local stats={bites=0}
 local function getBobber() return bobber end
 local function waitForTug() return true,false end
 local clicks,catches=0,0
 local function clickOnce() clicks+=1;return true end
 local function updateBoard() end
 local function waitUntil() return true end
 local function registerCatch() catches+=1 end
 local task={wait=function() end}
 local RemoteCatalog={CompleteModeGoal=function(mode)
  assert(mode=='fishing' and catches==1,'fishing goal check must follow catch registration')
  enabled=false
 end}
 baitBusy=false
 ${run.replace('local function run(myCycle)','local function goalFishing(myCycle)')}
 goalFishing(1)
 assert(clicks==1 and catches==1 and not enabled,'reached goal must prevent another cast or reel input')
end
return 'Bait scheduling: queued priority, long-cast retry, success/OFF release, next-cast blocking and existing-cast completion passed'
`;
const state=await LuauState.createAsync();try{console.log(await state.loadstring(code,'bait-scheduling',true)());}finally{state.destroy();}
