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

The test compiles the hub, both src scripts, and the recorder and constructs the full Farming Hub UI using
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

Remote names alone do not specify argument formats. The subsequent call captures
now document four legacy request formats (see `captured-protocols.md`): mining,
placement, bait and hotbar. These use current-session IDs learned by the embedded
recorder separately for each remote. There is no fallback to a fixed old ID.
Crop harvest is documented by the subsequent Cobalt snippet in `captured-protocols.md`; direct fishing remote argument captures remain missing. The
existing fishing input workflow is separate from direct remote calls.

## Capture request arguments

`message.txt` embeds the recorder, OFF by default. No second script is
needed; Remotes > Start capture enables optional recording. The Remotes tab provides pause/resume, export and stop controls, plus
recording status and the observed mining-ID status. Removing the hub stops its
recorder. Without working hook APIs the UI remains usable and explains that
capture is unavailable.

`tools/CaptureRemotes.lua` is the recorder source and records outgoing mining, harvesting, planting, fishing,
hotbar, and bait calls. It requires host-provided `hookmetamethod` and
`getnamecallmethod`; ordinary Roblox Studio LocalScripts cannot intercept calls
from other scripts. It does not send or replay requests, and preserves the original
arguments, return values, and errors. Names are filtered to the relevant requests
and the existing legacy names; unrelated requests are passed through silently.

Run Farming Hub, then perform one action manually at a time (mine, harvest,
plant, cast/reel). F8 pauses/resumes, F9 prints and exports, F10 stops. When the
host provides `writefile` and `isfile`, F9 writes a new, uniquely named
`Reborn-remotes-<timestamp>-<index>.lua` in that host's file workspace. Otherwise
copy the call blocks from the console. Send the resulting capture file or console
text. The export is reference data, not a script to execute.

Capture is capped at 100 calls. Oversized/cyclic/unsupported argument data and
unparented instances are explicitly marked INCOMPLETE. Stopping disables capture and makes the hook pass-through. Rerunning the current version
resumes the existing recorder, preserving records without adding hooks or listeners.
Its one hotkey listener ignores input while stopped.
The mock tests verify interception semantics; live host compatibility is untested.


The recorder includes name, class, optional debug ID and position for detached
Instances in a `DetachedInstance({...})` diagnostic marker. These remain marked
INCOMPLETE: metadata is not a replacement for the real Instance and the exported
text must not be executed. Actual game calls retain their original Instance.

The recorded mining request confirms that its ID differs from the old fixed value.
Mining now reads the ID observed for OEzzgCCBzocxJw by the recorder in the current
session. Start Farming Hub and enable Mining. The game request API is preferred; only
legacy fallback needs Remotes > Start capture and one manually mined block.
No observed mining ID means no automatic mining request is sent. IDs are held only
in memory, per remote. Placement, bait and hotbar also use their own observed IDs;
the confirmed crop-harvest route is learned from a manual crop action; direct fishing payloads still need a capture.
This transport wiring is mock-tested; live mining is not verified here.

If an external loader reports HTTP 404, load this repository's `message.txt` from
branch `claude/gifted-fermi-4c277x`. The raw URLs for `message.txt` and
`tools/CaptureRemotes.lua` returned HTTP 200 during the update. The external loader
and its failing URL are not in this repository, so its original URL was not fixed.


When editing the recorder source, run `node scripts/embed-capture.mjs` to update
its embedded copy in `message.txt`. The test command checks that the two copies
match and exercises the integrated UI both with and without hook support.


The Remotes tab's **Kopiér alle kald** button copies every recorded call, with
arguments, to the clipboard. With no captured calls it explains what to do without
changing the clipboard. If clipboard access is absent or fails, it exports the
same complete dump to the existing file/console route. Calls not yet performed
cannot be included. Upgrading the recorder preserves earlier records and observed
request IDs from the same session.


## Harvest improvements and supplied client examples

