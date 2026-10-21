import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const tracker=main.slice(main.indexOf('-- PROPELLER TRACKER BEGIN'),main.indexOf('-- PROPELLER TRACKER END'));
const run=main.slice(main.indexOf('local function run(myCycle)'),main.indexOf('-- Controls\r\n'));
if (!run.includes('registerCatch(fishName)')) throw new Error('Fishing loop boundary missing');
const code=`
local enabled=false
local gui={Parent=true}
local player={Character={}}
local overlayValues={propellers={},propellerLast={}}
local COLORS={warn=1,muted=2,good=3,gold=4}
local status
local function setStatus(text) status=text end
local cycleId,stops=0,0
local setEnabled
local RemoteCatalog={PropellerLabel={},PropellerInfo={},PropellerGoalLabel={},PropellerHistoryLabel={},PropellerGoalButton={}}
local quantity,now=100,100
local tool={Name='propeller',Parent={}}
RemoteCatalog.OwnedTools=function() return {tool} end
RemoteCatalog.BaitCount=function() return quantity end
${tracker}
RemoteCatalog.PropellerNow=function() return now end
RemoteCatalog.PropellerTimestamp=function() return '2026-10-21 12:00:00 UTC' end
setEnabled=function(state)
 if enabled==state then return end
 enabled=state;cycleId+=1
 if state then RemoteCatalog.StartPropellerRun()
 else stops+=1;RemoteCatalog.PropellerWindow=nil;RemoteCatalog.PropellerPendingWindow=nil end
 RemoteCatalog.RefreshPropellers()
end
RemoteCatalog.StopGoalMode=function(mode) assert(mode=='fishing');setEnabled(false) end
local function has(text,part) return string.find(text,part,1,true)~=nil end
local function catch(amount)
 RemoteCatalog.BeginPropellerCatch(3);quantity+=amount;RemoteCatalog.ConfirmPropellerCatch()
end
assert(RemoteCatalog.PropellerGoal.Limit==nil and #RemoteCatalog.PropellerHistory==0,'goals must start Unlimited with no historical stock inferred')
setEnabled(true);catch(7)
assert(RemoteCatalog.PropellerTotal==7 and RemoteCatalog.PropellerGoal.Progress==7 and enabled and stops==0)
assert(#RemoteCatalog.PropellerHistory==1 and RemoteCatalog.PropellerHistory[1].Amount==7 and RemoteCatalog.PropellerHistory[1].Total==7,'one observed gain must create exactly one history entry with its real amount and total')
RemoteCatalog.RefreshPropellers()
assert(has(RemoteCatalog.PropellerHistoryLabel.Text,'2026-10-21 12:00:00 UTC · +7 · session 7'),'history must show immutable timestamp, actual gain and resulting session total')
assert(not RemoteCatalog.SetPropellerGoal(10),'goal editing must be locked while fishing is ON')
setEnabled(false);assert(RemoteCatalog.SetPropellerGoal(10));setEnabled(true);catch(4)
assert(enabled and RemoteCatalog.PropellerGoal.Progress==4 and RemoteCatalog.PropellerTotal==11,'previous stock/session finds must not satisfy a new run goal')
setEnabled(false);local history=#RemoteCatalog.PropellerHistory
setEnabled(true);assert(RemoteCatalog.PropellerGoal.Progress==0 and #RemoteCatalog.PropellerHistory==history,'OFF to ON must reset run progress while keeping session history')
catch(10)
assert(not enabled and RemoteCatalog.PropellerGoal.Reached and RemoteCatalog.PropellerGoal.Progress==10 and RemoteCatalog.PropellerTotal==21 and has(status,'Propeller goal reached'),'the confirmed threshold must stop fishing and preserve actual session counts')
local stopped=stops
RemoteCatalog.RefreshPropellers();RemoteCatalog.PropellerHistoryReport();RemoteCatalog.PropellerReport()
assert(stops==stopped,'goal completion must be latched across recursive refresh/report calls')
assert(RemoteCatalog.SetPropellerGoal(1));setEnabled(true);catch(3)
assert(not enabled and RemoteCatalog.PropellerGoal.Progress==3 and RemoteCatalog.PropellerHistory[1].Amount==3,'a multi-item gain may overshoot but must never be clamped or counted as one')
for _,bad in ipairs({-1,2,1.5,'10',true,math.huge,0/0}) do assert(not RemoteCatalog.SetPropellerGoal(bad),'unsupported goals must not change the setting') end
assert(RemoteCatalog.PropellerGoal.Limit==1)
RemoteCatalog.ClearPropellerHistory()
assert(RemoteCatalog.PropellerTotal==24 and RemoteCatalog.PropellerGoal.Progress==3 and RemoteCatalog.PropellerGoal.Reached and #RemoteCatalog.PropellerHistory==0,'Clear history must retain session totals and goal state')
assert(RemoteCatalog.SetPropellerGoal(0));setEnabled(true)
local baseline=RemoteCatalog.PropellerTotal
for index=1,55 do now+=1;catch(1) end
assert(#RemoteCatalog.PropellerHistory==50 and RemoteCatalog.PropellerTotal==baseline+55 and RemoteCatalog.PropellerHistory[1].Total==baseline+55 and RemoteCatalog.PropellerHistory[50].Total==baseline+6,'history must retain only the newest 50 gains without truncating totals')
local count=#RemoteCatalog.PropellerHistory
for _=1,5 do RemoteCatalog.PollPropellers() end
assert(#RemoteCatalog.PropellerHistory==count,'repeated samples must not create duplicate loot rows')
RemoteCatalog.ClearPropellerHistory();RemoteCatalog.ResetPropellers()
assert(RemoteCatalog.PropellerTotal==0 and #RemoteCatalog.PropellerHistory==0 and RemoteCatalog.PropellerGoal.Progress==0 and not RemoteCatalog.PropellerWindow and not RemoteCatalog.PropellerPendingWindow)
-- A previous confirmed catch must survive the start of a new, unconfirmed reel.
RemoteCatalog.BeginPropellerCatch(3);RemoteCatalog.ConfirmPropellerCatch();now+=1
RemoteCatalog.BeginPropellerCatch(3);quantity+=1;RemoteCatalog.PollPropellers()
assert(RemoteCatalog.PropellerTotal==1 and #RemoteCatalog.PropellerHistory==1,'a delayed gain from the previous confirmed catch must not be lost at the next reel')
RemoteCatalog.ConfirmPropellerCatch();RemoteCatalog.PollPropellers()
assert(RemoteCatalog.PropellerTotal==1 and #RemoteCatalog.PropellerHistory==1,'overlapping confirmed windows must share their inventory high-water mark')
quantity+=2;RemoteCatalog.PollPropellers()
assert(RemoteCatalog.PropellerTotal==3 and RemoteCatalog.PropellerHistory[1].Amount==2)
RemoteCatalog.BeginPropellerCatch(3);RemoteCatalog.ChestBusy=true;RemoteCatalog.PollPropellers();RemoteCatalog.ChestBusy=false;quantity+=1;RemoteCatalog.ConfirmPropellerCatch()
assert(RemoteCatalog.PropellerTotal==3,'chest overlap must exclude both previous/current windows')
RemoteCatalog.ResetPropellers();RemoteCatalog.BeginPropellerCatch(3);RemoteCatalog.ConfirmPropellerCatch();RemoteCatalog.BeginPropellerCatch(3)
player.Character={};quantity+=1;RemoteCatalog.PollPropellers()
assert(RemoteCatalog.PropellerTotal==0 and not RemoteCatalog.PropellerPendingWindow,'respawn must clear both attribution windows')
RemoteCatalog.PropellerTimestamp=function() error('clock unavailable') end
setEnabled(false);assert(RemoteCatalog.SetPropellerGoal(1));setEnabled(true);catch(1)
assert(not enabled and RemoteCatalog.PropellerTotal==1 and RemoteCatalog.PropellerHistory[1].Timestamp=='timestamp unavailable','clock formatting failure must not drop loot or prevent the goal stop')
RemoteCatalog.ResetPropellers()
assert(RemoteCatalog.PropellerGoal.Limit==1 and not RemoteCatalog.PropellerGoal.Reached and RemoteCatalog.PropellerGoal.Progress==0,'Reset session must keep the selected limit and clear progress/history')
-- Rates use active Fishing time and survive history clearing/OFF periods.
setEnabled(false);assert(RemoteCatalog.SetPropellerGoal(0));RemoteCatalog.ResetPropellers()
now=1000;setEnabled(true);now=1060;catch(4)
local metrics=RemoteCatalog.PropellerStatistics()
assert(metrics.Seconds==60 and metrics.PerHour==240 and metrics.Events==1 and metrics.AverageGap==nil,'stacked gains count items/hour, but a first find has no interval')
now=1090;catch(2);metrics=RemoteCatalog.PropellerStatistics()
assert(metrics.Seconds==90 and metrics.PerHour==240 and metrics.AverageGap==30 and metrics.Events==2)
setEnabled(false);now=1690;metrics=RemoteCatalog.PropellerStatistics()
assert(metrics.Seconds==90 and metrics.PerHour==240,'OFF time cannot dilute the active Fishing rate')
setEnabled(true);now=1720;catch(3);metrics=RemoteCatalog.PropellerStatistics()
assert(metrics.Seconds==120 and metrics.PerHour==270 and metrics.AverageGap==30,'average gaps must exclude the OFF period between sessions')
RemoteCatalog.ClearPropellerHistory();metrics=RemoteCatalog.PropellerStatistics()
assert(metrics.Events==3 and metrics.PerHour==270 and metrics.AverageGap==30,'Clear history must retain aggregate statistics')
assert(has(RemoteCatalog.PropellerReport(),'Propellers/hour: 270.0') and has(RemoteCatalog.PropellerHistoryReport(),'Average between observed gains: 30.0s'),'copied diagnostics must include statistics even after clearing rows')
setEnabled(false);now=2000;RemoteCatalog.ResetPropellers();metrics=RemoteCatalog.PropellerStatistics()
assert(metrics.Seconds==0 and metrics.PerHour==nil and metrics.Events==0 and metrics.AverageGap==nil,'Reset must clear time and intervals without division by zero')
assert(RemoteCatalog.SetPropellerGoal(1))
-- Exercise the real fishing loop: the final fish must register before a
-- propeller goal stops the worker, and no further cast/reel may be sent.
local CONFIG={ActionCooldown=0,ReelTimeout=3,ReelSettleDelay=0,FishingPollInterval=.05}
local baitBusy=false
local lastAction=0
local bobber
local clicks,catches,activeAtCatch,waits=0,0,false,0
local stats={bites=0,missed=0}
local task={wait=function() waits+=1;assert(waits<20,'fishing did not stop at its goal') end}
local function running(token) return enabled and token==cycleId end
local function getBobber() return bobber end
local function waitForTug() return true,false end
local function waitUntil(_,_,predicate) return predicate() end
local function clickOnce() clicks+=1;quantity+=1;bobber=nil;return true end
local function updateBoard() RemoteCatalog.RefreshPropellers() end
local function registerCatch() catches+=1;activeAtCatch=enabled;RemoteCatalog.RefreshPropellers() end
local function hasRodEquipped() error('unexpected extra cast after goal') end
RemoteCatalog.CompleteModeGoal=function() end
${run}
setEnabled(true);bobber={};lastAction=-1000;run(cycleId)
assert(clicks==1 and catches==1 and activeAtCatch and not enabled and RemoteCatalog.PropellerGoal.Reached,'a real confirmed catch must register before the propeller goal stops fishing')
setEnabled(true);RemoteCatalog.BeginPropellerCatch(3);RemoteCatalog.ConfirmPropellerCatch();quantity+=1;bobber={};clicks=0;catches=0;stats.bites=0
run(cycleId)
assert(clicks==0 and catches==0 and stats.bites==0 and not enabled and not RemoteCatalog.PropellerWindow,'a goal reached while flushing the previous catch must prevent the new reel entirely')
return 'Propeller features: timestamped/bounded history, copy/reset/clear semantics, per-run goals, overshoot, stop latching, previous-catch replication, conflicts, clock errors and real-loop stop ordering passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'propeller-features',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
