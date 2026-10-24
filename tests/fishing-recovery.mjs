import fs from 'node:fs';
import {LuauState} from 'luau-web';
const source=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8').replaceAll('\r\n','\n');
const wait=source.slice(source.indexOf('local function waitUntil('),source.indexOf('-- FISHING RECOVERY BEGIN'));
const recover=source.slice(source.indexOf('-- FISHING RECOVERY BEGIN'),source.indexOf('-- FISHING RECOVERY END'));
const run=source.slice(source.indexOf('local function run(myCycle)'),source.indexOf('-- Controls\n'));
const code=`
local function scenario(mode)
 local time,enabled=0,true
 local os={clock=function() return time end}
 local CONFIG={FishingPollInterval=.05}
 local baitBusy,fishingInputBusy=false,false
 local rod={Name='fishingRod'}
 local other={Name='manualTool'}
 local selected=rod
 local bobber={Parent=true}
 local unequips,equips,slotToggles=0,0,0
 local humanoid={UnequipTools=function()
  unequips+=1;selected=nil
 end}
 local character={FindFirstChildOfClass=function(_,kind) if kind=='Tool' then return selected else return humanoid end end}
 local player={Character=character,Name='Test',GetAttribute=function() return mode=='locked' end,FindFirstChild=function() if mode=='loading' then return {Value=true} end end}
 local UserInputService={GetFocusedTextBox=function() return mode=='chat' and {} or nil end}
 local function running(token) return enabled and token==1 end
 local function hasRodEquipped() return selected==rod end
 local function getBobber() return bobber.Parent and bobber or nil end
 local function setStatus() end
 local COLORS={warn=1,good=2}
 local task={wait=function(dt)
  time+=dt
  if mode=='stop' then enabled=false
  elseif mode=='respawn' then player.Character={}
  elseif mode=='manual' then selected=other end
  if mode~='stuck' and mode~='stop' and mode~='respawn' and time>=.15 then bobber.Parent=nil end
 end}
 local native={selectedHotbarIndex=0,hotbar={[0]=rod},setSelectedHotbarIndex=function(_,slot)
  assert(slot==0);slotToggles+=1;if mode~='native-noop' then selected=nil end
 end}
 local RemoteCatalog={BaitPending=mode~='no-bait',GameModule=function() return (mode=='native' or mode=='native-noop') and native or nil end,
  EquipTool=function(tool) equips+=1;selected=tool;return true end,
  EquipFishingRod=function() error('unexpected selection') end}
 ${wait}
 ${recover}
 local cleared=RemoteCatalog.RecoverFishingCast(1,bobber)
 if mode=='locked' or mode=='loading' or mode=='chat' then assert(not cleared and unequips==0 and slotToggles==0 and equips==0,'locked tools, loading and chat must prevent recovery changes')
 elseif mode=='stuck' then assert(not cleared and bobber.Parent and selected==rod and equips==1 and time>=2,'unconfirmed reset must keep bobber and restore rod without inventing success')
 elseif mode=='stop' or mode=='respawn' then assert(not cleared and equips==0,'Stop/respawn must cancel recovery without restoring stale tools')
 elseif mode=='manual' then assert(cleared and selected==other and equips==0,'manual selection must not be overwritten')
 else assert(cleared and not bobber.Parent,'recovery must observe bobber disappearance') end
 if mode=='native' then assert(slotToggles==1 and unequips==0 and equips==0 and selected==nil,'slot zero reset must leave queued bait a tool-free handoff') end
 if mode=='native-noop' then assert(slotToggles==1 and unequips==1 and cleared and selected==nil,'a hotbar toggle that changes nothing must fall back to UnequipTools instead of trusting the call') end
 if mode=='no-bait' then assert(equips==1 and selected==rod,'fishing without queued bait must restore the rod') end
end
for _,mode in ipairs({'native','native-noop','fallback','no-bait','stuck','stop','respawn','manual','locked','loading','chat'}) do scenario(mode) end
-- One bobber instance reused across casts: per-bobber state must not survive a catch.
do
 local time,enabled=0,true
 local os={clock=function() return time end}
 local CONFIG={ActionCooldown=0,ReelSettleDelay=.01,ReelTimeout=.7,CastTimeout=.5,MaxFailedCasts=3}
 local gui={Parent=true}
 local baitBusy,baitEnabled=false,false
 local harvestEnabled,woodEnabled,mineEnabled=false,false,false
 local lastAction=-100
 local bobber={Parent=true}
 local stats={bites=0,casts=0}
 local waits,reels,casts,catches=0,0,0,0
 local function running(token) return enabled and token==1 end
 local function getBobber() return bobber.Parent and bobber or nil end
 local function waitForTug() waits+=1;return true,false end
 local function clickOnce(action)
  if action=='cast' then casts+=1;bobber.Parent=true;return true end
  reels+=1;bobber.Parent=nil;return true
 end
 local function waitUntil(_,_,predicate) return running(1) and predicate() end
 local function updateBoard() end
 local function setStatus() end
 local COLORS={warn=1,gold=2,good=3,muted=4}
 local function registerMiss() error('no miss expected') end
 local function registerCatch() catches+=1;if catches>=2 then enabled=false end end
 local function hasRodEquipped() return true end
 local lastNewItem,reelTime
 local RemoteCatalog={CompleteModeGoal=function() end,BeginPropellerCatch=function() end,EquipFishingRod=function() return true end,RecoverFishingCast=function() error('no recovery expected') end}
 local steps=0
 local task={wait=function(dt) time+=dt;steps+=1;assert(steps<60,'worker did not settle') end}
 ${run}
 run(1)
 assert(catches==2 and waits==2 and reels==2 and casts==1,'the second cast with the same bobber instance must wait for its own bite instead of reeling at once')
end
-- A cast whose input went out but failed the post-release check still waits for the bobber instead of casting again.
do
 local time,enabled=0,true
 local os={clock=function() return time end}
 local CONFIG={ActionCooldown=0,ReelSettleDelay=.01,ReelTimeout=.7,CastTimeout=.5,MaxFailedCasts=3}
 local gui={Parent=true}
 local baitBusy,baitEnabled=false,false
 local harvestEnabled,woodEnabled,mineEnabled=false,false,false
 local lastAction=-100
 local bobber={Parent=false}
 local stats={bites=0,casts=0}
 local casts,inFlightSeen=0,false
 local function running(token) return enabled and token==1 end
 local function getBobber() return bobber.Parent and bobber or nil end
 local function waitForTug() enabled=false;return false,false end
 local function clickOnce(action) assert(action=='cast');casts+=1;return false,'right mouse held after release',true end
 local function hasRodEquipped() return true end
 local lastNewItem,reelTime
 local RemoteCatalog={CompleteModeGoal=function() end,BeginPropellerCatch=function() end,EquipFishingRod=function() return true end,RecoverFishingCast=function() end}
 local function waitUntil(_,timeout,predicate)
  assert(timeout==CONFIG.CastTimeout,'a dispatched cast must wait the cast timeout for its bobber')
  inFlightSeen=RemoteCatalog.CastInFlight==true;bobber.Parent=true;enabled=false;return predicate()
 end
 local function updateBoard() end
 local function setStatus() end
 local COLORS={warn=1,gold=2,good=3,muted=4}
 local function registerMiss() end
 local function registerCatch() end
 local task={wait=function(dt) time+=dt end}
 ${run}
 run(1)
 assert(casts==1 and inFlightSeen and stats.casts==0,'a sent-but-unconfirmed cast is not counted, keeps CastInFlight for bait and is never doubled')
end
-- Exercise the real worker until a persistent bobber triggers recovery.
do
 local enabled=true
 local function running() return enabled end
 local CONFIG={ActionCooldown=0,ReelSettleDelay=.01,ReelTimeout=.7}
 local gui={Parent=true}
 local baitBusy,baitEnabled=false,true
 local harvestEnabled,woodEnabled,mineEnabled=false,false,false
 local lastAction=-100
 local bobber={Parent=true}
 local stats={bites=0}
 local function getBobber() return bobber.Parent and bobber or nil end
 local function waitForTug() return true,false end
 local function clickOnce() return true end
 local function waitUntil() return false end
 local function updateBoard() end
 local function setStatus() end
 local COLORS={warn=1,gold=2,muted=3}
 local misses,recoveries,queueGaps=0,0,0
 local function registerMiss() misses+=1 end
 local function registerCatch() error('reset must not count a catch') end
 local task={wait=function() end}
 local RemoteCatalog={BaitPending=true,RecoverFishingCast=function(_,old)
  assert(old==bobber);recoveries+=1;bobber.Parent=nil;return true
 end}
 task.wait=function() if recoveries>0 then
  if not bobber.Parent then queueGaps+=1 end
  if queueGaps>=2 then enabled=false end
 end end
 ${run}
 run(1)
 assert(recoveries==1 and misses==1 and stats.bites==1 and queueGaps>=2,'three unconfirmed reels must recover once, preserve counters and hand control back to queued bait')
end
-- A single bite must survive blocked input and action cooldowns until reeling.
local function transientBite(mode)
 local time,enabled=0,true
 local os={clock=function() return time end}
 local CONFIG={ActionCooldown=.04,ReelSettleDelay=.01,ReelTimeout=.7}
 local gui={Parent=true}
 local baitBusy,baitEnabled=false,false
 local harvestEnabled,woodEnabled,mineEnabled=false,false,false
 local lastAction=mode=='cooldown' and 0 or -100
 local original={Parent=true};local current=original
 local waits,inputs,catches,recoveries=0,0,0,0
 local stats={bites=0}
 local function running(token) return enabled and token==1 end
 local function getBobber() return current.Parent and current or nil end
 local function waitForTug()
  waits+=1
  if mode=='replaced' then current={Parent=true} end
  return waits==1,waits>1
 end
 local function clickOnce(action,token)
  assert(action=='reel' and token==1)
  inputs+=1
  if mode=='interrupted' then return false,'mouse hold interrupted',true end
  if mode=='blocked' or mode=='stop' then
   if inputs<=4 then return false,'on-screen controls cover the fishing aim' end
  end
  current.Parent=nil;return true
 end
 local function waitUntil(_,_,predicate) return running(1) and predicate() end
 local function updateBoard() end
 local message
 local function setStatus(text) message=text end
 local COLORS={warn=1,gold=2,good=3}
 local function registerMiss() error('a blocked input cannot invent a missed catch') end
 local function registerCatch() catches+=1;enabled=false end
 local RemoteCatalog={CompleteModeGoal=function() end,RecoverFishingCast=function()
  recoveries+=1
  assert(mode=='interrupted','blocked/unsent reels cannot consume the three-attempt reset budget')
  enabled=false;return false
 end}
 local steps=0
 local task={wait=function(dt)
  time+=dt;steps+=1;assert(steps<30,'fishing worker did not settle')
  if mode=='stop' or mode=='replaced' then enabled=false end
 end}
 ${run}
 run(1)
 if mode=='blocked' then
  assert(waits==1 and inputs==5 and catches==1 and recoveries==0 and stats.bites==1,'a transient bite must survive four blocked clicks and reel once controls clear without resetting or waiting for a second bite')
 elseif mode=='cooldown' then
  assert(waits==1 and inputs==1 and catches==1 and time>=.04 and stats.bites==1,'a bite during the action cooldown must yield then reel the same bite')
 elseif mode=='stop' then
  assert(inputs==1 and catches==0 and recoveries==0 and string.find(message,'on-screen controls cover',1,true),'Stop must cancel a retained bite and preserve the specific blocking reason')
 elseif mode=='replaced' then
  assert(inputs==0 and catches==0 and stats.bites==0,'a replaced bobber cannot receive a reel intended for the old bite')
 else assert(inputs==3 and recoveries==1 and catches==0,'dispatched but interrupted input must still consume the bounded recovery budget') end
end
for _,mode in ipairs({'blocked','cooldown','stop','replaced','interrupted'}) do transientBite(mode) end
return 'Fishing recovery: persistent cast limit, native slot zero/fallback, observed removal, queued bait handoff, no-bait continuation, failure, Stop, respawn and manual tool preservation passed'
`;
const state=await LuauState.createAsync();
try{console.log(await state.loadstring(code,'fishing-recovery',true)());}finally{state.destroy();}
