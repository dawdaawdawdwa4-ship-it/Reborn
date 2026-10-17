# Farming Hub UI

The uploaded Insane script is a reference for the UI layout only. Farming Hub
remains the application; do not add the full reference script or its gameplay code.

`message.txt` is the standalone Roblox LocalScript. It embeds only the Airflow UI
library section from the user-provided `Insane_version_clean (1).lua`; the uploaded
trading, bootstrap, automation, and remote-execution code is not imported.

The hub uses Airflow's sidebar, tab transitions, drag, corner resize handle,
RightControl shortcut, close button, and floating reopen button. Existing farming
callbacks remain attached to their controls. Settings also offers size and reset
buttons. Pages are registered as controls so interacting with them does not drag
the window. The GUI is parented to PlayerGui for ordinary LocalScript use.

## Validation

With Node.js available:

```sh
npm ci --prefix tests
npm --prefix tests test
```

The test compiles all three scripts and constructs the full Farming Hub UI using
Roblox mocks. It checks that all six tabs have content, switches tabs, closes and
reopens the hub, and exercises resize/reset. The reduced Roblox API name fixture
comes from MaximumADHD/Roblox-Client-Tracker's `roblox/API-Dump.json`, retrieved
2026-10-17; the mock rejects invalid initialization properties and property signals.
Mocks do not validate actual rendering, input routing, or server interactions.

In Roblox Studio, put the contents of `message.txt` into a LocalScript under
StarterPlayerScripts in your own experience. Verify that the six tabs render,
scrolling/clicking does not drag the hub, dragging the header works, the corner
handle resizes, RightControl and the floating button reopen the closed window,
and Settings > Reset view restores its original size and centered position.

## Remote reference

`Remotes-reborn.txt` preserves the user's additional capture as reference.
Remote names and paths alone do not specify argument formats or prove that calls
work. This UI migration does not replace or add remote calls from that list.
