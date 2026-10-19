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
return 'Auto Build blueprints, paths, placement confirmation, distant occupied skip, plan edit guards, single worker, cancellation and failure stop passed'
`;
const state=await LuauState.createAsync();try{console.log(await state.loadstring(checks,'autobuild',true)());}finally{state.destroy();}
