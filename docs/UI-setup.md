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
