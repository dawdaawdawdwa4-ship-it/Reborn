import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const source=main.slice(main.indexOf('-- CHEST AUTO BEGIN'),main.indexOf('-- CHEST AUTO END'));
const conveyor=main.slice(main.indexOf('-- CHEST CONVEYOR GUARD BEGIN'),main.indexOf('-- CHEST CONVEYOR GUARD END'));
const quantityAdapter=main.slice(main.indexOf('RemoteCatalog.BaitCount=function(tool)'),main.indexOf('RemoteCatalog.WithBaitTool = function'));
const code=`
local gui={Parent=true}
local COLORS={on=1,off=2}
local RemoteCatalog={ChestAutoButton={},ChestResultLabel={},Navigation={Stop=function(owner) assert(owner=="Chest") end}}
local worker
local waits={}
local task={spawn=function(fn) worker=coroutine.create(fn);local ok,err=coroutine.resume(worker);assert(ok,err) end,wait=function(dt) table.insert(waits,dt);coroutine.yield(dt) end}
local inventory,chest,calls,readable=0,75,{},true
local valid,reached=true,true
local binding={Amount=30}
local recorder={ChestBinding=binding,CanUseChestBinding=function() return valid end}
RemoteCatalog.LiveRecorder=function() return recorder end
RemoteCatalog.SelectedChestTargets=function() return {{Recorder=recorder,Binding=binding}} end
RemoteCatalog.OwnedTools=function() return {{Name='carrotHarvested'},{Name='carrotSeeds'},{Name='bait'}} end
RemoteCatalog.BaitCount=function() return readable and inventory or nil end
RemoteCatalog.ChestResultText=function(v) return type(v)=='table' and v.reason or tostring(v) end
RemoteCatalog.ApproachChest=function() return reached,'out of range' end
local function request(amount)
 table.insert(calls,amount)
 if amount>chest then return false,{reason='insufficient items'} end
 chest-=amount;inventory+=amount;return true
end
RemoteCatalog.WithdrawCarrots=request
${conveyor}
${source}
local function drain()
 for i=1,500 do
  if not worker or coroutine.status(worker)=='dead' then return end
  local ok,err=coroutine.resume(worker);assert(ok,err)
 end
 error('worker failed to settle')
end
assert(not RemoteCatalog.ChestAutoEnabled and not RemoteCatalog.ChestAutoWorker,'must not start on load')
assert(RemoteCatalog.SetChestAuto(true))
local originalWorker=worker
assert(RemoteCatalog.SetChestAuto(true) and worker==originalWorker,'double ON must not create a second worker')
drain()
assert(inventory==75 and chest==0 and RemoteCatalog.ChestAutoTotal==75 and not RemoteCatalog.ChestAutoEnabled,'Auto Max must collect full batches and the smaller remaining stack')
assert(#calls<20 and calls[1]==30 and not RemoteCatalog.ChestBusy and not RemoteCatalog.ChestAutoWorker,'withdrawal must be bounded, serialized and clean up')
local reduced=false
for _,amount in ipairs(calls) do
 if amount==15 then reduced=true end
 if reduced then assert(amount<=15,'a successful smaller remainder batch must not reset to an oversized learned batch') end
end
assert(reduced,'remainder fixture must exercise a successful reduced batch')
-- An accepted response without inventory movement must not imply transfer.
calls={};inventory=0;RemoteCatalog.WithdrawCarrots=function(amount) table.insert(calls,amount);return true end
assert(RemoteCatalog.SetChestAuto(true));drain()
assert(RemoteCatalog.ChestAutoTotal==0 and not RemoteCatalog.ChestAutoEnabled and #calls==1,'an accepted but unconfirmed transfer must stop without resending or reducing its batch')
-- Unreadable quantities send nothing.
readable=false;calls={}
assert(RemoteCatalog.SetChestAuto(true));drain()
assert(#calls==0 and not RemoteCatalog.ChestAutoEnabled,'unreadable inventory must stop before sending')
readable=true
-- Invalid stack counts must never become transfer confirmation or issue requests.
local originalCount=RemoteCatalog.BaitCount
for _,count in ipairs({-1,0.5,math.huge,-math.huge,0/0,"5",9007199254740992}) do
 RemoteCatalog.BaitCount=function() return count end
 calls={};RemoteCatalog.WithdrawCarrots=request
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(#calls==0 and RemoteCatalog.ChestAutoTotal==0,'invalid stack count must stop before sending')
end
-- Valid individual stacks can still overflow the exact aggregate integer range.
local originalTools=RemoteCatalog.OwnedTools
RemoteCatalog.OwnedTools=function() return {{Name='carrotHarvested'},{Name='carrotHarvested'}} end
RemoteCatalog.BaitCount=function() return 4503599627370496 end
assert(RemoteCatalog.CarrotCount()==nil,'inexact aggregate count must be unreadable')
RemoteCatalog.OwnedTools=originalTools
RemoteCatalog.BaitCount=originalCount
inventory=0;calls={}
RemoteCatalog.WithdrawCarrots=function(amount)
 table.insert(calls,amount);inventory=0.5;return true
end
assert(RemoteCatalog.SetChestAuto(true));drain()
assert(#calls==1 and RemoteCatalog.ChestAutoTotal==0 and not RemoteCatalog.ChestBusy and not RemoteCatalog.ChestAutoWorker,'invalid replicated count must stop without confirming a transfer')
inventory=0
-- Range/path waits send no requests, and can resume once approach succeeds.
reached=false;calls={};chest=60;inventory=0;RemoteCatalog.WithdrawCarrots=request
assert(RemoteCatalog.SetChestAuto(true) and #calls==0 and RemoteCatalog.ChestAutoEnabled)
assert(coroutine.resume(worker) and #calls==0,'out-of-range wait must not issue requests')
reached=true;drain();assert(inventory==60 and chest==0,'approach completion must allow withdrawal')
-- A cancelled approach must not release a lock subsequently owned by manual withdrawal.
reached=false
assert(RemoteCatalog.SetChestAuto(true))
RemoteCatalog.SetChestAuto(false)
RemoteCatalog.ChestBusy=true -- a manual request can start while the old approach is cancelling
assert(coroutine.resume(worker))
assert(RemoteCatalog.ChestBusy,'old worker cleanup must not release another request lock')
RemoteCatalog.ChestBusy=false;reached=true
-- Stop during an in-flight request must prevent another request or immediate overlapping restart.
calls={};inventory=0
RemoteCatalog.WithdrawCarrots=function(amount) table.insert(calls,amount);task.wait(.1);inventory+=amount;return true end
assert(RemoteCatalog.SetChestAuto(true) and #calls==1)
RemoteCatalog.SetChestAuto(false)
assert(not RemoteCatalog.SetChestAuto(true),'restart must wait for an in-flight worker to finish')
drain();assert(#calls==1 and not RemoteCatalog.ChestBusy and not RemoteCatalog.ChestAutoWorker and not RemoteCatalog.ChestAutoEnabled,'stopped request must clean up without sending again')
assert(RemoteCatalog.ChestHistory[1].Outcome=='Stopped' and RemoteCatalog.ChestHistory[1].Total==0,'cancelled in-flight requests must record only previously confirmed totals')
-- Exceptions, session changes and GUI destruction must release the worker.
RemoteCatalog.WithdrawCarrots=function() error('transport failed') end
assert(RemoteCatalog.SetChestAuto(true));drain()
assert(not RemoteCatalog.ChestBusy and not RemoteCatalog.ChestAutoWorker and string.find(RemoteCatalog.ChestLastDetail,'transport failed',1,true))
RemoteCatalog.WithdrawCarrots=request;chest=100;inventory=0
assert(RemoteCatalog.SetChestAuto(true));local before=#calls
valid=false;drain();assert(#calls==before and not RemoteCatalog.ChestAutoEnabled,'session invalidation must stop additional sends')
valid=true;chest=100
assert(RemoteCatalog.SetChestAuto(true));before=#calls;gui.Parent=nil;drain()
assert(#calls==before and not RemoteCatalog.ChestAutoWorker and not RemoteCatalog.ChestBusy,'GUI removal must stop sends and release state')
gui.Parent=true;valid=true;readable=true;reached=true
local a,b={Amount=30,Id='A'},{Amount=12,Id='B'}
local remaining={A=75,B=23}
local sent={}
inventory=0
RemoteCatalog.SelectedChestTargets=function() return {{Recorder=recorder,Binding=a},{Recorder=recorder,Binding=b}} end
RemoteCatalog.WithdrawCarrots=function(amount,owner,selected)
 assert(owner==recorder and (selected==a or selected==b),'auto must pass the exact chest binding to replay')
 table.insert(sent,selected.Id)
 if remaining[selected.Id]<amount then return false,{reason='empty'} end
 remaining[selected.Id]-=amount;inventory+=amount;return true
end
assert(RemoteCatalog.SetChestAuto(true));drain()
assert(inventory==98 and remaining.A==0 and remaining.B==0 and RemoteCatalog.ChestAutoTotal==98,'multi chest auto must collect both full and partial stacks')
local moved=false
for _,id in ipairs(sent) do if id=='B' then moved=true end;assert(not moved or id~='A','auto must finish the current stack before moving to the next chest') end
assert(sent[1]=='A' and moved,'both selected chests must still be processed')
remaining={A=0,B=9};inventory=0;sent={}
assert(RemoteCatalog.SetChestAuto(true));drain()
assert(inventory==9 and remaining.B==0,'empty first chest must not stop another chest')
remaining={A=100,B=9};inventory=0;sent={}
recorder.CanUseChestBinding=function(_,selected) return selected~=a end
assert(RemoteCatalog.SetChestAuto(true));drain()
assert(inventory==9 and remaining.A==100,'invalid first chest must be skipped while other chests continue')
for _,id in ipairs(sent) do assert(id=='B','invalid chest must never send') end
recorder.CanUseChestBinding=function() return true end
RemoteCatalog.ApproachChest=function(_,_,selected) return selected~=a,'out of range' end
remaining={A=100,B=9};inventory=0;sent={}
assert(RemoteCatalog.SetChestAuto(true))
for i=1,80 do if coroutine.status(worker)=='suspended' then local ok,err=coroutine.resume(worker);assert(ok,err) end end
assert(inventory==9 and remaining.A==100 and RemoteCatalog.ChestAutoEnabled,'unreachable chest must not block a reachable one')
RemoteCatalog.SetChestAuto(false);drain()
RemoteCatalog.ApproachChest=function() return true end
local slots={['A:0']=30,['A:5']=17,['A:11']=2,['B:12']=30,['B:3']=4}
local expanded={}
for _,chest in ipairs({'A','B'}) do
 for slot=0,12 do table.insert(expanded,{Recorder=recorder,Binding={Amount=30,Probe=true,Key=chest..':'..slot}}) end
end
RemoteCatalog.SelectedChestTargets=function() return expanded end
inventory=0
local requests={}
RemoteCatalog.WithdrawCarrots=function(amount,owner,binding)
 local key=binding.Key
 if not requests[key] then assert(amount==1,'unverified slots must start with a one-item request') end
 requests[key]=(requests[key] or 0)+1
 local available=slots[key] or 0
 if available<amount then return false,{reason='empty or insufficient'} end
 slots[key]=available-amount;inventory+=amount;return true
end
assert(RemoteCatalog.SetChestAuto(true));drain()
assert(inventory==83 and RemoteCatalog.ChestAutoTotal==83,'whole-chest mode must drain every nonempty carrot slot including both index boundaries')
for _,remaining in pairs(slots) do assert(remaining==0,'a carrot stack was left behind') end
assert(requests['A:1']==1 and requests['B:0']==1,'empty probe slots must be skipped without repeated retries')
-- Walk mode must drain all slots in one physical chest before travelling again.
local physicalA,physicalB={},{}
local routed={
 {Recorder=recorder,Binding={Chest=physicalA,Slot=0,Amount=5,Key='A:0'}},
 {Recorder=recorder,Binding={Chest=physicalA,Slot=1,Amount=5,Key='A:1'}},
 {Recorder=recorder,Binding={Chest=physicalB,Slot=0,Amount=5,Key='B:0'}},
}
RemoteCatalog.ChestTravel='Walk'
RemoteCatalog.SelectedChestTargets=function() return routed end
slots={['A:0']=10,['A:1']=10,['B:0']=10};inventory=0
local visits={}
RemoteCatalog.WithdrawCarrots=function(amount,_,binding)
 table.insert(visits,binding.Chest)
 if slots[binding.Key]<amount then return false,'empty' end
 slots[binding.Key]-=amount;inventory+=amount;return true
end
assert(RemoteCatalog.SetChestAuto(true));drain()
local leftA=false
for _,chest in ipairs(visits) do
 if chest==physicalB then leftA=true end
 assert(not leftA or chest~=physicalA,'Walk must not bounce back to a chest after each batch')
end
assert(inventory==30 and string.find(RemoteCatalog.ChestLastDetail,'Pass finished: 30 items',1,true),'completed pass must report the confirmed total')
-- An unreachable current chest must release its preference so another can run.
RemoteCatalog.ApproachChest=function(_,_,binding) return binding.Chest~=physicalA,'out of range' end
slots={['A:0']=10,['A:1']=10,['B:0']=10};inventory=0
assert(RemoteCatalog.SetChestAuto(true))
for i=1,100 do if coroutine.status(worker)=='suspended' then local ok,err=coroutine.resume(worker);assert(ok,err) end end
assert(inventory==10 and RemoteCatalog.ChestAutoEnabled,'blocked Walk chest must not starve reachable targets')
RemoteCatalog.SetChestAuto(false);drain()
-- Mixed item collection must confirm each requested item independently.
RemoteCatalog.ChestTravel='Stay';RemoteCatalog.ApproachChest=function() return true end
local quantities={wood=0,stone=0,carrotHarvested=300}
RemoteCatalog.OwnedTools=function() return {{Name='wood'},{Name='stone'},{Name='carrotHarvested'}} end
RemoteCatalog.BaitCount=function(tool) return quantities[tool.Name] end
RemoteCatalog.SelectedChestTargets=function() return {
 {Recorder=recorder,Binding={Chest=physicalA,Item='wood',Slot=0,Amount=5}},
 {Recorder=recorder,Binding={Chest=physicalA,Item='stone',Slot=1,Amount=3}}
} end
local stock={wood=7,stone=4}
RemoteCatalog.WithdrawCarrots=function(amount,_,binding)
 local item=binding.Item
 if stock[item]<amount then return false,'insufficient' end
 stock[item]-=amount;quantities[item]+=amount;return true
end
assert(RemoteCatalog.SetChestAuto(true));drain()
assert(quantities.wood==7 and quantities.stone==4 and RemoteCatalog.ChestAutoTotal==11,'mixed items must be counted using their own inventory totals')
assert(quantities.carrotHarvested==300,'unrelated carrot quantity must not affect the collected total')
assert(RemoteCatalog.ChestAutoItems.wood==7 and RemoteCatalog.ChestAutoItems.stone==4,'per-item totals must retain confirmed mixed transfers')
assert(string.find(RemoteCatalog.ChestLastDetail,'By item: stone: 4, wood: 7',1,true),'copyable result must include a sorted item breakdown')
-- A goal caps the last request and ends the pass without draining the chest.
RemoteCatalog.SelectedChestTargets=function() return {{Recorder=recorder,Binding={Amount=30,Item='wood'}}} end
RemoteCatalog.OwnedTools=function() return {{Name='wood'}} end
RemoteCatalog.BaitCount=function() return inventory end
RemoteCatalog.ChestGoal=35;inventory=0;calls={}
RemoteCatalog.WithdrawCarrots=function(amount) table.insert(calls,amount);inventory+=amount;return true end
assert(RemoteCatalog.SetChestAuto(true));drain()
assert(#calls==2 and calls[1]==30 and calls[2]==5 and inventory==35,'goal must cap the final batch to the remaining whole-item total')
assert(not RemoteCatalog.ChestAutoEnabled and not RemoteCatalog.ChestAutoWorker and not RemoteCatalog.ChestBusy,'goal completion must release the worker and lock')
assert(string.find(RemoteCatalog.ChestLastDetail,'Goal reached: 35',1,true) and RemoteCatalog.ChestAutoItems.wood==35,'goal completion must explain why unchecked slots remain')
-- A rejected capped batch backs off from the amount actually sent.
RemoteCatalog.ChestGoal=5;inventory=0;calls={}
RemoteCatalog.WithdrawCarrots=function(amount)
 table.insert(calls,amount)
 if amount>2 then return false,'batch too large' end
 inventory+=amount;return true
end
assert(RemoteCatalog.SetChestAuto(true));drain()
assert(#calls==4 and calls[1]==5 and calls[2]==2 and calls[3]==2 and calls[4]==1,'capped failures must halve the actual attempted batch and retain successful remainder sizes')
assert(inventory==5 and RemoteCatalog.ChestAutoItems.wood==5,'new run must reset the per-item totals')
-- Unconfirmed responses do not satisfy a goal.
RemoteCatalog.ChestGoal=1;inventory=0;calls={}
RemoteCatalog.WithdrawCarrots=function(amount) table.insert(calls,amount);return true end
assert(RemoteCatalog.SetChestAuto(true));drain()
assert(#calls==1 and RemoteCatalog.ChestAutoTotal==0 and next(RemoteCatalog.ChestAutoItems)==nil,'goals require inventory confirmation and must not replay an accepted but unconfirmed transfer')
-- A goal is shared by mixed items, rather than applied separately to each.
RemoteCatalog.ChestGoal=6;quantities.wood=0;quantities.stone=0;calls={}
RemoteCatalog.SelectedChestTargets=function() return {
 {Recorder=recorder,Binding={Amount=4,Item='wood'}},
 {Recorder=recorder,Binding={Amount=4,Item='stone'}}
} end
RemoteCatalog.OwnedTools=function() return {{Name='wood'},{Name='stone'}} end
RemoteCatalog.BaitCount=function(tool) return quantities[tool.Name] end
RemoteCatalog.WithdrawCarrots=function(amount,_,binding)
 table.insert(calls,amount);quantities[binding.Item]+=amount;return true
end
assert(RemoteCatalog.SetChestAuto(true));drain()
assert(#calls==2 and quantities.wood==6 and quantities.stone==0 and RemoteCatalog.ChestAutoTotal==6,'combined goal must cap the current stack instead of switching items before it is drained')
RemoteCatalog.ChestGoal=nil
assert(RemoteCatalog.ChestHistory[1].Outcome=='Goal reached' and RemoteCatalog.ChestHistory[1].Total==6 and RemoteCatalog.ChestHistory[1].Goal==6,'automatic completion must retain its outcome, total and goal')
local historical=RemoteCatalog.ChestHistory[1]
RemoteCatalog.ChestAutoItems.wood=999
assert(historical.Items.wood==6,'history must snapshot totals instead of retaining mutable run state')
for index=1,8 do RemoteCatalog.RecordChestRun('Stopped',index,{wood=index}) end
assert(#RemoteCatalog.ChestHistory==5 and RemoteCatalog.ChestHistory[1].Total==8 and RemoteCatalog.ChestHistory[5].Total==4,'history must keep only the newest five runs in order')
-- Fast pacing shortens confirmed-transfer waits without weakening confirmation or retries.
do
 local function run(pace,confirmed)
  RemoteCatalog.ChestSpeed=pace;RemoteCatalog.ChestGoal=confirmed and 60 or 1
  RemoteCatalog.SelectedChestTargets=function() return {{Recorder=recorder,Binding={Amount=30,Item='wood'}}} end
  RemoteCatalog.OwnedTools=function() return {{Name='wood'}} end
  RemoteCatalog.BaitCount=function() return inventory end
  inventory=0;calls={};waits={}
  RemoteCatalog.WithdrawCarrots=function(amount) table.insert(calls,amount);if confirmed then inventory+=amount end;return true end
  assert(RemoteCatalog.SetChestAuto(true));drain()
  local total,polls=0,0
  for _,dt in ipairs(waits) do total+=dt;if dt==.1 then polls+=1 end end
  return total,polls,#calls,RemoteCatalog.ChestAutoTotal
 end
 local standard=run('Standard',true)
 local fast,_,count,total=run('Fast',true)
 assert(standard>fast and count==2 and total==60,'Fast must reduce waits for the same two confirmed batches')
 local _,polls,unconfirmed,total=run('Fast',false)
 assert(unconfirmed==1 and total==0 and polls>=50,'Fast must retain the five-second confirmation window without replaying an unconfirmed transfer')
 -- A running worker keeps its captured pace even if external code changes the preference.
 RemoteCatalog.ChestSpeed='Standard';RemoteCatalog.ChestGoal=60;inventory=0;waits={}
 RemoteCatalog.WithdrawCarrots=function(amount) inventory+=amount;return true end
 assert(RemoteCatalog.SetChestAuto(true));RemoteCatalog.ChestSpeed='Fast';drain()
 for _,dt in ipairs(waits) do assert(dt==.25,'pacing must be stable throughout a run') end
 RemoteCatalog.ChestSpeed='Standard';RemoteCatalog.ChestGoal=nil
end
-- Potato salad can move between slots; each check must retain the item and learned ceiling.
do
 RemoteCatalog.ChestGoal=nil;RemoteCatalog.ChestSpeed='Standard';RemoteCatalog.ChestTravel='Stay'
 local salad={}
 local amounts={potatoSalad=0,carrotHarvested=100,wood=20}
 local source={['3']=9,['8']=17,['12']=4}
 local checks={}
 for slot=0,12 do table.insert(checks,{Recorder=recorder,Binding={Chest=salad,Slot=slot,Item='potatoSalad',Amount=17,Probe=true}}) end
 RemoteCatalog.SelectedChestTargets=function() return checks end
 RemoteCatalog.OwnedTools=function() return {{Name='potatoSalad'},{Name='carrotHarvested'},{Name='wood'}} end
 RemoteCatalog.BaitCount=function(tool) return amounts[tool.Name] end
 local sent={}
 RemoteCatalog.WithdrawCarrots=function(amount,owner,selected)
  assert(owner==recorder and selected.Item=='potatoSalad' and amount<=17,'salad collection must retain the exact item and learned maximum')
  local key=tostring(selected.Slot)
  if not sent[key] then assert(amount==1,'unobserved salad slots must start with a one-item probe') end
  sent[key]=(sent[key] or 0)+1
  if (source[key] or 0)<amount then return false,'insufficient salad' end
  source[key]-=amount;amounts.potatoSalad+=amount;return true
 end
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(amounts.potatoSalad==30 and RemoteCatalog.ChestAutoTotal==30 and RemoteCatalog.ChestAutoItems.potatoSalad==30,'salad in varying slots must all count after observed inventory changes')
 assert(amounts.carrotHarvested==100 and amounts.wood==20 and sent['0']==1 and sent['11']==1,'empty probes must stop without changing unrelated inventory')
 -- A success response accompanied only by another item's increase is insufficient.
 amounts.potatoSalad=0;RemoteCatalog.ChestGoal=1;sent={}
 RemoteCatalog.SelectedChestTargets=function() return {{Recorder=recorder,Binding={Chest=salad,Slot=8,Item='potatoSalad',Amount=17}}} end
 RemoteCatalog.WithdrawCarrots=function(amount) table.insert(sent,amount);amounts.carrotHarvested+=amount;return true end
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(#sent==1 and RemoteCatalog.ChestAutoTotal==0 and RemoteCatalog.ChestAutoItems.potatoSalad==nil,'only salad inventory growth can confirm a salad withdrawal; wrong-item growth must not cause retries')
end
-- A first food tool can replicate before its stack quantity becomes readable.
do
 local oldWait,oldQuantity=task.wait,RemoteCatalog.BaitCount
 local stock,quantity,hasTool,ready,ticks=17,0,false,true,0
 ${quantityAdapter}
 local tool={Name='potatoSalad',GetAttributes=function() return ready and {Amount=quantity} or {} end,GetChildren=function() return {} end}
 local sent={}
 local salad={Chest={},Slot=8,Item='potatoSalad',Amount=17,Probe=true}
 RemoteCatalog.ChestGoal=nil;RemoteCatalog.ChestStockTarget=nil
 RemoteCatalog.SelectedChestTargets=function() return {{Recorder=recorder,Binding=salad}} end
 RemoteCatalog.OwnedTools=function() return hasTool and {tool} or {} end
 RemoteCatalog.ApproachChest=function() return true end
 task.wait=function(dt)
  if not ready then ticks+=1;if ticks>=3 then ready=true end end
  return oldWait(dt)
 end
 RemoteCatalog.WithdrawCarrots=function(amount)
  assert(ready,'another request must wait until the pending stack quantity is readable')
  table.insert(sent,amount)
  if amount>stock then return false,'insufficient salad' end
  stock-=amount;quantity+=amount;hasTool=true;ready=false;ticks=0
  return true
 end
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(quantity==17 and stock==0 and RemoteCatalog.ChestAutoTotal==17,'a tool arriving before its quantity must not stop salad collection after one item')
 local batch=false
 for index,amount in ipairs(sent) do if index>1 and amount>1 then batch=true end end
 assert(sent[1]==1 and batch and #sent<20,'confirmed one-item probe must continue with learned batches and bounded remainder handling')
 -- Unknown metadata must time out without issuing another unconfirmed request.
 stock=17;quantity=0;hasTool=false;ready=true;ticks=0;sent={}
 task.wait=oldWait -- quantity deliberately never becomes readable
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(#sent==1 and quantity==1 and RemoteCatalog.ChestAutoTotal==0 and not RemoteCatalog.ChestAutoWorker,'permanently missing quantity must not permit a second withdrawal')
 assert(string.find(RemoteCatalog.ChestLastDetail,'within 5 seconds',1,true),'timeout must explain why the one-item probe could not continue')
 -- Stop during metadata confirmation must prevent all late counts and follow-up requests.
 stock=17;quantity=0;hasTool=false;ready=true;sent={}
 assert(RemoteCatalog.SetChestAuto(true) and #sent==1 and not ready)
 RemoteCatalog.SetChestAuto(false);ready=true;drain()
 assert(#sent==1 and RemoteCatalog.ChestAutoTotal==0 and not RemoteCatalog.ChestBusy,'Stop must cancel a pending quantity wait without counting its late result')
 -- Top-up can also wait for metadata already pending before the first request.
 stock=13;quantity=37;hasTool=true;ready=false;ticks=0;sent={}
 RemoteCatalog.ChestStockTarget=50
 task.wait=function(dt) if not ready then ticks+=1;if ticks>=3 then ready=true end end;return oldWait(dt) end
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(quantity==50 and stock==0 and RemoteCatalog.ChestAutoTotal==13 and sent[1]==1 and sent[2]==12,'pending starting quantity must settle before top-up computes its deficit')
 RemoteCatalog.ChestStockTarget=nil
 task.wait,RemoteCatalog.BaitCount=oldWait,oldQuantity
end
-- Optional auto top-up counts existing inventory per item and shares deficits across slots.
do
 local qty,requests,approaches,remaining
 local salad={Chest={},Slot=8,Item='potatoSalad',Amount=17}
 local otherSalad={Chest=salad.Chest,Slot=3,Item='potatoSalad',Amount=17}
 local wood={Chest=salad.Chest,Slot=1,Item='wood',Amount=30}
 local function prepare(count,targets)
  qty={potatoSalad=count,wood=0};requests={};approaches=0;remaining=100
  gui.Parent=true;valid=true;RemoteCatalog.ChestGoal=nil;RemoteCatalog.ChestStockTarget=50
  RemoteCatalog.SelectedChestTargets=function() return targets or {{Recorder=recorder,Binding=salad},{Recorder=recorder,Binding=otherSalad}} end
  RemoteCatalog.OwnedTools=function() return {{Name='potatoSalad'},{Name='wood'}} end
  RemoteCatalog.BaitCount=function(tool) return qty[tool.Name] end
  RemoteCatalog.ApproachChest=function() approaches+=1;return true end
  RemoteCatalog.WithdrawCarrots=function(amount,owner,binding)
   assert(owner==recorder)
   table.insert(requests,{Amount=amount,Item=binding.Item})
   if remaining<amount then return false,'insufficient stock' end
   remaining-=amount;qty[binding.Item]+=amount;return true
  end
 end
 prepare(37)
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(#requests==1 and requests[1].Amount==13 and approaches==1 and qty.potatoSalad==50,'37 existing salads must require only 13, without approaching a second slot after the shared target is met')
 assert(RemoteCatalog.ChestAutoTotal==13 and RemoteCatalog.ChestAutoItems.potatoSalad==13,'top-up must count new confirmed items, excluding existing inventory')
 assert(RemoteCatalog.ChestHistory[1].Outcome=='Inventory targets met' and RemoteCatalog.ChestHistory[1].StockTarget==50,'run history must retain the actual target and outcome')
 prepare(60)
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(#requests==0 and approaches==0 and RemoteCatalog.ChestAutoTotal==0,'satisfied inventory must send no requests or approach calls')
 prepare(47,{{Recorder=recorder,Binding=salad},{Recorder=recorder,Binding=wood}});qty.wood=49
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(#requests==2 and requests[1].Amount==3 and requests[2].Amount==1 and qty.potatoSalad==50 and qty.wood==50 and RemoteCatalog.ChestAutoTotal==4,'each selected item must have its own current-inventory deficit')
 prepare(37)
 RemoteCatalog.ApproachChest=function() approaches+=1;task.wait(.1);qty.potatoSalad=49;return true end
 assert(RemoteCatalog.SetChestAuto(true));RemoteCatalog.ChestStockTarget=25;drain()
 assert(requests[1].Amount==1 and qty.potatoSalad==50 and RemoteCatalog.ChestHistory[1].StockTarget==50,'count must be re-read after approach, while the run retains its original target')
 prepare(37)
 RemoteCatalog.ApproachChest=function() approaches+=1;task.wait(.1);qty.potatoSalad=50;return true end
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(#requests==0 and approaches==1,'inventory reaching the target during approach must prevent the next request')
 prepare(37);RemoteCatalog.ChestGoal=10
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(#requests==1 and requests[1].Amount==10 and qty.potatoSalad==47 and RemoteCatalog.ChestAutoTotal==10,'combined collection goal must cap top-up when it is the smaller limit')
 assert(RemoteCatalog.ChestHistory[1].Outcome=='Goal reached','aggregate goal must remain distinct from per-item stock targets')
 prepare(37);remaining=5
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(qty.potatoSalad==42 and remaining==0 and RemoteCatalog.ChestAutoTotal==5 and #requests<25,'partial stock must retain bounded remainder handling')
 assert(RemoteCatalog.ChestHistory[1].Outcome=='Pass finished' and string.find(RemoteCatalog.ChestLastDetail,'remain below 50',1,true),'empty stock must never be reported as a satisfied inventory target')
 prepare(49)
 RemoteCatalog.WithdrawCarrots=function(amount) table.insert(requests,amount);qty.wood+=amount;return true end
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(#requests==1 and qty.potatoSalad==49 and RemoteCatalog.ChestAutoTotal==0,'top-up must stop an unconfirmed transfer instead of retrying other slots or attributing unrelated items')
 prepare(nil)
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(#requests==0 and approaches==0 and string.find(RemoteCatalog.ChestLastDetail,'Cannot read',1,true),'unreadable inventory must stop before top-up navigation or withdrawal')
 for _,invalid in ipairs({0,-1,25.5,'50',true,math.huge,0/0}) do
  prepare(37);RemoteCatalog.ChestStockTarget=invalid
  assert(not RemoteCatalog.SetChestAuto(true) and #requests==0 and not RemoteCatalog.ChestAutoWorker,'invalid stock preferences must not start a worker')
 end
 prepare(37)
 RemoteCatalog.WithdrawCarrots=function(amount,_,binding) table.insert(requests,amount);task.wait(.2);qty[binding.Item]+=amount;return true end
 assert(RemoteCatalog.SetChestAuto(true) and requests[1]==13)
 RemoteCatalog.SetChestAuto(false)
 assert(not RemoteCatalog.SetChestAuto(true),'cancelled top-up must retain the in-flight lock')
 drain()
 assert(#requests==1 and RemoteCatalog.ChestAutoTotal==0 and RemoteCatalog.ChestHistory[1].Outcome=='Stopped' and not RemoteCatalog.ChestAutoWorker,'Stop must discard late confirmation and prevent extra top-up requests')
 RemoteCatalog.ChestStockTarget=nil;RemoteCatalog.ChestGoal=nil
end
-- Explicit thirty-item batches keep collecting the same physical slot.
do
 local oldBatch=RemoteCatalog.ChestAutoBatch
 RemoteCatalog.ChestAutoBatch=30;RemoteCatalog.ChestStockTarget=nil;RemoteCatalog.ChestGoal=nil;RemoteCatalog.ChestTravel='Stay'
 local chest={}
 local first={Chest=chest,Slot=8,Item='potatoSalad',Amount=17,Probe=true}
 local second={Chest=chest,Slot=3,Item='potatoSalad',Amount=17,Probe=true}
 local stock={[8]=95,[3]=60}
 local total,trace,blocked=0,{},false
 RemoteCatalog.SelectedChestTargets=function() return {{Recorder=recorder,Binding=first},{Recorder=recorder,Binding=second}} end
 RemoteCatalog.OwnedTools=function() return {{Name='potatoSalad'}} end
 RemoteCatalog.BaitCount=function() return total end
 RemoteCatalog.ApproachChest=function(_,_,binding) return not (blocked and binding==first),'out of range' end
 RemoteCatalog.WithdrawCarrots=function(amount,owner,binding)
  assert(owner==recorder and amount<=30 and (binding==first or binding==second),'collector must retain the exact learned slot/item while applying the requested batch')
  table.insert(trace,{Slot=binding.Slot,Amount=amount})
  if stock[binding.Slot]<amount then return false,'insufficient salad' end
  stock[binding.Slot]-=amount;total+=amount;return true
 end
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(trace[1].Slot==8 and trace[1].Amount==1 and trace[2].Slot==8 and trace[2].Amount==30 and trace[3].Slot==8 and trace[3].Amount==30,'after one probe, thirty-item batches must continue on the same slot instead of switching stacks')
 local moved=false
 for _,request in ipairs(trace) do
  if request.Slot==3 then moved=true end
  assert(not moved or request.Slot~=8,'the first stack must be drained before checking another slot in the same chest')
 end
 assert(total==155 and stock[8]==0 and stock[3]==0 and RemoteCatalog.ChestAutoTotal==155 and #trace<40,'both stacks and their remainders must drain with bounded attempts')
 assert(first.Slot==8 and first.Amount==17 and second.Slot==3,'batch override must not mutate captured slot or amount metadata')
 -- A preferred stack losing reach must release preference so another can continue.
 first.Probe=false;second.Probe=false;stock={[8]=100,[3]=60};total=0;trace={};blocked=false
 assert(RemoteCatalog.SetChestAuto(true) and trace[1].Slot==8 and trace[1].Amount==30)
 blocked=true
 for _=1,100 do if coroutine.status(worker)=='suspended' then local ok,e=coroutine.resume(worker);assert(ok,e) end end
 assert(stock[8]==70 and stock[3]==0 and total==90 and RemoteCatalog.ChestAutoEnabled,'an unreachable preferred stack must not block reachable stacks')
 RemoteCatalog.SetChestAuto(false);drain()
 RemoteCatalog.ChestAutoBatch=oldBatch
end
-- Repeat stays in one worker, waits between passes and discovers a refilled/moved stack.
do
 local oldWait=task.wait
 local clock,qty,stock,trace,selected,usable,approaches=0,0,{}, {},{},true,0
 local chest={}
 local first={Chest=chest,Slot=8,Item='potatoSalad',Amount=17,Probe=true}
 local moved={Chest=chest,Slot=3,Item='potatoSalad',Amount=9}
 local owner={CanUseChestBinding=function() return usable end}
 task.wait=function(dt) clock+=dt;return oldWait(dt) end
 local function prepare(available,inventory,goal,target)
  clock=0;qty=inventory or 0;stock={[8]=available};trace={};usable=true;approaches=0
  selected={{Recorder=owner,Binding=first}}
  RemoteCatalog.ChestRepeat=true;RemoteCatalog.ChestAutoBatch=30;RemoteCatalog.ChestGoal=goal;RemoteCatalog.ChestStockTarget=target
  RemoteCatalog.SelectedChestTargets=function() return selected end
  RemoteCatalog.OwnedTools=function() return {{Name='potatoSalad'}} end
  RemoteCatalog.BaitCount=function() return qty end
  RemoteCatalog.ApproachChest=function() approaches+=1;return true end
  RemoteCatalog.WithdrawCarrots=function(amount,rec,binding)
   assert(rec==owner and binding.Item=='potatoSalad' and amount<=30)
   table.insert(trace,{Amount=amount,Slot=binding.Slot,At=clock})
   if (stock[binding.Slot] or 0)<amount then return false,'empty or insufficient' end
   stock[binding.Slot]-=amount;qty+=amount;return true
  end
 end
 local function untilTrue(predicate,limit)
  for _=1,limit or 600 do
   if predicate() then return end
   assert(worker and coroutine.status(worker)=='suspended','repeat worker stopped before expected state')
   local ok,e=coroutine.resume(worker);assert(ok,e)
  end
  assert(predicate(),'repeat condition did not settle')
 end
 local function resume(count)
  for _=1,count do local ok,e=coroutine.resume(worker);assert(ok,e) end
 end
 prepare(60)
 local previousHistory=RemoteCatalog.ChestHistory[1]
 assert(RemoteCatalog.SetChestAuto(true))
 local singleWorker=worker
 untilTrue(function() return RemoteCatalog.ChestRepeatWaiting end)
 assert(qty==60 and RemoteCatalog.ChestAutoTotal==60 and RemoteCatalog.ChestAutoEnabled and not RemoteCatalog.ChestBusy,'emptying a chest in Repeat must wait ON without holding a request lock')
 local calls,waitBegan=#trace,clock-.1
 resume(10)
 assert(#trace==calls and worker==singleWorker,'repeat wait must send no requests or create another worker')
 stock[3]=60;selected={{Recorder=owner,Binding=moved}}
 RemoteCatalog.ChestAutoBatch=1 -- external edits must not change the active run's batch.
 untilTrue(function() return RemoteCatalog.ChestAutoTotal==120 and RemoteCatalog.ChestRepeatWaiting end)
 assert(RemoteCatalog.ChestAutoPass==2 and worker==singleWorker and trace[calls+1].Slot==3 and trace[calls+1].Amount==1,'repeat must refresh moved slots with one-item probes in the same worker')
 assert(math.abs(trace[calls+1].At-waitBegan-2)<1e-6 and trace[calls+2].Amount==30,'the next pass must wait two seconds and retain its original thirty-item maximum')
 assert(first.Slot==8 and moved.Slot==3 and moved.Amount==9 and RemoteCatalog.ChestHistory[1]==previousHistory,'repeat must not mutate captures or add history entries for every pass')
 calls=#trace
 RemoteCatalog.SetChestAuto(false)
 assert(not RemoteCatalog.SetChestAuto(true),'Stop during repeat wait must retain worker ownership until cleanup')
 drain()
 assert(#trace==calls and not RemoteCatalog.ChestAutoWorker and not RemoteCatalog.ChestRepeatWaiting and RemoteCatalog.ChestHistory[1].Total==120,'stopping repeat must preserve cumulative confirmed totals and issue no late requests')
 -- Combined goals span passes, rather than resetting after each refill.
 prepare(30,0,40)
 assert(RemoteCatalog.SetChestAuto(true));untilTrue(function() return RemoteCatalog.ChestRepeatWaiting end)
 stock[8]=20
 untilTrue(function() return not RemoteCatalog.ChestAutoWorker end)
 assert(qty==40 and stock[8]==10 and RemoteCatalog.ChestAutoTotal==40 and RemoteCatalog.ChestHistory[1].Outcome=='Goal reached','a shared goal must end repeat at its cumulative total')
 -- Top-up repeats wait without withdrawal until inventory is used.
 prepare(100,50,nil,50)
 assert(RemoteCatalog.SetChestAuto(true) and RemoteCatalog.ChestRepeatWaiting and #trace==0 and approaches==0)
 qty=43
 untilTrue(function() return qty==50 and RemoteCatalog.ChestRepeatWaiting end)
 assert(#trace==2 and trace[1].Amount==1 and trace[2].Amount==6 and RemoteCatalog.ChestAutoTotal==7,'repeat must top up only the live deficit after consumption')
 calls=#trace;resume(60)
 assert(#trace==calls and RemoteCatalog.ChestAutoEnabled,'satisfied repeated top-up must remain idle without extra withdrawals')
 RemoteCatalog.SetChestAuto(false);drain()
 -- Expired bindings during the wait stop rather than replaying a stale packet.
 prepare(0)
 assert(RemoteCatalog.SetChestAuto(true));untilTrue(function() return RemoteCatalog.ChestRepeatWaiting end)
 calls=#trace;usable=false
 untilTrue(function() return not RemoteCatalog.ChestAutoWorker end)
 assert(#trace==calls and not RemoteCatalog.ChestAutoEnabled and string.find(RemoteCatalog.ChestLastDetail,'no current learned targets',1,true),'repeat must stop explicitly if no current binding survives')
 -- GUI removal also cancels the repeat delay with no follow-up request.
 prepare(0)
 assert(RemoteCatalog.SetChestAuto(true));untilTrue(function() return RemoteCatalog.ChestRepeatWaiting end)
 calls=#trace;gui.Parent=nil;drain()
 assert(#trace==calls and not RemoteCatalog.ChestAutoWorker and not RemoteCatalog.ChestBusy,'GUI cleanup must stop repeated polls')
 gui.Parent=true;task.wait=oldWait
 RemoteCatalog.ChestRepeat=false;RemoteCatalog.ChestAutoBatch=nil;RemoteCatalog.ChestGoal=nil;RemoteCatalog.ChestStockTarget=nil
end
-- Pause holds one run, preserves its stack/goal and allows sent requests to settle.
do
 local originalWait=task.wait
 local clock,qty,stock,trace,usable,pending,walking,approaches,walkActive,stopCount
 local savedStop=RemoteCatalog.Navigation.Stop
 RemoteCatalog.Navigation.Stop=function(owner) assert(owner=='Chest');stopCount=(stopCount or 0)+1 end
 task.wait=function(dt) clock+=dt;return originalWait(dt) end
 local binding={Chest={},Slot=8,Item='potatoSalad',Amount=17}
 local owner={CanUseChestBinding=function() return usable end}
 local function prepare(options)
  clock=0;qty=0;stock=options.Stock or 90;trace={};usable=true;pending=options.Pending;walking=options.Walk;approaches=0;stopCount=0;walkActive=nil
  if options.Missing then qty=nil end
  binding.Probe=options.Probe
  RemoteCatalog.ChestAutoBatch=30;RemoteCatalog.ChestSpeed='Standard'
  RemoteCatalog.ChestGoal=options.Goal;RemoteCatalog.ChestStockTarget=options.Target;RemoteCatalog.ChestRepeat=options.Repeat==true
  RemoteCatalog.SelectedChestTargets=function() return {{Recorder=owner,Binding=binding}} end
  RemoteCatalog.OwnedTools=function() return {{Name='potatoSalad'}} end
  RemoteCatalog.BaitCount=function() return qty end
  RemoteCatalog.ApproachChest=function(_,active)
   approaches+=1
   if walking then walking=false;walkActive=active;task.wait(.05);return active(),'walk cancelled' end
   return true
  end
  RemoteCatalog.WithdrawCarrots=function(amount,rec,selected)
   assert(rec==owner and selected==binding and not RemoteCatalog.ChestAutoPaused,'a paused run must never issue a new request')
   table.insert(trace,{Amount=amount,At=clock})
   if pending then pending=false;task.wait(.05) end
   if amount>stock then return false,'empty' end
   stock-=amount;qty+=amount;return true
  end
 end
 local function pump(count)
  for _=1,count do assert(worker and coroutine.status(worker)=='suspended','pause fixture worker ended unexpectedly');local ok,e=coroutine.resume(worker);assert(ok,e) end
 end
 local function untilTrue(predicate)
  for _=1,1000 do
   if predicate() then return end
   pump(1)
  end
  assert(predicate(),'pause fixture did not settle')
 end
 assert(not RemoteCatalog.SetChestPaused(true) and not RemoteCatalog.ChestAutoEnabled,'Pause while OFF must never start collection')
 prepare({Stock=90,Goal=90})
 assert(RemoteCatalog.SetChestAuto(true) and qty==30 and #trace==1)
 local co,generation=worker,RemoteCatalog.ChestAutoGeneration
 assert(RemoteCatalog.SetChestPaused(true))
 local pauses=stopCount
 assert(RemoteCatalog.SetChestPaused(true) and RemoteCatalog.SetChestAuto(true),'repeated Pause/ON must keep the same worker')
 pump(40)
 assert(stopCount==pauses and #trace==1 and qty==30 and RemoteCatalog.ChestAutoTotal==30 and worker==co and RemoteCatalog.ChestAutoGeneration==generation,'Pause must retain totals, generation, goal and worker without resending')
 assert(RemoteCatalog.SetChestPaused(false));untilTrue(function() return not RemoteCatalog.ChestAutoWorker end)
 assert(qty==90 and #trace==3 and trace[2].Amount==30 and trace[3].Amount==30 and RemoteCatalog.ChestHistory[1].Outcome=='Goal reached' and not RemoteCatalog.ChestAutoPaused,'Resume must continue the same stack and cumulative goal')
 -- A request sent before Pause is still confirmed exactly once.
 prepare({Stock=60,Goal=60,Pending=true})
 assert(RemoteCatalog.SetChestAuto(true) and RemoteCatalog.ChestBusy and #trace==1 and qty==0)
 assert(RemoteCatalog.SetChestPaused(true));pump(40)
 assert(qty==30 and RemoteCatalog.ChestAutoTotal==30 and #trace==1 and not RemoteCatalog.ChestBusy and RemoteCatalog.ChestAutoPaused,'Pause must let an in-flight transfer settle without losing or duplicating its count')
 assert(RemoteCatalog.SetChestPaused(false));untilTrue(function() return not RemoteCatalog.ChestAutoWorker end)
 assert(qty==60 and #trace==2 and RemoteCatalog.ChestAutoTotal==60)
 -- A pre-request quantity wait must not send when it resolves during Pause.
 prepare({Stock=50,Target=50,Missing=true})
 assert(RemoteCatalog.SetChestAuto(true) and #trace==0)
 assert(RemoteCatalog.SetChestPaused(true));qty=50;pump(20)
 assert(#trace==0 and RemoteCatalog.ChestAutoPaused,'resolved quantity metadata must not bypass Pause')
 assert(RemoteCatalog.SetChestPaused(false));untilTrue(function() return not RemoteCatalog.ChestAutoWorker end)
 assert(#trace==0 and RemoteCatalog.ChestAutoTotal==0 and RemoteCatalog.ChestHistory[1].Outcome=='Inventory targets met','Resume must re-read live inventory before deciding what to withdraw')
 -- Pausing an approach cancels movement and retries reach before any resumed send.
 prepare({Stock=30,Goal=30,Walk=true})
 assert(RemoteCatalog.SetChestAuto(true) and walkActive and walkActive())
 assert(RemoteCatalog.SetChestPaused(true) and not walkActive());pump(20)
 assert(#trace==0 and approaches==1 and RemoteCatalog.ChestAutoPaused,'Pause must cancel navigation without sending at the destination')
 assert(RemoteCatalog.SetChestPaused(false));untilTrue(function() return not RemoteCatalog.ChestAutoWorker end)
 assert(qty==30 and approaches>=2 and #trace==1,'Resume must recheck reach after a cancelled approach')
 -- The repeat countdown freezes, rather than running out behind Pause.
 prepare({Stock=0,Goal=30,Repeat=true,Probe=true})
 assert(RemoteCatalog.SetChestAuto(true));untilTrue(function() return RemoteCatalog.ChestRepeatWaiting end)
 local requests,seconds,pass=#trace,RemoteCatalog.ChestNextScan,RemoteCatalog.ChestAutoPass
 assert(RemoteCatalog.SetChestPaused(true));pump(40)
 assert(#trace==requests and RemoteCatalog.ChestNextScan==seconds and RemoteCatalog.ChestAutoPass==pass,'Pause must freeze Repeat without refreshing slots or sending requests')
 stock=30;local resumedAt=clock
 assert(RemoteCatalog.SetChestPaused(false));untilTrue(function() return not RemoteCatalog.ChestAutoWorker end)
 assert(trace[requests+1].At-resumedAt>=1.8 and trace[requests+1].At-resumedAt<=2.1 and qty==30 and RemoteCatalog.ChestAutoTotal==30,'Resume must finish the remaining repeat wait before continuing the cumulative goal')
 -- Stop can end a paused run and holds ownership through cleanup.
 prepare({Stock=90,Goal=90})
 assert(RemoteCatalog.SetChestAuto(true) and RemoteCatalog.SetChestPaused(true));pump(10)
 requests=#trace
 RemoteCatalog.SetChestAuto(false)
 assert(not RemoteCatalog.ChestAutoPaused and not RemoteCatalog.SetChestPaused(false) and not RemoteCatalog.SetChestAuto(true),'Stop must clear Pause without allowing an overlapping restart')
 drain()
 assert(#trace==requests and not RemoteCatalog.ChestAutoWorker and RemoteCatalog.ChestHistory[1].Outcome=='Stopped' and RemoteCatalog.ChestHistory[1].Total==30)
 -- Resume still validates current session/chest bindings.
 prepare({Stock=60,Goal=60})
 assert(RemoteCatalog.SetChestAuto(true) and RemoteCatalog.SetChestPaused(true));usable=false
 assert(RemoteCatalog.SetChestPaused(false));untilTrue(function() return not RemoteCatalog.ChestAutoWorker end)
 assert(#trace==1 and qty==30 and not RemoteCatalog.ChestAutoPaused,'Resume must not replay an expired binding')
 -- GUI removal cancels a paused worker without needing Resume.
 prepare({Stock=90,Goal=90})
 assert(RemoteCatalog.SetChestAuto(true) and RemoteCatalog.SetChestPaused(true));pump(10)
 requests=#trace;gui.Parent=nil;drain()
 assert(#trace==requests and not RemoteCatalog.ChestAutoWorker and not RemoteCatalog.ChestAutoPaused and not RemoteCatalog.ChestBusy,'GUI cleanup must release a paused worker without another request')
 gui.Parent=true;task.wait=originalWait;RemoteCatalog.Navigation.Stop=savedStop
 RemoteCatalog.ChestAutoBatch=nil;RemoteCatalog.ChestGoal=nil;RemoteCatalog.ChestStockTarget=nil;RemoteCatalog.ChestRepeat=false
end
-- TOO_FAST is a pacing rejection, never evidence of an empty/smaller stack.
do
 local oldWait=task.wait
 local clock,qty,stock,trace,options,lastRequest,firstReject,usable
 task.wait=function(dt) clock+=dt;return oldWait(dt) end
 local binding={Chest={},Slot=8,Item='potatoSalad',Amount=17}
 local owner={CanUseChestBinding=function() return usable end}
 local function prepare(settings)
  options=settings;clock=0;qty=0;stock=settings.Stock or 10000;trace={};lastRequest=-100;firstReject=settings.RejectFirst;usable=true
  binding.Probe=settings.Probe
  RemoteCatalog.ChestRateDelay=nil;RemoteCatalog.ChestCooldown=nil
  RemoteCatalog.ChestClock=function() return clock end
  RemoteCatalog.ChestRequestAt=nil;RemoteCatalog.ChestRateFloor=nil;RemoteCatalog.ChestRateCeiling=nil;RemoteCatalog.ChestRateAccepted=0;RemoteCatalog.ChestRateSuccesses=0
  RemoteCatalog.ChestAutoBatch=settings.Fixed or 'Max';RemoteCatalog.ChestSpeed='Standard';RemoteCatalog.ChestRepeat=false
  RemoteCatalog.ChestGoal=settings.Goal;RemoteCatalog.ChestStockTarget=settings.Target
  RemoteCatalog.SelectedChestTargets=function() return {{Recorder=owner,Binding=binding}} end
  RemoteCatalog.OwnedTools=function() return {{Name='potatoSalad'}} end
  RemoteCatalog.BaitCount=function() return qty end
  RemoteCatalog.ApproachChest=function() return true end
  RemoteCatalog.WithdrawCarrots=function(amount,rec,selected)
   assert(rec==owner and selected==binding and amount<=1000 and not RemoteCatalog.ChestAutoPaused)
   local rejected=options.AlwaysFast or firstReject or options.Interval and clock-lastRequest<options.Interval-1e-6
   firstReject=false;lastRequest=clock
   table.insert(trace,{Amount=amount,At=clock,Rate=rejected})
   if options.Latency then task.wait(options.Latency) end
   if rejected then return false,{success=false,error='TOO_FAST'} end
   if options.RejectAbove and amount>options.RejectAbove then return false,{success=false,error='AMOUNT_TOO_LARGE'} end
   if amount>stock then return false,{success=false,error='INSUFFICIENT_ITEMS'} end
   local gain=math.min(amount,options.Clamp or amount)
   stock-=gain;qty+=gain;return true
  end
 end
 local function pump(count)
  for _=1,count do assert(worker and coroutine.status(worker)=='suspended');local ok,e=coroutine.resume(worker);assert(ok,e) end
 end
 assert(RemoteCatalog.ChestTooFast({success=false,error='TOO_FAST'}) and RemoteCatalog.ChestTooFast({value={code='TOO_FAST'}}))
 local cyclic={error='INSUFFICIENT_ITEMS'};cyclic.value=cyclic
 assert(not RemoteCatalog.ChestTooFast(cyclic) and not RemoteCatalog.ChestTooFast({success=false,error='NOT_ENOUGH_ITEMS'}),'only the known rate error may trigger same-batch pacing retries')
 prepare({Goal=930,Interval=.8})
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(qty==930 and RemoteCatalog.ChestAutoTotal==930 and #trace==8 and math.abs(RemoteCatalog.ChestRateDelay-1)<1e-6,'Max must grow full transfers while returning to its known working request pace: qty='..qty..' calls='..#trace..' delay='..tostring(RemoteCatalog.ChestRateDelay))
 assert(trace[1].Amount==30 and trace[2].Rate and trace[2].Amount==60 and trace[3].Rate and trace[3].Amount==60 and trace[4].Amount==60,'TOO_FAST must retry the exact growth batch instead of halving it')
 assert(trace[5].Amount==120 and trace[6].Amount==240 and trace[7].Amount==480 and trace[8].Amount==480,'confirmed Max batches must continue growing on the same stack')
 for i=4,#trace do if not trace[i].Rate then assert(trace[i].At-trace[i-1].At>=.8-1e-6,'accepted requests must respect the simulated server interval') end end
 prepare({Goal=2930})
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(qty==2930 and #trace==8 and trace[7].Amount==1000 and trace[8].Amount==40,'adaptive Max must cap at 1000 and obey the remaining cumulative goal')
 prepare({Goal=90,Clamp=30})
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(qty==90 and #trace==3 and trace[1].Amount==30 and trace[2].Amount==60 and trace[3].Amount==30,'a partially fulfilled larger request must retain only the observed supported batch')
 prepare({Goal=150,RejectAbove=30})
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(qty==150 and #trace==6 and trace[2].Amount==60,'Max must learn a supported smaller batch after a larger amount is rejected')
 for i=3,#trace do assert(trace[i].Amount==30,'a learned batch ceiling must prevent repeated oversized attempts') end
 prepare({Stock=137})
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(qty==137 and stock==0 and #trace<40 and RemoteCatalog.ChestAutoTotal==137 and binding.Amount==17,'adaptive Max must drain smaller remainders with bounded retries without mutating the captured amount')
 prepare({Goal=90,Fixed=30,Interval=.8})
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(qty==90 and RemoteCatalog.ChestAutoTotal==90)
 for _,request in ipairs(trace) do assert(request.Amount==30,'fixed full-stack batches must not shrink after TOO_FAST') end
 prepare({Goal=31,RejectFirst=true,Probe=true})
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(qty==31 and trace[1].Amount==1 and trace[1].Rate and trace[2].Amount==1 and trace[3].Amount==30,'a throttled probe must be retried rather than incorrectly marking its slot empty')
 prepare({AlwaysFast=true})
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(#trace==5 and qty==0 and RemoteCatalog.ChestAutoTotal==0 and not RemoteCatalog.ChestAutoWorker and string.find(RemoteCatalog.ChestLastDetail,'five attempts',1,true),'persistent TOO_FAST must stop after bounded same-batch attempts')
 for _,request in ipairs(trace) do assert(request.Amount==30) end
 prepare({Goal=30,RejectFirst=true})
 assert(RemoteCatalog.SetChestAuto(true) and RemoteCatalog.ChestCooldown and #trace==1)
 assert(RemoteCatalog.SetChestPaused(true));pump(20)
 assert(#trace==1 and RemoteCatalog.ChestAutoPaused,'Pause must freeze a server cooldown without resending')
 assert(RemoteCatalog.SetChestPaused(false));drain()
 assert(qty==30 and #trace==2 and not RemoteCatalog.ChestCooldown)
 prepare({RejectFirst=true})
 assert(RemoteCatalog.SetChestAuto(true) and RemoteCatalog.ChestCooldown)
 RemoteCatalog.SetChestAuto(false);drain()
 assert(#trace==1 and not RemoteCatalog.ChestCooldown and not RemoteCatalog.ChestAutoWorker,'Stop during a rate cooldown must prevent the pending retry')
 prepare({RejectFirst=true})
 assert(RemoteCatalog.SetChestAuto(true));usable=false;drain()
 assert(#trace==1 and qty==0,'cooldown completion must still validate the live binding before retrying')
 -- A transient four-second delay must not become a permanent per-request pause.
 prepare({Goal=1800,Fixed=30,Interval=.4})
 RemoteCatalog.ChestRateDelay=4;RemoteCatalog.ChestRateSuccesses=0
 assert(RemoteCatalog.SetChestAuto(true) and RemoteCatalog.ChestCooldownKind=='pace')
 for _=1,3000 do if not RemoteCatalog.ChestAutoWorker then break end;pump(1) end
 assert(not RemoteCatalog.ChestAutoWorker and qty==1800 and #trace<75 and RemoteCatalog.ChestRateDelay<1,'stable responses must gradually recover a transient four-second delay without losing transfers')
 assert(math.abs(trace[2].At-trace[1].At-4)<1e-6 and math.abs(trace[4].At-trace[3].At-3.2)<1e-6,'pacing must decrease by twenty percent only after three valid server responses')
 for _,request in ipairs(trace) do assert(request.Amount==30,'recovery must retain the full batch even if the faster probe meets TOO_FAST again') end
 -- Converge near a slower server limit instead of repeatedly jumping back to four seconds.
 prepare({Goal=1800,Fixed=30,Interval=2.8})
 assert(RemoteCatalog.SetChestAuto(true))
 for _=1,5000 do if not RemoteCatalog.ChestAutoWorker then break end;pump(1) end
 assert(not RemoteCatalog.ChestAutoWorker and qty==1800 and RemoteCatalog.ChestAutoTotal==1800,'stable pacing must complete the same full-stack goal against a slower server')
 local initial=false;local retries=0
 for i,request in ipairs(trace) do
  assert(request.Amount==30,'steady-server probing must retain the configured full batch')
  if not request.Rate and i>1 then
   assert(request.At-trace[i-1].At>=2.8-1e-6)
   if RemoteCatalog.ChestRateCeiling then initial=true end
  elseif request.Rate then retries+=1 end
 end
 assert(initial and retries<18 and RemoteCatalog.ChestRateDelay>=2.8 and RemoteCatalog.ChestRateDelay<=3.1,'bounded probing must settle close to the known accepted server interval')
 -- OFF/ON must retain learned server spacing before the next run's first call.
 prepare({Goal=60,Fixed=30,Interval=2.8})
 RemoteCatalog.ChestRateDelay=3
 assert(RemoteCatalog.SetChestAuto(true) and qty==30 and #trace==1)
 RemoteCatalog.SetChestAuto(false);drain()
 RemoteCatalog.ChestGoal=30
 assert(RemoteCatalog.SetChestAuto(true) and #trace==1 and RemoteCatalog.ChestCooldownKind=='pace','an immediate restart must wait the remaining accepted interval before resending')
 for _=1,1000 do if not RemoteCatalog.ChestAutoWorker then break end;pump(1) end
 assert(not RemoteCatalog.ChestAutoWorker and qty==60 and #trace==2 and not trace[2].Rate and trace[2].At-trace[1].At>=3-1e-6,'restart pacing must avoid a new TOO_FAST burst and retain exact confirmed totals')
 -- A failed faster probe reuses the working interval; it need not double to four seconds.
 RemoteCatalog.ChestRateDelay=2.5;RemoteCatalog.ChestRateFloor=2;RemoteCatalog.ChestRateCeiling=3
 assert(RemoteCatalog.ChestBackoff(2.5)==3 and RemoteCatalog.ChestRateFloor==2.5,'TOO_FAST below a known working interval must retry that working interval')
 RemoteCatalog.ChestRateDelay=3;RemoteCatalog.ChestRateSuccesses=0;RemoteCatalog.ChestRateAccepted=0
 for _=1,3 do RemoteCatalog.ObserveChestPace(true,nil,.1,3) end
 assert(RemoteCatalog.ChestRateDelay==2.75,'recovery must bisect the rejected/accepted bracket')
 RemoteCatalog.ChestBackoff(2.75)
 for _=1,3 do RemoteCatalog.ObserveChestPace(true,nil,.1,3) end
 assert(RemoteCatalog.ChestRateDelay==3,'a narrow bracket must hold its working interval rather than continually overshooting')
 for _=1,9 do RemoteCatalog.ObserveChestPace(true,nil,.1,3) end
 assert(not RemoteCatalog.ChestRateFloor and RemoteCatalog.ChestRateDelay<3,'a stale rejection bound must expire after sustained acceptance so changing server load can recover')
 RemoteCatalog.ChestRateDelay=2;RemoteCatalog.ChestRateFloor=.5;RemoteCatalog.ChestRateCeiling=1
 assert(RemoteCatalog.ChestBackoff(1.2)==4 and not RemoteCatalog.ChestRateCeiling,'a rejection above the previous working interval must invalidate that old bound and back off')
 -- Request/confirmation time counts toward the interval rather than adding another full pause.
 prepare({Goal=300,Fixed=30,Interval=.8,Latency=.3})
 assert(RemoteCatalog.SetChestAuto(true))
 for _=1,3000 do if not RemoteCatalog.ChestAutoWorker then break end;pump(1) end
 assert(not RemoteCatalog.ChestAutoWorker and qty==300,'latency-aware pacing must still complete exact-item confirmation and goals')
 local closeGap=false
 for i=2,#trace do
  if not trace[i].Rate then
   local gap=trace[i].At-trace[i-1].At
   assert(gap>=.8-1e-6,'network work must not shorten the actual interval below the simulated server limit')
   if gap<=1.001 then closeGap=true end
  end
 end
 assert(closeGap and clock<14,'accepted request spacing must subtract request work instead of waiting the whole interval again')
 -- Accepted protocol replies, including empty checks, are pacing evidence.
 RemoteCatalog.ChestRateDelay=4;RemoteCatalog.ChestRateSuccesses=0
 RemoteCatalog.ChestRateFloor=nil;RemoteCatalog.ChestRateCeiling=nil;RemoteCatalog.ChestRateAccepted=0
 RemoteCatalog.ObserveChestPace(false,'Stand within 20 studs',.25)
 RemoteCatalog.ObserveChestPace(false,nil,.25)
 assert(RemoteCatalog.ChestRateDelay==4 and RemoteCatalog.ChestRateSuccesses==0,'local/transport errors must never suggest that a shorter server interval is accepted')
 for _=1,3 do RemoteCatalog.ObserveChestPace(false,{success=false,error='INSUFFICIENT_ITEMS'},.25) end
 assert(RemoteCatalog.ChestRateDelay==3.2,'non-throttled empty-slot server replies must let scanning recover too')
 RemoteCatalog.ObserveChestPace(true,nil,.25);RemoteCatalog.ObserveChestPace(false,{success=false,error='TOO_FAST'},.25)
 assert(RemoteCatalog.ChestRateDelay==3.2 and RemoteCatalog.ChestRateSuccesses==0,'a rate rejection must reset the recovery streak')
 assert(RemoteCatalog.ChestBackoff()==4 and RemoteCatalog.ChestRateSuccesses==0,'fresh throttling must still back off within the existing bound')
 RemoteCatalog.ChestRateDelay=.26;RemoteCatalog.ChestRateSuccesses=0
 for _=1,30 do RemoteCatalog.ObserveChestPace(true,nil,.25) end
 assert(RemoteCatalog.ChestRateDelay==.25,'recovery must never go below the selected base pace')
 task.wait=oldWait;RemoteCatalog.ChestClock=nil;RemoteCatalog.ChestRequestAt=nil;RemoteCatalog.ChestRateFloor=nil;RemoteCatalog.ChestRateCeiling=nil;RemoteCatalog.ChestRateAccepted=0;RemoteCatalog.ChestRateDelay=nil;RemoteCatalog.ChestRateSuccesses=0;RemoteCatalog.ChestAutoBatch=nil;RemoteCatalog.ChestGoal=nil;RemoteCatalog.ChestStockTarget=nil
end
-- Balance continuously refilling chests without starving another chest/item.
do
 local oldWait=task.wait
 local clock,qty,trace,stock,settings,blocked,rateOnce,bindings,items,approaches
 local a,b={},{}
 local owner={CanUseChestBinding=function() return true end}
 local a1={Chest=a,Slot=8,Item='carrotHarvested',Amount=30,Id='A8'}
 local a2={Chest=a,Slot=3,Item='potatoSalad',Amount=30,Id='A3'}
 local b1={Chest=b,Slot=1,Item='carrotHarvested',Amount=30,Id='B1'}
 local b2={Chest=b,Slot=2,Item='potatoSalad',Amount=30,Id='B2'}
 task.wait=function(dt) clock+=dt;return oldWait(dt) end
 local function prepare(options)
  settings=options;clock=0;qty={};trace={};stock=options.Stock or {};blocked=options.BlockB;rateOnce=options.RateB;approaches={}
  bindings=options.Multi and {a1,a2,b1,b2} or {a1,b1}
  items={}
  for _,binding in ipairs(bindings) do if not qty[binding.Item] then qty[binding.Item]=0;table.insert(items,{Name=binding.Item}) end end
  RemoteCatalog.ChestOrder=options.Order
  RemoteCatalog.ChestAutoBatch=30;RemoteCatalog.ChestGoal=options.Goal;RemoteCatalog.ChestStockTarget=options.Target;RemoteCatalog.ChestRepeat=options.Repeat==true;RemoteCatalog.ChestTravel=options.Walk and 'Walk' or 'Stay'
  RemoteCatalog.ChestClock=function() return clock end
  RemoteCatalog.ChestRequestAt=nil;RemoteCatalog.ChestRateDelay=nil;RemoteCatalog.ChestRateFloor=nil;RemoteCatalog.ChestRateCeiling=nil;RemoteCatalog.ChestRateSuccesses=0;RemoteCatalog.ChestRateAccepted=0
  RemoteCatalog.SelectedChestTargets=function() local result={};for _,binding in ipairs(bindings) do table.insert(result,{Recorder=owner,Binding=binding}) end;return result end
  RemoteCatalog.OwnedTools=function() return items end
  RemoteCatalog.BaitCount=function(tool) return qty[tool.Name] end
  RemoteCatalog.ApproachChest=function(_,active,binding) table.insert(approaches,binding.Id);return not (blocked and binding.Chest==b),'out of reach' end
  RemoteCatalog.WithdrawCarrots=function(amount,rec,binding)
   assert(rec==owner and amount<=30)
   local rate=rateOnce and binding==b1
   if rate then rateOnce=false end
   table.insert(trace,{Id=binding.Id,Amount=amount,Rate=rate})
   if rate then return false,{success=false,error='TOO_FAST'} end
   local available=stock[binding.Id] or (options.Finite and 0 or math.huge)
   if available<amount then return false,'insufficient' end
   if available~=math.huge then stock[binding.Id]-=amount end
   qty[binding.Item]+=amount;return true
  end
 end
 local function pump(count)
  for _=1,count do assert(worker and coroutine.status(worker)=='suspended');local ok,e=coroutine.resume(worker);assert(ok,e) end
 end
 local function untilTrue(predicate)
  for _=1,1000 do if predicate() then return end;pump(1) end
  assert(predicate(),'balanced queue did not settle')
 end
 prepare({Goal=90}) -- Missing preference must retain the original same-stack default.
 assert(RemoteCatalog.SetChestAuto(true));RemoteCatalog.ChestOrder='Balance chests';drain()
 assert(#trace==3 and trace[1].Id=='A8' and trace[2].Id=='A8' and trace[3].Id=='A8','Same stack must remain the default and its captured preference must not change mid-run')
 prepare({Order='Balance chests',Goal=90})
 assert(RemoteCatalog.SetChestAuto(true));RemoteCatalog.ChestOrder='Same stack';drain()
 assert(#trace==3 and trace[1].Id=='A8' and trace[2].Id=='B1' and trace[3].Id=='A8' and RemoteCatalog.ChestAutoTotal==90,'Balance must give another chest a turn even if the first continually refills, with a frozen mode and cumulative goal')
 prepare({Order='Balance chests',Goal=120,Multi=true,Walk=true})
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(#trace==4 and trace[1].Id=='A8' and trace[2].Id=='B1' and trace[3].Id=='A3' and trace[4].Id=='B2' and qty.carrotHarvested==60 and qty.potatoSalad==60,'Balance must rotate physical chests and their selected item/slot cursors even in Walk mode')
 prepare({Order='Balance chests',Goal=120,Multi=true,RateB=true})
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(#trace==5 and trace[2].Id=='B1' and trace[2].Rate and trace[3].Id=='B1' and trace[3].Amount==30 and trace[4].Id=='A3' and trace[5].Id=='B2','TOO_FAST must retry the same slot/full amount before advancing the balanced queue')
 prepare({Order='Balance chests',Goal=90,BlockB=true,Walk=true})
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(#trace==3 and qty.carrotHarvested==90 and #approaches>=5 and approaches[2]=='B1' and approaches[3]=='A8','an unreachable chest must not trap balanced scheduling or block reachable refills')
 prepare({Order='Balance chests',Multi=true,Target=50})
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(qty.carrotHarvested==50 and qty.potatoSalad==50 and RemoteCatalog.ChestAutoTotal==100 and RemoteCatalog.ChestHistory[1].Outcome=='Inventory targets met','balanced chests sharing an item must obey the live per-item inventory target')
 prepare({Order='Balance chests',Goal=90})
 assert(RemoteCatalog.SetChestAuto(true) and RemoteCatalog.SetChestPaused(true));pump(20)
 assert(#trace==1 and RemoteCatalog.ChestAutoTotal==30,'Pause must hold the balanced cursor without sending to another chest')
 assert(RemoteCatalog.SetChestPaused(false));drain()
 assert(#trace==3 and trace[2].Id=='B1' and trace[3].Id=='A8','Resume must continue the existing balanced queue and totals')
 prepare({Order='Balance chests',Goal=90,Repeat=true,Finite=true,Stock={A8=30,B1=30}})
 assert(RemoteCatalog.SetChestAuto(true));untilTrue(function() return RemoteCatalog.ChestRepeatWaiting end)
 local requests=#trace
 stock.A8=30;stock.B1=30
 drain()
 assert(RemoteCatalog.ChestAutoTotal==90 and trace[requests+1].Id=='A8' and trace[requests+1].Amount==1 and trace[requests+2].Id=='B1' and trace[requests+2].Amount==1 and trace[requests+3].Amount==28,'Repeat must refresh balanced cursors/probes while preserving the remaining cumulative goal')
 prepare({Order='Balance chests',Goal=90})
 assert(RemoteCatalog.SetChestAuto(true));RemoteCatalog.SetChestAuto(false);drain()
 assert(#trace==1 and not RemoteCatalog.ChestAutoWorker and RemoteCatalog.ChestHistory[1].Total==30,'Stop must cancel the pending balanced turn without losing confirmed totals')
 task.wait=oldWait;RemoteCatalog.ChestClock=nil;RemoteCatalog.ChestRequestAt=nil;RemoteCatalog.ChestOrder=nil;RemoteCatalog.ChestGoal=nil;RemoteCatalog.ChestStockTarget=nil;RemoteCatalog.ChestAutoBatch=nil;RemoteCatalog.ChestRepeat=false
 RemoteCatalog.ChestRateDelay=nil;RemoteCatalog.ChestRateFloor=nil;RemoteCatalog.ChestRateCeiling=nil;RemoteCatalog.ChestRateSuccesses=0;RemoteCatalog.ChestRateAccepted=0
end
-- Distant physical chests must not add a one-second delay for every slot.
do
 local oldWait=task.wait
 local clock,total,calls,checks,near=0,0,{}, {},{}
 local a,b,c={},{},{}
 local owner={CanUseChestBinding=function() return true end}
 local targets={}
 for _,chest in ipairs({a,b,c}) do for slot=0,12 do table.insert(targets,{Recorder=owner,Binding={Chest=chest,Slot=slot,Item='carrotHarvested',Amount=30}}) end end
 RemoteCatalog.ChestOrder='Same stack';RemoteCatalog.ChestAutoBatch=30;RemoteCatalog.ChestGoal=30;RemoteCatalog.ChestTravel='Stay';RemoteCatalog.ChestRateDelay=nil;RemoteCatalog.ChestRequestAt=nil
 RemoteCatalog.ChestClock=function() return clock end
 task.wait=function(dt) clock+=dt;return oldWait(dt) end
 RemoteCatalog.SelectedChestTargets=function() return targets end
 RemoteCatalog.OwnedTools=function() return {{Name='carrotHarvested'}} end
 RemoteCatalog.BaitCount=function() return total end
 RemoteCatalog.ApproachChest=function(_,active,binding) checks[binding.Chest]=(checks[binding.Chest] or 0)+1;return near[binding.Chest]==true,'Stay mode: stand within 20 studs' end
 RemoteCatalog.WithdrawCarrots=function(amount,rec,binding) assert(near[binding.Chest]);table.insert(calls,binding);total+=amount;return true end
 near[c]=true
 assert(RemoteCatalog.SetChestAuto(true) and #calls==1 and calls[1].Chest==c and clock<1,'reachable chests must be served immediately after skipping distant groups, without one-second per-slot waits')
 assert(checks[a]==1 and checks[b]==1,'defer all distant slots after one physical-chest preflight')
 drain();assert(total==30 and RemoteCatalog.ChestAutoTotal==30)
 near={};checks={};calls={};total=0;clock=0
 RemoteCatalog.ChestGoal=30;RemoteCatalog.ChestRateDelay=3;RemoteCatalog.ChestRequestAt=0
 assert(RemoteCatalog.SetChestAuto(true) and RemoteCatalog.ChestReachWaiting and #calls==0 and clock==1,'all-distant targets must wait one scan interval, without a server cooldown or fabricated progress')
 assert(checks[a]==1 and checks[b]==1 and checks[c]==1 and not RemoteCatalog.ChestCooldown)
 RemoteCatalog.ChestRateDelay=nil;near[b]=true
 drain()
 assert(#calls==1 and calls[1].Chest==b and total==30 and not RemoteCatalog.ChestReachWaiting,'moving near a deferred chest must resume collection without switching modes or restarting')
 near={};calls={};total=0;clock=0;checks={}
 assert(RemoteCatalog.SetChestAuto(true) and RemoteCatalog.ChestReachWaiting)
 RemoteCatalog.SetChestAuto(false);drain()
 assert(#calls==0 and not RemoteCatalog.ChestReachWaiting and not RemoteCatalog.ChestAutoWorker,'Stop must release the local rescan wait without sending')
 task.wait=oldWait;RemoteCatalog.ChestClock=nil;RemoteCatalog.ChestRequestAt=nil;RemoteCatalog.ChestGoal=nil;RemoteCatalog.ChestAutoBatch=nil;RemoteCatalog.ChestOrder=nil
end
-- Defence at queue construction also prevents repeat/custom target lists from replaying I/O withdrawals.
do
 local io,ordinary={Name='chestMediumIndustrialIO'},{Name='chestSmall'}
 local owner={CanUseChestBinding=function() return true end}
 local blocked={Recorder=owner,Binding={Chest=io,Slot=1,Item='carrotHarvested',Amount=30}}
 local regular={Recorder=owner,Binding={Chest=ordinary,Slot=1,Item='carrotHarvested',Amount=30}}
 local transferred,trace=0,{}
 RemoteCatalog.ChestIncludeConveyor=false;RemoteCatalog.ChestAutoBatch=30;RemoteCatalog.ChestGoal=30;RemoteCatalog.ChestRateDelay=nil;RemoteCatalog.ChestRequestAt=nil
 RemoteCatalog.SelectedChestTargets=function() return {blocked} end
 assert(not RemoteCatalog.SetChestAuto(true) and not RemoteCatalog.ChestAutoWorker and string.find(RemoteCatalog.ChestResultLabel.Text,'Conveyor I/O chests are skipped',1,true),'all-I/O scans must stop with an actionable Skip reason before any request')
 RemoteCatalog.SelectedChestTargets=function() return {blocked,regular} end
 RemoteCatalog.ApproachChest=function() return true end
 RemoteCatalog.OwnedTools=function() return {{Name='carrotHarvested'}} end
 RemoteCatalog.BaitCount=function() return transferred end
 RemoteCatalog.WithdrawCarrots=function(amount,_,binding) assert(binding.Chest~=io);table.insert(trace,binding);transferred+=amount;return true end
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(#trace==1 and trace[1].Chest==ordinary and transferred==30,'mixed scans must still collect regular chests and never withdraw from I/O')
 assert(#RemoteCatalog.ChestAutoStates({blocked},30,true)==0,'repeat probes must also exclude protected I/O')
 RemoteCatalog.ChestIncludeConveyor=true
 assert(#RemoteCatalog.ChestAutoStates({blocked},30,false)==1,'explicit Include must retain the legacy I/O worker path')
 RemoteCatalog.ChestIncludeConveyor=false
end
return 'Chest Auto Max: protected conveyor queues, nearby/deferred groups, same-stack and balanced queues, adaptive batches, server pacing, repeat/top-up, pause/resume, goals, confirmation, Stop and cleanup passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'chest-auto',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
