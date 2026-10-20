import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const tracker=main.slice(main.indexOf('-- PROPELLER TRACKER BEGIN'),main.indexOf('-- PROPELLER TRACKER END'));
const code=`
local enabled=true
local gui={Parent=true}
local player={Character={}}
local overlayValues={propellers={},propellerLast={}}
local quantity,attached=10,true
local tool={Name='propeller',Parent={}}
local RemoteCatalog={PropellerLabel={},PropellerInfo={}}
RemoteCatalog.OwnedTools=function() return attached and {tool} or {} end
RemoteCatalog.BaitCount=function() return quantity end
${tracker}
local now=100
RemoteCatalog.PropellerNow=function() return now end
RemoteCatalog.RefreshPropellers()
assert(string.find(RemoteCatalog.PropellerInfo.Text,'Waiting for next reel',1,true),'idle fishing must explain that no catch window is active')
RemoteCatalog.BeginPropellerCatch(3);quantity=11
RemoteCatalog.RefreshPropellers()
assert(string.find(RemoteCatalog.PropellerInfo.Text,'Waiting for catch confirmation',1,true),'unconfirmed reels must not claim confirmed tracking')
RemoteCatalog.PollPropellers();assert(RemoteCatalog.PropellerTotal==0,'unconfirmed reel cannot attribute inventory gain')
RemoteCatalog.ConfirmPropellerCatch()
assert(RemoteCatalog.PropellerTotal==1 and RemoteCatalog.PropellerLastAt==100,'confirmed fishing window must count only gain over existing stock')
local report=RemoteCatalog.PropellerReport()
assert(string.find(report,'Propellers this session: 1',1,true) and string.find(report,'Catch window: confirmed',1,true) and string.find(report,'Window baseline: 11',1,true) and string.find(report,'Window remaining: 5s',1,true),'tracker report must expose the actual attribution state and inventory baseline')
for _=1,4 do RemoteCatalog.PollPropellers() end
assert(RemoteCatalog.PropellerTotal==1,'same stack must not count repeatedly')
now=102;quantity=13;RemoteCatalog.RefreshPropellers()
assert(RemoteCatalog.PropellerTotal==3 and overlayValues.propellers.Text=='3' and RemoteCatalog.PropellerLastAt==102,'stack increases must count actual quantity and update the overlay')
quantity=0;RemoteCatalog.PollPropellers();quantity=13;RemoteCatalog.PollPropellers()
assert(RemoteCatalog.PropellerTotal==3,'temporary inventory removal/reappearance cannot count old stock')
now=177;RemoteCatalog.RefreshPropellers();assert(RemoteCatalog.PropellerLastText()=='00:01:15 ago','time since last propeller must keep advancing after the catch window expires')
enabled=false;quantity=14;RemoteCatalog.RefreshPropellers();assert(RemoteCatalog.PropellerTotal==3,'Fishing OFF must not count inventory changes')
enabled=true;quantity=14;RemoteCatalog.BeginPropellerCatch(3);RemoteCatalog.ConfirmPropellerCatch();assert(RemoteCatalog.PropellerTotal==3,'new catch baseline must include existing inventory')
quantity=nil;RemoteCatalog.PollPropellers();quantity=15;now=178;RemoteCatalog.PollPropellers()
assert(RemoteCatalog.PropellerTotal==4,'delayed quantity metadata may settle inside the confirmed window')
RemoteCatalog.ResetPropellers();assert(RemoteCatalog.PropellerTotal==0 and RemoteCatalog.PropellerLastText()=='none yet' and not RemoteCatalog.PropellerWindow)
quantity=5;RemoteCatalog.BeginPropellerCatch(3);RemoteCatalog.ChestBusy=true;quantity=6;RemoteCatalog.ConfirmPropellerCatch();RemoteCatalog.ChestBusy=false;RemoteCatalog.PollPropellers()
assert(RemoteCatalog.PropellerTotal==0,'chest withdrawal overlap must invalidate the whole catch window')
RemoteCatalog.RefreshPropellers()
assert(string.find(RemoteCatalog.PropellerInfo.Text,'Catch excluded: inventory automation overlapped',1,true) and string.find(RemoteCatalog.PropellerReport(),'Window blocked: true',1,true),'a blocked window must stay visibly excluded after the conflicting worker finishes')
RemoteCatalog.BeginPropellerCatch(3);RemoteCatalog.CraftWorker=1;quantity=7;RemoteCatalog.ConfirmPropellerCatch();RemoteCatalog.CraftWorker=nil;RemoteCatalog.PollPropellers()
assert(RemoteCatalog.PropellerTotal==0,'crafting overlap must not be counted as fishing')
RemoteCatalog.BeginPropellerCatch(3);player.Character={};quantity=8;RemoteCatalog.ConfirmPropellerCatch();assert(RemoteCatalog.PropellerTotal==0,'respawn inventory replication must not count')
RemoteCatalog.BeginPropellerCatch(3);now+=10;quantity=9;RemoteCatalog.PollPropellers();RemoteCatalog.ConfirmPropellerCatch();assert(RemoteCatalog.PropellerTotal==0,'an expired unconfirmed reel cannot count later inventory')
quantity=nil;RemoteCatalog.BeginPropellerCatch(3);quantity=10;RemoteCatalog.ConfirmPropellerCatch();assert(RemoteCatalog.PropellerTotal==0,'unreadable starting quantities cannot establish a fake baseline')
RemoteCatalog.RefreshPropellers()
assert(string.find(RemoteCatalog.PropellerInfo.Text,'starting quantity unreadable',1,true),'a missing baseline must remain explicit even when the current quantity becomes readable')
quantity=nil;RemoteCatalog.PropellerWindow=nil;RemoteCatalog.RefreshPropellers()
assert(string.find(RemoteCatalog.PropellerInfo.Text,'Waiting for readable inventory quantity',1,true),'unreadable live inventory must not be displayed as active tracking')
enabled=false;RemoteCatalog.RefreshPropellers()
assert(string.find(RemoteCatalog.PropellerReport(),'Fishing OFF; session count kept',1,true),'diagnostics must include the disabled state without clearing session totals')
enabled=true;RemoteCatalog.CraftWorker=1;RemoteCatalog.RefreshPropellers()
assert(string.find(RemoteCatalog.PropellerInfo.Text,'Paused: chest collection or crafting active',1,true),'inventory automation must explain why attribution is paused')
RemoteCatalog.CraftWorker=nil
for _,bad in ipairs({-1,1.5,math.huge,0/0,'4'}) do quantity=bad;assert(RemoteCatalog.PropellerCount()==nil,'malformed quantities must never count') end
quantity=10;tool.Parent=nil;assert(RemoteCatalog.PropellerCount()==nil,'detached cached tools must wait for inventory to settle')
tool.Parent={};tool.Name='propellor';assert(RemoteCatalog.PropellerCount()==10,'the user spelling must map to the propeller tracker')
tool.Name='fishingRod';assert(RemoteCatalog.PropellerCount()==0,'unrelated tools must not count')
return 'Propellers: existing/stacked stock, delayed metadata, timer, double-count prevention, OFF, reset, inventory conflicts, respawn, expired reels and invalid quantities passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'propeller-tracker',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
