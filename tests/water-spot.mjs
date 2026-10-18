import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const source=main.slice(main.indexOf('-- WATER SPOT BEGIN'),main.indexOf('-- WATER SPOT END'));
const code=`
local velocityMt={}
velocityMt.__mul=function(_,n) return setmetatable({value=n},velocityMt) end
local zero=setmetatable({value=7},velocityMt)
local vmt={__sub=function(a,b) return {Magnitude=math.abs(a.X-b.X)} end}
local function position(x) return setmetatable({X=x},vmt) end
local CFrame={new=function(...) local values=table.pack(...);return {Values=values,Position=position(values[1])} end}
local savedFrame={location='water hole',Position=position(10)}
local root={CFrame=savedFrame,Position=position(10),AssemblyLinearVelocity=zero,AssemblyAngularVelocity=zero}
local humanoid={Health=100}
local character={FindFirstChild=function(_,name) return name=='HumanoidRootPart' and root end,FindFirstChildOfClass=function(_,class) return class=='Humanoid' and humanoid end}
root.Parent=character
local player={Character=character,UserId=7}
local game={PlaceId=100,JobId='server-one'}
local baitBusy,fishingInputBusy=false,false
local gui={Parent=true}
local COLORS={good=1,warn=2}
local function setStatus() end
local jobs={}
local task={spawn=function(fn) local co=coroutine.create(fn);local ok,err=coroutine.resume(co);assert(ok,err);table.insert(jobs,co) end,wait=function() coroutine.yield() end}
local function flushChecks()
 for i=1,3 do
  for _,co in ipairs(jobs) do if coroutine.status(co)=='suspended' then local ok,err=coroutine.resume(co);assert(ok,err) end end
 end
end
local stopped={}
local RemoteCatalog={SetChestAuto=function(on) assert(not on);stopped.chest=true end,Navigation={Stop=function() stopped.navigation=true end}}
local function setEnabled(on) assert(not on);stopped.fishing=true end
local function setBaitEnabled(on) assert(not on);stopped.bait=true end
local function setFarmMode(kind,on) assert(not on);stopped[kind]=true end
local buildController={Stop=function() stopped.build=true end}
${source}
assert(not RemoteCatalog.TeleportWaterSpot(),'unsaved location must not teleport')
assert(RemoteCatalog.SaveWaterSpot() and RemoteCatalog.WaterSpot.CFrame==savedFrame,'save must use current root frame')
root.CFrame={location='elsewhere'}
assert(RemoteCatalog.TeleportWaterSpot() and root.CFrame==savedFrame,'teleport must return to the saved position and orientation')
for _,key in ipairs({'fishing','bait','crop','wood','mine','chest','build','navigation'}) do assert(stopped[key],'missing cancellation '..key) end
assert(root.AssemblyLinearVelocity.value==0 and root.AssemblyAngularVelocity.value==0,'teleport must clear momentum')
local currentFrame={location='busy'};root.CFrame=currentFrame
baitBusy=true
assert(not RemoteCatalog.TeleportWaterSpot() and root.CFrame==currentFrame,'must not teleport during bait input')
baitBusy=false;fishingInputBusy=true
assert(not RemoteCatalog.TeleportWaterSpot(),'must not teleport during rod input')
fishingInputBusy=false;root.Anchored=true
assert(not RemoteCatalog.TeleportWaterSpot(),'anchored characters must not teleport')
root.Anchored=false;humanoid.Health=0
assert(not RemoteCatalog.SaveWaterSpot() and not RemoteCatalog.TeleportWaterSpot(),'dead character must not save or teleport')
humanoid.Health=100;game.JobId='another-server'
assert(not RemoteCatalog.TeleportWaterSpot() and not RemoteCatalog.WaterSpot,'server changes must invalidate location')
game.JobId='server-one';assert(RemoteCatalog.SaveWaterSpot());player.UserId=99
assert(not RemoteCatalog.TeleportWaterSpot() and not RemoteCatalog.WaterSpot,'account changes must invalidate location')
player.UserId=7;assert(RemoteCatalog.SaveWaterSpot());game.PlaceId=200
assert(not RemoteCatalog.TeleportWaterSpot() and not RemoteCatalog.WaterSpot,'place changes must invalidate location')
game.PlaceId=100;assert(RemoteCatalog.SaveWaterSpot());root.Parent=nil
assert(not RemoteCatalog.TeleportWaterSpot(),'removed root must not teleport')
root.Parent=character;root.CFrame=savedFrame
assert(RemoteCatalog.SaveTeleportSpot('Island / home'))
local away={location='away',Position=position(50)};root.CFrame=away
assert(RemoteCatalog.TeleportSavedSpot('Island / home') and root.CFrame==savedFrame and RemoteCatalog.TeleportPrevious.CFrame==away,'Home must preserve the return location')
assert(RemoteCatalog.TeleportSavedSpot('Previous') and root.CFrame==away,'Back must return to the previous location')
assert(RemoteCatalog.SaveTeleportSpot('Custom spot') and RemoteCatalog.GetTeleportSpot('Custom spot').CFrame==away,'custom destinations must be independent')
assert(not RemoteCatalog.SaveTeleportSpot('invalid'),'unknown destination names must not create arbitrary slots')
RemoteCatalog.SetTeleportSpot('Custom spot',nil)
assert(not RemoteCatalog.GetTeleportSpot('Custom spot') and not RemoteCatalog.TeleportSavedSpot('Custom spot'),'cleared spots must not teleport')
root.Parent=character;root.CFrame=savedFrame;root.Position=position(10)
assert(RemoteCatalog.SaveWaterSpot())
assert(RemoteCatalog.TeleportWaterSpot());flushChecks()
assert(string.find(RemoteCatalog.TeleportLastResult,'Arrived at Water hole',1,true),'arrival must be checked after the character remains near the destination')
assert(RemoteCatalog.TeleportWaterSpot())
root.CFrame=away;root.Position=position(50) -- simulate server correction
flushChecks()
assert(root.CFrame==away and string.find(RemoteCatalog.TeleportLastResult,'corrected',1,true),'server correction must be reported without forcing another teleport')
assert(RemoteCatalog.TeleportWaterSpot())
local result=RemoteCatalog.TeleportLastResult
player.Character={};flushChecks()
assert(RemoteCatalog.TeleportLastResult==result,'verification must stop after character replacement')
player.Character=character;root.Parent=character
local wrongFrame=root.CFrame
assert(not RemoteCatalog.TeleportSavedSpot('Spawn') and root.CFrame==wrongFrame,'preset must refuse another PlaceId without moving')
game.PlaceId=137524393306210
local spawn=RemoteCatalog.GetTeleportSpot('Spawn')
assert(spawn.CFrame.Values.n==12 and spawn.CFrame.Values[1]==6000.14014 and spawn.CFrame.Values[2]==-1.20368242 and spawn.CFrame.Values[3]==5997.77197,'Spawn must use the provided location')
assert(spawn.CFrame.Values[4]==-0.0349005498 and spawn.CFrame.Values[12]==-0.0349005498,'Spawn orientation must be retained')
assert(RemoteCatalog.TeleportSavedSpot('Spawn') and root.CFrame==spawn.CFrame,'provided Spawn preset must teleport without manual saving')
RemoteCatalog.TeleportSpots={};RemoteCatalog.WaterSpot=nil;RemoteCatalog.TeleportPrevious=nil
assert(RemoteCatalog.GetTeleportSpot('Spawn')==spawn,'clearing user saves must preserve the built-in preset')
game.JobId='new-server';player.UserId=99
assert(RemoteCatalog.TeleportSpotValid(spawn),'place presets must remain usable across accounts and servers of the same place')
local portal=RemoteCatalog.GetTeleportSpot('Own island portal')
assert(portal.CFrame.Values[1]==6001.06689 and portal.CFrame.Values[2]==-1.20368242 and portal.CFrame.Values[3]==5868.05078,'own-island portal must be separate from Spawn')
assert(RemoteCatalog.TeleportSavedSpot('Own island portal') and root.CFrame==portal.CFrame,'portal destination must dispatch without replacing Spawn')
assert(RemoteCatalog.GetTeleportSpot('Spawn')==spawn,'adding the island portal must preserve Spawn')
local hub=RemoteCatalog.GetTeleportSpot('Hub return portal')
assert(hub.CFrame.Values[1]==272.612946 and hub.CFrame.Values[2]==97.3866577 and hub.CFrame.Values[3]==-560.961792,'hub return portal must retain its supplied location')
local pond=RemoteCatalog.GetTeleportSpot('Fishing pond')
assert(pond.CFrame.Values[1]==424.779266 and pond.CFrame.Values[2]==87.5868607 and pond.CFrame.Values[3]==-640.204895,'fishing pond must retain its supplied location')
assert(RemoteCatalog.TeleportSavedSpot('Fishing pond') and root.CFrame==pond.CFrame,'pond preset must use the standard teleport/verification path')
for name,expected in pairs({['Slime portal']={546.674561,94.422081,-496.263855},['Slime return portal']={659.497559,184.839874,-230.143631},Buffalkor={806.163635,181.826767,17.0179768}}) do
 local point=RemoteCatalog.GetTeleportSpot(name)
 assert(point and point.CFrame.Values.n==12,'preset missing: '..name)
 for i=1,3 do assert(point.CFrame.Values[i]==expected[i],'incorrect preset position: '..name) end
end
return 'Saved water-hole TP: exact location, stopped workers, cleared momentum, busy/dead/anchored guards and account/server/place validation passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'water-spot',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
