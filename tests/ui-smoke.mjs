import fs from 'node:fs';
import {LuauState} from 'luau-web';
const root=new URL('../',import.meta.url);
const state=await LuauState.createAsync();
for(const path of ['message.txt','src/AutoFarmUI.lua','src/init.client.lua','tools/CaptureRemotes.lua']) {
 state.loadstring(fs.readFileSync(new URL(path,root),'utf8'),path,true);
 console.log('Compiled '+path);
}
const schema=JSON.parse(fs.readFileSync(new URL('roblox-api.json',import.meta.url),'utf8'));
const literal=v=>typeof v==='string'?JSON.stringify(v):'{'+Object.entries(v).map(([k,x])=>'['+JSON.stringify(k)+']='+literal(x)).join(',')+'}';
const source=fs.readFileSync(new URL('message.txt',root),'utf8').replaceAll('\r\n','\n');
const usedEnums=new Set([...source.matchAll(/Enum\.(\w+)/g)].map(m=>m[1]));
const usedClasses=new Set(schema.Classes.filter(c=>source.includes('"'+c.Name+'"') || source.includes("'"+c.Name+"'")).map(c=>c.Name));
for(let changed=true;changed;) {changed=false;for(const c of schema.Classes) if(usedClasses.has(c.Name)&&!usedClasses.has(c.Superclass)) {usedClasses.add(c.Superclass);changed=true;}}
const enums=Object.fromEntries(schema.Enums.filter(e=>usedEnums.has(e.Name)).map(e=>[e.Name,Object.fromEntries(e.Items.map(i=>[i.Name,{Name:i.Name}]))]));
const classes=Object.fromEntries(schema.Classes.filter(c=>usedClasses.has(c.Name)).map(c=>[c.Name,{super:c.Superclass,members:Object.fromEntries(c.Members.map(m=>[m.Name,m.MemberType]))}]));
const setup='local API_CLASSES='+literal(classes)+'\nlocal Enum='+literal(enums)+'\n'+fs.readFileSync(new URL('roblox-mock.luau',import.meta.url),'utf8');
const prefix=source.slice(0,source.indexOf('-- Stats\n'));
if(!prefix.includes('showTab("Fishing")')) throw new Error('UI construction boundary missing');
const controls=source.slice(source.indexOf('setEnabled = function(state)'),source.indexOf('setHarvestEnabled = function(state)'));
const farmBindings=source.slice(source.indexOf('track(harvestToggle.Activated'),source.indexOf('track(cropSelect.Activated'));
const fishBindings=source.slice(source.indexOf('track(toggle.Activated'),source.indexOf('for modeName, modeButton'));
const wiring=`
RemoteCatalog.Navigation={Stop=function() end}
local cycleId,harvestCycleId=0,0
local stats={activeTime=0}
local setEnabled,setHarvestEnabled
local workerFails=false
local function updateBoard() end
local function refreshModeStatus() end
local function run() end
local function harvestLoop() if workerFails then error('test worker failure') end end
${controls}
setHarvestEnabled=function(state) setFarmMode("crop",state) end
${farmBindings}
${fishBindings}
track(baitToggle.Activated:Connect(function() setBaitEnabled(not baitEnabled) end))
`;
const checks=`
local valid=pcall(function() Instance.new('ScrollingFrame').ScrollBarInset=Enum.ScrollBarInset.ScrollBar end)
assert(not valid,'mock must reject invalid ScrollBarInset regression')
flush()
assert(#RemoteCatalog.Entries==143,'all captured remotes must be incorporated')
RemoteCatalog.RefreshButton.Activated:Fire()
assert(string.find(RemoteCatalog.Summary.Text,'143',1,true),'remote discovery summary missing')
assert(gui.Parent==playerGui,'hub must use PlayerGui')
assert(#hub.Tabs==10,'ten tabs must exist')
assert(hub.Root.Visible and hub.Body.GroupTransparency==0,'hub intro must finish')
assert(hub.CurrentTab==airflowTabs.Fishing,'Fishing must be initial tab')
for name,page in pairs(pages) do
 assert(page.Parent==airflowTabs[name]._page,'page attached to wrong tab')
 assert(table.find(hub._controls,page),'page must block window dragging')
 assert(#page:GetChildren()>0,'empty tab: '..name)
 showTab(name);flush()
 assert(hub.CurrentTab==airflowTabs[name] and page.Parent.Visible,'tab switch failed: '..name)
end
hub:Toggle(false);flush();assert(not hub.Root.Visible,'close failed')
hub:Toggle(true);flush();assert(hub.Root.Visible,'reopen failed')
largerUI.Activated:Fire();assert(frame.Size.X.Offset>720,'larger UI failed')
smallerUI.Activated:Fire();resetUI.Activated:Fire()
assert(frame.Size.X.Offset==720 and frame.Size.Y.Offset==470,'reset failed')
assert(hub.OpenButton and #hub._connections>0,'reopen and drag connections missing')
assert(not RemoteCatalog.Recorder and hookCount==0,'recording must not start or install hooks by default')
-- Exercise the actual switch callbacks with no learned remote IDs.
for _,button in ipairs({harvestToggle,woodToggle,mineToggle,toggle,baitToggle}) do
 button.Activated:Fire()
 assert(string.find(button.Text,'ON',1,true),'switch failed to turn ON without recorder/session IDs')
 button.Activated:Fire()
 assert(string.find(button.Text,'OFF',1,true),'switch failed to turn OFF')
end
flush()
workerFails=true
woodToggle.Activated:Fire();assert(woodEnabled,'wood switch failed to enable')
flush()
assert(not woodEnabled and string.find(status.Text,'Farm stopped:',1,true),'worker error must reset state and explain failure')
workerFails=false
woodToggle.Activated:Fire();assert(woodEnabled,'wood switch not recoverable after error')
woodToggle.Activated:Fire();flush()
if CAPTURE_SUPPORTED then
 RemoteCatalog.CaptureToggle.Activated:Fire()
 local recorder=assert(RemoteCatalog.Recorder,'embedded recorder not started')
 assert(recorder.Active,'embedded recorder not recording')
 RemoteCatalog.CaptureToggle.Activated:Fire();assert(not recorder.Active,'pause button failed')
 RemoteCatalog.CaptureToggle.Activated:Fire();assert(recorder.Active,'resume button failed')
 RemoteCatalog.CaptureStop.Activated:Fire();assert(recorder.Stopped,'stop button failed')
 RemoteCatalog.CaptureToggle.Activated:Fire();assert(not recorder.Stopped,'restart button failed')
 local exports=0
 recorder.CopyAll=function() exports+=1;return true,"Copied all" end
 RemoteCatalog.CaptureExport.Activated:Fire();assert(exports==1,'copy-all button not connected')
 assert(RemoteCatalog.CaptureStatus.Text=='Copied all','copy feedback missing')
 RemoteCatalog.EnableCapture();assert(hookCount==1,'restarting setup stacked hooks')
else
 assert(not RemoteCatalog.Recorder,'unsupported host must not have recorder')
 RemoteCatalog.CaptureToggle.Activated:Fire()
 assert(not RemoteCatalog.Recorder and string.find(RemoteCatalog.CaptureStatus.Text,'unavailable',1,true),'missing hooks must not break UI')
end
;(function()
 showTab('Wood Farm')
 showTab('Mining')
 flush()
 assert(hub.CurrentTab==airflowTabs.Mining and hub._inPage==nil and hub._outPage==nil,'rapid tab switches must settle only the current generation')
 -- Direct GUI destruction bypasses Window:Destroy and must also cancel callbacks.
 showTab('Fishing')
 local incoming,outgoing=hub._inPage,hub._outPage
 gui:Destroy()
 flush()
 assert(incoming.Parent==nil and outgoing.Parent==nil,'delayed tab callbacks must not resurrect destroyed GUI pages')
 hub:_settleIn();hub:_settleOut();hub:SelectTab(airflowTabs.Stats)
 assert(hub.CurrentTab==airflowTabs.Fishing,'tab selection must ignore destroyed GUI')
 local window=Airflow:Window({Title='Lifecycle test',Parent=playerGui,Loading={Enabled=false}})
 local first=window:Tab({Title='First'})
 local second=window:Tab({Title='Second'})
 flush()
 window:SelectTab(second)
 local entering=window._inPage
 window:Destroy()
 assert(window._destroyed and window._inPage==nil and window._outPage==nil,'Window Destroy must invalidate transition state immediately')
 flush()
 assert(entering.Parent==nil,'Window Destroy must cancel pending tab settlement')
 local removedWindow=Airflow:Window({Title='Removed page',Parent=playerGui,Loading={Enabled=false}})
 local tab=removedWindow:Tab({Title='First'})
 flush()
 local nextTab=removedWindow:Tab({Title='Second'})
 removedWindow:SelectTab(nextTab)
 local removed=removedWindow._inPage
 removed:Destroy()
 flush()
 assert(removed.Parent==nil and removedWindow._inPage==nil,'settleIn must not reparent a destroyed page')
 removedWindow:Destroy();flush()
end)()
return 'UI, ten tabs, resize/reset and embedded recorder controls passed; hooks=' .. tostring(CAPTURE_SUPPORTED)
`;
for (const supported of [false,true]) {
 const hooks=`
local CAPTURE_SUPPORTED=${supported}
if not CAPTURE_SUPPORTED then task.defer=nil end
local hookCount=0
local captureEnvironment={}
local function getgenv() return captureEnvironment end
local hookmetamethod,getnamecallmethod
if CAPTURE_SUPPORTED then
 hookmetamethod=function(_,_,fn) hookCount+=1;return function(...) return ... end end
 getnamecallmethod=function() return 'InvokeServer' end
end
`;
 try { console.log(await state.loadstring(setup+'\n'+hooks+'\nlocal function runUI()\n'+prefix+'\n'+wiring+'\n'+checks+'\nend\nreturn runUI()','ui-runtime-smoke',true)()); }
 catch(error) {console.error(String(error));process.exitCode=1;}
}
state.destroy();
