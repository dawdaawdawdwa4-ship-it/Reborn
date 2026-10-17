import fs from 'node:fs';
import {LuauState} from 'luau-web';
const source=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8').replaceAll('\r\n','\n');
const helpers=source.slice(source.indexOf('local function hasRodEquipped()'),source.indexOf('local function waitForTug'));
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
local failMove,failDown,failWait=false,false,false
local game={}
local VirtualInputManager={}
function VirtualInputManager:SendMouseMoveEvent(x,y,target)
 assert(target==game,'input target missing')
 if failMove then error('blocked movement') end
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
 if down and cancel then enabled=false end
 if down and failWait then error('interrupted hold') end
end}
local function running(token) return enabled and token==1 end
local hub={Root={Visible=true,AbsolutePosition={X=0,Y=0},AbsoluteSize={X=500,Y=500}}}
local status
local function setStatus(text) status=text end
local COLORS={warn=1}
local folder
local workspace={CurrentCamera={ViewportSize={X=1920,Y=1080},WorldToScreenPoint=function() return {X=1200,Y=600},true end},FindFirstChild=function() return folder end}
${helpers}
assert(clickOnce('cast',1) and not down)
assert(events[1][1]=='move' and events[2][1]=='down' and events[3][1]=='up','aim/press/release order incorrect')
assert(events[3][2]-events[2][2]>=.35,'cast charge too short')
events={};time=0
assert(clickOnce('reel',1) and events[3][2]-events[2][2]<.05,'reel must not charge like a cast')
cancel=true;events={};time=0
assert(not clickOnce('cast',1) and not down and events[#events][1]=='up','Stop must release cast')
cancel=false;enabled=true;failWait=true;events={}
assert(not clickOnce('cast',1) and not down and events[#events][1]=='up','interrupted hold must release')
failWait=false;failDown=true;events={}
assert(not clickOnce('cast',1) and events[#events][1]=='up','failed press still needs independent release')
failDown=false;failMove=true;events={}
assert(not clickOnce('cast',1) and #events==0,'blocked mouse move must not send press')
failMove=false;tool.Name='stonePickaxe';assert(not hasRodEquipped() and not clickOnce('cast',1),'pickaxe must not count as rod')
tool.Name='fishingRod'
local own={IsA=function(_,c) return c=='Model' end,GetAttribute=function(_,name) if name=='OwnerUserId' then return 7 end end}
local other={IsA=own.IsA,GetAttribute=function() return 8 end}
folder={FindFirstChild=function() return nil end,GetChildren=function() return {other,own} end}
assert(getBobber()==own,'owner/model bobber not detected')
folder.GetChildren=function() return {other} end
assert(getBobber()==nil,'must not use another player bobber')
return 'Fishing input passed: aim first, charged cast, short reel, cancellation/error release, rod validation and owned bobber discovery'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'fishing-smoke',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
