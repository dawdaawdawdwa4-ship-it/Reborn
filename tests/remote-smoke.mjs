import fs from 'node:fs';
import {LuauState} from 'luau-web';
const source=fs.readFileSync(new URL('../Insane_version_clean.lua',import.meta.url),'utf8');
const adapter=source.slice(source.indexOf('local NET = (function()'),source.indexOf('-- the remote names'));
if(!adapter.includes('return adapter')) throw new Error('Missing remote adapter');
const mock=`
local now=0
local os={clock=function() return now end}
local task={wait=function(dt) now+=dt end}
local function node(name,cls,children)
 local n={Name=name,ClassName=cls,children=children or {}}
 function n:IsA(c) return self.ClassName==c end
 function n:FindFirstChild(wanted,recursive)
  for _,c in ipairs(self.children) do if c.Name==wanted then return c end end
  if recursive then for _,c in ipairs(self.children) do local found=c:FindFirstChild(wanted,true);if found then return found end end end
 end
 function n:GetDescendants()
  local all={}
  for _,c in ipairs(self.children) do
   table.insert(all,c)
   for _,d in ipairs(c:GetDescendants()) do table.insert(all,d) end
  end
  return all
 end
 return n
end
local ReplicatedStorage=node('ReplicatedStorage','ReplicatedStorage')
`;
const checks=`
assert(NET:FindFirstChild('missing')==nil,'missing path must be safe')
local out=node('out','ModuleScript')
local parent=out
for _,name in ipairs({'net','@rbxts','node_modules','rbxts_include'}) do parent=node(name,'Folder',{parent}) end
ReplicatedStorage.children={parent}
assert(NET:FindFirstChild('missing')==nil,'missing _NetManaged must be safe')
local direct=node('FishCast','RemoteEvent')
out.children={direct}
assert(NET:FindFirstChild('FishCast')==direct,'direct remote')
local nested=node('deGzdggahhjo/name','RemoteFunction')
out.children={node('renamed-group','Folder',{nested}),direct}
assert(NET:FindFirstChild('deGzdggahhjo/name')==nested,'renamed folder and literal slash name')
local preferred=node('FishCast','RemoteEvent')
out.children[3]=node('_NetManaged','Folder',{preferred})
assert(NET:FindFirstChild('FishCast')==preferred,'prefer managed remote')
out.children[4]=node('notRemote','ModuleScript')
assert(NET:FindFirstChild('notRemote')==nil,'must reject non-remotes')
assert(#NET:GetChildren()==3,'enumeration must include only remotes')
assert(NET:WaitForChild('missing',.25)==nil and now>=.25 and now<.4,'bounded wait')
local originalWait=task.wait
local late=node('late','RemoteEvent')
task.wait=function(dt) originalWait(dt);table.insert(out.children,late) end
assert(NET:WaitForChild('late',1)==late,'late replication')
task.wait=originalWait
now=0;NET.StartupDeadline=5
for _=1,6 do assert(GetRemote('missing',true)==nil) end
assert(now>=5 and now<5.2,'startup waits must share a single budget')
assert(#MissingRemotes==6,'missing remote diagnostics')
return 'Remote resolution passed: absent paths/managed folder, alternate groups, exact names, types, late replication, shared timeout'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(mock+adapter+checks,'remote-resolution',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
