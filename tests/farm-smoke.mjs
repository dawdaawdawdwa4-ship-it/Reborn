import fs from 'node:fs';
import {LuauState} from 'luau-web';
const source=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8').replaceAll('\r\n','\n');
const farm=fs.readFileSync(new URL('../tools/FarmLogic.lua',import.meta.url),'utf8');
const targeting=source.slice(source.indexOf('local function getPlayerIsland()'),source.indexOf('-- RESOURCE AIM BEGIN'));
const mock=`
local vmt={}
local function vec(x,y,z) return setmetatable({X=x,Y=y,Z=z},vmt) end
function vmt.__sub(a,b) return vec(a.X-b.X,a.Y-b.Y,a.Z-b.Z) end
function vmt.__index(a,k) if k=='Magnitude' then return math.sqrt(a.X*a.X+a.Y*a.Y+a.Z*a.Z) end end
local function node(name,cls,children,position)
 local n={Name=name,ClassName=cls,children=children or {},attributes={},Position=position or vec(0,0,0),Parent=true}
 function n:IsA(c) return c==self.ClassName or c=='BasePart' and self.ClassName=='Part' end
 function n:GetChildren() return self.children end
 function n:FindFirstChild(name) for _,v in ipairs(self.children) do if v.Name==name then return v end end end
 function n:FindFirstChildWhichIsA(c) for _,v in ipairs(self.children) do if v:IsA(c) then return v end end end
 function n:GetAttribute(key) return self.attributes[key] end
 function n:GetPivot() return {Position=self.Position} end
 function n:GetDescendants()
  local all={}
  for _,v in ipairs(self.children) do
   table.insert(all,v)
   for _,d in ipairs(v:GetDescendants()) do table.insert(all,d) end
  end
  return all
 end
 return n
end
local stone=node('stone','Part',nil,vec(10,0,0))
local wheat=node('wheat','Model',nil,vec(8,0,0));wheat.attributes.Mature=true
local young=node('wheat','Model',nil,vec(3,0,0));young.attributes.Mature=false
local tree=node('treeOak','Model',nil,vec(20,0,0))
local farTree=node('treePine','Model',nil,vec(50,0,0))
local carrot=node('carrot','Model',nil,vec(4,0,0))
local blocks=node('Blocks','Folder',{stone,wheat,young,tree,farTree,carrot,node('sapling','Part'),node('grass','Part')})
local owned=node('7-island','Model',{blocks})
local other=node('8-island','Model',{node('Blocks','Folder',{node('stone','Part',nil,vec(1,0,0)),node('wheat','Model',nil,vec(1,0,0))})})
local publicTree=node('treePalm','Model',nil,vec(25,0,0))
local workspace=node('Workspace','Workspace',{node('Islands','Folder',{owned,other}),node('spawnPrefabs','Folder',{node('Forest','Folder',{publicTree})})})
local player={UserId=7,Character=node('Character','Model',{node('HumanoidRootPart','Part')})}
local RemoteCatalog={}
local CONFIG={HarvestCrop='wheat',WoodRange=30,MineRange=90,CropRange=15}
local harvestEnabled,woodEnabled,mineEnabled=true,true,true
`;
const checks=`
assert(RemoteCatalog.BuildIslandBlocks()==blocks,'blueprint capture adapter must resolve only the owned island blocks')
player.UserId=999;assert(RemoteCatalog.BuildIslandBlocks()==nil,'blueprint capture must never fall back to another island');player.UserId=7
assert(FarmLogic.Category('saplingOrange')==nil and FarmLogic.Category('berryHarvested')==nil)
assert(FarmLogic.Category('grass')==nil and FarmLogic.Category('treeOak')=='wood')
assert(getPlayerIsland()==owned,'must select owned island')
local targets=getMineTargets()
assert(#targets==5,'must skip immature/unselected crops, saplings, unrelated blocks, foreign crops and trees outside wood range')
assert(targets[2].instance==wheat and targets[3].instance==stone and targets[4].instance==tree,'targets must be nearest first')
FarmState.Cooldowns[wheat]=os.clock()+10
assert(#getMineTargets()==4,'target backoff missing')
FarmState.Cooldowns[wheat]=nil
woodEnabled=false;mineEnabled=false
assert(#getMineTargets()==1 and getMineTargets()[1].instance==wheat,'mode isolation failed')
assert(targets[5].instance==publicTree,'public resource tree not discovered')
CONFIG.HarvestCrops=FarmLogic.NormalizeCrops({wheat=true,carrot=true,invalid=true},'wheat')
woodEnabled=false;mineEnabled=false
assert(FarmLogic.CropsMatch('carrot',CONFIG.HarvestCrops,'wheat') and not FarmLogic.CropsMatch('potato',CONFIG.HarvestCrops,'wheat'),'multi-crop matching must include all and only selected crops')
assert(#getMineTargets()==2,'multi-crop scan must find ready wheat and carrot on owned island')
assert(FarmLogic.ReplantType('carrot',CONFIG.HarvestCrops,'wheat')=='carrot','carrots must not be replanted as wheat')
assert(FarmLogic.NormalizeCrops({},'berryBush').berryBush,'legacy crop preference must migrate')
CONFIG.HarvestCrops=nil

woodEnabled=false;mineEnabled=true;harvestEnabled=false
local nearOre=node('rockIron','Model',nil,vec(2,0,0))
nearOre.GetBoundingBox=function() return {Position=vec(2,0,0)},vec(3,3,3) end
nearOre.GetPivot=function() return {Position=vec(500,0,0)} end
local resourceGroup=node('rockCluster','Model',{nearOre},vec(500,0,0))
local prefabs=workspace:FindFirstChild('spawnPrefabs')
table.insert(prefabs.children,node('MiningZone','Folder',{resourceGroup}))
local mines=getMineTargets()
local nearIndex,stoneIndex
for i,target in ipairs(mines) do if target.instance==nearOre then nearIndex=i;assert(target.distance==2,'use bounds instead of distant pivot') end;if target.instance==stone then stoneIndex=i end end
assert(nearIndex and stoneIndex and nearIndex<stoneIndex,'nested near rocks must be found and sorted before farther rocks')
local before=FarmLogic.Snapshot(wheat)
assert(not FarmLogic.Confirmed(wheat,before),'successful transport alone must not count')
wheat.attributes.Mature=false
assert(FarmLogic.Confirmed(wheat,before) and not FarmLogic.IsReady(wheat),'readiness transition should confirm harvest')
wheat.attributes.Mature=true
local water=node('Water','ProximityPrompt');water.Enabled=true;water.ActionText='Water'
local prompt=node('Harvest','ProximityPrompt');prompt.Enabled=true;prompt.ActionText='Harvest'
wheat.children={water,prompt}
assert(FarmLogic.HarvestPrompt(wheat)==prompt,'must not trigger unrelated prompts')
prompt.Enabled=false
assert(FarmLogic.Confirmed(wheat,before,prompt),'disabled harvest prompt should confirm')
wheat.Parent=nil
assert(FarmLogic.Confirmed(wheat,before),'removal should confirm')
assert(FarmLogic.Range('wood',CONFIG)==30 and FarmLogic.Range('crop',CONFIG)==15,'separate farm ranges ignored')
local time,holding,releases,cancelled=0,false,0,false
prompt.HoldDuration=.2
function prompt:InputHoldBegin() holding=true end
function prompt:InputHoldEnd() holding=false;releases+=1 end
local function waitFor(dt) time+=dt end
local function now() return time end
assert(FarmLogic.HoldPrompt(prompt,function() return true end,waitFor,now) and not holding and releases==1,'normal hold/release failed')
time=0
local function cancelWait(dt) time+=dt;cancelled=true end
assert(not FarmLogic.HoldPrompt(prompt,function() return not cancelled end,cancelWait,now) and not holding and releases==2,'cancelled prompt must release and not report success')
assert(not FarmLogic.HoldPrompt(prompt,function() return true end,function() error('input failure') end,now) and not holding and releases==3,'failed hold must release')
local orangeFruit=node('Fruit','Model',nil,vec(3,0,0));orangeFruit.attributes.Mature=true
local unripeFruit=node('Fruit','Model',nil,vec(2,0,0));unripeFruit.attributes.Harvestable=false
local orangeTree=node('treeOrange','Model',{node('stage-1','Model',{orangeFruit}),node('stage-2','Model',{unripeFruit})},vec(5,0,0))
table.insert(blocks.children,orangeTree)
local foreignFruit=node('Fruit','Model',nil,vec(1,0,0))
table.insert(other:FindFirstChild('Blocks').children,node('treeOrange','Model',{node('stage-1','Model',{foreignFruit})},vec(1,0,0)))
CONFIG.FruitEnabled=true;harvestEnabled=true;woodEnabled=true;mineEnabled=false
local fruitCount=0
for _,item in ipairs(getMineTargets()) do
 if item.kind=='fruit' then fruitCount+=1;assert(item.instance==orangeFruit and item.model==orangeTree,'fruit must come from the owned tree') end
 assert(item.instance~=orangeTree,'fruit-picking tree must not become an axe target')
end
assert(fruitCount==1,'skip foreign and unripe fruit')
harvestEnabled=false
for _,item in ipairs(getMineTargets()) do assert(item.instance~=orangeTree,'Wood Farm alone must not chop a fruit tree while fruit picking is enabled') end
harvestEnabled=true
orangeTree.children={}
for _,item in ipairs(getMineTargets()) do assert(item.instance~=orangeTree,'fruit tree must remain protected after fruit removal') end
return 'Farm rules passed: owned island, mode/crop filtering, maturity, independent ranges, backoff, sorting, prompt selection and confirmation'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring('local FarmLogic=(function()\n'+farm+'\nend)()\n'+mock+targeting+checks,'farm-smoke',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
