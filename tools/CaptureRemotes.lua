-- Reborn remote recorder: records calls; never replays or sends extra requests.
-- Requires host-provided hookmetamethod/getnamecallmethod (not Studio APIs).
-- F8 pause/resume | F9 print + save capture | F10 stop recording.
-- Perform ONE manual mining/harvest/plant/fishing action at a time.
if type(hookmetamethod) ~= "function" or type(getnamecallmethod) ~= "function" then
    warn("[Reborn capture] This host cannot intercept outgoing calls. In Studio, instrument your own server handlers or client call sites instead.")
    return
end
local environment = type(getgenv) == "function" and getgenv() or _G
local previous = environment.RebornCapture
if previous and previous.Version == 2 and previous.Resume then
    previous:Resume()
    print("[Reborn capture] Existing recorder reused; " .. #previous.Records .. " calls retained. F9 exports.")
    return
end
if previous and previous.Stop then previous:Stop() end
local capture = { Version = 2, Active = true, Stopped = false, Records = {}, MaxCalls = 100, RequestIds = {} }
local exactNames = {
    OEzzgCCBzocxJw = true, hFuV0Z1w601mXP = true,
    RZQQNNDRUvfj1N = true, ohy6O10QKzyGZE = true, raqRasAwcny1zh = true,
}
local function wanted(remote)
    if typeof(remote) ~= "Instance" then return false end
    if not remote:IsA("RemoteFunction") and not remote:IsA("RemoteEvent") then return false end
    if exactNames[remote.Name] then return true end
    local name = string.lower(remote.Name)
    for _, part in ipairs({"fish", "harvest", "block_hit_request", "block_place_request", "hotbar_layout", "trim_tree", "replant", "bait"}) do
        if string.find(name, part, 1, true) then return true end
    end
    return false
end
local function instancePath(instance)
    if instance == game then return "game", true end
    local path, cursor = {}, instance
    while cursor and cursor ~= game do
        table.insert(path, 1, cursor.Name)
        cursor = cursor.Parent
    end
    if cursor ~= game then
        -- Metadata is evidence, not a guessed replacement for the actual Instance.
        local fields = {
            "Name = " .. string.format("%q", instance.Name),
            "ClassName = " .. string.format("%q", instance.ClassName),
        }
        local ok, debugId = pcall(function() return instance:GetDebugId(0) end)
        if ok then table.insert(fields, "DebugId = " .. string.format("%q", debugId)) end
        local positioned, position = pcall(function()
            if instance:IsA("BasePart") then return instance.Position end
            if instance:IsA("Model") then return instance:GetPivot().Position end
        end)
        if positioned and position then
            table.insert(fields, string.format("Position = Vector3.new(%.17g, %.17g, %.17g)", position.X, position.Y, position.Z))
        end
        return "DetachedInstance({" .. table.concat(fields, ", ") .. "})", false
    end
    local expression = "game"
    for _, name in ipairs(path) do
        expression ..= ":FindFirstChild(" .. string.format("%q", name) .. ")"
    end
    return expression, true
end
-- SERIALIZER BEGIN (also exercised by the local test suite)
local function serialize(value, seen, budget, depth)
    budget = budget or { count = 0, complete = true }
    seen = seen or {}
    depth = depth or 0
    budget.count += 1
    if depth > 20 or budget.count > 500 then
        budget.complete = false
        return "nil --[[capture limit]]", budget.complete
    end
    local kind = typeof(value)
    if kind == "nil" or kind == "boolean" then return tostring(value), budget.complete end
    if kind == "number" then
        if value ~= value then return "(0/0)", budget.complete end
        if value == math.huge then return "math.huge", budget.complete end
        if value == -math.huge then return "-math.huge", budget.complete end
        return string.format("%.17g", value), budget.complete
    end
    if kind == "string" then
        if #value > 4096 then budget.complete = false end
        return string.format("%q", string.sub(value, 1, 4096)), budget.complete
    end
    if kind == "Instance" then
        local path, complete = instancePath(value)
        if not complete then budget.complete = false end
        return path, budget.complete
    end
    if kind == "Vector3" then
        return string.format("Vector3.new(%.17g, %.17g, %.17g)", value.X, value.Y, value.Z), budget.complete
    end
    if kind == "Vector2" then
        return string.format("Vector2.new(%.17g, %.17g)", value.X, value.Y), budget.complete
    end
    if kind == "CFrame" then
        local components = { value:GetComponents() }
        for i, component in ipairs(components) do components[i] = string.format("%.17g", component) end
        return "CFrame.new(" .. table.concat(components, ", ") .. ")", budget.complete
    end
    if kind == "Color3" then
        return string.format("Color3.new(%.17g, %.17g, %.17g)", value.R, value.G, value.B), budget.complete
    end
    if kind == "EnumItem" then return tostring(value), budget.complete end
    if kind == "table" then
        if seen[value] then budget.complete = false; return "nil --[[cyclic table]]", false end
        seen[value] = true
        local parts = {}
        for key, item in next, value do
            if budget.count > 500 then budget.complete = false; break end
            local encodedKey = serialize(key, seen, budget, depth + 1)
            local encodedValue = serialize(item, seen, budget, depth + 1)
            table.insert(parts, "[" .. encodedKey .. "] = " .. encodedValue)
        end
        seen[value] = nil
        return "{" .. table.concat(parts, ", ") .. "}", budget.complete
    end
    budget.complete = false
    return "nil --[[unsupported: " .. kind .. "]]", false
end
-- SERIALIZER END
function capture:Dump()
    local lines = { "-- Reborn outgoing call capture. Reference only; do not execute this file." }
    for _, record in ipairs(self.Records) do table.insert(lines, record) end
    return table.concat(lines, "\n\n")
end
function capture:Export()
    local output = self:Dump()
    print(output)
    if type(writefile) == "function" and type(isfile) == "function" then
        local prefix = "Reborn-remotes-" .. tostring(os.time())
        for i = 1, 100 do
            local path = prefix .. "-" .. i .. ".lua"
            local ok, saved = pcall(function()
                if isfile(path) then return false end
                writefile(path, output)
                return true
            end)
            if ok and saved then print("[Reborn capture] Saved " .. path); return path end
            if not ok then break end
        end
    end
    warn("[Reborn capture] File export unavailable; copy the capture from the console.")
end
function capture:Stop()
    self.Active, self.Stopped = false, true
    -- Retain the single hotkey connection so this same recorder can be resumed.
    -- It ignores input while stopped; no extra hooks or listeners are installed.
    -- Leave our hook in pass-through mode; restoring it could overwrite another hook.
end
function capture:Resume()
    self.Stopped = false
    self.Active = #self.Records < self.MaxCalls
end
local original
local function intercept(remote, ...)
    local method = getnamecallmethod()
    if capture.Active and (method == "InvokeServer" or method == "FireServer") then
        local args = table.pack(...)
        -- Recorder failures must never cancel or replace the original game call.
        pcall(function()
            if not wanted(remote) then return end
            -- Keep the observed per-remote request ID in memory for this session.
            -- Never substitute IDs between different remote names.
            if exactNames[remote.Name] and type(args[1]) == "table"
                and type(args[1].TrNhTTgExIb1Bg) == "string" then
                capture.RequestIds[remote.Name] = args[1].TrNhTTgExIb1Bg
            end
            local budget = { count = 0, complete = true }
            local path, validPath = instancePath(remote)
            if not validPath then budget.complete = false end
            local encoded = {}
            for i = 1, args.n do encoded[i] = serialize(args[i], {}, budget) end
            local record = string.format("-- Call %d | %s | t=%.3f | %s\n%s:%s(%s)",
                #capture.Records + 1, remote.Name, os.clock(), budget.complete and "COMPLETE" or "INCOMPLETE",
                path, method, table.concat(encoded, ", "))
            if #record > 65536 then record = "-- INCOMPLETE: call too large to capture" end
            table.insert(capture.Records, record)
            print(record)
            if #capture.Records >= capture.MaxCalls then
                capture.Active = false
                warn("[Reborn capture] 100-call limit reached. Press F9 to export.")
            end
        end)
    end
    return original(remote, ...)
end
local installed, result = pcall(function()
    return hookmetamethod(game, "__namecall", type(newcclosure) == "function" and newcclosure(intercept) or intercept)
end)
if not installed or type(result) ~= "function" then
    warn("[Reborn capture] Could not install recorder: " .. tostring(result))
    return
end
original = result
environment.RebornCapture = capture
capture.Connection = game:GetService("UserInputService").InputBegan:Connect(function(input, processed)
    if processed or capture.Stopped then return end
    if input.KeyCode == Enum.KeyCode.F8 then
        if #capture.Records < capture.MaxCalls then capture.Active = not capture.Active end
        print("[Reborn capture] Recording: " .. tostring(capture.Active))
    elseif input.KeyCode == Enum.KeyCode.F9 then
        capture:Export()
    elseif input.KeyCode == Enum.KeyCode.F10 then
        capture:Stop()
        print("[Reborn capture] Stopped. Run RebornCapture:Export() to export, or rerun the recorder to resume.")
    end
end)
print("[Reborn capture] Ready. Do ONE action manually. F8 pause, F9 export, F10 stop.")
