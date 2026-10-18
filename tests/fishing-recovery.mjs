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
  assert(slot==0);slotToggles+=1;selected=nil
 end}
 local RemoteCatalog={BaitPending=mode~='no-bait',GameModule=function() return mode=='native' and native or nil end,
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
 if mode=='no-bait' then assert(equips==1 and selected==rod,'fishing without queued bait must restore the rod') end
end
for _,mode in ipairs({'native','fallback','no-bait','stuck','stop','respawn','manual','locked','loading','chat'}) do scenario(mode) end
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
return 'Fishing recovery: persistent cast limit, native slot zero/fallback, observed removal, queued bait handoff, no-bait continuation, failure, Stop, respawn and manual tool preservation passed'
`;
const state=await LuauState.createAsync();
try{console.log(await state.loadstring(code,'fishing-recovery',true)());}finally{state.destroy();}
