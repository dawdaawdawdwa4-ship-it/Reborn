import fs from 'node:fs';
import {LuauState} from 'luau-web';
const source=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8').replaceAll('\r\n','\n');
const helpers=source.slice(source.indexOf('local function hasRodEquipped()'),source.indexOf('local function waitForTug'));
const waitHelpers=source.slice(source.indexOf('local function waitForTug'),source.indexOf('-- Auto Mine (Cobalt')) ;
const run=source.slice(source.indexOf('local function run(myCycle)'),source.indexOf('-- Controls\n'));
const cameraGuard=source.slice(source.indexOf('-- MOUSE CAMERA GUARD BEGIN'),source.indexOf('-- MOUSE CAMERA GUARD END'));
const code=`
local function vec(x,y,z)
 return setmetatable({X=x,Y=y,Z=z},{__add=function(a,b) return vec(a.X+b.X,a.Y+b.Y,a.Z+b.Z) end,__sub=function(a,b) return vec(a.X-b.X,a.Y-b.Y,a.Z-b.Z) end,__mul=function(a,b) return vec(a.X*b,a.Y*b,a.Z*b) end})
end
local Vector3={new=vec}
local time,enabled,cancel,down=0,true,false,false
local tool={Name='fishingRod'}
local root={Position=vec(0,0,0),CFrame={LookVector=vec(0,0,-1)}}
local player={Name='Test',UserId=7,Character={FindFirstChildOfClass=function() return tool end,FindFirstChild=function() return root end}}
local events={}
local focused,covered,swapOnAim,respawnOnHold
local Enum={MouseBehavior={Default=1,LockCenter=2,LockCurrentPosition=3},UserInputType={MouseButton2=2}}
local rightMouse,captureOnAim,captureOnHold=false,false,false
local UserInputService={MouseBehavior=Enum.MouseBehavior.Default,GetFocusedTextBox=function() return focused end,
 IsMouseButtonPressed=function(_,button) assert(button==Enum.UserInputType.MouseButton2);return rightMouse end}
local playerGui={GetGuiObjectsAtPosition=function() return covered and {{IsA=function(_,class) return class=='GuiButton' end}} or {} end}
local mouseX,mouseY=0,0
local failMove,failDown,failWait=false,false,false
local game={}
local VirtualInputManager={}
local virtualMoves=0
function VirtualInputManager:SendMouseMoveEvent(x,y,target)
 virtualMoves+=1
 assert(target==game,'input target missing')
 if failMove then error('blocked movement') end
 mouseX,mouseY=x,y
 table.insert(events,{'move',time,x,y})
end
function VirtualInputManager:SendMouseButtonEvent(x,y,button,pressed,target)
 assert(target==game)
 table.insert(events,{pressed and 'down' or 'up',time})
 if pressed and failDown then error('blocked press') end
 down=pressed
end
local mousemoveabs,mouse1press,mouse1release
local CONFIG={CastHold=.35}
local os={clock=function() return time end}
local task={wait=function(dt)
 time+=dt
 if captureOnAim and not down or captureOnHold and down then rightMouse=true end
 if swapOnAim and not down then tool={Name='stonePickaxe'} end
 if respawnOnHold and down then player.Character={} end
 if down and cancel then enabled=false end
 if down and failWait then error('interrupted hold') end
end}
local function running(token) return enabled and token==1 end
local hub={Root={Visible=true,AbsolutePosition={X=0,Y=0},AbsoluteSize={X=500,Y=500}}}
local status
local function setStatus(text) status=text end
local COLORS={warn=1}
local folder
local RemoteCatalog={}
local workspace={CurrentCamera={ViewportSize={X=1920,Y=1080},WorldToScreenPoint=function() return {X=1200,Y=600},true end},FindFirstChild=function() return folder end}
${cameraGuard}
${helpers}
assert(clickOnce('cast',1) and not down)
assert(events[1][1]=='move' and events[2][1]=='down' and events[3][1]=='up','aim/press/release order incorrect')
assert(events[3][2]-events[2][2]>=.35,'cast charge too short')
events={};time=0;mouseX,mouseY=100,100 -- User moved the mouse onto the hub after casting.
assert(clickOnce('reel',1) and #events==3 and events[1][1]=='move' and events[2][1]=='down' and events[3][2]-events[2][2]<.05,'reel must restore saved aim before a short press')
assert(events[1][3]==1200 and events[1][4]==600 and mouseX==1200 and mouseY==600,'reel must restore the cast coordinates after manual cursor movement')
failMove=true;events={}
assert(not clickOnce('reel',1) and #events==0,'blocked reel aiming must not send a blind press')
failMove=false
cancel=true;events={};time=0
assert(not clickOnce('cast',1) and not down and events[#events][1]=='up','Stop must release cast')
cancel=false;enabled=true;failWait=true;events={}
local heldOK,heldReason,heldSent=clickOnce('cast',1)
assert(not heldOK and heldSent and not down and events[#events][1]=='up','interrupted hold must release while retaining its dispatched-input classification')
failWait=false;failDown=true;events={}
assert(not clickOnce('cast',1) and events[#events][1]=='up','failed press still needs independent release')
failDown=false;failMove=true;events={}
assert(not clickOnce('cast',1) and #events==0,'blocked mouse move must not send press')
failMove=false;tool.Name='stonePickaxe';assert(not hasRodEquipped() and not clickOnce('cast',1),'pickaxe must not count as rod')
tool.Name='fishingRod'
focused={};events={}
assert(not clickOnce('cast',1) and #events==0,'editing chat must pause fishing input')
focused=nil;covered=true;events={}
assert(not clickOnce('reel',1) and #events==0,'game buttons covering the aim must prevent synthetic clicks')
local blocked,reason,sent=clickOnce('reel',1)
assert(not blocked and not sent and string.find(reason,'controls cover',1,true),'blocked reel must retain its precise reason and report no sent input')
covered=false;swapOnAim=true;events={}
assert(not clickOnce('cast',1) and #events==1 and events[1][1]=='move','tool switch during aiming must prevent press')
swapOnAim=false;tool={Name='fishingRod'}
local savedCharacter=player.Character
respawnOnHold=true;events={}
assert(not clickOnce('cast',1) and not down and events[#events][1]=='up' and not RemoteCatalog.FishingMouseInput,'respawn during charge must release input and clear the UI guard')
respawnOnHold=false;player.Character=savedCharacter
local savedRod=tool
local baitTool={Name='bait'}
local equips=0
RemoteCatalog.OwnedTools=function() return {baitTool,savedRod} end
RemoteCatalog.EquipTool=function(selected) equips+=1;tool=selected;return true end
tool=baitTool
assert(RemoteCatalog.EquipFishingRod(1) and tool==savedRod and equips==1,'Fishing must select owned rod after bait even when the previous tool was bait')
assert(RemoteCatalog.EquipFishingRod(1) and equips==1,'an already equipped rod must not be toggled off')
tool=nil
assert(RemoteCatalog.EquipFishingRod(1) and tool==savedRod and equips==2,'starting empty-handed must select the owned rod')
RemoteCatalog.OwnedTools=function() return {baitTool} end
tool=nil
local missing,missingReason=RemoteCatalog.EquipFishingRod(1)
assert(not missing and string.find(missingReason,'No fishing rod',1,true) and equips==2,'missing rod must show a reason without selecting bait')
RemoteCatalog.OwnedTools=function() return {baitTool,savedRod} end
tool=baitTool;enabled=false
assert(not RemoteCatalog.EquipFishingRod(1) and equips==2,'Fishing OFF must not select tools')
enabled=true;baitBusy=true
assert(not RemoteCatalog.EquipFishingRod(1) and equips==2,'bait application must keep exclusive tool control')
baitBusy=false
RemoteCatalog.EquipTool=function() return true end
assert(not RemoteCatalog.EquipFishingRod(1),'an API success without actual rod selection must not count as equipped')
tool=savedRod
local own={IsA=function(_,c) return c=='Model' end,GetAttribute=function(_,name) if name=='OwnerUserId' then return 7 end end}
local other={IsA=own.IsA,GetAttribute=function() return 8 end}
folder={FindFirstChild=function() return nil end,GetChildren=function() return {other,own} end}
assert(getBobber()==own,'owner/model bobber not detected')
folder.GetChildren=function() return {other} end
assert(getBobber()==nil,'must not use another player bobber')
-- Reproduce the video's blocked virtual mouse with complete alternate backends.
do
 local rod=tool
 local activate,deactivate=rod.Activate,rod.Deactivate
 local hostMoves,hostDowns,hostUps,toolDowns,toolUps=0,0,0,0,0
 local function resetInput()
  tool=rod;enabled=true;cancel=false;covered=false;focused=nil
  failMove=true;failDown=false;failWait=false;down=false;events={}
  swapOnAim=false;respawnOnHold=false
  rightMouse=false;captureOnAim=false;captureOnHold=false;UserInputService.MouseBehavior=Enum.MouseBehavior.Default;virtualMoves=0
  hostMoves,hostDowns,hostUps,toolDowns,toolUps=0,0,0,0,0
  mousemoveabs,mouse1press,mouse1release=nil,nil,nil
  rod.Activate=nil;rod.Deactivate=nil;rod.Enabled=true
 end
 local function host()
  mousemoveabs=function(x,y) hostMoves+=1;assert(x==1200 and y==600,'fallback must restore the same cast aim') end
  mouse1press=function() hostDowns+=1;down=true;assert(RemoteCatalog.FishingMouseInput,'host press must keep the existing UI guard') end
  mouse1release=function() hostUps+=1;down=false end
 end
 local function native()
  rod.Activate=function(self) assert(self==rod and RemoteCatalog.FishingMouseInput);toolDowns+=1;down=true end
  rod.Deactivate=function(self) assert(self==rod);toolUps+=1;down=false end
 end
 resetInput();host();native()
 assert(clickOnce('reel',1,true) and hostMoves==1 and hostDowns==1 and hostUps==1 and toolDowns==0 and #events==0 and not down,'blocked virtual movement must fall back to exactly one paired host mouse click')
 assert(RemoteCatalog.FishingInputTransport=='host mouse' and not RemoteCatalog.FishingMouseInput,'report must name the successful backend and release the UI guard')
 resetInput();host();assert(clickOnce('cast',1) and hostDowns==1 and hostUps==1,'host fallback may cast only after a successful aim move')
 resetInput();native()
 assert(clickOnce('reel',1) and toolDowns==1 and toolUps==1 and not down and #events==0,'blocked virtual movement with no host API must support one normal rod activation/deactivation for reeling')
 assert(RemoteCatalog.FishingInputTransport=='rod activation' and string.find(RemoteCatalog.FishingInputResult,'catch confirmation',1,true),'rod activation must remain input evidence rather than an invented catch')
 resetInput();native()
 assert(not clickOnce('cast',1) and toolDowns==0 and toolUps==0,'a rod activation cannot cast without a successful mouse aim')
 resetInput();native();rod.Enabled=false
 assert(not clickOnce('reel',1) and toolDowns==0,'a disabled rod must wait before native activation')
 resetInput();native();mouse1press=function() error('incomplete backend cannot press') end
 assert(clickOnce('reel',1) and toolDowns==1 and toolUps==1,'an incomplete host backend cannot steal native rod fallback')
 resetInput();native();host();mousemoveabs=function() hostMoves+=1;return false end
 assert(clickOnce('reel',1,true) and hostMoves==1 and hostDowns==0 and hostUps==0 and toolDowns==1 and toolUps==1,'an explicit failed host move sends no click and may choose rod activation')
 resetInput();host();native();cancel=true
 assert(not clickOnce('reel',1,true) and hostDowns==1 and hostUps==1 and toolDowns==0 and not down,'Stop during host hold must release that backend without activating the rod again')
 resetInput();native();cancel=true
 assert(not clickOnce('reel',1) and toolDowns==1 and toolUps==1 and not down,'Stop during normal rod activation must still deactivate the same rod')
 resetInput();host();native();swapOnAim=true
 assert(not clickOnce('reel',1,true) and hostMoves==1 and hostDowns==0 and toolDowns==0,'manual tool changes during fallback aiming must prevent every press')
 resetInput();host();native();focused={}
 assert(not clickOnce('reel',1) and hostMoves==0 and toolDowns==0,'fallback must preserve chat/text focus protection')
 resetInput();host();native();covered=true
 assert(clickOnce('reel',1) and hostMoves==0 and toolDowns==1 and virtualMoves==0,'direct reeling may activate the rod over visible UI without moving or clicking the cursor')
 resetInput();host();native();failMove=false;failDown=true
 assert(not clickOnce('reel',1,true) and hostMoves==0 and hostDowns==0 and toolDowns==0 and #events==3,'a dispatched virtual press error must release virtual input without replaying another backend')
 resetInput();host();native()
 mouse1press=function() hostDowns+=1;down=true;error('host press failed') end
 assert(not clickOnce('reel',1,true) and hostDowns==1 and hostUps==1 and toolDowns==0 and not down,'host press errors must still release host input and cannot replay a native activation')
 resetInput();native()
 rod.Activate=function() toolDowns+=1;down=true;error('activation failed') end
 assert(not clickOnce('reel',1) and toolDowns==1 and toolUps==1 and not down,'activation errors must still deactivate the rod')
 resetInput();host()
 mouse1press=function() hostDowns+=1;down=true;mouse1release=function() error('changed global must not replace the paired release') end end
 assert(clickOnce('reel',1) and hostDowns==1 and hostUps==1 and not down,'the selected host pair must stay stable if global functions change during the click')
 resetInput();native();failMove=false
 assert(clickOnce('reel',1) and toolDowns==1 and virtualMoves==0 and #events==0,'ordinary reels must prefer paired rod activation without moving the cursor')
 for _,behavior in ipairs({Enum.MouseBehavior.LockCenter,Enum.MouseBehavior.LockCurrentPosition}) do
  resetInput();host();native();UserInputService.MouseBehavior=behavior
  assert(clickOnce('reel',1) and toolDowns==1 and hostMoves==0 and virtualMoves==0 and UserInputService.MouseBehavior==behavior,'native reels must preserve a captured camera and cursor mode')
  resetInput();host();native();UserInputService.MouseBehavior=behavior
  assert(not clickOnce('cast',1) and hostMoves==0 and virtualMoves==0 and hostDowns==0 and UserInputService.MouseBehavior==behavior,'casting must pause before any cursor movement while mouse lock is active')
 end
 resetInput();host();native();rightMouse=true
 assert(not clickOnce('cast',1) and virtualMoves==0 and hostMoves==0 and hostDowns==0,'right-button camera dragging must pause casts without changing the camera')
 assert(clickOnce('reel',1,true) and toolDowns==1 and virtualMoves==0 and hostMoves==0,'even mouse retries must use native reeling while the camera is captured')
 resetInput();host();rightMouse=true
 assert(not clickOnce('reel',1) and virtualMoves==0 and hostMoves==0,'a client without native rod activation must wait for camera release before mouse reeling')
 resetInput();host();failMove=false;captureOnAim=true
 assert(not clickOnce('cast',1) and #events==1 and events[1][1]=='move' and hostDowns==0,'camera capture beginning during the aim delay must prevent a press')
 resetInput();host();failMove=false;captureOnHold=true
 assert(not clickOnce('cast',1) and #events==3 and events[3][1]=='up' and not down and rightMouse,'camera capture during a charge must release the left button and preserve manual camera control')
 resetInput();host();rightMouse=true
 assert(not clickOnce('cast',1));rightMouse=false
 assert(clickOnce('cast',1) and hostDowns==1 and hostUps==1,'casting must resume automatically after right-button camera control ends')
 resetInput();native();fishingInputBusy=true
 assert(not clickOnce('reel',1) and toolDowns==0,'restart cannot overlap a pending rod input')
 fishingInputBusy=false;resetInput();rod.Activate=activate;rod.Deactivate=deactivate
 failMove=false
end
${waitHelpers}
enabled=true;time=0;CONFIG.BiteTimeout=.05;CONFIG.FishingPollInterval=.01
local disconnected=false
local bobber={Parent=true,GetAttribute=function() return false end,GetAttributeChangedSignal=function() return {Connect=function() return {Disconnect=function() disconnected=true end} end} end}
task.wait=function(dt) time+=dt end
local tugged,timedOut=waitForTug(bobber,1)
assert(not tugged and timedOut and disconnected,'stuck bobber must timeout and disconnect')
bobber.GetAttribute=function() return true end;disconnected=false
assert(waitForTug(bobber,1) and disconnected,'existing tug must reel immediately')
bobber.GetAttribute=function() return false end;time=0;disconnected=false
task.wait=function(dt) time+=dt;enabled=false end
local tugged,timedOut=waitForTug(bobber,1)
assert(not tugged and not timedOut and disconnected,'Stop must exit bite wait without false timeout')
-- Subscribe before reading, and keep transient callbacks even when Tug clears.
do
 enabled=true;time=0;disconnected=false
 local value=false
 bobber.Parent=true
 bobber.GetAttribute=function() return value end
 bobber.GetAttributeChangedSignal=function() return {Connect=function()
  value=true -- Arrival between the old initial read and connection registration.
  return {Disconnect=function() disconnected=true end}
 end} end
 local tugged,timedOut=waitForTug(bobber,1)
 assert(tugged and not timedOut and time==0 and disconnected,'a bite arriving during listener registration must be detected immediately')
 local callback
 value=false;time=0;disconnected=false
 bobber.GetAttributeChangedSignal=function() return {Connect=function(_,fn) callback=fn;return {Disconnect=function() disconnected=true end} end} end
 task.wait=function(dt) time+=dt;value=true;callback();value=false end
 assert(waitForTug(bobber,1) and disconnected and value==false,'brief Tug pulses must remain latched after the attribute resets')
 value=false;time=0;disconnected=false
 task.wait=function(dt) time+=dt;value=true end
 assert(waitForTug(bobber,1) and disconnected,'attribute polling must recover a missed signal notification')
 value=false;time=0;disconnected=false
 task.wait=function(dt) time+=dt;value=true;callback();bobber.Parent=nil end
 tugged,timedOut=waitForTug(bobber,1)
 assert(not tugged and not timedOut and disconnected,'a removed bobber cannot authorize a stale reel after a bite pulse')
 value=false;bobber.Parent=true;time=0;disconnected=false
 task.wait=function(dt) time+=dt;enabled=false end
 CONFIG.BiteTimeout=.01
 tugged,timedOut=waitForTug(bobber,1)
 assert(not tugged and not timedOut and disconnected,'Stop at the timeout boundary cannot trigger cast recovery')
end
-- Exercise the real worker + real input helper against the exact blocked-move case.
do
 local originalMouseButton=VirtualInputManager.SendMouseButtonEvent
 for _,mode in ipairs({'rod','unconfirmed','mouse','stop'}) do
  local confirmed=mode=='rod' or mode=='stop'
  enabled=true;cancel=false;failMove=mode~='mouse';failDown=false;failWait=false;focused=nil;covered=false;time=0;down=false
  rightMouse=false;captureOnAim=false;captureOnHold=false;UserInputService.MouseBehavior=Enum.MouseBehavior.Default
  mousemoveabs,mouse1press,mouse1release=nil,nil,nil
  local bobber={Parent=true,IsA=function(_,kind) return kind=='BasePart' end,
   GetAttribute=function(_,name) return name=='Tug' end,
   GetAttributeChangedSignal=function() return {Connect=function() return {Disconnect=function() end} end} end}
  folder={FindFirstChild=function() return bobber.Parent and bobber or nil end,GetChildren=function() return {} end}
  local presses,releases,catches,misses,recoveries=0,0,0,0,0
  VirtualInputManager.SendMouseButtonEvent=function(self,x,y,button,pressed,...)
   originalMouseButton(self,x,y,button,pressed,...)
   if mode=='mouse' and not pressed then bobber.Parent=nil end
  end
  tool.Activate=function() presses+=1;down=true end
  tool.Deactivate=function() releases+=1;down=false;if confirmed then bobber.Parent=nil end end
  tool.Enabled=true
  CONFIG.ActionCooldown=.02;CONFIG.ReelSettleDelay=.01;CONFIG.ReelTimeout=.05
  task.wait=function(dt) time+=dt;if mode=='stop' and dt==.05 and not bobber.Parent then enabled=false end;assert(time<5,'blocked-input worker did not settle') end
  local stats={bites=0,casts=0}
  local lastAction,cycleId=-100,1
  local baitEnabled,baitBusy=false,false
  local harvestEnabled,woodEnabled,mineEnabled=false,false,false
  local function updateBoard() end
  local function registerCatch() catches+=1;enabled=false end
  local function registerMiss() misses+=1 end
  RemoteCatalog.CompleteModeGoal=function() end
  RemoteCatalog.RecoverFishingCast=function() recoveries+=1;enabled=false;return false end
  ${run}
  run(1)
  assert(not down and not RemoteCatalog.FishingMouseInput,'worker must release its selected backend')
  if mode=='rod' then assert(presses==1 and releases==1 and catches==1 and stats.bites==1 and misses==0 and recoveries==0,'native reeling must confirm without a cursor move')
  elseif mode=='mouse' then assert(presses==1 and releases==1 and catches==1 and misses==1 and recoveries==0 and RemoteCatalog.FishingInputTransport=='virtual mouse','unconfirmed native input must allow a separate mouse retry through existing confirmation')
  elseif mode=='stop' then assert(presses==1 and releases==1 and catches==0 and misses==0,'Stop during the delayed catch registration must never add a stale catch')
  else assert(presses==3 and releases==3 and catches==0 and misses==1 and recoveries==1,'accepted rod activation alone cannot count a catch and must retain bounded recovery') end
 end
 VirtualInputManager.SendMouseButtonEvent=originalMouseButton
end
return 'Fishing input passed: aim first, charged cast, short reel, cancellation/error release, rod validation and owned bobber discovery'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'fishing-smoke',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
