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
Roblox mocks. It checks that all thirteen tabs have content, switches tabs, closes and
reopens the hub, and exercises resize/reset. The reduced Roblox API name fixture
comes from MaximumADHD/Roblox-Client-Tracker's `roblox/API-Dump.json`, retrieved
2026-10-17; the mock rejects invalid initialization properties and property signals.
Mocks do not validate actual rendering, input routing, or server interactions.

In Roblox Studio, put the contents of `message.txt` into a LocalScript under
StarterPlayerScripts in your own experience. Verify that the thirteen tabs render,
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

Build recovery-16 adds input cancellation for tool/character changes and chat focus, plus checks for buttons covering the fishing aim. Auto Build skips completed out-of-range cells before asking the player to move and rejects dimension/material edits while a build is running. Navigation validates both the current root and humanoid identities. Recorder v21 updates observed AutoReplant state only after the original request returns without explicit rejection, preserves all returns/errors, and prevents unrelated mining from ending wood-only learning. Legacy structured rejections are treated as failures.

Build resource-check-17 validates target lifetime and the current character/root again immediately before resource requests, after tool equip delays or navigation. Detached fruit/tree pairs are skipped. Movement overrides track ownership separately for walk speed, jump power and jump height; changing one feature leaves unowned properties untouched, and disabling it releases its saved baseline so later game updates are preserved.

Build cast-reset-18 limits unconfirmed reel attempts on one bobber to three before a normal rod unequip/reset. It toggles the selected native inventory slot (including zero) or uses Humanoid:UnequipTools when native selection is unavailable, waits for the actual old bobber to disappear, and leaves queued bait the next tool handoff. An unconfirmed reset keeps Fishing ON and preserves the bobber; recovery does not register catches. Stop, respawn, manual tool changes, chat, locked tools and session loading are covered.

Build bait-fallback-19 switches normal input methods after an unconfirmed bait attempt: a host/virtual click that reports success but consumes nothing no longer prevents Tool:Activate on the next retry. Each attempt uses one method; quantity confirmation is still required, and successful methods remain preferred on later refreshes unless a learned request is available.

Build bait-native-20 tries Requests.Client:Get("CLIENT_EAT_FOOD"):CallServer({tool=actualBait}) through the existing game-module adapter. This endpoint name is in the supplied remote catalog; the wrapper supplies live session context. Captured requests and normal input remain fallbacks. Explicit rejection never sends another route in the same attempt, and an unconfirmed native attempt is not repeated for the same character/tool until Auto Bait is re-enabled. Quantity confirmation still gates automatic Fishing startup.

Build bait-diagnostics-21 retains the native food route status across fallback attempts and shows it below the fishing aim controls. Copy bait diagnostics copies a small report with route status, current transport, quantity, equipped state and capture support; it prints to the console if clipboard APIs are unavailable. Captured arguments and request-context tokens are not included.

Build bait-signal-22 adds a third normal activation route when host firesignal is available: the equipped bait tool's Activated/Deactivated signals are paired, allowing the game's own handler to construct its request. It runs on a later attempt after Tool:Activate fails, never together with another transport. Last-item removal still counts as consumption even if its detached quantity attribute remains 1. Diagnostics also report Tool.Enabled, ManualActivationOnly, signal support, refresh mode and learned-request outcome.

The Fishing page also offers Learn bait manually: it pauses Fishing and Auto Bait, arms quiet capture, and instructs one manual use before re-enabling Auto Bait. It sends no bait request itself. Stop All cancels this learning even when Auto Bait was already OFF.

Manual learning snapshots the account's current quantity and binding. A fresh captured use plus decreased quantity (or last-item removal) is recognized when Auto Bait is enabled immediately afterward, so it can start Fishing without consuming another bait. The initial refresh countdown uses the captured use time.

Build auto-bait-23 prefers automatic activation signals for missing/stale bait requests. When firesignal is unavailable, supported hosts can invoke enabled callbacks belonging only to the equipped tool's food script via getconnections/getfenv. Disabled tools and unrelated callbacks are excluded. Normal signal, Tool activation and mouse retries are separate attempts; fresh learned requests remain preferred. Full startup tests exercise Auto Bait alone consuming a stack item or the last item and starting Fishing without manual learning. Unsupported host APIs still require the explicit manual-learning fallback.

Build bait-recovery-24 catches unexpected bait-worker exceptions, releases the cast reservation and retries after five seconds while preserving the user's Fishing setting. A failed or unconfirmed direct firesignal route is skipped for later attempts so supported food callbacks can run, with press/release kept on the same backend. Activation failure state resets when the character/tool changes or Auto Bait is re-enabled.

Carrot chest controls are below Fruit Picking on the scrolling Harvest page. Choose **Learn carrot chest withdrawal**, withdraw carrots manually once, then use **Withdraw carrots** beside the same chest. The learned slot is reused; the amount dropdown defaults to 1 and also offers 5, 10, 25 or the learned quantity. Learn again if the slot changes. Account/session values are learned in memory. No chest automation starts at launch.

`ui-lifecycle-26` cancels pending tab transitions when a window or its ScreenGui is destroyed. Settling an entrance/exit skips removed pages and detached layers. Regression checks cover rapid switching, page removal, direct GUI destruction and Window:Destroy; the UI mock enforces Roblox's locked Parent on destroyed instances. The previous build fails these checks with `destroyed instance Parent is locked`.

`chest-water-31`: Harvest → Learn carrot chest withdrawal → **Auto Withdraw Max**. It collects batches from the learned carrot slot, reduces batch size for a smaller remainder, verifies inventory gain and stops after repeated attempts without progress. It starts OFF and Stop All cancels it. **Chest approach range** cycles 30/60/120/240 studs (default 120); **Move to chest: Walk / Stay** controls automatic approach. Walk starts only after enabling Auto Withdraw, uses normal pathfinding to reach 12 studs, and pauses while another farming movement mode is active. The request itself still requires normal interaction distance; range does not change the server's limits.

Fishing and Movement also contain **Save water-hole spot** and **TP to water hole**. Stand at the desired fishing position and save it once per script session. TP restores that position/orientation, clears character momentum and pauses Fishing, Bait, farming, Auto Build and Auto Withdraw. It never enables fishing automatically. The saved point is rejected after account, place or server changes, and TP waits until current rod/bait input is finished. The game server can override local character teleportation.

`teleport-32`: Teleport has its own tab with Water Hole, Island/Home and Custom saved destinations, displayed distances, Return to previous position and Clear saved positions. Fishing and Movement no longer duplicate these controls. After requesting a teleport, the hub checks its position at 0.25, 1 and 2 seconds while it remains near; it reports correction/failure instead of retrying automatically. Position correction alone does not identify anti-cheat as the cause.

Chest travel now defaults to **Stay**. The crop Auto Move switch and chest travel are independent. The chest approach range (up to 240 studs) is used only for walking; Stay/manual withdrawals retain the hub's 20-stud proximity check, so a distant clip does not establish a changed server limit. Selecting Stay or disabling Auto Withdraw immediately cancels chest-owned navigation and clears its Humanoid MoveTo destination. Other navigation owners are preserved.

`spawn-33` adds the user-supplied Spawn, Own Island Portal, Hub Return Portal, Fishing Pond, Slime Portal, Slime Return Portal and Buffalkor positions in a compact two-column destination grid. They are available only in PlaceId `137524393306210`, preserve the captured orientation and use the same automation pause/Back/arrival-check behavior as saved spots. Clear saved positions does not remove presets. These are recorded coordinates, not a dynamic lookup of each account's generated island.

`teleport-labels-34` retains each preset destination name during live label/distance refresh instead of replacing all buttons with “Teleport”. Pending status also names its requested destination. Server correction behavior is unchanged.

`multi-chest-35`: Harvest → **Learn chests**, withdraw carrots manually once from each desired chest, then **Stop learning chests**. The **Chests** dropdown defaults to All learned and can select one chest/slot. Manual withdrawal sends one batch to each selected target; Auto Max rotates batches across them and skips depleted/invalid targets so one chest cannot block the others. Each learned chest+slot retains its own request envelope. Stay remains the default; Walk must be selected explicitly for travel between chests. Stop All, new learning, changing selection and teleporting cancel remaining manual batches. No chest discovery or withdrawal starts automatically.

`chest-layout-36`: chest collection now has a dedicated **Chests** tab. Its summary separates physical chest count, learned slots and the last Auto Collected total. Numbered Learn, Select & Collect, and Range & Movement sections use shorter actions and paired manual amount/movement controls. Selection and amount dropdowns expand inline, shifting later controls down; only one menu opens at a time. Result text and Copy result have their own section, and successful collection feedback uses the success color. Harvest retains crop and fruit controls. Existing learning, per-chest requests, Stay default and cancellation behavior are unchanged.

`whole-chest-37`: In **Chests**, learn one current carrot withdrawal and stop learning. **Whole chest: ON** checks every slot in matching 12-slot Medium Industrial I/O chests; **Scope: All matching** also finds that container type on your own island within Approach range. Other container types retain their explicitly learned slots. Choose **AUTO WITHDRAW** to drain the selected carrot stacks; it starts OFF. Empty/unconfirmed new slots are skipped after one one-carrot probe, while confirmed slots use adaptive batches. Stay remains the default; select Walk explicitly to approach distant chests. Server proximity and inventory availability still apply.

`chest-routing-38`: Walk begins with the closest selected chest and finishes its slots before moving to the next. An unreachable chest still yields to reachable targets. Stay keeps the existing round-robin behavior. Auto Withdraw displays completed slot checks and preserves the last result in its end-of-pass summary; a completed check does not prove a slot was empty.

`chest-manual-39`: Withdraw once now checks reach/ownership once per physical chest before scanning its selected slots. Distant chests are skipped together while nearby requests continue. The manual action becomes Stop with check progress while running; press it again to cancel unsent requests. The result shows sent, skipped/rejected and total requests, with bounded response detail. Requests sent are not confirmed item transfers.

`chest-items-40`: The dedicated **Chests** tab supports general item withdrawals, not only carrots. Start learning, withdraw each wanted item once, then stop. **Items** offers All learned items or one observed item identifier. Whole chest probes each learned item in matching 12-slot I/O containers; other layouts use captured slots. Mixed-item Auto Withdraw confirms inventory gain separately for the requested item and reports a total number of items. Unknown contents are not inferred: learn another item manually to include it. Account, character, ownership, range and cancellation checks still apply.

`chest-selection-41`: The Items dropdown is now a checklist. Click several wanted items, then **Done**, or use **All learned items**. Unchecking the last item selects none and prevents collection until a choice is made. Changes cancel pending chest collection. **Manual batch** labels its scope explicitly; Auto Withdraw still begins with learned batch amounts and now retains a smaller successful batch for that slot after remainder backoff. Whole-chest probes still start at one item before using learned batches.

### Chest inventory count validation

Auto Withdraw requires each matching inventory stack and their combined total to
be nonnegative whole numbers within the exact integer range (up to 2^53 - 1).
Invalid counts stop the worker before a request, or stop confirmation if they
appear after a request; they never increase the collected total. Zero remains a
valid empty inventory. Item selection, reduced remainder batches and one-item
discovery probes retain v41 behavior. Regression tests cover fractional, negative,
nonfinite, nonnumeric and oversized counts, aggregate overflow and invalid
replicated counts after a withdrawal. Live server behavior remains unverified.

### Collection planner (v42)

The Chests page places a Collection plan section before the collection actions.
**Preview selection** shows selected physical chests, slot checks, item types and
checks currently within normal withdrawal reach. Preview does not move, withdraw
or start automation. It is a snapshot; refresh it after moving or changing filters.
It cannot determine chest contents.

**Auto goal** cycles through Unlimited (default), 25, 50, 100, 250 and 500 items.
The goal applies to the combined confirmed inventory gain across selected items
in one run. The final request is capped to the remaining goal. Rejections retain
adaptive backoff, and accepted responses without inventory gain do not advance
the goal. Changing the goal stops an active run; start Auto Withdraw again to
use the new goal. Manual withdrawal is independent of this control. Concurrent
external inventory gains can still affect confirmation totals.

The collected card updates after each confirmed batch. Completed results include
a sorted per-item breakdown, also included by Copy result. **Select none** clears
the item checklist explicitly while keeping it open; All learned items restores
the earlier selection behavior. Inline menus push the planner and later controls
down instead of overlapping them. Regression checks cover actual UI callbacks,
preview isolation, layout, shared mixed-item goals, capped requests, no-progress
limits and per-run totals. The complete mock suite passes; live Roblox rendering
and server interaction still require an available client session.

### Session dashboard and stop timer (v43)

Open **Stats** for a session dashboard above the existing statistics and recent
catches. It shows Fishing, Bait, Harvest, Wood, Mining, Chests and Auto Build
state and the current confirmed chest total. Page shortcuts only navigate.
The dashboard Stop All button uses the same cleanup as Settings > Stop All.

The optional stop timer starts OFF. Choose 5, 15, 30 or 60 minutes (15 selected by
default), then press **Start stop timer**. Starting it does not enable a mode.
The countdown uses elapsed time and the existing live-refresh loop; expiry stops
all automation once, without restarting it. Cancel disarms the timer. Its duration
cannot be changed while running. Stop All and hub destruction also clear it.
A paused or suspended client can delay processing until the next refresh; an
in-flight server call cannot be recalled.

Chests > **Previous runs** cycles through the newest five automatic runs in this
hub session, including stopped runs. Each summary snapshots its outcome, goal,
confirmed total and per-item totals. History is memory-only and contains no
request envelopes or chest Instances. An interrupted in-flight request is not
retroactively counted. Copy result copies whichever summary is displayed.
History browsing waits for active collection to finish so it cannot overwrite
live progress.

Preview and latest-result panels now scroll long text within fixed viewports,
leaving later controls reachable. Preview groups blocked slot checks by up to
three actionable reasons. It still makes no requests and never moves the player.
Mock checks cover actual dashboard and timer callbacks, one-shot expiry,
cancellation, destruction, shared Stop All cleanup, history ordering/bounds,
snapshot isolation, copy behavior, scroll-container wiring and preview reasons.
Real Roblox rendering and live server behavior remain unverified.

### Mode goals and session report (v44)

Stats > **Mode goals** provides independent Fishing, Harvest, Wood and Mining
goals: Unlimited (default), 10, 25, 50 or 100. Choosing a goal stops that mode
and resets its progress; start the mode normally when ready. Every new run starts
at zero. Session-stat resets do not change goal progress. A farm-mode switch
starts fresh progress for the newly selected mode and retains the stopped mode's
last progress for inspection. These goals are session-only.

Fishing goals use the existing catch counter, including its current confirmation
limits; a catch is not independently verified by server inventory. Resource goals
advance only through the existing confirmed target-change path, counting targets
rather than item stack amounts. Requests and unchanged targets do not advance
resource goals. Final crop replanting gets its normal opportunity before a
reached goal stops Harvest. A reached goal disables only its own mode: other
independent modes and manual Auto Bait remain as selected. Existing Stop All and
the session stop timer still cancel all modes.

**Copy session report** exports active time, fishing/resource/chest totals,
current mode states, each goal's progress and up to ten sorted fish-type totals.
It reads state without sending requests or changing active modes. Missing or
failing clipboard support prints the same report to the console. Reports omit
request envelopes and account/server identifiers.

Full-startup tests exercise actual goal and report controls, completion, restart,
exclusive farm switching, statistics-reset independence, unrelated-mode
preservation and clipboard failure. The real loop fixtures also verify fishing
exits before another input and crop goals preserve final replanting. Existing
v41–v43 defaults remain covered. Live Roblox behavior remains unverified.

### Saved island blueprints and build library (v45)

Auto Build now has five named blueprint slots. To save a generated build, configure
its shape and materials, Preview, enter a name, choose a slot and press **Save
preview**. This saves the resulting block layout and materials, so it also works
as a named build preset. Saving overwrites the selected slot.

To save part of your own island, enter a name, select the save radius (15/30/60/120
studs; default 30), choose a slot and press **Save island area**. Capture reads
only the owned island's Blocks folder and includes nearby BaseParts/Models whose
names exist in the game's block definitions. It stores block types and complete
relative CFrames, retaining rotations. Source origin uses the snapped player X/Z
and lowest captured block Y. It sends no placement requests.

This is a block-layout snapshot, not a full game save: chest contents, inventory,
scripts, machine settings, crop growth and other object state are not serialized.
Folders and unknown block types are excluded. The existing 300-block build limit
also applies to saves. Areas over the limit fail without truncation or replacing
the selected slot; reduce the radius or save a smaller island section. Missing
island/definitions or unreadable transforms also leave existing slots intact.

**Load selected slot** validates the saved data and selects it without starting
placement. Preview positions it relative to your current ground anchor and facing;
it does not restore the original world location. Use Rotate and Move blueprint to
align it, then Start build. Saved layouts retain their own materials and shape;
choose a built-in blueprint to edit generator dimensions or material fields.
The material summary lists planned quantities, not owned stock. Rebuilding still
requires materials, normal reach, support and island permissions, and uses the
existing occupied-cell skipping, confirmation, cancellation and failure limits.

Hosts with file APIs save JSON in `RebornBlueprint_<UserId>_<slot>.json`. Hosts
without working file saving retain slots in this hub session and say **Session
only**. New hub sessions read a slot's file on first load. Files have a versioned,
validated schema with 1–300 unique block positions, bounded finite coordinates,
valid rotation matrices and bounded names. Read errors or invalid files do not
replace the current preview. The library is per account; blueprint names do not
become filenames.

Chests' item checklist also supports case-insensitive, literal text search. Search
hides unmatched rows without changing selection, invalidating workers or sending
requests. Empty results explain this. Closing the menu releases search focus.
Fishing, Harvest, Wood and Mining pages now also show their goal control below
their existing settings, sharing the same state and behavior as Stats.

Tests cover named round trips, relative rotation/material preservation, imported
preview/build confirmation, malformed/oversized data, capture radius and source
adapters, file failure fallback, active-build guards, account-specific file
paths, search selection isolation and shared inline goal controls. Live Roblox
rendering, save compatibility and server placement remain unverified.

### Build checks, slot inspection and protected resume (v46)

Auto Build > **Check remaining materials** reads the current preview without
placing blocks. It reports planned cells, occupied cells, remaining cells and
how many remaining cells are currently within normal reach. Remaining material
quantities exclude occupied positions. When owned-item counts are readable, it
shows owned quantities and shortages; invalid or unavailable reads show unknown.
The scrollable material panel retains the full report, and **Copy build check**
copies it or prints it when clipboard access is unavailable. Previewing, moving
or clearing a plan invalidates its previous check. Checks are snapshots: refresh
after inventory or world changes. An occupied position can contain a different
block, and the report does not verify structural support or server permissions.

**Refresh saved slots** inspects all five slots and shows names, block counts,
selected slot and file/session status. Invalid files and read failures are
reported separately. Browsing or switching slots does not load a plan, alter
a preview or start placement. A newer session-only save takes precedence over
older disk data, so refreshing cannot discard an unsaved in-memory layout.

Stopping a build now retains worker ownership until an in-flight placement
returns. **Resume build** cannot start a competing worker during that interval.
Once it settles, resume rechecks all preview cells and skips occupied positions,
including late-arriving blocks from the stopped request. Counters start fresh
for the resumed pass, with earlier completed positions counted as skipped. The
current run tracks confirmed placements, occupied/skipped cells and failures,
and includes these counts in status and session reports. Stop All retains its
existing cancellation behavior; an in-flight request still cannot be recalled.

Regression tests cover in-flight stop/restart, settled-block skipping, unreadable
inventory counts, occupied-cell deductions, reach checks, copy controls and slot
inspection without placement. Existing v41–v45 regressions remain covered. Live
Roblox rendering and server behavior remain unverified.

### Blueprint material editing, rename and copy (v47)

Load a saved blueprint, then use **Existing block name** and **Replacement block
name** under Auto Build > Replace material. **Replace material** changes all
matching cells in the working blueprint, keeping CFrames and preview position
unchanged. The replacement must exist in the game's block definitions. An
asterisk marks unsaved edits, material counts refresh and the previous build
check is invalidated. Existing placed blocks are not modified: builds still
skip occupied cells. Materials, reach and server permissions remain required.

The saved source slot and its file stay unchanged until **Save preview**. If no
preview exists yet, Preview first. **Undo last edit** restores the immediately
previous material state without changing geometry or saved slots. Only one edit
is retained for Undo; loading a different plan, choosing a generated preset or
saving the working preview clears it. Saving a generated preset retains its
existing behavior.

**Rename selected slot** uses the blueprint name field to rename only the saved
slot. Names are trimmed and must remain 1–48 bytes. The current preview is kept.
**Copy target** selects a destination slot; **Copy selected slot → target**
overwrites that explicit destination with an independent validated snapshot.
Copying to the source slot is refused. Copy uses the saved slot rather than any
unsaved working material edit. It leaves source selection and preview position
unchanged. Both operations use the existing account-specific file adapter and
report Session only if persistence fails.

Material edits, Undo, rename, copy and slot writes wait for active or cancelled
in-flight build workers to finish. None starts a build or sends placement
requests. Regression tests exercise actual controls, source/destination isolation,
invalid targets/names, unknown materials, full rotation preservation, Undo state,
preflight invalidation and in-flight guards. Live Roblox behavior remains
unverified.

### Layer-by-layer building (v48)

Auto Build now has a **Build: All layers** control above Preview/Start. Preview a
layout, then cycle All layers → Layer 1 → Layer 2 → … → All layers. Layers are
distinct relative block heights sorted from bottom to top (grouped to 0.001
stud), so irregular captured layouts can have more layers than grid floors.
The default remains the complete blueprint.

Only cells in the selected layer are queued by Start. Remaining-material checks
and the material summary use that same selection and show selected versus total
planned cells. Unselected preview parts become faint; they remain in the plan
for later layers. Switching layers does not move the blueprint or start a build.
Saving, copying and renaming still operate on the full blueprint: the layer
filter never cuts down a saved island layout. Material replacement retains its
existing whole-working-blueprint scope, with selected-layer totals refreshed.

The selection is frozen while the worker is active or a stopped request is still
finishing. Resume keeps the selected layer, rechecks its occupied cells and skips
late-arriving completed blocks. After the worker finishes, select another layer
and Start again. A fresh preview, Clear, loading another layout or changing the
generated plan resets the selection to All layers. Moving a preview retains the
selection. Layer changes invalidate previous material-check snapshots.

Mock tests cover the actual selector control, preview fading, selected material
counts, lower/upper-layer dispatch, stop/in-flight guards, resume totals, full
blueprint saving and reset to All. Existing v41–v47 regressions remain covered.
Live Roblox rendering, structural support and server acceptance are unverified.

### In-place rotation and preview centering (v49)

