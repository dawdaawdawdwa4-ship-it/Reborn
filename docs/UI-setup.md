# Farming Hub UI

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

## Supplied full script

`Insane_version_clean.lua` is the full user-uploaded script with a focused fix for
`_NetManaged is not a valid member of ModuleScript ...net.out`. Use this file when
running that full setup; `message.txt` remains the separate Farming Hub script.
The remote adapter uses child lookups rather than indexing `_NetManaged`, prefers
that group when present, and otherwise finds exact remote names beneath `out`.
It does not require the `out` module or guess obfuscated remote names. Missing
remotes are recorded, and initial lookups share a five-second wait budget.

`npm --prefix tests test` also tests this adapter with missing paths/groups,
renamed grouping folders, literal slash names, remote types, delayed replication,
and the shared startup timeout. The full 2.6 MB supplied script exceeds the local
WASM compiler's memory limit; only the changed resolver block was compiled and
executed. Existing script behavior and live server calls remain unverified.
