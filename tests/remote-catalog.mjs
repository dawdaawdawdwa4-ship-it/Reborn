import fs from 'node:fs';
import {LuauState} from 'luau-web';
const source=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8').replaceAll('\r\n','\n');
const block=source.slice(source.indexOf('-- REMOTE CATALOG BEGIN'),source.indexOf('-- REMOTE CATALOG END'));
const mineFunction=source.slice(source.indexOf('local function fireBlockMine(block)'),source.indexOf('local function fireModelHarvest'));
const plantFunction=source.slice(source.indexOf('local function firePlant(cf, blockType)'),source.indexOf('-- Plant a grid'));
const layoutFunction=source.slice(source.indexOf('local function setHotbarLayout(layoutString)'),source.indexOf('-- Shared tool support'));
const equipFunction=source.slice(source.indexOf('local function equipBestResourceTool(category)'),source.indexOf('local function equipPickaxe()'));
const baitFunction=source.slice(source.indexOf('local function applyBait()'),source.indexOf('local function setBaitEnabled'));
const mock=`
local baseTypeof=typeof
local function typeof(value) return type(value)=="table" and value._testType or baseTypeof(value) end
local function node(name,cls,children)
 local n={Name=name,ClassName=cls,children=children or {}}
 function n:IsA(c) return self.ClassName==c end
 function n:FindFirstChild(name)
  for _,c in ipairs(self.children) do if c.Name==name then return c end end
 end
 function n:GetDescendants()
  local all={}
  for _,c in ipairs(self.children) do
   table.insert(all,c)
   for _,d in ipairs(c:GetDescendants()) do table.insert(all,d) end
  end
  return all
 end
 return n
end
local player
local roots={}
local game={FindFirstChild=function(_,name) return roots[name] end}
`;
const checks=`
assert(#RemoteCatalog.Entries==140)
assert(RemoteCatalog.Refresh()==0,'absent roots must be safe')
local out=node('out','ModuleScript')
local parent=out
for _,name in ipairs({'net','@rbxts','node_modules','rbxts_include'}) do parent=node(name,'Folder',{parent}) end
roots.ReplicatedStorage=node('ReplicatedStorage','ReplicatedStorage',{parent})
assert(RemoteCatalog.Refresh()==0,'missing _NetManaged must be safe')
local fish=node('CLIENT_CAST_FISHING_ROD','RemoteFunction')
out.children={node('_NetManaged','Folder',{fish})}
assert(RemoteCatalog.FindNamed('CLIENT_CAST_FISHING_ROD','RemoteFunction')==fish)
assert(RemoteCatalog.FindNamed('CLIENT_CAST_FISHING_ROD','RemoteEvent')==nil,'class mismatch')
assert(RemoteCatalog.Refresh()==1,'exact path discovery')
out.children={node('renamed-group','Folder',{fish})}
assert(RemoteCatalog.FindNamed('CLIENT_CAST_FISHING_ROD','RemoteFunction')==fish,'alternate grouping')
assert(RemoteCatalog.Refresh()==1,'catalog fallback')
local legacy=node('OEzzgCCBzocxJw','RemoteFunction')
table.insert(out.children,node('ULrMeokpcNr7uD','Folder',{legacy}))
assert(RemoteCatalog.FindLegacy('OEzzgCCBzocxJw')==legacy,'legacy argument route retained')
legacy.ClassName='RemoteEvent'
assert(RemoteCatalog.FindLegacy('OEzzgCCBzocxJw')==nil,'legacy class check')
out.children={}
assert(RemoteCatalog.Refresh()==0,'removed remotes must clear stale references')
for _,e in ipairs(RemoteCatalog.Entries) do assert(e.Instance==nil) end
assert(RemoteCatalog.RequestId('OEzzgCCBzocxJw')==nil,'missing recorder ID must not fall back to old static value')
local context={RebornCapture={RequestIds={OEzzgCCBzocxJw='test-current-session'}}}
getgenv=function() return context end
assert(RemoteCatalog.RequestId('OEzzgCCBzocxJw')=='test-current-session','current per-remote ID not read')
assert(RemoteCatalog.RequestId('different')==nil,'must not reuse IDs across remotes')
local sent
local requests, responses={},{}
local names={'OEzzgCCBzocxJw','ohy6O10QKzyGZE','raqRasAwcny1zh','RZQQNNDRUvfj1N'}
local group=node('ULrMeokpcNr7uD','Folder')
out.children={group}
for _,name in ipairs(names) do
 local remote=node(name,'RemoteFunction')
 function remote:InvokeServer(payload)
  sent=payload;requests[self.Name]=payload
  if responses[self.Name]=='throw' then error('server error') end
  return responses[self.Name]
 end
 table.insert(group.children,remote)
end
local function targetCategory() return 'mine' end
${mineFunction}
local actualBlock={Name='test-block'}
local ok,result=fireBlockMine(actualBlock)
assert(ok,'mining call not forwarded')
assert(sent.TrNhTTgExIb1Bg=='test-current-session' and sent.TlSR8Mzd9FLwaZ.block==actualBlock,'mining must use current ID and actual block Instance')
local CONFIG={PlantType='wheat'}
local bait={Name='bait'}
player={Character={FindFirstChild=function(_,name) if name=='bait' then return bait end end,FindFirstChildOfClass=function() return nil end},FindFirstChildOfClass=function() return nil end}
${plantFunction}
${layoutFunction}
RemoteCatalog.BaitCount=function() return nil end
RemoteCatalog.WithBaitTool=function(tool,callback) return callback() end
local baitInfo={}
local COLORS={warn=1,good=2}
local status
local function setStatus(message) status=message end
${baitFunction}
local cf={Rotation='preserve original CFrame including rotation'}
context.RebornCapture.RequestIds.ohy6O10QKzyGZE='placement-session'
context.RebornCapture.RequestIds.raqRasAwcny1zh='bait-session'
context.RebornCapture.RequestIds.RZQQNNDRUvfj1N='hotbar-session'
assert(firePlant(cf,'saplingOrange'))
assert(requests.ohy6O10QKzyGZE.TrNhTTgExIb1Bg=='placement-session')
assert(requests.ohy6O10QKzyGZE.TlSR8Mzd9FLwaZ.cframe==cf and requests.ohy6O10QKzyGZE.TlSR8Mzd9FLwaZ.blockType=='saplingOrange','placement arguments changed')
assert(applyBait())
assert(requests.raqRasAwcny1zh.TrNhTTgExIb1Bg=='bait-session' and requests.raqRasAwcny1zh.TlSR8Mzd9FLwaZ.tool==bait,'bait must use actual tool and own ID')
local layout='stonePickaxe,stoneAxe,fishingRod,coal,stone,fertilizerBasic,bait,sapling'
assert(setHotbarLayout(layout))
assert(requests.RZQQNNDRUvfj1N.TrNhTTgExIb1Bg=='hotbar-session' and requests.RZQQNNDRUvfj1N.TlSR8Mzd9FLwaZ.layout==layout,'hotbar payload changed')
responses.ohy6O10QKzyGZE=false
assert(firePlant(cf,'sapling')==false,'explicit rejection must not count as success')
responses.ohy6O10QKzyGZE='throw'
assert(firePlant(cf,'sapling')==false,'server error must not escape')
assert(RemoteCatalog.InvokeCaptured('uncaptured',{})==false,'uncaptured action must not send')
context.RebornCapture.RequestIds={};sent=nil
assert(firePlant(cf,'sapling')==false and sent==nil,'placement must not reuse mining ID')
assert(applyBait()==false and sent==nil,'bait must not use stale ID')
assert(setHotbarLayout(layout)==false and sent==nil,'hotbar must not use stale ID')
assert(fireBlockMine(actualBlock)==false and sent==nil,'missing ID must not send stale request')
local inputCalls=0
RemoteCatalog.InputMine=function(target) inputCalls+=1;assert(target==actualBlock);return true end
assert(RemoteCatalog.CallMine(actualBlock) and inputCalls==1,'missing session must use tool input')
local oldChildren=out.children;out.children={}
assert(RemoteCatalog.CallMine(actualBlock) and inputCalls==2,'changed remote group must use tool input')
out.children=oldChildren
context.RebornCapture.RequestIds.OEzzgCCBzocxJw='current-session'
responses.OEzzgCCBzocxJw=false
assert(not RemoteCatalog.CallMine(actualBlock) and inputCalls==2,'rejected request must not click again')
responses.OEzzgCCBzocxJw=nil
RemoteCatalog.InputMine=nil
RemoteCatalog.Recorder={BaitBinding={},Bait=function(_,tool) assert(tool==bait);return true end}
assert(applyBait(),'learned bait request must work without old endpoint')
RemoteCatalog.Recorder.Bait=function() return false,'denied' end
sent=nil
assert(not applyBait() and sent==nil,'learned bait rejection must not fall back to legacy')
RemoteCatalog.Recorder=nil
local previousRecorder=context.RebornCapture
local globalBaitCalls=0
context.RebornCapture={BaitBinding={},Bait=function(_,tool) assert(tool==bait);globalBaitCalls+=1;return true end}
assert(applyBait() and globalBaitCalls==1,'standalone learned bait binding must survive hub reload')
context.RebornCapture=previousRecorder
local oldRecorder=context.RebornCapture
local learnedRemote={Parent=true}
local learnedPlacementCalls=0
context.RebornCapture={PlacementBinding={Remote=learnedRemote},Place=function(_,body) learnedPlacementCalls+=1;assert(body.cframe==cf and body.blockType=='grass');return true end}
assert(RemoteCatalog.PlacementAvailable() and firePlant(cf,'grass') and learnedPlacementCalls==1,'new placement route must work after standalone capture')
context.RebornCapture.Place=function() return false,'denied' end
sent=nil;assert(not firePlant(cf,'grass') and sent==nil,'placement rejection must not retry through legacy')
context.RebornCapture=oldRecorder
local savedContext=context.RebornCapture
local observedTree={Name='treeOrange'}
context.RebornCapture={WoodHitBinding={Remote={Parent=true}},Hit=function(_,tree,category) assert(tree==observedTree and category=='wood');return true end}
assert(RemoteCatalog.CallMine(observedTree,'wood'),'learned axe endpoint must route wood')
context.RebornCapture.Hit=function() return false,'denied' end
sent=nil;assert(not RemoteCatalog.CallMine(observedTree,'wood') and sent==nil,'axe rejection must not replay')
context.RebornCapture={AutoReplantBinding={Remote={Parent=true}},SetAutoReplant=function(_,state) return state end}
assert(RemoteCatalog.SetAutoReplant(true) and RemoteCatalog.ServerAutoReplant==true,'game setting must mark server replant only on acceptance')
assert(not RemoteCatalog.SetAutoReplant(false) and RemoteCatalog.ServerAutoReplant==true,'rejected setting must preserve previous server state')
RemoteCatalog.ServerAutoReplant=nil;context.RebornCapture=savedContext
local hotbarContext=context.RebornCapture
local updatedHotbarCalls=0
context.RebornCapture={HotbarBinding={Remote={Parent=true}},HotbarLayout='woodAxe,wood,sapling,,,,,',Hotbar=function(_,layout)
 updatedHotbarCalls+=1;assert(layout=='woodAxe,wood,sapling,,,,,');return true
end}
assert(RemoteCatalog.WoodHotbarLayout()=='woodAxe,wood,sapling,,,,,','wood layout should preserve starter slots')
assert(RemoteCatalog.CallHotbar(RemoteCatalog.WoodHotbarLayout()) and updatedHotbarCalls==1,'wood layout must route through new hotbar binding')
context.RebornCapture.HotbarLayout='woodPickaxe,,,,,,,'
assert(RemoteCatalog.WoodHotbarLayout()==nil,'mining-only layout must not be applied to wood cutting')
context.RebornCapture=hotbarContext
local requestModule=node('requests','ModuleScript')
local toolModule=node('tool-meta','ModuleScript')
local inventoryDataModule=node('inventory-service','ModuleScript')
table.insert(roots.ReplicatedStorage.children,node('TS','Folder',{node('network','Folder',{requestModule}),node('tool','Folder',{toolModule}),node('inventory','Folder',{inventoryDataModule})}))
local inventoryModule=node('client-inventory-service','ModuleScript')
roots.Players=node('Players','Players',{node('TestPlayer','Player',{node('PlayerScripts','Folder',{node('TS','Folder',{node('inventory','Folder',{inventoryModule})})})})})
local locked=false
player.Name='TestPlayer'
function player:GetAttribute(name) return name=='ToolsLocked' and locked end
function player:FindFirstChild() return nil end
local tool={Parent=nil}
local selected,equipped=0,0
local inventory={hotbar={[0]=tool},selectedHotbarIndex=-1}
function inventory:setSelectedHotbarIndex(index) self.selectedHotbarIndex=index;selected+=1;tool.Parent=player.Character end
function inventory:equipTool(value) equipped+=1;value.Parent=player.Character end
local hiddenAxe={_testType='Instance',Name='ironAxe',IsA=function(_,cls) return cls=='Tool' end}
local hiddenSeed={_testType='Instance',Name='blueFlowerSeeds',IsA=hiddenAxe.IsA}
function player.Character:GetChildren() return {} end
function player.Character:FindFirstChildOfClass(cls) if cls=='Humanoid' then return {} end end
local requestedName, gameBody, response
require=function(module)
 if module==inventoryDataModule then return {InventoryService={getPlayerInventory=function() return {allTools={hiddenAxe,hiddenSeed,hiddenAxe}} end}} end
 if module==inventoryModule then return {ClientInventoryService=inventory} end
 if module==toolModule then return {ToolMeta={blueFlowerSeeds={cropSeed={cropName='blueFlowers'}}}} end
 return {Requests={Client={Get=function(_,name)
  requestedName=name
  return {CallServer=function(_,body) gameBody=body;return response end}
 end}}}
end
assert(RemoteCatalog.EquipTool(tool) and inventory.selectedHotbarIndex==0 and selected==1,'hotbar slot zero must be selectable')
assert(RemoteCatalog.EquipTool(tool) and selected==1 and equipped==0,'an already equipped tool must not be reselected')
locked=true;assert(RemoteCatalog.EquipTool(tool)==false,'tools lock ignored');locked=false
local owned=RemoteCatalog.OwnedTools()
assert(#owned==2 and owned[1]==hiddenAxe,'inventory-only tools must be found and deduplicated')
local woodToolPreference,mineToolPreference='Auto best axe','Auto best pickaxe'
local COLORS={bad=1,warn=2}
${equipFunction}
assert(equipBestResourceTool('wood') and hiddenAxe.Parent==player.Character,'auto wood must equip axe from InventoryService, not just Backpack')
woodToolPreference='Stone axe'
assert(equipBestResourceTool('wood') and woodToolPreference=='Auto best axe' and hiddenAxe.Parent==player.Character,'missing saved axe must recover to an available axe')
woodToolPreference='Iron axe'
assert(equipBestResourceTool('wood') and woodToolPreference=='Iron axe','owned preferred axe should remain selected')
local allOwned=RemoteCatalog.OwnedTools
RemoteCatalog.OwnedTools=function() return {{Name='woodPickaxe'}} end
assert(not equipBestResourceTool('wood'),'axe recovery must never substitute a pickaxe')
for _,name in ipairs({'woodAxe','woodenAxe'}) do
 local starterAxe={Name=name,Parent=player.Character}
 RemoteCatalog.OwnedTools=function() return {starterAxe} end
 woodToolPreference='Wooden axe'
 assert(equipBestResourceTool('wood') and woodToolPreference=='Wooden axe','Wooden axe selection must match both starter naming variants')
 mineToolPreference='Wooden axe'
 assert(equipBestResourceTool('mine') and mineToolPreference=='Wooden axe','Mining must honor explicitly selected axes')
end
RemoteCatalog.OwnedTools=allOwned
assert(RemoteCatalog.PlacementAvailable(),'game request module should permit placement without recorder ID')
assert(firePlant(cf,'blueFlowers'))
assert(requestedName=='BLOCK_PLACE_REQUEST' and gameBody.cframe==cf and gameBody.blockType=='blueFlowers','game placement API used incorrectly')
assert(table.find(RemoteCatalog.SeedNames('blueFlowers'),'blueFlowerSeeds'),'metadata seed mapping missing')
assert(setHotbarLayout('stonePickaxe,,,,,,,'))
assert(requestedName=='CLIENT_HOTBAR_LAYOUT_UPDATE' and gameBody.layout=='stonePickaxe,,,,,,,','game hotbar API not used')
local cropTarget={Name='wheat'}
RemoteCatalog.Recorder={Harvest=function() error('must not use recorder when native API exists') end}
assert(RemoteCatalog.CallHarvest(cropTarget))
assert(requestedName=='CLIENT_HARVEST_CROP_REQUEST' and gameBody.model==cropTarget and gameBody.player==player,'native harvest payload must preserve actual crop/player')
assert(RemoteCatalog.CallMine(actualBlock))
assert(requestedName=='BLOCK_HIT_REQUEST' and gameBody.block==actualBlock,'native mining route missing')
response=false;sent=nil
assert(RemoteCatalog.CallHarvest(cropTarget)==false and sent==nil,'harvest rejection must not replay through recorder')
assert(RemoteCatalog.CallMine(actualBlock)==false and sent==nil,'mining rejection must not replay through legacy')
assert(firePlant(cf,'stone')==false and sent==nil,'game API rejection must not retry through legacy remote')

local gameRequire=require
require=function() error('host require cannot load game ModuleScripts') end
getrenv=function() return {require=gameRequire} end
RemoteCatalog.ModuleCache['ReplicatedStorage.TS.network.requests']=nil
response=true
assert(RemoteCatalog.CallHarvest(cropTarget) and requestedName=='CLIENT_HARVEST_CROP_REQUEST','native game require fallback must restore harvest endpoint')
assert(RemoteCatalog.CallMine(actualBlock) and requestedName=='BLOCK_HIT_REQUEST','native game require fallback must restore wood/mining endpoint')
require=gameRequire;getrenv=nil
return '140 remote entries: missing roots/groups, exact/alternate paths, class checks, legacy lookup, removal and four captured request bindings passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(mock+block+checks,'remote-catalog-tests',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