With a preview visible, **Rotate** now turns the complete working layout 90°
about its current anchor. It updates the actual queued CFrames and ghost parts
without reloading the blueprint, clearing material edits or changing the layer
filter. Before the first preview, Rotate retains its earlier behavior of choosing
the next preview's rotation. Offsets are converted to the rotated axes so the
visible anchor and offset controls stay consistent.

**Center in front** requires a preview and a current character. It moves the full
footprint horizontally in whole-block grid steps, aligning its center with the
character's nearest cardinal facing direction and leaving a front gap based on
footprint depth. Odd/even footprint widths can produce a center difference up to
half a grid step. Height, block orientation, selected layer and unsaved material
edits are retained. Use Move blueprint's up/down controls to adjust height. This
operation does not resample ground at the destination, move the character or
guarantee that every target is within reach.

Both actions move unselected layers along with selected ones, preserve existing
material Undo, and invalidate stale build checks. They do not save files, change
placed blocks or start building. Existing saved slots remain untouched. Reset
blueprint offset still returns to the rotated base anchor. A fresh Preview
continues to recompute its base from the current character and ground, as before.

In-place rotation, centering, movement and preview regeneration wait for active
or cancelled in-flight build workers to finish. Mock tests cover four-turn
round trips, offset reconstruction, changed character facing, grid alignment,
height/orientation retention, ghost updates, layer selection, real unsaved edits
and Undo, missing characters, request/file isolation and in-flight guards. Full
v41–v48 regressions remain covered; live Roblox rendering and placement remain
unverified.

### Compact build workspace and reach markers (v50)

Auto Build now starts with three optional sections collapsed: **Build settings**,
**Saved blueprints & checks**, and **Material editing**. Rotation, positioning,
layer selection, Preview, Start/Stop and status remain in the compact workspace.
Open a section to access its existing controls; stored values and blueprint data
are retained when it is closed. Section layout adjusts the scroll canvas and
pushes later controls down without overlap or accumulated position drift.
Collapsing a focused field releases focus through its existing commit handler.

Auto Build manages its own collapsed visibility rather than using Airflow's
child-reveal animation. Moving between tabs or closing the window now also closes
the builder's preset/movement menus through the shared menu-closer mechanism.
These presentation changes do not start or stop workers or change saved files.

**Move blueprint > Mark reach** is optional and OFF by default. When enabled,
selected preview ghosts retain their original blue/gold color within normal
build reach, turn orange beyond reach, and gray when character/reach data is
unavailable. The button shows in/out/unknown counts. Unselected layers remain
faint and are excluded from marker counts. Markers refresh with the existing
one-second hub refresh and after preview transforms or layer changes; switching
OFF restores original colors. Completed ghosts removed by the builder are no
longer counted.

Markers show local preview-cell distance, not occupancy, material availability,
structural support or server permission. They neither approach targets nor send
placement requests. Check remaining materials and actual placement still use
their existing separate checks. Mock tests cover compact defaults, independent
section expansion/collapse, exact layout round trips, explicit canvas size, tab
intro visibility, shared menu cleanup, marker refresh, unknown data, selected
layers, color restoration and absence of placement/file side effects. Full
v41–v49 regressions remain covered. Live Roblox rendering remains unverified.

### Blueprint block tools, favorites and results (v51)

**Blueprint block editing** now edits generated previews as well as loaded
layouts. Open the section, enter an existing material in the first field and a
replacement in the second, then choose **Replace material**. Replacement applies
to every matching block in the full working blueprint, including unselected
layers. The replacement name must exist in the game's block definitions.

**Remove named blocks** removes every block matching the first field across the
full blueprint. To remove one horizontal layer instead, preview the layout,
choose a single layer with **Build: Layer …**, then press **Remove selected
layer**. All layers is not a removal target. Removal must leave at least one
block; Clear preview can hide the entire preview. Removing cells updates ghosts,
material totals and the actual build queue, resets the layer filter to All, and
invalidates old checks. The remaining cells keep their positions and rotations.

**Undo last edit** restores one replacement or removal, including the previous
unsaved state. Removal Undo restores the complete previous layout at the current
preview anchor, even after moving or rotating it. It resets layer selection to
All. Undo after Clear restores the working data without recreating a preview.
Saving commits only surviving cells and clears Undo. Edits never change saved
slots until Save preview; active and stopped in-flight workers lock editing.
These tools edit blueprints before building. Start retains its existing occupied
cell skipping and placement confirmation behavior.

The preset menu now uses two columns and includes:

| Preset | Shape | Dimensions |
| --- | --- | --- |
| Room | Floor, hollow walls, open roof, one-block-wide front doorway up to two blocks tall | Width/length at least 3; Height controls walls |
| Bridge | Continuous raised deck with one-block-high rails on both sides | Width at least 3; Length controls span; Height is unused |
| Fence | Closed rectangular wall perimeter with an open interior | Width/length at least 3; Height controls walls |

Existing Farm plots, Platform, Wall and Stairs shapes retain their behavior.
All plans remain capped at 300 blocks and build from bottom to top. Large
room/fence dimensions can exceed the cap and require reducing dimensions. The
presets do not add foundations, structural support, inventories or seed planting.

In **Build settings**, the star beside the build/path material toggles that name
in a shared list of up to eight favorites. **Next ★** selects the next favorite
through the field's normal commit handler. Selection waits for worker cleanup;
loaded/edited layouts continue to use the block editor for material changes.
Favorites use `RebornBuildFavorites_<UserId>.json` when file APIs work, otherwise
remain session-only. Files use `{Version=1, Items={...}}`, at most 4096 encoded
bytes; invalid data is ignored without replacing session preferences. Names are
preferences, not proof of item ownership or valid block definitions.

**Recent build results** starts collapsed. View next build result cycles the last
five worker outcomes newest first; Copy build result copies the selected result
or selects the newest. Results contain the blueprint name, layer selection,
selected/full totals, observed placements, occupied skips, failed attempts,
unprocessed cells and elapsed worker time. They are session-only plain-data
snapshots, separate from live progress and blueprint files. Stop publishes its
result after in-flight cleanup; late returns are not retroactively confirmed.
Error and failure-pause outcomes are retained as well. Results do not store live
instances, request bodies or session envelopes.

Tests cover preset geometry/limits, generated and saved blueprint edits, local
file isolation, removal Undo after transforms, survivor-only placement, field
commits and favorite persistence failures/validation, actual UI callbacks and
host filenames, cancellation/error/failure history, immutable results and the
five-run limit. The full suite retains v41 and later regression coverage. Live
Roblox/Studio rendering, server acceptance and structural support remain
unverified.

### Individual blocks, Undo/Redo and chest pacing (v52)

Open **Auto Build > Blueprint block editing** after creating a preview. Enable
**Pick block**, then click/tap a ghost outside the hub, or use **Next block**.
The selected ghost becomes less transparent, and the editor identifies its
material and current cell number. Only live preview ghosts in the selected
build layer are eligible; world geometry in front of a ghost blocks click
selection. The number identifies the current preview and can change after edits.

**Remove selected** removes that one cell. **Replace selected** changes that
cell's material to the replacement field's value, with the existing known-block
validation. Named replacement/removal retain their full-blueprint scope. Removing
the last remaining cell is still rejected. Picking is OFF by default, disables
on preview clearing/regeneration, build start, tab/window menu cleanup or editor
closing, and is locked while a build worker or stopped in-flight call is active.
UI-consumed input, keyboard input, chat/text editing, hub controls, hidden windows,
other tabs and destroyed UI are excluded. Picking does not inject mouse or tool
input. Preview parts remain noncolliding, nontouchable and nonqueryable.

**Undo** and **Redo** now retain up to 20 edit steps for the current working
blueprint, including bulk/individual material changes and cell/layer removals.
The buttons show available counts. Undoing a removal recreates the previous
shape at the current moved/rotated anchor and resets layer selection to All;
material-only steps preserve existing preview CFrames. Redo reapplies the edit.
New valid edits discard the abandoned Redo path; rejected/no-op edits retain it.
Older steps are evicted at the cap, so exhausting Undo does not necessarily mean
the original layout was reached. Save, loading a slot, choosing a built-in preset
and destruction clear both stacks. Clear preview keeps them: Undo/Redo can restore
working data without creating a new preview. Slots remain unchanged until Save.

On **Chests**, **START COLLECTING** is now beside Start learning near the top of
the page. During collection it becomes **STOP** with completed-check counts.
**Pace: Standard** preserves the prior timing. Switch to **Fast** to reduce the
post-confirmation pause from 0.6 to 0.2 seconds, reduced-batch retry pauses from
0.6 to 0.35 seconds, failed-probe pauses from 0.2 to 0.1 seconds and single-item
no-progress backoff from 3 to 1 second. The two-second inventory-confirmation
window, one-item unobserved-slot probes, bounded retries, normal reach, batch
limits, goals, Stop and single-worker rules are retained. Each run captures its
pace; changing pace waits for active/in-flight/manual requests to finish. Pace
is a session preference and starts at Standard.

**Use learned slots only** switches off discovery and whole-chest scanning,
preserving the current item checklist and explicit chest selection. It previews
the resulting targets without starting collection. Use it when the wanted slots
are already learned; it intentionally omits unlearned slots and discovered chests.
Scope and Whole chest controls can restore broader collection. This shortcut
also waits for request cleanup. Live results now identify each attempted batch
and show when inventory confirmation is pending. Fast shortens local pauses;
network/server response times and confirmations still determine actual speed.

The full suite covers nearest rotated-ghost picking, obstruction/layer filters,
mouse/touch/UI/chat guards, actual editor and chest callbacks, single-cell edits,
multiple Undo/Redo sequences after transforms, history bounds and lifecycle,
pace snapshots, identical confirmed totals, unchanged confirmation windows and
bounded no-progress behavior. Existing v41–v51 regressions remain covered. Live
Roblox/Studio behavior and observed server throughput remain unverified.

### Reusable chest profiles (v53)

Open **Chests > Chest profiles**, choose one of three slots, enter a name and
press **Save profile (overwrites)**. A profile stores the current item checklist,
All matching/Learned only scope, Whole chest setting, Standard/Fast pace,
Stay/Walk movement, approach range and combined collection goal. Selecting a
slot only browses it. **Load profile** applies its settings, refreshes the existing
control labels and read-only target preview, and closes menus. Press **START
COLLECTING** separately when ready.

Profiles preserve All learned items and an explicit empty checklist as different
states. They can store up to 64 distinct item identifiers of 1–128 bytes and a
trimmed name of 1–48 bytes. Items that are not learned in the current session do
not produce requests; normal learning and target validation remain required.

Specific chest instances/slots, capture bindings, server identifiers and request
arguments are not saved. Loading clears the previous physical-chest selection
and legacy single-item filter, selecting all eligible chests in the saved scope.
Use the existing chest selector afterwards to narrow it. Saving leaves the
current physical selection untouched. Save and Load are locked during automatic
collection, stopped in-flight cleanup, manual chest work or chest learning;
loading a Walk preference does not move the player.

Profiles use the fixed account file `RebornChestProfiles_<UserId>.json` when file
APIs work, with a version-1 envelope whose `Profiles` object contains string slot
keys `"1"`, `"2"`, `"3"`. Only validated preference fields are serialized. Files
are limited to 65,536 encoded bytes. Startup validates and caches profiles without
applying them, so existing startup settings and OFF defaults are preserved.
Invalid files are ignored as a whole. Missing/failing file APIs retain session
profiles, and the panel identifies File + session, Loaded from file or Session
only storage. Refreshing cached files does not replace newer session snapshots.
A successful Save writes every cached slot, including earlier session-only saves.

The panel starts collapsed, pushes later controls down when expanded and closes
on shared menu/tab/window cleanup. Chests manages its initial visibility so the
stock tab reveal does not expose hidden profile/menu controls. Start/Stop remains
near the top, independent of the panel and menu layout.

Tests cover schema and slot validation, whole-file rejection, fixed account
filenames, startup caching without application, isolated save/load snapshots,
All/None/legacy filters, file errors and session fallback, worker/learning guards,
actual profile buttons, control-label refresh, profile-only browsing and stable
panel expansion/tab cleanup. The full v41–v52 regression suite remains covered.
Live Roblox behavior and file API availability on the user's host are unverified.

### Blueprint backup and transfer (v54)

**Auto Build > Saved blueprints & checks** now includes a backup summary,
**Restore backup → slot**, **Export saved slot**, **Export working layout**, and a
multiline JSON transfer field with **Import to working layout**.

Every changed saved-slot overwrite retains one previous validated version for
that slot, including Save preview, island capture, rename and copy-to-target.
The previous version can come from the session library or a validated primary
file that has not yet been loaded. Identical saves retain the existing useful
backup. Backups are independent snapshots. With working file APIs, the host
writes `RebornBlueprint_<UserId>_<slot>_backup.json` before replacing the primary
file. If backup writing fails, the primary file is retained and the new layout
remains usable in the session. A primary-write failure can still leave a valid
backup for recovery. This is an ordered two-file write, not an atomic filesystem
transaction.

**Refresh saved slots** also inspects the selected slot's backup. **Restore
backup → slot** replaces the selected saved slot and retains the valid version
it replaced as the new backup, allowing another restore to swap back. It leaves
the current working preview untouched; use Load selected slot to work with the
restored version. Invalid/missing backups do not overwrite the selected slot.
Backups remain session-only if file APIs are unavailable or fail.

Export saved slot serializes that slot's validated layout. Export working layout
serializes the unsaved loaded/edited layout or generated preview. Both include
all layers and materials, regardless of the current layer filter. Export writes
JSON to the transfer field and attempts clipboard copying; manual copy remains
available if clipboard APIs fail. It does not save files or place blocks.

Paste the same version-1 blueprint JSON into the field and press Import to
working layout. JSON decoding and the existing complete blueprint validator run
before the current preview is changed: version, name, size, dense 1–300-cell
list, materials, bounded finite coordinates, orthonormal/right-handed rotations
and duplicate positions are checked. Text is limited to 1,000,000 bytes. Text is
never evaluated as code or fetched as a URL. Invalid input retains working data
and slots. A valid import creates an unsaved working copy, clears the old preview
and Undo/Redo, and resets layer/offset/rotation settings. It does not alter saved
slots or start building. Preview checks current block definitions and positioning; use the existing
material/reach checks before Start. Save preview commits the import with normal
backup behavior.

Transfer, restore and slot writes wait for active/cancelled in-flight build
workers. Controls remain inside the existing collapsed library section, keeping
the compact default workspace. Tests cover uncached disk backups, independent
snapshots, same-data saves, restore swaps, backup-write failure ordering and retry,
invalid backup files, import rejection, working-versus-saved exports, full-layer
export, clipboard fallback, worker guards and actual host/UI adapters.

### Auto Plow on owned ground (v54)

**Harvest > Auto Plow · Own island** starts OFF and is session-only. Own a hoe,
use **Scan grass / dirt**, face the area and leave the target clear of the hub,
then enable Auto Plow. The radius starts at 15 studs and cycles 5/10/15/20; it is
locked through worker cleanup. Each pass considers at most the nearest 100
eligible blocks and switches OFF when finished. Move manually and start another
pass for additional ground. It does not walk, plant seeds or automatically run
after Auto Build.

Scanning reads only the player's owned island Blocks folder. Candidates are
existing horizontal BaseParts named `grass` or `dirt` within the selected radius,
with a clear vertical ray for one block above their top center. Existing `soil`,
foreign island blocks, covered targets and tilted blocks are excluded. Scanning
sends no input. The worker equips an owned hoe/plow tool, then uses normal host
mouse input or VirtualInputManager on a visible, unobstructed top-face point
within normal tool reach. It does not guess or replay a new plow remote payload.

Chat/text focus, hub/GUI controls, changed tools, off-screen/occluded targets,
character/island changes and stopped generations prevent further clicks. Input
release is always attempted on Stop, hold/press errors and GUI cleanup. The
previous tool is restored only on the same character while the worker still owns
selection. Other input automation and blueprint picking must be stopped first;
other mode/build/chest/plant starts wait for Plow cleanup. Stop All stops Plow too.

Counts advance only when a `soil` BasePart is observed at the target's former
center in the owned folder within the confirmation window. A successful input
API return or block disappearance alone is insufficient. Three consecutive
unconfirmed attempts pause the pass. The Plow panel and session report retain
observed conversion/failure counts. A hoe can affect neighboring ground according
to the game's own tool behavior; only processed targets' observed changes count.

Mock tests cover owned/surface/range filtering, the pass cap, read-only scans,
hoe selection, actual normal-input guards, observed conversion versus no change,
three-failure stopping, Stop/in-flight ownership, error/GUI release, manual tool
preservation, respawn cleanup and real UI handoffs. The full v41–v53 regressions
remain covered. Live Roblox plow behavior, native hoe area effects and all new
file/clipboard behavior on the user's host remain unverified.

### Learned hoe requests (v55)

**Harvest > Auto Plow** now offers **Learn hoe request** and a **Method** button.
Click Learn, hide/move the hub, equip the hoe and plow one grass/dirt block
manually. Learning observes that normal action without sending an extra request.
Once the panel reports readiness, enable Auto Plow. Click Learn again to cancel;
Stop All and closing the GUI also cancel learning.

Method cycles **Auto → Captured → Input**. Auto uses a valid learned request when
the pass starts, otherwise it retains v54's normal hoe-input behavior. Captured
requires learning first; Input always uses normal input. The selected method is
locked until an active or cancelled worker finishes cleanup. Captured mode sends
no synthetic mouse input, so camera visibility and overlapping UI do not control
its targeting. It still requires an equipped owned hoe, exposed owned grass/dirt,
the selected radius and normal tool reach. Rejected or expired captured requests
never fall through to a second input attempt.

Bindings remain in memory for the current account, character and server. Learn
again after respawning, switching servers or a server-side protocol change. The
recorded grass instance may already be detached; each replay substitutes a fresh
live block from the owned island. No pasted session token or debug ID is saved.
`Character.hoe.hoe` identifies the hoe's nested asset; keep the enclosing hoe Tool
equipped rather than adding that asset as another request argument.

All v54 pass limits, soil-observation counts, failure stopping and Stop/worker
guards remain. New tests cover learned-packet preservation, detached samples,
ownership/session expiry, method selection, rejection without duplicate input,
and Stop during an in-flight request. The full regression suite passes in mocks;
live Roblox acceptance and hoe behavior remain unverified.

### Continuous plowing and clearer controls (v56)

Auto Plow still starts OFF, but **Run: Continuous** is now the session default.
After nearby ground is plowed, it stays ON and rescans around the character every
0.5 seconds. It can start with no eligible ground and waits as you move around
your own island. Each scan selects at most the nearest 100 eligible blocks.
There is no automatic movement or planting. Choose **Run: One pass** for v54/v55's
finite pass and its three-failure stop behavior.

Continuous no longer switches OFF after a completed scan or three unconfirmed
attempts. A failed block waits at least 10 seconds before another attempt, and
three consecutive failures pause processing for 3 seconds before rescanning.
Cooling blocks are excluded before applying the candidate cap, allowing fresh
ground to be considered. The panel explains waiting and cooldowns and retains
the observed-soil/failure totals for the run. Character/island changes, manual
tool changes, expired captured context, conflicting automation and unexpected
errors still stop the worker with a reason. Learn a new manual hoe action if a
captured binding expires; captured failures never fall through to mouse input.

The larger ON/OFF control now has a separate **STOP PLOW** button. OFF cancels
remaining work immediately; an already-sent request must return before ownership
is released, so the control shows **STOPPING…** during cleanup. Pressing ON then
queues one restart instead of silently losing that click. Clicking again, Stop,
Stop All or closing the hub cancels the queued restart. Restart also checks that
the character, island and competing automation have not changed. Late old-run
results never increment the new run's confirmation count.

**Area**, **Run** and **Method** are real dropdowns with checked selections and
larger option rows. Opening a menu does not change a setting or start automation.
Only one menu remains open, and inline expansion pushes following controls down
inside the scrollable page. Selection, Escape, outside mouse/touch input, tab
navigation and hiding the hub close menus and restore their exact positions.
Area/run/method changes wait for active or cancelled workers to finish. Existing
crop, tool, travel, movement, chest and blueprint menus participate in outside
click dismissal. Buttons have consistent padding, truncated long captions,
higher-contrast ON backgrounds and Modal enabled so visible controls can release
a game-locked pointer. Existing protection against synthetic Fishing/Bait clicks
is retained.

The full mock regression suite covers continuous waiting and new-target discovery,
cooldown/retry timing, candidate caps, cancellation and queued restart, preserved
one-pass behavior, actual dropdown selection/layout and mouse/touch/Escape event
wiring. Live input routing, rendering and Roblox server behavior still need an
in-game check.

### Potato salad and variable chest slots (v57)

The supplied `potatoSalad` withdrawal endpoint is now included in the catalog and
recorder v28. In **Chests**, press **Start learning**, manually withdraw some
potato salad, then **Stop learning**. Open **Items**, search for `potato salad`
and check `potatoSalad`, then use the normal collection controls. Searches ignore
case, spaces, underscores and hyphens; selected request identifiers remain exact.
Searching and selecting items do not withdraw anything.

The captured slot 8 and amount 17 are examples, not fixed settings. Learning
records the actual chest, slot, amount and live envelope each time. Relearning
the same physical slot replaces its previous item binding. Distinct observed
slots remain separate, since two stacks of the same item may coexist.

**Whole chest** checks all supported slots of matching industrial I/O chests,
starting each unobserved slot with a one-item probe. It uses the newest learned
packet and batch ceiling for each chest/item, including when discovering another
matching chest. Thus an older observation of salad in slot 8 cannot hide a newer
packet learned in slot 3. **Learned slots** retains exact observed slots. Unknown
chest types still require learning their individual slots; their layout is not
inferred from this capture.

Auto Take confirms potato salad through the `potatoSalad` inventory total, not
another item's increase or a successful request response alone. The existing
owned-island, reach, session/character, cancellation, batch and retry checks remain.
Tests cover the supplied packet, slot changes, newest-template selection, salad in
multiple slots and unrelated inventory changes. The full mock suite passes;
live Roblox behavior remains unverified.

### Auto Take inventory top-up (v58)

**Chests > Auto top-up/item** offers **No limit**, **25**, **50**, **100**, **250**
and **500**. No limit is the default and retains v57 collection behavior. Select
a target to request only the missing amount of each selected item: with 37
`potatoSalad` already in inventory and a target of 50, Auto Take requests at most
13 more. Separate salad slots/chests share the same live deficit; selected wood
has its own deficit. The preview displays the current inventory and missing
amount for up to four item names without sending requests or moving.

