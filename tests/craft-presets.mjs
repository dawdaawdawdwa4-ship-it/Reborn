import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const core=main.slice(main.indexOf('-- CRAFT BAIT BEGIN'),main.indexOf('-- CRAFT BAIT END'));
const wait=main.slice(main.indexOf('function RemoteCatalog.WaitChestInventory'),main.indexOf('function RemoteCatalog.ChestAutoMessage'));
const code=`
local gui={Parent=true}
local COLORS={on=1,off=2,text=3,muted=4}
local RemoteCatalog={CraftToggle={},CraftLearnButton={},CraftInfo={},CraftPresetName={Text='Materials'},CraftPresetSummary={},CraftPresetSaveButton={},CraftPresetLoadButton={},CraftPresetSlotButton={},CloseMenus=function() end}
local island={};local bench={Parent=island}
local position=setmetatable({},{__sub=function() return {Magnitude=0} end})
local player={UserId=7,Character={FindFirstChild=function() return {Position=position} end}}
local function getPlayerIsland() return island end
local function getPartPosition() return position end
local inventory,calls,workers={}, {}, {}
local task={spawn=function(fn) local co=coroutine.create(fn);table.insert(workers,co);local ok,e=coroutine.resume(co);assert(ok,e) end,wait=function() coroutine.yield() end}
local bindings={bait={Item='bait',Workbench=bench}}
local recorder={CraftBinding=bindings.bait,CraftBindings=bindings,CanUseCraftBinding=function() return true end,CraftItem=function(_,amount,binding) table.insert(calls,amount);inventory[binding.Item]=(inventory[binding.Item] or 0)+amount;return true end}
RemoteCatalog.LiveRecorder=function() return recorder end
RemoteCatalog.CarrotCount=function(item) return inventory[item] or 0 end
RemoteCatalog.ChestTooFast=function() return false end
RemoteCatalog.ChestResultText=tostring
local archive,files,writes,reads,sequence={}, {},0,0,0
local path='RebornCraftQueues_7.json'
local HttpService={JSONEncode=function(_,data) sequence+=1;local text='json-'..sequence;archive[text]=data;return text end,JSONDecode=function(_,text) assert(archive[text],'invalid JSON');return archive[text] end}
local writefile=function(name,text) assert(name==path);writes+=1;files[name]=text end
local readfile=function(name) assert(name==path);reads+=1;assert(files[name],'missing');return files[name] end
${wait}
${core}
local function job(item) return {Item=item or 'bait',Mode='Make amount',Batch=100,Target=100} end
local function has(text,part) return string.find(text,part,1,true)~=nil end
local function drain()
 for _=1,1000 do if not RemoteCatalog.CraftWorker then return end;for _,co in ipairs(workers) do if coroutine.status(co)~='dead' then local ok,e=coroutine.resume(co);assert(ok,e) end end end
 error('craft worker did not settle')
end
RemoteCatalog.CraftQueue={job(),job('unlearnedRecipe')}
RemoteCatalog.CraftQueue[1].Binding={Token='must not persist'};RemoteCatalog.CraftQueue[1].Recorder=recorder
assert(RemoteCatalog.SaveCraftPreset() and writes==1 and #calls==0,'Save must persist a queue without crafting')
local saved=RemoteCatalog.CraftPresets[1]
local payload=archive[files[path]].Presets['1']
assert(saved.Name=='Materials' and #payload.Jobs==2 and payload.Jobs[1].Binding==nil and payload.Jobs[1].Recorder==nil,'saved descriptors must omit live bindings, functions and context tokens')
local fields=0;for _ in pairs(payload.Jobs[1]) do fields+=1 end;assert(fields==4)
RemoteCatalog.CraftQueue[1].Target=500
assert(saved.Jobs[1].Target==100 and payload.Jobs[1].Target==100,'saving must detach both session and encoded snapshots from later queue edits')
assert(RemoteCatalog.SetCraftPresetSlot(2));RemoteCatalog.CraftPresetName.Text='Stock'
RemoteCatalog.CraftQueue={{Item='bait',Mode='Top up stock',Batch=25,Target=250}}
assert(RemoteCatalog.SaveCraftPreset() and archive[files[path]].Presets['1'] and archive[files[path]].Presets['2'],'saving another slot must preserve existing slots')
local sentinel={job('sentinel')};RemoteCatalog.CraftQueue=sentinel
RemoteCatalog.CraftPresets={};RemoteCatalog.CraftPresetPersistence={}
assert(RemoteCatalog.ReadCraftPresets() and RemoteCatalog.CraftQueue==sentinel and not RemoteCatalog.CraftEnabled and #calls==0,'a hub reload must read presets without replacing the working queue or auto-starting')
assert(RemoteCatalog.CraftPresets[1].Name=='Materials' and RemoteCatalog.CraftPresetPersistence[2]=='Loaded from file')
assert(RemoteCatalog.SetCraftPresetSlot(1) and RemoteCatalog.LoadCraftPreset())
assert(#RemoteCatalog.CraftQueue==2 and not RemoteCatalog.CraftEnabled and #calls==0 and RemoteCatalog.CraftQueue~=RemoteCatalog.CraftPresets[1].Jobs,'Load must replace the queue with an independent copy and keep crafting OFF')
RemoteCatalog.CraftQueue[1].Target=500;assert(RemoteCatalog.CraftPresets[1].Jobs[1].Target==100)
RemoteCatalog.LoadCraftPreset()
assert(not RemoteCatalog.SetCraftEnabled(true,true) and #calls==0 and not RemoteCatalog.CraftWorker,'loaded unknown recipes must fail whole-queue preflight before any request')
for _,jobs in ipairs({{}, {[2]=job()}, {job(),Extra=job()}, {{Item='bait',Mode='Continuous',Batch=100,Target=100}}, {{Item='bad\\nID',Mode='Make amount',Batch=100,Target=100}}, {{Item='bait',Mode='Make amount',Batch=101,Target=100}}, {{Item='bait',Mode='Make amount',Batch=100,Target=101}}}) do
 assert(not pcall(RemoteCatalog.ValidateCraftPreset,{Version=1,Name='Bad',Jobs=jobs}),'invalid or non-finite queues must be rejected')
end
local huge={};for _=1,9 do table.insert(huge,job()) end
assert(not pcall(RemoteCatalog.ValidateCraftPreset,{Version=1,Name='Bad',Jobs=huge}))
for _,name in ipairs({'',' bad','bad ','bad\\nname',string.rep('a',49)}) do assert(not pcall(RemoteCatalog.ValidateCraftPreset,{Version=1,Name=name,Jobs={job()}})) end
assert(not pcall(RemoteCatalog.ValidateCraftPresets,{Version=1,Presets={['4']={Version=1,Name='Bad',Jobs={job()}}}}))
local previous=RemoteCatalog.CraftPresets
local previousSlot=previous[1]
files[path]='invalid';assert(not RemoteCatalog.ReadCraftPresets() and RemoteCatalog.CraftPresets==previous,'corrupt JSON must preserve session presets and queue')
files[path]=string.rep('x',65537);assert(not RemoteCatalog.ReadCraftPresets() and RemoteCatalog.CraftPresets==previous,'oversized files must be rejected before applying data')
archive.bad={Version=1,Presets={['1']={Version=1,Name='Good',Jobs={job()}},['2']={Version=1,Name='Bad',Jobs={}}}};files[path]='bad'
assert(not RemoteCatalog.ReadCraftPresets() and RemoteCatalog.CraftPresets==previous and previous[1]==previousSlot,'one invalid slot must reject the complete file atomically')
local queue=RemoteCatalog.CraftQueue;local preset=RemoteCatalog.CraftPresets[1];local oldWrites=writes
RemoteCatalog.CraftQueue={};assert(not RemoteCatalog.SaveCraftPreset() and RemoteCatalog.CraftPresets[1]==preset and writes==oldWrites,'invalid saves must preserve both stored slot and file')
RemoteCatalog.CraftQueue=queue
RemoteCatalog.CraftPresets[1]={Version=1,Name='Bad',Jobs={}}
assert(not RemoteCatalog.LoadCraftPreset() and RemoteCatalog.CraftQueue==queue,'invalid preset Load must keep the working queue')
RemoteCatalog.CraftPresets[1]=preset
local writer=writefile
writefile=function() return false end;RemoteCatalog.CraftPresetName.Text='Session fallback'
assert(RemoteCatalog.SaveCraftPreset() and RemoteCatalog.CraftPresetPersistence[1]=='Session only' and not RemoteCatalog.CraftPresetBusy,'writer failure must retain the new preset in session without claiming persistence')
assert(has(RemoteCatalog.CraftPresetSummary.Text,'File saving unavailable or failed'))
writefile=nil;assert(RemoteCatalog.SaveCraftPreset() and RemoteCatalog.CraftPresetPersistence[1]=='Session only','missing writer must remain usable within the session')
writefile=writer
local reader=readfile
readfile=nil;assert(not RemoteCatalog.ReadCraftPresets() and has(RemoteCatalog.CraftPresetFileState,'unavailable'))
readfile=reader
for _,field in ipairs({'CraftWorker','CraftEnabled','CraftLearning','CraftPresetBusy','CraftCatalogLoading'}) do
 RemoteCatalog[field]=true;local before=RemoteCatalog.CraftPresets[1]
 assert(not RemoteCatalog.SaveCraftPreset() and not RemoteCatalog.LoadCraftPreset() and not RemoteCatalog.SetCraftPresetSlot(2) and not RemoteCatalog.ReadCraftPresets() and RemoteCatalog.CraftPresets[1]==before,'active/paused/cleanup/learning/catalog/file work must lock presets')
 RemoteCatalog[field]=nil
end
RemoteCatalog.Recorder={LearnCraftOnly=true};assert(not RemoteCatalog.LoadCraftPreset());RemoteCatalog.Recorder=nil
local count=writes+reads;player.UserId=8
assert(not RemoteCatalog.SaveCraftPreset() and not RemoteCatalog.ReadCraftPresets() and writes+reads==count,'account changes must not access or overwrite another account file')
player.UserId=7
writefile=function(name,text) coroutine.yield('disk');writer(name,text) end
local save=coroutine.create(RemoteCatalog.SaveCraftPreset);local ok,e=coroutine.resume(save);assert(ok,e)
assert(RemoteCatalog.CraftPresetBusy and not RemoteCatalog.CraftPresetSaveButton.Active and not RemoteCatalog.CraftPresetName.TextEditable)
assert(not RemoteCatalog.SetCraftEnabled(true,true) and not RemoteCatalog.BeginCraftLearning() and not RemoteCatalog.LoadCraftCatalog() and not RemoteCatalog.AddCraftQueueJob() and not RemoteCatalog.EditCraftQueue(true),'yielding file IO must block worker startup, learning, catalog and queue edits')
ok,e=coroutine.resume(save);assert(ok,e);assert(not RemoteCatalog.CraftPresetBusy)
writefile=writer
readfile=function(name) coroutine.yield('disk');return reader(name) end
RemoteCatalog.CraftPresets={};local empty=RemoteCatalog.CraftPresets
local read=coroutine.create(RemoteCatalog.ReadCraftPresets);ok,e=coroutine.resume(read);assert(ok,e)
gui.Parent=nil;ok,e=coroutine.resume(read);assert(ok,e)
assert(not RemoteCatalog.CraftPresetBusy and RemoteCatalog.CraftPresets==empty and next(empty)==nil,'GUI destruction during file reading must release IO state without applying the file')
gui.Parent=true;readfile=reader
assert(RemoteCatalog.ReadCraftPresets());RemoteCatalog.CraftPresetSlot=1;assert(RemoteCatalog.LoadCraftPreset())
bindings.unlearnedRecipe={Item='unlearnedRecipe',Workbench=bench}
assert(RemoteCatalog.SetCraftEnabled(true,true));drain()
assert(#calls==2 and inventory.bait==100 and inventory.unlearnedRecipe==100,'only an explicit Run Queue after current recipe learning may execute the loaded jobs')
return 'Craft presets: descriptor-only snapshots, three slots, account files, read-only reload/load, fresh-binding preflight, validation/limits, failure preservation, session fallback, IO locks and cleanup passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'craft-presets',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
