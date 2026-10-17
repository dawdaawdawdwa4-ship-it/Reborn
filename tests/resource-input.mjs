import fs from 'node:fs';
import {LuauState} from 'luau-web';
const main=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8');
const source=main.slice(main.indexOf('-- RESOURCE AIM BEGIN'),main.indexOf('-- RESOURCE AIM END'))+'\n'+main.slice(main.indexOf('-- RESOURCE INPUT BEGIN'),main.indexOf('-- RESOURCE INPUT END'));
const test=`
local mt={__sub=function(a,b) return setmetatable({Magnitude=math.abs(a.n-b.n),n=a.n-b.n},getmetatable(a)) end}
local function vec(n) return setmetatable({n=n},mt) end
local tool={Name='stonePickaxe'}
local root={Position=vec(0)}
local char={FindFirstChild=function() return root end,FindFirstChildOfClass=function() return tool end};tool.Parent=char
local player={Character=char}
local playerGui={GetGuiObjectsAtPosition=function() return {} end}
local target={Name='stone',Parent=true,Position=vec(5),IsA=function(_,c) return c=='BasePart' end}
local hit=target
local visible=true
local workspace={CurrentCamera={CFrame={Position=vec(0)},WorldToScreenPoint=function() return {X=200,Y=200,Z=5},visible end},Raycast=function() return {Instance=hit} end}
local hub={Root={Visible=false,AbsolutePosition={X=100,Y=100},AbsoluteSize={X=150,Y=150}}}
local gui={Parent=true}
local harvestCycleId,mineEnabled,woodEnabled,enabled,harvestEnabled=1,true,false,false,false
local function modeAllows() return mineEnabled or woodEnabled or harvestEnabled end
local function targetCategory(name) return name=='wheat' and 'crop' or name=='tree' and 'wood' or 'mine' end
local function getPartPosition(t) return t.Position end

local RemoteCatalog={GameModule=function() return nil end}
local RaycastParams={new=function() return {} end}
local Enum={RaycastFilterType={Exclude=1},KeyCode={F="F"}}
local focused
local UserInputService={GetFocusedTextBox=function() return focused end}
local game={}
local events={}
local failPress,failWait,stopAt,waits=false,false,nil,0
local VirtualInputManager={SendMouseMoveEvent=function(_,x,y) table.insert(events,'move') end,
 SendMouseButtonEvent=function(_,x,y,button,down)
  table.insert(events,down and 'down' or 'up');if down and failPress then error('denied') end
 end}
function VirtualInputManager:SendKeyEvent(down,key,repeatKey,targetGame)
 assert(key=="F" and targetGame==game);table.insert(events,down and "F-down" or "F-up");if down and failPress then error("key blocked") end
end
local task={wait=function()
 waits+=1
 if stopAt==waits then harvestCycleId+=1 end
 if failWait then error('wait failed') end
end}
${source}
local trunk={Position=vec(3),IsA=function(_,c) return c=='BasePart' end}
local canopy={Position=vec(30),IsA=trunk.IsA}
local treeModel={IsA=function() return false end,GetDescendants=function() return {canopy,trunk} end}
assert(getInteractionPoint(treeModel,root.Position)==trunk.Position,'tree interaction must use nearby trunk instead of canopy centre')
assert(resourceInputHit(target));assert(table.concat(events,',')=='move,down,up')
local function reset() events={};waits=0;stopAt=nil;failPress=false;failWait=false end
reset();stopAt=1;assert(not resourceInputHit(target));assert(table.concat(events,',')=='move','Stop before press must prevent click')
reset();stopAt=2;assert(not resourceInputHit(target));assert(table.concat(events,',')=='move,down,up','Stop during press must release')
reset();failPress=true;assert(not resourceInputHit(target));assert(events[#events]=='up','press error must release')
reset();hub.Root.Visible=true;assert(not resourceInputHit(target));assert(#events==0,'hub must not be clicked');hub.Root.Visible=false
reset();target.Position=vec(100);assert(not resourceInputHit(target));assert(#events==0,'out of reach');target.Position=vec(5)
reset();visible=false;assert(not resourceInputHit(target));assert(#events==0,'off screen');visible=true
reset();hit={IsDescendantOf=function() return false end};assert(not resourceInputHit(target));assert(#events==0,'obstructed target');hit=target
reset();enabled=true;assert(not resourceInputHit(target));assert(#events==0,'shared fishing input must not be interrupted');enabled=false
reset();tool.Name='fishingRod';assert(not resourceInputHit(target));assert(#events==0,'wrong tool must not be used')
reset();tool.Name='stoneAxe';target.Name='tree';woodEnabled=true;assert(resourceInputHit(target),'wood must share native input fallback')
reset();target.Name='wheat';harvestEnabled=true;tool=nil
assert(RemoteCatalog.InputHarvest(target),'harvest must work through the visible F interaction without a tool')
assert(table.concat(events,',')=='move,F-down,F-up','crop interaction must aim then press and release F')
reset();stopAt=2;assert(not RemoteCatalog.InputHarvest(target) and events[#events]=='F-up','Stop during crop interaction must release F')
reset();focused={};assert(not RemoteCatalog.InputHarvest(target) and #events==0,'must never type F into chat');focused=nil
return 'Resource input: mining/wood, aim, reach, visibility, obstruction, UI protection, matching tools, Stop and error release passed'
`;
const state=await LuauState.createAsync();try{console.log(await state.loadstring(test,'resource-input',true)());}finally{state.destroy();}