Items already at or above the target need no approach or withdrawal. Counts are
read again after approaching a chest, since inventory can change while moving.
Each request is capped by the current deficit, learned batch/remainder limits
and the existing combined Auto goal. The target is captured when the run starts
and its dropdown remains locked through active or cancelled worker cleanup.
Unobserved slots still start with a one-item probe. Unknown inventory counts stop
automation before a top-up approach/request; they are not assumed to be zero.

This is a finite top-up run, not a background restocking service. Spending items
after a completed check may require another run. The cap controls the amount
requested using the latest observed count; simultaneous manual inventory changes
and actual server transfers are observed separately. Explicit manual batches keep
their selected amounts and do not use the auto cap.

Results distinguish **Inventory targets met**, the combined **Goal reached** and
a completed pass with some items still below target. Run history retains the
target and only newly observed transfer totals, excluding starting inventory.
Stop and session/ownership/reach checks remain on their existing paths; late
returns after cancellation do not count as new confirmed transfers.

Chest profiles save the optional numeric `StockTarget` preference using the same
version-1 schema. Older profiles default it to 0/No limit, and loading one clears
a previously selected cap. Profile loading updates the label and read-only
preview without starting collection. No inventory counts, live bindings or
session packets are saved in profiles.

The full mock suite covers per-item/shared-slot deficits, count changes during
approach, combined goals, partial stock, exact-item confirmation, unknown counts,
frozen settings, Stop, old/new profiles and actual dropdown/layout/manual adapters.
Rendering, input dispatch and server behavior remain unverified in live Roblox.

### Salad quantity replication and manual batches (v59)

Auto Take previously stopped after the one-item probe when a newly received food
Tool appeared before its quantity metadata. The inventory reader now distinguishes
missing metadata from an invalid numeric count. Pending metadata can settle within
the existing two-second confirmation window; no further withdrawal is sent while
waiting. Once the exact item's increase is observed, collection continues with
the learned batch and existing remainder backoff. Top-up can also wait for a
pending starting quantity before computing its deficit or approaching a chest.

Malformed returned counts still stop collection. If missing metadata never settles,
the run stops with a specific timeout message instead of assuming a count or
issuing another unconfirmed request. Stop cancels the wait, and late replicated
counts after cancellation do not add confirmed items.

Because the user reported one-item behavior for the manual action too,
**Manual batch** now starts at **Learned**, using the currently recorded amount
for each selected withdrawal. This changes the previous one-item default; **1**
remains an explicit dropdown choice alongside 5, 10 and 25. The action displays
the actual chosen quantity, such as **Withdraw ×17**, or **Withdraw learned
batches** for differing recorded quantities. The count updates after a dropdown
choice and after completion. Learned counts are examples of observed requests,
not a claim about current chest stock; automatic collection retains the bounded
remainder handling when a larger batch is rejected.

Regression tests reproduce the original one-item stop with the real quantity
adapter and delayed food Tool attributes, then verify completion of a 17-item
stack using the one-item probe and larger batches. They also cover permanently
missing metadata, Stop while waiting, pending top-up counts, invalid numbers,
and actual manual controls sending learned 17 versus an explicitly selected 1.
The full mock suite passes. Live Roblox behavior remains unverified.

### Thirty-item batches and same-stack collection (v60)

At the user's request, manual collection now defaults to **30**, and Auto Take
uses a requested maximum batch of **30**, independently of the manual dropdown.
The dropdown includes 1, 5, 10, 25, 30 and Learned; the manual action displays
**Withdraw ×30**. Choosing another manual amount does not change Auto Take's
thirty-item setting. Current captured chest/item/slot and live envelope remain
required; this explicit amount preference replaces the automatic learned-count
ceiling used in previous versions without changing the captured sample itself.

Auto Take keeps the same chest, slot and item selected after a confirmed transfer,
instead of rotating to another stack after every batch. Unobserved whole-chest
slots still start with a single-item probe, then progress to batches of up to 30
after confirmation. Rejected larger batches use bounded smaller remainder
attempts on that same stack. Empty/unconfirmed slots finish after the existing
retry limits, allowing another selected stack to proceed. A preferred stack that
loses reach releases its preference so reachable stacks can continue.

The combined collection goal, per-item top-up target, exact inventory confirmation,
quantity replication wait and Stop/in-flight cleanup still apply. A shared run
goal can now be satisfied entirely from the current stack before another selected
item is considered. Manual withdrawal remains one selected batch per checked
slot; use **START COLLECTING** for repeated same-stack collection.

Mock tests drain 95 and 60 salads from two slots without returning to the first
after moving to the second, check one-item probe → 30-item continuation, preserve
the original recorded amount, and verify range loss, smaller remainders, goals
and manual thirty-item dispatch. The full suite passes; live Roblox behavior
remains unverified.

### Optional repeated chest collection (v61)

**Chests > Run** offers **One pass** (default) and **Repeat (5s)**. Choosing a mode
updates the read-only preview; press **START COLLECTING** to run it. Repeat stays
ON after a pass, waits five seconds without sending withdrawal requests, then
refreshes the selected targets from current learned bindings. This can find a
refilled stack or the selected item in another learned/supported slot. Each new
pass probes unconfirmed slots with one item before continuing the same stack in
batches of up to 30. Empty probes remain bounded to one attempt per refreshed
slot/check. The countdown begins after the preceding pass finishes.

Repeat uses one worker and cumulative confirmed totals. A combined Auto goal
applies across every pass and stops the run when reached. With an inventory
top-up target, satisfied items need no approach or withdrawal: the worker waits
and checks again, topping up only the live deficit after you use some items.
This explicitly enabled mode extends v58's finite top-up operation; One pass
retains its existing behavior.

The result panel and action button show the next-pass countdown, pass number
and cumulative total. The manual button says **Stop Auto Take first** during
automatic collection. Stop, Stop All and GUI destruction cancel the wait; the
worker lock remains held until cleanup, preventing overlapping restarts. Targets
are refreshed after the wait and must still have current usable bindings. If no
current learned targets remain, Repeat stops with a reason. Quantity timeouts
and invalid inventory counts still stop the run without automatically retrying
an unreadable transfer.

Run mode and inventory target dropdowns share menu cleanup and push the preview
below their options. Run mode is locked during collection and cancelled worker
cleanup. Profiles save optional boolean `Repeat`; older version-1 profiles
default to One pass. Loading a Repeat profile changes preferences and the preview
without starting collection. History receives one final run snapshot, not an
entry after every pass.

Mock tests cover refill polling in another slot, the five-second request-free
wait, one-worker ownership, frozen batch sizes, cumulative goals, top-up after
consumption, stale targets, Stop/GUI cleanup, profile compatibility and actual
dropdown/layout/status wiring. The full regression suite passes; live rendering,
input dispatch and Roblox server behavior remain unverified.


### Shorter chest waits and compact controls (v62)

The recording showed a manual withdrawal pass checking hundreds of slots with a
fixed 0.6-second pause. Both manual and automatic collection now use a
**0.25-second Standard** pause between batches, or **0.1-second Fast** pause.
Manual collection snapshots the chosen pace for its whole pass. **Repeat (2s)**
replaces Repeat (5s); the countdown remains request-free and cancellable every
0.1 seconds. Auto retry pauses are 0.35/0.2 seconds for Standard/Fast, and
single-item no-progress backoff is 1/0.5 seconds. Attempts remain bounded.

The collection plan and longer hint start collapsed behind **Show details**.
Opening details refreshes the read-only preview and inserts it above manual
collection; closing removes its space. Main action locations, target selection,
profiles, goals and existing defaults remain. Paired buttons have a 12-pixel
horizontal gutter. The manual batch dropdown is a full-width scrolling list
with 38-pixel options and a highlighted selection.

**STOP AUTO TAKE** and **STOP WITHDRAWAL** keep stable action labels. Progress
appears in the chest status line and footer so it remains visible while scrolling.
Unavailable batch, pace, shortcut, top-up and run-mode controls are dimmed and
locked during requests or auto-worker cleanup. Manual collection cannot start
during cancelled auto-worker cleanup. Starting either collection mode dismisses
open menus, and cleanup restores the controls.

Auto Take still waits up to two seconds for exact-item inventory confirmation,
keeps its thirty-item same-stack maximum, reduces remainder/goal/top-up batches,
and enforces the same ownership, reach and current-session bindings. Manual
withdrawal sends its chosen batch once per selected slot; use START COLLECTING
to keep draining a stack. Saved profile schema and packet fields are unchanged.

Mock tests verify exact shorter pauses, frozen pacing, the two-second refill
interval, Stop before another manual send, compact/detail layout round trips,
button spacing, full-width dropdowns, visible progress and cleanup locks. The
full test suite passes. Live Roblox timing and rendering remain unverified.


### Adaptive Auto Max, server pacing and Pause/Resume (v63)

The live v62 recording showed `TOO_FAST` followed by 15-, 7- and smaller-item
batches. That server rejection was incorrectly routed through the remainder
logic. V63 distinguishes `TOO_FAST` from other failures in both automatic and
manual collection. It waits and retries the same chest/slot/item/amount,
including one-item probes, rather than shrinking the amount or marking the
slot empty. Cooldowns grow from 0.5 to 1, 2 and at most 4 seconds. Five consecutive
rate rejections of the same automatic state/manual check stop with an explicit
reason. The learned interval also paces later successes and remainder checks in
this script session. No cooldown bypass or concurrent request worker is added.

**Chests > Auto batch > Max (1000)** is the new startup choice requested after
the recording. It starts a confirmed-slot batch at at least 30 (or a larger
observed amount, capped at 1000), doubles only after full confirmed transfers,
and caps each request at 1000. A fresh one-item probe is followed by a batch of
up to 30. A partially fulfilled larger request, or a successful reduced batch
after an amount/remainder rejection, sets the smaller observed ceiling for that
slot. `TOO_FAST` never changes this ceiling. This is bounded adaptation; 1000 is
a local request ceiling, not a claim that Roblox accepts 1000 or that the exact
server maximum is known. Run goals and live top-up deficits can reduce requests.
Choose a fixed **30, 60, 100, 250, 500 or 1000** instead if preferred. The manual
batch remains independent and defaults to 30.

The auto-batch dropdown occupies the former learned-slot shortcut position beside
Pace. The shortcut is now inside **Show details**. Dropdown choices expand in
flow, share exclusive cleanup and lock during workers/cleanup. Whole-chest scans
check the newest learned slot first, followed by all other supported slots once;
this preserves coverage when an item moves. A full 23-chest scan can still mean
299 checks. **Whole chest: OFF** checks just the learned slot for each matching
chest; enable whole-chest scanning when items move between slots.

During Auto Take, the manual action becomes **PAUSE AUTO TAKE** / **RESUME AUTO
TAKE**, while the main action remains **STOP AUTO TAKE**. Pause preserves one
worker, the current stack state, confirmed totals and cumulative goal. It cancels
chest navigation and holds future requests; an already-sent request finishes its
existing inventory confirmation and is counted once. Resume rechecks reach and
live inventory. Repeat and rate-cooldown countdowns freeze during Pause. Stop,
Stop All and GUI destruction can end a paused run without Resume. The footer
shows Pausing, Paused, server cooldown and pending cleanup states.

Profile schema version 1 accepts optional `AutoBatch`. Older profiles default
to fixed 30, preserving their preference. New saves can retain Max or a supported
fixed size. Pause and learned server pacing are runtime state and are not saved.
Existing own-island/session/reach checks and the two-second exact-item
confirmation window remain.

Mock tests reproduce repeated `TOO_FAST` at a minimum server interval and verify
same-amount retries, adaptive growth, a 1000-item ceiling, server-clamped and
rejected larger amounts, remainders, goals, capped retries, manual retry,
cancellation, Pause during requests/navigation/quantity waits/cooldowns, profile
compatibility and actual UI layout/actions. The full suite passes. Live behavior
of this new version, including the server's accepted maximum, remains unverified.


### Recovering request pacing and Fast slot setup (v64)

The supplied v63 clip shows 91 collected items, 2/299 checks finished, a 30-carrot
notification and a multi-second countdown after a successful transfer. V63 kept
a raised server interval for the rest of the session. V64 reduces that interval
by 20 percent after every three non-throttled server replies, down to the chosen
base pace (0.25 seconds Standard / 0.1 seconds Fast). A new `TOO_FAST` resets the
recovery streak and retains the existing bounded backoff and same-batch retry.

Successful calls and structured server replies with a boolean `success` field,
including non-throttled empty-slot rejections, provide pacing evidence. Local
validation messages and transport failures reset the streak without reducing the
interval. This also lets scans of empty slots recover from a temporary throttle.
Pacing state remains shared across manual/automatic chest requests in the current
script session; it is not saved in profiles. Server acceptance of a shorter
interval must still be observed and no fixed live throughput is promised.

The footer distinguishes **Request pace** (ordinary spacing after a response)
from **Server cooldown** (waiting to retry `TOO_FAST`). Pause freezes either
countdown, and Stop/GUI cleanup clears both the countdown and its label state.
The existing amount, goal, top-up, exact-item confirmation and retry rules remain.

**Fast slot setup**, beside **Chest profiles**, chooses All matching scope and
turns Whole chest OFF. It clears an individual chest selection, preserves item
filters and batch/run preferences, refreshes the preview, and leaves collection
OFF. Press START COLLECTING separately. It checks learned slots and the matching
slots of discovered supported chests, rather than every one of the 13 supported
slots. Multiple explicitly learned slots remain available. Re-enable Whole chest
when items move between slots. The default scan scope is unchanged until the
preset is selected, and workers/cleanup lock the button. Profiles already save
its resulting Discover/Whole preferences; no new profile schema is required.

Mock tests cover recovery from a four-second interval against a simulated server
limit, renewed throttling without shrinking batches, the selected base-pace floor,
non-throttled empty replies versus local/transport errors, shared manual recovery,
countdown labels/cleanup, exact slot/filter preservation and actual preset/profile
layout controls. The full regression suite passes. Live v64 remains unverified.


### Stable accepted pacing and latency-aware waits (v65)

The two supplied v64 clips show Pace Fast, fixed Auto batch 30, Whole chest OFF,
25 selected checks, and totals progressing from 30 to 60 while ordinary pacing
switches back to a multi-second server cooldown. V64's fixed 20-percent speed
probe could repeatedly cross the server's accepted interval and double the wait.

V65 measures actual time between request attempts. It retains both the largest
observed rejected interval and the smallest accepted interval. After three
non-throttled replies, recovery probes between those bounds. When the bounds
are within 0.1 seconds or 10 percent of the working interval, it holds that
working interval. A new `TOO_FAST` below a still-valid accepted bound retries
that known interval instead of automatically doubling to four seconds. If the
server rejects the old accepted interval too, it is discarded and the existing
bounded exponential backoff applies. Old rejection bounds expire after twelve
accepted replies so temporary load does not permanently pin a slower interval.
These are local estimates, not a discovered or guaranteed Roblox server limit.

Request/confirmation work counts toward an adaptive interval: the worker waits
only the remaining time rather than adding a full extra interval after the
reply. The already learned interval is also checked before a new run's first
request, including immediate OFF/ON and manual/auto transitions. No concurrent
request worker is introduced. Pause still freezes an entered countdown; Stop,
GUI removal, stale bindings and unreadable inventory retain their guards.
Local validation/transport errors cannot establish a working interval.

Fixed 30, Max, manual batch, item and scan choices are unchanged. Waiting status
now keeps confirmed collected totals visible. Collection progress says **slots
finished**: a slot stays current while its stack is being drained, so zero
finished slots does not mean that zero items were collected. Fast slot setup and
whole-chest coverage remain explicit choices. Rate timing/bounds are runtime
state only; no profile or recorder/catalog change.

Mock tests cover a 2.8-second server threshold, returning directly to a known
working interval, holding a narrow bracket, changed/stale server bounds, request
latency counting toward spacing, immediate restart pacing, full-batch preservation,
goals, manual collection and visible totals. The full regression suite passes.
Live v65 throughput and server acceptance remain unverified.


### Optional balanced chest collection (v66)

**Chests > Order** offers **Same stack** (default) and **Balance chests**.
Same stack preserves continued collection from the current stack. Balance gives
another physical chest a turn after a confirmed batch, so a continuously
refilling output chest cannot monopolize collection. Each chest also retains a
cursor through its selected items/slots, preventing a second item in that chest
from being starved. With one physical chest it rotates its available selected
slots; with one target it naturally continues that stack.

A failed amount/remainder attempt and `TOO_FAST` keep their existing slot and
amount retry behavior before yielding. Invalid targets are skipped. An
unreachable chest releases its turn so reachable chests can continue. Walk mode
honors balancing instead of always exhausting one physical chest first; it may
therefore require more travel. One worker still sends serialized requests and
the shared server interval/backoff is unchanged. Balancing is scheduling, not a
rate-limit workaround, and does not by itself address a server rejecting every
request while the confirmed total stays zero.

Order is captured for the active run and locked during workers, Pause and
cancelled-worker cleanup. Pause/Resume retains the queue, totals and cumulative
goal. Repeat refreshes target/cursor state while retaining its whole-run goal.
Top-up still shares each item's live deficit across chests. A balanced turn does
not mark its stack finished: One pass ends when all selected states are finished,
a goal/top-up ends it, or Stop is pressed. Continuously refilling targets can
therefore keep an unlimited run ON.

The order dropdown expands above details/manual controls, shares exclusive menu
cleanup, and restores the compact layout on close/Escape. Choosing a mode only
updates preferences and preview; START COLLECTING is separate. Version-1 profiles
save optional `Order`; missing values restore Same stack and loading never starts
collection. Manual withdrawal and batch/run/scan defaults remain unchanged.

Mock tests compare default same-stack behavior with balancing refilling chests,
physical-chest and multi-item/slot rotation in Walk mode, frozen run choices,
same-slot rate retries, unreachable targets, shared inventory targets,
Pause/Resume, Repeat goals, Stop, profile compatibility and real dropdown layout
and locks. The full suite passes. Live v66 scheduling and throughput remain
unverified. The latest short v65 clip shows zero confirmed items during a retry
cooldown; its final copied result is needed to investigate that run further.

### Auto Craft Bait and reachable chest scans (v67)

Fishing now includes **Auto Craft Bait** beneath the bait diagnostics. It starts
OFF and uses the player's materials. Click **Learn bait craft**, craft bait
manually once (batch 1–100) at your own `workbench2`, then choose **Batch**
(25/50/100), **Bait target** (100/250/500/1000) and **Start crafting**. The default
batch and target are 100. Learning forwards the manual action once and sends no
extra craft. Hosts without the recorder hook APIs cannot learn this feature.

Crafting uses the exact observed workbench and current request context. It waits
while outside the local 20-stud guard or while chest collection is active, checks
ownership/range again after quantity replication, and stops on a changed
character/server, rejected request or missing confirmed inventory gain. Each
request is limited to the selected batch and remaining inventory deficit. The
server determines recipe output, so an inventory target is a stopping condition,
not a guarantee of an exact final count. Existing bait is included in the target;
this is a finite top-up run, not a continuous refill mode. Auto Bait and Fishing
remain separately controlled.

Only observed net inventory growth confirms crafting. Unreadable quantities send
nothing, and an accepted response without gain stops after the bounded inventory
wait. `TOO_FAST` allows at most five retries with cancellable .5/1/2/4/4-second
waits. Other errors stop immediately. Stop, Stop All and GUI destruction cancel
the worker/learner. An in-flight request must finish before restart or chest
withdrawal; it cannot be recalled. Batch/target menus expand within the page and
lock while the worker is running. Choices are session-only.

Chest **Stay** still sends only within 20 studs; it never enables walking. The
range control is now labeled **Walk range** to distinguish its purpose. An
unreachable physical chest defers all its selected slots for that scan, allowing
nearby chests to collect without a separate one-second delay for every distant
slot. When all remaining targets are deferred, collection stays ON, explains the
range wait and rescans once per second. Moving into range resumes without a
restart. These local waits do not consume server cooldown intervals or count
items. Same stack remains the default scheduling choice.

Validation: `npm --prefix tests test` covers the full suite, including learned
craft envelope preservation, quantity confirmation, delayed replication, cooldown
bounds, ownership/range, movement during quantity waits, cancellation, the real
UI controls and grouped distant chest scans. Live Roblox crafting, rendering and
server acceptance of v67 remain unverified.

### Craft extra bait regardless of stock (v68)

The reported 3,770 bait exceeds every v67 inventory target (maximum 1,000).
That version only topped up inventory; it would not make additional bait above
its selected target. Its **Copy bait diagnostics** report described using bait,
not crafting it, so the report did not identify craft readiness or the target.

Auto Craft now defaults to **Craft: Make amount**. Amount 100 means 100 additional
confirmed bait during this run, independently of existing stock. **Top up stock**
retains the previous inventory-target behavior as an explicit choice. Both use
amounts/targets 100, 250, 500, 1,000, 2,500, 5,000 or 10,000; the choice is a run
goal, not the quantity sent in one request. The game allows at most **100 per
craft request**. Batch choices remain 25/50/100, and a final partial batch can be
smaller. For example, Make amount 500 with batch 100 sends separate batches of
at most 100 and waits for confirmed inventory growth between them. With stock
3,770, Make amount 100 can make 100 more, while Top up stock 100 sends nothing.
The mode, batch and goal remain fixed for an active run. Startup remains OFF.
These choices are session-only; no saved preferences are migrated.

Fishing's craft section now sits below the manual bait-use learning button,
with a separate mode dropdown. All dropdowns expand in flow and lock while a
craft worker is active. **Copy craft diagnostics** reports mode, batch, request
limit, amount/target, inventory, craft-specific binding/learning state, active
worker, last status and next step. It copies no learned session context and sends
no requests. **Copy bait diagnostics** now identifies its scope as bait use and
shows that no activation is scheduled while Auto Bait is OFF.

To use crafting: **Learn bait craft** → craft bait manually once at your own
workbench2 (at most 100 in that manual craft) → choose **Make amount** and amount
→ **Start crafting**. Using/equipping bait is a separate action and does not teach
a craft request. A new character/server needs its own learned craft context.
Stop, cancellation, reach/ownership checks, inventory confirmation and bounded
cooldown retries remain as in v67. Materials are consumed by successful crafts;
server recipe output still determines the final observed quantity.

Validation: `npm --prefix tests test` includes the 3,770-stock regression,
500 crafted via five requests of 100, a smaller final batch, top-up to 5,000,
configuration frozen mid-run, the distinct diagnostics, and layout/menu locks.
The full suite passes. Live v68 Roblox crafting/rendering remains unverified.

### General Auto Craft workspace (v69)

**Crafting** is now its own tab (twelve tabs total). It replaces Fishing's craft
section; bait application and its manual-use learner stay in Fishing. Crafting
starts OFF with Recipe **bait**, **Make amount**, batch 100 and amount 100.

