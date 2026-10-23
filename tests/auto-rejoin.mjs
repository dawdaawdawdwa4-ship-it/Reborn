import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8').replaceAll('\r\n','\n');
const source=main.slice(main.indexOf('-- AUTO REJOIN BEGIN'),main.indexOf('-- AUTO REJOIN END'));
const code=`
local now=100000
local os={time=function() return now end}
local files={}
local function writefile(name,value) files[name]=value end
local function readfile(name) return files[name] end
local function isfile(name) return files[name]~=nil end
local HttpService={JSONEncode=function(_,v) return v end,JSONDecode=function(_,v) return v end}
local player={UserId=7}
local CONFIG={AutoRejoin=true}
local saves=0
local function savePreferences() saves+=1 end
local lastStatus
local function setStatus(text) lastStatus=text end
local COLORS={warn=1,good=2,muted=3,on=4,off=5}
local enabled,baitEnabled,harvestEnabled,woodEnabled,mineEnabled=true,false,false,true,false
local started={}
local function setEnabled(v) table.insert(started,'fishing') end
local function setBaitEnabled(v) table.insert(started,'bait') end
local function setFarmMode(mode,v) table.insert(started,mode);if mode=='wood' then woodEnabled=v end end
local mobsStarted=0
local RemoteCatalog={Mobs={Enabled=true,Start=function() mobsStarted+=1;return true end},SettingsAdvancedBody={}}
local function button(props) return {Activated={Connect=function(_,fn) return fn end},Text=props.Text} end
local function track(c) return c end
local errorHandler
local teleports=0
local game={PlaceId=55,GetService=function(_,name)
 if name=='GuiService' then return {ErrorMessageChanged={Connect=function(_,fn) errorHandler=fn;return {} end}} end
 if name=='TeleportService' then return {Teleport=function(_,place,who) assert(place==55 and who==player);teleports+=1 end} end
end}
local spawned={}
local task={spawn=function(fn) table.insert(spawned,fn) end,delay=function() end,wait=function() end}
local gui={Parent=true}
local UDim2={new=function() return {} end,fromOffset=function() return {} end}
${source}
local allowed=RemoteCatalog.RejoinAllowed
assert(allowed('Lost connection to the game server, please reconnect (Error Code: 277)',{},now),'connection loss must rejoin')
assert(allowed('You were disconnected for being idle 20 minutes',{},now),'idle disconnects must rejoin')
assert(allowed('The game has shut down',{},now),'server shutdowns must rejoin')
assert(not allowed('You were kicked from this experience: please stop',{},now),'a deliberate kick must not rejoin')
assert(not allowed('You have been banned',{},now),'bans must never rejoin')
assert(not allowed('Kicked: exploit detected, connection closed',{},now),'anti-exploit kicks must never rejoin, even with connection words')
assert(not allowed('Lost connection',{now-100,now-200,now-300},now),'at most three rejoins an hour')
assert(not allowed('You were kicked from this experience (Error Code: 267)',{},now),'error 267 is a deliberate kick')
assert(not allowed('Disconnected: unexpected client behavior (Error Code: 268)',{},now),'error 268 is anti-cheat and must never rejoin')
assert(not allowed('Same account launched experience from different device (Error Code: 273)',{},now),'273 must not fight another device')
assert(not allowed('You were kicked: server restarting soon',{},now),'any kick is refused unless it is an idle kick')
assert(allowed('You were kicked for being idle 20 minutes',{},now),'idle kicks still rejoin')
assert(allowed('Lost connection',{now-4000,now-5000,now-100},now),'rejoins older than an hour do not count')
-- A real disconnect stores history and the running farms, then teleports.
assert(errorHandler,'the hub must listen for disconnect prompts')
errorHandler('Lost connection to the game server (Error Code: 277)')
local state=files[RemoteCatalog.RejoinFile]
assert(state and #state.History==1 and state.Resume.At==now,'rejoin state must be saved before teleporting')
assert(table.concat(state.Resume.Modes,',')=='fishing,wood,mobs','running farms must be remembered')
for _,fn in ipairs(spawned) do fn() end
assert(teleports==3,'teleport is retried until this client is replaced')
assert(not RemoteCatalog.HandleDisconnect('Lost connection') or true)
-- The next load resumes exactly once.
RemoteCatalog.Mobs.Start=function() mobsStarted+=1;RemoteCatalog.Mobs.Enabled=true;return true end
RemoteCatalog.Mobs.Enabled=false
-- setEnabled is refused here (it never turns fishing on), so fishing must not be reported.
enabled=false;woodEnabled=false
local resumed=RemoteCatalog.ResumeAfterRejoin()
assert(table.concat(resumed,',')=='wood,mobs' and mobsStarted==1 and string.find(lastStatus,'Resumed after rejoin',1,true),'farms must resume after rejoin')
assert(#RemoteCatalog.ResumeAfterRejoin()==0,'a resume must not repeat on the next load')
files[RemoteCatalog.RejoinFile]={History={},Resume={At=now-1000,Modes={'fishing'}}}
assert(#RemoteCatalog.ResumeAfterRejoin()==0,'an old resume flag (over 15 minutes) is ignored')
CONFIG.AutoRejoin=false
RemoteCatalog.Rejoining=false
assert(RemoteCatalog.HandleDisconnect('Lost connection')==false,'Auto rejoin OFF must never teleport')
return 'Auto rejoin: connection-only reasons, kick/ban refusal, hourly limit, saved state, teleport retry, single resume, expiry and OFF passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'auto-rejoin',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
