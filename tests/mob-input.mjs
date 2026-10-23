import fs from 'node:fs';
import {LuauState} from 'luau-web';
const source=fs.readFileSync(new URL('../tools/MobFarm.lua',import.meta.url),'utf8');
const code=`
local Module=(function() ${source} end)()
local waits,events,workers={},{},{}
local running=true
local pressError,refusePress,releaseError,refuseRelease,waitError=false,false,false,false,false
local tool={Enabled=true}
function tool:Activate()
 table.insert(events,'activate')
 if pressError then error('activation denied',0) end
 if refusePress then return false end
end
function tool:Deactivate()
 table.insert(events,'deactivate')
 if releaseError then error('release denied',0) end
 if refuseRelease then return false end
end
local scheduler={wait=function(dt)
 table.insert(waits,dt)
 if waitError then error('hold failed',0) end
 return coroutine.yield(dt)
end}
local farm=Module.new({Navigation={Stop=function(owner) assert(owner=='Mobs') end},Scheduler=scheduler,
 Alive=function() return true end,Busy=function() end,Recorder=function() return nil end})
local function active() return running end
local function reset()
 running=true;pressError=false;refusePress=false;releaseError=false;refuseRelease=false;waitError=false
 tool.Enabled=true;events={};waits={};farm.Press=nil
end
local function start(canStart,owner)
 local result
 local co=coroutine.create(function() result=table.pack(farm:Swing(tool,canStart or active,owner)) end)
 local ok,err=coroutine.resume(co);assert(ok,err)
 return co,function() return result end
end
local function finish(co) if coroutine.status(co)=='suspended' then local ok,err=coroutine.resume(co);assert(ok,err) end end
reset();local co,result=start();assert(events[1]=='activate' and farm.Press and waits[1]==.08)
finish(co);assert(result()[1] and table.concat(events,',')=='activate,deactivate' and not farm.Press,'native swing must release after one bounded hold')
reset();running=false;co,result=start();assert(not result()[1] and #events==0,'cancelled input must not activate')
reset();tool.Enabled=false;co,result=start();assert(not result()[1] and #events==0,'tool cooldown must not activate')
reset();co,result=start();local old=farm.Press
running=false;farm:Stop();assert(events[2]=='deactivate' and not farm.Press,'Stop must release the held weapon immediately, before the worker resumes')
finish(co);assert(not result()[1] and #events==2,'old hold cleanup must not release twice or report a successful post-Stop swing')
running=true;local nextCo,nextResult=start();local newer=farm.Press
assert(newer and farm:ReleaseSwing(old) and farm.Press==newer and #events==3,'old release must not cancel a newer activation')
finish(nextCo);assert(nextResult()[1] and #events==4)
for _,kind in ipairs({'throw','false'}) do
 reset();pressError=kind=='throw';refusePress=kind=='false';co,result=start()
 assert(not result()[1] and table.concat(events,',')=='activate,deactivate' and not farm.Press,'activation failure still needs a paired release with no alternate hit request')
end
reset();waitError=true;co,result=start();assert(not result()[1] and events[2]=='deactivate' and not farm.Press,'failed holds must release')
for _,kind in ipairs({'throw','false'}) do
 reset();releaseError=kind=='throw';refuseRelease=kind=='false';co,result=start();finish(co)
 assert(not result()[1] and farm.Press,'failed release must retain its owner for Stop/retry')
 local attempts=#events
 assert(not farm:Start() and #events==attempts+1 and events[#events]=='deactivate','Start must retry release and refuse a new activation while release is blocked')
 releaseError=false;refuseRelease=false;farm:Stop();assert(not farm.Press and events[#events]=='deactivate')
end
reset();local targetAlive=true
co,result=start(function() return targetAlive end,active);targetAlive=false;finish(co)
assert(result()[1] and not farm.Press,'a target dying after activation must not turn a completed swing into a cancelled worker')
return 'Mob native input: paired activation/release, cooldown, Stop during hold, old/new owners, failed activation/hold/release and target-death completion passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'mob-input',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