Click **Learn recipe**, manually craft the desired item once at your own
workbench, then choose its name in **Recipe**. The learner sends no extra
request. A completed learning action selects the new recipe without starting
automation. Learn another recipe to add it to the current-session picker. Recipes
use their own complete observed request and workbench. This supports recipes
with the observed `toolName` / `workbenchBlock` / `amount` request shape; it does
not invent a request for an unlearned item or infer recipe costs/output. The
crafted inventory item's exact name must match `toolName`, and its quantity must
be readable. Other request shapes or unobservable output remain unsupported.

Choose a run mode:

- **Make amount**: make the chosen number of additional confirmed items.
- **Top up stock**: stop when the selected item's total inventory meets its target.
- **Continuous**: repeat the selected batch until Stop, an error or unconfirmed
  output. The unused amount control is disabled. Successful crafts use materials.

Requests remain capped at 100. Each batch waits for confirmed growth of the
selected item; replies without inventory gain stop. The recipe, captured
workbench, batch and mode stay fixed for the run, even if another manual craft
is observed. Requests are serialized with chest collection. Existing ownership,
20-stud local reach, stale-character/server checks, bounded `TOO_FAST` retries,
Stop All and GUI cleanup still apply. Stop cannot recall an in-flight request.
A finite run must be started again to make another finite amount. Use Continuous
to keep making the same recipe without restarting between completed batches.

The recipe dropdown refreshes its list when opened and disconnects replaced
option callbacks. The same inline dropdown helper preserves layout, exclusive
opening, Escape/close behavior and cleanup for other controls. Changing a recipe
or mode does not send a craft. **Copy craft diagnostics** includes the selected
recipe and mode; it omits learned session context. Recorder v30 retains v29 bait
bindings during upgrade. Recipe bindings stay in memory for the current account,
character and server; there is no recipe file import/export in this version.

Validation: `npm --prefix tests test` includes the full suite, generic recipe and
workbench isolation, bait compatibility/migration, selected-item confirmation,
Continuous Stop/material failure, recipe selection and dynamic callback cleanup,
12-tab startup, plus existing build/plow/chest/fishing regressions. Live Roblox
crafting, menu rendering and recipe compatibility remain unverified.

### Leave conveyor I/O chests alone by default (v70)

The user's v68 clip shows Auto Take running across 25 chests while carrots travel
on the conveyor. The industrial Input/Output chests can feed the belt while Auto
Take withdraws from the same storage. v70 changes the default selection:
**Conveyor I/O chests: Skip** appears in Chests above the profile controls.

Skip excludes the known `chestMediumIndustrialIO` type from automatic collection
and manual hub withdrawal. It also excludes discovered matches, whole-chest slot
expansion and repeat queues. Learning a normal manual withdrawal still observes
that action; it does not cause a replay. Regular chests remain eligible. The
selection, worker queue construction and final withdrawal readiness check all
honor Skip. If every selected target is protected, Start sends nothing and
explains why. Show details lists the number of selected physical I/O chests
protected, instead of treating them as available withdrawal checks.

Click the control to choose **Include** explicitly and restore the earlier I/O
withdrawal behavior. Included I/O withdrawals can compete with the belt. This
control is locked during collection, pause, manual requests and worker cleanup.
It does not start collection. The preference is session-only and defaults to Skip
on reload; loading a profile does not override it. Other item, scope, order,
batch, pacing, crafting and build settings are unchanged.

The protection matches the known I/O chest type, including unconnected I/O
chests. It does not infer a physical conveyor connection or pause/change the
conveyor itself. Other conveyor/container types have not been established by the
supplied capture. Validation covers default protection, Include compatibility,
regular/mixed scopes, discovered/whole/repeat queues, final preflight, actionable
empty plans, profile behavior and UI locks/layout. `npm --prefix tests test`
passes. Live Roblox conveyor operation remains unverified.

### Ordered crafting queue (v71)

Crafting now includes **Add to queue**, **Run Queue / Stop Queue**, **Remove last
job** and **Clear queue**, plus a scrollable list with current/completed job
markers. Select a learned recipe, **Make amount** or **Top up stock**, amount and
batch, then click Add to queue. Repeat for other recipes and press Run Queue.
Adding or changing a plan never starts crafting. The queue starts empty and OFF;
no existing preferences are applied automatically. Single-recipe Start crafting
and Continuous keep their v70 behavior independently of the configured queue.

A queue holds up to eight finite jobs. Each stores its own recipe name, mode,
amount/target and 25/50/100 batch. Continuous cannot be queued because it would
prevent later jobs from running. Before the first request, all jobs must have
valid current-account/character/server bindings. Each run freezes the jobs and
captured workbenches, uses one worker, and finishes one job before advancing.
Per-request quantity is still at most 100, including a smaller final batch.
Inventory confirmation remains specific to the active recipe. Already-met
Top up stock jobs advance without sending a request. Duplicate Make amount jobs
each make their configured additional amount.

The queue stops at the failed job on server rejection, unreadable/unconfirmed
inventory, expired context or the existing bounded cooldown limit; it does not
silently skip it and spend materials on later jobs. TOO_FAST retries the same
recipe and batch. An out-of-reach workbench waits with the queue ON; move within
20 studs of that learned workbench. The queue does not walk or infer recipe
materials/dependencies. Subsequent jobs can use materials produced by earlier
ones only through the game's normal crafting rules.

Stop crafting, Stop Queue, Stop All and GUI removal cancel remaining work. They
cannot recall an in-flight RPC; cleanup must finish before restart or edits.
Queue editing and recipe/mode controls lock while the worker runs. Completed or
stopped configured queues remain available in memory: Run Queue always starts
at the first job, not from partial progress, and may consume materials again.
Removing/clearing jobs resets the displayed run totals. Queue diagnostics include
completed jobs, confirmed positive inventory gains and the active queued recipe.
The list is session-only; configured jobs store no binding, session token or
remote path, and there is no queue persistence/import in this release.

Validation: `npm --prefix tests test` includes new queue regressions for order,
partial batches, independent recipe counts, repeated/top-up jobs, whole-queue
preflight, frozen settings/bindings, Stop/in-flight restart, material/no-gain/
cooldown failure, workbench range, malformed/capped queues and GUI cleanup. The
real UI tests exercise Add/Run/Stop/Clear, Stop All, edit locks, diagnostics and
inline dropdown layout. Conveyor Skip remains the startup default. Live v71
Roblox behavior remains unverified.

### Recipe catalog, craft pause and propeller tracking (v72)

Crafting adds **Load all recipes** and a search field. Loading first inspects
relevant cached and already-loaded game recipe/item metadata. If no recipes are
found, it looks for explicitly named recipe/config metadata modules under
ReplicatedStorage. It reads table exports, recognizes recipe output IDs and
item metadata with `craftingRecipe` data, and excludes ingredient lists from the
output choices. It does not invoke recipe getter functions, craft requests,
purchases or queue actions. Loading is explicit and locked while crafting.

Catalog IDs merge with learned recipes. Search ignores case, spaces, underscores
and hyphens; at most 60 matches render at once, so narrow the search for larger
lists. The status shows available/shown counts and whether the selected recipe
has been learned. Selecting a catalog entry does not create a request binding:
the selected recipe still needs one manual learned craft before Auto Craft can
send it. This button provides the recipe list, not server unlocks or a generic
request template. Data discovery is bounded and schema-based; getters, different
metadata formats or hidden/server-only recipes can remain unavailable. A failed
reload preserves the previous catalog and learned recipes. Open a crafting
station and retry if the client has not exposed recipe metadata. Copy craft
diagnostics includes catalog read/failure counts for live troubleshooting.

**Pause crafting / Resume crafting** works for single-recipe and queued jobs.
It keeps the worker, recipe, job index, confirmed totals and remaining quantity.
An already-sent request may finish inventory confirmation, but no next request
or queued job starts while paused. Resume continues the same job; Stop still
cancels it. Recipe/queue edits and catalog loading remain locked during Pause.
Completed final batches can finish a run even if Pause was pressed in flight.

Fishing now shows **Propellers this session** and **Last propeller**; both also
appear in the corner overlay, and the session report includes them. The timer
updates in HH:MM:SS since the last observed gain and keeps advancing with Fishing
OFF. Counts persist through OFF→ON in the same hub session. **Reset propeller
session** clears both; the general stats reset also clears them. Reloading the
hub starts a new session. No earlier catch time or historical total is inferred.

The tracker snapshots owned propeller quantity immediately before an Auto
Fishing reel and attributes positive changes only after the catch's bobber
removal is confirmed, allowing up to five seconds for metadata replication.
Existing quantities, unchanged stacks, temporary removal/reappearance, invalid
counts, expired/unconfirmed reels, OFF and respawn do not add to the counter.
It supports the exact propeller/propellor name spellings and plural variants.
Unreadable stack quantities wait rather than assuming one Tool means one item.
Hub chest/craft requests invalidate an overlapping catch window, including
requests that finish between tracker polls. This is inventory-based attribution,
not a captured server reward event; manual purchases/trades outside the hub
cannot be conclusively distinguished if they coincide with the same catch
window. Recipes/remote bindings and conveyor Skip behavior remain unchanged.

Validation: `npm --prefix tests test` covers recipe schemas and metadata fallback,
search/render limits, no request fabrication, catalog failure preservation,
pause/resume and in-flight confirmation, propeller stack/delay/timer/reset/
conflict cases, real panel/overlay controls and all previous regressions. The UI
mock's hook variants run in separate processes to avoid its fixed WASM heap and
bridge-handle limits; neither variant's checks were removed. Live v72 recipe
coverage and Roblox propeller tracking/rendering remain unverified.

### Recipe discovery and tracker diagnostics (v73)

**Load all recipes** now supplements a partial cached/loaded list with explicitly
named recipe and item metadata under ReplicatedStorage. Finding one station's
recipes no longer prevents discovery of other stations' data. A shared limit of
32 read attempts covers cached tables and module reads, including failures.
Duplicate module identities and exports are skipped across discovery stages;
cached modules with matching full paths do not need another require. A failed
module is not retried in the same scan. Failed reads and an exhausted budget are
shown as a partial scan, and **Copy craft diagnostics** includes attempts, failures
and the limit flag. A scan with no usable recipes preserves the previous list.
The limit bounds attempts, not the runtime of a game's individual module load.
Client metadata still cannot guarantee every server recipe is discoverable, and
an independently learned recipe request is still required for Auto Craft.

The Fishing propeller panel now distinguishes waiting for a reel, waiting for
catch confirmation, watching delayed inventory, unreadable quantities, and
chest/craft overlap. If an overlapping action invalidated a catch window, that
window stays visibly excluded after the other action ends; the next reel starts
a fresh window. An unreadable starting quantity stays excluded even if later
inventory becomes readable. **Copy tracker result** sits beside **Reset session**
and reports session count, time since the last propeller, inventory, window
baseline, confirmation/block state, remaining observation time and hub workers.
If clipboard access fails, it prints to the console. No captured request payloads
or context tokens appear in the report. Counters and fishing attribution rules
are unchanged from v72.

Validation includes partial catalog completion, shared attempt limits for failed
and cached reads, deduplication, GUI destruction during a module read, tracker
status transitions and the real copy button/clipboard fallback, in addition to
the full existing suite. Live Roblox compatibility remains unverified.

### Crafting materials overview (v74)

The Crafting tab now includes **Materials · selected recipe**, above the queue.
After **Load all recipes**, the panel shows each readable ingredient's **need /
have / missing**, and how much the limiting ingredient permits from current
inventory. **Refresh materials** reads quantities immediately; the normal board
update also refreshes the view once a second. **Copy materials** copies the current
estimate or prints it to the console if clipboard access fails. The existing
craft diagnostics also include it. Opening inline dropdowns moves the materials
and queue panels down together; both lists scroll separately.

Validated recipe metadata supports numeric ingredient maps and ingredient rows
with explicit item IDs and positive integer amount/quantity/count fields.
Repeated ingredients are added together, with a maximum of 64 input entries.
Explicit output amount/count metadata permits a whole-run estimate: required
crafts are rounded up by that output quantity. **Make amount** uses the extra
quantity selected, regardless of existing stock; **Top up stock** uses the current
output deficit; **Continuous** shows the next selected batch only. Running or
paused jobs use their frozen recipe/settings and confirmed remaining amount.
During a queue, the panel covers the current job, not the later jobs combined.

Missing output quantities are not assumed to be one: the panel shows per-craft
costs and says a total cannot be calculated. Unreadable inventory remains unknown,
including the missing quantity; it is not treated as zero stock. Incompatible
recipe variants for the same output stay ambiguous instead of choosing one
station's cost arbitrarily. Invalid, empty, oversized or unsupported material
data, alternative ingredients and extra cost/currency fields do not produce a
partial total. Missing metadata explains that request learning alone provides
no material costs. A failed catalog reload preserves existing materials with
the catalog. Explicit output quantities are read from output/result/outputItem
rows or outputAmount/outputCount/resultAmount fields; an ambiguous top-level
amount is not guessed. Current recipe discovery/schema coverage is incomplete.

This is an advisory estimate from client metadata and readable owned inventory.
It does not reserve or withdraw materials, start a craft, change request batching,
or bypass server recipe/workbench/unlock requirements. Server-only costs may
remain unknown. Existing crafting confirmation, pause/stop and chest protection
behavior stays in place.

Validation includes recipe extraction, duplicate/variant handling, malformed
costs and inventory, output rounding, all three modes, active frozen progress,
unknown data, catalog preservation, real refresh/copy controls and dropdown
layout, plus the full regression suite. Live Roblox material schemas and UI
remain unverified.

### Sturdier chest collection (v75)

Auto Take now distinguishes a rejected batch from an uncertain transfer. Only
recognized empty/insufficient/oversized-batch responses reduce the requested
amount. **TOO_FAST** retains its bounded same-batch retries and learned pacing.
An invalid/empty slot or item mismatch is skipped once, allowing other selected
slots to continue. Full inventory, changed session/permissions and unknown
rejections stop with the server result and keep the batch size. A transport
exception also stops: the server may already have moved items, so the request is
not replayed automatically. Manual withdrawal stops its sweep on these failures
and reports how many earlier requests were sent.

An accepted Auto Take request gets up to **five seconds after the server call
returns** for a readable increase of that exact item's inventory. Confirmation
returns immediately when the increase appears; successful transfers acquire no
extra fixed delay. If the item never increases or becomes unreadable, the run
ends as **Needs review**, with previously confirmed totals retained. It does not
shrink the batch, retry the accepted request or move on to other slots. Check
inventory before restarting because later replication may still arrive. Another
item's increase does not confirm the requested item.

Before dispatch, temporarily missing stack metadata is retried for up to three
two-second checks, with a one-second rescan when all remaining checks are waiting.
Readable items may continue while an unreadable target waits. Persistent missing
metadata stops without sending a request for that target. Malformed quantities
remain immediate failures. Session, conveyor exclusion and normal 20-stud reach
are checked again after any inventory wait. Moving away defers the check while
preserving the batch; moving back resumes it.

The action status distinguishes **Waiting for server** from **Confirming item**.
Pause allows an already-sent transfer to finish confirmation, while holding new
work. Stop prevents follow-up requests and ignores late inventory credit. An
in-flight server call keeps its lock until it returns, including after Stop;
the five-second inventory window is not a network-call timeout. Conveyor I/O
**Skip** remains the default, and normal Same stack/Balance chests, Max growth,
fixed batches, goals, repeat and top-up behavior are retained.

Recorder v31 preserves learned bindings from v30 and adds a local failure-origin
return value for chest requests; it changes no wire envelope or endpoint. Full
regressions cover delayed confirmation, ambiguous transport outcomes, capacity/
permission failures, slot skipping, bounded metadata recovery, session/range
changes during waits, pause/stop and manual sweep cleanup. Live Roblox behavior
remains unverified.

### Exclude individual chests (v76)

**Chest protection · session only** sits below the chest selector in Targets.
Choose one chest, then press **Exclude selected chest**. The exclusion covers
that exact physical chest, across all of its slots and item types, for both Auto
Take and manual hub withdrawal. The selector marks it **EXCLUDED** and keeps it
available for selection, so **Allow selected chest** can undo the exclusion.
The count and collection preview show the protection state. Neither button
starts collection or sends a request.

All learned/All matching scope, generated whole-chest slot probes, repeat scans,
fixed/Max queues and the final pre-request guard respect the exclusion. Allowed
neighbors still work, even when they share the same model name. Fast slot setup,
profile loading and **Conveyor I/O chests: Include** do not remove it. Conversely,
allowing an excluded chest again does not override Conveyor Skip. Auto/paused
collection, manual withdrawal and request cleanup lock exclusion edits; forged
button callbacks are checked as well. The pane moves below inline selector
options and restores its position when they close.

These are exact-instance exclusions for the current hub session, not saved
profiles or a persistent island blacklist. They survive a character respawn
while the same hub stays open. Reloading the hub starts a new exclusion list;
a destroyed/replaced chest is a different instance, even at the same coordinates.
No position/name-based match or serialized remote binding is inferred. Learning
and normal in-game chest interaction outside the hub are unaffected.

Validation covers exact identity and all slots/items, discovered chests, stale
queue/readiness snapshots, direct request guards, manual sweeps, edit locks,
undo, ownership, replacement identities, conveyor independence, real buttons,
preview/selector labels, profile/quick setup preservation and dropdown layout,
plus the full existing suite. Live Roblox behavior remains unverified.

### Saved crafting queue presets (v77)

The Crafting tab now has **Saved queue presets** below the working queue. Cycle
between three slots, enter a name, and press **Save queue (overwrites slot)**.
Each preset keeps 1–8 finite jobs, including recipe IDs, order, Make amount/Top up
stock mode, batch and amount/stock target. It stores no request binding, workbench
instance, actor/session context or token. Continuous jobs are not saved in a queue.

**Load queue (replaces)** copies the selected preset into the working queue and
clears its old progress. Crafting stays OFF, the saved preset remains independent
of later queue edits, and loading never sends a request. Each recipe still needs
a fresh usable learned binding on this character/server. **Run Queue** retains
the whole-queue preflight and 100-per-request cap; a missing recipe binding blocks
the run before any job sends. Selection in the single-recipe controls is retained.

When host file APIs are available, saving writes all three current slots to
`RebornCraftQueues_<UserId>.json`. On hub startup, a valid file populates saved
slots without loading or running a working queue. Files are limited to 64 KiB
and validated as a whole before any slot is applied. Invalid versions, slot keys,
sparse/oversized queues, names, IDs, modes, batches and amounts are rejected.
A failed read preserves session presets and the current working queue. A failed
load or invalid save also retains the existing working/stored data.

The summary distinguishes **File + session**, **Loaded from file** and **Session
only**, and shows file read/write status. If writing is unsupported or fails,
the new preset remains available only while this hub session stays open; a
previously saved file can still contain an older version. Presets are scoped to
the account, with no captured envelope transferred through files. There is no
promise of persistence if the host does not retain its own files.

Running, paused and finishing craft workers, recipe learning/catalog loading and
preset file work lock preset controls. A yielding file operation also prevents
queue edits and crafting/learning/catalog startup until it returns. When file work returns after GUI cleanup, its busy state is released and a late
read does not apply data. Inline
dropdowns push the preset section down and restore it when closed.

Validation covers snapshot isolation, three-slot/account persistence, no automatic
start, fresh-binding preflight, invalid/oversized/corrupt data, failed writes,
session fallback, IO concurrency/cleanup and the actual preset buttons/layout,
plus the full regression suite. Live Roblox and executor file retention remain
unverified.

### Propeller loot history and per-run goals (v78)

Fishing now shows **Propeller loot · latest 50 · UTC**, below the tracker and
goal picker. Each credited inventory increase records its actual quantity,
observed UTC timestamp and resulting session total, newest first. The history
retains 50 entries while the session counter continues beyond that limit.
Timestamps describe when the client observed the gain, not the server's reward
time; one catch can replicate as several gains/rows. If the clock cannot be
formatted, the row says **timestamp unavailable** and counting still works.
**Copy loot history** copies the bounded history or prints it to the console if
clipboard access fails. No extra fishing or pickup request is sent by history.

The **Propeller goal** dropdown offers Unlimited (default), 1, 5, 10, 25, 50 and
100 new propellers. Choose it while Fishing is OFF. Each OFF→ON start begins
run progress at zero, retaining the session total/history. Existing inventory
and previous-run finds cannot satisfy a fresh goal. A credited gain reaching
the target stops Auto Fishing through its normal cancellation path, keeps the
reached result visible and cancels queued bait-triggered fishing startup. Other
automation states remain unchanged; existing fishing goals/timers still apply.
An individual gain can overshoot the limit, and the full observed amount is kept.
Starting Fishing again deliberately begins another run toward the same limit.

**Clear history** clears only log rows, retaining the session total, last-found
timer, current run progress and Fishing state. **Reset session** and the general
stats reset clear the propeller counter, history, last time and run progress;
they retain the selected goal limit. These counters, limits and history belong
to the current hub session and are not restored after reloading the hub.

A previous confirmed catch now retains its remaining five-second observation
window when the next reel starts. At most the previous confirmed window and the
current reel are held. Overlapping windows share inventory high-water marks so
a delayed gain is not lost or counted twice. Chest/craft dispatch invalidates
both overlapping windows, including requests completed between tracker polls.
OFF, respawn, expiry and unreadable starting quantities retain their exclusion
rules. The real fishing loop registers the confirmed fish before a propeller
goal stops it and checks cancellation before sending a new reel. Inventory-based
attribution still cannot distinguish outside purchases/trades that coincide
with an eligible window; this does not establish an exact server reward source.

Validation covers timestamps/clock failure, retention order/limits, clear/reset,
restart/overshoot, locked goal edits, one-time stop and real-loop ordering,
delayed previous-catch gains, shared-window deduplication, hub conflicts and the
actual dropdown/history/copy controls, plus the full regression suite. Live
Roblox rewards, client rendering and attribution remain unverified.


### Queue editing, chest priority, statistics and controls (v79)

**Crafting queue:** use **Edit job** to load a queued descriptor into the recipe,
mode, batch and amount controls above. Changing those controls stages an edit;
**Apply settings to selected job** explicitly replaces that job. **Move up/down**
keeps the chosen job selected and preserves all other jobs. Remove deletes the
selected job, or the last job when no job is selected. Clear/Remove/Load clear
the edit selection. Reordering or applying resets the previous run summary.

Edits affect the working queue only; saved presets retain their snapshots until
explicitly saved again. Unlearned preset recipes can be edited without fabricating
a binding. Run Queue still validates every current learned recipe before its
first request, keeps a frozen configuration and caps crafting requests at 100.
Running, paused, finishing, learning, catalog loading and preset file work lock
the editor. Dropdown expansion keeps the editor/preset section below its options.

