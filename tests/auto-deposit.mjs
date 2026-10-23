import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8').replaceAll('\r\n','\n');
const source=main.slice(main.indexOf('-- AUTO DEPOSIT BEGIN'),main.indexOf('-- AUTO DEPOSIT END'));
const code=`
local mt={}
local function vec(x) return setmetatable({X=x},mt) end
mt.__sub=function(a,b) return vec(a.X-b.X) end
mt.__index=function(a,k) if k=='Magnitude' then return math.abs(a.X) end end
local function tool(name,amount)
 local value={Value=amount}
 return {Name=name,Parent='Backpack',FindFirstChild=function(_,child) return child=='Amount' and value or nil end,Amount=value}
end
local wheat,carrots,logs,axe,bait,seeds,sword=tool('wheat',30),tool('carrotHarvested',12),tool('oakLog',8),tool('ironAxe',1),tool('bait',5),tool('wheatSeeds',9),tool('ironWarAxe',1)
local held=tool('potato',3)
local owned={wheat,carrots,logs,axe,bait,seeds,sword,held}
local root={Position=vec(0)}
local player={Character={FindFirstChild=function(_,n) return n=='HumanoidRootPart' and root or nil end,FindFirstChildOfClass=function() return held end}}
local function chest(name,x,capacity)
 local c={Name=name,Position=vec(x),capacity=capacity}
 function c:FindFirstChild(n) return n=='Contents' and {} or nil end
 return c
end
local full=chest('chestLarge',5,0)
local spare=chest('chestSmall',8,1000)
local io=chest('chestMediumIndustrialIO',2,1000)
local blocks={GetChildren=function() return {io,full,spare} end}
local island={FindFirstChild=function() return blocks end}
local function getPlayerIsland() return island end
local function getPartPosition(c) return c.Position end
local sent={}
local remote={InvokeServer=function(self,body)
 table.insert(sent,body)
 assert(body.action=='deposit' and body.player_tracking_category=='join_from_web' and body.amount==body.tool.Amount.Value,'deposit body must match the confirmed chest transaction shape')
 if body.chest.capacity>0 then body.tool.Parent=nil end
end}
local CONFIG={}
local saves=0
local function savePreferences() saves+=1 end
local enabled=false
local gui={Parent=true}
local COLORS={on=1,off=2,muted=3}
local approached=0
local RemoteCatalog={DepositPage={},ChestTravel='Stay',ChestScanRange=120,OwnedTools=function() return owned end,
 ChestTransactionRemote=function() return remote end,StackAmount=function(t) return t.Amount and t.Amount.Value or 1 end,
 ChestTargetProtected=function(b) return b.Chest.Name=='chestMediumIndustrialIO' end,
 Navigation={Stop=function() end,Approach=function(_,c) approached+=1;root.Position=c.Position;return true end}}
local function label(p) return {Text=p.Text} end
local function button(p) return {Text=p.Text,Activated={Connect=function() return {} end}} end
local function pageHeading() return {} end
local function track(c) return c end
local task={wait=function() end,spawn=function() end}
local UDim2={new=function() return {} end,fromOffset=function() return {} end}
local Enum={TextTruncate={None=0}}
${source}
assert(RemoteCatalog.DepositKind('wheat')=='crop' and RemoteCatalog.DepositKind('oakLog')=='wood' and RemoteCatalog.DepositKind('ironOre')=='ore')
for _,name in ipairs({'ironAxe','stonePickaxe','ironWarAxe','bait','wheatSeeds','saplingOrange','fishingRod','hoe'}) do
 assert(RemoteCatalog.DepositKind(name)==nil,name..' must never be deposited')
end
local items=RemoteCatalog.DepositItems()
assert(#items==2 and items[1].Tool==carrots and items[2].Tool==wheat,'Crops mode takes crops only, never the held tool')
CONFIG.DepositCategory='Wood + ores';assert(#RemoteCatalog.DepositItems()==1);CONFIG.DepositCategory='Crops'
local chests=RemoteCatalog.DepositChests()
assert(#chests==2 and chests[1].Chest==full and chests[2].Chest==spare,'nearest unprotected chests with contents first; conveyor input chests are skipped')
assert(RemoteCatalog.DepositPreview():find('Would deposit 2 stacks',1,true))
local count,message=RemoteCatalog.DepositOnce()
assert(count==42 and not wheat.Parent and not carrots.Parent,'a full chest must spill into the next nearest chest')
assert(#sent==4 and sent[1].chest==full and sent[3].chest==spare,'each stack tries the nearest chest first')
assert(message:find('Deposited 42 items',1,true) and not RemoteCatalog.DepositBusy,'busy flag must clear after a deposit')
assert(approached==0,'chests within 20 studs need no movement')
-- Far chest: Stay never moves; Walk approaches; Fishing never walks away from the water.
wheat.Parent='Backpack';full.Position=vec(60);spare.Position=vec(80);sent={}
count,message=RemoteCatalog.DepositOnce()
assert(count==0 and approached==0 and message:find('Stand within 20 studs',1,true),'Stay mode must not move')
RemoteCatalog.ChestTravel='Walk';enabled=true
count,message=RemoteCatalog.DepositOnce()
assert(count==0 and approached==0,'Fishing must not walk away from the water')
enabled=false
count,message=RemoteCatalog.DepositOnce()
assert(approached>=1 and count==30,'Walk must approach the chest and deposit')
RemoteCatalog.ChestAutoWorker=1
assert(select(2,RemoteCatalog.DepositOnce()):find('chest collection',1,true),'deposit waits for chest collection')
RemoteCatalog.ChestAutoWorker=nil;RemoteCatalog.ChestTransactionRemote=function() return nil end
assert(select(2,RemoteCatalog.DepositOnce()):find('unavailable',1,true))
return 'Auto deposit: item kinds, never-deposit tools, held tool, chest order/protection, spill to next chest, Stay/Walk/Fishing movement rules, conflicts and missing remote passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'auto-deposit',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
