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
assert(#RemoteCatalog.Entries==148)
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
local craft=node('tIFPj2BFAwqodE','RemoteFunction')
out.children={node('cuWyO3sRPqwiuD','Folder',{craft})}
assert(RemoteCatalog.FindPath('ReplicatedStorage.rbxts_include.node_modules.@rbxts.net.out.cuWyO3sRPqwiuD.tIFPj2BFAwqodE','RemoteFunction')==craft and RemoteCatalog.Refresh()==1,'bait craft endpoint must resolve at its exact path without sending')
out.children={node('rotatedCraftGroup','Folder',{craft})}
assert(RemoteCatalog.FindNamed('tIFPj2BFAwqodE','RemoteFunction')==craft and RemoteCatalog.Refresh()==1,'bait craft lookup must tolerate a changed group')
local salad=node('FiAxD3JcLWBD6I','RemoteFunction')
out.children={node('cuWyO3sRPqwiuD','Folder',{salad})}
assert(RemoteCatalog.FindPath('ReplicatedStorage.rbxts_include.node_modules.@rbxts.net.out.cuWyO3sRPqwiuD.FiAxD3JcLWBD6I','RemoteFunction')==salad,'supplied potato salad endpoint must resolve at its exact path')
assert(RemoteCatalog.Refresh()==1,'new chest endpoint must appear in the catalog')
out.children={node('rotatedChestGroup','Folder',{salad})}
assert(RemoteCatalog.FindNamed('FiAxD3JcLWBD6I','RemoteFunction')==salad and RemoteCatalog.Refresh()==1,'chest lookup must tolerate a changed grouping folder')
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
local absentFood,foodReason=RemoteCatalog.GameEndpoint('CLIENT_EAT_FOOD')
assert(absentFood==nil and foodReason=='Module path not found','missing game API must report why native bait is unavailable')
local CONFIG={PlantType='wheat'}
local bait={Name='bait'}
player={Character={FindFirstChild=function(_,name) if name=='bait' then return bait end end,FindFirstChildOfClass=function() return nil end},FindFirstChildOfClass=function() return nil end}
${plantFunction}
${layoutFunction}
RemoteCatalog.BaitSignalAvailable=function() return type(firesignal)=="function" end
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
responses.ohy6O10QKzyGZE={success=false}
assert(firePlant(cf,'sapling')==false,'structured legacy rejection must not count as success')
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
RemoteCatalog.Recorder={LearnWoodOnly=true}
assert(RemoteCatalog.CallMine(actualBlock,'wood') and inputCalls==1,'automatic wood learning must not block normal axe input')
RemoteCatalog.Recorder=nil
local oldChildren=out.children;out.children={}
assert(RemoteCatalog.CallMine(actualBlock) and inputCalls==2,'changed remote group must use tool input')
out.children=oldChildren
context.RebornCapture.RequestIds.OEzzgCCBzocxJw='current-session'
responses.OEzzgCCBzocxJw=false
assert(not RemoteCatalog.CallMine(actualBlock) and inputCalls==2,'rejected request must not click again')
responses.OEzzgCCBzocxJw=nil
RemoteCatalog.InputMine=nil
RemoteCatalog.Recorder={BaitBinding={Remote={Parent=true,Name='old-bait'}},Bait=function(_,tool) assert(tool==bait);return true end}
assert(applyBait(),'learned bait request must work without old endpoint')
assert(RemoteCatalog.BaitAttemptedBinding==RemoteCatalog.Recorder.BaitBinding,'dispatch must identify the exact template replayed')
RemoteCatalog.Recorder.Bait=function() return false,'denied' end
sent=nil
assert(not applyBait() and sent==nil,'learned bait rejection must not fall back to legacy')
RemoteCatalog.BaitNeedsRefresh=true
local oldActivation=RemoteCatalog.ActivateBait
local refreshAttempts=0
RemoteCatalog.ActivateBait=function(tool) assert(tool==bait);refreshAttempts+=1;return true end
assert(RemoteCatalog.CallBait(bait) and refreshAttempts==1,'an explicitly requested refresh must try normal input on the next call instead of replaying stale binding')
assert(RemoteCatalog.BaitAttemptedBinding==nil,'normal input must not inherit an earlier attempted learned binding')
local freshCalls=0
RemoteCatalog.Recorder.BaitBinding={Remote={Parent=true,Name='fresh-bait'}}
RemoteCatalog.Recorder.Bait=function(_,tool) assert(tool==bait);freshCalls+=1;return true end
assert(RemoteCatalog.CallBait(bait) and freshCalls==1 and refreshAttempts==1 and not RemoteCatalog.BaitNeedsRefresh,'fresh captured binding must clear refresh mode and be used instead of more mouse clicks')

RemoteCatalog.ActivateBait=oldActivation
RemoteCatalog.BaitNeedsRefresh=false
RemoteCatalog.Recorder=nil
local previousRecorder=context.RebornCapture
local globalBaitCalls=0
context.RebornCapture={BaitBinding={},Bait=function(_,tool) assert(tool==bait);globalBaitCalls+=1;return true end}
assert(applyBait() and globalBaitCalls==1,'standalone learned bait binding must survive hub reload')
context.RebornCapture=previousRecorder
local savedLocalRecorder=RemoteCatalog.Recorder
local savedGlobalRecorder=context.RebornCapture
local staleBinding={Remote={Parent=true,Name='old-bait'},ObservedAt=1}
local latestBinding={Remote={Parent=true,Name='yrIxXd1d5bBQji'},ObservedAt=2}
RemoteCatalog.Recorder={BaitBinding=staleBinding,Bait=function() error('stale recorder must not send') end}
local latestSends=0
context.RebornCapture={BaitBinding=latestBinding,Bait=function(_,tool) assert(tool==bait);latestSends+=1;return true end}
RemoteCatalog.BaitNeedsRefresh=true;RemoteCatalog.BaitFailedBinding=staleBinding
assert(RemoteCatalog.CallBait(bait) and latestSends==1 and not RemoteCatalog.BaitNeedsRefresh,'newer standalone recorder must override stale hub binding and clear the failed template')
RemoteCatalog.Recorder=savedLocalRecorder;context.RebornCapture=savedGlobalRecorder
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
context.RebornCapture.AutoReplantState=false
assert(not RemoteCatalog.ServerReplantEnabled(),'accepted manual OFF must override an older cached ON state')
context.RebornCapture.AutoReplantState=true
assert(RemoteCatalog.ServerReplantEnabled(),'accepted manual ON must be recognized')
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
 if module==inventoryDataModule then return {InventoryService={getPlayerInventory=function(self,who) assert(who==player or self==player,'the inventory service is called with the player as a plain or method argument');return {allTools={hiddenAxe,hiddenSeed,hiddenAxe}} end}} end
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
assert(equipBestResourceTool('wood') and woodToolPreference=='Stone axe' and hiddenAxe.Parent==player.Character,'a missing saved axe uses an available axe for this hit without rewriting the saved preference')
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
woodToolPreference='Auto best axe'
local warAxe,stoneAxe={Name='ironWarAxe',Parent=player.Character},{Name='stoneAxe',Parent=player.Character}
local equippedName
local originalEquip=RemoteCatalog.EquipTool
RemoteCatalog.EquipTool=function(tool) equippedName=tool.Name;return true end
RemoteCatalog.OwnedTools=function() return {warAxe,stoneAxe} end
assert(equipBestResourceTool('wood') and equippedName=='stoneAxe','Wood Farm must never pick the mob farm war axe over a real axe')
woodToolPreference='Iron axe';equippedName=nil
assert(equipBestResourceTool('wood') and equippedName=='stoneAxe','an Iron axe preference must not match ironWarAxe')
RemoteCatalog.OwnedTools=function() return {warAxe} end;equippedName=nil
assert(not equipBestResourceTool('wood') and equippedName==nil,'a war axe alone is not a woodcutting tool')
RemoteCatalog.EquipTool=originalEquip;woodToolPreference='Auto best axe'
RemoteCatalog.OwnedTools=allOwned
assert(RemoteCatalog.PlacementAvailable(),'game request module should permit placement without recorder ID')
assert(firePlant(cf,'blueFlowers'))
assert(requestedName=='BLOCK_PLACE_REQUEST' and gameBody.cframe==cf and gameBody.blockType=='blueFlowers','game placement API used incorrectly')
assert(table.find(RemoteCatalog.SeedNames('blueFlowers'),'blueFlowerSeeds'),'metadata seed mapping missing')
;(function()
 local lookup,recorder=RemoteCatalog.PlacementClient,RemoteCatalog.Recorder
 local fallbacks,dispatches=0,0
 RemoteCatalog.Recorder={PlacementBinding={Remote={Parent=true}},Place=function() fallbacks+=1;return true end}
 for _,invalid in ipairs({false,{},123}) do
  RemoteCatalog.PlacementClient=function() return {Get=function() return invalid end} end
  assert(RemoteCatalog.PlacementAvailable() and RemoteCatalog.CallPlacement({}) and fallbacks>0,'broken endpoint lookup must allow a learned placement route')
 end
 RemoteCatalog.PlacementClient=function() return {Get=function() error('missing endpoint') end} end
 local before=fallbacks;assert(RemoteCatalog.CallPlacement({}) and fallbacks==before+1)
 RemoteCatalog.PlacementClient=function() return {Get=function() return {CallServer=function() dispatches+=1;error('transport lost') end} end} end
 before=fallbacks
 local sent,reason,origin=RemoteCatalog.CallPlacement({})
 assert(not sent and origin=='transport' and dispatches==1 and fallbacks==before,'a dispatched native call must never fall back after a transport exception')
 RemoteCatalog.PlacementClient=function() return {Get=function() return {CallServer=function() return {success=false,error='TOO_FAST'} end} end} end
 sent,reason,origin=RemoteCatalog.CallPlacement({})
 assert(not sent and reason.error=='TOO_FAST' and origin=='rejected' and fallbacks==before,'explicit rejection must preserve the server error without duplicate dispatch')
 -- Preserve the recorder's result and origin through the real catalog adapter.
 RemoteCatalog.PlacementClient=function() return nil end
 for _,origin in ipairs({'transport','unavailable','rejected'}) do
  local result={success=false,error='TOO_FAST'}
  local calls=0
  RemoteCatalog.Recorder.Place=function() calls+=1;return false,result,origin end
  local sent,reason,actual=RemoteCatalog.CallPlacement({})
  assert(not sent and reason==result and actual==origin and calls==1,'learned failure origins must survive the adapter without another route or dispatch')
 end
 RemoteCatalog.PlacementClient,RemoteCatalog.Recorder=lookup,recorder
 end)()

assert(setHotbarLayout('stonePickaxe,,,,,,,'))
assert(requestedName=='CLIENT_HOTBAR_LAYOUT_UPDATE' and gameBody.layout=='stonePickaxe,,,,,,,','game hotbar API not used')
do
 local lookup=RemoteCatalog.PlacementClient
 local chestRemote,foodRemote={_testType='Instance',Name='kAnpiAlDrqMuEh'},{_testType='Instance',Name='wKCeyGAO4SqdMY'}
 local endpoints={CLIENT_CHEST_WITHDRAW={instance=chestRemote},CLIENT_EAT_FOOD={instance=foodRemote}}
 RemoteCatalog.PlacementClient=function() return {declarations={CLIENT_EAT_FOOD={},CLIENT_CHEST_WITHDRAW={},lowercase={}},Get=function(_,name) return endpoints[name] or error('unknown') end} end
 local names=RemoteCatalog.RequestDefinitionNames()
 assert(#names==2 and names[1]=='CLIENT_CHEST_WITHDRAW' and names[2]=='CLIENT_EAT_FOOD','request definition names must be listed from the game Requests client')
 assert(RemoteCatalog.RequestDefinitionFor(chestRemote)=='CLIENT_CHEST_WITHDRAW','a renamed remote must map back to its stable definition name')
 assert(RemoteCatalog.RequestDefinitionFor({_testType='Instance',Name='unknown'})==nil,'unknown remotes stay unmapped')
 RemoteCatalog.PlacementClient=function() return nil end
 assert(#RemoteCatalog.RequestDefinitionNames()==0)
 RemoteCatalog.PlacementClient=lookup
end
do
 local lookup,previous=RemoteCatalog.PlacementClient,RemoteCatalog.Recorder
 local used
 RemoteCatalog.Recorder={HotbarBinding={Remote={Parent=true}},Hotbar=function(_,layout) used=layout;return true end}
 RemoteCatalog.PlacementClient=function() return {Get=function() error('definition renamed') end} end
 assert(RemoteCatalog.CallHotbar('ironAxe,,,,,,,') and used=='ironAxe,,,,,,,','a missing game hotbar definition must fall back to the learned request')
 used=nil
 RemoteCatalog.PlacementClient=function() return {Get=function() return {CallServer=function() error('timeout') end} end} end
 assert(not RemoteCatalog.CallHotbar('ironAxe,,,,,,,') and used==nil,'a sent hotbar request must never be repeated through another route')
 RemoteCatalog.PlacementClient,RemoteCatalog.Recorder=lookup,previous
end
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
-- Bait can use the same typed game wrapper as harvest/mining, without captured session IDs.
do
 local nativeCalls,inputCalls=0,0
 local result=true
 local oldEndpoint,oldActivate=RemoteCatalog.GameEndpoint,RemoteCatalog.ActivateBait
 RemoteCatalog.BaitNativeFailed=nil;RemoteCatalog.BaitNeedsRefresh=true
 RemoteCatalog.GameEndpoint=function(name)
  assert(name=='CLIENT_EAT_FOOD','bait must request the documented food endpoint')
  return {CallServer=function(_,body)
   nativeCalls+=1;assert(body.tool==bait and next(body,'tool')==nil,'food request must use the actual tool without copied context fields')
   return result
  end}
 end
 RemoteCatalog.ActivateBait=function() inputCalls+=1;return true end
 assert(RemoteCatalog.CallBait(bait) and nativeCalls==1 and inputCalls==0 and RemoteCatalog.BaitTransport=='game food request','native food endpoint must work without a captured bait binding')
 result={success=false}
 assert(not RemoteCatalog.CallBait(bait) and nativeCalls==2 and inputCalls==0,'rejected native bait must not send another transport in the same attempt')
 assert(RemoteCatalog.CallBait(bait) and nativeCalls==2 and inputCalls==1,'next attempt must fall back rather than retrying a rejected native route indefinitely')
 assert(RemoteCatalog.BaitNativeStatus=='Food request rejected or errored','fallback must preserve the original native-route failure for diagnostics')
 RemoteCatalog.BaitNativeFailed=nil;result=true
 assert(RemoteCatalog.CallBait(bait) and nativeCalls==3,'clearing retry state must allow the native route again')
 RemoteCatalog.GameEndpoint,RemoteCatalog.ActivateBait=oldEndpoint,oldActivate
 RemoteCatalog.BaitNativeFailed=nil
end
do
 local oldLocal,oldGlobal=RemoteCatalog.Recorder,context.RebornCapture
 local valid=false
 local localPlow={PlowBinding={Remote={Parent=true}},CanUsePlowBinding=function() return valid end}
 RemoteCatalog.Recorder=localPlow;context.RebornCapture={}
 assert(not RemoteCatalog.LiveRecorder('PlowBinding'),'stale local plow bindings must not be exposed')
 valid=true;assert(RemoteCatalog.LiveRecorder('PlowBinding')==localPlow,'valid local plow binding must be exposed')
 valid=false
 local globalPlow={PlowBinding={Remote={Parent=true}},CanUsePlowBinding=function() return true end}
 context.RebornCapture=globalPlow
 assert(RemoteCatalog.LiveRecorder('PlowBinding')==globalPlow,'valid standalone plow binding must remain available when the local sample is stale')
 RemoteCatalog.Recorder,context.RebornCapture=oldLocal,oldGlobal
end
return '148 remote entries: missing roots/groups, exact/alternate paths, class checks, legacy lookup, removal and four captured request bindings passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(mock+block+checks,'remote-catalog-tests',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
