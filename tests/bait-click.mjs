import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const source=main.slice(main.indexOf('-- BAIT NORMAL CLICK BEGIN'),main.indexOf('-- BAIT NORMAL CLICK END'));
const code=`
local baitEnabled,baitCycleId=true,1
local gui={Parent=true}
local tool={Name='bait'}
local root={Position=1,CFrame={LookVector=1}}
local character={FindFirstChild=function() return root end,FindFirstChildOfClass=function() return tool end};tool.Parent=character
local player={Character=character}
local hub={Root={Visible=true,AbsolutePosition={X=0,Y=0},AbsoluteSize={X=500,Y=500}}}
local workspace={CurrentCamera={ViewportSize={X=1000,Y=600},WorldToScreenPoint=function() return {X=200,Y=200,Z=1},true end}}
local objects={}
local playerGui={GetGuiObjectsAtPosition=function() return objects end}
local focused
local UserInputService={GetFocusedTextBox=function() return focused end}
local game={}
local events={}
local waits,stopAt=0,nil
local pressFails,moveFails=false,false
local mousemoveabs,mouse1press,mouse1release
local task={wait=function() waits+=1;if stopAt==waits then baitEnabled=false end end}
local VirtualInputManager={SendMouseMoveEvent=function(_,x,y)
 if moveFails then error('blocked') end
 assert(x==800 and y==300,'bait click must avoid the hub');table.insert(events,'move')
end,SendMouseButtonEvent=function(_,x,y,button,down)
 table.insert(events,down and 'down' or 'up');if down and pressFails then error('blocked') end
end}
local RemoteCatalog={}
${source}
local function reset() events={};waits=0;stopAt=nil;baitEnabled=true;pressFails=false;moveFails=false;focused=nil;objects={} end
assert(RemoteCatalog.ClickBaitTool(tool) and table.concat(events,',')=='move,down,up','bait must receive one normal mouse click outside UI')
reset();stopAt=1;assert(not RemoteCatalog.ClickBaitTool(tool) and table.concat(events,',')=='move','Stop before press must prevent bait use')
reset();stopAt=2;assert(not RemoteCatalog.ClickBaitTool(tool) and events[#events]=='up','Stop during press must release')
reset();pressFails=true;assert(not RemoteCatalog.ClickBaitTool(tool) and table.concat(events,',')=='move,down,up','failed press must release without trying another input backend')
reset();focused={};assert(not RemoteCatalog.ClickBaitTool(tool) and #events==0,'chat editing must block bait clicks')
reset();objects={{IsA=function(_,class) return class=='GuiButton' end}};assert(not RemoteCatalog.ClickBaitTool(tool) and #events==0,'covered game view must never click UI')
reset();moveFails=true;assert(RemoteCatalog.ClickBaitTool(tool)==nil and #events==0,'unavailable movement must return before any button press')
reset();moveFails=true
mousemoveabs=function(x,y) assert(x==800 and y==300);table.insert(events,'host-move') end
mouse1press=function() assert(RemoteCatalog.BaitMouseInput,'synthetic press must guard UI activation');table.insert(events,'host-down') end
mouse1release=function() assert(RemoteCatalog.BaitMouseInput,'synthetic release must still guard UI activation');table.insert(events,'host-up') end
assert(RemoteCatalog.ClickBaitTool(tool) and table.concat(events,',')=='host-move,host-down,host-up','host mouse backend must work when virtual input is blocked')
assert(not RemoteCatalog.BaitMouseInput,'input guard must clear after release')
return 'Bait click: one backend, UI/chat protection, Stop/error release, unavailable input and host fallback passed'
`;
const state=await LuauState.createAsync();try{console.log(await state.loadstring(code,'bait-click',true)());}finally{state.destroy();}
