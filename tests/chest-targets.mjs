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
for index=1,13 do assert(nearest[index].Binding.Slot==index-1,'equal-distance slots must retain their original order') end
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
RemoteCatalog.ChestItem='unobservedItem'
assert(#RemoteCatalog.SelectedChestTargets()==0,'unlearned items must not produce fabricated requests')
RemoteCatalog.ChestItem=nil
valid=false
assert(#RemoteCatalog.ChestTargets()==0 and #RemoteCatalog.SelectedChestTargets()==0,'invalid session must prevent discovery and replay target generation')
return 'Chest targets: matching owned discovery, range/type filtering, complete slot coverage, deduplication, individual/scope controls and expired-session guards passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'chest-targets',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
