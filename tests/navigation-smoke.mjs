import fs from 'node:fs';
import {LuauState} from 'luau-web';
const source=fs.readFileSync(new URL('../tools/FarmNavigation.lua',import.meta.url),'utf8');
const builder=fs.readFileSync(new URL('../tools/AutoBuild.lua',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8').replaceAll('\r\n','\n');
if(!main.includes(source)) throw Error('Embedded navigation differs from source');
const code=`
local time=0
local os={clock=function() return time end}
local mt={}
local function v(x,y,z) y=y or 0;z=z or 0;return setmetatable({x=x,X=x,Y=y,Z=z,Magnitude=math.sqrt(x*x+y*y+z*z)},mt) end
mt.__sub=function(a,b) return v(a.X-b.X,a.Y-b.Y,a.Z-b.Z) end
mt.__add=function(a,b) return v(a.X+b.X,a.Y+b.Y,a.Z+b.Z) end
mt.__mul=function(a,b) return v(a.X*b,a.Y*b,a.Z*b) end
mt.__index=function(a,key) if key=="Unit" then return v(a.X/a.Magnitude,a.Y/a.Magnitude,a.Z/a.Magnitude) end end
local Vector3={zero=v(0),new=v}
local Enum={PathStatus={Success=1},PathWaypointAction={Jump=2},EasingStyle={Linear=1}}
local TweenInfo={new=function(duration) return duration end}
local root={Position=v(0,3)}
setmetatable(root,{__index=function(t,key) if key=="CFrame" then return t.Position end end,__newindex=function(t,key,value) if key=="CFrame" then rawset(t,"Position",value) else rawset(t,key,value) end end})
local tweenCancelled=0
local moves,stops,halts=0,0,0
local humanoid={Health=100,MoveTo=function(_,p) if p==root.Position then halts+=1 else moves+=1 end end,Move=function() stops+=1 end}
local currentRoot,currentHumanoid=root,humanoid
local character={FindFirstChild=function() return currentRoot end,FindFirstChildOfClass=function() return currentHumanoid end}
local player={Character=character}
local target={Parent=true,Position=v(20)}
local moving=true
local failPath,jump,stuck,cancel=false,false,false,false
local replaceRoot,replaceHumanoid,respawn=false,false,false
local function active() return moving end
local function positionOf(obj) return obj.Position end
local path={Status=1,ComputeAsync=function() end,GetWaypoints=function() return {{Position=v(0,0),Action=0},{Position=v(20,0),Action=jump and 2 or 0}} end}
local game={GetService=function(_,name)
 if name=="TweenService" then return {Create=function(_,instance,duration,properties)
  return {Play=function() if not cancel then instance.CFrame=properties.CFrame end end,Cancel=function() tweenCancelled+=1 end}
 end} end
 return {CreatePath=function(_,settings) assert(settings.AgentCanJump);path.Status=failPath and 0 or 1;return path end} end}
local Navigation
local task={wait=function(dt)
 time+=dt
 if cancel then moving=false;Navigation.Stop() end
 if replaceRoot then currentRoot={Position=v(100,3)} end
 if replaceHumanoid then currentHumanoid={Health=100} end
 if respawn then player.Character={} end
 if not stuck then root.Position=v(root.Position.x+4,3) end
end}
Navigation=(function() ${source} end)()
assert(Navigation.Approach(player,target,8,active,positionOf) and moves==2 and stops==1,'walk must reach collection range and release movement')
assert(halts==1,'finishing travel must clear the outstanding MoveTo destination')
local function reset() root.Position=v(0,3);humanoid.Jump=false;moving=true;failPath=false;jump=false;stuck=false;cancel=false;moves=0;replaceRoot=false;replaceHumanoid=false;respawn=false;currentRoot=root;currentHumanoid=humanoid;player.Character=character end
reset();assert(not Navigation.Approach(player,target,8,active,positionOf,'Normal') and moves==0,'Normal must not move toward distant targets')
reset();root.Position=v(15);assert(Navigation.Approach(player,target,8,active,positionOf,'Normal') and moves==0,'Normal must allow in-range actions without movement')
reset();failPath=true;assert(not Navigation.Approach(player,target,8,active,positionOf) and moves==0,'failed path must not walk directly across void')
reset();jump=true;assert(Navigation.Approach(player,target,8,active,positionOf) and humanoid.Jump,'path jump must use ordinary Humanoid jump controls')
reset();stuck=true;local before=time;assert(not Navigation.Approach(player,target,8,active,positionOf) and time-before<2,'stuck walking must time out')
reset();cancel=true;assert(not Navigation.Approach(player,target,8,active,positionOf) and not Navigation.Humanoid,'Stop must cancel and release movement')
reset();replaceRoot=true;before=time
assert(not Navigation.Approach(player,target,8,active,positionOf) and time-before<.2 and not Navigation.Humanoid,'replacing the root within the same character must stop the old walk immediately')
reset();replaceHumanoid=true;before=time
assert(not Navigation.Approach(player,target,8,active,positionOf) and time-before<.2 and not Navigation.Humanoid,'replacing the humanoid within the same character must stop the old walk immediately')
reset();respawn=true;before=time
assert(not Navigation.Approach(player,target,8,active,positionOf) and time-before<.2 and not Navigation.Humanoid,'respawning must stop travel without moving the new character')
reset();root.Position=v(15);assert(Navigation.Approach(player,target,8,active,positionOf) and moves==0,'in-range harvest must not calculate or walk a path')
reset();assert(Navigation.Approach(player,target,8,active,positionOf,'Teleport') and moves==0,'teleport must arrive within interaction reach without walking')
reset();assert(Navigation.Approach(player,target,8,active,positionOf,'Tween') and moves==0 and tweenCancelled>0 and not Navigation.Tween,'tween must arrive and clean up')
reset();cancel=true;stuck=true;local cancelledBefore=tweenCancelled
assert(not Navigation.Approach(player,target,8,active,positionOf,'Tween') and tweenCancelled>cancelledBefore and not Navigation.Tween,'Stop during tween must cancel travel and prevent action')
reset();replaceRoot=true;stuck=true;cancelledBefore=tweenCancelled
-- Keep the tween pending so the root can be replaced during its first wait.
local oldGetService=game.GetService
game.GetService=function(self,name)
 if name=='TweenService' then return {Create=function() return {Play=function() end,Cancel=function() tweenCancelled+=1 end} end} end
 return oldGetService(self,name)
end
assert(not Navigation.Approach(player,target,8,active,positionOf,'Tween') and tweenCancelled>cancelledBefore and not Navigation.Tween and not Navigation.Humanoid,'replacing the root must cancel a tween targeting the detached part')
reset()
Navigation.Humanoid=humanoid;Navigation.Root=root;Navigation.Owner='Wood'
local gen=Navigation.Generation
local previousHalts=halts
assert(not Navigation.Stop('Chest') and Navigation.Generation==gen and Navigation.Humanoid==humanoid,'stopping chest travel must not cancel another navigation owner')
Navigation.Owner='Chest'
assert(Navigation.Stop('Chest') and Navigation.Generation==gen+1 and not Navigation.Humanoid and halts==previousHalts+1,'chest OFF must immediately clear the MoveTo destination and owner')
-- Real Auto Build + real navigation: paths, reach and cancellation compose.
;(function()
 local function signal() return {Connect=function() return {} end} end
 local function control(props) local value={Activated=signal(),FocusLost=signal(),Destroy=function() end};if type(props)=="table" then for key,item in pairs(props) do value[key]=item end end;return value end
 local Instance={new=control}
 local UDim2={new=function(xs,x,ys,y) return {X={Scale=xs,Offset=x},Y={Scale=ys,Offset=y}} end}\n UDim2.fromOffset=function(x,y) return UDim2.new(0,x,0,y) end
 local Color3={fromRGB=function() return {} end}
 local Enum={RaycastFilterType={Exclude=1},Material={ForceField=1},AutomaticSize={Y=1},TextTruncate={None=1},TextXAlignment={Left=1},TextYAlignment={Top=1}}
 local AutoBuild=(function() ${builder} end)()
 local world,dispatches,travels={},0,0
 path.ComputeAsync=function(_,_,destination) path.Destination=destination end
 path.GetWaypoints=function() return {{Position=v(0,0),Action=0},{Position=v(path.Destination.X,0),Action=0}} end
 local ctx={Player=player,Parent={},Label=control,Button=control,Track=function() end,Alive=function() return true end,Workspace={},Now=function() return time end,
  Scheduler={spawn=function(fn) fn() end,wait=function(dt) task.wait(dt) end},
  GameModule=function(_,key)
   if key=='CLIENT_REACH' then return 20 end
   if key=='BlockUtils' then return {getBlocksFromLocation=function(point) return world[point] and {true} or {} end} end
  end,
  Place=function(body)
   assert((root.Position-body.cframe.Position).Magnitude<=20,'composed worker must verify real reach before sending')
   dispatches+=1;world[body.cframe.Position]=true;return true
  end,
  Approach=function(cell,reach,active)
   travels+=1
   local previewTarget={Parent=true,Position=cell.CFrame.Position}
   return Navigation.Approach(player,previewTarget,reach*.8,active,positionOf,'Walk','Build')
  end,
  StopTravel=function() Navigation.Stop('Build') end,
 }
 local function fresh()
  reset();world={};dispatches=0;travels=0
  local b=AutoBuild.new(ctx);b.BlockSize=3;b.Cells={{CFrame={Position=v(40)},Material='grass'}}
  assert(b:SetTravelMode('Walk'));return b
 end
 local b=fresh();assert(b:Start())
 assert(dispatches==1 and travels==1 and moves>0 and b.Progress.Placed==1 and b.Progress.State=='Finished' and not Navigation.Humanoid,'real paths must reach and confirm a distant preview cell, then release movement')
 b=fresh();failPath=true;b:Start()
 assert(dispatches==0 and travels==1 and moves==0 and b.Progress.State=='Walking paused' and b.Cells and not Navigation.Humanoid,'failed paths must retain the preview without sending')
 b=fresh();stuck=true;local began=time;b:Start()
 assert(dispatches==0 and time-began<2 and b.Progress.State=='Walking paused' and not Navigation.Humanoid,'stuck paths must bound the wait and clean up')
 local ordinaryWait=task.wait
 b=fresh();task.wait=function(dt)
  ordinaryWait(dt)
  if b.Progress.State=='Walking to block' then b:Stop();assert(not Navigation.Humanoid,'Stop must immediately clear real MoveTo ownership') end
 end
 b:Start();assert(dispatches==0 and b.Progress.State=='Stopped' and not b.WorkerToken,'Stop inside a real path must prevent dispatch and finish worker cleanup')
 task.wait=ordinaryWait;b:Start();assert(dispatches==1 and b.Progress.Placed==1,'resuming after a cancelled path must start fresh and build')
 b=fresh();respawn=true;b:Start()
 assert(dispatches==0 and b.Progress.State=='Walking paused' and not Navigation.Humanoid,'respawning during real movement must stop before placing')
 reset()
 end)()
return 'Navigation: approach, blocked routes, stuck timeout, respawn/cancellation and real Auto Build walking integration passed'
`;
const state=await LuauState.createAsync();try{console.log(await state.loadstring(code,'navigation',true)());}finally{state.destroy();}
