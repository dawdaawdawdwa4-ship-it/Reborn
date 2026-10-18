import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const source=main.slice(main.indexOf('-- WATER SPOT BEGIN'),main.indexOf('-- WATER SPOT END'));
const code=`
local zero=setmetatable({value=7},{__mul=function(_,n) return {value=n} end})
local savedFrame={location='water hole'}
local root={CFrame=savedFrame,AssemblyLinearVelocity=zero,AssemblyAngularVelocity=zero}
local humanoid={Health=100}
local character={FindFirstChild=function(_,name) return name=='HumanoidRootPart' and root end,FindFirstChildOfClass=function(_,class) return class=='Humanoid' and humanoid end}
root.Parent=character
local player={Character=character,UserId=7}
local game={PlaceId=100,JobId='server-one'}
local baitBusy,fishingInputBusy=false,false
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
return 'Saved water-hole TP: exact location, stopped workers, cleared momentum, busy/dead/anchored guards and account/server/place validation passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'water-spot',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
