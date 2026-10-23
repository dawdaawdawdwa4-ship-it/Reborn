local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Icon
local success = pcall(function()
	local iconModule = ReplicatedStorage:FindFirstChild("Icon")
		or ReplicatedStorage:FindFirstChild("TopbarPlus")
	if iconModule then
		Icon = require(iconModule)
	end
end)
if not success then
	Icon = nil
end

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local AutoFarmUI = {}
AutoFarmUI.__index = AutoFarmUI

-- Theme
local Theme = {
	Background = Color3.fromRGB(20, 15, 30),
	Surface = Color3.fromRGB(30, 25, 45),
	SurfaceHover = Color3.fromRGB(40, 35, 55),
	Primary = Color3.fromRGB(120, 60, 200),
	PrimaryBright = Color3.fromRGB(150, 80, 255),
	Accent = Color3.fromRGB(200, 50, 200),
	Green = Color3.fromRGB(40, 180, 80),
	GreenDark = Color3.fromRGB(30, 140, 60),
	Text = Color3.fromRGB(255, 255, 255),
	TextMuted = Color3.fromRGB(180, 170, 200),
	Border = Color3.fromRGB(180, 50, 220),
	SliderTrack = Color3.fromRGB(50, 40, 70),
	SliderFill = Color3.fromRGB(120, 60, 200),
	SliderFillEnd = Color3.fromRGB(200, 80, 200),
	CheckOn = Color3.fromRGB(120, 60, 200),
	CheckOff = Color3.fromRGB(60, 50, 80),
}

local FONT = Enum.Font.GothamBold
local FONT_MEDIUM = Enum.Font.GothamMedium
local FONT_REGULAR = Enum.Font.Gotham

-- State
local state = {
	activeTab = "Pathfinder",
	pathfinderEnabled = false,
	orbitTarget = "None",
	targetMobs = {
		Slimes = true,
		Buffalkor = false,
		Wizards = false,
		["Skorpian (all variants)"] = false,
	},
	orbitDistance = 17,
	walkSpeed = 27,
	autoHitEnabled = false,
}

local callbacks = {
	onPathfinderToggle = nil,
	onAutoHitToggle = nil,
	onTargetMobChanged = nil,
	onOrbitDistanceChanged = nil,
	onWalkSpeedChanged = nil,
}

local function create(class, props, children)
	local inst = Instance.new(class)
	for k, v in pairs(props) do
		if k ~= "Parent" then
			inst[k] = v
		end
	end
	if children then
		for _, child in ipairs(children) do
			child.Parent = inst
		end
	end
	if props.Parent then
		inst.Parent = props.Parent
	end
	return inst
end

local function addCorner(parent, radius)
	return create("UICorner", { CornerRadius = UDim.new(0, radius or 8), Parent = parent })
end

local function addStroke(parent, color, thickness)
	return create("UIStroke", {
		Color = color or Theme.Border,
		Thickness = thickness or 2,
		Parent = parent,
	})
end

local function addPadding(parent, t, b, l, r)
	return create("UIPadding", {
		PaddingTop = UDim.new(0, t or 10),
		PaddingBottom = UDim.new(0, b or 10),
		PaddingLeft = UDim.new(0, l or 12),
		PaddingRight = UDim.new(0, r or 12),
		Parent = parent,
	})
end

local function addGradient(parent, c1, c2)
	return create("UIGradient", {
		Color = ColorSequence.new(c1, c2),
		Parent = parent,
	})
end

local function tweenColor(obj, prop, target, duration)
	local tween = TweenService:Create(obj, TweenInfo.new(duration or 0.2, Enum.EasingStyle.Quad), { [prop] = target })
	tween:Play()
	return tween
end

