import fs from 'node:fs';
import {LuauState} from 'luau-web';
const source=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8').replaceAll('\r\n','\n');
const helpers=source.slice(source.indexOf('local function hasRodEquipped()'),source.indexOf('local function waitForTug'));
const waitHelpers=source.slice(source.indexOf('local function waitForTug'),source.indexOf('-- Auto Mine (Cobalt')) ;
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
local UserInputService={GetFocusedTextBox=function() return focused end}
local playerGui={GetGuiObjectsAtPosition=function() return covered and {{IsA=function(_,class) return class=='GuiButton' end}} or {} end}
local mouseX,mouseY=0,0
local failMove,failDown,failWait=false,false,false
local game={}
local VirtualInputManager={}
function VirtualInputManager:SendMouseMoveEvent(x,y,target)
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
local CONFIG={CastHold=.35}
local os={clock=function() return time end}
local task={wait=function(dt)
 time+=dt
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
return 'Fishing input passed: aim first, charged cast, short reel, cancellation/error release, rod validation and owned bobber discovery'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'fishing-smoke',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
