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
local Enum={RaycastFilterType={Exclude=1},Material={ForceField=1},AutomaticSize={Y=1},TextTruncate={None=1}}
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
return 'Auto Build blueprints, paths, placement confirmation, distant occupied skip, plan edit guards, single worker, cancellation and failure stop passed'
`;
const state=await LuauState.createAsync();try{console.log(await state.loadstring(checks,'autobuild',true)());}finally{state.destroy();}
