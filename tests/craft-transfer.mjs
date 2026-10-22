import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const core=main.slice(main.indexOf('-- CRAFT BAIT BEGIN'),main.indexOf('-- CRAFT BAIT END'));
const wait=main.slice(main.indexOf('function RemoteCatalog.WaitChestInventory'),main.indexOf('function RemoteCatalog.ChestAutoMessage'));
const code=`
local gui={Parent=true}
local COLORS={on=1,off=2,text=3,muted=4}
local UDim2={new=function(...) return {...} end}
local RemoteCatalog={CraftToggle={},CraftLearnButton={},CraftInfo={},CloseMenus=function() end,
 CraftTransferText={Text='keep draft'},CraftTransferPanel={},CraftTransferButton={},CraftTransferHint={},CraftPresetName={Text=' Shared queue '}}
local island={};local bench={Parent=island}
local position=setmetatable({},{__sub=function() return {Magnitude=0} end})
local player={UserId=7,Character={FindFirstChild=function() return {Position=position} end}}
local function getPlayerIsland() return island end
local function getPartPosition() return position end
local requests,writes,decodes,sequence=0,0,0,0
local inventory={}
local bindings={bait={Item='bait',Workbench=bench}}
local recorder={CraftBinding=bindings.bait,CraftBindings=bindings,CanUseCraftBinding=function() return true end,CraftItem=function(_,amount,binding) requests+=1;inventory[binding.Item]=(inventory[binding.Item] or 0)+amount;return true end}
RemoteCatalog.LiveRecorder=function() return recorder end
RemoteCatalog.CarrotCount=function(item) return inventory[item] or 0 end
RemoteCatalog.ChestTooFast=function() return false end
RemoteCatalog.ChestResultText=tostring
local task={spawn=function(fn) fn() end,wait=function() end}
local archive,onEncode,onDecode={}
local HttpService={JSONEncode=function(_,data)
 if onEncode then return onEncode(data) end
 sequence+=1;local text='json-'..sequence;archive[text]=data;return text
end,JSONDecode=function(_,text)
 decodes+=1;if onDecode then return onDecode(text) end
 assert(archive[text],'invalid JSON');return archive[text]
end}
local writefile=function() writes+=1;error('transfer must not write preset files') end
local setclipboard
${wait}
${core}
local function job(item,mode) return {Item=item or 'bait',Mode=mode or 'Make amount',Batch=100,Target=100} end
local function payload(jobs) return {Version=1,Name='Shared queue',Jobs=jobs or {job()}} end
local function has(text,part) return string.find(text,part,1,true)~=nil end
local function reset()
 gui.Parent=true;player.UserId=7;onEncode=nil;onDecode=nil;setclipboard=nil
 RemoteCatalog.CraftEnabled=false;RemoteCatalog.CraftWorker=nil;RemoteCatalog.CraftPaused=false
 RemoteCatalog.CraftTransferBusy=false;RemoteCatalog.CraftPresetBusy=false;RemoteCatalog.CraftCatalogLoading=false;RemoteCatalog.CraftLearning=false;RemoteCatalog.Recorder=nil
 RemoteCatalog.CraftQueue={job()};RemoteCatalog.CraftPresetName.Text=' Shared queue ';RemoteCatalog.CraftTransferText.Text='keep draft'
end
reset()
local source=RemoteCatalog.CraftQueue
source[1].Binding={Secret='session'};source[1].RemotePath='old path'
local ok,text=RemoteCatalog.ExportCraftQueue(false)
assert(ok and archive[text].Name=='Shared queue' and archive[text].Jobs[1].Binding==nil and archive[text].Jobs[1].RemotePath==nil,'export must normalize its name and serialize descriptor fields only')
assert(RemoteCatalog.CraftQueue==source and source[1].Binding.Secret=='session' and RemoteCatalog.CraftTransferText.Text==text and requests==0 and writes==0,'export must leave queue/context data and files untouched, showing JSON in the field')
source[1].Target=500;assert(archive[text].Jobs[1].Target==100,'export must snapshot descriptors independently')
assert(RemoteCatalog.ImportCraftQueue(text) and RemoteCatalog.CraftQueue~=source and RemoteCatalog.CraftQueue[1].Target==100 and requests==0,'exported text must round-trip into a fresh working queue without crafting')
local saved=payload({job('unlearned')});RemoteCatalog.CraftPresets[1]=saved
RemoteCatalog.CraftQueueSelected=1;RemoteCatalog.CraftQueueDone=1;RemoteCatalog.CraftQueueTotal=500;RemoteCatalog.CraftQueueIndex=1;RemoteCatalog.CraftMaterialRun={}
archive.import=payload({job('bait'),job('unlearned','Top up stock')});archive.import.Session='ignored';archive.import.Jobs[1].Binding={Secret='discard'}
assert(RemoteCatalog.ImportCraftQueue('import'))
assert(#RemoteCatalog.CraftQueue==2 and RemoteCatalog.CraftQueue[2].Item=='unlearned' and not RemoteCatalog.CraftQueue[1].Binding and RemoteCatalog.CraftPresets[1]==saved,'import must copy finite descriptors, keeping saved presets and excluding request context')
assert(not RemoteCatalog.CraftWorker and not RemoteCatalog.CraftEnabled and not RemoteCatalog.CraftQueueSelected and RemoteCatalog.CraftQueueDone==0 and RemoteCatalog.CraftQueueTotal==0 and not RemoteCatalog.CraftMaterialRun,'import must clear old progress/selection while leaving crafting OFF')
archive.import.Jobs[1].Target=10000;assert(RemoteCatalog.CraftQueue[1].Target==100,'decoded objects must not alias imported jobs')
assert(not RemoteCatalog.SetCraftEnabled(true,true) and requests==0,'an imported unknown recipe must fail whole-queue learned-binding preflight before any request')
archive.known=payload({job()});assert(RemoteCatalog.ImportCraftQueue('known') and requests==0)
assert(RemoteCatalog.SetCraftEnabled(true,true) and requests==1 and inventory.bait==100,'an explicit Run Queue must still use current learned bindings and normal confirmations')
reset();local keep=RemoteCatalog.CraftQueue
for index,bad in ipairs({{Version=2,Name='X',Jobs={job()}},{Version=1,Name='X',Jobs={}},{Version=1,Name='X',Jobs={job('bait','Continuous')}},{Version=1,Name='X',Jobs={[2]=job()}},{Version=1,Name='X',Jobs={{Item='bait',Mode='Make amount',Batch=101,Target=100}}},{Version=1,Name='X',Jobs={{Item='bait',Mode='Make amount',Batch=100,Target=101}}}}) do
 archive['bad-'..index]=bad
 assert(not RemoteCatalog.ImportCraftQueue('bad-'..index) and RemoteCatalog.CraftQueue==keep and RemoteCatalog.CraftPresets[1]==saved,'invalid imports must be atomic and preserve working/saved queues')
end
local beforeDecodes=decodes
for _,bad in ipairs({'',string.rep('x',32769),false,42}) do assert(not RemoteCatalog.ImportCraftQueue(bad)) end
assert(decodes==beforeDecodes,'type/size limits must be checked before decoding')
assert(not RemoteCatalog.ImportCraftQueue('malformed JSON') and RemoteCatalog.CraftQueue==keep and not RemoteCatalog.CraftTransferBusy,'decode failures must preserve the queue and release transfer locks')
for _,encoder in ipairs({function() error('encoder failed') end,function() return false end,function() return string.rep('x',32769) end}) do
 onEncode=encoder
 assert(not RemoteCatalog.ExportCraftQueue(false) and RemoteCatalog.CraftTransferText.Text=='keep draft' and RemoteCatalog.CraftQueue==keep and not RemoteCatalog.CraftTransferBusy,'failed/oversized exports must preserve the draft and queue')
end
onEncode=nil;RemoteCatalog.CraftPresetName.Text='';ok,text=RemoteCatalog.ExportCraftQueue(false)
assert(ok and archive[text].Name=='Shared craft queue','blank names should have a portable default')
RemoteCatalog.CraftPresetName.Text=string.rep('x',49);RemoteCatalog.CraftTransferText.Text='keep draft'
assert(not RemoteCatalog.ExportCraftQueue(false) and RemoteCatalog.CraftTransferText.Text=='keep draft','invalid export names must not erase transfer drafts')
reset();RemoteCatalog.CraftQueue={};assert(not RemoteCatalog.ExportCraftQueue(false),'empty queues cannot be exported as unloadable presets')
for _,field in ipairs({'CraftWorker','CraftEnabled','CraftPresetBusy','CraftTransferBusy','CraftCatalogLoading','CraftLearning'}) do
 reset();RemoteCatalog[field]=true;keep=RemoteCatalog.CraftQueue
 assert(not RemoteCatalog.ImportCraftQueue('known') and not RemoteCatalog.ExportCraftQueue(true) and RemoteCatalog.CraftQueue==keep and RemoteCatalog.CraftTransferText.Text=='keep draft','busy '..field..' must lock both transfer directions')
end
reset();RemoteCatalog.Recorder={LearnCraftOnly=true};assert(not RemoteCatalog.ImportCraftQueue('known'))
reset();player.UserId=8;assert(not RemoteCatalog.ExportCraftQueue(false) and not RemoteCatalog.ImportCraftQueue('known'),'switching accounts requires a fresh hub')
reset();gui.Parent=false;assert(not RemoteCatalog.ImportCraftQueue('known') and not RemoteCatalog.ExportCraftQueue(false))
reset();local copied
setclipboard=function(value) copied=value end
assert(RemoteCatalog.ExportCraftQueue(true) and copied==RemoteCatalog.CraftTransferText.Text and has(RemoteCatalog.CraftTransferHint.Text,'copied'),'copy must export current canonical descriptors and show success locally')
for _,copier in ipairs({function() return false end,function() error('clipboard failed') end}) do
 setclipboard=copier
 assert(RemoteCatalog.ExportCraftQueue(true) and has(RemoteCatalog.CraftTransferHint.Text,'Select and copy'),'failed clipboard writes must leave a usable text-field fallback')
end
setclipboard=nil;assert(RemoteCatalog.ExportCraftQueue(true) and has(RemoteCatalog.CraftInfo.Text,'Clipboard unavailable'))
reset();local beforeRequests=requests
onEncode=function(data)
 assert(not RemoteCatalog.SetCraftEnabled(true,true) and not RemoteCatalog.ImportCraftQueue('known') and not RemoteCatalog.SaveCraftPreset() and not RemoteCatalog.AddCraftQueueJob(),'transfer locks must block reentrant runs, imports, preset writes and edits')
 archive.reentrant=data;return 'reentrant'
end
assert(RemoteCatalog.ExportCraftQueue(false) and requests==beforeRequests and writes==0,'reentrant callbacks must not craft or write files')
reset();keep=RemoteCatalog.CraftQueue
onDecode=function() RemoteCatalog.SetCraftEnabled(false);return payload() end
assert(not RemoteCatalog.ImportCraftQueue('known') and RemoteCatalog.CraftQueue==keep and not RemoteCatalog.CraftTransferBusy,'Stop during a yielding decode must invalidate the old import')
reset();local replacement={job('unlearned')}
onDecode=function() RemoteCatalog.CraftQueue=replacement;return payload() end
assert(not RemoteCatalog.ImportCraftQueue('known') and RemoteCatalog.CraftQueue==replacement,'an old decode must not overwrite a replaced working queue')
reset();onEncode=function() gui.Parent=false;return 'stale' end
assert(not RemoteCatalog.ExportCraftQueue(false) and RemoteCatalog.CraftTransferText.Text=='keep draft' and not RemoteCatalog.CraftTransferBusy,'destroyed UI must not publish a stale export')
assert(writes==0,'import/export must never write preset files implicitly')
return 'Craft queue sharing: descriptor-only JSON, size/schema limits, atomic import, snapshot isolation, fresh-binding preflight, clipboard fallback, busy/account locks and stale callback cleanup passed'
`;
const state=await LuauState.createAsync();
try{console.log(await state.loadstring(code,'craft-transfer',true)());}finally{state.destroy();}
