-- Minimal UI construction mock. It does not simulate Roblox rendering or networking.
local queue = {}
local function schedule(fn, ...) table.insert(queue, {fn, {...}}) end
local task = {defer=schedule, delay=function(_,fn,...) schedule(fn,...) end, spawn=schedule}
local function flush()
 local count=0
 while #queue>0 do
  count+=1; assert(count<2000,'task queue did not settle')
  local job=table.remove(queue,1);job[1](table.unpack(job[2]))
 end
end
local function signal()
 local s={listeners={}}
 function s:Connect(fn)
  local conn={Connected=true}
  function conn:Disconnect() self.Connected=false end
  table.insert(self.listeners,{fn,conn});return conn
 end
 function s:Fire(...)
  for _,v in ipairs(self.listeners) do if v[2].Connected then v[1](...) end end
 end
 return s
end
local vec
local vmt={}
vec=function(x,y) return setmetatable({X=x or 0,Y=y or 0},vmt) end
function vmt.__add(a,b) return vec(a.X+b.X,a.Y+b.Y) end
function vmt.__sub(a,b) return vec(a.X-b.X,a.Y-b.Y) end
function vmt.__mul(a,b)
 if type(b)=='number' then return vec(a.X*b,a.Y*b) end
 return vec(a.X*b.X,a.Y*b.Y)
end
function vmt.__div(a,b) return vec(a.X/b,a.Y/b) end
function vmt.__index(a,k)
 if k=='Magnitude' then return math.sqrt(a.X*a.X+a.Y*a.Y) end
 if k=='Lerp' then return function(self,b,t) return self+(b-self)*t end end
end
local Vector2={new=vec,zero=vec(0,0)}
local UDim={new=function(s,o) return {Scale=s,Offset=o} end}
local UDim2={new=function(xs,x,ys,y) return {X=UDim.new(xs,x),Y=UDim.new(ys,y)} end}
function UDim2.fromScale(x,y) return UDim2.new(x,0,y,0) end
function UDim2.fromOffset(x,y) return UDim2.new(0,x,0,y) end
local Color3={}
function Color3.new(r,g,b) return {R=r,G=g,B=b} end
function Color3.fromRGB(r,g,b) return Color3.new(r/255,g/255,b/255) end
local ColorSequence={new=function(...) return {...} end}
local ColorSequenceKeypoint=ColorSequence
local NumberSequence=ColorSequence
local NumberSequenceKeypoint=ColorSequence
local Rect={new=function(...) return {...} end}
local Font={new=function(...) return {...} end}
local TweenInfo={new=function(...) return {...} end}
local methods={}
local function allowed(cls,key)
 local c=API_CLASSES[cls]
 if not c then return false end
 return c.members[key] or allowed(c.super,key)
end
local defaults={Visible=true,Scale=1,Text='',TextSize=14,BackgroundTransparency=0,ImageTransparency=0}
local Instance={}
function Instance.new(cls)
 assert(API_CLASSES[cls],'unknown class '..cls)
 local data={ClassName=cls,Name=cls,Size=UDim2.fromOffset(0,0),Position=UDim2.fromOffset(0,0),AnchorPoint=vec(0,0),CanvasPosition=vec(0,0),_children={},_signals={}}
 local object={}
 setmetatable(object,{
  __index=function(_,key)
   if methods[key] then return methods[key] end
   if key=='AbsoluteSize' then return cls=='ScreenGui' and vec(1920,1080) or vec(720,470) end
   if key=='AbsolutePosition' then return vec(0,0) end
   if key=='TextBounds' then return vec(100,18) end
   if data[key]~=nil then return data[key] end
   if defaults[key]~=nil then return defaults[key] end
   if allowed(cls,key)=='Event' then
    data[key]=signal();return data[key]
   end
   return nil
  end,
  __newindex=function(_,key,value)
   assert(key:sub(1,1)=='_' or allowed(cls,key)=='Property','invalid '..cls..'.'..key)
   if key=='Parent' then
    assert(not data._dead or value==nil,'destroyed instance Parent is locked')
    if data.Parent then
     for i,c in ipairs(data.Parent._children) do if c==object then table.remove(data.Parent._children,i);break end end
     data.Parent.ChildRemoved:Fire(object)
    end
    data.Parent=value
    if value then table.insert(value._children,object);value.ChildAdded:Fire(object) end
   else data[key]=value end
  end
 })
 return object
end
function methods:IsA(cls)
 local current=self.ClassName
 while API_CLASSES[current] do
  if current==cls then return true end
  current=API_CLASSES[current].super
 end
 return false
end
function methods:GetChildren() return table.clone(self._children) end
function methods:GetDescendants()
 local result={}
 for _,child in ipairs(self:GetChildren()) do
  table.insert(result,child)
  for _,descendant in ipairs(child:GetDescendants()) do table.insert(result,descendant) end
 end
 return result
end
function methods:FindFirstChildOfClass(cls)
 for _,child in ipairs(self:GetChildren()) do if child.ClassName==cls then return child end end
end
function methods:FindFirstChild(name)
 for _,child in ipairs(self._children) do if child.Name==name then return child end end
end
function methods:WaitForChild(name) return assert(self:FindFirstChild(name),'missing child '..name) end
function methods:GetPropertyChangedSignal(name)
 assert(allowed(self.ClassName,name)=='Property','invalid property signal '..name)
 self._signals[name]=self._signals[name] or signal();return self._signals[name]
end
function methods:Destroy()
 if self._dead then return end
 self._dead=true;self.Destroying:Fire()
 for _,child in ipairs(self:GetChildren()) do child:Destroy() end
 self.Parent=nil
end
local playerGui=Instance.new('PlayerGui')
local player={PlayerGui=playerGui,CharacterAdded=signal(),Idled=signal()}
function player:FindFirstChildOfClass() return nil end
function player:WaitForChild(name) return assert(self[name]) end
local services={Players={LocalPlayer=player},UserInputService={TouchEnabled=false,KeyboardEnabled=true,InputBegan=signal(),InputChanged=signal(),InputEnded=signal(),WindowFocusReleased=signal()},RunService={RenderStepped=signal()},GuiService={},ReplicatedStorage={},HttpService={}}
function services.UserInputService:GetMouseLocation() return vec(300,300) end
services.TweenService={Create=function(_,object,_,props)
 return {Completed=signal(),Play=function() for k,v in pairs(props) do object[k]=v end end}
end}
local game={FindFirstChild=function(_,name) return services[name] end,GetService=function(_,name) return services[name] or {} end}
local workspace={CurrentCamera={ViewportSize=vec(1920,1080)}}