-- Slider widget
-- connections: the owning UI's list, so Destroy can disconnect the global input listeners.
local function createSlider(parent, label, min, max, initial, onChange, connections)
	local container = create("Frame", {
		Size = UDim2.new(1, 0, 0, 50),
		BackgroundTransparency = 1,
		Parent = parent,
	})

	local valueLabel = create("TextLabel", {
		Size = UDim2.new(1, 0, 0, 18),
		BackgroundTransparency = 1,
		Text = label .. ": " .. tostring(initial),
		TextColor3 = Theme.Text,
		Font = FONT_MEDIUM,
		TextSize = 14,
		TextXAlignment = Enum.TextXAlignment.Left,
		Parent = container,
	})

	local trackFrame = create("Frame", {
		Position = UDim2.new(0, 0, 0, 26),
		Size = UDim2.new(1, 0, 0, 10),
		BackgroundColor3 = Theme.SliderTrack,
		Parent = container,
	})
	addCorner(trackFrame, 5)

	local fillFrame = create("Frame", {
		Size = UDim2.new((initial - min) / (max - min), 0, 1, 0),
		BackgroundColor3 = Theme.SliderFill,
		Parent = trackFrame,
	})
	addCorner(fillFrame, 5)
	addGradient(fillFrame, Theme.SliderFill, Theme.SliderFillEnd)

	local thumb = create("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.new((initial - min) / (max - min), 0, 0.5, 0),
		Size = UDim2.new(0, 16, 0, 16),
		BackgroundColor3 = Theme.PrimaryBright,
		Parent = trackFrame,
	})
	addCorner(thumb, 8)

	local dragging = false

	local function update(input)
		local trackPos = trackFrame.AbsolutePosition.X
		local trackSize = trackFrame.AbsoluteSize.X
		local rel = math.clamp((input.Position.X - trackPos) / trackSize, 0, 1)
		local val = math.floor(min + rel * (max - min))

		fillFrame.Size = UDim2.new(rel, 0, 1, 0)
		thumb.Position = UDim2.new(rel, 0, 0.5, 0)
		valueLabel.Text = label .. ": " .. tostring(val)

		if onChange then
			onChange(val)
		end
	end

	trackFrame.InputBegan:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
			dragging = true
			update(input)
		end
	end)

	table.insert(connections, UserInputService.InputChanged:Connect(function(input)
		if dragging and (input.UserInputType == Enum.UserInputType.MouseMovement or input.UserInputType == Enum.UserInputType.Touch) then
			update(input)
		end
	end))

	table.insert(connections, UserInputService.InputEnded:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
			dragging = false
		end
	end))

	return container
end

-- Checkbox widget
local function createCheckbox(parent, label, checked, onChange)
	local container = create("Frame", {
		Size = UDim2.new(1, 0, 0, 28),
		BackgroundTransparency = 1,
		Parent = parent,
	})

	local box = create("Frame", {
		Size = UDim2.new(0, 22, 0, 22),
		Position = UDim2.new(0, 0, 0.5, -11),
		BackgroundColor3 = checked and Theme.CheckOn or Theme.CheckOff,
		Parent = container,
	})
	addCorner(box, 4)

	local checkmark = create("TextLabel", {
		Size = UDim2.new(1, 0, 1, 0),
		BackgroundTransparency = 1,
		Text = checked and "\226\156\147" or "",
		TextColor3 = Theme.Text,
		Font = FONT,
		TextSize = 14,
		Parent = box,
	})

	local textLabel = create("TextLabel", {
		Size = UDim2.new(1, -32, 1, 0),
		Position = UDim2.new(0, 32, 0, 0),
		BackgroundTransparency = 1,
		Text = label,
		TextColor3 = Theme.Text,
		Font = FONT_REGULAR,
		TextSize = 14,
		TextXAlignment = Enum.TextXAlignment.Left,
		Parent = container,
	})

	local btn = create("TextButton", {
		Size = UDim2.new(1, 0, 1, 0),
		BackgroundTransparency = 1,
		Text = "",
		Parent = container,
	})

	local isChecked = checked
	btn.MouseButton1Click:Connect(function()
		isChecked = not isChecked
		box.BackgroundColor3 = isChecked and Theme.CheckOn or Theme.CheckOff
		checkmark.Text = isChecked and "\226\156\147" or ""
		if onChange then
			onChange(isChecked)
		end
	end)

	return container
