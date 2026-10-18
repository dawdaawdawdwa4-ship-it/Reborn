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
local basePlayer={UserId=7,Character={}}
local gamePlayer=basePlayer
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
  if object.originalHandler then return object.originalHandler(...) end
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
gamePlayer=basePlayer
local settingRemote=remote('nrGQVrxpfb3dKr')
local settingArgs
settingRemote.InvokeServer=function(_,packet) settingArgs=packet;return true end
local settingPacket={E6N43ldyV5t9lg='live-settings-context',wGquKmyB3mV2Cf={name='AutoReplant',value=true}}
installedHook(settingRemote,settingPacket)
assert(capture.AutoReplantBinding and capture.AutoReplantState==true,'accepted manual AutoReplant setting must update live state')
assert(capture:SetAutoReplant(false),'AutoReplant setting not learned')
assert(settingArgs.E6N43ldyV5t9lg=='live-settings-context' and settingArgs.wGquKmyB3mV2Cf.name=='AutoReplant' and settingArgs.wGquKmyB3mV2Cf.value==false,'setting context/value lost')
assert(settingPacket.wGquKmyB3mV2Cf.value==true,'setting template mutated')
settingRemote.InvokeServer=function() return false end;assert(not capture:SetAutoReplant(true),'setting rejection must remain failure')
local manualOff={E6N43ldyV5t9lg='live-settings-context',wGquKmyB3mV2Cf={name='AutoReplant',value=false}}
installedHook(settingRemote,settingPacket)
assert(capture.AutoReplantState==true,'manual AutoReplant ON must replace the accepted replay state')
installedHook(settingRemote,manualOff)
assert(capture.AutoReplantState==false,'manual AutoReplant OFF must replace the previous accepted ON state')
local beforeSettingCalls=#calls
settingRemote.originalHandler=function() return false,nil,'rejected',nil end
local rejectedSetting=table.pack(installedHook(settingRemote,settingPacket,nil,'tail',nil))
assert(capture.AutoReplantState==false,'rejected manual setting must preserve accepted OFF state')
assert(rejectedSetting.n==4 and rejectedSetting[1]==false and rejectedSetting[2]==nil and rejectedSetting[3]=='rejected' and rejectedSetting[4]==nil,'setting rejection returns must remain unchanged')
assert(#calls==beforeSettingCalls+1 and calls[#calls].n==5 and calls[#calls][2]==settingPacket and calls[#calls][4]=='tail','recognized setting must forward original arguments exactly once')
settingRemote.originalHandler=function() return {success=false} end
assert(installedHook(settingRemote,settingPacket).success==false and capture.AutoReplantState==false,'structured setting rejection must not update state')
settingRemote.originalHandler=function() error('original setting failure',0) end
beforeSettingCalls=#calls
local settingOK,settingError=pcall(installedHook,settingRemote,settingPacket)
assert(not settingOK and settingError=='original setting failure' and #calls==beforeSettingCalls+1,'recognized setting must preserve the original error without retrying')
assert(capture.AutoReplantState==false,'failed setting must preserve the accepted state')
settingRemote.originalHandler=function(packet)
 packet.wGquKmyB3mV2Cf.value=false
 return nil,nil,42,nil
end
local acceptedSetting=table.pack(installedHook(settingRemote,settingPacket))
assert(acceptedSetting.n==4 and acceptedSetting[1]==nil and acceptedSetting[2]==nil and acceptedSetting[3]==42 and acceptedSetting[4]==nil,'recognized setting must preserve all accepted returns, including nils')
assert(capture.AutoReplantState==true,'accepted state must use the observed value before the original call mutated its packet')
settingPacket.wGquKmyB3mV2Cf.value=true
settingRemote.originalHandler=nil
installedHook(settingRemote,{E6N43ldyV5t9lg='live-settings-context',wGquKmyB3mV2Cf={name='OtherSetting',value=false}})
assert(capture.AutoReplantState==true,'unrecognized settings must not affect AutoReplant state')
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
local currentBaitRemote=remote('wKCeyGAO4SqdMY')
local currentBaitArgs
currentBaitRemote.InvokeServer=function(_,packet) currentBaitArgs=packet;return true end
local currentBaitPacket={HrGxW0IGeHngmz='current-bait-context',H3ZxjzDRyU5tvI={tool=baitTool,extra=42}}
installedHook(currentBaitRemote,currentBaitPacket)
assert(capture:Bait(nextBait),'current bait request must be learned')
assert(currentBaitArgs.HrGxW0IGeHngmz=='current-bait-context' and currentBaitArgs.H3ZxjzDRyU5tvI.tool==nextBait and currentBaitArgs.H3ZxjzDRyU5tvI.extra==42,'current bait envelope must preserve context and replace actual tool')
assert(currentBaitPacket.H3ZxjzDRyU5tvI.tool==baitTool,'current bait capture must remain immutable')
currentBaitRemote.InvokeServer=function() return {success=false} end
assert(not capture:Bait(nextBait),'current bait rejection must remain a failure')
local rotatedBait=remote('GDbJa5Ix6UZ8mg')
local rotatedArgs
rotatedBait.InvokeServer=function(_,packet) rotatedArgs=packet;return true end
installedHook(rotatedBait,{o2PTfAjMDqKi5j='new-session-context',YcuvKDybdDE9ik={tool=baitTool}})
assert(capture:Bait(nextBait) and rotatedArgs.o2PTfAjMDqKi5j=='new-session-context' and rotatedArgs.YcuvKDybdDE9ik.tool==nextBait,'new bait endpoint and independently rotating body keys must preserve context')
local futureBait=remote('unknown-future-bait-alias')
futureBait.Name='randomFutureAlias';futureBait.Parent={Parent={Name='out'}}
futureBait.InvokeServer=rotatedBait.InvokeServer
installedHook(futureBait,{contextKey='future-context',payloadKey={tool=baitTool}})
assert(capture:Bait(nextBait) and rotatedArgs.contextKey=='future-context' and rotatedArgs.payloadKey.tool==nextBait,'future bait alias must be learned by concrete tool payload under out')
local goodBinding=capture.BaitBinding
installedHook(futureBait,{contextKey='other-tool',payloadKey={tool=nextTree}})
assert(capture.BaitBinding==goodBinding,'non-bait payload must never replace bait binding')
capture.MaxCalls=#capture.Records+1
installedHook(target,{})
assert(not capture.Active,'record limit failed')
local fullCount=#capture.Records
local laterPacket={iXwUW9mXJ8AVnK='new-live-id',a1tIHk1Kl9GiE5={model=crop,player='current-player'}}
installedHook(updatedRemote,laterPacket)
assert(#capture.Records==fullCount and capture:Harvest(nextCrop),'full log must not prevent harvest learning')
assert(updatedArgs.iXwUW9mXJ8AVnK=='new-live-id','full log retained stale request context')
local berryRemote=remote('UctIHHAfsCxxzj')
local berryArgs
berryRemote.InvokeServer=function(_,packet) berryArgs=packet;return true end
installedHook(berryRemote,{HrGxW0IGeHngmz='berry-session',H3ZxjzDRyU5tvI={model=crop,player='current-player'}})
assert(capture:Harvest(nextCrop) and berryArgs.HrGxW0IGeHngmz=='berry-session' and berryArgs.H3ZxjzDRyU5tvI.model==nextCrop,'new berry envelope must retain context and replace target')
local before=#capture.Records
capture:Stop();installedHook(target,{})
assert(#capture.Records==before,'stop must remain pass-through')
local hookBefore=installedHook
runRecorder();runRecorder()
assert(installedHook==hookBefore and hookCount==1 and connectionCount==1,'rerun must not stack hooks/listeners')
assert(environment.RebornCapture==capture and #capture.Records==before and not capture.Stopped,'rerun must preserve records and resume')
capture.WoodHitBinding=nil
capture:Resume();capture.Active=false;capture.LearnWoodOnly=true
local quietCount=#capture.Records
installedHook(baitRemote,baitPacket)
assert(not capture.WoodHitBinding and capture.LearnWoodOnly and #capture.Records==quietCount,'wood learning must not log unrelated calls')
installedHook(newestAxe,{HrGxW0IGeHngmz='fresh-session',H3ZxjzDRyU5tvI={block=tree}})
assert(capture.Stopped and not capture.LearnWoodOnly and #capture.Records==quietCount,'wood learning must stop after its first binding without logging')
assert(capture:Hit(nextTree,'wood') and newestArgs.HrGxW0IGeHngmz=='fresh-session' and newestArgs.H3ZxjzDRyU5tvI.block==nextTree,'quiet learning must retain fresh context and allow later tree hits')
local staleWood=capture.WoodHitBinding
newestAxe.Parent=nil
capture:Resume();capture.Active=false;capture.LearnWoodOnly=true
installedHook(mining,{TrNhTTgExIb1Bg='manual-mining-context',TlSR8Mzd9FLwaZ={block=rock}})
assert(capture.LearnWoodOnly and not capture.Stopped and capture.WoodHitBinding==staleWood,'unrelated mining must not finish quiet wood learning with a stale binding')
assert(#capture.Records==quietCount,'quiet wood learning must not log the unrelated mining call')
newestAxe.Parent=game
installedHook(newestAxe,{HrGxW0IGeHngmz='refreshed-wood-session',H3ZxjzDRyU5tvI={block=tree}})
assert(capture.Stopped and not capture.LearnWoodOnly and capture.WoodHitBinding~=staleWood,'a fresh valid wood binding must finish quiet learning')
assert(capture:Hit(nextTree,'wood') and newestArgs.HrGxW0IGeHngmz=='refreshed-wood-session','quiet learning must replace stale wood context before reuse')
capture:Resume();capture.Active=false;capture.LearnBaitOnly=true;capture.BaitBinding=nil
local quietBaitCount=#capture.Records
installedHook(target,{})
assert(capture.LearnBaitOnly and not capture.BaitBinding and #capture.Records==quietBaitCount,'automatic bait learning must ignore unrelated requests without logging')
installedHook(rotatedBait,{o2PTfAjMDqKi5j='quiet-live-context',YcuvKDybdDE9ik={tool=baitTool}})
assert(capture.Stopped and not capture.LearnBaitOnly and #capture.Records==quietBaitCount,'automatic bait learner must stop after acquiring one template')
assert(capture:Bait(nextBait) and rotatedArgs.o2PTfAjMDqKi5j=='quiet-live-context','quiet learned binding must remain usable after capture stops')
capture:Resume()
local latestBait=remote('yrIxXd1d5bBQji')
latestBait.Parent={Name='skLtAq4BgI4AnK',Parent={Name='out',Parent=game}}
local latestPacket
latestBait.InvokeServer=function(_,packet) latestPacket=packet;return true end
installedHook(latestBait,{GzIfeyeyrx62Dp='latest-live-context',KjPN9j5XhwOHKO={tool=baitTool}})
assert(capture:Bait(nextBait) and latestPacket.GzIfeyeyrx62Dp=='latest-live-context' and latestPacket.KjPN9j5XhwOHKO.tool==nextBait,'latest exact captured envelope must retain context and replace the actual bait tool')
assert(type(capture.BaitBinding.ObservedAt)=='number','bait learning must timestamp the observed binding')
local sentBefore=#calls
local originalCharacter=gamePlayer.Character
local originalUserId=gamePlayer.UserId
assert(capture:CanUseBaitBinding(),'same account/character binding must remain usable')
gamePlayer.UserId=99
assert(not capture:CanUseBaitBinding() and not capture:Bait(nextBait) and #calls==sentBefore,'another account must not send a captured bait request')
gamePlayer.UserId=originalUserId;gamePlayer.Character={}
assert(not capture:CanUseBaitBinding() and not capture:Bait(nextBait),'respawn must invalidate the old bait character binding')
gamePlayer.Character=originalCharacter
game.JobId='different-server'
assert(not capture:CanUseBaitBinding(),'another server must invalidate bait context')
game.JobId=nil;assert(capture:CanUseBaitBinding(),'restoring exact live context must restore binding validity')
;(function()
 capture:Resume();capture.Active=false;capture.LearnChestOnly=true
 local chest={_type='Instance',Name='chestMediumIndustrialIO',Parent=game,IsA=function(_,class) return class=='Model' end}
 local endpoint=remote('rotatedChestEndpoint')
 endpoint.Parent={Name='rotatingGroup',Parent={Name='out',Parent=game}}
 local payload={sessionKey='live-account-context',body={chest=chest,action='withdraw',slot=1,item='carrotHarvested',amount=26}}
 local recorded=#capture.Records
 installedHook(endpoint,{body={chest=chest,action='deposit',slot=1,item='carrotHarvested',amount=26}})
 assert(not capture.ChestBinding and capture.LearnChestOnly,'deposit must not learn withdrawal')
 payload.body.amount=0/0
 installedHook(endpoint,payload)
 assert(not capture.ChestBinding,'invalid amount must not learn')
 payload.body.amount=26
 capture.LearnBaitOnly=true
 local forwarded=table.pack(installedHook(endpoint,payload,nil,'tail',nil))
 assert(forwarded.n==3 and forwarded[1]=='original-result','chest capture must preserve original returns')
 assert(not capture.LearnChestOnly and capture.LearnBaitOnly and not capture.Stopped,'chest learning must leave bait learning running')
 assert(#capture.Records==recorded,'quiet chest learning must not fill call log')
 capture:Stop()
 local replay
 endpoint.InvokeServer=function(_,...) replay=table.pack(...);return nil end
 assert(capture:WithdrawCarrots(),'learned request should send')
 assert(replay.n==4 and replay[2]==nil and replay[3]=='tail' and replay[4]==nil,'withdrawal trailing arguments lost')
 assert(replay[1].sessionKey=='live-account-context' and replay[1].body.chest==chest and replay[1].body.amount==26 and replay[1].body.slot==1,'withdrawal envelope changed')
 assert(capture:WithdrawCarrots(1) and replay[1].body.amount==1 and replay[1].body.slot==1 and replay[1].sessionKey=='live-account-context','chosen amount must replace only the learned body amount')
 assert(capture.ChestBinding.Args[1].body.amount==26 and capture.ChestBinding.Amount==26,'changing the request amount must not mutate the capture')
 for _,amount in ipairs({0,-1,.5,math.huge,0/0,1000001,'1'}) do
  replay=nil
  assert(not capture:WithdrawCarrots(amount) and replay==nil,'invalid amount must not send')
 end
 assert(capture:WithdrawCarrots() and replay[1].body.amount==26,'learned amount must remain available after custom requests')
 local char=gamePlayer.Character
 gamePlayer.Character={}
 assert(not capture:WithdrawCarrots(),'respawn must invalidate chest binding')
 gamePlayer.Character=char
 local user=gamePlayer.UserId;gamePlayer.UserId=123
 assert(not capture:WithdrawCarrots(),'different account must not reuse binding')
 gamePlayer.UserId=user
 game.JobId='new-server';assert(not capture:WithdrawCarrots(),'server change must invalidate binding');game.JobId=nil
 endpoint.InvokeServer=function() return {success=false} end
 assert(not capture:WithdrawCarrots(),'server rejection must propagate')
 endpoint.InvokeServer=function() error('network failure') end
 assert(not capture:WithdrawCarrots(),'transport errors must be handled')
 chest.Parent=nil;assert(not capture:CanUseChestBinding(),'removed chest must invalidate binding')
end)()
;(function()
 capture:Resume();capture.Active=false;capture.LearnChestOnly=true;capture.LearnChestMany=true
 local function chest(name) return {_type='Instance',Name=name,Parent=game,IsA=function(_,class) return class=='Model' end} end
 local a,b=chest('Chest A'),chest('Chest B')
 local endpoint=remote('differentChestEndpoint');endpoint.Parent={Name='rotatedGroup',Parent={Name='out',Parent=game}}
 local packets={}
 endpoint.InvokeServer=function(_,packet) table.insert(packets,packet);return true end
 local records=#capture.Records
 installedHook(endpoint,{context='account-A',body={chest=a,action='withdraw',slot=1,item='carrotHarvested',amount=30}})
 local bindingA=capture.ChestBinding
 installedHook(endpoint,{context='account-B',body={chest=b,action='withdraw',slot=4,item='carrotHarvested',amount=12}})
 local bindingB=capture.ChestBinding
 assert(#capture:GetChestBindings()==2 and capture.LearnChestOnly and not capture.Stopped and #capture.Records==records,'multi learning must retain two chests and stay quiet/active until explicitly stopped')
 assert(capture:WithdrawCarrots(5,bindingA) and capture.ChestBinding==bindingB,'explicit replay must not replace the latest observed binding')
 assert(packets[1].context=='account-A' and packets[1].body.chest==a and packets[1].body.slot==1 and packets[1].body.amount==5,'first chest replay mixed another chest envelope')
 assert(capture:WithdrawCarrots(2,bindingB) and packets[2].context=='account-B' and packets[2].body.chest==b and packets[2].body.slot==4,'second chest replay must preserve its own slot/context')
 installedHook(endpoint,{context='updated-A',body={chest=a,action='withdraw',slot=1,item='carrotHarvested',amount=15}})
 assert(#capture:GetChestBindings()==2 and capture.ChestBinding.Args[1].context=='updated-A','relearning one chest/slot must replace, not duplicate it')
 installedHook(endpoint,{context='another-slot',body={chest=a,action='withdraw',slot=2,item='carrotHarvested',amount=8}})
 assert(#capture:GetChestBindings()==3,'different carrot slots in one chest must remain distinct')
 b.Parent=nil
 assert(#capture:GetChestBindings()==2 and not capture:WithdrawCarrots(1,bindingB),'removed chest must be excluded without losing other bindings')
 capture:Stop();assert(not capture.LearnChestOnly and not capture.LearnChestMany,'Stop must end multi learning')
end)()
return 'Recorder passed: argument/return preservation, filtering, cycles, pause, errors, detached instances, cap, stop, idempotent restart, detached metadata, request IDs'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(setup+'\nlocal function runRecorder()\n'+source+'\nend\nrunRecorder()\n'+checks,'capture-smoke',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
