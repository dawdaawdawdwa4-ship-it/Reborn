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
assert(not enabled and not harvestEnabled and not woodEnabled and not mineEnabled and not baitEnabled)
local baitApplications=0
applyBait=function() baitApplications+=1;return true end
for _,button in ipairs({toggle,harvestToggle,woodToggle,mineToggle,baitToggle}) do
 button.Activated:Fire()
 if button==toggle then
  assert(baitEnabled and baitApplications==1,'Fishing must apply bait immediately')
  setEnabled(true);assert(baitApplications==1,'repeated Start must not duplicate bait')
 end
 assert(string.find(button.Text,'ON',1,true),'actual switch/worker failed to stay ON: '..button.Text..' status='..status.Text)
 button.Activated:Fire()
 if button==toggle then assert(not baitEnabled,'Stopping Fishing must stop bait refreshes') end
 assert(string.find(button.Text,'OFF',1,true),'actual switch failed to turn OFF')
 stepWorkers()
end
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
