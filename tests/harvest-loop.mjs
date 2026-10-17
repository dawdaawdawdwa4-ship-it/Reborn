import fs from 'node:fs';
import {LuauState} from 'luau-web';
const source=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8').replaceAll('\r\n','\n');
const logic=fs.readFileSync(new URL('../tools/FarmLogic.lua',import.meta.url),'utf8');
const loop=source.slice(source.indexOf('local function harvestLoop(myCycle)'),source.indexOf('-- Main fishing loop'));
const code=`
local FarmLogic=(function() ${logic} end)()
local function runScenario(scenario)
 local time=0
 local os={clock=function() return time end}
 local harvestCycleId=1
 local harvestEnabled,woodEnabled,mineEnabled=true,false,false
 local gui={Parent=true}
 local CONFIG={MineScanInterval=.2,MineDelay=.123,CropRange=30,WoodRange=30,MineRange=30,PlantEnabled=true,AutoReplant=true,PlantType='wheat'}
 local COLORS={muted=1,warn=2,good=3}
 local FarmState={Cooldowns={}}
 local counted,planted=0,0
 local stats={harvests=0}
 local function registerHarvest() counted+=1;stats.harvests+=1 end
 local function setStatus() end
 local function resolveRemotes() end
 local zero=setmetatable({X=0,Y=0,Z=0},{__sub=function() return {Magnitude=0} end})
 local originalFrame={rotation='unchanged'}
 local target={Name='wheat',Parent=true,attributes={Mature=true},Position=zero,children={}}
 function target:IsA(c) return c=='Model' end
 function target:GetPivot() return originalFrame end
 function target:GetAttribute(name) return self.attributes[name] end
 function target:GetDescendants() return self.children end
 local player={Character={FindFirstChild=function() return {Position=zero} end}}
 local function getPartPosition(obj) return zero end
 local function modeAllows() return true end
 local fruitTree={Parent=true}
 function target:IsDescendantOf(model) return model==fruitTree end
 if scenario=='fruit' or scenario=='fruit-cancel' then CONFIG.FruitEnabled=true end
 local function getMineTargets() return {{instance=target,name='wheat',category='crop',kind=CONFIG.FruitEnabled and 'fruit' or 'model',model=fruitTree}} end
 local function equipBestResourceTool() return true end
 local held,released=false,false
 if scenario=='prompt-cancel' or scenario=='learned-prompt' then
  local prompt={Name='Harvest',ActionText='Harvest',Enabled=true,Parent=target,MaxActivationDistance=10,HoldDuration=1}
  function prompt:IsA(c) return c=='ProximityPrompt' end
  function prompt:InputHoldBegin() held=true end
  function prompt:InputHoldEnd() held=false;released=true end
  target.children={prompt}
 end
 local task={wait=function(dt)
  time+=dt
  if dt==CONFIG.MineDelay or dt==CONFIG.MineScanInterval or scenario=='prompt-cancel' then harvestCycleId+=1 end
 end}
 local function fireModelHarvest(obj)
  if scenario=='removed' or scenario=='learned-prompt' or scenario=='server-replant' then obj.Parent=nil end
  if scenario=='regrow' then obj.attributes.Mature=false end
  if scenario=='cancel' then obj.Parent=nil;harvestCycleId+=1 end
  return true
 end
 local function fireBlockMine() return true end
 local RemoteCatalog={RequestId=function() return 'current-session' end,PlacementAvailable=function() return true end,HarvestEndpoint=function() return nil end}
 RemoteCatalog.CallFruit=function(model,obj)
  assert(model==fruitTree and obj==target,'fruit target pair must be preserved')
  obj.Parent=nil
  if scenario=='fruit-cancel' then harvestCycleId+=1 end
  return true
 end
 if scenario=='server-replant' then RemoteCatalog.ServerAutoReplant=true end
 if scenario=='learned-prompt' then RemoteCatalog.Recorder={HarvestBinding={Remote={Parent=true},Target=target}} end
 local function firePlant(cf,kind)
  assert(cf==originalFrame and kind=='wheat','replant must preserve frame and crop')
  assert(harvestCycleId==1,'replant after cancellation')
  planted+=1
 end
 ${loop}
 harvestLoop(1)
 if scenario=='unchanged' then assert(counted==0 and planted==0,'acknowledged request must not count as harvested') end
 if scenario=='learned-prompt' then assert(counted==1 and planted==1 and not released,'learned crop request must take precedence over prompt') end
 if scenario=='fruit' then assert(counted==1 and planted==0 and fruitTree.Parent,'fruit removal must count without replanting or removing the tree') end
 if scenario=='fruit-cancel' then assert(counted==0 and planted==0,'cancelled fruit call must not count') end
 if scenario=='server-replant' then assert(counted==1 and planted==0,'game AutoReplant must suppress duplicate local planting') end
 if scenario=='removed' then assert(counted==1 and planted==1,'removed crop must count once and replant') end
 if scenario=='regrow' then assert(counted==1 and planted==0,'crop regrowing in place must not be planted over') end
 if scenario=='cancel' then assert(counted==0 and planted==0,'cancelled cycle must not count/replant') end
 if scenario=='prompt-cancel' then assert(released and not held and counted==0 and planted==0,'Stop must release prompt and cancel post-processing') end
end
for _,scenario in ipairs({'unchanged','removed','regrow','cancel','prompt-cancel','learned-prompt','server-replant','fruit','fruit-cancel'}) do runScenario(scenario) end
return 'Harvest loop passed: no false counts, confirmed removal/replant, regrow in place, Stop/cycle cancellation and prompt release'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'harvest-loop',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
