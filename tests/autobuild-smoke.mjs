import fs from 'node:fs';
import {LuauState} from 'luau-web';
const source=fs.readFileSync(new URL('../tools/AutoBuild.lua',import.meta.url),'utf8');
const checks=`
local A=(function() ${source} end)()
for _,case in ipairs({{'Farm plots',5,6,3,30},{'Platform',4,3,2,12},{'Wall',4,3,2,8},{'Stairs',2,4,1,20},{'Room',5,6,3,82},{'Bridge',5,6,3,42},{'Fence',5,6,3,54}}) do
 local plan=A.Plan(case[1],case[2],case[3],case[4]);assert(#plan==case[5])
 local seen={};local previous=-1
 for _,cell in ipairs(plan) do
  local key=cell.x..','..cell.y..','..cell.z
  assert(not seen[key],'duplicate cell');seen[key]=true
  assert(cell.y>=previous,'build must proceed bottom up');previous=cell.y
 end
end
assert(not pcall(A.Plan,'Stairs',12,12,1),'oversized plans must fail')
assert(not pcall(A.Plan,'Wall',0,1,1),'invalid dimensions must fail')
local paths=0
for _,c in ipairs(A.Plan('Farm plots',5,6,1)) do if c.role=='path' then paths+=1 end end
assert(paths==6,'farm needs one path column per three columns')
do
 local function has(plan,x,y,z) for _,c in ipairs(plan) do if c.x==x and c.y==y and c.z==z then return true end end return false end
 local room=A.Plan('Room',3,3,2)
 assert(has(room,0,0,1) and not has(room,0,1,1) and not has(room,0,2,1),'rooms need a floor and two-block front doorway')
 assert(not has(room,0,1,2) and has(room,-1,1,2),'rooms must have hollow interiors and perimeter walls')
 local bridge=A.Plan('Bridge',3,4,1)
 assert(has(bridge,0,1,2) and has(bridge,-1,2,2) and has(bridge,1,2,2) and not has(bridge,0,2,2),'bridges need a continuous deck and clear middle between rails')
 local fence=A.Plan('Fence',3,3,2)
 assert(not has(fence,0,1,2) and has(fence,0,1,1) and has(fence,-1,2,2),'fences must retain their perimeter and open interior')
 for _,preset in ipairs({'Room','Fence'}) do
  assert(not pcall(A.Plan,preset,2,3,1) and not pcall(A.Plan,preset,12,12,8),'hollow presets must reject undersized or oversized layouts')
 end
 assert(not pcall(A.Plan,'Bridge',2,4,1))
 local input={Version=1,Items={'grass','stone'}};local names=A.ValidateFavorites(input);names[1]='soil'
 assert(input.Items[1]=='grass','favorite validation must copy data')
 for _,bad in ipairs({{Version=2,Items={}},{Version=1,Items={'grass','grass'}},{Version=1,Items={' grass'}},{Version=1,Items={''}},{Version=1,Items={[1]='grass',[3]='stone'}},{Version=1,Items={'1','2','3','4','5','6','7','8','9'}}}) do
  assert(not pcall(A.ValidateFavorites,bad),'malformed favorites must be rejected')
 end
end
-- Repeating whole layouts preserves transforms and respects existing limits.
;(function()
 local function cell(x,y,z,material,rotation)
  local c={x,y,z};for _,n in ipairs(rotation or {1,0,0,0,1,0,0,0,1}) do table.insert(c,n) end
  return {Material=material or 'grass',Components=c}
 end
 local function plan(cells,size) return {Version=1,Name='Repeat test',BlockSize=size or 3,Cells=cells} end
 local original=plan({cell(0,0,0),cell(3,3,0,'stone')})
 local repeated,step=A.RepeatPlan(original,'Right',3,1)
 assert(step==9 and #repeated.Cells==6,'three copies of a two-column layout with a one-block gap must use nine-stud spacing')
 local points={}
 for _,value in ipairs(repeated.Cells) do points[value.Components[1]..','..value.Components[2]]=value.Material end
 for _,x in ipairs({0,9,18}) do assert(points[x..',0']=='grass' and points[(x+3)..',3']=='stone','each copy must preserve height and material') end
 assert(#original.Cells==2 and original.Cells[1].Components[1]==0,'repeat planning cannot mutate its source')
 repeated.Cells[1].Components[1]=123;assert(original.Cells[1].Components[1]==0 and repeated.Cells[2].Components[1]~=123,'source and repeated transforms must be independent')
 repeated,step=A.RepeatPlan(plan({cell(0,0,0),cell(0,0,-3)}),'Forward',2,0)
 local zs={};for _,value in ipairs(repeated.Cells) do zs[value.Components[3]]=true end
 assert(step==6 and zs[0] and zs[-3] and zs[-6] and zs[-9],'forward means negative local Z with adjacent copies when gap is zero')
 local q=math.sqrt(.5);local rotation={q,0,q,0,1,0,-q,0,q}
 repeated,step=A.RepeatPlan(plan({cell(0,0,0,'stone',rotation)}),'Right',2,0)
 assert(step==6 and repeated.Cells[2].Components[1]==6,'rotated block extents must be rounded up to whole grid steps')
 for _,value in ipairs(repeated.Cells) do for i=1,9 do assert(value.Components[i+3]==rotation[i],'repeat must preserve the full rotation matrix') end end
 repeated,step=A.RepeatPlan(plan({cell(0,0,0),cell(1.5,0,0)}),'Right',2,0)
 assert(step==6 and repeated.Cells[4].Components[1]==7.5,'off-grid captures must retain their internal positions and pad copy spacing to grid steps')
 repeated,step=A.RepeatPlan(plan({cell(0,0,0)},2.5),'Right',2,1);assert(step==5 and repeated.BlockSize==2.5)
 local large={};for x=0,149 do table.insert(large,cell(x*3,0,0)) end
 assert(#A.RepeatPlan(plan(large),'Right',2,0).Cells==300,'the 300-cell boundary must remain usable')
 table.insert(large,cell(450,0,0));assert(not pcall(A.RepeatPlan,plan(large),'Right',2,0),'over-limit repeats must reject before editing')
 assert(not pcall(A.RepeatPlan,plan({cell(2999,0,0)}),'Right',2,0),'repeats outside existing coordinate bounds must reject')
 for _,copies in ipairs({1,5,2.5,math.huge,0/0,'2',false}) do assert(not pcall(A.RepeatPlan,original,'Right',copies,0)) end
 for _,gap in ipairs({-1,9,.5,math.huge,0/0,'0',false}) do assert(not pcall(A.RepeatPlan,original,'Right',2,gap)) end
 assert(not pcall(A.RepeatPlan,original,'Sideways',2,0) and not pcall(A.RepeatPlan,plan({}),'Right',2,0))
 end)()
-- Floors can repeat upward; layer scope appends copies and retains all other cells.
;(function()
 local function cell(x,y,z,material,rotation)
  local c={x,y,z};for _,n in ipairs(rotation or {1,0,0,0,1,0,0,0,1}) do table.insert(c,n) end
  return {Material=material or 'grass',Components=c}
 end
 local source={Version=1,Name='Floors',BlockSize=3,Cells={cell(0,0,0),cell(0,3,0,'stone')}}
 local all,step=A.RepeatPlan(source,'Up',2,1)
 assert(step==9 and #all.Cells==4 and all.Cells[3].Components[2]==9 and all.Cells[4].Components[2]==12,'whole-layout Up must use full height plus the gap')
 local selected,pitch=A.RepeatPlan(source,'Up',3,1,3)
 assert(pitch==6 and #selected.Cells==4 and selected.Cells[1].Material=='grass' and selected.Cells[2].Material=='stone' and selected.Cells[3].Components[2]==9 and selected.Cells[4].Components[2]==15,'selected-layer Up must keep the lower floor and append only the chosen floor')
 local right=A.RepeatPlan(source,'Right',2,0,0)
 assert(#right.Cells==3 and right.Cells[1].Components[2]==0 and right.Cells[2].Components[1]==3 and right.Cells[3].Components[2]==3,'horizontal layer repeats must keep other layers without cloning them')
 assert(not pcall(A.RepeatPlan,source,'Up',2,0,0),'copying a lower layer onto an existing upper layer must reject exact-position overlap')
 assert(#source.Cells==2 and source.Cells[2].Components[2]==3,'success and overlap rejection must not mutate the source')
 selected.Cells[3].Components[2]=99;assert(source.Cells[2].Components[2]==3 and selected.Cells[2].Components[2]==3,'original and added floor transforms must not alias')
 for _,height in ipairs({-5,6,math.huge,0/0,'3',false}) do assert(not pcall(A.RepeatPlan,source,'Up',2,0,height),'invalid/empty layer selections must reject') end
 local q=math.sqrt(.5);local tilt={1,0,0,0,q,-q,0,q,q}
 local tilted={Version=1,Name='Tilted floor',BlockSize=3,Cells={cell(0,0,0,'stone',tilt)}}
 selected,pitch=A.RepeatPlan(tilted,'Up',2,0)
 assert(pitch==6 and selected.Cells[2].Components[2]==6,'Up spacing must account for vertical tilt')
 for _,c in ipairs(selected.Cells) do for i=1,9 do assert(c.Components[i+3]==tilt[i]) end end
 source.Cells[2].Components[2]=3.0004
 selected=A.RepeatPlan(source,'Up',2,0,3);assert(math.abs(selected.Cells[3].Components[2]-6.0004)<.00001,'layer matching must use the same millistud grouping as the layer selector')
 local large={Version=1,Name='Large floor',BlockSize=3,Cells={}}
 for x=0,297 do table.insert(large.Cells,cell(x*3,0,0)) end
 table.insert(large.Cells,cell(0,3,0,'stone'))
 assert(#A.RepeatPlan(large,'Up',2,0,3).Cells==300,'selected-layer limits must count only added cells and preserve the 300-cell boundary')
 assert(not pcall(A.RepeatPlan,large,'Up',3,0,3),'a selected-layer repeat exceeding 300 cells must reject')
 end)()
local function signal()
 local callbacks={}
 return {Connect=function(_,callback) table.insert(callbacks,callback);return {} end,
 Fire=function() for _,callback in ipairs(callbacks) do callback() end end}
end
local function control(props) local value={Activated=signal(),FocusLost=signal(),Destroy=function(self) self.Destroyed=true end};for key,item in pairs(props or {}) do value[key]=item end;return value end
local Instance={new=function() return control() end}
local Vector2={zero={X=0,Y=0}}
local UDim2={new=function(xs,x,ys,y) return {X={Scale=xs,Offset=x},Y={Scale=ys,Offset=y}} end}\nUDim2.fromOffset=function(x,y) return UDim2.new(0,x,0,y) end
local Color3={fromRGB=function() return {} end}
local fm={}
local function frame(x,y,z,yaw)
 return setmetatable({Position={X=x,Y=y,Z=z},yaw=yaw or 0},fm)
end
function fm.__mul(a,b)
 local p,q=a.Position,b.Position;local c,s=math.cos(a.yaw),math.sin(a.yaw)
 return frame(p.X+q.X*c+q.Z*s,p.Y+q.Y,p.Z-q.X*s+q.Z*c,a.yaw+b.yaw)
end
fm.__index={Inverse=function(a)
 local p=a.Position;local c,s=math.cos(a.yaw),math.sin(a.yaw)
 return frame(-p.X*c+p.Z*s,-p.Y,-p.X*s-p.Z*c,-a.yaw)
end}
local CFrame={new=frame}
local function vector(x,y,z)
 return setmetatable({X=x,Y=y,Z=z},{__sub=function(a,b)
  return {Magnitude=math.sqrt((a.X-b.X)^2+(a.Y-b.Y)^2+(a.Z-b.Z)^2)}
 end})
end
local Vector3={new=vector}
local RaycastParams={new=function() return {} end}
local Enum={RaycastFilterType={Exclude=1},Material={ForceField=1},AutomaticSize={Y=1},TextTruncate={None=1},TextXAlignment={Left=1},TextYAlignment={Top=1}}
local definitions={FindFirstChild=function(_,name) return (name=='grass' or name=='stone') and {} end}
local game={GetService=function() return {FindFirstChild=function() return definitions end} end}
fm.__index.ToObjectSpace=function(a,b) return a:Inverse()*b end
fm.__index.GetComponents=function(a)
 local p=a.Position;local c,s=math.cos(a.yaw),math.sin(a.yaw)
 return p.X,p.Y,p.Z,c,0,s,0,1,0,-s,0,c
end
CFrame.new=function(x,y,z,...)
 local rotation={...}
 local cf=frame(x,y,z,#rotation==9 and math.atan2(rotation[3],rotation[1]) or rotation[1])
 cf.Position=vector(x,y,z);cf.LookVector={X=-math.sin(cf.yaw),Z=-math.cos(cf.yaw)}
 return cf
end
CFrame.Angles=function(_,yaw) return CFrame.new(0,0,0,yaw) end
-- Re-evaluate with the injected UI globals.
local A=(function() ${source} end)()
local ticks,worker,requests=0,nil,0
local occupied={}
local root={Position=setmetatable({},{__sub=function() return {Magnitude=0} end})}
local ctx={Player={Character={FindFirstChild=function() return root end}},Parent={},Label=function(props) return control(props) end,Button=function(props) return control(props) end,Track=function() end,Alive=function() return true end,Workspace={},Now=function() return ticks end,
 Scheduler={spawn=function(fn) worker=coroutine.create(fn);local ok,e=coroutine.resume(worker);assert(ok,e) end,wait=function(dt) ticks+=dt;coroutine.yield() end},
 GameModule=function(_,name) if name=='BlockUtils' then return {getBlocksFromLocation=function(pos) return occupied[pos] and {true} or {} end} end end,
 Place=function(body) requests+=1;occupied[body.cframe.Position]=true;return true end}
local function cells(n) local out={} for i=1,n do out[i]={CFrame={Position=i},Material='grass'} end return out end
local function step() local ok,e=coroutine.resume(worker);assert(ok,e) end
local b=A.new(ctx);b.Cells=cells(3);b.BlockSize=3;b:Start();assert(requests==1)
b:Start();assert(requests==1,'second start must not create a worker')
b:Stop();step();assert(requests==1,'stop must cancel queued placements')
b.Cells=cells(3);b:Start();while coroutine.status(worker)~='dead' do step() end
assert(requests==3,'occupied block should be skipped');assert(string.find(b.Status.Text,'2 confirmed',1,true))
ctx.Place=function() requests+=1;return false,'denied' end
occupied={};b.Cells=cells(6);local before=requests;b:Start();while coroutine.status(worker)~='dead' do step() end
assert(requests-before==3,'three failures must stop the build');assert(not b.Running)
assert(string.find(b.Status.Text,'3 failures',1,true))
ctx.Place=function() requests+=1;return true end
occupied={};b.Cells=cells(6);before=requests;b:Start();while coroutine.status(worker)~='dead' do step() end
assert(requests-before==3,'unconfirmed responses must stop after three failures')
assert(b.Progress.Placed==0 and b.Progress.Failed==3 and b.Progress.State=='Paused after failures','accepted responses without observed blocks must remain unconfirmed failures')
root.Position=setmetatable({},{__sub=function() return {Magnitude=100} end})
b.Cells=cells(2);before=requests;b:Start();assert(requests==before,'out of reach must pause requests')
b:Stop();step();assert(requests==before,'stop must cancel a paused build')
-- A restarted build may begin with completed cells that are now far away.
-- These must be skipped without pulling the player back to the old work area.
ctx.Place=function(body) requests+=1;occupied[body.cframe.Position]=true;return true end
occupied={[1]=true}
root.Position=setmetatable({},{__sub=function(_,position) return {Magnitude=position==1 and 100 or 0} end})
b.Cells=cells(2);before=requests;b:Start();step()
assert(requests-before==1,'resume must skip distant completed cells before checking reach')
while coroutine.status(worker)~='dead' do step() end
assert(string.find(b.Status.Text,'1 occupied/skipped',1,true),'completed cells must remain skipped in the result')
-- Someone else can fill a target while this player is waiting to approach it.
root.Position=setmetatable({},{__sub=function() return {Magnitude=100} end})
occupied={};b.Cells=cells(2);before=requests;b:Start()
occupied[1]=true;step();step()
assert(string.find(b.Status.Text,'block 2/2',1,true),'a completed waiting cell must advance to the next target')
assert(requests==before,'remote targets must not be sent while out of reach')
b:Stop();step()
-- Placement recovery uses a single cell/worker and bounded server pacing.
;(function()
 local originalPlace,originalModule=ctx.Place,ctx.GameModule
 local function drain() for _=1,2000 do if coroutine.status(worker)=='dead' then return end;step() end;error('build did not settle') end
 local function fresh(n)
  occupied={};root.Position=setmetatable({},{__sub=function() return {Magnitude=0} end})
  local value=A.new(ctx);value.Cells=cells(n or 2);value.BlockSize=3;return value
 end
 ctx.PlacementReady=function() return false,'Learn placement first' end
 local value=fresh();local before=requests
 assert(value:Start()==false and not value.Running and not value.WorkerToken and requests==before,'unavailable placement must stop before requests')
 ctx.PlacementReady=nil
 local attempts=0
 ctx.Place=function(body) attempts+=1;requests+=1;if attempts<=2 then return false,{success=false,error='TOO_FAST'},'rejected' end;occupied[body.cframe.Position]=true;return true end
 value=fresh(1);value:Start();drain()
 assert(attempts==3 and value.Progress.Placed==1 and value.Progress.Failed==0,'cooldown must retry the same cell without counting transient rejects as failed blocks')
 attempts=0;ctx.Place=function() attempts+=1;return false,{error='TOO_FAST'},'rejected' end
 value=fresh();value:Start();drain()
 assert(attempts==6 and value.Progress.Failed==1 and value.Progress.State=='Paused after cooldown','persistent server pacing must stop after five retries')
 attempts=0;value=fresh();value:Start();value:Stop();drain();assert(attempts==1,'Stop must cancel cooldown before another request')
 local due
 ctx.Place=function(body) due={Position=body.cframe.Position,At=ticks+2};return true end
 ctx.GameModule=function(path,name)
  if name=='BlockUtils' then return {getBlocksFromLocation=function(pos) if due and ticks>=due.At then occupied[due.Position]=true end;return occupied[pos] and {true} or {} end} end
 end
 value=fresh(1);value:Start();drain()
 assert(value.Progress.Placed==1 and value.Progress.Failed==0,'a block replicated after two seconds must confirm rather than fail')
 ctx.GameModule=originalModule
 attempts=0;ctx.Place=function() attempts+=1;return false,'connection lost','transport' end
 value=fresh();local ghost={Destroy=function(self) self.Destroyed=true end};value.Cells[1].Preview=ghost
 value:Start();drain()
 assert(attempts==1 and value.Progress.State=='Placement needs review' and value.Progress.Failed==1 and not ghost.Destroyed,'uncertain transport must retain the ghost and stop before the next cell')
 assert(string.find(value:DiagnosticReport(),'connection lost',1,true),'diagnostics must retain the actual placement failure')
 attempts=0;ctx.Place=function(body)
  attempts+=1;if attempts==1 then root.Position=setmetatable({},{__sub=function() return {Magnitude=100} end});return false,{error='TOO_FAST'} end
  occupied[body.cframe.Position]=true;return true
 end
 value=fresh(1);value:Start()
 for _=1,20 do step() end
 assert(attempts==1 and value.Progress.State=='Waiting for reach','cooldown must recheck reach before resending')
 root.Position=setmetatable({},{__sub=function() return {Magnitude=0} end});drain();assert(attempts==2 and value.Progress.Placed==1)
 for _,invalid in ipairs({0,-1,math.huge,0/0}) do
  ctx.GameModule=function(_,name) if name=='CLIENT_REACH' then return invalid end;if name=='BlockUtils' then return {getBlocksFromLocation=function() return {} end} end end
  value=fresh(1);root.Position=setmetatable({},{__sub=function() return {Magnitude=100} end});local before=attempts
  value:Start();assert(attempts==before and value.Progress.State=='Waiting for reach','invalid reach metadata must use the normal fallback rather than send from afar')
  value:Stop();drain()
 end
 ctx.Place,ctx.GameModule=originalPlace,originalModule
 end)()
-- Auto Walk shares fresh range/occupancy checks with ordinary placement.
;(function()
 local fields={'Approach','StopTravel','TravelBlocked','Place','PlacementReady','GameModule'}
 local old={};for _,key in ipairs(fields) do old[key]=ctx[key] end
 local oldCharacter,oldPosition=ctx.Player.Character,root.Position
 local walks,stops,trace,conflict=0,0,{},nil
 local distance=100
 local function position() root.Position=setmetatable({},{__sub=function() return {Magnitude=distance} end}) end
 local function drain() for _=1,500 do if coroutine.status(worker)=='dead' then return end;step() end;error('walk worker did not finish') end
 local function fresh(n)
  occupied={};distance=100;position();walks=0;stops=0;trace={};conflict=nil
  local value=A.new(ctx);value.Cells=cells(n);value.BlockSize=3
  assert(value.TravelMode=='Stay','legacy manual reach must remain the default')
  return value
 end
 ctx.TravelBlocked=function() return conflict end
 ctx.StopTravel=function() stops+=1 end
 ctx.PlacementReady=function() return true end
 ctx.Place=function(body)
  assert(distance<=20,'every send must have fresh normal reach')
  table.insert(trace,body.cframe.Position);occupied[body.cframe.Position]=true;return true
 end
 ctx.Approach=function(cell,reach,active)
  assert(reach==20 and active());walks+=1;distance=0;return true
 end
 local value=fresh(1)
 value:SetTravelMode('Walk')
 local report=value:CheckSetup()
 assert(report.States.Reach=='ACTION' and string.find(report.Text,'Auto Walk will try paths after Start',1,true) and walks==0 and #trace==0,'setup must keep distant cells out of reach and describe untested paths without movement')
 conflict='Other movement is active';report=value:CheckSetup()
 assert(report.States.Walking=='ACTION' and walks==0 and #trace==0,'read-only setup must expose movement conflicts')
 conflict=nil
 ctx.TravelBlocked=function() value:SetTravelMode('Stay') end
 assert(not value:CheckSetup() and not value.SetupReport,'a movement change during a yielding setup lookup must invalidate its report')
 ctx.TravelBlocked=function() return conflict end
 value:SetTravelMode('Walk');ctx.PlacementReady=function() value:SetTravelMode('Stay');return true end
 assert(not value:Start() and not value.WorkerToken and walks==0,'changing movement during readiness checks must not launch a worker with a stale mode')
 ctx.PlacementReady=function() return true end
 value=fresh(2)
 value:Start();assert(walks==0 and #trace==0 and value.Progress.State=='Waiting for reach','Stay must wait without requesting any movement')
 value:Stop();drain()
 value=fresh(3);occupied[1]=true
 assert(value:SetTravelMode('Walk') and not value:SetTravelMode('Teleport'),'Auto Walk supports only Stay/Walk')
 assert(value:Start() and not value:SetTravelMode('Stay'),'active workers must freeze the travel choice')
 drain();assert(walks==1 and #trace==2 and trace[1]==2 and trace[2]==3 and value.Progress.Placed==2 and value.Progress.Skipped==1,'skip distant occupied cells, walk once, then confirm in-range cells')
 assert(stops>0 and string.find(value:DiagnosticReport(),'Build movement: Walk',1,true),'completion must release walking and expose movement in diagnostics')
 value=fresh(1);value:SetTravelMode('Walk');conflict='Other movement is active'
 assert(not value:Start() and not value.WorkerToken and walks==0 and #trace==0,'conflicts must block Start before a path or placement')
 value=fresh(1);value:SetTravelMode('Walk');ctx.Approach=nil
 assert(not value:Start() and string.find(value.Status.Text,'unavailable',1,true),'missing walking adapter must explain the manual fallback')
 for _,arrived in ipairs({false,true}) do
  value=fresh(1);value:SetTravelMode('Walk')
  ctx.Approach=function() walks+=1;return arrived,'Path failed' end
  assert(value:Start());drain()
  assert(walks==1 and #trace==0 and value.Progress.State=='Walking paused' and value.Cells and next(value.Failures)==nil,'a blocked path or inaccurate success cannot place, retry forever or reject untouched cells')
 end
 value=fresh(1);value:SetTravelMode('Walk')
 ctx.Approach=function(_,_,active) walks+=1;ctx.Scheduler.wait(.1);if active() then distance=0 end;return true end
 value:Start();local stopped=stops
 value:Stop();assert(stops==stopped+1 and #trace==0 and not value:Start() and not value:SetTravelMode('Stay'),'Stop releases movement immediately and locks restart until path cleanup')
 drain();assert(#trace==0 and value.Progress.State=='Stopped' and not value.WorkerToken,'an old path cannot place after Stop')
 assert(value:Start());drain();assert(#trace==1 and walks==2,'OFF/ON restart must create a new path after cleanup')
 value=fresh(1);value:SetTravelMode('Walk');value:Start();conflict='Chest walking started';drain()
 assert(#trace==0 and value.Progress.State=='Walking paused' and string.find(value.Status.Text,conflict,1,true),'a new conflicting worker during path computation must pause before placement')
 value=fresh(1);value:SetTravelMode('Walk')
 ctx.Approach=function() walks+=1;distance=0;return true end
 local attempts=0
 ctx.Place=function(body)
  attempts+=1;assert(distance<=20)
  if attempts==1 then distance=100;return false,{error='TOO_FAST'},'rejected' end
  occupied[body.cframe.Position]=true;table.insert(trace,body.cframe.Position);return true
 end
 value:Start();drain();assert(attempts==2 and walks==2 and value.Progress.Placed==1,'cooldown retries must approach again when the actor moved outside reach')
 value=fresh(1);value:SetTravelMode('Walk');attempts=0
 ctx.Approach=function(cell) walks+=1;distance=0;if walks==2 then occupied[cell.CFrame.Position]=true end;return true end
 value:Start();drain();assert(attempts==1 and walks==2 and value.Progress.Skipped==1,'a cell occupied during cooldown travel must not be resent')
 ctx.Place=old.Place
 value=fresh(1);value:SetTravelMode('Walk');ctx.Player.Character=nil
 value:Start();assert(walks==0 and #trace==0 and value.Running,'missing character must wait without moving or disabling the build')
 ctx.Player.Character=oldCharacter;drain();assert(walks==1 and value.Progress.Placed==1)
 value=fresh(1);value:SetTravelMode('Walk');ctx.Approach=function() error('path service failed') end
 value:Start();drain();assert(value.Progress.State=='Error' and stops>0 and not value.WorkerToken and next(value.Failures)==nil,'path exceptions must clean up without recording a dispatched request')
 for _,key in ipairs(fields) do ctx[key]=old[key] end
 ctx.Player.Character=oldCharacter;root.Position=oldPosition;occupied={}
 end)()
-- Plan controls must agree with the immutable active preview.
root.Position=setmetatable({},{__sub=function() return {Magnitude=0} end})
occupied={};b.Cells=cells(2);b:Start()
b.Inputs.Width.Text='9';b.Inputs.Width.FocusLost:Fire()
assert(b.Width==5 and b.Inputs.Width.Text=='5','active dimensions must not silently invalidate the queued plan')
b.Inputs.Material.Text='stone';b.Inputs.Material.FocusLost:Fire()
assert(b.Inputs.Material.Text=='grass','active material edits must not disagree with the preview')
b:Stop();step()
b.Inputs.Width.Text='9';b.Inputs.Width.FocusLost:Fire()
assert(b.Width==9 and b.Inputs.Width.Text=='9' and b.Cells==nil,'stopped plan edits must invalidate the old preview')
local moved=A.new(ctx)
moved.Anchor=frame(10,0,10,math.pi/2);moved.BlockSize=3
local original=moved.Anchor*frame(0,0,-3)
local ghost={}
moved.Cells={{CFrame=original,Material='grass',Preview=ghost}}
moved.BuildReport='Old check'
assert(moved:Move(1,1,1))
assert(not moved.BuildReport and not string.find(moved.MaterialSummary.Text,'Old check',1,true),'moving the blueprint must clear the displayed old build check')
local p=moved.Cells[1].CFrame.Position
assert(math.abs(p.X-4)<.001 and math.abs(p.Y-3)<.001 and math.abs(p.Z-7)<.001,'blueprint shifts must follow its rotated axes')
assert(ghost.CFrame==moved.Cells[1].CFrame,'ghost must follow actual placement coordinates')
moved.Running=true;assert(not moved:Move(1,0,0),'cannot shift active queue');moved.Running=false
assert(moved:Move(-moved.OffsetX,-moved.OffsetY,-moved.OffsetZ))
local restored=moved.Cells[1].CFrame.Position
assert(math.abs(restored.X-original.Position.X)<.001 and math.abs(restored.Z-original.Position.Z)<.001,'reset offset must restore preview')
-- Named, plain-data layouts preserve materials and rotations across save/load.
local stored,writes=nil,0
ctx.WriteBlueprint=function(slot,data) assert(slot==1);writes+=1;stored=data;return true end
ctx.ReadBlueprint=function(slot) assert(slot==1);return stored end
local library=A.new(ctx)
library.Anchor=frame(30,0,20,math.pi/2);library.BlockSize=3
library.Cells={
 {CFrame=library.Anchor*frame(0,0,0),Material='grass'},
 {CFrame=library.Anchor*frame(3,3,-3,math.pi/2),Material='stone'}}
assert(library:SavePreview() and writes==1 and #stored.Cells==2,'saving preview must persist a validated layout')
assert(stored.Name=='My island build' and stored.Cells[2].Material=='stone','saved layout must retain its name and per-block material')
assert(math.abs(stored.Cells[2].Components[1]-3)<.001 and math.abs(stored.Cells[2].Components[6]-1)<.001,'saved transforms must be relative and preserve rotation')
library.Cells[2].Material='changed'
assert(stored.Cells[2].Material=='stone','saved layouts must not alias a mutable preview')
local loaded=A.new(ctx)
local requestsBefore=requests
assert(loaded:LoadBlueprint() and loaded.SavedPlan and not loaded.Cells and not loaded.Running and requests==requestsBefore,'loading must not preview or send placements')
local previous=loaded.SavedPlan
loaded.Library={};ctx.ReadBlueprint=function() return {Version=99} end
assert(not loaded:LoadBlueprint() and loaded.SavedPlan==previous,'invalid disk data must preserve the current plan')
loaded.Running=true
assert(not loaded:LoadBlueprint() and not loaded:SavePreview() and not loaded:CaptureIsland(),'active plans must refuse library mutation')
loaded.Running=false
local function valid()
 return {Version=1,Name='Test',BlockSize=3,Cells={{Material='grass',Components={0,0,0,1,0,0,0,1,0,0,0,1}}}}
end
for _,change in ipairs({
 function(d) d.Cells[1].Components[1]=0/0 end,
 function(d) d.Cells[1].Components[2]=math.huge end,
 function(d) d.Cells[1].Components[4]=2 end,
 function(d) d.Cells[1].Components[12]=-1 end,
 function(d) d.Cells[1].Material='' end,
 function(d) d.Name=string.rep('x',49) end,
 function(d) d.BlockSize=0 end,
 function(d) d.Cells[2]=d.Cells[1] end,
 function(d) d.Cells.extra=d.Cells[1] end,
 function(d) for i=2,301 do d.Cells[i]=d.Cells[1] end end
}) do local data=valid();change(data);assert(not pcall(A.Validate,data),'malformed blueprints must fail validation') end
-- Captures are sourced only from the owned-island adapter and the chosen radius.
root.CFrame=CFrame.new(0,3,0);root.Position=root.CFrame.Position
ctx.BlockDefinitions=function() return definitions end
local function block(name,x,y,z,model)
 return {Name=name,CFrame=CFrame.new(x,y,z,model and math.pi/2 or 0),
  IsA=function(_,kind) return kind==(model and 'Model' or 'BasePart') end,
  GetPivot=function(self) return self.CFrame end}
end
local islandBlocks={block('grass',0,0,0),block('stone',3,3,0,true),block('grass',100,0,0),block('unknown',0,0,0)}
ctx.IslandBlocks=function() return {GetChildren=function() return islandBlocks end} end
assert(library:CaptureIsland() and writes==2 and #stored.Cells==2,'capture must include nearby defined blocks and exclude distant or unknown objects')
local saved=library.Library[1]
ctx.IslandBlocks=function() return nil end
assert(not library:CaptureIsland() and library.Library[1]==saved,'missing owned island must preserve the saved slot')
islandBlocks={}
for i=1,301 do islandBlocks[i]=block('grass',i*.05,0,0) end
ctx.IslandBlocks=function() return {GetChildren=function() return islandBlocks end} end
assert(not library:CaptureIsland() and library.Library[1]==saved and writes==2,'oversized areas must refuse without truncating or overwriting the saved slot')
ctx.WriteBlueprint=function() error('disk unavailable') end
assert(library:StoreBlueprint(valid()) and library.Library[1].Name=='Test' and string.find(library.Status.Text,'Session only',1,true),'file errors must retain a usable session blueprint')
-- Loaded layouts feed the existing preview and placement confirmation pipeline.
ctx.Workspace.Raycast=function() return {Position=vector(0,1.5,0)} end
loaded.SavedPlan=A.Validate(stored);loaded.Preset='Saved test';loaded.Cells=nil
loaded.Inputs.Material.Text='';loaded.Inputs.Path.Text='' -- saved materials are independent of generator inputs
assert(loaded:Preview() and #loaded.Cells==2,'loaded layouts must generate preview cells')
assert(loaded.Cells[2].Material=='stone' and math.abs(loaded.Cells[2].CFrame.yaw-math.pi/2)<.001,'loaded previews must retain per-block material and rotation')
local needs=loaded:UpdateMaterials(loaded.Cells)
assert(needs.grass==1 and needs.stone==1,'material summary must count each saved block type')
occupied={};before=requests;loaded:Start()
while coroutine.status(worker)~='dead' do step() end
assert(requests-before==2 and string.find(loaded.Status.Text,'2 confirmed',1,true),'saved layouts must build only through the existing confirmed queue')
-- Stop must retain ownership until an in-flight request really returns.
occupied={};root.Position=setmetatable({},{__sub=function() return {Magnitude=0} end})
ctx.Place=function(body)
 requests+=1;ctx.Scheduler.wait(.1);occupied[body.cframe.Position]=true;return true
end
b.Cells=cells(2);before=requests;b:Start()
local inFlight=worker
assert(b.WorkerToken and requests==before+1,'fixture must stop inside a pending placement')
b:Stop()
assert(not b:Start() and worker==inFlight and requests==before+1,'immediate resume must not overlap a cancelled in-flight request')
assert(not b:CheckMaterials(),'read-only build checks must wait for the active request to finish')
step();assert(not b.WorkerToken,'cancelled worker must release ownership when its request returns')
b:Start()
while coroutine.status(worker)~='dead' do step() end
assert(requests-before==2 and b.Progress.Placed==1 and b.Progress.Skipped==1 and b.Progress.Failed==0 and b.Progress.State=='Finished','resume must skip the settled old request and retain accurate new-run counters')
-- Build checks are read-only snapshots of remaining material and reach needs.
local check=A.new(ctx)
check.Cells={{CFrame={Position=1},Material='grass'},{CFrame={Position=2},Material='grass'},{CFrame={Position=3},Material='stone'}}
check.BlockSize=3
root.Position=setmetatable({},{__sub=function(_,position) return {Magnitude=position==2 and 5 or 100} end})
occupied={[1]=true}
ctx.ItemCount=function(material) return material=='grass' and 0 or 7 end
before=requests
local result=check:CheckMaterials()
assert(result.Occupied==1 and result.Remaining==2 and result.Reachable==1 and result.Materials.grass==1 and result.Materials.stone==1,'preflight must exclude occupied cells and count reach independently')
assert(requests==before and not check.Running and not check.WorkerToken,'build checks must never send placements or start workers')
assert(string.find(check.BuildReport,'grass: need 1, owned 0, short 1',1,true),'zero owned stock must show a real shortage')
assert(string.find(check.BuildReport,'stone: need 1, owned 7, short 0',1,true),'adequate stock must not be labelled missing')
ctx.ItemCount=function(material) if material=='grass' then return .5 end;error('inventory unavailable') end
assert(check:CheckMaterials())
assert(string.find(check.BuildReport,'grass: need 1, owned quantity unknown',1,true) and string.find(check.BuildReport,'stone: need 1, owned quantity unknown',1,true),'invalid and failed inventory reads must be unknown rather than zero')
occupied={[1]=true,[2]=true,[3]=true}
result=check:CheckMaterials();assert(result.Remaining==0 and next(result.Materials)==nil,'completed layouts must need no additional material')
check:ClearPreview();assert(not check.BuildReport and not check:CheckMaterials(),'changing the plan must invalidate the old preflight snapshot')
-- Consolidated setup reports preserve building behavior and make no requests.
;(function()
 local fields={'PlacementReady','BuildBlocked','GameModule','ItemCount','Alive'}
 local old={};for _,field in ipairs(fields) do old[field]=ctx[field] end
 local originalCharacter=ctx.Player.Character
 local function has(text,part) return string.find(text,part,1,true)~=nil end
 local function find(report,name) for _,row in ipairs(report.Checks) do if row.Name==name then return row end end end
 local value=A.new(ctx);value.Cells=cells(3);value.BlockSize=3
 occupied={[1]=true}
 root.Position=setmetatable({},{__sub=function(_,pos) return {Magnitude=pos==3 and 50 or 5} end})
 ctx.PlacementReady=function() return false,'Learn placement first' end
 ctx.BuildBlocked=function() return 'Wait for Auto Plow cleanup' end
 ctx.ItemCount=function() return 0 end
 local before=requests;local token=value.Token
 local report=value:CheckSetup()
 assert(report.NextSteps and string.find(report.Text,'Collect missing blocks: grass ×2',1,true),'setup must name concrete missing materials in its next steps')
 assert(report.Summary=='ACTION NEEDED' and report.Materials.Occupied==1 and report.Materials.Remaining==2 and report.Materials.Quantities.grass.Missing==2)
 assert(find(report,'Placement').State=='ACTION' and find(report,'Automation').State=='ACTION' and find(report,'Reach').State=='ACTION' and find(report,'Materials').State=='ACTION')
 assert(string.find(report.Text,'[ACTION] Placement',1,true)<string.find(report.Text,'[INFO] Movement',1,true),'setup must show blockers before informational Auto Walk status')
 assert(string.find(value.Status.Text,report.NextSteps[1],1,true),'the main status must show the next concrete action')
 assert(requests==before and not value.WorkerToken and not value.Running and value.Token==token and value.Cells[1].Material=='grass','setup cannot send, launch or mutate the blueprint')
 ctx.PlacementReady=function() return true,'Native endpoint ready' end;ctx.BuildBlocked=function() end;ctx.ItemCount=function() return 2 end
 root.Position=setmetatable({},{__sub=function() return {Magnitude=5} end})
 report=value:CheckSetup();assert(report.Summary=='LOCAL CHECKS PASS' and report.Actions==0 and report.Unknown==0 and has(value.MaterialSummary.Text,'[OK] Materials'))
 for _,bad in ipairs({-1,.5,math.huge,0/0,'2'}) do
  ctx.ItemCount=function() return bad end;report=value:CheckSetup()
  assert(report.Summary=='CHECKS INCOMPLETE' and find(report,'Materials').State=='UNKNOWN' and report.Materials.Quantities.grass.Missing==nil,'bad stock cannot claim materials ready or zero')
 end
 ctx.ItemCount=function() error('unreadable') end;ctx.PlacementReady=function() error('lookup failed') end
 report=value:CheckSetup();assert(find(report,'Placement').State=='UNKNOWN' and find(report,'Materials').State=='UNKNOWN')
 ctx.PlacementReady=function() return true end;ctx.ItemCount=function() return 10 end
 ctx.Player.Character=nil;report=value:CheckSetup()
 assert(find(report,'Character').State=='ACTION' and find(report,'Reach').State=='UNKNOWN','missing character must leave reach unknown')
 ctx.Player.Character=originalCharacter
 for _,bad in ipairs({-1,0,math.huge,0/0}) do
  ctx.GameModule=function(path,name) if name=='CLIENT_REACH' then return bad end;return old.GameModule(path,name) end
  report=value:CheckSetup();assert(report.Materials.Reach==20 and report.Materials.ReachFallback,'setup range must match the worker fallback for invalid metadata')
 end
 ctx.GameModule=old.GameModule;occupied={[1]=true,[2]=true,[3]=true}
 report=value:CheckSetup();assert(report.Summary=='NOTHING TO PLACE' and report.Materials.Remaining==0)
 value.Cells=nil;report=value:CheckSetup();assert(find(report,'Preview').State=='ACTION' and not report.Materials and value.Cells==nil,'setup cannot create a preview implicitly')
 value.Cells=cells(2)
 value.Running=true;assert(not value:CheckSetup());value.Running=false
 value.WorkerToken=82;assert(not value:CheckSetup());value.WorkerToken=nil
 ctx.Alive=function() return false end;local previous=value.MaterialSummary.Text
 assert(not value:CheckSetup() and value.MaterialSummary.Text==previous,'destroyed UI must not publish setup results');ctx.Alive=old.Alive
 occupied={};value.Cells={{CFrame={Position=1},LayerY=0,Material='grass'},{CFrame={Position=2},LayerY=3,Material='stone'}}
 value.LayerIndex=1;report=value:CheckSetup();assert(report.Materials.Selected==1 and report.Materials.Excluded==1 and not report.Materials.Materials.stone,'setup must check only the selected layer')
 value:UpdateMaterials(value:SelectedCells());assert(not value.SetupReport and not value.SetupResult,'editing plan material state must invalidate the snapshot')
 -- A yielding callback must not publish over a moved/changed plan or a new worker.
 ctx.ItemCount=function() value:UpdateMaterials(value:SelectedCells());return 10 end
 assert(not value:CheckSetup() and not value.SetupReport,'revision changes during a count read must discard both material/setup snapshots')
 ctx.ItemCount=old.ItemCount;ctx.PlacementReady=function() value.Token+=1;return true end
 assert(not value:CheckSetup(),'new cycle during placement lookup must discard the old setup')
 for _,field in ipairs(fields) do ctx[field]=old[field] end
 end)()
-- Retry failed uses only rejected cells from the current plan/layer.
;(function()
 local originalPlace,originalReady=ctx.Place,ctx.PlacementReady
 local function drain() for _=1,2500 do if coroutine.status(worker)=='dead' then return end;step() end;error('retry worker did not settle') end
 local function fresh(n)
  occupied={};root.Position=setmetatable({},{__sub=function() return {Magnitude=0} end})
  local value=A.new(ctx);value.Cells=cells(n);value.BlockSize=3;return value
 end
 local trace,allow={},false
 ctx.Place=function(body)
  local pos=body.cframe.Position;table.insert(trace,pos)
  if not allow and (pos==1 or pos==3) then return false,{success=false,error='MISSING_MATERIALS'},'rejected' end
  occupied[pos]=true;return true
 end
 local value=fresh(4)
 assert(not value.Buttons.RetryFailed.Active and not value:RetryFailures(),'fresh plans cannot retry cells they have never attempted')
 assert(value:Start());drain()
 assert(value.Progress.Failed==2 and value:FailureCounts().Retryable==2 and value.Buttons.RetryFailed.Active,'explicitly rejected cells must become retry candidates after worker cleanup')
 assert(string.find(value:FailureReport(),'blueprint block #1 · grass · MISSING_MATERIALS',1,true) and string.find(value:DiagnosticReport(),'MISSING_MATERIALS',1,true),'per-cell reasons must survive a later successful placement result')
 allow=true;trace={};assert(value:RetryFailures());drain()
 assert(#trace==2 and trace[1]==1 and trace[2]==3 and value.Progress.RetryOnly and value.Progress.Total==2 and value.Progress.Placed==2,'Retry failed must exclude successful and unattempted cells while preserving order')
 assert(value:FailureCounts().Retryable==0 and not value.Buttons.RetryFailed.Active and value.History[1].RetryOnly,'successful retry must clear candidates and label result history')
 -- A rejected target that has since become occupied is skipped without resending.
 ctx.Place=function() return false,{success=false,error='DENIED'},'rejected' end
 value=fresh(1);value:Start();drain();occupied[1]=true
 ctx.Place=function() error('occupied retry must not send') end
 assert(value:RetryFailures());drain();assert(value.Progress.Skipped==1 and value:FailureCounts().Retryable==0)
 -- Unknown transport and accepted/no-gain outcomes need review, not automatic replay.
 trace={};ctx.Place=function(body)
  table.insert(trace,body.cframe.Position)
  if body.cframe.Position==1 then return false,{success=false,error='DENIED'},'rejected' end
  return false,'connection lost','transport'
 end
 value=fresh(3);value:Start();drain()
 assert(value:FailureCounts().Retryable==1 and value:FailureCounts().Review==1 and #trace==2)
 trace={};ctx.Place=function(body) table.insert(trace,body.cframe.Position);occupied[body.cframe.Position]=true;return true end
 assert(value:RetryFailures());drain()
 assert(#trace==1 and trace[1]==1 and value:FailureCounts().Review==1,'retry cannot include an uncertain request or an untouched later cell')
 assert(not value:RetryFailures())
 local attempts=0;ctx.Place=function() attempts+=1;return false,{error='TOO_FAST'},'transport' end
 value=fresh(1);value:Start();drain()
 assert(attempts==1 and value:FailureCounts().Review==1 and value:FailureCounts().Retryable==0,'transport-origin cooldown-shaped errors must never trigger a resend')
 ctx.Place=function() return true end;value=fresh(1);value:Start();drain()
 assert(value:FailureCounts().Review==1 and value:FailureCounts().Retryable==0 and not value:RetryFailures(),'accepted/unconfirmed calls cannot enter rejected-only retries')
 -- Stop during a dispatched request retains its review marker until inspected.
 ctx.Place=function() ctx.Scheduler.wait(.1);return false,{success=false,error='DENIED'},'rejected' end
 value=fresh(1);value:Start();value:Stop()
 assert(not value:RetryFailures() and not value.Buttons.RetryFailed.Active,'in-flight cleanup must lock retry even after Stop')
 drain();assert(value:FailureCounts().Review==1 and value:FailureCounts().Retryable==0)
 -- Layer selection narrows the same rejected set; changed geometry/materials do not match it.
 ctx.Place=function() return false,{success=false,error='DENIED'},'rejected' end
 value=fresh(3);value.Cells[1].LayerY=0;value.Cells[2].LayerY=0;value.Cells[3].LayerY=3
 value:Start();drain();assert(value:CycleLayer() and value:FailureCounts().Retryable==2)
 trace={};ctx.Place=function(body) table.insert(trace,body.cframe.Position);occupied[body.cframe.Position]=true;return true end
 assert(value:RetryFailures());drain();assert(#trace==2 and trace[1]==1 and trace[2]==2)
 assert(value:CycleLayer() and value:FailureCounts().Retryable==1)
 value.Cells[3].Material='stone';value:UpdateMaterials(value:SelectedCells())
 assert(not value.Buttons.RetryFailed.Active and not value:RetryFailures(),'a changed material must not reuse an old rejection')
 value.Cells[3].Material='grass';value.Cells[3].CFrame={Position=30};value:UpdateMaterials(value:SelectedCells())
 assert(value:FailureCounts().Retryable==0,'moved geometry must not reuse old coordinates')
 value:ClearPreview();assert(next(value.Failures)==nil)
 ctx.Place,ctx.PlacementReady=originalPlace,originalReady
 end)()
-- Slot inspection validates files without selecting their plans or starting work.
ctx.ReadBlueprint=function(slot)
 if slot==1 then local data=valid();data.Name='House';return data end
 if slot==2 then return {Version=999} end
 if slot==3 then error('read failed') end
 if slot==5 then local data=valid();data.Name='Barn';return data end
end
local browser=A.new(ctx)
local summary=browser:RefreshLibrary(true)
assert(browser.Library[1].Name=='House' and browser.Library[5].Name=='Barn' and not browser.SavedPlan and not browser.Cells,'library browsing must cache valid slots without loading a plan')
assert(string.find(summary,'2: Invalid file',1,true) and string.find(summary,'3: Unavailable file',1,true),'browser must distinguish malformed files from failed reads')
summary=browser:RefreshLibrary(false)
assert(string.find(summary,'2: Invalid file',1,true),'known slot diagnostics must remain visible without rereading files')
assert(browser:StoreBlueprint(valid())) -- file writer still fails; the newest session save wins
summary=browser:RefreshLibrary(true)
assert(browser.Library[1].Name=='Test' and string.find(summary,'Session only',1,true),'refresh must preserve a newer session-only save over older disk data')
assert(requests==before,'slot browsing must never place blocks')
-- Material edits are isolated from saved slots and preserve preview transforms.
local disk,writes47={},0
ctx.WriteBlueprint=function(slot,data) disk[slot]=A.Validate(data);writes47+=1;return true end
local editor=A.new(ctx)
assert(editor:StoreBlueprint(stored) and editor:LoadBlueprint())
editor.Anchor=frame(0,0,0);editor.BlockSize=3
editor.Cells={{CFrame=frame(0,0,0),Material='grass'},{CFrame=frame(3,3,0,math.pi/2),Material='stone'}}
local source47=editor.Library[1]
local position47=editor.Cells[2].CFrame
editor.BuildReport='Old check'
local changed47,count47=editor:ReplaceMaterial(' grass ','stone')
assert(changed47 and count47==1 and editor.SavedPlan.Cells[1].Material=='stone' and editor.Cells[1].Material=='stone','replacement must apply only to matching blocks in the working layout')
assert(editor.Library[1]==source47 and source47.Cells[1].Material=='grass' and disk[1].Cells[1].Material=='grass','material editing must not overwrite the original memory or disk slot')
assert(editor.Cells[2].CFrame==position47 and editor.PlanDirty and not editor.BuildReport,'material edits must preserve preview transforms and invalidate preflight')
local work47=editor.SavedPlan
assert(not editor:ReplaceMaterial('stone','unknown') and editor.SavedPlan==work47,'unknown replacements must leave the working layout intact')
assert(not editor:ReplaceMaterial('missing','grass') and editor.SavedPlan==work47,'a missing source material must not create an edit')
assert(editor:UndoMaterial() and editor.Cells[1].Material=='grass' and not editor.PlanDirty and editor.Cells[2].CFrame==position47,'Undo must restore the preceding materials and clean/dirty state without moving cells')
assert(not editor:UndoMaterial(),'only the latest material edit is retained for Undo')
assert(editor:ReplaceMaterial('grass','stone') and editor:SavePreview())
assert(disk[1].Cells[1].Material=='stone' and not editor.PlanDirty and not editor.MaterialUndo,'Save preview must commit the working material change and clear Undo')
-- Rename and copy operate on validated slot snapshots, not the working preview.
local preview47=editor.Cells
assert(editor:RenameSlot('  Budget House  ') and editor.Library[1].Name=='Budget House' and disk[1].Name=='Budget House','rename must trim and persist the blueprint name')
local renamed47=editor.Library[1]
assert(not editor:RenameSlot('   ') and editor.Library[1]==renamed47,'invalid names must preserve existing saved data')
assert(not editor:CopySlot(1) and not editor:CopySlot(nil) and not editor:CopySlot(6),'copy must reject the source and invalid destination slots')
editor.Library[2]=valid()
assert(editor:CopySlot(2) and editor.Slot==1 and editor.Library[2].Name=='Budget House' and editor.Cells==preview47,'copy must overwrite only the explicit destination and preserve source selection/preview')
assert(editor.Library[1]~=editor.Library[2] and editor.Library[1].Cells[1]~=editor.Library[2].Cells[1],'copied slots must not alias source data')
assert(math.abs(disk[2].Cells[2].Components[6]-1)<.001,'slot copies must retain saved block rotations')
local guard47=writes47
editor.WorkerToken=99
assert(not editor:ReplaceMaterial('stone','grass') and not editor:RenameSlot('No') and not editor:CopySlot(3) and not editor:StoreBlueprint(valid()),'in-flight worker ownership must guard edits and writes after Stop')
assert(writes47==guard47,'blocked edits must not write files')
editor.WorkerToken=nil
-- Layer selection filters the queue without cutting the saved blueprint.
local layered=A.new(ctx)
layered.Anchor=frame(0,0,0);layered.BlockSize=3
local function layerCell(x,y,material)
 return {CFrame=frame(x,y,0),LayerY=y,Material=material,Preview={Transparency=.65,Destroy=function(self) self.Destroyed=true end}}
end
layered.Cells={layerCell(0,0,'grass'),layerCell(3,0,'grass'),layerCell(0,3,'stone'),layerCell(0,6,'grass')}
local full48=layered.Cells
local upper48=layered.Cells[3].Preview
assert(#layered:SelectedCells()==4 and not layered.LayerIndex,'default selection must include every block')
layered.BuildReport='Old full-plan check'
assert(layered:CycleLayer() and layered.LayerIndex==1 and #layered:SelectedCells()==2 and not layered.BuildReport,'first layer must include only its matching cells and invalidate the old check')
assert(layered.Cells[1].Preview.Transparency==.65 and upper48.Transparency==.94,'excluded preview layers must be visibly faint')
occupied={};root.Position=setmetatable({},{__sub=function() return {Magnitude=0} end})
local check48=layered:CheckMaterials()
assert(check48.Selected==2 and check48.Excluded==2 and check48.Materials.grass==2 and not check48.Materials.stone,'material checks must use only selected layers')
assert(layered:SavePreview() and #disk[1].Cells==4 and layered.Cells==full48 and layered.LayerIndex==1,'Save preview must preserve the full blueprint and current layer selection')
before=requests;layered:Start()
assert(layered.Progress.Total==2 and not layered:CycleLayer() and layered.LayerIndex==1,'active builds must freeze their selected layer')
layered:Stop()
assert(not layered:CycleLayer() and layered.LayerIndex==1,'cancelled in-flight requests must also protect layer selection')
while coroutine.status(worker)~='dead' do step() end
layered:Start()
while coroutine.status(worker)~='dead' do step() end
assert(requests-before==2 and layered.Progress.Total==2 and layered.Progress.Placed==1 and layered.Progress.Skipped==1,'resume must complete only the selected layer, skipping its settled old request')
assert(not upper48.Destroyed,'building one layer must retain the unbuilt upper preview')
assert(layered:CycleLayer() and layered.LayerIndex==2 and #layered:SelectedCells()==1 and upper48.Transparency==.65,'next layer must select its own cells and restore their ghost visibility')
before=requests;layered:Start()
while coroutine.status(worker)~='dead' do step() end
assert(requests-before==1 and layered.Progress.Total==1 and layered.Progress.Placed==1,'upper-layer builds must not revisit lower or higher layers')
assert(layered:CycleLayer() and layered.LayerIndex==3 and #layered:SelectedCells()==1,'all distinct heights must be selectable bottom-up')
assert(layered:CycleLayer() and not layered.LayerIndex and #layered:SelectedCells()==4,'layer selector must cycle back to the complete layout')
layered:ClearPreview()
assert(not layered.LayerIndex and not layered:CycleLayer(),'clearing the plan must reset layer selection and require a new preview')
-- In-place rotations preserve the anchor, selected layer and unsaved edits.
local spatial=A.new(ctx)
spatial.Anchor=frame(10,2,20);spatial.BaseAnchor=frame(7,2,20);spatial.BlockSize=3;spatial.OffsetX=1
spatial.Cells={
 {CFrame=spatial.Anchor*frame(3,0,-3),LayerY=0,Material='grass',Preview={}},
 {CFrame=spatial.Anchor*frame(-3,3,-6,math.pi/2),LayerY=3,Material='stone',Preview={}}}
spatial.SavedPlan=A.Validate(stored);spatial.Library[1]=A.Validate(stored)
assert(spatial:ReplaceMaterial('grass','stone'),'spatial fixture must retain a real unsaved material edit')
local undo49,slot49,cells49=spatial.MaterialUndo,spatial.Library[1],spatial.Cells
local first49,second49=spatial.Cells[1].CFrame,spatial.Cells[2].CFrame
local writes49,requests49=writes47,requests
assert(spatial:CycleLayer() and spatial.LayerIndex==1)
spatial.BuildReport='Old check'
assert(spatial:RotatePreview())
local rotated49=spatial.Cells[1].CFrame.Position
assert(math.abs(rotated49.X-7)<.001 and math.abs(rotated49.Z-17)<.001 and spatial.Anchor.Position.X==10 and spatial.Anchor.Position.Z==20,'rotation must turn cells around the existing anchor without moving the anchor')
assert(spatial.OffsetX==0 and spatial.OffsetZ==-1 and spatial.Rotation==90,'rotation must convert offsets into the new preview axes')
assert(spatial.Cells[1].Preview.CFrame==spatial.Cells[1].CFrame and spatial.LayerIndex==1 and spatial.PlanDirty and spatial.MaterialUndo==undo49 and not spatial.BuildReport,'rotation must update ghosts, retain edits/layers/Undo and invalidate preflight')
for i=1,3 do assert(spatial:RotatePreview()) end
assert(spatial.Rotation==0 and spatial.OffsetX==1 and spatial.OffsetZ==0,'four turns must restore rotation and offset settings')
for index,original in ipairs({first49,second49}) do
 local current=spatial.Cells[index].CFrame
 assert(math.abs(current.Position.X-original.Position.X)<.001 and math.abs(current.Position.Y-original.Position.Y)<.001 and math.abs(current.Position.Z-original.Position.Z)<.001 and math.abs(math.sin(current.yaw-original.yaw))<.001,'four rotations must restore positions and orientations')
end
-- Centering translates the full layout on grid steps without rotating or changing height.
root.CFrame=CFrame.new(0,3,0);root.Position=root.CFrame.Position
assert(spatial:CenterPreview())
for index,original in ipairs({first49,second49}) do
 local current=spatial.Cells[index].CFrame
 local dx=(current.Position.X-original.Position.X)/3
 local dz=(current.Position.Z-original.Position.Z)/3
 assert(math.abs(dx-math.round(dx))<.001 and math.abs(dz-math.round(dz))<.001 and current.Position.Y==original.Position.Y,'centering must move only in whole horizontal block steps')
 assert(current.Position.Z<0 and math.abs(math.sin(current.yaw-original.yaw))<.001,'centering must place all cells in front while preserving their orientation')
end
local midpoint=(spatial.Cells[1].CFrame.Position.X+spatial.Cells[2].CFrame.Position.X)/2
assert(math.abs(midpoint)<=1.5,'centering must align the full footprint within half a grid step')
local anchor49=spatial.BaseAnchor*frame(spatial.OffsetX*3,spatial.OffsetY*3,-spatial.OffsetZ*3)
assert(math.abs(anchor49.Position.X-spatial.Anchor.Position.X)<.001 and math.abs(anchor49.Position.Z-spatial.Anchor.Position.Z)<.001,'centered offsets must reconstruct the visible anchor')
root.CFrame=CFrame.new(0,3,0,math.pi/2);root.Position=root.CFrame.Position
assert(spatial:CenterPreview() and spatial.Cells[1].CFrame.Position.X<0 and spatial.Cells[2].CFrame.Position.X<0,'centering must follow a different snapped character facing')
assert(spatial.Cells==cells49 and spatial.Library[1]==slot49 and spatial.MaterialUndo==undo49 and spatial.LayerIndex==1 and writes47==writes49 and requests==requests49,'spatial editing must preserve working data and saved slots without files or placement requests')
local frozen49=spatial.Cells[1].CFrame
spatial.WorkerToken=123
assert(not spatial:RotatePreview() and not spatial:CenterPreview() and not spatial:Move(1,0,0) and not spatial:Preview() and spatial.Cells[1].CFrame==frozen49,'active or cancelled in-flight workers must lock all spatial edits')
spatial.WorkerToken=nil
local savedCharacter49=ctx.Player.Character;ctx.Player.Character=nil
assert(not spatial:CenterPreview() and spatial.Cells[1].CFrame==frozen49,'a missing character must not move the preview')
ctx.Player.Character=savedCharacter49
assert(spatial:Move(-spatial.OffsetX,-spatial.OffsetY,-spatial.OffsetZ))
assert(spatial.OffsetX==0 and spatial.OffsetY==0 and spatial.OffsetZ==0 and math.abs(spatial.Anchor.Position.X-spatial.BaseAnchor.Position.X)<.001 and math.abs(spatial.Anchor.Position.Z-spatial.BaseAnchor.Position.Z)<.001,'Reset offset must still return to the rotated base after centering')
local undoPosition49=spatial.Cells[1].CFrame
assert(spatial:UndoMaterial() and spatial.Cells[1].Material=='grass' and spatial.Cells[1].CFrame==undoPosition49,'material Undo must still work after rotation, centering and offset reset without moving the preview')
-- Optional reach markers query only selected ghosts and restore original colors.
local markers=A.new(ctx)
local base50a,base50b,base50c={},{},{}
markers.Cells={
 {CFrame={Position=1},LayerY=0,Material='grass',Preview={},PreviewColor=base50a},
 {CFrame={Position=2},LayerY=0,Material='grass',Preview={},PreviewColor=base50b},
 {CFrame={Position=3},LayerY=3,Material='stone',Preview={},PreviewColor=base50c}}
markers.BlockSize=3
root.Position=setmetatable({},{__sub=function(_,position) return {Magnitude=position==1 and 5 or 40} end})
assert(not markers.RangeMarkers,'reach marking must be OFF by default')
assert(markers:CycleLayer())
local req50,writes50=requests,writes47
markers.Buttons.Reach.Activated:Fire()
assert(markers.RangeMarkers and markers.ReachCounts.InRange==1 and markers.ReachCounts.OutOfRange==1 and markers.ReachCounts.Unknown==0,'reach markers must distinguish selected cells at normal reach')
assert(markers.Cells[1].ReachState=='in' and markers.Cells[2].ReachState=='out' and not markers.Cells[3].ReachState and markers.Cells[3].Preview.Transparency==.94,'unselected layers must remain faint without misleading out-of-range markers')
root.Position=setmetatable({},{__sub=function() return {Magnitude=0} end})
markers:RefreshReach()
assert(markers.ReachCounts.InRange==2 and markers.ReachCounts.OutOfRange==0 and markers.Cells[2].Preview.Color==base50b,'refresh must follow character movement and restore in-range colors')
local char50=ctx.Player.Character;ctx.Player.Character=nil
markers:RefreshReach()
assert(markers.ReachCounts.Unknown==2 and markers.Cells[1].ReachState=='unknown','missing characters must show unknown reach')
ctx.Player.Character=char50
local modules50=ctx.GameModule;ctx.GameModule=function() error('unavailable') end
markers:RefreshReach();assert(markers.ReachCounts.Unknown==2,'failed reach reads must stay unknown rather than imply readiness')
ctx.GameModule=modules50
markers.Buttons.Reach.Activated:Fire()
assert(not markers.RangeMarkers and not markers.ReachCounts and not markers.Cells[2].ReachState and markers.Cells[1].Preview.Color==base50a and markers.Cells[2].Preview.Color==base50b,'OFF must restore all original colors and clear marker state')
assert(requests==req50 and writes47==writes50 and not markers.Running,'marker refresh must never place, write files or start a worker')
-- Setup markers reuse bounded snapshots and leave source blocks/requests alone.
;(function()
 local module,count,alive,character,clock=ctx.GameModule,ctx.ItemCount,ctx.Alive,ctx.Player.Character,ticks
 local value=A.new(ctx);value.BlockSize=3
 local sourceColors={}
 value.Cells={}
 for index=1,7 do sourceColors[index]={};value.Cells[index]={CFrame={Position=index},LayerY=index==7 and 3 or 0,Material='grass',Preview={},PreviewColor=sourceColors[index]} end
 value.LayerIndex=1
 local scans=0
 ctx.GameModule=function(_,name)
  if name=='CLIENT_REACH' then return 20 end
  if name=='BlockUtils' then return {getBlocksFromLocation=function(pos) scans+=1;return pos==1 and {true} or {} end} end
 end
 ctx.ItemCount=function() return 100 end
 root.Position=setmetatable({},{__sub=function(_,pos) return {Magnitude=pos==4 and 50 or 1} end})
 value.Failures[value.Cells[2]]={CFrame=value.Cells[2].CFrame,Material='grass',Reason='DENIED',Retryable=true}
 value.Failures[value.Cells[3]]={CFrame=value.Cells[3].CFrame,Material='grass',Reason='uncertain',Retryable=false}
 local requestsBefore=requests
 assert(not value.SetupMarkers and value:SetSetupMarkers(true))
 assert(value.Cells[1].SetupState=='Occupied' and value.Cells[1].Preview.Color==value.MarkerColors.Occupied)
 assert(value.Cells[2].SetupState=='Rejected' and value.Cells[2].Preview.Color==value.MarkerColors.Rejected)
 assert(value.Cells[3].SetupState=='Review' and value.Cells[3].Preview.Color==value.MarkerColors.Review)
 assert(value.Cells[4].SetupState=='Out' and value.Cells[5].SetupState=='Clear' and value.Cells[5].Preview.Color==sourceColors[5])
 assert(not value.Cells[7].SetupState and value.Cells[7].Preview.Color==sourceColors[7],'excluded layer cannot inherit a diagnostic color')
 assert(string.find(value.SetupReport,'MARKERS · purple:',1,true) and requests==requestsBefore and not value.WorkerToken,'marker enabling must only run the read-only setup check')
 local scanCount=scans
 for _=1,20 do value:RefreshPreviewColors() end
 assert(scans==scanCount,'repainting must never rescan occupancy')
 assert(value:SelectCell(2) and value.Cells[2].Preview.Transparency==.25 and value.Cells[2].SetupState=='Rejected','picking must preserve diagnosis color and selection emphasis')
 value.VisualSnapshot.States[value.Cells[6]]=nil;value:RefreshPreviewColors()
 assert(value.Cells[6].SetupState=='Unknown','missing per-cell observations cannot claim an empty buildable cell')
 value.Buttons.Reach.Activated:Fire();assert(value.RangeMarkers and value.Cells[2].SetupState=='Rejected' and value.Cells[1].SetupState=='Occupied','live reach must not overwrite occupied/rejection colors')
 value.Buttons.Reach.Activated:Fire();assert(value.SetupMarkers and value.Cells[1].SetupState=='Occupied','reach OFF must preserve setup diagnostics')
 ticks+=31;scanCount=scans;value:RefreshPreviewColors()
 assert(value.VisualCounts.Stale and value.Cells[1].SetupState=='Unknown' and value.Cells[5].SetupState=='Unknown' and scans==scanCount,'expired occupancy must turn unknown without a background scan')
 value:CheckSetup();assert(not value.VisualCounts.Stale and value.Cells[1].SetupState=='Occupied')
 ctx.Player.Character={FindFirstChild=function() return root end};value:RefreshPreviewColors()
 assert(value.Cells[1].SetupState=='Unknown','respawn must invalidate an old occupancy observation')
 ctx.Player.Character=character
 assert(value:CycleLayer() and value.Cells[7].SetupState=='Unknown' and not value.Cells[2].SetupState and value.Cells[2].Preview.Transparency==.94,'changing layer must require a new setup snapshot and fade the excluded layer')
 value:CheckSetup();assert(value.Cells[7].SetupState=='Clear')
 value:UpdateMaterials(value:SelectedCells());assert(not value.VisualSnapshot and value.Cells[7].SetupState=='Unknown','plan edits cannot reuse old occupancy colors')
 value.WorkerToken=84;scanCount=scans
 assert(not value:SetSetupMarkers(true) and scans==scanCount,'finishing placement work must block another setup scan')
 assert(value:SetSetupMarkers(false) and value.Cells[7].Preview.Color==sourceColors[7] and not value.Cells[7].SetupState,'OFF must restore material colors even during cleanup')
 value.WorkerToken=nil
 ctx.GameModule=function() error('world metadata unavailable') end
 assert(value:SetSetupMarkers(true) and value.Cells[7].SetupState=='Unknown','failed setup reads cannot leave stale colors')
 ctx.Alive=function() return false end;local before=value.Cells[7].Preview.Color
 value:RefreshPreviewColors();assert(value.Cells[7].Preview.Color==before,'destroyed hub cannot update marker colors')
 ctx.GameModule,ctx.ItemCount,ctx.Alive,ctx.Player.Character,ticks=module,count,alive,character,clock
 assert(requests==requestsBefore,'setup diagnostics must never place or remove a source block')
 end)()
-- Panel toggles change only presentation and have stable, bounded layout height.
local compact=A.new(ctx)
assert(compact.LayoutHeight<650 and not compact.Inputs.Width.Visible and compact.Buttons.Start.Visible and not compact.Buttons.Load.Visible and not compact.Buttons.Replace.Visible,'compact layout must expose primary actions and collapse optional sections')
local compactHeight50=compact.LayoutHeight
assert(compact:ToggleSection('Settings') and compact.Inputs.Width.Visible and compact.LayoutHeight==compactHeight50+302,'settings expansion must reveal its fields and reserve their full height')
assert(compact:ToggleSection('Library') and compact.Buttons.Load.Visible and compact.Buttons.Check.Visible,'library expansion must reveal saves and material checks')
assert(compact:ToggleSection('Materials') and compact.Inputs.ReplaceFrom.Visible,'editing expansion must reveal material fields')
for _,key in ipairs({'Library','Settings','Materials'}) do assert(compact:ToggleSection(key)) end
assert(compact.LayoutHeight==compactHeight50 and not compact:ToggleSection('missing') and not compact.Running,'collapsing must restore exact layout height without starting gameplay')
-- Favorites use bounded independent data and real field commit handlers.
do
 local originalRead,originalWrite=ctx.ReadFavorites,ctx.WriteFavorites
 local disk={Version=1,Items={'grass','stone'}};local writes=0
 ctx.ReadFavorites=function() return disk end
 ctx.WriteFavorites=function(data) disk=data;writes+=1;return true end
 local f=A.new(ctx);local previous=requests
 assert(#f.Favorites==2 and f.FavoriteButtons.Material.Text=='★ Saved','valid file favorites must load at startup')
 f.Buttons.UseFavoriteMaterial.Activated:Fire()
 assert(f.Inputs.Material.Text=='stone' and not f.Cells,'favorite selection must commit the chosen name and invalidate the old preview')
 f.Running=true;f.Inputs.Material.Text='grass';f.Inputs.Material.FocusLost:Fire()
 assert(f.Inputs.Material.Text=='stone','programmatic favorite selection must update the guarded field value')
 assert(not f:UseFavorite('Material'));f.Running=false
 f.WorkerToken=8;assert(not f:UseFavorite('Path'));f.WorkerToken=nil
 f.SavedPlan=valid();assert(not f:UseFavorite('Material'));f.SavedPlan=nil
 f.Buttons.FavoriteMaterial.Activated:Fire()
 assert(#f.Favorites==1 and f.Favorites[1]=='grass' and writes==1 and #disk.Items==1,'star must toggle and save a favorite without changing the plan')
 disk.Items[1]='soil';assert(f.Favorites[1]=='grass','file snapshots must not alias live favorites')
 disk={Version=1,Items={'grass','grass'}}
 assert(not f:LoadFavorites() and f.Favorites[1]=='grass','invalid file data must preserve session favorites')
 ctx.WriteFavorites=function() error('disk failed') end
 f.Inputs.Material.Text='stone';assert(f:ToggleFavorite('Material') and #f.Favorites==2 and string.find(f.Status.Text,'Session only',1,true),'failed writes must retain session favorites')
 f.Favorites={'1','2','3','4','5','6','7','8'};f.Inputs.Material.Text='ninth'
 assert(not f:ToggleFavorite('Material') and #f.Favorites==8,'favorite capacity must be enforced')
 assert(not f:ToggleFavorite('missing') and not f:UseFavorite('missing') and requests==previous,'preferences must never send placements')
 ctx.ReadFavorites,ctx.WriteFavorites=originalRead,originalWrite
end
-- Repeating is an explicit local geometry edit with staged preview/Undo.
;(function()
 local oldWrite,oldPlace,oldAlive=ctx.WriteBlueprint,ctx.Place,ctx.Alive
 local written,dispatches=nil,0
 ctx.WriteBlueprint=function(_,data) written=A.Validate(data);return true end
 ctx.Place=function(body) dispatches+=1;occupied[body.cframe.Position]=true;return true end
 local function fresh()
  local e=A.new(ctx);e.Anchor=frame(12,3,30,math.pi/2);e.BaseAnchor=e.Anchor;e.BlockSize=3;e.Rotation=90
  e.Cells={{CFrame=e.Anchor*frame(0,0,-3),LayerY=0,Material='grass',Preview=control()},
   {CFrame=e.Anchor*frame(3,3,-3),LayerY=3,Material='stone',Preview=control()}}
  return e
 end
 local e=fresh();local anchor=e.Anchor;local oldCells=e.Cells
 e.LayerIndex=1;e.SelectedCell=e.Cells[1];e.Picking=true;e.SetupReport='stale';e.BuildReport='stale';e.Failures[e.Cells[1]]={}
 assert(e:RepeatLayout('Right',2,1) and #e.Cells==4 and #e.SavedPlan.Cells==4 and e.Anchor==anchor and e.BaseAnchor==anchor and e.Rotation==90,'repeating must preserve the anchor and orientation while expanding every layer')
 assert(oldCells[1].Preview.Destroyed and oldCells[2].Preview.Destroyed and e.PreviewFolder.Parent==ctx.Workspace and not e.LayerIndex and not e.SelectedCell and not e.Picking,'old ghosts/selections must be replaced as one complete preview')
 assert(e.PlanDirty and #e.UndoStack==1 and not e.SetupReport and not e.BuildReport and next(e.Failures)==nil and dispatches==0 and not written,'repeat must invalidate old observations and remain unsaved/unbuilt')
 local points={}
 for _,cell in ipairs(e.Cells) do local p=cell.CFrame.Position;points[math.round(p.Z)]=p end
 assert(points[30] and points[27] and points[21] and points[18] and math.abs(points[21].X-9)<.001,'copy direction must follow the rotated local axes')
 assert(e:Move(1,0,1) and e:RotatePreview());anchor=e.Anchor
 assert(e:UndoMaterial() and #e.Cells==2 and not e.PlanDirty and e.Anchor==anchor,'Undo must restore the original layout at the current moved/rotated anchor')
 assert(e:RedoEdit() and #e.Cells==4 and e.PlanDirty and e.Anchor==anchor,'Redo must restore the repeated geometry without moving its anchor')
 assert(e:ReplaceMaterial('grass','stone') and e:UndoMaterial() and e:UndoMaterial() and #e.Cells==2 and e:RedoEdit() and e:RedoEdit(),'material edits must compose correctly with repeat Undo/Redo')
 for _,cell in ipairs(e.Cells) do assert(cell.Material=='stone') end
 assert(e:SavePreview() and written and #written.Cells==4 and #e.UndoStack==0,'only explicit Save preview must persist the repeated layout')
 written=nil;e=fresh();local cells=e.Cells
 assert(not e:RepeatLayout('Sideways') and not e:RepeatLayout('Right',false,0) and not e:RepeatLayout('Right',2,-1) and e.Cells==cells and #e.UndoStack==0,'bad repeat options must leave data and history intact')
 e.WorkerToken=99
 assert(not e:RepeatLayout('Right') and not e:CycleRepeatOption('Copies') and e.RepeatCopies==2 and e.Cells==cells,'in-flight cleanup must lock repeat options and edits')
 e.WorkerToken=nil;e.Running=true;assert(not e:RepeatLayout('Right'));e.Running=false
 local factory=Instance.new;local staged
 Instance.new=function(kind) if kind=='Part' then error('preview factory failed') end;staged=factory(kind);return staged end
 assert(not e:RepeatLayout('Right') and e.Cells==cells and not cells[1].Preview.Destroyed and not e.SavedPlan and #e.UndoStack==0 and staged.Destroyed,'failed preview staging must leave the old layout/history intact and clean up temporary ghosts')
 Instance.new=factory
 e:ClearPreview();e.SavedPlan=valid();local library=A.Validate(e.SavedPlan);e.Library[1]=library
 assert(e:RepeatLayout('Forward',2,0) and not e.Cells and #e.SavedPlan.Cells==2 and e.Library[1]==library and #library.Cells==1,'loaded layouts can repeat as data without preview creation or saved-slot changes')
 assert(e:UndoMaterial() and #e.SavedPlan.Cells==1 and not e.Cells and e:RedoEdit() and #e.SavedPlan.Cells==2,'data-only repetition must support Undo/Redo without creating ghosts')
 ctx.Alive=function() return false end
 assert(not e:RepeatLayout('Right') and #e.SavedPlan.Cells==2,'destroyed hubs cannot edit layouts');ctx.Alive=oldAlive
 e=fresh();assert(e:RepeatLayout('Right',2,0));occupied={};root.Position=setmetatable({},{__sub=function() return {Magnitude=0} end})
 assert(e:Start() and not e.Buttons.RepeatRight.Active and not e.Buttons.RepeatCopies.Active,'running workers must visibly disable repeat editing');while coroutine.status(worker)~='dead' do step() end
 assert(e.Buttons.RepeatRight.Active and e.Buttons.RepeatCopies.Active,'completed workers must restore repeat controls')
 assert(dispatches==4 and e.Progress.Placed==4,'only explicit Start must send and confirm every repeated cell through the existing worker')
 ctx.WriteBlueprint,ctx.Place,ctx.Alive=oldWrite,oldPlace,oldAlive;occupied={}
 end)()
-- Selected-layer floors use the same reversible edit path, and capture waits for cleanup.
;(function()
 local oldIsland,oldWrite,oldAlive=ctx.IslandBlocks,ctx.WriteBlueprint,ctx.Alive
 local queries,writes=0,0
 ctx.IslandBlocks=function() queries+=1;return nil end
 ctx.WriteBlueprint=function() writes+=1;return true end
 local e=A.new(ctx);e.Anchor=frame(12,6,30,math.pi/2);e.BaseAnchor=e.Anchor;e.BlockSize=3
 e.Cells={{CFrame=e.Anchor*frame(0,0,-3),LayerY=0,Material='grass',Preview=control()},
  {CFrame=e.Anchor*frame(0,3,-3),LayerY=3,Material='stone',Preview=control()}}
 assert(e.RepeatScope=='Entire layout','v88 whole-layout behavior must remain the default')
 e:CycleRepeatOption('Scope');local original=e.Cells
 assert(e.RepeatScope=='Selected layer' and not e:RepeatLayout('Up') and e.Cells==original and #e.UndoStack==0,'selected scope must require an explicit preview layer')
 e.LayerIndex=1
 assert(not e:RepeatLayout('Up') and e.Cells==original and #e.UndoStack==0 and not original[1].Preview.Destroyed,'an overlapping floor must preserve geometry, preview and history')
 e.LayerIndex=2;local before=requests
 assert(e:RepeatLayout('Up') and #e.Cells==3 and not e.LayerIndex and e.RepeatScope=='Selected layer' and requests==before and writes==0,'selected Up must append one floor, clear layer selection and remain local/unsaved')
 assert(e.Cells[1].Material=='grass' and e.Cells[2].Material=='stone' and e.Cells[3].Material=='stone' and e.Cells[3].LayerY==6 and e.Cells[3].CFrame.Position.Y==12,'the original lower layer and top-floor material/height must survive repetition')
 assert(not e:RepeatLayout('Up') and #e.Cells==3,'a second selected-layer repeat must require choosing a layer again')
 assert(e:Move(1,0,0) and e:RotatePreview());local anchor=e.Anchor
 assert(e:UndoMaterial() and #e.Cells==2 and e.Anchor==anchor and e:RedoEdit() and #e.Cells==3 and e.Anchor==anchor,'new floor edits must Undo/Redo at the moved/rotated anchor')
 e.WorkerToken=90;e:RefreshFailureUI();local scope=e.RepeatScope
 for _,key in ipairs({'RepeatScope','RepeatUp'}) do assert(not e.Buttons[key].Active) end
 assert(not e:RepeatLayout('Up') and not e:CycleRepeatOption('Scope') and e.RepeatScope==scope,'in-flight cleanup must lock new floor controls')
 local range=e.CaptureRange
 e.Buttons.CaptureRange.Activated:Fire();e.Buttons.Capture.Activated:Fire()
 assert(not e:CaptureIsland() and e.CaptureRange==range and queries==0 and writes==0,'stopped builds with an owned worker must not scan/save an island or change capture range')
 e.WorkerToken=nil;e.Running=true;assert(not e:CaptureIsland() and queries==0);e.Running=false
 ctx.Alive=function() return false end;assert(not e:CaptureIsland() and queries==0);ctx.Alive=oldAlive
 assert(not e:CaptureIsland() and queries==1,'after cleanup an ordinary capture may query the island again')
 e:ClearPreview();e:CycleRepeatOption('Scope');assert(e.RepeatScope=='Entire layout' and e:RepeatLayout('Up') and not e.Cells,'whole-layout Up must also work on data-only layouts')
 ctx.IslandBlocks,ctx.WriteBlueprint,ctx.Alive=oldIsland,oldWrite,oldAlive
 end)()
-- Removing blueprint cells is local, reversible and reflected in saves/queues.
do
 local e=A.new(ctx);local savedWrites=writes47;local previous=requests
 e.Anchor=frame(12,6,9);e.BaseAnchor=e.Anchor;e.BlockSize=3
 e.Cells={
  {CFrame=e.Anchor*frame(0,0,-3),LayerY=0,Material='grass',Preview=control()},
  {CFrame=e.Anchor*frame(3,0,-3),LayerY=0,Material='stone',Preview=control()},
  {CFrame=e.Anchor*frame(0,3,-3),LayerY=3,Material='grass',Preview=control()}}
 local removedGhost=e.Cells[1].Preview;local surviving=e.Cells[2].CFrame
 e.BuildReport='Old check'
 assert(e:RemoveBlocks(' grass ',false) and #e.Cells==1 and #e.SavedPlan.Cells==1,'generated previews must support named block removal')
 assert(removedGhost.Destroyed and e.Cells[1].CFrame==surviving and e.PlanDirty and not e.BuildReport and not e.LayerIndex,'removal must destroy only excluded ghosts, preserve remaining positions and clear stale checks/layers')
 assert(writes47==savedWrites and requests==previous and not e.Library[1],'editing must not save or place implicitly')
 assert(not e:RemoveBlocks('stone',false) and #e.Cells==1,'removal must retain at least one block')
 assert(e:Move(1,0,0) and e:RotatePreview(),'removal Undo must survive spatial edits')
 local anchor=e.Anchor
 assert(e:UndoMaterial() and #e.Cells==3 and not e.PlanDirty,'Undo must restore removed cells and previous dirty state')
 for _,cell in ipairs(e.Cells) do
  local cf=anchor:ToObjectSpace(cell.CFrame)
  assert(math.abs(cf.Position.Z+3)<.001 and (math.abs(cf.Position.Y)<.001 or math.abs(cf.Position.Y-3)<.001),'restored blocks must follow the current translated/rotated anchor')
 end
 assert(not e:RemoveBlocks(nil,true),'All layers must never imply whole-plan deletion')
 assert(e:CycleLayer() and e:RemoveBlocks(nil,true) and #e.Cells==1 and e.Cells[1].LayerY==3,'layer removal must remove only the selected height')
 assert(not e.LayerIndex and e:UndoMaterial() and #e.Cells==3,'layer removal Undo must restore all layers')
 e.WorkerToken=77
 assert(not e:RemoveBlocks('grass',false) and not e:ReplaceMaterial('grass','stone') and not e:UndoMaterial(),'worker ownership must lock all block edits')
 e.WorkerToken=nil
 assert(e:RemoveBlocks('grass',false) and e:SavePreview() and #disk[1].Cells==1 and not e.MaterialUndo,'saving must commit exactly the surviving cells and clear Undo')
 local slot=e.Library[1]
 assert(e:ReplaceMaterial('stone','grass') and e.Library[1]==slot and slot.Cells[1].Material=='stone','replacement after removal must preserve saved snapshots')
 e:ClearPreview();assert(e:UndoMaterial() and e.SavedPlan.Cells[1].Material=='stone' and not e.Cells,'Undo after clearing must restore data without creating a preview')
 local plain=A.new(ctx);plain.Anchor=frame(0,0,0);plain.BlockSize=3
 plain.Cells={{CFrame=frame(0,0,-3),LayerY=0,Material='grass',Preview=control()},{CFrame=frame(0,0,-6),LayerY=0,Material='stone',Preview=control()}}
 assert(plain:ReplaceMaterial('grass','stone') and plain:UndoMaterial() and plain.Cells[1].Material=='grass' and plain.Cells[2].Material=='stone','generated preview replacement Undo must retain cell/material correspondence even when validation sorts cells differently')
 -- Only surviving cells can enter the placement worker.
 assert(plain:RemoveBlocks('grass',false))
 local oldPlace=ctx.Place
 ctx.Place=function(body) requests+=1;occupied[body.cframe.Position]=true;assert(body.blockType=='stone');return true end
 occupied={};root.Position=setmetatable({},{__sub=function() return {Magnitude=0} end})
 previous=requests;plain:Start();while coroutine.status(worker)~='dead' do step() end
 assert(requests==previous+1 and plain.Progress.Total==1 and plain.Progress.Placed==1,'removed cells must not be sent by Start')
 ctx.Place=oldPlace
end
-- Build history records observed outcomes only and remains independent of live progress.
do
 local h=A.new(ctx);local oldPlace,oldCopy=ctx.Place,ctx.CopyReport
 local copied
 ctx.CopyReport=function(report) copied=report end
 assert(not h:ShowHistory() and #h.History==0)
 h.Cells=cells(2);h.BlockSize=3;occupied={}
 ctx.Place=function(body) requests+=1;occupied[body.cframe.Position]=true;return true end
 h:Start();while coroutine.status(worker)~='dead' do step() end
 local result=h.History[1]
 assert(result.State=='Finished' and result.Placed==2 and result.Skipped==0 and result.Total==2 and result.Elapsed>0,'finished history must capture confirmed counts and elapsed time')
 h.Progress.Placed=99;h:Stop()
 assert(result.Placed==2 and result.State=='Finished','history must not alias mutable progress or later Stop calls')
 h.Buttons.CopyHistory.Activated:Fire()
 assert(copied and string.find(copied,'2 confirmed',1,true) and not h.Running,'copy result must select the latest snapshot without starting work')
 ctx.Place=function(body) requests+=1;coroutine.yield();occupied[body.cframe.Position]=true;return true end
 h.Cells=cells(2);occupied={};h:Start();h:Stop()
 assert(#h.History==1 and not h:Start(),'in-flight cancellation must not publish a result before cleanup or overlap workers')
 step()
 assert(#h.History==2 and h.History[1].State=='Stopped' and h.History[1].Placed==0,'late placement returns after Stop must remain unconfirmed in history')
 ctx.Place=function() requests+=1;return true end
 h.Cells=cells(4);occupied={};h:Start();while coroutine.status(worker)~='dead' do step() end
 assert(h.History[1].State=='Paused after failures' and h.History[1].Failed==3 and h.History[1].Placed==0,'accepted but unobserved placements must be failures in history')
 ctx.Place=function() error('placement failed') end
 h.Cells=cells(1);occupied={};h:Start()
 assert(h.History[1].State=='Error' and h.History[1].Placed==0,'worker errors must record their outcome and release ownership')
 ctx.Place=function(body) requests+=1;occupied[body.cframe.Position]=true;return true end
 for i=1,6 do
  occupied={};h.Preset='Run '..i;h.Cells=cells(1);h:Start();while coroutine.status(worker)~='dead' do step() end
 end
 assert(#h.History==5 and h.History[1].Name=='Run 6' and h.History[5].Name=='Run 2' and not h.HistoryReport,'history must retain only the latest five snapshots and invalidate stale selection')
 for i=1,5 do h.Buttons.History.Activated:Fire() end
 assert(h.HistoryIndex==5 and string.find(h.HistoryReport,'Run 2',1,true))
 h.Buttons.History.Activated:Fire();assert(h.HistoryIndex==1,'history browsing must wrap newest first')
 assert(h:ToggleSection('History') and h.Buttons.History.Visible and h:ToggleSection('History') and not h.Buttons.History.Visible and h.LayoutHeight<650,'history must use its own collapsed section and preserve compact defaults')
 ctx.Place,ctx.CopyReport=oldPlace,oldCopy
end
-- Individual picking resolves the nearest visible-layer ghost without world queries.
do
 local e=A.new(ctx);local previous=requests;local writes=writes47
 e.Anchor=CFrame.new(12,6,9,.37);e.BaseAnchor=e.Anchor;e.BlockSize=3
 e.Cells={
  {CFrame=e.Anchor*frame(0,0,-3),LayerY=0,Material='grass',Preview=control()},
  {CFrame=e.Anchor*frame(0,0,-6),LayerY=0,Material='grass',Preview=control()},
  {CFrame=e.Anchor*frame(0,3,-3),LayerY=3,Material='grass',Preview=control()}}
 local origin=vector(12,6,9);local direction=vector(-math.sin(.37),0,-math.cos(.37))
 assert(not e.Picking and not e:PickRay(origin,direction),'picking must start OFF')
 assert(not e:SelectCell(0) and not e:SelectCell(999) and not e:SelectCell(false),'invalid selections must be harmless')
 assert(e:SetPicking(true) and e:PickRay(origin,direction) and e.SelectedCell==e.Cells[1],'ray picking must select the nearest rotated ghost')
 assert(e.Cells[1].Preview.Transparency==.25 and e.Cells[2].Preview.Transparency==.65,'selected ghosts must be highlighted without fading other included cells')
 assert(not e:PickRay(origin,direction,1) and not e.SelectedCell,'a world obstruction before the ghost must prevent selection')
 assert(not A.RayBox(CFrame.new(0,0,0),vector(3,0,0),vector(0,0,-1),1),'parallel rays outside the box must miss')
 assert(not A.RayBox(CFrame.new(0,0,0),vector(0,0,5),vector(0,0,0),1),'zero-length rays must not select')
 assert(not A.RayBox(CFrame.new(0,0,0),vector(0,0,5),vector(0/0,0,-1),1),'nonfinite rays must be ignored')
 assert(not A.RayBox(CFrame.new(0,0,0),vector(0,0,5),vector(0,0,1),1),'boxes behind the camera must not be selected')
 assert(e:CycleLayer() and not e:SelectCell(3),'excluded layers must not be selectable')
 e.Buttons.NextBlock.Activated:Fire();assert(e.SelectedCell==e.Cells[1])
 e.Buttons.NextBlock.Activated:Fire();assert(e.SelectedCell==e.Cells[2])
 assert(e:CycleLayer() and not e.SelectedCell and not e:PickRay(origin,direction),'layer changes must clear an excluded selection and ray picking must respect the filter')
 assert(e:CycleLayer() and e:PickRay(origin,direction))
 local chosen=e.SelectedCell;local position=chosen.CFrame
 assert(e:ReplaceSelected('stone') and chosen.Material=='stone' and e.Cells[2].Material=='grass','selected replacement must affect exactly one same-material cell')
 assert(e:Move(1,0,0) and e:RotatePreview() and e.SelectedCell==chosen,'selection must follow in-place transforms')
 local anchor=e.Anchor
 assert(e:RemoveSelected() and #e.Cells==2 and not e.SelectedCell and #e.UndoStack==2,'selected removal must remove exactly one cell and record a second edit')
 assert(e:UndoMaterial() and #e.Cells==3 and #e.RedoStack==1,'Undo must restore the removed selected block')
 assert(e:UndoMaterial() and #e.UndoStack==0 and #e.RedoStack==2 and not e.PlanDirty,'a second Undo must restore the earlier material edit and clean state')
 for _,cell in ipairs(e.Cells) do
  assert(cell.Material=='grass')
  local p=anchor:ToObjectSpace(cell.CFrame).Position
  assert(math.abs(p.X)<.001 and (math.abs(p.Z+3)<.001 or math.abs(p.Z+6)<.001),'Undo must follow the current moved/rotated anchor')
 end
 assert(e:RedoEdit() and #e.RedoStack==1 and e.PlanDirty,'Redo must restore the selected material edit')
 assert(e:RedoEdit() and #e.Cells==2 and #e.UndoStack==2 and #e.RedoStack==0,'second Redo must remove the same cell again')
 assert(e:UndoMaterial() and #e.RedoStack==1)
 local depth=#e.UndoStack
 assert(not e:ReplaceMaterial('grass','unknown') and #e.RedoStack==1 and #e.UndoStack==depth,'invalid edits must retain both histories')
 assert(e:ReplaceMaterial('grass','stone') and #e.RedoStack==0 and not e:RedoEdit(),'a new valid edit after Undo must discard the abandoned Redo path')
 e.WorkerToken=1
 assert(not e:SelectCell(1) and not e:UndoMaterial() and not e:RedoEdit() and not e:RemoveSelected() and not e:PickRay(origin,direction),'in-flight ownership must lock selection and edit history')
 e.WorkerToken=nil
 e:ClearPreview();assert(not e.Picking and not e.SelectedCell and e:UndoMaterial() and not e.Cells,'Undo after Clear must restore data without rebuilding ghosts')
 assert(e:RedoEdit() and not e.Cells,'Redo after Clear must also remain data-only')
 assert(requests==previous and writes47==writes,'selection and Undo/Redo must never place blocks or write saved slots')
end
-- Edit history is bounded, reversible and cleared by explicit save/load/preset changes.
do
 local e=A.new(ctx);e.Anchor=frame(0,0,0);e.BaseAnchor=e.Anchor;e.BlockSize=3
 e.Cells={{CFrame=frame(0,0,-3),LayerY=0,Material='grass',Preview=control()},{CFrame=frame(0,0,-6),LayerY=0,Material='grass',Preview=control()}}
 for i=1,25 do assert(e:ReplaceMaterial(i%2==1 and 'grass' or 'stone',i%2==1 and 'stone' or 'grass')) end
 assert(#e.UndoStack==20 and #e.RedoStack==0,'only the newest 20 edit steps may be retained')
 for i=1,20 do assert(e:UndoMaterial()) end
 assert(not e:UndoMaterial() and #e.RedoStack==20 and e.PlanDirty,'evicting older edits must not imply the original clean state was reached')
 for i=1,20 do assert(e:RedoEdit()) end
 assert(not e:RedoEdit() and #e.UndoStack==20 and e.Cells[1].Material=='stone')
 e:SetPicking(true);e:CloseMenus();assert(not e.Picking,'tab/menu cleanup must disable picking')
 assert(e:SavePreview() and #e.UndoStack==0 and #e.RedoStack==0 and not e.MaterialUndo,'saving must clear both edit histories')
 assert(e:ReplaceMaterial('stone','grass') and e:LoadBlueprint() and #e.UndoStack==0 and #e.RedoStack==0,'loading a saved blueprint must clear edit history')
end
-- Saved-slot overwrites retain an independent previous version; restoring swaps versions.
do
 local c=table.clone(ctx);c.Parent={}
 local files,backups={},{}
 local writes={}
 local failBackup=false
 c.ReadBlueprint=function(slot) return files[slot] end
 c.ReadBlueprintBackup=function(slot) return backups[slot] end
 c.WriteBlueprint=function(slot,data,previous)
  if previous then
   if failBackup then error('backup failed') end
   backups[slot]=A.Validate(previous);table.insert(writes,'backup')
  end
  files[slot]=A.Validate(data);table.insert(writes,'main');return true
 end
 local first=valid();first.Name='First';files[1]=A.Validate(first)
 local b=A.new(c);local second=valid();second.Name='Second'
 assert(b:StoreBlueprint(second) and b.Backups[1].Name=='First' and files[1].Name=='Second','an uncached valid disk slot must be backed up before overwrite')
 assert(writes[1]=='backup' and writes[2]=='main' and b.BackupPersistence[1]=='File + session')
 assert(b:StoreBlueprint(second) and b.Backups[1].Name=='First','identical repeated saves must preserve the useful prior version')
 second.Cells[1].Material='mutated';assert(b.Library[1].Cells[1].Material~='mutated' and b.Backups[1].Name=='First','new saves and backups must be independent copies')
 local working,cells=b.SavedPlan,b.Cells
 assert(b:RestoreBackup() and files[1].Name=='First' and b.Backups[1].Name=='Second' and b.SavedPlan==working and b.Cells==cells,'restore must change only the saved slot and retain the version it replaced')
 assert(b:RestoreBackup() and files[1].Name=='Second' and b.Backups[1].Name=='First','restoring again must recover the replaced version')
 local fresh=A.new(c);assert(fresh:InspectBackup(1) and fresh.Backups[1].Name=='First','a new controller must read validated backup files')
 failBackup=true;local third=valid();third.Name='Third'
 assert(fresh:StoreBlueprint(third) and fresh.Library[1].Name=='Third' and files[1].Name=='Second' and fresh.Backups[1].Name=='Second' and fresh.Persistence[1]=='Session only','backup write failure must preserve the old primary file and retain the new session layout')
 failBackup=false
 assert(fresh:StoreBlueprint(third) and files[1].Name=='Third' and backups[1].Name=='Second','retrying an unchanged session save must first persist its retained backup')
 local corrupt=A.new(c);backups[2]={Version=99}
 corrupt.Slot=2;assert(not corrupt:RestoreBackup() and not files[2],'invalid backup files must not change a saved slot')
 b.WorkerToken=5
 assert(not b:StoreBlueprint(valid()) and not b:RestoreBackup() and not b:LoadBlueprint(),'in-flight build ownership must lock slot overwrite, restore and load')
end
-- Import validates first and edits only working data; export includes the complete canonical layout.
do
 local c=table.clone(ctx);c.Parent={};c.ReadBlueprint=nil;c.WriteBlueprint=nil
 local decoded,encoded,copied
 c.DecodeBlueprint=function(text) if text=='bad' then error('invalid JSON') end;return decoded end
 c.EncodeBlueprint=function(data) encoded=A.Validate(data);return 'canonical-json' end
 c.CopyBlueprint=function(text) copied=text;return true end
 local b=A.new(c);assert(b:StoreBlueprint(valid()))
 local slot=b.Library[1];local oldCells={{CFrame=frame(0,0,0),LayerY=0,Material='grass',Preview=control()}}
 b.Cells=oldCells;b.Anchor=frame(0,0,0);b.BlockSize=3;b.LayerIndex=1;b.BuildReport='old check'
 decoded={Version=99};assert(not b:ImportBlueprint('invalid') and b.Cells==oldCells and b.BuildReport=='old check' and b.Library[1]==slot,'invalid imports must preserve preview, checks and slots')
 assert(not b:ImportBlueprint('bad') and not b:ImportBlueprint('') and not b:ImportBlueprint(string.rep('x',1000001)))
 decoded=valid();decoded.Name='Shared house'
 assert(b:ImportBlueprint('valid') and not b.Cells and b.PlanDirty and b.SavedPlan.Name=='Shared house' and b.Library[1]==slot and not b.Running and not b.LayerIndex,'import must create an unsaved working copy without saving or building')
 decoded.Cells[1].Material='changed';assert(b.SavedPlan.Cells[1].Material~='changed','import must not retain references to decoder data')
 assert(b:ExportBlueprint(false)=='canonical-json' and copied=='canonical-json' and b.Inputs.Transfer.Text=='canonical-json' and encoded.Name=='Shared house','working export must serialize canonical layout and populate the transfer field')
 assert(b:ExportBlueprint(true)=='canonical-json' and encoded.Name==slot.Name,'saved-slot export must use the stored layout rather than unsaved working edits')
 local base=b.SavedPlan.Cells[1]
 table.insert(b.SavedPlan.Cells,{Material='stone',Components={3,3,0,1,0,0,0,1,0,0,0,1}})
 b.Cells={{CFrame=frame(0,0,0),LayerY=0,Material=base.Material,Preview=control()},{CFrame=frame(3,3,0),LayerY=3,Material='stone',Preview=control()}}
 b.Anchor=frame(0,0,0);b.BlockSize=3;b.LayerIndex=1
 assert(#b:SelectedCells()==1 and b:ExportBlueprint(false) and #encoded.Cells==2,'export must include unselected blueprint layers')
 c.CopyBlueprint=function() error('clipboard unavailable') end
 assert(b:ExportBlueprint(false) and string.find(b.Status.Text,'Select and copy',1,true),'clipboard failures must retain export text for manual copy')
 b.WorkerToken=9;local plan=b.SavedPlan
 assert(not b:ImportBlueprint('valid') and not b:ExportBlueprint(false) and b.SavedPlan==plan,'active or stopped in-flight workers must lock transfer operations')
 b.WorkerToken=nil
 c.EncodeBlueprint=function() error('encoder failed') end
 assert(not b:ExportBlueprint(false) and b.Inputs.Transfer.Text=='canonical-json','encoder failures must retain the last useful export')
end
;(function()
 local function scenario(speed,latency,count,prebuilt,rateLimit)
  local clock,co,attempts,world,starts,waits=0,nil,0,{},{},{}
  for i=1,(prebuilt or 0) do world[i]=true end
  local fixture={Player={Character={FindFirstChild=function() return root end}},Parent={},
   Label=function(props) return control(props) end,Button=function(props) return control(props) end,Track=function() end,
   Alive=function() return true end,Workspace={},Now=function() return clock end,
   Scheduler={spawn=function(fn) co=coroutine.create(fn);local ok,e=coroutine.resume(co);assert(ok,e) end,
    wait=function(dt) table.insert(waits,dt);clock+=dt;coroutine.yield() end},
   GameModule=function(_,name) if name=='BlockUtils' then return {getBlocksFromLocation=function(pos) return world[pos] and {true} or {} end} end end,
   Place=function(body)
    attempts+=1;table.insert(starts,clock);clock+=latency
    if rateLimit and attempts==1 then return false,{success=false,error='TOO_FAST'},'rejected' end
    world[body.cframe.Position]=true;return true
   end}
  local value=A.new(fixture);value.Cells=cells(count);value.BlockSize=3
  assert(value:SetBuildSpeed(speed));value:Start()
  local guard=0
  while coroutine.status(co)~='dead' do guard+=1;assert(guard<2000);local ok,e=coroutine.resume(co);assert(ok,e) end
  return value,starts,clock,waits
 end
 local standard,normal,normalTime=scenario('Standard',0,6)
 local fast,quick,fastTime=scenario('Fast',0,6)
 assert(standard.Progress.Placed==6 and fast.Progress.Placed==6 and normalTime>fastTime*3,'Fast must reduce local delay while retaining confirmed counts')
 for i=2,#normal do assert(math.abs(normal[i]-normal[i-1]-.2)<.00001) end
 for i=2,#quick do assert(math.abs(quick[i]-quick[i-1]-.05)<.00001) end
 local slow,sent,total=scenario('Fast',.12,4)
 assert(slow.Progress.Placed==4 and total<.6,'slow server replies must count toward the interval rather than incur another full delay')
 for i=2,#sent do assert(sent[i]-sent[i-1]>=.12 and sent[i]-sent[i-1]<.15,'requests remain sequential after server replies') end
 local skipped,none,skipTime=scenario('Standard',0,100,100)
 assert(#none==0 and skipped.Progress.Skipped==100 and skipTime<1.1,'occupied layouts must skip quickly without sending placement requests')
 local cooled,retried=scenario('Fast',0,8,0,true)
 assert(cooled.Progress.Placed==8 and #retried==9 and cooled.BuildCooldowns==1,'TOO_FAST must retry the same block through existing confirmation rules')
 assert(retried[2]-retried[1]>=.5 and retried[3]-retried[2]>=.099,'the accepted retry must also respect the increased gap before the next cell')
 assert(cooled.CurrentBuildGap>.05 and cooled.CurrentBuildGap<.1,'pace should recover gradually after confirmed placements')
 local value=A.new(ctx);local saved=value.BuildSpeed
 assert(not value:SetBuildSpeed('Turbo') and value.BuildSpeed==saved)
 value.WorkerToken=99;assert(not value:SetBuildSpeed('Fast') and value.BuildSpeed==saved,'speed must lock during cleanup')
 value.WorkerToken=nil;value.Running=true;assert(not value:SetBuildSpeed('Fast'));value.Running=false
 assert(value:SetBuildSpeed('Fast') and string.find(value:DiagnosticReport(),'Build speed: Fast',1,true),'diagnostics must identify the selected speed')
end)()
;(function()
 local function fixture(count)
  local f={Stock=count,Calls=0,Clock=0,World={},Walks=0,Distance=0}
  local actor={Position=setmetatable({},{__sub=function() return {Magnitude=f.Distance} end})}
  local options={Parent={},Player={Character={FindFirstChild=function() return actor end}},Workspace={},
   Label=function(props) return control(props) end,Button=function(props) return control(props) end,Track=function() end,
   Alive=function() return true end,Now=function() return f.Clock end,
   Scheduler={spawn=function(fn) f.Worker=coroutine.create(fn);local ok,e=coroutine.resume(f.Worker);assert(ok,e) end,
    wait=function(dt) f.Clock+=dt;coroutine.yield() end},
   ItemCount=function(item) assert(item=='grass');if f.Read then return f.Read() end;return f.Stock end,
   GameModule=function(_,key)
    if key=='CLIENT_REACH' then return 20 end
    if key=='BlockUtils' then return {getBlocksFromLocation=function(pos) return f.World[pos] and {true} or {} end} end
   end,
   Place=function(body)
    f.Calls+=1
    if f.Response then return f.Response(body) end
    f.Stock=math.max(0,(f.Stock or 0)-1);f.World[body.cframe.Position]=true;return true
   end,
   Approach=function() f.Walks+=1;f.Distance=0;return true end}
  f.Value=A.new(options);f.Value.Cells=cells(2);f.Value.BlockSize=3
  function f:Step() local ok,e=coroutine.resume(self.Worker);assert(ok,e) end
  function f:Drain() local guard=0;while coroutine.status(self.Worker)~='dead' do guard+=1;assert(guard<200,'worker did not settle: '..self.Value.Progress.State..' stock '..tostring(self.Stock));self:Step() end end
  return f,options
 end
 local f=fixture(0);local b=f.Value
 local plan=b.Cells;b:Start();local owner=b.WorkerToken
 assert(f.Calls==0 and b.Running and owner and b.Progress.State=='Waiting for materials' and b.WaitingMaterial=='grass','empty stock must keep ON without dispatch')
 assert(b.Progress.Failed==0 and b.Progress.Checked==0 and b:FailureCounts().Review==0 and b.Buttons.Start.Text=='Restock · 0/2','unsent empty-stock cells are neither failed nor checked and must show restock at the top')
 for _=1,4 do f:Step() end
 assert(f.Calls==0 and b.WorkerToken==owner and #b.History==0,'waiting must keep one worker and one run')
 f.Stock=1;f:Step()
 assert(f.Calls==1 and b.Progress.Placed==1 and b.Progress.Checked==1 and b.Buttons.Start.Text=='Building · 1/2','restocking must resume and update checked progress after confirmation')
 f:Step();assert(f.Calls==1 and b.Buttons.Start.Text=='Restock · 1/2' and b.WaitingMaterial=='grass')
 f.Stock=1;f:Drain()
 assert(f.Calls==2 and b.Progress.Placed==2 and b.Progress.Checked==2 and not b.Running and not b.WaitingMaterial and #b.History==1 and b.Cells==plan,'repeated restocks must complete the original plan/run without replacing cells')
 f=fixture(0);b=f.Value;b:Start();b:Stop()
 assert(not b:Start() and f.Calls==0,'Stop keeps restart locked until the material wait exits')
 f.Stock=100;f:Drain()
 assert(f.Calls==0 and not b.WorkerToken and not b.WaitingMaterial and b.Progress.State=='Stopped','late restocking after Stop cannot send a request')
 f=fixture(0);b=f.Value;b:Start()
 for _,invalid in ipairs({false,'1',-1,.5,math.huge,0/0}) do
  f.Stock=invalid;f:Step();assert(f.Calls==0 and b.Running and b.WaitingMaterial=='grass','unreadable quantities after empty stock cannot pretend to be a restock')
 end
 f.Read=function() error('inventory unavailable') end;f:Step();assert(f.Calls==0)
 f.Read=nil;f.Stock=2;f:Drain();assert(f.Calls==2 and b.Progress.Placed==2)
 f=fixture(nil);f.Read=function() return nil end;b=f.Value;b:Start();f:Drain();assert(f.Calls==2,'initially unknown inventory must retain normal server validation')
 f=fixture(0);b=f.Value;b:Start();f.World[1]=true;f.World[2]=true;f:Drain()
 assert(f.Calls==0 and b.Progress.Skipped==2 and b.Progress.Checked==2 and not b.WaitingMaterial,'blocks supplied by the world while waiting must skip without requiring stock')
 f=fixture(0);b=f.Value;b:SetTravelMode('Walk');f.Distance=50;b:Start()
 assert(f.Walks==0 and f.Calls==0,'Auto Walk must not begin a trip while known stock is empty')
 f.Stock=2;f:Drain();assert(f.Walks==1 and f.Calls==2,'restocking must resume normal reach checks and walking')
 local options;f,options=fixture(1);b=f.Value;b.Cells=cells(1)
 f.Response=function(body)
  if f.Calls==1 then f.Stock=0;return false,{success=false,error='TOO_FAST'},'rejected' end
  f.World[body.cframe.Position]=true;return true
 end
 b:Start()
 while b.Progress.State~='Waiting for materials' do f:Step() end
 assert(f.Calls==1 and b.Running and b.BuildCooldowns==1,'cooldown retries must check stock again before resending')
 f.Stock=1;f:Drain();assert(f.Calls==2 and b.Progress.Placed==1)
 f,options=fixture(2);b=f.Value
 options.ItemCount=function() coroutine.yield();return 2 end
 b:Start();assert(f.Calls==0);b:Stop();f:Drain()
 assert(f.Calls==0 and not b.WorkerToken,'Stop during a yielding inventory lookup must cancel before dispatch')
 -- Pause retains the exact worker, plan, counters and current run.
 f=fixture(2);b=f.Value
 assert(not b:SetPaused(true),'idle builds cannot pause')
 b:Start();local owner,token=b.WorkerToken,b.Token
 assert(f.Calls==1 and b.Progress.Checked==1 and b:SetPaused(true))
 for _=1,5 do f:Step() end
 assert(f.Calls==1 and b.Running and b.Paused and b.WorkerToken==owner and b.Token==token and #b.History==0,'paused builds cannot advance to a new request or create a second run')
 assert(b.Buttons.Start.Text=='Paused · 1/2' and b.Buttons.Pause.Text=='Resume' and not b:SetBuildSpeed('Fast'),'paused UI must show Resume while editing stays locked')
 assert(b:SetPaused(false));f:Drain()
 assert(f.Calls==2 and b.Progress.Placed==2 and #b.History==1 and not b.Paused and not b.Buttons.Pause.Active,'Resume must finish the original worker and disable Pause afterward')
 f=fixture(0);b=f.Value;b:Start();b:SetPaused(true)
 local reads=0;f.Stock=2;f.Read=function() reads+=1;return f.Stock end
 for _=1,4 do f:Step() end
 assert(reads==0 and f.Calls==0 and b.WaitingMaterial=='grass','restocking while manually paused cannot restart inventory reads or placement')
 b:SetPaused(false);f:Drain();assert(f.Calls==2)
 f=fixture(2);b=f.Value;b:Start();b:SetPaused(true);b:Stop()
 assert(not b.Paused and not b:Start());f:Drain()
 assert(f.Calls==1 and not b.WorkerToken and b.History[1].State=='Stopped','Stop from Pause must discard the wait and prevent queued requests')
 -- An already dispatched request may settle, but may not launch another one.
 f=fixture(2);b=f.Value
 f.Response=function(body)
  if f.Calls==1 then coroutine.yield() end
  f.World[body.cframe.Position]=true;return true
 end
 b:Start();assert(f.Calls==1 and b.RequestPending)
 b:SetPaused(true);assert(string.find(b.Status.Text,'Pausing',1,true))
 for _=1,4 do f:Step() end
 assert(f.Calls==1 and b.Progress.Placed==1 and b.Paused and not b.RequestPending and b.Buttons.Start.Text=='Paused · 1/2','in-flight confirmation must be counted once while new requests remain paused')
 b:SetPaused(false);f:Drain();assert(f.Calls==2 and b.Progress.Placed==2)
 f=fixture(2);b=f.Value
 f.Response=function() coroutine.yield();error('transport failed') end
 b:Start();b:SetPaused(true);f:Drain()
 assert(f.Calls==1 and b.Progress.State=='Error' and not b.Paused and not b.RequestPending,'transport errors during Pause must stop normally without hidden replay')
 -- Pausing confirmation does not abandon the request or extend its deadline.
 f=fixture(2);b=f.Value
 f.Response=function(body) if f.Calls>1 then f.World[body.cframe.Position]=true end;return true end
 b:Start();assert(b.Progress.State=='Confirming block');b:SetPaused(true)
 for _=1,4 do f:Step() end
 assert(f.Calls==1 and b.Progress.Placed==0)
 f.World[1]=true;for _=1,3 do f:Step() end
 assert(b.Progress.Placed==1 and f.Calls==1)
 b:SetPaused(false);f:Drain();assert(b.Progress.Placed==2)
 f=fixture(2);b=f.Value;f.Response=function() return true end
 b:Start();b:SetPaused(true);for _=1,125 do f:Step() end
 assert(f.Calls==1 and b.Progress.Failed==1 and b.Paused and b:FailureCounts().Review==1,'confirmation timeout must remain bounded during Pause without replaying the uncertain request')
 b:Stop();f:Drain();assert(f.Calls==1)
 -- Cooldown and inventory lookup resume through fresh preflight checks.
 f=fixture(2);b=f.Value
 f.Response=function(body)
  if f.Calls==1 then return false,{success=false,error='TOO_FAST'},'rejected' end
  f.World[body.cframe.Position]=true;return true
 end
 b:Start();b:SetPaused(true);for _=1,5 do f:Step() end
 assert(f.Calls==1 and b.BuildCooldowns==1)
 b:SetPaused(false);f:Drain();assert(f.Calls==3 and b.Progress.Placed==2)
 f=fixture(2);b=f.Value;reads=0
 f.Read=function() reads+=1;if reads==1 then coroutine.yield() end;return f.Stock end
 b:Start();b:SetPaused(true);b:SetPaused(false);f:Drain()
 assert(reads>=2 and f.Calls==2,'even a rapid Pause/Resume must refresh a yielding inventory lookup')
 -- Rapid Resume before a cancelled path returns must not end the worker.
 f,options=fixture(2);b=f.Value;f.Distance=50;b:SetTravelMode('Walk')
 options.Approach=function()
  f.Walks+=1
  if f.Walks==1 then coroutine.yield();return false,'old path cancelled' end
  f.Distance=0;return true
 end
 b:Start();owner=b.WorkerToken;assert(f.Walks==1 and f.Calls==0)
 b:SetPaused(true);b:SetPaused(false);f:Drain()
 assert(f.Walks==2 and f.Calls==2 and b.Progress.Placed==2 and #b.History==1,'Resume must recheck a cancelled old path in the same run')
end)()
;(function()
 local fields={'Place','ItemCount','CopyReport','Alive'}
 local old={};for _,key in ipairs(fields) do old[key]=ctx[key] end
 local oldWorld,oldRoot=occupied,root.Position
 root.Position=setmetatable({},{__sub=function() return {Magnitude=0} end})
 ctx.ItemCount=nil
 local copied,copies,dispatches=nil,0,0
 ctx.CopyReport=function(text) copied=text;copies+=1 end
 local h=A.new(ctx)
 assert(not h:CopyAllHistory() and copies==0,'empty history cannot overwrite the clipboard')
 local function drain() local guard=0;while coroutine.status(worker)~='dead' do guard+=1;assert(guard<2000);step() end end
 local function run(name,count,place)
  occupied={};h.Preset=name;h.Cells=cells(count);h.BlockSize=3;h.Failures={};ctx.Place=function(body) dispatches+=1;return place(body) end
  assert(h:Start());drain();return h.History[1]
 end
 local n=0
 local success=run('Cooldown recovery',2,function(body)
  n+=1;if n==1 then return false,{success=false,error='TOO_FAST'},'rejected' end
  occupied[body.cframe.Position]=true;return true
 end)
 assert(success.Attempts==3 and success.Cooldowns==1 and success.Retryable==0 and success.Review==0 and #success.Failures==0,'successful cooldown retries must clear historical unresolved cells while keeping attempt counts')
 assert(success.Speed=='Standard' and success.Travel=='Stay' and success.NextAction=='No unresolved cells in this run.')
 local rejected=run('Mixed support failures',18,function(body)
  if body.cframe.Position%2==0 then return false,{success=false,error='NO_SUPPORT'..string.char(10)..string.rep('x',800)},'rejected' end
  occupied[body.cframe.Position]=true;return true
 end)
 assert(rejected.State=='Finished' and rejected.Failed==9 and rejected.Retryable==9 and rejected.Review==0 and #rejected.Failures==8 and rejected.Attempts==18,'mixed failures must preserve completed-run behavior and bound the historical cell list')
 assert(rejected.Failures[1].Index==2 and rejected.Failures[8].Index==16 and #rejected.Failures[1].Reason<=512 and not rejected.Failures[1].Reason:find('[%c]'),'failure snapshots must be ordered and contain bounded plain reasons')
 assert(not rejected.Failures[1].CFrame and not rejected.Failures[1].Cell and not rejected.Failures[1].Remote,'historical failures must exclude live instances and request bindings')
 assert(string.find(h:ShowHistory(),'Finished with unresolved cells',1,true) and string.find(h.HistoryReport,'More tracked cells: 1',1,true) and string.find(rejected.NextAction,'Retry failed',1,true),'partial completion must expose failures and a concrete next step')
 h:ClearPreview();h.LastPlacementResult='unrelated later result';h:SetBuildSpeed('Fast')
 assert(rejected.Speed=='Standard' and rejected.Failures[1].Material=='grass' and string.find(rejected.LastResult,'NO_SUPPORT',1,true),'editing/clearing later previews cannot change old results or their settings')
 local review=run('Unconfirmed response',1,function() return true end)
 assert(review.Review==1 and review.Retryable==0 and review.Failed==1 and string.find(review.NextAction,'Inspect uncertain',1,true),'unconfirmed placements must retain review guidance instead of suggesting an automatic retry')
 ctx.ItemCount=function() return 0 end
 occupied={};h.Cells=cells(1);h.Preset='Restock stop';h:Start();h:Stop();drain()
 local empty=h.History[1]
 assert(empty.Attempts==0 and empty.LastResult=='No placement request sent' and empty.WaitReason=='Material: grass' and empty.State=='Stopped','a stopped restock wait must not inherit a previous server error')
 ctx.ItemCount=nil
 occupied={};h.Cells=cells(1);h.Preset='Late transport error'
 ctx.Place=function() dispatches+=1;coroutine.yield();error('late transport failure') end
 h:Start();h:Stop();drain()
 local late=h.History[1]
 assert(late.State=='Stopped' and late.Placed==0 and late.Attempts==1 and late.Review==1 and string.find(late.LastResult,'Transport error:',1,true),'late errors after Stop must remain unconfirmed while recording the actual result')
 assert(#h.History==5)
 h:ShowHistory();local selected,label,report=h.HistoryIndex,h.HistoryLabel.Text,h.HistoryReport
 local before=dispatches
 h.Buttons.CopyAllHistory.Activated:Fire()
 assert(copied and string.find(copied,'5 / 5 retained',1,true) and string.find(copied,'Late transport error',1,true) and string.find(copied,'Cooldown recovery',1,true),'Copy all must include every retained snapshot newest first')
 assert(string.find(copied,'Late transport error',1,true)<string.find(copied,'Cooldown recovery',1,true) and h.HistoryIndex==selected and h.HistoryLabel.Text==label and h.HistoryReport==report,'whole-history export must preserve the selected/displayed result')
 ctx.ItemCount=function() return 0 end
 occupied={};h.Cells=cells(1);h.Preset='ACTIVE NOT RECORDED';h:Start();local owner=h.WorkerToken
 local full=h:CopyAllHistory()
 assert(not string.find(full,'ACTIVE NOT RECORDED',1,true) and h.WorkerToken==owner and h.Running and dispatches==before,'copying during a run must export finished snapshots only without dispatching or stopping')
 h:Stop();drain();ctx.ItemCount=nil
 local originalCopy=ctx.CopyReport;ctx.CopyReport=nil
 assert(not h:CopyAllHistory(),'unavailable copying must not be claimed as success');ctx.CopyReport=originalCopy
 ctx.Alive=function() return false end;local count=copies
 assert(not h:CopyAllHistory() and copies==count,'removed hubs cannot invoke history copying')
 for _,key in ipairs(fields) do ctx[key]=old[key] end
 occupied,root.Position=oldWorld,oldRoot
end)()
return 'Auto Build blueprints, paths, placement confirmation, result snapshots/export, pause/resume, restock waits, live progress, adaptive speed, occupied skip, plan edit guards, single worker, cancellation and failure stop passed'
`;
const state=await LuauState.createAsync();try{console.log(await state.loadstring(checks,'autobuild',true)());}finally{state.destroy();}
