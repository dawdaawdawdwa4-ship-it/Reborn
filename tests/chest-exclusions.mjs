import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const targets=main.slice(main.indexOf('-- CHEST TARGETS BEGIN'),main.indexOf('-- CHEST TARGETS END'));
const controls=main.slice(main.indexOf('-- CHEST EXCLUSION UI LOGIC BEGIN'),main.indexOf('-- CHEST EXCLUSION UI LOGIC END'));
const request=main.slice(main.indexOf('function RemoteCatalog.ChestRequestReady('),main.indexOf('function RemoteCatalog.ChestResultText('));
const manual=main.slice(main.indexOf('function RemoteCatalog.WithdrawSelectedCarrots('),main.indexOf('-- CHEST PROFILES BEGIN'));
const auto=main.slice(main.indexOf('-- CHEST AUTO BEGIN'),main.indexOf('-- CHEST AUTO END'));
const code=`
local gui={Parent=true}
local COLORS={text=1,muted=2,on=3,panel=4,off=5}
local function pos(x) return setmetatable({X=x,Y=0,Z=0},{__sub=function(a,b) return {Magnitude=math.abs(a.X-b.X)} end}) end
local island={}
local blocks={Parent=island}
local a={Name='chestSmall',Parent=blocks,Position=pos(2)}
local b={Name='chestSmall',Parent=blocks,Position=pos(4)}
local io1={Name='chestMediumIndustrialIO',Parent=blocks,Position=pos(6)}
local io2={Name=io1.Name,Parent=blocks,Position=pos(8)}
blocks.GetChildren=function() return {a,b,io1,io2} end
island.FindFirstChild=function() return blocks end
local function getPlayerIsland() return island end
local function getPartPosition(chest) return chest.Position end
local player={Character={FindFirstChild=function() return {Position=pos(0)} end}}
local owner,learned,calls,worker,onWait
local quantity=0
local task={spawn=function(fn) worker=coroutine.create(fn);local ok,e=coroutine.resume(worker);assert(ok,e) end,wait=function() if onWait then onWait() end;coroutine.yield() end}
local RemoteCatalog={ChestExclusionButton={},ChestExclusionSummary={},ChestAutoButton={},ChestResultLabel={},Navigation={Stop=function() end},ChestDiscover=false,ChestWhole=false,ChestScanRange=120,ChestAutoBatch=30,ChestGoal=30}
RemoteCatalog.CloseMenus=function() end
RemoteCatalog.UpdateChestSelectionUI=function() RemoteCatalog.RefreshChestExclusions() end
RemoteCatalog.PreviewChestSelection=function() end
RemoteCatalog.OwnedTools=function() return {{Name='potatoSalad'}} end
RemoteCatalog.BaitCount=function() return quantity end
RemoteCatalog.ApproachChest=function() return true end
RemoteCatalog.ChestResultText=function(value) return tostring(value) end
owner={CanUseChestBinding=function(_,binding) return binding.Chest.Parent~=nil end,GetChestBindings=function() return learned end}
function owner:MakeChestTarget(binding,chest,slot)
 if chest.Name~=io1.Name then return nil end
 return {Chest=chest,Slot=slot,Amount=binding.Amount,Item=binding.Item,Probe=true}
end
owner.WithdrawItems=function(_,amount,binding) table.insert(calls,{Chest=binding.Chest,Amount=amount});quantity+=amount;return true end
RemoteCatalog.Recorder=owner
local ba={Chest=a,Slot=1,Amount=30,Item='potatoSalad'}
local ba2={Chest=a,Slot=2,Amount=30,Item='wood'}
local bb={Chest=b,Slot=1,Amount=30,Item='potatoSalad'}
learned={ba,ba2,bb};calls={}
${targets}
${controls}
${request}
${auto}
${manual}
local function drain()
 for _=1,300 do if not worker or coroutine.status(worker)=='dead' then return end;local ok,e=coroutine.resume(worker);assert(ok,e) end
 error('worker did not settle')
end
RemoteCatalog.RefreshChestExclusions()
assert(not RemoteCatalog.ChestExclusionButton.Active and not RemoteCatalog.SetChestExcluded(nil,true),'all-chest selection must never exclude every target accidentally')
RemoteCatalog.ChestSelection={Chest=a,Slot=1}
assert(RemoteCatalog.SetChestExcluded(a,true) and #calls==0)
assert(RemoteCatalog.ChestIsExcluded(ba) and RemoteCatalog.ChestIsExcluded(ba2) and not RemoteCatalog.ChestIsExcluded(bb),'one exact physical chest must exclude all its slots/items without affecting equal-named neighbors')
assert(#RemoteCatalog.ChestTargets()==3 and #RemoteCatalog.SelectedChestTargets()==0 and #RemoteCatalog.SelectedChestTargets(true)==1,'excluded targets must stay available for read-only choice/preview but disappear from dispatch selection')
assert(RemoteCatalog.ChestExclusionButton.Text=='Allow selected chest' and string.find(RemoteCatalog.ChestExclusionSummary.Text,'1 excluded chests',1,true),'selected exclusion must be visible and reversible')
RemoteCatalog.ChestSelection=nil
assert(#RemoteCatalog.SelectedChestTargets()==1 and RemoteCatalog.SelectedChestTargets()[1].Binding==bb)
RemoteCatalog.ChestIncludeConveyor=true
assert(not RemoteCatalog.ChestRequestReady(ba),'Conveyor Include must never override a physical exclusion')
local sent,reason,origin=RemoteCatalog.WithdrawCarrots(30,owner,ba)
assert(not sent and origin=='blocked' and #calls==0 and string.find(reason,'explicitly excluded',1,true),'the final wrapper must block direct stale packets before replay')
assert(#RemoteCatalog.ChestAutoStates({{Recorder=owner,Binding=ba},{Recorder=owner,Binding=bb}},30,false)==1,'auto queue construction must independently exclude a stale protected target')
for _,field in ipairs({'ChestAutoEnabled','ChestAutoWorker','ChestBusy','ChestManualRunning'}) do
 RemoteCatalog[field]=true
 assert(not RemoteCatalog.SetChestExcluded(a,false) and RemoteCatalog.ChestIsExcluded(ba),'active/paused/cleanup/manual work must lock exclusion edits')
 RemoteCatalog[field]=nil
end
assert(RemoteCatalog.SetChestExcluded(a,false) and not RemoteCatalog.ChestIsExcluded(ba) and #calls==0,'allowing a chest again must remain read-only')
learned={{Chest=io1,Slot=3,Amount=30,Item='potatoSalad'}}
RemoteCatalog.ChestDiscover=true;RemoteCatalog.ChestWhole=true;RemoteCatalog.ChestSelection={Chest=io2,Slot=3}
assert(#RemoteCatalog.SelectedChestTargets()==13 and RemoteCatalog.SetChestExcluded(io2,true),'discovered matching chests must be selectable for exclusion')
assert(#RemoteCatalog.SelectedChestTargets()==0 and #RemoteCatalog.SelectedChestTargets(true)==13,'whole-chest probing must exclude every generated slot of a protected instance')
RemoteCatalog.ChestSelection=nil
assert(#RemoteCatalog.SelectedChestTargets()==13 and RemoteCatalog.SelectedChestTargets()[1].Binding.Chest==io1,'excluding a discovered chest must leave the template chest available')
assert(RemoteCatalog.SetChestExcluded(io1,true));assert(RemoteCatalog.SetChestExcluded(io1,false))
RemoteCatalog.ChestIncludeConveyor=false
assert(RemoteCatalog.ChestTargetProtected({Chest=io1}) and not RemoteCatalog.ChestIsExcluded({Chest=io1}),'allowing a chest must retain independent Conveyor Skip')
RemoteCatalog.ChestDiscover=false;RemoteCatalog.ChestWhole=false;RemoteCatalog.ChestIncludeConveyor=true;RemoteCatalog.ChestSelection=nil;learned={bb}
RemoteCatalog.ApproachChest=function() task.wait();RemoteCatalog.ChestExcludedChests[b]=true;return true end
calls={};assert(RemoteCatalog.SetChestAuto(true));drain()
assert(#calls==0 and RemoteCatalog.ChestAutoTotal==0,'a protection appearing after the worker snapshot/approach must be caught by the final pre-request guard')
RemoteCatalog.ChestExcludedChests[b]=nil;RemoteCatalog.ApproachChest=function() return true end
learned={ba,{Chest=a,Slot=3,Amount=30,Item='potatoSalad'}};calls={};quantity=0
onWait=function() RemoteCatalog.ChestExcludedChests[a]=true end
local manualResult
task.spawn(function() manualResult=table.pack(RemoteCatalog.WithdrawSelectedCarrots()) end);drain();onWait=nil
assert(#calls==1 and calls[1].Chest==a and not manualResult[1],'a cached manual readiness result must not bypass an exclusion added between slots')
local replacement={Name=a.Name,Parent=blocks,Position=a.Position}
assert(not RemoteCatalog.ChestIsExcluded({Chest=replacement}),'same-name/same-position replacements must not inherit another instance identity')
local otherIsland={};local foreign={Name=a.Name,Parent=otherIsland,Position=pos(1)}
learned={{Chest=foreign,Slot=1,Amount=30}}
assert(not RemoteCatalog.SetChestExcluded(foreign,true) and not RemoteCatalog.ChestIsExcluded({Chest=foreign}),'exclusion edits must validate island ownership')
gui.Parent=nil;learned={bb}
assert(not RemoteCatalog.SetChestExcluded(b,true),'destroyed UI must not mutate protection')
return 'Chest exclusions: exact identity, all slots/items, discovered/whole checks, final manual/auto guards, lock states, undo, independent conveyor protection, replacements and cleanup passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'chest-exclusions',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
