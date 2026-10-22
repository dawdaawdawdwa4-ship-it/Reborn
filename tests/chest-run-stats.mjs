import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const core=main.slice(main.indexOf('-- CHEST AUTO BEGIN'),main.indexOf('-- CHEST AUTO END'));
const guard=main.slice(main.indexOf('-- CHEST CONVEYOR GUARD BEGIN'),main.indexOf('-- CHEST CONVEYOR GUARD END'));
const code=`
local gui={Parent=true}
local COLORS={on=1,off=2}
local RemoteCatalog={ChestAutoButton={},ChestResultLabel={},Navigation={Stop=function(owner) assert(owner=='Chest') end}}
local worker,clock,quantity,calls,request,usable
local task={}
local binding={Chest={Name='chestSmall'},Item='potatoSalad',Amount=30,Slot=8}
local owner={CanUseChestBinding=function() return usable end}
RemoteCatalog.SelectedChestTargets=function() return {{Recorder=owner,Binding=binding}} end
RemoteCatalog.OwnedTools=function() return {{Name='potatoSalad'}} end
RemoteCatalog.BaitCount=function() return quantity end
RemoteCatalog.ApproachChest=function() return true end
RemoteCatalog.ChestClock=function() return clock end
RemoteCatalog.ChestResultText=function(value) return type(value)=='table' and tostring(value.error) or tostring(value) end
RemoteCatalog.WithdrawCarrots=function(amount)
 table.insert(calls,amount);return request(amount)
end
function task.wait(dt) clock+=dt;coroutine.yield() end
function task.spawn(fn) worker=coroutine.create(fn);local ok,e=coroutine.resume(worker);assert(ok,e) end
${guard}
${core}
local function has(text,part) return string.find(text,part,1,true)~=nil end
local function step() if coroutine.status(worker)~='dead' then local ok,e=coroutine.resume(worker);assert(ok,e) end end
local function drain() for _=1,1000 do if coroutine.status(worker)=='dead' then return end;step() end;error('worker stuck') end
local function reset()
 assert(not RemoteCatalog.ChestAutoWorker and not RemoteCatalog.ChestRunMetrics,'metrics or worker leaked')
 clock=0;quantity=0;calls={};usable=true;gui.Parent=true
 RemoteCatalog.ChestGoal=60;RemoteCatalog.ChestAutoBatch=30;RemoteCatalog.ChestSpeed='Fast'
 RemoteCatalog.ChestTravel='Stay';RemoteCatalog.ChestOrder='Same stack';RemoteCatalog.ChestRepeat=false
 RemoteCatalog.ChestStockTarget=nil;RemoteCatalog.ChestRateDelay=nil;RemoteCatalog.ChestRequestAt=nil
 RemoteCatalog.ChestRateFloor=nil;RemoteCatalog.ChestRateCeiling=nil
 request=function(amount) quantity+=amount;return true end
end
local function latest() return RemoteCatalog.ChestHistory[1] end
reset();assert(RemoteCatalog.SetChestAuto(true));drain()
local first=latest()
assert(first.Total==60 and first.Items.potatoSalad==60 and first.Requests==2 and first.RateLimits==0 and first.Outcome=='Goal reached','history must describe real confirmed transfers, not attempted amounts')
assert(math.abs(first.Duration-.2)<.00001 and first.PausedSeconds==0 and first.ActiveSeconds==first.Duration and math.abs(first.ItemsPerMinute-18000)<.001,'unpaused timing must include normal per-request waits')
assert(first.Settings.Batch==30 and first.Settings.Speed=='Fast' and first.Settings.Travel=='Stay' and has(first.Text,'Requests: 2') and has(first.Text,'potatoSalad: 60'))
RemoteCatalog.ChestAutoItems.potatoSalad=999
assert(first.Items.potatoSalad==60,'live counters must not alias completed reports')
reset();RemoteCatalog.SetChestAuto(true)
assert(RemoteCatalog.SetChestPaused(true));clock+=12;step()
assert(#calls==1 and RemoteCatalog.ChestAutoPaused,'pause must retain the actual current run without new requests')
assert(RemoteCatalog.SetChestPaused(false));drain()
assert(latest().Total==60 and latest().Duration>=12 and latest().PausedSeconds>=12 and latest().ActiveSeconds<1,'explicit pauses must be separated from elapsed time')
assert(latest().ItemsPerMinute>3000,'pause duration must not dilute the reported rate excluding pause')
reset();RemoteCatalog.SetChestAuto(true);RemoteCatalog.SetChestPaused(true);clock+=8
RemoteCatalog.SetChestAuto(false);drain()
assert(latest().Outcome=='Stopped' and latest().Total==30 and latest().PausedSeconds>=8 and not RemoteCatalog.ChestRunMetrics,'Stop while paused must close timing and preserve only confirmed gains')
reset()
request=function(amount) task.wait(.5);quantity+=amount;return true end
RemoteCatalog.SetChestAuto(true);RemoteCatalog.SetChestAuto(false);clock+=5;drain()
assert(quantity==30 and latest().Requests==1 and latest().Total==0 and latest().Duration>=5 and latest().Outcome=='Stopped','late transfer responses must remain uncredited after Stop while cleanup time remains visible')
reset();RemoteCatalog.ChestGoal=30
request=function(amount) if #calls==1 then return false,{error='TOO_FAST'} end;quantity+=amount;return true end
RemoteCatalog.SetChestAuto(true);drain()
assert(latest().Total==30 and latest().Requests==2 and latest().RateLimits==1 and calls[1]==calls[2] and latest().ActiveSeconds>.1,'cooldown telemetry must retain real retries, waits and unchanged batch size')
reset();request=function() return false,{error='TOO_FAST'} end
RemoteCatalog.SetChestAuto(true);drain()
assert(latest().Outcome=='Rate limited' and latest().Requests==5 and latest().RateLimits==5 and latest().Total==0 and has(latest().Detail,'five attempts'),'exhausted cooldown must retain its precise stop reason and last result')
reset();quantity=nil;RemoteCatalog.SetChestAuto(true);drain()
assert(latest().Outcome=='Inventory unreadable' and latest().Requests==0 and latest().Total==0 and has(latest().Detail,'Cannot read'),'unreadable inventory must explain that no request was sent')
reset();request=function() error('connection lost') end
RemoteCatalog.SetChestAuto(true);drain()
assert(latest().Outcome=='Needs review' and latest().Requests==1 and latest().Total==0 and has(latest().Detail,'connection lost'),'transport failures must remain reviewable without fabricated gains')
reset();local approach=RemoteCatalog.ApproachChest
RemoteCatalog.ApproachChest=function() error('path unavailable') end
RemoteCatalog.SetChestAuto(true);drain();RemoteCatalog.ApproachChest=approach
assert(latest().Outcome=='Failed' and latest().Requests==0 and has(latest().Detail,'path unavailable'),'unexpected worker errors must retain their original diagnostic detail')
reset();RemoteCatalog.SetChestAuto(true)
RemoteCatalog.ChestAutoBatch='Max';RemoteCatalog.ChestSpeed='Standard';RemoteCatalog.ChestTravel='Walk';RemoteCatalog.ChestOrder='Balance chests';RemoteCatalog.ChestRepeat=true
drain()
assert(latest().Settings.Batch==30 and latest().Settings.Speed=='Fast' and latest().Settings.Travel=='Stay' and latest().Settings.Order=='Same stack' and not latest().Settings.Repeat,'history settings must describe the frozen run, not later control values')
for _,bad in ipairs({0/0,math.huge,'unavailable',false,-1}) do
 reset();RemoteCatalog.SetChestAuto(true)
 RemoteCatalog.ChestRunMetrics.Clock=function() return bad end
 drain()
 assert(latest().Total==60 and latest().Duration==nil and latest().ItemsPerMinute==nil and has(latest().TimingText,'unavailable'),'bad telemetry clocks must not affect transfers or invent timing/rates')
end
reset();RemoteCatalog.SetChestAuto(true);RemoteCatalog.ChestRunMetrics.Clock=function() error('clock failed') end;drain()
assert(latest().Total==60 and not latest().Duration,'throwing telemetry clocks must not fail the worker')
reset();RemoteCatalog.SetChestAuto(true);RemoteCatalog.ChestRunMetrics.LastTime=10;RemoteCatalog.ChestRunMetrics.Clock=function() return 9 end;drain()
assert(latest().Total==60 and not latest().Duration,'backward clocks must leave timing unknown')
reset();RemoteCatalog.SetChestAuto(true);RemoteCatalog.ChestRunMetrics.Clock=function() return 0 end;drain()
assert(latest().Duration==0 and latest().ItemsPerMinute==nil and has(latest().TimingText,'rate unavailable'),'zero duration must not divide by zero or invent a rate')
reset();RemoteCatalog.SetChestAuto(true);RemoteCatalog.ChestRunMetrics.Clock=function() return 1e-320 end;drain()
assert(latest().Duration>0 and latest().ItemsPerMinute==nil,'overflowing rates must remain unavailable instead of displaying infinity')
local history=RemoteCatalog.ChestHistory
local before=#calls
local report=RemoteCatalog.ChestHistoryReport()
assert(#history==5 and has(report,'Newest first') and has(report,'Run 5 / 5') and has(report,'Confirmed inventory gains only') and #calls==before and RemoteCatalog.ChestHistory==history,'whole-history reporting must be bounded and read-only')
RemoteCatalog.ChestHistory={};assert(RemoteCatalog.ChestHistoryReport()==nil,'empty history must not invent a result')
return 'Chest run reports: timing, explicit pauses, cooldowns, settings snapshots, inventory/transport failures, Stop/cleanup, clock faults and read-only exports passed'
`;
const state=await LuauState.createAsync();
try{console.log(await state.loadstring(code,'chest-run-stats',true)());}finally{state.destroy();}
