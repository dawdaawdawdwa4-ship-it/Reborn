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
  assert(r==root and t==farm.Target:FindFirstChild('HumanoidRootPart'));hops+=1
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
learned=false;assert(not farm:Start() and sent==0);learned=true
busy='other worker';assert(not farm:Start());busy=nil
assert(farm:Start() and sent==1 and farm.Swings==1 and farm.Drops==1)
step();assert(sent==1,'cadence must include time spent in RPC/equip and never spam')
step(.6);assert(sent==2 and farm.Drops==2)
farm:Stop();local before=sent;step(1)
assert(sent==before and not farm.Worker and not farm.Enabled,'Stop must end worker and future attacks')
local function reset()
 farm:Stop();step();farm=Module.new(ctx)
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
reset();farm:Start();local prior=farm.Drops;a.Parent=nil;step(.7)
assert(farm.Defeats==0 and farm.Drops==prior,'streaming out must not count a defeat');a.Parent=nested
reset();ar.Position=v(30);farm.ChaseRange=0;farm:Start();assert(walks==1 and sent==0);step();assert(sent==1 and farm.Target==b,'Auto Walk must approach nearest living target and attack only after rechecking reach')
reset();ar.Position=v(30);farm.Walk=false;farm:Start();step(2);assert(walks==0 and sent==0 and farm.Enabled)
reset();human.Health=25;farm:Start();assert(sent==0 and farm.Enabled)
assert(moves==1 and root.Position.X<0 and farm.Message:find('Retreating',1,true),'low health must step away from the nearest slime')
human.Health=40;step(1);assert(sent==0,'health recovery must use hysteresis')
human.Health=45;for i=1,4 do step() end;assert(sent==1,'farming must resume after recovery')
reset();farm.Walk=false;human.Health=25;farm:Start()
assert(moves==0 and farm.Message:find('low health',1,true),'Auto Move OFF must never retreat on its own')
reset();pause='typing';farm:Start();step(2);assert(sent==0 and walks==0 and farm.Enabled);pause=nil;step();assert(sent==1)
reset();equipHook=function() farm:Stop();scheduler.wait(.1) end;farm:Start()
assert(not farm:Start() and farm.Worker,'restart must wait for old yielding equip cleanup')
step();assert(sent==0 and not farm.Worker,'Stop during equip must prevent a late attack')
equipHook=nil;assert(farm:Start());assert(sent==1,'fresh restart must create one worker')
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
assert(hitA>=4 and hitB==4,'one unhittable slime must be cooled down and the next slime tried')
assert(sent==12 and farm.Swings==12 and farm.Drops==0 and not farm.Enabled and not farm.Worker and farm.Message:find('12 swings',1,true),'unconfirmed attacks across targets must stop at a bounded run budget')
reset();damage=false
attackHook=function() if farm.Swings==2 then damage=true end end
farm:Start();for i=1,40 do if not farm.Enabled or farm.Swings>=14 then break end;step(.7) end
assert(farm.Enabled and farm.Drops>0,'any observed HP drop must refill the run budget')
reset();faceError=true;farm:Start();assert(sent==1 and farm.Enabled,'a facing failure must not block the native swing')
reset();ar.Position=v(15);farm:Start()
assert(walks==0 and moves==1 and sent==0 and farm.Message:find('Chasing',1,true),'nearby visible slimes must be chased directly without pathfinding')
step();assert(sent==1 and farm.Target==a and walks==0,'a chased slime must be attacked once in reach')
reset();ar.Position=v(15);farm:Start();farm:Stop()
assert(moves==2 and not farm.Chase,'Stop must clear the direct chase destination')
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
ah.Health-=10;step();assert(farm.Drops==1,'an HP drop replicated after a target switch must still be observed')
reset();farm:Start();step(1);farm:Stop();local runTime=farm:RunTime();step(5)
assert(runTime>=1 and farm:RunTime()==runTime and farm.EndedAt,'run time must freeze when the farm stops')
reset();ar.Position=v(40);br.Position=v(32);farm.Travel='Teleport';farm:Start()
assert(hops==1 and root.Position.X==8 and walks==0 and moves==0 and sent==0 and farm.Message:find('Teleporting',1,true),'TP mode must hop 8 studs toward the slime, not walk')
step();step();assert(hops==3 and root.Position.X==24 and sent==0)
step();assert(hops==4 and root.Position.X==29 and sent==0,'the last hop must stop short of the slime')
step();assert(sent==1 and farm.Target==b,'TP hops must loop until the slime is in reach, then attack')
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
assert(sent==0 and farm.Target==b,'a damaged slime about as close as the nearest must be finished first')
step();assert(sent==1 and farm.Target==b)
reset();br.Position=v(20);bh.Health=30;farm:Start();assert(farm.Target==a,'a far damaged slime must not pull the farm past a near one')
reset();ah.Health=15;farm:Start();assert(farm.Drops==1 and ah.Health==5)
a.Parent=nil;step();a.Parent=nested
assert(farm.KillsByName.slimeBlue==1,'likely defeats count in the per-mob report')
assert(farm.Defeats==0 and farm.LikelyDefeats==1,'a slime that despawns right after a finishing-size hit is a likely defeat, never an observed one')
reset();farm:Start();assert(farm.Drops==1 and ah.Health==90);a.Parent=nil;step();a.Parent=nested
assert(farm.LikelyDefeats==0,'a healthy slime streaming out is not a likely defeat')
reset();farm:Start();alive=false;step();assert(not farm.Enabled and not farm.Worker,'GUI removal must terminate worker')
return 'Mob farm: targeting, facing, TP hop loop, respawn resume, late HP observation, run time, direct chase/stall backoff, walking, per-target no-damage switching, cooldowns, health/chat pauses, observations, no-damage budget, session/Stop/restart guards passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'mob-farm',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
