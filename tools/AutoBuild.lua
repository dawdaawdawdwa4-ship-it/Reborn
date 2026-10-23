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
    elseif preset == "Room" then
        assert(width>=3 and length>=3,"Rooms need width and length of at least 3")
        for z=0,length-1 do for x=0,width-1 do add(x,0,z) end end
        for y=1,height do for z=0,length-1 do for x=0,width-1 do
            local edge=x==0 or x==width-1 or z==0 or z==length-1
            local doorway=z==0 and x==math.floor(width/2) and y<=2
            if edge and not doorway then add(x,y,z) end
        end end end
    elseif preset == "Bridge" then
        assert(width>=3,"Bridges need width of at least 3 for a walkway and rails")
        for z=0,length-1 do
            for x=0,width-1 do add(x,1,z) end
            add(0,2,z);add(width-1,2,z)
        end
    elseif preset == "Fence" then
        assert(width>=3 and length>=3,"Fences need width and length of at least 3")
        for y=1,height do for z=0,length-1 do for x=0,width-1 do
            if x==0 or x==width-1 or z==0 or z==length-1 then add(x,y,z) end
        end end end
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
-- Repeat layouts or append copies of one layer on their local block grid.
function AutoBuild.RepeatPlan(data,axis,copies,gap,height)
    assert(axis=="Right" or axis=="Forward" or axis=="Up","Choose Right, Forward or Up")
    assert(type(copies)=="number" and copies%1==0 and copies>=2 and copies<=4,"Use 2–4 total copies")
    assert(type(gap)=="number" and gap%1==0 and gap>=0 and gap<=8,"Use a gap of 0–8 blocks")
    local original=AutoBuild.Validate(data)
    local source=original.Cells
    if height~=nil then
        assert(type(height)=="number" and height==height and math.abs(height)<=3000,"Choose a valid preview layer")
        source={}
        for _,cell in ipairs(original.Cells) do
            if math.round(cell.Components[2]*1000)==math.round(height*1000) then table.insert(source,cell) end
        end
        assert(#source>0,"Selected layer has no blueprint cells")
    end
    assert(#original.Cells+#source*(copies-1)<=300,"Repeated layout exceeds 300 blocks; use fewer copies or a smaller blueprint")
    local coordinate=axis=="Right" and 1 or axis=="Up" and 2 or 3
    local row=axis=="Right" and 4 or axis=="Up" and 7 or 10
    local low,high=math.huge,-math.huge
    for _,cell in ipairs(source) do
        local c=cell.Components
        -- Full block extents also account for rotated/tilted captured cells.
        local half=original.BlockSize*.5*(math.abs(c[row])+math.abs(c[row+1])+math.abs(c[row+2]))
        low=math.min(low,c[coordinate]-half);high=math.max(high,c[coordinate]+half)
    end
    local step=(math.ceil((high-low)/original.BlockSize-1e-6)+gap)*original.BlockSize
    local result={Version=1,Name=original.Name,BlockSize=original.BlockSize,Cells=table.clone(original.Cells)}
    for index=1,copies-1 do
        for _,cell in ipairs(source) do
            local c=table.clone(cell.Components)
            c[coordinate]+=index*step*(axis=="Forward" and -1 or 1)
            table.insert(result.Cells,{Material=cell.Material,Components=c})
        end
    end
    return AutoBuild.Validate(result),step
end
function AutoBuild.ValidateFavorites(data)
    assert(type(data)=="table" and data.Version==1 and type(data.Items)=="table" and #data.Items<=8,"Invalid favorites data")
    local result,seen,count={},{},0
    for index in pairs(data.Items) do
        assert(type(index)=="number" and index%1==0 and index>=1 and index<=#data.Items,"Invalid favorite list")
        count+=1
    end
    assert(count==#data.Items,"Favorite list contains gaps")
    for _,name in ipairs(data.Items) do
        assert(type(name)=="string" and #name>0 and #name<=128 and not name:find("[%c]") and name:match("^%s*(.-)%s*$")==name and not seen[name],"Invalid favorite material")
        seen[name]=true;table.insert(result,name)
    end
    return result
end
function AutoBuild.RayBox(cf,origin,direction,half,limit)
    local c={cf:GetComponents()}
    local x,y,z=origin.X-c[1],origin.Y-c[2],origin.Z-c[3]
    local o={x*c[4]+y*c[7]+z*c[10],x*c[5]+y*c[8]+z*c[11],x*c[6]+y*c[9]+z*c[12]}
    local d={direction.X*c[4]+direction.Y*c[7]+direction.Z*c[10],direction.X*c[5]+direction.Y*c[8]+direction.Z*c[11],direction.X*c[6]+direction.Y*c[9]+direction.Z*c[12]}
    local near,far=0,limit or 1000
    if d[1]^2+d[2]^2+d[3]^2<1e-12 then return nil end
    for axis=1,3 do
        if o[axis]~=o[axis] or d[axis]~=d[axis] or math.abs(o[axis])==math.huge or math.abs(d[axis])==math.huge then return nil end
        if math.abs(d[axis])<1e-8 then
            if math.abs(o[axis])>half then return nil end
        else
            local a,b=(-half-o[axis])/d[axis],(half-o[axis])/d[axis]
            near=math.max(near,math.min(a,b));far=math.min(far,math.max(a,b))
            if near>far then return nil end
        end
    end
    return near
end
function AutoBuild.new(ctx)
    local self={Paused=false,PauseEpoch=0,BuildSpeed="Standard",RepeatScope="Entire layout",RepeatCopies=2,RepeatGap=0,TravelMode="Stay",Preset="Farm plots",Width=5,Length=6,Height=3,Rotation=0,Token=0,Running=false,Cells=nil,PreviewFolder=nil,OffsetX=0,OffsetY=0,OffsetZ=0,Library={},Slot=1,CaptureRange=30,Persistence={}}
    local inputs,buttons,commits={},{},{}
    self.Favorites={};self.History={};self.UndoStack={};self.RedoStack={}
    self.Failures=setmetatable({}, {__mode="k"})
    self.MarkerColors={Occupied=Color3.fromRGB(172,126,224),Rejected=Color3.fromRGB(240,100,108),Review=Color3.fromRGB(250,209,90),Out=Color3.fromRGB(255,160,70),Unknown=Color3.fromRGB(160,170,180)}
    self.Backups={};self.BackupPersistence={}
    local space=ctx.Workspace or workspace
    local scheduler=ctx.Scheduler or task
    local now=ctx.Now or os.clock
    local function refreshProgress()
        local p=self.Progress
        local total=p and math.max(0,p.Total or 0) or 0
        local checked=p and math.min(total,(p.Placed or 0)+(p.Skipped or 0)+(p.Failed or 0)) or 0
        if p then p.Checked=checked end
        if self.ProgressSegments then
            local offset=0
            for _,key in ipairs({"Placed","Skipped","Failed"}) do
                local fraction=p and self.Cells and p.PreviewRevision==self.PlanRevision and p.Layer==self.LayerIndex and total>0 and math.clamp((p[key] or 0)/total,0,1-offset) or 0
                local segment=self.ProgressSegments[key]
                segment.Position=UDim2.new(offset,0,0,0)
                segment.Size=UDim2.new(fraction,0,1,0)
                segment.Visible=fraction>0
                offset+=fraction
            end
        end
        if self.Running and buttons.Start and p then
            local label=self.Paused and "Paused" or p.State=="Waiting for materials" and "Restock" or p.State=="Waiting for reach" and "Move closer" or "Building"
            buttons.Start.Text=label.." · "..checked.."/"..tostring(total)
        end
    end
    local function status(message)
        refreshProgress()
        local p=self.Progress
        if p and self.WorkerToken then p.Detail=tostring(message):sub(1,1024) end
        local counts=self.Running and p and p.State~="Finished" and string.format("\nRun: %d confirmed · %d skipped · %d failed",p.Placed,p.Skipped,p.Failed) or ""
        if self.Running and self.Paused then
            message=self.RequestPending and "Pausing · waiting for the current server request. Resume keeps this run."
                or "Paused · Resume continues this run; Stop ends it."
        end
        self.Status.Text=tostring(message)..counts
    end
    function self:ClearPreview()
        self.PlanRevision=(self.PlanRevision or 0)+1
        self.Failures=setmetatable({}, {__mode="k"})
        if self.PreviewFolder then self.PreviewFolder:Destroy();self.PreviewFolder=nil end
        self.Cells=nil;self.BuildReport=nil;self.SetupReport=nil;self.SetupResult=nil;self.LayerIndex=nil;self.BaseAnchor=nil
        self.WaitingMaterial=nil
        self.VisualSnapshot=nil;self.VisualCounts=nil
        self:RefreshPreviewColors()
        self.SelectedCell=nil;self.Picking=false
        if buttons.Pick then buttons.Pick.Text="Pick block: OFF" end
        if self.SelectionLabel then self.SelectionLabel.Text="No preview block selected." end
        if buttons.Layer then buttons.Layer.Text="Build: All layers" end
        self.ReachCounts=nil
        if buttons.Reach then buttons.Reach.Text=self.RangeMarkers and "Mark reach: ON" or "Mark reach: OFF" end
        if self.MaterialSummary then self.MaterialSummary.Text="Preview or load a blueprint to see its material counts." end
        if self.RefreshFailureUI then self:RefreshFailureUI() end
        refreshProgress()
    end
    local function stopTravel()
        if ctx.StopTravel then pcall(ctx.StopTravel) end
    end
    function self:SetTravelMode(mode)
        if mode~="Stay" and mode~="Walk" then return false end
        if self.Running or self.WorkerToken then status("Stop building and wait for cleanup before changing Auto Walk.");return false end
        self.TravelMode=mode
        self.SetupReport=nil;self.SetupResult=nil
        buttons.Travel.Text=mode=="Walk" and "Auto Walk: ON" or "Auto Walk: OFF"
        status(mode=="Walk" and "Auto Walk ON: Start build walks toward distant cells. Blocked paths pause the run; preview stays available."
            or "Auto Walk OFF: build waits for you to move within normal reach.")
        return true
    end
    function self:SetPaused(value)
        if type(value)~="boolean" or not ctx.Alive() or not self.Running or not self.WorkerToken then return false end
        if self.Paused==value then return true end
        self.Paused=value
        if value then self.PauseEpoch+=1;stopTravel() end
        self:RefreshFailureUI()
        status(value and "Paused" or "Resuming the current build. Reach, material and occupancy checks remain active.")
        return true
    end
    function self:Stop()
        local live=self.Running or self.WorkerToken
        self.Token+=1;self.Running=false;self.Paused=false
        stopTravel()
        -- Teleports and Stop All also call this; a finished run must keep its result.
        if not live then return end
        if self.Progress then self.Progress.State="Stopped" end
        if self.RefreshFailureUI then self:RefreshFailureUI() end
        local p=self.Progress
        status("Stopped. Remaining blocks were not sent."..(self.WorkerToken and " Finishing the current worker before Start unlocks." or "")..(p and string.format(" %d confirmed, %d skipped, %d failed; %d planned.",p.Placed,p.Skipped,p.Failed,p.Total) or ""))
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
    function self:Layers()
        local heights,seen={},{}
        for _,cell in ipairs(self.Cells or {}) do
            local y=cell.LayerY
            if y==nil then
                local ok,value=pcall(function() return cell.CFrame.Position.Y end)
                if ok then y=value end
            end
            if type(y)~="number" or y~=y or math.abs(y)==math.huge then return nil end
            local key=math.round(y*1000)/1000
            if not seen[key] then seen[key]=true;table.insert(heights,key) end
        end
        table.sort(heights)
        return heights
    end
    function self:SelectedCells()
        if not self.LayerIndex then return self.Cells or {} end
        local heights=self:Layers()
        local height=heights and heights[self.LayerIndex]
        if height==nil then return {} end
        local selected={}
        for _,cell in ipairs(self.Cells or {}) do
            local y=cell.LayerY
            if y==nil then y=cell.CFrame.Position.Y end
            if math.round(y*1000)/1000==height then table.insert(selected,cell) end
        end
        return selected
    end
    function self:RefreshPreviewColors()
        if not ctx.Alive() then return end
        local selected={};for _,cell in ipairs(self:SelectedCells()) do selected[cell]=true end
        local snapshot=self.VisualSnapshot
        local valid=snapshot and snapshot.Revision==self.PlanRevision and snapshot.Token==self.Token and snapshot.Layer==self.LayerIndex
            and snapshot.Character==ctx.Player.Character and now()>=snapshot.At and now()-snapshot.At<=30
        local counts={Occupied=0,Rejected=0,Review=0,Out=0,Unknown=0,Clear=0,Stale=not valid}
        for _,cell in ipairs(self.Cells or {}) do
            if cell.Preview then
                local color=cell.PreviewColor or Color3.fromRGB(100,160,255)
                cell.SetupState=nil
                if selected[cell] then
                    if self.SetupMarkers then
                        local row=valid and snapshot.States[cell]
                        if row and (row.CFrame~=cell.CFrame or row.Material~=cell.Material) then row=nil end
                        local failure=self.Failures[cell]
                        if failure and (failure.CFrame~=cell.CFrame or failure.Material~=cell.Material) then failure=nil end
                        local state
                        if row and row.Occupied then state="Occupied"
                        elseif failure then state=failure.Retryable and "Rejected" or "Review"
                        elseif not row then state="Unknown"
                        elseif self.RangeMarkers and cell.ReachState=="out" or not self.RangeMarkers and row.InReach==false then state="Out"
                        elseif self.RangeMarkers and cell.ReachState~="in" or not self.RangeMarkers and row.InReach==nil then state="Unknown"
                        else state="Clear" end
                        cell.SetupState=state;counts[state]+=1
                        color=self.MarkerColors[state] or color
                    elseif self.RangeMarkers then
                        if cell.ReachState=="out" then color=self.MarkerColors.Out
                        elseif cell.ReachState=="unknown" then color=self.MarkerColors.Unknown end
                    end
                end
                cell.Preview.Color=color
            end
        end
        self.VisualCounts=self.SetupMarkers and counts or nil
        if buttons.SetupMarkers then
            buttons.SetupMarkers.Text=self.SetupMarkers and "Setup marks: ON" or "Setup marks: OFF"
            local available=self.SetupMarkers or not self.Running and not self.WorkerToken
            buttons.SetupMarkers.Active=available==true;buttons.SetupMarkers.Selectable=available==true
        end
    end
    function self:SetSetupMarkers(on)
        if not ctx.Alive() or type(on)~="boolean" then return false end
        if on and (self.Running or self.WorkerToken) then status("Stop building and wait for cleanup before checking preview markers.");return false end
        self.SetupMarkers=on
        if on then self:CheckSetup() end
        self:RefreshReach();self:RefreshPreviewColors()
        if not on then status("Setup markers OFF. Reach markers still apply when enabled.") end
        return true
    end
    function self:RefreshSelection()
        local included={}
        for _,cell in ipairs(self:SelectedCells()) do included[cell]=true end
        if self.SelectedCell and (not included[self.SelectedCell] or not self.SelectedCell.Preview) then self.SelectedCell=nil end
        for _,cell in ipairs(self.Cells or {}) do
            if cell.Preview then cell.Preview.Transparency=cell==self.SelectedCell and .25 or included[cell] and .65 or .94 end
        end
        self:RefreshPreviewColors()
        if self.SelectionLabel then
            local cell=self.SelectedCell
            self.SelectionLabel.Text=cell and ("Selected block #"..tostring(table.find(self.Cells,cell))..": "..cell.Material..". Use the replacement field, then Replace selected; or Remove selected.") or "No preview block selected. Enable Pick block, then click/tap a ghost outside the hub, or use Next block."
        end
    end
    function self:SelectCell(index)
        if self.Running or self.WorkerToken then status("Wait for the build worker before selecting a block.");return false end
        local cell=index
        if type(index)=="number" then cell=self.Cells and self.Cells[index] end
        if type(cell)~="table" or not cell.Preview or not table.find(self:SelectedCells(),cell) then return false end
        self.SelectedCell=cell;self:RefreshSelection();return true
    end
    function self:SetPicking(on)
        if on and (self.Running or self.WorkerToken or not self.Cells) then status("Preview a blueprint and wait for the worker before picking blocks.");return false end
        self.Picking=on==true;buttons.Pick.Text=self.Picking and "Pick block: ON" or "Pick block: OFF"
        return true
    end
    function self:PickRay(origin,direction,limit)
        if not self.Picking or self.Running or self.WorkerToken or not ctx.Alive() then return false end
        local nearest,best=limit or 1000,nil
        for _,cell in ipairs(self:SelectedCells()) do
            if cell.Preview then
                local distance=AutoBuild.RayBox(cell.CFrame,origin,direction,(self.BlockSize-.15)/2,nearest)
                if distance and (not best or distance<nearest) then nearest=distance;best=cell end
            end
        end
        self.SelectedCell=best;self:RefreshSelection()
        return best~=nil
    end
    function self:NextBlock()
        if self.Running or self.WorkerToken then return false end
        local candidates={}
        for _,cell in ipairs(self:SelectedCells()) do if cell.Preview then table.insert(candidates,cell) end end
        if #candidates==0 then status("Preview some blocks before selecting one.");return false end
        local index=table.find(candidates,self.SelectedCell) or 0
        return self:SelectCell(candidates[index%#candidates+1])
    end
    function self:RefreshReach()
        if not self.RangeMarkers then
            if self.ReachCounts then
                for _,cell in ipairs(self.Cells or {}) do
                    cell.ReachState=nil
                    if cell.Preview then cell.Preview.Color=cell.PreviewColor or Color3.fromRGB(100,160,255) end
                end
            end
            self.ReachCounts=nil
            if buttons.Reach then buttons.Reach.Text="Mark reach: OFF" end
            self:RefreshPreviewColors()
            return nil
        end
        if not self.Cells then
            if buttons.Reach then buttons.Reach.Text="Mark reach: ON · preview first" end
            return nil
        end
        local included={}
        for _,cell in ipairs(self:SelectedCells()) do included[cell]=true end
        local _,root=characterRoot()
        local readable,reach=pcall(ctx.GameModule,"ReplicatedStorage.Shared.SharedConfig","CLIENT_REACH")
        if readable and type(reach)~="number" then reach=20 end
        local valid=readable and type(reach)=="number" and reach>0 and reach<math.huge
        local counts={InRange=0,OutOfRange=0,Unknown=0}
        for _,cell in ipairs(self.Cells) do
            if cell.Preview then
                local color=cell.PreviewColor or Color3.fromRGB(100,160,255)
                cell.ReachState=nil
                if included[cell] then
                    if not root or not valid then
                        cell.ReachState="unknown";counts.Unknown+=1;color=Color3.fromRGB(160,170,180)
                    elseif (root.Position-cell.CFrame.Position).Magnitude>reach then
                        cell.ReachState="out";counts.OutOfRange+=1;color=Color3.fromRGB(255,160,70)
                    else cell.ReachState="in";counts.InRange+=1 end
                end
                cell.Preview.Color=color
            end
        end
        self.ReachCounts=counts
        if buttons.Reach then buttons.Reach.Text="Reach: "..counts.InRange.." in / "..counts.OutOfRange.." out / "..counts.Unknown.." unknown" end
        self:RefreshPreviewColors()
        return counts
    end
    function self:CycleLayer()
        if self.Running or self.WorkerToken then status("Wait for the build worker before changing layers.");return false end
        if not self.Cells then status("Preview a blueprint before selecting a layer.");return false end
        local heights=self:Layers()
        if not heights or #heights==0 then status("Layer information is unavailable; create a new preview.");return false end
        local index=(self.LayerIndex or 0)+1
        self.LayerIndex=index<=#heights and index or nil
        self.VisualSnapshot=nil
        self.BuildReport=nil;self.SetupReport=nil;self.SetupResult=nil
        local selected=self:SelectedCells()
        self:RefreshFailureUI()
        self:RefreshSelection()
        local included={}
        for _,cell in ipairs(selected) do included[cell]=true end
        for _,cell in ipairs(self.Cells) do
            if cell.Preview then cell.Preview.Transparency=included[cell] and .65 or .94 end
        end
        buttons.Layer.Text=self.LayerIndex and ("Build: Layer "..self.LayerIndex.."/"..#heights.." · "..#selected.." blocks") or ("Build: All layers · "..#selected.." blocks")
        self:UpdateMaterials(selected)
        self:RefreshSelection();self:RefreshReach()
        status("Selected "..#selected.." of "..#self.Cells.." blocks. Faint preview blocks are excluded. Save preview still saves the full layout.")
        return true
    end
    local function makeGhost(cf,material,layerY,size,path)
        local part=Instance.new("Part")
        part.Name="PlannedBlock";part.Anchored=true;part.CanCollide=false;part.CanTouch=false;part.CanQuery=false
        part.Size=Vector3.new(size-.15,size-.15,size-.15);part.CFrame=cf
        part.Transparency=.65;part.Material=Enum.Material.ForceField
        part.Color=path and Color3.fromRGB(210,180,100) or Color3.fromRGB(100,160,255)
        part.Parent=self.PreviewFolder
        return {CFrame=cf,Material=material,Preview=part,PreviewColor=part.Color,LayerY=layerY}
    end
    function self:Preview()
        if self.Running or self.WorkerToken then status("Wait for the build worker before changing its plan.");return false end
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
        self.BaseAnchor=anchor
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
            local name=self.SavedPlan and cell.Material or cell.role=="path" and pathMaterial or material
            table.insert(self.Cells,makeGhost(cf,name,self.SavedPlan and cell.Components[2] or cell.y*size,size,cell.role=="path"))
        end
        self.BlockSize=size
        self:UpdateMaterials(self:SelectedCells())
        self:RefreshReach()
        status(string.format("Preview: %s, %d blocks. Blue = build/beds; gold = paths.",self.Preset,#self.Cells))
        return true
    end
    local function transformPreview(anchor)
        local delta=anchor*self.Anchor:Inverse()
        for _,cell in ipairs(self.Cells) do
            cell.CFrame=delta*cell.CFrame
            if cell.Preview then cell.Preview.CFrame=cell.CFrame end
        end
        self.Anchor=anchor;self.BuildReport=nil;self.SetupReport=nil;self.SetupResult=nil
        self:UpdateMaterials(self:SelectedCells())
        self:RefreshReach()
    end
    local function updateOffsetLabel()
        self.MoveLabel.Text=string.format("Offset: right %d / up %d / forward %d blocks",self.OffsetX,self.OffsetY,self.OffsetZ)
    end
    function self:Move(dx,dy,dz)
        if self.Running or self.WorkerToken then status("Wait for the build worker before moving its blueprint.");return false end
        if not self.Cells and not self:Preview() then return false end
        transformPreview(self.Anchor*CFrame.new(dx*self.BlockSize,dy*self.BlockSize,-dz*self.BlockSize))
        self.OffsetX+=dx;self.OffsetY+=dy;self.OffsetZ+=dz
        updateOffsetLabel()
        status("Blueprint moved. Start builds the visible preview positions.")
        return true
    end
    function self:RotatePreview()
        if self.Running or self.WorkerToken then status("Wait for the build worker before rotating its blueprint.");return false end
        if not self.Cells then status("Preview a blueprint before rotating it in place.");return false end
        local turn=CFrame.Angles(0,math.pi/2,0)
        local base=self.BaseAnchor or self.Anchor*CFrame.new(-self.OffsetX*self.BlockSize,-self.OffsetY*self.BlockSize,self.OffsetZ*self.BlockSize)
        self.BaseAnchor=base*turn
        transformPreview(self.Anchor*turn)
        self.OffsetX,self.OffsetZ=self.OffsetZ,-self.OffsetX
        self.Rotation=(self.Rotation+90)%360;buttons.Rotate.Text="↻ "..self.Rotation.."°"
        updateOffsetLabel()
        status("Preview rotated 90° around its anchor. Layers and unsaved material edits are retained; saved slots are unchanged.")
        return true
    end
    function self:CenterPreview()
        if self.Running or self.WorkerToken then status("Wait for the build worker before positioning its blueprint.");return false end
        if not self.Cells or #self.Cells==0 then status("Preview a blueprint before centering it.");return false end
        local _,root=characterRoot()
        if not root then status("Wait for your character before centering the preview.");return false end
        local minX,maxX,minZ,maxZ=math.huge,-math.huge,math.huge,-math.huge
        for _,cell in ipairs(self.Cells) do
            local p=cell.CFrame.Position
            minX=math.min(minX,p.X);maxX=math.max(maxX,p.X);minZ=math.min(minZ,p.Z);maxZ=math.max(maxZ,p.Z)
        end
        local look=root.CFrame.LookVector
        local yaw=math.round(math.atan2(-look.X,-look.Z)/(math.pi/2))*(math.pi/2)
        local dirX,dirZ=math.round(-math.sin(yaw)),math.round(-math.cos(yaw))
        local size=self.BlockSize
        local halfDepth=(math.abs(dirX)*(maxX-minX)+math.abs(dirZ)*(maxZ-minZ))/2
        local distance=(math.ceil(halfDepth/size)+2)*size
        local targetX=math.round(root.Position.X/size)*size+dirX*distance
        local targetZ=math.round(root.Position.Z/size)*size+dirZ*distance
        local dx=math.round((targetX-(minX+maxX)/2)/size)*size
        local dz=math.round((targetZ-(minZ+maxZ)/2)/size)*size
        local base=self.BaseAnchor or self.Anchor*CFrame.new(-self.OffsetX*size,-self.OffsetY*size,self.OffsetZ*size)
        self.BaseAnchor=base
        transformPreview(CFrame.new(dx,0,dz)*self.Anchor)
        local offset=base:ToObjectSpace(self.Anchor).Position
        self.OffsetX=math.round(offset.X/size);self.OffsetY=math.round(offset.Y/size);self.OffsetZ=math.round(-offset.Z/size)
        updateOffsetLabel()
        status("Full preview centered in front of your facing direction on grid steps. Height, orientation and layer selection are retained. Check reach before building.")
        return true
    end
    local function reportText(value)
        return tostring(value):gsub("[%c]"," "):sub(1,512)
    end
    function self:FormatHistory(run,index,total)
        local outcome=run.State=="Finished" and (run.Failed>0 or (run.Review or 0)>0 or (run.Retryable or 0)>0)
            and "Finished with unresolved cells" or run.State
        local text=string.format("Reborn build result %d/%d (newest first)\n%s · %s\n%s · %d selected / %d total planned\n%d confirmed · %d occupied/skipped · %d failed\n%d unprocessed · %.1fs elapsed",
            index,total,run.Name,outcome,run.Layer,run.Total,run.WholeTotal,run.Placed,run.Skipped,run.Failed,
            math.max(0,run.Total-run.Placed-run.Skipped-run.Failed),run.Elapsed)
        text..=run.RetryOnly and "\nRun type: Retry failed (explicitly rejected cells only)" or "\nRun type: Normal Start/Resume"
        if run.NextAction then
            text..="\nNext: "..run.NextAction
            text..="\nSettings: "..run.Speed.." · "..run.Travel.." · Attempts: "..run.Attempts.." · TOO_FAST: "..run.Cooldowns
            text..="\nLast result: "..run.LastResult.."\nDetail: "..run.Detail
            if run.WaitReason then text..="\nLast wait: "..run.WaitReason end
            text..="\nTracked cells: "..run.Retryable.." rejected · "..run.Review.." need review"
            for _,entry in ipairs(run.Failures) do
                text..="\n"..(entry.Retryable and "REJECTED" or "REVIEW").." · run cell #"..entry.Index.." · "..entry.Material.." · "..entry.Reason
            end
            if run.Retryable+run.Review>#run.Failures then text..="\nMore tracked cells: "..(run.Retryable+run.Review-#run.Failures) end
            text..="\nHistorical snapshot. Recheck the current island before retrying."
        end
        return text
    end
    function self:ShowHistory()
        if #self.History==0 then self.HistoryLabel.Text="No completed or stopped builds this session.";return false end
        self.HistoryIndex=(self.HistoryIndex or 0)%#self.History+1
        self.HistoryReport=self:FormatHistory(self.History[self.HistoryIndex],self.HistoryIndex,#self.History)
        self.HistoryLabel.Text=self.HistoryReport
        return self.HistoryReport
    end
    function self:CopyAllHistory()
        if not ctx.Alive() then return false end
        if #self.History==0 then status("No recorded build results to copy. The current active run is recorded after it ends.");return false end
        local history=table.clone(self.History)
        local lines={"Reborn Auto Build · all recorded results","Newest first · "..#history.." / 5 retained · current hub session only"}
        for index,run in ipairs(history) do table.insert(lines,self:FormatHistory(run,index,#history)) end
        local text=table.concat(lines,"\n\n")
        if ctx.CopyReport then ctx.CopyReport(text) else status("Report copying is unavailable.");return false end
        return text
    end
    local function recordBuild(progress,meta)
        local state=progress.State
        if state=="Building" or state=="Waiting for reach" or state=="Waiting for materials" then state="Stopped" end
        local failures,retryable,review={},0,0
        for index=1,progress.Total do
            local entry=meta.Failures[index]
            if entry then
                if entry.Retryable then retryable+=1 else review+=1 end
                if #failures<8 then table.insert(failures,{Index=index,Material=entry.Material,Reason=entry.Reason,Retryable=entry.Retryable}) end
            end
        end
        local nextAction=review>0 and "Inspect uncertain cells on the island before normal Resume. Retry failed excludes them."
            or retryable>0 and "Fix the recorded rejection cause, then use Retry failed for eligible cells in the current preview."
            or state=="Finished" and progress.Failed==0 and "No unresolved cells in this run."
            or "Check the current preview and setup, then Resume build when ready."
        table.insert(self.History,1,{Name=meta.Name,Layer=meta.Layer,WholeTotal=meta.WholeTotal,Total=progress.Total,
            Placed=progress.Placed,Skipped=progress.Skipped,Failed=progress.Failed,State=state,Elapsed=math.max(0,(meta.Ended or now())-meta.Started),RetryOnly=meta.RetryOnly==true,
            Speed=meta.Speed,Travel=meta.Travel,Attempts=meta.Attempts,Cooldowns=meta.Cooldowns,LastResult=meta.LastResult,
            Detail=reportText(progress.Detail or state),WaitReason=progress.WaitReason and reportText(progress.WaitReason) or nil,
            Failures=failures,Retryable=retryable,Review=review,NextAction=nextAction})
        while #self.History>5 do table.remove(self.History) end
        self.HistoryIndex=0;self.HistoryReport=nil
        if ctx.Alive() then self.HistoryLabel.Text="Latest build recorded. View results to inspect the last "..#self.History.." runs (session only)." end
    end
    function self:FailureCounts()
        local counts={Retryable=0,Review=0}
        for _,cell in ipairs(self:SelectedCells()) do
            local failure=self.Failures[cell]
            if failure and failure.CFrame==cell.CFrame and failure.Material==cell.Material then
                if failure.Retryable then counts.Retryable+=1 else counts.Review+=1 end
            end
        end
        return counts
    end
    function self:FailureReport()
        local lines,total={},0
        for _,cell in ipairs(self:SelectedCells()) do
            local failure=self.Failures[cell]
            if failure and failure.CFrame==cell.CFrame and failure.Material==cell.Material then
                total+=1
                if total<=8 then table.insert(lines,(failure.Retryable and "REJECTED" or "REVIEW").." · blueprint block #"..tostring(table.find(self.Cells,cell)).." · "..cell.Material.." · "..failure.Reason) end
            end
        end
        if total>8 then table.insert(lines,(total-8).." more tracked failures; report shows the first 8 in this layer.") end
        return #lines>0 and table.concat(lines,"\n") or "No matching placement failures in this layer."
    end
    function self:RefreshFailureUI()
        if not buttons.RetryFailed then return end
        local editing=ctx.Alive() and not self.Running and not self.WorkerToken
        if buttons.Start then
            buttons.Start.Active=editing==true;buttons.Start.Selectable=editing==true
            if not self.Running then
                buttons.Start.Text=self.WorkerToken and "Finishing…" or self.Cells and self.Progress and self.Progress.PreviewRevision==self.PlanRevision and self.Progress.Layer==self.LayerIndex and self.Progress.State~="Finished" and "Resume build" or "Start build"
            end
        end
        if buttons.Stop then
            local canStop=ctx.Alive() and self.Running
            buttons.Stop.Active=canStop==true;buttons.Stop.Selectable=canStop==true
            buttons.Stop.Text=not self.Running and self.WorkerToken and "Stopping…" or "Stop"
        end
        for _,key in ipairs({"Check","CopyMissing","CopyCheck","CopySetup","CheckSetup"}) do
            if buttons[key] then buttons[key].Active=editing==true;buttons[key].Selectable=editing==true end
        end
        for _,key in ipairs({"RepeatCopies","RepeatGap","RepeatScope","RepeatRight","RepeatForward","RepeatUp"}) do
            if buttons[key] then
                buttons[key].Active=editing==true;buttons[key].Selectable=editing==true;buttons[key].AutoButtonColor=editing==true
            end
        end
        if buttons.Speed then
            buttons.Speed.Active=editing==true;buttons.Speed.Selectable=editing==true
        end
        if buttons.Pause then
            local canPause=ctx.Alive() and self.Running and self.WorkerToken~=nil
            buttons.Pause.Active=canPause==true;buttons.Pause.Selectable=canPause==true
            buttons.Pause.Text=self.Paused and "Resume" or "Pause"
        end
        local counts=self:FailureCounts()
        local available=ctx.Alive() and not self.Running and not self.WorkerToken and counts.Retryable>0
        buttons.RetryFailed.Active=available==true;buttons.RetryFailed.Selectable=available==true
        if self.SetupMarkers then self:RefreshPreviewColors() end
        refreshProgress()
    end
    local function markFailure(cell,reason,retryable,run,index)
        self.Failures[cell]={CFrame=cell.CFrame,Material=cell.Material,Reason=tostring(reason),Retryable=retryable==true}
        run.Failures[index]={Material=reportText(cell.Material),Reason=reportText(reason),Retryable=retryable==true}
        if self.SetupMarkers then self:RefreshPreviewColors() end
    end
    function self:RetryFailures() return self:Start(true) end
    function self:DiagnosticReport()
        local ready,reason=true,"Placement readiness check unavailable"
        if ctx.PlacementReady then ready,reason=ctx.PlacementReady() end
        local p=self.Progress or {}
        local failures=self:FailureCounts()
        return table.concat({"Reborn Auto Build diagnostics", "Placement ready: "..tostring(ready).." · "..tostring(reason),
            "Running: "..tostring(self.Running).."; request cleanup: "..tostring(self.WorkerToken~=nil),
            "Paused: "..tostring(self.Paused).."; request in flight: "..tostring(self.RequestPending==true),
            "Waiting for material: "..tostring(self.WaitingMaterial or "none"),
            "Build speed: "..self.BuildSpeed.."; current request gap: "..tostring(self.CurrentBuildGap or (self.BuildSpeed=="Fast" and .05 or .2)).."; cooldowns: "..tostring(self.BuildCooldowns or 0),
            "Build movement: "..self.TravelMode.."; last walk: "..tostring(self.LastTravelResult or "none"),
            "Preview cells: "..tostring(self.Cells and #self.Cells or 0).."; selected: "..#self:SelectedCells(),
            "State: "..tostring(p.State or "not started").."; cell: "..tostring(p.Index or 0).." / "..tostring(p.Total or 0),
            "Confirmed: "..tostring(p.Placed or 0).."; skipped: "..tostring(p.Skipped or 0).."; failed: "..tostring(p.Failed or 0),
            "Rejected cells eligible for Retry failed: "..failures.Retryable.."; uncertain cells needing review: "..failures.Review,
            self:FailureReport(),
            "Last placement: "..tostring(self.LastPlacementResult or "none"),"Status: "..tostring(self.Status.Text),
            "Setup snapshot: "..tostring(self.SetupReport or "not checked; use Check setup")},"\n")
    end
    local function resultText(value)
        if type(value)=="table" then return tostring(value.error or value.code or value.message or value.success or "unrecognized server result") end
        return tostring(value)
    end
    function self:SetBuildSpeed(value)
        if not ctx.Alive() then return false end
        if self.Running or self.WorkerToken then status("Stop the build and wait for cleanup before changing speed.");return false end
        if value~="Standard" and value~="Fast" then return false end
        self.BuildSpeed=value
        buttons.Speed.Text="Speed: "..value.."  ▼"
        for index,choice in ipairs({"Standard","Fast"}) do
            self.SpeedOptions[index].Text=(choice==value and "✓  " or "    ")..choice..(choice=="Fast" and " · 0.05s target" or " · 0.20s target")
        end
        self:CloseMenus()
        status(value=="Fast" and "Fast: target 0.05s between requests, including server/confirmation time. Server cooldown adapts the pace."
            or "Standard: target 0.20s between requests, including server/confirmation time. Existing blocks skip quickly.")
        return true
    end
    function self:Start(retryFailed)
        if ctx.BuildBlocked then local reason=ctx.BuildBlocked();if reason then status(reason);return false end end
        if self.Running then return false end
        if self.WorkerToken then status("Wait for the previous build request to finish before resuming.");return false end
        local travelMode=self.TravelMode
        if travelMode=="Walk" then
            if not ctx.Approach then status("Auto Walk unavailable. Turn it OFF to build while moving manually.");return false end
            local reason=ctx.TravelBlocked and ctx.TravelBlocked()
            if reason then status(tostring(reason));return false end
        end
        if ctx.PlacementReady then
            local ready,reason=ctx.PlacementReady()
            if not ready then status(reason);return false end
        end
        if retryFailed==true and not self.Cells then status("No failed cells in a current preview. Preview and build first.");return false end
        if not self.Cells and not self:Preview() then return end
        local cells=self:SelectedCells()
        if retryFailed==true then
            local rejected={}
            for _,cell in ipairs(cells) do
                local failure=self.Failures[cell]
                if failure and failure.Retryable and failure.CFrame==cell.CFrame and failure.Material==cell.Material then table.insert(rejected,cell) end
            end
            cells=rejected
            if #cells==0 then status("No eligible rejected cells in this layer. Uncertain requests need island review; use normal Resume after inspecting them.");return false end
        end
        if #cells==0 then status("No blocks selected. Choose All layers or create a new preview.");return false end
        if self.Running or self.WorkerToken then return false end
        if self.TravelMode~=travelMode then status("Build movement changed during setup. Press Start again.");return false end
        self:CloseMenus()
        local minimumGap=self.BuildSpeed=="Fast" and .05 or .2
        local gap,successes=minimumGap,0
        self.CurrentBuildGap=gap;self.BuildCooldowns=0;self.WaitingMaterial=nil;self.Paused=false;self.RequestPending=false
        self.Token+=1
        local token=self.Token
        self.WorkerToken=token
        self.VisualSnapshot=nil
        self.SetupReport=nil;self.SetupResult=nil
        self.Progress={Placed=0,Skipped=0,Failed=0,Total=#cells,Index=0,State="Building",RetryOnly=retryFailed==true,PreviewRevision=self.PlanRevision,Layer=self.LayerIndex}
        local progress=self.Progress
        local meta={Name=self.SavedPlan and self.SavedPlan.Name or self.Preset,Layer=self.LayerIndex and "Layer "..self.LayerIndex or "All layers",WholeTotal=#self.Cells,Started=now(),RetryOnly=retryFailed==true,
            Speed=self.BuildSpeed,Travel=travelMode,Attempts=0,Cooldowns=0,LastResult="No placement request sent",Failures={}}
        self.Picking=false;self.SelectedCell=nil;self:RefreshSelection()
        if buttons.Pick then buttons.Pick.Text="Pick block: OFF" end
        self.Running=true;buttons.Start.Text="Building…"
        self:RefreshFailureUI()
        if self.MoveMenu then self.MoveMenu.Visible=false end
        local function active() return self.Running and self.Token==token and ctx.Alive() end
        local function awaitResume()
            while active() and self.Paused do scheduler.wait(.1) end
            return active()
        end
        local function ensureMaterials(cell,index)
            local waited=false
            while active() do
                if not awaitResume() then return false end
                if occupied(cell.CFrame,self.BlockSize) then self.WaitingMaterial=nil;return true end
                local epoch=self.PauseEpoch
                local ok,quantity=false,nil
                if type(ctx.ItemCount)=="function" then ok,quantity=pcall(ctx.ItemCount,cell.Material) end
                if not active() then return false end
                if self.PauseEpoch~=epoch then continue end
                local valid=ok and type(quantity)=="number" and quantity==quantity and quantity>=0 and quantity<math.huge and quantity%1==0
                if valid and quantity>0 or not valid and not waited then
                    self.WaitingMaterial=nil
                    return true
                end
                waited=true;self.WaitingMaterial=cell.Material
                progress.State="Waiting for materials"
                progress.WaitReason="Material: "..cell.Material
                status("Waiting for "..cell.Material.." · block "..index.."/"..#cells
                    ..(valid and " · inventory is empty. Restock to continue, or press Stop." or " · waiting for a readable quantity after empty stock. Stop cancels."))
                scheduler.wait(.25)
            end
            return false
        end
        -- Both the initial request and cooldown retries use fresh reach/occupancy
        -- observations. A path result alone never authorizes a placement.
        local function ensureReach(cell,reach,index)
            local function blocked() return ctx.TravelBlocked and ctx.TravelBlocked() end
            local function pause(reason)
                stopTravel()
                self.LastTravelResult=tostring(reason)
                progress.State="Walking paused"
                progress.WaitReason="Walking: "..tostring(reason)
                status("Auto Walk paused: "..tostring(reason).." Preview kept; fix the route or turn Auto Walk OFF, then Resume build.")
                return false
            end
            while active() do
                if not awaitResume() then return false end
                if travelMode=="Walk" then
                    local reason=blocked()
                    if reason then return pause(reason) end
                end
                if occupied(cell.CFrame,self.BlockSize) then return true end
                local _,root=characterRoot()
                if root and (root.Position-cell.CFrame.Position).Magnitude<=reach then return true end
                if root and travelMode=="Walk" then
                    progress.State="Walking to block"
                    status(string.format("Walking to block %d/%d · normal reach %g studs · Stop cancels movement",index,#cells,reach))
                    local epoch=self.PauseEpoch
                    local arrived,reason=ctx.Approach(cell,reach,function() return active() and not self.Paused and not blocked() end)
                    if not active() then return false end
                    if self.PauseEpoch~=epoch then continue end
                    local conflict=blocked()
                    if conflict then return pause(conflict) end
                    if occupied(cell.CFrame,self.BlockSize) then return true end
                    if not arrived then return pause(reason or "Could not reach this block") end
                    _,root=characterRoot()
                    if not root or (root.Position-cell.CFrame.Position).Magnitude>reach then
                        return pause("Walk finished outside placement reach")
                    end
                    self.LastTravelResult="Reached block "..index
                else
                    progress.State="Waiting for reach"
                    progress.WaitReason=root and ("Reach: move within "..reach.." studs of run cell #"..index) or "Character not ready"
                    status(root and string.format("Move within %g studs of block %d/%d, or press Stop.",reach,index,#cells)
                        or "Waiting for your character · Stop cancels the build")
                    scheduler.wait(.2)
                end
            end
            return false
        end
        scheduler.spawn(function()
            local placed,skipped,failed,streak=0,0,0,0
            local ok,err=pcall(function()
                for index,cell in ipairs(cells) do
                    if not awaitResume() then return end
                    local cycleAt=now()
                    self.Progress.Index=index
                    local existing=occupied(cell.CFrame,self.BlockSize)
                    local confirmed=false
                    if existing then
                        skipped+=1
                    else
                        local reach=ctx.GameModule("ReplicatedStorage.Shared.SharedConfig","CLIENT_REACH")
                        if type(reach)~="number" or not (reach>0 and reach<math.huge) then reach=20 end
                        if not ensureMaterials(cell,index) then return end
                        if not ensureReach(cell,reach,index) then return end
                        if not active() then return end
                        existing=existing or occupied(cell.CFrame,self.BlockSize)
                        if existing then
                            skipped+=1
                        else
                            local sent,reason,origin
                            local retries=0
                            repeat
                                if not awaitResume() then return end
                                local epoch=self.PauseEpoch
                                if not ensureMaterials(cell,index) then return end
                                if not ensureReach(cell,reach,index) then return end
                                if not active() then return end
                                local alreadyPlaced=occupied(cell.CFrame,self.BlockSize)
                                if not active() then return end
                                if self.PauseEpoch~=epoch then continue end
                                if alreadyPlaced then existing=true;sent=true;break end
                                progress.State="Building"
                                status(string.format("Building %d/%d: %s",index,#cells,cell.Material))
                                markFailure(cell,"Request in flight or confirmation not observed",false,meta,index)
                                cycleAt=now()
                                self.RequestPending=true
                                meta.Attempts+=1;meta.LastResult="Request sent; result pending"
                                sent,reason,origin=ctx.Place({cframe=cell.CFrame,blockType=cell.Material})
                                self.RequestPending=false
                                local resultLabel=sent and "Accepted: " or origin=="transport" and "Transport error: " or origin=="unavailable" and "Unavailable: " or "Rejected: "
                                self.LastPlacementResult=resultLabel..resultText(reason)
                                meta.LastResult=reportText(self.LastPlacementResult)
                                if not active() then return end
                                local cooldown=not sent and origin~="transport" and origin~="unavailable" and type(reason)=="table" and (reason.error=="TOO_FAST" or reason.code=="TOO_FAST")
                                if not sent then
                                    local rejected=origin=="rejected" or type(reason)=="table" and reason.success==false or cooldown
                                    markFailure(cell,resultText(reason),rejected and origin~="transport" and origin~="unavailable",meta,index)
                                end
                                if not cooldown then break end
                                successes=0;gap=math.min(.8,math.max(gap*1.5,gap+.05))
                                self.CurrentBuildGap=gap;self.BuildCooldowns+=1;meta.Cooldowns+=1
                                retries+=1
                                if retries>5 then
                                    progress.Failed+=1;progress.State="Paused after cooldown"
                                    status("Server cooldown persisted after 5 retries. Preview kept; wait, then Resume build.")
                                    return
                                end
                                progress.State="Waiting for server cooldown"
                                progress.WaitReason="Server cooldown at run cell #"..index.." · retry "..retries.."/5"
                                status("Server cooldown · retrying block "..index.." / "..#cells.." ("..retries.."/5)")
                                for _=1,math.ceil(math.min(4,.5*2^(retries-1))/.1) do
                                    if not awaitResume() then return end
                                    scheduler.wait(.1)
                                end
                                if not active() then return end
                                if occupied(cell.CFrame,self.BlockSize) then existing=true;sent=true;break end
                                if not ensureReach(cell,reach,index) then return end
                                if not active() then return end
                                if occupied(cell.CFrame,self.BlockSize) then existing=true;sent=true;break end
                            until not active()
                            if not active() then return end
                            if origin=="transport" or origin=="unavailable" then
                                progress.Failed+=1;progress.State="Placement needs review"
                                if origin=="unavailable" then
                                    status("Placement unavailable: "..resultText(reason)..". Learn placement again, then Resume build.")
                                else
                                    status("Placement stopped: "..resultText(reason)..". Check the island before resuming; no further blocks sent.")
                                end
                                return
                            end
                            if sent then
                                progress.State="Confirming block"
                                status("Confirming block "..index.." / "..#cells.." · waiting for island replication")
                                local deadline=now()+5
                                repeat
                                    if not active() then return end
                                    confirmed=occupied(cell.CFrame,self.BlockSize)
                                    if confirmed then break end
                                    scheduler.wait(.05)
                                until now()>=deadline
                                if not active() then return end
                            end
                            if existing then skipped+=1;streak=0
                            elseif confirmed then
                                placed+=1;streak=0;successes+=1
                                if successes>=5 then gap=math.max(minimumGap,gap*.85);self.CurrentBuildGap=gap;successes=0 end
                            else failed+=1;streak+=1 end
                            self.Progress.Placed=placed;self.Progress.Skipped=skipped;self.Progress.Failed=failed
                            if streak>=3 then
                                self.Progress.State="Paused after failures"
                                status("Build paused after 3 failures: "..resultText(reason or "no block appeared")..". Check materials, support and island access.")
                                return
                            end
                        end
                    end
                    self.Progress.Placed=placed;self.Progress.Skipped=skipped;self.Progress.Failed=failed
                    refreshProgress()
                    if existing or confirmed then self.Failures[cell]=nil;meta.Failures[index]=nil end
                    if (existing or confirmed) and cell.Preview then cell.Preview:Destroy();cell.Preview=nil end
                    -- Server time and replication already consumed part of the target
                    -- interval. Existing cells only need a short cancellation yield.
                    local elapsed=math.max(0,now()-cycleAt)
                    scheduler.wait(existing and .01 or math.max(.01,gap-elapsed))
                end
                if active() then self.Progress.State="Finished";status(string.format((failed>0 and "Finished with failures: " or "Finished: ").."%d confirmed, %d occupied/skipped, %d failed.",placed,skipped,failed)) end
            end)
            meta.Ended=now()
            if not ok and meta.LastResult=="Request sent; result pending" then meta.LastResult="Transport error: "..reportText(err) end
            stopTravel()
            if self.WorkerToken==token then self.WorkerToken=nil;self.WaitingMaterial=nil;self.RequestPending=false end
            if self.Token==token then
                self.Running=false;self.Paused=false;buttons.Start.Text=progress.State=="Finished" and "Start build" or "Resume build"
                if not ok then
                    progress.State="Error";progress.Detail="Build stopped: "..reportText(err)
                    status(progress.Detail)
                elseif progress.Detail then
                    -- A pause during the last request showed the pause hint over the final result.
                    status(progress.Detail)
                end
            end
            if ctx.Alive() then self:RefreshFailureUI() end
            recordBuild(progress,meta)
        end)
        return true
    end
    function self:RefreshFavorites()
        for key,control in pairs(self.FavoriteButtons or {}) do
            local name=inputs[key].Text:match("^%s*(.-)%s*$")
            control.Text=table.find(self.Favorites,name) and "★ Saved" or "☆ Save"
        end
    end
    function self:LoadFavorites()
        if not ctx.ReadFavorites then return false end
        local ran,data=pcall(ctx.ReadFavorites)
        if not ran or data==nil then return false end
        local valid,items=pcall(AutoBuild.ValidateFavorites,data)
        if not valid then return false end
        self.Favorites=items;self:RefreshFavorites();return true
    end
    function self:ToggleFavorite(key)
        if key~="Material" and key~="Path" then return false end
        local name=inputs[key].Text:match("^%s*(.-)%s*$")
        if #name==0 or #name>128 or name:find("[%c]") then status("Enter a block name of 1–128 bytes first.");return false end
        local index=table.find(self.Favorites,name)
        if not index and #self.Favorites>=8 then status("Eight favorites are already saved. Remove one with its star first.");return false end
        local updated=table.clone(self.Favorites)
        if index then table.remove(updated,index) else table.insert(updated,name) end
        self.Favorites=updated;self:RefreshFavorites()
        local persisted=false
        if ctx.WriteFavorites then local ok,result=pcall(ctx.WriteFavorites,{Version=1,Items=table.clone(updated)});persisted=ok and result==true end
        status((index and "Removed " or "Favorited ")..name..". "..(persisted and "Saved to file." or "Session only; favorite file saving is unavailable or failed."))
        return true
    end
    function self:UseFavorite(key)
        if key~="Material" and key~="Path" then return false end
        if self.Running or self.WorkerToken then status("Wait for the build worker before changing materials.");return false end
        if self.SavedPlan then status("Choose a generated blueprint to use favorites; loaded layouts use Replace material.");return false end
        if #self.Favorites==0 then status("Save a material with its star before cycling favorites.");return false end
        local index=table.find(self.Favorites,inputs[key].Text) or 0
        inputs[key].Text=self.Favorites[index%#self.Favorites+1]
        commits[key]()
        status("Selected favorite "..inputs[key].Text..". Preview the updated generated plan.")
        return true
    end
    function self:UpdateMaterials(cells)
        self.PlanRevision=(self.PlanRevision or 0)+1
        self.VisualSnapshot=nil
        self.SetupReport=nil;self.SetupResult=nil
        self:RefreshFailureUI()
        self:RefreshPreviewColors()
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
    function self:InspectBackup(slot)
        if type(slot)~="number" or slot%1~=0 or slot<1 or slot>5 then return nil,"Invalid backup slot" end
        if self.Backups[slot] then return self.Backups[slot],self.BackupPersistence[slot] or "Session only" end
        local function unavailable(reason) self.BackupPersistence[slot]=reason;return nil,reason end
        if not ctx.ReadBlueprintBackup then return unavailable("No backup file access") end
        local ran,data=pcall(ctx.ReadBlueprintBackup,slot)
        if not ran then return unavailable("Backup file unavailable") end
        if data==nil then return unavailable("No backup saved") end
        local valid,copy=pcall(AutoBuild.Validate,data)
        if not valid then return unavailable("Invalid backup file") end
        self.Backups[slot]=copy;self.BackupPersistence[slot]="Loaded from file"
        return copy,"Loaded from file"
    end
    function self:RefreshBackup(readFile)
        local data,source=self.Backups[self.Slot],self.BackupPersistence[self.Slot] or "Not inspected; Refresh saved slots to check"
        if readFile then data,source=self:InspectBackup(self.Slot) end
        if self.BackupSummary then self.BackupSummary.Text="BACKUP · slot "..self.Slot..": "..(data and (data.Name.." · "..#data.Cells.." blocks · "..source) or source) end
    end
    local function sameBlueprint(a,b)
        if a.Name~=b.Name or a.BlockSize~=b.BlockSize or #a.Cells~=#b.Cells then return false end
        for index,cell in ipairs(a.Cells) do
            local other=b.Cells[index]
            if cell.Material~=other.Material then return false end
            for i=1,12 do if cell.Components[i]~=other.Components[i] then return false end end
        end
        return true
    end
    function self:StoreBlueprint(data,slot)
        if self.Running or self.WorkerToken then status("Wait for the build worker to finish before changing saved slots.");return false end
        if slot==nil then slot=self.Slot end
        if type(slot)~="number" or slot%1~=0 or slot<1 or slot>5 then status("Choose a slot from 1 to 5.");return false end
        local ok,copy=pcall(AutoBuild.Validate,data)
        if not ok then status(copy);return false end
        local previous=self:InspectSlot(slot)
        if previous then
            local valid,original=pcall(AutoBuild.Validate,previous)
            if valid and not sameBlueprint(original,copy) then
                self.Backups[slot]=original;self.BackupPersistence[slot]="Session only"
            end
        end
        self.Library[slot]=copy
        local persisted=false
        if ctx.WriteBlueprint then
            local ran,result=pcall(ctx.WriteBlueprint,slot,copy,self.Backups[slot] and AutoBuild.Validate(self.Backups[slot]) or nil)
            persisted=ran and result==true
        end
        self.Persistence[slot]=persisted and "File + session" or "Session only"
        if persisted and self.Backups[slot] then self.BackupPersistence[slot]="File + session" end
        self:RefreshLibrary(false)
        status("Saved slot "..slot..": "..copy.Name.." ("..#copy.Cells.." blocks). "..(persisted and "Saved to file." or "Session only; file/backup saving is unavailable or failed. Existing disk data was not replaced if backup saving failed."))
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
        self:RefreshBackup(readFiles)
        return table.concat(lines,"\n")
    end
    function self:CheckMaterials()
        if not ctx.Alive() then return false end
        if self.Running or self.WorkerToken then status("Finish or stop the current build request before checking materials.");return false end
        if not self.Cells then status("Preview at the intended position before checking materials.");return false end
        self.BuildReport=nil
        local cells=self:SelectedCells()
        local checkedCells,checkedToken,checkedLayer,revision=self.Cells,self.Token,self.LayerIndex,self.PlanRevision
        local checkedCharacter=ctx.Player.Character
        self.VisualSnapshot=nil;self:RefreshPreviewColors()
        self.SetupReport=nil;self.SetupResult=nil
        if #cells==0 then status("No blocks selected. Choose All layers or refresh the preview.");return false end
        local pending,skipped,reachable,states={},0,0,{}
        local rootRead,_,root=pcall(characterRoot)
        if not rootRead then root=nil end
        local reachRead,reach=pcall(ctx.GameModule,"ReplicatedStorage.Shared.SharedConfig","CLIENT_REACH")
        local fallback=not reachRead or type(reach)~="number" or not (reach>0 and reach<math.huge)
        if fallback then reach=20 end
        local ok,err=pcall(function()
            for _,cell in ipairs(cells) do
                local existing=occupied(cell.CFrame,self.BlockSize)
                local inReach
                if not existing and root then inReach=(root.Position-cell.CFrame.Position).Magnitude<=reach end
                states[cell]={CFrame=cell.CFrame,Material=cell.Material,Occupied=existing,InReach=inReach}
                if existing then skipped+=1
                else
                    pending[cell.Material]=(pending[cell.Material] or 0)+1
                    if inReach then reachable+=1 end
                end
            end
        end)
        if not ctx.Alive() or self.Cells~=checkedCells or self.Token~=checkedToken or self.LayerIndex~=checkedLayer or self.PlanRevision~=revision or ctx.Player.Character~=checkedCharacter or self.Running or self.WorkerToken then return false end
        if not ok then status("Could not check world occupancy: "..tostring(err));return false end
        local names,total={},0
        for material,amount in pairs(pending) do table.insert(names,material);total+=amount end
        table.sort(names)
        local lines={"BUILD CHECK · snapshot",#cells.." selected of "..#checkedCells.." planned · "..skipped.." occupied · "..total.." remaining",reachable.." remaining cells currently in reach"}
        local quantities,short,unknown={},0,0
        for _,material in ipairs(names) do
            local count
            if ctx.ItemCount then local ran,value=pcall(ctx.ItemCount,material);if ran then count=value end end
            local valid=type(count)=="number" and count>=0 and count%1==0 and count<=9007199254740991
            local missing=valid and math.max(0,pending[material]-count) or nil
            quantities[material]={Need=pending[material],Owned=valid and count or nil,Missing=missing}
            if not valid then unknown+=1 elseif missing>0 then short+=1 end
            table.insert(lines,material..": need "..pending[material]..(valid and (", owned "..count..", short "..math.max(0,pending[material]-count)) or ", owned quantity unknown"))
        end
        table.insert(lines,"Occupied cells may contain a different block. Materials, support and permissions remain server-controlled.")
        if not ctx.Alive() or self.Cells~=checkedCells or self.Token~=checkedToken or self.LayerIndex~=checkedLayer or self.PlanRevision~=revision or ctx.Player.Character~=checkedCharacter or self.Running or self.WorkerToken then return false end
        self.VisualSnapshot={States=states,Revision=revision,Token=checkedToken,Layer=checkedLayer,Character=checkedCharacter,At=now()}
        self:RefreshPreviewColors()
        self.BuildReport=table.concat(lines,"\n")
        self.MaterialSummary.Text=self.BuildReport
        status("Build check ready. No blocks were placed. Refresh after inventory or world changes.")
        return {Remaining=total,Occupied=skipped,Reachable=reachable,Materials=pending,Selected=#cells,Excluded=#self.Cells-#cells,
            Quantities=quantities,ShortTypes=short,UnknownTypes=unknown,RootAvailable=root~=nil,Reach=reach,ReachFallback=fallback,Layer=checkedLayer}
    end
    function self:CopyMissingMaterials()
        local check=self:CheckMaterials()
        if not check then return false end
        local names={}
        for name,quantity in pairs(check.Quantities) do
            if quantity.Missing==nil or quantity.Missing>0 then table.insert(names,name) end
        end
        table.sort(names)
        local lines={"Reborn Auto Build · Restock list",
            check.Layer and ("Selected layer: "..check.Layer) or "All layers",
            check.Selected.." selected · "..check.Occupied.." occupied/skipped · "..check.Remaining.." remaining",
            "Known shortages: "..check.ShortTypes.." material types · unknown quantities: "..check.UnknownTypes}
        for _,name in ipairs(names) do
            local quantity=check.Quantities[name]
            table.insert(lines,quantity.Missing==nil
                and (name.." · need "..quantity.Need.." · owned unknown; shortage unknown")
                or (name.." ×"..quantity.Missing.." · need "..quantity.Need.." · owned "..quantity.Owned))
        end
        if check.Remaining==0 then table.insert(lines,"No blocks needed; all selected cells are occupied.")
        elseif #names==0 then table.insert(lines,"Readable inventory covers all remaining selected cells.") end
        table.insert(lines,"Fresh read-only snapshot. Recheck after restocking or world changes. No blocks placed, materials reserved or chests accessed.")
        local report=table.concat(lines,"\n")
        if not ctx.CopyReport then status("Report copying is unavailable.");return false end
        ctx.CopyReport(report)
        return report
    end
    function self:CheckSetup()
        if not ctx.Alive() then return false end
        if self.Running or self.WorkerToken then status("Stop building and wait for request cleanup before checking setup.");return false end
        self.SetupReport=nil;self.SetupResult=nil
        local cells,token,layer,revision,travelMode=self.Cells,self.Token,self.LayerIndex,self.PlanRevision,self.TravelMode
        local function current()
            return ctx.Alive() and self.Cells==cells and self.Token==token and self.LayerIndex==layer and self.PlanRevision==revision and self.TravelMode==travelMode and not self.Running and not self.WorkerToken
        end
        local result={Checks={},States={},Actions=0,Unknown=0}
        local function add(name,state,detail)
            table.insert(result.Checks,{Name=name,State=state,Detail=detail})
            result.States[name]=state
            if state=="ACTION" then result.Actions+=1 elseif state=="UNKNOWN" then result.Unknown+=1 end
        end
        if ctx.BuildBlocked then
            local ok,reason=pcall(ctx.BuildBlocked)
            if not ok then add("Automation","UNKNOWN","Could not check other automation")
            elseif reason then add("Automation","ACTION",tostring(reason))
            else add("Automation","OK","No build blocker reported") end
        end
        add("Movement","INFO",self.TravelMode=="Walk" and "Auto Walk ON; paths are checked only during a run" or "Auto Walk OFF; move manually when outside reach")
        if self.TravelMode=="Walk" and ctx.TravelBlocked then
            local ok,reason=pcall(ctx.TravelBlocked)
            if not ok then add("Walking","UNKNOWN","Could not check movement conflicts")
            elseif reason then add("Walking","ACTION",tostring(reason)) end
        end
        if ctx.PlacementReady then
            local ok,ready,reason=pcall(ctx.PlacementReady)
            add("Placement",not ok and "UNKNOWN" or ready==true and "OK" or ready==false and "ACTION" or "UNKNOWN",
                ok and tostring(reason or (ready and "Placement route available" or "Use Learn placement, then place one block manually")) or "Placement readiness could not be read")
        else add("Placement","UNKNOWN","Placement readiness check unavailable") end
        if not current() then return false end
        local ok,char,root=pcall(characterRoot)
        add("Character",ok and root and "OK" or "ACTION",ok and root and "Character root available" or "Wait for your character to spawn")
        local selected=self:SelectedCells()
        if not self.Cells or #selected==0 then
            add("Preview","ACTION","Preview at the intended position and select at least one block")
        else
            add("Preview","OK",#selected.." selected of "..#self.Cells.." planned")
            local ran,check=pcall(function() return self:CheckMaterials() end)
            if ran and type(check)=="table" then
                result.Materials=check
                add("Occupied","INFO",check.Occupied.." selected cells will be skipped; existing block type is not verified")
                if check.ShortTypes>0 then add("Materials","ACTION",check.ShortTypes.." material types short; "..check.UnknownTypes.." quantities unknown")
                elseif check.UnknownTypes>0 then add("Materials","UNKNOWN",check.UnknownTypes.." inventory quantities unreadable")
                else add("Materials","OK",check.Remaining==0 and "No materials needed; all selected cells occupied" or "Readable inventory covers the remaining cells") end
                if check.ShortTypes>0 and check.UnknownTypes>0 then add("Inventory reads","UNKNOWN",check.UnknownTypes.." quantities unreadable; additional shortages may exist") end
                if check.Remaining==0 then add("Reach","INFO","No empty selected cells to place")
                elseif not check.RootAvailable then add("Reach","UNKNOWN","Character root unavailable; remaining-cell reach unknown")
                else
                    local outside=check.Remaining-check.Reachable
                    add("Reach",outside>0 and "ACTION" or "OK",check.Reachable.." in / "..outside.." out of reach · "..check.Reach.." studs"..(check.ReachFallback and " (normal fallback)" or "")..(outside>0 and "; move closer or build a nearer layer" or ""))
                end
            else add("World/materials","UNKNOWN","Could not read occupancy or inventory. Refresh after the world settles.") end
        end
        -- Lookups can yield. Never publish results over a changed plan, a new
        -- worker, a different selected layer or a destroyed hub.
        if not current() then return false end
        result.Summary=result.Materials and result.Materials.Remaining==0 and "NOTHING TO PLACE" or result.Actions>0 and "ACTION NEEDED" or result.Unknown>0 and "CHECKS INCOMPLETE" or "LOCAL CHECKS PASS"
        result.NextSteps={}
        local function nextStep(text) table.insert(result.NextSteps,text) end
        if result.States.Character=="ACTION" then nextStep("Wait for your character to spawn, then check setup again.") end
        if result.States.Preview=="ACTION" then nextStep("Press Preview at the intended position and choose a non-empty layer.") end
        if result.States.Automation=="ACTION" then nextStep("Finish the automation or cleanup named above, then check again.") end
        if result.States.Placement=="ACTION" then nextStep("Press Learn placement, hide the hub and place one block manually, then check again.") end
        if result.Materials and result.Materials.ShortTypes>0 then
            local missing={}
            for name,quantity in pairs(result.Materials.Quantities) do if quantity.Missing and quantity.Missing>0 then table.insert(missing,name.." ×"..quantity.Missing) end end
            table.sort(missing)
            while #missing>5 do table.remove(missing) end
            nextStep("Collect missing blocks: "..table.concat(missing,", ")..(result.Materials.ShortTypes>5 and " …" or "")..". Refresh after restocking.")
        end
        if result.States.Walking=="ACTION" then nextStep("Stop the movement automation named above before using Auto Walk.") end
        if result.States.Reach=="ACTION" then nextStep(self.TravelMode=="Walk" and "Auto Walk will try paths after Start; unreachable cells pause the run. Check setup does not move you."
            or "Move within normal reach or choose a nearer layer; Check setup does not move you.") end
        if result.Unknown>0 then nextStep("Let inventory/world data settle, refresh Check setup, or copy the report if a check stays unknown.") end
        result.Failures=self:FailureCounts()
        if result.Failures.Review>0 then nextStep("Inspect "..result.Failures.Review.." uncertain cells on the island. Retry failed excludes them; normal Resume remains available after review.") end
        if result.Failures.Retryable>0 then nextStep("After fixing the cause, Retry failed targets "..result.Failures.Retryable.." explicitly rejected cells in this layer only.") end
        if #result.NextSteps==0 then nextStep(result.Summary=="NOTHING TO PLACE" and "All selected cells are occupied. Move the preview or choose another layer to build elsewhere." or "Check the preview position, then Start build. The server still checks support and island permissions.") end
        local lines={"AUTO BUILD SETUP · snapshot",result.Summary.." · "..result.Actions.." action checks · "..result.Unknown.." unknown checks"}
        -- Put the blockers visible first in the short on-screen report.
        for _,state in ipairs({"ACTION","UNKNOWN"}) do
            for _,check in ipairs(result.Checks) do
                if check.State==state then table.insert(lines,"["..check.State.."] "..check.Name..": "..check.Detail) end
            end
        end
        table.insert(lines,"")
        table.insert(lines,"NEXT: "..result.NextSteps[1])
        table.insert(lines,"")
        for _,state in ipairs({"OK","INFO"}) do
            for _,check in ipairs(result.Checks) do
                if check.State==state then table.insert(lines,"["..check.State.."] "..check.Name..": "..check.Detail) end
            end
        end
        if result.Materials then
            local names={};for name in pairs(result.Materials.Quantities) do table.insert(names,name) end;table.sort(names)
            for _,name in ipairs(names) do
                local quantity=result.Materials.Quantities[name]
                table.insert(lines,name.." · need "..quantity.Need.." · owned "..tostring(quantity.Owned or "unknown").." · short "..tostring(quantity.Missing or "unknown"))
            end
        end
        if result.Failures.Retryable+result.Failures.Review>0 then table.insert(lines,self:FailureReport()) end
        table.insert(lines,"NEXT STEPS")
        for index,step in ipairs(result.NextSteps) do table.insert(lines,index..". "..step) end
        if self.SetupMarkers then table.insert(lines,"MARKERS · purple: occupied/skipped; red: recorded rejection; yellow: review; orange: out of reach; gray: unknown/stale; blue/gold: empty in reach. Occupancy is a snapshot (30s); Check setup refreshes it.") end
        table.insert(lines,"Read-only snapshot; no blocks placed. Refresh after inventory, position or world changes. Support and island permissions are checked by the server.")
        result.Text=table.concat(lines,"\n")
        self:RefreshPreviewColors()
        self.SetupReport=result.Text;self.SetupResult=result
        self.MaterialSummary.Text=result.Text
        if self.MaterialView then self.MaterialView.CanvasPosition=Vector2.zero end
        status(result.Summary.." · Next: "..result.NextSteps[1])
        return result
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
    function self:RestoreBackup()
        if self.Running or self.WorkerToken then status("Wait for the build worker before restoring a saved slot.");return false end
        local backup,reason=self:InspectBackup(self.Slot)
        if not backup then status("Cannot restore backup: "..tostring(reason));return false end
        local ok,copy=pcall(AutoBuild.Validate,backup)
        if not ok then status("Invalid backup: "..tostring(copy));return false end
        if not self:StoreBlueprint(copy) then return false end
        status("Restored "..copy.Name.." to slot "..self.Slot.." ("..self.Persistence[self.Slot].."). Load selected slot to use it; the current working preview is retained.")
        return true
    end
    local function positionKey(c)
        return string.format("%d,%d,%d",math.round(c[1]*1000),math.round(c[2]*1000),math.round(c[3]*1000))
    end
    local function workingPlan()
        if self.SavedPlan then return AutoBuild.Validate(self.SavedPlan) end
        assert(self.Cells and self.Anchor,"Preview or load a blueprint before editing blocks.")
        local data={Version=1,Name=inputs.Name.Text,BlockSize=self.BlockSize,Cells={}}
        for _,cell in ipairs(self.Cells) do
            table.insert(data.Cells,{Material=cell.Material,Components={self.Anchor:ToObjectSpace(cell.CFrame):GetComponents()}})
        end
        return AutoBuild.Validate(data)
    end
    function self:ExportBlueprint(savedSlot)
        if self.Running or self.WorkerToken then status("Wait for the build worker before exporting a blueprint.");return false end
        local ok,data
        if savedSlot then
            local stored=self:InspectSlot(self.Slot)
            ok,data=pcall(AutoBuild.Validate,stored)
        else ok,data=pcall(workingPlan) end
        if not ok then status("Cannot export: "..tostring(data));return false end
        if not ctx.EncodeBlueprint then status("Blueprint JSON encoding is unavailable.");return false end
        local encoded,text=pcall(ctx.EncodeBlueprint,data)
        if not encoded or type(text)~="string" or #text==0 or #text>1000000 then status("Blueprint export failed or exceeds the text limit.");return false end
        inputs.Transfer.Text=text
        local copied=false
        if ctx.CopyBlueprint then local ran,result=pcall(ctx.CopyBlueprint,text);copied=ran and result==true end
        status("Exported "..data.Name.." · "..#data.Cells.." blocks. "..(copied and "Copied to clipboard; JSON is also in the transfer field." or "Select and copy the JSON in the transfer field; clipboard copying is unavailable."))
        return text
    end
    function self:ImportBlueprint(text)
        if self.Running or self.WorkerToken then status("Wait for the build worker before importing a blueprint.");return false end
        if type(text)~="string" or #text==0 or #text>1000000 then status("Paste blueprint JSON of 1–1,000,000 bytes first.");return false end
        if not ctx.DecodeBlueprint then status("Blueprint JSON decoding is unavailable.");return false end
        local decoded,data=pcall(ctx.DecodeBlueprint,text)
        if not decoded then status("Invalid blueprint JSON. The working layout and saved slots were retained.");return false end
        local valid,copy=pcall(AutoBuild.Validate,data)
        if not valid then status("Import rejected: "..tostring(copy));return false end
        self:UseWorkingBlueprint(copy,true)
        status("Imported "..copy.Name.." · "..#copy.Cells.." blocks into the working layout. Preview to check materials and positioning, then Save preview to keep it. Saved slots were retained.")
        return true
    end
    local function markEdited()
        self.PlanDirty=true;self.BuildReport=nil;self.SetupReport=nil;self.SetupResult=nil
        self.Preset="Saved: "..self.SavedPlan.Name.." *";buttons.Preset.Text=self.Preset.."  ▼"
        self:UpdateMaterials(self.Cells and self:SelectedCells() or self.SavedPlan.Cells)
    end
    function self:RefreshEdits()
        self.MaterialUndo=self.UndoStack[#self.UndoStack]
        if buttons.UndoMaterial then buttons.UndoMaterial.Text="Undo ("..#self.UndoStack..")" end
        if buttons.Redo then buttons.Redo.Text="Redo ("..#self.RedoStack..")" end
    end
    function self:ClearEdits()
        self.UndoStack={};self.RedoStack={};self:RefreshEdits()
    end
    local function editSnapshot(plan,removal)
        local materials={}
        for _,cell in ipairs(self.Cells or {}) do materials[cell]=cell.Material end
        return {Plan=plan,Dirty=self.PlanDirty,Removal=removal,CellList=self.Cells,Materials=materials}
    end
    local function pushEdit(plan,removal)
        table.insert(self.UndoStack,editSnapshot(plan,removal))
        if #self.UndoStack>20 then table.remove(self.UndoStack,1) end
        self.RedoStack={};self:RefreshEdits()
    end
    function self:CycleRepeatOption(option)
        if not ctx.Alive() or self.Running or self.WorkerToken then status("Wait for the build worker before changing repeat options.");return false end
        if option=="Copies" then
            self.RepeatCopies=self.RepeatCopies==4 and 2 or self.RepeatCopies+1
            buttons.RepeatCopies.Text="Copies: "..self.RepeatCopies.." total"
        elseif option=="Gap" then
            local choices={0,1,2,4}
            self.RepeatGap=choices[((table.find(choices,self.RepeatGap) or 0)%#choices)+1]
            buttons.RepeatGap.Text="Gap: "..self.RepeatGap.." blocks"
        elseif option=="Scope" then
            self.RepeatScope=self.RepeatScope=="Entire layout" and "Selected layer" or "Entire layout"
            buttons.RepeatScope.Text="Repeat: "..self.RepeatScope
        else return false end
        status("Repeat options staged: "..self.RepeatScope.." · "..self.RepeatCopies.." total copies · gap "..self.RepeatGap..". Choose Right, Forward or Up; other layers are kept.")
        return true
    end
    function self:RepeatLayout(axis,copies,gap)
        if not ctx.Alive() then return false end
        if self.Running or self.WorkerToken then status("Wait for the build worker before repeating a layout.");return false end
        copies=copies==nil and self.RepeatCopies or copies;gap=gap==nil and self.RepeatGap or gap
        local ok,original=pcall(workingPlan)
        if not ok then status(original);return false end
        local height
        if self.RepeatScope=="Selected layer" then
            local heights=self:Layers()
            height=self.LayerIndex and heights and heights[self.LayerIndex]
            if not self.Cells or height==nil then status("Preview the layout and choose one Build layer before repeating Selected layer. Other layers will be kept.");return false end
        elseif self.RepeatScope~="Entire layout" then status("Choose Entire layout or Selected layer first.");return false end
        local valid,copy,step=pcall(AutoBuild.RepeatPlan,original,axis,copies,gap,height)
        if not valid then status("Repeat rejected: "..tostring(copy)..". Working layout kept.");return false end
        local staged,newCells
        if self.Cells then
            if not self.Anchor or type(self.BlockSize)~="number" or math.abs(self.BlockSize-original.BlockSize)>.001 then status("Preview the working blueprint again before repeating it.");return false end
            local oldFolder=self.PreviewFolder
            local made,err=pcall(function()
                staged=Instance.new("Folder");staged.Name="RebornBuildPreview"
                self.PreviewFolder=staged;newCells={}
                for _,cell in ipairs(copy.Cells) do
                    table.insert(newCells,makeGhost(self.Anchor*CFrame.new(table.unpack(cell.Components)),cell.Material,cell.Components[2],self.BlockSize))
                end
            end)
            self.PreviewFolder=oldFolder
            if not made then
                if staged then staged:Destroy() end
                status("Repeat preview failed: "..tostring(err)..". Working layout kept.");return false
            end
        end
        -- Geometry edits share the removal snapshot path for complete Undo/Redo.
        pushEdit(original,true)
        self.SavedPlan=copy
        if newCells then
            for _,cell in ipairs(self.Cells) do if cell.Preview then cell.Preview:Destroy() end end
            if self.PreviewFolder then self.PreviewFolder:Destroy() end
            self.PreviewFolder=staged;staged.Parent=space;self.Cells=newCells
        end
        self.Failures=setmetatable({}, {__mode="k"})
        self.LayerIndex=nil;buttons.Layer.Text="Build: All layers"
        self.SelectedCell=nil;self.Picking=false;buttons.Pick.Text="Pick block: OFF"
        markEdited();self:RefreshSelection();self:RefreshReach()
        status(string.format("Repeated %s %s: %d total copies · %d blocks · %g-stud spacing. Other layers kept. Undo/Redo available; Save preview to keep it. No blocks placed.",self.RepeatScope:lower(),axis:lower(),copies,#copy.Cells,step))
        return true,#copy.Cells
    end
    function self:RemoveBlocks(material,selectedLayer,onlyCell)
        if self.Running or self.WorkerToken then status("Wait for the build worker before removing blueprint blocks.");return false end
        local ok,original=pcall(workingPlan)
        if not ok then status(original);return false end
        material=type(material)=="string" and material:match("^%s*(.-)%s*$") or ""
        local height,cellKey
        if onlyCell then
            if not table.find(self:SelectedCells(),onlyCell) or not onlyCell.Preview then status("Select a preview block first.");return false end
            local c={self.Anchor:ToObjectSpace(onlyCell.CFrame):GetComponents()}
            cellKey=positionKey(c)
        end
        if selectedLayer then
            local heights=self:Layers();height=self.LayerIndex and heights and heights[self.LayerIndex]
            if not height then status("Choose one layer with the Build layer control before removing it.");return false end
        elseif not onlyCell and (material=="" or #material>128) then status("Enter an existing block name in the first edit field.");return false end
        local function matches(name,y)
            return selectedLayer and math.round(y*1000)/1000==height or not selectedLayer and name==material
        end
        local copy=AutoBuild.Validate(original);local remaining={}
        for _,cell in ipairs(copy.Cells) do
            local c=cell.Components
            local match=onlyCell and positionKey(c)==cellKey or not onlyCell and matches(cell.Material,c[2])
            if not match then table.insert(remaining,cell) end
        end
        local removed=#copy.Cells-#remaining
        if removed==0 then status("No matching blocks in the working blueprint.");return false end
        if #remaining==0 then status("Keep at least one blueprint block. Use Clear preview to hide the whole plan.");return false end
        copy.Cells=remaining
        pushEdit(original,true)
        self.SavedPlan=copy
        if self.Cells then
            local kept={}
            for _,cell in ipairs(self.Cells) do
                local y=cell.LayerY or self.Anchor:ToObjectSpace(cell.CFrame).Position.Y
                if onlyCell and cell==onlyCell or not onlyCell and matches(cell.Material,y) then
                    if cell.Preview then cell.Preview:Destroy() end
                else table.insert(kept,cell) end
            end
            self.Cells=kept
        end
        self.LayerIndex=nil;buttons.Layer.Text="Build: All layers"
        for _,cell in ipairs(self.Cells or {}) do if cell.Preview then cell.Preview.Transparency=.65 end end
        self.SelectedCell=nil;markEdited();self:RefreshSelection();self:RefreshReach()
        status("Removed "..removed.." blueprint blocks. Undo restores this edit; Save preview updates the selected slot.")
        return true,removed
    end
    function self:ReplaceMaterial(from,to,onlyCell)
        if self.Running or self.WorkerToken then status("Wait for the build worker before replacing materials.");return false end
        from=type(from)=="string" and from:match("^%s*(.-)%s*$") or ""
        to=type(to)=="string" and to:match("^%s*(.-)%s*$") or ""
        if from=="" or to=="" or #from>128 or #to>128 or from==to then status("Enter different source and replacement block names.");return false end
        local definitions=ctx.BlockDefinitions and ctx.BlockDefinitions()
        if not definitions or not definitions:FindFirstChild(to) then status("Replacement block is unknown or definitions are unavailable.");return false end
        local ok,original=pcall(workingPlan)
        if not ok then status(original);return false end
        local copy=AutoBuild.Validate(original)
        local changed,cellKey=0,nil
        if onlyCell then
            if not table.find(self:SelectedCells(),onlyCell) or not onlyCell.Preview then status("Select a preview block first.");return false end
            local c={self.Anchor:ToObjectSpace(onlyCell.CFrame):GetComponents()}
            cellKey=positionKey(c)
        end
        for _,cell in ipairs(copy.Cells) do
            local c=cell.Components
            if cell.Material==from and (not onlyCell or positionKey(c)==cellKey) then cell.Material=to;changed+=1 end
        end
        if changed==0 then status("No blocks named "..from.." in the loaded blueprint.");return false end
        pushEdit(original,false)
        self.SavedPlan=copy
        if self.Cells then
            for _,cell in ipairs(self.Cells) do if cell.Material==from and (not onlyCell or cell==onlyCell) then cell.Material=to end end
        end
        markEdited();self:RefreshSelection()
        status("Changed "..changed.." blocks in the working blueprint. Saved slots are unchanged; Preview then Save preview to keep this edit.")
        return true,changed
    end
    local function restoreEdit(source,destination,verb)
        if self.Running or self.WorkerToken then status("Wait for the build worker before Undo/Redo.");return false end
        local undo=source[#source]
        if not undo then status("No blueprint edit to "..verb..".");return false end
        local ok,current=pcall(workingPlan)
        if not ok then status(current);return false end
        table.remove(source)
        table.insert(destination,editSnapshot(current,undo.Removal))
        self.SavedPlan=AutoBuild.Validate(undo.Plan);self.PlanDirty=undo.Dirty;self.BuildReport=nil;self.SetupReport=nil;self.SetupResult=nil
        if self.Cells then
            if undo.Removal then
                for _,cell in ipairs(self.Cells) do if cell.Preview then cell.Preview:Destroy() end end
                if not self.PreviewFolder then
                    self.PreviewFolder=Instance.new("Folder");self.PreviewFolder.Name="RebornBuildPreview";self.PreviewFolder.Parent=space
                end
                self.Cells={}
                for _,cell in ipairs(self.SavedPlan.Cells) do
                    table.insert(self.Cells,makeGhost(self.Anchor*CFrame.new(table.unpack(cell.Components)),cell.Material,cell.Components[2],self.BlockSize))
                end
                self.LayerIndex=nil;buttons.Layer.Text="Build: All layers"
            else
                local byPosition={}
                for _,cell in ipairs(self.SavedPlan.Cells) do
                    local c=cell.Components;byPosition[positionKey(c)]=cell.Material
                end
                for index,cell in ipairs(self.Cells) do
                    local c=self.Anchor and {self.Anchor:ToObjectSpace(cell.CFrame):GetComponents()} or {0,0,0}
                    cell.Material=undo.CellList==self.Cells and undo.Materials[cell] or byPosition[positionKey(c)] or self.SavedPlan.Cells[index].Material
                end
            end
        end
        self.Preset="Saved: "..self.SavedPlan.Name..(self.PlanDirty and " *" or "");buttons.Preset.Text=self.Preset.."  ▼"
        self:RefreshEdits();self:UpdateMaterials(self.Cells and self:SelectedCells() or self.SavedPlan.Cells)
        self:RefreshSelection();self:RefreshReach()
        status("Blueprint edit "..verb.." complete. Saved slots are unchanged.")
        return true
    end
    function self:UndoMaterial() return restoreEdit(self.UndoStack,self.RedoStack,"undo") end
    function self:RedoEdit() return restoreEdit(self.RedoStack,self.UndoStack,"redo") end
    function self:RemoveSelected()
        if not self.SelectedCell then status("Select a preview block first.");return false end
        return self:RemoveBlocks(nil,false,self.SelectedCell)
    end
    function self:ReplaceSelected(to)
        if not self.SelectedCell then status("Select a preview block first.");return false end
        return self:ReplaceMaterial(self.SelectedCell.Material,to,self.SelectedCell)
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
            self.SavedPlan=self.Library[self.Slot];self.PlanDirty=false;self:ClearEdits()
            self.Preset="Saved: "..self.SavedPlan.Name;buttons.Preset.Text=self.Preset.."  ▼"
        end
        return saved
    end
    function self:UseWorkingBlueprint(copy,dirty)
        self:ClearPreview();self.SavedPlan=AutoBuild.Validate(copy);self.PlanDirty=dirty;self:ClearEdits()
        self.Preset="Saved: "..copy.Name..(dirty and " *" or "");buttons.Preset.Text=self.Preset.."  ▼"
        inputs.Name.Text=copy.Name
        self.OffsetX,self.OffsetY,self.OffsetZ=0,0,0
        self.Rotation=0;buttons.Rotate.Text="↻ 0°"
        self:UpdateMaterials(self.SavedPlan.Cells)
    end
    function self:LoadBlueprint()
        if self.Running or self.WorkerToken then status("Wait for the build worker before loading a blueprint.");return false end
        local data=self.Library[self.Slot]
        if not data and ctx.ReadBlueprint then
            local ran,result=pcall(ctx.ReadBlueprint,self.Slot)
            if ran then data=result end
        end
        local ok,copy=pcall(AutoBuild.Validate,data)
        if not ok then status("Cannot load slot "..self.Slot..": "..tostring(copy));return false end
        if not self.Library[self.Slot] then self.Persistence[self.Slot]="Loaded from file" end
        self.Library[self.Slot]=AutoBuild.Validate(copy)
        self:UseWorkingBlueprint(copy,false);self:RefreshLibrary(false)
        status("Loaded "..copy.Name..". Preview at your current position, adjust offset/rotation, then Start. Materials and permissions are still required.")
        return true
    end
    function self:CaptureIsland()
        if not ctx.Alive() then return false end
        if self.Running or self.WorkerToken then status("Stop the build and wait for request cleanup before saving island blocks.");return false end
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
    function self:Destroy() self:Stop();self:ClearPreview();self:ClearEdits() end
    local layoutItems={}
    local function register(control,y,height,x,offset,section,field)
        table.insert(layoutItems,{Control=control,Y=y,Height=height,X=x or 0,Offset=offset or 6,Section=section,Field=field})
        return control
    end
    local function layoutY(y) return y>=446 and y+44 or y end
    local function label(text,y,height)
        return register(ctx.Label({Parent=ctx.Parent,Text=text,TextSize=12,Size=UDim2.new(1,-12,0,height or 24),Position=UDim2.fromOffset(6,layoutY(y))}),layoutY(y),height or 24)
    end
    local function button(name,text,x,y,width,callback)
        local rowY=(name=="Preview" or name=="LearnPlacement" or name=="CheckSetup") and 446 or layoutY(y)
        local b=ctx.Button({Parent=ctx.Parent,Text=text,TextSize=13,Size=UDim2.new(width or 1,-12,0,32),Position=UDim2.new(x or 0,6,0,rowY)})
        buttons[name]=b;register(b,rowY,32,x)
        ctx.Track(b.Activated:Connect(callback));return b
    end
    local function invalidate()
        if not self.Running then self:ClearPreview();status("Settings changed. Preview the new plan.") end
    end
    label("Build farms, platforms, walls, stairs, rooms, bridges and fences.",4,36)
    local presets={"Farm plots","Platform","Wall","Stairs","Room","Bridge","Fence"}
    local presetMenu=Instance.new("Frame")
    presetMenu.Name="BlueprintOptions";presetMenu.Size=UDim2.new(1,-12,0,144);presetMenu.Position=UDim2.fromOffset(6,84)
    presetMenu.BackgroundColor3=Color3.fromRGB(21,27,44);presetMenu.BorderSizePixel=0;presetMenu.ZIndex=35;presetMenu.Visible=false;presetMenu.Parent=ctx.Parent
    button("Preset","Farm plots  ▼",0,48,.5,function()
        if not self.Running and not self.WorkerToken then
            local open=not presetMenu.Visible;self:CloseMenus();presetMenu.Visible=open
        end
    end)
    local moveMenu=Instance.new("Frame")
    moveMenu.Name="MoveBlueprint";moveMenu.Size=UDim2.new(1,-12,0,256);moveMenu.Position=UDim2.fromOffset(6,84)
    moveMenu.BackgroundColor3=Color3.fromRGB(21,27,44);moveMenu.BorderSizePixel=0;moveMenu.ZIndex=35;moveMenu.Visible=false;moveMenu.Parent=ctx.Parent
    button("Movement","Move / Auto Walk  ▼",.5,48,.5,function()
        local open=not moveMenu.Visible;self:CloseMenus();moveMenu.Visible=open
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
    local resetOffset=ctx.Button({Parent=moveMenu,Text="Reset offset",Size=UDim2.new(.5,-6,0,32),Position=UDim2.fromOffset(3,112)})
    resetOffset.ZIndex=36;buttons.ResetOffset=resetOffset
    ctx.Track(resetOffset.Activated:Connect(function() self:Move(-self.OffsetX,-self.OffsetY,-self.OffsetZ) end))
    buttons.SetupMarkers=ctx.Button({Parent=moveMenu,Text="Setup marks: OFF",TextSize=12,Size=UDim2.new(.5,-6,0,32),Position=UDim2.new(.5,3,0,112)})
    buttons.SetupMarkers.ZIndex=36
    ctx.Track(buttons.SetupMarkers.Activated:Connect(function() self:SetSetupMarkers(not self.SetupMarkers) end))
    self.MoveLabel=ctx.Label({Parent=moveMenu,Text="Moves 1 block per click, relative to preview.",TextSize=12,Size=UDim2.new(1,-12,0,30),Position=UDim2.fromOffset(6,148)})
    self.MoveLabel.ZIndex=36;self.MoveLabel.TextWrapped=true
    self.MoveMenu=moveMenu
    buttons.Reach=ctx.Button({Parent=moveMenu,Text="Mark reach: OFF",TextSize=12,Size=UDim2.new(1,-6,0,30),Position=UDim2.fromOffset(3,184)})
    buttons.Reach.ZIndex=36
    ctx.Track(buttons.Reach.Activated:Connect(function()
        self.RangeMarkers=not self.RangeMarkers;self:RefreshReach()
        status(self.RangeMarkers and (self.SetupMarkers and "Reach markers ON; setup occupied/failure colors take priority. Check setup refreshes occupancy." or "Reach markers ON: original colors are in reach, orange is beyond reach, gray is unknown. Selected preview ghosts update while the hub runs.")
            or (self.SetupMarkers and "Reach markers OFF. Setup snapshot markers remain ON; Check setup refreshes them." or "Reach markers OFF. Original preview colors restored."))
    end))
    buttons.Travel=ctx.Button({Parent=moveMenu,Text="Auto Walk: OFF",TextSize=12,Size=UDim2.new(1,-6,0,30),Position=UDim2.fromOffset(3,220)})
    buttons.Travel.ZIndex=36
    ctx.Track(buttons.Travel.Activated:Connect(function() self:SetTravelMode(self.TravelMode=="Walk" and "Stay" or "Walk") end))
    for index,preset in ipairs(presets) do
        local option=ctx.Button({Parent=presetMenu,Text=preset,Size=UDim2.new(.5,-4,0,34),Position=UDim2.new((index-1)%2*.5,2,0,math.floor((index-1)/2)*36)})
        option.ZIndex=36
        ctx.Track(option.Activated:Connect(function()
            if self.Running or self.WorkerToken then return end
            self.SavedPlan=nil;self.PlanDirty=false;self:ClearEdits()
            self.Preset=preset;buttons.Preset.Text=preset.."  ▼";presetMenu.Visible=false;invalidate()
        end))
    end
    local function input(key,title,value,y,numeric)
        label(title,y)
        local field=Instance.new("TextBox");field.Name=key;field.Text=tostring(value);field.PlaceholderText=title
        field.ClearTextOnFocus=false;field.TextSize=14;field.TextColor3=Color3.fromRGB(226,232,240)
        field.BackgroundColor3=Color3.fromRGB(21,27,44);field.BorderSizePixel=0;field.Size=UDim2.new(1,-12,0,30);field.Position=UDim2.fromOffset(6,y+24);field.Parent=ctx.Parent
        inputs[key]=field;register(field,y+24,30,0,6,nil,true)
        local committed=field.Text
        local function commit()
            if self.Running or self.WorkerToken or self.SavedPlan then
                field.Text=committed
                status(self.SavedPlan and "Saved layouts keep their materials and shape. Choose a built-in blueprint to edit them." or "Stop the build before changing its plan.")
                return
            end
            if numeric then
                local limit=key=="Height" and 8 or 12
                self[key]=math.clamp(math.floor(tonumber(field.Text) or self[key]),1,limit);field.Text=tostring(self[key])
            end
            -- Leaving a field unchanged must not discard the preview, retries or resume point.
            if field.Text==committed then return end
            committed=field.Text
            invalidate();self:RefreshFavorites()
        end
        commits[key]=commit;ctx.Track(field.FocusLost:Connect(commit))
    end
    input("Material","Bed/build block name (for example grass, soil or stone)","grass",90)
    input("Path","Farm path block name","stone",152)
    input("Width","Width (blocks)",self.Width,214,true)
    input("Length","Length / stair steps (blocks)",self.Length,276,true)
    input("Height","Wall / room / fence height (blocks)",self.Height,338,true)
    self.FavoriteButtons={}
    for index,key in ipairs({"Material","Path"}) do
        local y=index==1 and 114 or 176
        inputs[key].Size=UDim2.new(.5,-12,0,30)
        self.FavoriteButtons[key]=button("Favorite"..key,"☆ Save",.5,y,.25,function() self:ToggleFavorite(key) end)
        button("UseFavorite"..key,"Next ★",.75,y,.25,function() self:UseFavorite(key) end)
    end
    self:LoadFavorites();self:RefreshFavorites()
    button("Rotate","↻ 0°",0,486,.25,function()
        if self.Running or self.WorkerToken then return end
        if self.Cells then self:RotatePreview()
        else self.Rotation=(self.Rotation+90)%360;buttons.Rotate.Text="↻ "..self.Rotation.."°";invalidate() end
    end)
    button("Center","Center",.25,486,.25,function() self:CenterPreview() end)
    buttons.Layer=ctx.Button({Parent=ctx.Parent,Text="Build: All layers",TextSize=13,Size=UDim2.new(.5,-12,0,32),Position=UDim2.fromOffset(6,446)})
    register(buttons.Layer,layoutY(446),32)
    ctx.Track(buttons.Layer.Activated:Connect(function() self:CycleLayer() end))
    button("Preview","Preview",0,406,.3,function() self:Preview() end)
    button("LearnPlacement","Learn placement",.3,406,.4,function()
        if self.Running or self.WorkerToken then status("Stop building and wait for request cleanup before learning.");return end
        if not ctx.LearnPlacement then status("Placement learning unavailable in this host.");return end
        local ok,reason=ctx.LearnPlacement();status(reason)
    end)
    buttons.Start=ctx.Button({Parent=ctx.Parent,Text="Start build",TextSize=14,Primary=true,Size=UDim2.new(.5,-12,0,36),Position=UDim2.fromOffset(6,406)})
    register(buttons.Start,406,36)
    ctx.Track(buttons.Start.Activated:Connect(function() self:Start() end))
    buttons.Pause=ctx.Button({Parent=ctx.Parent,Text="Pause",TextSize=13,Size=UDim2.new(.25,-12,0,36),Position=UDim2.new(.5,6,0,406)})
    register(buttons.Pause,406,36,.5)
    ctx.Track(buttons.Pause.Activated:Connect(function() self:SetPaused(not self.Paused) end))
    buttons.Stop=ctx.Button({Parent=ctx.Parent,Text="Stop",TextSize=14,Bg=Color3.fromRGB(87,39,47),Size=UDim2.new(.25,-12,0,36),Position=UDim2.new(.75,6,0,406)})
    register(buttons.Stop,406,36,.75)
    ctx.Track(buttons.Stop.Activated:Connect(function() self:Stop() end))
    button("RetryFailed","Retry",.5,486,.25,function() self:RetryFailures() end)
    button("CheckSetup","Check setup",.7,406,.3,function() self:CheckSetup() end)
    button("Clear","Clear",.75,486,.25,function() if not self.Running and not self.WorkerToken then self:ClearPreview();status("Preview cleared.") else status("Wait for build request cleanup before clearing the preview.") end end)
    button("Speed","Speed: Standard  ▼",.5,446,.5,function()
        if self.Running or self.WorkerToken then status("Stop building before changing speed.");return end
        local open=not self.SpeedMenu.Visible
        self:CloseMenus();self.SpeedMenu.Visible=open
        buttons.Speed.Text="Speed: "..self.BuildSpeed..(open and "  ▲" or "  ▼")
        self:LayoutSections()
    end)
    local speedMenu=Instance.new("Frame")
    self.SpeedMenu=speedMenu
    speedMenu.Name="BuildSpeedOptions";speedMenu.Size=UDim2.new(1,-12,0,88)
    speedMenu.BackgroundColor3=Color3.fromRGB(21,27,44);speedMenu.BorderSizePixel=0;speedMenu.Visible=false;speedMenu.ZIndex=35;speedMenu.Parent=ctx.Parent
    self.SpeedOptions={}
    for index,value in ipairs({"Standard","Fast"}) do
        local option=ctx.Button({Parent=speedMenu,Text=value=="Standard" and "✓  Standard · 0.20s target" or "    Fast · 0.05s target",TextSize=13,
            Size=UDim2.new(1,-12,0,34),Position=UDim2.fromOffset(6,6+(index-1)*40)})
        option.ZIndex=36;self.SpeedOptions[index]=option
        ctx.Track(option.Activated:Connect(function() self:SetBuildSpeed(value) end))
    end
    self.Status=label("Choose materials you own, then Preview. Farm plots are raised beds with path columns; plant seeds after building.",534,74)
    self.Status.TextWrapped=true
    self.Status.TextSize=14;self.Status.TextTruncate=Enum.TextTruncate.None
    local progressTrack=Instance.new("Frame")
    progressTrack.Name="BuildProgress";progressTrack.BackgroundColor3=Color3.fromRGB(34,43,66)
    progressTrack.BorderSizePixel=0;progressTrack.ClipsDescendants=true
    progressTrack.Size=UDim2.new(1,-12,0,4);progressTrack.Parent=ctx.Parent
    self.ProgressTrack=register(progressTrack,layoutY(610),4)
    self.ProgressSegments={}
    for key,color in pairs({Placed=Color3.fromRGB(94,209,152),Skipped=self.MarkerColors.Occupied,Failed=self.MarkerColors.Rejected}) do
        local segment=Instance.new("Frame")
        segment.Name=key;segment.BackgroundColor3=color;segment.BorderSizePixel=0
        segment.Position=UDim2.fromOffset(0,0);segment.Size=UDim2.new(0,0,1,0)
        segment.Visible=false;segment.Parent=progressTrack;self.ProgressSegments[key]=segment
    end
    local materialView=Instance.new("ScrollingFrame")
    materialView.Size=UDim2.new(1,-12,0,100);materialView.Position=UDim2.fromOffset(6,layoutY(616))
    self.MaterialView=materialView
    materialView.BackgroundTransparency=1;materialView.BorderSizePixel=0;materialView.ScrollBarThickness=5
    materialView.CanvasSize=UDim2.new();materialView.AutomaticCanvasSize=Enum.AutomaticSize.Y;materialView.Parent=ctx.Parent
    register(materialView,layoutY(616),100)
    self.MaterialSummary=ctx.Label({Parent=materialView,Text="Preview or load a blueprint to see its material counts.",TextSize=14,
        Size=UDim2.new(1,-12,0,24),Position=UDim2.fromOffset(2,0)})
    self.MaterialSummary.TextWrapped=true;self.MaterialSummary.AutomaticSize=Enum.AutomaticSize.Y;self.MaterialSummary.TextTruncate=Enum.TextTruncate.None
    local name=Instance.new("TextBox");name.Name="BlueprintName";name.Text="My island build";name.PlaceholderText="Blueprint name (1–48 bytes)"
    name.ClearTextOnFocus=false;name.TextSize=14;name.TextColor3=Color3.fromRGB(226,232,240);name.BackgroundColor3=Color3.fromRGB(21,27,44)
    name.Size=UDim2.new(1,-12,0,32);name.Position=UDim2.fromOffset(6,layoutY(764));name.Parent=ctx.Parent;inputs.Name=name;register(name,layoutY(764),32,0,6,nil,true)
    button("Slot","Blueprint slot: 1 / 5",0,804,1,function()
        if self.Running then status("Stop the build before changing its blueprint slot.");return end
        self.Slot=self.Slot%5+1
        self:InspectSlot(self.Slot);self:RefreshLibrary(false)
    end)
    button("Save","Save preview",0,844,.5,function() self:SavePreview() end)
    button("Capture","Save island area",.5,844,.5,function() self:CaptureIsland() end)
    button("Load","Load selected slot",0,884,1,function() self:LoadBlueprint() end)
    button("CaptureRange","Save radius: 30 studs",0,924,1,function()
        if self.Running or self.WorkerToken then status("Wait for build request cleanup before changing capture range.");return end
        self.CaptureRange=self.CaptureRange>=120 and 15 or self.CaptureRange*2
        buttons.CaptureRange.Text="Save radius: "..self.CaptureRange.." studs"
    end)
    local hint=label("Save preview stores its shape and materials. Save island area stores nearby placed blocks on your own island. Saving overwrites the selected slot. Load never starts building. Chest contents, inventories and scripts are not saved.",966,110)
    hint.TextWrapped=true
    button("Check","Check materials",0,1088,.5,function() self:CheckMaterials() end)
    button("CopyMissing","Copy restock",.5,1088,.5,function() self:CopyMissingMaterials() end)
    button("CopyCheck","Copy build check",0,1128,.5,function()
        if not self.BuildReport then status("Run Check materials first.");return end
        if ctx.CopyReport then ctx.CopyReport(self.BuildReport) else status("Report copying is unavailable.") end
    end)
    button("CopySetup","Copy setup check",.5,1128,.5,function()
        local result=self:CheckSetup()
        if not result then return end
        if ctx.CopyReport then ctx.CopyReport(result.Text) else status(result.Text) end
    end)
    button("Inspect","Refresh saved slots",0,1168,.5,function() self:RefreshLibrary(true) end)
    -- Inside the Library section; the old y=1896 row fell below it, under the next header.
    button("CopyDiagnostics","Copy build diagnostics",.5,1168,.5,function()
        local report=self:DiagnosticReport()
        if ctx.CopyReport then ctx.CopyReport(report) else status(report) end
    end)
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
    self.BackupSummary=label("Backup not inspected. Refresh saved slots to check the selected slot.",1540,52)
    self.BackupSummary.TextWrapped=true
    button("RestoreBackup","Restore backup → slot",0,1600,.5,function() self:RestoreBackup() end)
    button("ExportSaved","Export saved slot",.5,1600,.5,function() self:ExportBlueprint(true) end)
    local transfer=Instance.new("TextBox")
    transfer.Name="BlueprintTransfer";transfer.Text="";transfer.PlaceholderText="Paste blueprint JSON to import, or export a layout here."
    transfer.MultiLine=true;transfer.ClearTextOnFocus=false;transfer.TextSize=11;transfer.TextWrapped=true
    transfer.TextXAlignment=Enum.TextXAlignment.Left;transfer.TextYAlignment=Enum.TextYAlignment.Top
    transfer.TextColor3=Color3.fromRGB(226,232,240);transfer.BackgroundColor3=Color3.fromRGB(21,27,44)
    transfer.Size=UDim2.new(1,-12,0,104);transfer.Position=UDim2.fromOffset(6,layoutY(1640));transfer.Parent=ctx.Parent
    inputs.Transfer=transfer;register(transfer,layoutY(1640),104,0,6,nil,true)
    button("ExportWorking","Export working layout",0,1752,.5,function() self:ExportBlueprint(false) end)
    button("Import","Import to working layout",.5,1752,.5,function() self:ImportBlueprint(inputs.Transfer.Text) end)
    local transferHint=label("Overwrite keeps one prior valid version per slot. Restore changes the saved slot; Load uses it. Import replaces only the working layout. Preview and Save to keep an import. Export includes the full layout, including unselected layers.",1796,88)
    transferHint.TextWrapped=true
    for index,key in ipairs({"ReplaceFrom","ReplaceTo"}) do
        local field=Instance.new("TextBox");field.Name=key;field.Text="";field.PlaceholderText=index==1 and "Existing block name" or "Replacement block name"
        field.ClearTextOnFocus=false;field.TextSize=14;field.TextColor3=Color3.fromRGB(226,232,240);field.BackgroundColor3=Color3.fromRGB(21,27,44)
        field.Size=UDim2.new(.5,-12,0,32);field.Position=UDim2.new((index-1)*.5,6,0,layoutY(1942));field.Parent=ctx.Parent
        inputs[key]=field;register(field,layoutY(1942),32,(index-1)*.5,6,nil,true)
    end
    button("Replace","Replace material",0,1982,.5,function() self:ReplaceMaterial(inputs.ReplaceFrom.Text,inputs.ReplaceTo.Text) end)
    button("UndoMaterial","Undo (0)",.5,1982,.25,function() self:UndoMaterial() end)
    button("Redo","Redo (0)",.75,1982,.25,function() self:RedoEdit() end)
    button("RemoveMaterial","Remove named blocks",0,2024,.5,function() self:RemoveBlocks(inputs.ReplaceFrom.Text,false) end)
    button("RemoveLayer","Remove selected layer",.5,2024,.5,function() self:RemoveBlocks(nil,true) end)
    button("Pick","Pick block: OFF",0,2064,.5,function() self:SetPicking(not self.Picking) end)
    button("NextBlock","Next block",.5,2064,.5,function() self:NextBlock() end)
    self.SelectionLabel=label("No preview block selected. Enable Pick block, then click/tap a ghost outside the hub, or use Next block.",2104,48)
    self.SelectionLabel.TextWrapped=true
    button("RemoveSelected","Remove selected",0,2160,.5,function() self:RemoveSelected() end)
    button("ReplaceSelected","Replace selected",.5,2160,.5,function() self:ReplaceSelected(inputs.ReplaceTo.Text) end)
    local replaceHint=label("Named edits affect all matching blocks. Selected edits affect one highlighted ghost. Undo/Redo keeps up to 20 edits. Save preview commits the layout and clears edit history.",2200,84)
    replaceHint.TextWrapped=true
    button("RepeatCopies","Copies: 2 total",0,2288,.5,function() self:CycleRepeatOption("Copies") end)
    button("RepeatGap","Gap: 0 blocks",.5,2288,.5,function() self:CycleRepeatOption("Gap") end)
    button("RepeatScope","Repeat: Entire layout",0,2330,1,function() self:CycleRepeatOption("Scope") end)
    button("RepeatRight","Repeat right",0,2372,1/3,function() self:RepeatLayout("Right") end)
    button("RepeatForward","Repeat forward",1/3,2372,1/3,function() self:RepeatLayout("Forward") end)
    button("RepeatUp","Repeat up",2/3,2372,1/3,function() self:RepeatLayout("Up") end)
    local repeatHint=label("Copies includes the original. Selected layer keeps all other layers; choose a Build layer first. Up can add floors. Overlapping positions are rejected. Max 300 blocks. Undo/Redo; Start builds.",2414,64)
    repeatHint.TextWrapped=true
    button("History","Next result",0,2528,.34,function() self:ShowHistory() end)
    button("CopyHistory","Copy result",.34,2528,.33,function()
        if not self.HistoryReport and not self:ShowHistory() then return end
        if ctx.CopyReport then ctx.CopyReport(self.HistoryReport) else status("Report copying is unavailable.") end
    end)
    button("CopyAllHistory","Copy all",.67,2528,.33,function() self:CopyAllHistory() end)
    local historyView=Instance.new("ScrollingFrame")
    historyView.Size=UDim2.new(1,-12,0,216);historyView.Position=UDim2.fromOffset(6,layoutY(2572))
    historyView.BackgroundTransparency=1;historyView.BorderSizePixel=0;historyView.ScrollBarThickness=5
    historyView.CanvasSize=UDim2.new();historyView.AutomaticCanvasSize=Enum.AutomaticSize.Y;historyView.Parent=ctx.Parent
    register(historyView,layoutY(2572),216)
    self.HistoryLabel=ctx.Label({Parent=historyView,Text="No builds recorded this session.",TextSize=12,
        Size=UDim2.new(1,-12,0,24),Position=UDim2.fromOffset(2,0)})
    self.HistoryLabel.TextWrapped=true;self.HistoryLabel.AutomaticSize=Enum.AutomaticSize.Y;self.HistoryLabel.TextTruncate=Enum.TextTruncate.None
    self.Sections={
        {Key="Settings",Title="Build settings",Header=90,Start=90,Finish=392,Expanded=40,Collapsed=-262,Open=false},
        {Key="Library",Title="Saved blueprints & checks",Header=768,Start=808,Finish=1936,Expanded=0,Collapsed=-1128,Open=false},
        {Key="Materials",Title="Blueprint block editing",Header=1944,Start=1984,Finish=2528,Expanded=0,Collapsed=-544,Open=false},
        {Key="History",Title="Recent build results",Header=2532,Start=2572,Finish=2844,Expanded=0,Collapsed=-272,Open=false},
    }
    self.SectionButtons={}
    function self:CloseMenus()
        presetMenu.Visible=false;moveMenu.Visible=false
        if self.SpeedMenu then self.SpeedMenu.Visible=false end
        if buttons.Speed then buttons.Speed.Text="Speed: "..self.BuildSpeed.."  ▼" end
        if self.LayoutSections then self:LayoutSections() end
        self.Picking=false;if buttons.Pick then buttons.Pick.Text="Pick block: OFF" end
    end
    function self:LayoutSections()
        local bottom=0
        for _,item in ipairs(layoutItems) do
            local y,visible=item.Y,true
            for _,section in ipairs(self.Sections) do
                if item.Section~=section.Key then
                    if item.Y>=section.Start and item.Y<section.Finish then
                        if section.Open then y+=section.Expanded else visible=false end
                    elseif item.Y>=section.Finish then y+=section.Open and section.Expanded or section.Collapsed end
                end
            end
            if speedMenu.Visible and item.Y>=layoutY(486) then y+=speedMenu.Size.Y.Offset+12 end
            item.Control.Visible=visible
            item.Control.Position=UDim2.new(item.X,item.Offset,0,y)
            if visible then bottom=math.max(bottom,y+item.Height) end
        end
        speedMenu.Position=UDim2.fromOffset(6,buttons.Speed.Position.Y.Offset+buttons.Speed.Size.Y.Offset+6)
        self.LayoutHeight=bottom+16
        ctx.Parent.AutomaticCanvasSize=Enum.AutomaticSize.None
        ctx.Parent.CanvasSize=UDim2.new(0,0,0,self.LayoutHeight)
    end
    function self:ToggleSection(key)
        for _,section in ipairs(self.Sections) do
            if section.Key==key then
                if section.Open then
                    for _,item in ipairs(layoutItems) do
                        if item.Field and item.Y>=section.Start and item.Y<section.Finish then
                            pcall(function() item.Control:ReleaseFocus() end)
                        end
                    end
                end
                self:CloseMenus();section.Open=not section.Open
                self.SectionButtons[key].Text=(section.Open and "▾  " or "▸  ")..section.Title
                self:LayoutSections();return true
            end
        end
        return false
    end
    for _,section in ipairs(self.Sections) do
        local control=ctx.Button({Parent=ctx.Parent,Text="▸  "..section.Title,TextSize=13,
            Size=UDim2.new(1,-12,0,32),Position=UDim2.fromOffset(6,section.Header)})
        register(control,section.Header,32,0,6,section.Key)
        self.SectionButtons[section.Key]=control
        ctx.Track(control.Activated:Connect(function() self:ToggleSection(section.Key) end))
    end
    if ctx.RegisterPicker then ctx.RegisterPicker(function(origin,direction,limit) return self:PickRay(origin,direction,limit) end) end
    if ctx.RegisterMenuCloser then ctx.RegisterMenuCloser(function() self:CloseMenus() end) end
    self:LayoutSections()
    self:RefreshFailureUI()
    self.Buttons=buttons;self.Inputs=inputs
    return self
end
return AutoBuild