**Chest priority:** choose an individual physical chest in Targets, then click
**Priority** to cycle Normal → First → Last → Normal. FIRST/LAST appear in the
chest labels. First checks precede Normal and Last checks; Walk uses distance
within each priority and keeps slot order for ties. Balance chests still rotates
after confirmed transfers. Unreachable/waiting chests do not prevent other ready
checks. Priority does not bypass exclusions, conveyor protection, range checks,
item filters or learned-binding validation. Changes require collection/manual
withdrawal and in-flight cleanup to finish. Priorities are session-only, apply to
all slots/items of that exact instance and are not stored in chest profiles or
transferred to replacement chests.

**Propeller statistics:** below the loot history, Fishing shows items per hour,
active Fishing ON seconds and the average active time between observed gains.
Rates count actual credited quantities; the interval average counts observations,
which can be parts of one replicated catch. No interval is shown before two
finds. OFF time is excluded, including gaps between runs. Clear history retains
statistics; Reset session clears quantities, active time and interval aggregates.
Statistics survive the 50-row history limit within this session and appear in
both tracker and history reports. The existing attribution limits still apply.

**Controls:** the application and shell share a quieter dark palette. Buttons use
lighter type, subtle shaded surfaces and smaller corners. Primary crafting/chest
run actions retain stronger accent borders and bold labels; selected, hovered,
pressed and disabled states have separate border/text treatment. Mouse and touch
feedback changes appearance without invoking gameplay callbacks. Disabled buttons
remain dim even under hover or press. All added event listeners use normal hub
cleanup. Control geometry, menu closing and automation callbacks remain intact.

Validation covers edited queue execution, preset isolation, invalid edits, locks,
priority dispatch/protection, rate/interval/OFF/reset semantics, real buttons,
dropdown layout and shared mouse/touch states, plus the full regression suite.
Live Roblox behavior and rendering remain unverified.


### Whole-queue material plan (v80)

Under **Crafting → Materials → Plan**, choose **Whole queue** to estimate the
next full run of the configured queue. **Selected recipe** remains the default
and retains the previous single-recipe/current-job view. Refresh materials and
Copy materials follow the visible scope; craft diagnostics include both scopes.
The scope dropdown pushes lower controls down and restores them when closed.

The whole-queue view lists each finite job's planned additional output and
estimated crafts, followed by combined ingredient use, current stock, planned
queue output and shortages in queue order. Shared ingredient stock is read once
per report and consumed only once in the calculation. Make amount is additional;
Top up stock uses projected stock after earlier jobs, so repeated top-ups do not
charge for the same target twice. Earlier outputs can supply later jobs, but a
later output cannot remove an earlier shortage. Ingredient use and output credits
are local estimates; no inventory, saved preset or queue descriptor is changed.

Shortages are tallied assuming the user supplies them at the step that needs
them and each earlier job succeeds. This is not an exact upfront shopping list:
restocking before the run can change Top up stock deficits. Refresh after
restocking or editing the queue. Each batch's estimated crafts round up using
explicit output metadata, and only the requested output is projected for later
jobs; possible rounding surplus is not credited. Server behavior may differ.

Unreadable ingredient stock shows unknown shortage, not zero. Missing/ambiguous
recipe costs, unknown output yield, self-consuming output recipes or unreadable
Top up output stock stop the estimate at that job. The earlier estimated prefix
is labeled PARTIAL and no full-queue total is claimed. Already-met top-ups need
no recipe metadata and spend no materials. Dense queues of at most eight finite
jobs, supported batch/target choices and bounded ingredient quantities are
validated before totals are presented.

While crafting is running, paused or finishing, Whole queue asks the user to
stop and wait for cleanup: it does not misrepresent the configured full queue
as remaining active work. Catalog/preset loading also postpones estimates.
Planning is advisory, starts no crafting, reserves no materials and does not
change existing runtime preflight, pacing, request caps or server validation.

Validation includes shared stock, queue order, intermediate outputs, repeated
and later top-ups, per-batch rounding, missing/invalid metadata, partial plans,
unknown stock, maximum totals, UI scope/copy/refresh/edit/layout/cleanup and the
full regression suite. Live Roblox costs, output quantities and rendering remain
unverified.


### Auto Build placement setup and recovery (v81)

Auto Build now checks that a usable placement route is available before starting
a worker. **Learn placement** sits beside Preview/Start: it starts the existing
manual recorder and asks the user to hide the hub and place one block manually
on their own island. It sends no placement request itself. Hosts without capture
support receive a setup message; the native game API can still work when present.
Crafting, chest and Auto Plow activity must finish before starting this capture.

Native placement readiness validates the BLOCK_PLACE_REQUEST endpoint and its
CallServer method, rather than assuming Requests.Client alone is sufficient.
Failed endpoint lookup can use an existing learned/legacy route. Once a native
request has been dispatched, rejection or transport failure never causes a second
route to send it again. Native/legacy transport uncertainty stops Auto Build
before another cell and asks the user to inspect the island before resuming.

Explicit TOO_FAST replies retry the same cell after 0.5/1/2/4/4 seconds, with at
most five retries. Stop cancels waiting; each retry rechecks normal reach. Invalid reach metadata
falls back to the normal 20-stud check. A block already observed during cooldown
is skipped. Accepted requests now receive
up to five seconds for replication instead of one; early observation still
continues immediately. Other rejection/no-gain behavior retains the three-failure
limit. Failed cells retain their ghosts for inspection and explicit Resume.
Confirmation still observes occupancy, not independent material/server identity.

Clear preview, dimension commits and placement learning remain locked while a
stopped request is still finishing. **Saved blueprints & checks → Copy build
diagnostics** reports placement readiness, worker/cleanup state, selected cells,
progress, last server result and current status. It uses the normal clipboard/
console report path and sends no requests. Saved blueprint formats are unchanged.

Validation covers unusable native endpoint fallback, no resend after dispatch,
manual learning UI, missing setup, delayed replication, cooldown/reach/Stop,
transport uncertainty, failed ghosts and cleanup locks, plus the full regression
suite. Live Roblox placement and rendering remain unverified.


### Auto Build setup check (v82)

**Check setup** is visible beside Stop/Clear in the compact Auto Build action
row. Preview the intended placement and select All layers or one layer, then
press Check setup. It does not create/move a preview, invoke placement, move the
character, start capture, reserve inventory or start a worker.

The scrollable material panel displays an **AUTO BUILD SETUP · snapshot** with
OK, ACTION, UNKNOWN and INFO lines. It checks the configured automation blocker,
placement route availability, character root, selected preview, occupied cells,
remaining material quantities and current reach. Unknown stock is not zero.
Occupied cells are excluded from material needs because the existing build
worker skips them; their material/type is not independently verified.

The summary is **ACTION NEEDED**, **CHECKS INCOMPLETE**, **LOCAL CHECKS PASS** or
**NOTHING TO PLACE**. A local pass establishes only these client-side checks;
support and island permissions still require the server. Materials/reach checks
use the selected layer only, with a normal 20-stud fallback for invalid reach
metadata matching the worker. Out-of-range cells recommend moving closer or
choosing a nearer layer. Recheck after moving or changing world/inventory state.

**Saved blueprints & checks → Copy setup check** runs a fresh setup check and
copies its full result through the usual clipboard/console path. Copy build
check retains its material-only report. Copy build diagnostics includes the
latest plan-specific setup snapshot when available. Blueprint edits, preview
replacement, layer/position/material changes and worker startup invalidate that
snapshot. Check setup/copy wait for running or finishing workers to end.

World/module/inventory reads can yield. Results are not published if the plan,
selected layer, revision, worker token or hub lifetime changes during the read.
The existing material checker now returns structured shortage/readability data
for the setup report and shares its range fallback; Start/resume, confirmation,
request envelopes, pacing and blueprint persistence remain unchanged.

Tests cover consolidated status, missing setup/character, material shortages,
unknown/error/invalid reads, occupied-only plans, layer filtering, range fallback,
read-only behavior, snapshot invalidation and changed-context reads, plus actual
setup/copy controls, compact layout and console fallback. The full regression
suite is required. Live Roblox placement, permissions and rendering remain
unverified.


### Rejected-cell retry and setup next steps (v83)

**Retry failed** appears beside Stop and Check setup. After a worker finishes,
it starts an explicit run containing only cells in the current selected layer
whose placement was clearly rejected. It preserves blueprint order and reuses
normal placement readiness, reach checks, cooldown handling, occupancy skips,
confirmation and Stop/cleanup behavior. Successful/skipped cells and cells never
attempted are not added. Normal Start/Resume still visits the full selected plan.

A rejected cell already filled by the time Retry runs is skipped without a new
request. Confirmed/skipped retry cells leave the failure set. Run progress counts
only the retry subset, and recent build results identify **Retry failed** versus
a normal run. The button is disabled when no eligible cells exist or any worker
is running/finishing. It cannot implicitly create a preview or bypass setup.

Transport uncertainty, requests interrupted while in flight, accepted requests
without an observed block, and older recorder failures without an explicit
rejection origin remain **review** cases. Retry failed excludes them; inspect
the island and deliberately use normal Resume when appropriate. A transport
error resembling TOO_FAST cannot cause an automatic cooldown resend. Failure
tracking is session-only and matches the exact cell, position/orientation and
material; changed geometry/materials are ineligible and clearing/recreating the
preview clears its tracked failures. Layer changes simply narrow the selection.

Setup reports now include ordered **Next steps**: manual placement learning,
character/preview setup, named missing blocks with quantities, reach guidance,
unknown-data refresh and eligible/review counts. The first step appears directly
below the summary. Setup and diagnostic copies retain reasons for the first eight matching cells
in the selected layer, even when a later placement succeeds. Diagnostic copies
include both counts, while Copy setup still
refreshes its snapshot without placing anything. No retry starts automatically.

Validation covers mixed success/rejection runs, occupied retry targets, selected
layers, untouched cells, changed geometry/materials, in-flight Stop, unconfirmed
and transport outcomes (including cooldown-shaped errors), successful retry
cleanup, result history and actual UI handlers. The full regression suite is
required; live Roblox placement and rendering remain unverified.


### Setup preview markers (v84)

**Move blueprint → Setup marks** is optional and OFF by default. Turning it ON
runs the existing read-only setup check for the current selected layer and colors
its remaining preview ghosts. It shares the reset-offset row, keeping the compact
page and move popup at their previous size. Check setup/Copy setup refresh the
observations; the material-only check also refreshes the same occupancy snapshot.

The legend appears in the setup report:

- **Purple:** observed occupied; the build worker will skip this cell. The
  existing block's material is not verified and no existing block is removed.
- **Red:** a recorded explicit placement rejection for this cell/material.
- **Yellow:** a recorded uncertain request or unconfirmed placement needing review.
- **Orange:** an empty observed cell outside normal reach.
- **Gray:** unavailable, invalidated or expired observation data.
- **Original blue/gold:** observed empty and in reach; server checks still apply.

Occupied observations take precedence over past failure colors. Rejection/review
records take precedence over reach. Unselected layers keep their original colors
and faint opacity; picking a ghost retains its selection emphasis. Turning setup
markers OFF restores material colors, while optional live Reach markers remain
active if enabled. Enabling setup scans waits for worker cleanup; turning markers
OFF remains available during a run.

Occupancy/reach observations are snapshots, expire after 30 seconds and are
invalidated by blueprint edits/movement, layer/run changes or respawn. Refresh Check
setup after moving or changing inventory/world state. With Reach markers ON,
their current reach state is used for the empty-cell reach color; occupied and
failure colors retain priority. Cached marker paints query no world occupancy,
perform no movement, write no files and send no placement requests. Source blocks
and saved blueprint data are unchanged. Runtime Start/Resume/Retry still perform
their existing fresh checks independently of these colors.

Tests cover every marker state, precedence, selection/layer behavior, expiry,
respawn/plan invalidation, no repeated scans, failed reads, worker locks, OFF
restoration and actual UI/worker repainting, plus the full regression suite.
Live Roblox rendering, occupancy precision and placement remain unverified.

### Auto Walk for Auto Build (v85)

Open **Auto Build → Move / Auto Walk → Auto Walk: ON**, preview the layout, then
press **Start build**. OFF remains the default: builds wait for you to move into
normal placement reach. Selecting ON alone does not start walking or building.
The popup gains one 36-pixel row; the main page keeps its compact layout.

Auto Walk uses ordinary pathfinding, walking and waypoint jumps to approach the
next empty selected cell. Already occupied cells are skipped before travel.
The destination leaves a margin inside normal reach; the build worker checks
actual character distance and occupancy again before sending. After server
cooldown, it approaches again if you have moved away. Layer selection, existing
placement learning, confirmation and rejected-only retries keep their behavior.

**Stop** cancels Build movement immediately. Resume stays locked until the old
path/request finishes cleaning up, then can start a fresh path. A blocked path,
stuck character, respawn or conflicting movement pauses the run with its preview
kept; it does not silently skip the target or repeatedly replan. Fix the route or
turn Auto Walk OFF and Resume to move manually. High layers or builds across gaps
may need you to create access first. Walk can only use paths the character can
traverse; it does not create a bridge or scaffold.

Pause Fishing, farming movement, chest walking and Auto Plow before using Auto
Walk. A new movement conflict during travel also pauses the build. Build Stop
and cleanup release only movement owned by Build. The movement selector is locked
during a run and during old-worker cleanup.

Check setup remains read-only: it reports the selected movement mode, current
reach and movement conflicts, without claiming that a path will succeed. Copy
build diagnostics includes movement mode and the last walk result. Tests cover
real navigation composed with Auto Build, Stop/Resume, blocked/stuck paths,
respawn, stale success, cooldown re-approach, occupied targets, conflicts and
actual UI adapters. The full regression suite is required. Live Roblox walking,
rendering and placement remain unverified.

### Direct chest priority and richer run reports (v86)

**Chests → Priority / protection** now shows **First**, **Normal** and **Last**
as separate buttons in the existing row. A checkmark marks the selected chest's
priority. Clicking the same choice twice keeps it selected. Choose an individual
physical chest in Targets first; all three choices are disabled without one or
while collection/manual work is running or cleaning up. Priorities still apply
to the exact chest instance for this session and retain all existing protection,
item, range and permission checks.

The existing **Runs** button cycles through the newest five completed Auto Take
runs. Reports now retain:

- Confirmed totals per item, outcome and last observed status/error.
- Elapsed seconds, explicit paused seconds and confirmed items per minute with
  explicit pauses excluded. Walking, server waits/cooldown and cleanup remain
  part of elapsed time; server waits and walking remain in the rate denominator.
- Actual withdrawal attempts and `TOO_FAST` replies, including rejected attempts.
- The run's original batch, pace, movement, ordering and Repeat settings.

Exhausted cooldown retries are labelled **Rate limited**. A run ended by unreadable
inventory is labelled **Inventory unreadable**. These describe the existing stop
conditions without adding requests or retries. Attempted amounts and transfers
that finish after Stop are not credited as confirmed gains. Invalid, backward or
failed telemetry clocks leave timing/rate unavailable while preserving totals;
zero elapsed active time has no rate.

**Copy result**, **Runs** and the new **Copy runs** action share one row. Copy
runs exports all five retained reports in one text, newest first, without changing
the displayed result or history selection. Clipboard failure falls back to the
console. History browsing/export waits for collection/request cleanup. Reports
are session-only and retain their snapshots across later runs; they do not save
remote IDs, request packets or world objects. Observed inventory gains retain
the existing attribution limits and are not an exact server reward audit.

Validation covers real Auto Take workers, pause/resume, Stop during an in-flight
request, cooldown exhaustion, unreadable inventory, transport/worker errors,
settings snapshot isolation, bad clocks, whole-history export, direct priority
buttons, disabled states and row layout. The full regression suite is required.
Live Roblox behavior and rendering remain unverified.

### Crafting queue backup and sharing (v87)

Open **Crafting → Queue backup / share** below the saved presets. The section
starts collapsed. **Export queue** puts the current working queue in a scrollable
JSON field; **Copy queue JSON** refreshes that export and copies it. If the
clipboard API is missing, throws or returns false, the JSON remains available
for manual selection/copy. A blank preset-name field uses “Shared craft queue”
for the exported name. Export does not change the queue or save a file.

Paste an exported queue into the field and click **Import JSON → replace working
queue**. Import replaces only the working descriptors and name field, clears the
old edit selection/run totals and keeps crafting OFF. Saved presets are unchanged;
explicitly Save a preset to retain the imported queue through the existing file
workflow. Importing or exporting does not start a run, learn recipes or withdraw
items. Run Queue still validates all current learned bindings before its first
request; unlearned recipes may be shared/imported but must be learned here before
running. Each normal crafting request remains capped at 100.

The portable format is a single version-1 queue preset with Name and Jobs. It
contains only recipe IDs, finite Make amount/Top up stock modes, batch and target.
Session IDs, remote paths, workbench objects and learned packets are omitted.
Existing validation requires 1–8 consecutive jobs, supported batch/target choices,
bounded names and recipe IDs. Imports accept at most 32 KiB and decode JSON as
plain data. Malformed/unsupported/oversized data preserves both the current queue
and saved presets; failed export preserves the previous text draft. Feedback
appears beside the field as well as in crafting status.

Both transfer directions lock during crafting, Pause/cleanup, recipe learning,
catalog loading and preset file work. Starting a run, editing jobs or applying a
preset also waits for a pending transfer. A changed queue, Stop cycle, account or
removed hub invalidates a pending codec result. The panel follows inline dropdown
expansion without overlapping existing presets, and long JSON scrolls within its
fixed viewport.

Tests cover descriptor-only round trips, unknown-recipe preflight, invalid data,
size limits, snapshot isolation, clipboard fallbacks, concurrent/busy/account
states, stale callback cleanup, actual controls, scroll/layout behavior and event
disconnection on GUI removal. The full regression suite is required. Live Roblox
rendering, clipboard hosts and crafting remain unverified.

### Repeat complete Auto Build layouts (v88)

Under **Auto Build → Blueprint block editing**, choose **Copies** (2, 3 or 4,
including the original) and **Gap** (0, 1, 2 or 4 additional block steps), then
press **Repeat right** or **Repeat forward**. Options are staged until a direction
is pressed. Repeat affects the entire working layout, including layers outside
the current layer selection. It works on an existing preview or a loaded/imported
working blueprint; data-only edits still need Preview to show their position.

Right follows positive local X; Forward follows negative local Z of the preview
anchor. The current world anchor, movement offset and overall orientation stay
in place. Materials, per-block rotations, heights and internal offsets are copied.
Spacing uses rotated block-sized bounds rounded up to whole block steps, plus the
chosen gap. Off-grid/tilted captured layouts may therefore get extra padding.
Copies are revalidated and sorted bottom-up under the existing 300-cell and
coordinate limits. Over-limit repeats leave the working plan and edit history
unchanged.

A repeat is one unsaved geometry edit. Existing previews are rebuilt at the same
anchor; creation is staged so a failed new preview retains the old one. Layer and
block picking reset to All layers/OFF, and old setup/failure observations are
invalidated. Undo/Redo restores the whole edit and works after subsequent preview
movement or rotation, alongside material edits. Saved library slots change only
when explicitly saved. Repeating never starts building or sends a placement
request; normal Start/Resume, reach/occupancy checks, Auto Walk and server
validation still govern the resulting layout.

The four controls are inside the existing collapsed editor, keeping the default
page compact. They visibly lock while building or waiting for in-flight cleanup.
Tests cover spacing, rotated bounds, source isolation, limits, local axes,
preview staging failure, Undo/Redo/material composition, save isolation,
explicit placement, real controls/layout and callback cleanup, plus the full
regression suite. Live Roblox rendering and placement remain unverified.

### Read-only crafting queue check (v89)

**Crafting → Check queue** combines the whole configured queue's local readiness
checks in one report. It checks the finite-job schema, current learned requests,
own-workbench reach (20 studs), readable output quantities, chest contention and
the existing ordered material estimate. Unlearned imported recipes are named;
missing requests are never synthesized. Completed Top up stock jobs still need
a valid learned binding, matching normal Run Queue preflight.

Results appear in the existing scrollable queue view, with a summary and first
Next step above the configured jobs. **LOCAL CHECKS PASS** means the readable
local observations pass; **ACTION NEEDED** names learning, reach or shortage work;
**CHECKS INCOMPLETE** retains unreadable counts, missing recipe metadata and partial
estimates as unknown. Zero is a readable quantity. Shared output/ingredient reads
are cached once per item within the check, and no extra inventory scan is needed
to repaint its report. The checker never walks, loads recipe modules, learns,
crafts, reserves materials, changes the queue or writes files.

Material rows use the existing full-queue simulation: earlier output can feed
later jobs, shared stock is spent once, and missing quantities assume earlier
jobs succeed and shortages are supplied in order. Partial metadata never claims
a full-queue total. Refresh after restocking because Top up jobs can change.
Server costs, output timing and permission checks still govern actual crafting.

**Copy queue check** refreshes the report before copying; a missing, failing or
false-returning clipboard falls back to the console. Craft diagnostics include
the current valid snapshot. Snapshots expire after 30 seconds and clear after
queue edits, imports/loads, a new craft/Stop cycle, character/root or account/server
changes, or replacement of recipe material metadata. Moving, learning or changing
inventory/world state still requires a fresh Check queue. No passing report is
used to authorize a later request; Run Queue retains its independent checks.

Checks/copies wait for crafting, Pause/in-flight cleanup, recipe learning,
catalog/preset loading and queue transfers. Starting work or editing while a
check lookup yields discards its stale result; a newer worker's status is kept.
The two actions share one new row above Remove/Clear and follow inline dropdown
layout. Long reports grow inside the existing fixed scroll viewport.

Validation covers current recipe/range/ownership checks, single-read inventory,
unknown/short/partial/already-met plans, locks, copy refresh/fallback, expiry,
context changes, actual UI/diagnostics/layout and callback cleanup, plus the full
regression suite. Live Roblox behavior and rendering remain unverified.

### Repeat floors upward or copy only one layer (v90)

**Auto Build → Blueprint block editing** adds **Repeat up** beside Right/Forward,
and a **Repeat: Entire layout / Selected layer** choice. Entire layout remains
the default and retains v88 behavior. Up follows positive local Y and preserves
cell materials and full rotations; its spacing uses rotated block-sized vertical
bounds, rounded to grid steps, plus the selected gap.

To add floors from one layer, first Preview, select a specific **Build: Layer**,
choose **Repeat: Selected layer**, set Copies/Gap and press Repeat up. Copies
includes the original selected layer. Only its extra copies are appended; all
other original layers remain. For example, a single-block-height top floor with
Gap 2 repeats every 9 studs on a 3-stud grid. Actual placement still requires
normal materials, support, reach and island permissions.

