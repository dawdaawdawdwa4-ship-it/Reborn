import fs from 'node:fs';
import {LuauState} from 'luau-web';
const source=fs.readFileSync(new URL('../tools/AutoBuild.lua',import.meta.url),'utf8');
const checks=`
local A=(function() ${source} end)()
for _,case in ipairs({{'Farm plots',5,6,3,30},{'Platform',4,3,2,12},{'Wall',4,3,2,8},{'Stairs',2,4,1,20}}) do
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
local function signal()
 local callbacks={}
 return {Connect=function(_,callback) table.insert(callbacks,callback);return {} end,
 Fire=function() for _,callback in ipairs(callbacks) do callback() end end}
end
local function control() return {Activated=signal(),FocusLost=signal()} end
local Instance={new=function() return control() end}
local UDim2={new=function() return {} end,fromOffset=function() return {} end}
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
-- Re-evaluate with the injected UI globals.
local A=(function() ${source} end)()
local ticks,worker,requests=0,nil,0
local occupied={}
local root={Position=setmetatable({},{__sub=function() return {Magnitude=0} end})}
local ctx={Player={Character={FindFirstChild=function() return root end}},Parent={},Label=function() return control() end,Button=function() return control() end,Track=function() end,Alive=function() return true end,Workspace={},Now=function() return ticks end,
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
assert(not string.find(b.Status.Text,'confirmed',1,true),'accepted request alone is not a placement')
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
assert(moved:Move(1,1,1))
local p=moved.Cells[1].CFrame.Position
assert(math.abs(p.X-4)<.001 and math.abs(p.Y-3)<.001 and math.abs(p.Z-7)<.001,'blueprint shifts must follow its rotated axes')
assert(ghost.CFrame==moved.Cells[1].CFrame,'ghost must follow actual placement coordinates')
moved.Running=true;assert(not moved:Move(1,0,0),'cannot shift active queue');moved.Running=false
assert(moved:Move(-moved.OffsetX,-moved.OffsetY,-moved.OffsetZ))
local restored=moved.Cells[1].CFrame.Position
assert(math.abs(restored.X-original.Position.X)<.001 and math.abs(restored.Z-original.Position.Z)<.001,'reset offset must restore preview')
return 'Auto Build blueprints, paths, placement confirmation, distant occupied skip, plan edit guards, single worker, cancellation and failure stop passed'
`;
const state=await LuauState.createAsync();try{console.log(await state.loadstring(checks,'autobuild',true)());}finally{state.destroy();}
