-- Shared targeting and confirmation rules; no server calls or input injection.
local FarmLogic = {}
local cropNames = {"wheat", "berry", "carrot", "potato", "corn", "tomato", "pumpkin", "melon", "cabbage", "lettuce", "flower", "crop", "bush"}
local woodNames = {"tree", "wood", "log", "oak", "pine", "birch", "palm"}
local mineNames = {"rock", "stone", "ore", "iron", "coal", "gold", "copper", "tin", "silver", "crystal", "gem", "mineral", "aquamarine", "emerald", "sapphire", "ruby", "amethyst", "quartz", "diamond"}
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
function FarmLogic.Fruits(model)
    local fruits={}
    if FarmLogic.Category(model.Name)~="wood" then return fruits end
    for _,stage in ipairs(model:GetChildren()) do
        if string.match(stage.Name,"^stage%-%d+$") then
            local fruit=stage:FindFirstChild("Fruit")
            if fruit and FarmLogic.IsReady(fruit) then table.insert(fruits,fruit) end
        end
    end
    return fruits
end
function FarmLogic.CropMatches(name, selected)
    local wanted = string.lower(selected)
    if wanted == "berrybush" then wanted = "berry" end
    return FarmLogic.Category(name) == "crop" and string.find(string.lower(name), wanted, 1, true) ~= nil
end
FarmLogic.CropOptions={"wheat","carrot","potato","corn","tomato","pumpkin","melon","cabbage","lettuce","berryBush"}
function FarmLogic.NormalizeCrops(selection, fallback)
    local chosen={}
    if type(selection)=="table" then
        for key,value in pairs(selection) do
            local name=type(key)=="number" and value or value==true and key
            if type(name)=="string" and table.find(FarmLogic.CropOptions,name) then chosen[name]=true end
        end
    end
    if not next(chosen) then chosen[table.find(FarmLogic.CropOptions,fallback) and fallback or "wheat"]=true end
    return chosen
end
function FarmLogic.SelectedCrops(selection,fallback)
    local names={}
    for _,name in ipairs(FarmLogic.CropOptions) do
        if type(selection)=="table" and selection[name] then table.insert(names,name) end
    end
    if #names==0 then table.insert(names,fallback or "wheat") end
    return names
end
function FarmLogic.CropsMatch(name,selection,fallback)
    for _,crop in ipairs(FarmLogic.SelectedCrops(selection,fallback)) do
        if FarmLogic.CropMatches(name,crop) then return true end
    end
    return false
end
function FarmLogic.ReplantType(name,selection,fallback)
    for _,crop in ipairs(FarmLogic.SelectedCrops(selection,fallback)) do
        if FarmLogic.CropMatches(name,crop) then return crop end
    end
    return fallback
end
-- Greedy nearest-next routing: continue from where the character stands now, not the scan order.
function FarmLogic.TakeNearest(targets, origin)
    local bestIndex, bestDistance
    for index, target in ipairs(targets) do
        local distance = origin and target.position and (target.position - origin).Magnitude or target.distance or 0
        if not bestDistance or distance < bestDistance then bestIndex, bestDistance = index, distance end
    end
    return bestIndex and table.remove(targets, bestIndex)
end
function FarmLogic.Range(category, config)
    if category == "wood" then return config.WoodRange end
    -- CropRange 0 means the whole owned island (crops are only ever scanned there).
    if category == "crop" then return (config.CropRange or 0) <= 0 and math.huge or config.CropRange end
    return config.MineRange
end
-- kind "All" (or nil) accepts every tree; otherwise the tree name must contain it, e.g. "oak".
FarmLogic.TreeOptions = {"All", "oak", "pine", "birch", "palm"}
function FarmLogic.TreeMatches(name, kind)
    if kind == nil or kind == "All" then return true end
    return string.find(string.lower(name), string.lower(kind), 1, true) ~= nil
end
-- Rock filter for Mining: "All" accepts every rock/ore; "stone" means plain rock or stone;
-- any other option (e.g. "aquamarine") must appear in the block name.
FarmLogic.RockOptions = {"All", "aquamarine", "iron", "coal", "gold", "stone"}
function FarmLogic.RockMatches(name, kind)
    if kind == nil or kind == "All" then return true end
    local lower = string.lower(name)
    if kind == "stone" then return string.find(lower, "stone", 1, true) ~= nil or string.find(lower, "rock", 1, true) ~= nil end
    return string.find(lower, string.lower(kind), 1, true) ~= nil
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
-- A crop whose harvest prompt exists but is disabled is still growing, whatever its attributes say.
function FarmLogic.PromptDisabled(target)
    local ok,result=pcall(function()
        for _,child in ipairs(target:GetDescendants()) do
            if child:IsA("ProximityPrompt") and child.Enabled==false then return true end
        end
        return false
    end)
    return ok and result==true
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