The supplied block-placement behavior documents the game's `Requests.Client` API.
Placement now prefers `BLOCK_PLACE_REQUEST:CallServer({cframe, blockType})`; hotbar
layout uses `CLIENT_HOTBAR_LAYOUT_UPDATE:CallServer({layout})`, as shown by the
client-inventory-service example. A failed request is not retried through another
transport. Missing modules fall back to the recorded legacy route and per-remote
session IDs. Optional game modules are looked up without WaitForChild chains.

ToolMeta maps crop block names to seed Tools (for example blueFlowers to its seed
item). Existing inventory-service selection is used when available, including
zero-based hotbar slot 0. Already selected slots are not toggled off. Locked tools
and session-loading state are respected. There is no automatic hotbar rewrite
when enabling a farm. Vending and chest examples were inspected for relevance;
this change does not add trading or chest transfers.

Crop targeting is limited to the selected crop on the player's own island.
Saplings/seedlings and explicitly immature plants are skipped. Each mode uses its
own range. The nearest eligible target is processed first, with retries backed off
and cancellation checked between actions. Targets outside prompt reach are not
forced; all scan passes yield even when every candidate is out of reach.

The crop's enabled harvest ProximityPrompt is used where present. The prompt is
held for its configured duration and released even when Stop or an input error
interrupts it. If no suitable prompt exists, the recorder can learn a manually
observed harvest-named (or known legacy crop) request containing an actual crop
Instance in its model field. The argument snapshot preserves session context and
other fields, replacing only the target on future calls. Unsupported payload
shapes are not guessed.

Counters increase only after target removal, an explicit mature-to-unready
transition, or disappearance/disablement of the activated harvest prompt.
Unchanged targets after a successful transport do not increment the count.
Replanting happens only when the harvested plant was removed, uses its original
CFrame including rotation, and requires the cycle to still be active. Plants
regrowing in place are not planted over. Module placement support can eliminate
the manual placement-ID step. There is still no direct fishing-request capture.

`tools/FarmLogic.lua` is embedded into the single-script hub by
`node scripts/embed-farm.mjs`. Tests cover targeting, readiness, ranges, prompt
release, cancelled cycles, harvest confirmation, replanting, learned request
snapshots, game-module requests, seed mapping and inventory slot selection.
Mocks verify logic and API wiring; actual Roblox rendering/input/server behavior
remains unverified. Explicit readiness flags are used when available; unknown
numeric growth stages are not treated as proof of maturity.


The confirmed crop remote is now
`mEn0GOcgVLtb4o.COtnYCOPUThadM`, using the newly observed `iXwUW9mXJ8AVnK`
and `a1tIHk1Kl9GiE5` envelope. Reload the hub, harvest one crop manually with
capture running, then enable Crop Farm. A learned compatible remote takes
precedence over a prompt. No pasted session ID or child index is hard-coded.


## Switch, wood and fishing regressions

Recording is now opt-in and no hooks are installed during normal hub startup.
Stopping the recorder leaves its wrapper in immediate pass-through mode. All five
mode switches are tested with no recorder or learned IDs; they update their button
state before background jobs start. Background job errors reset the relevant
switches and show the actual error rather than leaving an apparently active mode.
A status helper previously declared below bait callbacks has been moved above
them so those callbacks capture the intended local function.

Harvest now prefers the game wrapper's `CLIENT_HARVEST_CROP_REQUEST` using the
supplied `{model, player}` body. Mining uses `BLOCK_HIT_REQUEST` with `{block}`.
Unavailable wrappers fall back to the learned/captured route. Server errors or
rejections do not trigger duplicate calls through another transport. This avoids a
manual-ID startup requirement when the game's module is available.

Nearby wood/mineral targeting is restored across island Blocks/Prefabs. Crops
remain scoped to the owned island. Wood detection also checks bounded nested
public resource folders below spawnPrefabs; container models holding individual
trees are not treated as a single tree target. Separate wood range remains in use.

