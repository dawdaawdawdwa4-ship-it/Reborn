import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const source=main.slice(main.indexOf('-- CHEST AUTO BEGIN'),main.indexOf('-- CHEST AUTO END'));
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
assert(sent[1]=='A' and sent[2]=='B','auto must rotate between chests rather than blocking behind the first one')
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
assert(#calls==2 and quantities.wood==4 and quantities.stone==2 and RemoteCatalog.ChestAutoTotal==6,'mixed items must share one combined collection goal')
RemoteCatalog.ChestGoal=nil
assert(RemoteCatalog.ChestHistory[1].Outcome=='Goal reached' and RemoteCatalog.ChestHistory[1].Total==6 and RemoteCatalog.ChestHistory[1].Goal==6,'automatic completion must retain its outcome, total and goal')
local historical=RemoteCatalog.ChestHistory[1]
RemoteCatalog.ChestAutoItems.wood=999
assert(historical.Items.wood==4,'history must snapshot totals instead of retaining mutable run state')
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
return 'Chest Auto Max: batches/remainder, potato salad in varying slots, item-specific inventory confirmation, range wait/resume, one worker, bounded no-progress, Stop/in-flight restart, errors/session/GUI cleanup passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'chest-auto',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
