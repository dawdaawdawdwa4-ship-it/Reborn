import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const source=main.slice(main.indexOf('-- BUILD PICK INPUT BEGIN'),main.indexOf('-- BUILD PICK INPUT END'));
const code=`
local Enum={UserInputType={MouseButton1=1,Touch=2,Keyboard=3},RaycastFilterType={Exclude=1}}
local gui={Parent=true}
local buildController={Picking=true}
local activeTab='Auto Build'
local hub={Open=true,Root={Visible=true,AbsolutePosition={X=0,Y=0},AbsoluteSize={X=300,Y=400}}}
local focused,objects,guiError=false,{},false
local vector
vector=function(x,y,z) return setmetatable({X=x,Y=y,Z=z},{
 __mul=function(a,b) return vector(a.X*b,a.Y*b,a.Z*b) end,
 __sub=function(a,b) return {Magnitude=math.sqrt((a.X-b.X)^2+(a.Y-b.Y)^2+(a.Z-b.Z)^2)} end}) end
local point={X=500,Y=250}
local listener
local UserInputService={GetFocusedTextBox=function() return focused and {} end,GetMouseLocation=function() return point end,
 InputBegan={Connect=function(_,fn) listener=fn;return {} end}}
local playerGui={GetGuiObjectsAtPosition=function() if guiError then error('unavailable') end;return objects end}
local player={Character={}}
local RaycastParams={new=function() return {} end}
local origin,direction=vector(0,0,0),vector(0,0,-1)
local raycasts,occluded=0,false
local rays={screen=0,viewport=0}
local camera={ScreenPointToRay=function(_,x,y) rays.screen+=1;assert(x>=500 and y==250);return {Origin=origin,Direction=direction} end,ViewportPointToRay=function(_,x,y) rays.viewport+=1;assert(x>=500 and y==250);return {Origin=origin,Direction=direction} end}
local workspace={CurrentCamera=camera,Raycast=function(_,o,d,params)
 raycasts+=1;assert(o==origin and d.Z==-1000 and params.FilterType==1 and params.FilterDescendantsInstances[1]==player.Character)
 return occluded and {Position=vector(0,0,-4)} or nil
end}
local calls,limit=0,nil
local RemoteCatalog={BuildPicker=function(o,d,max)
 assert(o==origin and d==direction);calls+=1;limit=max;return true
end}
local function track() end
${source}
local mouse={UserInputType=1}
assert(not RemoteCatalog.TryPickBuildInput(mouse,true) and calls==0,'processed UI input must be ignored')
for _,blocked in ipairs({'off','building','inflight','tab','hidden','closed','chat','gui','guiFailure','keyboard','inside','camera','destroyed'}) do
 buildController.Picking=blocked~='off';buildController.Running=blocked=='building';buildController.WorkerToken=blocked=='inflight' and 1 or nil
 activeTab=blocked=='tab' and 'Fishing' or 'Auto Build';hub.Root.Visible=blocked~='hidden';hub.Open=blocked~='closed'
 focused=blocked=='chat';objects=blocked=='gui' and {{IsA=function(_,cls) return cls=='GuiButton' end}} or {};guiError=blocked=='guiFailure'
 point=blocked=='inside' and {X=20,Y=20} or {X=500,Y=250};workspace.CurrentCamera=blocked~='camera' and camera or nil;gui.Parent=blocked~='destroyed' and true or nil
 local input=blocked=='keyboard' and {UserInputType=3} or mouse
 assert(not RemoteCatalog.TryPickBuildInput(input,false) and calls==0,'blocked '..blocked..' must not select ghosts')
end
buildController.Picking=true;buildController.Running=false;buildController.WorkerToken=nil;activeTab='Auto Build'
hub.Root.Visible=true;hub.Open=true;focused=false;objects={};guiError=false;point={X=500,Y=250};workspace.CurrentCamera=camera;gui.Parent=true
buildController.PreviewFolder={}
assert(RemoteCatalog.TryPickBuildInput(mouse,false) and calls==1 and limit==1000,'unblocked mouse input must reach the registered picker')
occluded=true
assert(RemoteCatalog.TryPickBuildInput({UserInputType=2,Position={X=600,Y=250}},false) and calls==2 and limit==4,'touch selection must carry world-obstruction distance to the picker')
assert(rays.viewport>=1 and rays.screen==1,'mouse picks use the viewport ray (GetMouseLocation space); touch picks use the screen ray (GUI space)')
listener(mouse,false);assert(calls==3,'the actual tracked input listener must dispatch selection')
buildController.Picking=false;listener(mouse,false);assert(calls==3,'OFF must suppress the listener')
return 'Build picking: mouse/touch dispatch, tab/window/chat/UI guards, world obstruction and OFF passed'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(code,'build-picking',true)());} finally {state.destroy();}
