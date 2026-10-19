import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const source=main.slice(main.indexOf('-- CHEST PROFILES BEGIN'),main.indexOf('-- CHEST PROFILES END'));
const code=`
local function template()
 return {Version=1,Name='Wood run',ItemMode='Selected',Items={'wood','stone'},Discover=false,Whole=false,Speed='Fast',Travel='Walk',Range=60,Goal=100}
end
local player={UserId=7}
local COLORS={warn=1,good=2}
local message
local function setStatus(value) message=value end
local RemoteCatalog={ChestSpeed='Standard',ChestTravel='Stay',ChestDiscover=true,ChestWhole=true,ChestScanRange=120,ChestSelection={}}
for _,key in ipairs({'ChestProfileSlotButton','ChestProfileSummary','ChestProfileName','ChestSpeedButton','ChestTravelButton','ChestRangeButton','ChestGoalButton','ChestStockButton','ChestScopeButton','ChestWholeButton','ChestItemButton'}) do RemoteCatalog[key]={} end
local closes,updates,previews=0,0,0
RemoteCatalog.CloseMenus=function() closes+=1 end
RemoteCatalog.UpdateChestSelectionUI=function() updates+=1 end
RemoteCatalog.PreviewChestSelection=function() previews+=1 end
RemoteCatalog.ChestItemSelectionText=function() return RemoteCatalog.ChestItems and 'Selected' or 'All learned' end
RemoteCatalog.SetChestAuto=function() error('profiles must never start or stop automation') end
RemoteCatalog.WithdrawCarrots=function() error('profiles must never withdraw') end
RemoteCatalog.Navigation={Stop=function() error('profiles must never move the player') end}
local db={startup={Version=1,Profiles={['1']=template()}}}
local file='startup'
local readCalls,writes,encodes=0,0,0
local HttpService={JSONDecode=function(_,value) return assert(db[value],'invalid JSON') end,
 JSONEncode=function(_,value) encodes+=1;local key='json-'..encodes;db[key]=value;return key end}
local readfile=function(path) assert(path=='RebornChestProfiles_7.json');readCalls+=1;return file end
local writefile=function(path,value) assert(path=='RebornChestProfiles_7.json');writes+=1;file=value end
${source}
assert(readCalls==1 and RemoteCatalog.ChestProfiles[1].Name=='Wood run' and RemoteCatalog.ChestProfileName.Text=='Wood run','startup must cache valid profile files and show their names')
assert(RemoteCatalog.ChestSpeed=='Standard' and RemoteCatalog.ChestTravel=='Stay' and RemoteCatalog.ChestDiscover and RemoteCatalog.ChestWhole and RemoteCatalog.ChestSelection and not RemoteCatalog.ChestItems,'startup must not apply a stored profile')
assert(previews==0 and updates==0 and writes==0,'startup must remain read-only')
local validated=RemoteCatalog.ValidateChestProfile(template())
assert(validated.StockTarget==0,'v57 profiles without an inventory target must default to no limit')
assert(validated.Repeat==false,'older profiles must retain one-pass behavior')
local input=template();input.Binding={Session='secret'};local copy=RemoteCatalog.ValidateChestProfile(input)
copy.Items[1]='other'
assert(input.Items[1]=='wood' and not copy.Binding,'validation must copy names and discard non-profile fields')
for _,change in ipairs({
 {'Version',2},{'Name',''},{'Name',string.rep('a',49)},{'Name',' bad'},{'Name','bad'..string.char(10)},
 {'ItemMode','Unknown'},{'Items',{'wood','wood'}},{'Items',{[1]='wood',[3]='stone'}},{'Items',{''}},
 {'Items',{' bad'}},{'Items',{string.rep('x',129)}},{'Discover','true'},{'Whole',1},
 {'Speed','Turbo'},{'Travel','Teleport'},{'Range',15},{'Goal',-1},{'Goal',0/0},{'Goal',math.huge},{'Goal',25.5},
 {'StockTarget',-1},{'StockTarget','50'},{'StockTarget',true},{'StockTarget',0/0},{'StockTarget',math.huge},{'StockTarget',25.5},
 {'Repeat','true'},{'Repeat',1},{'Repeat',{}}
}) do
 local bad=template();bad[change[1]]=change[2]
 assert(not pcall(RemoteCatalog.ValidateChestProfile,bad),'invalid '..change[1]..' must be rejected')
end
local tooMany=template();tooMany.Items={};for i=1,65 do tooMany.Items[i]='item'..i end
assert(not pcall(RemoteCatalog.ValidateChestProfile,tooMany),'item count must be bounded')
local all=template();all.ItemMode='All'
assert(not pcall(RemoteCatalog.ValidateChestProfile,all),'All mode cannot hide a nonempty selected list')
for _,bad in ipairs({{Version=2,Profiles={}},{Version=1,Profiles={['4']=template()}},{Version=1,Profiles={[1]=template()}},{Version=1,Profiles={['2']={Version=1}}}}) do
 assert(not pcall(RemoteCatalog.ValidateChestProfiles,bad),'invalid envelopes must not load partially')
end
-- Loading changes only preferences and refreshes the existing read-only preview.
assert(RemoteCatalog.LoadChestProfile())
assert(RemoteCatalog.ChestItems.wood and RemoteCatalog.ChestItems.stone and not RemoteCatalog.ChestSelection and not RemoteCatalog.ChestItem,'load must restore selected items and discard stale chest/single-item selection')
assert(RemoteCatalog.ChestSpeed=='Fast' and RemoteCatalog.ChestTravel=='Walk' and RemoteCatalog.ChestScanRange==60 and RemoteCatalog.ChestGoal==100 and not RemoteCatalog.ChestDiscover and not RemoteCatalog.ChestWhole,'load must restore the full collection configuration')
assert(previews==1 and closes==1 and updates==1 and not RemoteCatalog.ChestAutoEnabled and writes==0,'loading must not send requests, start automation or write files')
assert(RemoteCatalog.ChestSpeedButton.Text=='Pace: Fast' and RemoteCatalog.ChestGoalButton.Text=='Auto goal: 100 items','loaded settings must update their actual control labels')
RemoteCatalog.ChestStockTarget=50
RemoteCatalog.ChestRepeat=true
assert(RemoteCatalog.LoadChestProfile() and not RemoteCatalog.ChestStockTarget,'loading an older profile must clear a previously selected top-up cap')
assert(not RemoteCatalog.ChestRepeat,'loading an older profile must also clear Repeat')
assert(RemoteCatalog.ChestAutoBatch==30,'older profiles must retain the former fixed thirty-item batch')
assert(RemoteCatalog.ChestOrder=='Same stack','older profiles must preserve original same-stack scheduling')
for _,order in ipairs({'Same stack','Balance chests'}) do local profile=template();profile.Order=order;assert(RemoteCatalog.ValidateChestProfile(profile).Order==order) end
for _,order in ipairs({false,1,'Round robin'}) do local profile=template();profile.Order=order;assert(not pcall(RemoteCatalog.ValidateChestProfile,profile)) end
for _,batch in ipairs({'Max',30,60,100,250,500,1000}) do local profile=template();profile.AutoBatch=batch;assert(RemoteCatalog.ValidateChestProfile(profile).AutoBatch==batch) end
for _,batch in ipairs({false,1,31,1001,'1000'}) do local profile=template();profile.AutoBatch=batch;assert(not pcall(RemoteCatalog.ValidateChestProfile,profile),'invalid batches must not load') end
RemoteCatalog.ChestItems.wood=nil
assert(#RemoteCatalog.ChestProfiles[1].Items==2,'loaded item filters must not alias saved data')
-- Save normalizes names and serializes only preference data.
RemoteCatalog.ChestProfileName.Text='  Stone run  '
RemoteCatalog.ChestStockTarget=50
RemoteCatalog.ChestRepeat=true
RemoteCatalog.ChestAutoBatch='Max'
RemoteCatalog.ChestOrder='Balance chests'
RemoteCatalog.ChestAutoPaused=true;RemoteCatalog.ChestRateDelay=1
assert(RemoteCatalog.SaveChestProfile() and writes==1 and RemoteCatalog.ChestProfiles[1].Name=='Stone run')
local disk=db[file]
assert(disk.Version==1 and disk.Profiles['1'].Items[1]=='stone' and not disk.Profiles['1'].Binding and not disk.Profiles['1'].Selection,'only validated preference fields may be saved')
assert(disk.Profiles['1'].StockTarget==50,'profile files must retain the inventory preference')
assert(disk.Profiles['1'].Repeat==true,'profile files must retain the explicit repeat preference')
assert(disk.Profiles['1'].AutoBatch=='Max' and disk.Profiles['1'].ChestAutoPaused==nil and disk.Profiles['1'].ChestRateDelay==nil,'persist only batch preferences, never live pause/rate state')
assert(disk.Profiles['1'].Order=='Balance chests','profiles must retain scheduling preference without live cursors')
RemoteCatalog.ChestOrder='Same stack'
RemoteCatalog.ChestAutoBatch=30;RemoteCatalog.ChestAutoPaused=false;RemoteCatalog.ChestRateDelay=nil
RemoteCatalog.ChestStockTarget=nil
RemoteCatalog.ChestRepeat=false
assert(RemoteCatalog.LoadChestProfile() and RemoteCatalog.ChestStockTarget==50 and string.find(RemoteCatalog.ChestStockButton.Text,'50',1,true),'loading must restore the saved cap and label without starting collection')
assert(RemoteCatalog.ChestRepeat and not RemoteCatalog.ChestAutoEnabled,'loading a repeat profile must not start a worker')
assert(RemoteCatalog.ChestAutoBatch=='Max' and not RemoteCatalog.ChestAutoPaused,'load must restore Max without starting or pausing a run')
assert(RemoteCatalog.ChestOrder=='Balance chests','load must restore balancing without starting a worker')
RemoteCatalog.ChestProfiles[1].Items[1]='wood'
assert(disk.Profiles['1'].Items[1]=='stone','file snapshots must not alias session profiles')
local saved=RemoteCatalog.ChestProfiles[1]
RemoteCatalog.ChestProfileName.Text=' '
assert(not RemoteCatalog.SaveChestProfile() and RemoteCatalog.ChestProfiles[1]==saved and writes==1,'invalid names must preserve stored profiles')
-- Preserve both All and an explicit empty checklist across saves/loads.
RemoteCatalog.ChestProfileSlot=2;RemoteCatalog.ChestProfileName.Text='Nothing';RemoteCatalog.ChestItems={};RemoteCatalog.ChestGoal=nil
assert(RemoteCatalog.SaveChestProfile() and #RemoteCatalog.ChestProfiles[2].Items==0 and RemoteCatalog.ChestProfiles[2].ItemMode=='Selected')
RemoteCatalog.ChestItems=nil;assert(RemoteCatalog.LoadChestProfile() and RemoteCatalog.ChestItems and next(RemoteCatalog.ChestItems)==nil and not RemoteCatalog.ChestGoal,'None must never become All on load')
RemoteCatalog.ChestProfileSlot=3;RemoteCatalog.ChestProfileName.Text='Everything';RemoteCatalog.ChestItems=nil
assert(RemoteCatalog.SaveChestProfile() and RemoteCatalog.ChestProfiles[3].ItemMode=='All')
RemoteCatalog.ChestItems={wood=true};assert(RemoteCatalog.LoadChestProfile() and not RemoteCatalog.ChestItems,'All mode must restore the unfiltered learned-item setting')
-- Legacy single-item filters save their actual intersection with the checklist.
RemoteCatalog.ChestProfileName.Text='Legacy';RemoteCatalog.ChestItem='wood';RemoteCatalog.ChestItems={stone=true}
assert(RemoteCatalog.SaveChestProfile() and #RemoteCatalog.ChestProfiles[3].Items==0)
RemoteCatalog.ChestItems=nil;assert(RemoteCatalog.SaveChestProfile() and RemoteCatalog.ChestProfiles[3].Items[1]=='wood');RemoteCatalog.ChestItem=nil
-- Failed or unavailable file APIs keep the newest session save.
local writer=writefile
writefile=function() error('disk failed') end
RemoteCatalog.ChestProfileName.Text='Session copy';assert(RemoteCatalog.SaveChestProfile() and RemoteCatalog.ChestProfilePersistence[3]=='Session only')
local session=RemoteCatalog.ChestProfiles[3]
assert(RemoteCatalog.ReadChestProfiles() and RemoteCatalog.ChestProfiles[3]==session,'file refresh must not replace a newer session-only profile')
writefile=function() return false end
assert(RemoteCatalog.SaveChestProfile() and RemoteCatalog.ChestProfilePersistence[3]=='Session only','explicit false writer results must not be claimed as durable')
writefile=nil;assert(RemoteCatalog.SaveChestProfile() and RemoteCatalog.ChestProfilePersistence[3]=='Session only')
writefile=writer;assert(RemoteCatalog.SaveChestProfile())
for slot=1,3 do assert(RemoteCatalog.ChestProfilePersistence[slot]=='File + session','a successful whole-file write must persist all cached slots') end
local reader=readfile
for _,bad in ipairs({'invalid-json',string.rep('x',65537)}) do
 readfile=function() return bad end
 assert(not RemoteCatalog.ReadChestProfiles() and RemoteCatalog.ChestProfiles[3].Name=='Session copy','bad files must leave session data intact')
end
readfile=nil;assert(not RemoteCatalog.ReadChestProfiles());readfile=reader
-- Collection, cleanup, manual work and learning all lock profile application/saving.
local beforeWrites,beforePreviews=writes,previews
for _,key in ipairs({'ChestAutoEnabled','ChestAutoWorker','ChestBusy','Learning'}) do
 if key=='Learning' then RemoteCatalog.Recorder={LearnChestOnly=true} else RemoteCatalog[key]=true end
 local speed=RemoteCatalog.ChestSpeed
 assert(not RemoteCatalog.SaveChestProfile() and not RemoteCatalog.LoadChestProfile() and RemoteCatalog.ChestSpeed==speed,'busy '..key..' must lock settings and saves')
 if key=='Learning' then RemoteCatalog.Recorder=nil else RemoteCatalog[key]=nil end
end
assert(writes==beforeWrites and previews==beforePreviews,'blocked profiles must not write files or change the target preview')
for _,badSlot in ipairs({0,4,1.5,'1',math.huge,0/0}) do
 RemoteCatalog.ChestProfileSlot=badSlot
 assert(not RemoteCatalog.SaveChestProfile() and not RemoteCatalog.LoadChestProfile(),'invalid profile slots must not change settings or serialize unloadable keys')
end
RemoteCatalog.ChestProfileSlot=3
-- A malformed sibling makes the entire file invalid before any slot is merged.
local cached=RemoteCatalog.ChestProfiles;RemoteCatalog.ChestProfiles={}
db.partial={Version=1,Profiles={['1']=template(),['2']={Version=999}}};file='partial'
assert(not RemoteCatalog.ReadChestProfiles() and next(RemoteCatalog.ChestProfiles)==nil,'invalid files must not partially load valid siblings')
RemoteCatalog.ChestProfiles=cached
return 'Chest profiles: validation, startup read-only cache, account files, independent snapshots, All/None/legacy filters, session fallback and worker guards passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'chest-profiles',true)());} finally {state.destroy();}
