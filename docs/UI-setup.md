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
Roblox mocks. It checks that all twelve tabs have content, switches tabs, closes and
reopens the hub, and exercises resize/reset. The reduced Roblox API name fixture
comes from MaximumADHD/Roblox-Client-Tracker's `roblox/API-Dump.json`, retrieved
2026-10-17; the mock rejects invalid initialization properties and property signals.
Mocks do not validate actual rendering, input routing, or server interactions.

In Roblox Studio, put the contents of `message.txt` into a LocalScript under
StarterPlayerScripts in your own experience. Verify that the twelve tabs render,
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
