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
function game:GetService(name)
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
