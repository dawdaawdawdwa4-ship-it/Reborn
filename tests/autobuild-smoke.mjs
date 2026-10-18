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
local function control() return {Activated=signal(),FocusLost=signal(),Destroy=function(self) self.Destroyed=true end} end
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
local function vector(x,y,z)
 return setmetatable({X=x,Y=y,Z=z},{__sub=function(a,b)
  return {Magnitude=math.sqrt((a.X-b.X)^2+(a.Y-b.Y)^2+(a.Z-b.Z)^2)}
 end})
end
local Vector3={new=vector}
local RaycastParams={new=function() return {} end}
local Enum={RaycastFilterType={Exclude=1},Material={ForceField=1}}
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
return 'Auto Build blueprints, paths, placement confirmation, distant occupied skip, plan edit guards, single worker, cancellation and failure stop passed'
`;
const state=await LuauState.createAsync();try{console.log(await state.loadstring(checks,'autobuild',true)());}finally{state.destroy();}
