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
function AutoBuild.new(ctx)
    local self={Preset="Farm plots",Width=5,Length=6,Height=3,Rotation=0,Token=0,Running=false,Cells=nil,PreviewFolder=nil,OffsetX=0,OffsetY=0,OffsetZ=0}
    local inputs,buttons={},{}
    local space=ctx.Workspace or workspace
    local scheduler=ctx.Scheduler or task
    local now=ctx.Now or os.clock
    local function status(message) self.Status.Text=tostring(message) end
    function self:ClearPreview()
        if self.PreviewFolder then self.PreviewFolder:Destroy();self.PreviewFolder=nil end
        self.Cells=nil
    end
    function self:Stop()
        self.Token+=1;self.Running=false
        buttons.Start.Text="Start build"
        status("Stopped. Remaining blocks were not sent.")
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
        local ok,plan=pcall(AutoBuild.Plan,self.Preset,self.Width,self.Length,self.Height)
        if not ok then status(plan);return false end
        local material=inputs.Material.Text:match("^%s*(.-)%s*$")
        local pathMaterial=inputs.Path.Text:match("^%s*(.-)%s*$")
        if material=="" or self.Preset=="Farm plots" and pathMaterial=="" then status("Choose bed/build and path materials.");return false end
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
        if definitions then
            if not definitions:FindFirstChild(material) then status("Unknown build block: "..material);return false end
            if self.Preset=="Farm plots" and not definitions:FindFirstChild(pathMaterial) then status("Unknown path block: "..pathMaterial);return false end
        end
        local folder=Instance.new("Folder");folder.Name="RebornBuildPreview";folder.Parent=space
        self.PreviewFolder=folder
        self.Cells={}
        for _,cell in ipairs(plan) do
            local cf=anchor*CFrame.new(cell.x*size,cell.y*size,-cell.z*size)
            local part=Instance.new("Part")
            part.Name="PlannedBlock";part.Anchored=true;part.CanCollide=false;part.CanTouch=false;part.CanQuery=false
            part.Size=Vector3.new(size-.15,size-.15,size-.15);part.CFrame=cf
            part.Transparency=.65;part.Material=Enum.Material.ForceField
            part.Color=cell.role=="path" and Color3.fromRGB(210,180,100) or Color3.fromRGB(100,160,255)
            part.Parent=folder
            table.insert(self.Cells,{CFrame=cf,Material=cell.role=="path" and pathMaterial or material,Preview=part})
        end
        self.BlockSize=size
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
        self.Anchor=anchor
        self.OffsetX+=dx;self.OffsetY+=dy;self.OffsetZ+=dz
        self.MoveLabel.Text=string.format("Offset: right %d / up %d / forward %d blocks",self.OffsetX,self.OffsetY,self.OffsetZ)
        status("Blueprint moved. Start builds the visible preview positions.")
        return true
    end
    function self:Start()
        if self.Running then return end
        if not self.Cells and not self:Preview() then return end
        self.Token+=1
        local token=self.Token
        self.Running=true;buttons.Start.Text="Building…"
        if self.MoveMenu then self.MoveMenu.Visible=false end
        local function active() return self.Running and self.Token==token and ctx.Alive() end
        scheduler.spawn(function()
            local placed,skipped,failed,streak=0,0,0,0
            local ok,err=pcall(function()
                for index,cell in ipairs(self.Cells) do
                    if not active() then return end
                    local existing=occupied(cell.CFrame,self.BlockSize)
                    if existing then
                        skipped+=1
                    else
                        local _,root=characterRoot()
                        local reach=ctx.GameModule("ReplicatedStorage.Shared.SharedConfig","CLIENT_REACH")
                        if type(reach)~="number" then reach=20 end
                        while active() and (not root or (root.Position-cell.CFrame.Position).Magnitude>reach) do
                            status(string.format("Move within %d studs of block %d/%d, or press Stop.",reach,index,#self.Cells))
                            scheduler.wait(.2);_,root=characterRoot()
                            if active() then existing=occupied(cell.CFrame,self.BlockSize) end
                            if existing then break end
                        end
                        if not active() then return end
                        if existing or occupied(cell.CFrame,self.BlockSize) then
                            skipped+=1
                        else
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
                            if streak>=3 then
                                status("Build paused after 3 failures: "..tostring(reason or "no block appeared")..". Check materials, support and island access.")
                                return
                            end
                        end
                    end
                    if cell.Preview then cell.Preview:Destroy();cell.Preview=nil end
                    scheduler.wait(.2)
                end
                if active() then status(string.format("Finished: %d confirmed, %d occupied/skipped, %d failed.",placed,skipped,failed)) end
            end)
            if self.Token==token then
                self.Running=false;buttons.Start.Text="Start build"
                if not ok then status("Build stopped: "..tostring(err)) end
            end
        end)
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
            if self.Running then
                field.Text=committed
                status("Stop the build before changing its plan.")
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
    self.Buttons=buttons;self.Inputs=inputs
    return self
end
return AutoBuild
