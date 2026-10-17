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
Roblox mocks. It checks that all seven tabs have content, switches tabs, closes and
reopens the hub, and exercises resize/reset. The reduced Roblox API name fixture
comes from MaximumADHD/Roblox-Client-Tracker's `roblox/API-Dump.json`, retrieved
2026-10-17; the mock rejects invalid initialization properties and property signals.
Mocks do not validate actual rendering, input routing, or server interactions.

In Roblox Studio, put the contents of `message.txt` into a LocalScript under
StarterPlayerScripts in your own experience. Verify that the seven tabs render,
scrolling/clicking does not drag the hub, dragging the header works, the corner
handle resizes, RightControl and the floating button reopen the closed window,
and Settings > Reset view restores its original size and centered position.

## Remote reference

`Remotes-reborn.txt` preserves the user's additional capture as reference.
All 129 unique captured paths and their remote classes are included in the
standalone script's RemoteCatalog. The Remotes tab shows which ones resolve and
provides a Refresh button. Lookups tolerate missing roots and _NetManaged, and
use exact-name/type discovery under out for renamed grouping folders. Discovery
does not invoke any server methods. Existing captured legacy request formats now
use the same safe path resolver rather than chained WaitForChild calls.

Remote names and paths alone do not specify argument formats. The named mining,
harvesting, planting, hotbar and fishing requests cannot yet be called correctly
from this capture. Existing obfuscated payloads are kept on their original legacy
remotes; they are not sent to similarly named remotes as guessed substitutes.
To finish those action bindings, capture a manual action's InvokeServer/FireServer
call and full argument structure for each requested function. Live game checks
remain necessary even after an argument capture is available.

## Capture request arguments

`tools/CaptureRemotes.lua` records outgoing mining, harvesting, planting, fishing,
hotbar, and bait calls. It requires host-provided `hookmetamethod` and
`getnamecallmethod`; ordinary Roblox Studio LocalScripts cannot intercept calls
from other scripts. It does not send or replay requests, and preserves the original
arguments, return values, and errors. Names are filtered to the relevant requests
and the existing legacy names; unrelated requests are passed through silently.

Run the recorder, then perform one action manually at a time (mine, harvest,
plant, cast/reel). F8 pauses/resumes, F9 prints and exports, F10 stops. When the
host provides `writefile` and `isfile`, F9 writes a new, uniquely named
`Reborn-remotes-<timestamp>-<index>.lua` in that host's file workspace. Otherwise
copy the call blocks from the console. Send the resulting capture file or console
text. The export is reference data, not a script to execute.

Capture is capped at 100 calls. Oversized/cyclic/unsupported argument data and
unparented instances are explicitly marked INCOMPLETE. Stopping disables the
recorder and disconnects its hotkey listener; its interception wrapper remains
pass-through so it does not overwrite hooks installed by other tools.
The mock tests verify interception semantics; live host compatibility is untested.