end

-- Toggle button widget
local function createToggleButton(parent, labelOn, labelOff, enabled, colorOn, colorOff, onChange)
	local btn = create("TextButton", {
		Size = UDim2.new(1, 0, 0, 38),
		BackgroundColor3 = enabled and (colorOn or Theme.Green) or (colorOff or Theme.Surface),
		Text = enabled and labelOn or labelOff,
		TextColor3 = Theme.Text,
		Font = FONT,
		TextSize = 15,
		AutoButtonColor = false,
		Parent = parent,
	})
	addCorner(btn, 8)

	local isEnabled = enabled
	btn.MouseButton1Click:Connect(function()
		isEnabled = not isEnabled
		tweenColor(btn, "BackgroundColor3", isEnabled and (colorOn or Theme.Green) or (colorOff or Theme.Surface))
		btn.Text = isEnabled and labelOn or labelOff
		if onChange then
			onChange(isEnabled)
		end
	end)

	return btn
end

function AutoFarmUI.new()
	local self = setmetatable({}, AutoFarmUI)
	self._connections = {}
	self:_build()
	return self
end

function AutoFarmUI:_build()
	-- ScreenGui
	self.screenGui = create("ScreenGui", {
		Name = "AutoFarmGui",
		ResetOnSpawn = false,
		ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
		Parent = playerGui,
	})

	-- Main frame
	local mainFrame = create("Frame", {
		Name = "MainFrame",
		AnchorPoint = Vector2.new(0, 0.5),
		Position = UDim2.new(0, 16, 0.5, 0),
		Size = UDim2.new(0, 300, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundColor3 = Theme.Background,
		Parent = self.screenGui,
	})
	addCorner(mainFrame, 12)
	addStroke(mainFrame, Theme.Border, 2)
	self.mainFrame = mainFrame

	local mainLayout = create("UIListLayout", {
		SortOrder = Enum.SortOrder.LayoutOrder,
		Padding = UDim.new(0, 0),
		Parent = mainFrame,
	})

	-- Title bar
	local titleBar = create("Frame", {
		Size = UDim2.new(1, 0, 0, 46),
		BackgroundTransparency = 1,
		LayoutOrder = 0,
		Parent = mainFrame,
	})
	addPadding(titleBar, 12, 8, 14, 14)

	create("TextLabel", {
		Size = UDim2.new(1, 0, 1, 0),
		BackgroundTransparency = 1,
		Text = "\240\159\140\190 AUTO FARM",
		TextColor3 = Theme.Text,
		Font = FONT,
		TextSize = 18,
		TextXAlignment = Enum.TextXAlignment.Left,
		Parent = titleBar,
	})

	-- Close button
	local closeBtn = create("TextButton", {
		AnchorPoint = Vector2.new(1, 0.5),
		Position = UDim2.new(1, 0, 0.5, 0),
		Size = UDim2.new(0, 24, 0, 24),
		BackgroundTransparency = 1,
		Text = "\226\156\149",
		TextColor3 = Theme.TextMuted,
		Font = FONT,
		TextSize = 16,
		Parent = titleBar,
	})

	-- Make draggable
	local dragging, dragStart, startPos
	titleBar.InputBegan:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
			dragging = true
			dragStart = input.Position
			startPos = mainFrame.Position
		end
	end)
	table.insert(self._connections, UserInputService.InputChanged:Connect(function(input)
		if dragging and (input.UserInputType == Enum.UserInputType.MouseMovement or input.UserInputType == Enum.UserInputType.Touch) then
			local delta = input.Position - dragStart
			mainFrame.Position = UDim2.new(
				startPos.X.Scale, startPos.X.Offset + delta.X,
				startPos.Y.Scale, startPos.Y.Offset + delta.Y
			)
		end
	end))
	table.insert(self._connections, UserInputService.InputEnded:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
			dragging = false
		end
	end))

	-- Tab bar
	local tabContainer = create("Frame", {
		Size = UDim2.new(1, 0, 0, 46),
		BackgroundTransparency = 1,
		LayoutOrder = 1,
		Parent = mainFrame,
	})
	addPadding(tabContainer, 0, 6, 12, 12)

	local tabLayout = create("UIListLayout", {
		FillDirection = Enum.FillDirection.Horizontal,
		SortOrder = Enum.SortOrder.LayoutOrder,
		Padding = UDim.new(0, 6),
		Parent = tabContainer,
	})

	local pathfinderTab = create("TextButton", {
		Size = UDim2.new(0.5, -3, 0, 36),
		BackgroundColor3 = Theme.Primary,
		Text = "PATHFINDER",
		TextColor3 = Theme.Text,
		Font = FONT,
		TextSize = 14,
		AutoButtonColor = false,
		LayoutOrder = 0,
		Parent = tabContainer,
	})
	addCorner(pathfinderTab, 8)

	local fishingTab = create("TextButton", {
		Size = UDim2.new(0.5, -3, 0, 36),
		BackgroundColor3 = Theme.Surface,
		Text = "FISHING",
		TextColor3 = Theme.Text,
		Font = FONT,
		TextSize = 14,
		AutoButtonColor = false,
		LayoutOrder = 1,
		Parent = tabContainer,
	})
	addCorner(fishingTab, 8)

	-- Content area
	local contentFrame = create("Frame", {
		Size = UDim2.new(1, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundTransparency = 1,
		LayoutOrder = 2,
		Parent = mainFrame,
	})
	addPadding(contentFrame, 4, 10, 12, 12)

	local contentLayout = create("UIListLayout", {
		SortOrder = Enum.SortOrder.LayoutOrder,
		Padding = UDim.new(0, 8),
		Parent = contentFrame,
	})

	-- Pathfinder page
	self.pathfinderPage = create("Frame", {
		Size = UDim2.new(1, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundTransparency = 1,
		LayoutOrder = 0,
		Parent = contentFrame,
	})

	local pfLayout = create("UIListLayout", {
		SortOrder = Enum.SortOrder.LayoutOrder,
		Padding = UDim.new(0, 8),
		Parent = self.pathfinderPage,
	})

	-- Pathfinder section card
	local pfCard = create("Frame", {
		Size = UDim2.new(1, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundColor3 = Theme.Surface,
		LayoutOrder = 0,
		Parent = self.pathfinderPage,
	})
	addCorner(pfCard, 10)
	addPadding(pfCard, 10, 12, 12, 12)

	local pfCardLayout = create("UIListLayout", {
		SortOrder = Enum.SortOrder.LayoutOrder,
		Padding = UDim.new(0, 8),
		Parent = pfCard,
	})

	-- Section header
	create("TextLabel", {
		Size = UDim2.new(1, 0, 0, 18),
		BackgroundTransparency = 1,
		Text = "PATHFINDER",
		TextColor3 = Theme.TextMuted,
		Font = FONT,
		TextSize = 12,
		TextXAlignment = Enum.TextXAlignment.Left,
		LayoutOrder = 0,
		Parent = pfCard,
	})

	-- Pathfinder toggle
	createToggleButton(pfCard, "PATHFINDER \194\183 ON", "PATHFINDER \194\183 OFF", state.pathfinderEnabled, Theme.Primary, Theme.Surface, function(enabled)
		state.pathfinderEnabled = enabled
		if callbacks.onPathfinderToggle then
			callbacks.onPathfinderToggle(enabled)
		end
	end).LayoutOrder = 1

	-- Orbiting label
	self.orbitLabel = create("TextLabel", {
		Size = UDim2.new(1, 0, 0, 18),
		BackgroundTransparency = 1,
		Text = "Orbiting: " .. state.orbitTarget,
		TextColor3 = Theme.TextMuted,
		Font = FONT_REGULAR,
		TextSize = 13,
		TextXAlignment = Enum.TextXAlignment.Left,
		LayoutOrder = 2,
		Parent = pfCard,
	})

	-- Target mobs header
	create("TextLabel", {
		Size = UDim2.new(1, 0, 0, 22),
		BackgroundTransparency = 1,
		Text = "TARGET MOBS",
		TextColor3 = Theme.Text,
		Font = FONT,
		TextSize = 13,
		TextXAlignment = Enum.TextXAlignment.Left,
		LayoutOrder = 3,
		Parent = pfCard,
	})

	-- Checkboxes
	local mobOrder = { "Slimes", "Buffalkor", "Wizards", "Skorpian (all variants)" }
	for i, mobName in ipairs(mobOrder) do
		local cb = createCheckbox(pfCard, mobName, state.targetMobs[mobName], function(checked)
			state.targetMobs[mobName] = checked
			if callbacks.onTargetMobChanged then
				callbacks.onTargetMobChanged(mobName, checked)
			end
		end)
		cb.LayoutOrder = 3 + i
	end

	-- Orbit distance slider
	local orbitSlider = createSlider(pfCard, "Orbit Distance", 5, 50, state.orbitDistance, function(val)
		state.orbitDistance = val
		if callbacks.onOrbitDistanceChanged then
			callbacks.onOrbitDistanceChanged(val)
		end
	end, self._connections)
	orbitSlider.LayoutOrder = 10

	-- Walk speed slider
	local walkSlider = createSlider(pfCard, "WalkSpeed", 16, 100, state.walkSpeed, function(val)
		state.walkSpeed = val
		if callbacks.onWalkSpeedChanged then
			callbacks.onWalkSpeedChanged(val)
		end
	end, self._connections)
	walkSlider.LayoutOrder = 11

	-- Fishing page (hidden by default)
	self.fishingPage = create("Frame", {
		Size = UDim2.new(1, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundTransparency = 1,
		Visible = false,
		LayoutOrder = 0,
		Parent = contentFrame,
	})

	local fishCard = create("Frame", {
		Size = UDim2.new(1, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundColor3 = Theme.Surface,
		Parent = self.fishingPage,
	})
	addCorner(fishCard, 10)
	addPadding(fishCard, 10, 12, 12, 12)

	create("TextLabel", {
		Size = UDim2.new(1, 0, 0, 40),
		BackgroundTransparency = 1,
		Text = "FISHING",
		TextColor3 = Theme.TextMuted,
		Font = FONT,
		TextSize = 14,
		Parent = fishCard,
	})

	-- Tab switching
	pathfinderTab.MouseButton1Click:Connect(function()
		state.activeTab = "Pathfinder"
		pathfinderTab.BackgroundColor3 = Theme.Primary
		fishingTab.BackgroundColor3 = Theme.Surface
		self.pathfinderPage.Visible = true
		self.fishingPage.Visible = false
	end)

	fishingTab.MouseButton1Click:Connect(function()
		state.activeTab = "Fishing"
		fishingTab.BackgroundColor3 = Theme.Primary
		pathfinderTab.BackgroundColor3 = Theme.Surface
		self.pathfinderPage.Visible = false
		self.fishingPage.Visible = true
	end)

	-- Auto Hit section card
	local autoHitCard = create("Frame", {
		Size = UDim2.new(1, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundColor3 = Theme.Surface,
		LayoutOrder = 10,
		Parent = contentFrame,
	})
	addCorner(autoHitCard, 10)
	addPadding(autoHitCard, 10, 12, 12, 12)

	local ahLayout = create("UIListLayout", {
		SortOrder = Enum.SortOrder.LayoutOrder,
		Padding = UDim.new(0, 8),
		Parent = autoHitCard,
	})

	create("TextLabel", {
		Size = UDim2.new(1, 0, 0, 18),
		BackgroundTransparency = 1,
		Text = "AUTO HIT",
		TextColor3 = Theme.TextMuted,
		Font = FONT,
		TextSize = 12,
		TextXAlignment = Enum.TextXAlignment.Left,
		LayoutOrder = 0,
		Parent = autoHitCard,
	})

	createToggleButton(autoHitCard, "AUTO HIT \194\183 ENABLED", "AUTO HIT \194\183 DISABLED", state.autoHitEnabled, Theme.Green, Theme.Surface, function(enabled)
		state.autoHitEnabled = enabled
		if callbacks.onAutoHitToggle then
			callbacks.onAutoHitToggle(enabled)
		end
	end).LayoutOrder = 1

	-- Show/hide helpers
	local function showPanel()
		mainFrame.Visible = true
		mainFrame.AutomaticSize = Enum.AutomaticSize.Y
		mainFrame.BackgroundTransparency = 1
		TweenService:Create(mainFrame, TweenInfo.new(0.25, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
			BackgroundTransparency = 0,
		}):Play()
	end

	local function hidePanel()
		local tween = TweenService:Create(mainFrame, TweenInfo.new(0.15, Enum.EasingStyle.Quad, Enum.EasingDirection.In), {
			BackgroundTransparency = 1,
		})
		tween:Play()
		tween.Completed:Connect(function(playbackState)
			-- A quick reopen cancels this tween; only a finished hide may hide the panel.
			if playbackState == Enum.PlaybackState.Completed then
				mainFrame.Visible = false
			end
		end)
	end

	-- TopbarPlus integration (optional)
	if Icon then
		mainFrame.Visible = false

		self.icon = Icon.new()
			:setName("AutoFarm")
			:setImage("rbxassetid://7733960981")
			:setLabel("Auto Farm")
			:setOrder(1)

		self.icon:bindEvent("toggled", function(icon)
			if icon.isSelected then
				showPanel()
			else
				hidePanel()
			end
		end)

		closeBtn.MouseButton1Click:Connect(function()
			self.icon:deselect()
		end)
	else
		-- No TopbarPlus: show panel immediately, close button hides it,
		-- press RightControl to toggle
		mainFrame.Visible = true

		local panelOpen = true
		closeBtn.MouseButton1Click:Connect(function()
			panelOpen = false
			hidePanel()
		end)

		table.insert(self._connections, UserInputService.InputBegan:Connect(function(input, processed)
			if processed then return end
			if input.KeyCode == Enum.KeyCode.RightControl then
				panelOpen = not panelOpen
				if panelOpen then
					showPanel()
				else
					hidePanel()
				end
			end
		end))
	end
end

function AutoFarmUI:SetOrbitTarget(name)
	state.orbitTarget = name or "None"
	if self.orbitLabel then
		self.orbitLabel.Text = "Orbiting: " .. state.orbitTarget
	end
end

function AutoFarmUI:GetState()
	return state
end

function AutoFarmUI:OnPathfinderToggle(fn)
	callbacks.onPathfinderToggle = fn
end

function AutoFarmUI:OnAutoHitToggle(fn)
	callbacks.onAutoHitToggle = fn
end

function AutoFarmUI:OnTargetMobChanged(fn)
	callbacks.onTargetMobChanged = fn
end

function AutoFarmUI:OnOrbitDistanceChanged(fn)
	callbacks.onOrbitDistanceChanged = fn
end

function AutoFarmUI:OnWalkSpeedChanged(fn)
	callbacks.onWalkSpeedChanged = fn
end

function AutoFarmUI:Destroy()
	for _, connection in ipairs(self._connections or {}) do
		connection:Disconnect()
	end
	self._connections = {}
	if self.icon then
		self.icon:destroy()
	end
	if self.screenGui then
		self.screenGui:Destroy()
	end
end

return AutoFarmUI
