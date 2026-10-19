import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const source=main.slice(main.indexOf('-- CHEST AUTO BEGIN'),main.indexOf('-- CHEST AUTO END'));
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
assert(RemoteCatalog.ChestAutoTotal==0 and not RemoteCatalog.ChestAutoEnabled and #calls<=8,'no progress must back off to one and stop after bounded retries')
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
assert(#calls==3 and RemoteCatalog.ChestAutoTotal==0 and next(RemoteCatalog.ChestAutoItems)==nil,'goal still requires inventory confirmation and bounded no-progress retries')
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
 assert(unconfirmed==3 and total==0 and polls>=60,'Fast must retain the full two-second confirmation window and bounded no-progress attempts')
 -- A running worker keeps its captured pace even if external code changes the preference.
 RemoteCatalog.ChestSpeed='Standard';RemoteCatalog.ChestGoal=60;inventory=0;waits={}
 RemoteCatalog.WithdrawCarrots=function(amount) inventory+=amount;return true end
 assert(RemoteCatalog.SetChestAuto(true));RemoteCatalog.ChestSpeed='Fast';drain()
 for _,dt in ipairs(waits) do assert(dt==.6,'pacing must be stable throughout a run') end
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
 assert(#sent==3 and RemoteCatalog.ChestAutoTotal==0 and RemoteCatalog.ChestAutoItems.potatoSalad==nil,'only salad inventory growth can confirm a salad withdrawal')
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
 assert(string.find(RemoteCatalog.ChestLastDetail,'within 2 seconds',1,true),'timeout must explain why the one-item probe could not continue')
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
 assert(#requests==6 and qty.potatoSalad==49 and RemoteCatalog.ChestAutoTotal==0,'top-up still needs exact item confirmation and bounded retries for each selected slot')
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
 resume(30)
 assert(#trace==calls and worker==singleWorker,'repeat wait must send no requests or create another worker')
 stock[3]=60;selected={{Recorder=owner,Binding=moved}}
 RemoteCatalog.ChestAutoBatch=1 -- external edits must not change the active run's batch.
 untilTrue(function() return RemoteCatalog.ChestAutoTotal==120 and RemoteCatalog.ChestRepeatWaiting end)
 assert(RemoteCatalog.ChestAutoPass==2 and worker==singleWorker and trace[calls+1].Slot==3 and trace[calls+1].Amount==1,'repeat must refresh moved slots with one-item probes in the same worker')
 assert(trace[calls+1].At-waitBegan>=5-1e-6 and trace[calls+2].Amount==30,'the next pass must wait five seconds and retain its original thirty-item maximum')
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
return 'Chest Auto Max: thirty-item same-slot batches, repeated refill polling/top-up, cumulative goals, quantity replication, bounded retries, Stop and cleanup passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'chest-auto',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
