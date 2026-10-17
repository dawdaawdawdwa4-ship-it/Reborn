import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8').replaceAll('\r\n','\n');
const controls=main.slice(main.indexOf('local function setBaitEnabled(state)'),main.indexOf('local harvestToggle ='));
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
return 'Bait scheduling: queued priority, long-cast retry, success/OFF release, next-cast blocking and existing-cast completion passed'
`;
const state=await LuauState.createAsync();try{console.log(await state.loadstring(code,'bait-scheduling',true)());}finally{state.destroy();}