The supplied fishing clips showed stop-after-five/no-bobber behavior. Fishing
input now moves the aim toward the equipped rod user's forward water area before
sending a charged 0.35-second cast and independent release. It avoids the hub's
screen rectangle, uses the game as input target, and retains a short reel press.
Balanced/Test allow two seconds for bobber creation, Fast 1.5, Safe four. Only
actual rod/fishing Tools pass the equipped-tool check. Bobber discovery supports
matching owned Models as well as BaseParts. Input errors and Stop always attempt
release; cancelled cycles do not count failed reels.

Tests exercise these input sequences, errors, cancellation, switch callbacks,
nearby public trees, module harvest/mining routing and rejection without fallback.
These are mock checks, not evidence of a successful live cast, harvest or tree cut.
After switching from an older injected script, restarting the client once gives a
clean baseline without any old recorder hooks; then load the updated message.txt.


## Inventory-only tool lookup

Resource-tool and seed selection now merges the character, Backpack, and
`InventoryService.getPlayerInventory(player).allTools` with instance deduplication.
The supplied PickBlock and inventory modules use this same owned-tool inventory;
a tool need not currently be parented to Backpack to be selectable. Auto Wood
therefore finds an owned axe stored only in that inventory and equips it through
the existing inventory client. No tools are created or granted.

`tests/full-startup.mjs` runs the complete script in the mock environment, including
its actual callback registration, worker entry points, OFF/ON/OFF transitions and
cleanup. It checks startup without a recorder or learned IDs, rather than only
checking the earlier UI construction prefix. Its no-character scenario validates
waiting-state behavior; it does not validate real Roblox server outcomes.

### Auto Build

The standalone hub has an Auto Build tab, defaulting to Farm plots (raised bed rows with a path column every third column). Platform, Wall and solid Stairs presets are also available. Set exact owned block names for beds/build and paths, dimensions and rotation, then Preview and Start build. Farm plots build the layout only; planting remains separate.

Preview parts are local, non-colliding and removed on Clear preview or hub cleanup. Placement uses the existing game request wrapper and captured fallback. Blocks are processed bottom up, existing occupied cells are skipped, and success requires an observed block after the request. The queue pauses outside normal reach without moving the player, stops after three consecutive failures, and is cancelled by Stop build, Stop All or hub destruction. Plans are capped at 300 blocks. Materials, support and island access remain subject to server rules.

Run `npm --prefix tests test` to check generated modules, blueprint planning, queue cancellation, occupied-cell skipping, unconfirmed/rejected requests, and complete hub startup. These mocks do not replace live Roblox validation of placement or preview alignment.

Mining/wood no longer require recorder context when the game's request module is unavailable: they can aim and click with the equipped tool. Face a nearby resource, keep the hub clear of it, and pause Fishing when using this input fallback. The range control is a scanning radius; it does not extend normal tool reach.

For the updated bait remote, start capture in Remotes, use bait manually once in the running session, then enable Auto Bait. Capture remains optional and off at startup. The observed session ID is retained in memory, not embedded in the script.

Fishing now offers 12/24/36-stud cast aim presets in its Fishing tab. For nearby shallow water, try 12; 24 remains the default. These change the aim point only, not the game's cast or bite limits. Reeling reuses the last aim position without the cast mouse-movement delay, but refuses to click if the hub now covers that position. Retries on the same bobber count as a single bite. After 45 seconds without a tug, fishing stops with a recovery message instead of remaining stuck; reel manually and check water/bait before restarting.

All automation starts OFF. Fishing and Auto Bait have independent manual switches; starting Fishing does not enable bait. Enabling Auto Bait attempts application immediately. Successful applications refresh after 60 seconds; unavailable bait/context retries after 5 seconds. Stopping Fishing leaves the manual bait setting unchanged. Stop All cancels both. When a live bait call is unavailable, Auto Bait now tries equipping and activating the bait tool, then restores the previous rod. The status calls this an activation attempt; server-side bait consumption is not confirmed by that attempt alone.

