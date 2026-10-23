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
local time=os.clock
function services.GuiService:GetGuiInset() return Vector2.zero,Vector2.zero end
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
 if coroutine.status(co)=='suspended' then table.insert(workers,co) end
 return co
end
local function stepWorkers()
 for _,co in ipairs(table.clone(workers)) do
  if coroutine.status(co)=='suspended' then local ok,err=coroutine.resume(co);assert(ok,err) end
 end
 -- Roblox releases completed tasks; the fixture must not retain every old coroutine.
 for i=#workers,1,-1 do if coroutine.status(workers[i])=='dead' then table.remove(workers,i) end end
end
local function warn() end
`;
const checks=`
flush()
assert(RemoteCatalog.ChestIncludeConveyor==false and string.find(RemoteCatalog.ChestConveyorButton.Text,"Skip",1,true),"conveyor I/O chests must be skipped by default")
RemoteCatalog.ChestConveyorButton.Activated:Fire()
assert(RemoteCatalog.ChestIncludeConveyor,"explicit Include must restore legacy I/O collection")
 ;(function()
 assert(buildController.LayoutHeight<650 and not buildController.Inputs.Width.Visible and buildController.Buttons.Start.Visible,'actual startup must show a compact Auto Build workspace')
 ;(function()
  local b,r=buildController,RemoteCatalog
  local cache,cells,layer,character,count=r.ModuleCache,b.Cells,b.LayerIndex,player.Character,r.CarrotCount
  local stock,dispatches,copied=0,0,nil
  local markerOn,rangeOn=b.SetupMarkers,b.RangeMarkers
  local function pos(x) return setmetatable({X=x,Y=0,Z=0},{__sub=function(a,b) return {Magnitude=math.abs(a.X-b.X)} end}) end
  r.ModuleCache={
   ['ReplicatedStorage.TS.network.requests']={Requests={Client={Get=function() return {CallServer=function() dispatches+=1;return true end} end}}},
   ['ReplicatedStorage.TS.util.block-utils']={BlockUtils={getBlocksFromLocation=function(pos) return pos.X==1 and {true} or {} end}},
   ['ReplicatedStorage.Shared.SharedConfig']={CLIENT_REACH=20},
  }
  player.Character={FindFirstChild=function() return {Position=pos(0)} end}
  r.CarrotCount=function() return stock end
  b.LayerIndex=nil;b.Cells={{CFrame={Position=pos(1)},Material='grass'},{CFrame={Position=pos(4)},Material='grass'},{CFrame={Position=pos(45)},Material='grass'}}
  b.Buttons.CheckSetup.Activated:Fire()
  assert(b.SetupResult and b.SetupResult.Summary=='ACTION NEEDED' and b.SetupResult.Materials.Occupied==1 and b.SetupResult.Materials.Quantities.grass.Missing==2,'actual Check setup must combine placement, occupied, reach and inventory state')
  assert(b.MaterialSummary.TextSize>=14 and b.Status.TextSize>=14 and string.find(b.MaterialSummary.Text,'[ACTION]',1,true)<string.find(b.MaterialSummary.Text,'[INFO] Movement',1,true),'native setup must use readable text and put actions before Auto Walk information')
  b.MaterialView.CanvasPosition=Vector2.new(0,200);b.Buttons.CheckSetup.Activated:Fire()
  assert(b.MaterialView.CanvasPosition==Vector2.zero and string.find(b.Status.Text,b.SetupResult.NextSteps[1],1,true),'rechecking must return to the first blocker and show its next step')
  assert(string.find(b.MaterialSummary.Text,'1 in / 1 out of reach',1,true) and dispatches==0 and not b.WorkerToken,'setup must report distant cells without moving or placing')
  local copy=setclipboard;setclipboard=function(text) copied=text end
  stock=5;b.Buttons.CopySetup.Activated:Fire()
  assert(copied and string.find(copied,'AUTO BUILD SETUP',1,true) and string.find(copied,'owned 5',1,true) and dispatches==0,'Copy setup must refresh current stock and copy without dispatch')
  setclipboard=function() error('unavailable') end;b.Buttons.CopySetup.Activated:Fire()
  assert(string.find(status.Text,'printed to console',1,true),'setup copy must support console fallback')
  setclipboard=copy
  assert(b.Buttons.CheckSetup.Visible and b.Buttons.CheckSetup.Position.Y.Offset==b.Buttons.Preview.Position.Y.Offset and b.LayoutHeight<650,'setup action must remain visible inside the compact action row')
  assert(b.Buttons.Preview.Position.X.Scale+b.Buttons.Preview.Size.X.Scale<=b.Buttons.LearnPlacement.Position.X.Scale and b.Buttons.LearnPlacement.Position.X.Scale+b.Buttons.LearnPlacement.Size.X.Scale<=b.Buttons.CheckSetup.Position.X.Scale,'action buttons must not overlap horizontally')
  b.WorkerToken=82;b.Buttons.CheckSetup.Activated:Fire();assert(dispatches==0);b.WorkerToken=nil
  local base={}
  for _,cell in ipairs(b.Cells) do cell.Preview={Color=base};cell.PreviewColor=base end
  b.Buttons.SetupMarkers.Activated:Fire()
  assert(b.SetupMarkers and b.Cells[1].SetupState=='Occupied' and b.Cells[2].SetupState=='Clear' and b.Cells[3].SetupState=='Out' and dispatches==0,'real setup marker toggle must paint the checked ghosts without placement')
  local checks=b.VisualSnapshot
  updateBoard();assert(b.VisualSnapshot==checks and b.Cells[1].SetupState=='Occupied','periodic color refresh must reuse the snapshot')
  b.Buttons.SetupMarkers.Activated:Fire()
  assert(not b.SetupMarkers and b.Cells[1].Preview.Color==base and not b.Cells[1].SetupState,'real OFF control must restore source preview colors')
  assert(b.Buttons.SetupMarkers.Position.Y.Offset==b.Buttons.ResetOffset.Position.Y.Offset and b.MoveMenu.Size.Y.Offset==256,'diagnostic toggle must share the reset row above the new Auto Walk row')

  r.ModuleCache,b.Cells,b.LayerIndex,player.Character,r.CarrotCount=cache,cells,layer,character,count
  b.SetupReport=nil;b.SetupResult=nil;b.VisualSnapshot=nil;b.VisualCounts=nil;b.SetupMarkers=markerOn;b.RangeMarkers=rangeOn
  end)()

 ;(function()
  local r=RemoteCatalog;local b=buildController
  local start,recorder=r.StartCapture,r.Recorder
  local cells=b.Cells;local calls,placements=0,0
  b.Cells={{CFrame={},Material='grass'}}
  assert(not b:Start() and not b.WorkerToken and string.find(b.Status.Text,'Placement not ready',1,true),'real Start must explain missing placement setup before spawning a worker')
  r.StartCapture=function() calls+=1;return {PlacementBinding={Remote={Parent=true}},Place=function() placements+=1;return true end} end
  b.Buttons.LearnPlacement.Activated:Fire()
  assert(calls==1 and placements==0 and r.PlacementAvailable() and string.find(b.Status.Text,'place one block manually',1,true),'Learn placement must start capture with instructions and send no placement')
  b.WorkerToken=81;b.Buttons.LearnPlacement.Activated:Fire();b.Buttons.Clear.Activated:Fire()
  assert(calls==1 and b.Cells~=nil,'in-flight worker must lock learning and Clear after Stop')
  local width=b.Width;b.Inputs.Width.Text='12';b.Inputs.Width.FocusLost:Fire()
  assert(b.Width==width,'in-flight cleanup must also lock dimension commits')
  b.WorkerToken=nil
  local copy,report=setclipboard,nil;setclipboard=function(value) report=value end
  b.Buttons.CopyDiagnostics.Activated:Fire()
  assert(report and string.find(report,'Reborn Auto Build diagnostics',1,true) and string.find(report,'Learned placement ready',1,true),'Copy build diagnostics must report the actual available route')
  setclipboard=copy;r.StartCapture,r.Recorder=start,recorder;b.Cells=cells
  end)()


 ;(function()
  local b,r=buildController,RemoteCatalog
  local saved={Count=r.CarrotCount,Cache=r.ModuleCache,Cells=b.Cells,Layer=b.LayerIndex,Character=player.Character,Failures=b.Failures,Progress=b.Progress,History=b.History}
  r.CarrotCount=function() return 100 end
  local world,trace,allow={},{},false
  local function pos(x) return setmetatable({X=x,Y=0,Z=0},{__sub=function(a,c) return {Magnitude=math.abs(a.X-c.X)} end}) end
  r.ModuleCache={
   ['ReplicatedStorage.TS.network.requests']={Requests={Client={Get=function() return {CallServer=function(_,body)
    table.insert(trace,body.cframe.Position.X)
    if not allow then return {success=false,error='MISSING_MATERIALS'} end
    world[body.cframe.Position.X]=true;return true
   end} end}}},
   ['ReplicatedStorage.TS.util.block-utils']={BlockUtils={getBlocksFromLocation=function(p) return world[p.X] and {true} or {} end}},
   ['ReplicatedStorage.Shared.SharedConfig']={CLIENT_REACH=20},
  }
  player.Character={FindFirstChild=function() return {Position=pos(0)} end}
  b.LayerIndex=nil;b.Failures={};b.Cells={{CFrame={Position=pos(4)},Material='grass'},{CFrame={Position=pos(7)},Material='grass'}}
  for _,cell in ipairs(b.Cells) do cell.Preview={Destroy=function() end};cell.PreviewColor={} end
  b.SetupMarkers=true
  b.Buttons.Start.Activated:Fire();for _=1,4 do stepWorkers() end
  assert(not b.WorkerToken and b.Buttons.RetryFailed.Active and #trace==2,'real rejected placements must enable Retry failed after cleanup')
  assert(b.History[1].Attempts==2 and b.History[1].Retryable==2 and b.History[1].Review==0 and string.find(b.History[1].LastResult,'MISSING_MATERIALS',1,true),'native history must retain the actual server reason and eligible rejected count')

  assert(b.Cells[1].SetupState=='Rejected' and b.Cells[2].SetupState=='Rejected','actual rejected requests must be visible as red diagnostics')
  b.Buttons.CheckSetup.Activated:Fire()
  assert(string.find(b.SetupReport,'Retry failed targets 2 explicitly rejected cells',1,true),'setup must explain the eligible retry count')
  assert(string.find(b.SetupReport,'REJECTED · blueprint block #1 · grass · MISSING_MATERIALS',1,true),'setup must retain per-cell server reasons')
  allow=true;b.Buttons.RetryFailed.Activated:Fire();for _=1,4 do stepWorkers() end
  assert(#trace==4 and b.Progress.RetryOnly and b.Progress.Total==2 and b.Progress.Placed==2 and not b.Buttons.RetryFailed.Active,'actual Retry failed must use the normal confirmed worker and clear completed candidates')
  assert(b.History[1].RetryOnly and string.find(b:ShowHistory(),'Run type: Retry failed',1,true),'retry history must identify its narrower run scope')
  assert(b.Buttons.RetryFailed.Position.Y.Offset==b.Buttons.Clear.Position.Y.Offset and b.LayoutHeight<650,'retry action must fit the compact action row')
  r.CarrotCount=saved.Count
  r.ModuleCache,b.Cells,b.LayerIndex,player.Character,b.Failures,b.Progress,b.History=saved.Cache,saved.Cells,saved.Layer,saved.Character,saved.Failures,saved.Progress,saved.History
  b.HistoryIndex=0;b.SetupReport=nil;b.SetupResult=nil;b.SetupMarkers=false;b.VisualSnapshot=nil;b.VisualCounts=nil;b:RefreshFailureUI()
  end)()
 ;(function()
  local b,r=buildController,RemoteCatalog
  local saved={Count=r.CarrotCount,Navigation=r.Navigation,Cache=r.ModuleCache,Cells=b.Cells,Layer=b.LayerIndex,Character=player.Character,Failures=b.Failures,Progress=b.Progress,History=b.History}
  r.CarrotCount=function() return 100 end
  local world,trace,walks,stops={},{},0,{}
  local function pos(x) return setmetatable({X=x,Y=0,Z=0},{__sub=function(a,c) return {Magnitude=math.abs(a.X-c.X)} end}) end
  local root={Position=pos(0)}
  r.ModuleCache={
   ['ReplicatedStorage.TS.network.requests']={Requests={Client={Get=function() return {CallServer=function(_,body)
    assert((root.Position-body.cframe.Position).Magnitude<=20,'real placement adapter must be inside normal reach')
    table.insert(trace,body.cframe.Position.X);world[body.cframe.Position.X]=true;return true
   end} end}}},
   ['ReplicatedStorage.TS.util.block-utils']={BlockUtils={getBlocksFromLocation=function(p) return world[p.X] and {true} or {} end}},
   ['ReplicatedStorage.Shared.SharedConfig']={CLIENT_REACH=20},
  }
  r.Navigation={Stop=function(owner) table.insert(stops,owner);return true end,Approach=function(who,target,reach,active,positionOf,mode,owner)
   assert(who==player and mode=='Walk' and owner=='Build' and reach==16 and target.Parent~=nil and active(),'real adapter must use walking, scoped ownership and a margin inside normal reach')
   walks+=1;task.wait(.1)
   if active() then root.Position=positionOf(target);return true end
   return false,'Travel stopped'
  end}
  player.Character={FindFirstChild=function() return root end}
  b.Cells={{CFrame={Position=pos(80)},Material='grass'}};b.LayerIndex=nil;b.Failures={}
  assert(b.TravelMode=='Stay' and b.Buttons.Travel.Position.Y.Offset>=b.Buttons.Reach.Position.Y.Offset+b.Buttons.Reach.Size.Y.Offset,'Auto Walk must default OFF and fit below reach controls without overlap')
  b.Buttons.Travel.Activated:Fire();assert(b.TravelMode=='Walk' and walks==0 and #trace==0,'the toggle selects movement without starting a path or placement')
  b.Buttons.Start.Activated:Fire();assert(b.Running and b.Progress.State=='Walking to block' and walks==1)
  b.Buttons.Travel.Activated:Fire();assert(b.TravelMode=='Walk','real UI must lock travel changes during a run')
  b.Buttons.Stop.Activated:Fire();assert(stops[#stops]=='Build' and b.WorkerToken,'real Stop must cancel only Build movement while path cleanup remains locked')
  for _=1,3 do stepWorkers() end
  assert(#trace==0 and not b.WorkerToken and b.Progress.State=='Stopped','cancelled UI path cannot dispatch placement')
  b.Buttons.Start.Activated:Fire();for _=1,5 do stepWorkers() end
  assert(walks==2 and #trace==1 and trace[1]==80 and b.Progress.Placed==1 and not b.WorkerToken,'real Resume must re-approach and confirm placement with the existing request envelope')
  for _,owner in ipairs(stops) do assert(owner=='Build','Build must not issue an unscoped navigation stop') end
  enabled=true;assert(string.find(r.BuildTravelBlocked(),'Fishing',1,true));enabled=false
  harvestEnabled=true;local walk=CONFIG.HarvestWalk;CONFIG.HarvestWalk=true
  assert(string.find(r.BuildTravelBlocked(),'farming',1,true));harvestEnabled=false;CONFIG.HarvestWalk=walk
  local chestWorker,chestTravel=r.ChestAutoWorker,r.ChestTravel;r.ChestAutoWorker=true;r.ChestTravel='Walk'
  assert(string.find(r.BuildTravelBlocked(),'chest',1,true));r.ChestAutoWorker,r.ChestTravel=chestWorker,chestTravel
  r.Navigation.Humanoid={};r.Navigation.Owner='Chest';assert(r.BuildTravelBlocked());r.Navigation.Owner='Build';assert(not r.BuildTravelBlocked())
  b.Buttons.Travel.Activated:Fire();assert(b.TravelMode=='Stay')
  r.CarrotCount=saved.Count
  r.Navigation,r.ModuleCache,b.Cells,b.LayerIndex,player.Character,b.Failures,b.Progress,b.History=saved.Navigation,saved.Cache,saved.Cells,saved.Layer,saved.Character,saved.Failures,saved.Progress,saved.History
  b.HistoryIndex=0;b.SetupReport=nil;b.SetupResult=nil;b.VisualSnapshot=nil;b.VisualCounts=nil;b.LastTravelResult=nil;b:RefreshFailureUI()
  end)()
 showTab('Auto Build');flush()
 assert(not buildController.Inputs.Width.Visible and not buildController.Buttons.Load.Visible,'tab intro must not reveal collapsed Auto Build fields')
 local startY=buildController.Buttons.Start.Position.Y.Offset
 buildController.SectionButtons.Settings.Activated:Fire()
 assert(buildController.Inputs.Width.Visible and buildController.Buttons.Start.Position.Y.Offset>startY,'settings must expand in flow above build actions')
 buildController.SectionButtons.Library.Activated:Fire()
 assert(buildController.Buttons.Load.Visible and buildController.Buttons.Check.Visible,'saved-blueprint section must reveal its controls')
 buildController.SectionButtons.Materials.Activated:Fire()
 assert(buildController.Inputs.ReplaceTo.Visible and buildPage.CanvasSize.Y.Offset==buildController.LayoutHeight,'editing section must expand the explicit scroll canvas')
 for _,key in ipairs({'Library','Settings','Materials'}) do buildController.SectionButtons[key].Activated:Fire() end
 assert(buildController.Buttons.Start.Position.Y.Offset==startY and buildController.LayoutHeight<650,'section round trip must not drift the action layout')
 buildController.Buttons.Movement.Activated:Fire()
 assert(buildController.MoveMenu.Visible,'move menu must still open in compact layout')
 showTab('Chests')
 assert(not buildController.MoveMenu.Visible,'switching tabs must close the Auto Build menu')
 showTab('Fishing')
 buildController.Buttons.Reach.Activated:Fire();updateBoard()
 assert(buildController.RangeMarkers and not buildController.Cells and not buildController.Running,'reach marking without a preview must remain a display preference')
 buildController.Buttons.Reach.Activated:Fire()
 assert(not buildController.RangeMarkers,'reach markers must be switchable OFF through the actual UI')
 end)()
 ;(function()
 local originalWrite,originalRead=writefile,readfile
 local encode,decode=HttpService.JSONEncode,HttpService.JSONDecode
 local file,encoded,snapshot
 HttpService.JSONEncode=function(_,data) snapshot=data;return 'favorites-json' end
 HttpService.JSONDecode=function(_,value) assert(value=='favorites-json');return snapshot end
 writefile=function(name,value) file=name;encoded=value end
 readfile=function(name) assert(name==file);return encoded end
 buildController.Buttons.FavoriteMaterial.Activated:Fire()
 assert(file=='RebornBuildFavorites_7.json' and snapshot.Version==1 and snapshot.Items[1]=='grass','favorite stars must use the account-specific host file adapter')
 buildController.Favorites={}
 assert(buildController:LoadFavorites() and buildController.Favorites[1]=='grass','favorite host read adapter must decode validated data')
 buildController.Buttons.FavoritePath.Activated:Fire()
 assert(#buildController.Favorites==2 and snapshot.Items[2]=='stone','build/path controls must share the material favorite list')
 buildController.Buttons.UseFavoriteMaterial.Activated:Fire()
 assert(buildController.Inputs.Material.Text=='stone' and not buildController.Running,'favorite cycling must select through the actual UI without building')
 readfile=function() return string.rep('x',4097) end
 assert(not buildController:LoadFavorites() and #buildController.Favorites==2,'oversized favorite files must be rejected without losing session data')
 buildController.Inputs.Material.Text='grass';buildController.Inputs.Material.FocusLost:Fire()
 buildController.Favorites={};buildController:RefreshFavorites()
 writefile,readfile=originalWrite,originalRead
 HttpService.JSONEncode,HttpService.JSONDecode=encode,decode
 local options=buildPage:FindFirstChild('BlueprintOptions');local choices={}
 for _,child in ipairs(options:GetChildren()) do if child:IsA('TextButton') then choices[child.Text]=child end end
 for _,name in ipairs({'Room','Bridge','Fence'}) do
  assert(choices[name],'new presets must be available in the actual menu')
  choices[name].Activated:Fire();assert(buildController.Preset==name and not buildController.Running)
 end
 choices['Farm plots'].Activated:Fire()
 end)()
 ;(function()
 local originalWrite,originalRead=writefile,readfile
 local encode,decode=HttpService.JSONEncode,HttpService.JSONDecode
 local path,encoded,snapshot
 local json,files={},{}
 HttpService.JSONEncode=function(_,data) snapshot=data;local key='blueprint-json-'..(#json+1);table.insert(json,data);return key end
 HttpService.JSONDecode=function(_,value) local index=tonumber(value:match('^blueprint%-json%-(%d+)$'));return assert(json[index]) end
 writefile=function(name,value) path=name;encoded=value;files[name]=value end
 readfile=function(name) return assert(files[name],'file missing') end
 local plan={Version=1,Name='House',BlockSize=3,Cells={{Material='grass',Components={0,0,0,1,0,0,0,1,0,0,0,1}}}}
 assert(buildController:StoreBlueprint(plan) and path=='RebornBlueprint_7_1.json' and encoded=='blueprint-json-1','host adapter must use account-specific fixed slot filenames')
 buildController.Library={}
 buildController.Buttons.Load.Activated:Fire()
 assert(buildController.SavedPlan and buildController.SavedPlan.Name=='House' and not buildController.Running and not buildController.Cells,'Load button must validate disk data without starting a build')
 buildController.Buttons.Inspect.Activated:Fire()
 assert(string.find(buildController.LibrarySummary.Text,'House',1,true),'slot browser must display the saved layout name')
 buildController.Inputs.Name.Text='Cabin'
 buildController.Buttons.Rename.Activated:Fire()
 assert(buildController.Library[1].Name=='Cabin','Rename button must use the blueprint name field')
 buildController.Buttons.CopySlot.Activated:Fire()
 assert(buildController.Library[2].Name=='Cabin' and buildController.Slot==1 and path=='RebornBlueprint_7_2.json','Copy button must persist the explicit target without switching the source slot')
 local findDefinitions=ReplicatedStorage.FindFirstChild
 ReplicatedStorage.FindFirstChild=function(_,name)
  if name=='Blocks' then return {FindFirstChild=function(_,material) return (material=='grass' or material=='stone') and {} end} end
 end
 buildController.Inputs.ReplaceFrom.Text='grass';buildController.Inputs.ReplaceTo.Text='stone'
 buildController.Buttons.Replace.Activated:Fire()
 assert(buildController.SavedPlan.Cells[1].Material=='stone' and buildController.Library[1].Cells[1].Material=='grass','Replace button must isolate the working layout from the saved slot')
 buildController.Buttons.UndoMaterial.Activated:Fire()
 assert(buildController.SavedPlan.Cells[1].Material=='grass' and not buildController.MaterialUndo,'Undo button must restore the prior working material')
 local originalPlan=buildController.SavedPlan
 buildController.SavedPlan={Version=1,Name='Edit test',BlockSize=3,Cells={
  {Material='grass',Components={0,0,0,1,0,0,0,1,0,0,0,1}},
  {Material='stone',Components={0,3,0,1,0,0,0,1,0,0,0,1}}}}
 buildController.Buttons.RemoveMaterial.Activated:Fire()
 assert(#buildController.SavedPlan.Cells==1 and buildController.SavedPlan.Cells[1].Material=='stone' and buildController.Library[1].Cells[1].Material=='grass','Remove named blocks button must change only the working blueprint')
 buildController.Buttons.UndoMaterial.Activated:Fire()
 assert(#buildController.SavedPlan.Cells==2,'actual Undo must restore removed blueprint cells without requiring a preview')
 buildController.Cells={{LayerY=0,Material='grass'},{LayerY=3,Material='stone'}}
 buildController.LayerIndex=1
 buildController.Buttons.RemoveLayer.Activated:Fire()
 assert(#buildController.Cells==1 and buildController.Cells[1].LayerY==3 and not buildController.LayerIndex,'Remove layer button must remove the selected height and reset selection')
 buildController.Cells=nil
 buildController.Buttons.UndoMaterial.Activated:Fire()
 assert(#buildController.SavedPlan.Cells==2 and not buildController.Running,'removal Undo must never start building')
 buildController.SavedPlan=originalPlan;buildController.PlanDirty=false
 ReplicatedStorage.FindFirstChild=findDefinitions

 buildController.Buttons.Check.Activated:Fire()
 assert(string.find(buildController.Status.Text,'Preview at the intended position',1,true),'preflight must request a preview rather than starting one implicitly')
 local oldCopy=setclipboard
 local copied
 setclipboard=function(report) copied=report end
 buildController.BuildReport='Read-only build check'
 buildController.Buttons.CopyCheck.Activated:Fire()
 assert(copied=='Read-only build check' and not buildController.Running,'copy build check must use the host clipboard without starting a build')
 buildController.History={{Name='Bridge',Layer='All layers',WholeTotal=10,Total=10,Placed=4,Skipped=2,Failed=1,State='Stopped',Elapsed=2.5}}
 buildController.HistoryIndex=0
 buildController.SectionButtons.History.Activated:Fire()
 assert(buildController.Buttons.History.Visible,'build history must expand through its actual section control')
 buildController.Buttons.History.Activated:Fire()
 buildController.Buttons.CopyHistory.Activated:Fire()
 ;(function()
 local selection,shown=buildController.HistoryIndex,buildController.HistoryLabel.Text
 buildController.Buttons.CopyAllHistory.Activated:Fire()
 assert(string.find(copied,'all recorded results',1,true) and buildController.HistoryIndex==selection and buildController.HistoryLabel.Text==shown and not buildController.Running,'native Copy all must preserve browsing state and stay read-only')
 assert(buildController.Buttons.CopyAllHistory.Position.Y.Offset==buildController.Buttons.History.Position.Y.Offset and buildController.Buttons.CopyAllHistory.Position.X.Scale>buildController.Buttons.CopyHistory.Position.X.Scale,'Copy all must share the history action row')
 end)()
 assert(string.find(copied,'Bridge',1,true) and string.find(copied,'3 unprocessed',1,true),'history buttons must display and copy the selected plain-data result')
 buildController.SectionButtons.History.Activated:Fire()
 buildController.History={};buildController.HistoryIndex=0;buildController.HistoryReport=nil
 setclipboard=oldCopy
 assert(not buildController.LayerIndex and buildController.Buttons.Layer.Text=='Build: All layers','layer filter must default to the complete plan')
 assert(buildController.Buttons.Layer.Position.Y.Offset==buildController.Buttons.Speed.Position.Y.Offset and buildController.Buttons.Start.Position.Y.Offset<buildController.Buttons.Preview.Position.Y.Offset,'layer control must fit above the build actions')
 local upperGhost={}
 buildController.Cells={{LayerY=0,Material='grass'},{LayerY=3,Material='stone',Preview=upperGhost}}
 buildController.Buttons.Layer.Activated:Fire()
 assert(buildController.LayerIndex==1 and #buildController:SelectedCells()==1 and upperGhost.Transparency==.94,'actual layer button must filter selection and fade excluded ghosts')
 buildController.Buttons.Layer.Activated:Fire()
 assert(buildController.LayerIndex==2 and upperGhost.Transparency==.65,'actual button must restore the selected layer visibility')
 buildController.Buttons.Layer.Activated:Fire()
 assert(not buildController.LayerIndex and #buildController:SelectedCells()==2,'actual layer button must restore All layers')
 buildController.Cells=nil
 buildController.Buttons.Slot.Activated:Fire()
 assert(buildController.Slot==2,'slot button must cycle independently of blueprint names')
 buildController.Buttons.CaptureRange.Activated:Fire()
 assert(buildController.CaptureRange==60,'capture range must be configurable')
 buildController.SavedPlan=nil;buildController.Preset='Farm plots';buildController.Slot=1;buildController.Library={};buildController.CaptureRange=30
 writefile,readfile=originalWrite,originalRead
 HttpService.JSONEncode,HttpService.JSONDecode=encode,decode
 end)()

 ;(function()
 local b=buildController
 b:ClearEdits()
 local function transform(x,z) return {GetComponents=function() return x,0,z,1,0,0,0,1,0,0,0,1 end} end
 b.Anchor={ToObjectSpace=function(_,cf) return cf end};b.BlockSize=3
 b.SavedPlan={Version=1,Name='Single edits',BlockSize=3,Cells={
  {Material='grass',Components={0,0,-6,1,0,0,0,1,0,0,0,1}},
  {Material='grass',Components={0,0,-3,1,0,0,0,1,0,0,0,1}},
  {Material='grass',Components={3,0,-3,1,0,0,0,1,0,0,0,1}}}}
 local function ghost() return {Destroy=function(self) self.Destroyed=true end} end
 b.Cells={{CFrame=transform(0,-3),LayerY=0,Material='grass',Preview=ghost()},
  {CFrame=transform(0,-6),LayerY=0,Material='grass',Preview=ghost()},
  {CFrame=transform(3,-3),LayerY=0,Material='grass',Preview=ghost()}}
 local findDefinitions=ReplicatedStorage.FindFirstChild
 ReplicatedStorage.FindFirstChild=function(_,name) if name=='Blocks' then return {FindFirstChild=function(_,name) return name=='grass' or name=='stone' end} end end
 b.SectionButtons.Materials.Activated:Fire()
 b.Buttons.Pick.Activated:Fire();assert(b.Picking and type(RemoteCatalog.BuildPicker)=='function','actual picker control must enable registered world input')
 b.Buttons.NextBlock.Activated:Fire();assert(b.SelectedCell==b.Cells[1] and b.Cells[1].Preview.Transparency==.25,'Next block must highlight a real preview ghost')
 b.Inputs.ReplaceTo.Text='stone';b.Buttons.ReplaceSelected.Activated:Fire()
 assert(b.Cells[1].Material=='stone' and b.Cells[2].Material=='grass','Replace selected button must edit exactly one same-material ghost')
 b.Buttons.UndoMaterial.Activated:Fire();assert(b.Cells[1].Material=='grass' and #b.RedoStack==1)
 b.Buttons.Redo.Activated:Fire();assert(b.Cells[1].Material=='stone' and #b.RedoStack==0,'actual Redo button must restore the selected replacement')
 b.Buttons.RemoveSelected.Activated:Fire();assert(#b.Cells==2 and not b.SelectedCell,'Remove selected button must remove one ghost')
 b:ClearPreview();b.Buttons.UndoMaterial.Activated:Fire()
 assert(#b.SavedPlan.Cells==3 and not b.Cells,'actual removal Undo after Clear must restore data without constructing a preview')
 b.Buttons.Redo.Activated:Fire();assert(#b.SavedPlan.Cells==2 and not b.Cells,'actual removal Redo must restore the survivor-only plan')
 b.SectionButtons.Materials.Activated:Fire()
 assert(not b.Picking and b.LayoutHeight<650 and not b.Buttons.ReplaceSelected.Visible,'closing the editor must disable picking and restore compact layout')
 ReplicatedStorage.FindFirstChild=findDefinitions
 b:ClearEdits();b.SavedPlan=nil;b.PlanDirty=false;b.Preset='Farm plots';b.Inputs.ReplaceTo.Text='';b.Anchor=nil
 end)()

buildController.Buttons.Rotate.Activated:Fire()
assert(buildController.Rotation==90 and not buildController.Cells,'rotation before Preview must retain the existing settings behavior')
buildController.Buttons.Center.Activated:Fire()
assert(string.find(buildController.Status.Text,'Preview a blueprint',1,true) and not buildController.Running,'Center button must require a preview and never start a build')
buildController.Rotation=0
buildController.Buttons.Preview.Activated:Fire()
assert(string.find(buildController.Status.Text,"spawn",1,true))
assert(buildController.Preset=="Farm plots")
assert(not RemoteCatalog.Recorder,'recorder must be off on actual full startup')
assert(not RemoteCatalog.ChestAutoEnabled and not RemoteCatalog.ChestAutoWorker,'chest automation must be off at startup')
assert(RemoteCatalog.AntiAFK.Enabled and RemoteCatalog.AntiAFK.Connection,'Anti AFK must start ON with an idle listener')
local idleClicks=0
services.VirtualUser={CaptureController=function() end,ClickButton2=function() idleClicks+=1 end}
player.Idled:Fire()
assert(idleClicks==1,'Startup must wire the idle response')
RemoteCatalog.AntiAFKButton.Activated:Fire()
player.Idled:Fire()
assert(not RemoteCatalog.AntiAFK.Enabled and idleClicks==1,'Settings toggle must disable the idle response')
RemoteCatalog.AntiAFKButton.Activated:Fire()
stopAllButton.Activated:Fire()
player.Idled:Fire()
assert(not RemoteCatalog.AntiAFK.Enabled and idleClicks==1,'Stop All must disable Anti AFK')
 ;(function()
 assert(not RemoteCatalog.StopTimerDeadline and RemoteCatalog.StopTimerMinutes==15,'session timer must start OFF with a fifteen-minute choice')
 RemoteCatalog.UpdateDashboard()
 assert(string.find(RemoteCatalog.DashboardStatus.Text,'Fishing OFF',1,true) and string.find(RemoteCatalog.DashboardStatus.Text,'Chests: idle',1,true),'dashboard must reflect startup mode state')
 for _,name in ipairs({'Fishing','Harvest','Wood Farm','Mining','Chests'}) do
  RemoteCatalog.DashboardButtons[name].Activated:Fire()
  assert(hub.CurrentTab==airflowTabs[name],'dashboard shortcut must open its page')
  assert(not enabled and not harvestEnabled and not woodEnabled and not mineEnabled and not RemoteCatalog.ChestAutoEnabled,'navigation must never start automation')
 end
 RemoteCatalog.StopTimerButton.Activated:Fire()
 local deadline=RemoteCatalog.StopTimerDeadline
 assert(deadline and deadline-os.clock()>899 and deadline-os.clock()<=900,'timer start must use the selected real duration')
 assert(not enabled and not baitEnabled and RemoteCatalog.StopTimerButton.Text=='Cancel stop timer','starting a timer must not enable gameplay')
 RemoteCatalog.StopTimerDuration.Activated:Fire()
 assert(RemoteCatalog.StopTimerDeadline==deadline and RemoteCatalog.StopTimerMinutes==15,'duration clicks must not extend a running timer')
 RemoteCatalog.StopTimerButton.Activated:Fire()
 assert(not RemoteCatalog.StopTimerDeadline,'Cancel must disarm the timer')
 for _,minutes in ipairs({30,60,5,15}) do
  RemoteCatalog.StopTimerDuration.Activated:Fire()
  assert(RemoteCatalog.StopTimerMinutes==minutes,'timer duration must cycle through all supported choices')
 end
 local originalStop=RemoteCatalog.StopAllAutomation
 local stops=0
 RemoteCatalog.StopAllAutomation=function() stops+=1;originalStop() end
 RemoteCatalog.StopTimerDeadline=os.clock()+60
 RemoteCatalog.UpdateDashboard()
 assert(stops==0 and RemoteCatalog.StopTimerDeadline,'future timers must leave modes unchanged')
 enabled=true;baitEnabled=true;harvestEnabled=true;woodEnabled=true;mineEnabled=true
 buildController.Running=true;RemoteCatalog.ChestAutoEnabled=true;RemoteCatalog.Planting=true
 RemoteCatalog.StopTimerDeadline=os.clock()-1
 RemoteCatalog.UpdateDashboard();RemoteCatalog.UpdateDashboard()
 assert(stops==1 and not RemoteCatalog.StopTimerDeadline,'expired timer must dispatch Stop All exactly once')
 assert(not enabled and not baitEnabled and not harvestEnabled and not woodEnabled and not mineEnabled and not RemoteCatalog.ChestAutoEnabled and not buildController.Running and not RemoteCatalog.Planting,'timer expiry must stop all gameplay workers')
 assert(string.find(status.Text,'Session timer finished',1,true),'timer expiry must explain the stop')
 RemoteCatalog.StopTimerButton.Activated:Fire()
 RemoteCatalog.DashboardButtons['Stop all'].Activated:Fire()
 assert(stops==2 and not RemoteCatalog.StopTimerDeadline,'dashboard Stop all must use shared cleanup and cancel the timer')
 RemoteCatalog.StopAllAutomation=originalStop
 showTab('Fishing')
 end)()


assert(CONFIG.CastDistance==12 and activeFishingMode=='Fast' and CONFIG.FishingPollInterval==.005,'startup must use fixed Fast mode and 12-stud aim')
applyFishingMode('Safe')
assert(activeFishingMode=='Fast' and CONFIG.CastDistance==12 and not modeButtons.Safe and not modeButtons.Balanced,'other profiles must not override fixed settings')

for _,option in ipairs(woodPage:GetChildren()) do if option.Text=='Tween' then option.Activated:Fire() end end
assert(CONFIG.WoodTravelMode=='Tween' and CONFIG.FarmTravelMode=='Walk' and string.find(RemoteCatalog.TravelSelectors[1].Text,'Walk',1,true),'wood mode selection must not change Harvest travel')
assert(not enabled and not woodEnabled and not harvestEnabled,'choosing a travel mode must not start automation')
for _,option in ipairs(woodPage:GetChildren()) do if option.Text=='Normal' then option.Activated:Fire() end end
assert(CONFIG.WoodTravelMode=='Normal' and CONFIG.FarmTravelMode=='Walk','Normal must be selectable for wood without changing crop travel')

assert(SETTINGS_FILE=='IslandsFarmingHub_7_settings.json','preferences must be isolated by account')
local hum={WalkSpeed=16,JumpPower=50,JumpHeight=7.2,UseJumpPower=true}
local character={FindFirstChildOfClass=function() return hum end,GetChildren=function() return {} end,WaitForChild=function() return hum end}
player.Character=character
movementController.WalkButton.Activated:Fire();movementController.JumpButton.Activated:Fire()
assert(hum.WalkSpeed==20 and hum.JumpPower==60,'movement presets must apply')
movementController.ResetButton.Activated:Fire()
assert(hum.WalkSpeed==16 and hum.JumpPower==50,'reset must restore movement')
hum.UseJumpPower=false
movementController.JumpButton.Activated:Fire();assert(hum.JumpHeight==10,'height-based jump mode missing')
local secondHum={WalkSpeed=18,JumpPower=55,JumpHeight=8,UseJumpPower=false}
local secondChar={FindFirstChildOfClass=function() return secondHum end,GetChildren=function() return {} end,WaitForChild=function() return secondHum end}
player.Character=secondChar;player.CharacterAdded:Fire(secondChar)
assert(secondHum.JumpHeight==10,'enabled movement must follow respawn')
movementController:Reset();assert(secondHum.WalkSpeed==18 and secondHum.JumpHeight==8,'respawn reset must use new character defaults')
player.Character=nil

registerHarvest('treeOrange','wood');registerHarvest('coal','mine');registerHarvest('wheat','crop')
for _,entry in ipairs({{'Wood Farm','WOOD STATS'},{'Mining','MINING STATS'},{'Harvest','CROP STATS'}}) do
 showTab(entry[1]);updateBoard()
 assert(statsOverlayTitle.Text==entry[2] and overlayValues.catches.Text=='1','resource overlay must show independent category totals')
end
showTab('Fishing');updateBoard()
assert(statsOverlayTitle.Text=='FISHING STATS' and overlayValues.catches.Text=='0','resource totals must not change fishing counters')
assert(not enabled and not harvestEnabled and not woodEnabled and not mineEnabled and not baitEnabled)
fruitToggle.Activated:Fire()
assert(CONFIG.FruitEnabled and harvestEnabled,'fruit toggle must start the shared harvest worker')
fruitToggle.Activated:Fire();setHarvestEnabled(false);stepWorkers()
assert(not CONFIG.FruitEnabled and not harvestEnabled,'fruit picking must be independently disabled')
cropSelect.Activated:Fire();cropButtons[2].Activated:Fire()
assert(CONFIG.HarvestCrops.wheat and CONFIG.HarvestCrops.carrot and cropDropdown.Visible,'multi-select must keep existing crops and leave menu open')
cropButtons[1].Activated:Fire();assert(not CONFIG.HarvestCrops.wheat and CONFIG.HarvestCrops.carrot,'selected crops can be removed')
cropButtons[2].Activated:Fire();assert(CONFIG.HarvestCrops.carrot,'last selection must not be removed')
cropButtons[1].Activated:Fire();cropButtons[2].Activated:Fire();cropSelect.Activated:Fire()
assert(CONFIG.HarvestCrops.wheat and not CONFIG.HarvestCrops.carrot and not cropDropdown.Visible,'menu must close without losing chosen crops')
woodToggle.Activated:Fire();harvestToggle.Activated:Fire()
assert(harvestEnabled and not woodEnabled and not mineEnabled,'Harvest must switch off wood/mining')
mineToggle.Activated:Fire();assert(mineEnabled and not harvestEnabled and not woodEnabled,'Mining must select only its worker mode')
mineToggle.Activated:Fire();stepWorkers()
RemoteCatalog.TestOriginalApplyBait=applyBait
local baitApplications=0
applyBait=function() baitApplications+=1;return true end
for _,button in ipairs({toggle,harvestToggle,woodToggle,mineToggle,baitToggle}) do
 button.Activated:Fire()
 if button==toggle then
  assert(not baitEnabled and baitApplications==0,'Fishing must leave bait OFF')
  setEnabled(true);assert(baitApplications==0,'repeated Start must not enable bait')
  assert(RemoteCatalog.FishingStatus.Token==cycleId and string.find(fishInfo.Text,RemoteCatalog.FishingStatus.Text,1,true),'native Start must show this worker status under the fishing switch')
 end
 assert(string.find(button.Text,'ON',1,true),'actual switch/worker failed to stay ON: '..button.Text..' status='..status.Text)
 button.Activated:Fire()
 if button==toggle then
  assert(not baitEnabled,'Stopping Fishing must leave bait OFF')
  local text=fishInfo.Text
  assert(text=='Fishing is off.' and not RemoteCatalog.SetFishingStatus(cycleId-1,'stale cast') and fishInfo.Text==text,'native OFF must reject status from its old worker')
 end
 assert(string.find(button.Text,'OFF',1,true),'actual switch failed to turn OFF')
 stepWorkers()
end
RemoteCatalog.BaitMouseInput=true
baitToggle.Activated:Fire()
toggle.Activated:Fire()
assert(not enabled and not baitEnabled,'synthetic bait input must not enable fishing or bait')
RemoteCatalog.BaitMouseInput=false
statsOverlayGui.Enabled=true
RemoteCatalog.StatsVisibilityButton.Activated:Fire()
assert(not statsOverlayGui.Enabled,'stats control must hide the corner display')
statsOverlay.Position=UDim2.fromOffset(-1000,-1000)
RemoteCatalog.StatsResetButton.Activated:Fire()
assert(statsOverlayGui.Enabled and statsOverlay.Position.X.Scale==1 and statsOverlay.Position.X.Offset==-14,'reset must recover a hidden or lost corner display')
do
RemoteCatalog.BaitNativeStatus="Food API unavailable: Module path not found"
RemoteCatalog.BaitTransport="Tool:Activate"
local report=RemoteCatalog.BaitDiagnosticReport()
assert(string.find(report,"Module path not found",1,true) and string.find(report,"Tool:Activate",1,true),'bait diagnostics must retain native-route failure alongside the fallback transport')
assert(not string.find(report,"RequestIds",1,true),'diagnostic report must not dump captured request contexts')
local copied
setclipboard=function(value) copied=value end
RemoteCatalog.BaitDiagnosticButton.Activated:Fire()
assert(copied==report,'bait diagnostic button must copy the current report')
setclipboard=nil
end
(function()
 local prepare,stop,recorder=RemoteCatalog.PrepareBaitLearning,RemoteCatalog.StopBaitLearning,RemoteCatalog.Recorder
 local learnedBefore={Remote={Parent=true}}
 RemoteCatalog.Recorder={BaitBinding=learnedBefore,Stopped=false}
 RemoteCatalog.PrepareBaitLearning=function() RemoteCatalog.Recorder.LearnBaitOnly=true end
 RemoteCatalog.StopBaitLearning=function() RemoteCatalog.Recorder.LearnBaitOnly=false end
 local attempts=baitApplications
 RemoteCatalog.LearnBaitButton.Activated:Fire()
 assert(not baitEnabled and RemoteCatalog.Recorder.LearnBaitOnly and RemoteCatalog.BaitNeedsRefresh and baitApplications==attempts,'manual learning must arm capture without starting bait or sending an application')
 stopAllButton.Activated:Fire()
 assert(not RemoteCatalog.Recorder.LearnBaitOnly,'Stop All must cancel manual bait learning even when Auto Bait is already OFF')
 RemoteCatalog.PrepareBaitLearning,RemoteCatalog.StopBaitLearning,RemoteCatalog.Recorder=prepare,stop,recorder
 RemoteCatalog.BaitNeedsRefresh=false;RemoteCatalog.BaitFailedBinding=nil
end)()
local originalReplantY=replantToggle.Position.Y.Offset
cropSelect.Activated:Fire()
assert(cropDropdownOpen and replantToggle.Position.Y.Offset>cropDropdown.Position.Y.Offset+cropDropdown.Size.Y.Offset,'expanded crop menu must push following controls below its options')
cropSelect.Activated:Fire()
assert(not cropDropdownOpen and replantToggle.Position.Y.Offset==originalReplantY,'closing crop menu must restore original spacing')
local axeMenu=woodPage:FindFirstChild('AxeDropdown')
assert(axeMenu:IsA('ScrollingFrame') and axeMenu.Size.Y.Offset<=180,'tool menu must have bounded scrollable options')
woodToolSelect.Activated:Fire()
assert(axeMenu.Visible and string.find(woodToolSelect.Text,'▲',1,true),'open tool menu must update its arrow')
RemoteCatalog.TravelSelectors[2].Activated:Fire()
assert(not axeMenu.Visible,'opening movement choices must close the axe menu')
woodToolSelect.Activated:Fire()
hub:Toggle()
assert(not axeMenu.Visible,'hiding the hub must dismiss open menus')
hub:Toggle()
woodToolSelect.Activated:Fire()
hub:SelectTab(airflowTabs.Fishing)
assert(not axeMenu.Visible,'direct sidebar navigation must dismiss menus')
woodToolSelect.Activated:Fire()
showTab('Fishing')
assert(not axeMenu.Visible and string.find(woodToolSelect.Text,'▼',1,true),'switching tabs must close tool menu and reset arrow')
local beforeManualBait=baitApplications
setBaitEnabled(true)
assert(baitEnabled and baitApplications==beforeManualBait+1,'manual bait must apply immediately')
setEnabled(true)
RemoteCatalog.BaitMouseInput=true
toggle.Activated:Fire();baitToggle.Activated:Fire()
assert(enabled and baitEnabled,'synthetic bait input must not disable fishing or bait')
RemoteCatalog.BaitMouseInput=false
setEnabled(false)
assert(baitEnabled and baitApplications==beforeManualBait+1,'Fishing must preserve manually enabled bait')
setBaitEnabled(false);stepWorkers()
applyBait=function() return false,'bait tool not found' end
setBaitEnabled(true);assert(not enabled,'missing bait must not start Fishing');setBaitEnabled(false);stepWorkers()
applyBait=function() return true,'bait consumption confirmed' end
setBaitEnabled(true)
assert(enabled and baitEnabled and not RemoteCatalog.StartFishingOnBait,'confirmed bait must start Fishing once and clear the startup request')
setEnabled(false)
assert(not enabled and not RemoteCatalog.StartFishingOnBait,'manual Fishing OFF must cancel automatic startup')
setBaitEnabled(false);stepWorkers()
assert(not enabled and not harvestEnabled and not woodEnabled and not mineEnabled and not baitEnabled)
assert(not string.find(status.Text,'stopped:',1,true),'worker error during actual startup/switch test: '..status.Text)
;(function()
 local originalApply,originalRun,originalCharacter=applyBait,run,player.Character
 local owned,prepare,stop,recorder,callBait=RemoteCatalog.OwnedTools,RemoteCatalog.PrepareBaitLearning,RemoteCatalog.StopBaitLearning,RemoteCatalog.Recorder,RemoteCatalog.CallBait
 local applications=0
 applyBait=RemoteCatalog.TestOriginalApplyBait
 RemoteCatalog.CallBait=function() applications+=1;error('manual confirmation must not consume more bait') end
 run=function() assert(enabled,'confirmed manual bait must start the real Fishing control') end
 for _,initial in ipairs({3,1}) do
  local quantity=initial
  local bait={Name='bait',GetAttributes=function() return {Amount=quantity} end}
  local character={FindFirstChild=function(_,name) if name=='bait' and bait.Parent then return bait end end,
   FindFirstChildOfClass=function(_,class) if class=='Tool' and bait.Parent then return bait end end}
  player.Character=character;bait.Parent=character
  local oldBinding={Remote={Parent=true},Target=bait}
  RemoteCatalog.Recorder={BaitBinding=oldBinding,Stopped=false,Records={},MaxCalls=100,Active=false}
  RemoteCatalog.OwnedTools=function() return bait.Parent and {bait} or {} end
  RemoteCatalog.PrepareBaitLearning=function() RemoteCatalog.Recorder.LearnBaitOnly=true;RemoteCatalog.Recorder.Stopped=false end
  RemoteCatalog.StopBaitLearning=function() RemoteCatalog.Recorder.LearnBaitOnly=false end
  local realApply=applyBait
  applyBait=function() return false,'waiting for manual learning' end
  setEnabled(true);setBaitEnabled(true)
  applyBait=realApply
  RemoteCatalog.LearnBaitButton.Activated:Fire()
  assert(not enabled and not baitEnabled and RemoteCatalog.BaitSample.Tool==bait and RemoteCatalog.BaitSample.Count==initial and RemoteCatalog.Recorder.LearnBaitOnly,'learn button must snapshot this account before manual input')
  -- A real manually observed use creates a new binding, then the server removes one bait.
  RemoteCatalog.Recorder.BaitBinding={Remote={Parent=true},Target=bait,ObservedAt=os.clock()}
  RemoteCatalog.Recorder.LearnBaitOnly=false;RemoteCatalog.Recorder.Stopped=true
  quantity-=1;if quantity==0 then bait.Parent=nil end
  baitToggle.Activated:Fire()
  assert(enabled and baitEnabled and not RemoteCatalog.StartFishingOnBait and applications==0,'manual use must start Fishing through the real switches without consuming another bait')
  assert(RemoteCatalog.BaitOutOfStock==(initial==1),'last-item manual consumption must hand off to Fishing despite empty inventory')
  assert(string.find(baitToggle.Text,'AUTO BAIT ON',1,true) and not string.find(baitToggle.Text,'RETRY',1,true),'confirmed manual use must enter the refresh timer')
  stopAllButton.Activated:Fire();stepWorkers()
 end
 -- Automatic handler learning: click only Auto Bait, with no manual use/button.
 do
  local env,connections,fire=getfenv,getconnections,firesignal
  local getMouse=player.GetMouse
  local globalOwned=RemoteCatalog.OwnedTools
  RemoteCatalog.CallBait=callBait
  firesignal=nil
  for _,channel in ipairs({'Activated','Mouse'}) do
  for _,initial in ipairs({3,1}) do
   local quantity,sent=initial,0
   local current
   local food={}
   local mouse={Button1Down={},Button1Up={}}
   player.GetMouse=function() return channel=='Mouse' and mouse or nil end
   local bait={Name='bait',ManualActivationOnly=channel=='Mouse',Parent={},Activated={},Deactivated={},GetAttributes=function() return {Amount=quantity} end}
   function bait:FindFirstChild(name) if name=='food' and self.Parent then return food end end
   local character
   local hum={EquipTool=function(_,tool) current=tool;tool.Parent=character end}
   character={FindFirstChild=function(_,name) if name=='bait' and bait.Parent==character then return bait end end,
    FindFirstChildOfClass=function(_,class) if class=='Humanoid' then return hum elseif class=='Tool' then return current end end}
   player.Character=character
   RemoteCatalog.Recorder={Stopped=false,Records={},MaxCalls=100,Active=false}
   RemoteCatalog.OwnedTools=function() return bait.Parent and {bait} or {} end
   local function activateFood()
    sent+=1;quantity-=1
    RemoteCatalog.Recorder.BaitBinding={Remote={Parent=true},Target=bait,ObservedAt=os.clock()}
    RemoteCatalog.Recorder.LearnBaitOnly=false
    if quantity==0 then bait.Parent=nil;current=nil end
   end
   getfenv=function(fn) return {script=fn==activateFood and food or {}} end
   getconnections=function(event) return event==(channel=='Mouse' and mouse.Button1Down or bait.Activated) and {{Enabled=true,Function=activateFood}} or {} end
   baitToggle.Activated:Fire()
   for i=1,8 do stepWorkers() end
   assert(enabled and baitEnabled and sent==1 and quantity==initial-1,'Auto Bait alone must call the food handler once, confirm consumption and start Fishing')
   assert(RemoteCatalog.BaitTransport==(channel=='Mouse' and 'Mouse.Button1Down food handler' or 'Tool.Activated food handler'),'automatic startup must select the food script input channel without manual learning')
   stopAllButton.Activated:Fire();stepWorkers()
  end
  end
  getfenv,getconnections,firesignal=env,connections,fire
  player.GetMouse=getMouse
  RemoteCatalog.OwnedTools=globalOwned
 end
 applyBait,run,player.Character=originalApply,originalRun,originalCharacter
 RemoteCatalog.OwnedTools,RemoteCatalog.PrepareBaitLearning,RemoteCatalog.StopBaitLearning,RemoteCatalog.Recorder,RemoteCatalog.CallBait=owned,prepare,stop,recorder,callBait
 RemoteCatalog.BaitSample=nil;RemoteCatalog.BaitNeedsRefresh=false;RemoteCatalog.BaitFailedBinding=nil
end)()
 ;(function()
 local savedFind,savedLive,savedChar=workspace.FindFirstChild,RemoteCatalog.LiveRecorder,player.Character
 local function position(x) return setmetatable({X=x},{__sub=function(a,b) return {Magnitude=math.abs(a.X-b.X)} end}) end
 local island={Name='7-island',FindFirstChild=function() return nil end}
 local foreign={Name='other-island'}
 local chest={Parent=island,Position=position(5),IsA=function(_,kind) return kind=='BasePart' end}
 local root={Position=position(0)}
 player.Character={FindFirstChild=function(_,name) return name=='HumanoidRootPart' and root or nil end,FindFirstChildOfClass=function() return nil end}
 workspace.FindFirstChild=function(_,name)
  if name=='Islands' then return {FindFirstChild=function(_,key) return key=='7-island' and island or nil end} end
 end
 local sent,requested,denied=0,nil,nil
 local recorder={Records={},MaxCalls=100,Active=false,ChestBinding={Chest=chest,Amount=26},CanUseChestBinding=function() return true end,WithdrawCarrots=function(_,amount) sent+=1;requested=amount;if denied then return false,denied end;return true end}
 RemoteCatalog.LiveRecorder=function() return recorder end
 assert(RemoteCatalog.WithdrawCarrots() and sent==1,'nearby owned chest request must send once')
 assert(requested==30 and RemoteCatalog.ChestAmount==30 and RemoteCatalog.ChestAutoBatch=='Max','manual must stay at thirty while Auto defaults to the requested Max mode')
 chest.Position=position(50)
 assert(not RemoteCatalog.WithdrawCarrots() and sent==1,'distant chest must not send')
 chest.Position=position(5);chest.Parent=foreign
 assert(not RemoteCatalog.WithdrawCarrots() and sent==1,'foreign chest must not send')
 recorder.CanUseChestBinding=function() return false end
 assert(not RemoteCatalog.WithdrawCarrots() and sent==1,'stale chest binding must not send')
 chest.Parent=island;recorder.CanUseChestBinding=function() return true end
 local navigation=RemoteCatalog.Navigation
 local travel,range=RemoteCatalog.ChestTravel,RemoteCatalog.ChestScanRange
 local approached,cancel=0,nil
 RemoteCatalog.Navigation={Stop=function() end,Approach=function(_,target,reach,active,position,mode)
  approached+=1;cancel=active
  assert(target==chest and reach==12 and mode=='Walk','chest must walk into normal interaction reach')
  return true
 end}
 chest.Position=position(60)
 assert(RemoteCatalog.ChestTravel=='Stay' and not RemoteCatalog.ApproachChest(recorder,function() return true end),'chest must default to Stay without walking')
 RemoteCatalog.ChestTravelButton.Activated:Fire()
 assert(RemoteCatalog.ApproachChest(recorder,function() return true end) and approached==1,'chest within approach range must navigate closer')
 RemoteCatalog.ChestTravelButton.Activated:Fire()
 assert(RemoteCatalog.ChestTravel=='Stay' and not cancel(),'Stay must cancel the active chest walk')
 assert(not RemoteCatalog.ApproachChest(recorder,function() return true end) and approached==1,'Stay must not navigate')
 RemoteCatalog.ChestTravelButton.Activated:Fire()
 chest.Position=position(150)
 assert(not RemoteCatalog.ApproachChest(recorder,function() return true end),'outside approach range must wait')
 RemoteCatalog.ChestRangeButton.Activated:Fire()
 assert(RemoteCatalog.ChestScanRange==240 and RemoteCatalog.ApproachChest(recorder,function() return true end),'range increase must permit a more distant approach')
 chest.Position=position(5)
 RemoteCatalog.Navigation=navigation
 RemoteCatalog.ChestTravel,RemoteCatalog.ChestScanRange=travel,range

 RemoteCatalog.ChestAmountButton.Activated:Fire()
 assert(RemoteCatalog.ChestAmountMenu.Visible and RemoteCatalog.ChestAmountMenu.Size.X.Scale==1 and RemoteCatalog.ChestAmountMenu:IsA('ScrollingFrame'),'amount dropdown must open as a full-width scrolling list')
 assert(RemoteCatalog.ChestRangeButton.Position.Y.Offset>=RemoteCatalog.ChestAmountMenu.Position.Y.Offset+RemoteCatalog.ChestAmountMenu.Size.Y.Offset,'amount dropdown must push settings below itself')
 for _,child in ipairs(RemoteCatalog.ChestAmountMenu:GetChildren()) do
  if child:IsA('TextButton') and child.Text=='5' then child.Activated:Fire() end
 end
 assert(RemoteCatalog.ChestAmount==5 and not RemoteCatalog.ChestAmountMenu.Visible,'amount dropdown must select and close')
 denied={success=false,error={message='Not enough carrots in slot',code='INSUFFICIENT_ITEMS'}}
 RemoteCatalog.ChestWithdrawButton.Activated:Fire()
 assert(requested==5 and not RemoteCatalog.ChestBusy,'withdraw handler must send the selected amount and release its lock')
 assert(string.find(RemoteCatalog.ChestResultLabel.Text,'Not enough carrots',1,true) and string.find(RemoteCatalog.ChestLastDetail,'INSUFFICIENT_ITEMS',1,true),'structured server rejection must be readable and copyable')
 RemoteCatalog.ChestAmount='Learned'
 RemoteCatalog.WithdrawCarrots()
 assert(requested==26,'Learned option must use the observed count')
 local cyclic={};cyclic.error=cyclic
 assert(string.find(RemoteCatalog.ChestResultText(cyclic),'cycle',1,true),'cyclic error responses must be bounded')
 RemoteCatalog.ChestAmount=1
 -- Select one or all learned chests and cancel a multi-chest manual batch.
 local savedLocalRecorder=RemoteCatalog.Recorder
 local a=recorder.ChestBinding;a.Slot=1;chest.Name='Chest A'
 local other={Name='Chest B',Parent=island,Position=position(7),IsA=chest.IsA}
 local b={Chest=other,Slot=2,Amount=12}
 recorder.GetChestBindings=function() return {a,b} end
 RemoteCatalog.Recorder=recorder
 recorder.CanUseChestBinding=function() return true end
 local requestedBindings={}
 assert(RemoteCatalog.ChestAutoButton.Position.Y.Offset==130 and RemoteCatalog.ChestAutoButton.Position.X.Scale==.5,'collection action must be beside learning at the top')
 assert(RemoteCatalog.ChestSpeed=='Standard','Standard must remain the default pace')
 assert(not RemoteCatalog.ChestDetailsOpen and not RemoteCatalog.ChestPlanView.Visible and not RemoteCatalog.ChestLearnedButton.Visible,'chest guidance must start collapsed without leaving its old blank area')
 local compactY=RemoteCatalog.ChestWithdrawButton.Position.Y.Offset
 for _=1,3 do
  RemoteCatalog.ChestPreviewButton.Activated:Fire()
  assert(RemoteCatalog.ChestPlanView.Visible and RemoteCatalog.ChestLearnedButton.Visible and RemoteCatalog.ChestWithdrawButton.Position.Y.Offset>compactY,'showing details must expand in flow above manual collection')
  RemoteCatalog.ChestPreviewButton.Activated:Fire()
  assert(not RemoteCatalog.ChestPlanView.Visible and not RemoteCatalog.ChestLearnedButton.Visible and RemoteCatalog.ChestWithdrawButton.Position.Y.Offset==compactY,'closing details must restore the compact layout without drift')
 end
 local left,right=RemoteCatalog.ChestLearnButton,RemoteCatalog.ChestAutoButton
 local gap=right.Position.X.Offset-left.Position.X.Offset-left.Size.X.Offset
 assert(left.Size.X.Scale==.5 and right.Size.X.Scale==.5 and gap>=12,'paired chest actions need a clear gutter at every window width')
 RemoteCatalog.ChestSpeedButton.Activated:Fire()
 assert(RemoteCatalog.ChestSpeed=='Fast' and not RemoteCatalog.ChestAutoEnabled,'pace changes must not start collection')
 RemoteCatalog.ChestAutoWorker=99
 RemoteCatalog.ChestSpeedButton.Activated:Fire()
 assert(RemoteCatalog.ChestSpeed=='Fast','in-flight workers must lock pace changes')
 local whole,discover,items=RemoteCatalog.ChestWhole,RemoteCatalog.ChestDiscover,RemoteCatalog.ChestItems
 RemoteCatalog.ChestLearnedButton.Activated:Fire()
 assert(RemoteCatalog.ChestWhole==whole and RemoteCatalog.ChestDiscover==discover,'in-flight workers must also lock target shortcuts')
 RemoteCatalog.ChestAutoWorker=nil
 local filter={wood=true};RemoteCatalog.ChestItems=filter
 RemoteCatalog.ChestLearnedButton.Activated:Fire()
 assert(not RemoteCatalog.ChestWhole and not RemoteCatalog.ChestDiscover and RemoteCatalog.ChestItems==filter and #requestedBindings==0 and not RemoteCatalog.ChestAutoEnabled,'learned-only shortcut must preserve item choices and preview without withdrawing')
 RemoteCatalog.ChestWhole,RemoteCatalog.ChestDiscover,RemoteCatalog.ChestItems=whole,discover,items
 RemoteCatalog.ChestSpeedButton.Activated:Fire();RemoteCatalog.UpdateChestSelectionUI()

 recorder.WithdrawCarrots=function(_,amount,binding) table.insert(requestedBindings,binding);return true end
 RemoteCatalog.ChestSelectButton.Activated:Fire()
 assert(RemoteCatalog.ChestWithdrawButton.Position.Y.Offset>=RemoteCatalog.ChestSelectMenu.Position.Y.Offset+RemoteCatalog.ChestSelectMenu.Size.Y.Offset,'chest selector must push manual controls below itself')
 local list=RemoteCatalog.ChestSelectMenu:GetChildren()[1]
 for _,option in ipairs(list:GetChildren()) do if string.find(option.Text,'#2',1,true) then option.Activated:Fire() end end
 assert(#RemoteCatalog.SelectedChestTargets()==1 and RemoteCatalog.SelectedChestTargets()[1].Binding==b,'selector must support an individual chest')
 assert(RemoteCatalog.WithdrawCarrots() and requestedBindings[1]==b,'individual request must dispatch to selected chest')
 RemoteCatalog.ChestSelectButton.Activated:Fire()
 list=RemoteCatalog.ChestSelectMenu:GetChildren()[1]
 for _,option in ipairs(list:GetChildren()) do if option.Text=='All learned chests' or option.Text=='All matching chests' then option.Activated:Fire() end end
 assert(#RemoteCatalog.SelectedChestTargets()==2,'All must retain both chests')
 RemoteCatalog.UpdateChestSelectionUI()
 assert(RemoteCatalog.ChestStats.CHESTS.Text=='2' and RemoteCatalog.ChestStats.SLOTS.Text=='2','summary must show physical chest and slot counts separately')
 assert(RemoteCatalog.ChestPage==pages.Chests and RemoteCatalog.ChestLearnButton.Parent==pages.Chests,'chest controls must live in their dedicated tab')
 requestedBindings={}
 RemoteCatalog.ChestWithdrawButton.Activated:Fire()
 assert(#requestedBindings==1 and RemoteCatalog.ChestBusy,'manual all-chest batch must be serialized')
 assert(RemoteCatalog.ChestWithdrawButton.Text=='STOP WITHDRAWAL' and string.find(RemoteCatalog.ChestIntro.Text,'1/2 checks',1,true),'manual progress must use the status line and keep its Stop label stable')
 assert(string.find(status.Text,'1/2 checks',1,true),'manual progress must remain visible in the footer while scrolling')
 assert(not RemoteCatalog.ChestAmountButton.Active and not RemoteCatalog.ChestSpeedButton.Selectable,'manual requests must visibly lock batch and pace controls')
 local batch=RemoteCatalog.ChestAmount
 RemoteCatalog.ChestAmountButton.Activated:Fire()
 assert(not RemoteCatalog.ChestAmountMenu.Visible and RemoteCatalog.ChestAmount==batch,'manual batch menu must stay closed during a request')
 stopAllButton.Activated:Fire();stepWorkers()
 assert(#requestedBindings==1 and not RemoteCatalog.ChestBusy,'Stop All must cancel remaining manual chest requests')
 assert(not RemoteCatalog.ChestManualRunning and RemoteCatalog.ChestAmountButton.Active and RemoteCatalog.ChestSpeedButton.Selectable,'manual cleanup must release its UI locks')
 requestedBindings={}
 RemoteCatalog.ChestWithdrawButton.Activated:Fire();stepWorkers()
 assert(#requestedBindings==2 and requestedBindings[1]==a and requestedBindings[2]==b and not RemoteCatalog.ChestBusy,'manual All must withdraw from both learned chests')
 -- Manual collection must skip a distant chest as a group, keep nearby requests,
 -- and offer cancellation through the same action button.
 local savedTargets=RemoteCatalog.SelectedChestTargets
 local savedReady=RemoteCatalog.ChestRequestReady
 local farChecks=0
 chest.Position=position(80)
 RemoteCatalog.SelectedChestTargets=function()
  local targets={}
  for slot=0,12 do table.insert(targets,{Recorder=recorder,Binding={Chest=chest,Slot=slot,Amount=1}}) end
  table.insert(targets,{Recorder=recorder,Binding=b})
  return targets
 end
 RemoteCatalog.ChestRequestReady=function(binding)
  if binding.Chest==chest then farChecks+=1 end
  return savedReady(binding)
 end
 requestedBindings={}
 RemoteCatalog.ChestWithdrawButton.Activated:Fire();stepWorkers()
 assert(farChecks==1 and #requestedBindings==1 and requestedBindings[1]==b,'manual collection must preflight a distant physical chest once and continue nearby')
 assert(string.find(RemoteCatalog.ChestResultLabel.Text,'Sent 1/14 requests; 13 skipped',1,true),'manual summary must distinguish sent requests and skipped slots')
 RemoteCatalog.SelectedChestTargets=savedTargets;RemoteCatalog.ChestRequestReady=savedReady
 chest.Position=position(5);requestedBindings={}
 RemoteCatalog.ChestWithdrawButton.Activated:Fire()
 assert(RemoteCatalog.ChestBusy and #requestedBindings==1,'manual batch must be active before cancellation')
 RemoteCatalog.ChestWithdrawButton.Activated:Fire();stepWorkers()
 assert(#requestedBindings==1 and not RemoteCatalog.ChestBusy,'pressing manual collection again must cancel unsent requests')
 -- Item checklist supports independent multiple choices and an explicit Done action.
 a.Item='wood';b.Item='stone'
 RemoteCatalog.ChestItemButton.Activated:Fire()
 assert(RemoteCatalog.ChestItemMenu.Visible,'item dropdown must open on the dedicated Chests page')
 assert(RemoteCatalog.ChestSelectButton.Position.Y.Offset>=RemoteCatalog.ChestItemMenu.Position.Y.Offset+RemoteCatalog.ChestItemMenu.Size.Y.Offset,'item dropdown must push later controls below itself')
 local function chooseItem(name)
  for _,option in ipairs(RemoteCatalog.ChestItemMenu:GetChildren()) do
   if option.Text==name or option.Text=='✓ '..name then option.Activated:Fire();return end
  end
  error('missing checklist option '..name)
 end
 local previousGeneration=RemoteCatalog.ChestManualGeneration
 chooseItem('stone')
 assert(RemoteCatalog.ChestItems.stone and RemoteCatalog.ChestItemMenu.Visible,'item choice must stay open for multiple selection')
 assert(RemoteCatalog.ChestManualGeneration>previousGeneration,'changing selected items must cancel pending manual requests')
 local selectedItems=RemoteCatalog.SelectedChestTargets()
 assert(#selectedItems==1 and selectedItems[1].Binding==b,'actual UI item handler must filter to stone')
 chooseItem('wood')
 assert(RemoteCatalog.ChestItems.wood and #RemoteCatalog.SelectedChestTargets()==2 and RemoteCatalog.ChestItemSelectionText()=='2 selected','two checked items must both be retained')
 local beforeSearch=RemoteCatalog.ChestManualGeneration
 local beforeRequests=#requestedBindings
 local function searchItems(query)
  RemoteCatalog.ChestItemSearch.Text=query
  RemoteCatalog.ChestItemSearch:GetPropertyChangedSignal('Text'):Fire()
 end
 local function itemVisible(name)
  for _,child in ipairs(RemoteCatalog.ChestItemMenu:GetChildren()) do
   if child.Text==name or child.Text=='✓ '..name then return child.Visible end
  end
  error('missing search item '..name)
 end
 searchItems('  StOnE  ')
 assert(itemVisible('stone') and not itemVisible('wood'),'search must match case-insensitively and trim outer spaces')
 assert(RemoteCatalog.ChestItems.wood and RemoteCatalog.ChestItems.stone and #RemoteCatalog.SelectedChestTargets()==2,'filtering must preserve checked items outside the visible results')
 searchItems('[')
 assert(not itemVisible('wood') and not itemVisible('stone'),'search punctuation must be treated literally')
 local empty=false
 for _,child in ipairs(RemoteCatalog.ChestItemMenu:GetChildren()) do
  if child.Text=='No matching items. Your selection is unchanged.' then empty=child.Visible end
 end
 assert(empty,'empty results must explain that selection is unchanged')
 assert(RemoteCatalog.ChestManualGeneration==beforeSearch and #requestedBindings==beforeRequests,'typing a search must neither cancel collection nor send requests')
 searchItems('')
 assert(itemVisible('wood') and itemVisible('stone'),'clearing search must restore all item rows')

 chooseItem('stone')
 selectedItems=RemoteCatalog.SelectedChestTargets()
 assert(#selectedItems==1 and selectedItems[1].Binding==a,'unchecking one item must preserve the other')
 chooseItem('wood')
 assert(#RemoteCatalog.SelectedChestTargets()==0 and RemoteCatalog.ChestItemSelectionText()=='None selected','unchecking the last item must not accidentally enable all items')
 assert(not RemoteCatalog.SetChestAuto(true) and string.find(RemoteCatalog.ChestResultLabel.Text,'No items selected',1,true),'empty selection must explain why collection cannot start')
 chooseItem('All learned items')
 assert(not RemoteCatalog.ChestItems and #RemoteCatalog.SelectedChestTargets()==2,'All learned items must restore mixed collection')
 chooseItem('Select none')
 assert(RemoteCatalog.ChestItems and next(RemoteCatalog.ChestItems)==nil and #RemoteCatalog.SelectedChestTargets()==0,'Select none must leave an explicit empty selection')
 RemoteCatalog.ChestPreviewButton.Activated:Fire()
 assert(string.find(RemoteCatalog.ChestPlanLabel.Text,'No targets selected',1,true),'empty preview must explain how to choose targets')
 RemoteCatalog.ChestPreviewButton.Activated:Fire() -- close details before the next preview
 chooseItem('All learned items')
 chooseItem('Done')
 assert(not RemoteCatalog.ChestItemMenu.Visible,'Done must close the item checklist')
 do
  local item,slot,amount=a.Item,a.Slot,a.Amount
  a.Item='potatoSalad';a.Slot=8;a.Amount=17
  local requestCount=#requestedBindings
  RemoteCatalog.ChestItemButton.Activated:Fire()
  searchItems('  PoTaTo SaLaD  ')
  assert(itemVisible('potatoSalad') and not itemVisible('stone'),'spaced food names must find the exact camelCase learned identifier')
  searchItems('potato_salad')
  assert(itemVisible('potatoSalad'),'underscored search must also find the learned food')
  chooseItem('potatoSalad')
  local targets=RemoteCatalog.SelectedChestTargets()
  assert(#targets==1 and targets[1].Binding==a and targets[1].Binding.Item=='potatoSalad' and targets[1].Binding.Slot==8,'food selection must keep the captured identifier and slot')
  a.Slot=3
  targets=RemoteCatalog.SelectedChestTargets()
  assert(targets[1].Binding.Slot==3,'item selection must not pin salad to slot eight')
  assert(#requestedBindings==requestCount and not RemoteCatalog.ChestAutoEnabled,'searching/selecting a food must never withdraw or start Auto Take')
  chooseItem('All learned items');chooseItem('Done')
  a.Item,a.Slot,a.Amount=item,slot,amount
 end
 local beforePreview=#requestedBindings
 chest.Position=position(80)
 RemoteCatalog.ChestPreviewButton.Activated:Fire()
 assert(#requestedBindings==beforePreview and not RemoteCatalog.ChestAutoEnabled,'preview must never withdraw or start automation')
 assert(string.find(RemoteCatalog.ChestPlanLabel.Text,'2 chests · 2 slot checks · 2 item types',1,true),'preview must describe the actual selection')
 assert(string.find(RemoteCatalog.ChestPlanLabel.Text,'1 checks in reach; 1 need approach',1,true),'preview must distinguish reachable and distant targets')
 assert(string.find(RemoteCatalog.ChestPlanLabel.Text,'stone, wood',1,true),'preview must show sorted selected items')
 assert(string.find(RemoteCatalog.ChestPlanLabel.Text,'Stand within 20 studs',1,true),'preview must give an actionable reason for blocked checks')
 assert(RemoteCatalog.ChestPlanLabel.Parent==RemoteCatalog.ChestPlanView and RemoteCatalog.ChestPlanView.AutomaticCanvasSize==Enum.AutomaticSize.Y,'long preview details must scroll within their own viewport')

 assert(RemoteCatalog.ChestAutoButton.Position.Y.Offset==130 and RemoteCatalog.ChestHint.Position.Y.Offset>=RemoteCatalog.ChestPlanView.Position.Y.Offset+RemoteCatalog.ChestPlanView.Size.Y.Offset,'primary collection must stay at the top while detailed guidance fits below the plan')
 assert(not RemoteCatalog.ChestGoal,'goal must default to unlimited')
 RemoteCatalog.ChestAutoEnabled=true
 RemoteCatalog.ChestGoalButton.Activated:Fire()
 assert(not RemoteCatalog.ChestAutoEnabled and RemoteCatalog.ChestGoal==25 and RemoteCatalog.ChestGoalButton.Text=='Auto goal: 25 items','changing the goal must stop the old worker and update its label')
 for _,goal in ipairs({50,100,250,500}) do
  RemoteCatalog.ChestGoalButton.Activated:Fire()
  assert(RemoteCatalog.ChestGoal==goal,'goal control must cycle through its labelled choices')
 end
 RemoteCatalog.ChestGoalButton.Activated:Fire()
 assert(not RemoteCatalog.ChestGoal and RemoteCatalog.ChestGoalButton.Text=='Auto goal: Unlimited','goal control must return to unlimited')
 chest.Position=position(5)

 RemoteCatalog.Recorder=savedLocalRecorder;RemoteCatalog.ChestSelection=nil
 workspace.FindFirstChild,RemoteCatalog.LiveRecorder,player.Character=savedFind,savedLive,savedChar
 local savedRecorder=RemoteCatalog.Recorder
 local stopped=false
 RemoteCatalog.Recorder={LearnChestOnly=true,LearnBaitOnly=true,Stop=function() stopped=true end}
 RemoteCatalog.StopChestLearning()
 assert(not stopped and RemoteCatalog.Recorder.LearnBaitOnly and not RemoteCatalog.Recorder.LearnChestOnly,'stopping chest learner must preserve bait learner')
 RemoteCatalog.Recorder=savedRecorder
end)()
 ;(function()
 local original=player.Character
 local frame={Position=Vector2.new(10,10)}
 local root={CFrame=frame,Position=frame.Position,AssemblyLinearVelocity=Vector2.new(2,2),AssemblyAngularVelocity=Vector2.new(2,2)}
 local humanoid={Health=100}
 local character={FindFirstChild=function(_,name) return name=='HumanoidRootPart' and root end,FindFirstChildOfClass=function(_,class) return class=='Humanoid' and humanoid end}
 root.Parent=character;player.Character=character
 assert(airflowTabs.Teleport and pages.Teleport==RemoteCatalog.TeleportPage,'dedicated Teleport tab must exist')
 RemoteCatalog.UpdateTeleportLabels()
 for name,card in pairs(RemoteCatalog.TeleportCards) do
  if card.Preset then assert(card.Teleport.Text==name,'refresh must preserve destination name: '..name) end
 end
 for name,preset in pairs(RemoteCatalog.TeleportPresets) do
  assert(RemoteCatalog.TeleportCards[name] and table.find(RemoteCatalog.TeleportPresetNames,name),'every preset must have a destination button: '..name)
  assert(not RemoteCatalog.TeleportCards[name].Save,'built-in destinations must not expose an overwrite button')
 end
 RemoteCatalog.TeleportCards.Spawn.Teleport.Activated:Fire()
 assert(string.find(RemoteCatalog.TeleportStatus.Text,'137524393306210',1,true),'wrong-place preset click must explain the required place')
 RemoteCatalog.TeleportCards['Water hole'].Save.Activated:Fire()
 assert(RemoteCatalog.WaterSpot.CFrame==frame and RemoteCatalog.TeleportCards['Water hole'].Label.Text~='Not saved','water save card must save the actual point')
 root.CFrame={Position=Vector2.new(50,50)}
 local away=root.CFrame
 RemoteCatalog.TeleportCards['Water hole'].Teleport.Activated:Fire()
 assert(root.CFrame==frame and not enabled and not baitEnabled and not RemoteCatalog.ChestAutoEnabled,'teleport card must return and pause gameplay')
 RemoteCatalog.TeleportBackButton.Activated:Fire()
 assert(root.CFrame==away,'Back control must restore pre-teleport position')
 RemoteCatalog.TeleportCards['Island / home'].Save.Activated:Fire()
 RemoteCatalog.TeleportCards['Custom spot'].Save.Activated:Fire()
 assert(RemoteCatalog.GetTeleportSpot('Island / home') and RemoteCatalog.GetTeleportSpot('Custom spot'),'additional cards must save independent destinations')
 RemoteCatalog.TeleportClearButton.Activated:Fire()
 assert(not RemoteCatalog.WaterSpot and not RemoteCatalog.TeleportPrevious and next(RemoteCatalog.TeleportSpots)==nil,'Clear must remove every saved position')
 assert(RemoteCatalog.TeleportCards['Water hole'].Label.Text=='Not saved','Clear must update displayed state')
 player.Character=original
end)()
 ;(function()
 local originalRun,originalHarvest,originalStats=run,harvestLoop,stats
 run=function() end;harvestLoop=function() end;stats=newStats()
 for _,mode in ipairs({'fishing','crop','wood','mine'}) do
  local goal=RemoteCatalog.ModeGoals[mode]
  assert(not goal.Limit and goal.Progress==0,'all mode goals must start unlimited')
  assert(goal.PageButton and goal.PageButton.Text==goal.Button.Text,'each farming page must expose its current goal')
  for _,limit in ipairs({10,25,50,100}) do
   goal.PageButton.Activated:Fire()
   assert(goal.Limit==limit and goal.Button.Text==goal.PageButton.Text,'inline controls must share the Stats goal controller')
  end
  goal.PageButton.Activated:Fire()
  assert(not goal.Limit,'inline goals must cycle back to Unlimited')

 end
 local fish=RemoteCatalog.ModeGoals.fishing
 fish.Button.Activated:Fire()
 assert(fish.Limit==10 and not enabled,'choosing a fishing goal must not start fishing')
 setEnabled(true);baitEnabled=true
 for index=1,9 do registerCatch('Trout');RemoteCatalog.CompleteModeGoal('fishing') end
 assert(enabled and fish.Progress==9 and not fish.Reached,'fishing must continue below its goal')
 registerCatch('Trout');RemoteCatalog.CompleteModeGoal('fishing')
 assert(not enabled and baitEnabled and fish.Reached and fish.Progress==10,'fishing goal must stop only Fishing and preserve manual Auto Bait')
 RemoteCatalog.CompleteModeGoal('fishing')
 assert(fish.Progress==10,'completed goals must not dispatch a second stop')
 setEnabled(true)
 assert(fish.Progress==0 and not fish.Reached,'restarting a mode must reset only its run progress')
 fish.Button.Activated:Fire()
 assert(not enabled and fish.Limit==25,'changing an active goal must stop that mode before replacing its limit')
 for _,limit in ipairs({50,100}) do fish.Button.Activated:Fire();assert(fish.Limit==limit) end
 fish.Button.Activated:Fire()
 assert(not fish.Limit,'goal selector must cycle back to Unlimited')
 setEnabled(true)
 for _,mode in ipairs({'crop','wood','mine'}) do
  local goal=RemoteCatalog.ModeGoals[mode]
  goal.Button.Activated:Fire();setFarmMode(mode,true)
  for index=1,10 do registerHarvest('testResource',mode);RemoteCatalog.CompleteModeGoal(mode) end
  assert(goal.Progress==10 and goal.Reached,'each farm mode must retain its own reached goal')
  assert(not harvestEnabled and not woodEnabled and not mineEnabled and enabled,'farm goal must preserve Fishing while stopping its farm mode')
  registerHarvest('external',mode)
  assert(goal.Progress==10,'inactive targets must not advance a mode goal')
 end
 local crop=RemoteCatalog.ModeGoals.crop
 setFarmMode('crop',true);registerHarvest('wheat','crop')
 assert(crop.Progress==1,'only the active matching category must advance')
 stats=newStats()
 assert(crop.Progress==1,'session statistics reset must not reset an active goal')
 setFarmMode('wood',true)
 assert(not harvestEnabled and woodEnabled and RemoteCatalog.ModeGoals.wood.Progress==0,'exclusive farm switching must start fresh progress for the new mode')
 assert(crop.Progress==1,'switching modes must retain the stopped mode progress')
 RemoteCatalog.StopAllAutomation()
 local originalCopy=setclipboard
 local copied
 setclipboard=function(value) copied=value end
 RemoteCatalog.SessionReportButton.Activated:Fire()
 assert(copied and string.find(copied,'Reborn mob-survive-113',1,true) and string.find(copied,'Resources:',1,true) and string.find(copied,'Harvest goal: 1/10',1,true),'report must include session counters and independent mode goals')
 assert(string.find(copied,'Fishing input:',1,true),'session report must include the fishing input backend/result without requiring a cast')
 assert(string.find(copied,'Fishing status:',1,true),'session report must include the persistent fishing status')
 assert(not enabled and not harvestEnabled and not woodEnabled and not mineEnabled,'copying a report must never start gameplay')
 setclipboard=function() error('unavailable') end
 RemoteCatalog.SessionReportButton.Activated:Fire()
 assert(string.find(status.Text,'printed to console',1,true),'failed clipboard must use the console fallback')
 setclipboard=originalCopy
 for mode,goal in pairs(RemoteCatalog.ModeGoals) do goal.Limit=nil;RemoteCatalog.ResetModeGoal(mode) end
 run,harvestLoop,stats=originalRun,originalHarvest,originalStats
 updateBoard()
 end)()
 ;(function()
 assert(RemoteCatalog.ChestResultLabel.Parent==RemoteCatalog.ChestResultView and RemoteCatalog.ChestResultLabel.AutomaticSize==Enum.AutomaticSize.Y,'long results must grow inside a scrollable viewport')
 assert(RemoteCatalog.ChestCopyButton.Position.Y.Offset>=RemoteCatalog.ChestResultView.Position.Y.Offset+RemoteCatalog.ChestResultView.Size.Y.Offset,'result actions must remain below the fixed viewport')
 local originalHistory=RemoteCatalog.ChestHistory
 RemoteCatalog.ChestHistory={}
 RemoteCatalog.RecordChestRun('Pass finished',8,{wood=8})
 RemoteCatalog.RecordChestRun('Goal reached',5,{stone=5},5)
 RemoteCatalog.ChestHistoryButton.Activated:Fire()
 assert(string.find(RemoteCatalog.ChestResultLabel.Text,'Previous run 1/2',1,true) and string.find(RemoteCatalog.ChestLastDetail,'stone: 5',1,true),'history must display the newest run first and make it copyable')
 local originalCopy=setclipboard
 local copied
 setclipboard=function(value) copied=value end
 RemoteCatalog.ChestCopyButton.Activated:Fire()
 assert(copied==RemoteCatalog.ChestLastDetail,'Copy result must copy the selected historical report')
 local shown,index=RemoteCatalog.ChestResultLabel.Text,RemoteCatalog.ChestHistoryIndex
 RemoteCatalog.ChestCopyRunsButton.Activated:Fire()
 assert(copied and string.find(copied,'Chest run history',1,true) and string.find(copied,'stone: 5',1,true) and string.find(copied,'wood: 8',1,true),'Copy runs must export every retained run in one report')
 assert(RemoteCatalog.ChestResultLabel.Text==shown and RemoteCatalog.ChestHistoryIndex==index,'copying all runs must preserve the selected result and history cursor')
 setclipboard=function() error('clipboard unavailable') end
 RemoteCatalog.ChestCopyRunsButton.Activated:Fire()
 assert(string.find(status.Text,'printed to console',1,true),'whole-history copy must support the console fallback')
 setclipboard=originalCopy
 assert(RemoteCatalog.ChestCopyRunsButton.Position.Y.Offset==RemoteCatalog.ChestCopyButton.Position.Y.Offset and RemoteCatalog.ChestHistoryButton.Position.Y.Offset==RemoteCatalog.ChestCopyButton.Position.Y.Offset,'all three result actions must share one row')
 assert(RemoteCatalog.ChestCopyButton.Position.X.Scale+RemoteCatalog.ChestCopyButton.Size.X.Scale<=RemoteCatalog.ChestHistoryButton.Position.X.Scale and RemoteCatalog.ChestHistoryButton.Position.X.Scale+RemoteCatalog.ChestHistoryButton.Size.X.Scale<=RemoteCatalog.ChestCopyRunsButton.Position.X.Scale,'result actions must not overlap horizontally')
 RemoteCatalog.ChestHistoryButton.Activated:Fire()
 assert(string.find(RemoteCatalog.ChestResultLabel.Text,'wood: 8',1,true),'history must cycle to older runs')
 local previous=RemoteCatalog.ChestResultLabel.Text
 RemoteCatalog.ChestBusy=true
 RemoteCatalog.ChestHistoryButton.Activated:Fire()
 setclipboard=function() error('busy history must not copy') end
 RemoteCatalog.ChestCopyRunsButton.Activated:Fire()
 assert(string.find(status.Text,'Finish or stop',1,true),'in-flight request cleanup must lock whole-history export')
 setclipboard=originalCopy
 assert(RemoteCatalog.ChestResultLabel.Text==previous,'history must not overwrite an active request status')
 RemoteCatalog.ChestBusy=false
 RemoteCatalog.ChestHistory=originalHistory
 end)()
 ;(function()
 local r=RemoteCatalog
 local oldWrite,oldRead=writefile,readfile
 local oldEncode,oldDecode=HttpService.JSONEncode,HttpService.JSONDecode
 local oldProfiles,oldSources,oldSlot=r.ChestProfiles,r.ChestProfilePersistence,r.ChestProfileSlot
 local oldSettings={Items=r.ChestItems,Item=r.ChestItem,Selection=r.ChestSelection,Discover=r.ChestDiscover,Whole=r.ChestWhole,
  Speed=r.ChestSpeed,Travel=r.ChestTravel,Range=r.ChestScanRange,Goal=r.ChestGoal,Recorder=r.Recorder}
 local oldWithdraw=r.WithdrawCarrots
 local path,snapshot,writes=nil,nil,0
 HttpService.JSONEncode=function(_,data) snapshot=data;return 'profiles-json' end
 HttpService.JSONDecode=function(_,value) assert(value=='profiles-json');return snapshot end
 writefile=function(name,value) assert(value=='profiles-json');path=name;writes+=1 end
 readfile=function(name) assert(name==path);return 'profiles-json' end
 r.WithdrawCarrots=function() error('profile UI must never withdraw') end
 r.ChestProfiles={};r.ChestProfilePersistence={};r.ChestProfileSlot=1;r.Recorder=nil
 r.ChestItems={wood=true,stone=true};r.ChestItem=nil;r.ChestSelection={};r.ChestDiscover=false;r.ChestWhole=false
 r.ChestSpeed='Fast';r.ChestTravel='Walk';r.ChestScanRange=60;r.ChestGoal=100
 showTab('Chests');flush()
 assert(not r.ChestProfilesPanel.Visible and r.ChestAutoButton.Position.Y.Offset==130,'profiles must stay collapsed on tab reveal and keep collection near the top')
 local initial=r.ChestItemButton.Position.Y.Offset
 r.ChestProfilesButton.Activated:Fire()
 assert(r.ChestProfilesPanel.Visible and r.ChestItemButton.Position.Y.Offset>=r.ChestProfilesPanel.Position.Y.Offset+r.ChestProfilesPanel.Size.Y.Offset,'profile expansion must push the item selector below the panel')
 r.ChestProfileName.Text='  Material run  ';r.ChestProfileSaveButton.Activated:Fire()
 assert(path=='RebornChestProfiles_7.json' and snapshot.Version==1 and snapshot.Profiles['1'].Name=='Material run' and writes==1,'Save button must persist the named profile to the account-specific file')
 assert(r.ChestSelection and not snapshot.Profiles['1'].Selection and not snapshot.Profiles['1'].Chest,'saving preferences must not persist or change the current physical chest choice')
 r.ChestItems=nil;r.ChestDiscover=true;r.ChestWhole=true;r.ChestSpeed='Standard';r.ChestTravel='Stay';r.ChestScanRange=120;r.ChestGoal=nil
 r.ChestProfileLoadButton.Activated:Fire()
 assert(r.ChestItems.wood and r.ChestItems.stone and r.ChestSpeed=='Fast' and r.ChestTravel=='Walk' and r.ChestScanRange==60 and r.ChestGoal==100,'Load button must restore all collection preferences')
 assert(not r.ChestSelection and not r.ChestAutoEnabled and not r.ChestAutoWorker and not r.ChestProfilesPanel.Visible,'loading must reset stale physical selection, remain idle and close menus')
 assert(r.ChestSpeedButton.Text=='Pace: Fast' and r.ChestScopeButton.Text=='Scope: Learned only' and r.ChestWholeButton.Text=='Whole chest: OFF' and r.ChestGoalButton.Text=='Auto goal: 100 items','profile loading must refresh existing controls')
 r.ChestProfilesButton.Activated:Fire();r.ChestProfileSlotButton.Activated:Fire()
 assert(r.ChestProfileSlot==2 and r.ChestProfileName.Text=='Chest setup 2','slot cycling must show a default name for an empty slot')
 r.ChestProfileName.Text='Empty filter';r.ChestItems={};r.ChestProfileSaveButton.Activated:Fire()
 r.ChestProfileSlotButton.Activated:Fire();r.ChestProfileName.Text='Everything';r.ChestItems=nil;r.ChestProfileSaveButton.Activated:Fire()
 assert(snapshot.Profiles['2'].ItemMode=='Selected' and #snapshot.Profiles['2'].Items==0 and snapshot.Profiles['3'].ItemMode=='All','file encoding must distinguish None from All across separate slots')
 r.ChestProfileSlotButton.Activated:Fire()
 assert(r.ChestProfileSlot==1 and r.ChestProfileName.Text=='Material run' and not r.ChestItems,'browsing profiles must not apply them')
 r.ChestAutoWorker=99
 local before=writes
 r.ChestProfileSaveButton.Activated:Fire();r.ChestProfileLoadButton.Activated:Fire()
 assert(writes==before and not r.ChestItems,'in-flight request ownership must guard actual profile callbacks')
 r.ChestAutoWorker=nil
 r.ChestProfiles={};r.ChestProfilePersistence={}
 assert(r.ReadChestProfiles() and r.ChestProfiles[1].Name=='Material run' and r.ChestProfiles[2].ItemMode=='Selected' and not r.ChestItems,'file reload must validate and cache settings without applying them')
 r.RefreshChestProfiles()
 showTab('Fishing');flush()
 assert(not r.ChestProfilesPanel.Visible and r.ChestItemButton.Position.Y.Offset==initial,'tab cleanup must collapse profiles and restore exact layout positions')
 for i=1,3 do r.ChestProfilesButton.Activated:Fire();r.ChestProfilesButton.Activated:Fire() end
 assert(r.ChestItemButton.Position.Y.Offset==initial,'profile layout toggles must not accumulate drift')
 r.ChestProfiles,r.ChestProfilePersistence,r.ChestProfileSlot=oldProfiles,oldSources,oldSlot
 r.ChestItems,r.ChestItem,r.ChestSelection=oldSettings.Items,oldSettings.Item,oldSettings.Selection
 r.ChestDiscover,r.ChestWhole,r.ChestSpeed=oldSettings.Discover,oldSettings.Whole,oldSettings.Speed
 r.ChestTravel,r.ChestScanRange,r.ChestGoal,r.Recorder=oldSettings.Travel,oldSettings.Range,oldSettings.Goal,oldSettings.Recorder
 r.WithdrawCarrots=oldWithdraw
 writefile,readfile=oldWrite,oldRead;HttpService.JSONEncode,HttpService.JSONDecode=oldEncode,oldDecode
 end)()

 ;(function()
 local b=buildController
 local oldWrite,oldRead,oldCopy=writefile,readfile,setclipboard
 local oldEncode,oldDecode=HttpService.JSONEncode,HttpService.JSONDecode
 local oldLibrary,oldBackups,oldSources,oldBackupSources=b.Library,b.Backups,b.Persistence,b.BackupPersistence
 local oldSlot,oldPlan=b.Slot,b.SavedPlan
 local payloads,files,trace={}, {},{}
 local copied,failBackup
 HttpService.JSONEncode=function(_,data) table.insert(payloads,data);return 'layout-'..#payloads end
 HttpService.JSONDecode=function(_,text) local index=tonumber(text:match('^layout%-(%d+)$'));return assert(payloads[index],'invalid JSON') end
 writefile=function(path,text)
  assert(path:match('^RebornBlueprint_7_[1-5]'))
  if failBackup and path:find('_backup.json',1,true) then error('backup write unavailable') end
  files[path]=text;table.insert(trace,path)
 end
 readfile=function(path) return assert(files[path],'file missing') end
 setclipboard=function(text) copied=text end
 b.Library={};b.Backups={};b.Persistence={};b.BackupPersistence={};b.Slot=1
 local function plan(name) return {Version=1,Name=name,BlockSize=3,Cells={{Material='grass',Components={0,0,0,1,0,0,0,1,0,0,0,1}}}} end
 assert(b:StoreBlueprint(plan('First')) and #trace==1 and trace[1]=='RebornBlueprint_7_1.json')
 assert(b:StoreBlueprint(plan('Second')) and trace[2]=='RebornBlueprint_7_1_backup.json' and trace[3]=='RebornBlueprint_7_1.json','host writer must back up the previous version before replacing the primary file')
 assert(HttpService:JSONDecode(files['RebornBlueprint_7_1_backup.json']).Name=='First')
 local disk=files['RebornBlueprint_7_1.json'];failBackup=true
 assert(b:StoreBlueprint(plan('Third')) and files['RebornBlueprint_7_1.json']==disk and b.Persistence[1]=='Session only','failed backup writes must protect the actual old primary file')
 failBackup=false
 b.SavedPlan=plan('Working');b.PlanDirty=true
 local working=b.SavedPlan
 b.SectionButtons.Library.Activated:Fire()
 b.Buttons.RestoreBackup.Activated:Fire()
 assert(b.Library[1].Name=='Second' and b.Backups[1].Name=='Third' and b.SavedPlan==working,'Restore button must replace only the selected saved slot and retain its replacement')
 b.Buttons.ExportSaved.Activated:Fire()
 assert(copied==b.Inputs.Transfer.Text and HttpService:JSONDecode(copied).Name=='Second','saved export must use the host JSON and clipboard adapters')
 b.Buttons.ExportWorking.Activated:Fire()
 assert(HttpService:JSONDecode(copied).Name=='Working','working export must retain unsaved changes')
 local stored=b.Library[1];b.Inputs.Transfer.Text='not JSON';b.Buttons.Import.Activated:Fire()
 assert(b.SavedPlan==working and b.Library[1]==stored,'invalid UI import must retain working/saved layouts')
 local before=#trace
 b.Inputs.Transfer.Text=HttpService:JSONEncode(plan('Shared layout'));b.Buttons.Import.Activated:Fire()
 assert(b.SavedPlan.Name=='Shared layout' and b.PlanDirty and not b.Cells and not b.Running and b.Library[1]==stored and #trace==before,'valid UI import must load only an unsaved working copy without file writes or building')
 b.Backups={};b.BackupPersistence={};b.Buttons.Inspect.Activated:Fire()
 assert(b.Backups[1].Name=='Third' and b.BackupPersistence[1]=='Loaded from file','refresh must discover and validate account-specific backup files')
 b.SectionButtons.Library.Activated:Fire()
 assert(not b.Inputs.Transfer.Visible and not b.Buttons.RestoreBackup.Visible and b.LayoutHeight<650,'transfer controls must remain inside the existing compact library section')
 b.Library,b.Backups,b.Persistence,b.BackupPersistence=oldLibrary,oldBackups,oldSources,oldBackupSources
 b.Slot,b.SavedPlan=oldSlot,oldPlan;b.PlanDirty=false;b:ClearEdits();b:ClearPreview()
 writefile,readfile,setclipboard=oldWrite,oldRead,oldCopy;HttpService.JSONEncode,HttpService.JSONDecode=oldEncode,oldDecode
 end)()
 ;(function()
 assert(not RemoteCatalog.PlowEnabled and not RemoteCatalog.PlowWorker and RemoteCatalog.PlowRadius==15,'Auto Plow must start OFF with a small area')
 RemoteCatalog.PlowScanButton.Activated:Fire()
 assert(not RemoteCatalog.PlowEnabled,'scan must never enable plowing')
 RemoteCatalog.PlowRadiusButton.Activated:Fire();assert(RemoteCatalog.PlowRadiusMenu.Menu.Visible and RemoteCatalog.PlowRadius==15,'opening area choices must not change the setting')
 RemoteCatalog.PlowRadiusMenu.Options[4].Activated:Fire();assert(RemoteCatalog.PlowRadius==20)
 RemoteCatalog.PlowRadiusButton.Activated:Fire();RemoteCatalog.PlowRadiusMenu.Options[1].Activated:Fire();assert(RemoteCatalog.PlowRadius==5)
 RemoteCatalog.PlowRadius=15
 setEnabled(false);setBaitEnabled(false);setFarmMode('crop',false);setFarmMode('wood',false);setFarmMode('mine',false)
 RemoteCatalog.PlowWorker=999
 toggle.Activated:Fire();harvestToggle.Activated:Fire();woodToggle.Activated:Fire();mineToggle.Activated:Fire();baitToggle.Activated:Fire()
 assert(not enabled and not baitEnabled and not harvestEnabled and not woodEnabled and not mineEnabled,'other input-mode callbacks must wait for stopped Plow cleanup')
 buildController.Buttons.Start.Activated:Fire();plantBtn.Activated:Fire();RemoteCatalog.ChestAutoButton.Activated:Fire()
 assert(not buildController.Running and not RemoteCatalog.Planting and not RemoteCatalog.ChestAutoEnabled,'build, planting and chest starts must also wait for Plow ownership')
 RemoteCatalog.PlowRadiusButton.Activated:Fire();assert(RemoteCatalog.PlowRadius==15,'active ownership must freeze the selected plow area')
 RemoteCatalog.PlowWorker=nil
 stopAllButton.Activated:Fire()
 assert(not RemoteCatalog.PlowEnabled,'Stop All must stop Auto Plow too')
 end)()

 ;(function()
 local r=RemoteCatalog
 assert(r.PlowMode=='Auto','Auto must preserve normal-input fallback as the default')
 r.PlowModeButton.Activated:Fire();assert(r.PlowMode=='Auto' and r.PlowModeMenu.Menu.Visible)
 r.PlowModeMenu.Options[2].Activated:Fire();assert(r.PlowMode=='Captured')
 r.PlowModeButton.Activated:Fire();r.PlowModeMenu.Options[3].Activated:Fire();assert(r.PlowMode=='Input')
 r.PlowModeButton.Activated:Fire();r.PlowModeMenu.Options[1].Activated:Fire();assert(r.PlowMode=='Auto')
 r.PlowWorker=55;r.PlowModeButton.Activated:Fire();assert(r.PlowMode=='Auto','in-flight workers must freeze method selection');r.PlowWorker=nil
 local oldRecorder,oldStart,oldAttempted=r.Recorder,r.StartCapture,r.CaptureAttempted
 local learner={Version=27,Active=false,Stopped=false,Records={},MaxCalls=100,RequestIds={}}
 function learner:Stop() self.Stopped=true;self.LearnPlowOnly=false end
 function learner:CanUsePlowBinding() return self.Ready==true end
 function learner:Plow() error('learning controls must never send') end
 r.Recorder=nil;r.StartCapture=function() learner.Stopped=false;return learner end
 r.PlowLearnButton.Activated:Fire()
 assert(learner.LearnPlowOnly and not learner.Active and r.PlowLearning and not r.PlowEnabled,'Learn button must enable quiet manual capture without plowing')
 learner.LearnBaitOnly=true;r.StopBaitLearning()
 learner.LearnWoodOnly=true;r.StopWoodLearning()
 learner.LearnChestOnly=true;r.StopChestLearning()
 assert(learner.LearnPlowOnly and not learner.Stopped,'stopping other quiet learners must preserve an active plow learner')
 learner.Ready=true;learner.LearnPlowOnly=false;learner.Stopped=true
 learner.PlowBinding={Remote={Name='PdqfVEBKHDSMfE',Parent=true}}
 updateBoard()
 assert(not r.PlowLearning and string.find(r.PlowInfo.Text,'Hoe request learned',1,true) and not r.PlowEnabled,'manual capture completion must refresh readiness without starting Auto Plow')
 r.PlowLearnButton.Activated:Fire();assert(learner.LearnPlowOnly)
 r.PlowLearnButton.Activated:Fire();assert(not learner.LearnPlowOnly and not r.PlowLearning,'Learn button must also cancel a pending learner')
 r.PlowLearnButton.Activated:Fire();assert(learner.LearnPlowOnly)
 r.PlowStopButton.Activated:Fire();assert(not learner.LearnPlowOnly and not r.PlowLearning,'dedicated Stop must also cancel manual hoe learning')
 r.PlowLearnButton.Activated:Fire();assert(learner.LearnPlowOnly)
 r.StopAllAutomation();assert(not learner.LearnPlowOnly and not r.PlowLearning,'Stop All must cancel hoe learning as well as plowing')
 r.Recorder,r.StartCapture,r.CaptureAttempted=oldRecorder,oldStart,oldAttempted
 end)()

 ;(function()
 local r=RemoteCatalog
 assert(r.PlowRunMode=='Continuous' and r.PlowStopButton.Modal and r.PlowButton.Active,'new controls must expose continuous and keep the mouse accessible')
 local base=r.PlowInfo.Position.Y.Offset
 for _=1,3 do
  r.PlowModeButton.Activated:Fire()
  assert(r.PlowModeMenu.Menu.Visible and r.PlowInfo.Position.Y.Offset>base,'open method menu must push the status below its options')
  assert(string.find(r.PlowModeMenu.Options[1].Text,'✓',1,true),'selected method must have a checkmark')
  r.PlowModeButton.Activated:Fire()
  assert(not r.PlowModeMenu.Menu.Visible and r.PlowInfo.Position.Y.Offset==base,'closing menus must restore exact layout without drift')
 end
 r.PlowModeButton.Activated:Fire();r.PlowRadiusButton.Activated:Fire()
 assert(not r.PlowModeMenu.Menu.Visible and r.PlowRadiusMenu.Menu.Visible,'only one choice menu may remain open')
 local oldObjects=methods.GetGuiObjectsAtPosition
 local child=Instance.new('TextLabel');child.Parent=r.PlowRadiusMenu.Options[1]
 methods.GetGuiObjectsAtPosition=function() return {child} end
 UserInputService.InputBegan:Fire({UserInputType=Enum.UserInputType.MouseButton1},true)
 assert(r.PlowRadiusMenu.Menu.Visible,'clicking a menu descendant must not dismiss before selection')
 methods.GetGuiObjectsAtPosition=function() return {} end
 UserInputService.InputBegan:Fire({UserInputType=Enum.UserInputType.Touch,Position=Vector2.new(900,900)},true)
 assert(not r.PlowRadiusMenu.Menu.Visible and r.PlowInfo.Position.Y.Offset==base,'outside touch must dismiss and restore layout')
 r.PlowRunButton.Activated:Fire();r.PlowRunMenu.Options[2].Activated:Fire()
 assert(r.PlowRunMode=='One pass' and not r.PlowEnabled,'run selection must not start automation')
 r.PlowRunButton.Activated:Fire();r.PlowRunMenu.Options[1].Activated:Fire()
 r.PlowModeButton.Activated:Fire();UserInputService.InputBegan:Fire({KeyCode=Enum.KeyCode.Escape},true)
 assert(not r.PlowModeMenu.Menu.Visible,'Escape must close dropdowns')
 r.PlowModeButton.Activated:Fire();showTab('Fishing')
 assert(not r.PlowModeMenu.Menu.Visible and r.PlowInfo.Position.Y.Offset==base,'tab changes must restore dropdown layout')
 r.PlowModeButton.Activated:Fire();r.PlowWorker=777;r.PlowModeMenu.Options[2].Activated:Fire()
 assert(r.PlowMode=='Auto' and not r.PlowModeMenu.Menu.Visible,'a worker starting between menu open and selection must retain its method')
 r.PlowEnabled=true;r.UpdatePlowControls()
 r.PlowStopButton.Activated:Fire()
 assert(not r.PlowEnabled and r.PlowWorker==777 and string.find(r.PlowButton.Text,'STOPPING',1,true),'Stop must immediately disable while accurately showing pending cleanup')
 r.PlowButton.Activated:Fire();assert(r.PlowPendingStart,'actual ON button must queue a restart during cleanup')
 r.PlowStopButton.Activated:Fire();assert(not r.PlowPendingStart,'Stop must cancel pending restart intent')
 r.PlowWorker=nil;r.UpdatePlowControls()
 methods.GetGuiObjectsAtPosition=oldObjects
 end)()

 ;(function()
 local r=RemoteCatalog
 local oldTargets,oldCount,oldReady=r.SelectedChestTargets,r.CarrotCount,r.ChestRequestReady
 local oldTarget=r.ChestStockTarget
 local chest={Name='chestMediumIndustrialIO'}
 local binding={Chest=chest,Slot=8,Item='potatoSalad',Amount=17}
 r.SelectedChestTargets=function() return {{Binding=binding}} end
 r.CarrotCount=function(item) assert(item=='potatoSalad');return 37 end
 r.ChestRequestReady=function() return true end
 local before=r.ChestPlanView.Position.Y.Offset
 for _=1,3 do
  r.ChestStockButton.Activated:Fire()
  assert(r.ChestStockMenu.Menu.Visible and r.ChestPlanView.Position.Y.Offset>=r.ChestStockMenu.Menu.Position.Y.Offset+r.ChestStockMenu.Menu.Size.Y.Offset,'top-up dropdown must push the plan below every choice')
  r.ChestStockButton.Activated:Fire()
  assert(not r.ChestStockMenu.Menu.Visible and r.ChestPlanView.Position.Y.Offset==before,'top-up layout must restore without drift')
 end
 r.ChestStockButton.Activated:Fire();r.ChestStockMenu.Options[3].Activated:Fire()
 assert(r.ChestStockTarget==50 and not r.ChestAutoEnabled and not r.ChestBusy,'choosing 50 must only update preferences and the read-only preview')
 assert(string.find(r.ChestPlanLabel.Text,'37 in inventory; 13 missing',1,true) and string.find(r.ChestPlanLabel.Text,'manual batch unchanged',1,true),'preview must explain the actual inventory deficit and manual scope')
 local manualAmount
 local owner={CanUseChestBinding=function() return true end,WithdrawItems=function(_,amount,chosen) assert(chosen==binding);manualAmount=amount;return true end}
 assert(r.WithdrawCarrots(25,owner,binding) and manualAmount==25,'an explicit manual batch must retain its selected amount instead of using the auto top-up deficit')
 r.ChestStockButton.Activated:Fire();r.ChestAutoWorker=55
 r.ChestStockMenu.Options[4].Activated:Fire()
 assert(r.ChestStockTarget==50 and not r.ChestStockMenu.Menu.Visible,'an in-flight worker must lock an already open top-up menu')
 r.ChestStockButton.Activated:Fire();assert(not r.ChestStockMenu.Menu.Visible,'in-flight cleanup must also lock menu opening')
 r.ChestAutoWorker=nil
 r.ChestStockButton.Activated:Fire();r.ChestAmountButton.Activated:Fire()
 assert(not r.ChestStockMenu.Menu.Visible and r.ChestAmountMenu.Visible,'manual batch menu must dismiss the top-up menu')
 assert(r.ChestRangeButton.Position.Y.Offset>=r.ChestAmountMenu.Position.Y.Offset+r.ChestAmountMenu.Size.Y.Offset,'manual batch layout must still push later controls below all options')
 r.CloseMenus();assert(r.ChestPlanView.Position.Y.Offset==before,'shared menu cleanup must restore the complete chest layout')
 r.ChestStockButton.Activated:Fire();r.ChestProfilesButton.Activated:Fire()
 assert(not r.ChestStockMenu.Menu.Visible and r.ChestProfilesPanel.Visible,'opening saved profiles must dismiss top-up options')
 r.CloseMenus();assert(r.ChestPlanView.Position.Y.Offset==before)
 r.CarrotCount=function() return nil end;r.PreviewChestSelection()
 assert(string.find(r.ChestPlanLabel.Text,'inventory count unavailable',1,true),'preview must show an unknown count instead of assuming zero')
 r.ChestStockButton.Activated:Fire();r.ChestStockMenu.Options[1].Activated:Fire()
 assert(not r.ChestStockTarget and string.find(r.ChestStockButton.Text,'No limit',1,true),'No limit must restore the v57 collection preference')
 r.SelectedChestTargets,r.CarrotCount,r.ChestRequestReady=oldTargets,oldCount,oldReady
 r.ChestStockTarget=oldTarget;r.ChestStockMenu:Refresh()
 end)()

 ;(function()
 local r=RemoteCatalog
 local targets,ready,amount=r.SelectedChestTargets,r.ChestRequestReady,r.ChestAmount
 local binding={Chest={},Slot=8,Item='potatoSalad',Amount=17}
 local requests={}
 local owner={CanUseChestBinding=function() return true end,WithdrawItems=function(_,quantity,selected) assert(selected==binding);table.insert(requests,quantity);return true end}
 r.SelectedChestTargets=function() return {{Recorder=owner,Binding=binding}} end
 r.ChestRequestReady=function() return true end
 r.ChestAmount='Learned';r.UpdateChestSelectionUI()
 assert(r.ChestWithdrawButton.Text=='Withdraw ×17','manual action must display the actual learned batch rather than hiding a one-item default')
 r.ChestWithdrawButton.Activated:Fire()
 assert(requests[1]==17 and not r.ChestBusy and r.ChestWithdrawButton.Text=='Withdraw ×17','actual manual button must replay the learned seventeen-item batch and restore its caption')
 r.ChestAmountButton.Activated:Fire()
 for _,option in ipairs(r.ChestAmountMenu:GetChildren()) do if option.Text=='1' then option.Activated:Fire() end end
 assert(r.ChestAmount==1 and r.ChestWithdrawButton.Text=='Withdraw ×1','one item must remain an explicit, visible manual choice')
 r.ChestWithdrawButton.Activated:Fire()
 assert(requests[2]==1 and not r.ChestBusy,'explicit one-item selection must retain v41 manual behavior')
 r.ChestAmountButton.Activated:Fire()
 for _,option in ipairs(r.ChestAmountMenu:GetChildren()) do if option.Text=='30' then option.Activated:Fire() end end
 assert(r.ChestAmount==30 and r.ChestWithdrawButton.Text=='Withdraw ×30','thirty-item batches must be visible and selectable in the manual dropdown')
 r.ChestWithdrawButton.Activated:Fire()
 assert(requests[3]==30,'manual thirty-item selection must send thirty through the existing replay adapter')
 r.ChestAmount='Learned'
 r.SelectedChestTargets=function() return {{Recorder=owner,Binding=binding},{Recorder=owner,Binding={Amount=9}}} end
 assert(r.ChestManualCaption()=='Withdraw learned batches','mixed observed amounts must not advertise a single incorrect batch size')
 r.SelectedChestTargets,r.ChestRequestReady,r.ChestAmount=targets,ready,amount
 r.UpdateChestSelectionUI()
 end)()

 ;(function()
 local r=RemoteCatalog
 assert(r.ChestRepeat==false and string.find(r.ChestRepeatButton.Text,'One pass',1,true),'Repeat must default OFF without starting a worker')
 local y=r.ChestPlanView.Position.Y.Offset
 for _=1,3 do
  r.ChestRepeatButton.Activated:Fire()
  assert(r.ChestRepeatMenu.Menu.Visible and r.ChestPlanView.Position.Y.Offset>=r.ChestRepeatMenu.Menu.Position.Y.Offset+r.ChestRepeatMenu.Menu.Size.Y.Offset,'repeat choices must expand the chest layout without covering its preview')
  r.ChestRepeatButton.Activated:Fire()
  assert(not r.ChestRepeatMenu.Menu.Visible and r.ChestPlanView.Position.Y.Offset==y,'closing repeat options must restore the exact layout')
 end
 r.ChestRepeatButton.Activated:Fire();r.ChestRepeatMenu.Options[2].Activated:Fire()
 assert(r.ChestRepeat and not r.ChestAutoEnabled and not r.ChestAutoWorker and string.find(r.ChestPlanLabel.Text,'wait 2 seconds',1,true),'choosing Repeat must only change the preference and read-only preview')
 r.ChestRepeatButton.Activated:Fire();r.ChestStockButton.Activated:Fire()
 assert(not r.ChestRepeatMenu.Menu.Visible and r.ChestStockMenu.Menu.Visible,'top-up and repeat options must share single-menu cleanup')
 r.CloseMenus();assert(r.ChestPlanView.Position.Y.Offset==y)
 r.ChestRepeatButton.Activated:Fire();r.ChestAutoWorker=77
 r.ChestRepeatMenu.Options[1].Activated:Fire()
 assert(r.ChestRepeat and not r.ChestRepeatMenu.Menu.Visible,'a worker starting while a menu is open must freeze its repeat setting')
 r.ChestRepeatButton.Activated:Fire();assert(not r.ChestRepeatMenu.Menu.Visible,'repeat waiting/cleanup must lock menu opening too')
 r.ChestAutoWorker=nil
 r.ChestAutoEnabled=true;r.ChestRepeatWaiting=true;r.UpdateChestSelectionUI()
 assert(string.find(r.ChestIntro.Text,'Waiting',1,true) and r.ChestWithdrawButton.Text=='PAUSE AUTO TAKE','waiting state must explain why a manual action cannot overlap Auto Take')
 assert(r.ChestAutoButton.Text=='STOP AUTO TAKE' and not r.ChestAmountButton.Active and not r.ChestRepeatButton.Active,'repeat waits must keep an obvious Stop action and lock irrelevant preferences')
 r.ChestAutoEnabled=false;r.ChestRepeatWaiting=false
 r.ChestRepeatButton.Activated:Fire();UserInputService.InputBegan:Fire({KeyCode=Enum.KeyCode.Escape},true)
 assert(not r.ChestRepeatMenu.Menu.Visible and r.ChestPlanView.Position.Y.Offset==y,'Escape must dismiss repeat options and restore their layout')
 r.ChestRepeatButton.Activated:Fire();r.ChestRepeatMenu.Options[1].Activated:Fire()
 assert(not r.ChestRepeat and not r.ChestAutoEnabled,'One pass must remain an explicit non-starting choice')
 r.UpdateChestSelectionUI()
 end)()

;(function()
 local r=RemoteCatalog
 local total,goal=r.ChestAutoTotal,r.ChestGoal
 r.ChestAutoEnabled=true;r.ChestAutoWorker=631;r.ChestAutoTotal=37;r.ChestGoal=100;r.ChestBusy=true
 r.RefreshChestActions()
 assert(r.ChestWithdrawButton.Active and r.ChestWithdrawButton.Text=='PAUSE AUTO TAKE' and r.ChestAutoButton.Text=='STOP AUTO TAKE','Auto Take must expose distinct Pause and Stop actions')
 r.ChestWithdrawButton.Activated:Fire()
 assert(r.ChestAutoPaused and r.ChestWithdrawButton.Text=='RESUME AUTO TAKE' and string.find(status.Text,'Pausing',1,true),'Pause during an in-flight request must explain that its confirmation is finishing')
 r.ChestBusy=false;r.RefreshChestActions()
 assert(string.find(status.Text,'Paused',1,true) and not r.ChestAmountButton.Active and not r.ChestRepeatButton.Active,'paused runs must retain preference locks and visible footer guidance')
 r.ChestWithdrawButton.Activated:Fire()
 assert(not r.ChestAutoPaused and r.ChestAutoTotal==37 and r.ChestGoal==100 and r.ChestAutoWorker==631,'actual Resume must preserve counts, goal and worker ownership')
 r.ChestWithdrawButton.Activated:Fire();r.ChestAutoButton.Activated:Fire()
 assert(not r.ChestAutoEnabled and not r.ChestAutoPaused and r.ChestAutoWorker==631 and r.ChestAutoButton.Text=='STOPPING…','Stop must cancel a paused run while keeping cleanup explicit')
 local generation=r.ChestManualGeneration
 r.ChestWithdrawButton.Activated:Fire()
 assert(r.ChestManualGeneration==generation and not r.ChestWithdrawButton.Active,'the resumed/manual action must stay blocked through cancelled worker cleanup')
 r.ChestAutoWorker=nil;r.ChestAutoTotal=total;r.ChestGoal=goal;r.UpdateChestSelectionUI()
 assert(r.ChestWithdrawButton.Active and r.ChestAmountButton.Active,'cleanup must restore manual controls')
 end)()

;(function()
 local r=RemoteCatalog
 r.ChestAutoBatch='Max';r.ChestBatchMenu:Refresh()
 local y=r.ChestProfilesButton.Position.Y.Offset
 for _=1,3 do
  r.ChestBatchButton.Activated:Fire()
  assert(r.ChestBatchMenu.Menu.Visible and r.ChestProfilesButton.Position.Y.Offset>=r.ChestBatchMenu.Menu.Position.Y.Offset+r.ChestBatchMenu.Menu.Size.Y.Offset,'auto batch choices must push every following section below the menu')
  r.ChestBatchButton.Activated:Fire()
  assert(not r.ChestBatchMenu.Menu.Visible and r.ChestProfilesButton.Position.Y.Offset==y,'batch dropdown cleanup must restore the compact layout without drift')
 end
 local manual=r.ChestAmount
 r.ChestBatchButton.Activated:Fire();r.ChestBatchMenu.Options[5].Activated:Fire()
 assert(r.ChestAutoBatch==250 and r.ChestAmount==manual and not r.ChestAutoEnabled,'fixed automatic batches must stay independent of manual amount and never start automation')
 r.ChestBatchButton.Activated:Fire();r.ChestAutoWorker=633;r.ChestBatchMenu.Options[1].Activated:Fire()
 assert(r.ChestAutoBatch==250 and not r.ChestBatchMenu.Menu.Visible,'an in-flight worker must lock an already-open batch selection')
 r.ChestAutoWorker=nil;r.ChestBatchButton.Activated:Fire();r.ChestBatchMenu.Options[1].Activated:Fire()
 assert(r.ChestAutoBatch=='Max' and string.find(r.ChestPlanLabel.Text,'adaptive 30–1000',1,true),'Max must explain its bounded growth in the read-only preview')
 r.ChestBatchButton.Activated:Fire();r.ChestRepeatButton.Activated:Fire()
 assert(not r.ChestBatchMenu.Menu.Visible and r.ChestRepeatMenu.Menu.Visible,'automatic batch choices must share exclusive dropdown cleanup')
 r.CloseMenus()
 r.ChestPreviewButton.Activated:Fire()
 if not r.ChestDetailsOpen then r.ChestPreviewButton.Activated:Fire() end
 assert(r.ChestLearnedButton.Visible and r.ChestWithdrawButton.Position.Y.Offset>=r.ChestLearnedButton.Position.Y.Offset+r.ChestLearnedButton.Size.Y.Offset,'the learned-slot shortcut must fit inside details above the manual actions')
 r.ChestPreviewButton.Activated:Fire()
 local targets,ready,withdraw=r.SelectedChestTargets,r.ChestRequestReady,r.WithdrawCarrots
 local chest={};local binding={Chest=chest,Slot=8,Amount=30};local calls=0
 r.SelectedChestTargets=function() return {{Binding=binding}} end
 r.ChestRequestReady=function() return true end
 r.WithdrawCarrots=function(_,_,selected) assert(selected==binding);calls+=1;if calls==1 then return false,{success=false,error='TOO_FAST'} end;return true end
 r.ChestRateDelay=nil
 local generation=r.ChestManualGeneration
 local co=coroutine.create(function() return r.WithdrawSelectedCarrots(generation) end)
 assert(coroutine.resume(co) and calls==1 and r.ChestCooldown,'manual TOO_FAST must enter a cooldown before retrying the same slot')
 for _=1,20 do if coroutine.status(co)=='dead' then break end;local ok,e=coroutine.resume(co);assert(ok,e) end
 assert(coroutine.status(co)=='dead' and calls==2 and not r.ChestCooldown and r.ChestRateDelay==.5,'manual withdrawal must retry once at its learned pace, rather than skipping the stack')
 r.SelectedChestTargets,r.ChestRequestReady,r.WithdrawCarrots=targets,ready,withdraw
 r.ChestRateDelay=nil;r.RefreshChestActions()
 end)()

;(function()
 local r=RemoteCatalog
 local targets,discover,whole,selection,items,item=r.ChestTargets,r.ChestDiscover,r.ChestWhole,r.ChestSelection,r.ChestItems,r.ChestItem
 local a,b={Name='chestMediumIndustrialIO'},{Name='chestMediumIndustrialIO'}
 local owner={}
 function owner:MakeChestTarget(binding,chest,slot) return {Chest=chest,Slot=slot,Item=binding.Item,Amount=binding.Amount} end
 r.ChestTargets=function() return {{Recorder=owner,Binding={Chest=a,Slot=3,Item='wood',Amount=30}},{Recorder=owner,Binding={Chest=b,Slot=8,Item='wood',Amount=30}},{Recorder=owner,Binding={Chest=a,Slot=1,Item='stone',Amount=30}}} end
 r.ChestDiscover=false;r.ChestWhole=true;r.ChestSelection={Chest=a,Slot=3};r.ChestItems={wood=true};r.ChestItem=nil
 local chosen=r.ChestItems
 r.ChestQuickButton.Activated:Fire()
 local selected=r.SelectedChestTargets()
 assert(r.ChestDiscover and not r.ChestWhole and not r.ChestSelection and r.ChestItems==chosen and #selected==2 and selected[1].Binding.Slot==3 and selected[2].Binding.Slot==8,'Fast slot setup must retain the item filter and select exact learned slots across matching chests')
 assert(not r.ChestAutoEnabled and not r.ChestAutoWorker and not r.ChestBusy and string.find(status.Text,'press START COLLECTING',1,true),'fast setup must explain the separate Start action without sending requests')
 local y=r.ChestQuickButton.Position.Y.Offset
 for _=1,3 do
  r.ChestProfilesButton.Activated:Fire()
  assert(r.ChestProfilesPanel.Visible and r.ChestQuickButton.Position.Y.Offset==r.ChestProfilesButton.Position.Y.Offset,'profile expansion must leave Fast slot setup beside its header')
  r.ChestProfilesButton.Activated:Fire()
  assert(r.ChestQuickButton.Position.Y.Offset==y,'profile cleanup must not move the quick action')
 end
 for _,flag in ipairs({'ChestAutoEnabled','ChestAutoWorker','ChestBusy'}) do
  r.ChestDiscover=false;r.ChestWhole=true;local selectedChest={Chest=a,Slot=3};r.ChestSelection=selectedChest
  r[flag]=flag=='ChestAutoWorker' and 640 or true
  r.RefreshChestActions();r.ChestQuickButton.Activated:Fire()
  assert(not r.ChestQuickButton.Active and not r.ChestDiscover and r.ChestWhole and r.ChestSelection==selectedChest,'busy/paused/cleanup workers must lock the quick preset without replacing their targets')
  if flag=='ChestAutoWorker' then r[flag]=nil else r[flag]=false end
 end
 r.ChestAutoWorker=nil;r.ChestAutoEnabled=false;r.ChestBusy=false
 r.ChestTargets,r.ChestDiscover,r.ChestWhole,r.ChestSelection,r.ChestItems,r.ChestItem=targets,discover,whole,selection,items,item
 r.ChestScopeButton.Text=discover and 'Scope: All matching' or 'Scope: Learned only';r.ChestWholeButton.Text=whole and 'Whole chest: ON' or 'Whole chest: OFF'
 r.UpdateChestSelectionUI()
 -- Ordinary accepted-request spacing and retry cooldowns need different labels.
 r.ChestCooldown='2.0s';r.ChestCooldownKind='pace';r.RefreshChestActions()
 assert(string.find(r.ChestIntro.Text,'Request pace',1,true),'normal request spacing must not claim another server error')
 r.ChestCooldownKind='retry';r.RefreshChestActions()
 assert(string.find(r.ChestIntro.Text,'Server cooldown',1,true),'an actual rejected request must retain its cooldown explanation')
 r.ChestCooldown=nil;r.ChestCooldownKind=nil;r.RefreshChestActions()
 -- Manual collection shares the recovery policy, including its footer labels.
 local selectedTargets,ready,withdraw=r.SelectedChestTargets,r.ChestRequestReady,r.WithdrawCarrots
 local c={};local calls=0
 r.SelectedChestTargets=function() return {{Binding={Chest=c}},{Binding={Chest=c}},{Binding={Chest=c}}} end
 r.ChestRequestReady=function() return true end
 r.WithdrawCarrots=function() calls+=1;return true end
 r.ChestRateDelay=4;r.ChestRateSuccesses=0;r.ChestRateAccepted=0;r.ChestRateFloor=nil;r.ChestRateCeiling=nil;r.ChestRequestAt=nil
 local originalWait,originalClock=task.wait,r.ChestClock
 local manualClock=0
 r.ChestClock=function() return manualClock end
 task.wait=function(dt) manualClock+=dt;return originalWait(dt) end
 local co=coroutine.create(function() return r.WithdrawSelectedCarrots(r.ChestManualGeneration) end)
 assert(coroutine.resume(co) and calls==1 and r.ChestCooldownKind=='pace','manual accepted-request spacing must use the normal pacing label')
 for _=1,200 do if coroutine.status(co)=='dead' then break end;local ok,e=coroutine.resume(co);assert(ok,e) end
 assert(coroutine.status(co)=='dead' and calls==3 and r.ChestRateDelay==3.2 and not r.ChestCooldown and not r.ChestCooldownKind,'three accepted manual responses must recover pacing and clean up the indicator')
 r.SelectedChestTargets,r.ChestRequestReady,r.WithdrawCarrots=selectedTargets,ready,withdraw
 task.wait=originalWait;r.ChestClock=originalClock;r.ChestRequestAt=nil
 r.ChestRateDelay=nil;r.ChestRateSuccesses=0;r.ChestRateAccepted=0;r.ChestRateFloor=nil;r.ChestRateCeiling=nil;r.RefreshChestActions()
 -- The recorded fixed batch stays selected, with totals visible during normal pacing.
 local batch,total=r.ChestAutoBatch,r.ChestAutoTotal
 r.ChestAutoBatch=30;r.ChestAutoTotal=60;r.ChestAutoEnabled=true;r.ChestAutoWorker=650
 r.ChestCooldown='2.0s';r.ChestCooldownKind='pace';r.RefreshChestActions()
 assert(r.ChestAutoBatch==30 and string.find(status.Text,'60 collected',1,true) and string.find(status.Text,'Request pace',1,true),'pacing must preserve a fixed thirty-item selection and show confirmed totals while waiting')
 r.ChestAutoEnabled=false;r.ChestAutoWorker=nil;r.ChestCooldown=nil;r.ChestCooldownKind=nil
 r.ChestAutoBatch=batch;r.ChestAutoTotal=total;r.RefreshChestActions()
 end)()

;(function()
 local r=RemoteCatalog
 assert(r.ChestOrder=='Same stack' and string.find(r.ChestOrderButton.Text,'Same stack',1,true),'scheduling must default to Same stack in the real UI')
 local y=r.ChestWithdrawButton.Position.Y.Offset
 for _=1,3 do
  r.ChestOrderButton.Activated:Fire()
  assert(r.ChestOrderMenu.Menu.Visible and r.ChestWithdrawButton.Position.Y.Offset>=r.ChestOrderMenu.Menu.Position.Y.Offset+r.ChestOrderMenu.Menu.Size.Y.Offset,'order dropdown must expand in flow above manual controls')
  r.ChestOrderButton.Activated:Fire()
  assert(r.ChestWithdrawButton.Position.Y.Offset==y,'order menu cleanup must restore the compact layout without drift')
 end
 r.ChestOrderButton.Activated:Fire();r.ChestOrderMenu.Options[2].Activated:Fire()
 assert(r.ChestOrder=='Balance chests' and not r.ChestAutoEnabled and not r.ChestAutoWorker and string.find(r.ChestPlanLabel.Text,'another chest a turn',1,true),'Balance selection must explain its behavior and never start a worker')
 r.ChestOrderButton.Activated:Fire();r.ChestRepeatButton.Activated:Fire()
 assert(not r.ChestOrderMenu.Menu.Visible and r.ChestRepeatMenu.Menu.Visible,'order choices must share exclusive dropdown cleanup')
 r.CloseMenus()
 r.ChestOrderButton.Activated:Fire();r.ChestAutoWorker=660;r.ChestOrderMenu.Options[1].Activated:Fire()
 assert(r.ChestOrder=='Balance chests' and not r.ChestOrderMenu.Menu.Visible,'an already-open scheduling choice must lock when a worker starts')
 r.ChestAutoEnabled=true;r.ChestAutoPaused=true;r.RefreshChestActions()
 assert(not r.ChestOrderButton.Active,'Pause must retain the order lock')
 r.ChestOrderButton.Activated:Fire();assert(not r.ChestOrderMenu.Menu.Visible)
 r.ChestAutoEnabled=false;r.ChestAutoPaused=false;r.ChestAutoWorker=nil;r.RefreshChestActions()
 r.ChestOrderButton.Activated:Fire();UserInputService.InputBegan:Fire({KeyCode=Enum.KeyCode.Escape},true)
 assert(not r.ChestOrderMenu.Menu.Visible and r.ChestWithdrawButton.Position.Y.Offset==y,'Escape must restore scheduling dropdown layout')
 r.ChestOrderButton.Activated:Fire();r.ChestOrderMenu.Options[1].Activated:Fire()
 r.UpdateChestSelectionUI()
 end)()

;(function()
 -- Exercise the actual manual loop at both paces and Stop during its pause.
 local r=RemoteCatalog
 local oldTargets,oldReady,oldWithdraw,oldSpeed=r.SelectedChestTargets,r.ChestRequestReady,r.WithdrawCarrots,r.ChestSpeed
 local c={}
 r.SelectedChestTargets=function() return {{Binding={Chest=c}},{Binding={Chest=c}},{Binding={Chest=c}}} end
 r.ChestRequestReady=function() return true end
 local calls=0
 r.WithdrawCarrots=function() calls+=1;return true end
 for _,fixture in ipairs({{'Standard',.25},{'Fast',.1}}) do
  r.ChestSpeed=fixture[1];calls=0
  r.ChestManualGeneration=(r.ChestManualGeneration or 0)+1
  local generation=r.ChestManualGeneration
  local co=coroutine.create(function() return r.WithdrawSelectedCarrots(generation) end)
  local ok,delay=coroutine.resume(co)
  assert(ok and delay==fixture[2] and calls==1,'manual batch pause must be .25s Standard or .1s Fast without overlapping requests')
  r.ChestSpeed=fixture[1]=='Standard' and 'Fast' or 'Standard'
  ok,delay=coroutine.resume(co)
  assert(ok and delay==fixture[2] and calls==2,'manual pace must remain frozen for the active run')
  r.ChestManualGeneration+=1
  assert(coroutine.resume(co) and coroutine.status(co)=='dead' and calls==2,'Stop in a short manual pause must suppress the next request')
 end
 r.SelectedChestTargets,r.ChestRequestReady,r.WithdrawCarrots,r.ChestSpeed=oldTargets,oldReady,oldWithdraw,oldSpeed
 r.UpdateChestSelectionUI()
 end)()

;(function()
 local r=RemoteCatalog
 assert(not r.CraftEnabled and not r.CraftWorker and r.CraftBatch==100 and r.CraftTarget==100,'craft startup must be OFF with batch/target 100')
 assert(r.CraftMode=='Make amount','craft default must make extra bait independently of stock')
 assert(#hub.Tabs==13 and r.CraftPage.Parent.Name~='Fishing','Crafting must be an independent tab')
 local oldRecorder=r.Recorder
 local bench={Parent=true}
 local learnedRecipes={CraftBinding={Item='bait',Remote={Parent=true},Workbench=bench},CraftBindings={testRecipe={Item='testRecipe',Workbench=bench}},CanUseCraftBinding=function() return true end,CraftItem=function() error('picker must never craft') end}
 r.Recorder=learnedRecipes
 r.CraftRecipeButton.Activated:Fire()
 assert(r.CraftRecipeMenu.Menu.Visible and #r.CraftRecipeMenu.Options==2,'recipe dropdown must discover learned recipe names dynamically')
 local previousOption=r.CraftRecipeMenu.Options[2]
 previousOption.Activated:Fire()
 assert(r.CraftItem=='testRecipe' and not r.CraftEnabled and not r.CraftRecipeMenu.Menu.Visible,'selecting another recipe must not start crafting')
 r.CraftRecipeButton.Activated:Fire()
 r.CraftRecipeMenu.Options[1].Activated:Fire()
 previousOption.Activated:Fire()
 assert(r.CraftItem=='bait','replaced dynamic menu options must disconnect their old callbacks')
 r.CraftModeButton.Activated:Fire();r.CraftModeMenu.Options[3].Activated:Fire()
 assert(r.CraftMode=='Continuous' and string.find(r.CraftInfo.Text,'until Stop',1,true),'Continuous choice must explain its stopping rule without starting a worker')
 r.CraftTargetButton.Activated:Fire();assert(not r.CraftTargetMenu.Menu.Visible and not r.CraftTargetButton.Active,'Continuous must disable its unused amount control')
 r.CraftModeButton.Activated:Fire();r.CraftModeMenu.Options[1].Activated:Fire()
 r.Recorder=oldRecorder

 assert(r.CraftHeading.Parent==r.CraftPage and r.LearnBaitButton.Parent~=r.CraftPage,'crafting must have its own page separate from bait-use learning')
 assert(r.CraftHeading.Position.Y.Offset+r.CraftHeading.Size.Y.Offset<r.CraftRecipeButton.Position.Y.Offset and r.CraftRecipeButton.Position.Y.Offset+r.CraftRecipeButton.Size.Y.Offset<r.CraftModeButton.Position.Y.Offset,'recipe and mode controls must be below the heading without overlap')
 local originalModeY=r.CraftLearnButton.Position.Y.Offset
 for _=1,3 do
  r.CraftModeButton.Activated:Fire()
  assert(r.CraftModeMenu.Menu.Visible and r.CraftLearnButton.Position.Y.Offset>originalModeY,'craft mode dropdown must expand without covering learning/start controls')
  r.CraftModeButton.Activated:Fire()
  assert(r.CraftLearnButton.Position.Y.Offset==originalModeY,'closing mode menu must restore its layout without drift')
 end
 local count=r.CarrotCount
 r.CarrotCount=function() return 3770 end
 r.CraftModeButton.Activated:Fire();r.CraftModeMenu.Options[2].Activated:Fire()
 assert(r.CraftMode=='Top up stock' and string.find(r.CraftInfo.Text,'Stock target already met',1,true) and not r.CraftWorker,'top-up selection must explain the 3770/100 case without sending')
 local copied
 setclipboard=function(value) copied=value end
 r.CraftDiagnosticButton.Activated:Fire()
 assert(copied==r.CraftDiagnosticReport() and string.find(copied,'Craft diagnostics',1,true) and string.find(copied,'Stock target already met',1,true),'dedicated button must copy the actual craft report')
 assert(not string.find(copied,'ptT2gra',1,true),'craft diagnostics must not dump learned request context')
 setclipboard=nil
 r.CraftModeButton.Activated:Fire();r.CraftModeMenu.Options[1].Activated:Fire()
 assert(string.find(r.CraftInfo.Text,'extra bait',1,true),'Make amount selection must explain that it makes extra bait')
 r.CarrotCount=count

 assert(string.find(r.ChestRangeButton.Text,'Walk range:',1,true),'range control must identify walking range')
 local y=r.CraftInfo.Position.Y.Offset
 r.CraftBatchButton.Activated:Fire()
 assert(r.CraftBatchMenu.Menu.Visible and r.CraftInfo.Position.Y.Offset>y,'craft dropdown must expand in flow')
 r.CraftBatchMenu.Options[1].Activated:Fire()
 assert(r.CraftBatch==25 and not r.CraftBatchMenu.Menu.Visible and r.CraftInfo.Position.Y.Offset==y,'craft batch selection must restore layout')
 r.CraftTargetButton.Activated:Fire();r.CraftTargetMenu.Options[2].Activated:Fire()
 assert(r.CraftTarget==250 and not r.CraftWorker,'choosing target must not start crafting')
 r.CraftWorker=67;r.CraftBatchButton.Activated:Fire()
 assert(not r.CraftBatchMenu.Menu.Visible,'active craft must lock dropdowns')
 r.CraftModeButton.Activated:Fire();assert(not r.CraftModeMenu.Menu.Visible,'active craft must lock mode dropdown')
 r.CraftRecipeButton.Activated:Fire();assert(not r.CraftRecipeMenu.Menu.Visible,'active craft must lock recipe dropdown')
 r.CraftWorker=nil
 local start,recorder=r.StartCapture,r.Recorder
 local learned={Active=false,LearnBaitOnly=true,Stop=function(self) self.Stopped=true end}
 r.StartCapture=function() return learned end
 r.CraftLearnButton.Activated:Fire()
 assert(learned.LearnCraftOnly and not learned.Active and not r.CraftEnabled,'learn must listen without starting craft')
 r.StopBaitLearning();assert(learned.LearnCraftOnly and not learned.Stopped,'stopping bait learner must preserve craft learner')
 r.StopAllAutomation();assert(not learned.LearnCraftOnly and learned.Stopped and not r.CraftEnabled,'Stop All must cancel craft learning')
 r.StartCapture,r.Recorder=start,recorder
 r.CraftEnabled=true;r.CraftWorker=67;r.RefreshCraftUI()
 r.CraftToggle.Activated:Fire()
 assert(not r.CraftEnabled and r.CraftWorker==67 and string.find(r.CraftToggle.Text,'FINISHING',1,true),'Stop must show outstanding request cleanup')
 r.CraftWorker=nil;r.RefreshCraftUI()
 r.ChestAutoEnabled=true;r.ChestAutoWorker=67;r.ChestReachWaiting=true;r.ChestAutoTotal=0;r.RefreshChestActions()
 assert(string.find(r.ChestIntro.Text,'within 20 studs',1,true),'range pause must explain Stay reach in the real UI')
 r.SetChestAuto(false);assert(not r.ChestReachWaiting,'Stop clears deferred reach status')
 r.ChestAutoWorker=nil;r.RefreshChestActions()
 end)()

;(function()
 local r=RemoteCatalog
 local start,recorder=r.StartCapture,r.Recorder
 local fake={Stopped=false,Active=false,CanUseCraftBinding=function() return true end,Stop=function(self) self.Stopped=true;self.LearnCraftOnly=false end}
 r.StartCapture=function() return fake end
 assert(r.BeginCraftLearning() and r.CraftLearning and fake.LearnCraftOnly)
 fake.CraftBinding={Item='testRecipe',Workbench={Parent=true},Remote={Parent=true}}
 fake.LearnCraftOnly=false;fake.Stopped=true
 r.RefreshCraftUI()
 assert(r.CraftItem=='testRecipe' and not r.CraftLearning and string.find(r.CraftInfo.Text,'Learned recipe: testRecipe',1,true) and not r.CraftEnabled,'completed learning must select the new recipe and explain Start without crafting automatically')
 r.StopCraftLearning();r.StartCapture,r.Recorder=start,recorder;r.CraftItem='bait';r.RefreshCraftUI()
 end)()

;(function()
 local r=RemoteCatalog
 assert(r.ChestIncludeConveyor,'legacy fixtures explicitly opted into I/O')
 r.ChestConveyorButton.Activated:Fire();assert(not r.ChestIncludeConveyor and string.find(r.ChestConveyorButton.Text,'Skip',1,true), 'idle protection toggle must switch from Include to Skip')
 local targets=r.ChestTargets
 local io={Name='chestMediumIndustrialIO'}
 local ordinary={Name='chestSmall'}
 local owner={CanUseChestBinding=function() return true end}
 local block={Recorder=owner,Binding={Chest=io,Slot=1,Amount=30,Item='carrotHarvested'}}
 local regular={Recorder=owner,Binding={Chest=ordinary,Slot=1,Amount=30,Item='carrotHarvested'}}
 r.ChestTargets=function() return {block,regular} end
 local selection,items,item,whole=r.ChestSelection,r.ChestItems,r.ChestItem,r.ChestWhole
 r.ChestSelection=nil;r.ChestItems=nil;r.ChestItem=nil;r.ChestWhole=false
 assert(#r.SelectedChestTargets()==1 and r.SelectedChestTargets()[1]==regular,'real target selection must skip I/O for both Auto and manual hub actions')
 local ready,reason=r.ChestRequestReady(block.Binding)
 assert(not ready and string.find(reason,'Conveyor I/O chest skipped',1,true),'final withdrawal preflight must reject protected I/O before checking reach or sending')
 local text=r.PreviewChestSelection()
 assert(string.find(text,'1 selected chests protected',1,true),'plan must show protected chest count')
 r.ChestSelection={Chest=io,Slot=1}
 assert(#r.SelectedChestTargets()==0 and string.find(r.PreviewChestSelection(),'No eligible targets',1,true),'all-protected selection needs an actionable empty plan')
 assert(not r.SetChestAuto(true) and not r.ChestAutoWorker,'all-protected selection must not start a worker')
 r.ChestAutoEnabled=true;r.ChestAutoPaused=true;r.ChestAutoWorker=70;r.RefreshChestActions()
 assert(not r.ChestConveyorButton.Active,'paused collection must keep conveyor selection locked')
 r.ChestConveyorButton.Activated:Fire();assert(not r.ChestIncludeConveyor,'handler must retain protection even if fired while locked')
 r.SetChestAuto(false);r.ChestConveyorButton.Activated:Fire();assert(not r.ChestIncludeConveyor,'cleanup must lock the protection toggle')
 r.ChestAutoWorker=nil;r.RefreshChestActions()
 r.ChestConveyorButton.Activated:Fire();assert(r.ChestIncludeConveyor and #r.SelectedChestTargets()==1,'explicit Include must restore I/O selection without starting a worker')
 r.ChestConveyorButton.Activated:Fire()
 r.ChestSelection,r.ChestItems,r.ChestItem,r.ChestWhole=selection,items,item,whole
 r.ChestTargets=targets
 local profileY=r.ChestProfilesButton.Position.Y.Offset
 assert(r.ChestConveyorButton.Position.Y.Offset+r.ChestConveyorButton.Size.Y.Offset<=profileY,'protection control must sit above profiles without overlap')
 local itemY=r.ChestItemButton.Position.Y.Offset
 for _=1,3 do r.ChestProfilesButton.Activated:Fire();r.ChestProfilesButton.Activated:Fire() end
 assert(r.ChestProfilesButton.Position.Y.Offset==profileY and r.ChestItemButton.Position.Y.Offset==itemY,'profile expansion must preserve the new protection row without drift')
 end)()

;(function()
 local r=RemoteCatalog
 local lookup,count,reach=r.CraftRecorder,r.CarrotCount,r.CraftReachable
 local item,mode,batch,target=r.CraftItem,r.CraftMode,r.CraftBatch,r.CraftTarget
 local stock,trace={},{}
 local bindings={bait={Item='bait',Workbench={}},testRecipe={Item='testRecipe',Workbench={}}}
 local recorder={CanUseCraftBinding=function() return true end,CraftItem=function(_,amount,binding) table.insert(trace,binding.Item);stock[binding.Item]=(stock[binding.Item] or 0)+amount;return true end}
 r.CraftRecorder=function(name) return recorder,bindings[name or r.CraftItem] end
 r.CarrotCount=function(name) return stock[name] or 0 end;r.CraftReachable=function() return true end
 r.CraftQueue={};r.CraftItem='bait';r.CraftMode='Make amount';r.CraftBatch=100;r.CraftTarget=100
 r.CraftQueueAddButton.Activated:Fire()
 r.CraftItem='testRecipe';r.CraftQueueAddButton.Activated:Fire()
 assert(#r.CraftQueue==2 and #trace==0 and string.find(r.CraftQueueLabel.Text,'testRecipe',1,true),'real Add to queue controls must describe both recipes without crafting')
 r.CraftMode='Continuous';r.RefreshCraftUI()
 assert(not r.CraftQueueAddButton.Active,'Continuous must disable Add to queue')
 r.CraftQueueAddButton.Activated:Fire();assert(#r.CraftQueue==2,'handler must reject infinite jobs even if fired on an inactive button')
 r.CraftMode='Make amount';r.RefreshCraftUI()
 local y=r.CraftQueueAddButton.Position.Y.Offset
 r.CraftModeButton.Activated:Fire();assert(r.CraftQueueAddButton.Position.Y.Offset>y,'inline mode menu must push queue controls down')
 r.CraftModeButton.Activated:Fire();assert(r.CraftQueueAddButton.Position.Y.Offset==y,'closing dropdown must restore queue layout')
 r.CraftQueueRunButton.Activated:Fire()
 assert(r.CraftQueueRunning and r.CraftQueueDone==1 and #trace==1 and trace[1]=='bait' and r.CraftQueueRunButton.Text=='STOP QUEUE','Run Queue must execute the first job with one worker and expose Stop')
 assert(not r.CraftQueueAddButton.Active and not r.CraftQueueClearButton.Active,'active queue must lock editing')
 r.CraftQueueClearButton.Activated:Fire();assert(#r.CraftQueue==2,'Clear handler must not mutate the active queue')
 local report=r.CraftDiagnosticReport()
 assert(string.find(report,'Queue: 2 jobs; 1 finished',1,true),'copy diagnostics must expose actual queue progress')
 stopAllButton.Activated:Fire();stepWorkers()
 assert(not r.CraftWorker and not r.CraftQueueRunning and #trace==1 and #r.CraftQueue==2,'Stop All must cancel the remaining jobs while keeping the configured queue')
 r.CraftQueueRunButton.Activated:Fire();assert(#trace==2)
 r.CraftQueueRunButton.Activated:Fire();stepWorkers()
 assert(not r.CraftQueueRunning and not r.CraftWorker and #trace==2,'real Stop Queue button must prevent the next recipe')
 local presetY=r.CraftPresetSlotButton.Position.Y.Offset
 r.CraftQueueJobButton.Activated:Fire()
 assert(r.CraftQueueJobMenu.Menu.Visible and #r.CraftQueueJobMenu.Options==2 and r.CraftPresetSlotButton.Position.Y.Offset>presetY,'job picker must list queue entries and push presets down')
 r.CraftQueueJobMenu.Options[1].Activated:Fire()
 assert(r.CraftQueueSelected==1 and r.CraftItem=='bait' and r.CraftPresetSlotButton.Position.Y.Offset==presetY,'selecting a job must load its settings and restore the layout')
 r.CraftTargetMenu:Open();r.CraftTargetMenu.Options[2].Activated:Fire()
 assert(r.CraftTarget==250 and r.CraftQueue[1].Target==100,'amount dropdown must stage an edit without changing the queued job')
 r.CraftQueueApplyButton.Activated:Fire()
 assert(r.CraftQueue[1].Target==250 and #trace==2,'real Apply must update a descriptor without sending requests')
 r.CraftQueueDownButton.Activated:Fire()
 assert(r.CraftQueueSelected==2 and r.CraftQueue[2].Item=='bait' and not r.CraftQueueDownButton.Active,'Move down must track the selected job and disable at the boundary')
 r.CraftQueueUpButton.Activated:Fire()
 assert(r.CraftQueueSelected==1 and r.CraftQueue[1].Item=='bait' and not r.CraftQueueUpButton.Active)
 assert(r.CraftQueueEditHint.Position.Y.Offset+r.CraftQueueEditHint.Size.Y.Offset<=r.CraftPresetSlotButton.Position.Y.Offset,'queue editing controls must fit above presets')
 r.CraftQueueRemoveButton.Activated:Fire();assert(#r.CraftQueue==1 and r.CraftQueue[1].Item=='testRecipe')
 r.CraftQueueClearButton.Activated:Fire();assert(#r.CraftQueue==0 and string.find(r.CraftQueueLabel.Text,'0 / 8',1,true))
 r.CraftRecorder,r.CarrotCount,r.CraftReachable=lookup,count,reach
 r.CraftItem,r.CraftMode,r.CraftBatch,r.CraftTarget=item,mode,batch,target;r.RefreshCraftUI()
 end)()

;(function()
 local r=RemoteCatalog
 local cache,catalog,status,item,materials=r.ModuleCache,r.CraftCatalog,r.CraftCatalogStatus,r.CraftItem,r.CraftMaterials
 r.ModuleCache={['ReplicatedStorage.TS.crafting-recipes']={Recipes={catalogRecipe={toolName='catalogRecipe',outputAmount=1,ingredients={worm=2}}}}}
 r.CraftCatalogButton.Activated:Fire()
 assert(r.CraftCatalog.catalogRecipe and not r.CraftWorker,'Load all recipes must populate the visible catalog without crafting')
 r.CraftRecipeSearch.Text='CATALOG_recipe'
 r.CraftRecipeButton.Activated:Fire()
 assert(#r.CraftRecipeMenu.Options==1 and string.find(r.CraftRecipeMenu.Options[1].Text,'catalogRecipe',1,true),'recipe search must filter loaded catalog entries in the real dropdown')
 r.CraftRecipeMenu.Options[1].Activated:Fire()
 assert(r.CraftItem=='catalogRecipe' and not r.CraftWorker,'catalog selection must not start crafting or queue work')
 assert(r.CraftMaterials.catalogRecipe and string.find(r.CraftMaterialsLabel.Text,'worm',1,true),'real recipe selection must show discovered ingredient metadata')
 local job=r.MakeCraftJob('catalogRecipe','Make amount',100,100,false)
 assert(not job,'a displayed recipe must not fabricate a learned craft request')
 r.CraftWorker=72;r.CraftEnabled=true;r.RefreshCraftUI()
 r.CraftPauseButton.Activated:Fire()
 assert(r.CraftPaused and r.CraftPauseButton.Text=='RESUME CRAFTING' and not r.CraftCatalogButton.Active and not r.CraftRecipeSearch.TextEditable,'Pause must lock the catalog/search and expose Resume')
 r.CraftPauseButton.Activated:Fire();assert(not r.CraftPaused)
 r.SetCraftEnabled(false);r.CraftWorker=nil;r.RefreshCraftUI()
 r.ModuleCache,r.CraftCatalog,r.CraftCatalogStatus,r.CraftItem,r.CraftMaterials=cache,catalog,status,item,materials;r.CraftRecipeSearch.Text='';r.RefreshCraftCatalogUI()
 assert(r.CraftRecipeSearch.Position.Y.Offset+r.CraftRecipeSearch.Size.Y.Offset<=r.CraftCatalogLabel.Position.Y.Offset and r.CraftCatalogLabel.Position.Y.Offset+r.CraftCatalogLabel.Size.Y.Offset<=r.CraftRecipeButton.Position.Y.Offset,'catalog search/status must not overlap recipe selection')
 end)()
;(function()
 local r=RemoteCatalog
 local materials,item,mode,target,count=r.CraftMaterials,r.CraftItem,r.CraftMode,r.CraftTarget,r.CarrotCount
 local stock={bait=3770,worm=20}
 r.CraftMaterials={bait={OutputAmount=1,Ingredients={{Item='worm',Amount=2}}}}
 r.CraftItem='bait';r.CraftMode='Make amount';r.CraftTarget=100
 r.CarrotCount=function(name) return stock[name] or 0 end
 r.CraftMaterialsRefresh.Activated:Fire()
 assert(string.find(r.CraftMaterialsLabel.Text,'worm · need 200 · have 20 · missing 180',1,true) and not r.CraftWorker,'Refresh materials must calculate costs without crafting')
 stock.worm=30;updateBoard()
 assert(string.find(r.CraftMaterialsLabel.Text,'have 30 · missing 170',1,true),'periodic board updates must keep material quantities fresh')
 local copy=setclipboard
 local report
 setclipboard=function(value) report=value end
 r.CraftMaterialsCopy.Activated:Fire()
 assert(report and string.find(report,'Reborn mob-survive-113 · Materials',1,true) and string.find(report,'missing 170',1,true),'Copy materials must use current quantities')
 setclipboard=function() error('unavailable') end
 r.CraftMaterialsCopy.Activated:Fire()
 assert(string.find(status.Text,'printed to the console',1,true),'materials copy must provide a console fallback')
 setclipboard=copy
 assert(r.CraftMaterialsRefresh.Position.Y.Offset+r.CraftMaterialsRefresh.Size.Y.Offset<=r.CraftMaterialsView.Position.Y.Offset and r.CraftMaterialsView.Position.Y.Offset+r.CraftMaterialsView.Size.Y.Offset<r.CraftQueueAddButton.Position.Y.Offset,'materials controls and queue must not overlap')
 local y=r.CraftMaterialsView.Position.Y.Offset
 r.CraftModeButton.Activated:Fire();assert(r.CraftMaterialsView.Position.Y.Offset>y,'inline dropdowns must push the material panel down')
 r.CloseMenus();assert(r.CraftMaterialsView.Position.Y.Offset==y,'closing dropdowns must restore material layout')
 r.CraftMaterials,r.CraftItem,r.CraftMode,r.CraftTarget,r.CarrotCount=materials,item,mode,target,count;r.RefreshCraftUI()
 end)()
;(function()
 local r=RemoteCatalog
 local fields={'CraftQueue','CraftQueueSelected','CraftMaterials','CraftItem','CraftMode','CraftBatch','CraftTarget','CarrotCount'}
 local old={};for _,field in ipairs(fields) do old[field]=r[field] end
 local stock={bait=0,worm=150}
 r.CarrotCount=function(name) return stock[name] or 0 end
 r.CraftMaterials={bait={OutputAmount=1,Ingredients={{Item='worm',Amount=2}}}}
 r.CraftQueue={{Item='bait',Mode='Make amount',Target=100,Batch=100},{Item='bait',Mode='Make amount',Target=100,Batch=100}}
 assert(r.CraftMaterialsScope=='Selected recipe','new material panel must preserve the old default')
 local base=r.CraftMaterialsRefresh.Position.Y.Offset
 r.CraftMaterialsScopeButton.Activated:Fire()
 assert(r.CraftMaterialsScopeMenu.Menu.Visible and r.CraftMaterialsRefresh.Position.Y.Offset>base,'scope dropdown must push material controls down')
 r.CraftMaterialsScopeMenu.Options[2].Activated:Fire()
 assert(r.CraftMaterialsScope=='Whole queue' and r.CraftMaterialsRefresh.Position.Y.Offset==base and not r.CraftWorker,'selecting Whole queue must restore layout without starting crafting')
 assert(string.find(r.CraftMaterialsLabel.Text,'worm · use 400 · have 150 · queue output 0 · missing in order 250',1,true),'actual scope selector must show combined shortages')
 stock.worm=200;updateBoard()
 assert(string.find(r.CraftMaterialsLabel.Text,'missing in order 200',1,true),'periodic refresh must use new inventory quantities')
 local copy,report=setclipboard,nil
 setclipboard=function(text) report=text end;r.CraftMaterialsCopy.Activated:Fire()
 assert(report and string.find(report,'WHOLE QUEUE',1,true) and string.find(report,'missing in order 200',1,true),'Copy materials must follow the visible scope')
 setclipboard=function() error('clipboard unavailable') end;r.CraftMaterialsCopy.Activated:Fire()
 assert(string.find(status.Text,'printed to the console',1,true),'whole-queue copy must support the console fallback');setclipboard=copy
 assert(r.SelectCraftQueueJob(1));r.CraftTarget=250;r.CraftQueueApplyButton.Activated:Fire()
 assert(string.find(r.CraftMaterialsLabel.Text,'worm · use 700',1,true),'Apply must refresh whole-queue materials immediately')
 r.CraftWorker=80;r.CraftEnabled=true;r.RefreshCraftMaterials()
 assert(string.find(r.CraftMaterialsLabel.Text,'Crafting active or finishing',1,true) and not string.find(r.CraftMaterialsLabel.Text,'Estimated 2 / 2',1,true),'active queue scope must not mislabel a next-run plan as remaining work')
 r.CraftEnabled=false;r.CraftWorker=nil;r.CraftQueueClearButton.Activated:Fire()
 assert(string.find(r.CraftMaterialsLabel.Text,'Queue empty',1,true),'Clear must immediately remove stale combined totals')
 assert(string.find(r.CraftDiagnosticReport(),'WHOLE QUEUE',1,true),'craft diagnostics must include queue materials')
 assert(r.CraftMaterialsScopeButton.Position.Y.Offset+r.CraftMaterialsScopeButton.Size.Y.Offset<=base and r.CraftMaterialsView.Position.Y.Offset+r.CraftMaterialsView.Size.Y.Offset<r.CraftQueueAddButton.Position.Y.Offset,'scope/material controls must fit above the queue')
 for _=1,3 do r.CraftMaterialsScopeButton.Activated:Fire();r.CloseMenus() end
 assert(r.CraftMaterialsRefresh.Position.Y.Offset==base,'repeated scope expansion must not drift')
 r.CraftMaterialsScopeMenu:Open();r.CraftMaterialsScopeMenu.Options[1].Activated:Fire()
 for _,field in ipairs(fields) do r[field]=old[field] end;r.RefreshCraftUI()
 end)()

;(function()
 local r=RemoteCatalog
 local owned,count,clock=r.OwnedTools,r.BaitCount,r.PropellerNow
 local fishing=enabled
 local quantity,time=5,100
 local propeller={Name='propeller',Parent={}}
 r.OwnedTools=function() return {propeller} end;r.BaitCount=function() return quantity end;r.PropellerNow=function() return time end
 r.ResetPropellers();enabled=true
 r.BeginPropellerCatch(3);quantity=6;r.ConfirmPropellerCatch();updateBoard()
 assert(r.PropellerTotal==1 and overlayValues.propellers.Text=='1' and string.find(r.PropellerLabel.Text,'this session: 1',1,true),'real fishing panel and overlay must show the observed propeller count')
 time=175;updateBoard()
 assert(overlayValues.propellerLast.Text=='00:01:15 ago' and string.find(r.SessionReport(),'Propellers: 1',1,true),'timer and copied report must include the last propeller')
 r.BeginPropellerCatch(3);r.ConfirmPropellerCatch();r.BeginPropellerCatch(3)
 local requestAt=r.ChestRequestAt;r.MarkChestRequest();quantity=7;r.ConfirmPropellerCatch()
 assert(r.PropellerTotal==1,'a hub withdrawal must invalidate fishing attribution even if it finishes between tracker polls')
 assert(r.PropellerPendingWindow and r.PropellerPendingWindow.Blocked,'a hub request must also invalidate the previous confirmed catch window')
 local originalCopy=setclipboard
 local trackerReport
 setclipboard=function(value) trackerReport=value end
 r.PropellerCopyButton.Activated:Fire()
 assert(trackerReport and string.find(trackerReport,'Propeller tracker',1,true) and string.find(trackerReport,'Window blocked: true',1,true),'Copy tracker result must use the current attribution state')
 setclipboard=function() error('clipboard unavailable') end
 r.PropellerCopyButton.Activated:Fire()
 assert(string.find(status.Text,'printed to the console',1,true),'tracker diagnostics must provide a console fallback when clipboard access fails')
 setclipboard=originalCopy
 r.ChestRequestAt=requestAt
 r.PropellerResetButton.Activated:Fire();assert(r.PropellerTotal==0 and r.PropellerLastText()=='none yet')
 enabled=fishing;r.OwnedTools,r.BaitCount,r.PropellerNow=owned,count,clock;updateBoard()
 assert(r.PropellerLabel.Parent==fishingPage and r.PropellerResetButton.Position.Y.Offset>=r.PropellerInfo.Position.Y.Offset+r.PropellerInfo.Size.Y.Offset,'propeller tracking must live under Fishing with non-overlapping controls')
 end)()

;(function()
 local r=RemoteCatalog
 local fields={'ChestTargets','ChestSelection','ChestWhole','ChestDiscover','ChestIncludeConveyor','ChestExcludedChests','ChestItems','ChestItem','ChestGoal','ChestAutoBatch','ChestRepeat','ChestStockTarget','ChestProfiles','ChestProfileSlot','ChestSpeed','ChestTravel','ChestScanRange','ChestOrder','OwnedTools','BaitCount'}
 local old={};for _,field in ipairs(fields) do old[field]=r[field] end
 local function pos(x) return setmetatable({X=x,Y=0,Z=0},{__sub=function(a,b) return {Magnitude=math.abs(a.X-b.X)} end}) end
 local oldFind,oldCharacter=workspace.FindFirstChild,player.Character
 local island={Name='7-island',FindFirstChild=function() return nil end}
 workspace.FindFirstChild=function(_,name) return name=='Islands' and {FindFirstChild=function(_,key) return key=='7-island' and island end} end
 player.Character={FindFirstChild=function(_,name) return name=='HumanoidRootPart' and {Position=pos(0)} end,FindFirstChildOfClass=function() return nil end}
 local a={Name='chestSmall',Parent=island,Position=pos(3),IsA=function(_,class) return class=='BasePart' end}
 local b={Name=a.Name,Parent=island,Position=pos(5),IsA=a.IsA}
 local trace,quantity={},0
 local owner={CanUseChestBinding=function() return true end,WithdrawItems=function(_,amount,binding) table.insert(trace,binding.Chest);quantity+=amount;return true end}
 local ba={Chest=a,Slot=1,Item='potatoSalad',Amount=30}
 local bb={Chest=b,Slot=1,Item='potatoSalad',Amount=30}
 local entries={{Recorder=owner,Binding=ba},{Recorder=owner,Binding=bb}}
 r.ChestTargets=function() return entries end
 r.OwnedTools=function() return {{Name='potatoSalad'}} end;r.BaitCount=function() return quantity end
 r.ChestWhole=false;r.ChestDiscover=false;r.ChestIncludeConveyor=true;r.ChestExcludedChests={};r.ChestItems=nil;r.ChestItem=nil;r.ChestSelection=nil
 r.ChestGoal=30;r.ChestAutoBatch=30;r.ChestRepeat=false;r.ChestStockTarget=nil
 r.UpdateChestSelectionUI()
 assert(not r.ChestExclusionButton.Active,'all-target mode must require an individual chest before exclusion')
 for _,control in pairs(r.ChestPriorityButtons) do assert(not control.Active,'all-target mode must disable every individual chest priority') end
 r.ChestSelectButton.Activated:Fire()
 local option
 for _,child in ipairs(r.ChestSelectMenu:GetChildren()[1]:GetChildren()) do if child:IsA('TextButton') and string.find(child.Text,'Chest #1',1,true) then option=child;break end end
 assert(option,'real chest selector must offer the first physical chest');option.Activated:Fire()
 assert(r.ChestSelection.Chest==a and r.ChestExclusionButton.Active,'selecting a physical chest must enable its protection control: selected='..tostring(r.ChestSelection.Chest==a)..' active='..tostring(r.ChestExclusionButton.Active)..' auto='..tostring(r.ChestAutoEnabled)..' worker='..tostring(r.ChestAutoWorker)..' busy='..tostring(r.ChestBusy)..' manual='..tostring(r.ChestManualRunning))
 r.ChestExclusionButton.Activated:Fire()
 assert(r.ChestIsExcluded(ba) and not r.ChestIsExcluded(bb) and #trace==0 and r.ChestExclusionButton.Text=='Allow selected chest','the real exclude button must protect one instance without a request')
 assert(string.find(r.ChestSelectButton.Text,'EXCLUDED',1,true) and string.find(r.PreviewChestSelection(),'Explicit exclusions: 1',1,true),'selector and preview must identify excluded chests')
 r.ChestAutoButton.Activated:Fire()
 assert(not r.ChestAutoWorker and #trace==0,'Auto Take must not start on an excluded-only selection')
 r.ChestWithdrawButton.Activated:Fire();stepWorkers()
 assert(#trace==0 and not r.ChestBusy,'manual withdrawal must not send from an excluded selection')
 r.ChestQuickButton.Activated:Fire()
 assert(r.ChestIsExcluded(ba) and r.ChestSelection==nil,'Fast slot setup must retain existing exclusions')
 r.ChestProfiles={[1]={Version=1,Name='Exclusion preservation',ItemMode='All',Items={},Discover=true,Whole=false,Speed='Standard',Travel='Stay',Range=120,Goal=0,AutoBatch=30,Order='Same stack'}};r.ChestProfileSlot=1
 assert(r.LoadChestProfile() and r.ChestIsExcluded(ba) and not r.ChestAutoEnabled and #trace==0,'loading a saved profile must preserve physical exclusions and keep collection OFF')
 r.ChestGoal=30
 r.ChestAutoButton.Activated:Fire();stepWorkers()
 assert(#trace==1 and trace[1]==b and r.ChestAutoTotal==30,'All matching must collect an allowed neighbor while keeping the excluded chest untouched')
 for _,field in ipairs({'ChestAutoEnabled','ChestAutoWorker','ChestBusy','ChestManualRunning'}) do
  local original=r[field];r[field]=true;r.RefreshChestActions();r.ChestSelection={Chest=a,Slot=1};r.ChestExclusionButton.Activated:Fire()
  assert(r.ChestIsExcluded(ba) and not r.ChestExclusionButton.Active,'active/manual/cleanup locks must reject even direct exclusion-button events')
  r[field]=original
 end
 r.ChestSelection={Chest=a,Slot=1};r.UpdateChestSelectionUI();r.ChestExclusionButton.Activated:Fire()
 assert(not r.ChestIsExcluded(ba) and #trace==1 and not r.ChestAutoEnabled,'Allow must restore eligibility without starting collection')
 r.ChestPriorityButtons[1].Activated:Fire();assert(r.ChestPriorities[a]==1 and string.find(r.ChestPriorityButtons[1].Text,'✓',1,true) and #trace==1,'priority button must assign First without dispatch')
 r.ChestPriorityButtons[1].Activated:Fire();assert(r.ChestPriorities[a]==1,'choosing First twice must stay First instead of cycling')
 r.ChestPriorityButtons[-1].Activated:Fire();assert(r.ChestPriorities[a]==-1 and string.find(r.ChestPriorityButtons[-1].Text,'✓',1,true))
 assert(not string.find(r.ChestPriorityButtons[1].Text,'✓',1,true) and not string.find(r.ChestPriorityButtons[0].Text,'✓',1,true),'only the chosen priority must be marked')
 for _,control in pairs(r.ChestPriorityButtons) do assert(control.Position.Y.Offset==122 and control.Position.Y.Offset+control.Size.Y.Offset<=r.ChestExclusionPanel.Size.Y.Offset,'direct priority choices must fit the existing panel row') end
 r.ChestAutoWorker=true;r.RefreshChestActions();r.ChestPriorityButtons[1].Activated:Fire()
 assert(not r.ChestPriorityButtons[1].Active and r.ChestPriorities[a]==-1,'in-flight cleanup must lock priority callbacks')
 r.ChestAutoWorker=nil;r.RefreshChestActions();r.ChestPriorityButtons[0].Activated:Fire();assert(r.ChestPriorities[a]==nil)
 assert(r.ChestPriorityButtons[0].Position.Y.Offset+r.ChestPriorityButtons[0].Size.Y.Offset<=r.ChestExclusionPanel.Size.Y.Offset,'priority button must fit inside its panel')
 assert(r.ChestExclusionPanel.Position.Y.Offset>=r.ChestSelectButton.Position.Y.Offset+r.ChestSelectButton.Size.Y.Offset and r.ChestScopeButton.Position.Y.Offset>=r.ChestExclusionPanel.Position.Y.Offset+r.ChestExclusionPanel.Size.Y.Offset,'protection must fit between chest selection and scope controls')
 local y=r.ChestExclusionPanel.Position.Y.Offset
 r.ChestSelectButton.Activated:Fire()
 assert(r.ChestExclusionPanel.Position.Y.Offset>=r.ChestSelectMenu.Position.Y.Offset+r.ChestSelectMenu.Size.Y.Offset,'open chest selector must push protection below its options')
 r.CloseMenus();assert(r.ChestExclusionPanel.Position.Y.Offset==y,'closing selector must restore protection layout without drift')
 for _,field in ipairs(fields) do r[field]=old[field] end
 workspace.FindFirstChild,player.Character=oldFind,oldCharacter;r.UpdateChestSelectionUI()
 end)()

;(function()
 local r=RemoteCatalog
 local fields={'CraftQueue','CraftPresets','CraftPresetPersistence','CraftPresetSlot','CraftPresetFileState'}
 local old={};for _,field in ipairs(fields) do old[field]=r[field] end
 local name=r.CraftPresetName.Text
 local oldWrite,oldRead=writefile,readfile
 local encode,decode=HttpService.JSONEncode,HttpService.JSONDecode
 local data,encoded,writes=nil,nil,0
 HttpService.JSONEncode=function(_,value) data=value;return 'craft-presets-json' end
 HttpService.JSONDecode=function(_,text) assert(text=='craft-presets-json');return data end
 writefile=function(path,text) assert(path=='RebornCraftQueues_7.json');encoded=text;writes+=1 end
 readfile=function(path) assert(path=='RebornCraftQueues_7.json');return encoded end
 r.CraftPresetSlot=1;r.CraftPresets={};r.CraftPresetPersistence={}
 r.CraftQueue={{Item='bait',Mode='Make amount',Batch=100,Target=100},{Item='unlearnedRecipe',Mode='Top up stock',Batch=25,Target=250}}
 r.CraftPresetName.Text='Materials route';r.RefreshCraftQueue()
 r.CraftPresetSaveButton.Activated:Fire()
 assert(writes==1 and r.CraftPresets[1].Name=='Materials route' and not r.CraftWorker,'real Save must persist the configured queue without running it')
 r.CraftQueueClearButton.Activated:Fire()
 assert(#r.CraftQueue==0 and #r.CraftPresets[1].Jobs==2,'clearing the working queue must retain the stored preset')
 r.CraftPresetLoadButton.Activated:Fire()
 assert(#r.CraftQueue==2 and r.CraftQueue[2].Item=='unlearnedRecipe' and not r.CraftEnabled and not r.CraftWorker,'real Load must restore descriptors while keeping crafting OFF')
 r.CraftPresetSlotButton.Activated:Fire()
 assert(r.CraftPresetSlot==2 and not r.CraftPresetLoadButton.Active and r.CraftPresetName.Text=='Craft queue 2','slot cycle must show an empty preset clearly')
 r.CraftPresetName.Text='Second route';r.CraftPresetSaveButton.Activated:Fire()
 assert(writes==2 and data.Presets['1'] and data.Presets['2'],'saving a second real UI slot must keep the first')
 for _,field in ipairs({'CraftWorker','CraftEnabled','CraftLearning','CraftPresetBusy','CraftCatalogLoading'}) do
  local previous=r[field];r[field]=true;r.RefreshCraftQueue();local slot=r.CraftPresetSlot;local queue=r.CraftQueue
  r.CraftPresetSlotButton.Activated:Fire();r.CraftPresetSaveButton.Activated:Fire();r.CraftPresetLoadButton.Activated:Fire()
  assert(r.CraftPresetSlot==slot and r.CraftQueue==queue and writes==2 and not r.CraftPresetSaveButton.Active and not r.CraftPresetName.TextEditable,'preset UI callbacks must enforce running/paused/cleanup/learning/file locks')
  r[field]=previous
 end
 r.CraftPresets={};r.CraftPresetPersistence={};local queue=r.CraftQueue
 assert(r.ReadCraftPresets() and r.CraftQueue==queue and r.CraftPresets[1].Name=='Materials route' and not r.CraftEnabled,'file restore must populate slots without applying a queue')
 assert(r.CraftPresetSlotButton.Position.Y.Offset>=r.CraftQueueView.Position.Y.Offset+r.CraftQueueView.Size.Y.Offset,'preset controls must remain below the queue')
 local y=r.CraftPresetSlotButton.Position.Y.Offset
 r.CraftModeButton.Activated:Fire();assert(r.CraftPresetSlotButton.Position.Y.Offset>y,'inline recipe controls must push the preset section down')
 r.CloseMenus();assert(r.CraftPresetSlotButton.Position.Y.Offset==y,'closing menus must restore the preset layout')
 writefile=function() return false end
 r.CraftPresetSaveButton.Activated:Fire()
 assert(r.CraftPresetPersistence[2]=='Session only' and string.find(r.CraftPresetSummary.Text,'File saving unavailable or failed',1,true),'file failure must be visible in the real preset summary')
 writefile,readfile=oldWrite,oldRead;HttpService.JSONEncode,HttpService.JSONDecode=encode,decode
 for _,field in ipairs(fields) do r[field]=old[field] end;r.CraftPresetName.Text=name;r.RefreshCraftUI()
 end)()

;(function()
 local r=RemoteCatalog
 local fields={'OwnedTools','BaitCount','PropellerNow','PropellerTimestamp','PropellerGoal','PropellerHistory','PropellerTotal','PropellerLastAt','PropellerWindow','PropellerPendingWindow'}
 local old={};for _,field in ipairs(fields) do old[field]=r[field] end
 local quantity=10
 r.OwnedTools=function() return {{Name='propeller',Parent={}}} end;r.BaitCount=function() return quantity end
 r.PropellerNow=function() return 100 end;r.PropellerTimestamp=function() return '2026-10-21 12:00:00 UTC' end
 r.PropellerGoal={Progress=0,Reached=false};r.ResetPropellers()
 assert(not enabled,'propeller goal UI fixture must start with Fishing OFF')
 r.PropellerGoalButton.Activated:Fire()
 local y=r.PropellerHistoryView.Position.Y.Offset
 assert(r.PropellerGoalMenu.Menu.Visible and y>=r.PropellerGoalMenu.Menu.Position.Y.Offset+r.PropellerGoalMenu.Menu.Size.Y.Offset,'goal dropdown must push loot history below its options')
 r.PropellerGoalMenu.Options[4].Activated:Fire()
 assert(r.PropellerGoal.Limit==10 and not enabled and not r.PropellerGoalMenu.Menu.Visible,'choosing ten must keep fishing OFF')
 local base=r.PropellerHistoryView.Position.Y.Offset
 assert(base<y,'closing the goal dropdown must restore history layout')
 r.PropellerGoalButton.Activated:Fire();assert(r.PropellerGoalMenu.Menu.Visible)
 setEnabled(true)
 assert(r.PropellerGoal.Progress==0 and not r.PropellerGoalButton.Active and not r.PropellerGoalMenu.Menu.Visible,'Fishing start must reset run progress, dismiss the picker and lock goal editing')
 r.PropellerGoalButton.Activated:Fire();assert(not r.PropellerGoalMenu.Menu.Visible and not r.SetPropellerGoal(5),'running Fishing must reject goal edits through both UI and API')
 r.BeginPropellerCatch(3);quantity=20
 local token=cycleId;local bait=baitEnabled;baitEnabled=true;r.StartFishingOnBait=true
 r.ConfirmPropellerCatch()
 assert(not enabled and cycleId>token and string.find(toggle.Text,'FISH OFF',1,true) and r.PropellerGoal.Reached and r.PropellerGoal.Progress==10,'the real fishing controller must stop at ten new propellers and cancel its old generation')
 assert(baitEnabled and not r.StartFishingOnBait,'propeller completion must keep other automation state and cancel pending bait auto-start')
 baitEnabled=bait
 assert(string.find(status.Text,'Propeller goal reached',1,true) and string.find(r.PropellerGoalLabel.Text,'REACHED',1,true) and r.PropellerGoalButton.Active,'completion must remain visible and unlock the goal selector')
 local originalCopy=setclipboard
 local copied
 setclipboard=function(value) copied=value end;r.PropellerHistoryCopy.Activated:Fire()
 assert(copied and string.find(copied,'Propeller loot history (UTC)',1,true) and string.find(copied,'2026-10-21 12:00:00 UTC · +10 · session 10',1,true),'Copy loot history must include timestamp and actual amount')
 setclipboard=function() error('clipboard unavailable') end;r.PropellerHistoryCopy.Activated:Fire()
 assert(string.find(status.Text,'printed to the console',1,true),'history copy must support the console fallback')
 setclipboard=originalCopy
 setEnabled(true);assert(r.PropellerGoal.Progress==0 and r.PropellerTotal==10 and #r.PropellerHistory==1,'restarting Fishing must retain session history and reset only run progress')
 r.BeginPropellerCatch(3);quantity=21;r.ConfirmPropellerCatch();r.PropellerHistoryClear.Activated:Fire()
 assert(enabled and #r.PropellerHistory==0 and r.PropellerTotal==11 and r.PropellerGoal.Progress==1,'Clear history must not change Fishing or goal/session counters')
 r.PropellerResetButton.Activated:Fire()
 assert(enabled and r.PropellerTotal==0 and #r.PropellerHistory==0 and r.PropellerGoal.Progress==0 and r.PropellerGoal.Limit==10,'Reset session must clear history/progress and keep the selected goal')
 assert(r.PropellerHistoryCopy.Position.Y.Offset>=r.PropellerHistoryView.Position.Y.Offset+r.PropellerHistoryView.Size.Y.Offset,'history actions must sit below their scrolling view')
 r.RefreshPropellers()
 assert(string.find(r.PropellerStatsLabel.Text,'Propellers/hour:',1,true) and string.find(r.PropellerStatsLabel.Text,'needs 2 finds',1,true),'actual Fishing page must show reset rate/interval status')
 assert(r.PropellerStatsLabel.Position.Y.Offset>=r.PropellerHistoryCopy.Position.Y.Offset+r.PropellerHistoryCopy.Size.Y.Offset,'statistics must sit below history actions')
 setEnabled(false);stepWorkers()
 for _,field in ipairs(fields) do r[field]=old[field] end;r.RefreshPropellers()
 end)()

;(function()
 local r=RemoteCatalog
 local fields={'CraftQueue','CraftQueueDone','CraftQueueTotal','CraftQueueIndex','CraftQueueRunSize','CraftQueueActiveItem','CraftQueueSelected','CraftMaterialRun','CraftPaused','CraftTransferBusy'}
 local old={};for _,field in ipairs(fields) do old[field]=r[field] end
 local name,text,hint=r.CraftPresetName.Text,r.CraftTransferText.Text,r.CraftTransferHint.Text
 local encoder,decoder,clipboard,writer=HttpService.JSONEncode,HttpService.JSONDecode,setclipboard,writefile
 local archive,sequence,copied,writes={},0,nil,0
 HttpService.JSONEncode=function(_,data) sequence+=1;local token='queue-json-'..sequence;archive[token]=data;return token end
 HttpService.JSONDecode=function(_,value) assert(archive[value],'invalid JSON');return archive[value] end
 writefile=function() writes+=1 end
 local function job(item) return {Item=item,Mode='Make amount',Batch=100,Target=100} end
 r.CraftQueue={job('bait'),job('unknownRecipe')};r.CraftQueue[1].Binding={Secret='not portable'};r.CraftPresetName.Text=' Queue backup '
 r.CraftQueueSelected=1;r.CraftQueueDone=1;r.CraftQueueTotal=100
 r.RefreshCraftUI()
 assert(not r.CraftTransferPanel.Visible and r.CraftTransferPanel.Size.Y.Offset==0,'sharing must start collapsed without a tall empty panel')
 r.CraftTransferButton.Activated:Fire()
 assert(r.CraftTransferPanel.Visible and r.CraftTransferPanel.Size.Y.Offset==250,'sharing toggle must reveal the panel')
 assert(r.CraftTransferButton.Position.Y.Offset>=r.CraftPresetSummary.Position.Y.Offset+r.CraftPresetSummary.Size.Y.Offset and r.CraftTransferPanel.Position.Y.Offset>=r.CraftTransferButton.Position.Y.Offset+r.CraftTransferButton.Size.Y.Offset,'sharing must sit below presets without overlapping them')
 assert(r.CraftTransferText.Parent==r.CraftTransferView and r.CraftTransferText.AutomaticSize==Enum.AutomaticSize.Y and r.CraftTransferView.AutomaticCanvasSize==Enum.AutomaticSize.Y,'long queue JSON must grow inside a scrolling field')
 local y=r.CraftTransferPanel.Position.Y.Offset
 r.CraftModeButton.Activated:Fire();assert(r.CraftTransferPanel.Position.Y.Offset>y,'open dropdowns must push sharing below their options')
 r.CraftTransferButton.Activated:Fire();assert(not r.CraftTransferPanel.Visible and r.CraftTransferPanel.Position.Y.Offset==y,'closing sharing must close menus and restore its base layout')
 r.CraftTransferButton.Activated:Fire()
 local queue,presets=r.CraftQueue,r.CraftPresets
 r.CraftExportButton.Activated:Fire()
 assert(r.CraftTransferText.Text~='' and archive[r.CraftTransferText.Text].Name=='Queue backup' and archive[r.CraftTransferText.Text].Jobs[1].Binding==nil,'real Export must serialize clean descriptors and populate the field')
 assert(r.CraftQueue==queue and not r.CraftWorker and writes==0,'real Export cannot craft, replace the queue or write preset files')
 setclipboard=function() return false end;r.CraftCopyQueueButton.Activated:Fire()
 assert(string.find(r.CraftTransferHint.Text,'Select and copy',1,true),'clipboard failure must give feedback beside the JSON field')
 setclipboard=function(value) copied=value end;r.CraftCopyQueueButton.Activated:Fire()
 assert(copied==r.CraftTransferText.Text and string.find(r.CraftTransferHint.Text,'copied',1,true),'Copy must use the fresh export and report success locally')
 r.CraftTransferText.Text='broken';r.CraftImportButton.Activated:Fire()
 assert(r.CraftQueue==queue and r.CraftPresets==presets and string.find(r.CraftTransferHint.Text,'Import rejected',1,true),'malformed JSON must preserve both queues and show a local error')
 archive.imported={Version=1,Name='Imported queue',Jobs={job('unknownRecipe'),job('bait')}}
 r.CraftTransferText.Text='imported';r.CraftImportButton.Activated:Fire()
 assert(r.CraftQueue~=queue and r.CraftQueue[1].Item=='unknownRecipe' and r.CraftQueueDone==0 and not r.CraftQueueSelected and r.CraftQueueTotal==0 and r.CraftPresetName.Text=='Imported queue','real Import must install the ordered descriptors and clear previous progress')
 assert(not r.CraftWorker and not r.CraftEnabled and r.CraftPresets==presets and writes==0 and string.find(r.CraftTransferHint.Text,'Crafting stays OFF',1,true),'real Import must keep crafting OFF and require explicit preset saving')
 queue=r.CraftQueue;r.CraftWorker=true;r.RefreshCraftUI()
 assert(not r.CraftImportButton.Active and not r.CraftExportButton.Active and not r.CraftCopyQueueButton.Active and not r.CraftTransferText.TextEditable,'in-flight cleanup must visibly lock sharing buttons and text editing')
 r.CraftImportButton.Activated:Fire();r.CraftExportButton.Activated:Fire()
 assert(r.CraftQueue==queue and not r.CraftTransferBusy,'locked callbacks must not import or export')
 r.CraftWorker=nil;r.RefreshCraftUI();r.SetCraftTransferOpen(false)
 for _,field in ipairs(fields) do r[field]=old[field] end
 r.CraftPresetName.Text=name;r.CraftTransferText.Text=text;r.CraftTransferHint.Text=hint
 HttpService.JSONEncode,HttpService.JSONDecode,setclipboard,writefile=encoder,decoder,clipboard,writer
 r.RefreshCraftUI()
 end)()

;(function()
 local b=buildController
 local fields={'SavedPlan','Cells','PlanDirty','LayerIndex','SelectedCell','Picking','RepeatCopies','RepeatGap','UndoStack','RedoStack','Preset','PlanRevision','Failures','SetupReport','SetupResult','BuildReport','VisualSnapshot','VisualCounts','ReachCounts'}
 local old,open={},{};for _,field in ipairs(fields) do old[field]=b[field] end
 for _,section in ipairs(b.Sections) do open[section.Key]=section.Open;if section.Open then b:ToggleSection(section.Key) end end
 assert(not b.Buttons.RepeatRight.Visible and not b.Buttons.RepeatCopies.Visible and b.LayoutHeight<650,'repeat editing must remain inside the collapsed editor without enlarging the default page')
 b.SectionButtons.Materials.Activated:Fire()
 assert(b.Buttons.RepeatRight.Visible and b.Buttons.RepeatForward.Visible and b.Buttons.RepeatGap.Visible,'opening the editor must expose repeat actions/options')
 assert(b.Buttons.RepeatCopies.Position.Y.Offset+b.Buttons.RepeatCopies.Size.Y.Offset<=b.Buttons.RepeatRight.Position.Y.Offset and b.Buttons.RepeatRight.Position.Y.Offset+b.Buttons.RepeatRight.Size.Y.Offset<b.SectionButtons.History.Position.Y.Offset,'repeat controls must sit in distinct rows above result history')
 local slot=b.Library[1]
 local function cell(x,y,material) return {Material=material,Components={x,y,0,1,0,0,0,1,0,0,0,1}} end
 b.Cells=nil;b.SavedPlan={Version=1,Name='Repeat UI test',BlockSize=3,Cells={cell(0,0,'grass'),cell(3,3,'stone')}}
 b.PlanDirty=false;b:ClearEdits();b.RepeatCopies=2;b.RepeatGap=0
 local source=b.SavedPlan
 b.Buttons.RepeatCopies.Activated:Fire();b.Buttons.RepeatGap.Activated:Fire()
 assert(b.RepeatCopies==3 and b.RepeatGap==1 and b.SavedPlan==source and #b.UndoStack==0 and not b.WorkerToken,'option choices must be staged without changing the layout')
 b.Buttons.RepeatForward.Activated:Fire()
 assert(#b.SavedPlan.Cells==6 and b.PlanDirty and not b.Cells and not b.LayerIndex and #b.UndoStack==1 and b.Library[1]==slot and not b.WorkerToken,'actual Repeat must edit the entire loaded layout while retaining saved slots and keeping building OFF')
 local levels={};for _,cell in ipairs(b.SavedPlan.Cells) do levels[cell.Components[3]]=true end
 assert(levels[0] and levels[-6] and levels[-12],'actual options must produce three forward copies with the chosen one-block gap')
 b.Buttons.UndoMaterial.Activated:Fire();assert(#b.SavedPlan.Cells==2 and not b.PlanDirty,'actual Undo must restore the pre-repeat layout')
 b.Buttons.Redo.Activated:Fire();assert(#b.SavedPlan.Cells==6 and b.PlanDirty,'actual Redo must restore repeated geometry')
 local current=b.SavedPlan;b.WorkerToken=88;b:RefreshFailureUI()
 for _,key in ipairs({'RepeatCopies','RepeatGap','RepeatRight','RepeatForward'}) do assert(not b.Buttons[key].Active,'cleanup must visibly lock every repeat control');b.Buttons[key].Activated:Fire() end
 assert(b.SavedPlan==current and b.RepeatCopies==3 and b.RepeatGap==1,'disabled callbacks must retain geometry and options')
 b.WorkerToken=nil;b:RefreshFailureUI()
 b.Buttons.UndoMaterial.Activated:Fire();b.RepeatCopies=2;b.RepeatGap=0;b.Buttons.RepeatRight.Activated:Fire()
 assert(#b.SavedPlan.Cells==4 and b.SavedPlan.Cells[3].Components[1]==3,'actual Right action must repeat using local positive X while maintaining bottom-up order')
 for _,section in ipairs(b.Sections) do if section.Open then b:ToggleSection(section.Key) end end
 assert(b.LayoutHeight<650 and not b.Buttons.RepeatRight.Visible,'closing the editor must restore the compact page exactly')
 for _,field in ipairs(fields) do b[field]=old[field] end
 b.Buttons.RepeatCopies.Text='Copies: '..b.RepeatCopies..' total';b.Buttons.RepeatGap.Text='Gap: '..b.RepeatGap..' blocks'
 b.Buttons.Preset.Text=b.Preset..'  ▼';b:RefreshEdits();b:RefreshFailureUI()
 for _,section in ipairs(b.Sections) do if open[section.Key] then b:ToggleSection(section.Key) end end
 end)()

;(function()
 local r=RemoteCatalog
 local fields={'CraftQueue','CraftQueueRevision','CraftQueueCheckResult','CraftQueueCheckBusy','CraftMaterials','CraftQueueDone','CraftQueueTotal','CraftQueueSelected'}
 local old={};for _,field in ipairs(fields) do old[field]=r[field] end
 local recorder,reachable,count,copy,character=r.CraftRecorder,r.CraftReachable,r.CarrotCount,setclipboard,player.Character
 local learned,inRange,stock,copied=true,true,300,nil
 local root={};player.Character={FindFirstChild=function() return root end}
 r.CraftRecorder=function() return learned and {} or nil,learned and {Workbench={}} or nil end
 r.CraftReachable=function() return inRange,'Stand within 20 studs of your learned workbench' end
 r.CarrotCount=function(item) return item=='worm' and stock or 0 end
 r.CraftMaterials={bait=r.ReadCraftMaterials({outputAmount=1},{worm=2})}
 r.CraftQueue={{Item='bait',Mode='Make amount',Batch=100,Target=100}}
 r.RefreshCraftUI()
 assert(r.CraftQueueCheckButton.Position.Y.Offset>=r.CraftQueueRunButton.Position.Y.Offset+r.CraftQueueRunButton.Size.Y.Offset and r.CraftQueueRemoveButton.Position.Y.Offset>=r.CraftQueueCheckButton.Position.Y.Offset+r.CraftQueueCheckButton.Size.Y.Offset,'queue check actions must fit in their own row between Run and Remove')
 assert(r.CraftQueueCheckButton.Position.Y.Offset==r.CraftQueueCopyCheckButton.Position.Y.Offset and r.CraftQueueView.Position.Y.Offset>=r.CraftQueueRemoveButton.Position.Y.Offset+r.CraftQueueRemoveButton.Size.Y.Offset,'the new row must push the scroll report down without overlap')
 r.CraftQueueCheckButton.Activated:Fire()
 assert(r.CraftQueueCheckResult and r.CraftQueueCheckResult.Summary=='LOCAL CHECKS PASS' and string.find(r.CraftQueueLabel.Text,'CRAFT QUEUE CHECK',1,true) and not r.CraftWorker,'real Check must show an advisory report in the scrolling queue view without crafting')
 assert(r.CraftQueueView.AutomaticCanvasSize==Enum.AutomaticSize.Y and r.CraftQueueLabel.AutomaticSize==Enum.AutomaticSize.Y,'long checks must remain scrollable')
 setclipboard=function(value) copied=value end;stock=0;r.CraftQueueCopyCheckButton.Activated:Fire()
 assert(copied and string.find(copied,'worm ×200',1,true) and r.CraftQueueCheckResult.Summary=='ACTION NEEDED','real Copy must refresh current quantities instead of copying an earlier pass')
 assert(string.find(r.CraftDiagnosticReport(),'CRAFT QUEUE CHECK',1,true),'craft diagnostics must include the valid queue check snapshot')
 setclipboard=function() return false end;r.CraftQueueCopyCheckButton.Activated:Fire()
 assert(string.find(r.CraftInfo.Text,'printed to console',1,true),'real Copy check must support clipboard failure')
 stock=300;learned=false;inRange=false;r.CraftQueueCheckButton.Activated:Fire()
 assert(string.find(r.CraftQueueCheckResult.Text,'Learn recipes: bait',1,true),'unlearned imported recipes must be named in the real queue report')
 learned=true;r.CraftQueueCheckButton.Activated:Fire();assert(r.CraftQueueCheckResult.Summary=='ACTION NEEDED')
 inRange=true;r.CraftQueueCheckButton.Activated:Fire()
 r.CraftQueueCheckResult._At=os.clock()-31;updateBoard()
 assert(not r.CraftQueueCheckResult and not string.find(r.CraftQueueLabel.Text,'CRAFT QUEUE CHECK',1,true) and string.find(r.CraftInfo.Text,'expired',1,true),'periodic refresh must expire old checks without running a new one')
 r.CraftWorker=89;r.RefreshCraftUI()
 assert(not r.CraftQueueCheckButton.Active and not r.CraftQueueCopyCheckButton.Active,'cleanup must visibly lock both queue-check controls')
 r.CraftQueueCheckButton.Activated:Fire();assert(not r.CraftQueueCheckResult and not r.CraftQueueCheckBusy,'locked callbacks cannot create a report')
 r.CraftWorker=nil;r.RefreshCraftUI();r.CraftQueueCheckButton.Activated:Fire()
 r.CraftQueueSelected=1;r.CraftQueueRemoveButton.Activated:Fire();assert(not r.CraftQueueCheckResult,'editing must clear the previous check snapshot')
 local y=r.CraftQueueCheckButton.Position.Y.Offset
 r.CraftModeButton.Activated:Fire();assert(r.CraftQueueCheckButton.Position.Y.Offset>y,'inline menus must push the new check row below options')
 r.CloseMenus();assert(r.CraftQueueCheckButton.Position.Y.Offset==y,'closing dropdowns must restore the new row without drift')
 r.CraftRecorder,r.CraftReachable,r.CarrotCount,setclipboard,player.Character=recorder,reachable,count,copy,character
 for _,field in ipairs(fields) do r[field]=old[field] end;r.RefreshCraftUI()
 end)()

;(function()
 local b=buildController
 local fields={'SavedPlan','Cells','PlanDirty','LayerIndex','SelectedCell','Picking','RepeatScope','RepeatCopies','RepeatGap','UndoStack','RedoStack','Preset','PlanRevision','Failures','SetupReport','SetupResult','BuildReport','VisualSnapshot','VisualCounts','CaptureRange'}
 local old,open={},{};for _,field in ipairs(fields) do old[field]=b[field] end
 for _,section in ipairs(b.Sections) do open[section.Key]=section.Open;if section.Open then b:ToggleSection(section.Key) end end
 assert(b.RepeatScope=='Entire layout' and not b.Buttons.RepeatScope.Visible and not b.Buttons.RepeatUp.Visible and b.LayoutHeight<650,'whole-layout repetition and compact hidden editing must remain the default')
 b.SectionButtons.Materials.Activated:Fire()
 assert(b.Buttons.RepeatScope.Visible and b.Buttons.RepeatUp.Visible and b.Buttons.RepeatScope.Position.Y.Offset+b.Buttons.RepeatScope.Size.Y.Offset<=b.Buttons.RepeatUp.Position.Y.Offset,'scope must occupy its own row above the direction actions')
 assert(b.Buttons.RepeatRight.Position.Y.Offset==b.Buttons.RepeatUp.Position.Y.Offset and b.Buttons.RepeatForward.Position.Y.Offset==b.Buttons.RepeatUp.Position.Y.Offset,'all three directions must share one row')
 assert(b.Buttons.RepeatRight.Position.X.Scale+b.Buttons.RepeatRight.Size.X.Scale<=b.Buttons.RepeatForward.Position.X.Scale and b.Buttons.RepeatForward.Position.X.Scale+b.Buttons.RepeatForward.Size.X.Scale<=b.Buttons.RepeatUp.Position.X.Scale,'three direction buttons must not overlap')
 local function cell(y,material) return {Material=material,Components={0,y,0,1,0,0,0,1,0,0,0,1}} end
 b.Cells=nil;b.SavedPlan={Version=1,Name='Floors UI',BlockSize=3,Cells={cell(0,'grass'),cell(3,'stone')}}
 b.PlanDirty=false;b.RepeatCopies=2;b.RepeatGap=0;b:ClearEdits()
 local slot=b.Library[1]
 b.Buttons.RepeatUp.Activated:Fire()
 assert(#b.SavedPlan.Cells==4 and b.SavedPlan.Cells[3].Components[2]==6 and b.SavedPlan.Cells[4].Components[2]==9 and not b.WorkerToken and b.Library[1]==slot,'actual Up action must append a complete vertical copy as an unsaved edit')
 b.Buttons.UndoMaterial.Activated:Fire();assert(#b.SavedPlan.Cells==2 and not b.PlanDirty)
 b.Buttons.RepeatScope.Activated:Fire();local plan=b.SavedPlan
 assert(b.RepeatScope=='Selected layer' and string.find(b.Buttons.RepeatScope.Text,'Selected layer',1,true),'scope control must explicitly select one layer')
 b.Buttons.RepeatUp.Activated:Fire()
 assert(b.SavedPlan==plan and #b.UndoStack==0 and string.find(b.Status.Text,'choose one Build layer',1,true),'selected scope without a preview/layer must leave the layout and history unchanged with guidance')
 b.WorkerToken=90;b:RefreshFailureUI()
 for _,key in ipairs({'RepeatScope','RepeatUp'}) do assert(not b.Buttons[key].Active);b.Buttons[key].Activated:Fire() end
 assert(b.RepeatScope=='Selected layer' and b.SavedPlan==plan,'cleanup must lock the new scope and Up callbacks')
 local find=RemoteCatalog.BuildIslandBlocks;local scans=0
 RemoteCatalog.BuildIslandBlocks=function() scans+=1;return nil end
 local range=b.CaptureRange;b.Buttons.Capture.Activated:Fire();b.Buttons.CaptureRange.Activated:Fire()
 assert(scans==0 and b.CaptureRange==range and string.find(b.Status.Text,'cleanup',1,true),'actual capture controls must reject early during in-flight cleanup')
 RemoteCatalog.BuildIslandBlocks=find;b.WorkerToken=nil;b:RefreshFailureUI()
 b.Buttons.RepeatScope.Activated:Fire();assert(b.RepeatScope=='Entire layout' and b.SavedPlan==plan,'returning to the default scope must not apply an edit')
 for _,section in ipairs(b.Sections) do if section.Open then b:ToggleSection(section.Key) end end
 assert(b.LayoutHeight<650 and not b.Buttons.RepeatUp.Visible,'closing the enlarged editor must restore the compact default')
 for _,field in ipairs(fields) do b[field]=old[field] end
 b.Buttons.RepeatScope.Text='Repeat: '..b.RepeatScope;b.Buttons.Preset.Text=b.Preset..'  ▼';b:RefreshEdits();b:RefreshFailureUI()
 for _,section in ipairs(b.Sections) do if open[section.Key] then b:ToggleSection(section.Key) end end
 end)()

 ;(function()
 local r=RemoteCatalog
 local old=r.ChestTransferContext()
 local oldProfiles,oldPersistence,oldText,oldHint=r.ChestProfiles,r.ChestProfilePersistence,r.ChestTransferText.Text,r.ChestTransferHint.Text
 local oldEncode,oldDecode,oldWrite,oldCopy=HttpService.JSONEncode,HttpService.JSONDecode,writefile,setclipboard
 local archive,sequence,writes={},0,0
 HttpService.JSONEncode=function(_,data) sequence+=1;local text='chest-share-'..sequence;archive[text]=data;return text end
 HttpService.JSONDecode=function(_,text) return assert(archive[text],'bad JSON') end
 writefile=function(path,text) assert(path=='RebornChestProfiles_7.json' and archive[text].Profiles['1'].Name=='Shared supplies');writes+=1 end
 setclipboard=function() return false end
 r.ChestProfiles={};r.ChestProfilePersistence={};r.ChestProfileSlot=1
 r.ChestProfileName.Text='Shared supplies';r.ChestItems={wood=true};r.ChestItem=nil;r.ChestSelection=nil
 r.ChestDiscover=true;r.ChestWhole=false;r.ChestSpeed='Fast';r.ChestTravel='Stay';r.ChestScanRange=60
 r.ChestGoal=250;r.ChestStockTarget=100;r.ChestRepeat=true;r.ChestAutoBatch='Max';r.ChestOrder='Balance chests'
 showTab('Chests');flush()
 local initial=r.ChestItemButton.Position.Y.Offset
 assert(not r.ChestTransferPanel.Visible and not r.ChestProfilesPanel.Visible,'backup editor starts collapsed')
 r.ChestProfilesButton.Activated:Fire();r.ChestTransferButton.Activated:Fire()
 assert(r.ChestProfilesPanel.Visible and r.ChestTransferPanel.Visible and r.ChestProfilesPanel.Size.Y.Offset>=r.ChestTransferPanel.Position.Y.Offset+r.ChestTransferPanel.Size.Y.Offset,'backup editor must fit inside expanded profiles')
 assert(r.ChestItemButton.Position.Y.Offset>=r.ChestProfilesPanel.Position.Y.Offset+r.ChestProfilesPanel.Size.Y.Offset,'expanded JSON editor must push following controls down')
 assert(r.ChestTransferView:IsA('ScrollingFrame') and r.ChestTransferText.MultiLine and r.ChestTransferText.TextWrapped,'JSON must be editable and scrollable')
 r.ChestExportButton.Activated:Fire()
 local text=r.ChestTransferText.Text
 assert(archive[text].Kind=='RebornChestSetup' and archive[text].Profile.AutoBatch=='Max' and writes==0 and not r.ChestAutoEnabled,'Export button must show current settings without saving or collecting')
 r.ChestCopySetupButton.Activated:Fire()
 assert(string.find(r.ChestTransferHint.Text,'Select and copy',1,true) and archive[r.ChestTransferText.Text],'failed clipboard API must explain the editable text fallback')
 r.ChestSpeed='Standard';r.ChestItems={}
 r.ChestImportButton.Activated:Fire()
 assert(r.ChestSpeed=='Fast' and r.ChestItems.wood and r.ChestStockTarget==100 and r.ChestAutoBatch=='Max' and r.ChestOrder=='Balance chests','Import button must restore full working preferences')
 assert(next(r.ChestProfiles)==nil and writes==0 and not r.ChestAutoEnabled and not r.ChestAutoWorker,'import must leave saved slots and workers untouched')
 r.ChestProfileSaveButton.Activated:Fire()
 assert(writes==1 and r.ChestProfiles[1].Name=='Shared supplies' and r.ChestProfiles[1].Items[1]=='wood','explicit Save must persist the imported setup normally')
 for _,field in ipairs({'ChestAutoEnabled','ChestAutoWorker','ChestBusy'}) do
  r[field]=true;r.ChestTransferText.Text='keep draft'
  r.ChestImportButton.Activated:Fire();r.ChestExportButton.Activated:Fire()
  assert(r.ChestTransferText.Text=='keep draft' and r.ChestItems.wood and writes==1,'busy actual callbacks must preserve settings and JSON')
  r[field]=nil
 end
 local originalCapture=r.StartCapture
 r.StartCapture=function() error('learning must not begin during transfer') end
 HttpService.JSONEncode=function(_,data)
  assert(r.ChestTransferBusy and not r.SetChestAuto(true),'auto collection cannot start during encoding')
  assert(not r.ChestRequestReady(nil),'manual dispatch cannot pass preflight during transfer')
  r.ChestLearnButton.Activated:Fire()
  sequence+=1;local value='chest-share-'..sequence;archive[value]=data;return value
 end
 r.ChestExportButton.Activated:Fire()
 assert(r.ChestTransferText.Text~='keep draft' and not r.ChestTransferBusy and not r.ChestAutoEnabled,'transfer must release lock after host reentry checks')
 r.StartCapture=originalCapture
 text=r.ChestTransferText.Text
 showTab('Fishing');flush()
 assert(not r.ChestTransferPanel.Visible and not r.ChestProfilesPanel.Visible and r.ChestItemButton.Position.Y.Offset==initial and r.ChestTransferText.Text==text,'tab cleanup must collapse JSON and restore layout while preserving draft')
 for _=1,3 do r.ChestProfilesButton.Activated:Fire();r.ChestTransferButton.Activated:Fire();r.ChestTransferButton.Activated:Fire();r.CloseMenus() end
 assert(r.ChestItemButton.Position.Y.Offset==initial,'nested editor toggles must not accumulate layout drift')
 for _,key in ipairs(r.ChestTransferFields) do r[key]=old[key] end
 r.ChestProfileName.Text=old.Name;r.ChestProfiles,r.ChestProfilePersistence=oldProfiles,oldPersistence
 r.ChestTransferText.Text=oldText;r.ChestTransferHint.Text=oldHint
 HttpService.JSONEncode,HttpService.JSONDecode,writefile,setclipboard=oldEncode,oldDecode,oldWrite,oldCopy
 r.RefreshChestProfiles();r.CloseMenus()
 end)()

 ;(function()
 local r=RemoteCatalog
 local oldFocus,oldSend,oldCharacter=UserInputService.GetFocusedTextBox,VirtualInputManager.SendKeyEvent,player.Character
 local events={}
 UserInputService.GetFocusedTextBox=function() return nil end
 VirtualInputManager.SendKeyEvent=function(_,down,key) assert(key==Enum.KeyCode.Q);table.insert(events,down and 'down' or 'up') end
 player.Character={Parent=true,FindFirstChildOfClass=function() return {Health=100} end,FindFirstChild=function() return {} end}
 showTab('Settings');flush()
 assert(not r.DropEnabled and r.DropButton.Text=='AUTO DROP: OFF' and r.DropCount==0,'Q repeat must be OFF at startup')
 local initial=r.DropInfo.Position.Y.Offset
 r.DropIntervalButton.Activated:Fire()
 assert(r.DropIntervalMenu.Menu.Visible and r.DropInfo.Position.Y.Offset>initial,'Q interval dropdown must expand without covering the status')
 r.DropIntervalMenu.Options[1].Activated:Fire()
 assert(r.DropInterval==.1 and not r.DropIntervalMenu.Menu.Visible and r.DropInfo.Position.Y.Offset==initial,'Q interval selection must restore the exact compact layout')
 r.DropButton.Activated:Fire()
 assert(r.DropEnabled and events[1]=='down' and r.DropButton.Text=='AUTO DROP: ON','actual ON must send Q')
 r.DropIntervalButton.Activated:Fire();assert(not r.DropIntervalMenu.Menu.Visible,'interval changes must wait for press cleanup')
 UserInputService.WindowFocusReleased:Fire()
 assert(not r.DropEnabled and events[2]=='up' and not r.DropHeld,'losing window focus must release Q immediately and disable repeat')
 stepWorkers();assert(not r.DropWorker,'old worker must finish before restart')
 r.DropButton.Activated:Fire();assert(r.DropEnabled and events[#events]=='down')
 r.DropStopButton.Activated:Fire();assert(not r.DropEnabled and events[#events]=='up','dedicated Stop must release Q')
 stepWorkers();r.DropButton.Activated:Fire();assert(r.DropEnabled)
 r.StopAllAutomation();assert(not r.DropEnabled and events[#events]=='up','Stop All must stop and release Q')
 stepWorkers();assert(not r.DropWorker and not r.DropHeld)
 UserInputService.GetFocusedTextBox=function() return {} end
 r.DropButton.Activated:Fire()
 assert(r.DropEnabled and string.find(r.DropInfo.Text,'typing',1,true),'text focus must pause without switching OFF')
 r.DropStopButton.Activated:Fire();stepWorkers()
 UserInputService.GetFocusedTextBox,VirtualInputManager.SendKeyEvent,player.Character=oldFocus,oldSend,oldCharacter
 r.DropInterval=.15;r.DropIntervalMenu:Refresh();r.DropCount=0;r.RefreshDropUI()
 end)()

;(function()
 local r=RemoteCatalog
 local cards={r.SettingsControlCard,r.SettingsDropCard,r.SettingsQuickCard,r.SettingsInterfaceCard,r.SettingsAdvancedCard}
 local function checkLayout()
  for _,windowWidth in ipairs({640,720,1080}) do
   local pageWidth=windowWidth-190-36
   local previousBottom=0
   for _,card in ipairs(cards) do
    assert(card.Parent==settingsPage and card.Position.Y.Offset>=previousBottom+8,'settings cards must have distinct vertical space')
    previousBottom=card.Position.Y.Offset+card.Size.Y.Offset
    local function checkChildren(parent,width)
     local boxes={}
     for _,child in ipairs(parent:GetChildren()) do
      if child:IsA('GuiObject') and child.Visible then
       local x=child.Position.X.Scale*width+child.Position.X.Offset
       local y=child.Position.Y.Offset
       local w=child.Size.X.Scale*width+child.Size.X.Offset
       local h=child.Size.Y.Offset
       assert(x>=0 and y>=0 and x+w<=width and y+h<=parent.Size.Y.Offset,'settings controls must stay within their card at every supported width')
       for _,box in ipairs(boxes) do
        assert(x>=box.X+box.W or box.X>=x+w or y>=box.Y+box.H or box.Y>=y+h,'settings controls must not overlap')
       end
       table.insert(boxes,{X=x,Y=y,W=w,H=h})
       if child:IsA('Frame') then checkChildren(child,w) end
      end
     end
    end
    checkChildren(card,card.Size.X.Scale*pageWidth+card.Size.X.Offset)
   end
  end
 end
 assert(r.SettingsLayoutHeight<600 and not r.SettingsQuickBody.Visible and not r.SettingsAdvancedBody.Visible,'default Settings must be compact with optional details collapsed')
 assert(stopAllButton.Parent==r.SettingsControlCard and r.AntiAFKButton.Parent==r.SettingsControlCard and r.DropButton.Parent==r.SettingsDropCard,'primary controls must be grouped at the top')
 assert(r.SettingsDropCard.Position.Y.Offset<200,'Q repeat must be reachable near the top of Settings')
 checkLayout()
 local initial=r.SettingsLayoutHeight
 r.DropIntervalButton.Activated:Fire();assert(r.DropIntervalMenu.Menu.Visible)
 checkLayout()
 r.DropIntervalMenu.Options[2].Activated:Fire();assert(r.SettingsLayoutHeight==initial,'dropdown selection must restore layout exactly')
 for _=1,3 do
  r.SettingsQuickButton.Activated:Fire();assert(r.SettingsQuickBody.Visible and not r.SettingsAdvancedBody.Visible)
  checkLayout()
  r.SettingsAdvancedButton.Activated:Fire();assert(r.SettingsAdvancedBody.Visible and not r.SettingsQuickBody.Visible,'opening a detail section should keep one section expanded')
  checkLayout()
  r.DropIntervalButton.Activated:Fire();assert(not r.SettingsAdvancedBody.Visible,'opening interval choices must dismiss optional settings')
  checkLayout()
  showTab('Fishing');flush();assert(not r.DropIntervalMenu.Menu.Visible and r.SettingsLayoutHeight==initial,'tab switches must restore the compact layout without drift')
 end
 showTab('Settings');flush()
 assert(not r.DropEnabled and not r.DropWorker,'layout actions cannot start Q automation')
end)()

;(function()
 local b=buildController
 local original=b.BuildSpeed
 showTab('Auto Build');flush()
 local initial=b.LayoutHeight
 assert(b.ProgressTrack.Visible and b.ProgressTrack.Position.Y.Offset>=b.Status.Position.Y.Offset+b.Status.Size.Y.Offset and b.ProgressTrack.Position.Y.Offset+b.ProgressTrack.Size.Y.Offset<=b.MaterialView.Position.Y.Offset,'native progress strip must fit between status and report without overlap')
 assert(b.Buttons.Start.Active and not b.Buttons.Stop.Active,'idle native actions must show Start as available and Stop as disabled')
 assert(b.BuildSpeed=='Standard' and b.Buttons.Start.Position.Y.Offset==b.Buttons.Stop.Position.Y.Offset and b.Buttons.Start.Position.Y.Offset==b.Buttons.Pause.Position.Y.Offset and not b.Buttons.Pause.Active and b.Buttons.Start.Position.Y.Offset<b.Buttons.Preview.Position.Y.Offset,'Start and Stop must share the first action row')
 local controls={b.Buttons.Start,b.Buttons.Pause,b.Buttons.Stop,b.Buttons.Preview,b.Buttons.LearnPlacement,b.Buttons.CheckSetup,b.Buttons.Layer,b.Buttons.Speed,b.Buttons.Rotate,b.Buttons.Center,b.Buttons.RetryFailed,b.Buttons.Clear}
 for _,width in ipairs({640-190-36,720-190-36,1080-190-36}) do
  for i,control in ipairs(controls) do
   local x=control.Position.X.Scale*width+control.Position.X.Offset
   local w=control.Size.X.Scale*width+control.Size.X.Offset
   assert(x>=0 and x+w<=width and w>60,'action controls must fit at every supported window width')
   for j=i+1,#controls do
    local other=controls[j]
    if control.Position.Y.Offset==other.Position.Y.Offset then
     local ox=other.Position.X.Scale*width+other.Position.X.Offset
     local ow=other.Size.X.Scale*width+other.Size.X.Offset
     assert(x+w<=ox or ox+ow<=x,'build action columns must not overlap')
    end
   end
  end
 end
 for _=1,3 do
  b.Buttons.Speed.Activated:Fire()
  assert(b.SpeedMenu.Visible and b.Buttons.Rotate.Position.Y.Offset>b.SpeedMenu.Position.Y.Offset+b.SpeedMenu.Size.Y.Offset and b.LayoutHeight>initial,'speed choices must expand in flow and push the editing row and report down')
  assert(b.ProgressTrack.Position.Y.Offset>=b.Status.Position.Y.Offset+b.Status.Size.Y.Offset and b.ProgressTrack.Position.Y.Offset+b.ProgressTrack.Size.Y.Offset<=b.MaterialView.Position.Y.Offset,'native dropdown expansion must keep the progress strip clear of adjacent content')
  b.SpeedOptions[2].Activated:Fire()
  assert(b.BuildSpeed=='Fast' and not b.SpeedMenu.Visible and b.LayoutHeight==initial and string.find(b.SpeedOptions[2].Text,'✓',1,true),'speed selection must mark Fast and restore the exact compact layout')
  b.Buttons.Speed.Activated:Fire();b.Buttons.Movement.Activated:Fire()
  assert(not b.SpeedMenu.Visible and b.MoveMenu.Visible and b.LayoutHeight==initial,'movement must dismiss speed options')
  b:CloseMenus();b.Buttons.Speed.Activated:Fire();showTab('Fishing');flush()
  assert(not b.SpeedMenu.Visible and b.LayoutHeight==initial,'tab cleanup must close speed options without layout drift')
 end
 b.WorkerToken=95;b:RefreshFailureUI();b.Buttons.Speed.Activated:Fire();b.SpeedOptions[1].Activated:Fire()
 assert(not b.Buttons.Speed.Active and b.BuildSpeed=='Fast' and not b.SpeedMenu.Visible,'speed buttons must lock through request cleanup')
 b.WorkerToken=nil;b:RefreshFailureUI();assert(b.Buttons.Speed.Active and b:SetBuildSpeed(original))
 assert(not b.Running and not b.WorkerToken,'layout and speed selection cannot start placement')
end)()

;(function()
 local b,r=buildController,RemoteCatalog
 local saved={Count=r.CarrotCount,Cache=r.ModuleCache,Cells=b.Cells,Layer=b.LayerIndex,Character=player.Character,Failures=b.Failures,Progress=b.Progress,History=b.History,Speed=b.BuildSpeed}
 local world,stock,requests={},0,0
 local function pos(x) return setmetatable({X=x,Y=0,Z=0},{__sub=function(a,c) return {Magnitude=math.abs(a.X-c.X)} end}) end
 r.CarrotCount=function(item) assert(item=='grass');return stock end
 r.ModuleCache={
  ['ReplicatedStorage.TS.network.requests']={Requests={Client={Get=function() return {CallServer=function(_,body)
   assert(stock>0,'known empty stock must never reach the game endpoint')
   stock-=1;requests+=1;world[body.cframe.Position.X]=true;return true
  end} end}}},
  ['ReplicatedStorage.TS.util.block-utils']={BlockUtils={getBlocksFromLocation=function(p) return world[p.X] and {true} or {} end}},
  ['ReplicatedStorage.Shared.SharedConfig']={CLIENT_REACH=20},
 }
 player.Character={FindFirstChild=function() return {Position=pos(0)} end}
 b.Cells={{CFrame={Position=pos(4)},Material='grass'},{CFrame={Position=pos(7)},Material='grass'},{CFrame={Position=pos(10)},Material='grass'}}
 b.LayerIndex=nil;b.Failures={};b.History={};assert(b:SetBuildSpeed('Fast'))
 showTab('Auto Build');flush();b.Buttons.Start.Activated:Fire()
 local owner=b.WorkerToken
 assert(b.Running and owner and requests==0 and b.Buttons.Start.Text=='Restock · 0/3' and b.WaitingMaterial=='grass','native Start must stay ON at empty stock and display restock in the primary button')
 assert(not b.Buttons.Start.Active and b.Buttons.Stop.Active and b.Buttons.Pause.Active and not b.ProgressSegments.Placed.Visible,'native live buttons and empty progress must match the restock state')
 for _=1,3 do stepWorkers() end
 assert(requests==0 and b.Progress.Failed==0 and b.WorkerToken==owner,'waiting cannot generate failures or replacement workers')
 b.Buttons.Pause.Activated:Fire()
 assert(b.Paused and b.Buttons.Pause.Text=='Resume' and b.Buttons.Start.Text=='Paused · 0/3' and b.WorkerToken==owner,'native Pause must retain the run and show Resume beside Start')
 stock=1;for _=1,4 do stepWorkers() end
 assert(requests==0 and b.Paused,'restocking cannot override an explicit native pause')
 b.Buttons.Pause.Activated:Fire()
 assert(not b.Paused and b.Buttons.Pause.Text=='Pause' and b.WorkerToken==owner)
 stock=1;stepWorkers()
 assert(requests==1 and b.Progress.Checked==1 and b.Buttons.Start.Text=='Building · 1/3','confirmed progress must be visible in the top action row')
 assert(math.abs(b.ProgressSegments.Placed.Size.X.Scale-1/3)<.000001 and b.ProgressSegments.Placed.Visible,'native progress must credit only the confirmed run fraction')
 stepWorkers();assert(b.Buttons.Start.Text=='Restock · 1/3' and requests==1)
 stock=2;for _=1,5 do stepWorkers() end
 assert(requests==3 and b.Progress.Checked==3 and b.Progress.Placed==3 and #b.History==1 and not b.WorkerToken and not b.WaitingMaterial,'restocking must complete the same native run')
 assert(b.ProgressSegments.Placed.Size.X.Scale==1 and b.Buttons.Start.Active and not b.Buttons.Stop.Active,'native completion must fill the strip and unlock Start')
 b.Cells={{CFrame={Position=pos(13)},Material='grass'}};b.Buttons.Start.Activated:Fire()
 assert(b.Running and b.WaitingMaterial=='grass');b.Buttons.Pause.Activated:Fire();b.Buttons.Stop.Activated:Fire()
 assert(not b.Buttons.Start.Active and not b.Buttons.Stop.Active and b.Buttons.Start.Text=='Finishing…' and b.Buttons.Stop.Text=='Stopping…','native Stop must show cleanup until the existing worker ends')
 stock=10;stepWorkers()
 assert(requests==3 and not b.WorkerToken and not b.WaitingMaterial and not b.Paused and not b.Buttons.Pause.Active,'actual Stop must cancel a paused restock wait before late stock arrives')
 r.CarrotCount,r.ModuleCache,b.Cells,b.LayerIndex,player.Character,b.Failures,b.Progress,b.History=saved.Count,saved.Cache,saved.Cells,saved.Layer,saved.Character,saved.Failures,saved.Progress,saved.History
 b:SetBuildSpeed(saved.Speed)
end)()

;(function()
 local b,r=buildController,RemoteCatalog
 local saved={Count=r.CarrotCount,Cache=r.ModuleCache,Cells=b.Cells,Layer=b.LayerIndex,Character=player.Character,Copy=setclipboard,Alternate=toclipboard}
 local fields={'BuildReport','SetupReport','SetupResult','VisualSnapshot','VisualCounts'}
 local old={};for _,key in ipairs(fields) do old[key]=b[key] end
 local function pos(x) return setmetatable({X=x,Y=0,Z=0},{__sub=function(a,c) return {Magnitude=math.abs(a.X-c.X)} end}) end
 r.ModuleCache={
  ['ReplicatedStorage.TS.util.block-utils']={BlockUtils={getBlocksFromLocation=function(p) return p.X==1 and {true} or {} end}},
  ['ReplicatedStorage.Shared.SharedConfig']={CLIENT_REACH=20}}
 player.Character={FindFirstChild=function() return {Position=pos(0)} end}
 b.Cells={{CFrame={Position=pos(1)},Material='grass'},{CFrame={Position=pos(4)},Material='grass'},{CFrame={Position=pos(7)},Material='stone'}};b.LayerIndex=nil
 r.CarrotCount=function(name) if name=='grass' then return 0 end end
 local copied,attempts=nil,0
 setclipboard=function() attempts+=1;return false end
 toclipboard=function(text) copied=text end
 b.Buttons.CopyMissing.Activated:Fire()
 assert(copied and string.find(copied,'grass ×1',1,true) and string.find(copied,'stone · need 1 · owned unknown',1,true) and string.find(status.Text,'copied',1,true),'native restock action must copy a fresh shortage list through the alternate clipboard API')
 assert(attempts==1 and not b.Running and not b.WorkerToken,'native export must not start automation or repeat the rejected clipboard API')
 local same=function() attempts+=1;return false end
 setclipboard=same;toclipboard=same;local count=attempts
 assert(r.CopyBuildReport('restock clipboard fallback')==false and attempts==count+1 and string.find(status.Text,'printed to console',1,true),'explicit false with aliased APIs must print once and never claim a copy')
 setclipboard=function() error('clipboard unavailable') end;toclipboard=nil
 assert(r.CopyBuildReport('restock exception fallback')==false and string.find(status.Text,'printed to console',1,true))
 setclipboard=true;toclipboard=function(text) copied=text end
 assert(r.CopyBuildReport('alternate available')==true and copied=='alternate available','a non-function primary clipboard value cannot hide a usable alternate')
 setclipboard=function(text) copied=text end;toclipboard=nil
 assert(r.CopyBuildReport('nil return means success')==true and copied=='nil return means success')
 b.WorkerToken=101;b:RefreshFailureUI();copied=nil
 b.Buttons.CopyMissing.Activated:Fire()
 assert(not copied and not b.Buttons.CopyMissing.Active and not b.Buttons.Check.Active,'cleanup must disable the two material-check actions and reject forced callbacks')
 b.WorkerToken=nil;b:RefreshFailureUI()
 local height=b.LayoutHeight
 if not b.Buttons.CopyMissing.Visible then b:ToggleSection('Library') end
 assert(b.Buttons.CopyMissing.Visible and b.Buttons.CopyMissing.Position.Y.Offset==b.Buttons.Check.Position.Y.Offset,'restock action must fit beside the material check in the saved-blueprint section')
 for _,width in ipairs({414,494,854}) do
  local check,copy=b.Buttons.Check,b.Buttons.CopyMissing
  assert(check.Position.X.Offset+check.Size.X.Scale*width+check.Size.X.Offset<=copy.Position.X.Scale*width+copy.Position.X.Offset,'restock and check controls cannot overlap at supported widths')
 end
 b:ToggleSection('Library');assert(b.LayoutHeight==height and b.LayoutHeight<650,'the compact default height must be preserved')
 r.CarrotCount,r.ModuleCache,b.Cells,b.LayerIndex,player.Character,setclipboard,toclipboard=saved.Count,saved.Cache,saved.Cells,saved.Layer,saved.Character,saved.Copy,saved.Alternate
 for _,key in ipairs(fields) do b[key]=old[key] end
 b:RefreshFailureUI()
end)()

;(function()
 local oldEnabled,oldState=enabled,RemoteCatalog.FishingStatus
 local height=fishInfo.Size.Y.Offset
 enabled=true;RemoteCatalog.SetFishingStatus(cycleId,'Waiting for fish...',nil,true)
 RemoteCatalog.FishingStatus.At=os.clock()-5;updateBoard()
 assert(string.find(fishInfo.Text,'Waiting for fish...',1,true) and fishInfo.Text:match('^%[%d+s%]'),'existing board updates must refresh elapsed fishing status')
 assert(fishInfo.Size.Y.Offset==height and fishInfo.Position.Y.Offset+height<=baitToggle.Position.Y.Offset,'persistent fishing status must fit the original area without overlap')
 enabled=oldEnabled;RemoteCatalog.FishingStatus=oldState;RemoteCatalog.RefreshFishingStatus()
end)()

;(function()
 local r=RemoteCatalog
 r.StopAllAutomation();stepWorkers()
 assert(#hub.Tabs==13 and pages.Mobs==r.MobPage and #r.MobPage:GetChildren()>=2,'Mobs must have its own populated tab')
 assert(airflowTabs.Mobs._revealed,'native tab reveal must preserve closed mob dropdowns')
 local saved={Character=player.Character,Find=workspace.FindFirstChild,Recorder=r.Recorder,Start=r.StartCapture,Focus=UserInputService.GetFocusedTextBox}
 workspace.FindFirstChild=function() return nil end
 UserInputService.GetFocusedTextBox=function() return nil end
 r.Recorder=nil
 assert(r.MobInfo.Parent==r.MobToggle.Parent and r.MobInfo.Position.Y.Offset+r.MobInfo.Size.Y.Offset<=r.MobToggle.Position.Y.Offset,'the actual start blocker must be visible above the Start control')
 assert(r.MobCounters.Position.Y.Offset+r.MobCounters.Size.Y.Offset<=r.MobInfo.Parent.Size.Y.Offset,'run counters must fit in the same compact card')
 enabled=true;r.MobPage.CanvasPosition=Vector2.new(0,300);r.MobToggle.Activated:Fire()
 assert(not r.Mobs.Enabled and r.MobInfo.Text:find('Fishing is ON',1,true) and r.MobPage.CanvasPosition==Vector2.zero,'failed Start must reveal the precise blocking mode at the top of the page')
 enabled=false
 r.MobToggle.Activated:Fire()
 assert(not r.Mobs.Enabled and r.MobInfo.Text:find('Learn attack first',1,true),'Start without a learned attack must send nothing and explain setup')
 r.MobPage.CanvasPosition=Vector2.new(0,300);r.MobScan.Activated:Fire()
 assert(r.MobPage.CanvasPosition==Vector2.zero)
 assert(r.MobInfo.Text:find('0 living slimes',1,true) and not r.Mobs.Worker,'Scan must be read-only')
 r.MobRadius.Activated:Fire()
 assert(r.MobRadiusMenu.Menu.Visible and r.MobWalk.Position.Y.Offset>=r.MobRadiusMenu.Menu.Position.Y.Offset+r.MobRadiusMenu.Menu.Size.Y.Offset,'radius dropdown must push following controls down')
 r.MobRadiusMenu.Options[3].Activated:Fire()
 assert(r.Mobs.Radius==120 and not r.MobRadiusMenu.Menu.Visible)
 r.RefreshMobUI();r.MobRadius:GetPropertyChangedSignal('Text'):Fire()
 assert(r.MobRadius.Text:find('▼',1,true) and r.MobRadius:FindFirstChild('ChoiceChip').Visible,'board refresh must preserve the styled dropdown instead of replacing its arrow with an unsupported glyph')
  do
  local saved
  local previousWrite,previousEncode=writefile,HttpService.JSONEncode
  writefile=function() end
  HttpService.JSONEncode=function(_,data) saved=data;return 'preferences-json' end
  r.MobWalk.Activated:Fire();assert(r.Mobs.Walk and r.Mobs.Travel=='Teleport' and r.MobWalk.Text=='AUTO MOVE: TP HOPS','second move mode must be short teleport hops')
  assert(saved and saved.MobTravel=='Teleport' and saved.MobWalk==true and saved.MobRadius==r.Mobs.Radius,'mob move mode must be saved with preferences')
  writefile,HttpService.JSONEncode=previousWrite,previousEncode
 end
 r.MobWalk.Activated:Fire();assert(not r.Mobs.Walk and r.MobWalk.Text=='AUTO MOVE: OFF');r.MobWalk.Activated:Fire();assert(r.Mobs.Walk and r.Mobs.Travel=='Walk')
 local weapon={Name='ironWarAxe'}
 local human={Health=100,MaxHealth=100}
 local root={Position={X=0,Y=0,Z=0}}
 local character={Parent=true,FindFirstChild=function(_,name) if name=='HumanoidRootPart' then return root end end,
  FindFirstChildOfClass=function(_,kind) if kind=='Tool' then return weapon elseif kind=='Humanoid' then return human end end}
 weapon.Parent=character;player.Character=character
 ;(function()
  local clip,alternate,copied=setclipboard,toclipboard,nil
  enabled=true
  r.Mobs.LastResult='{error=TOO_FAST, success=false}';r.Mobs.LastTarget='slimeBlue'
  setclipboard=function() return false end;toclipboard=function(value) copied=value end
  r.MobCopy.Activated:Fire()
  assert(copied and copied:find('Fishing is ON',1,true) and copied:find('TOO_FAST',1,true) and copied:find('slimeBlue',1,true) and not r.Mobs.Worker,'Copy result must include current blockers and the full error without starting a worker')
  toclipboard=function() error('clipboard unavailable') end;r.MobCopy.Activated:Fire()
  assert(status.Text:find('Mob result printed to console',1,true),'failed clipboard functions must fall back accurately to console')
  setclipboard,toclipboard=clip,alternate;enabled=false
 end)()
 local sends,learnCalls=0,0
 local learned={Records={},MaxCalls=100,RequestIds={},MobBinding={WeaponName='ironWarAxe',Remote={Parent=true}},CanUseMobBinding=function() return true end,
  MobHit=function() sends+=1;return true end,Stop=function(self) self.Stopped=true;self.LearnMobOnly=false end}
 r.StartCapture=function() learnCalls+=1;learned.Stopped=false;return learned end
 r.MobLearn.Activated:Fire()
 assert(learned.LearnMobOnly and learned.Active==false and sends==0,'Learn attack must wait for one manual hit without sending a request')
 r.MobStop.Activated:Fire();assert(not learned.LearnMobOnly and learned.Stopped,'Stop must cancel learning too')
 assert(r.MobToggle.Text=='START FARMING' and r.MobLearn.Text=='Relearn attack','ready attack must expose a clear Start action and label learning as optional relearning')
 ;(function()
  local find=character.FindFirstChildOfClass
  character.FindFirstChildOfClass=function(self,kind) if kind~='Tool' then return find(self,kind) end end
  r.MobLearn.Activated:Fire()
  assert(learnCalls==1 and r.MobInfo.Text:find('Attack already ready',1,true) and r.MobInfo.Text:find('START FARMING',1,true),'relearning without an equipped tool must not imply an existing valid binding is missing')
  character.FindFirstChildOfClass=find
 end)()
 r.MobToggle.Activated:Fire()
 assert(r.Mobs.Enabled and r.Mobs.Worker and sends==0 and r.MobInfo.Text:find('scanning continues',1,true),'empty native scan must stay ON without attacking: '..tostring(r.Mobs.Enabled)..' / '..tostring(r.MobInfo.Text))
 assert(not r.MobLearn.Active and r.BuildTravelBlocked():find('Auto Mobs',1,true),'combat must lock learning and compete explicitly with build walking')
 local radius=r.Mobs.Radius;r.MobRadiusMenu.Options[1].Activated:Fire();assert(r.Mobs.Radius==radius,'in-flight worker must lock setup edits')
 r.MobStop.Activated:Fire();assert(not r.Mobs.Enabled and r.Mobs.Worker and not r.MobToggle.Active,'Stop must keep Start locked until worker cleanup')
 stepWorkers();assert(not r.Mobs.Worker and r.MobToggle.Active)
 r.MobToggle.Activated:Fire();assert(r.Mobs.Enabled)
 setEnabled(true);assert(not r.Mobs.Enabled,'starting Fishing must stop combat immediately')
 setEnabled(false);stepWorkers()
 r.MobToggle.Activated:Fire();assert(r.Mobs.Enabled)
 r.StopAllAutomation();stepWorkers()
 assert(not r.Mobs.Enabled and not r.Mobs.Worker and not learned.LearnMobOnly,'Stop All must cancel combat and its navigation worker')
 ;(function()
  local denied,releases=true,0
  r.Mobs.Press={Tool={Deactivate=function() releases+=1;return not denied end}}
  setEnabled(true)
  assert(not enabled and r.Mobs.Press and releases==1 and status.Text:find('Weapon release pending',1,true),'another mode must not start while a previous native weapon activation cannot be released')
  denied=false;r.MobStop.Activated:Fire();assert(not r.Mobs.Press and releases==2)
 end)()

 assert(r.SessionReport():find('Mobs: OFF',1,true),'session report must include combat status and observed counters')
 player.Character=saved.Character;workspace.FindFirstChild=saved.Find;r.Recorder=saved.Recorder;r.StartCapture=saved.Start;UserInputService.GetFocusedTextBox=saved.Focus
 r.Mobs.Radius=60;r.RefreshMobUI()
end)()

local cleanupOptions={MobCopy=RemoteCatalog.MobCopy,MobToggle=RemoteCatalog.MobToggle,MobStop=RemoteCatalog.MobStop,Recipe=RemoteCatalog.CraftRecipeMenu.Options[1],Materials=RemoteCatalog.CraftMaterialsScopeMenu.Options[2],Import=RemoteCatalog.CraftImportButton,Export=RemoteCatalog.CraftExportButton,Repeat=buildController.Buttons.RepeatRight,QueueCheck=RemoteCatalog.CraftQueueCheckButton,RepeatUp=buildController.Buttons.RepeatUp,ChestImport=RemoteCatalog.ChestImportButton,ChestExport=RemoteCatalog.ChestExportButton,ChestCopy=RemoteCatalog.ChestCopySetupButton,Drop=RemoteCatalog.DropButton,DropStop=RemoteCatalog.DropStopButton,DropEvents={},SettingsQuick=RemoteCatalog.SettingsQuickButton,SettingsAdvanced=RemoteCatalog.SettingsAdvancedButton,DropTextBounds=RemoteCatalog.DropInfo:GetPropertyChangedSignal('TextBounds'),BuildFast=buildController.SpeedOptions[2],BuildPause=buildController.Buttons.Pause,BuildCopyAll=buildController.Buttons.CopyAllHistory,BuildRestock=buildController.Buttons.CopyMissing}
 ;(function()
 local oldPress,oldRelease,oldFocus,oldCharacter=keypress,keyrelease,UserInputService.GetFocusedTextBox,player.Character
 local events=cleanupOptions.DropEvents
 keypress=function() table.insert(events,'down') end;keyrelease=function() table.insert(events,'up') end
 UserInputService.GetFocusedTextBox=function() return nil end
 player.Character={Parent=true,FindFirstChildOfClass=function() return {Health=100} end,FindFirstChild=function() return {} end}
 assert(RemoteCatalog.SetDropEnabled(true) and events[1]=='down')
 keypress,keyrelease,UserInputService.GetFocusedTextBox,player.Character=oldPress,oldRelease,oldFocus,oldCharacter
 end)()
RemoteCatalog.StopTimerButton.Activated:Fire()
gui:Destroy();stepWorkers()
RemoteCatalog.Mobs.Start=function() error('mob Start survived GUI removal') end
RemoteCatalog.Mobs.Stop=function() error('mob Stop survived GUI removal') end
RemoteCatalog.CopyMobResult=function() error('mob Copy result survived GUI removal') end
cleanupOptions.MobToggle.Activated:Fire();cleanupOptions.MobStop.Activated:Fire();cleanupOptions.MobCopy.Activated:Fire()
assert(cleanupOptions.DropEvents[2]=='up' and not RemoteCatalog.DropEnabled and not RemoteCatalog.DropHeld and not RemoteCatalog.DropWorker,'destroying the hub must release Q and end the drop worker')
RemoteCatalog.SetDropEnabled=function() error('Q drop callback survived GUI removal') end
cleanupOptions.Drop.Activated:Fire();cleanupOptions.DropStop.Activated:Fire();UserInputService.WindowFocusReleased:Fire()
RemoteCatalog.LayoutSettings=function() error('settings layout callback survived GUI removal') end
cleanupOptions.SettingsQuick.Activated:Fire();cleanupOptions.SettingsAdvanced.Activated:Fire();cleanupOptions.DropTextBounds:Fire()
RemoteCatalog.CraftItem="cleanup-sentinel";cleanupOptions.Recipe.Activated:Fire()
assert(RemoteCatalog.CraftItem=="cleanup-sentinel","GUI cleanup must disconnect dynamic recipe option callbacks")
RemoteCatalog.CraftMaterialsScope="cleanup-sentinel";cleanupOptions.Materials.Activated:Fire()
assert(RemoteCatalog.CraftMaterialsScope=="cleanup-sentinel","GUI cleanup must disconnect material scope callbacks")
RemoteCatalog.ImportCraftQueue=function() error('import callback survived GUI removal') end
RemoteCatalog.ExportCraftQueue=function() error('export callback survived GUI removal') end
cleanupOptions.Import.Activated:Fire();cleanupOptions.Export.Activated:Fire()
buildController.RepeatLayout=function() error('repeat callback survived GUI removal') end;cleanupOptions.Repeat.Activated:Fire();cleanupOptions.RepeatUp.Activated:Fire()
buildController.SetBuildSpeed=function() error('speed callback survived GUI removal') end;cleanupOptions.BuildFast.Activated:Fire()
buildController.SetPaused=function() error('pause callback survived GUI removal') end;cleanupOptions.BuildPause.Activated:Fire()
buildController.CopyAllHistory=function() error('history export callback survived GUI removal') end;cleanupOptions.BuildCopyAll.Activated:Fire()
buildController.CopyMissingMaterials=function() error('restock export callback survived GUI removal') end;cleanupOptions.BuildRestock.Activated:Fire()
RemoteCatalog.CheckCraftQueue=function() error('queue-check callback survived GUI removal') end;cleanupOptions.QueueCheck.Activated:Fire()
RemoteCatalog.ImportChestSetup=function() error('chest import callback survived GUI removal') end
RemoteCatalog.ExportChestSetup=function() error('chest export callback survived GUI removal') end
cleanupOptions.ChestImport.Activated:Fire();cleanupOptions.ChestExport.Activated:Fire();cleanupOptions.ChestCopy.Activated:Fire()
assert(not RemoteCatalog.StopTimerDeadline,'destroying the hub must clear its timer')
assert(#connections==0,'cleanup must disconnect tracked listeners')
return 'Full application startup, real switch handlers/workers and cleanup passed without recorder or learned IDs'
`;
const state=await LuauState.createAsync();
try {console.log(await state.loadstring(setup+'\nlocal function runApplication()\n'+source+'\n'+checks+'\nend\nreturn runApplication()','full-startup',true)());}
catch(e) {console.error(String(e));process.exitCode=1;}
finally {state.destroy();}
