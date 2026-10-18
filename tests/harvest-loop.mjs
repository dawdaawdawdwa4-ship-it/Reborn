import fs from 'node:fs';
import {LuauState} from 'luau-web';
const source=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8').replaceAll('\r\n','\n');
const logic=fs.readFileSync(new URL('../tools/FarmLogic.lua',import.meta.url),'utf8');
const loop=source.slice(source.indexOf('local function harvestLoop(myCycle)'),source.indexOf('-- Main fishing loop'));
const planting=source.slice(source.indexOf('local function plantAroundPlayer('),source.indexOf('-- Hotbar layout remote'));
const code=`
local FarmLogic=(function() ${logic} end)()
local function runScenario(scenario)
 local time=0
 local os={clock=function() return time end}
 local harvestCycleId=1
 local harvestEnabled,woodEnabled,mineEnabled=true,false,false
 local gui={Parent=true}
 local CONFIG={MineScanInterval=.2,MineDelay=.123,HarvestWalk=true,CropRange=30,WoodRange=30,MineRange=30,PlantEnabled=true,AutoReplant=true,PlantType='wheat'}
 local COLORS={muted=1,warn=2,good=3}
 local FarmState={Cooldowns={}}
 local counted,planted=0,0
 local stats={harvests=0}
 local function registerHarvest() counted+=1;stats.harvests+=1 end
 local lastStatus
 local woodStatus={}
 local function setStatus(message) lastStatus=message end
 local function resolveRemotes() end
 local walked=false
 local zero=setmetatable({X=0,Y=0,Z=0},{__sub=function() return {Magnitude=(scenario=="walk-crop" or scenario=="walk-cancel" or scenario=="walk-short") and not walked and 25 or 0} end})
 local originalFrame={rotation='unchanged'}
 local target={Name='wheat',Parent=true,attributes={Mature=true},Position=zero,children={}}
 if scenario=='unready' then target.attributes.Mature=false end
 function target:IsA(c) return c=='Model' end
 function target:GetPivot() return originalFrame end
 function target:GetAttribute(name) return self.attributes[name] end
 function target:GetDescendants() return self.children end
 local root={Position=zero}
 local player={Character={FindFirstChild=function() return root end}}
 local function getPartPosition(obj) return zero end
 local function modeAllows() return true end
 local oldTool,newTool={},{}
 local selectedTool=oldTool
 function player.Character:FindFirstChildOfClass() return selectedTool end
 local equipRace=scenario=='wood-detached' or scenario=='wood-respawn' or scenario=='wood-root-replaced'
 local isWood=scenario=='wood-equip' or scenario=='blocked-wood' or equipRace
 if isWood then harvestEnabled=false;woodEnabled=true end
 if scenario=='multi-carrot' then target.Name='carrot';CONFIG.HarvestCrops={wheat=true,carrot=true} end
 if scenario=='berry-persistent' then target.Name='berryBush' end
 local fruitTree={Parent=true}
 function target:IsDescendantOf(model) return model==fruitTree end
 if scenario=='fruit' or scenario=='fruit-cancel' then CONFIG.FruitEnabled=true end
 local function getMineTargets() if scenario=='blocked-wood' and time>0 then return {} end;return {{instance=target,name=target.Name,category=isWood and 'wood' or 'crop',kind=isWood and 'block' or CONFIG.FruitEnabled and 'fruit' or 'model',model=fruitTree}} end
 local function equipBestResourceTool() if scenario=='wood-equip' or equipRace then selectedTool=newTool end;return true end
 local held,released=false,false
 if scenario=='prompt-cancel' or scenario=='learned-prompt' then
  local prompt={Name='Harvest',ActionText='Harvest',Enabled=true,Parent=target,MaxActivationDistance=10,HoldDuration=1}
  function prompt:IsA(c) return c=='ProximityPrompt' end
  function prompt:InputHoldBegin() held=true end
  function prompt:InputHoldEnd() held=false;released=true end
  target.children={prompt}
 end
 local scanWaits=0
 local task={wait=function(dt)
  time+=dt
  if equipRace and dt==.1 then
   if scenario=='wood-detached' then target.Parent=nil
   elseif scenario=='wood-respawn' then player.Character={FindFirstChild=function() return {Position=zero} end}
   else root={Position=zero} end
  end
  if scenario=='blocked-wood' then
   if dt==CONFIG.MineScanInterval then scanWaits+=1;if scanWaits>=2 then harvestCycleId+=1 end end
  elseif dt==CONFIG.MineDelay or dt==.08 or dt==CONFIG.MineScanInterval or scenario=='prompt-cancel' then harvestCycleId+=1 end
 end}
 local function fireModelHarvest(obj)
  assert(scenario~='unready','unready crops must not receive requests')
  assert(scenario~='walk-short','navigation success outside reach must never send harvest')
  if scenario=='goal-replant' or scenario=='walk-crop' or scenario=='removed' or scenario=='learned-prompt' or scenario=='server-replant' or scenario=='multi-carrot' or scenario=='server-replant-off' then obj.Parent=nil end
  if scenario=='regrow' then obj.attributes.Mature=false end
  if scenario=='cancel' then obj.Parent=nil;harvestCycleId+=1 end
  return true
 end
 local function fireBlockMine() assert(not equipRace,'must not send a resource request after target removal, respawn or root replacement during equip');if scenario=='blocked-wood' then return false,'Obstacle blocks trunk' end;if scenario=='wood-equip' then assert(selectedTool==newTool and time>=.1,'must allow changed axe to equip before hitting');target.Parent=nil end;return true end
 local RemoteCatalog={Navigation={Approach=function(_,obj,reach,active) assert(obj==target and reach==8 and active());walked=scenario~="walk-short";if scenario=="walk-cancel" then harvestCycleId+=1;return false,"Walking stopped" end;return true end},GameModule=function() return nil end,WoodReach=function() return true end,RequestId=function() return 'current-session' end,PlacementAvailable=function() return true end,HarvestEndpoint=function() return nil end}
 RemoteCatalog.CompleteModeGoal=function(category)
  if scenario=='goal-replant' then
   assert(counted==1 and planted==1 and category=='crop','goal completion must follow confirmed harvest and final replant')
   harvestCycleId+=1;harvestEnabled=false
  end
 end
 RemoteCatalog.ServerReplantEnabled=function() return RemoteCatalog.ServerAutoReplant==true end
 RemoteCatalog.CallFruit=function(model,obj)
  assert(model==fruitTree and obj==target,'fruit target pair must be preserved')
  obj.Parent=nil
  if scenario=='fruit-cancel' then harvestCycleId+=1 end
  return true
 end
 if scenario=='server-replant' then RemoteCatalog.ServerAutoReplant=true end
 if scenario=='server-replant-off' then RemoteCatalog.ServerAutoReplant=true;RemoteCatalog.ServerReplantEnabled=function() return false end end
 if scenario=='learned-prompt' then RemoteCatalog.Recorder={HarvestBinding={Remote={Parent=true},Target=target}} end
 local function firePlant(cf,kind)
  assert(cf==originalFrame and kind==(scenario=='multi-carrot' and 'carrot' or 'wheat'),'replant must preserve frame and crop')
  assert(harvestCycleId==1,'replant after cancellation')
  planted+=1
 end
 ${loop}
 harvestLoop(1)
 if scenario=='walk-crop' then assert(walked and counted==1 and planted==1,'out-of-range crop must be approached before harvest') end
 if scenario=='walk-cancel' then assert(walked and counted==0 and planted==0,'Stop during navigation must prevent harvest and replant') end
 if scenario=='berry-persistent' then assert(counted==0 and planted==0 and time<.5 and FarmState.Cooldowns[target]>time,'persistent berry must advance quickly without false counts, replanting or immediate repeat') end
 if scenario=='unchanged' then assert(counted==0 and planted==0,'acknowledged request must not count as harvested') end
 if scenario=='learned-prompt' then assert(counted==1 and planted==1 and not released,'learned crop request must take precedence over prompt') end
 if scenario=='blocked-wood' then assert(string.find(lastStatus,'Obstacle blocks trunk',1,true) and string.find(woodStatus.Text,'Obstacle blocks trunk',1,true),'cooldown scan must preserve the actual blocker') end
 if scenario=='multi-carrot' then assert(counted==1 and planted==1,'multi-crop replant must preserve the harvested crop') end
 if scenario=='wood-equip' then assert(counted==1 and planted==0,'wood must confirm removal after equipping') end
 if equipRace then assert(counted==0 and planted==0,'changed equip context must not count or replant resources') end
 if scenario=='fruit' then assert(counted==1 and planted==0 and fruitTree.Parent,'fruit removal must count without replanting or removing the tree') end
 if scenario=='fruit-cancel' then assert(counted==0 and planted==0,'cancelled fruit call must not count') end
 if scenario=='server-replant-off' then assert(counted==1 and planted==1,'accepted server OFF must restore local planting despite cached ON') end
 if scenario=='server-replant' then assert(counted==1 and planted==0,'game AutoReplant must suppress duplicate local planting') end
 if scenario=='removed' then assert(counted==1 and planted==1,'removed crop must count once and replant') end
 if scenario=='goal-replant' then assert(not harvestEnabled and counted==1 and planted==1,'goal must stop the loop after preserving final replant') end
 if scenario=='regrow' then assert(counted==1 and planted==0,'crop regrowing in place must not be planted over') end
 if scenario=='cancel' then assert(counted==0 and planted==0,'cancelled cycle must not count/replant') end
 if scenario=='prompt-cancel' then assert(released and not held and counted==0 and planted==0,'Stop must release prompt and cancel post-processing') end
end
for _,scenario in ipairs({'unready','walk-short','walk-crop','walk-cancel','berry-persistent','unchanged','removed','regrow','cancel','prompt-cancel','learned-prompt','server-replant','server-replant-off','fruit','fruit-cancel','wood-equip','wood-detached','wood-respawn','wood-root-replaced','blocked-wood','multi-carrot','goal-replant'}) do runScenario(scenario) end
-- Manual grid planting must stop before the next request after cancellation or respawn.
do
 local RemoteCatalog={PlacementAvailable=function() return true end,PlantGeneration=1}
 local gui={Parent=true}
 local CONFIG={PlantType='wheat',PlantRadius=3,PlantSpacing=3,PlantDelay=.1}
 local root={Position={X=0,Y=0,Z=0}}
 local char={FindFirstChild=function() return root end}
 local player={Character=char}
 local Vector3={new=function() return {} end}
 local frame=setmetatable({},{__mul=function(a) return a end})
 local CFrame={new=function() return frame end,Angles=function() return frame end}
 local calls=0
 local function setStatus() end
 local COLORS={warn=1}
 local function firePlant() calls+=1;return true end
 local task={wait=function() RemoteCatalog.PlantGeneration+=1 end}
 ${planting}
 assert(plantAroundPlayer('wheat',1)==1 and calls==1,'Stop All token must prevent subsequent planting requests')
 calls=0
 assert(plantAroundPlayer('wheat',1)==0 and calls==0,'stale planting worker must send nothing')
 RemoteCatalog.PlantGeneration=3
 task.wait=function() player.Character={} end
 assert(plantAroundPlayer('wheat',3)==1,'respawn must cancel remaining planting requests')
end
return 'Harvest loop passed: no false counts, confirmed removal/replant, regrow in place, Stop/cycle cancellation and prompt release'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'harvest-loop',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
