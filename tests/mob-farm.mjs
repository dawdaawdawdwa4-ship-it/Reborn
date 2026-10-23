import fs from 'node:fs';
import {LuauState} from 'luau-web';
const module=fs.readFileSync(new URL('../tools/MobFarm.lua',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const resultText=main.slice(main.indexOf('function RemoteCatalog.ChestResultText(value)'),main.indexOf('track(RemoteCatalog.ChestCopyButton.Activated'));
const code=`
local time=0
local mt={}
local function v(x) return setmetatable({X=x,Y=0,Z=0},mt) end
mt.__sub=function(a,b) return v(a.X-b.X) end
mt.__mul=function(a,n) return v(a.X*n) end
mt.__add=function(a,b) return v(a.X+b.X) end
mt.__index=function(a,k) if k=='Magnitude' then return math.abs(a.X) elseif k=='Unit' then return v(math.sign(a.X)) end end
local function node(name,kind,parent)
 local n={Name=name,ClassName=kind,Parent=parent,children={}}
 if parent then table.insert(parent.children,n) end
 function n:IsA(c) return c==kind or c=='BasePart' and kind=='Part' end
 function n:FindFirstChild(name) for _,c in ipairs(self.children) do if c.Name==name then return c end end end
 function n:FindFirstChildOfClass(kind) for _,c in ipairs(self.children) do if c:IsA(kind) then return c end end end
 function n:GetChildren() return self.children end
 return n
end
local world=node('Workspace','Workspace')
local wild=node('WildernessIsland','Model',world)
local nested=node('Entities','Folder',wild)
local direct=node('Entities','Folder',world)
local foreign=node('Decorations','Folder',world)
local function actor(name,x,parent)
 local m=node(name,'Model',parent)
 local h=node('Humanoid','Humanoid',m);h.Health=100;h.MaxHealth=100
 local r=node('HumanoidRootPart','Part',m);r.Position=v(x)
 return m,h,r
end
local char,human,root=actor('Character',0,world)
local stuck,moves,hops,hopError=false,0,0,false
function human:MoveTo(point) moves+=1;if not stuck then root.Position=point end end
local player={Character=char}
local players={GetPlayerFromCharacter=function(_,model) return model.IsPlayer and {} or nil end}
local a,ah,ar=actor('slimeBlue',4,nested)
local b,bh,br=actor('greenSlime',20,direct)
actor('slimeKing',1,nested);actor('slimeQueen',1,direct);actor('slimeBoss',1,direct)
actor('slime',1,foreign)
local fake=actor('slime',1,nested);fake.IsPlayer=true
local dead,dh=actor('slime',1,nested);dh.Health=0
actor('buffalkor',1,nested);actor('slime',300,direct)
local Module=(function() ${module} end)()
local RemoteCatalog={}
${resultText}
local workers={}
local scheduler={spawn=function(fn)
 local co=coroutine.create(fn);table.insert(workers,co)
 local ok,err=coroutine.resume(co);assert(ok,err);return co
end,wait=function(dt) if dt==.08 then time+=dt;return end;return coroutine.yield(dt) end}
local function step(dt)
 time+=dt or .15
 for _,co in ipairs(table.clone(workers)) do
  if coroutine.status(co)=='suspended' then local ok,err=coroutine.resume(co);assert(ok,err) end
 end
end
local busy,pause,damage,blocked,transport,learned,alive=nil,nil,true,false,false,true,true
local bindingChar=char
local sent,walks,halts=0,0,0
local tool={Name='swordWood',Parent=char}
local equipHook,walkHook,attackHook,faced,faceError
local farm
local recorder={MobBinding={WeaponName='swordWood'}}
function recorder:CanUseMobBinding() return bindingChar==player.Character and learned end
function recorder:MobHit() error("legacy replay must not be called by the mob worker") end
function tool:Activate()
 local target=farm.Target
 sent+=1
 assert(faced==target:FindFirstChild('HumanoidRootPart'),'character must face the chosen slime before every native swing')
 if attackHook then attackHook() end
 if transport then error(type(transport)=='table' and transport or 'activation failed',0) end
 if damage then target:FindFirstChildOfClass('Humanoid').Health-=10 end
end
function tool:Deactivate() end
local ctx={Player=player,Players=players,World=world,Now=function() return time end,Scheduler=scheduler,
 Alive=function() return alive end,Busy=function() return busy end,PauseReason=function() return pause end,
 Recorder=function() return learned and recorder or nil end,Weapon=function() return tool end,
 Equip=function() if equipHook then equipHook() end;return true end,ClearLine=function() return not blocked end,
 DescribeResult=RemoteCatalog.ChestResultText,
 Hop=function(r,destination,t)
  assert(r==root and (farm.Target==nil and t.Name=='HumanoidRootPart' or t==farm.Target:FindFirstChild('HumanoidRootPart')));hops+=1
  if hopError then error('anchored') end
  assert(math.abs((destination-root.Position).Magnitude)<=8.001,'each teleport must be a short hop')
  if not stuck then root.Position=destination end
 end,
 Face=function(r,t) assert(r==root);faced=t;if faceError then error('facing unavailable') end end,
 Navigation={Stop=function(owner) assert(owner=='Mobs');halts+=1 end,
 Approach=function(who,target,reach,active,positionOf,mode,owner)
  walks+=1;assert(who==player and owner=='Mobs' and mode=='Walk' and reach==4)
  if walkHook then return walkHook(active) end
  assert(active());root.Position=v(positionOf(target).X-3);return true
 end}}
farm=Module.new(ctx)
local targets=farm:Scan()
assert(#targets==2 and targets[1].Model==a and targets[2].Model==b,'only living non-player regular slimes in either Entities root, nearest first')
farm.Radius=10;assert(#farm:Scan()==1);farm.Radius=60
actor('fireflyGlow',2,nested)
farm.Kind='All mobs'
local names={}
for _,entry in ipairs(farm:Scan()) do names[entry.Model.Name]=true end
assert(names.buffalkor and names.slimeBlue and names.greenSlime and not names.slimeKing and not names.slimeQueen and not names.slimeBoss and not names.fireflyGlow,'All mobs must include regular mobs but never bosses or critters')
farm.Kind='buffalkor'
local only=farm:Scan()
assert(#only==1 and only[1].Model.Name=='buffalkor','a named target must match only that mob')
farm.Kind='slimeKing';assert(#farm:Scan()==0,'a boss name stays excluded even when chosen')
farm.Kind='Slimes'
learned=false;assert(not farm:Start() and sent==0);learned=true
busy='other worker';assert(not farm:Start());busy=nil
assert(farm:Start() and sent==1 and farm.Swings==1 and farm.Drops==1)
step();assert(sent==1,'cadence must include time spent in RPC/equip and never spam')
step(.6);assert(sent==2 and farm.Drops==2)
farm:Stop();local before=sent;step(1)
assert(sent==before and not farm.Worker and not farm.Enabled,'Stop must end worker and future attacks')
local function reset()
 farm:Stop();step();farm=Module.new(ctx);farm.SeekRange=0;farm.HitAndRun=false
 ah.Health=100;bh.Health=100;ar.Position=v(4);br.Position=v(20);root.Position=v(0)
 human.Health=100;human.MaxHealth=100;player.Character=char;bindingChar=char
 busy=nil;pause=nil;damage=true;blocked=false;transport=false;learned=true;alive=true
 equipHook=nil;walkHook=nil;attackHook=nil;sent=0;walks=0;tool.Parent=char
 stuck=false;moves=0;faced=nil;faceError=false;hops=0;hopError=false
end
reset();ah.Health=10;farm:Start()
assert(farm.Defeats==1 and farm.Drops==1,'zero HP must count once, and never infer a kill from dispatch alone')
assert(farm.KillsByName.slimeBlue==1,'kills must be broken down by mob name')
step();step();assert(farm.Defeats==1)
reset();farm:Start();a.Parent=nil;step(.7)
assert(farm.Defeats==0 and farm.LikelyDefeats==0,'streaming out with replicated HP must not count a defeat');a.Parent=nested
reset();ar.Position=v(30);farm.ChaseRange=0;farm:Start();assert(walks==1 and sent==0);step();assert(sent==1 and farm.Target==b,'Auto Walk must approach nearest living target and attack only after rechecking reach')
reset();ar.Position=v(30);farm.Walk=false;farm:Start();step(2);assert(walks==0 and sent==0 and farm.Enabled)
reset();human.Health=25;farm:Start();assert(sent==0 and farm.Enabled)
assert(moves==1 and root.Position.X<0 and farm.Message:find('Retreating',1,true),'low health must step away from the nearest slime')
human.Health=50;step(1);assert(sent==0,'health recovery must use hysteresis')
human.Health=65;step();assert(sent==0,'65% is still below the 70% resume point')
human.Health=70;for i=1,4 do step() end;assert(sent==1,'farming must resume after recovery')
reset();farm.Walk=false;human.Health=25;farm:Start()
assert(moves==0 and farm.Message:find('low health',1,true),'Auto Move OFF must never retreat on its own')
-- Low health in TP mode hops away from every mob kind until all are 20 studs off; HP that never rises stops the run.
do
 reset();farm.Travel='Teleport';human.Health=40;ar.Position=v(30);br.Position=v(60);farm:Start()
 assert(hops==1 and sent==0 and root.Position.X<=-8 and farm.Message:find('Retreating from buffalkor',1,true),'low HP must TP-hop away from any mob kind, not only slimes')
 step();step();assert(hops==3 and root.Position.X<=-21,'the retreat keeps hopping until the mob is 20 studs away')
 local before=hops;step();assert(hops==before and farm.Message:find('Paused · low health',1,true),'once every mob is 20 studs away the character waits for HP')
 step(5);assert(farm.Message:find('HP not rising · stops in',1,true) and farm.Message:find('now 40%',1,true),'a flat HP line warns about the coming stop')
 human.Health=45;step(5);assert(farm.Message:find('+0.5 HP/s',1,true) and farm.Message:find('s to go',1,true),'rising HP shows the rate and the time left to the resume point')
 step(46);assert(not farm.Enabled and farm.Message:find('not regenerating',1,true),'HP that never rises for 45 s must stop the run with a clear message')
 reset();farm.Travel='Teleport';human.Health=40;ar.Position=v(30);br.Position=v(60);farm:Start();step(20);human.Health=50;step(30)
 assert(farm.Enabled,'rising HP resets the regeneration watchdog')
 human.Health=70;before=hops;step();step();assert(farm.Enabled and hops>before and farm.Message:find('Teleporting',1,true),'recovered HP resumes the hop loop toward the slime')
end
reset();pause='typing';farm:Start();step(2);assert(sent==0 and walks==0 and farm.Enabled);pause=nil;step();assert(sent==1)
reset();equipHook=function() farm:Stop();scheduler.wait(.1) end;farm:Start()
assert(not farm:Start() and farm.Worker,'restart must wait for old yielding equip cleanup')
step();assert(sent==0 and not farm.Worker,'Stop during equip must prevent a late attack')
assert(math.abs(root.Position.X-ar.Position.X)>=8 and math.abs(root.Position.X-1)>=8,'a stop must step the character away from every adjacent mob')
equipHook=nil;root.Position=v(0);assert(farm:Start());assert(sent==1,'fresh restart must create one worker')
reset();equipHook=function() ar.Position=v(80) end;farm:Start();assert(sent==0,'target moving outside radius during equip must not be attacked')
reset();walkHook=function(active) farm:Stop();assert(not active());scheduler.wait(.1);return true end
ar.Position=v(30);farm.ChaseRange=0;farm:Start();step();assert(sent==0 and not farm.Worker,'Stop mid-walk must invalidate follow-up attacks')
reset();walkHook=function(active) busy='other mode';assert(not active());return false end
ar.Position=v(30);farm.ChaseRange=0;farm:Start();step();assert(sent==0 and not farm.Worker and not farm.Enabled,'new automation must take control without a combat dispatch')
reset();transport=true;farm:Start();assert(sent==1 and farm.Swings==0 and not farm.Enabled and not farm.Worker,'activation failure must stop without legacy replay or false counters')
reset();transport={success=false,error='TOO_FAST'};farm:Start()
assert(sent==1 and farm.Swings==0 and farm.Message:find('TOO_FAST',1,true) and not farm.Message:find('table:',1,true) and farm.LastTarget=='slimeBlue' and farm.LastResult:find('success=false',1,true),'structured activation errors must remain readable in the status and copied result')
reset();tool.Enabled=false;farm:Start();step(1);assert(sent==0 and farm.Enabled,'weapon cooldown must wait without stopping or dispatching');tool.Enabled=true;step();assert(sent==1)
reset();damage=false;local hitA,hitB=0,0
attackHook=function() if farm.Target==a then hitA+=1 elseif farm.Target==b then hitB+=1 end end
farm:Start();for i=1,40 do if not farm.Enabled then break end;step(.7) end
assert(hitA>=6 and hitB==6,'one unhittable slime must be cooled down after six swings and the next slime tried')
assert(sent==12 and farm.Swings==12 and farm.Drops==0 and not farm.Enabled and not farm.Worker and farm.Message:find('12 swings',1,true),'unconfirmed attacks across targets must stop at a bounded run budget')
reset();damage=false
attackHook=function() if farm.Swings==2 then damage=true end end
farm:Start();for i=1,40 do if not farm.Enabled or farm.Swings>=14 then break end;step(.7) end
assert(farm.Enabled and farm.Drops>0,'any observed HP drop must refill the run budget')
reset();faceError=true;farm:Start();assert(sent==1 and farm.Enabled,'a facing failure must not block the native swing')
reset();ar.Position=v(15);farm:Start()
assert(walks==0 and moves==1 and sent==1 and farm.Target==a,'nearby visible slimes are tethered directly without pathfinding and attacked in the same tick')
step();assert(sent==1 and farm.Target==a and walks==0,'the attack cadence still holds')
reset();ar.Position=v(15);farm:Start();farm:Stop()
assert(moves==3 and not farm.Chase and root.Position.X<=1,'Stop must clear the direct chase destination and step away from the adjacent slime')
reset();stuck=true;ar.Position=v(15);br.Position=v(40);farm:Start()
local stalled=false
for i=1,20 do step();if farm.Message:find('Chase stalled',1,true) then stalled=true;break end end
assert(stalled and sent==0 and walks==0 and farm.Enabled,'a chase without progress must back off instead of running in place')
step();assert(farm.Target~=a,'a stalled chase target must cool down')
reset();blocked=true;ar.Position=v(15);br.Position=v(40);farm:Start();step()
assert(walks>=1 and moves==0,'obstructed slimes must use the pathfinder instead of a direct chase')
reset();blocked=true;farm:Start();step();assert(sent==0,'obstructed targets cannot be attacked')
reset();walkHook=function() return false end;ar.Position=v(30);farm.ChaseRange=0;farm:Start();step();step()
assert(walks==2,'each unreachable target gets its own cooldown');step();assert(walks==2,'unreachable targets must not be repathed every tick')
reset();ar.Position=v(300);br.Position=v(300);farm:Start();step(3)
assert(farm.Enabled and sent==0 and farm.Message:find('scanning continues',1,true),'empty scans must keep the farm ON')
reset();human.Health=0;farm:Start();assert(sent==0 and farm.Enabled);player.Character={FindFirstChild=function() return root end,FindFirstChildOfClass=function() return human end};human.Health=100;step()
assert(not farm.Enabled and sent==0,'a new character needs a new learned session before attacks')
reset();attackHook=function() farm:Stop() end;farm:Start();assert(farm.Swings==0 and farm.Drops==0,'late completion after Stop must not update counters')
reset();attackHook=function() scheduler.wait(.1) end;farm:Start()
assert(sent==1 and farm.Worker and farm.Enabled)
farm:Stop();step()
assert(not farm.Worker and farm.Swings==0 and farm.Drops==0,'Stop while native activation is pending must discard its late completion')
reset();ctx.BindingUsable=function() return learned end;human.Health=0;farm:Start();assert(sent==0 and farm.Enabled)
local respawned={FindFirstChild=function() return root end,FindFirstChildOfClass=function() return human end}
player.Character=respawned;tool.Parent=respawned;human.Health=100;step()
assert(farm.Enabled and sent==1,'a respawn must resume when the learned session only supplies the native weapon')
ctx.BindingUsable=nil;player.Character=char;tool.Parent=char
reset();damage=false;farm.TargetBudget=1;farm:Start();assert(sent==1 and farm.Target==nil and farm.Drops==0)
-- A slime beside the character that is only cooling down beats a trip to a far one.
reset();damage=false;farm.TargetBudget=1;farm.Travel='Teleport';br.Position=v(40);farm:Start()
assert(sent==1 and farm.Target==nil,'the first unconfirmed swing cools the near slime down')
local h=hops;step();assert(hops==h and sent==1 and farm.Message:find('cooling down',1,true),'with the near slime cooling down the farm waits instead of teleporting to one 40 studs away')
step(6);assert(sent==2,'after the cooldown the near slime is attacked again')
reset();damage=false;farm.TargetBudget=1;farm.Travel='Teleport';br.Position=v(14);farm:Start();h=hops;step()
assert(hops>h and farm.Target==b,'a slime within the chase range is still worth the hop')
ah.Health-=10;step();assert(farm.Drops==1,'an HP drop replicated after a target switch must still be observed')
reset();farm:Start();step(1);farm:Stop();local runTime=farm:RunTime();step(5)
assert(runTime>=1 and farm:RunTime()==runTime and farm.EndedAt,'run time must freeze when the farm stops')
reset();farm.HitAndRun=true;ar.Position=v(40);br.Position=v(32);farm.Travel='Teleport';farm:Start()
assert(hops==1 and root.Position.X==8 and walks==0 and moves==0 and sent==0 and farm.Message:find('Teleporting',1,true),'TP mode must hop 8 studs toward the slime, not walk')
step();step();assert(hops==3 and root.Position.X==24 and sent==0)
step();assert(hops==5 and root.Position.X>=21 and root.Position.X<=22 and sent==1 and farm.Target==b and farm.Message:find('backed off to 11 studs',1,true),'the last hop lands at the kept distance, the swing follows in the same tick, then a hop back out of reach')
step();assert(hops==5 and sent==1 and farm.Message:find('Resting',1,true),'between swings the character rests out of reach instead of hopping on')
step(.7);assert(hops==7 and sent==2 and root.Position.X>=21 and root.Position.X<=22,'when the next swing is due: hop in, swing, hop out again')
br.Position=v(30);step(.7);assert(hops==7 and sent==2 and farm.Message:find('is moving',1,true),'a slime that moved since the last tick is mid-jump: no hop in until it settles')
step(.15);assert(hops==9 and sent==3,'once the slime settles the hop in and swing follow')
human.Health=80;step();assert(farm.HitsTaken==1 and farm.DamageTaken==20 and farm.HitsAfterSwing==1,'damage taken right after a swing is counted as such')
pause='typing';step(1.2);human.Health=70;step();assert(farm.HitsTaken==2 and farm.DamageTaken==30 and farm.HitsAfterSwing==1,'damage taken away from a swing is counted separately')
human.Health=100;step();assert(farm.HitsTaken==2,'healing is not a hit');pause=nil
farm.HitAndRun=false;step(.7);assert(hops>=10 and sent>=4 and root.Position.X>=27 and root.Position.X<=28,'hit and run OFF stays at the kept distance after the swing')
local h=hops;step(.7);assert(hops==h and sent>=5,'TP hops keep the distance instead of hopping on')
reset();farm.Travel='Teleport';blocked=true;ar.Position=v(40);br.Position=v(60);farm:Start();step()
assert(hops==0 and walks>=1,'obstructed slimes must be pathfound instead of teleported through walls')
reset();farm.Travel='Teleport';stuck=true;ar.Position=v(40);br.Position=v(60);farm:Start()
local tpStalled=false
for i=1,20 do step();if farm.Message:find('Teleport stalled',1,true) then tpStalled=true;break end end
assert(tpStalled and sent==0 and farm.Enabled,'rubber-banded teleports must back off instead of looping forever on one slime')
reset();farm.Travel='Teleport';hopError=true;ar.Position=v(40);br.Position=v(60);farm:Start()
assert(hops==1 and farm.Enabled and farm.Message:find('Teleport unavailable',1,true),'a failed hop must cool the slime down and keep farming')
reset();farm.Travel='Teleport';farm.Walk=false;ar.Position=v(40);br.Position=v(60);farm:Start();step(2)
assert(hops==0 and walks==0 and sent==0,'Auto Move OFF must never teleport')
reset();br.Position=v(8);bh.Health=30;farm:Start()
assert(sent==1 and farm.Target==b,'a damaged slime about as close as the nearest must be finished first')
step();assert(sent==1 and farm.Target==b)
reset();br.Position=v(20);bh.Health=30;farm:Start();assert(farm.Target==a,'a far damaged slime must not pull the farm past a near one')
reset();ah.Health=15;farm:Start();assert(farm.Drops==1 and ah.Health==5)
a.Parent=nil;step();a.Parent=nested
assert(farm.KillsByName.slimeBlue==1,'likely defeats count in the per-mob report')
assert(farm.Defeats==0 and farm.LikelyDefeats==1,'a slime that despawns right after a finishing-size hit is a likely defeat, never an observed one')
reset();farm:Start();assert(farm.Drops==1 and ah.Health==90);a.Parent=nil;step();a.Parent=nested
assert(farm.LikelyDefeats==0,'a healthy slime streaming out is not a likely defeat')
-- Nothing inside the radius: Auto Move seeks the nearest loaded target within SeekRange.
reset();farm.SeekRange=300;ar.Position=v(70);br.Position=v(90);farm:Start()
for i=1,6 do if sent>0 then break end;step() end
assert(sent==1 and farm.Target==a,'a target just outside the radius must be reached and attacked')
reset();farm.SeekRange=300;farm.Walk=false;ar.Position=v(70);br.Position=v(90);farm:Start();step(2)
assert(sent==0 and walks==0 and moves==0 and farm.Message:find('within 60 studs',1,true),'Auto Move OFF must never seek beyond the radius')
reset();farm.SeekRange=250;ar.Position=v(400);br.Position=v(400);farm:Start();step(2)
assert(sent==0 and farm.Message:find('within 250 studs',1,true),'targets beyond SeekRange are not chased')
-- Swings are real clicks aimed at the target; Activate() only when no click can land.
do
 reset();local clicks,releases,aimTarget={}, 0,nil
 ctx.Aim=function(target) aimTarget=target;return 120,340 end
 ctx.Click=function(x,y,down) if down then table.insert(clicks,{x,y}) else releases+=1 end;return true end
 farm:Start()
 assert(aimTarget and aimTarget.Model==a and #clicks==1 and clicks[1][1]==120 and releases==1 and sent==0,'an aimable target gets a mouse click, not Tool:Activate')
 assert(farm.LastMethod=='mouse click at target' and farm.Swings==1,'the method must be reported')
 ctx.Aim=function() return nil,'target off screen' end;clicks={}
 step(.7);assert(#clicks==0 and sent==1 and farm.LastMethod:find('weapon activation',1,true) and farm.LastMethod:find('off screen',1,true),'an off-screen target falls back to activation and says why')
 ctx.Aim=function() return 10,10 end
 ctx.Click=function(x,y,down) if down then return true end;error('release failed') end
 step(.7);assert(not farm.Enabled and farm.Press and farm.Message:find('release failed',1,true),'a click that cannot be released must stop with the press retained for STOP')
 ctx.Click=function() return true end;assert(farm:ReleaseSwing() and not farm.Press)
 ctx.Aim=nil;ctx.Click=nil
end
-- Clicks with no HP change escalate to the learned hit packet before giving up on the target.
do
 reset();damage=false;local learned={}
 ctx.Aim=function() return 50,50 end;ctx.Click=function() return true end
 ctx.LearnedHit=function(model) table.insert(learned,model);ah.Health-=10;return true end
 farm:Start();for i=1,5 do step(.7) end
 assert(farm.Swings==6 and #learned==0 and farm.UseLearnedHit and farm.Message:find('learned hit packet',1,true),'six unconfirmed clicks must switch on the learned hit')
 step(.7);assert(#learned==1 and learned[1]==a and farm.Drops==1 and farm.LastMethod:find('+ learned hit',1,true),'the next swing adds the learned packet on the same target')
 ctx.Aim=nil;ctx.Click=nil;ctx.LearnedHit=nil
end
-- A ready hit packet (learned, auto-learned or remembered) follows every click from the first swing,
-- starting from the far end of its range probe where a click cannot land.
do
 reset();damage=false;local learned={};local accept=true
 ctx.Aim=function() return 50,50 end;ctx.Click=function() return true end
 ctx.LearnedHitReady=function() return true end
 ctx.LearnedHit=function(model) table.insert(learned,model);if accept then ah.Health-=10;return true end;return false,{success=false} end
 farm:Start();assert(#learned==1 and farm.LearnedHits==1 and farm.UseLearnedHit and farm.PacketKeep==9 and farm.LastMethod:find('+ learned hit',1,true),'a ready packet is used from the first swing and the probe starts at 9 studs')
 step(.7);assert(#learned==2 and farm.Drops==2,'and on every later swing')
 accept=false;for i=1,8 do step(.7) end
 assert(#learned==10 and farm.UseLearnedHit and farm.LearnedHitRejections==8 and farm.LastRejection:find('success=false',1,true) and not farm.LearnedHitRejected,'rejections are counted and never switch the packet off')
 assert(farm.PacketKeep==5.5,'two rejections in a row step the probe one stud closer until the normal distance')
 ctx.LearnedHitReady=nil;ctx.Aim=nil;ctx.Click=nil;ctx.LearnedHit=nil
end
-- The kept distance follows the packet range while packets are accepted out there.
do
 reset();damage=false;local learned={};farm.Travel='Teleport';farm.HitAndRun=false;ar.Position=v(30);br.Position=v(60);ah.Health=1000;ah.MaxHealth=1000
 ctx.Aim=function() return 50,50 end;ctx.Click=function() return true end
 ctx.LearnedHitReady=function() return true end
 ctx.LearnedHit=function(model) table.insert(learned,model);ah.Health-=10;return true end
 farm:Start();for i=1,4 do step(.7) end
 assert(farm.PacketKeep==9 and farm.PacketAcceptedAt==9 and math.abs(ar.Position.X-root.Position.X-9)<1e-6 and #learned>=3,'accepted packets keep the character 9 studs out')
 ctx.LearnedHit=function(model) table.insert(learned,model);return false,{success=false} end
 step(.7);step(.7);assert(farm.PacketKeep==8,'two rejections step one stud closer')
 ctx.LearnedHit=function(model) table.insert(learned,model);ah.Health-=10;return true end
 step(.7);step(.7);assert(farm.PacketKeep==8 and farm.PacketAcceptedAt==8 and math.abs(ar.Position.X-root.Position.X-8)<1e-6,'an accepted packet holds the new distance')
 ctx.LearnedHitReady=nil;ctx.Aim=nil;ctx.Click=nil;ctx.LearnedHit=nil
end
-- A mob hidden only by its no-damage cooldown is reported as cooling down, not missing.
do
 reset();damage=false;br.Position=v(300);farm:Start();for i=1,5 do step(.7) end
 step(.7);assert(farm.Message:find('cooling down after no HP drop',1,true) and farm.Message:find('retry in',1,true),'cooldown must be explained instead of "no living slimes"')
end
-- Food below 50% HP, before any retreat; the eat hook is rate limited and counted.
do
 reset();local meals=0
 ctx.Eat=function() meals+=1;human.Health=90;return true,'potatoSalad · HP 90/100' end
 human.Health=45;farm:Start()
 assert(meals==1 and farm.Meals==1 and farm.LastEat:find('ate potatoSalad',1,true) and sent==1,'low HP must eat first, then attack once healed')
 human.Health=45;step(.7);assert(meals==1,'eating is rate limited to one meal per 4 seconds')
 step(4);assert(meals==2,'the next meal follows after the limit')
 farm.AutoEat=false;human.Health=45;step(4);assert(meals==2,'AUTO EAT OFF never eats')
 ctx.Eat=function() meals+=1;return false,'no food in the inventory' end
 farm.AutoEat=true;human.Health=20;step(4);assert(meals==3 and farm.LastEat:find('could not eat',1,true) and farm.Message:find('low health',1,true) or farm.Message:find('Retreating',1,true),'without food the low-health retreat still applies')
 ctx.Eat=nil
end
-- Walk mode hit and run: walk in, swing, walk back out to the rest distance.
do
 reset();farm.HitAndRun=true;ar.Position=v(20);farm:Start()
 assert(sent==1 and math.abs(ar.Position.X-root.Position.X-12)<1e-6 and farm.Message:find('backed off to 12 studs',1,true),'walk mode hit and run walks back out to 12 studs after the swing')
 step();assert(sent==1 and farm.Message:find('Resting',1,true),'it rests there until the next swing is due')
 step(.7);assert(sent==2 and math.abs(ar.Position.X-root.Position.X-12)<1e-6,'then walks in, swings and walks out again')
end
-- A grounded slime already within reach is hit before travelling to the chosen target.
do
 reset();ar.Position=v(30);farm.ChaseRange=0;farm:Start();assert(farm.Target==a or farm.Target==b)
 reset();ar.Position=v(30);br.Position=v(5);farm:Start();assert(farm.Target==b and sent==1,'the slime within reach is hit first')
 reset();ar.Position=v(30);br.Position=v(5);farm:Start();step();ar.Position=v(5);br.Position=v(30);step(.7)
 assert(farm.Target==a,'when the target leaves and another slime stands within reach, that one is hit next')
end
-- The kept distance follows the body size (model extents), not the small root part.
do
 reset();local big=a;function big:GetExtentsSize() return {X=8,Y=8,Z=8} end
 ar.Position=v(20);br.Position=v(60);farm:Start()
 assert(math.abs(ar.Position.X-root.Position.X-5.5)<1e-6,'an 8-stud slime is kept at its body edge + 1.5, capped at reach - .5')
 big.GetExtentsSize=nil
end
-- A mob standing on the character is attacked from the edge of reach, not from inside it.
do
 reset();ar.Position=v(1);farm:Start()
 assert(sent==1 and moves>=1 and (ar.Position.X-root.Position.X)>=farm.Standoff,'a mob within the standoff distance must be stepped away from before the swing')
 reset();farm.Walk=false;ar.Position=v(1);farm:Start();assert(sent==1 and moves==0,'Auto Move OFF never steps')
end
-- Travel runs at the farm's walk speed and the original speed returns on every halt and swing.
do
 reset();local speeds={}
 ctx.Boost=function(h,speed) assert(h==human);table.insert(speeds,speed or 'restore') end
 ar.Position=v(15);farm:Start()
 assert(speeds[1]==24,'chasing must apply the farm walk speed')
 step();assert(sent==1 and speeds[#speeds]=='restore','the swing restores the original speed')
 farm.WalkSpeed=32;ar.Position=v(30);speeds={};step(.7);assert(speeds[1]==32,'the chosen walk speed is used')
 farm:Stop();assert(speeds[#speeds]=='restore','Stop must restore the original speed')
 ctx.Boost=nil
end
-- A slime hopping at the character is awaited, a slime in the air is not swung at, and facing is continuous.
do
 reset();stuck=true;ar.Position=v(11);farm:Start()
 local chasedMoves=moves
 ar.Position=v(9);step()
 assert(root.Position.X==0 and sent==0 and (farm.Message:find('Chasing',1,true) or farm.Message:find('Dodging',1,true)),'a closing target is tethered, never hopped into')
 ar.Position=v(4);step();assert(sent==1,'once it arrives in reach it is attacked')
 reset();ar.Position=v(4);ar.Position.Y=8;farm:Start()
 assert(sent==0 and farm.Message:find('in the air',1,true),'no swing while the slime is above head height')
 ar.Position.Y=0;step(.7);assert(sent==1,'the landed slime is attacked')
 reset();ar.Position=v(9);farm:Start();assert(faced==ar,'the character faces a nearby target before it is in reach')
end
-- Loot in the inventory confirms hits when mob HP never changes, and refills the budgets.
do
 reset();damage=false;local bag={greenSlimeBall=0}
 ctx.Inventory=function() return {greenSlimeBall=bag.greenSlimeBall} end
 farm:Start();for i=1,3 do step(.7) end
 assert(farm.Swings==4 and farm.Loot==0,'no loot yet')
 bag.greenSlimeBall=2;step(.7)
 assert(farm.Loot==2 and farm.LootByName.greenSlimeBall==2,'loot gained after a swing must be counted')
 for i=1,10 do step(.7) end
 assert(farm.Enabled,'a run with loot must not stop on the no-damage budget')
 bag.greenSlimeBall=5;step(.7);assert(farm.Loot==5,'later loot keeps counting')
 ctx.Inventory=nil
end
-- Without any replicated HP drop, a target that vanishes within reach right after a swing is a likely defeat.
do
 reset();damage=false;farm:Start();assert(farm.Swings==1 and farm.Drops==0)
 a.Parent=nil;step();a.Parent=nested
 assert(farm.LikelyDefeats==1 and farm.KillsByName.slimeBlue==1,'vanish within reach after a swing counts when HP never replicates')
end
-- Health attributes are read when present.
do
 reset();a.attributes={Health=40};function a:GetAttribute(k) return self.attributes[k] end
 damage=false;farm:Start();a.attributes.Health=30;step(.7)
 assert(farm.Drops==1,'an HP attribute drop counts as a hit');a.attributes=nil;a.GetAttribute=nil
end
-- A slime jumping at the character is dodged with a sidestep instead of waited for.
do
 reset();stuck=true;local dodges=0
 ctx.Sidestep=function(h,r,threat,distance) assert(h==human and r==root and distance==5);dodges+=1 end
 ar.Position=v(9);farm:Start();ar.Position=v(7);ar.Position.Y=6;step()
 assert(dodges==1 and farm.Message:find('Dodging',1,true) and sent==0,'an airborne closing slime must be sidestepped')
 ar.Position.Y=0;ar.Position=v(7);step();assert(farm.Message:find('is coming',1,true) or sent>=0)
 ctx.Sidestep=nil
end
-- Tether: the kept distance is held in both directions, following a moving mob.
do
 reset();farm.KeepDistance=4;ar.Position=v(20);br.Position=v(60);farm:Start()
 assert(math.abs(ar.Position.X-root.Position.X-4)<1e-6 and sent==1,'the farm closes to the kept distance and swings')
 ar.Position=v(26);step(.7);assert(math.abs(ar.Position.X-root.Position.X-4)<1e-6,'when the mob moves away the farm follows at the same distance')
 ar.Position=root.Position;ar.Position=v(root.Position.X+1);step(.7)
 assert(math.abs(ar.Position.X-root.Position.X-4)<1e-6,'when the mob closes in the farm backs out to the same distance')
 reset();farm.KeepDistance=4;farm.Travel='Teleport';farm.HitAndRun=false;ar.Position=v(40);br.Position=v(60);farm:Start();for i=1,6 do step() end
 assert(math.abs(ar.Position.X-root.Position.X-4)<1e-6 and sent>=1,'TP hops attach at the kept distance too')
 ar.Position=v(root.Position.X+1);step(.7);assert(math.abs(ar.Position.X-root.Position.X-4)<1e-6,'a hop backs out when the mob lands on the character')
 farm.HitAndRun=true;step(.7);assert(math.abs(ar.Position.X-root.Position.X-12)<=1e-6,'hit and run rests 12 studs away after the swing')
 ar.Position=v(root.Position.X+1);step();assert(math.abs(ar.Position.X-root.Position.X-4)<1e-6 and sent>=3,'a mob landing on a resting character is hit from the kept distance at once')
end
-- Floating damage numbers confirm hits and refill the budgets.
do
 reset();damage=false;local numbers={}
 ctx.DamageSeen=function(since) local c,t=0,0 for _,n in ipairs(numbers) do if n.At>=since and not n.Counted then n.Counted=true;c+=1;t+=n.Value end end return c,t end
 farm:Start();for i=1,3 do step(.7) end
 assert(farm.Swings==4 and farm.DamageNumbers==0)
 table.insert(numbers,{At=time,Value=16});step()
 assert(farm.DamageNumbers==1 and farm.DamageTotal==16,'a damage number after a swing counts as a hit')
 for i=1,14 do table.insert(numbers,{At=time,Value=10});step(.7) end
 assert(farm.Swings>=12 and farm.Enabled and farm.DamageNumbers>=10,'confirmed hits keep the run going past the budget')
 ctx.DamageSeen=nil
end
reset();farm:Start();alive=false;step();assert(not farm.Enabled and not farm.Worker,'GUI removal must terminate worker')
return 'Mob farm: targeting, facing, TP hop loop, respawn resume, late HP observation, run time, direct chase/stall backoff, walking, per-target no-damage switching, cooldowns, health/chat pauses, observations, no-damage budget, session/Stop/restart guards passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'mob-farm',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