Bait tool fallback waits for rod input to finish and pauses fishing input while changing tools. Stop before activation prevents use; activation errors release the busy flag and attempt to restore the rod. The corner overlay labels failed attempts as “Retry in …” rather than showing the retry timer as an active bait duration. Native activation still needs validation in the live game; a learned current remote remains preferred.

### Resource interactions and Movement

Crop harvest now falls back to the visible game interaction: aim at an owned crop and press/release F when no native or learned request is available. Normal resource input requires a visible, unobstructed target in tool reach, with no text field focused and no UI blocking the target. Stop releases the key. Successful input still requires actual removal/readiness changes to count as a harvest. Pause Fishing when using these shared mouse controls.

Public resource discovery includes nested rock groups alongside trees. Model positions use rendered bounding boxes before falling back to pivots, avoiding far-away pivots in otherwise nearby resources. No automatic player movement is performed for targets outside normal reach.

The Movement tab provides optional walk-speed and jump-strength dropdowns, independent enable buttons, Reset, and window positioning/size controls. Jump settings respect Humanoid.UseJumpPower; original values are saved per character. Enabled options follow respawns, while Reset, Stop All and hub cleanup restore the current character's original values. Server rules can override local movement settings.

Auto Build now uses a blueprint dropdown and matching material input colors. For the new placement envelope, start capture and place a block manually once in the live session before running a blueprint when the native module is unavailable. Tests cover argument preservation/rejection, F-key release and focused-field protection, nested rock ordering, and movement reset across respawns. Live Roblox execution is still required to verify game interaction behavior.

### Blueprint movement and resource boards

Auto Build → Move blueprint opens grid-step controls for left/right, forward/back and up/down, plus Reset blueprint offset. These move both the ghost and actual queued CFrames along the preview's axes. Offsets survive preview refresh; movement is blocked during an active build. Character movement remains a separate tab.

The corner board follows Fishing, Wood Farm, Mining or Harvest tabs. Resources keep independent confirmed totals, attempts and last-collected names; rates use overall active session time. Successful transport or an axe swing alone never counts as a collected resource. The board returns to fishing labels on the Fishing tab.

Recorder version 9 also learns axe/block-hit and game AutoReplant requests. Capture a manual tree hit to bind the current axe endpoint, and a manual game AutoReplant change to bind that setting. The hub Auto-replant button prefers the learned game setting; rejected updates preserve its prior state. Once the game setting is confirmed enabled, local planting is suppressed. Without that setting binding, the existing local replant option remains available. Wood-input fallback aims at the closest queryable solid part/surface, avoiding canopy centres outside normal reach.

### Fruit picking

Harvest now has an optional Fruit picking control. It starts the shared harvest worker, finds ready `stage-N.Fruit` instances on trees in your own island's Blocks folder, and uses the learned fruit request. Enable capture and pick one fruit manually to learn the current context before enabling this option. Crop selection still filters normal crops; fruit picking is separate.

Only the fruit is a harvest target: its parent tree is preserved, crop replanting is skipped, and counts require removal/readiness confirmation. While fruit picking and harvesting are active, Wood Farm skips orange trees and other observed fruit trees, including after their fruit has been removed. Turning Fruit picking off restores ordinary wood targeting. Fruits use the existing crop range, cooldown and crop stats. Tests cover ownership, unready fruit, tree protection, context/target replacement, cancellation and no replant after fruit collection.

### Bait and tool handoff reliability

Bait application now wraps both learned requests and normal activation in the same operation: find bait in character/Backpack/owned inventory, wait until the current cast and rod input finish, equip bait, allow it to settle, apply it, and restore the previous tool. Stop, respawn, manual tool changes and failures preserve cleanup; a rejected request never triggers another activation. The 60-second timer remains unchanged. Native activation is still labelled an attempt, not proof of a server-side buff.

Already equipped tools are no longer reselected for every action. Wood/mining waits briefly after changing tools before its first hit; the shared farm worker waits while bait is changing tools. Crop key input allows the game's interaction focus to update before pressing F. When ordinary host require cannot load a game module, module discovery tries the game's own require if the host exposes it through getrenv. Module absence still uses existing input/captured fallbacks.

