-- Idle-event driven; no input loop and no startup listener.
local AntiAFK={}
function AntiAFK.new(player,virtualUser,camera,changed)
    return setmetatable({Player=player,VirtualUser=virtualUser,Camera=camera,Changed=changed,Enabled=false}, {__index=AntiAFK})
end
function AntiAFK:SetEnabled(state)
    state=state==true and not self.Destroyed
    if self.Enabled==state then return self.Enabled end
    self.Enabled=state
    if self.Connection then self.Connection:Disconnect();self.Connection=nil end
    if state then
        local ok,connection=pcall(function()
            return self.Player.Idled:Connect(function()
                if not self.Enabled or self.Destroyed then return end
                local sent,failure=pcall(function()
                    local user=self.VirtualUser()
                    local camera=self.Camera()
                    if not camera then error("Camera unavailable") end
                    user:CaptureController()
                    user:ClickButton2(Vector2.zero,camera.CFrame)
                end)
                if not sent then
                    self:SetEnabled(false)
                    if self.Changed then self.Changed(false,"input unavailable") end
                elseif self.Changed then self.Changed(true,"idle response sent") end
            end)
        end)
        if not ok then
            self.Enabled=false
            if self.Changed then self.Changed(false,"idle event unavailable") end
            return false
        end
        self.Connection=connection
    end
    if self.Changed then self.Changed(self.Enabled) end
    return self.Enabled
end
function AntiAFK:Destroy()
    self:SetEnabled(false)
    self.Destroyed=true
end
return AntiAFK