Selected layer also works with Right/Forward. It requires an explicit current
preview layer; All layers or a data-only blueprint produces guidance without an
edit. Exact-position overlaps with any retained blueprint cell are rejected
before preview/history changes. Counts use the full original layout plus only
added selected cells and retain the 300-cell and coordinate limits. Choose the
top layer or adjust spacing when copying upward would overlap another floor.

After a successful edit, Build returns to All layers and picking turns OFF, so
choose the desired layer again before another selected-layer repeat. Undo/Redo,
preview movement/rotation, saving, staged preview failure recovery and normal
Start remain unchanged. Up works on whole data-only layouts as well. The selector
and three direction buttons fit inside the collapsed editor; the default page
height is unchanged and every repeat control locks during build/request cleanup.

Island capture now rejects before scanning when a stopped build still owns an
in-flight worker, and capture-range changes also wait for cleanup. The existing
final saved-slot guard remains in place. Removed hubs cannot begin capture.

Tests cover vertical/tilted bounds, layer grouping, retained layers/materials,
overlap rejection, selected-cell limits, Undo/Redo at moved anchors, explicit
selection, real buttons/layout, cleanup locks and early capture rejection, plus
the full regression suite. Live Roblox rendering and placement remain unverified.

## Chest setup backup and sharing (v91)

Open **Chests > Chest profiles > Backup / share setup**. **Export current setup**
shows the current collection settings as JSON in a scrollable, editable field;
**Copy setup JSON** also tries the clipboard. If copying is unavailable or fails,
the JSON stays visible for manual copying. The name comes from the profile name
field. Export uses current settings, including edits since the last profile save.

Paste an exported setup and press **Import JSON → apply settings** to restore its
item filter, scope, whole-chest choice, movement/range, pace, batch size, order,
goal, per-item top-up target and repeat preference. Collection stays OFF. Import
resets the physical chest selection and refreshes the existing read-only preview.
Use **Save profile (overwrites)** to retain the imported settings in the selected
slot; importing alone preserves all three saved slots and writes no files. To
back up a saved slot, load it first, then export the current setup.

The portable envelope is Version 1 with Kind `RebornChestSetup` and a validated
Version 1 `Profile`. Only preference fields are copied. Learned requests, chest
instances, request IDs, inventory counters, cooldowns, session priorities and
exclusions are excluded. Existing exclusions, priorities, learned bindings and
the current conveyor inclusion choice remain in place after import. All items
and an explicitly empty item filter remain distinct.

Both directions reject work while collection, a manual chest request, learning,
request cleanup or another transfer owns the chest controls. Auto collection,
manual request preflight and starting chest learning also wait during JSON work.
Input is limited to 32 KiB and validated completely before applying; malformed,
unsupported or oversized input leaves current preferences, saved slots and the
JSON draft intact. Export errors also keep the draft. Removed hubs, changed
accounts and settings changed during host JSON work cannot apply stale results.
Profiles now reject save/load after hub removal or an account change as well.

The editor is collapsed initially, expands within the profile section, and moves
following controls down. Tab changes and other menus collapse it and release
text focus while retaining the draft. Tests cover preference round trips,
All/None filters, validation failures, clipboard fallback, busy/context guards,
saved-slot preservation, explicit saving after import, actual buttons, layout
restoration and listener cleanup. The full regression suite is required; live
Roblox rendering, clipboard host support and server behavior remain unverified.

## Repeated Q drop input (v92)

**Settings > AUTO DROP · Q** repeats the game's normal Q action. Select the item
you want the game to drop, choose **Q interval (seconds)**, and enable **AUTO
DROP**. Available intervals are 0.10, 0.15 (default), 0.25, 0.50 and 1 second;
each includes a 0.03-second key hold. The feature starts OFF, is never persisted
as ON, and has its own **STOP DROP** button. The counter reports completed Q
presses for the current run, not confirmed item drops or quantities.

Text/chat focus, unreadable text focus, a missing/dead character, Auto Plow and
existing fishing/bait/resource mouse-input actions pause the worker while it
stays ON. It resumes when those conditions clear. Losing window focus switches
it OFF and releases Q immediately. OFF, STOP DROP, Stop All (including the stop
timer), and hub removal also release the key. Restart and interval changes wait
for the previous worker's cleanup, preventing overlapping presses or an old
worker releasing a newer worker's key.

Paired host `keypress`/`keyrelease` functions use virtual-key code `0x51` when
available; otherwise the feature uses `VirtualInputManager:SendKeyEvent` with
`Enum.KeyCode.Q`. A failed press stops and attempts key release without replaying
through another transport. If release fails, its transport is retained so STOP
can retry; starting a new run requires successful release first. No chest/drop
remote is learned or invoked, and game permissions and actual drop behavior are
unchanged. The script does not choose an item or confirm that the game dropped it.

Tests cover cadence, focus/character/input pauses, immediate key release,
OFF→ON cleanup, host and VIM transports, failed presses/releases, actual settings
buttons/dropdown, Stop All, window focus and destruction. The full regression
suite remains required; host input support and live Roblox drops are unverified.

## Settings layout (v93)

Settings now groups its controls in five rounded cards with consistent padding,
button heights and column gaps. The automation card comes first with Stop All,
Anti AFK and the live mode status. Auto Drop follows directly below, bringing
its toggle, dedicated Stop and interval dropdown near the top of the page.

**Quick actions** expands to show Reset statistics, Apply hotbar layout and Plant
selected crop. **Interface** keeps A−, A+ and Reset view visible. **Advanced
settings** expands to show the existing timing controls, Save preferences and
current configuration. Quick actions and Advanced settings start collapsed;
opening either closes the other. Timing buttons use shorter labels with a cycle
arrow, retaining their existing values and callbacks. The obsolete V5 description
has been removed.

The normal collapsed layout is 554 logical pixels high, down from the previous
Auto Drop status ending at 802. Actual height can grow to accommodate wrapped
Auto Drop status text. Its interval menu expands the card and pushes all following
cards down, with no overlay on the status or other controls. Positions are
recomputed from the current sizes instead of accumulating offsets. Opening
another menu, switching tabs or hiding the hub restores the compact sections
without changing automation state or current preferences.

Full-application tests check visible control bounds and overlaps at window widths
640, 720 and 1080, section/dropdown transitions, layout restoration, grouping,
listener cleanup and unchanged Auto Drop input behavior. The full test suite is
required; live Roblox rendering and input routing remain unverified.

## Rotated placement learning and clearer build checks (v94)

The latest supplied placement endpoint, `mF2HsnhouMrwrl`, uses new context/body
field names. Recorder v32 now learns those fields from a manual placement,
including future unambiguous rotated placement envelopes under a net `out`
group. The existing old placement formats and native game API remain supported.
The supplied session string and coordinates are not saved into the script.
See `captured-protocols.md` for the observed packet and validation rules.

Use **Auto Build > Learn placement**, hide the hub, and place one block manually
on your island. Reopen the hub and use **Check setup**. A working capture host
or the native game placement API is still required. Preview a blueprint and
address any remaining action checks before **Start build**. **Auto Walk OFF**
is informational: moving manually within normal reach remains supported.

Setup reports now place ACTION and UNKNOWN rows before OK/INFO rows, so the short
on-screen viewport shows blockers before routine information. The main status
shows the first concrete next step. Status/report text uses size 14, the full
report remains scrollable/copyable, and a new setup check returns the report to
the top. Layout dimensions and placement behavior remain unchanged.

Tests cover the supplied endpoint and field names, refreshed session templates,
rotated/direct packets, extra/nil arguments, original-packet preservation,
ambiguity rejection, removed endpoints, server rejection, recorder migration,
report ordering and native UI scroll reset, plus the full regression suite.
Live Roblox placement and rendering remain unverified.

## Auto Build speed and action layout (v95)

The supplied recording shows build progress and some placement failures. This
update reduces avoidable local delay; it does not resolve missing materials,
unsupported blocks, island permissions or other server rejections.

**Start build / Stop** now share the first action row below the blueprint/settings
controls. **Preview / Learn placement / Check setup** share the next row. The
layer selector and new **Speed** dropdown sit together, followed by compact
Rotate, Center, Retry and Clear buttons. Start/Stop are larger, setup buttons use
size 13 text, and rotation uses a short arrow label. The collapsed tab height is
unchanged. The Standard/Fast menu expands in flow, pushes later controls and the
report down, and restores their positions on selection, another menu, a section
change or tab/hub closure. It never starts a build.

Speed defaults to **Standard**, with a target interval of 0.20 seconds between
placement request starts. **Fast** uses a 0.05-second target. Both count the
preceding request's server/confirmation time toward the target instead of adding
the full interval afterward. A short yield remains when that time already
exceeds the target. Cells already occupied yield 0.01 seconds instead of waiting
0.20 seconds each. Actual speed depends on server latency, replication and limits;
requests remain sequential and require the existing confirmation checks.

An observed server `TOO_FAST` still uses the existing bounded retry/backoff for
the same cell. It also increases the run's request gap up to 0.80 seconds. After
five confirmed placements, the gap recovers gradually toward the selected speed.
The increased gap applies after an accepted retry too. Each new run starts at its
selected target. Transport failures keep the existing no-replay/review behavior.
Speed edits lock during a run and request cleanup; diagnostics show the selected
speed, current gap and cooldown count. Speed is a session setting and is not
stored in blueprint JSON.

Deterministic tests cover Standard/Fast cadence, slow RPCs, occupied-layout
throughput, cooldown recovery, speed locks and sequential confirmation. Full UI
tests cover action bounds at 640/720/1080-pixel window widths, menu expansion,
selected-state feedback, cleanup, section/tab restoration and unchanged build
controls. The full regression suite is required. These new timings and the
revised layout have not been verified in live Roblox.

## Auto Build restocking and visible progress (v96)

Auto Build now waits when the current block's inventory quantity is readable and
zero. The run stays ON with its existing worker and blueprint. The primary build
button shows **Restock · checked/total**, and the status names the material to
replenish. After stock becomes positive, the same run resumes without another
Start click. This check runs before walking and again before placement/retries;
restocking does not bypass fresh reach, occupancy or cancellation checks.

While a known empty stock is waiting, subsequent missing/invalid/erroring quantity
reads keep the wait active until a positive readable quantity arrives. If stock
was unreadable from the outset, the existing server-validation path remains
available. Counts must be nonnegative finite integers to be treated as readable.
Waiting does not reserve stock, withdraw from chests, mark unsent cells as failed,
create additional workers or reset progress. If a waiting cell becomes occupied,
it is skipped without requiring inventory. Stop, Stop All and hub removal cancel
the wait; a late inventory update cannot send another placement.

The Start button now shows **Building · checked/total** during work and **Move
closer · checked/total** during a reach wait. Checked includes confirmed,
occupied/skipped and failed cells; it is not a count of newly placed blocks.
The existing detailed status and run history still report these counts separately.
The first-row progress updates after each processed cell, so it remains visible
without scrolling to the status/report. Diagnostics include the waiting material.
No extra layout height or new automatic inventory actions are introduced.

Tests cover repeated restocks in one run, readable-zero/unknown transitions,
occupied cells supplied while waiting, walking after restock, cooldown rechecks,
Stop during a yielding inventory read, real button text and native endpoint
dispatch. The full regression suite remains required. This new wait/progress
behavior has not been verified in live Roblox.

## Auto Build Pause / Resume (v97)

The first action row now has **Start build / Pause / Stop**. Pause changes to
**Resume** during an explicit pause, and the primary button shows **Paused ·
checked/total**. Pause is disabled without an active run. The existing tab height
is unchanged; the controls fit the supported window widths.

An explicit pause retains the same worker, cell list, selected layer, speed,
counters and run history entry. Material polling, reach waits, cooldown retries
and new placement requests wait for Resume. Auto Walk stops through the scoped
Build navigation owner. After Resume, reach, inventory and occupancy are checked
again before dispatch. Even a quick Pause/Resume before a cancelled walk or
inventory lookup returns cannot treat its stale result as permission to place.

A request already sent to the server cannot be cancelled. While it is in flight,
the UI says **Pausing**. Its response and normal five-second confirmation window
are allowed to settle, so the confirmed/failed count can change for that one
request during Pause. No further request starts until Resume. Transport errors
and confirmation failures keep their existing review/no-replay behavior. A run
that completes or errors clears its pause state normally.

Stop still ends the run and invalidates its token, including from Pause. Stop
All, the stop timer and hub removal use the same cancellation path. Plan, speed
and travel edits stay locked through Pause and request cleanup. Pausing does not
write files or create another worker/run; history elapsed time includes the time
spent paused. Diagnostics show the pause and in-flight-request flags.

Tests cover pause/resume between requests, material waits, stock arriving during
Pause, cooldown, a pending RPC, confirmation and its deadline, transport failure,
yielding inventory reads, rapid cancelled-path Resume, native buttons, bounds,
Stop and listener cleanup. The full regression suite remains required. This new
Pause/Resume behavior has not been verified in live Roblox.

## Build result details and Copy all (v98)

**Recent build results** now has **Next result / Copy result / Copy all** on one
row. Copy all exports the five retained results newest first without changing the
result currently being viewed. It can be used during a build; the active run is
included only after it ends. An empty history leaves the clipboard untouched.
The existing host clipboard/console helper handles export, and no files are
written or build actions started by copying.

New results retain their selected speed/movement, actual placement-attempt count,
observed TOO_FAST count, last response, end/stop detail and last waiting reason.
Material and reach waits that sent no requests cannot inherit another run's last
server response. Elapsed time is captured when the worker ends and still includes
manual pause time. Later preview edits, settings changes, Stop calls and current
progress mutations do not modify these stored results.

Each result counts its explicitly rejected and uncertain cells separately and
retains details for the first eight in run order. Indices refer to this run's
selected cell list, including Retry failed subsets. Reasons and other detail
strings are bounded and flattened for reporting; the snapshots contain plain data,
not live cells, CFrames, remotes, request templates or session bindings. Successful
confirmed/occupied cells clear their tracked failures, including after cooldown
retries. Unconfirmed or cancelled in-flight requests retain review guidance.

A run that reaches its end with failures is displayed as **Finished with unresolved
cells**, preserving its underlying Finished state and existing placement behavior.
Its next-step text distinguishes Retry failed candidates from cells requiring
manual island review. Stop and transport errors also retain their original run
outcomes; late results after Stop never add confirmed placements. Reports are
historical snapshots and remind the user to recheck the current island before
retrying. Earlier count-only snapshots remain readable.

Tests cover request/cooldown counts, cleared failures after success, bounded and
independent failure lists, incomplete completion, review guidance, zero-request
waits, late transport errors, all-five export ordering, active-run exclusion,
unchanged browsing state, native buttons and listener cleanup, alongside the full
regression suite. The new reports/UI have not been verified in live Roblox.

## Learned placement recovery (v99)

Auto Build now stops after the first transport error on a learned placement
route, just as it already did for the native API. A request that throws is
uncertain even when the thrown value resembles `{success=false,error="TOO_FAST"}`;
it cannot enter cooldown retries or trigger another transport. Inspect the island
before resuming. Explicit server rejections retain their actual result and remain
eligible for the existing rejected-only retry rules. Accepted responses, including
nil, still require island replication before a block is counted.

The current diagnostics and saved run results distinguish **Transport error**,
**Unavailable**, **Rejected** and **Accepted**. An unavailable template gives the
concrete instruction to learn placement again, then resume. It stops the worker
and keeps the preview; it does not automatically retry or switch routes.

Replay validates its body and prepares a copy of the learned template before
dispatch. Invalid bodies, missing remotes, unsupported methods or malformed
saved templates return unavailable without sending. A missing nested body cannot
silently fall back to modifying the request envelope. Capture v33 replaces older
recorders while retaining their learned bindings; repeated v33 startup reuses the
same recorder. These paths and native/learned adapter behavior are mock-tested.
Live Roblox acceptance and timing remain unverified.

## Compact build progress and action states (v100)

A thin progress strip fits between the existing build status and report, without
increasing the compact tab height. Green shows confirmed placements, purple shows
already occupied/skipped cells, and red shows counted failures. Unchecked cells
leave the track empty. Counts come from the current run's fixed selection, including
Retry failed subsets; the strip does not estimate success or time remaining.
Existing status text retains the numeric counts.

Pause and restock/reach waits retain progress. An outstanding request is not filled
until its normal confirmation completes, and a late result after Stop never adds
placements. Starting another run resets the strip. Clearing or editing the preview
hides old progress; selecting another layer hides the previous layer's result.
Stored result history is preserved independently.

Start is disabled while building, paused or cleaning up. Pause/Resume and Stop are
available only for a live run. After Stop, **Finishing…** / **Stopping…** show that
the same worker is still exiting; Start unlocks only after cleanup. The existing
request and single-worker guards remain active even if a callback is forced.
Disabled controls use the UI's existing disabled styling and cannot be selected
through keyboard/gamepad navigation. No extra timer or polling worker is added.

Validation covers mixed placed/skipped/failed fractions, zero segments, pause,
restock, Stop during a pending request, late completion, repeated runs, preview
revision/layer changes, history retention, removed hubs, and actual UI control
states/layout with inline dropdowns. Live Roblox rendering and behavior remain
unverified.

## Fresh build restock lists (v101)

Open **Saved blueprints & checks** and use **Copy restock**, next to **Check
materials**. It runs a fresh read-only check of the current preview and selected
layer, excludes occupied cells, subtracts readable owned quantities, and copies a
sorted list of remaining shortages. Covered materials are omitted. Unknown
inventory quantities retain their required count and explicitly unknown shortage;
they never become an invented zero or a claim that stock is sufficient. An
all-occupied selection and a fully covered inventory have distinct explanations.

The list includes selected/occupied/remaining counts and its layer scope. It does
not access chests, reserve materials or send placement requests. Copying again
refreshes the world/inventory check after restocking. Empty previews, active or
paused builds, pending worker cleanup, unreadable occupancy, and checks overtaken
by preview/run/layer/character changes or GUI removal do not export a stale list.
The check and copy controls are visibly disabled throughout active work/cleanup.
The split row fits inside the existing section without increasing the compact
page height.

Material checks now tolerate a failed reach-configuration lookup using the existing
normal 20-stud fallback estimate; failed occupancy reads still abort the check.
An attempted fresh check invalidates its older cached build report. Known shortage
counts remain snapshot estimates: occupied block types are not verified, and
support/permissions remain server-controlled.

Build report copying now treats an explicit clipboard `false` as a failure while
retaining nil-returning clipboard API compatibility. It tries a distinct alternate
clipboard function when available, then prints to the console with accurate
status. An aliased clipboard function is never invoked twice. This applies to the
new restock list and existing build diagnostics, setup/check and history exports.

Validation covers sorted mixed shortages, unknown/covered inventory, occupied
cells, selected layers, failed reach metadata, active/cleanup locks, concurrent
snapshot cancellation, clipboard failures/alternate APIs, layout and listener
cleanup. The full suite remains required; live Roblox behavior is unverified.

## Islands reference styling (v102)

The supplied `Insane_version_clean.lua` was inspected as a visual reference for
its Airflow palette, fonts and control treatment. Its game logic and remote
requests were not imported. Reborn now uses the same navy background/surface roles,
blue accent and Builder Sans family across the window and hand-built controls.
The sidebar identifies the product as **Reborn / Islands Farming**; release IDs
remain in diagnostic reports. Existing tab ordering, settings and workers remain.

Buttons use flat rounded surfaces with restrained borders instead of a gradient.
Primary actions without an explicit state background use the accent with dark
text. Hover/press/disabled feedback is retained. Fishing, Auto Bait, crop/wood
farming, mining, Anti AFK, Auto Drop and Auto Plow have compact switch indicators
with the original status text alongside. The indicator follows ON/OFF text rather
than transient result coloring, so a failed bait application cannot show its
still-enabled automation as OFF. These are decorations on existing buttons;
click handlers, cancellation and cleanup are unchanged.

Dropdown triggers split their existing text into a title, selected-value chip and
chevron. Menu-only triggers have a small arrow chip. Text/disabled/ZIndex changes
update the decoration; ordinary action text restores the original button display.
The original Text property remains intact for diagnostics and existing callers.
Value chips are capped at 190 pixels, long values truncate, and title/value areas
stay separate at supported widths. Existing inline expansion, menu exclusivity,
selection and keyboard/mouse/touch behavior remain in use.

Input fields receive matching fonts, padding, rounded surfaces and focus borders
when their tab is selected. Styling is installed once per field; revisiting a tab
does not reset values, reposition controls or add duplicate focus listeners.
Auto Build menus and its progress track use matching navy surfaces. No new
network downloads, polling tasks, saved preferences or automation are introduced.

Validation covers visual-state synchronization, mixed result/ON state, dropdown
restoration and width bounds, field focus and repeated styling, existing real
switch handlers, all tabs, resize/reset, supported/unsupported recorder hosts and
the full regression suite. Roblox rendering and live game behavior remain
unverified; the supplied script was not executed.

## Retained fishing bites and reel retries (v103)

A detected bite is retained for that exact owned bobber until the run ends or the
bobber disappears. Previously, returning to the loop after a blocked reel or an
action cooldown started a fresh Tug wait; a short Tug pulse could already have
cleared, leaving fishing waiting for another bite instead of reeling. Retained
bites now retry the reel without requiring a second pulse. Cooldown-only waits
yield instead of spinning.

A click blocked before its mouse press does not consume the three-reel recovery
budget. Dispatched input, including an interrupted hold/release, still consumes
that budget. Existing bounded recovery after three unconfirmed/dispatched reels
remains; blocked input alone cannot reset a live cast. The reel status preserves
the specific reason, such as controls covering the aim, text focus, a missing rod
or blocked mouse movement. Controls covering the saved cast aim still need to be
moved away; the script does not click through them.

Tug observation subscribes before its initial read and also checks the attribute
on the existing polling loop. Brief signaled pulses stay latched, and a missed
notification can be recovered by the next read. Stop at the timeout boundary
cannot request a reset. A removed/replaced bobber cannot authorize a stale reel.
Each bobber still counts at most one bite/miss, and catches still require observed
bobber disappearance after a successful reel. No new bait activation or extra
fishing worker is introduced.

Validation reproduces four blocked clicks after one transient bite, bites arriving
during cooldown or listener registration, missed notifications, Stop, bobber
replacement/removal and the dispatched-input recovery budget. The full suite is
required. Live Roblox reeling remains unverified; these fixes address reproduced
client-side failures, not a confirmed live server diagnosis.

## Blocked fishing mouse input (v104)

The supplied 23 October recording shows **Reel paused: mouse movement was blocked**
while a bite is already counted. The virtual mouse move fails before the press;
retaining the bite in v103 cannot by itself supply a usable input backend.

