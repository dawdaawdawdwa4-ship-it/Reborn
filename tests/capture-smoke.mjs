import fs from 'node:fs';
import {LuauState} from 'luau-web';
const source=fs.readFileSync(new URL('../tools/CaptureRemotes.lua',import.meta.url),'utf8');
const setup=`
local nativeTypeof=typeof
local function typeof(v) return type(v)=='table' and v._type or nativeTypeof(v) end
local logs, environment, calls={}, {}, {}
local function print(...) table.insert(logs,table.pack(...)) end
local warn=print
local currentMethod='InvokeServer'
local function getnamecallmethod() return currentMethod end
local function getgenv() return environment end
local installedHook
local game={_type='Instance'}
local keyListener
local disconnected=false
function game:GetService(name)
 return {InputBegan={Connect=function(_,fn)
  keyListener=fn
  return {Disconnect=function() disconnected=true end}
 end}}
end
local function remote(name)
 return {_type='Instance',Name=name,Parent=game,IsA=function(_,cls) return cls=='RemoteFunction' end}
end
local function hookmetamethod(_,_,fn)
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
local target=remote('CLIENT_HARVEST_CROP_REQUEST')
local payload={block='wheat',count=3}
local returned=table.pack(installedHook(target,payload,nil,'last',nil))
assert(returned.n==3 and returned[1]=='original-result' and returned[2]==nil and returned[3]==42,'original returns changed')
assert(#calls==1 and calls[1].n==5 and calls[1][2]==payload and calls[1][4]=='last','original arguments changed')
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
capture.MaxCalls=#capture.Records+1
installedHook(target,{})
assert(not capture.Active,'record limit failed')
local before=#capture.Records
capture:Stop();installedHook(target,{})
assert(#capture.Records==before and disconnected,'stop must disconnect and remain pass-through')
return 'Recorder passed: argument/return preservation, filtering, cycles, pause, errors, detached instances, cap, stop'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(setup+'\nlocal function runRecorder()\n'+source+'\nend\nrunRecorder()\n'+checks,'capture-smoke',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
