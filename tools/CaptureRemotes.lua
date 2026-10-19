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
if previous and previous.Version == 28 and previous.Resume then
    previous:Resume()
    print("[Reborn capture] Existing recorder reused; " .. #previous.Records .. " calls retained. F9 exports.")
    return previous
end
if previous and previous.Stop then previous:Stop() end
local capture = { Version = 28, Active = true, Stopped = false, Records = {}, MaxCalls = 100, RequestIds = {} }
if previous then
    capture.Records = previous.Records or capture.Records
    capture.RequestIds = previous.RequestIds or capture.RequestIds
    capture.HarvestBinding = previous.HarvestBinding
    capture.BaitBinding = previous.BaitBinding
    capture.PlacementBinding = previous.PlacementBinding
    capture.PlowBinding = previous.PlowBinding
    capture.WoodHitBinding = previous.WoodHitBinding
    capture.MineHitBinding = previous.MineHitBinding
    capture.AutoReplantBinding = previous.AutoReplantBinding
    capture.ChestBinding = previous.ChestBinding
    capture.ChestBindings = previous.ChestBindings or (previous.ChestBinding and {previous.ChestBinding} or {})
    capture.FruitBinding = previous.FruitBinding
    capture.HotbarBinding = previous.HotbarBinding
    capture.HotbarLayout = previous.HotbarLayout
    capture.AutoReplantState = previous.AutoReplantState
    capture.Active = #capture.Records < capture.MaxCalls
end
capture.ChestBindings=capture.ChestBindings or {}
local exactNames = {
    FiAxD3JcLWBD6I = true, -- Supplied potatoSalad chest withdrawal; learn its live envelope.
    PdqfVEBKHDSMfE = true, -- Supplied hoe/plow endpoint; context is learned live.
    OEzzgCCBzocxJw = true, hFuV0Z1w601mXP = true,
    RZQQNNDRUvfj1N = true, ohy6O10QKzyGZE = true, raqRasAwcny1zh = true,
    T5XIZMc0DxnCFt = true, -- Most recent rotated block-hit endpoint.
    OAVO4xgiY252ym = true, -- Updated axe/block-hit endpoint.
    Gu0tNi2YAOdeYv = true, -- Updated hotbar-layout capture.
    Y6oBjV1u9qIAAS = true, -- Fruit-picking capture.
    nrGQVrxpfb3dKr = true, -- AutoReplant setting endpoint.
    qn1PInnZJmfDd1 = true, -- Supplied axe/block-hit capture.
    u71Y03otNIwj9g = true, -- Supplied updated placement endpoint.
    yrIxXd1d5bBQji = true,
    GDbJa5Ix6UZ8mg = true,
    wKCeyGAO4SqdMY = true,
    XPQExfDjDSUkYv = true, -- Supplied bait capture (rotating envelope).
    UctIHHAfsCxxzj = true,
    COtnYCOPUThadM = true, -- Supplied crop-harvest capture (new network group).
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
function capture:CopyAll()
    if #self.Records == 0 then
        return false, "Ingen kald optaget endnu. Udfør handlingerne manuelt først."
    end
    local output = self:Dump()
    local copy = type(setclipboard) == "function" and setclipboard
        or (type(toclipboard) == "function" and toclipboard)
    if copy then
        local ok = pcall(copy, output)
        if ok then return true, string.format("Alle %d optagne kald er kopieret. Send teksten her.", #self.Records) end
    end
    self:Export()
    return true, "Udklipsholder utilgængelig. Alle kald er eksporteret til fil/konsol."
end
function capture:Stop()
    self.Active, self.Stopped = false, true
    self.LearnPlowOnly = false
    self.LearnWoodOnly = false
    self.LearnBaitOnly = false
    self.LearnChestOnly = false
    self.LearnChestMany = false
    -- Retain the single hotkey connection so this same recorder can be resumed.
    -- It ignores input while stopped; no extra hooks or listeners are installed.
    -- Leave our hook in pass-through mode; restoring it could overwrite another hook.
end
function capture:Resume()
    self.Stopped = false
    self.Active = #self.Records < self.MaxCalls
end
-- Learn only a concrete model-target request observed during manual harvesting.
local function cloneArguments(value, oldTarget, newTarget, seen, budget)
    if oldTarget and value == oldTarget then return newTarget end
    if typeof(value) ~= "table" then return value end
    seen, budget = seen or {}, budget or { count = 0 }
    if seen[value] then return seen[value] end
    budget.count += 1
    assert(budget.count <= 500, "request snapshot too large")
    local copy = {}
    seen[value] = copy
    for key, item in next, value do copy[key] = cloneArguments(item, oldTarget, newTarget, seen, budget) end
    return copy
end
local function learnHotbar(remote,method,args)
    if method~="InvokeServer" or type(args[1])~="table" then return false end
    if remote.Name~="Gu0tNi2YAOdeYv" and remote.Name~="RZQQNNDRUvfj1N" and not string.find(string.lower(remote.Name),"hotbar_layout",1,true) then return false end
    local packet=args[1]
    local key=type(packet.P1ZFEJgXWM4k62)=="table" and "P1ZFEJgXWM4k62"
        or (type(packet.wGquKmyB3mV2Cf)=="table" and "wGquKmyB3mV2Cf"
        or (type(packet.TlSR8Mzd9FLwaZ)=="table" and "TlSR8Mzd9FLwaZ" or nil))
    local body=key and packet[key] or packet
    if type(body.layout)~="string" then return false end
    capture.HotbarBinding={Remote=remote,Method=method,Args=cloneArguments(args),BodyKey=key}
    capture.HotbarLayout=body.layout
    return true
end
function capture:Hotbar(layout)
    local binding=self.HotbarBinding
    if not binding or not binding.Remote.Parent or type(layout)~="string" then return false,"Change hotbar manually once with capture active" end
    local ok,result=pcall(function()
        local args=cloneArguments(binding.Args)
        local body=binding.BodyKey and args[1][binding.BodyKey] or args[1]
        body.layout=layout
        return binding.Remote[binding.Method](binding.Remote,table.unpack(args,1,args.n))
    end)
    if not ok or result==false or type(result)=="table" and result.success==false then return false,result end
    self.HotbarLayout=layout
    return true,result
end
local function learnFruit(remote, method, args)
    if remote.Name~="Y6oBjV1u9qIAAS" or method~="InvokeServer" or type(args[1])~="table" then return false end
    local body=args[1].wGquKmyB3mV2Cf
    if type(body)~="table" or typeof(body.model)~="Instance" or typeof(body.fruit)~="Instance" or typeof(body.player)~="Instance" then return false end
    capture.FruitBinding={Remote=remote,Method=method,Args=cloneArguments(args),Model=body.model,Fruit=body.fruit}
    return true
end
function capture:Fruit(model,fruit)
    local binding=self.FruitBinding
    if not binding or not binding.Remote.Parent then return false,"Pick fruit manually once with capture active" end
    if typeof(model)~="Instance" or typeof(fruit)~="Instance" or not fruit:IsDescendantOf(model) then return false,"Fruit no longer belongs to this tree" end
    local ok,result=pcall(function()
        local args=cloneArguments(binding.Args,binding.Model,model)
        args=cloneArguments(args,binding.Fruit,fruit)
        return binding.Remote[binding.Method](binding.Remote,table.unpack(args,1,args.n))
    end)
    if not ok or result==false or type(result)=="table" and result.success==false then return false,result end
    return true,result
end
local function learnAutoReplant(remote, method, args)
    if remote.Name~="nrGQVrxpfb3dKr" or method~="InvokeServer" or type(args[1])~="table" then return false end
    local body=args[1].wGquKmyB3mV2Cf
    if type(body)~="table" or body.name~="AutoReplant" or type(body.value)~="boolean" then return false end
    capture.AutoReplantBinding={Remote=remote,Method=method,Args=cloneArguments(args)}
    return true,body.value
end
function capture:SetAutoReplant(value)
    local binding=self.AutoReplantBinding
    if type(value)~="boolean" or not binding or not binding.Remote.Parent then return false,"Change AutoReplant manually once with capture active" end
    local ok,result=pcall(function()
        local args=cloneArguments(binding.Args)
        args[1].wGquKmyB3mV2Cf.value=value
        return binding.Remote[binding.Method](binding.Remote,table.unpack(args,1,args.n))
    end)
    if not ok or result==false or type(result)=="table" and result.success==false then return false,result end
    self.AutoReplantState=value
    return true,result
end
local function equippedHoe(owner)
    local char=owner and owner.Character
    if not char or type(char.FindFirstChildOfClass)~="function" then return nil end
    local tool=char:FindFirstChildOfClass("Tool")
    if not tool or not tool:IsA("Tool") then return nil end
    local name=string.lower(tool.Name)
    return (name=="hoe" or name=="plow" or name:match("hoe$")) and tool or nil
end
local function learnPlow(remote,method,args)
    if method~="InvokeServer" or type(args[1])~="table" then return false end
    local known=remote.Name=="PdqfVEBKHDSMfE" or string.find(string.lower(remote.Name),"plow",1,true)
    local group=remote.Parent
    if not known and (not capture.LearnPlowOnly or not group or not group.Parent or group.Parent.Name~="out") then return false end
    local body=args[1]
    if typeof(body.block)~="Instance" then
        body=nil
        for _,value in pairs(args[1]) do if type(value)=="table" and typeof(value.block)=="Instance" then body=value;break end end
    end
    local target=body and body.block
    if typeof(target)~="Instance" or not target:IsA("BasePart") or (target.Name~="grass" and target.Name~="dirt") then return false end
    local owner=game:GetService("Players").LocalPlayer
    if not equippedHoe(owner) then return false end
    capture.PlowBinding={Remote=remote,Method=method,Args=cloneArguments(args),Target=target,
        OwnerUserId=owner.UserId,OwnerCharacter=owner.Character,JobId=game.JobId,ObservedAt=os.clock()}
    return true
end
function capture:CanUsePlowBinding()
    local b=self.PlowBinding
    local owner=game:GetService("Players").LocalPlayer
    return b~=nil and b.Remote~=nil and b.Remote.Parent~=nil and b.Remote:IsA("RemoteFunction") and b.Method=="InvokeServer"
        and owner~=nil and owner.Character~=nil and b.OwnerCharacter==owner.Character and b.OwnerUserId==owner.UserId and b.JobId==game.JobId
end
function capture:Plow(block)
    if not self:CanUsePlowBinding() then return false,"Plow once manually on this character/server to learn the current request" end
    local owner=game:GetService("Players").LocalPlayer
    if not equippedHoe(owner) then return false,"Keep an owned hoe equipped" end
    if typeof(block)~="Instance" or not block:IsA("BasePart") or not block.Parent or (block.Name~="grass" and block.Name~="dirt") then return false,"Choose a live grass/dirt block" end
    local world=game:GetService("Workspace")
    local islands=world and world:FindFirstChild("Islands")
    local island=islands and islands:FindFirstChild(tostring(owner.UserId).."-island")
    if not island and islands then
        for _,candidate in ipairs(islands:GetChildren()) do if candidate:GetAttribute("OwnerUserId")==owner.UserId then island=candidate;break end end
    end
    local blocks=island and island:FindFirstChild("Blocks")
    if not blocks or block.Parent~=blocks then return false,"Plow targets must belong to your own island Blocks folder" end
    local b=self.PlowBinding
    local ok,result=pcall(function()
        local args=cloneArguments(b.Args,b.Target,block)
        return b.Remote[b.Method](b.Remote,table.unpack(args,1,args.n))
    end)
    if not ok or result==false or type(result)=="table" and result.success==false then return false,result end
    return true,result
end
local function learnBlockHit(remote, method, args)
    if method~="InvokeServer" or type(args[1])~="table" then return false end
    local known=remote.Name=="T5XIZMc0DxnCFt" or remote.Name=="OAVO4xgiY252ym" or remote.Name=="qn1PInnZJmfDd1" or remote.Name=="OEzzgCCBzocxJw"
        or string.find(string.lower(remote.Name),"block_hit_request",1,true)
    local packet=args[1]
    local body=packet
    -- Body/context field names rotate independently of the remote's name.
    for _,value in pairs(packet) do
        if type(value)=="table" and typeof(value.block)=="Instance" then body=value;break end
    end
    local block=body.block
    if typeof(block)~="Instance" or not (block:IsA("Model") or block:IsA("BasePart")) then return false end
    local name=string.lower(block.Name)
    local wood=false
    for _,word in ipairs({"tree","wood","log","oak","pine","birch","palm"}) do
        if string.find(name,word,1,true) then wood=true;break end
    end
    if not known then
        local group=remote.Parent
        if not group or not group.Parent or group.Parent.Name~="out" then return false end
        if not wood then
            local mineral=false
            for _,word in ipairs({"rock","stone","ore","iron","coal","gold","copper","mineral","crystal"}) do
                if string.find(name,word,1,true) then mineral=true;break end
            end
            if not mineral then return false end
        end
        local player=game:GetService("Players").LocalPlayer
        local character=player and player.Character
        local tool=character and character:FindFirstChildOfClass("Tool")
        local toolName=tool and string.lower(tool.Name) or ""
        local pick=string.find(toolName,"pickaxe",1,true)~=nil
        local axe=not pick and string.find(toolName,"axe",1,true)~=nil
        if not (wood and axe or not wood and pick) then return false end
    end
    local key=wood and "WoodHitBinding" or "MineHitBinding"
    capture[key]={Remote=remote,Method=method,Args=cloneArguments(args),Target=block}
    return true
end
function capture:Hit(block, category)
    local binding=self[category=="wood" and "WoodHitBinding" or "MineHitBinding"]
    if not binding or not binding.Remote.Parent then return false,"Hit a matching resource manually with capture active" end
    local ok,result=pcall(function()
        local args=cloneArguments(binding.Args,binding.Target,block)
        return binding.Remote[binding.Method](binding.Remote,table.unpack(args,1,args.n))
    end)
    if not ok or result==false or type(result)=="table" and result.success==false then return false,result end
    return true,result
end
local function learnPlacement(remote, method, args)
    if method ~= "InvokeServer" or type(args[1]) ~= "table" then return false end
    if remote.Name ~= "u71Y03otNIwj9g" and remote.Name ~= "ohy6O10QKzyGZE"
        and not string.find(string.lower(remote.Name), "block_place_request", 1, true) then return false end
    local packet = args[1]
    local key = type(packet.wGquKmyB3mV2Cf) == "table" and "wGquKmyB3mV2Cf"
        or (type(packet.TlSR8Mzd9FLwaZ) == "table" and "TlSR8Mzd9FLwaZ" or nil)
    local body = key and packet[key] or packet
    if typeof(body.cframe) ~= "CFrame" or type(body.blockType) ~= "string" then return false end
    capture.PlacementBinding = {Remote=remote,Method=method,Args=cloneArguments(args),BodyKey=key}
    return true
end
function capture:Place(body)
    local binding = self.PlacementBinding
    if not binding or not binding.Remote.Parent then return false, "Place one block manually with capture active" end
    if typeof(body.cframe) ~= "CFrame" or type(body.blockType) ~= "string" then return false, "Invalid placement body" end
    local ok, result = pcall(function()
        local args = cloneArguments(binding.Args)
        local packet = binding.BodyKey and args[1][binding.BodyKey] or args[1]
        packet.cframe, packet.blockType = body.cframe, body.blockType
        return binding.Remote[binding.Method](binding.Remote,table.unpack(args,1,args.n))
    end)
    if not ok or result == false or type(result) == "table" and result.success == false then return false, result end
    return true, result
end
local function learnBait(remote, method, args)
    if method ~= "InvokeServer" or type(args[1]) ~= "table" then return false end
    local known=remote.Name=="yrIxXd1d5bBQji" or remote.Name=="GDbJa5Ix6UZ8mg" or remote.Name=="wKCeyGAO4SqdMY" or remote.Name=="XPQExfDjDSUkYv" or remote.Name=="raqRasAwcny1zh"
        or string.find(string.lower(remote.Name),"bait",1,true)
    local group=remote.Parent
    if not known and (not group or not group.Parent or group.Parent.Name~="out") then return false end
    local packet=args[1]
    local body=packet
    for _,value in pairs(packet) do
        if type(value)=="table" and typeof(value.tool)=="Instance" then body=value;break end
    end
    local tool = body.tool
    if typeof(tool) ~= "Instance" or not tool:IsA("Tool") or string.lower(tool.Name) ~= "bait" then return false end
    local owner=game:GetService("Players").LocalPlayer
    if not owner or not owner.Character then return false end
    capture.BaitBinding = {Remote=remote,Method=method,Args=cloneArguments(args),Target=tool,
        OwnerUserId=owner.UserId,OwnerCharacter=owner.Character,JobId=game.JobId,ObservedAt=os.clock()}
    return true
end
function capture:CanUseBaitBinding()
    local binding=self.BaitBinding
    local owner=game:GetService("Players").LocalPlayer
    return binding~=nil and binding.Remote~=nil and binding.Remote.Parent~=nil and owner~=nil
        and binding.OwnerCharacter==owner.Character and owner.Character~=nil
        and binding.OwnerUserId==owner.UserId and binding.JobId==game.JobId
end
function capture:Bait(tool)
    local binding = self.BaitBinding
    if not self:CanUseBaitBinding() then return false, "Use bait once on this account and character to learn its current request" end
    if typeof(tool) ~= "Instance" or not tool:IsA("Tool") or string.lower(tool.Name) ~= "bait" then return false, "Bait tool unavailable" end
    local ok, result = pcall(function()
        local args = cloneArguments(binding.Args, binding.Target, tool)
        return binding.Remote[binding.Method](binding.Remote, table.unpack(args,1,args.n))
    end)
    if not ok or result == false or type(result) == "table" and result.success == false then return false, result end
    return true, result
end
-- Learn observed item withdrawals; never infer items or rotating envelope keys.
local function learnChest(remote,method,args)
    if method~="InvokeServer" or type(args[1])~="table" then return false end
    local group=remote.Parent
    if remote.Name~="kAnpiAlDrqMuEh" and remote.Name~="FiAxD3JcLWBD6I" and (not group or not group.Parent or group.Parent.Name~="out") then return false end
    local body=args[1]
    for _,value in pairs(body) do
        if type(value)=="table" and value.action=="withdraw" then body=value;break end
    end
    if body.action~="withdraw" or (type(body.item)~="string" or #body.item==0 or #body.item>128) or typeof(body.chest)~="Instance"
        or not (body.chest:IsA("Model") or body.chest:IsA("BasePart")) then return false end
    if type(body.slot)~="number" or body.slot<0 or body.slot%1~=0
        or type(body.amount)~="number" or body.amount<=0 or body.amount%1~=0 then return false end
    local owner=game:GetService("Players").LocalPlayer
    if not owner or not owner.Character then return false end
    local binding={Remote=remote,Method=method,Args=cloneArguments(args),Chest=body.chest,
        Slot=body.slot,Amount=body.amount,Item=body.item,OwnerUserId=owner.UserId,OwnerCharacter=owner.Character,JobId=game.JobId,ObservedAt=os.clock()}
    capture.ChestBinding=binding
    local replaced=false
    for i,old in ipairs(capture.ChestBindings) do
        if old.Chest==binding.Chest and old.Slot==binding.Slot then capture.ChestBindings[i]=binding;replaced=true;break end
    end
    if not replaced then table.insert(capture.ChestBindings,binding) end
    return true
end
function capture:CanUseChestBinding(binding)
    local b=binding or self.ChestBinding
    local owner=game:GetService("Players").LocalPlayer
    return b~=nil and b.Remote~=nil and b.Remote.Parent~=nil and b.Chest~=nil and b.Chest.Parent~=nil
        and owner~=nil and owner.Character~=nil and b.OwnerCharacter==owner.Character
        and b.OwnerUserId==owner.UserId and b.JobId==game.JobId
end
function capture:GetChestBindings()
    local result={}
    for _,binding in ipairs(self.ChestBindings) do
        if self:CanUseChestBinding(binding) then table.insert(result,binding) end
    end
    return result
end
-- Input/Output chests in the supplied clip have twelve slots. Include the
-- boundary index while the capture has not established zero/one-based indexing.
function capture:MakeChestTarget(binding,chest,slot)
    if not self:CanUseChestBinding(binding) then return nil end
    if typeof(chest)~="Instance" or not chest.Parent or not (chest:IsA("Model") or chest:IsA("BasePart")) or chest.Name~=binding.Chest.Name
        or string.lower(chest.Name)~="chestmediumindustrialio" then return nil end
    if type(slot)~="number" or slot<0 or slot>12 or slot%1~=0 then return nil end
    local target={}
    for key,value in pairs(binding) do target[key]=value end
    target.Args=cloneArguments(binding.Args,binding.Chest,chest)
    target.Chest=chest;target.Slot=slot;target.Generated=true
    return target
end
function capture:WithdrawCarrots(amount,binding)
    if not self:CanUseChestBinding(binding) then return false,"Learn an item withdrawal on this character first" end
    local b=binding or self.ChestBinding
    amount=amount==nil and b.Amount or amount
    if type(amount)~="number" or amount<=0 or amount%1~=0 or amount>1000000 then return false,"Choose a positive whole withdrawal amount" end
    local args=cloneArguments(b.Args)
    local body=args[1]
    if type(body)~="table" then return false,"Learn this chest withdrawal again" end
    if body.chest~=b.Chest then
        for _,value in pairs(body) do
            if type(value)=="table" and value.chest==b.Chest and value.action=="withdraw" then body=value;break end
        end
    end
    if body.chest~=b.Chest or body.action~="withdraw" or body.item~=(b.Item or "carrotHarvested") then return false,"Learn this chest withdrawal again" end
    -- Apply the selected slot and count to the cloned body; retain the learned session envelope.
    body.amount=amount
    body.slot=b.Slot
    local ok,result=pcall(function() return b.Remote[b.Method](b.Remote,table.unpack(args,1,args.n)) end)
    if not ok or result==false or type(result)=="table" and result.success==false then return false,result end
    return true,result
end
capture.WithdrawItems=capture.WithdrawCarrots
local function learnHarvest(remote, method, args)
    if args.n < 1 or type(args[1]) ~= "table" then return false end
    local packet = args[1]
    local body = type(packet.wGquKmyB3mV2Cf) == "table" and packet.wGquKmyB3mV2Cf
        or type(packet.a1tIHk1Kl9GiE5) == "table" and packet.a1tIHk1Kl9GiE5
        or (type(packet.TlSR8Mzd9FLwaZ) == "table" and packet.TlSR8Mzd9FLwaZ or packet)
    if type(packet.H3ZxjzDRyU5tvI)=="table" then body=packet.H3ZxjzDRyU5tvI end
    local target = body.model
    if typeof(target) ~= "Instance" or not (target:IsA("Model") or target:IsA("BasePart")) then return false end
    local name = string.lower(target.Name)
    local crop = false
    for _, word in ipairs({"wheat", "berry", "carrot", "potato", "corn", "tomato", "pumpkin", "melon", "cabbage", "lettuce", "flower"}) do
        if string.find(name, word, 1, true) then crop = true; break end
    end
    if not crop then return false end
    if not string.find(string.lower(remote.Name), "harvest", 1, true) and remote.Name ~= "hFuV0Z1w601mXP" and remote.Name ~= "COtnYCOPUThadM" and remote.Name ~= "UctIHHAfsCxxzj" then return false end
    capture.HarvestBinding = { Remote = remote, Method = method, Args = cloneArguments(args), Target = target }
    return true
end
function capture:Harvest(target)
    local binding = self.HarvestBinding
    if not binding or not binding.Remote.Parent then return false, "Harvest a crop manually once first" end
    if binding.Target:IsA("Model") ~= target:IsA("Model") then return false, "Crop target type differs from the learned request" end
    local ok, result = pcall(function()
        local args = cloneArguments(binding.Args, binding.Target, target)
        return binding.Remote[binding.Method](binding.Remote, table.unpack(args, 1, args.n))
    end)
    if not ok or result == false or type(result) == "table" and result.success == false then return false, result end
    return true, result
end
local original
local function intercept(remote, ...)
    if capture.Stopped then return original(remote, ...) end
    local method = getnamecallmethod()
    if capture.LearnWoodOnly or capture.LearnBaitOnly or capture.LearnChestOnly or capture.LearnPlowOnly then
        if method == "InvokeServer" then
            local args = table.pack(...)
            pcall(function()
                if typeof(remote)=="Instance" and remote:IsA("RemoteFunction") then
                    if capture.LearnPlowOnly and learnPlow(remote,method,args) then capture.LearnPlowOnly=false end
                    if capture.LearnWoodOnly then
                        local previousWood=capture.WoodHitBinding
                        learnBlockHit(remote,method,args)
                        local learnedWood=capture.WoodHitBinding
                        if learnedWood and learnedWood~=previousWood and learnedWood.Remote and learnedWood.Remote.Parent then capture.LearnWoodOnly=false end
                    end
                    if capture.LearnBaitOnly and learnBait(remote,method,args) then capture.LearnBaitOnly=false end
                    if capture.LearnChestOnly and learnChest(remote,method,args) and not capture.LearnChestMany then capture.LearnChestOnly=false end
                    if not capture.LearnWoodOnly and not capture.LearnBaitOnly and not capture.LearnChestOnly and not capture.LearnPlowOnly then capture:Stop() end
                end
            end)
        end
        return original(remote,...)
    end
    local autoReplantValue
    if not capture.Stopped and (capture.Active or #capture.Records >= capture.MaxCalls)
        and (method == "InvokeServer" or method == "FireServer") then
        local args = table.pack(...)
        -- Recorder failures must never cancel or replace the original game call.
        pcall(function()
            local learned = false
            if typeof(remote) == "Instance" and (remote:IsA("RemoteFunction") or remote:IsA("RemoteEvent")) then
                learned = learnHotbar(remote, method, args) or learnFruit(remote, method, args)
                if not learned then learned,autoReplantValue=learnAutoReplant(remote, method, args) end
                learned = learned or learnPlow(remote,method,args) or learnChest(remote,method,args) or learnBlockHit(remote, method, args) or learnPlacement(remote, method, args) or learnBait(remote, method, args) or learnHarvest(remote, method, args)
            end
            if not learned and not wanted(remote) then return end
            -- Keep the observed per-remote request ID in memory for this session.
            -- Never substitute IDs between different remote names.
            if exactNames[remote.Name] and type(args[1]) == "table"
                and type(args[1].TrNhTTgExIb1Bg) == "string" then
                capture.RequestIds[remote.Name] = args[1].TrNhTTgExIb1Bg
            end
            -- Keep learning live context after the log fills, without adding more records.
            if not capture.Active then return end
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
    if autoReplantValue~=nil then
        -- Observing a setting request does not prove the server accepted it.
        -- Snapshot its value before the original call can yield or mutate the packet.
        -- Do not catch original errors, and retain every return (including nils).
        local returned=table.pack(original(remote,...))
        pcall(function()
            local response=returned[1]
            if response~=false and not (type(response)=="table" and response.success==false) then
                capture.AutoReplantState=autoReplantValue
            end
        end)
        return table.unpack(returned,1,returned.n)
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

return capture
