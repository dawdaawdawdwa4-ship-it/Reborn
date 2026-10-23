import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8').replaceAll('\r\n','\n');
const source=main.slice(main.indexOf('-- REMEMBERED CHESTS BEGIN'),main.indexOf('-- REMEMBERED CHESTS END'));
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
 io.FindFirstChild=function(_,child) return child=='Contents' and {GetChildren=function() return {carrots,stack('stone',0)} end} or nil end
 RemoteCatalog.ContentsChestCache=nil
 local again=RemoteCatalog.ContentsChestRecorder():GetChestBindings()
 assert(#again==1 and again[1].Item=='carrotHarvested' and again[1].Slot==carrotSlot,'a stack keeps its slot id when another stack empties, and zero-amount stacks are skipped')
 RemoteCatalog.FindNamed=nil;RemoteCatalog.ContentsChestCache=nil
 assert(RemoteCatalog.ContentsChestRecorder()==nil,'without the chest remote nothing is offered')
end
return 'Chest memory: offset snapshot, new-server rediscovery, stable request body, invalid/rejected sends and missing endpoint passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'chest-memory',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
