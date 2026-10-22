import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const core=main.slice(main.indexOf('-- CRAFT BAIT BEGIN'),main.indexOf('-- CRAFT BAIT END'));
const wait=main.slice(main.indexOf('function RemoteCatalog.WaitChestInventory'),main.indexOf('function RemoteCatalog.ChestAutoMessage'));
const code=`
local gui={Parent=true}
local clock=0
local os={clock=function() return clock end}
local game={JobId='server',PlaceId=1}
local COLORS={on=1,off=2,text=3,muted=4}
local RemoteCatalog={CraftToggle={},CraftLearnButton={},CraftInfo={},CloseMenus=function() end}
local island={};local a,b={Parent=island},{Parent=island}
local root={Position=setmetatable({},{__sub=function(_,point) return {Magnitude=point.Distance} end})}
local character={FindFirstChild=function() return root end}
local player={UserId=7,Character=character}
local function getPlayerIsland() return island end
local distances={}
local function getPartPosition(bench) return {Distance=distances[bench] or 0} end
local inventory,reads,inspect,onRead={},{},nil,nil
local requests,writes,printed,copied=0,0,nil,nil
local print=function(value) printed=value end
local setclipboard
local task={spawn=function() error('queue checks must not spawn a worker') end,wait=function() error('queue checks must not wait') end}
local bindings={bait={Item='bait',Workbench=a},food={Item='food',Workbench=b}}
local recorder={CraftBindings=bindings,CanUseCraftBinding=function(_,binding) return not binding.Invalid end,CraftItem=function() requests+=1;error('must not craft') end}
RemoteCatalog.LiveRecorder=function() return recorder end
RemoteCatalog.CarrotCount=function(item)
 reads[item]=(reads[item] or 0)+1
 if onRead then onRead(item) end
 return inventory[item]
end
RemoteCatalog.ChestResultText=tostring
local writefile=function() writes+=1 end
${wait}
${core}
local function job(item,mode) return {Item=item,Mode=mode or 'Make amount',Batch=100,Target=100} end
local function has(text,part) return string.find(text,part,1,true)~=nil end
local function reset()
 gui.Parent=true;player.UserId=7;player.Character=character;clock=0;game.JobId='server';onRead=nil;setclipboard=nil
 RemoteCatalog.CraftWorker=nil;RemoteCatalog.CraftEnabled=false;RemoteCatalog.CraftQueueCheckBusy=false;RemoteCatalog.CraftTransferBusy=false
 RemoteCatalog.CraftPresetBusy=false;RemoteCatalog.CraftCatalogLoading=false;RemoteCatalog.CraftLearning=false;RemoteCatalog.Recorder=nil
 RemoteCatalog.ChestAutoWorker=nil;RemoteCatalog.ChestBusy=false
 RemoteCatalog.CraftQueue={job('bait'),job('food','Top up stock')};RemoteCatalog.CraftQueueCheckResult=nil
 bindings.bait.Invalid=nil;bindings.food.Invalid=nil;a.Parent=island;b.Parent=island;distances={}
 inventory={bait=0,food=0,worm=300,wood=100};reads={}
 RemoteCatalog.CraftMaterials={bait=RemoteCatalog.ReadCraftMaterials({outputAmount=1},{worm=2}),food=RemoteCatalog.ReadCraftMaterials({outputAmount=1},{worm=1,wood=1})}
end
reset();local queue=RemoteCatalog.CraftQueue
local result=RemoteCatalog.CheckCraftQueue(false)
assert(result and result.Summary=='LOCAL CHECKS PASS' and result.Actions==0 and result.Unknown==0 and #result.Jobs==2 and result.Materials.Complete,'reachable learned recipes with sufficient readable stock must pass local checks')
assert(reads.bait==1 and reads.food==1 and reads.worm==1 and reads.wood==1,'output and ingredient reads must share one per-item snapshot')
assert(RemoteCatalog.CraftQueue==queue and not RemoteCatalog.CraftWorker and not RemoteCatalog.CraftEnabled and requests==0 and writes==0 and has(result.Text,'No crafting started'),'checking cannot change the queue, craft or write files')
assert(has(RemoteCatalog.CraftQueueText(),'LOCAL CHECKS PASS') and has(result.Text,'Own learned workbench within 20 studs'))
reset();bindings.food.Invalid=true;result=RemoteCatalog.CheckCraftQueue(false)
assert(result.Summary=='ACTION NEEDED' and not result.Jobs[2].Learned and has(result.Text,'Learn recipes: food') and result.Jobs[1].Learned,'unlearned recipes must be named without hiding other jobs')
reset();distances[b]=45;result=RemoteCatalog.CheckCraftQueue(false)
assert(result.Summary=='ACTION NEEDED' and not result.Jobs[2].Reachable and has(result.Text,'20 studs') and not has(result.Text,'Crafting stays ON'),'out-of-range preflight must not imply crafting was enabled')
reset();b.Parent={};result=RemoteCatalog.CheckCraftQueue(false)
assert(result.Summary=='ACTION NEEDED' and has(result.Text,'own island'),'foreign workbenches must remain actionable')
reset();player.Character=nil;result=RemoteCatalog.CheckCraftQueue(false)
assert(result.Summary=='ACTION NEEDED' and has(result.Text,'Wait for your character'))
reset();RemoteCatalog.ChestAutoWorker=1;result=RemoteCatalog.CheckCraftQueue(false)
assert(result.Summary=='ACTION NEEDED' and has(result.Text,'Finish chest collection'),'existing chest contention must be visible without stopping that worker')
reset();inventory.worm=10;inventory.wood=0;result=RemoteCatalog.CheckCraftQueue(false)
assert(result.Materials.MissingTypes==2 and result.Summary=='ACTION NEEDED' and has(result.Text,'worm ×290') and has(result.Text,'wood ×100'),'material shortages must reflect the whole ordered queue and be named')
reset();inventory.bait=nil;result=RemoteCatalog.CheckCraftQueue(false)
assert(result.Summary=='CHECKS INCOMPLETE' and has(result.Text,'Output quantity unreadable') and reads.bait==1,'missing output quantity must remain unknown and only read once')
reset();inventory.worm=nil;result=RemoteCatalog.CheckCraftQueue(false)
assert(result.Summary=='CHECKS INCOMPLETE' and result.Materials.UnknownTypes==1 and has(result.Text,'missing in order unknown'),'unreadable ingredients cannot claim zero shortage')
reset();RemoteCatalog.CraftMaterials.food=nil;result=RemoteCatalog.CheckCraftQueue(false)
assert(result.Summary=='CHECKS INCOMPLETE' and not result.Materials.Complete and #result.Materials.Jobs==1 and has(result.Text,'later jobs not estimated'),'partial metadata must not pass the full queue')
reset();inventory.bait=100;inventory.food=100;RemoteCatalog.CraftMaterials={};RemoteCatalog.CraftQueue={job('bait','Top up stock'),job('food','Top up stock')}
result=RemoteCatalog.CheckCraftQueue(false)
assert(result.Summary=='LOCAL CHECKS PASS' and #result.Materials.Rows==0,'already-met top-ups need no materials while learned bindings still validate')
reset();RemoteCatalog.CraftQueue={};result=RemoteCatalog.CheckCraftQueue(false)
assert(result.Summary=='ACTION NEEDED' and has(result.Text,'Add finite jobs'))
reset();RemoteCatalog.CraftQueue={job('bait','Continuous')};result=RemoteCatalog.CheckCraftQueue(false)
assert(result.Summary=='ACTION NEEDED' and has(result.Text,'valid finite jobs'),'invalid imported/configured jobs must fail schema checks')
for _,field in ipairs({'CraftWorker','CraftEnabled','CraftPresetBusy','CraftTransferBusy','CraftCatalogLoading','CraftLearning','CraftQueueCheckBusy'}) do
 reset();RemoteCatalog[field]=true
 assert(not RemoteCatalog.CheckCraftQueue(false) and not RemoteCatalog.CraftQueueCheckResult,'busy '..field..' must block inspection without a stale report')
end
reset();RemoteCatalog.Recorder={LearnCraftOnly=true};assert(not RemoteCatalog.CheckCraftQueue(false))
reset();local method=RemoteCatalog.CraftRecorder
RemoteCatalog.CraftRecorder=function() error('inspection failed') end
result=RemoteCatalog.CheckCraftQueue(false);RemoteCatalog.CraftRecorder=method
assert(result.Summary=='CHECKS INCOMPLETE' and not RemoteCatalog.CraftQueueCheckBusy and has(result.Text,'Could not inspect'),'read failures must remain unknown and release the checker')
reset();setclipboard=function(value) copied=value end
result=RemoteCatalog.CheckCraftQueue(true);assert(copied==result.Text and has(RemoteCatalog.CraftInfo.Text,'copied'))
inventory.worm=0;result=RemoteCatalog.CheckCraftQueue(true)
assert(copied==result.Text and result.Summary=='ACTION NEEDED','Copy check must refresh live inventory rather than reuse the old pass')
for _,copier in ipairs({function() return false end,function() error('clipboard failed') end}) do
 setclipboard=copier;printed=nil;result=RemoteCatalog.CheckCraftQueue(true)
 assert(printed==result.Text and has(RemoteCatalog.CraftInfo.Text,'printed to console'),'failed copies must retain an accessible report')
end
reset();result=RemoteCatalog.CheckCraftQueue(false);clock=31;local materialReads=reads.worm
assert(not RemoteCatalog.CraftQueueCheckCurrent(result) and not has(RemoteCatalog.CraftQueueText(),'CRAFT QUEUE CHECK') and reads.worm==materialReads,'expired snapshots must disappear without rescanning inventory')
reset();result=RemoteCatalog.CheckCraftQueue(false);RemoteCatalog.CraftQueue[1].Target=250
assert(not RemoteCatalog.CraftQueueCheckCurrent(result),'same-table descriptor changes must invalidate a snapshot')
reset();result=RemoteCatalog.CheckCraftQueue(false);RemoteCatalog.CraftQueueChanged();assert(not RemoteCatalog.CraftQueueCheckResult)
for index,change in ipairs({
 function() player.Character={} end,
 function() player.UserId=8 end,
 function() game.JobId='other server' end,
 function() RemoteCatalog.CraftGeneration=(RemoteCatalog.CraftGeneration or 0)+1 end,
 function() RemoteCatalog.CraftQueue={job('bait')} end,
 function() RemoteCatalog.CraftQueue[1].Target=250 end,
 function() RemoteCatalog.CraftMaterials={} end,
 function() gui.Parent=nil end,
}) do
 reset();onRead=function() onRead=nil;change() end
 assert(not RemoteCatalog.CheckCraftQueue(false) and not RemoteCatalog.CraftQueueCheckResult and not RemoteCatalog.CraftQueueCheckBusy,'changed context '..index..' while inspecting must discard the old result and release the checker')
end
reset();onRead=function() onRead=nil;RemoteCatalog.CraftWorker=88;RemoteCatalog.CraftEnabled=true;RemoteCatalog.CraftInfo.Text='Crafting newer job' end
assert(not RemoteCatalog.CheckCraftQueue(false) and RemoteCatalog.CraftInfo.Text=='Crafting newer job','a stale check cannot overwrite the status of a newer worker')
reset();result=RemoteCatalog.CheckCraftQueue(false);local oldRoot=root;root={Position=oldRoot.Position}
assert(not RemoteCatalog.CraftQueueCheckCurrent(result),'root replacement within the character must invalidate snapshots');root=oldRoot
assert(requests==0 and writes==0,'no check path may dispatch a craft or write a preset')
return 'Craft queue check: learned recipes, range/ownership, shared inventory snapshot, complete/partial materials, unknowns, busy locks, fresh copy, expiry and stale-context cleanup passed'
`;
const state=await LuauState.createAsync();
try{console.log(await state.loadstring(code,'craft-queue-check',true)());}finally{state.destroy();}
