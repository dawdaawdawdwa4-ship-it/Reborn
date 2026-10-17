import fs from 'node:fs';
import {LuauState} from 'luau-web';
const source=fs.readFileSync(new URL('../tools/AutoBuild.lua',import.meta.url),'utf8');
const checks=`
local A=(function() ${source} end)()
for _,case in ipairs({{'Farm plots',5,6,3,30},{'Platform',4,3,2,12},{'Wall',4,3,2,8},{'Stairs',2,4,1,20}}) do
 local plan=A.Plan(case[1],case[2],case[3],case[4]);assert(#plan==case[5])
 local seen={};local previous=-1
 for _,cell in ipairs(plan) do
  local key=cell.x..','..cell.y..','..cell.z
  assert(not seen[key],'duplicate cell');seen[key]=true
  assert(cell.y>=previous,'build must proceed bottom up');previous=cell.y
 end
end
assert(not pcall(A.Plan,'Stairs',12,12,1),'oversized plans must fail')
assert(not pcall(A.Plan,'Wall',0,1,1),'invalid dimensions must fail')
local paths=0
for _,c in ipairs(A.Plan('Farm plots',5,6,1)) do if c.role=='path' then paths+=1 end end
assert(paths==6,'farm needs one path column per three columns')
local function signal() return {Connect=function() return {} end} end
local function control() return {Activated=signal(),FocusLost=signal()} end
local Instance={new=function() return control() end}
local UDim2={new=function() return {} end,fromOffset=function() return {} end}
local Color3={fromRGB=function() return {} end}
-- Re-evaluate with the injected UI globals.
local A=(function() ${source} end)()
local ticks,worker,requests=0,nil,0
local occupied={}
local root={Position=setmetatable({},{__sub=function() return {Magnitude=0} end})}
local ctx={Player={Character={FindFirstChild=function() return root end}},Parent={},Label=function() return control() end,Button=function() return control() end,Track=function() end,Alive=function() return true end,Workspace={},Now=function() return ticks end,
 Scheduler={spawn=function(fn) worker=coroutine.create(fn);local ok,e=coroutine.resume(worker);assert(ok,e) end,wait=function(dt) ticks+=dt;coroutine.yield() end},
 GameModule=function(_,name) if name=='BlockUtils' then return {getBlocksFromLocation=function(pos) return occupied[pos] and {true} or {} end} end end,
 Place=function(body) requests+=1;occupied[body.cframe.Position]=true;return true end}
local function cells(n) local out={} for i=1,n do out[i]={CFrame={Position=i},Material='grass'} end return out end
local function step() local ok,e=coroutine.resume(worker);assert(ok,e) end
local b=A.new(ctx);b.Cells=cells(3);b.BlockSize=3;b:Start();assert(requests==1)
b:Start();assert(requests==1,'second start must not create a worker')
b:Stop();step();assert(requests==1,'stop must cancel queued placements')
b.Cells=cells(3);b:Start();while coroutine.status(worker)~='dead' do step() end
assert(requests==3,'occupied block should be skipped');assert(string.find(b.Status.Text,'2 confirmed',1,true))
ctx.Place=function() requests+=1;return false,'denied' end
occupied={};b.Cells=cells(6);local before=requests;b:Start();while coroutine.status(worker)~='dead' do step() end
assert(requests-before==3,'three failures must stop the build');assert(not b.Running)
assert(string.find(b.Status.Text,'3 failures',1,true))
ctx.Place=function() requests+=1;return true end
occupied={};b.Cells=cells(6);before=requests;b:Start();while coroutine.status(worker)~='dead' do step() end
assert(requests-before==3,'unconfirmed responses must stop after three failures')
assert(not string.find(b.Status.Text,'confirmed',1,true),'accepted request alone is not a placement')
root.Position=setmetatable({},{__sub=function() return {Magnitude=100} end})
b.Cells=cells(2);before=requests;b:Start();assert(requests==before,'out of reach must pause requests')
b:Stop();step();assert(requests==before,'stop must cancel a paused build')
return 'Auto Build blueprints, paths, placement confirmation, occupied skip, single worker, cancellation and failure stop passed'
`;
const state=await LuauState.createAsync();try{console.log(await state.loadstring(checks,'autobuild',true)());}finally{state.destroy();}
