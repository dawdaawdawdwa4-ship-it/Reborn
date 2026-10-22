import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const source=main.slice(main.indexOf('-- CHEST PROFILES BEGIN'),main.indexOf('-- CHEST PROFILES END'));
const code=`
local gui={Parent=true}
local player={UserId=7}
local COLORS={warn=1,good=2}
local UDim2={new=function(...) return {...} end}
local status
local function setStatus(text) status=text end
local RemoteCatalog={ChestDiscover=true,ChestWhole=false,ChestSpeed='Fast',ChestTravel='Stay',ChestScanRange=120,
 ChestAutoBatch='Max',ChestOrder='Balance chests',ChestStockTarget=100,ChestRepeat=true,ChestGoal=250}
for _,key in ipairs({'ChestProfileName','ChestProfileSummary','ChestProfileSlotButton','ChestProfilesPanel','ChestProfilesButton',
 'ChestTransferPanel','ChestTransferButton','ChestTransferText','ChestTransferHint','ChestStockButton','ChestSpeedButton',
 'ChestTravelButton','ChestRangeButton','ChestGoalButton','ChestScopeButton','ChestWholeButton','ChestItemButton'}) do RemoteCatalog[key]={} end
RemoteCatalog.ChestProfileName.Text=' Supply run '
RemoteCatalog.ChestTransferText.Text='keep draft'
local previews,closes=0,0
RemoteCatalog.CloseMenus=function() closes+=1 end
RemoteCatalog.UpdateChestSelectionUI=function() end
RemoteCatalog.PreviewChestSelection=function() previews+=1 end
RemoteCatalog.LayoutChestControls=function() end
RemoteCatalog.ChestItemSelectionText=function() return 'filter' end
RemoteCatalog.SetChestAuto=function() error('transfer must not start/stop automation') end
RemoteCatalog.WithdrawCarrots=function() error('transfer must not send a request') end
RemoteCatalog.Navigation={Stop=function() error('transfer must not walk') end}
local writes,decodes,sequence=0,0,0
local archive,onEncode,onDecode={}
local HttpService={JSONEncode=function(_,data)
 if onEncode then return onEncode(data) end
 sequence+=1;local text='json-'..sequence;archive[text]=data;return text
end,JSONDecode=function(_,text)
 decodes+=1;if onDecode then return onDecode(text) end
 assert(archive[text],'malformed JSON');return archive[text]
end}
local writefile=function() writes+=1 end
local setclipboard,toclipboard
${source}
local function has(text,part) return string.find(text,part,1,true)~=nil end
local function reset()
 gui.Parent=true;player.UserId=7;onEncode=nil;onDecode=nil;setclipboard=nil;toclipboard=nil
 RemoteCatalog.ChestAutoEnabled=false;RemoteCatalog.ChestAutoWorker=nil;RemoteCatalog.ChestBusy=false;RemoteCatalog.ChestTransferBusy=false;RemoteCatalog.Recorder=nil
 RemoteCatalog.ChestProfileSlot=1;RemoteCatalog.ChestProfileName.Text=' Supply run ';RemoteCatalog.ChestTransferText.Text='keep draft'
 RemoteCatalog.ChestItems={wood=true,stone=true};RemoteCatalog.ChestItem=nil;RemoteCatalog.ChestSelection=nil
 RemoteCatalog.ChestDiscover=true;RemoteCatalog.ChestWhole=false;RemoteCatalog.ChestSpeed='Fast';RemoteCatalog.ChestTravel='Stay';RemoteCatalog.ChestScanRange=120
 RemoteCatalog.ChestAutoBatch='Max';RemoteCatalog.ChestOrder='Balance chests';RemoteCatalog.ChestStockTarget=100;RemoteCatalog.ChestRepeat=true;RemoteCatalog.ChestGoal=250
end
reset()
local chest,excluded,priority,binding={},{},{},{Session='secret'}
RemoteCatalog.ChestSelection=chest;RemoteCatalog.ChestExcludedChests=excluded;RemoteCatalog.ChestPriorities=priority
RemoteCatalog.ChestIncludeConveyor=false;RemoteCatalog.ChestRateDelay=1;RemoteCatalog.ChestBinding=binding
local ok,text=RemoteCatalog.ExportChestSetup(false)
assert(ok and archive[text].Version==1 and archive[text].Kind=='RebornChestSetup' and archive[text].Profile.Name=='Supply run','export must identify its format and trim names')
local data=archive[text].Profile
assert(data.Items[1]=='stone' and data.Items[2]=='wood' and data.AutoBatch=='Max' and data.Order=='Balance chests' and data.StockTarget==100 and data.Repeat,'export must snapshot current preferences canonically')
assert(not data.Binding and not data.Selection and not data.ChestExcludedChests and not data.ChestPriorities and not data.ChestRateDelay and not data.ChestIncludeConveyor,'JSON must exclude session context and protected conveyor policy')
assert(RemoteCatalog.ChestTransferText.Text==text and RemoteCatalog.ChestTransferPanel.Visible and writes==0 and previews==0 and RemoteCatalog.ChestSelection==chest,'export must show portable text without changing preferences or files')
local stored=RemoteCatalog.ValidateChestProfile(data)
RemoteCatalog.ChestProfiles[1]=stored;RemoteCatalog.ChestProfilePersistence[1]='File + session'
RemoteCatalog.ChestItems.wood=nil;RemoteCatalog.ChestAutoBatch=30;RemoteCatalog.ChestStockTarget=nil
assert(data.Items[2]=='wood','export must be independent of current item filters')
data.Binding={Secret='discard'};data.Selection=chest;data.ChestIncludeConveyor=true
assert(RemoteCatalog.ImportChestSetup(text) and RemoteCatalog.ChestItems.wood and RemoteCatalog.ChestItems.stone and RemoteCatalog.ChestAutoBatch=='Max' and RemoteCatalog.ChestStockTarget==100,'import must restore current preferences')
assert(RemoteCatalog.ChestProfiles[1]==stored and RemoteCatalog.ChestProfilePersistence[1]=='File + session' and writes==0,'import must preserve all saved profiles and persistence state without writing files')
assert(not RemoteCatalog.ChestSelection and RemoteCatalog.ChestBinding==binding and RemoteCatalog.ChestExcludedChests==excluded and RemoteCatalog.ChestPriorities==priority and RemoteCatalog.ChestIncludeConveyor==false,'import must clear physical selection and preserve live bindings, protections and conveyor policy')
assert(not RemoteCatalog.ChestAutoEnabled and not RemoteCatalog.ChestAutoWorker and previews==1 and has(RemoteCatalog.ChestTransferHint.Text,'Save profile'),'import must stay idle and explain how to persist settings')
data.Items[1]='changed';assert(RemoteCatalog.ChestItems.stone,'imported filters must not alias decoded data')
reset()
-- Both unfiltered and explicit empty filters survive sharing. Legacy single item uses its intersection.
for _,mode in ipairs({'All','None','One','Excluded one'}) do
 reset()
 if mode=='All' then RemoteCatalog.ChestItems=nil
 elseif mode=='None' then RemoteCatalog.ChestItems={}
 else RemoteCatalog.ChestItem='wood';if mode=='Excluded one' then RemoteCatalog.ChestItems={stone=true} end end
 local passed,json=RemoteCatalog.ExportChestSetup(false);assert(passed)
 RemoteCatalog.ChestItem=nil;RemoteCatalog.ChestItems={unrelated=true}
 assert(RemoteCatalog.ImportChestSetup(json))
 assert(mode=='All' and RemoteCatalog.ChestItems==nil or mode=='One' and RemoteCatalog.ChestItems.wood and not RemoteCatalog.ChestItems.stone
  or (mode=='None' or mode=='Excluded one') and next(RemoteCatalog.ChestItems)==nil,'All, None and legacy intersections must round-trip')
end
reset();ok,text=RemoteCatalog.ExportChestSetup(false);assert(ok)
local valid=archive[text]
reset();local keep=RemoteCatalog.ChestItems;local before=previews
for index,bad in ipairs({{}, {Version=2,Kind='RebornChestSetup',Profile=valid.Profile},
 {Version=1,Kind='Other',Profile=valid.Profile}, {Version=1,Kind='RebornChestSetup',Profile={Version=1}},
 {Version=1,Profiles={['1']=valid.Profile}}, {Version=1,Kind='RebornChestSetup',Profile=false}}) do
 archive['bad-'..index]=bad
 assert(not RemoteCatalog.ImportChestSetup('bad-'..index) and RemoteCatalog.ChestItems==keep and RemoteCatalog.ChestProfiles[1]==stored and previews==before,'invalid JSON schemas must leave current and saved preferences intact')
end
local beforeDecode=decodes
for _,bad in ipairs({'',string.rep('x',32769),false,42}) do assert(not RemoteCatalog.ImportChestSetup(bad)) end
assert(decodes==beforeDecode,'type and size limits must reject before decoding')
assert(not RemoteCatalog.ImportChestSetup('malformed JSON') and not RemoteCatalog.ChestTransferBusy and RemoteCatalog.ChestTransferText.Text=='keep draft','malformed input must release locks and keep the draft')
for _,encoder in ipairs({function() error('encoder failed') end,function() return false end,function() return '' end,function() return string.rep('x',32769) end}) do
 onEncode=encoder
 assert(not RemoteCatalog.ExportChestSetup(true) and RemoteCatalog.ChestTransferText.Text=='keep draft' and not RemoteCatalog.ChestTransferBusy,'failed exports must keep existing JSON and release locks')
end
reset();RemoteCatalog.ChestProfileName.Text=' '
assert(not RemoteCatalog.ExportChestSetup(false) and RemoteCatalog.ChestTransferText.Text=='keep draft','invalid names must reject atomically')
assert(RemoteCatalog.ImportChestSetup(text),'valid imports can repair invalid current settings')
for _,field in ipairs({'ChestAutoEnabled','ChestAutoWorker','ChestBusy','ChestTransferBusy','Learning'}) do
 reset();keep=RemoteCatalog.ChestItems
 if field=='Learning' then RemoteCatalog.Recorder={LearnChestOnly=true} else RemoteCatalog[field]=true end
 assert(not RemoteCatalog.ImportChestSetup(text) and not RemoteCatalog.ExportChestSetup(false) and RemoteCatalog.ChestItems==keep and RemoteCatalog.ChestTransferText.Text=='keep draft','busy '..field..' must lock both directions')
end
reset();player.UserId=8;assert(not RemoteCatalog.ImportChestSetup(text) and not RemoteCatalog.ExportChestSetup(false) and not RemoteCatalog.SaveChestProfile() and not RemoteCatalog.LoadChestProfile(),'account changes require a fresh hub for all profile actions')
reset();gui.Parent=false;assert(not RemoteCatalog.ImportChestSetup(text) and not RemoteCatalog.ExportChestSetup(false) and not RemoteCatalog.SaveChestProfile() and not RemoteCatalog.LoadChestProfile(),'removed hubs cannot transfer or apply profiles')
-- Reentrant host functions cannot silently apply old input to a changed context.
for _,change in ipairs({function() RemoteCatalog.ChestProfileSlot=2 end,function() player.UserId=8 end,function() gui.Parent=false end,
 function() RemoteCatalog.ChestAutoWorker=true end,function() RemoteCatalog.ChestItems.wood=nil end,function() RemoteCatalog.ChestSpeed='Standard' end,
 function() RemoteCatalog.ChestProfileName.Text='New name' end}) do
 reset();before=previews
 onDecode=function() change();return valid end
 assert(not RemoteCatalog.ImportChestSetup(text) and previews==before and not RemoteCatalog.ChestTransferBusy,'state changes during decode must discard the import before application')
 reset();onEncode=function() change();return 'stale JSON' end
 assert(not RemoteCatalog.ExportChestSetup(true) and RemoteCatalog.ChestTransferText.Text=='keep draft' and not RemoteCatalog.ChestTransferBusy,'state changes during encoding must preserve the draft')
end
reset();onDecode=function()
 assert(RemoteCatalog.ChestTransferBusy and not RemoteCatalog.SaveChestProfile() and not RemoteCatalog.LoadChestProfile() and not RemoteCatalog.ImportChestSetup(text) and not RemoteCatalog.ExportChestSetup(false),'profile and nested transfer operations must wait for JSON work')
 return valid
end
assert(RemoteCatalog.ImportChestSetup(text) and not RemoteCatalog.ChestTransferBusy)
reset();local copied
setclipboard=function(value) copied=value end
assert(RemoteCatalog.ExportChestSetup(true) and copied==RemoteCatalog.ChestTransferText.Text and has(RemoteCatalog.ChestTransferHint.Text,'copied'),'copy must report successful clipboard output')
for _,copier in ipairs({function() return false end,function() error('clipboard failed') end}) do
 setclipboard=copier
 assert(RemoteCatalog.ExportChestSetup(true) and has(RemoteCatalog.ChestTransferHint.Text,'Select and copy'),'failed clipboard APIs must retain selectable JSON')
end
setclipboard=nil;toclipboard=function(value) copied=value end
assert(RemoteCatalog.ExportChestSetup(true) and copied==RemoteCatalog.ChestTransferText.Text,'toclipboard hosts must work')
toclipboard=nil;assert(RemoteCatalog.ExportChestSetup(true) and has(RemoteCatalog.ChestTransferHint.Text,'Select and copy'))
assert(writes==0 and RemoteCatalog.ChestProfiles[1]==stored,'all sharing paths must preserve saved profiles and avoid disk writes')
return 'Chest setup transfer: preference-only round trips, All/None, atomic schema/size failures, clipboard fallback, worker/account/context guards and saved profile preservation passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'chest-transfer',true)());} finally {state.destroy();}
