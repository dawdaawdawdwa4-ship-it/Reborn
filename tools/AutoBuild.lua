-- Blueprint planning and single-flight placement controller for the standalone hub.
local AutoBuild = {}
function AutoBuild.Plan(preset, width, length, height)
    width, length, height = math.floor(width), math.floor(length), math.floor(height)
    assert(width >= 1 and width <= 12 and length >= 1 and length <= 12 and height >= 1 and height <= 8, "Use sizes 1–12 and height 1–8")
    local cells = {}
    local function add(x,y,z,role)
        table.insert(cells, {x=x-math.floor(width/2),y=y,z=z+1,role=role or "main"})
        assert(#cells <= 300, "Plan exceeds 300 blocks; reduce its dimensions")
    end
    if preset == "Platform" then
        for z=0,length-1 do for x=0,width-1 do add(x,0,z) end end
    elseif preset == "Farm plots" then
        for z=0,length-1 do
            for x=0,width-1 do add(x,1,z,x%3==2 and "path" or "main") end
        end
    elseif preset == "Wall" then
        for y=1,height do for x=0,width-1 do add(x,y,0) end end
    elseif preset == "Stairs" then
        for z=0,length-1 do
            for y=1,z+1 do for x=0,width-1 do add(x,y,z) end end
        end
    else error("Unknown blueprint") end
    table.sort(cells,function(a,b)
        if a.y ~= b.y then return a.y < b.y end
        if a.z ~= b.z then return a.z < b.z end
        return a.x < b.x
    end)
    return cells
end
-- Plain-data blueprints are validated before use or persistence.
function AutoBuild.Validate(data)
    assert(type(data)=="table" and data.Version==1,"Unsupported blueprint version")
    assert(type(data.Name)=="string" and #data.Name>0 and #data.Name<=48,"Use a blueprint name of 1–48 bytes")
    assert(type(data.BlockSize)=="number" and data.BlockSize>=1 and data.BlockSize<=20,"Invalid blueprint block size")
    assert(type(data.Cells)=="table" and #data.Cells>=1 and #data.Cells<=300,"Blueprint must contain 1–300 blocks")
    local count=0
    for index in pairs(data.Cells) do
        assert(type(index)=="number" and index%1==0 and index>=1 and index<=#data.Cells,"Invalid blueprint cell list")
        count+=1
    end
    assert(count==#data.Cells,"Blueprint cell list contains gaps")
    local result={Version=1,Name=data.Name,BlockSize=data.BlockSize,Cells={}}
    local seen={}
    for index,cell in ipairs(data.Cells) do
        assert(type(cell)=="table" and type(cell.Material)=="string" and #cell.Material>0 and #cell.Material<=128,"Invalid block material")
        assert(type(cell.Components)=="table" and #cell.Components==12,"Invalid block transform")
        local c={}
        for i=1,12 do
            local n=cell.Components[i]
            assert(type(n)=="number" and n==n and math.abs(n)<=(i<=3 and 3000 or 1.001),"Invalid block coordinates")
            c[i]=n
        end
        -- Rotation rows must form an orthonormal, right-handed basis.
        for row=0,2 do
            local a=4+row*3
            assert(math.abs(c[a]^2+c[a+1]^2+c[a+2]^2-1)<.002,"Invalid block rotation")
            for other=row+1,2 do
                local b=4+other*3
                assert(math.abs(c[a]*c[b]+c[a+1]*c[b+1]+c[a+2]*c[b+2])<.002,"Invalid block rotation")
            end
        end
        local determinant=c[4]*(c[8]*c[12]-c[9]*c[11])-c[5]*(c[7]*c[12]-c[9]*c[10])+c[6]*(c[7]*c[11]-c[8]*c[10])
        assert(math.abs(determinant-1)<.002,"Invalid block rotation")
        local key=string.format("%.3f,%.3f,%.3f",c[1],c[2],c[3])
        assert(not seen[key],"Duplicate block position");seen[key]=true
        result.Cells[index]={Material=cell.Material,Components=c}
    end
    table.sort(result.Cells,function(a,b)
        local x,y=a.Components,b.Components
        if x[2]~=y[2] then return x[2]<y[2] end
        if x[3]~=y[3] then return x[3]<y[3] end
        return x[1]<y[1]
    end)
    return result
end
function AutoBuild.new(ctx)
    local self={Preset="Farm plots",Width=5,Length=6,Height=3,Rotation=0,Token=0,Running=false,Cells=nil,PreviewFolder=nil,OffsetX=0,OffsetY=0,OffsetZ=0,Library={},Slot=1,CaptureRange=30,Persistence={}}
    local inputs,buttons={},{}
    local space=ctx.Workspace or workspace
    local scheduler=ctx.Scheduler or task
    local now=ctx.Now or os.clock
    local function status(message)
        local p=self.Progress
        local counts=self.Running and p and p.State~="Finished" and string.format("\nRun: %d confirmed · %d skipped · %d failed",p.Placed,p.Skipped,p.Failed) or ""
        self.Status.Text=tostring(message)..counts
    end
    function self:ClearPreview()
        if self.PreviewFolder then self.PreviewFolder:Destroy();self.PreviewFolder=nil end
        self.Cells=nil;self.BuildReport=nil
        if self.MaterialSummary then self.MaterialSummary.Text="Preview or load a blueprint to see its material counts." end
    end
    function self:Stop()
        self.Token+=1;self.Running=false
        buttons.Start.Text=self.Cells and "Resume build" or "Start build"
        if self.Progress then self.Progress.State="Stopped" end
        local p=self.Progress
        status("Stopped. Remaining blocks were not sent."..(p and string.format(" %d confirmed, %d skipped, %d failed; %d planned.",p.Placed,p.Skipped,p.Failed,p.Total) or ""))
    end
    local function characterRoot()
        local char=ctx.Player.Character
        return char, char and char:FindFirstChild("HumanoidRootPart")
    end
    local function blockSize()
        local util=ctx.GameModule("ReplicatedStorage.TS.util.block-utils","BlockUtils")
        return util and type(util.BLOCK_SIZE)=="number" and util.BLOCK_SIZE or 3
    end
    local function occupied(cf,size)
        local util=ctx.GameModule("ReplicatedStorage.TS.util.block-utils","BlockUtils")
        if util and type(util.getBlocksFromLocation)=="function" then
            local ok,blocks=pcall(function() return util.getBlocksFromLocation(cf.Position,{},1,true) end)
            if ok and type(blocks)=="table" then return #blocks>0 end
        end
        local params=OverlapParams.new()
        params.FilterType=Enum.RaycastFilterType.Exclude
        local char=ctx.Player.Character
        local ignored={}
        if char then table.insert(ignored,char) end
        if self.PreviewFolder then table.insert(ignored,self.PreviewFolder) end
        params.FilterDescendantsInstances=ignored
        for _,part in ipairs(space:GetPartBoundsInBox(cf,Vector3.new(size-.2,size-.2,size-.2),params)) do
            if part.CanCollide then return true end
        end
        return false
    end
    function self:Preview()
        if self.Running then status("Stop the build before changing its plan.");return false end
        self:ClearPreview()
        local char,root=characterRoot()
        if not root then status("Wait for your character to spawn.");return false end
        local ok,plan
        if self.SavedPlan then ok,plan=pcall(AutoBuild.Validate,self.SavedPlan)
        else ok,plan=pcall(AutoBuild.Plan,self.Preset,self.Width,self.Length,self.Height) end
        if not ok then status(plan);return false end
        local material=inputs.Material.Text:match("^%s*(.-)%s*$")
        local pathMaterial=inputs.Path.Text:match("^%s*(.-)%s*$")
        if not self.SavedPlan and (material=="" or self.Preset=="Farm plots" and pathMaterial=="") then status("Choose bed/build and path materials.");return false end
        local params=RaycastParams.new()
        params.FilterType=Enum.RaycastFilterType.Exclude
        params.FilterDescendantsInstances={char}
        local ground=space:Raycast(root.Position,Vector3.new(0,-40,0),params)
        if not ground then status("Stand on solid ground before previewing.");return false end
        local size=blockSize()
        local look=root.CFrame.LookVector
        local yaw=math.round(math.atan2(-look.X,-look.Z)/(math.pi/2))*(math.pi/2)+math.rad(self.Rotation)
        local anchor=CFrame.new(math.round(root.Position.X/size)*size,math.round((ground.Position.Y-size/2)/size)*size,math.round(root.Position.Z/size)*size)*CFrame.Angles(0,yaw,0)
        anchor=anchor*CFrame.new(self.OffsetX*size,self.OffsetY*size,-self.OffsetZ*size)
        self.Anchor=anchor
        local definitions=game:GetService("ReplicatedStorage"):FindFirstChild("Blocks")
        if definitions and self.SavedPlan then
            for _,cell in ipairs(plan.Cells) do
                if not definitions:FindFirstChild(cell.Material) then status("Unknown saved block: "..cell.Material);return false end
            end
        elseif definitions then
            if not definitions:FindFirstChild(material) then status("Unknown build block: "..material);return false end
            if self.Preset=="Farm plots" and not definitions:FindFirstChild(pathMaterial) then status("Unknown path block: "..pathMaterial);return false end
        end
        if self.SavedPlan and math.abs(plan.BlockSize-size)>.001 then status("Saved blueprint uses a different block size.");return false end
        local folder=Instance.new("Folder");folder.Name="RebornBuildPreview";folder.Parent=space
        self.PreviewFolder=folder
        self.Cells={}
        for _,cell in ipairs(self.SavedPlan and plan.Cells or plan) do
            local cf=anchor*(self.SavedPlan and CFrame.new(table.unpack(cell.Components)) or CFrame.new(cell.x*size,cell.y*size,-cell.z*size))
            local part=Instance.new("Part")
            part.Name="PlannedBlock";part.Anchored=true;part.CanCollide=false;part.CanTouch=false;part.CanQuery=false
            part.Size=Vector3.new(size-.15,size-.15,size-.15);part.CFrame=cf
            part.Transparency=.65;part.Material=Enum.Material.ForceField
            part.Color=cell.role=="path" and Color3.fromRGB(210,180,100) or Color3.fromRGB(100,160,255)
            part.Parent=folder
            table.insert(self.Cells,{CFrame=cf,Material=self.SavedPlan and cell.Material or cell.role=="path" and pathMaterial or material,Preview=part})
        end
        self.BlockSize=size
        self:UpdateMaterials(self.Cells)
        status(string.format("Preview: %s, %d blocks. Blue = build/beds; gold = paths.",self.Preset,#self.Cells))
        return true
    end
    function self:Move(dx,dy,dz)
        if self.Running then status("Stop the build before moving its blueprint.");return false end
        if not self.Cells and not self:Preview() then return false end
        local anchor=self.Anchor*CFrame.new(dx*self.BlockSize,dy*self.BlockSize,-dz*self.BlockSize)
        local delta=anchor*self.Anchor:Inverse()
        for _,cell in ipairs(self.Cells) do
            cell.CFrame=delta*cell.CFrame
            if cell.Preview then cell.Preview.CFrame=cell.CFrame end
        end
        self.Anchor=anchor;self.BuildReport=nil
        self:UpdateMaterials(self.Cells)
        self.OffsetX+=dx;self.OffsetY+=dy;self.OffsetZ+=dz
        self.MoveLabel.Text=string.format("Offset: right %d / up %d / forward %d blocks",self.OffsetX,self.OffsetY,self.OffsetZ)
        status("Blueprint moved. Start builds the visible preview positions.")
        return true
    end
    function self:Start()
        if self.Running then return false end
        if self.WorkerToken then status("Wait for the previous build request to finish before resuming.");return false end
        if not self.Cells and not self:Preview() then return end
        self.Token+=1
        local token=self.Token
        self.WorkerToken=token
        self.Progress={Placed=0,Skipped=0,Failed=0,Total=#self.Cells,Index=0,State="Building"}
        self.Running=true;buttons.Start.Text="Building…"
        if self.MoveMenu then self.MoveMenu.Visible=false end
        local function active() return self.Running and self.Token==token and ctx.Alive() end
        scheduler.spawn(function()
            local placed,skipped,failed,streak=0,0,0,0
            local ok,err=pcall(function()
                for index,cell in ipairs(self.Cells) do
                    if not active() then return end
                    self.Progress.Index=index
                    local existing=occupied(cell.CFrame,self.BlockSize)
                    if existing then
                        skipped+=1
                    else
                        local _,root=characterRoot()
                        local reach=ctx.GameModule("ReplicatedStorage.Shared.SharedConfig","CLIENT_REACH")
                        if type(reach)~="number" then reach=20 end
                        while active() and (not root or (root.Position-cell.CFrame.Position).Magnitude>reach) do
                            self.Progress.State="Waiting for reach"
                            status(string.format("Move within %d studs of block %d/%d, or press Stop.",reach,index,#self.Cells))
                            scheduler.wait(.2);_,root=characterRoot()
                            if active() then existing=occupied(cell.CFrame,self.BlockSize) end
                            if existing then break end
                        end
                        if not active() then return end
                        if existing or occupied(cell.CFrame,self.BlockSize) then
                            skipped+=1
                        else
                            self.Progress.State="Building"
                            status(string.format("Building %d/%d: %s",index,#self.Cells,cell.Material))
                            local sent,reason=ctx.Place({cframe=cell.CFrame,blockType=cell.Material})
                            if not active() then return end
                            local confirmed=false
                            if sent then
                                local deadline=now()+1
                                repeat
                                    if not active() then return end
                                    confirmed=occupied(cell.CFrame,self.BlockSize)
                                    if confirmed then break end
                                    scheduler.wait(.05)
                                until now()>=deadline
                            end
                            if confirmed then placed+=1;streak=0
                            else failed+=1;streak+=1 end
                            self.Progress.Placed=placed;self.Progress.Skipped=skipped;self.Progress.Failed=failed
                            if streak>=3 then
                                self.Progress.State="Paused after failures"
                                status("Build paused after 3 failures: "..tostring(reason or "no block appeared")..". Check materials, support and island access.")
                                return
                            end
                        end
                    end
                    self.Progress.Placed=placed;self.Progress.Skipped=skipped;self.Progress.Failed=failed
                    if cell.Preview then cell.Preview:Destroy();cell.Preview=nil end
                    scheduler.wait(.2)
                end
                if active() then self.Progress.State="Finished";status(string.format("Finished: %d confirmed, %d occupied/skipped, %d failed.",placed,skipped,failed)) end
            end)
            if self.WorkerToken==token then self.WorkerToken=nil end
            if self.Token==token then
                self.Running=false;buttons.Start.Text="Start build"
                if not ok then self.Progress.State="Error";status("Build stopped: "..tostring(err)) end
            end
        end)
    end
    function self:UpdateMaterials(cells)
        local counts,names={},{}
        for _,cell in ipairs(cells or {}) do
            if not counts[cell.Material] then counts[cell.Material]=0;table.insert(names,cell.Material) end
            counts[cell.Material]+=1
        end
        table.sort(names)
        local lines={"Planned materials (availability not checked):"}
        for index,name in ipairs(names) do
            if index>5 then table.insert(lines,"More material types: "..(#names-5));break end
            table.insert(lines,name.." ×"..counts[name])
        end
        if self.MaterialSummary then self.MaterialSummary.Text=table.concat(lines,"\n") end
        return counts
    end
    function self:StoreBlueprint(data,slot)
        if self.Running or self.WorkerToken then status("Wait for the build worker to finish before changing saved slots.");return false end
        if slot==nil then slot=self.Slot end
        if type(slot)~="number" or slot%1~=0 or slot<1 or slot>5 then status("Choose a slot from 1 to 5.");return false end
        local ok,copy=pcall(AutoBuild.Validate,data)
        if not ok then status(copy);return false end
        self.Library[slot]=copy
        local persisted=false
        if ctx.WriteBlueprint then
            local ran,result=pcall(ctx.WriteBlueprint,slot,copy)
            persisted=ran and result==true
        end
        self.Persistence[slot]=persisted and "File + session" or "Session only"
        self:RefreshLibrary(false)
        status("Saved slot "..slot..": "..copy.Name.." ("..#copy.Cells.." blocks). "..(persisted and "Saved to file." or "Session only; file saving is unavailable or failed."))
        return true
    end
    function self:InspectSlot(slot)
        local data=self.Library[slot]
        if data then return data,self.Persistence[slot] or "Session" end
        local function unavailable(reason) self.Persistence[slot]=reason;return nil,reason end
        if not ctx.ReadBlueprint then return unavailable("No file access") end
        local ran,result=pcall(ctx.ReadBlueprint,slot)
        if not ran then return unavailable("Unavailable file") end
        if result==nil then return unavailable("No saved data") end
        local valid,copy=pcall(AutoBuild.Validate,result)
        if not valid then return unavailable("Invalid file") end
        self.Library[slot]=copy;self.Persistence[slot]="Loaded from file"
        return copy,"Loaded from file"
    end
    function self:RefreshLibrary(readFiles)
        local lines={"SAVED SLOTS"}
        for slot=1,5 do
            local data,source
            if readFiles then data,source=self:InspectSlot(slot)
            else data=self.Library[slot];source=self.Persistence[slot] or "Not inspected" end
            table.insert(lines,(slot==self.Slot and "→ " or "")..slot..": "..(data and (data.Name.." · "..#data.Cells.." blocks · "..source) or source))
        end
        if self.LibrarySummary then self.LibrarySummary.Text=table.concat(lines,"\n") end
        local selected=self.Library[self.Slot]
        buttons.Slot.Text="Slot "..self.Slot.." / 5"..(selected and (": "..selected.Name) or "")
        return table.concat(lines,"\n")
    end
    function self:CheckMaterials()
        if self.Running or self.WorkerToken then status("Finish or stop the current build request before checking materials.");return false end
        if not self.Cells then status("Preview at the intended position before checking materials.");return false end
        local pending,skipped,reachable={},0,0
        local _,root=characterRoot()
        local reach=ctx.GameModule("ReplicatedStorage.Shared.SharedConfig","CLIENT_REACH")
        if type(reach)~="number" then reach=20 end
        local ok,err=pcall(function()
            for _,cell in ipairs(self.Cells) do
                if occupied(cell.CFrame,self.BlockSize) then skipped+=1
                else
                    pending[cell.Material]=(pending[cell.Material] or 0)+1
                    if root and (root.Position-cell.CFrame.Position).Magnitude<=reach then reachable+=1 end
                end
            end
        end)
        if not ok then status("Could not check world occupancy: "..tostring(err));return false end
        local names,total={},0
        for material,amount in pairs(pending) do table.insert(names,material);total+=amount end
        table.sort(names)
        local lines={"BUILD CHECK · snapshot",#self.Cells.." planned · "..skipped.." occupied · "..total.." remaining",reachable.." remaining cells currently in reach"}
        for _,material in ipairs(names) do
            local count
            if ctx.ItemCount then local ran,value=pcall(ctx.ItemCount,material);if ran then count=value end end
            local valid=type(count)=="number" and count>=0 and count%1==0 and count<=9007199254740991
            table.insert(lines,material..": need "..pending[material]..(valid and (", owned "..count..", short "..math.max(0,pending[material]-count)) or ", owned quantity unknown"))
        end
        table.insert(lines,"Occupied cells may contain a different block. Materials, support and permissions remain server-controlled.")
        self.BuildReport=table.concat(lines,"\n")
        self.MaterialSummary.Text=self.BuildReport
        status("Build check ready. No blocks were placed. Refresh after inventory or world changes.")
        return {Remaining=total,Occupied=skipped,Reachable=reachable,Materials=pending}
    end
    function self:RenameSlot(name)
        if self.Running or self.WorkerToken then status("Wait for the build worker before renaming a slot.");return false end
        local data=self:InspectSlot(self.Slot)
        if not data then status("Load or save a valid selected slot before renaming it.");return false end
        local copy=AutoBuild.Validate(data)
        copy.Name=type(name)=="string" and name:match("^%s*(.-)%s*$") or ""
        return self:StoreBlueprint(copy)
    end
    function self:CopySlot(target)
        if self.Running or self.WorkerToken then status("Wait for the build worker before copying a slot.");return false end
        if type(target)~="number" or target%1~=0 or target<1 or target>5 then status("Choose a copy target from 1 to 5.");return false end
        if target==self.Slot then status("Choose a copy target different from the source slot.");return false end
        local data=self:InspectSlot(self.Slot)
        if not data then status("Select a valid saved source slot before copying it.");return false end
        return self:StoreBlueprint(data,target)
    end
    function self:ReplaceMaterial(from,to)
        if self.Running or self.WorkerToken then status("Wait for the build worker before replacing materials.");return false end
        if not self.SavedPlan then status("Load a saved blueprint before replacing its materials.");return false end
        from=type(from)=="string" and from:match("^%s*(.-)%s*$") or ""
        to=type(to)=="string" and to:match("^%s*(.-)%s*$") or ""
        if from=="" or to=="" or #from>128 or #to>128 or from==to then status("Enter different source and replacement block names.");return false end
        local definitions=ctx.BlockDefinitions and ctx.BlockDefinitions()
        if not definitions or not definitions:FindFirstChild(to) then status("Replacement block is unknown or definitions are unavailable.");return false end
        local copy=AutoBuild.Validate(self.SavedPlan)
        local changed=0
        for _,cell in ipairs(copy.Cells) do
            if cell.Material==from then cell.Material=to;changed+=1 end
        end
        if changed==0 then status("No blocks named "..from.." in the loaded blueprint.");return false end
        self.MaterialUndo={Plan=AutoBuild.Validate(self.SavedPlan),Dirty=self.PlanDirty}
        self.SavedPlan=copy;self.PlanDirty=true;self.BuildReport=nil
        if self.Cells then
            for _,cell in ipairs(self.Cells) do if cell.Material==from then cell.Material=to end end
        end
        self.Preset="Saved: "..copy.Name.." *";buttons.Preset.Text=self.Preset.."  ▼"
        self:UpdateMaterials(self.Cells or copy.Cells)
        status("Changed "..changed.." blocks in the working blueprint. Saved slots are unchanged; Preview then Save preview to keep this edit.")
        return true,changed
    end
    function self:UndoMaterial()
        if self.Running or self.WorkerToken then status("Wait for the build worker before undoing material edits.");return false end
        if not self.MaterialUndo then status("No material edit to undo.");return false end
        self.SavedPlan=self.MaterialUndo.Plan;self.PlanDirty=self.MaterialUndo.Dirty;self.MaterialUndo=nil;self.BuildReport=nil
        if self.Cells then
            for index,cell in ipairs(self.Cells) do cell.Material=self.SavedPlan.Cells[index].Material end
        end
        self.Preset="Saved: "..self.SavedPlan.Name..(self.PlanDirty and " *" or "");buttons.Preset.Text=self.Preset.."  ▼"
        self:UpdateMaterials(self.Cells or self.SavedPlan.Cells)
        status("Last material edit undone. No saved slot or placed block was changed.")
        return true
    end
    function self:SavePreview()
        if self.Running then status("Stop the build before saving a blueprint.");return false end
        if not self.Cells or not self.Anchor then status("Preview a build before saving it.");return false end
        local data={Version=1,Name=inputs.Name.Text,BlockSize=self.BlockSize,Cells={}}
        for _,cell in ipairs(self.Cells) do
            table.insert(data.Cells,{Material=cell.Material,Components={self.Anchor:ToObjectSpace(cell.CFrame):GetComponents()}})
        end
        local saved=self:StoreBlueprint(data)
        if saved and self.SavedPlan then
            self.SavedPlan=self.Library[self.Slot];self.PlanDirty=false;self.MaterialUndo=nil
            self.Preset="Saved: "..self.SavedPlan.Name;buttons.Preset.Text=self.Preset.."  ▼"
        end
        return saved
    end
    function self:LoadBlueprint()
        if self.Running then status("Stop the build before loading a blueprint.");return false end
        local data=self.Library[self.Slot]
        if not data and ctx.ReadBlueprint then
            local ran,result=pcall(ctx.ReadBlueprint,self.Slot)
            if ran then data=result end
        end
        local ok,copy=pcall(AutoBuild.Validate,data)
        if not ok then status("Cannot load slot "..self.Slot..": "..tostring(copy));return false end
        self:ClearPreview()
        if not self.Library[self.Slot] then self.Persistence[self.Slot]="Loaded from file" end
        self.Library[self.Slot]=copy;self.SavedPlan=copy;self.PlanDirty=false;self.MaterialUndo=nil
        self:RefreshLibrary(false)
        self.Preset="Saved: "..copy.Name;buttons.Preset.Text=self.Preset.."  ▼"
        inputs.Name.Text=copy.Name
        self.OffsetX,self.OffsetY,self.OffsetZ=0,0,0
        self.Rotation=0;buttons.Rotate.Text="Rotate: 0°"
        self:UpdateMaterials(copy.Cells)
        status("Loaded "..copy.Name..". Preview at your current position, adjust offset/rotation, then Start. Materials and permissions are still required.")
        return true
    end
    function self:CaptureIsland()
        if self.Running then status("Stop the build before saving island blocks.");return false end
        local _,root=characterRoot()
        local blocks=ctx.IslandBlocks and ctx.IslandBlocks()
        if not root or not blocks then status("Stand on your own island to save nearby blocks.");return false end
        local definitions=ctx.BlockDefinitions and ctx.BlockDefinitions()
        if not definitions then status("Block definitions are unavailable; island capture was not saved.");return false end
        local selected,minY={},math.huge
        for _,block in ipairs(blocks:GetChildren()) do
            if definitions:FindFirstChild(block.Name) and (block:IsA("BasePart") or block:IsA("Model")) then
                local ok,cf=pcall(function() return block:IsA("BasePart") and block.CFrame or block:GetPivot() end)
                if not ok then status("A block transform is unreadable; nothing was saved.");return false end
                if (cf.Position-root.Position).Magnitude<=self.CaptureRange then
                    table.insert(selected,{CFrame=cf,Material=block.Name});minY=math.min(minY,cf.Position.Y)
                    if #selected>300 then status("Area exceeds 300 blocks. Reduce capture range or choose a smaller island section; nothing was saved.");return false end
                end
            end
        end
        if #selected==0 then status("No supported placed blocks within "..self.CaptureRange.." studs.");return false end
        local size=blockSize()
        local origin=CFrame.new(math.round(root.Position.X/size)*size,minY,math.round(root.Position.Z/size)*size)
        local data={Version=1,Name=inputs.Name.Text,BlockSize=size,Cells={}}
        for _,cell in ipairs(selected) do
            table.insert(data.Cells,{Material=cell.Material,Components={origin:ToObjectSpace(cell.CFrame):GetComponents()}})
        end
        return self:StoreBlueprint(data)
    end
    function self:Destroy() self:Stop();self:ClearPreview() end
    local function label(text,y,height)
        return ctx.Label({Parent=ctx.Parent,Text=text,TextSize=12,Size=UDim2.new(1,-12,0,height or 24),Position=UDim2.fromOffset(6,y)})
    end
    local function button(name,text,x,y,width,callback)
        local b=ctx.Button({Parent=ctx.Parent,Text=text,TextSize=12,Size=UDim2.new(width or 1,-12,0,32),Position=UDim2.new(x or 0,6,0,y)})
        buttons[name]=b
        ctx.Track(b.Activated:Connect(callback));return b
    end
    local function invalidate()
        if not self.Running then self:ClearPreview();status("Settings changed. Preview the new plan.") end
    end
    label("Build farm beds and paths, platforms, walls or solid stairs.",4,36)
    local presets={"Farm plots","Platform","Wall","Stairs"}
    local presetMenu=Instance.new("Frame")
    presetMenu.Name="BlueprintOptions";presetMenu.Size=UDim2.new(1,-12,0,144);presetMenu.Position=UDim2.fromOffset(6,84)
    presetMenu.BackgroundColor3=Color3.fromRGB(29,39,48);presetMenu.BorderSizePixel=0;presetMenu.ZIndex=35;presetMenu.Visible=false;presetMenu.Parent=ctx.Parent
    button("Preset","Farm plots  ▼",0,48,.5,function()
        if not self.Running then presetMenu.Visible=not presetMenu.Visible;if self.MoveMenu then self.MoveMenu.Visible=false end end
    end)
    local moveMenu=Instance.new("Frame")
    moveMenu.Name="MoveBlueprint";moveMenu.Size=UDim2.new(1,-12,0,184);moveMenu.Position=UDim2.fromOffset(6,84)
    moveMenu.BackgroundColor3=Color3.fromRGB(29,39,48);moveMenu.BorderSizePixel=0;moveMenu.ZIndex=35;moveMenu.Visible=false;moveMenu.Parent=ctx.Parent
    button("Movement","Move blueprint  ▼",.5,48,.5,function()
        presetMenu.Visible=false
        moveMenu.Visible=not moveMenu.Visible
    end)
    local function moveButton(key,text,x,y,dx,dy,dz)
        local item=ctx.Button({Parent=moveMenu,Text=text,Size=UDim2.new(.5,-6,0,32),Position=UDim2.new(x,3,0,y)})
        item.ZIndex=36;buttons[key]=item
        ctx.Track(item.Activated:Connect(function() self:Move(dx,dy,dz) end))
    end
    moveButton("MoveLeft","← Left",0,4,-1,0,0)
    moveButton("MoveRight","Right →",.5,4,1,0,0)
    moveButton("MoveForward","↑ Forward",0,40,0,0,1)
    moveButton("MoveBack","Back ↓",.5,40,0,0,-1)
    moveButton("MoveUp","Up +1",0,76,0,1,0)
    moveButton("MoveDown","Down −1",.5,76,0,-1,0)
    local resetOffset=ctx.Button({Parent=moveMenu,Text="Reset blueprint offset",Size=UDim2.new(1,-6,0,32),Position=UDim2.fromOffset(3,112)})
    resetOffset.ZIndex=36;buttons.ResetOffset=resetOffset
    ctx.Track(resetOffset.Activated:Connect(function() self:Move(-self.OffsetX,-self.OffsetY,-self.OffsetZ) end))
    self.MoveLabel=ctx.Label({Parent=moveMenu,Text="Moves 1 block per click, relative to preview.",TextSize=12,Size=UDim2.new(1,-12,0,30),Position=UDim2.fromOffset(6,148)})
    self.MoveLabel.ZIndex=36;self.MoveLabel.TextWrapped=true
    self.MoveMenu=moveMenu
    for index,preset in ipairs(presets) do
        local option=ctx.Button({Parent=presetMenu,Text=preset,Size=UDim2.new(1,-4,0,34),Position=UDim2.fromOffset(2,(index-1)*36)})
        option.ZIndex=36
        ctx.Track(option.Activated:Connect(function()
            if self.Running then return end
            self.SavedPlan=nil;self.PlanDirty=false;self.MaterialUndo=nil
            self.Preset=preset;buttons.Preset.Text=preset.."  ▼";presetMenu.Visible=false;invalidate()
        end))
    end
    local function input(key,title,value,y,numeric)
        label(title,y)
        local field=Instance.new("TextBox");field.Name=key;field.Text=tostring(value);field.PlaceholderText=title
        field.ClearTextOnFocus=false;field.TextSize=14;field.TextColor3=Color3.fromRGB(226,232,240)
        field.BackgroundColor3=Color3.fromRGB(29,39,48);field.BorderSizePixel=0;field.Size=UDim2.new(1,-12,0,30);field.Position=UDim2.fromOffset(6,y+24);field.Parent=ctx.Parent
        inputs[key]=field
        local committed=field.Text
        ctx.Track(field.FocusLost:Connect(function()
            if self.Running or self.SavedPlan then
                field.Text=committed
                status(self.SavedPlan and "Saved layouts keep their materials and shape. Choose a built-in blueprint to edit them." or "Stop the build before changing its plan.")
                return
            end
            if numeric then
                local limit=key=="Height" and 8 or 12
                self[key]=math.clamp(math.floor(tonumber(field.Text) or self[key]),1,limit);field.Text=tostring(self[key])
            end
            committed=field.Text
            invalidate()
        end))
    end
    input("Material","Bed/build block name (for example grass, soil or stone)","grass",90)
    input("Path","Farm path block name","stone",152)
    input("Width","Width (blocks)",self.Width,214,true)
    input("Length","Length / stair steps (blocks)",self.Length,276,true)
    input("Height","Wall height (blocks)",self.Height,338,true)
    button("Rotate","Rotate: 0°",0,406,1,function()
        if self.Running then return end
        self.Rotation=(self.Rotation+90)%360;buttons.Rotate.Text="Rotate: "..self.Rotation.."°";invalidate()
    end)
    button("Preview","Preview",0,446,.5,function() self:Preview() end)
    button("Start","Start build",.5,446,.5,function() self:Start() end)
    button("Stop","Stop build",0,486,.5,function() self:Stop() end)
    button("Clear","Clear preview",.5,486,.5,function() if not self.Running then self:ClearPreview();status("Preview cleared.") end end)
    self.Status=label("Choose materials you own, then Preview. Farm plots are raised beds with path columns; plant seeds after building.",534,74)
    self.Status.TextWrapped=true
    local materialView=Instance.new("ScrollingFrame")
    materialView.Size=UDim2.new(1,-12,0,100);materialView.Position=UDim2.fromOffset(6,616)
    materialView.BackgroundTransparency=1;materialView.BorderSizePixel=0;materialView.ScrollBarThickness=5
    materialView.CanvasSize=UDim2.new();materialView.AutomaticCanvasSize=Enum.AutomaticSize.Y;materialView.Parent=ctx.Parent
    self.MaterialSummary=ctx.Label({Parent=materialView,Text="Preview or load a blueprint to see its material counts.",TextSize=12,
        Size=UDim2.new(1,-12,0,24),Position=UDim2.fromOffset(2,0)})
    self.MaterialSummary.TextWrapped=true;self.MaterialSummary.AutomaticSize=Enum.AutomaticSize.Y;self.MaterialSummary.TextTruncate=Enum.TextTruncate.None
    label("SAVED BLUEPRINTS · own-island block layouts, up to 300 blocks",724,34)
    local name=Instance.new("TextBox");name.Name="BlueprintName";name.Text="My island build";name.PlaceholderText="Blueprint name (1–48 bytes)"
    name.ClearTextOnFocus=false;name.TextSize=14;name.TextColor3=Color3.fromRGB(226,232,240);name.BackgroundColor3=Color3.fromRGB(29,39,48)
    name.Size=UDim2.new(1,-12,0,32);name.Position=UDim2.fromOffset(6,764);name.Parent=ctx.Parent;inputs.Name=name
    button("Slot","Blueprint slot: 1 / 5",0,804,1,function()
        if self.Running then status("Stop the build before changing its blueprint slot.");return end
        self.Slot=self.Slot%5+1
        self:InspectSlot(self.Slot);self:RefreshLibrary(false)
    end)
    button("Save","Save preview",0,844,.5,function() self:SavePreview() end)
    button("Capture","Save island area",.5,844,.5,function() self:CaptureIsland() end)
    button("Load","Load selected slot",0,884,1,function() self:LoadBlueprint() end)
    button("CaptureRange","Save radius: 30 studs",0,924,1,function()
        if self.Running then return end
        self.CaptureRange=self.CaptureRange>=120 and 15 or self.CaptureRange*2
        buttons.CaptureRange.Text="Save radius: "..self.CaptureRange.." studs"
    end)
    local hint=label("Save preview stores its shape and materials. Save island area stores nearby placed blocks on your own island. Saving overwrites the selected slot. Load never starts building. Chest contents, inventories and scripts are not saved.",966,110)
    hint.TextWrapped=true
    button("Check","Check remaining materials",0,1088,1,function() self:CheckMaterials() end)
    button("CopyCheck","Copy build check",0,1128,1,function()
        if not self.BuildReport then status("Run Check remaining materials first.");return end
        if ctx.CopyReport then ctx.CopyReport(self.BuildReport) else status("Report copying is unavailable.") end
    end)
    button("Inspect","Refresh saved slots",0,1168,1,function() self:RefreshLibrary(true) end)
    self.LibrarySummary=label("Saved slots have not been inspected. Press Refresh saved slots to read them.",1208,156)
    self.LibrarySummary.TextWrapped=true
    button("Rename","Rename selected slot",0,1376,.5,function() self:RenameSlot(inputs.Name.Text) end)
    self.CopyTarget=2
    button("CopyTarget","Copy target: 2 / 5",.5,1376,.5,function()
        if self.Running or self.WorkerToken then return end
        self.CopyTarget=self.CopyTarget%5+1;buttons.CopyTarget.Text="Copy target: "..self.CopyTarget.." / 5"
    end)
    button("CopySlot","Copy selected slot → target (overwrites target)",0,1416,1,function() self:CopySlot(self.CopyTarget) end)
    local copyHint=label("Rename uses the blueprint name field. Copy changes only the target slot; the current preview stays where it is. Choose the destination before copying.",1456,72)
    copyHint.TextWrapped=true
    label("REPLACE MATERIAL IN LOADED BLUEPRINT",1536,34)
    for index,key in ipairs({"ReplaceFrom","ReplaceTo"}) do
        local field=Instance.new("TextBox");field.Name=key;field.Text="";field.PlaceholderText=index==1 and "Existing block name" or "Replacement block name"
        field.ClearTextOnFocus=false;field.TextSize=14;field.TextColor3=Color3.fromRGB(226,232,240);field.BackgroundColor3=Color3.fromRGB(29,39,48)
        field.Size=UDim2.new(.5,-12,0,32);field.Position=UDim2.new((index-1)*.5,6,0,1578);field.Parent=ctx.Parent
        inputs[key]=field
    end
    button("Replace","Replace material",0,1618,.5,function() self:ReplaceMaterial(inputs.ReplaceFrom.Text,inputs.ReplaceTo.Text) end)
    button("UndoMaterial","Undo last edit",.5,1618,.5,function() self:UndoMaterial() end)
    local replaceHint=label("Applies to the loaded working blueprint and its preview. The saved slot is kept until Save preview. Existing placed blocks are not replaced; Start still skips occupied cells.",1660,84)
    replaceHint.TextWrapped=true
    self.Buttons=buttons;self.Inputs=inputs
    return self
end
return AutoBuild
