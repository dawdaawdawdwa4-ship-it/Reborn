import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const source=main.slice(main.indexOf('-- BAIT TOOL INPUT BEGIN'),main.indexOf('-- BAIT TOOL INPUT END'));
const code=`
local baitBusy,fishingInputBusy=false,false
local baitEnabled,baitCycleId=true,1
local gui={Parent=true}
local current,activated,failActivate,stop,changed=nil,0,false,false,false
local rod={Name='fishingRod'}
local quantity,consumeAfter=48,nil
local bait={Name='bait',GetAttributes=function() return {Amount=quantity} end}
function bait:Activate() activated+=1;if failActivate then error('activation blocked') end;consumeAfter=.5 end
local character={FindFirstChildOfClass=function() return current end}
current=rod;rod.Parent=character
local player={Character=character}
local RemoteCatalog={EquipTool=function(tool) current=tool;tool.Parent=character;return true end}
local task={wait=function(dt) if stop then baitEnabled=false end;if consumeAfter then consumeAfter-=dt;if consumeAfter<=0 then quantity-=1;consumeAfter=nil end end end}
${source}
assert(RemoteCatalog.ActivateBait(bait))
assert(activated==1 and current==rod and not baitBusy,'bait activation must restore the rod')
fishingInputBusy=true
assert(not RemoteCatalog.ActivateBait(bait) and activated==1,'must wait for an active rod press')
fishingInputBusy=false;stop=true
assert(not RemoteCatalog.ActivateBait(bait) and activated==1 and current==rod and not baitBusy,'Stop during equip must not consume bait')
stop=false;baitEnabled=true;failActivate=true
assert(not RemoteCatalog.ActivateBait(bait) and current==rod and not baitBusy,'activation error must restore rod and unlock fishing')
failActivate=false
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

RemoteCatalog.BobberActive=function() return true end
assert(not RemoteCatalog.WithBaitTool(bait,function() error('must not run during a cast') end) and current==rod,'bait must wait for current bobber')
RemoteCatalog.BobberActive=nil
local other={Name='manualSelection'}
task.wait=function() if current==bait then current=other end end
assert(not RemoteCatalog.ActivateBait(bait) and current==other,'manual tool choice must not be overwritten')
return 'Bait tool fallback: activation, rod restoration, input serialization, Stop and error cleanup passed'
`;
const state=await LuauState.createAsync();try{console.log(await state.loadstring(code,'bait-tool',true)());}finally{state.destroy();}