Recorder version 11 supports the newer envelope on the already confirmed crop endpoint and handles structured crop rejections consistently. Tests verify bait request execution while equipped, rod restoration on rejection/errors, no interference with an existing bobber, native module loading fallback, changed-axe timing and rotated crop context. Live Roblox validation is still necessary.

### Missing saved tools

If a selected axe/pickaxe material is absent, farming now falls back to the best owned tool of the matching type, updates the selector to Auto best, and saves that preference. An available selected material remains preferred; axes are never substituted with pickaxes. If no matching tool exists, the status asks for the missing tool. Settings files are now account-specific (`IslandsFarmingHub_<UserId>_settings.json`) to prevent another account's material choices from blocking starter equipment. Existing shared settings are left untouched and are not automatically imported.

### Multi-select harvest and farm-mode separation

The Harvest selector now supports several crops at once. Checked entries remain selected while the dropdown stays open; click the selector again to close it. At least one crop remains selected. Account preferences retain the selection and migrate the former single-crop preference. The scanner checks all selected crop types on the owned island, and local replant uses the original target's crop type captured before the request.

Starting Harvest, Wood Farm or Mining switches off the other two farm modes. Their switches and scan messages now reflect the selected mode, so Harvest no longer displays wood/mining scan text. The optional fruit-picking preference still belongs to Harvest. Blocked action messages remain visible through cooldown scans and are also shown on the Wood Farm page.

Normal resource input now tries visible, reachable points on the same resource (nearest surface, part centre and intermediate-height points). This can aim above a rock blocking the closest trunk point; it still refuses fully obstructed targets. No obstacle or reach checks are bypassed.

Mining's Tool dropdown now includes wooden/stone/iron pickaxes and axes, plus Auto best options for both types. Explicit axe choices are respected by equip and input paths; default auto mining continues to choose pickaxes. Server tool effectiveness remains unchanged. Tests cover actual UI multi-selection, exclusive farm switching, mixed-crop scans/replanting, blocker persistence, alternate visible aim points and explicit mining-axe selection.

Tree input fallback checks child meshes and invisible or non-queryable hitboxes, while rejecting obstructed rays and out-of-reach targets.

Wood Farm starts a temporary no-log learning mode when neither a live wood binding nor the native block-hit API is available. Chop one tree manually; learning stops automatically and subsequent targets use that request. Switching Wood Farm off cancels pending automatic learning. Startup and bait remain OFF. Rejoining may require a new chop; captured session values are never hardcoded.

Wood scan range selects candidates; it does not extend axe reach. All wood transports now check the closest tree geometry against the game reach value (20-stud fallback) before equipping or sending a request. Unreachable targets show Move closer and do not increase action counts. Request submission does not confirm damage or guarantee a swing animation.

Persistent berry bushes use a 150 ms confirmation window instead of 800 ms, then proceed to the next candidate with an 80 ms maximum delay. Successful submissions retain a one-second per-bush cooldown. Unconfirmed berry submissions do not increase collection counts or trigger replanting. Server response time still limits throughput.

Harvest now has an Auto Move option, enabled as a preference but idle until Crop Farm is started. Scan range (15–120 studs) discovers selected crops on the owned island; interaction range is capped at 10 studs and honors a smaller game reach value. Far targets are approached using Humanoid walking paths with normal Humanoid jump links. Failed routes cool down for three seconds; stuck movement stops after 1.5 seconds without progress, with a ten-second route deadline. Changing modes, disabling Auto Move, Stop All, starting Fishing, respawning or destroying the hub cancels walking. In-range crops skip pathfinding. Harvest requests collect the berries; no unrelated drop-pickup remote is assumed.

