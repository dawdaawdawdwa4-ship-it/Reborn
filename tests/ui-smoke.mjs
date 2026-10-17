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
const checks=`
local valid=pcall(function() Instance.new('ScrollingFrame').ScrollBarInset=Enum.ScrollBarInset.ScrollBar end)
assert(not valid,'mock must reject invalid ScrollBarInset regression')
flush()
assert(#RemoteCatalog.Entries==129,'all captured remotes must be incorporated')
RemoteCatalog.RefreshButton.Activated:Fire()
assert(string.find(RemoteCatalog.Summary.Text,'129',1,true),'remote discovery summary missing')
assert(gui.Parent==playerGui,'hub must use PlayerGui')
assert(#hub.Tabs==7,'seven tabs must exist')
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
if CAPTURE_SUPPORTED then
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
return 'UI, seven tabs, resize/reset and embedded recorder controls passed; hooks=' .. tostring(CAPTURE_SUPPORTED)
`;
for (const supported of [false,true]) {
 const hooks=`
local CAPTURE_SUPPORTED=${supported}
local hookCount=0
local captureEnvironment={}
local function getgenv() return captureEnvironment end
local hookmetamethod,getnamecallmethod
if CAPTURE_SUPPORTED then
 hookmetamethod=function(_,_,fn) hookCount+=1;return function(...) return ... end end
 getnamecallmethod=function() return 'InvokeServer' end
end
`;
 try { console.log(await state.loadstring(setup+'\n'+hooks+'\nlocal function runUI()\n'+prefix+'\n'+checks+'\nend\nreturn runUI()','ui-runtime-smoke',true)()); }
 catch(error) {console.error(String(error));process.exitCode=1;}
}
state.destroy();
