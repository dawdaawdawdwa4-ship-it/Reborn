-- Farm travel is idle until an active worker asks to approach a target.
local Navigation={Generation=0}
local function halt(humanoid,root)
    if not humanoid then return end
    -- Clear the outstanding MoveTo destination as well as current movement.
    if root then pcall(function() humanoid:MoveTo(root.Position) end) end
    pcall(function() humanoid:Move(Vector3.zero) end)
end
function Navigation.Stop(owner)
    if owner~=nil and Navigation.Owner~=owner then return false end
    Navigation.Generation+=1
    if Navigation.Tween then pcall(function() Navigation.Tween:Cancel() end);Navigation.Tween=nil end
    local humanoid,root=Navigation.Humanoid,Navigation.Root
    Navigation.Humanoid=nil;Navigation.Root=nil;Navigation.Owner=nil
    halt(humanoid,root)
    return true
end
function Navigation.Approach(player,target,reach,active,positionOf,mode,owner)
    local character=player.Character
    local humanoid=character and character:FindFirstChildOfClass("Humanoid")
    local root=character and character:FindFirstChild("HumanoidRootPart")
    if not root or not humanoid then return false,"Waiting for your character" end
    local generation=Navigation.Generation
    local function valid()
        return active() and Navigation.Generation==generation and player.Character==character
            and character:FindFirstChild("HumanoidRootPart")==root
            and character:FindFirstChildOfClass("Humanoid")==humanoid
            and target.Parent~=nil and humanoid.Health>0
    end
    local function near()
        local point=positionOf(target)
        return point and (point-root.Position).Magnitude<=reach
    end
    if not valid() then return false,"Travel stopped" end
    if near() then return true end
    if mode=="Normal" then return false,"Normal mode: move closer to the target" end
    Navigation.Stop()
    generation=Navigation.Generation
    Navigation.Humanoid=humanoid;Navigation.Root=root;Navigation.Owner=owner
    local ok,result=pcall(function()
        local destination=positionOf(target)
        if not destination then return false end
        -- Stand beside dense bushes rather than pathfinding into their collision geometry.
        destination=destination+(root.Position-destination).Unit*(reach*.6)
        if mode=="Teleport" or mode=="Tween" then
            local destinationFrame=root.CFrame+(destination-root.Position)
            if not valid() then return false end
            if mode=="Teleport" then
                root.CFrame=destinationFrame
                task.wait(.1)
                return valid() and near()
            end
            local duration=math.clamp((destination-root.Position).Magnitude/24,.15,5)
            local tween=game:GetService("TweenService"):Create(root,TweenInfo.new(duration,Enum.EasingStyle.Linear),{CFrame=destinationFrame})
            Navigation.Tween=tween
            tween:Play()
            local deadline=os.clock()+duration+.5
            while valid() and not near() and os.clock()<deadline do task.wait(.05) end
            tween:Cancel()
            if Navigation.Tween==tween then Navigation.Tween=nil end
            return valid() and near()
        end
        local path=game:GetService("PathfindingService"):CreatePath({AgentRadius=2,AgentHeight=5,AgentCanJump=true,WaypointSpacing=4})
        path:ComputeAsync(root.Position,destination)
        if not valid() or path.Status~=Enum.PathStatus.Success then return false end
        if mode=="Hop" then
            -- Teleport in short steps along the path: no long jumps and no cutting through walls.
            local waypoints=path:GetWaypoints()
            local lift=waypoints[1] and root.Position.Y-waypoints[1].Position.Y or 3
            local hopDeadline=os.clock()+math.max(5,(destination-root.Position).Magnitude/30+3)
            for _,waypoint in ipairs(waypoints) do
                local goal=waypoint.Position+Vector3.new(0,lift,0)
                while valid() and not near() do
                    local offset=goal-root.Position
                    if offset.Magnitude<.5 then break end
                    -- A server position reset would otherwise hop forever.
                    if os.clock()>hopDeadline then return false end
                    root.AssemblyLinearVelocity=Vector3.zero
                    root.CFrame=root.CFrame+offset.Unit*math.min(8,offset.Magnitude)
                    task.wait(.1)
                end
                if not valid() then return false end
                if near() then return true end
            end
            return near()
        end
        -- Far chests/trees need more than a fixed budget; per-waypoint stall checks still catch blocking.
        local speed=math.max(tonumber(humanoid.WalkSpeed) or 16,4)
        local deadline=os.clock()+math.max(10,(destination-root.Position).Magnitude/speed*1.5+2)
        for _,waypoint in ipairs(path:GetWaypoints()) do
            if not valid() then return false end
            if near() then return true end
            local function distanceToWaypoint()
                local offset=waypoint.Position-root.Position
                return Vector3.new(offset.X,0,offset.Z).Magnitude
            end
            -- Waypoint Y is at the feet; HumanoidRootPart stays above it.
            if waypoint.Action==Enum.PathWaypointAction.Jump then humanoid.Jump=true end
            humanoid:MoveTo(waypoint.Position)
            local best=distanceToWaypoint()
            local progressed=os.clock()
            while distanceToWaypoint()>2 or math.abs(waypoint.Position.Y-root.Position.Y)>6 do
                if not valid() then return false end
                if near() then return true end
                local distance=distanceToWaypoint()
                if distance<best-.3 then best=distance;progressed=os.clock() end
                if os.clock()>deadline or os.clock()-progressed>1.5 then return false end
                task.wait(.1)
            end
        end
        return near()
    end)
    -- A cancelled old path must not stop a newer worker's movement.
    if Navigation.Generation==generation and Navigation.Humanoid==humanoid then
        if Navigation.Tween then pcall(function() Navigation.Tween:Cancel() end);Navigation.Tween=nil end
        halt(humanoid,root)
        Navigation.Humanoid=nil;Navigation.Root=nil;Navigation.Owner=nil
    end
    return ok and result==true and valid(),ok and "Target not reached; skipping this target" or "Travel unavailable; skipping this target"
end
return Navigation
