-- Slime targeting and one cancellable combat worker. No camera or cursor writes.
local MobFarm={}
function MobFarm.Roots(world)
    local roots={}
    local wilderness=world:FindFirstChild("WildernessIsland")
    local nested=wilderness and wilderness:FindFirstChild("Entities")
    local direct=world:FindFirstChild("Entities")
    if nested then table.insert(roots,nested) end
    if direct and direct~=nested then table.insert(roots,direct) end
    return roots
end
function MobFarm.Details(model,roots,players)
    if not model or not model:IsA("Model") or not table.find(roots,model.Parent) then return nil end
    if players:GetPlayerFromCharacter(model) then return nil end
    local name=model.Name:lower():gsub("[%s_%-]","")
    if not name:find("slime",1,true) or name:find("king",1,true)
        or name:find("queen",1,true) or name:find("boss",1,true) then return nil end
    local humanoid=model:FindFirstChildOfClass("Humanoid")
    local root=model:FindFirstChild("HumanoidRootPart")
    if not humanoid or not root or not root:IsA("BasePart") then return nil end
    return humanoid,root
end
function MobFarm.new(ctx)
    local self={Enabled=false,Generation=0,Radius=60,Walk=true,Swings=0,Drops=0,Defeats=0,
        Message="Equip a melee weapon, then Learn attack and hit one slime manually.",Reach=6}
    local now=ctx.Now or os.clock
    local scheduler=ctx.Scheduler or task
    local function publish(text)
        self.Message=text
        if ctx.Update then ctx.Update(self) end
    end
    local function halt() ctx.Navigation.Stop("Mobs") end
    function self:ReleaseSwing(press)
        press=press or self.Press
        if not press or press.Released then return true end
        local ok,result=pcall(function() return press.Tool:Deactivate() end)
        if not ok or result==false then return false end
        press.Released=true
        if self.Press==press then self.Press=nil end
        return true
    end
    function self:Swing(tool,canStart,active)
        active=active or canStart
        if not canStart() then return false,"Swing cancelled" end
        if self.Press then return false,"Previous weapon activation is still releasing" end
        if tool.Enabled==false then return false,"Weapon is cooling down" end
        local press={Tool=tool}
        self.Press=press
        -- The weapon's own client must start its animation and send the hit. Replaying
        -- only the learned hitUnit packet fails server validation with NO_ANIMATION.
        local ok,result=pcall(function()
            local activated=tool:Activate()
            if activated==false then error("Weapon activation was refused",0) end
            if active() then scheduler.wait(.08) end
        end)
        if not self:ReleaseSwing(press) then return false,"Weapon release failed · press STOP to retry" end
        if not ok then return false,result end
        if not active() then return false,"Swing cancelled" end
        return true,"Weapon activated · checking for HP changes"
    end
    function self:Stop(reason)
        self.Enabled=false;self.Generation+=1;self.Target=nil
        halt()
        local released=self:ReleaseSwing()
        publish(not released and "Weapon release failed · press STOP to retry" or reason or "Stopped · movement and attacks cancelled")
    end
    function self:Scan(cooldowns)
        local char=ctx.Player.Character
        local root=char and char:FindFirstChild("HumanoidRootPart")
        if not root then return {} end
        local roots=MobFarm.Roots(ctx.World)
        local result={}
        for _,folder in ipairs(roots) do
            for _,model in ipairs(folder:GetChildren()) do
                local health,part=MobFarm.Details(model,roots,ctx.Players)
                if health and health.Health>0 and (not cooldowns or not cooldowns[model] or cooldowns[model]<=now()) then
                    local distance=(part.Position-root.Position).Magnitude
                    if distance<=self.Radius then table.insert(result,{Model=model,Humanoid=health,Root=part,Distance=distance}) end
                end
            end
        end
        table.sort(result,function(a,b) return a.Distance<b.Distance end)
        return result
    end
    function self:Start()
        if not ctx.Alive() then return false end
        if self.Enabled then return true end
        if self.Worker then publish("Finishing the previous walk · start again in a moment");return false end
        if not self:ReleaseSwing() then publish("Weapon release failed · press STOP to retry");return false end
        local busy=ctx.Busy()
        if busy then publish(busy);return false end
        local recorder=ctx.Recorder()
        if not recorder then publish("Learn attack first · equip a melee weapon and hit one slime manually");return false end
        self.Generation+=1
        local token=self.Generation
        self.Enabled=true;self.Worker=token;self.Swings=0;self.Drops=0;self.Defeats=0
        self.LastResult=nil;self.LastTarget=nil
        publish("Scanning for slimes · Auto Walk "..(self.Walk and "ON" or "OFF"))
        scheduler.spawn(function()
            local healthSeen=setmetatable({},{__mode="k"})
            local cooldowns=setmetatable({},{__mode="k"})
            local lastAttack=-math.huge
            local attempts=0
            local recovering=false
            local function active()
                return ctx.Alive() and self.Enabled and self.Generation==token and not ctx.Busy()
            end
            local function observe(model)
                local previous=healthSeen[model]
                local health=MobFarm.Details(model,MobFarm.Roots(ctx.World),ctx.Players)
                -- Streaming out is not proof of death; all counters describe observations.
                if health and previous and health.Health<previous then
                    self.Drops+=1;attempts=0
                    if previous>0 and health.Health<=0 then self.Defeats+=1 end
                end
                if health then healthSeen[model]=health.Health end
            end
            local ok,failure=pcall(function()
                while active() do
                    if self.Target then observe(self.Target) end
                    local char=ctx.Player.Character
                    local human=char and char:FindFirstChildOfClass("Humanoid")
                    local root=char and char:FindFirstChild("HumanoidRootPart")
                    if not human or not root or human.Health<=0 then
                        halt();self.Target=nil;publish("Paused · waiting for your character")
                    elseif not recorder:CanUseMobBinding() then
                        self:Stop("Character/session changed · learn one manual attack again");return
                    else
                        local fraction=human.MaxHealth>0 and human.Health/human.MaxHealth or 0
                        recovering=fraction<=.25 or recovering and fraction<.45
                        local paused=ctx.PauseReason()
                        if recovering or paused then
                            halt();self.Target=nil
                            publish(recovering and "Paused · low health; resumes at 45% HP" or paused)
                        else
                            local targets=self:Scan(cooldowns)
                            local chosen
                            -- Keep the current living target instead of bouncing between close mobs.
                            for _,entry in ipairs(targets) do if entry.Model==self.Target then chosen=entry;break end end
                            chosen=chosen or targets[1]
                            if not chosen then
                                halt();self.Target=nil;publish("Waiting · no living slimes within "..self.Radius.." studs; scanning continues")
                            else
                                if self.Target~=chosen.Model then attempts=0 end
                                self.Target=chosen.Model;observe(self.Target)
                                local function valid()
                                    if not active() or ctx.Player.Character~=char or human.Health<=human.MaxHealth*.25 or ctx.PauseReason() then return false end
                                    if char:FindFirstChild("HumanoidRootPart")~=root or char:FindFirstChildOfClass("Humanoid")~=human then return false end
                                    local h,p=MobFarm.Details(chosen.Model,MobFarm.Roots(ctx.World),ctx.Players)
                                    return h==chosen.Humanoid and p==chosen.Root and h.Health>0
                                        and (p.Position-root.Position).Magnitude<=self.Radius
                                end
                                if chosen.Distance>self.Reach then
                                    if self.Walk then
                                        publish("Walking · "..chosen.Model.Name.." · "..math.floor(chosen.Distance).." studs")
                                        local point=chosen.Root.Position
                                        local arrived=ctx.Navigation.Approach(ctx.Player,chosen.Model,4,function()
                                            return valid() and (chosen.Root.Position-point).Magnitude<6
                                        end,function() return chosen.Root.Position end,"Walk","Mobs")
                                        if not active() then return end
                                        if not arrived and valid() and (chosen.Root.Position-point).Magnitude<6 then
                                            cooldowns[chosen.Model]=now()+3
                                            publish("Path blocked · trying another slime shortly")
                                        end
                                    else publish("Waiting · move within 6 studs or enable Auto Walk") end
                                elseif now()-lastAttack>=.65 and valid() then
                                    local tool=ctx.Weapon(recorder.MobBinding.WeaponName)
                                    if not tool or not ctx.Equip(tool) then
                                        self:Stop("Learned weapon unavailable · equip it and learn attack again");return
                                    end
                                    -- Equipping may yield or change the character/target. Recheck before sending.
                                    if tool.Enabled==false then publish("Waiting · weapon cooldown")
                                    elseif valid() and tool.Parent==char and (chosen.Root.Position-root.Position).Magnitude<=self.Reach then
                                        if ctx.ClearLine(root,chosen.Root,char,chosen.Model) then
                                            lastAttack=now()
                                            self.LastTarget=chosen.Model.Name
                                            local sent,detail=self:Swing(tool,valid,function()
                                                return active() and ctx.Player.Character==char and tool.Parent==char
                                                    and char:FindFirstChild("HumanoidRootPart")==root
                                                    and char:FindFirstChildOfClass("Humanoid")==human
                                            end)
                                            if not active() then return end
                                            self.LastResult=ctx.DescribeResult and ctx.DescribeResult(detail) or tostring(detail)
                                            if not sent then self:Stop("Attack stopped · "..self.LastResult);return end
                                            self.Swings+=1;attempts+=1
                                            observe(chosen.Model)
                                            publish("Attacking · "..chosen.Model.Name.." · HP "..math.max(0,math.ceil(chosen.Humanoid.Health)))
                                            if attempts>=8 then
                                                self:Stop("No HP drop observed after 8 swings · check weapon activation, range and facing");return
                                            end
                                        else
                                            cooldowns[chosen.Model]=now()+3;publish("Target obstructed · trying another slime")
                                        end
                                    end
                                end
                            end
                        end
                    end
                    if not active() then return end
                    scheduler.wait(.15)
                end
            end)
            if self.Worker==token then
                self.Worker=nil
                if self.Generation==token then
                    self.Enabled=false;self.Target=nil;halt()
                    publish(ok and "Stopped · another mode took control" or "Stopped · "..tostring(failure))
                elseif ctx.Update then ctx.Update(self) end
            end
        end)
        return true
    end
    return self
end
return MobFarm
