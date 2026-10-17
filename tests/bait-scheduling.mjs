import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8').replaceAll('\r\n','\n');
const controls=main.slice(main.indexOf('local function setBaitEnabled(state)'),main.indexOf('local harvestToggle ='));
const apply=main.slice(main.indexOf("local function applyBait()"),main.indexOf("local function setBaitEnabled(state)"));
const run=main.slice(main.indexOf('local function run(myCycle)'),main.indexOf('-- Controls\n'));
const code=`
local RemoteCatalog={}
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
getBobber=function() return {Parent=true} end
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
 assert(not applyBait() and attempts==1,'first unconfirmed attempt must establish a count sample')
 quantity=15;recorder.BaitBinding={Target=bait}
 local confirmed,detail=applyBait()
 assert(confirmed and detail=='bait consumption confirmed' and attempts==1,'fresh captured use plus decreased quantity between retries must confirm without consuming more bait')
 player.Character={FindFirstChild=function() return bait end};quantity=14;recorder.BaitBinding={Target=bait}
 assert(not applyBait() and attempts==2,'a different character must not inherit consumption confirmation')
end
return 'Bait scheduling: queued priority, long-cast retry, success/OFF release, next-cast blocking and existing-cast completion passed'
`;
const state=await LuauState.createAsync();try{console.log(await state.loadstring(code,'bait-scheduling',true)());}finally{state.destroy();}