Travel dropdowns on Harvest and Wood Farm share Walk / Tween / Teleport selection (saved preference, Walk default). Trees approach automatically while Wood Farm is active; crop travel uses Auto Move. Tween speed is 24 studs/second with a five-second duration cap. Teleport and tween preserve orientation, stop beside the target, and recheck actual interaction reach before a request. Stop/mode changes cancel pending travel and tweens; choosing travel does not start farming. Server movement correction can still prevent arrival.

Waypoint arrival now compares horizontal distance with a separate vertical tolerance because the root is above ground waypoints. Walk can follow normal jump steps. Persistent berries have a 15-second retry cooldown to advance through the patch instead of repeatedly retrying nearby bushes whose growth state is unavailable.

Auto Bait reserves the next gap between casts when application is due. An existing bobber can finish normally; a new cast waits while bait is queued or being applied. Busy cast/input conditions retry at 100 ms rather than a five-second timer, preventing repeated casts from starving bait application. Successful application releases fishing for the 60-second refresh interval; missing bait or rejected requests release fishing while retaining the normal five-second retry. Manual bait OFF clears the reservation. Fishing still never enables bait.

An empty bait inventory now explicitly displays NO BAIT and states that Fishing continues. It releases any queued cast reservation, checks inventory again every five seconds, and does not change the Fishing switch. Once bait becomes available, normal application resumes between casts.

Fishing now always uses Fast timing and 12-stud cast aim. Alternative mode buttons and the distance cycle were removed. Profile application enforces these values regardless of old preferences, and cast input uses a fixed 12-stud offset. Fishing and bait still start OFF.

Build `bait-check-1` waits up to two seconds for bait consumption while holding the bait tool equipped, then restores the previous tool. A numeric amount/quantity/count/stack/stacksize attribute or IntValue/NumberValue child provides the quantity when available. Only an observed decrease (or removal of a known final item) starts the 60-second refresh timer. Missing quantity data or unchanged quantity shows an unconfirmed message and retries after five seconds while allowing fishing. Request acceptance and Tool:Activate alone no longer imply a successful application. Consumption confirms the item was used; direct buff-state detection is still unavailable. The build marker appears in the hub subtitle; fixed Fast mode and 12-stud aim remain enforced.

Build bait-adapt-2 supports dynamic bait endpoint/envelope learning after Auto Bait is enabled. Initial startup still installs no recorder or automation. Automatic wood and bait learning can coexist without logging unrelated requests. Disabling each feature cancels its corresponding pending learner. Unconfirmed bait status now says Fishing is OFF when appropriate.

Build bait-account-3 binds learned bait requests to the local UserId, Character Instance and server JobId. Removed, pre-v19 or mismatched bindings are excluded from automatic reuse; this account must establish its own current template. Quantity reads prefer amount/quantity/stacksize over generic count/stack and accept numeric attribute strings. Status distinguishes unreadable quantity from an observed unchanged value. Startup remains OFF and no session token is copied between accounts.

Enabling Auto Bait now arms a one-time Fishing start. The first confirmed bait consumption starts Fishing if it is OFF. Missing/unconfirmed bait never starts it. Any explicit Fishing state change clears the pending startup, so stopping Fishing is respected during later bait refreshes. This replaces the earlier fully independent bait-to-fishing behavior; Fishing still does not turn bait on, and initial launch keeps both OFF.

Wood learning no longer returns early before normal input. The hub tries a visible, reachable axe interaction while listening for its session request. Resource input can use host-provided mousemoveabs/mouse1press/mouse1release when all three exist; otherwise it uses VirtualInputManager. Only one input backend is selected per action, with unconditional button release on errors or cancellation. UI, visibility, matching tool, line-of-sight and reach guards apply to both. If neither backend works and no native/learned endpoint exists, one manual hit is still necessary.

Build bait-click-5 uses a normal mouse press/release for bait when client input is supported, so client food handlers listening for mouse input can run. It chooses clear screen space outside the hub and GUI buttons/text fields, blocks input while typing, and releases on errors or cancellation. Tool:Activate is retained only when movement input is unavailable before any click. Failed/unconfirmed bait marks the request for refresh; the next attempt uses normal input with temporary dynamic learning rather than replaying the same template. No second transport is attempted after a press or request in the same attempt. Status includes the chosen transport. Confirmed consumption is still required for the 60-second timer and one-time Fishing start.

