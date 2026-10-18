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
return 'Saved water-hole TP: exact location, stopped workers, cleared momentum, busy/dead/anchored guards and account/server/place validation passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'water-spot',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
