import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8').replaceAll('\r\n','\n');
const source=main.slice(main.indexOf('-- CHEST CONTENTS BEGIN'),main.indexOf('-- CHEST CONTENTS END'));
const code=`
local mt={}
local function vec(x) return setmetatable({X=x},mt) end
mt.__sub=function(a,b) return vec(a.X-b.X) end
mt.__index=function(a,k) if k=='Magnitude' then return math.abs(a.X) end end
local function node(name,children,props)
 local n={Name=name,children=children or {},attributes={}}
 for k,v in pairs(props or {}) do n[k]=v end
 function n:GetChildren() return self.children end
 function n:FindFirstChild(name) for _,c in ipairs(self.children) do if c.Name==name then return c end end end
 function n:GetAttribute(k) return self.attributes[k] end
 return n
end
local function stack(name,amount,attribute)
 local s=node(name,attribute and {} or {node('Amount',nil,{Value=amount})})
 if attribute then s.attributes.Amount=amount end
 return s
end
local salad1=node('chestMediumIndustrialIO',{node('Contents',{stack('potatoSalad',40),stack('carrotHarvested',12,true)})},{Pos=vec(10)})
local salad2=node('chestLarge',{node('Items',{stack('potatoSalad',5)})},{Pos=vec(30)})
local locked=node('chestSmall',{},{Pos=vec(50)})
local blocks=node('Blocks',{salad1,node('grass'),salad2,locked})
local RemoteCatalog={BuildIslandBlocks=function() return blocks end,ResourcePosition=function(chest) return chest.Pos end}
local player={Character={FindFirstChild=function() return {Position=vec(0)} end}}
local copied
local setclipboard=function(text) copied=text;return true end
local toclipboard
local status
local function setStatus(text) status=text end
local COLORS={good=1,warn=2}
${source}
local items,chests,unreadable=RemoteCatalog.ChestContents()
assert(#chests==3 and unreadable==1,'only chests count, and chests without a content folder are reported as unreadable')
assert(items.potatoSalad.Total==45 and items.carrotHarvested.Total==12,'Amount values and attributes must both be read')
local report=RemoteCatalog.ChestContentsReport()
assert(report:find('3 chests',1,true) and report:find('1 without a readable content folder',1,true))
assert(report:find('potatoSalad ×45: chest #1 (chestMediumIndustrialIO, 10 studs) ×40; chest #2 (chestLarge, 30 studs) ×5',1,true),'each item must list its chests, distances and amounts')
assert(report:find('potatoSalad',1,true)<report:find('carrotHarvested',1,true),'largest totals first')
local filtered=RemoteCatalog.ChestContentsReport('CARROT')
assert(filtered:find('carrotHarvested',1,true) and not filtered:find('potatoSalad',1,true),'the filter must be case-insensitive')
RemoteCatalog.CopyChestContents()
assert(copied==report and status=='Chest contents copied')
blocks.children={}
assert(RemoteCatalog.ChestContentsReport():find('No chests found',1,true))
return 'Chest contents: content folders, Amount values/attributes, per-chest listing, sorting, filter, copy and empty island passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'chest-contents',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