Build afk-6 adds Anti AFK under Settings, directly below Stop All. It starts OFF, connects one Player.Idled listener only while enabled, and uses VirtualUser CaptureController/ClickButton2 when supported. Unsupported input disables it with a visible status. Stop All and GUI destruction disconnect the listener; no background input loop is created.

The Airflow library now falls back to task.spawn when task.defer is unavailable, without modifying the host task table. Window construction has statement-level lines for useful startup error locations. Tests exercise UI construction with defer absent. This addresses a possible missing scheduling function; the original minified Window stack trace does not establish which call was nil.

Build bait-refresh-7 remembers the exact binding that failed confirmation. A newer live bait binding clears refresh mode and is used on the next attempt. Previously the refresh flag could keep choosing mouse clicks after a fresh request had been captured. An unchanged failed binding still uses normal-input relearning; requests rejected by account/character/server validation remain ineligible. Tests cover failure, normal input and replacement with a new learned binding.

Auto Bait also retains a quantity sample between retries. If the same character/tool has a lower quantity and a newly captured bait binding targets that tool, consumption is confirmed without sending another request. This covers a successful manual bait use or delayed confirmation while auto learning is active, and can satisfy the one-time Fishing start. A character change invalidates this comparison.

Between-attempt quantity confirmation is limited to a 15-second observation window. Successful attempts reset the sample to the post-consumption quantity so the same decrease cannot be counted again on the next refresh.

Wood Farm now has its own Mode dropdown: Normal (default), Walk, Tween and Teleport. Normal does not approach targets; it cuts only within actual axe reach and reports when the player must move closer. Wood mode is saved separately from Harvest travel, so selecting Normal for trees does not alter crop movement. Navigation also rejects distant Normal targets before starting any path or tween.

Build rod-return-9 automatically selects an owned fishing rod whenever Fishing is ON, no bobber is active and bait is not queued/busy. This covers startup directly from equipped bait and later bait handoffs where no prior rod was saved. It verifies actual selection before casting, does not toggle an equipped rod off, and checks Stop/character changes around equipping. Missing rods or blocked equipping show a status and retry. Fishing OFF does not select tools. Each account still needs its own learned bait request; another account's session context is rejected.

Anti AFK now starts ON automatically at launch. Settings can turn it off; Stop All still disables it and disconnects its idle listener. Farming and fishing remain off at launch.

Build bait-click-10 ignores Auto Bait toggle activations during its own synthetic mouse press/release, preventing accidental self-cancellation when host coordinates hit the hub.

Build fishing-recovery-11 keeps fishing enabled through bite/cast timeouts, guards both fishing and bait toggles during synthetic bait input, and counts at most one miss per bobber while retrying reels.

Build layout-12 bounds axe/mining dropdowns to a scrollable 180-pixel list with selected checks and synchronized arrows. Expanding the multi-crop menu moves following harvest controls down; closing it restores their positions.

Build harvest-range-13 skips crops already known to be unready before navigation and verifies actual crop interaction distance after navigation reports arrival. Stats now offers corner-display visibility and position recovery controls.

Build cleanup-14 review: sidebar navigation and hiding the hub close crop, tool, travel and movement menus. Opening a supported menu closes the other menus. Manual grid planting is single-flight and checks its cancellation generation, GUI lifetime and character before every placement. Stop All cancels remaining grid placements; GUI destruction also invalidates the planting generation. The stats overlay's global input listener is disconnected through the hub's tracked cleanup.

Build reel-aim-15 restores the saved cast cursor position before every reel, including when the user moved the cursor while waiting. Reel aiming stays short (10ms) and blocked mouse movement prevents a blind press. Auto Bait still waits until the existing bobber is gone before switching tools.
