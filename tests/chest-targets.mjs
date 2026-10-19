import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const source=main.slice(main.indexOf('-- CHEST TARGETS BEGIN'),main.indexOf('-- CHEST TARGETS END'));
const code=`
local function pos(x) return setmetatable({X=x},{__sub=function(a,b) return {Magnitude=math.abs(a.X-b.X)} end}) end
local a={Name='chestMediumIndustrialIO',Position=pos(3)}
local b={Name='chestMediumIndustrialIO',Position=pos(8)}
local far={Name='chestMediumIndustrialIO',Position=pos(300)}
local unrelated={Name='chestSmall',Position=pos(6)}
local blocks={GetChildren=function() return {a,b,far,unrelated} end}
local island={FindFirstChild=function(_,name) return name=='Blocks' and blocks end}
local function getPlayerIsland() return island end
local function getPartPosition(chest) return chest.Position end
local rootX=0
local player={Character={FindFirstChild=function() return {Position=pos(rootX)} end}}
local template={Chest=a,Slot=1,Amount=30,ObservedAt=1,Item="carrotHarvested"}
local learned={template}
local valid=true
local recorder={GetChestBindings=function() return learned end,CanUseChestBinding=function() return valid end}
function recorder:MakeChestTarget(binding,chest,slot)
 if not valid or chest.Name~='chestMediumIndustrialIO' or slot<0 or slot>12 then return end
 return {Chest=chest,Slot=slot,Amount=binding.Amount,Item=binding.Item,Generated=true,ObservedAt=binding.ObservedAt}
end
local RemoteCatalog={Recorder=recorder,ChestDiscover=true,ChestWhole=true,ChestScanRange=120}
${source}
local candidates=RemoteCatalog.ChestTargets()
assert(#candidates==2 and candidates[1].Binding.Chest==a and candidates[2].Binding.Chest==b,'one learned request must discover nearby matching owned chests')
local targets=RemoteCatalog.SelectedChestTargets()
assert(#targets==26,'whole-chest mode must cover both slot-index boundaries in two matching chests')
local seen={}
for _,target in ipairs(targets) do
 local binding=target.Binding
 assert(binding.Chest==a or binding.Chest==b,'must not target far or unmatched containers')
 assert(binding.Probe and binding.Generated,'unobserved slots must begin as unconfirmed probes')
 seen[binding.Chest]=seen[binding.Chest] or {}
 assert(not seen[binding.Chest][binding.Slot],'slots must not be duplicated')
 seen[binding.Chest][binding.Slot]=true
end
for slot=0,12 do assert(seen[a][slot] and seen[b][slot],'missing slot boundary') end
assert(template.Slot==1 and not template.Generated,'discovery must not modify the recorded template')
RemoteCatalog.ChestSelection={Chest=b,Slot=1}
assert(#RemoteCatalog.SelectedChestTargets()==13,'individual chest choice must restrict whole-chest collection')
RemoteCatalog.ChestSelection=nil;RemoteCatalog.ChestDiscover=false
assert(#RemoteCatalog.ChestTargets()==1 and #RemoteCatalog.SelectedChestTargets()==13,'learned-only scope must exclude discovered chests')
RemoteCatalog.ChestWhole=false
assert(#RemoteCatalog.SelectedChestTargets()==1 and RemoteCatalog.SelectedChestTargets()[1].Binding==template,'learned-slot mode must preserve the exact captured slot')
RemoteCatalog.ChestDiscover=true;RemoteCatalog.ChestWhole=true;RemoteCatalog.ChestTravel='Walk';rootX=10
local nearest=RemoteCatalog.SelectedChestTargets()
assert(nearest[1].Binding.Chest==b and nearest[14].Binding.Chest==a,'Walk must list nearer physical chests first')
local slotOrder={1,0,2,3,4,5,6,7,8,9,10,11,12}
for index=1,13 do assert(nearest[index].Binding.Slot==slotOrder[index],'check the learned slot first, then every remaining slot exactly once') end
local wood={Chest=a,Slot=2,Amount=5,ObservedAt=2,Item='wood'}
learned={template,wood};RemoteCatalog.ChestTravel='Stay'
local mixed=RemoteCatalog.SelectedChestTargets()
assert(#mixed==52,'whole mode must retain each learned item across both physical chests')
local perItem={}
for _,entry in ipairs(mixed) do perItem[entry.Binding.Item]=(perItem[entry.Binding.Item] or 0)+1 end
assert(perItem.wood==26 and perItem.carrotHarvested==26,'item templates must not suppress each other during discovery')
RemoteCatalog.ChestItem='wood'
local filtered=RemoteCatalog.SelectedChestTargets()
assert(#filtered==26,'individual item filter must select only that item across chests')
for _,entry in ipairs(filtered) do assert(entry.Binding.Item=='wood','item filter leaked another item') end
RemoteCatalog.ChestWhole=false
assert(#RemoteCatalog.SelectedChestTargets()==2,'captured-slot mode must retain wood only, including discovered wood template')
RemoteCatalog.ChestItem=nil;RemoteCatalog.ChestItems={wood=true,carrotHarvested=true}
assert(#RemoteCatalog.SelectedChestTargets()==4,'multiple selected items must both remain available in captured-slot mode')
RemoteCatalog.ChestItems={wood=true}
assert(#RemoteCatalog.SelectedChestTargets()==2,'multi-select must filter independently by item identifier')
RemoteCatalog.ChestItems={}
assert(#RemoteCatalog.SelectedChestTargets()==0,'empty checklist must not revert to all items')
RemoteCatalog.ChestItems=nil
RemoteCatalog.ChestItem='unobservedItem'
assert(#RemoteCatalog.SelectedChestTargets()==0,'unlearned items must not produce fabricated requests')
RemoteCatalog.ChestItem=nil
-- Whole chest must not pin its packet to the first observed salad slot.
local oldSalad={Chest=a,Slot=8,Amount=17,ObservedAt=3,Item='potatoSalad'}
local newSalad={Chest=a,Slot=3,Amount=9,ObservedAt=4,Item='potatoSalad'}
learned={oldSalad,newSalad};RemoteCatalog.ChestDiscover=true;RemoteCatalog.ChestWhole=true
local salads=RemoteCatalog.SelectedChestTargets()
assert(#salads==26 and salads[1].Binding.Slot==3 and salads[14].Binding.Slot==3,'salad must check its newest learned slot first and still cover every slot')
for _,entry in ipairs(salads) do
 assert(entry.Binding.Item=='potatoSalad' and entry.Binding.ObservedAt==4 and entry.Binding.Amount==9,'whole-chest discovery and slot checks must use the latest learned packet/maximum for that item')
end
assert(oldSalad.Slot==8 and newSalad.Slot==3,'whole chest must preserve both manual samples')
RemoteCatalog.ChestWhole=false;RemoteCatalog.ChestDiscover=false
local exact=RemoteCatalog.SelectedChestTargets()
assert(#exact==2 and exact[1].Binding==oldSalad and exact[2].Binding==newSalad,'learned-slot mode must preserve distinct observed slots instead of guessing that a stack moved')
valid=false
assert(#RemoteCatalog.ChestTargets()==0 and #RemoteCatalog.SelectedChestTargets()==0,'invalid session must prevent discovery and replay target generation')
return 'Chest targets: matching owned discovery, range/type filtering, complete slot coverage, deduplication, individual/scope controls and expired-session guards passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'chest-targets',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
