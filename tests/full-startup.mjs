import fs from 'node:fs';
import {LuauState} from 'luau-web';
const source=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8').replaceAll('\r\n','\n');
const schema=JSON.parse(fs.readFileSync(new URL('roblox-api.json',import.meta.url),'utf8'));
const lit=v=>typeof v==='string'?JSON.stringify(v):'{'+Object.entries(v).map(([k,x])=>'['+JSON.stringify(k)+']='+lit(x)).join(',')+'}';
const used=new Set(schema.Classes.filter(c=>source.includes('"'+c.Name+'"')||source.includes("'"+c.Name+"'")).map(c=>c.Name));
for(let changed=true;changed;){changed=false;for(const c of schema.Classes)if(used.has(c.Name)&&!used.has(c.Superclass)){used.add(c.Superclass);changed=true;}}
const classes=Object.fromEntries(schema.Classes.filter(c=>used.has(c.Name)).map(c=>[c.Name,{super:c.Superclass,members:Object.fromEntries(c.Members.map(m=>[m.Name,m.MemberType]))}]));
const enums=Object.fromEntries(schema.Enums.map(e=>[e.Name,Object.fromEntries(e.Items.map(i=>[i.Name,{Name:i.Name}]))]));
const setup='local API_CLASSES='+lit(classes)+'\nlocal Enum='+lit(enums)+'\n'+fs.readFileSync(new URL('roblox-mock.luau',import.meta.url),'utf8')+`
player.Name='Test';player.UserId=7
player.ChildAdded=signal();player.CharacterAdded=signal()
function player:GetAttribute() return nil end
function player:FindFirstChild(name) return self[name] end
function workspace:FindFirstChild() return nil end
local workers={}
function task.wait(dt) return coroutine.yield(dt) end
function task.spawn(fn,...)
 local co=coroutine.create(fn)
 local ok,failure=coroutine.resume(co,...)
 assert(ok,failure)
 table.insert(workers,co)
 return co
end
local function stepWorkers()
 for _,co in ipairs(table.clone(workers)) do
  if coroutine.status(co)=='suspended' then local ok,err=coroutine.resume(co);assert(ok,err) end
 end
end
local function warn() end
`;
const checks=`
flush()
buildController.Buttons.Preview.Activated:Fire()
assert(string.find(buildController.Status.Text,"spawn",1,true))
assert(buildController.Preset=="Farm plots")
assert(not RemoteCatalog.Recorder,'recorder must be off on actual full startup')
assert(RemoteCatalog.AntiAFK.Enabled and RemoteCatalog.AntiAFK.Connection,'Anti AFK must start ON with an idle listener')
local idleClicks=0
services.VirtualUser={CaptureController=function() end,ClickButton2=function() idleClicks+=1 end}
player.Idled:Fire()
assert(idleClicks==1,'Startup must wire the idle response')
RemoteCatalog.AntiAFKButton.Activated:Fire()
player.Idled:Fire()
assert(not RemoteCatalog.AntiAFK.Enabled and idleClicks==1,'Settings toggle must disable the idle response')
RemoteCatalog.AntiAFKButton.Activated:Fire()
stopAllButton.Activated:Fire()
player.Idled:Fire()
assert(not RemoteCatalog.AntiAFK.Enabled and idleClicks==1,'Stop All must disable Anti AFK')

assert(CONFIG.CastDistance==12 and activeFishingMode=='Fast' and CONFIG.FishingPollInterval==.005,'startup must use fixed Fast mode and 12-stud aim')
applyFishingMode('Safe')
assert(activeFishingMode=='Fast' and CONFIG.CastDistance==12 and not modeButtons.Safe and not modeButtons.Balanced,'other profiles must not override fixed settings')

for _,option in ipairs(woodPage:GetChildren()) do if option.Text=='Tween' then option.Activated:Fire() end end
assert(CONFIG.WoodTravelMode=='Tween' and CONFIG.FarmTravelMode=='Walk' and string.find(RemoteCatalog.TravelSelectors[1].Text,'Walk',1,true),'wood mode selection must not change Harvest travel')
assert(not enabled and not woodEnabled and not harvestEnabled,'choosing a travel mode must not start automation')
for _,option in ipairs(woodPage:GetChildren()) do if option.Text=='Normal' then option.Activated:Fire() end end
assert(CONFIG.WoodTravelMode=='Normal' and CONFIG.FarmTravelMode=='Walk','Normal must be selectable for wood without changing crop travel')

assert(SETTINGS_FILE=='IslandsFarmingHub_7_settings.json','preferences must be isolated by account')
local hum={WalkSpeed=16,JumpPower=50,JumpHeight=7.2,UseJumpPower=true}
local character={FindFirstChildOfClass=function() return hum end,GetChildren=function() return {} end,WaitForChild=function() return hum end}
player.Character=character
movementController.WalkButton.Activated:Fire();movementController.JumpButton.Activated:Fire()
assert(hum.WalkSpeed==20 and hum.JumpPower==60,'movement presets must apply')
movementController.ResetButton.Activated:Fire()
assert(hum.WalkSpeed==16 and hum.JumpPower==50,'reset must restore movement')
hum.UseJumpPower=false
movementController.JumpButton.Activated:Fire();assert(hum.JumpHeight==10,'height-based jump mode missing')
local secondHum={WalkSpeed=18,JumpPower=55,JumpHeight=8,UseJumpPower=false}
local secondChar={FindFirstChildOfClass=function() return secondHum end,GetChildren=function() return {} end,WaitForChild=function() return secondHum end}
player.Character=secondChar;player.CharacterAdded:Fire(secondChar)
assert(secondHum.JumpHeight==10,'enabled movement must follow respawn')
movementController:Reset();assert(secondHum.WalkSpeed==18 and secondHum.JumpHeight==8,'respawn reset must use new character defaults')
player.Character=nil

registerHarvest('treeOrange','wood');registerHarvest('coal','mine');registerHarvest('wheat','crop')
for _,entry in ipairs({{'Wood Farm','WOOD STATS'},{'Mining','MINING STATS'},{'Harvest','CROP STATS'}}) do
 showTab(entry[1]);updateBoard()
 assert(statsOverlayTitle.Text==entry[2] and overlayValues.catches.Text=='1','resource overlay must show independent category totals')
end
showTab('Fishing');updateBoard()
assert(statsOverlayTitle.Text=='FISHING STATS' and overlayValues.catches.Text=='0','resource totals must not change fishing counters')
assert(not enabled and not harvestEnabled and not woodEnabled and not mineEnabled and not baitEnabled)
fruitToggle.Activated:Fire()
assert(CONFIG.FruitEnabled and harvestEnabled,'fruit toggle must start the shared harvest worker')
fruitToggle.Activated:Fire();setHarvestEnabled(false);stepWorkers()
assert(not CONFIG.FruitEnabled and not harvestEnabled,'fruit picking must be independently disabled')
cropSelect.Activated:Fire();cropButtons[2].Activated:Fire()
assert(CONFIG.HarvestCrops.wheat and CONFIG.HarvestCrops.carrot and cropDropdown.Visible,'multi-select must keep existing crops and leave menu open')
cropButtons[1].Activated:Fire();assert(not CONFIG.HarvestCrops.wheat and CONFIG.HarvestCrops.carrot,'selected crops can be removed')
cropButtons[2].Activated:Fire();assert(CONFIG.HarvestCrops.carrot,'last selection must not be removed')
cropButtons[1].Activated:Fire();cropButtons[2].Activated:Fire();cropSelect.Activated:Fire()
assert(CONFIG.HarvestCrops.wheat and not CONFIG.HarvestCrops.carrot and not cropDropdown.Visible,'menu must close without losing chosen crops')
woodToggle.Activated:Fire();harvestToggle.Activated:Fire()
assert(harvestEnabled and not woodEnabled and not mineEnabled,'Harvest must switch off wood/mining')
mineToggle.Activated:Fire();assert(mineEnabled and not harvestEnabled and not woodEnabled,'Mining must select only its worker mode')
mineToggle.Activated:Fire();stepWorkers()
local baitApplications=0
applyBait=function() baitApplications+=1;return true end
for _,button in ipairs({toggle,harvestToggle,woodToggle,mineToggle,baitToggle}) do
 button.Activated:Fire()
 if button==toggle then
  assert(not baitEnabled and baitApplications==0,'Fishing must leave bait OFF')
  setEnabled(true);assert(baitApplications==0,'repeated Start must not enable bait')
 end
 assert(string.find(button.Text,'ON',1,true),'actual switch/worker failed to stay ON: '..button.Text..' status='..status.Text)
 button.Activated:Fire()
 if button==toggle then assert(not baitEnabled,'Stopping Fishing must leave bait OFF') end
 assert(string.find(button.Text,'OFF',1,true),'actual switch failed to turn OFF')
 stepWorkers()
end
RemoteCatalog.BaitMouseInput=true
baitToggle.Activated:Fire()
assert(not baitEnabled,'synthetic bait input must not enable its own toggle')
RemoteCatalog.BaitMouseInput=false
local beforeManualBait=baitApplications
setBaitEnabled(true)
assert(baitEnabled and baitApplications==beforeManualBait+1,'manual bait must apply immediately')
setEnabled(true);setEnabled(false)
assert(baitEnabled and baitApplications==beforeManualBait+1,'Fishing must preserve manually enabled bait')
setBaitEnabled(false);stepWorkers()
applyBait=function() return false,'bait tool not found' end
setBaitEnabled(true);assert(not enabled,'missing bait must not start Fishing');setBaitEnabled(false);stepWorkers()
applyBait=function() return true,'bait consumption confirmed' end
setBaitEnabled(true)
assert(enabled and baitEnabled and not RemoteCatalog.StartFishingOnBait,'confirmed bait must start Fishing once and clear the startup request')
setEnabled(false)
assert(not enabled and not RemoteCatalog.StartFishingOnBait,'manual Fishing OFF must cancel automatic startup')
setBaitEnabled(false);stepWorkers()
assert(not enabled and not harvestEnabled and not woodEnabled and not mineEnabled and not baitEnabled)
assert(not string.find(status.Text,'stopped:',1,true),'worker error during actual startup/switch test: '..status.Text)
gui:Destroy();stepWorkers()
assert(#connections==0,'cleanup must disconnect tracked listeners')
return 'Full application startup, real switch handlers/workers and cleanup passed without recorder or learned IDs'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(setup+'\nlocal function runApplication()\n'+source+'\n'+checks+'\nend\nreturn runApplication()','full-startup',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
