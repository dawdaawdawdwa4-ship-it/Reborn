-- Walking only: pathfinding never teleports or crosses jump links.
local Navigation={Generation=0}
function Navigation.Stop()
    Navigation.Generation+=1
    local humanoid=Navigation.Humanoid
    Navigation.Humanoid=nil
    if humanoid then pcall(function() humanoid:Move(Vector3.zero) end) end
end
function Navigation.Approach(player,target,reach,active,positionOf)
    local character=player.Character
    local humanoid=character and character:FindFirstChildOfClass("Humanoid")
    local root=character and character:FindFirstChild("HumanoidRootPart")
    if not root or not humanoid then return false,"Waiting for your character" end
    local generation=Navigation.Generation
    local function valid()
        return active() and Navigation.Generation==generation and player.Character==character and target.Parent~=nil and humanoid.Health>0
    end
    local function near()
        local point=positionOf(target)
        return point and (point-root.Position).Magnitude<=reach
    end
    if not valid() then return false,"Walking stopped" end
    if near() then return true end
    Navigation.Humanoid=humanoid
    local ok,result=pcall(function()
        local destination=positionOf(target)
        if not destination then return false end
        -- Stand beside dense bushes rather than pathfinding into their collision geometry.
        destination=destination+(root.Position-destination).Unit*(reach*.6)
        local path=game:GetService("PathfindingService"):CreatePath({AgentRadius=2,AgentHeight=5,AgentCanJump=false,WaypointSpacing=4})
        path:ComputeAsync(root.Position,destination)
        if not valid() or path.Status~=Enum.PathStatus.Success then return false end
        local deadline=os.clock()+10
        for _,waypoint in ipairs(path:GetWaypoints()) do
            if not valid() then return false end
            if near() then return true end
            if waypoint.Action==Enum.PathWaypointAction.Jump then return false end
            humanoid:MoveTo(waypoint.Position)
            local best=(waypoint.Position-root.Position).Magnitude
            local progressed=os.clock()
            while (waypoint.Position-root.Position).Magnitude>2 do
                if not valid() then return false end
                if near() then return true end
                local distance=(waypoint.Position-root.Position).Magnitude
                if distance<best-.3 then best=distance;progressed=os.clock() end
                if os.clock()>deadline or os.clock()-progressed>1.5 then return false end
                task.wait(.1)
            end
        end
        return near()
    end)
    -- A cancelled old path must not stop a newer worker's movement.
    if Navigation.Generation==generation and Navigation.Humanoid==humanoid then
        pcall(function() humanoid:Move(Vector3.zero) end)
        Navigation.Humanoid=nil
    end
    return ok and result==true,ok and "No walking route in reach; skipping this target" or "Walking unavailable; skipping this target"
end
return Navigation
