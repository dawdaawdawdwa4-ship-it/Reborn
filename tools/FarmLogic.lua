-- Shared targeting and confirmation rules; no server calls or input injection.
local FarmLogic = {}
local cropNames = {"wheat", "berry", "carrot", "potato", "corn", "tomato", "pumpkin", "melon", "cabbage", "lettuce", "flower", "crop", "bush"}
local woodNames = {"tree", "wood", "log", "oak", "pine", "birch", "palm"}
local mineNames = {"rock", "stone", "ore", "iron", "coal", "gold", "copper", "tin", "silver", "crystal", "gem", "mineral"}
local readiness = {"Mature", "IsMature", "FullyGrown", "Harvestable", "ReadyToHarvest"}
local function contains(name, patterns)
    for _, pattern in ipairs(patterns) do
        if string.find(name, pattern, 1, true) then return true end
    end
    return false
end
function FarmLogic.Category(name)
    name = string.lower(name)
    if contains(name, {"sapling", "seedling", "seed", "harvested"}) then return nil end
    if contains(name, cropNames) then return "crop" end
    if contains(name, woodNames) then return "wood" end
    if contains(name, mineNames) then return "mine" end
    return nil
end
function FarmLogic.CropMatches(name, selected)
    local wanted = string.lower(selected)
    if wanted == "berrybush" then wanted = "berry" end
    return FarmLogic.Category(name) == "crop" and string.find(string.lower(name), wanted, 1, true) ~= nil
end
function FarmLogic.Range(category, config)
    if category == "wood" then return config.WoodRange end
    if category == "crop" then return config.CropRange end
    return config.MineRange
end
function FarmLogic.Snapshot(target)
    local values = {}
    for _, name in ipairs(readiness) do values[name] = target:GetAttribute(name) end
    return values
end
function FarmLogic.IsReady(target)
    for _, name in ipairs(readiness) do
        if target:GetAttribute(name) == false then return false end
    end
    return true -- Unknown growth schema: do not invent a numeric maturity threshold.
end
function FarmLogic.Confirmed(target, before, prompt)
    if not target.Parent then return true end
    for _, name in ipairs(readiness) do
        if before[name] == true and target:GetAttribute(name) == false then return true end
    end
    return prompt ~= nil and (not prompt.Parent or not prompt.Enabled)
end
function FarmLogic.HarvestPrompt(target)
    for _, child in ipairs(target:GetDescendants()) do
        if child:IsA("ProximityPrompt") and child.Enabled then
            local text = string.lower(child.Name .. " " .. child.ActionText)
            if contains(text, {"harvest", "høst", "collect", "pick"}) then return child end
        end
    end
    return nil
end
function FarmLogic.HoldPrompt(prompt, active, waitFor, now)
    local began = pcall(function() prompt:InputHoldBegin() end)
    if not began then pcall(function() prompt:InputHoldEnd() end); return false end
    local held = pcall(function()
        local deadline = now() + prompt.HoldDuration
        while active() and now() < deadline do waitFor(0.05) end
    end)
    local released = pcall(function() prompt:InputHoldEnd() end)
    return held and released and active()
end
return FarmLogic
