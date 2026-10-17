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
local bait={Name='bait'}
function bait:Activate() activated+=1;if failActivate then error('activation blocked') end end
local character={FindFirstChildOfClass=function() return current end}
current=rod;rod.Parent=character
local player={Character=character}
local RemoteCatalog={EquipTool=function(tool) current=tool;tool.Parent=character;return true end}
local task={wait=function() if stop then baitEnabled=false end end}
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
local other={Name='manualSelection'}
task.wait=function() if current==bait then current=other end end
assert(not RemoteCatalog.ActivateBait(bait) and current==other,'manual tool choice must not be overwritten')
return 'Bait tool fallback: activation, rod restoration, input serialization, Stop and error cleanup passed'
`;
const state=await LuauState.createAsync();try{console.log(await state.loadstring(code,'bait-tool',true)());}finally{state.destroy();}
