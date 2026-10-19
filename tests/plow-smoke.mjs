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
local task={spawn=function(fn) worker=coroutine.create(fn);local ok,e=coroutine.resume(worker);assert(ok,e) end,wait=function(dt)
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
 enabled=false;RemoteCatalog.ResourceInputBusy=nil
end
assert(not RemoteCatalog.PlowEnabled and not RemoteCatalog.PlowWorker,'Auto Plow must start OFF')
local scan=RemoteCatalog.ScanPlowArea()
assert(#scan==2 and #events==0 and #equipped==0,'scan must select exposed nearby owned grass/dirt and send no input')
covered=true;assert(#RemoteCatalog.ScanPlowArea()==0,'covered ground must be excluded');covered=false
a.CFrame.UpVector.Y=.5;assert(#RemoteCatalog.ScanPlowArea()==1,'tilted blocks must be excluded');a.CFrame.UpVector.Y=1
local originalChildren=children;children={}
for i=1,120 do table.insert(children,block('grass',0,-3)) end
assert(#RemoteCatalog.ScanPlowArea()==100,'passes must be capped at 100 candidates');children=originalChildren
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
reset();hook=function(dt) if dt==.06 then gui.Parent=nil end end
assert(RemoteCatalog.SetPlowEnabled(true));drain();assert(events[#events]=='up' and not RemoteCatalog.PlowWorker,'destroyed GUI must release held input')
return 'Auto Plow: owned surface scan, cap, hoe selection, native input guards, observed soil confirmation, bounded failures, Stop/error release and tool/character cleanup passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'plow',true)());} finally {state.destroy();}
