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
local function chest(name,x) return {Name=name,Parent=blocks,Position=vec(x,0,5)} end
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
return 'Chest memory: offset snapshot, new-server rediscovery, stable request body, invalid/rejected sends and missing endpoint passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'chest-memory',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
