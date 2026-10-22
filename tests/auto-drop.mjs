import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const source=main.slice(main.indexOf('-- AUTO DROP BEGIN'),main.indexOf('-- AUTO DROP END'));
const code=`
local gui={Parent=true}
local COLORS={on=1,off=2}
local Enum={KeyCode={Q='Q'}}
local game={}
local focused,focusError=false,false
local UserInputService={GetFocusedTextBox=function() if focusError then error('unavailable') end;return focused end}
local humanoid={Health=100}
local character={Parent=true,FindFirstChildOfClass=function() return humanoid end,FindFirstChild=function() return {} end}
local player={Character=character}
local RemoteCatalog={DropButton={},DropInfo={}}
local events,workers,waits={},{},{}
local failDown,failUp,explicitFalse=false,false,false
local VirtualInputManager={SendKeyEvent=function(_,down,key,repeated,target)
 assert(key=='Q' and not repeated and target==game,'input must use Q')
 table.insert(events,down and 'down' or 'up')
 if down and failDown or not down and failUp then error('input blocked') end
 if explicitFalse then return false end
end}
local keypress,keyrelease
local task={wait=function(duration) table.insert(waits,duration);coroutine.yield() end,
 spawn=function(fn) local co=coroutine.create(fn);table.insert(workers,co);local ok,err=coroutine.resume(co);assert(ok,err) end}
local function step()
 for _,co in ipairs(table.clone(workers)) do if coroutine.status(co)=='suspended' then local ok,err=coroutine.resume(co);assert(ok,err) end end
end
${source}
local function reset()
 RemoteCatalog.SetDropEnabled(false);step();step()
 assert(not RemoteCatalog.DropWorker and not RemoteCatalog.DropHeld,'test cleanup must settle')
 events={};waits={};focused=false;focusError=false;gui.Parent=true;player.Character=character;humanoid.Health=100
 failDown=false;failUp=false;explicitFalse=false;keypress=nil;keyrelease=nil;RemoteCatalog.DropInterval=.15
end
assert(not RemoteCatalog.DropEnabled and not RemoteCatalog.DropWorker and #events==0,'startup must be OFF and send nothing')
assert(RemoteCatalog.SetDropEnabled(true) and events[1]=='down' and #events==1 and waits[1]==.03)
assert(RemoteCatalog.SetDropEnabled(true) and #events==1 and #workers==1,'repeated ON must not duplicate the worker')
step();assert(events[2]=='up' and RemoteCatalog.DropCount==1 and math.abs(waits[2]-.12)<.0001,'a full press must release before waiting the remaining interval')
step();assert(events[3]=='down')
assert(RemoteCatalog.SetDropEnabled(false) and events[4]=='up' and not RemoteCatalog.DropHeld,'OFF must release a held Q immediately')
assert(not RemoteCatalog.SetDropEnabled(true) and #events==4,'rapid restart must wait for the old worker')
step();assert(not RemoteCatalog.DropWorker and events[5]=='up' and #events==5,'cancelled worker may only complete its key release')
assert(RemoteCatalog.SetDropEnabled(true) and events[6]=='down' and RemoteCatalog.DropCount==0,'ON after cleanup starts a fresh run')
reset();focused={};assert(RemoteCatalog.SetDropEnabled(true) and #events==0 and RemoteCatalog.DropEnabled)
step();assert(#events==0 and string.find(RemoteCatalog.DropInfo.Text,'typing',1,true),'typing must keep ON while pausing Q')
focused=false;step();assert(events[1]=='down','clearing text focus must resume')
reset();focusError=true;RemoteCatalog.SetDropEnabled(true);assert(#events==0,'unreadable focus must pause')
focusError=false;step();assert(events[1]=='down')
reset();player.Character=nil;RemoteCatalog.SetDropEnabled(true);assert(#events==0)
player.Character=character;humanoid.Health=0;step();assert(#events==0)
humanoid.Health=100;step();assert(events[1]=='down','respawn readiness must resume')
for _,field in ipairs({'FishingMouseInput','BaitMouseInput','ResourceInputBusy','PlowWorker'}) do
 reset();RemoteCatalog[field]=true;RemoteCatalog.SetDropEnabled(true)
 assert(#events==0 and RemoteCatalog.DropEnabled,'another input owner must pause Q')
 RemoteCatalog[field]=nil;step();assert(events[1]=='down')
end
reset();failDown=true;assert(RemoteCatalog.SetDropEnabled(true))
assert(#events==2 and events[2]=='up' and not RemoteCatalog.DropWorker and not RemoteCatalog.DropEnabled and not RemoteCatalog.DropHeld and RemoteCatalog.DropCount==0,'failed down must release and stop without fallback replay')
failDown=false;reset();failUp=true;RemoteCatalog.SetDropEnabled(true);step()
assert(not RemoteCatalog.DropEnabled and not RemoteCatalog.DropWorker and RemoteCatalog.DropHeld,'failed key release must retain its release context')
assert(not RemoteCatalog.SetDropEnabled(true),'failed key release must prevent restarting')
failUp=false;assert(RemoteCatalog.SetDropEnabled(false) and not RemoteCatalog.DropHeld,'STOP must retry a failed key release')
reset();explicitFalse=true;RemoteCatalog.SetDropEnabled(true)
assert(not RemoteCatalog.DropEnabled and RemoteCatalog.DropHeld,'explicit false input results must be failures')
explicitFalse=false;RemoteCatalog.SetDropEnabled(false)
reset();keypress=function(code) assert(code==0x51);table.insert(events,'host-down') end
keyrelease=function(code) assert(code==0x51);table.insert(events,'host-up') end
RemoteCatalog.SetDropEnabled(true);keyrelease=function() error('release must use the original transport') end
step();assert(events[1]=='host-down' and events[2]=='host-up' and #events==2,'paired host APIs use Q virtual-key code and retain the matching release function')
reset();keypress=function() error('an unpaired keypress API must not be used') end
RemoteCatalog.SetDropEnabled(true);assert(events[1]=='down','partial host support must use VIM instead')
reset();gui.Parent=nil;assert(not RemoteCatalog.SetDropEnabled(true) and #events==0,'removed hub cannot start')
gui.Parent=true;RemoteCatalog.SetDropEnabled(true);gui.Parent=nil;step()
assert(events[2]=='up' and not RemoteCatalog.DropEnabled and not RemoteCatalog.DropWorker and not RemoteCatalog.DropHeld,'GUI removal during a press must release and end the worker')
gui.Parent=true;reset()
for _,interval in ipairs({.1,.15,.25,.5,1}) do
 RemoteCatalog.DropInterval=interval;RemoteCatalog.SetDropEnabled(true);step()
 assert(math.abs(waits[#waits]-(interval-.03))<.0001,'supported intervals include press duration')
 reset()
end
for _,bad in ipairs({0,-1,0/0,math.huge,'0.1',.001}) do
 RemoteCatalog.DropInterval=bad;assert(not RemoteCatalog.SetDropEnabled(true) and #events==0,'unsupported intervals must send nothing')
end
return 'Auto Drop: Q cadence, immediate release, restart ownership, text/character/input pauses, host/VIM support, failures and cleanup passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'auto-drop',true)());} finally {state.destroy();}
