import fs from 'node:fs';
import {LuauState} from 'luau-web';
const source=fs.readFileSync(new URL('../tools/CaptureRemotes.lua',import.meta.url),'utf8');
const code=`
local realTypeof=typeof
local function typeof(value) return type(value)=='table' and value._type or realTypeof(value) end
local function node(name,kind,parent)
 local n={_type='Instance',Name=name,ClassName=kind,Parent=parent,children={}}
 if parent then table.insert(parent.children,n) end
 function n:IsA(c) return c==kind end
 function n:GetChildren() return self.children end
 function n:FindFirstChild(name) for _,c in ipairs(self.children) do if c.Name==name then return c end end end
 function n:FindFirstChildOfClass(kind) for _,c in ipairs(self.children) do if c:IsA(kind) then return c end end end
 return n
end
local game=node('game','DataModel');game.JobId='server-a';game.PlaceId=123
local world=node('Workspace','Workspace',game)
local storage=node('ReplicatedStorage','ReplicatedStorage',game)
local out=node('out','Folder',node('net','Folder',storage))
local group=node('I6j1Fhxt8XQFwb','Folder',out)
local entities=node('Entities','Folder',node('WildernessIsland','Model',world))
local function mob(name,parent)
 local m=node(name,'Model',parent or entities)
 local h=node('Humanoid','Humanoid',m);h.Health=100
 node('HumanoidRootPart','Part',m)
 return m
end
local a,b=mob('slimeBlue'),mob('slimeGreen')
local char=node('Character','Model',world)
local tool=node('ironWarAxe','Tool',char);node('sword-legacy','LocalScript',tool)
local player={UserId=7,Character=char}
local players={LocalPlayer=player,GetPlayerFromCharacter=function(_,m) return m.Player and {} or nil end}
local listenerCount=0
local input={InputBegan={Connect=function()
 listenerCount+=1;return {Disconnect=function() end}
end}}
function game:GetService(name)
 if name=='Workspace' then return world elseif name=='ReplicatedStorage' then return storage
 elseif name=='Players' then return players elseif name=='UserInputService' then return input end
 error('Unexpected service: '..name)
end
local env={}
local function getgenv() return env end
local method='InvokeServer'
local function getnamecallmethod() return method end
local installed,hookCount,forwarded=nil,0,0
local response,throws,onForward=nil,nil,nil
local function hookmetamethod(_,_,fn)
 hookCount+=1;installed=fn
 return function(remote,...)
  forwarded+=1
  if onForward then onForward() end
  if throws then error(throws,0) end
  return response,nil,'tail',nil
 end
end
local function print() end
local warn=print
local function runRecorder() ${source} end
runRecorder()
local recorder=env.RebornCapture
local endpoint=node('vsDa9Tj8HsvSPz','RemoteFunction',group)
local sends={}
function endpoint:InvokeServer(...)
 table.insert(sends,table.pack(...))
 if throws then error(throws,0) end
 return response
end
local observed={U2NRKBAkSyCyXM={hitUnit=a,extra=17},oWybFA5HSVijAB='learned-current-session'}
local function arm() recorder:Resume();recorder.Active=false;recorder.LearnMobOnly=true;recorder.MobLearnToken={} end
arm()
local returned=table.pack(installed(endpoint,observed))
assert(returned.n==4 and returned[1]==nil and returned[2]==nil and returned[3]=='tail' and returned[4]==nil,'learning must preserve every original return including nils')
assert(forwarded==1 and #sends==0 and recorder.Stopped and not recorder.LearnMobOnly,'one manual attack must be forwarded once; learning must send no extra attack')
assert(recorder:CanUseMobBinding() and recorder.MobBinding.WeaponName=='ironWarAxe' and recorder.MobBinding.BodyKey=='U2NRKBAkSyCyXM')
assert(recorder:MobHit(b))
local sent=sends[1]
assert(sent.n==1 and sent[1].U2NRKBAkSyCyXM.hitUnit==b and observed.U2NRKBAkSyCyXM.hitUnit==a,'replay must replace the target without mutating the manual request')
assert(sent[1].oWybFA5HSVijAB=='learned-current-session' and sent[1].U2NRKBAkSyCyXM.extra==17,'current session envelope and scalar fields must survive')
observed.U2NRKBAkSyCyXM.extra=99;observed.oWybFA5HSVijAB='mutated'
assert(recorder:MobHit(b) and sends[2][1].U2NRKBAkSyCyXM.extra==17 and sends[2][1].oWybFA5HSVijAB=='learned-current-session','learning must snapshot the packet')
local valid=recorder.MobBinding
for _,bad in ipairs({
 {U2NRKBAkSyCyXM={hitUnit=b,other=b}},
 {U2NRKBAkSyCyXM={hitUnit=b,nested={}}},
 {U2NRKBAkSyCyXM={hitUnit=b},other={hitUnit=a}},
 {U2NRKBAkSyCyXM={hitUnit=b},session=string.rep('x',1025)},
 {U2NRKBAkSyCyXM={hitUnit=b},session=math.huge},
}) do arm();installed(endpoint,bad);assert(recorder.LearnMobOnly and recorder.MobBinding==valid,'unsupported shapes must not replace the learned hit') end
local other=mob('slimeBlue',world)
arm();installed(endpoint,{body={hitUnit=other}});assert(recorder.LearnMobOnly)
other.Parent=entities;other.Player=true;installed(endpoint,{body={hitUnit=other}});assert(recorder.LearnMobOnly,'players must not be learned as mobs')
b:FindFirstChildOfClass('Humanoid').Health=0
installed(endpoint,{body={hitUnit=b}});assert(recorder.LearnMobOnly,'dead mobs must not be learned');b:FindFirstChildOfClass('Humanoid').Health=100
tool.Parent=nil;char.children={};installed(endpoint,{body={hitUnit=b}});assert(recorder.LearnMobOnly,'an equipped weapon is required');tool.Parent=char;char.children={tool}
method='FireServer';installed(endpoint,{body={hitUnit=b}});assert(recorder.LearnMobOnly,'only the supplied InvokeServer shape is supported');method='InvokeServer'
local elsewhere=node('unrelated','RemoteFunction',storage)
installed(elsewhere,{body={hitUnit=b}});assert(recorder.LearnMobOnly,'learning must be restricted to the game network out tree')
response={success=false,error='TOO_FAST'};installed(endpoint,{body={hitUnit=b}})
assert(recorder.LearnMobOnly and recorder.MobBinding==valid,'a rejected manual call must not replace a valid binding or finish learning')
throws={reason='transport'};local ok,err=pcall(installed,endpoint,{body={hitUnit=b}})
assert(not ok and err==throws and recorder.MobBinding==valid and recorder.LearnMobOnly,'learning must preserve original errors and restore the prior template')
throws=nil;response=nil;recorder:Stop()
arm();onForward=function()
 assert(recorder.MobBinding==valid,'a pending manual call must not publish its candidate before success')
 recorder:Stop()
end
installed(endpoint,{body={hitUnit=b},session='late'})
assert(recorder.MobBinding==valid and recorder.Stopped,'Stop during a manual request must discard its late candidate')
arm();onForward=function() arm() end
installed(endpoint,{body={hitUnit=b},session='old-learner'})
assert(recorder.MobBinding==valid and recorder.LearnMobOnly,'a newer learner must not be replaced by an older in-flight call')
onForward=nil;recorder:Stop()
local before=#sends
local originalJob,originalPlace,originalChar,originalUser=game.JobId,game.PlaceId,player.Character,player.UserId
game.JobId='other';assert(not recorder:MobHit(b));game.JobId=originalJob
game.PlaceId=999;assert(not recorder:MobHit(b));game.PlaceId=originalPlace
player.Character={};assert(not recorder:MobHit(b));player.Character=originalChar
player.UserId=8;assert(not recorder:MobHit(b));player.UserId=originalUser
tool.Name='fishingRod';assert(not recorder:MobHit(b));tool.Name='ironWarAxe'
endpoint.Parent=nil;assert(not recorder:MobHit(b));endpoint.Parent=group
b.Parent=nil;assert(not recorder:MobHit(b));b.Parent=entities
b.Player=true;assert(not recorder:MobHit(b));b.Player=nil
b:FindFirstChildOfClass('Humanoid').Health=0;assert(not recorder:MobHit(b));b:FindFirstChildOfClass('Humanoid').Health=100
assert(#sends==before,'stale context, wrong tools, detached targets and players must send nothing')
response={success=false,error='TOO_FAST'};assert(not recorder:MobHit(b),'server rejection must remain failure')
response=false;assert(not recorder:MobHit(b))
response=nil;throws='transport';assert(not recorder:MobHit(b) and not recorder.DispatchingMob,'transport errors must release replay state without fallback')
throws=nil;assert(recorder:MobHit(b))
local binding=recorder.MobBinding
local previousRecorder=recorder
recorder.Version=33;recorder.LearnMobOnly=true
local hooks,listeners=hookCount,listenerCount
runRecorder();recorder=env.RebornCapture
assert(recorder.Version==34 and recorder.MobBinding==binding and recorder~=previousRecorder and recorder:CanUseMobBinding(),'v33 upgrade must preserve bindings with new validation')
assert(hookCount==hooks+1 and listenerCount==listeners+1)
runRecorder();assert(env.RebornCapture==recorder and hookCount==hooks+1 and listenerCount==listeners+1,'current recorder reuse must not stack hooks/listeners')
arm();recorder:Stop();assert(not recorder.LearnMobOnly,'Stop must cancel mob learning')
return 'Mob capture: supplied rotating InvokeServer envelope, target substitution, manual-call semantics, rejection/error rollback, context guards and recorder upgrade passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'mob-capture',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
