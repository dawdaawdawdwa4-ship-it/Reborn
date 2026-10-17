import fs from 'node:fs';
import {LuauState} from 'luau-web';
const source=fs.readFileSync(new URL('../tools/FarmNavigation.lua',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8').replaceAll('\r\n','\n');
if(!main.includes(source)) throw Error('Embedded navigation differs from source');
const code=`
local time=0
local os={clock=function() return time end}
local mt={}
local function v(x) return setmetatable({x=x,Magnitude=math.abs(x)},mt) end
mt.__sub=function(a,b) return v(a.x-b.x) end
mt.__add=function(a,b) return v(a.x+b.x) end
mt.__mul=function(a,b) return v(a.x*b) end
mt.__index=function(a,key) if key=="Unit" then return v(a.x<0 and -1 or 1) end end
local Vector3={zero=v(0)}
local Enum={PathStatus={Success=1},PathWaypointAction={Jump=2}}
local root={Position=v(0)}
local moves,stops=0,0
local humanoid={Health=100,MoveTo=function(_,p) moves+=1 end,Move=function() stops+=1 end}
local character={FindFirstChild=function() return root end,FindFirstChildOfClass=function() return humanoid end}
local player={Character=character}
local target={Parent=true,Position=v(20)}
local moving=true
local failPath,jump,stuck,cancel=false,false,false,false
local function active() return moving end
local function positionOf(obj) return obj.Position end
local path={Status=1,ComputeAsync=function() end,GetWaypoints=function() return {{Position=v(20),Action=jump and 2 or 0}} end}
local game={GetService=function() return {CreatePath=function(_,settings) assert(not settings.AgentCanJump);path.Status=failPath and 0 or 1;return path end} end}
local Navigation
local task={wait=function(dt)
 time+=dt
 if cancel then moving=false;Navigation.Stop() end
 if not stuck then root.Position=v(root.Position.x+4) end
end}
Navigation=(function() ${source} end)()
assert(Navigation.Approach(player,target,8,active,positionOf) and moves==1 and stops==1,'walk must reach collection range and release movement')
local function reset() root.Position=v(0);moving=true;failPath=false;jump=false;stuck=false;cancel=false;moves=0 end
reset();failPath=true;assert(not Navigation.Approach(player,target,8,active,positionOf) and moves==0,'failed path must not walk directly across void')
reset();jump=true;assert(not Navigation.Approach(player,target,8,active,positionOf) and moves==0,'jump links must be rejected')
reset();stuck=true;local before=time;assert(not Navigation.Approach(player,target,8,active,positionOf) and time-before<2,'stuck walking must time out')
reset();cancel=true;assert(not Navigation.Approach(player,target,8,active,positionOf) and not Navigation.Humanoid,'Stop must cancel and release movement')
reset();root.Position=v(15);assert(Navigation.Approach(player,target,8,active,positionOf) and moves==0,'in-range harvest must not calculate or walk a path')
return 'Navigation: approach, in-range fast path, blocked routes, jump rejection, stuck timeout and cancellation passed'
`;
const state=await LuauState.createAsync();try{console.log(await state.loadstring(code,'navigation',true)());}finally{state.destroy();}
