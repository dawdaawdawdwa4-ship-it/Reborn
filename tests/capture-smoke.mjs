import fs from 'node:fs';
import {LuauState} from 'luau-web';
const source=fs.readFileSync(new URL('../tools/CaptureRemotes.lua',import.meta.url),'utf8');
const setup=`
local nativeTypeof=typeof
local function typeof(v) return type(v)=='table' and v._type or nativeTypeof(v) end
local logs, environment, calls={}, {}, {}
local clipboard
local setclipboard=function(text) clipboard=text end
local function print(...) table.insert(logs,table.pack(...)) end
local warn=print
local currentMethod='InvokeServer'
local function getnamecallmethod() return currentMethod end
local function getgenv() return environment end
local installedHook
local hookCount, connectionCount=0,0
local game={_type='Instance'}
local keyListener
local disconnected=false
local gamePlayer
function game:GetService(name)
 if name=="Players" then return {LocalPlayer=gamePlayer} end
 return {InputBegan={Connect=function(_,fn)
  connectionCount+=1
  keyListener=fn
  return {Disconnect=function() disconnected=true end}
 end}}
end
local function remote(name)
 return {_type='Instance',ClassName='RemoteFunction',Name=name,Parent=game,IsA=function(_,cls) return cls=='RemoteFunction' end}
end
local function hookmetamethod(_,_,fn)
 hookCount+=1
 installedHook=fn
 return function(object,...)
  table.insert(calls,table.pack(object,...))
  if object.fail then error('original failure') end
  return 'original-result',nil,42
 end
end
local Enum={KeyCode={F8='F8',F9='F9',F10='F10'}}
`;
const checks=`
local capture=environment.RebornCapture
assert(capture and installedHook,'recorder not installed')
assert(capture:CopyAll()==false and clipboard==nil,'empty capture must not overwrite clipboard')
local target=remote('CLIENT_HARVEST_CROP_REQUEST')
local payload={block='wheat',count=3,TrNhTTgExIb1Bg='test-session-id'}
local returned=table.pack(installedHook(target,payload,nil,'last',nil))
assert(returned.n==3 and returned[1]=='original-result' and returned[2]==nil and returned[3]==42,'original returns changed')
assert(#calls==1 and calls[1].n==5 and calls[1][2]==payload and calls[1][4]=='last','original arguments changed')
assert(capture.RequestIds.CLIENT_HARVEST_CROP_REQUEST==nil,'named calls must not populate legacy request IDs')
assert(#capture.Records==1 and string.find(capture.Records[1],'COMPLETE',1,true),'call not recorded')
assert(string.find(capture.Records[1],'nil, "last", nil',1,true),'nil argument positions lost')
installedHook(remote('CLIENT_ISLAND_RESET_REQUEST'),{})
assert(#capture.Records==1 and #calls==2,'unrelated calls must pass through without logging')
local cyclic={};cyclic.self=cyclic
installedHook(target,cyclic)
assert(string.find(capture.Records[2],'INCOMPLETE',1,true),'cycles must be marked incomplete')
keyListener({KeyCode='F8'},false)
installedHook(target,{})
assert(#capture.Records==2 and #calls==4,'pause must still forward game calls')
keyListener({KeyCode='F8'},false)
target.fail=true
assert(not pcall(installedHook,target,{}),'original errors must propagate')
assert(#calls==5,'failing calls must not be duplicated')
target.fail=false
local detached=remote('CLIENT_CAST_FISHING_ROD');detached.Parent=nil
installedHook(detached,{})
assert(string.find(capture.Records[#capture.Records],'INCOMPLETE',1,true),'detached instance not marked')
local part={_type='Instance',Name='Stone',ClassName='Part',Position={X=1,Y=2,Z=3},IsA=function(_,cls) return cls=='BasePart' end,GetDebugId=function() return 'test-debug-id' end}
local mining=remote('OEzzgCCBzocxJw')
installedHook(mining,{TrNhTTgExIb1Bg='test-mining-id',TlSR8Mzd9FLwaZ={block=part}})
assert(capture.RequestIds.OEzzgCCBzocxJw=='test-mining-id','observed per-remote ID missing')
local latest=capture.Records[#capture.Records]
assert(string.find(latest,'DetachedInstance',1,true) and string.find(latest,'Stone',1,true) and string.find(latest,'test-debug-id',1,true),'detached instance metadata missing')
assert(string.find(latest,'Vector3.new(1, 2, 3)',1,true),'detached part position missing')
assert(capture:CopyAll()==true and clipboard==capture:Dump(),'copy-all must include full dump')
for _,record in ipairs(capture.Records) do assert(string.find(clipboard,record,1,true),'record omitted from clipboard') end
local exported=0
capture.Export=function() exported+=1 end
setclipboard=function() error('clipboard unavailable') end
assert(capture:CopyAll()==true and exported==1,'clipboard failure must export instead')
local crop={_type='Instance',Name='wheat',ClassName='Model',Parent=game,IsA=function(_,cls) return cls=='Model' end}
local nextCrop={_type='Instance',Name='wheat',ClassName='Model',Parent=game,IsA=function(_,cls) return cls=='Model' end}
local harvestRemote=remote('CLIENT_HARVEST_CROP_REQUEST')
local harvestArgs
harvestRemote.InvokeServer=function(_,...) harvestArgs=table.pack(...);return true end
local observed={TrNhTTgExIb1Bg='live-harvest-id',TlSR8Mzd9FLwaZ={model=crop,player='current-player',extra=17}}
installedHook(harvestRemote,observed,nil,'preserve-tail')
assert(capture.HarvestBinding and capture.HarvestBinding.Target==crop,'manual harvest binding not learned')
assert(capture:Harvest(nextCrop),'learned crop request did not execute')
assert(harvestArgs.n==3 and harvestArgs[2]==nil and harvestArgs[3]=='preserve-tail','learned argument positions changed')
assert(harvestArgs[1].TlSR8Mzd9FLwaZ.model==nextCrop and observed.TlSR8Mzd9FLwaZ.model==crop,'template mutation or wrong target')
assert(harvestArgs[1].TrNhTTgExIb1Bg=='live-harvest-id' and harvestArgs[1].TlSR8Mzd9FLwaZ.extra==17,'observed context lost')
harvestRemote.InvokeServer=function() return false end
assert(capture:Harvest(nextCrop)==false,'harvest rejection must remain failure')
harvestRemote.Parent=nil
assert(capture:Harvest(nextCrop)==false,'removed remote must not be used')
local updatedRemote=remote('COtnYCOPUThadM')
updatedRemote.Parent={_type='Instance',ClassName='Folder',Name='mEn0GOcgVLtb4o',Parent=game}
local updatedArgs
updatedRemote.InvokeServer=function(_,packet) updatedArgs=packet;return true end
local updatedPacket={iXwUW9mXJ8AVnK='current-crop-session',a1tIHk1Kl9GiE5={model=crop,player='current-player'}}
installedHook(updatedRemote,updatedPacket)
assert(capture.HarvestBinding.Remote==updatedRemote,'new harvest route not recognized')
assert(capture:Harvest(nextCrop),'new harvest payload not replayed')
assert(updatedArgs.iXwUW9mXJ8AVnK=='current-crop-session' and updatedArgs.a1tIHk1Kl9GiE5.model==nextCrop,'new envelope fields or crop target lost')
assert(updatedArgs.a1tIHk1Kl9GiE5.player=='current-player' and updatedPacket.a1tIHk1Kl9GiE5.model==crop,'player context changed or original packet mutated')
assert(updatedArgs.TrNhTTgExIb1Bg==nil,'new request must not be rewritten to old field names')
local rotatedCrop={E6N43ldyV5t9lg='rotated-crop-context',wGquKmyB3mV2Cf={model=crop,player='current-player'}}
installedHook(updatedRemote,rotatedCrop)
assert(capture:Harvest(nextCrop) and updatedArgs.wGquKmyB3mV2Cf.model==nextCrop,'known crop endpoint must support rotated body envelope')
assert(updatedArgs.E6N43ldyV5t9lg=='rotated-crop-context','crop context must be preserved')
updatedRemote.InvokeServer=function() return {success=false} end
assert(not capture:Harvest(nextCrop),'structured crop rejection must remain failure')
updatedRemote.InvokeServer=function(_,packet) updatedArgs=packet;return true end
local hotbarRemote=remote('Gu0tNi2YAOdeYv')
local hotbarPacket={fno9F0nWmx8xVf='new-hotbar-session',P1ZFEJgXWM4k62={layout='woodAxe,wood,sapling,,,,,'}}
local hotbarArgs
hotbarRemote.InvokeServer=function(_,packet) hotbarArgs=packet;return true end
installedHook(hotbarRemote,hotbarPacket)
assert(capture.HotbarBinding and capture.HotbarLayout=='woodAxe,wood,sapling,,,,,','starter hotbar must be learned exactly, including empty slots')
assert(capture:Hotbar('woodenAxe,wood,sapling,,,,,'),'hotbar replay failed')
assert(hotbarArgs.fno9F0nWmx8xVf=='new-hotbar-session' and hotbarArgs.P1ZFEJgXWM4k62.layout=='woodenAxe,wood,sapling,,,,,','new hotbar context or layout lost')
assert(hotbarArgs.E6N43ldyV5t9lg==nil and hotbarPacket.P1ZFEJgXWM4k62.layout=='woodAxe,wood,sapling,,,,,','hotbar envelope rewritten or source packet changed')
hotbarRemote.InvokeServer=function() return {success=false} end
assert(not capture:Hotbar('stoneAxe,,,,,,,'),'hotbar rejection must remain failure')
local fruitRemote=remote('Y6oBjV1u9qIAAS')
local fruitPlayer={_type='Instance',Name='Player',Parent=game}
local fruitTree={_type='Instance',Name='treeOrange',Parent=game}
local fruit={_type='Instance',Name='Fruit',Parent=fruitTree,IsDescendantOf=function(self,m) return self.Parent==m end}
local nextFruitTree={_type='Instance',Name='treeOrange',Parent=game}
local nextFruit={_type='Instance',Name='Fruit',Parent=nextFruitTree,IsDescendantOf=fruit.IsDescendantOf}
local fruitArgs
fruitRemote.InvokeServer=function(_,packet) fruitArgs=packet;return true end
local fruitPacket={E6N43ldyV5t9lg='live-fruit-context',wGquKmyB3mV2Cf={model=fruitTree,fruit=fruit,player=fruitPlayer}}
installedHook(fruitRemote,fruitPacket)
assert(capture.FruitBinding and capture:Fruit(nextFruitTree,nextFruit),'fruit request must be learned')
assert(fruitArgs.E6N43ldyV5t9lg=='live-fruit-context' and fruitArgs.wGquKmyB3mV2Cf.model==nextFruitTree and fruitArgs.wGquKmyB3mV2Cf.fruit==nextFruit,'fruit/tree/context replacement failed')
assert(fruitArgs.wGquKmyB3mV2Cf.player==fruitPlayer and fruitPacket.wGquKmyB3mV2Cf.fruit==fruit,'player context or source fruit mutated')
assert(not capture:Fruit(fruitTree,nextFruit),'fruit from another tree must not be sent')
fruitRemote.InvokeServer=function() return false end;assert(not capture:Fruit(nextFruitTree,nextFruit),'fruit rejection must remain failure')
local axeRemote=remote('qn1PInnZJmfDd1')
local tree={_type='Instance',Name='treeOrange',IsA=function(_,c) return c=='Model' end}
local nextTree={_type='Instance',Name='treeOak',IsA=tree.IsA}
local hitArgs
axeRemote.InvokeServer=function(_,packet) hitArgs=packet;return true end
local hitPacket={E6N43ldyV5t9lg='live-axe-context',wGquKmyB3mV2Cf={block=tree}}
installedHook(axeRemote,hitPacket)
assert(capture.WoodHitBinding and capture:Hit(nextTree,'wood'),'axe binding not learned')
assert(hitArgs.E6N43ldyV5t9lg=='live-axe-context' and hitArgs.wGquKmyB3mV2Cf.block==nextTree,'axe context/target lost')
assert(hitPacket.wGquKmyB3mV2Cf.block==tree,'axe template mutated')
assert(not capture:Hit(nextTree,'mine'),'must not reuse wood binding for mining')
axeRemote.InvokeServer=function() return false end;assert(not capture:Hit(nextTree,'wood'),'axe rejection must remain failure')
local updatedAxe=remote('OAVO4xgiY252ym')
local detachedTree={_type='Instance',Name='tree4',ClassName='Model',IsA=tree.IsA,GetDebugId=function() return 'old-tree-debug-id' end}
local updatedAxeArgs
updatedAxe.InvokeServer=function(_,packet) updatedAxeArgs=packet;return true end
local updatedAxePacket={fno9F0nWmx8xVf='new-live-axe-session',P1ZFEJgXWM4k62={block=detachedTree}}
installedHook(updatedAxe,updatedAxePacket)
assert(capture.WoodHitBinding and capture.WoodHitBinding.Remote==updatedAxe,'new wood endpoint must be learned even when original tree is detached')
assert(capture:Hit(nextTree,'wood'),'new axe payload must execute with an actual tree')
assert(updatedAxeArgs.fno9F0nWmx8xVf=='new-live-axe-session' and updatedAxeArgs.P1ZFEJgXWM4k62.block==nextTree,'new context or actual tree target lost')
assert(updatedAxeArgs.E6N43ldyV5t9lg==nil and updatedAxePacket.P1ZFEJgXWM4k62.block==detachedTree,'new axe envelope or original packet mutated')
updatedAxe.InvokeServer=function() return {success=false} end
assert(not capture:Hit(nextTree,'wood'),'new axe rejection must remain failure')
local newestAxe=remote('T5XIZMc0DxnCFt')
local newestArgs
newestAxe.InvokeServer=function(_,packet) newestArgs=packet;return true end
installedHook(newestAxe,{HrGxW0IGeHngmz='latest-live-context',H3ZxjzDRyU5tvI={block=detachedTree}})
assert(capture:Hit(nextTree,'wood') and newestArgs.HrGxW0IGeHngmz=='latest-live-context' and newestArgs.H3ZxjzDRyU5tvI.block==nextTree,'latest independently rotated envelope must retain its keys and replace detached target')
local futureAxe=remote('futureRandomName')
futureAxe.Parent={Name='futureGroup',Parent={Name='out',Parent=game}}
local held={Name='woodAxe'}
gamePlayer={Character={FindFirstChildOfClass=function() return held end}}
local futureArgs
futureAxe.InvokeServer=function(_,packet) futureArgs=packet;return true end
installedHook(futureAxe,{anotherContext='future-live-context',anotherBody={block=detachedTree}})
assert(capture.WoodHitBinding.Remote==futureAxe and capture:Hit(nextTree,'wood'),'future remote should be learned from block schema and equipped axe')
assert(futureArgs.anotherContext=='future-live-context' and futureArgs.anotherBody.block==nextTree,'future schema/context changed')
held.Name='fishingRod'
local wrongTool=remote('unrelatedRandomName');wrongTool.Parent=futureAxe.Parent
installedHook(wrongTool,{anotherContext='not-a-hit',anotherBody={block=detachedTree}})
assert(capture.WoodHitBinding.Remote==futureAxe,'unrecognized request without matching tool must not replace wood binding')
held.Name='woodPickaxe'
local rock={_type='Instance',Name='rockCoal',Parent=game,IsA=tree.IsA}
local futureMine=remote('futureMiningName');futureMine.Parent=futureAxe.Parent
installedHook(futureMine,{newContext='mining-context',newBody={block=rock}})
assert(capture.MineHitBinding.Remote==futureMine and capture.WoodHitBinding.Remote==futureAxe,'mineral/pickaxe learning must stay separate from wood')
gamePlayer=nil
local settingRemote=remote('nrGQVrxpfb3dKr')
local settingArgs
settingRemote.InvokeServer=function(_,packet) settingArgs=packet;return true end
local settingPacket={E6N43ldyV5t9lg='live-settings-context',wGquKmyB3mV2Cf={name='AutoReplant',value=true}}
installedHook(settingRemote,settingPacket)
assert(capture.AutoReplantBinding and capture:SetAutoReplant(false),'AutoReplant setting not learned')
assert(settingArgs.E6N43ldyV5t9lg=='live-settings-context' and settingArgs.wGquKmyB3mV2Cf.name=='AutoReplant' and settingArgs.wGquKmyB3mV2Cf.value==false,'setting context/value lost')
assert(settingPacket.wGquKmyB3mV2Cf.value==true,'setting template mutated')
settingRemote.InvokeServer=function() return false end;assert(not capture:SetAutoReplant(true),'setting rejection must remain failure')
local placementRemote=remote('u71Y03otNIwj9g')
local placementArgs
placementRemote.InvokeServer=function(_,...) placementArgs=table.pack(...);return true end
local cf={_type='CFrame',GetComponents=function() return 1,2,3,1,0,0,0,1,0,0,0,1 end}
local newCf={_type='CFrame'}
local placementPacket={E6N43ldyV5t9lg='live-placement-id',wGquKmyB3mV2Cf={cframe=cf,blockType='grass',extra=12}}
installedHook(placementRemote,placementPacket,nil,'tail')
assert(capture.PlacementBinding and capture:Place({cframe=newCf,blockType='stone'}),'updated placement binding missing')
assert(placementArgs.n==3 and placementArgs[3]=='tail','placement argument positions changed')
assert(placementArgs[1].E6N43ldyV5t9lg=='live-placement-id' and placementArgs[1].wGquKmyB3mV2Cf.cframe==newCf,'placement session or CFrame lost')
assert(placementArgs[1].wGquKmyB3mV2Cf.blockType=='stone' and placementArgs[1].wGquKmyB3mV2Cf.extra==12,'placement body/context lost')
assert(placementPacket.wGquKmyB3mV2Cf.blockType=='grass','placement source template mutated')
placementRemote.InvokeServer=function() return false end
assert(not capture:Place({cframe=newCf,blockType='stone'}),'placement rejection must remain failure')
local baitTool={_type='Instance',Name='bait',IsA=function(_,cls) return cls=='Tool' end}
local nextBait={_type='Instance',Name='bait',IsA=function(_,cls) return cls=='Tool' end}
local baitRemote=remote('XPQExfDjDSUkYv')
local baitArgs
baitRemote.InvokeServer=function(_,...) baitArgs=table.pack(...);return true end
local baitPacket={E6N43ldyV5t9lg='live-bait-session',wGquKmyB3mV2Cf={tool=baitTool,extra=17}}
installedHook(baitRemote,baitPacket,nil,'tail')
assert(capture.BaitBinding and capture.BaitBinding.Remote==baitRemote,'new bait remote must be learned')
assert(capture:Bait(nextBait),'bait replay failed')
assert(baitArgs.n==3 and baitArgs[3]=='tail','bait argument positions changed')
assert(baitArgs[1].E6N43ldyV5t9lg=='live-bait-session' and baitArgs[1].wGquKmyB3mV2Cf.tool==nextBait,'bait envelope or replacement tool lost')
assert(baitPacket.wGquKmyB3mV2Cf.tool==baitTool,'bait source packet mutated')
baitRemote.InvokeServer=function() return {success=false} end
assert(not capture:Bait(nextBait),'bait rejection must remain failure')
baitRemote.Parent=nil;assert(not capture:Bait(nextBait),'removed bait remote must not be used')
capture.MaxCalls=#capture.Records+1
installedHook(target,{})
assert(not capture.Active,'record limit failed')
local fullCount=#capture.Records
local laterPacket={iXwUW9mXJ8AVnK='new-live-id',a1tIHk1Kl9GiE5={model=crop,player='current-player'}}
installedHook(updatedRemote,laterPacket)
assert(#capture.Records==fullCount and capture:Harvest(nextCrop),'full log must not prevent harvest learning')
assert(updatedArgs.iXwUW9mXJ8AVnK=='new-live-id','full log retained stale request context')
local before=#capture.Records
capture:Stop();installedHook(target,{})
assert(#capture.Records==before,'stop must remain pass-through')
local hookBefore=installedHook
runRecorder();runRecorder()
assert(installedHook==hookBefore and hookCount==1 and connectionCount==1,'rerun must not stack hooks/listeners')
assert(environment.RebornCapture==capture and #capture.Records==before and not capture.Stopped,'rerun must preserve records and resume')
return 'Recorder passed: argument/return preservation, filtering, cycles, pause, errors, detached instances, cap, stop, idempotent restart, detached metadata, request IDs'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(setup+'\nlocal function runRecorder()\n'+source+'\nend\nrunRecorder()\n'+checks,'capture-smoke',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
