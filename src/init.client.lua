local AutoFarmUI = require(script.Parent.AutoFarmUI)

local ui = AutoFarmUI.new()

ui:OnPathfinderToggle(function(enabled)
	print("[AutoFarm] Pathfinder:", enabled and "ON" or "OFF")
end)

ui:OnAutoHitToggle(function(enabled)
	print("[AutoFarm] Auto Hit:", enabled and "ENABLED" or "DISABLED")
end)

ui:OnTargetMobChanged(function(mobName, checked)
	print("[AutoFarm] Target", mobName, ":", checked)
end)

ui:OnOrbitDistanceChanged(function(val)
	print("[AutoFarm] Orbit Distance:", val)
end)

ui:OnWalkSpeedChanged(function(val)
	print("[AutoFarm] WalkSpeed:", val)
end)
