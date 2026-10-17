import fs from 'node:fs';
import {LuauState} from 'luau-web';
const source=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8').replaceAll('\r\n','\n');
const block=source.slice(source.indexOf('-- REMOTE CATALOG BEGIN'),source.indexOf('-- REMOTE CATALOG END'));
const mock=`
local function node(name,cls,children)
 local n={Name=name,ClassName=cls,children=children or {}}
 function n:IsA(c) return self.ClassName==c end
 function n:FindFirstChild(name)
  for _,c in ipairs(self.children) do if c.Name==name then return c end end
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
local roots={}
local game={FindFirstChild=function(_,name) return roots[name] end}
`;
const checks=`
assert(#RemoteCatalog.Entries==129)
assert(RemoteCatalog.Refresh()==0,'absent roots must be safe')
local out=node('out','ModuleScript')
local parent=out
for _,name in ipairs({'net','@rbxts','node_modules','rbxts_include'}) do parent=node(name,'Folder',{parent}) end
roots.ReplicatedStorage=node('ReplicatedStorage','ReplicatedStorage',{parent})
assert(RemoteCatalog.Refresh()==0,'missing _NetManaged must be safe')
local fish=node('CLIENT_CAST_FISHING_ROD','RemoteFunction')
out.children={node('_NetManaged','Folder',{fish})}
assert(RemoteCatalog.FindNamed('CLIENT_CAST_FISHING_ROD','RemoteFunction')==fish)
assert(RemoteCatalog.FindNamed('CLIENT_CAST_FISHING_ROD','RemoteEvent')==nil,'class mismatch')
assert(RemoteCatalog.Refresh()==1,'exact path discovery')
out.children={node('renamed-group','Folder',{fish})}
assert(RemoteCatalog.FindNamed('CLIENT_CAST_FISHING_ROD','RemoteFunction')==fish,'alternate grouping')
assert(RemoteCatalog.Refresh()==1,'catalog fallback')
local legacy=node('OEzzgCCBzocxJw','RemoteFunction')
table.insert(out.children,node('ULrMeokpcNr7uD','Folder',{legacy}))
assert(RemoteCatalog.FindLegacy('OEzzgCCBzocxJw')==legacy,'legacy argument route retained')
legacy.ClassName='RemoteEvent'
assert(RemoteCatalog.FindLegacy('OEzzgCCBzocxJw')==nil,'legacy class check')
out.children={}
assert(RemoteCatalog.Refresh()==0,'removed remotes must clear stale references')
for _,e in ipairs(RemoteCatalog.Entries) do assert(e.Instance==nil) end
return '129 remote entries: missing roots/groups, exact/alternate paths, class checks, legacy lookup, removal passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(mock+block+checks,'remote-catalog-tests',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