Fishing keeps its existing virtual mouse path first. If moving that mouse fails,
it can use the host's complete `mousemoveabs` / `mouse1press` / `mouse1release`
backend. The same cast aim and press duration are retained. When no mouse backend
can move, reeling can use the equipped rod's normal `Activate` / `Deactivate`
methods. Both methods are required, and a disabled rod waits. This rod-only route
is limited to reeling; casting still requires a successful aim move.

A backend is selected before the press, and its paired release is captured for
the entire attempt. Press/hold/release failures never replay the action through
another backend. Release is attempted independently after errors, Stop or a
changed tool/character. The existing GUI/text-focus and bait guards remain, and a
new attempt cannot overlap input that is still finishing. No remote endpoint or
session packet is guessed or copied.

**Stats → Copy session report** now includes the last fishing action, chosen
backend and input result. Input success is separate from catch confirmation.
Observed bobber disappearance and the existing three-attempt recovery limit still
apply, including when normal rod activation returns successfully without reeling.

Validation reproduces blocked virtual movement with host input and with normal
rod activation, paired-release snapshots, Stop, disabled rods, incomplete APIs,
failed movement/presses, GUI/focus/tool changes, casting aim requirements, real
worker confirmation and unconfirmed recovery. The full regression suite is
required. The recording confirms the v103 failure; v104 input behavior remains
unverified in the user's live client.

## Camera-aware fishing and persistent status (v105)

The next recording showed camera swings during fishing. Normal first reel
attempts now prefer the equipped rod's paired Activate/Deactivate methods,
without moving or clicking the cursor. If that attempt is rejected or does not
confirm a catch, the next separate attempt may use the existing mouse path.
The three-attempt recovery budget and observed catch confirmation remain.

Mouse-based fishing and bait input now check right-button camera dragging and
non-default MouseBehavior (including mouse lock) before moving the cursor. Casts
wait while the camera owns the mouse, then retry automatically when it is
released. Native rod reeling can continue while the mouse is captured. No camera
CFrame, camera mode or MouseBehavior is changed by the script. A camera capture
beginning during an aim delay cancels the press; one beginning during a charge
still releases that attempt's paired button. The normal GUI/focus/tool guards
remain for mouse input; direct rod activation never clicks the UI.

The existing two-line area under the Fishing switch now shows fishing's current
step independently of other automations' global status messages. Long waits show
elapsed time in that step. Repeated updates to the same step retain its start
time; a different step resets it. It refreshes through the existing board update,
with no extra polling task or page height. The session report includes this status.

Start, OFF and worker errors update the same panel. Old run tokens and a removed
GUI cannot replace the current status. Stop is also rechecked after the short
post-reel registration delay, so stopping/restarting during that delay cannot add
a stale catch or update its goals/propeller attribution.

Validation covers cursor-free native reeling, a separate mouse retry after
unconfirmed native input, both mouse-lock modes, right-button dragging, camera
capture during aim/hold, automatic resumption, bait input, Stop during catch
registration, persistent status timing, stale workers and layout. The full suite
is required. v104 reeling was confirmed by the user; the v105 camera changes and
status remain unverified in the user's live client.


## Slime farming · v106

**Mobs** is the thirteenth tab. Equip a melee weapon, press **Learn attack**, hide
or move the hub and hit one slime manually. Then enable **Auto Mobs**. The learned
weapon is shown in Setup and equipped for attacks. Learning sends no extra request;
unsupported hosts or shapes show a setup message instead of dispatching guessed
packets. Learn again after a character, account, place or server change.

The worker finds living regular slimes in both `WildernessIsland.Entities` and
`workspace.Entities`, excluding player characters and Slime King/Queen/boss names.
It keeps its current eligible target, then chooses the nearest. Search radius is
30/60/120 studs (default 60). **Scan slimes** only reports eligible targets. No
island teleport or boss spawning is performed. **Auto Walk** uses the existing
pathfinder with owner `Mobs`, stops about four studs short and rechecks character,
health, target identity and distance after travelling and equipping. Moving targets
trigger a fresh path; blocked targets get a three-second backoff. With Auto Walk
off, only targets already within six studs can be attacked.

Attacks are separated by at least 0.65 seconds and require a clear line from the
character to the target. No cursor or camera movement is used. Chat/text focus
pauses the farm. Health at or below 25% pauses walking and attacks until 45% health.
An empty scan stays ON. A changed session or missing learned weapon requires setup
again. Eight swings without an observed HP drop stop the run with a recovery hint;
a rejected or failed attack stops without replaying it through another transport.

The run panel shows swings sent, observed HP drops and observed defeats. Only a
visible positive-to-zero HP transition counts as a defeat; disappearing/streamed
mobs do not. These observations cannot establish which player earned a kill.
Stop cancels owned travel immediately, invalidates the worker and keeps Start
locked through any in-flight request cleanup. Stop All, hub removal and saved
teleports also stop combat. Starting Fishing, Bait, resource farming, chest
collection, crafting or plowing stops combat; Auto Build walking reports the
conflict. Combat refuses to start while another automation owns tools/movement.

`tools/MobFarm.lua` is the controller source; run `node scripts/embed-mobs.mjs`
after editing it. New module, recorder and full-startup tests cover the supplied
attack envelope, targeting, movement cancellation, delayed equip/attack results,
low-health/chat pauses, empty scans, failed paths, cooldowns, bounded unconfirmed
attacks, character changes, dropdown layout, learning, Stop/Start and GUI cleanup.
The full existing suite remains required. Roblox rendering, pathfinding and live
server acceptance remain unverified here.


## Visible mob start status · v107

The user's follow-up clip shows Auto Mobs OFF with the run-status card below the
visible portion of the tab; it does not show a start attempt or server error.
The underlying live attack failure is therefore not established by this clip.
The mob tab now places the status, learned weapon and counters in the same top
card as Start/Stop and removes the separate bottom status card. Start, Stop,
Learn and Scan return the tab to the top so a start blocker can be read. Blockers
name the active mode (for example Fishing), rather than only saying another
mode is busy. These checks do not turn off the other mode automatically.

**Copy result** reports current mode/status, current start blocker, learning and
binding readiness, weapon, character health, scan radius/count, last attempted
target, full last response and observed counters. It performs no attacks or
movement and omits request packets/session tokens. Clipboard exceptions or an
explicit false use the alternate clipboard function, then console output if
needed. Table-shaped server responses are formatted as readable fields in the
worker's stop reason instead of an opaque table address. The compact UI shortens
very long status messages; the copied result retains the full message.

Periodic mob UI refresh now uses the dropdown's own Refresh method. The previous
refresh replaced its styled triangle with a different, unsupported glyph, hiding
the choice decoration. Inline menus still expand the following controls.
Full-startup tests cover the visible named blocker, action-driven scroll reset,
non-overlapping status/counters, dropdown refresh, read-only result copying and
clipboard fallback/cleanup. The worker test covers a structured TOO_FAST response
without treating it as success or sending a fallback attack. Live mob farming
still needs the visible status/result from the user's Roblox client.


## Native mob weapon activation · v108

The next live clip identifies the actual failure: **NO_ANIMATION** after three
submitted swings and no observed HP drop. It also demonstrates that the worker
can find a nearby slime; the earlier OFF-mode snapshot with zero candidates did
not establish a discovery failure. The existing slime discovery scope is retained.

The worker now uses the equipped weapon's `Activate()` / `Deactivate()` workflow.
It does not replay `MobHit` alongside activation. The native weapon client owns
animation startup and its hit request, keeping those parts of the normal attack
together. The learned binding continues to identify the chosen owned weapon and
validate the character/session. No animation asset IDs or old session tokens are
introduced. A normal activation is held for 0.08 seconds, released even after an
activation/hold error, and separated from the next attempt by at least 0.65 seconds.
A disabled tool yields through its cooldown instead of stopping the farm.

Stop immediately deactivates the held weapon and invalidates the worker. A failed
release retains its owner so Stop can retry; Start and other tool automations wait
until that release succeeds. Cleanup from an old hold cannot release a newer one.
A slime dying during the activation is a completed attempt, while user Stop or a
changed character discards late completion. Observed HP drops and defeats remain
separate from activation attempts. Eight unconfirmed attempts still stop with a
weapon/range/facing hint; there is no second transport or cursor/camera fallback.

The primary control now reads **START FARMING**, with an accent background while
off. With a usable binding, the learning button reads **Relearn attack**. Clicking
it without an equipped tool points to Start and retains the ready binding instead
of suggesting the already-learned attack is missing. Same-session reloads also
show the ready message. The report names the native method and any pending
weapon release; the visible counter says swings attempted rather than claiming
that a server hit was accepted.

`mob-input.mjs` exercises actual paired Tool activation, immediate Stop during a
hold, refused/throwing activation, failed hold/release, release retry, old/new
ownership and death during activation. Worker tests use native tool methods and
fail if the legacy replay is called; they cover cooldown waiting, observations
and cancellation. Full-startup checks cover the clearer Start/Relearn controls,
ready binding without an equipped tool, and blocked handover after failed release.
Run the full suite. Native weapon compatibility, hit detection and damage still
require confirmation in the user's live Roblox client.


## Smarter slime farming · v109

Before every native swing the character now turns (yaw only) toward the chosen
slime. The weapon's own client hits what the character faces, so a slime beside
or behind the character previously received swings that could never land. A
facing failure is ignored and does not block the swing.

Visible slimes within 24 studs and roughly the same height are chased directly
with `Humanoid:MoveTo` toward a point three studs short of their current position,
updated every tick. Hopping slimes no longer cancel and recompute a full path on
every hop. A chase that gains less than half a stud in two seconds stops, cools
that slime down for three seconds and picks another. Obstructed, farther or
higher/lower slimes still use the existing `Mobs` pathfinder. Stop, pauses, an
empty scan and the attack itself clear the chase destination.

Four swings without an observed HP drop now cool down only that slime for five
seconds and switch target instead of stopping the run. The run still stops after
twelve consecutive unconfirmed swings across targets; any observed HP drop resets
both budgets. Run `node scripts/embed-mobs.mjs` after editing `tools/MobFarm.lua`.
Live hit detection still needs confirmation in the user's Roblox client.


## Mob respawn, TP hops and run rate · v110

**Auto Move** now cycles **Walk → TP hops → Off**. TP hops moves the character
in straight steps of at most eight studs toward the chosen slime, one step per
0.15-second tick, and loops until the slime is within the six-stud attack reach.
The last hop stops three studs short and never ends below the slime's centre.
Velocity is cleared on each hop. Hops are used only with a clear line to the
slime; obstructed slimes still use the `Mobs` pathfinder, so a hop never passes
through a wall. A hop that fails or makes no progress for two seconds (for
example a server position reset) cools that slime down for three seconds.

The learned attack now survives a respawn. Since v108 the worker activates the
weapon natively and uses the binding only for the weapon name and session, so
`MobBindingUsable` accepts a new character with the same account, place, server
and live attack endpoint. Death pauses the run; it resumes after respawn without
learning again. Older bindings without owner fields keep the strict check.

Recently attacked slimes are observed for three seconds after a target switch,
so late HP replication still counts and refills the no-damage budget. The run
card shows run time and, after 30 seconds, observed defeats per minute; the time
freezes on Stop. Copy result includes the move mode, hop size and run time.
Report headers now read `Reborn mob-respawn-110`.


## Whole-hub review fixes · v111

A full review of every module produced these verified fixes:

- **Learning ownership.** Mob, craft, hoe, chest and placement learning share one
  recorder whose learn-only branches swallow other calls. A new learner now refuses
  to start while another manual learner is active and names it. Stopping craft,
  hoe, chest, bait or wood learning no longer tears down a pending mob learner,
  and the mob timeout clears only its own flag.
- **Hub requests are not learned.** The game food request sent by Auto Bait no
  longer becomes the "manual" bait binding, and placement/legacy replays use a
  plain index call so the capture hook does not record or print them.
- **Owned tools during respawn.** The Backpack is scanned even while the
  character is missing (`ipairs` stopped at the nil character).
- **Panels and menus.** Clicks inside Settings Quick actions/Advanced settings and
  Chest profiles/backup panels no longer collapse them before their buttons fire.
  While Auto Build picking is on, a world click is the pick and the Pick toggle can
  turn itself off again; Escape still closes menus and picking.
- **Status lines.** The Settings mode line follows F6, goals and bait auto-start.
  A copy-all notice on the Remotes page now expires after six seconds.
- **Farming.** Wood Farm alone no longer chops fruit trees while fruit picking is
  enabled. Wood/Mine skip axe/pickaxe targets while Fishing is ON instead of
  swapping the rod out of a cast. Walk travel allows time for the distance
  (1.5 × distance ÷ WalkSpeed + 2 s, minimum 10 s); waypoint stall checks remain.
- **Auto Build.** Copy build diagnostics moved into the Library section beside
  Refresh saved slots (it sat under the next header). Leaving a field unchanged no
  longer clears the preview, retries and resume point. Stop after a finished run
  keeps its result. A pause during the last request no longer hides the final or
  failure message, and Stop at the end of the confirmation window is not counted
  as a failure.
- **Studio UI module.** A quick reopen no longer lets the cancelled hide tween
  hide the panel.

Reviewed but not changed without live confirmation: screen-coordinate GUI-inset
handling for resource/bait clicks and menu hit tests, bait retries when the bait
count is unreadable, bait applied between cast release and bobber spawn, the stats
overlay absorbing tool clicks, and `src/init.client.lua`'s sibling `require` under
Rojo. Run the full suite after editing any `tools/` source and its embed script.


## Bait timing, overlay clicks and saved mob settings · v112

- **Cast in flight.** Fishing marks the time between cast release and the bobber
  appearing (up to `CastTimeout`). Auto Bait waits instead of swapping the rod out
  of that cast, and queues as for an active bobber.
- **Unreadable bait quantity.** When the bait count cannot be read, a sent use is
  still reported as unverified (never as confirmed), but the next attempt waits the
  normal 60 seconds instead of 5 and does not switch input methods.
- **Last bait.** A bait click that was sent counts as sent even when the last bait
  disappears during the hold; consumption is still confirmed separately.
- **Stats overlay.** Rod and bait click points under the draggable stats overlay
  are treated as covered, like buttons and text fields, so another point is used.
- **Mode handover.** Starting Crafting or Auto Plow stops Auto Mobs only after all
  of their own start checks pass; a refused start leaves the mob farm running.
- **Saved mob settings.** Search radius and Auto Move (Walk / TP hops / Off) are
  saved with the other preferences when changed and restored on the next load.

Report headers now read `Reborn improve-112`.


## Bait once a minute, war-axe exclusion and mob survival · v113

- **Bait once a minute.** Every bait attempt that may have used bait (confirmed,
  unconfirmed or failed after input) now waits 60 seconds before the next one.
  Only an empty bait inventory or an unexpected client error before use is
  rechecked after 5 seconds. Queuing behind an active cast is unchanged.
- **Wood Farm ignores combat axes.** Tool names containing `waraxe` or `battleaxe`
  (for example the mob farm's `ironWarAxe`) are no longer treated as woodcutting
  or mining axes, including for the "Iron axe" preference and the resource input
  tool check. With only a war axe, Wood Farm reports that no axe was found.
- **Low-health retreat.** At or below 25% HP with Auto Move on, Auto Mobs walks
  12 studs away from a slime within 12 studs instead of standing in its attacks;
  it resumes at 45% HP. Auto Move OFF still only pauses.
- **Finish damaged slimes.** Among slimes within six studs of the nearest one,
  the farm picks the one with the lowest HP; the current target is still kept.

Report headers now read `Reborn mob-survive-113`.


## Nearest-next routing, hotbar fallback and 200-stud mob radius · v114

- **Nearest-next farm routing.** Crop, fruit, wood and mine passes no longer
  follow the order sorted at scan time. After every target the loop picks the
  remaining target nearest to where the character stands now
  (`FarmLogic.TakeNearest`, using the scan-time position of each target). With
  Walk/Tween/Teleport this removes the zigzag across a field after the first
  move. Targets without a stored position fall back to their scan distance.
- **Hotbar fallback.** `CallHotbar` resolves the game definition separately from
  sending it. A missing or renamed `CLIENT_HOTBAR_LAYOUT_UPDATE` now falls back to
  the learned hotbar request; a request that was sent is never repeated elsewhere.
- **Mob search radius** adds 200 studs (useful with TP hops) and is saved.
- **Studio UI module.** Slider, drag and RightControl listeners are tracked and
  disconnected by `Destroy()`. `init.client.lua` finds `AutoFarmUI` either as a
  child (Rojo's `init.client.lua` layout) or as a sibling (manual copy).

Report headers now read `Reborn route-114`.


## Mob hotkey and likely defeats · v115

- **F4** toggles Auto Mobs like F6 (Fishing) and F7 (Harvest). Keys typed into
  chat or other processed input are ignored. Start keeps all its normal checks.
- **Likely defeats.** Slimes usually despawn as they die, before 0 HP replicates,
  so observed defeats undercount. A recently attacked slime (within 3 seconds)
  that disappears while its last seen HP was no more than the largest HP drop
  observed this run is counted separately as a *likely* defeat. Healthy slimes
  streaming out are not counted, and observed defeats keep their strict meaning.
  The run card shows `defeats observed (+likely)`, kills/min uses both, and Copy
  result lists them separately.

Report headers now read `Reborn mob-keys-115`.


## Chest TP hops and nearest-next chests · v116

- **Movement: TP hops.** Chests → Movement now cycles **Stay → Walk → TP hops**.
  TP hops computes the same path as Walk and then moves the character along it in
  short teleports (at most 8 studs, one every 0.1 seconds), clearing falling
  velocity on each hop. It never jumps straight across when no path exists, and
  a server position reset ends the trip after a distance-based time limit. The
  approach range, 20-stud withdrawal reach, Stop/Stay cancellation and farm
  movement conflicts are the same as Walk. Chest profiles save and load the mode.
- **Nearest-next chest.** With Walk or TP hops, after the current chest's slots
  are finished the run continues with the remaining chest nearest to where the
  character now stands (FIRST/LAST priorities still win), instead of the order
  sorted from the starting position. Balance-chests order is unchanged.
- Navigation exposes the mode as `"Hop"` (`tools/FarmNavigation.lua`).

Report headers now read `Reborn chest-hops-116`.


## TP hops for Harvest and Wood Farm · v117

Harvest **Travel** and Wood Farm **Mode** now include **TP hops** (stored as the
`Hop` navigation mode) beside Walk, Tween and Teleport. It uses the path-following
short teleports added for chests in v116: at most 8 studs per hop, never straight
across without a path, velocity cleared per hop, and a time limit if the server
resets the position. Reach checks, Stop, nearest-next routing and the saved
preference work as for the other modes.

Report headers now read `Reborn farm-hops-117`.


## Shared TP hop size and lighter resource scans · v118

- **Settings → Advanced → TP hop size** cycles 4 / 6 / 8 / 12 studs (default 8)
  and drives every TP hops mode: mobs, chests, Harvest and Wood Farm. Shorter hops
  help if the server resets long ones. The value is saved with preferences.
- **Lighter Wood/Mine scans.** Other players' islands whose bounding box (cached
  for 5 seconds) lies beyond the Wood or Mine range are no longer scanned block by
  block on every pass. Your own island and islands with unknown bounds are always
  scanned.
- Tests: `full-startup.mjs` compiles the hub without indentation and comment-only
  lines (line numbers kept) and loads only referenced enums, so the fixed-size
  Luau test heap fits the full hub.

Report headers now read `Reborn hop-size-118`.


## Remembered learning across servers · v119

Remote instances, their group folders, envelope keys and session context are
renamed on every server, so a learned packet cannot be replayed elsewhere. Two
things survive a server change and are now remembered in the preferences file:

- **Mob weapon.** Since v108 Auto Mobs activates the weapon natively and uses the
  learned binding only for the weapon name. The last learned weapon name is saved
  (`MobWeapon`), and on any later server Auto Mobs starts with it without Learn
  attack. The weapon line shows `(remembered)`. Relearning replaces it.
- **Stable request definitions.** The game's own `Requests.Client` reaches the
  renamed remotes under fixed definition names (as the hub already does for food,
  harvest, hotbar, placement and block hits). Once a second, each live learned
  binding's remote is matched against those definitions and the stable name is
  saved per kind (`LearnedDefinitions`, for example `ChestBinding=…`). Nothing is
  sent during this lookup.

**Copy session report** now lists the remembered weapon and definitions and every
definition name the game exposes. Withdrawal, crafting and hoe actions still use
their learned packets on the current server; switching them to the stable
definitions needs those names from a live report first, because their bodies and
envelopes cannot be confirmed offline.

Report headers now read `Reborn remember-119`.


## Chests and hoe without learning, setup ideas from Insane_version_clean · v120

The user's earlier hub (`Insane_version_clean.lua`) was reviewed for setup and
ideas; our own remotes, learning and confirmation logic are kept as they are.

- **Remembered chests.** Learned withdrawals are saved (`RememberedChests`, up to
  64) as chest name, position relative to the owned island's pivot (0.1 stud),
  slot, item and amount. On another server the same chests are found again by
  name and island offset (within 1 stud), including whole-chest discovery, and
  withdrawals are sent through the game's stable `CLIENT_CHEST_TRANSACTION`
  request with the learned body shape `{chest, slot, item, amount,
  action="withdraw"}`. Live learned bindings for the same chest/slot still win.
  Every run keeps confirming items by inventory gain, so a request the server
  does not accept stops the run instead of repeating.
- **Hoe without learning.** When no learned hoe request exists, Auto/Captured
  plowing uses the stable `CLIENT_PLOW_BLOCK_REQUEST` with `{block}` (result shows
  "Game hoe request"); soil confirmation is unchanged. Input mode is unchanged.
- **F3** runs Stop All Automation (panic), ignored while typing.
- **Load wait.** The hub waits for `game.Loaded` before resolving anything, for
  autoexec injection.
- **Game request health.** Copy session report lists which stable game requests
  are available (chests, hoe, bait, harvest, wood/mining, build/replant, hotbar)
  and which features therefore fall back to learning or input.

Not adopted: vending/ATM/sniper, block nuke, visitor watch and auto-panic on join
(they affect other players or evade detection). Ideas kept for later: rebindable
keys, openers (cauldrons/treasure chests/eggs), Find In Chests, auto-deposit when
the inventory is full, per-mob kill report, performance mode, totem upgrades
(remote unverified) and the direct fishing protocol (comment-only in that file).

Report headers now read `Reborn no-learn-120`.


## Rebindable keys, performance mode and per-mob kills · v121

- **Keybinds** (Settings → Advanced settings): Stop all, Fishing, Harvest and Mobs.
  Click a row, then press a key; Escape cancels. Taking a key another action uses
  swaps the two. The binding key press never triggers an action, RightControl
  (hub toggle) cannot be bound, and the keys are saved with preferences. The
  Fishing button label follows its key.
- **Performance mode** (Advanced settings) turns global shadows off and disables
  particle emitters, trails, beams, smoke, fire and sparkles, including ones that
  appear later. Switching it off, or removing the hub, restores exactly what it
  changed.
- **Kills by mob.** Auto Mobs counts observed and likely defeats per mob name;
  Copy result lists them, most first.
- Tests: `full-startup.mjs` loads only the Roblox class members the hub and the
  checks mention, keeping the fixed test heap within its limit.

Report headers now read `Reborn keys-121`.


## Self-test and status history · v122

- **Stats → Run self-test** copies a read-only report (or prints it when the
  clipboard is unavailable): executor name, which host functions exist
  (file, clipboard, hook, mouse and signal APIs), VirtualInputManager, character
  health, owned island with block and chest counts, game request health, the
  number of request definitions, remembered mob weapon and chest slots and how
  many remembered chests were found on this server, whether preferences are
  saved, physics FPS, ping, place and a short server id. Nothing is sent.
- **Status history.** The last 30 distinct status messages are kept with a clock
  time and included at the end of the self-test, so a report shows what happened
  while nobody was watching.

Report headers now read `Reborn self-test-122`.


## Auto rejoin and resume · v123

**Settings → Advanced → Auto rejoin** (OFF by default, saved).

- When Roblox shows a disconnect prompt, the hub rejoins the same place only for
  connection-type errors: lost connection, timeouts, idle disconnects, server
  shutdowns/restarts and 2xx error codes. A deliberate kick and any message that
  mentions a ban, exploit, cheat, hack, suspicion or moderation is never
  rejoined. At most three rejoins are made per hour (history in
  `IslandsFarmingHub_<UserId>_rejoin.json`), and a failed teleport is retried
  after 5, 10 and 15 seconds.
- Before teleporting it saves which farms were running (Fishing, Bait, Harvest,
  Wood, Mining, Mobs). When the hub loads again within 15 minutes, it restarts
  those farms once, with all their normal start checks, and reports
  "Resumed after rejoin". Mobs can resume because the weapon is remembered.
- The hub must be in the executor's **autoexec** folder to load again after the
  rejoin; the rejoin itself works without it.
- Tests: the suite now uses `luau-web` 1.5.0, whose heap can grow, so the full
  hub keeps compiling in `full-startup.mjs` as it grows.

Report headers now read `Reborn rejoin-123`.


## Hub profiles · v124

**Settings → Quick actions** has three hub profile slots. **Profile N** cycles the
slot, **Save profile** stores every saved preference (travel modes, crops,
ranges, delays, tools, mob radius/move mode, hop size, auto rejoin, keybinds) with
a date/time name, and **Load profile** restores it through the same validation as
the preferences file, updates the controls and saves it as the current
preferences. Account memory (remembered mob weapon, chests and request
definitions) is not part of a profile. Loading is refused while a farm runs.
Profiles live in `IslandsFarmingHub_<UserId>_profiles.json`, or for the session
only without file access.

Report headers now read `Reborn profiles-124`.


## Find items in chests · v125

**Stats → Copy chest contents (find items)** lists what the chests on your own
island hold, item by item, largest totals first: for each item the chests it is
in (numbered, with block name, distance from you and amount). It reads each
chest's content folder (`Contents`, `Items`, `Storage`, `Content` or
`SellingContents`, as in the earlier Insane hub) and each stack's `Amount` value
or attribute, and reports chests without a readable folder. It is read-only and
sends nothing. `RemoteCatalog.CopyChestContents("name")` filters by item name.
Whether the current game still uses those folder names is confirmed by the first
live report.

