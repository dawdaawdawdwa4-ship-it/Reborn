import fs from 'node:fs';
import {LuauState} from 'luau-web';
const source=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8').replaceAll('\r\n','\n');
const status=source.slice(source.indexOf('-- FISHING STATUS BEGIN'),source.indexOf('-- FISHING STATUS END'));
const code=`
local time,enabled,cycleId=0,false,0
local os={clock=function() return time end}
local gui={Parent=true}
local fishInfo={}
local COLORS={muted=1,warn=2,bad=3}
local RemoteCatalog={}
local changes,last=0,nil
local function setStatus(text) changes+=1;last=text end
${status}
assert(fishInfo.Text=='Fishing is off.' and changes==0,'initial fishing panel must be OFF without overriding another mode status')
enabled=true;cycleId=1
assert(RemoteCatalog.SetFishingStatus(1,'Waiting for fish...') and fishInfo.Text=='Waiting for fish...' and changes==1)
time=65;RemoteCatalog.RefreshFishingStatus()
assert(fishInfo.Text=='[1m05s] Waiting for fish...','waiting age must use the existing status timestamp')
local at=RemoteCatalog.FishingStatus.At
RemoteCatalog.SetFishingStatus(1,'Waiting for fish...',COLORS.warn)
assert(RemoteCatalog.FishingStatus.At==at and fishInfo.TextColor3==COLORS.warn,'repeated waits cannot reset their age')
RemoteCatalog.SetFishingStatus(1,'Tug! Reeling in...')
assert(fishInfo.Text=='Tug! Reeling in...' and RemoteCatalog.FishingStatus.At==65,'a new step must reset its elapsed time')
time=70;RemoteCatalog.RefreshFishingStatus()
assert(fishInfo.Text=='[5s] Tug! Reeling in...')
local before=changes
cycleId=2;enabled=false
assert(not RemoteCatalog.SetFishingStatus(1,'stale success') and changes==before,'a stopped worker must not overwrite current status')
RemoteCatalog.SetFishingStatus(2,'Fishing is off.',COLORS.muted,true)
assert(fishInfo.Text=='Fishing is off.' and changes==before,'manual OFF must update only its own panel when quiet')
RemoteCatalog.SetFishingStatus(2,'Fishing stopped: failure',COLORS.bad)
assert(fishInfo.TextColor3==COLORS.bad and fishInfo.Text=='Fishing stopped: failure','errors must remain visible while OFF')
cycleId=3;enabled=true
RemoteCatalog.SetFishingStatus(3,'Restarting')
assert(not RemoteCatalog.SetFishingStatus(2,'old failure') and fishInfo.Text=='Restarting','an old run cannot change a restarted panel')
RemoteCatalog.SetFishingStatus(3,'line one'..string.char(10)..string.rep('x',700))
assert(#RemoteCatalog.FishingStatus.Text==512 and not RemoteCatalog.FishingStatus.Text:find('[%c]'),'status strings must be bounded and plain')
local text=fishInfo.Text;before=changes;gui.Parent=nil
assert(not RemoteCatalog.SetFishingStatus(3,'removed') and changes==before)
RemoteCatalog.RefreshFishingStatus();assert(fishInfo.Text==text,'a destroyed GUI cannot receive status updates')
return 'Fishing status: elapsed waits, repeated phases, Stop/restart token guards, quiet OFF, errors, bounded text and destroyed UI passed'
`;
const state=await LuauState.createAsync();
try{console.log(await state.loadstring(code,'fishing-status',true)());}finally{state.destroy();}
