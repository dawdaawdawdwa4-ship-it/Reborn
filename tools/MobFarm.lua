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
-- Some games keep mob HP in an attribute or value and never replicate Humanoid.Health.
function MobFarm.HealthOf(model,humanoid)
    local value
    pcall(function() value=model:GetAttribute("Health") end)
    if type(value)~="number" then pcall(function() value=model:GetAttribute("HP") end) end
    if type(value)~="number" then
        local child=model:FindFirstChild("Health") or model:FindFirstChild("HP")
        if child and type(child.Value)=="number" then value=child.Value end
    end
    if type(value)=="number" then return value end
    return humanoid.Health
end
function MobFarm.new(ctx)
    local self={Enabled=false,Generation=0,Radius=60,Walk=true,Kind="Slimes",Swings=0,Drops=0,Defeats=0,LikelyDefeats=0,Loot=0,LootByName={},DamageNumbers=0,DamageTotal=0,KeepDistance="Auto",
        Message="Equip a melee weapon, then Learn attack and hit one slime manually.",Reach=6,
        ChaseRange=24,TargetBudget=6,RunBudget=12,Travel="Walk",HopDistance=8,SeekRange=300,
        Standoff=2.5,AutoEat=true,EatBelow=.5,RetreatBelow=.45,ResumeAbove=.7,SafeDistance=20,RegenTimeout=45,HitAndRun=true,RestDistance=12,PacketReach=9,Smart=true,KeepBias=0,JumpIntervals={},DamageTaken=0,HitsTaken=0,HitsAfterSwing=0,WalkSpeed=24}
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
        self.LastCommand="halt";self.LastCommandAt=now()
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
        -- A slime's root part is small; its body (model extents) is what must be kept outside of.
        local size=0
        pcall(function() local s=entry.Root.Size;size=math.max(s.X,s.Z) end)
        pcall(function() local s=entry.Model:GetExtentsSize();size=math.max(size,s.X,s.Z) end)
        return math.min(self.Reach-.5,math.max(self.Standoff,size/2+1.5))
    end
    -- Hopping slimes invalidate computed paths; follow nearby visible ones directly.
    local function chase(human,root,target,keep)
        local offset=target.Position-root.Position
        if offset.Magnitude<.1 then return false end
        self.LastCommand="chase";self.LastCommandAt=now()
        boost(human,true)
        local ok=pcall(function() human:MoveTo(target.Position-offset.Unit*(keep or 3)) end)
        if ok then self.Chase={Humanoid=human,Root=root} end
        return ok
    end
    -- Step away from a mob: low health, a mob standing on the character, or a stop that would
    -- otherwise leave the character inside the mob's attacks.
    -- Ground under a walk destination (ctx.Ground raycasts); without the hook every point counts.
    local function grounded(point)
        if not ctx.Ground then return true end
        local ok,result=pcall(ctx.Ground,point)
        return not ok or result~=false
    end
    -- Walking off the island is worse than standing still: the retreat point must have ground
    -- under it; otherwise half the distance, then either side, then no move at all.
    local function retreat(human,root,threat,distance,away)
        away=away or root.Position-threat.Position
        if ctx.Flatten then away=ctx.Flatten(away) end
        if away.Magnitude<.1 then return false end
        distance=distance or 12
        local candidates={}
        for _,fraction in ipairs({1,.75,.5,.25}) do table.insert(candidates,root.Position+away.Unit*(distance*fraction)) end
        if ctx.Side then
            local ok,side=pcall(ctx.Side,away)
            if ok and side and side.Magnitude>.1 then
                table.insert(candidates,root.Position+side.Unit*distance)
                table.insert(candidates,root.Position-side.Unit*distance)
            end
        end
        local destination
        for _,point in ipairs(candidates) do if grounded(point) then destination=point;break end end
        if not destination then self.EdgeStops=(self.EdgeStops or 0)+1;return false end
        self.LastCommand="retreat";self.LastCommandAt=now()
        boost(human,true)
        local ok=pcall(function() human:MoveTo(destination) end)
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
        -- The game's own hit packet names the target, so it lands whenever the server accepts it,
        -- while a click only lands when the swing animation happens to overlap the mob. With the
        -- animation now playing, the packet is accepted where a bare replay got NO_ANIMATION.
        -- A packet known to be ready (learned on this server, auto-learned from our own swing or
        -- remembered by its stable definition) follows every click; otherwise it is the escalation
        -- after clicks produced no confirmed hit.
        if not self.UseLearnedHit and not self.LearnedHitRejected and target and ctx.LearnedHit and ctx.LearnedHitReady and ctx.LearnedHitReady() then
            -- Start the packet from the far end of its probe: out there a click cannot land, so an
            -- accepted packet is the only hit and the character is outside the mob's contact range.
            self.UseLearnedHit=true;self.PacketKeep=self.PacketReach;self.PacketMisses=0
        end
        if self.UseLearnedHit and target and ctx.LearnedHit then
            local sent,detail=ctx.LearnedHit(target.Model)
            local text=ctx.DescribeResult and ctx.DescribeResult(detail) or tostring(detail)
            if sent then
                self.LearnedHits=(self.LearnedHits or 0)+1;self.PacketMisses=0
                self.PacketAcceptedAt=self.PacketKeep
                -- Every 45 s of accepted packets, try one stud further out again: an earlier step
                -- back may have been a cooldown rejection rather than range.
                if self.PacketKeep and self.PacketKeep<self.PacketReach then
                    self.PacketProbeAt=self.PacketProbeAt or now()
                    if now()-self.PacketProbeAt>45 then self.PacketKeep+=1;self.PacketProbeAt=now() end
                end
                method=method.." + learned hit"
            else
                -- At the normal distance a rejection usually means the click already landed and the
                -- game's own client sent this hit (a duplicate), or the melee cooldown is running:
                -- harmless, so the packet is never switched off. Beyond it, two rejections in a row
                -- mean the server will not take a hit from that far: step one stud closer.
                self.LearnedHitRejections=(self.LearnedHitRejections or 0)+1;self.LastRejection=text
                self.PacketMisses=(self.PacketMisses or 0)+1
                if self.PacketKeep and self.PacketKeep>self.Reach-.5 and self.PacketMisses>=2 then
                    self.PacketKeep=math.max(self.Reach-.5,self.PacketKeep-1);self.PacketMisses=0
                end
                method=method.." + learned hit rejected ("..text..")"
            end
        end
        self.LastMethod=method..(aimReason and x==nil and " (aim: "..tostring(aimReason)..")" or "")
        return true,self.LastMethod.." · checking for HP changes"
    end
    function self:RunTime()
        if not self.StartedAt then return 0 end
        return math.max(0,(self.EndedAt or now())-self.StartedAt)
    end
    -- A live clip showed a stopped run leaving the character inside a slime until it died.
    -- Nearest mob of any kind within `radius`; a low-health character flees buffalkor and
    -- lizards too, not only the kind it farms.
    function self:Threats(radius)
        local kind=self.Kind
        self.Kind="All mobs"
        local ok,found=pcall(function() return self:Scan(nil,radius) end)
        self.Kind=kind
        return ok and found or {}
    end
    -- Target scoring: near, isolated and damaged beat near alone. A slime with other mobs around it
    -- costs 5 studs per neighbour within 7 studs; one already damaged is 4 studs "closer".
    function self:Score(entry,threats)
        local crowd=0
        for _,other in ipairs(threats) do
            if other.Model~=entry.Model and (other.Root.Position-entry.Root.Position).Magnitude<=7 then crowd+=1 end
        end
        local damaged=entry.Humanoid.MaxHealth>0 and entry.Humanoid.Health<entry.Humanoid.MaxHealth
        entry.Crowd=crowd
        return entry.Distance+5*crowd-(damaged and 4 or 0)
    end
    -- The point `keep` studs from the mob that is farthest from every other mob, so the hop in
    -- comes from the free side of the crowd. Candidates come from ctx.Around; nil → straight line.
    function self:Approach(entry,keep,threats,from)
        if not ctx.Around or not self.Smart then return nil end
        local others={}
        for _,other in ipairs(threats) do if other.Model~=entry.Model then table.insert(others,other) end end
        if #others==0 then return nil end
        local ok,points=pcall(ctx.Around,entry.Root.Position,keep,8)
        if not ok or type(points)~="table" or #points==0 then return nil end
        local best,bestScore
        for _,point in ipairs(points) do
            if not grounded(point) then continue end
            local clearance=math.huge
            for _,other in ipairs(others) do clearance=math.min(clearance,(other.Root.Position-point).Magnitude) end
            local score=math.min(clearance,12)-.15*(point-from).Magnitude
            if not bestScore or score>bestScore then best,bestScore=point,score end
        end
        return best
    end
    function self:Threat(radius)
        local kind=self.Kind
        self.Kind="All mobs"
        local ok,found=pcall(function() return self:Scan(nil,radius) end)
        self.Kind=kind
        local nearest=ok and found[1] or nil
        if not nearest then return nil end
        -- Away from all of them at once: two mobs on opposite sides must not pin the character.
        local root=nearest.Root
        local char=ctx.Player.Character
        local mine=char and char:FindFirstChild("HumanoidRootPart")
        local away
        for _,entry in ipairs(found) do
            local offset=mine.Position-entry.Root.Position
            if ctx.Flatten then offset=ctx.Flatten(offset) end
            if offset.Magnitude>.1 then
                local push=offset.Unit*(1-entry.Distance/(radius+1))
                away=away and away+push or push
            end
        end
        if away and away.Magnitude<.1 then away=nil end
        nearest.Away=away
        return nearest
    end
    function self:SafetyStep()
        if not self.Walk or not ctx.Player or not ctx.Navigation then return false end
        local char=ctx.Player.Character
        local human=char and char:FindFirstChildOfClass("Humanoid")
        local root=char and char:FindFirstChild("HumanoidRootPart")
        if not human or not root or human.Health<=0 then return false end
        local threat=self:Threat(10)
        if not threat then return false end
        local stepped=retreat(human,root,threat.Root,12,threat.Away)
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
        self.LastResult=nil;self.LastTarget=nil;self.LastMethod=nil;self.UseLearnedHit=false;self.LearnedHitRejected=false;self.LearnedHits=0;self.LearnedHitRejections=0;self.LastRejection=nil;self.PacketKeep=nil;self.PacketMisses=0;self.PacketAcceptedAt=nil;self.PacketProbeAt=nil;self.EdgeStops=0;self.SideApproaches=0;self.Tuned=0;self.Deaths=0;self.Stalls=0;self.LastCommand=nil;self.LastCommandAt=nil;self.Meals=0;self.LastEat=nil;self.Loot=0;self.LootByName={};self.DamageNumbers=0;self.DamageTotal=0;self.DamageTaken=0;self.HitsTaken=0;self.HitsAfterSwing=0;self.StartedAt=now();self.EndedAt=nil
        local char=ctx.Player.Character
        local human=char and char:FindFirstChildOfClass("Humanoid")
        local fraction=human and human.MaxHealth>0 and human.Health/human.MaxHealth or 1
        if fraction<=self.RetreatBelow then
            publish("Low health ("..math.floor(fraction*100).."%) · waiting until "..math.floor(self.ResumeAbove*100).."% HP before attacking · eat or let it regenerate")
        else
            publish("Scanning for slimes · Auto Move "..(not self.Walk and "OFF" or self.Travel=="Teleport" and "TP hops" or "Walk"))
        end
        scheduler.spawn(function()
            local healthSeen=setmetatable({},{__mode="k"})
            local cooldowns=setmetatable({},{__mode="k"})
            local attackedAt=setmetatable({},{__mode="k"})
            local attackedNear=setmetatable({},{__mode="k"})
            local maxHit=0
            local lastAttack=-math.huge
            local attempts=0
            local unconfirmed=0
            local lastAttackAt=-math.huge
            local lastEat=-math.huge
            local lastDistance=setmetatable({},{__mode="k"})
            local progress={}
            local recovering=false
            local regenAt,regenBest,regenFrom,regenStart
            local lastHealth,healthChar
            local settledSeen=setmetatable({},{__mode="k"})
            local jumpStart=setmetatable({},{__mode="k"})
            local tuneHits,tuneLanded=0,0
            local deadSeen=setmetatable({},{__mode="k"})
            local farRetreat=false
            local jumpedFor=setmetatable({},{__mode="k"})
            local idleAt,idlePos=now(),nil
            local function active()
                return ctx.Alive() and self.Enabled and self.Generation==token and not ctx.Busy()
            end
            local function observe(model)
                local previous=healthSeen[model]
                local health=MobFarm.Details(model,MobFarm.Roots(ctx.World),ctx.Players,self.Kind)
                local current=health and MobFarm.HealthOf(model,health)
                -- Streaming out is not proof of death; all counters describe observations.
                if current and previous and current<previous then
                    -- A late drop on an earlier target must not reset the current target's budget.
                    self.Drops+=1;unconfirmed=0
                    if model==self.Target then attempts=0 end
                    maxHit=math.max(maxHit,previous-current)
                    if previous>0 and current<=0 then
                        self.Defeats+=1;self.KillsByName[model.Name]=(self.KillsByName[model.Name] or 0)+1
                    end
                end
                if current then healthSeen[model]=current end
            end
            -- Loot is proof a hit landed even when mob HP never replicates (a live clip showed
            -- "+2 Green Slime Ball" beside "0 HP drops"). Compared against the inventory at swing time.
            local lootBaseline
            local function checkLoot()
                if not ctx.Inventory or not lootBaseline or now()-lastAttackAt>3 then return end
                local ok,current=pcall(ctx.Inventory)
                if not ok or type(current)~="table" then return end
                local gained=0
                for name,count in pairs(current) do
                    local before=lootBaseline[name] or 0
                    if count>before then gained+=count-before;self.LootByName[name]=(self.LootByName[name] or 0)+(count-before) end
                end
                lootBaseline=current
                if gained>0 then
                    self.Loot+=gained;unconfirmed=0;attempts=0
                    publish("Loot · +"..gained.." items · hits are landing")
                end
            end
            local ok,failure=pcall(function()
                while active() do
                    if self.Target then observe(self.Target) end
                    -- HP replication can trail a swing; keep watching recent targets after a switch.
                    checkLoot()
                    -- The game's floating damage numbers are a direct hit signal when mob HP never replicates.
                    if ctx.DamageSeen and now()-lastAttackAt<=1.5 then
                        local ok,count,total=pcall(ctx.DamageSeen,lastAttackAt)
                        if ok and type(count)=="number" and count>0 then
                            self.DamageNumbers+=count;self.DamageTotal+=(total or 0)
                            unconfirmed=0;attempts=0
                            publish("Hit · damage number "..tostring(total or "?").." · hits are landing")
                        end
                    end
                    for model,at in pairs(attackedAt) do
                        if not MobFarm.Details(model,MobFarm.Roots(ctx.World),ctx.Players,self.Kind) then
                            -- Mobs usually despawn at 0 HP before it replicates, if HP replicates at all. A
                            -- mob that was within reach and vanishes within 3 s of a swing is a likely defeat.
                            local last=healthSeen[model]
                            -- With replicated HP a mob seen well above the biggest hit streamed out; without
                            -- any replicated drop this run, a vanish within reach is the only kill signal.
                            local near=(attackedNear[model] or math.huge)<=math.max(self.Reach,self.AttackRange or 0)+2
                            if near and now()-at<=3 and maxHit==0 or last and last>0 and maxHit>0 and last<=maxHit then
                                self.LikelyDefeats+=1;self.KillsByName[model.Name]=(self.KillsByName[model.Name] or 0)+1
                                unconfirmed=0;if model==self.Target then attempts=0 end
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
                        if human and human.Health<=0 and char and not deadSeen[char] then deadSeen[char]=true;self.Deaths=(self.Deaths or 0)+1 end
                        halt();self.Target=nil;publish("Paused · waiting for your character")
                    elseif not usable(recorder) then
                        self:Stop("Character/session changed · learn one manual attack again");return
                    else
                        -- Idle tracking for the Movement report line: how long the character has stood still.
                        if not idlePos or (root.Position-idlePos).Magnitude>.5 then idleAt=now();idlePos=root.Position end
                        self.IdleFor=now()-idleAt
                        -- Damage the character takes, and whether it came right after a swing (the hop in).
                        if healthChar==char and lastHealth and human.Health<lastHealth-.5 then
                            self.HitsTaken+=1;self.DamageTaken+=lastHealth-human.Health
                            if now()-lastAttackAt<=1 then self.HitsAfterSwing+=1 end
                        end
                        healthChar=char;lastHealth=human.Health
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
                            -- Regeneration watchdog: a character that keeps losing HP while "recovering" is still
                            -- being hit (or starving); stopping with a clear message beats a silent death.
                            if recovering then
                                if not regenAt then regenFrom=fraction;regenStart=now() end
                                if not regenAt or fraction>regenBest+.02 then regenAt=now();regenBest=fraction
                                elseif now()-regenAt>self.RegenTimeout then
                                    -- HP that does not rise means mobs still reach the character: double the
                                    -- distance kept from every mob and keep waiting; never give up the run here.
                                    farRetreat=true;regenAt=now();regenBest=fraction;self.FarRetreats=(self.FarRetreats or 0)+1
                                end
                            else regenAt=nil;farRetreat=false end
                            local safe=farRetreat and math.max(40,self.SafeDistance*2) or self.SafeDistance
                            if recovering and fraction<=.2 then safe=math.max(safe,60) end
                            -- "+0.5 HP/s · ~60 s to 70%" tells the user the wait is working; "not rising" warns of the stop.
                            local resume=math.floor(self.ResumeAbove*100).."% HP"
                            if recovering then
                                local elapsed=now()-regenStart
                                local rate=elapsed>=3 and (fraction-regenFrom)*human.MaxHealth/elapsed or nil
                                if rate and rate>.01 then
                                    local left=(self.ResumeAbove-fraction)*human.MaxHealth/rate
                                    resume=resume..string.format(" · +%.1f HP/s · ~%d s to go",rate,math.ceil(left))
                                elseif elapsed>=3 then
                                    resume=resume..string.format(" · HP not rising · moves further out in %d s",math.ceil(self.RegenTimeout-(now()-regenAt)))
                                end
                                if farRetreat then resume=resume.." · keeping "..safe.." studs from every mob" end
                                resume=resume.." · now "..math.floor(fraction*100).."%"
                            end
                            local threat=recovering and not paused and self.Walk and self:Threat(safe)
                            if threat then
                                -- Keep moving away until every mob is SafeDistance studs off, hopping in TP mode
                                -- (ground checked by ctx.Hop) and walking otherwise; stays attached while HP rises.
                                local away=threat.Away or root.Position-threat.Root.Position
                                if ctx.Flatten then away=ctx.Flatten(away) end
                                local moved=false
                                if self.Travel=="Teleport" and ctx.Hop and away.Magnitude>.1 then
                                    if self.Chase then halt() end
                                    local step=math.min(self.HopDistance,safe-threat.Distance+2)
                                    moved=pcall(ctx.Hop,root,root.Position+away.Unit*step,threat.Root)
                                end
                                if not moved then moved=retreat(human,root,threat.Root,math.max(12,safe-threat.Distance+4),threat.Away) end
                                if moved then
                                    publish("Retreating from "..threat.Model.Name.." · "..math.floor(threat.Distance).." studs; low health, resumes at "..resume)
                                else
                                    halt()
                                    publish("Paused · low health next to "..threat.Model.Name.."; resumes at "..resume)
                                end
                            else
                                halt()
                                publish(recovering and ("Paused · low health; resumes at "..resume) or paused)
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
                            -- A grounded slime already within reach is hit before travelling to the chosen one.
                            if chosen and chosen.Distance>self.Reach then
                                for _,entry in ipairs(targets) do
                                    if entry.Distance>self.Reach then break end
                                    if math.abs((entry.Root.Position.Y or 0)-(root.Position.Y or 0))<=2 then chosen=entry;break end
                                end
                            end
                            if not chosen and targets[1] then
                                -- Among slimes about as close as the nearest, finish the most damaged one first.
                                chosen=targets[1]
                                if self.Smart then
                                    local threats=self:Threats(targets[1].Distance+20)
                                    local bestScore=self:Score(chosen,threats)
                                    for _,entry in ipairs(targets) do
                                        if entry.Distance>targets[1].Distance+12 then break end
                                        local score=self:Score(entry,threats)
                                        if score<bestScore then chosen,bestScore=entry,score end
                                    end
                                else
                                    for _,entry in ipairs(targets) do
                                        if entry.Distance>targets[1].Distance+6 then break end
                                        if entry.Humanoid.Health<chosen.Humanoid.Health then chosen=entry end
                                    end
                                end
                                -- A slime beside the character that is only cooling down beats a trip across the
                                -- island: wait the few seconds instead of teleporting away from it.
                                if chosen.Distance>self.ChaseRange then
                                    for _,entry in ipairs(self:Scan(nil,12)) do
                                        local until_=cooldowns[entry.Model]
                                        if until_ and until_>now() and until_-now()<=6 then chosen=nil;break end
                                    end
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
                                -- Tether: the distance kept from the mob, every tick, in both directions.
                                local keep=(self.KeepDistance=="Auto" or type(self.KeepDistance)~="number") and standoff or math.min(self.Reach-.5,self.KeepDistance)
                                -- Self-tuned bias: more distance while hits are taken right after swings.
                                if self.Smart and (self.KeepBias or 0)>0 then keep=math.min(self.Reach-.5,keep+self.KeepBias) end
                                -- With the hit packet accepted the swing need not touch: stand further out.
                                local reach=self.Reach
                                if self.UseLearnedHit and self.PacketKeep and self.PacketKeep>keep then keep=self.PacketKeep;reach=math.max(reach,keep+.5) end
                                self.AttackRange=reach
                                local previous=lastDistance[chosen.Model]
                                lastDistance[chosen.Model]=chosen.Root.Position
                                local closing=previous~=nil and (previous-root.Position).Magnitude-chosen.Distance>=1.5 and chosen.Distance<=self.Reach*2
                                -- A slime that moved more than a stud since the last tick is mid-jump or mid-chase.
                                local settled=previous==nil or (chosen.Root.Position-previous).Magnitude<1
                                -- Jump rhythm: the interval between the starts of a mob's jumps, averaged over the
                                -- last ten, tells when the next one is due; the hop in waits out that moment.
                                local wasSettled=settledSeen[chosen.Model]
                                settledSeen[chosen.Model]=settled
                                if wasSettled and not settled then
                                    local last=jumpStart[chosen.Model]
                                    if last and now()-last>.3 and now()-last<8 then
                                        table.insert(self.JumpIntervals,now()-last)
                                        if #self.JumpIntervals>10 then table.remove(self.JumpIntervals,1) end
                                    end
                                    jumpStart[chosen.Model]=now()
                                end
                                local jumpDue=false
                                if self.Smart and #self.JumpIntervals>=2 and jumpStart[chosen.Model] then
                                    local sum=0
                                    for _,v in ipairs(self.JumpIntervals) do sum+=v end
                                    local period=sum/#self.JumpIntervals
                                    local since=now()-jumpStart[chosen.Model]
                                    jumpDue=since>period-.5 and since<period+1
                                    self.JumpPeriod=period
                                end
                                local function dy() return math.abs((chosen.Root.Position.Y or 0)-(root.Position.Y or 0)) end
                                local airborne=dy()>self.Reach*.75
                                -- A slime jump peaks well below head height; any lift while closing is a jump at us.
                                local jumping=dy()>2
                                if chosen.Distance<=self.Reach*2 and ctx.Face then pcall(ctx.Face,root,chosen.Root) end
                                local clear=self.Walk and ctx.ClearLine(root,chosen.Root,char,chosen.Model)
                                local teleport=clear and self.Travel=="Teleport" and ctx.Hop~=nil
                                local near=clear and chosen.Distance<=self.ChaseRange and dy()<(progress.Best and 12 or 6)
                                local gap=chosen.Distance
                                if self.Walk and closing and jumping and gap<=self.Reach*1.5 and ctx.Sidestep then
                                    -- A slime jumping at the character lands where the character was; step aside.
                                    boost(human,true)
                                    if pcall(ctx.Sidestep,human,root,chosen.Root.Position,5) then self.Chase={Humanoid=human,Root=root} end
                                    publish("Dodging · "..chosen.Model.Name.." is jumping at you")
                                elseif self.Walk and (teleport or near) then
                                    -- Hit and run (TP mode): between swings the character rests out of the mob's
                                    -- reach and hops in only when the next swing is due.
                                    local hitRun=(teleport or near) and self.HitAndRun and self.RestDistance>keep
                                    if hitRun and gap>keep+.75 and gap<=self.RestDistance+1.5 and now()-lastAttack<.5 then
                                        if self.Chase then halt() end
                                        publish("Resting · "..chosen.Model.Name.." · "..math.floor(gap).." studs away · next swing shortly")
                                    elseif hitRun and gap>keep+.75 and gap<=self.RestDistance+1.5 and (airborne or not settled or jumpDue) then
                                        -- Hopping in while the slime jumps lands the character under it; wait for the landing.
                                        if self.Chase then halt() end
                                        publish("Waiting · "..chosen.Model.Name.." is "..(airborne and "in the air" or not settled and "moving" or "about to jump").." · hopping in "..(jumpDue and not airborne and settled and "after its jump" or "once it settles"))
                                    -- Attached to the mob: too far → close in, too close → back out, both to `keep` studs.
                                    elseif math.abs(gap-keep)>.75 then
                                        chasing=gap>keep
                                        if chasing then
                                            if not progress.Best or gap<progress.Best-.5 then progress.Best=gap;progress.At=now() end
                                        end
                                        local offset=chosen.Root.Position-root.Position
                                        local desired=offset.Magnitude>.1 and chosen.Root.Position-offset.Unit*keep or nil
                                        if chasing and desired then
                                            local side=self:Approach(chosen,keep,self:Threats(15),root.Position)
                                            if side then desired=side;self.SideApproaches=(self.SideApproaches or 0)+1 end
                                        end
                                        if chasing and now()-progress.At>2 and not teleport and ctx.Jump and (jumpedFor[chosen.Model] or -math.huge)<now()-6 then
                                            -- A ledge or a block in the way: one jump and a fresh chase before giving the slime up.
                                            jumpedFor[chosen.Model]=now();progress={Best=gap,At=now()};self.Stalls=(self.Stalls or 0)+1
                                            pcall(ctx.Jump,human);chase(human,root,chosen.Root,keep)
                                            publish("Chase stalled · jumping and walking on toward "..chosen.Model.Name)
                                        elseif chasing and now()-progress.At>2 then
                                            halt();cooldowns[chosen.Model]=now()+3;self.Target=nil;self.Stalls=(self.Stalls or 0)+1
                                            publish((teleport and "Teleport" or "Chase").." stalled · trying another slime shortly")
                                        elseif not desired then
                                            -- Standing exactly inside the mob: any direction out.
                                            retreat(human,root,chosen.Root,keep)
                                        elseif teleport then
                                            if self.Chase then halt() end
                                            local move=desired-root.Position
                                            local step=math.min(self.HopDistance,move.Magnitude)
                                            if step>.1 and pcall(ctx.Hop,root,root.Position+move.Unit*step,chosen.Root) then
                                                publish((gap>keep and "Teleporting · " or "Backing off · ")..chosen.Model.Name.." · "..math.floor(gap).." → "..math.floor(keep+.5).." studs")
                                            else
                                                cooldowns[chosen.Model]=now()+3;self.Target=nil
                                                publish("Teleport unavailable · trying another slime shortly")
                                            end
                                        elseif chase(human,root,chosen.Root,keep) then
                                            publish((gap>keep and "Chasing · " or "Backing off · ")..chosen.Model.Name.." · "..math.floor(gap).." → "..math.floor(keep+.5).." studs")
                                        else
                                            halt();cooldowns[chosen.Model]=now()+3;self.Target=nil
                                            publish("Movement unavailable · trying another slime shortly")
                                        end
                                        gap=(chosen.Root.Position-root.Position).Magnitude
                                    elseif self.Chase then halt() end
                                elseif gap>self.Reach then
                                    if self.Walk then
                                        -- No clear line or beyond chase range: the pathfinder, then the tether takes over.
                                        if self.Chase then halt() end
                                        publish("Walking · "..chosen.Model.Name.." · "..math.floor(gap).." studs")
                                        local point=chosen.Root.Position
                                        boost(human,true)
                                        local arrived=ctx.Navigation.Approach(ctx.Player,chosen.Model,math.max(4,keep+1),function()
                                            return valid() and (chosen.Root.Position-point).Magnitude<6
                                        end,function() return chosen.Root.Position end,"Walk","Mobs")
                                        if not active() then return end
                                        if not arrived and valid() and (chosen.Root.Position-point).Magnitude<6 then
                                            cooldowns[chosen.Model]=now()+3
                                            publish("Path blocked · trying another slime shortly")
                                        end
                                    else publish("Waiting · move within "..self.Reach.." studs or enable Auto Move") end
                                end
                                if self.Target==chosen.Model and gap<=reach and valid() then
                                    if airborne then
                                        -- A swing at a slime above head height misses; it lands within a moment.
                                        publish("Waiting · "..chosen.Model.Name.." is in the air")
                                    elseif now()-lastAttack>=.65 then
                                        local tool=ctx.Weapon(recorder.MobBinding.WeaponName)
                                        if not tool or not ctx.Equip(tool) then
                                            self:Stop("Learned weapon unavailable · equip it and learn attack again");return
                                        end
                                        -- Equipping may yield or change the character/target. Recheck before sending.
                                        if tool.Enabled==false then publish("Waiting · weapon cooldown")
                                        elseif valid() and tool.Parent==char and (chosen.Root.Position-root.Position).Magnitude<=reach then
                                            if ctx.ClearLine(root,chosen.Root,char,chosen.Model) then
                                                boost(nil,false)
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
                                                -- Every ten swings: hits taken right after swings push the distance out
                                                -- (up to 3 studs); a poor hit rate pulls it back in.
                                                if self.Smart and self.Swings%10==0 then
                                                    local taken=(self.HitsAfterSwing or 0)-(tuneHits or 0)
                                                    local landed=(self.DamageNumbers or 0)+(self.Drops or 0)-(tuneLanded or 0)
                                                    tuneHits=self.HitsAfterSwing or 0;tuneLanded=(self.DamageNumbers or 0)+(self.Drops or 0)
                                                    if taken>=4 and (self.KeepBias or 0)<3 then self.KeepBias=(self.KeepBias or 0)+1;self.Tuned=(self.Tuned or 0)+1
                                                    elseif landed<3 and (self.KeepBias or 0)>0 then self.KeepBias=self.KeepBias-1;self.Tuned=(self.Tuned or 0)+1 end
                                                    if ctx.Remember then pcall(ctx.Remember,"KeepBias",self.KeepBias) end
                                                end
                                                attackedAt[chosen.Model]=now();lastAttackAt=now()
                                                attackedNear[chosen.Model]=(chosen.Root.Position-root.Position).Magnitude
                                                if ctx.Inventory and not lootBaseline then local ok,current=pcall(ctx.Inventory);lootBaseline=ok and type(current)=="table" and current or nil end
                                                observe(chosen.Model)
                                                publish("Attacking · "..chosen.Model.Name.." · HP "..math.max(0,math.ceil(chosen.Humanoid.Health)))
                                                -- Hit and run: straight back out of the mob's reach after the swing.
                                                if (teleport or near) and self.HitAndRun and self.RestDistance>keep and chosen.Root.Parent then
                                                    -- Out of reach of every nearby mob, not only the one just hit.
                                                    local crowd=self:Threat(12)
                                                    local away=crowd and crowd.Away or root.Position-chosen.Root.Position
                                                    if ctx.Flatten then away=ctx.Flatten(away) end
                                                    local step=self.RestDistance-(chosen.Root.Position-root.Position).Magnitude
                                                    if teleport then step=math.min(self.HopDistance,step) end
                                                    local out=away.Magnitude>.1 and step>.5
                                                    if out and teleport then out=pcall(ctx.Hop,root,root.Position+away.Unit*step,chosen.Root)
                                                    elseif out then out=retreat(human,root,chosen.Root,step,away) end
                                                    if out then
                                                        publish("Attacking · "..chosen.Model.Name.." · backed off to "..math.floor((chosen.Root.Position-root.Position).Magnitude+.5).." studs")
                                                    end
                                                end
                                                if unconfirmed>=self.RunBudget then
                                                    self:Stop("No HP drop, damage number, loot or defeat observed after "..self.RunBudget.." swings · check weapon activation, range and facing");return
                                                elseif attempts>=self.TargetBudget then
                                                    if ctx.LearnedHit and not self.UseLearnedHit and not self.LearnedHitRejected and (not ctx.LearnedHitReady or ctx.LearnedHitReady()) then
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
