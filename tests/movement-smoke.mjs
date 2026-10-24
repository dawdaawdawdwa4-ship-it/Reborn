import fs from 'node:fs';
import {LuauState} from 'luau-web';

const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8').replaceAll('\r\n','\n');
const start=main.indexOf('-- MOVEMENT UI BEGIN');
const end=main.indexOf('-- MOVEMENT UI END',start);
if(start<0||end<0) throw Error('Movement controller markers are missing');
const source=main.slice(start,end);
const code=`
local function signal()
 local callbacks={}
 return {Connect=function(_,callback)
  table.insert(callbacks,callback)
  return {Disconnect=function() local i=table.find(callbacks,callback);if i then table.remove(callbacks,i) end end}
 end,Fire=function(_,...) for _,callback in ipairs(table.clone(callbacks)) do callback(...) end end}
end
local function control(properties)
 local item=properties or {};item.Children={};item.Activated=signal()
 if item.Parent then table.insert(item.Parent.Children,item) end
 return item
end
local movementPage=control()
local function label(properties) return control(properties) end
local function button(properties) return control(properties) end
local Instance={new=function() return control() end}
local UDim2={new=function(...) return {...} end,fromOffset=function(...) return {...} end}
local COLORS={muted='muted',on='on',off='off',panel='panel'}
local function corner() end
local function track() end
local RemoteCatalog={MenuClosers={},RegisterMenuRegion=function() end}
function RemoteCatalog.CloseMenus() for _,close in ipairs(RemoteCatalog.MenuClosers) do close() end end
local pending={}
local task={spawn=function(callback) table.insert(pending,callback) end}
local function flush() local callbacks=pending;pending={};for _,callback in ipairs(callbacks) do callback() end end
local gui={Parent=true}
local player={CharacterAdded=signal()}
local function newHumanoid(speed,power,height,powerMode)
 local values={WalkSpeed=speed,JumpPower=power,JumpHeight=height,UseJumpPower=powerMode}
 local writes={}
 local hum=setmetatable({}, {__index=values,__newindex=function(_,key,value)
  values[key]=value;writes[key]=(writes[key] or 0)+1
 end})
 return hum,writes
end
local function character(hum)
 return {FindFirstChildOfClass=function(_,name) assert(name=='Humanoid');return hum end,
  WaitForChild=function(_,name,timeout) assert(name=='Humanoid' and timeout==5);return hum end}
end
local hum,writes=newHumanoid(16,50,7.2,true)
player.Character=character(hum)
${source}

movementController.WalkButton.Activated:Fire()
assert(hum.WalkSpeed==20 and not writes.JumpPower and not writes.JumpHeight,'enabling walk must not write either jump property')
hum.JumpPower=75;hum.JumpHeight=12;table.clear(writes)
movementController.Speed=24;movementController:Apply('walk')
assert(hum.WalkSpeed==24 and hum.JumpPower==75 and hum.JumpHeight==12,'walk changes must preserve game jump updates')
assert(not writes.JumpPower and not writes.JumpHeight,'walk settings must not own jump properties')
movementController.WalkButton.Activated:Fire()
assert(hum.WalkSpeed==16 and hum.JumpPower==75 and hum.JumpHeight==12,'walk OFF must restore only the custom walk value')

hum.WalkSpeed=18
movementController.WalkButton.Activated:Fire();movementController.WalkButton.Activated:Fire()
assert(hum.WalkSpeed==18,'re-enabling walk must capture the latest game baseline after the previous override was released')
movementController.WalkButton.Activated:Fire()
hum.WalkSpeed=37;table.clear(writes)
movementController.JumpButton.Activated:Fire()
assert(hum.JumpPower==60 and hum.WalkSpeed==37 and not writes.WalkSpeed,'jump toggle must leave walk untouched even when custom walk is enabled')
hum.JumpPower=82;table.clear(writes)
movementController.WalkButton.Activated:Fire()
assert(hum.WalkSpeed==18 and hum.JumpPower==82 and not writes.JumpPower,'walk toggle must leave jump untouched even when custom jump is enabled')

hum.UseJumpPower=false;table.clear(writes)
movementController:Apply('jump')
assert(hum.JumpPower==75 and hum.JumpHeight==10,'changing jump mode must restore the previously owned power and apply height')
assert(writes.JumpPower==1 and writes.JumpHeight==1 and not writes.WalkSpeed,'jump mode switch must touch only the two involved jump properties')
hum.UseJumpPower=true;movementController:Apply('jump')
assert(hum.JumpHeight==12 and hum.JumpPower==60,'switching back must restore height and capture power again')
hum.WalkSpeed=33;table.clear(writes)
movementController:Reset()
assert(hum.WalkSpeed==33 and hum.JumpPower==75 and hum.JumpHeight==12,'Reset must restore owned properties and preserve unowned game values')
assert(not writes.WalkSpeed and not writes.JumpHeight and writes.JumpPower==1,'Reset must not write properties released by an earlier toggle or mode change')
table.clear(writes);movementController:Reset()
assert(next(writes)==nil,'repeated Reset must release ownership instead of restoring stale values again')
hum.JumpPower=91;movementController.JumpButton.Activated:Fire();movementController.JumpButton.Activated:Fire()
assert(hum.JumpPower==91,'jump re-enable must capture the latest game baseline')

movementController.WalkButton.Activated:Fire();movementController.JumpButton.Activated:Fire()
local respawnHum,respawnWrites=newHumanoid(18,55,8,false)
local respawnChar=character(respawnHum);player.Character=respawnChar;player.CharacterAdded:Fire(respawnChar);flush()
assert(respawnHum.WalkSpeed==24 and respawnHum.JumpHeight==10 and not respawnWrites.JumpPower,'respawn must apply enabled features without changing the new humanoid unused jump property')
table.clear(respawnWrites);movementController:Reset()
assert(respawnHum.WalkSpeed==18 and respawnHum.JumpHeight==8 and respawnHum.JumpPower==55 and not respawnWrites.JumpPower,'Reset after respawn must restore that character own baselines')

movementController.WalkButton.Activated:Fire()
local staleHum,staleWrites=newHumanoid(22,50,7,true)
local staleChar=character(staleHum);player.Character=staleChar;player.CharacterAdded:Fire(staleChar)
local currentHum,currentWrites=newHumanoid(27,50,7,true)
local currentChar=character(currentHum);player.Character=currentChar;player.CharacterAdded:Fire(currentChar);flush()
assert(next(staleWrites)==nil and currentHum.WalkSpeed==24,'a delayed respawn callback must not modify a replaced character')

local stoppedHum,stoppedWrites=newHumanoid(19,50,7,true)
local stoppedChar=character(stoppedHum);player.Character=stoppedChar;player.CharacterAdded:Fire(stoppedChar)
movementController:Reset();flush()
assert(next(stoppedWrites)==nil,'Reset must suppress queued respawn application')
movementController.WalkButton.Activated:Fire()
local closedHum,closedWrites=newHumanoid(21,50,7,true)
local closedChar=character(closedHum);player.Character=closedChar;player.CharacterAdded:Fire(closedChar)
gui.Parent=nil;flush()
assert(next(closedWrites)==nil,'destroying the UI must suppress queued respawn application')
-- Another owner (the Mobs boost) handing back the true original while custom walk is ON.
do
 local boostHum,boostWrites=newHumanoid(16,50,7,true)
 local boostChar=character(boostHum);player.Character=boostChar;player.CharacterAdded:Fire(boostChar)
 boostHum.WalkSpeed=24 -- a boost raised 16 → 24 before custom walk was enabled
 movementController.WalkEnabled=false;movementController.WalkButton.Activated:Fire()
 assert(boostHum.WalkSpeed==movementController.Speed,'custom walk applies its speed')
 movementController:SetBaseline(boostHum,'WalkSpeed',16)
 movementController.WalkButton.Activated:Fire()
 assert(boostHum.WalkSpeed==16,'custom walk OFF restores the original handed over by the boost, not the boosted 24')
end
return 'Movement: independent overrides, fresh baselines, owned-only Reset, jump mode switches, boost baseline hand-off and guarded respawn passed'
`;
const state=await LuauState.createAsync();
try{console.log(await state.loadstring(code,'movement',true)());}finally{state.destroy();}
