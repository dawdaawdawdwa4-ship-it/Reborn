import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const source=main.slice(main.indexOf('-- AUTO PLOW BEGIN'),main.indexOf('-- AUTO PLOW END'));
const code=`
local mt={}
local function vector(x,y,z) return setmetatable({X=x,Y=y,Z=z},mt) end
function mt.__add(a,b) return vector(a.X+b.X,a.Y+b.Y,a.Z+b.Z) end
function mt.__sub(a,b) return vector(a.X-b.X,a.Y-b.Y,a.Z-b.Z) end
function mt.__index(a,key) if key=='Magnitude' then return math.sqrt(a.X^2+a.Y^2+a.Z^2) end end
local Vector3={new=vector}
local RaycastParams={new=function() return {} end}
local Enum={RaycastFilterType={Exclude=1}}
local gui={Parent=true};local COLORS={off=1,on=2}
local enabled,baitEnabled,baitBusy,harvestEnabled,woodEnabled,mineEnabled=false,false,false,false,false,false
local blocks,foreign={},{}
local children={}
function blocks:GetChildren() return children end
local root={Position=vector(0,4,0)}
local backpack={}
local char={}
local player={Character=char}
function char:FindFirstChild() return root end
function char:FindFirstChildOfClass() return self.Tool end
local function tool(name) return {Name=name,Parent=backpack,IsA=function(_,cls) return cls=='Tool' end} end
local hoe,previous,manual=tool('hoe'),tool('stonePickaxe'),tool('fishingRod')
char.Tool=previous;previous.Parent=char
local tools={hoe,previous}
local equipped={}
local RemoteCatalog={PlowButton={},PlowInfo={},BuildIslandBlocks=function() return blocks end,OwnedTools=function() return tools end,
 GameModule=function() return 20 end,EquipTool=function(t)
  if char.Tool then char.Tool.Parent=backpack end
  char.Tool=t;t.Parent=char;table.insert(equipped,t);return true
 end}
local buildController={}
local function block(name,x,z,parent)
 return {Name=name,Position=vector(x,0,z),Size=vector(3,3,3),CFrame={UpVector={Y=1}},Parent=parent or blocks,IsA=function(_,cls) return cls=='BasePart' end}
end
local a,b=block('grass',0,-3),block('dirt',3,-3)
local soil=block('soil',6,-3)
children={a,b,soil,block('grass',100,0),block('grass',0,0,foreign)}
local covered,visible,obstructed=false,true,false
local aimed
local workspace={CurrentCamera={CFrame={Position=vector(0,8,0)},WorldToScreenPoint=function(_,p)
 aimed=nil;for _,part in ipairs(children) do if part.Position.X==p.X and part.Position.Z==p.Z then aimed=part;break end end
 return {X=500+p.X,Y=250,Z=10},visible
end},Raycast=function(_,origin,direction)
 if direction.X==0 and direction.Z==0 and direction.Y==3 then return covered and {Instance={}} or nil end
 return {Instance=obstructed and {} or aimed}
end}
local focused,uiBlocked=false,false
local UserInputService={GetFocusedTextBox=function() return focused and {} end}
local playerGui={GetGuiObjectsAtPosition=function() return uiBlocked and {{IsA=function() return true end}} or {} end}
local hub={Root={Visible=false,AbsolutePosition={X=400,Y=200},AbsoluteSize={X=200,Y=200}}}
local worker,hook
local events={}
local confirm=true
local failPress,failHold=false,false
local game={}
local VirtualInputManager={SendMouseMoveEvent=function() table.insert(events,'move') end,SendMouseButtonEvent=function(_,x,y,button,down)
 table.insert(events,down and 'down' or 'up')
 if down and failPress then error('press failed') end
 if down and confirm and aimed then aimed.Name='soil' end
end}
local mousemoveabs,mouse1press,mouse1release
local elapsed=0
local os={clock=function() return elapsed end}
local task={spawn=function(fn) worker=coroutine.create(fn);local ok,e=coroutine.resume(worker);assert(ok,e) end,wait=function(dt)
 elapsed+=dt
 if hook then hook(dt) end
 if failHold and dt==.06 then error('hold failed') end
 coroutine.yield(dt)
end}
${source}
local function drain()
 for i=1,2000 do if not worker or coroutine.status(worker)=='dead' then return end;local ok,e=coroutine.resume(worker);assert(ok,e) end
 error('plow worker did not settle')
end
local function reset()
 RemoteCatalog.SetPlowEnabled(false);drain()
 children={a,b,soil};a.Name='grass';a.Parent=blocks;b.Name='dirt';b.Parent=blocks
 player.Character=char;char.Tool=previous;previous.Parent=char;hoe.Parent=backpack
 RemoteCatalog.BuildIslandBlocks=function() return blocks end
 RemoteCatalog.PlowRadius=15;events={};equipped={};hook=nil;confirm=true;failPress=false;failHold=false
 focused=false;uiBlocked=false;hub.Root.Visible=false;visible=true;obstructed=false;covered=false;tools={hoe,previous}
 enabled=false;RemoteCatalog.ResourceInputBusy=nil;RemoteCatalog.LiveRecorder=nil;RemoteCatalog.Recorder=nil;RemoteCatalog.PlowLearning=false;RemoteCatalog.PlowMode="Auto";RemoteCatalog.PlowRunMode="One pass"
end
assert(not RemoteCatalog.PlowEnabled and not RemoteCatalog.PlowWorker and RemoteCatalog.PlowRunMode=='Continuous','Auto Plow must start OFF with continuous selected')
RemoteCatalog.PlowRunMode='One pass'
local scan=RemoteCatalog.ScanPlowArea()
assert(#scan==2 and #events==0 and #equipped==0,'scan must select exposed nearby owned grass/dirt and send no input')
covered=true;assert(#RemoteCatalog.ScanPlowArea()==0,'covered ground must be excluded');covered=false
a.CFrame.UpVector.Y=.5;assert(#RemoteCatalog.ScanPlowArea()==1,'tilted blocks must be excluded');a.CFrame.UpVector.Y=1
local originalChildren=children;children={}
for i=1,120 do table.insert(children,block('grass',0,-3)) end
assert(#RemoteCatalog.ScanPlowArea()==100,'scans must be capped at 100 candidates')
local cooling={};for i=1,100 do cooling[children[i]]=os.clock()+100 end
assert(#RemoteCatalog.ScanPlowArea(true,cooling)==20,'cooling blocks must be excluded before the scan cap so they cannot hide eligible ground')
children=originalChildren
enabled=true;assert(not RemoteCatalog.SetPlowEnabled(true) and #events==0);enabled=false
RemoteCatalog.ResourceInputBusy=true;assert(not RemoteCatalog.SetPlowEnabled(true));RemoteCatalog.ResourceInputBusy=nil
tools={previous};assert(not RemoteCatalog.SetPlowEnabled(true) and #events==0,'missing hoe must not click anything');tools={hoe,previous}
assert(RemoteCatalog.SetPlowEnabled(true));local firstWorker=worker
assert(RemoteCatalog.SetPlowEnabled(true) and worker==firstWorker,'double ON must retain one worker')
drain()
assert(RemoteCatalog.PlowConfirmed==2 and RemoteCatalog.PlowFailed==0 and not RemoteCatalog.PlowEnabled and not RemoteCatalog.PlowWorker,'only observed soil conversions may count')
assert(char.Tool==previous and #equipped==2,'completed runs must restore the previous tool while selection is still owned')
-- Guarded failures never click UI, hidden/blocked targets, chat or wrong tools.
for _,reason in ipairs({'chat','ui','hub','hidden','obstructed','reach'}) do
 reset()
 if reason=='chat' then focused=true elseif reason=='ui' then uiBlocked=true elseif reason=='hub' then hub.Root.Visible=true
 elseif reason=='hidden' then visible=false elseif reason=='obstructed' then obstructed=true elseif reason=='reach' then RemoteCatalog.GameModule=function() return 1 end end
 assert(RemoteCatalog.SetPlowEnabled(true));drain()
 for _,event in ipairs(events) do assert(event~='down','blocked '..reason..' must not press input') end
 assert(RemoteCatalog.PlowConfirmed==0)
 RemoteCatalog.GameModule=function() return 20 end
end
reset();confirm=false;children={a,b,block('grass',-3,-3),block('grass',-6,-3)}
assert(RemoteCatalog.SetPlowEnabled(true));drain()
assert(RemoteCatalog.PlowConfirmed==0 and RemoteCatalog.PlowFailed==3 and string.find(RemoteCatalog.PlowInfo.Text,'3 unconfirmed',1,true),'unobserved clicks must pause after three attempts')
reset();confirm=false
hook=function(dt) if dt==.06 then RemoteCatalog.SetPlowEnabled(false) end end
assert(RemoteCatalog.SetPlowEnabled(true))
while events[#events]~='down' do local ok,e=coroutine.resume(worker);assert(ok,e) end
assert(not RemoteCatalog.SetPlowEnabled(true),'cancelled in-flight input must retain ownership until release')
drain();assert(events[#events]=='up' and RemoteCatalog.PlowConfirmed==0 and not RemoteCatalog.PlowWorker,'Stop during hold must release without confirming late changes')
for _,failure in ipairs({'press','hold'}) do
 reset();confirm=false;failPress=failure=='press';failHold=failure=='hold'
 assert(RemoteCatalog.SetPlowEnabled(true));drain()
 assert(events[#events]=='up' and not RemoteCatalog.PlowWorker,'input '..failure..' errors must release and clean up')
end
reset();hook=function(dt) if dt==.03 then focused=true end end
assert(RemoteCatalog.SetPlowEnabled(true));drain()
for _,event in ipairs(events) do assert(event~='down','chat opening after aim must prevent the press') end
reset();hook=function(dt) if dt==.03 then char.Tool=manual;manual.Parent=char end end
assert(RemoteCatalog.SetPlowEnabled(true));drain();assert(char.Tool==manual,'manual tool choices must not be overwritten in cleanup')
reset();local replacement={FindFirstChild=function() return root end,FindFirstChildOfClass=function() return nil end}
hook=function(dt) if dt==.03 then player.Character=replacement end end
assert(RemoteCatalog.SetPlowEnabled(true));drain();assert(#equipped==1 and not RemoteCatalog.PlowWorker,'respawn must cancel without equipping the old previous tool')
-- Captured mode replaces mouse input while preserving target/worker/confirmation rules.
do
 local capture={valid=true,calls=0,CanUsePlowBinding=function(self) return self.valid end,
  Plow=function(self,part) self.calls+=1;part.Name='soil';return true end}
 reset();RemoteCatalog.LiveRecorder=function(name) assert(name=='PlowBinding');return capture end
 focused=true;hub.Root.Visible=true;visible=false
 assert(RemoteCatalog.SetPlowEnabled(true));drain()
 assert(capture.calls==2 and #events==0 and RemoteCatalog.PlowConfirmed==2 and RemoteCatalog.PlowBackend=='Captured request','Auto must use a valid captured request without moving/pressing the mouse or requiring a visible screen point')
 reset();capture.calls=0;RemoteCatalog.LiveRecorder=function() return capture end;RemoteCatalog.PlowMode='Input'
 assert(RemoteCatalog.SetPlowEnabled(true));drain()
 assert(capture.calls==0 and RemoteCatalog.PlowConfirmed==2 and #events>0,'explicit Input must retain native hoe behavior even with a valid binding')
 reset();RemoteCatalog.PlowMode='Captured'
 assert(not RemoteCatalog.SetPlowEnabled(true) and #events==0 and #equipped==0,'Captured mode without a current binding must not click or equip')
 reset();capture.calls=0;capture.valid=true;RemoteCatalog.LiveRecorder=function() return capture end
 capture.Plow=function(self) self.calls+=1;return false,'rejected' end
 children={a,b,block('grass',-3,-3),block('grass',-6,-3)}
 assert(RemoteCatalog.SetPlowEnabled(true));drain()
 assert(capture.calls==3 and RemoteCatalog.PlowFailed==3 and #events==0,'rejected remote attempts must stop at three failures without falling through to mouse input')
 reset();capture.calls=0;capture.valid=true;RemoteCatalog.LiveRecorder=function() return capture end
 capture.Plow=function(self) self.calls+=1;self.valid=false;return true end
 assert(RemoteCatalog.SetPlowEnabled(true));drain()
 assert(capture.calls==1 and #events==0 and RemoteCatalog.PlowConfirmed==0 and string.find(RemoteCatalog.PlowInfo.Text,'expired',1,true),'a binding expiring mid-pass must not switch transports or falsely count an accepted result')
 reset();capture.calls=0;capture.valid=true;RemoteCatalog.LiveRecorder=function() return capture end
 capture.Plow=function(self,part) self.calls+=1;task.wait(.25);part.Name='soil';return true end
 assert(RemoteCatalog.SetPlowEnabled(true));local ok,e=coroutine.resume(worker);assert(ok,e)
 assert(capture.calls==1 and RemoteCatalog.PlowWorker)
 RemoteCatalog.SetPlowEnabled(false);assert(not RemoteCatalog.SetPlowEnabled(true),'cancelled in-flight remote calls must retain the single worker lock')
 drain();assert(not RemoteCatalog.PlowWorker and RemoteCatalog.PlowConfirmed==0 and #events==0,'late remote returns after Stop must remain unconfirmed and release ownership')
 reset()
 local learner={Stopped=false,Stop=function(self) self.Stopped=true;self.LearnPlowOnly=false end}
 RemoteCatalog.StartCapture=function() return learner end;RemoteCatalog.UpdateCaptureUI=function() end
 assert(RemoteCatalog.BeginPlowLearning() and learner.LearnPlowOnly and not learner.Active and RemoteCatalog.PlowLearning,'manual learning must enable only the quiet observer')
 assert(not RemoteCatalog.SetPlowEnabled(true) and #events==0,'automation must wait for a manual learning action')
 RemoteCatalog.StopPlowLearning();assert(not learner.LearnPlowOnly and learner.Stopped and not RemoteCatalog.PlowLearning,'cancel must stop a dedicated learner')
 RemoteCatalog.StartCapture=function() return nil end
 assert(not RemoteCatalog.BeginPlowLearning() and #events==0,'unsupported capture must retain native-input availability without sending requests')
end
-- Continuous must remain ON through empty scans, movement and bounded retries.
do
 local function stepUntil(predicate,limit)
  for _=1,limit or 100 do
   if predicate() then return end
   assert(worker and coroutine.status(worker)=='suspended','worker stopped unexpectedly')
   local ok,e=coroutine.resume(worker);assert(ok,e)
  end
  assert(predicate(),'condition did not settle')
 end
 reset();RemoteCatalog.PlowRunMode='Continuous'
 local capture={valid=true,calls=0,CanUsePlowBinding=function(self) return self.valid end,
  Plow=function(self,part) self.calls+=1;part.Name='soil';return true end}
 RemoteCatalog.LiveRecorder=function() return capture end
 assert(RemoteCatalog.SetPlowEnabled(true))
 stepUntil(function() return RemoteCatalog.PlowConfirmed==2 end)
 for _=1,15 do local ok,e=coroutine.resume(worker);assert(ok,e) end
 assert(RemoteCatalog.PlowEnabled and capture.calls==2 and string.find(RemoteCatalog.PlowInfo.Text,'Waiting',1,true),'finishing nearby ground must wait ON without extra calls')
 table.insert(children,block('grass',-3,-3))
 stepUntil(function() return RemoteCatalog.PlowConfirmed==3 end)
 assert(capture.calls==3,'newly discovered grass must be plowed without toggling again')
 RemoteCatalog.SetPlowEnabled(false);drain()
 assert(not RemoteCatalog.PlowWorker and not RemoteCatalog.PlowEnabled and capture.calls==3 and RemoteCatalog.PlowButton.Text=='AUTO PLOW: OFF','OFF must stop rescanning and finish in the OFF state')
 reset();RemoteCatalog.PlowRunMode='Continuous';children={soil}
 assert(RemoteCatalog.SetPlowEnabled(true),'continuous should start even when nearby ground is already plowed')
 stepUntil(function() return string.find(RemoteCatalog.PlowInfo.Text,'Waiting',1,true) end)
 assert(RemoteCatalog.PlowEnabled and #events==0)
 RemoteCatalog.SetPlowEnabled(false);drain()
 reset();RemoteCatalog.PlowRunMode='Continuous';capture.calls=0;capture.valid=true
 capture.Plow=function(self) self.calls+=1;return false,'server rejected' end
 RemoteCatalog.LiveRecorder=function() return capture end
 children={a,b,block('grass',-3,-3)}
 local retryStarted=elapsed
 assert(RemoteCatalog.SetPlowEnabled(true))
 stepUntil(function() return capture.calls==3 end)
 stepUntil(function() return string.find(RemoteCatalog.PlowInfo.Text,'Cooling down',1,true) end)
 assert(RemoteCatalog.PlowEnabled and RemoteCatalog.PlowFailed==3,'three failures should pause continuous instead of randomly switching OFF')
 for _=1,20 do local ok,e=coroutine.resume(worker);assert(ok,e) end
 assert(capture.calls==3,'failed blocks must not be retried during cooldown')
 stepUntil(function() return capture.calls>3 end,200)
 assert(elapsed-retryStarted>=10 and RemoteCatalog.PlowEnabled,'continuous must retry after cooldown without switching OFF')
 -- Put this failed attempt back on cooldown before introducing a fresh target.
 local failedCalls=capture.calls
 -- A blocked nearest set must not hide later eligible targets.
 capture.Plow=function(self,part) self.calls+=1;part.Name='soil';return true end
 table.insert(children,block('grass',6,-3))
 stepUntil(function() return RemoteCatalog.PlowConfirmed==1 end)
 assert(capture.calls==failedCalls+1,'fresh ground must be processed while failed targets are cooling')
 capture.valid=false
 stepUntil(function() return not RemoteCatalog.PlowWorker end)
 assert(not RemoteCatalog.PlowEnabled and string.find(RemoteCatalog.PlowInfo.Text,'expired',1,true),'expired session must stop with a useful reason')
 -- Rapid OFF/ON queues one restart only after the pending request returns.
 reset();RemoteCatalog.PlowRunMode='One pass';capture.valid=true;capture.calls=0
 capture.Plow=function(self,part) self.calls+=1;task.wait(.25);part.Name='soil';return true end
 RemoteCatalog.LiveRecorder=function() return capture end
 assert(RemoteCatalog.SetPlowEnabled(true))
 stepUntil(function() return capture.calls==1 end)
 local oldWorker=worker
 RemoteCatalog.TogglePlow()
 assert(not RemoteCatalog.PlowEnabled and string.find(RemoteCatalog.PlowButton.Text,'STOPPING',1,true))
 RemoteCatalog.TogglePlow()
 assert(RemoteCatalog.PlowPendingStart and worker==oldWorker and capture.calls==1,'restart must queue without overlapping an in-flight call')
 drain()
 assert(capture.calls==2 and RemoteCatalog.PlowConfirmed==1 and not RemoteCatalog.PlowWorker and not RemoteCatalog.PlowPendingStart,'queued restart must run once and ignore late old confirmation')
 reset();capture.calls=0;RemoteCatalog.LiveRecorder=function() return capture end
 assert(RemoteCatalog.SetPlowEnabled(true));stepUntil(function() return capture.calls==1 end)
 RemoteCatalog.TogglePlow();RemoteCatalog.TogglePlow();RemoteCatalog.TogglePlow()
 drain();assert(capture.calls==1 and not RemoteCatalog.PlowPendingStart,'clicking a queued restart again must cancel it')
end
reset();hook=function(dt) if dt==.06 then gui.Parent=nil end end
assert(RemoteCatalog.SetPlowEnabled(true));drain();assert(events[#events]=='up' and not RemoteCatalog.PlowWorker,'destroyed GUI must release held input')
return 'Auto Plow: owned surface scan, cap, hoe selection, native input guards, observed soil confirmation, continuous rescan/cooldown, queued restart, Stop/error release and tool/character cleanup passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'plow',true)());} finally {state.destroy();}
