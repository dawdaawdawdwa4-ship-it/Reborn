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
-- Bosses and harmless critters are never targets; kind is "Slimes", "All mobs" or one exact mob name.
MobFarm.Excluded={"king","queen","boss","firefly","fireflies","butterfl"}
function MobFarm.Matches(name,kind)
    local compact=string.lower(name):gsub("[%s_%-]","")
    for _,word in ipairs(MobFarm.Excluded) do if compact:find(word,1,true) then return false end end
    if kind==nil or kind=="Slimes" then return compact:find("slime",1,true)~=nil end
    return kind=="All mobs" or name==kind
end
function MobFarm.Details(model,roots,players,kind)
    if not model or not model:IsA("Model") or not table.find(roots,model.Parent) then return nil end
    if players:GetPlayerFromCharacter(model) then return nil end
    if not MobFarm.Matches(model.Name,kind) then return nil end
    local humanoid=model:FindFirstChildOfClass("Humanoid")
    local root=model:FindFirstChild("HumanoidRootPart")
    if not humanoid or not root or not root:IsA("BasePart") then return nil end
    return humanoid,root
end
function MobFarm.new(ctx)
    local self={Enabled=false,Generation=0,Radius=60,Walk=true,Kind="Slimes",Swings=0,Drops=0,Defeats=0,LikelyDefeats=0,
        Message="Equip a melee weapon, then Learn attack and hit one slime manually.",Reach=6,
        ChaseRange=24,TargetBudget=4,RunBudget=12,Travel="Walk",HopDistance=8,SeekRange=300,
        Standoff=2.5,AutoEat=true,EatBelow=.5,RetreatBelow=.35,ResumeAbove=.5,WalkSpeed=24}
    local now=ctx.Now or os.clock
    local scheduler=ctx.Scheduler or task
    local function usable(recorder)
        if ctx.BindingUsable then return ctx.BindingUsable(recorder) end
        return recorder:CanUseMobBinding()
    end
    local function publish(text)
        self.Message=text
        if ctx.Update then ctx.Update(self) end
    end
    -- Faster travel while the farm moves the character; the original speed returns on every halt.
    local function boost(human,on)
        if not ctx.Boost then return end
        if on then
            if self.BoostedHuman~=human then
                if self.BoostedHuman then pcall(ctx.Boost,self.BoostedHuman,nil) end
                self.BoostedHuman=human
            end
            pcall(ctx.Boost,human,self.WalkSpeed)
        elseif self.BoostedHuman then
            pcall(ctx.Boost,self.BoostedHuman,nil);self.BoostedHuman=nil
        end
    end
    local function halt()
        ctx.Navigation.Stop("Mobs")
        -- Direct chasing bypasses the pathfinder, so clear its MoveTo destination here too.
        local chase=self.Chase
        self.Chase=nil
        if chase then pcall(function() chase.Humanoid:MoveTo(chase.Root.Position) end) end
        boost(nil,false)
    end
    -- Stand outside the mob: a melee raycast that starts inside its body hits nothing, and a slime
    -- the character is inside of hits constantly. Half its width plus a margin, within reach.
    local function standoffFor(entry)
        local size=0
        pcall(function() local s=entry.Root.Size;size=math.max(s.X,s.Z) end)
        if size==0 then pcall(function() local s=entry.Model:GetExtentsSize();size=math.max(s.X,s.Z) end) end
        return math.min(self.Reach-.5,math.max(self.Standoff,size/2+1.5))
    end
    -- Hopping slimes invalidate computed paths; follow nearby visible ones directly.
    local function chase(human,root,target,keep)
        local offset=target.Position-root.Position
        if offset.Magnitude<.1 then return false end
        boost(human,true)
        local ok=pcall(function() human:MoveTo(target.Position-offset.Unit*(keep or 3)) end)
        if ok then self.Chase={Humanoid=human,Root=root} end
        return ok
    end
    -- Step away from a mob: low health, a mob standing on the character, or a stop that would
    -- otherwise leave the character inside the mob's attacks.
    local function retreat(human,root,threat,distance)
        local away=root.Position-threat.Position
        if away.Magnitude<.1 then return false end
        boost(human,true)
        local ok=pcall(function() human:MoveTo(root.Position+away.Unit*(distance or 12)) end)
        if ok then self.Chase={Humanoid=human,Root=root} end
        return ok
    end
    function self:ReleaseSwing(press)
        press=press or self.Press
        if not press or press.Released then return true end
        local ok,result=pcall(function()
            if press.Release then return press.Release() end
            return press.Tool:Deactivate()
        end)
        if not ok or result==false then return false end
        press.Released=true
        if self.Press==press then self.Press=nil end
        return true
    end
    -- A live clip showed Activate() swinging the axe beside a slime with no HP change: the weapon's
    -- client hits what the cursor points at. So a swing is a real click aimed at the target when the
    -- host can aim one, with Activate() as the fallback (off-screen target, no mouse API).
    function self:Swing(tool,canStart,active,target)
        active=active or canStart
        if not canStart() then return false,"Swing cancelled" end
        if self.Press then return false,"Previous weapon activation is still releasing" end
        if tool.Enabled==false then return false,"Weapon is cooling down" end
        local x,y,aimReason
        if target and ctx.Aim and ctx.Click then
            local aimed,ax,ay=pcall(ctx.Aim,target)
            if aimed and ax and ay then x,y=ax,ay else aimReason=aimed and ay or ax end
        end
        local press={Tool=tool}
        if x then press.Release=function() return ctx.Click(x,y,false) end end
        self.Press=press
        local method=x and "mouse click at target" or "weapon activation"
        local ok,result=pcall(function()
            if x then
                if ctx.Click(x,y,true)==false then error("Mouse input unavailable",0) end
            else
                local activated=tool:Activate()
                if activated==false then error("Weapon activation was refused",0) end
            end
            if active() then scheduler.wait(.08) end
        end)
        if not self:ReleaseSwing(press) then return false,"Weapon release failed · press STOP to retry" end
        if not ok then return false,result end
        if not active() then return false,"Swing cancelled" end
        -- Escalation: with the animation now playing, a learned hit packet is accepted where a bare
        -- replay got NO_ANIMATION. Used only after clicks/activation produced no HP change.
        if self.UseLearnedHit and target and ctx.LearnedHit then
            local sent,detail=ctx.LearnedHit(target.Model)
            method=method..(sent and " + learned hit" or " + learned hit rejected ("..(ctx.DescribeResult and ctx.DescribeResult(detail) or tostring(detail))..")")
        end
        self.LastMethod=method..(aimReason and x==nil and " (aim: "..tostring(aimReason)..")" or "")
        return true,self.LastMethod.." · checking for HP changes"
    end
    function self:RunTime()
        if not self.StartedAt then return 0 end
        return math.max(0,(self.EndedAt or now())-self.StartedAt)
    end
    -- A live clip showed a stopped run leaving the character inside a slime until it died.
    function self:SafetyStep()
        if not self.Walk or not ctx.Player or not ctx.Navigation then return false end
        local char=ctx.Player.Character
        local human=char and char:FindFirstChildOfClass("Humanoid")
        local root=char and char:FindFirstChild("HumanoidRootPart")
        if not human or not root or human.Health<=0 then return false end
        local ok,threat=pcall(function() return self:Scan(nil,10)[1] end)
        if not ok or not threat then return false end
        local stepped=retreat(human,root,threat.Root,12)
        -- One MoveTo that finishes on its own; a stopped farm holds no movement state or speed.
        self.Chase=nil
        boost(nil,false)
        return stepped
    end
    function self:Stop(reason)
        if self.StartedAt and not self.EndedAt then self.EndedAt=now() end
        self.Enabled=false;self.Generation+=1;self.Target=nil
        halt()
        if not (reason and string.find(reason,"another mode",1,true)) and self:SafetyStep() then
            reason=(reason or "Stopped · movement and attacks cancelled").." · stepping away from the mob"
        end
        local released=self:ReleaseSwing()
        publish(not released and "Weapon release failed · press STOP to retry" or reason or "Stopped · movement and attacks cancelled")
    end
    function self:Scan(cooldowns,radius)
        local char=ctx.Player.Character
        local root=char and char:FindFirstChild("HumanoidRootPart")
        if not root then return {} end
        local roots=MobFarm.Roots(ctx.World)
        local result={}
        for _,folder in ipairs(roots) do
            for _,model in ipairs(folder:GetChildren()) do
                local health,part=MobFarm.Details(model,roots,ctx.Players,self.Kind)
                if health and health.Health>0 and (not cooldowns or not cooldowns[model] or cooldowns[model]<=now()) then
                    local distance=(part.Position-root.Position).Magnitude
                    if distance<=(radius or self.Radius) then table.insert(result,{Model=model,Humanoid=health,Root=part,Distance=distance}) end
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
        self.Enabled=true;self.Worker=token;self.Swings=0;self.Drops=0;self.Defeats=0;self.LikelyDefeats=0;self.KillsByName={}
        self.LastResult=nil;self.LastTarget=nil;self.LastMethod=nil;self.UseLearnedHit=false;self.Meals=0;self.LastEat=nil;self.StartedAt=now();self.EndedAt=nil
        publish("Scanning for slimes · Auto Move "..(not self.Walk and "OFF" or self.Travel=="Teleport" and "TP hops" or "Walk"))
        scheduler.spawn(function()
            local healthSeen=setmetatable({},{__mode="k"})
            local cooldowns=setmetatable({},{__mode="k"})
            local attackedAt=setmetatable({},{__mode="k"})
            local maxHit=0
            local lastAttack=-math.huge
            local attempts=0
            local unconfirmed=0
            local lastEat=-math.huge
            local progress={}
            local recovering=false
            local function active()
                return ctx.Alive() and self.Enabled and self.Generation==token and not ctx.Busy()
            end
            local function observe(model)
                local previous=healthSeen[model]
                local health=MobFarm.Details(model,MobFarm.Roots(ctx.World),ctx.Players,self.Kind)
                -- Streaming out is not proof of death; all counters describe observations.
                if health and previous and health.Health<previous then
                    -- A late drop on an earlier target must not reset the current target's budget.
                    self.Drops+=1;unconfirmed=0
                    if model==self.Target then attempts=0 end
                    maxHit=math.max(maxHit,previous-health.Health)
                    if previous>0 and health.Health<=0 then
                        self.Defeats+=1;self.KillsByName[model.Name]=(self.KillsByName[model.Name] or 0)+1
                    end
                end
                if health then healthSeen[model]=health.Health end
            end
            local ok,failure=pcall(function()
                while active() do
                    if self.Target then observe(self.Target) end
                    -- HP replication can trail a swing; keep watching recent targets after a switch.
                    for model,at in pairs(attackedAt) do
                        if not MobFarm.Details(model,MobFarm.Roots(ctx.World),ctx.Players,self.Kind) then
                            -- Slimes usually despawn at 0 HP before it replicates. Removal right after a hit
                            -- that could finish it is counted separately as a likely defeat, never as observed.
                            local last=healthSeen[model]
                            if last and last>0 and maxHit>0 and last<=maxHit then
                                self.LikelyDefeats+=1;self.KillsByName[model.Name]=(self.KillsByName[model.Name] or 0)+1
                            end
                            attackedAt[model]=nil
                            if self.Target==model then self.Target=nil end
                        elseif now()-at>3 then attackedAt[model]=nil
                        elseif model~=self.Target then observe(model) end
                    end
                    local char=ctx.Player.Character
                    local human=char and char:FindFirstChildOfClass("Humanoid")
                    local root=char and char:FindFirstChild("HumanoidRootPart")
                    if not human or not root or human.Health<=0 then
                        halt();self.Target=nil;publish("Paused · waiting for your character")
                    elseif not usable(recorder) then
                        self:Stop("Character/session changed · learn one manual attack again");return
                    else
                        local fraction=human.MaxHealth>0 and human.Health/human.MaxHealth or 0
                        -- Food first: eating is quicker than walking away and keeps the run going.
                        if self.AutoEat and ctx.Eat and fraction<=self.EatBelow and now()-lastEat>=4 then
                            lastEat=now()
                            publish("Eating · HP "..math.floor(fraction*100).."%")
                            local ate,detail=ctx.Eat()
                            self.LastEat=(ate and "ate " or "could not eat · ")..tostring(detail)
                            if not active() then return end
                            if ate then self.Meals=(self.Meals or 0)+1 end
                            fraction=human.MaxHealth>0 and human.Health/human.MaxHealth or 0
                        end
                        recovering=fraction<=self.RetreatBelow or recovering and fraction<self.ResumeAbove
                        local paused=ctx.PauseReason()
                        if recovering or paused then
                            self.Target=nil
                            local threat=recovering and not paused and self.Walk and self:Scan()[1]
                            if threat and threat.Distance<12 and retreat(human,root,threat.Root) then
                                publish("Retreating from "..threat.Model.Name.." · low health; resumes at "..math.floor(self.ResumeAbove*100).."% HP")
                            else
                                halt()
                                publish(recovering and ("Paused · low health; resumes at "..math.floor(self.ResumeAbove*100).."% HP") or paused)
                            end
                        else
                            local targets=self:Scan(cooldowns)
                            local limit=self.Radius
                            -- Nothing in the search radius: with Auto Move on, travel to the nearest loaded
                            -- target within SeekRange instead of idling just outside the radius.
                            if #targets==0 and self.Walk and self.SeekRange>self.Radius then
                                targets=self:Scan(cooldowns,self.SeekRange);limit=self.SeekRange
                            end
                            local chosen
                            -- Keep the current living target instead of bouncing between close mobs.
                            for _,entry in ipairs(targets) do if entry.Model==self.Target then chosen=entry;break end end
                            if not chosen and targets[1] then
                                -- Among slimes about as close as the nearest, finish the most damaged one first.
                                chosen=targets[1]
                                for _,entry in ipairs(targets) do
                                    if entry.Distance>targets[1].Distance+6 then break end
                                    if entry.Humanoid.Health<chosen.Humanoid.Health then chosen=entry end
                                end
                            end
                            if not chosen then
                                halt();self.Target=nil
                                local label=self.Kind=="Slimes" and "slimes" or self.Kind=="All mobs" and "mobs" or self.Kind
                                -- Mobs hidden only by their no-damage cooldown are not "missing".
                                local cooling,soonest=0,nil
                                for _,entry in ipairs(self:Scan(nil,limit)) do
                                    local until_=cooldowns[entry.Model]
                                    if until_ and until_>now() then cooling+=1;soonest=math.min(soonest or until_,until_) end
                                end
                                if cooling>0 then
                                    -- Do not stand inside a mob while waiting on it.
                                    local close=self.Walk and self:Scan(nil,self.Standoff*2)[1]
                                    if close then retreat(human,root,close.Root,8) end
                                    publish("Waiting · "..cooling.." "..label.." cooling down after no HP drop · retry in "..math.max(1,math.ceil(soonest-now())).."s")
                                else publish("Waiting · no living "..label.." within "..(self.Walk and math.max(self.Radius,self.SeekRange) or self.Radius).." studs; scanning continues") end
                            else
                                if self.Target~=chosen.Model then attempts=0;progress={} end
                                self.Target=chosen.Model;observe(self.Target)
                                local function valid()
                                    if not active() or ctx.Player.Character~=char or human.Health<=human.MaxHealth*self.RetreatBelow or ctx.PauseReason() then return false end
                                    if char:FindFirstChild("HumanoidRootPart")~=root or char:FindFirstChildOfClass("Humanoid")~=human then return false end
                                    local h,p=MobFarm.Details(chosen.Model,MobFarm.Roots(ctx.World),ctx.Players,self.Kind)
                                    return h==chosen.Humanoid and p==chosen.Root and h.Health>0
                                        and (p.Position-root.Position).Magnitude<=limit
                                end
                                local chasing=false
                                local standoff=standoffFor(chosen)
                                if chosen.Distance>self.Reach then
                                    local clear=self.Walk and ctx.ClearLine(root,chosen.Root,char,chosen.Model)
                                    -- Teleport mode loops short hops, one per tick; walls still route through the pathfinder.
                                    local teleport=clear and self.Travel=="Teleport" and ctx.Hop~=nil
                                    local close=teleport or clear and chosen.Distance<=self.ChaseRange
                                        -- Hops lift the slime; allow more height once a chase is underway.
                                        and math.abs(chosen.Root.Position.Y-root.Position.Y)<(progress.Best and 12 or 6)
                                    if close then
                                        chasing=true
                                        if not progress.Best or chosen.Distance<progress.Best-.5 then
                                            progress.Best=chosen.Distance;progress.At=now()
                                        end
                                        if now()-progress.At>2 then
                                            halt();cooldowns[chosen.Model]=now()+3;self.Target=nil
                                            publish((teleport and "Teleport" or "Chase").." stalled · trying another slime shortly")
                                        elseif teleport then
                                            if self.Chase then halt() end
                                            local offset=chosen.Root.Position-root.Position
                                            local hop=math.min(self.HopDistance,offset.Magnitude-(standoff+1))
                                            if hop>.1 and pcall(ctx.Hop,root,root.Position+offset.Unit*hop,chosen.Root) then
                                                publish("Teleporting · "..chosen.Model.Name.." · "..math.floor(chosen.Distance).." studs")
                                            else
                                                cooldowns[chosen.Model]=now()+3;self.Target=nil
                                                publish("Teleport unavailable · trying another slime shortly")
                                            end
                                        elseif chase(human,root,chosen.Root,standoff+1) then
                                            publish("Chasing · "..chosen.Model.Name.." · "..math.floor(chosen.Distance).." studs")
                                        else
                                            halt();cooldowns[chosen.Model]=now()+3;self.Target=nil
                                            publish("Movement unavailable · trying another slime shortly")
                                        end
                                    elseif self.Walk then
                                        if self.Chase then halt() end
                                        publish("Walking · "..chosen.Model.Name.." · "..math.floor(chosen.Distance).." studs")
                                        local point=chosen.Root.Position
                                        boost(human,true)
                                        local arrived=ctx.Navigation.Approach(ctx.Player,chosen.Model,math.max(4,standoff+1),function()
                                            return valid() and (chosen.Root.Position-point).Magnitude<6
                                        end,function() return chosen.Root.Position end,"Walk","Mobs")
                                        if not active() then return end
                                        if not arrived and valid() and (chosen.Root.Position-point).Magnitude<6 then
                                            cooldowns[chosen.Model]=now()+3
                                            publish("Path blocked · trying another slime shortly")
                                        end
                                    else publish("Waiting · move within 6 studs or enable Auto Move") end
                                elseif now()-lastAttack>=.65 and valid() then
                                    if self.Chase then halt() end
                                    local tool=ctx.Weapon(recorder.MobBinding.WeaponName)
                                    if not tool or not ctx.Equip(tool) then
                                        self:Stop("Learned weapon unavailable · equip it and learn attack again");return
                                    end
                                    -- Equipping may yield or change the character/target. Recheck before sending.
                                    if tool.Enabled==false then publish("Waiting · weapon cooldown")
                                    elseif valid() and tool.Parent==char and (chosen.Root.Position-root.Position).Magnitude<=self.Reach then
                                        if ctx.ClearLine(root,chosen.Root,char,chosen.Model) then
                                            -- A mob on top of the character hits constantly and blocks the weapon's own
                                            -- raycast; swing from just outside its body.
                                            local gap=(chosen.Root.Position-root.Position).Magnitude
                                            if self.Walk and gap<standoff then
                                                retreat(human,root,chosen.Root,math.max(1,standoff+1-gap))
                                            else boost(nil,false) end
                                            -- Native melee hits what the character faces, not what the hub selected.
                                            if ctx.Face then pcall(ctx.Face,root,chosen.Root) end
                                            lastAttack=now()
                                            self.LastTarget=chosen.Model.Name
                                            local sent,detail=self:Swing(tool,valid,function()
                                                return active() and ctx.Player.Character==char and tool.Parent==char
                                                    and char:FindFirstChild("HumanoidRootPart")==root
                                                    and char:FindFirstChildOfClass("Humanoid")==human
                                            end,chosen)
                                            if not active() then return end
                                            self.LastResult=ctx.DescribeResult and ctx.DescribeResult(detail) or tostring(detail)
                                            if not sent then self:Stop("Attack stopped · "..self.LastResult);return end
                                            self.Swings+=1;attempts+=1;unconfirmed+=1
                                            attackedAt[chosen.Model]=now()
                                            observe(chosen.Model)
                                            publish("Attacking · "..chosen.Model.Name.." · HP "..math.max(0,math.ceil(chosen.Humanoid.Health)))
                                            if unconfirmed>=self.RunBudget then
                                                self:Stop("No HP drop observed after "..self.RunBudget.." swings · check weapon activation, range and facing");return
                                            elseif attempts>=self.TargetBudget then
                                                if ctx.LearnedHit and not self.UseLearnedHit then
                                                    -- Try the stronger method on this same target before giving up on it.
                                                    self.UseLearnedHit=true;attempts=0
                                                    publish("No HP drop from clicks · adding the learned hit packet")
                                                else
                                                    -- One unhittable slime must not end the whole run.
                                                    cooldowns[chosen.Model]=now()+5;self.Target=nil;attempts=0
                                                    publish("No HP drop on "..chosen.Model.Name.." · trying another slime")
                                                end
                                            end
                                        else
                                            cooldowns[chosen.Model]=now()+3;publish("Target obstructed · trying another slime")
                                        end
                                    end
                                end
                                -- Stall detection only measures one uninterrupted chase.
                                if not chasing then progress={} end
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
                    self.Enabled=false;self.Target=nil;self.EndedAt=self.EndedAt or now();halt()
                    publish(ok and "Stopped · another mode took control" or "Stopped · "..tostring(failure))
                elseif ctx.Update then ctx.Update(self) end
            end
        end)
        return true
    end
    return self
end
return MobFarm
