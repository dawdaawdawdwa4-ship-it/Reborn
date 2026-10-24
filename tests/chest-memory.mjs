import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8').replaceAll('\r\n','\n');
const source=main.slice(main.indexOf('-- REMEMBERED CHESTS BEGIN'),main.indexOf('-- REMEMBERED CHESTS END'));
const targetSource=main.slice(main.indexOf('-- CHEST TARGETS BEGIN'),main.indexOf('-- CHEST TARGETS END'));
const autoSource=main.slice(main.indexOf('-- CHEST AUTO BEGIN'),main.indexOf('-- CHEST AUTO END'));
const code=`
local mt={}
local function vec(x,y,z) return setmetatable({X=x,Y=y,Z=z},mt) end
mt.__sub=function(a,b) return vec(a.X-b.X,a.Y-b.Y,a.Z-b.Z) end
local origin=vec(0,0,0)
local island={}
function island:GetPivot() return {PointToObjectSpace=function(_,p) return p-origin end} end
local children={}
local blocks={GetChildren=function() return children end}
function island:FindFirstChild(name) return name=='Blocks' and blocks or nil end
local function getPlayerIsland() return island end
local function getPartPosition(chest) return chest.Position end
local function chest(name,x,stacks)
 local c={Name=name,Parent=blocks,Position=vec(x,0,5)}
 local contents=stacks and {Name='Contents',Parent=c,children=stacks,GetChildren=function(self) return self.children end}
 if contents then for _,stack in ipairs(stacks) do stack.Parent=contents end end
 function c:FindFirstChild(child) return child=='Contents' and contents or nil end
 return c
end
local function stack(name,amount)
 local value={Value=amount}
 return {Name=name,FindFirstChild=function(_,child) return child=='Amount' and value or nil end}
end
local player={Character={}}
local CONFIG={}
local sent={}
local endpoint={CallServer=function(_,body) table.insert(sent,body);return true end}
local RemoteCatalog={GameEndpoint=function(name) assert(name=='CLIENT_CHEST_TRANSACTION');return endpoint end,
 SendEndpoint=function(e,body) local ok,result=pcall(function() return e:CallServer(body) end);return ok and result~=false,result end}
local function typeof(value) return type(value)=='table' and 'Instance' or type(value) end
${source}
-- A present but empty Contents stack is a local skip, never a request for 0 items.
do
 local emptyChest=chest('chestMediumIndustrialIO',0,{stack('potatoSalad',0)})
 local remote={InvokeServer=function() error('a zero-amount withdrawal must never be sent') end}
 local originalRemote=RemoteCatalog.ChestTransactionRemote
 RemoteCatalog.ChestTransactionRemote=function() return remote end
 local sent,result,origin=RemoteCatalog.SendChestWithdraw(emptyChest,'potatoSalad',5,0)
 assert(not sent and result.error=='EMPTY_SLOT' and origin=='skip','an empty stack is skipped locally')
 RemoteCatalog.ChestTransactionRemote=originalRemote
end
-- Learn on server A: the island sits at the origin.
local salad=chest('chestMediumIndustrialIO',10)
local snapshot=RemoteCatalog.SnapshotChestMemory({{Chest=salad,Slot=3,Item='potatoSalad',Amount=25}})
assert(#snapshot==1 and snapshot[1].X==10 and snapshot[1].Z==5 and snapshot[1].Slot==3 and snapshot[1].Item=='potatoSalad','learned withdrawals must be stored by chest name, island offset, slot and item')
CONFIG.RememberedChests=snapshot
-- Server B: the island is elsewhere and every chest is a new instance.
origin=vec(500,40,-300)
local newSalad,decoy,otherType=chest('chestMediumIndustrialIO',510),chest('chestMediumIndustrialIO',530),chest('chestSmall',510)
newSalad.Position=vec(510,40,-295);decoy.Position=vec(530,40,-295);otherType.Position=vec(510,40,-295)
children={decoy,otherType,newSalad}
local recorder=RemoteCatalog.RememberedChestRecorder()
local bindings=recorder:GetChestBindings()
assert(#bindings==1 and bindings[1].Chest==newSalad and bindings[1].Slot==3 and bindings[1].Item=='potatoSalad','the same chest must be found again on a new server by its island offset')
assert(recorder:WithdrawItems(10,bindings[1]))
assert(#sent==1 and sent[1].chest==newSalad and sent[1].slot==3 and sent[1].item=='potatoSalad' and sent[1].amount==10 and sent[1].action=='withdraw','withdrawal must use the stable game chest request with the learned body shape')
assert(not recorder:WithdrawItems(0,bindings[1]) and #sent==1,'invalid amounts must send nothing')
local generated=recorder:MakeChestTarget(bindings[1],decoy,4)
assert(generated and generated.Chest==decoy and generated.Slot==4 and generated.Item=='potatoSalad','whole-chest discovery must work from remembered templates')
endpoint.CallServer=function() return false end
assert(not recorder:WithdrawItems(5,bindings[1]),'a rejected request must report failure')
RemoteCatalog.GameEndpoint=function() return nil end;RemoteCatalog.RememberedChestCache=nil
assert(RemoteCatalog.RememberedChestRecorder()==nil,'without the game chest request the remembered set stays inactive (learning still works)')
do
 local a={Name='chestA',X=1,Y=0,Z=0,Slot=1,Item='x',Amount=1}
 local b={Name='chestB',X=9,Y=0,Z=0,Slot=2,Item='y',Amount=5}
 local bNew={Name='chestB',X=9,Y=0,Z=0,Slot=2,Item='y',Amount=30}
 local merged=RemoteCatalog.MergeChestMemory({a,b},{bNew})
 assert(#merged==2 and merged[1]==bNew and merged[2]==a,'learning one chest must keep earlier remembered chests and prefer the newest entry')
 local many={}
 for i=1,70 do table.insert(many,{Name='c',X=i,Y=0,Z=0,Slot=1,Item='x',Amount=1}) end
 assert(#RemoteCatalog.MergeChestMemory(many,{})==64,'remembered chests stay capped')
end
-- No learning: stacks come straight from chest Contents and use the field-confirmed request shape.
do
 local invoked={}
 local remote={InvokeServer=function(self,body) table.insert(invoked,body);return true end}
 RemoteCatalog.FindNamed=function(name,class) assert(name=='CLIENT_CHEST_TRANSACTION' and class=='RemoteFunction');return remote end
 local salad,carrots=stack('potatoSalad',42),stack('carrotHarvested',7)
 local io=chest('chestMediumIndustrialIO',0,{salad,carrots})
 local plain=chest('chestSmall',4)
 children={io,plain,{Name='grass',FindFirstChild=function() return nil end}}
 local recorder=RemoteCatalog.ContentsChestRecorder()
 local bindings=recorder:GetChestBindings()
 assert(#bindings==2 and bindings[1].Item=='potatoSalad' and bindings[1].Amount==42 and bindings[1].Slot==1001 and bindings[2].Item=='carrotHarvested','every stack in a readable Contents folder becomes a withdrawal target')
 assert(recorder:WithdrawItems(nil,bindings[1]))
 local body=invoked[1]
 assert(body.chest==io and body.tool==salad and body.amount==42 and body.action=='withdraw' and body.player_tracking_category=='join_from_web','withdrawal must use the confirmed CLIENT_CHEST_TRANSACTION shape with the stack Instance')
 assert(recorder:WithdrawItems(500,bindings[2]) and invoked[2].amount==7,'amounts are capped at the stack size')
 salad.Parent=nil
 assert(not recorder:CanUseChestBinding(bindings[1]),'an emptied stack is no longer a target')
 local carrotSlot=bindings[2].Slot
 local contents=io:FindFirstChild('Contents')
 local empty=stack('stone',0);empty.Parent=contents
 contents.children={carrots,empty}
 RemoteCatalog.ContentsChestCache=nil
 local again=RemoteCatalog.ContentsChestRecorder():GetChestBindings()
 assert(#again==1 and again[1].Item=='carrotHarvested' and again[1].Slot==carrotSlot,'a stack keeps its slot id when another stack empties, and zero-amount stacks are skipped')
 local foreign=chest('chestSmall',8,{carrots})
 assert(not recorder:CanUseChestBinding(bindings[2]),'a stack moved to another chest must invalidate the old binding')
 local requests=#invoked
 local accepted,why,origin=RemoteCatalog.SendChestWithdraw(io,'carrotHarvested',5,0,carrots)
 assert(not accepted and origin=='skip' and #invoked==requests,'a stale stack must never be sent with its former chest')
 local zero,fresh=stack('potatoSalad',0),stack('potatoSalad',11)
 local current=chest('chestSmall',9,{zero,fresh})
 assert(RemoteCatalog.SendChestWithdraw(current,'potatoSalad',30,0))
 assert(#invoked==requests+1 and invoked[#invoked].tool==fresh and invoked[#invoked].amount==11,'a zero stack must not hide a later nonempty stack of the same item')
 assert(RemoteCatalog.SendChestWithdraw(current,'potatoSalad',3,0,carrots))
 assert(invoked[#invoked].chest==current and invoked[#invoked].tool==fresh and invoked[#invoked].amount==3,'a stale supplied stack must resolve only to the matching item in the requested chest')
 local currentBinding={Chest=current,Stack=fresh,Item='potatoSalad'}
 assert(recorder:CanUseChestBinding(currentBinding))
 fresh.Name='wood'
 assert(not recorder:CanUseChestBinding(currentBinding),'a stack whose item changes must invalidate its former item binding')
 fresh.Name='potatoSalad'
 local folder=current:FindFirstChild('Contents')
 current.FindFirstChild=function(_,name) return name=='Contents' and {GetChildren=function() return {} end} or nil end
 assert(not recorder:CanUseChestBinding(currentBinding),'replacing Contents invalidates stacks in the old folder')
 current.FindFirstChild=function(_,name) return name=='Contents' and folder or nil end
 RemoteCatalog.FindNamed=nil;RemoteCatalog.ContentsChestCache=nil
 assert(RemoteCatalog.ContentsChestRecorder()==nil,'without the chest remote nothing is offered')
end
-- Exercise discovery, actual per-stack transport and the collector together.
do
 local gui={Parent=true}
 local COLORS={on=1,off=2,muted=3,good=4,warn=5}
 local function setStatus() end
 local task={}
 local worker,quantity,transfers
 task.wait=function(dt) coroutine.yield(dt) end
 task.spawn=function(fn) worker=coroutine.create(fn);local ok,e=coroutine.resume(worker);assert(ok,e) end
 local function step() local ok,e=coroutine.resume(worker);assert(ok,e) end
 local function drain()
  for _=1,200 do if coroutine.status(worker)=='dead' then return end;step() end
  error('multi-stack collector did not settle')
 end
 player.Character={FindFirstChild=function() return {Position=vec(0,0,0)} end}
 CONFIG.RememberedChests={}
 RemoteCatalog.ChestAutoButton={};RemoteCatalog.ChestResultLabel={};RemoteCatalog.ChestIntro={}
 RemoteCatalog.Navigation={Stop=function() end}
 RemoteCatalog.LiveRecorder=function() return nil end
 RemoteCatalog.ChestTravel='Stay';RemoteCatalog.ChestWhole=false;RemoteCatalog.ChestDiscover=false
 RemoteCatalog.ChestAutoBatch=30;RemoteCatalog.ChestItems={potatoSalad=true}
 RemoteCatalog.ChestResultText=function(value) return tostring(value) end
 RemoteCatalog.ApproachChest=function() return true end
 RemoteCatalog.OwnedTools=function() return {{Name='potatoSalad'}} end
 RemoteCatalog.BaitCount=function() return quantity end
 RemoteCatalog.WithdrawCarrots=function(amount,recorder,binding) return recorder:WithdrawItems(amount,binding) end
 local remote={InvokeServer=function(_,body)
  assert(body.tool.Parent==body.chest:FindFirstChild('Contents') and body.tool.Name=='potatoSalad','the real request must stay on the selected chest and item')
  local value=body.tool:FindFirstChild('Amount');assert(body.amount>0 and body.amount<=value.Value)
  table.insert(transfers,body.amount);value.Value-=body.amount;quantity+=body.amount;return true
 end}
 RemoteCatalog.FindNamed=function() return remote end

 ${targetSource}
 ${autoSource}
 local function prepare(repeatRun)
  quantity=0;transfers={}
  local selected=chest('chestSmall',12,{stack('potatoSalad',0),stack('potatoSalad',20),stack('wood',99),stack('potatoSalad',40)})
  children={selected,chest('chestSmall',15,{stack('potatoSalad',50)})}
  RemoteCatalog.ContentsChestCache=nil;RemoteCatalog.ChestRequestAt=nil;RemoteCatalog.ChestRateDelay=nil
  RemoteCatalog.ChestSelection={Chest=selected,Item='potatoSalad',Slot=-1,FromContents=true}
  RemoteCatalog.ChestRepeat=repeatRun;RemoteCatalog.ChestGoal=repeatRun and 90 or nil
  return selected
 end
 prepare(false)
 assert(RemoteCatalog.SetChestAuto(true));drain()
 assert(quantity==60 and RemoteCatalog.ChestAutoTotal==60 and #transfers==3 and transfers[1]==20 and transfers[2]==30 and transfers[3]==10,'One pass must drain both salad stacks without waiting for Repeat or taking another chest/item')
 assert(RemoteCatalog.ChestHistory[1].Requests==3 and RemoteCatalog.ChestHistory[1].Outcome=='Pass finished')
 local selected=prepare(true)
 assert(RemoteCatalog.SetChestAuto(true))
 for _=1,100 do if RemoteCatalog.ChestRepeatWaiting then break end;step() end
 assert(RemoteCatalog.ChestRepeatWaiting and quantity==60 and #transfers==3,'Repeat must finish both stacks before waiting for refill')
 local contents=selected:FindFirstChild('Contents')
 local refill=stack('potatoSalad',30);refill.Parent=contents;contents.children={refill}
 RemoteCatalog.ContentsChestCache=nil
 drain()
 assert(quantity==90 and RemoteCatalog.ChestAutoTotal==90 and #transfers==5 and transfers[4]==1 and transfers[5]==29,'Repeat must discover the replacement stack and preserve its probe, cumulative goal and item selection')
 assert(not RemoteCatalog.ChestBusy and not RemoteCatalog.ChestAutoWorker and RemoteCatalog.ChestHistory[1].Outcome=='Goal reached')
end
return 'Chest memory: new-server rediscovery, live stack ownership/item checks, nonempty lookup, multi-stack One pass, selected refill Repeat and confirmed totals passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'chest-memory',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
