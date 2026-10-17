import fs from 'node:fs';
import {LuauState} from 'luau-web';
const source=fs.readFileSync(new URL('../tools/AntiAFK.lua',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8').replaceAll('\r\n','\n');
if(!main.includes(source)) throw Error('Embedded Anti AFK differs from source');
const code=`
local listener,connections,disconnects=nil,0,0
local player={Idled={Connect=function(_,callback)
 listener=callback;connections+=1
 return {Disconnect=function() listener=nil;disconnects+=1 end}
end}}
local Vector2={zero={X=0,Y=0}}
local calls=0
local blocked=false
local frame={}
local virtualUser={CaptureController=function() if blocked then error('blocked') end end,ClickButton2=function(_,position,camera)
 assert(position==Vector2.zero and camera==frame);calls+=1
end}
local lastReason
local Class=(function() ${source} end)()
local controller=Class.new(player,function() return virtualUser end,function() return {CFrame=frame} end,function(on,reason) lastReason=reason end)
assert(not controller.Enabled and not listener and connections==0,'startup must have no idle listener or input')
controller:SetEnabled(true);controller:SetEnabled(true)
assert(connections==1 and controller.Enabled,'repeated enabling must not stack listeners')
listener();assert(calls==1 and controller.Enabled,'idle event must send one right-click through VirtualUser')
local stale=listener
controller:SetEnabled(false);stale()
assert(calls==1 and not listener and disconnects==1,'disabling must disconnect and suppress stale callbacks')
controller:SetEnabled(true);blocked=true;listener()
assert(not controller.Enabled and not listener and lastReason=='input unavailable','unsupported input must disable cleanly without uncaught error')
blocked=false;controller:SetEnabled(true);controller:Destroy()
assert(not listener and not controller.Enabled and not controller:SetEnabled(true),'cleanup must prevent restart and remove listener')
return 'Anti AFK: startup OFF, one listener, idle response, disable, unsupported input and cleanup passed'
`;
const state=await LuauState.createAsync();try{console.log(await state.loadstring(code,'antiafk',true)());}finally{state.destroy();}