Report headers now read `Reborn chest-find-125`.


## Review fixes for v109–v125 · v126

An independent review of the recent features found and fixed:

- **Remembered chests were overwritten.** Learning one new withdrawal replaced
  the whole remembered list with the current server's bindings. Now new entries
  are merged in front of the existing ones (one per chest position, slot and
  item, at most 64).
- **Auto rejoin after deliberate kicks.** The `error code: 2` prefix also matched
  267 (kicked), 268 (unexpected client behaviour) and 273 (account joined
  elsewhere). Only 277/279 count now; 267, 268, 273 and any message with "kick"
  (except idle kicks) are refused.
- **Mob TP hops over the void.** Each hop now needs ground within 12 studs below
  the next point; otherwise the hop fails, the slime cools down and the farm
  picks another, so Stop or a pause cannot leave the character above a gap.
- **Stats layout.** The chest contents button no longer covers the session
  statistics heading.
- **Keybinds.** Unknown (mouse clicks), Escape, RightControl, F8–F10 (capture
  hotkeys) and Q (Auto Drop) can never be bound, also from files or profiles,
  and two actions can no longer load the same key. A waiting keybind row is
  disarmed by closing menus or after 8 seconds.
- **Profile loads** now refresh Fruit picking and the settings summary; rebinding
  refreshes the summary too.
- **Resume after rejoin** reports only farms that actually started.
- **Mob target budget.** A late HP drop on an earlier slime no longer resets the
  current slime's no-damage budget.

Report headers now read `Reborn review-126`.


## Mob targets beyond slimes · v127

Mobs → Setup has a **Target** button beside the search radius. It cycles
**Slimes** (default) → **All mobs** → each mob name currently within the search
radius → Slimes. All mobs means every living non-player Humanoid model in
`WildernessIsland.Entities` or `workspace.Entities`; bosses (king/queen/boss
names), fireflies and butterflies are never targets, even when named. A chosen
name matches that exact model name. The target is saved with preferences and hub
profiles, shown in the run card, and used by Scan targets, the worker and every
recheck. Target cannot change while the farm runs. Learning and the remembered
weapon are unchanged; any melee weapon learned once is used for all targets.

Report headers now read `Reborn mob-targets-127`.


## Chests without learning from Contents · v128

The user supplied a working withdrawal script that confirms the live protocol:
each owned chest has a `Contents` folder whose children are stacks with an
`Amount` value, and
`_NetManaged.CLIENT_CHEST_TRANSACTION:InvokeServer({chest, player_tracking_category = "join_from_web", amount, tool = <stack>, action = "withdraw"})`
withdraws a stack.

- Every stack in every owned chest with a readable `Contents` folder is now a
  withdrawal target without learning (`ContentsChestRecorder`, refreshed each
  second). The Items checklist, chest selection, Whole chest, Auto Collect,
  repeat, top-up targets, Walk/TP hops travel and inventory confirmation all
  work with them. Amounts are capped at the stack size; a stack that disappears
  stops being a target.
- Content stacks use slot numbers from 1001 so they never collide with learned
  slots, and a chest item already covered by a live learned binding is not
  added twice.
- Remembered chests now also withdraw through this request when the item's
  stack is visible, falling back to the game Requests wrapper otherwise.
- The hub's own request uses a plain index call, so the capture hook does not
  record it.
- Conveyor input chests (`chestMediumIndustrialIO`) stay protected unless the
  conveyor option includes them, as before.

Report headers now read `Reborn chest-contents-128`.


## Whole-island harvest and tree types · v129

- **Harvest → Scan range** now cycles 15 … 120 studs and then **whole island**:
  every selected ready crop on your own island, whatever the distance (crops are
  only ever scanned on the owned island). Pair it with Travel: TP hops or Walk and
  nearest-next routing. Saved with preferences.
- **Wood Farm → Trees** cycles All → oak → pine → birch → palm; only trees whose
  name contains the chosen kind are cut. Fruit-tree protection is unchanged.
  Saved with preferences and profiles. The wood range button now reads
  "Range: N studs ±" to share its row.

Report headers now read `Reborn island-trees-129`.


## Auto deposit · v130

A new **Deposit** tab puts farm items from the inventory into owned chests.

- **Items** cycles Crops / Crops + wood + ores / Wood + ores. Names are matched by
  kind (crops, logs/wood/planks, ores/stone/bars); anything that looks like a tool
  or weapon (axe, pickaxe, sword, rod, hoe, sickle …), bait, seeds and saplings is
  never deposited, nor the currently held tool. **Preview** shows the stacks and
  the nearest chest without sending anything.
- **Deposit now** and **Auto deposit** (every 30 / 60 / 120 / 300 s). Each stack is
  sent with `_NetManaged.CLIENT_CHEST_TRANSACTION` using the confirmed body with
  `action = "deposit"` and the inventory tool, and counts only when the stack
  shrinks or leaves the inventory within 1.5 s. Stacks a chest does not take are
  tried in the next nearest chest (up to three).
- Chests: owned chests with a `Contents` folder, nearest first; conveyor input
  chests and excluded chests are skipped as in collection. A chest farther than
  20 studs is reached with the chest Movement setting (Walk / TP hops) within the
  approach range; Stay never moves, and with Fishing ON it never walks away.
- While depositing, Harvest/Wood/Mining and Auto Mobs pause and then continue;
  deposits wait while chest collection runs.
- Category and interval are saved; Auto deposit always starts OFF.

Report headers now read `Reborn deposit-130`.


## Review fixes for v127–v130 · v131

- **Deposit owns movement.** Harvest/Wood batches stop at the next target while a
  deposit runs and their travel cancels, so the two never steer at once.
- **One deposit at a time.** A second run (Deposit now plus Auto, or a quick
  OFF/ON) is refused while one runs. Deposits also wait for crafting, Auto Plow
  and Auto Build; chest collection and manual withdrawals wait for a deposit.
- **Stop All** (and hub removal) turns Auto Deposit off.
- **Stable content stacks.** A Contents stack keeps its own id (1001+) for as long
  as it exists, so a chosen stack never turns into another item when a stack
  before it empties. Labels show the item instead of the id. Stacks with Amount 0
  are not targets; a missing Amount means one item.
- **Remembered items not in a chest** are skipped like an empty slot instead of
  blocking the run.
- **Scope: Learned only** now excludes Contents stacks; they belong to All
  matching.
- **Never deposited** now also covers replant stock named like the crop
  (`SeedNames` of the selected crops and plant type) and more gear words (shears,
  shield, armour, helmet, pick, rake, torch …). Inventory quantities are read like
  bait (attributes and value names).
- **Layout.** Deposit status sits below the buttons and grows downwards. Profile
  loads refresh the Deposit buttons, and the overlay shows "whole island".

Report headers now read `Reborn review-131`.


## Chest collection keeps going · v132

Live report: collection took one slot and stopped; after Fast slot setup it
emptied the chest once and stopped again.

- **Contents stacks in every scope again.** v131 left Contents stacks out under
  Scope: Learned only, so a run collected only the learned slot. Stacks read from
  Contents need no learning and are now offered in both scopes; Scope only
  controls template discovery for learned slots.
- **Repeat is the default.** START COLLECTING now runs Repeat (2s) unless Run is
  set to One pass, like a refill loop.
- **Empty chests wait for a refill.** Repeat used to stop with "no current learned
  targets" once every selected chest was empty. While the Contents of owned
  chests can be read, it now waits ("Selected chests are empty · waiting for a
  refill", checking every 2 s) and collects the refill in the same run; Stop
  still ends it at once.

Report headers now read `Reborn chest-repeat-132`.


## Faster chest repeat · v133

Chests → Run now offers **Repeat (0.5s)** beside Repeat (2s) and One pass. The
fast mode starts the next pass (and rechecks empty chests) after half a second,
matching a conveyor-fed chest loop; 2 s stays the default. Chest profiles save
the speed (`RepeatFast`) and older profiles load as 2 s.

Report headers now read `Reborn chest-fast-133`.


## Mob world diagnostic · v134

A live Mobs report showed an empty scan ("no living slimes within 60 studs").
Copy result now adds a read-only world view so the cause is visible: the
Entities folders found and their child counts, the living mobs loaded at any
distance (name, count, nearest distance; bosses and critters excluded), the
current Target, and the nearest matching target with a note when it lies
outside the search radius. Mobs beyond Roblox streaming range are not loaded on
the client and cannot be listed.

Report headers now read `Reborn mob-diag-134`.


## Mobs seek just outside the radius · v135

The v134 diagnostic showed four slimes loaded with the nearest at 67 studs while
the search radius was 60, so the farm idled. With Auto Move on (Walk or TP hops),
an empty search radius now falls back to the nearest loaded matching target
within 300 studs (`SeekRange`), which is then approached and attacked like any
other target; while it stays beyond the radius it is still validated against the
seek range. Auto Move OFF never leaves the radius. The waiting message names the
distance actually searched.

Report headers now read `Reborn mob-seek-135`.


## Mob attacks click the target · v136

A live clip (ironWarAxe swinging beside a slime, 8 swings, 0 HP drops) showed
that `Tool:Activate()` plays the swing but the weapon's client hits only what the
cursor points at. Auto Mobs now attacks the way a player does:

- **Aimed click.** Each swing moves the cursor to the target's screen position and
  presses/releases mouse button 1 (host mouse functions when available, else
  VirtualInputManager), with the same guards as resource input: target on screen,
  no obstruction between camera and target, not under the hub, a control or the
  stats overlay, no text box focused, right mouse not held. Other tool input
  waits while a mob click is held (`MobMouseInput`).
- **Fallback.** When no click can land (target off screen, hub covering it, no
  mouse API), the swing uses `Tool:Activate()` as before, and Copy result names
  the reason.
- **Escalation.** After four swings with no HP change on a target, and only when a
  learned attack exists on this server (Learn attack), each later swing also
  sends the learned hit packet right after the click/activation while the
  animation plays (the bare replay that got NO_ANIMATION never runs alone).
- **Cooldown message.** A target hidden only by its five-second no-damage cooldown
  is reported as "cooling down after no HP drop · retry in Ns" instead of "no
  living slimes".
- Copy result shows the last attack method and whether a learned hit exists here.

Report headers now read `Reborn mob-click-136`.


## Emptied-chest responses keep the run going · v137

From the user's continuous-collect patch (an extract of this hub's chest section):

- A withdrawal that was sent but gained nothing, where the server answers
  empty / no items / nothing to collect / out of stock / insufficient / not enough,
  or whose Contents stack has meanwhile disappeared, is a completed check for
  this pass: the slot is marked done, the run pauses briefly and Repeat looks for
  a refill. Previously it stopped the run as "Needs review".
- Response codes `CHANGE`, `CHANGED` and `CHEST_CHANGED` are skipped like an
  empty slot instead of blocking the run.
- The rest of the patch (per-pass flag resets, fallback to the last targets) is
  already covered: states are rebuilt each pass and empty readable chests wait
  for a refill (v132).

Report headers now read `Reborn chest-empty-137`.


## Mobs: staying alive · v138

A clip showed the character standing inside a slime, nearly dead, after the run
had stopped on "No HP drop after 12 swings". Four changes keep the character out
of the mob's attacks:

- **Standoff.** With Auto Move on, a target closer than 2.5 studs is stepped away
  from (to about reach − 1) before the swing, so attacks come from the edge of
  the 6-stud reach instead of from inside the mob. Auto Move OFF never moves.
- **Safety step.** Any stop except a mode handover (Stop button, F3/F4, no-damage
  budget, errors) first steps 12 studs away from a matching mob within 10 studs;
  the status says "stepping away from the mob". While a target is only cooling
  down, a mob within 5 studs is stepped away from too.
- **Auto eat** (Mobs → Setup, default ON, saved with preferences and profiles).
  At or below 50% HP the farm eats one prepared food from the inventory (names
  with salad, bread, cooked, roast, fried, grilled, pie, soup, stew, cake, cookie,
  juice, sushi, sandwich, steak, meal or food; never bait, seeds or raw crops)
  through the game's `CLIENT_EAT_FOOD` request that Auto Bait already uses:
  equip the food, send, confirm by HP rising or the stack shrinking within 1.5 s,
  re-equip the weapon. At most one meal per 4 seconds. Copy result shows the food
  that would be eaten, meals this run and the last result.
- **Earlier retreat.** The low-health retreat now starts at 35% HP (was 25%) and
  farming resumes at 50% (was 45%).

Report headers now read `Reborn mob-alive-138`.


## Mobs: stand outside the mob, walk faster · v139

A live report with aimed clicks still showed 12 swings and 0 HP drops while the
character stood inside the slime. A melee raycast that starts inside a body hits
nothing, so the farm now keeps the character outside the mob:

- **Size-based standoff.** The standoff is half the target's width (root part
  size or model extents) plus 1.5 studs, at least 2.5 and within reach − 0.5.
  Chasing, walking and TP hops stop at standoff + 1 instead of 3 studs short,
  and a target closer than the standoff is stepped away from before the swing.
- **Walk speed** (Mobs → Setup, default 24; 16/20/24/32/40, saved). While the
  farm moves the character (chase, walk, retreat, safety step) the humanoid
  WalkSpeed is raised to this value and restored on every halt and before each
  swing. The Movement tab's custom walk, when enabled, takes precedence.
- Copy result shows the walk speed and whether the Movement tab overrides it.
- Auto eat found no food in the live inventory; it stays available for when a
  prepared food is carried, and the low-health retreat covers the rest.

Report headers now read `Reborn mob-standoff-139`.


## Mob tracking · v140

A clip showed the farm TP-hopping at a slime (39 → 7 studs) while the slime
hopped at the character, ending with the two overlapping. Three tracking rules:

- **Let it come.** A target that moves 1.5 studs or more toward the character
  between two ticks (measured from the character's current position, so the hub's
  own hops do not count) within twice the reach is waited for ("Holding · slime
  is coming") instead of hopped or chased into.
- **No swing at an airborne mob.** While the target's root is more than 4.5 studs
  above or below the character, the farm waits ("… is in the air") without
  spending the attack cadence; the standoff step-back and the aimed click follow
  once it lands.
- **Continuous facing.** Within twice the reach the character turns toward the
  target every tick, not only before a swing.

Report headers now read `Reborn mob-track-140`.


## Hits confirmed by loot and despawn · v141

A live clip showed "+2 Green Slime Ball → backpack" while the run read "0 HP
drops" and then stopped on its no-damage budget: the game does not replicate
mob HP to the client, so hits were landing unseen. Confirmation now has four
signals, any of which refills the per-target and run budgets:

- **HP drop** of the target's Humanoid, or of a `Health`/`HP` attribute or value
  on the model when the game keeps HP there.
- **Loot**: the inventory ({name=count} over owned tools) is snapshotted at the
  first swing and compared on every tick for 3 s after each swing; any increase
  counts as loot ("Loot · +N items · hits are landing"), listed by item.
- **Despawn in reach**: a mob attacked within reach + 2 studs that vanishes within
  3 s of the swing is a likely defeat when no HP drop has replicated this run.
  With replicated HP the stricter finishing-size rule from v115 still applies.
- The run stops only when none of these appear in 12 swings.

The run card shows swings · HP drops · loot · defeats (+likely); Copy result
lists loot by item. Retreats and standoff steps move horizontally, so a mob
underneath the character is stepped away from too.

Report headers now read `Reborn mob-loot-141`.


## Dodging jumping mobs · v142

A v140 report showed the slime one stud from the character at 29% HP. Slimes
attack by jumping onto the character, and the jump is visible: the mob is
airborne and closing. With Auto Move on, the farm now sidesteps five studs
perpendicular to the mob (alternating sides) while it is in the air and within
1.5 × reach ("Dodging · slime is jumping at you"), so it lands beside the
character. After every swing the standoff step-back runs again, not only before
the next swing. Starting below 35% HP shows "Low health (N%) · waiting until 50%
HP before attacking" instead of silently pausing.

Report headers now read `Reborn mob-dodge-142`.


## Tether and damage numbers · v143

Requested after a clip: teleport to the mob, stay a fixed number of studs away,
and move with it so the distance stays the same.

- **Tether.** With Auto Move on, the farm keeps the character at the kept
  distance from the target every tick, in both directions: too far → close in
  (TP hop or walk), too close → back out, moving mob → follow. "Keep distance"
  (Mobs → Setup; Auto = just outside the mob's body, or 3 / 4 / 5 studs, saved
  and in profiles) replaces the separate standoff, holding and step-back rules;
  dodging a jumping mob and the airborne wait remain. A swing follows in the same
  tick once the distance is reached. Targets with no clear line or beyond the
  chase range still use the pathfinder first.
- **Damage numbers.** The clip showed "16" over the slime: the game's floating
  damage number. Numeric TextLabels created in the world or the player's GUI
  (never the hub's own) are logged; any that appear within 1.5 s of a swing count
  as hits ("Hit · damage number 16 · hits are landing") and refill the budgets.
  Copy result shows damage numbers seen and the total.

Report headers now read `Reborn mob-tether-143`.

## Survival retreat · v144

Requested after a run that landed 4 damage numbers (72 total) and then ended
with the character dead at 0/100 HP, with no food in the inventory.

- **Earlier, longer break.** Retreat starts at 45 % HP (was 35 %) and fighting
  resumes at 70 % (was 50 %). Auto eat still goes first at 50 %.
- **Real retreat.** While recovering, the farm looks at every mob kind
  (buffalkor, lizards, skorps too, never only slimes) within 20 studs and moves
  away from all of them at once: TP hops of up to 8 studs per tick in Teleport
  mode (each hop still ground checked), or a boosted walk otherwise. It keeps
  doing so every tick, so a mob that follows is kept 20 studs off, and it waits
  only once nothing is within 20 studs. The Stop safety step uses the same
  all-mob logic.
- **Regeneration watchdog.** If HP has not risen by 2 points within 45 s of
  recovering, the run stops with "HP is not regenerating (N%) · eat or heal,
  then start again" instead of letting the character die quietly.

Report headers now read `Reborn mob-retreat-144`.

## Hit and run · v145

A v143 report showed hits landing (14 damage numbers, 264 total, 2 kills in 45 s)
while the character lost about 28 HP per slime from standing inside its reach.

- **HIT & RUN** (Mobs → Setup, next to Keep distance; default ON, saved and in
  profiles). In TP-hop mode the farm hops in to the kept distance, swings, and
  hops straight back out to 10 studs. It rests there ("Resting · slime · 10
  studs away") until the next swing is due, then hops in again. A mob that
  lands on a resting character is hit from the kept distance at once. Walk
  mode and HIT & RUN OFF keep the previous behaviour: attached at the kept
  distance. Copy result shows the setting.
- **Learned-hit escalation** is tried only when this server has a learned hit;
  a rejected packet switches the escalation off instead of printing
  "learned hit rejected" after every swing.

Report headers now read `Reborn mob-hitrun-145`.

## Recovery progress · v146

A v145 report started at 39 % HP with no food: the farm retreated to 20 studs
and showed only "Paused · low health; resumes at 70% HP".

- The paused message now shows the regeneration trend: "+0.5 HP/s · ~60 s to
  go · now 42%" while HP rises, or "HP not rising · stops in N s unless it
  does" so the 45 s watchdog never surprises anyone.

Report headers now read `Reborn mob-regen-146`.
