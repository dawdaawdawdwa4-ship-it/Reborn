import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const source=main.slice(main.indexOf('-- BAIT TOOL INPUT BEGIN'),main.indexOf('-- BAIT TOOL INPUT END'));
const code=`
local baitBusy,fishingInputBusy=false,false
local baitEnabled,baitCycleId=true,1
local gui={Parent=true}
local current,activated,failActivate,stop,changed=nil,0,false,false,false
local deactivated=0
local engineActive=false
local rod={Name='fishingRod'}
local quantity,consumeAfter=48,nil
local bait={Name='bait',GetAttributes=function() return {Amount=quantity} end}
function bait:Activate() activated+=1;if failActivate then error('activation blocked') end;assert(not engineActive,'engine activation must release before reuse');engineActive=true;consumeAfter=.5 end
function bait:Deactivate() deactivated+=1;engineActive=false end
local character={FindFirstChildOfClass=function() return current end}
current=rod;rod.Parent=character
local player={Character=character}
local RemoteCatalog={EquipTool=function(tool) current=tool;tool.Parent=character;return true end}
local task={wait=function(dt) if stop then baitEnabled=false end;if consumeAfter then consumeAfter-=dt;if consumeAfter<=0 then quantity-=1;consumeAfter=nil end end end}
${source}
assert(RemoteCatalog.ActivateBait(bait))
assert(activated==1 and deactivated==1 and not engineActive and current==rod and not baitBusy,'bait activation must release engine input and restore the rod')
fishingInputBusy=true
assert(not RemoteCatalog.ActivateBait(bait) and activated==1,'must wait for an active rod press')
fishingInputBusy=false;stop=true
assert(not RemoteCatalog.ActivateBait(bait) and activated==1 and current==rod and not baitBusy,'Stop during equip must not consume bait')
stop=false;baitEnabled=true;failActivate=true
assert(not RemoteCatalog.ActivateBait(bait) and current==rod and not baitBusy,'activation error must restore rod and unlock fishing')
assert(not engineActive and deactivated==2,'failed engine activation must still release')
failActivate=false
local savedWait=task.wait
local savedActivate=bait.Activate
bait.Activate=function() activated+=1;engineActive=true end
local releaseBefore=deactivated
task.wait=function(dt) if engineActive then baitEnabled=false end end
assert(not RemoteCatalog.ActivateBait(bait) and not engineActive and deactivated==releaseBefore+1 and not baitBusy,'Stop during activation must release engine input')
bait.Activate=savedActivate;task.wait=savedWait;baitEnabled=true
local callbackCalls=0
local beforeActivation=activated
assert(RemoteCatalog.WithBaitTool(bait,function()
 callbackCalls+=1;assert(current==bait and baitBusy,'learned request must run while bait is equipped and input is locked');quantity-=1;return true,'accepted'
end))
assert(callbackCalls==1 and activated==beforeActivation and current==rod and not baitBusy,'learned path must restore rod without a second activation')
assert(not RemoteCatalog.WithBaitTool(bait,function() return false,'denied' end) and current==rod,'rejected request must restore rod')
assert(not RemoteCatalog.WithBaitTool(bait,function() error('network error') end) and current==rod and not baitBusy,'request errors must release the operation')
local oldQuantity=quantity
local confirmed,unconfirmedReason=RemoteCatalog.WithBaitTool(bait,function() return true,'accepted' end)
assert(not confirmed and string.find(unconfirmedReason,'unconfirmed',1,true) and quantity==oldQuantity and current==rod and not baitBusy,'accepted request without consumption must not start the successful timer')
local oldAttributes=bait.GetAttributes
bait.GetAttributes=function() return {} end
assert(not RemoteCatalog.WithBaitTool(bait,function() return true end),'unknown quantity must not be reported as confirmed')
bait.GetAttributes=oldAttributes
assert(RemoteCatalog.BaitCount(bait)==quantity,'quantity must be read from live attributes')
bait.GetAttributes=function() return {Amount='51',Count=1} end
assert(RemoteCatalog.BaitCount(bait)==51,'numeric string Amount must take precedence over generic Count')
bait.GetAttributes=oldAttributes

current=nil
local beforeEmptyHand=quantity
local consumed,detail=RemoteCatalog.WithBaitTool(bait,function()
 assert(current==bait and baitBusy,'empty-hand startup must equip bait before use')
 quantity-=1;return true
end)
assert(consumed and detail=='bait consumption confirmed' and quantity==beforeEmptyHand-1 and not baitBusy,'empty-hand bait use must confirm and release tool control')
current=rod

local normalClick=RemoteCatalog.ClickBaitTool
local mouseAttempts=0
RemoteCatalog.ClickBaitTool=function() mouseAttempts+=1;return true,'host mouse bait click' end
local beforeAlternate=activated
assert(not RemoteCatalog.ActivateBait(bait) and mouseAttempts==1 and activated==beforeAlternate,'a mouse call without consumption must fail without also activating the tool')
RemoteCatalog.BaitTryToolActivation=true
assert(RemoteCatalog.ActivateBait(bait) and mouseAttempts==1 and activated==beforeAlternate+1 and RemoteCatalog.BaitTransport=='Tool:Activate','next retry must be able to use tool activation even when host mouse APIs claim success')
RemoteCatalog.BaitTryToolActivation=false
local signalPress,signalRelease=0,0
bait.Activated={};bait.Deactivated={}
local signalFail=false
firesignal=function(signal)
 if signal==bait.Activated then
  signalPress+=1;if signalFail then error('signal blocked') end;consumeAfter=.5
 elseif signal==bait.Deactivated then signalRelease+=1 end
end
RemoteCatalog.BaitTrySignal=true
assert(RemoteCatalog.ActivateBait(bait) and signalPress==1 and signalRelease==1 and mouseAttempts==1 and activated==beforeAlternate+1,'signal route must activate the game handler without another mouse/Tool activation')
signalFail=true
assert(not RemoteCatalog.ActivateBait(bait) and signalPress==2 and signalRelease==2 and not baitBusy,'failed signal press must still release and unlock input')
signalFail=false;quantity=1;RemoteCatalog.BaitDirectSignalFailed=nil
firesignal=function(signal)
 if signal==bait.Activated then bait.Parent=nil;current=nil end
end
assert(RemoteCatalog.ActivateBait(bait) and current==rod and not baitBusy,'consuming the last bait must confirm tool removal even if its old quantity attribute still says one')
firesignal=nil
local realGetfenv=getfenv
local food,unrelated={},{}
function bait:FindFirstChild(name) if name=='food' then return food end end
quantity=3;consumeAfter=nil
local foodCalls,releases,foreign=0,0,0
local function activatedFood() foodCalls+=1;consumeAfter=.5 end
local function deactivatedFood() releases+=1 end
local function unrelatedCallback() foreign+=1 end
getfenv=function(fn) return {script=fn==unrelatedCallback and unrelated or food} end
getconnections=function(event)
 local function connection(fn,enabled) return {Function=fn,Enabled=enabled,Fire=function(self) self.Function() end} end
 if event==bait.Activated then return {connection(unrelatedCallback,true),connection(activatedFood,false),connection(activatedFood,true)} end
 return {connection(deactivatedFood,true)}
end
RemoteCatalog.BaitTrySignal=nil -- automatic preference, without the manual-learning button
assert(RemoteCatalog.ActivateBait(bait) and foodCalls==1 and releases==1 and foreign==0 and RemoteCatalog.BaitTransport=='Tool.Activated food handler','automatic handler activation must consume bait using only the equipped food script, respecting disabled/foreign callbacks')
firesignal=function() error('host signal blocked') end
RemoteCatalog.BaitDirectSignalFailed=nil
assert(not RemoteCatalog.ActivateBait(bait) and foodCalls==1 and releases==1 and RemoteCatalog.BaitDirectSignalFailed,'blocked direct signals must release the same backend without invoking handlers in the same attempt')
assert(RemoteCatalog.ActivateBait(bait) and foodCalls==2 and releases==2 and RemoteCatalog.BaitTransport=='Tool.Activated food handler','a later signal attempt must reach the food handlers after the direct API fails')
firesignal=nil

-- Mouse-bound food scripts must work even when Tool.Activated is a no-op.
local mouse={Button1Down={},Button1Up={}}
player.GetMouse=function() return mouse end
local mouseFoodCalls,mouseReleases=0,0
local foodFails=false
local function mouseFood() mouseFoodCalls+=1;if foodFails then error('food callback failed') end;consumeAfter=.5 end
local function mouseReleased() mouseReleases+=1 end
getconnections=function(event)
 if event==mouse.Button1Down then return {{Enabled=true,Function=unrelatedCallback},{Enabled=false,Function=mouseFood},{Enabled=true,Function=mouseFood}} end
 if event==mouse.Button1Up then return {{Enabled=true,Function=mouseReleased}} end
 return {}
end
local beforeEngine,beforeMouse,beforeFood=activated,mouseAttempts,foodCalls
RemoteCatalog.BaitTryMouseHandler=nil
quantity=8
assert(RemoteCatalog.ActivateBait(bait) and mouseFoodCalls==1 and mouseReleases==1 and foreign==0,'mouse food route must call only enabled callbacks owned by this food script')
assert(activated==beforeEngine and mouseAttempts==beforeMouse and foodCalls==beforeFood and RemoteCatalog.BaitTransport=='Mouse.Button1Down food handler','mouse handler route must not also fire another input backend')
foodFails=true
assert(not RemoteCatalog.ActivateBait(bait) and mouseReleases==2 and not baitBusy and current==rod,'failed mouse handler must release and restore rod')
foodFails=false
local mouseWait=task.wait
task.wait=function(dt) if consumeAfter then baitEnabled=false end end
assert(not RemoteCatalog.ActivateBait(bait) and mouseReleases==3 and not baitBusy,'Stop during mouse handler input must release and unlock')
task.wait=mouseWait;baitEnabled=true;consumeAfter=nil
player.GetMouse=nil

getconnections=function() return {{Function=unrelatedCallback,Enabled=true}} end
assert(not RemoteCatalog.ActivateBait(bait) and foreign==0,'unrelated event callbacks must never be invoked')
getconnections=nil;getfenv=realGetfenv;RemoteCatalog.BaitTrySignal=false
RemoteCatalog.ClickBaitTool=normalClick

RemoteCatalog.BobberActive=function() return true end
assert(not RemoteCatalog.WithBaitTool(bait,function() error('must not run during a cast') end) and current==rod,'bait must wait for current bobber')
RemoteCatalog.BobberActive=nil
local other={Name='manualSelection'}
task.wait=function() if current==bait then current=other end end
assert(not RemoteCatalog.ActivateBait(bait) and current==other,'manual tool choice must not be overwritten')
return 'Bait tool fallback: activation, rod restoration, input serialization, Stop and error cleanup passed'
`;
const state=await LuauState.createAsync();try{console.log(await state.loadstring(code,'bait-tool',true)());}finally{state.destroy();}
