# Captured request formats

The user supplied three exports: `Reborn-remotes-1792242298-1.lua` contained only
the recorder header. `Reborn-remotes-1792242353-1.lua` and
`Reborn-remotes-1792242355-1.lua` were byte-identical and contained 26 calls, so
they represent one capture, not 52 independent calls. They were inspected as data,
not executed. Session identifiers, player/island identifiers and coordinates are
not copied into application code or test fixtures.

All captured calls target RemoteFunctions below
`ReplicatedStorage.rbxts_include.node_modules.@rbxts.net.out.ULrMeokpcNr7uD`.
Each takes one table with `TrNhTTgExIb1Bg` (observed request ID) and
`TlSR8Mzd9FLwaZ` (body):

| Action | Remote | Count | Body |
| --- | --- | ---: | --- |
| Place block | `ohy6O10QKzyGZE` | 20 | `{blockType = string, cframe = CFrame}` |
| Strike block | `OEzzgCCBzocxJw` | 4 | `{block = Instance}` |
| Apply bait | `raqRasAwcny1zh` | 1 | `{tool = Tool}` |
| Set hotbar | `RZQQNNDRUvfj1N` | 1 | `{layout = string}` |

Placement includes sapling, stone and saplingOrange with both identity and
rotated CFrames. Block strikes reference a grass block; this is not a capture of
crop harvesting. Bait references the player's actual bait tool. The hotbar preset
in Settings now matches the captured ordering:
`stonePickaxe,stoneAxe,fishingRod,coal,stone,fertilizerBasic,bait,sapling`.

The hub uses the actual current target/tool/CFrame, not the recorded object paths
or coordinates. Per-remote IDs are learned by performing each action manually
once with the embedded recorder active in the current session. Missing remote or
ID means no automatic call is sent. Explicit false responses and raised errors
are treated as failed requests; a successful transport does not prove the game
awarded an item or placed a block. The captures contain outgoing calls, not server
responses, and the changed actions have not been live-tested here.

The existing crop-model request no longer uses an old fixed ID either. It requires
its own observed ID; this capture does not establish that request's body or a
working crop harvest. No direct fishing request format appears in these files.


## Confirmed crop harvest (subsequent Cobalt snippet)

The user confirmed this RemoteFunction as the crop-harvest endpoint:
`ReplicatedStorage.rbxts_include.node_modules.@rbxts.net.out.mEn0GOcgVLtb4o.COtnYCOPUThadM`.
It takes one table with the observed field names:

```lua
{
    iXwUW9mXJ8AVnK = currentSessionRequestId,
    a1tIHk1Kl9GiE5 = { model = actualCropInstance, player = currentPlayer },
}
```

The recorder recognizes this endpoint and payload without converting it to the old
field names. The model/player/session context is learned from a manual harvest in
the running session. Only the target Instance is replaced on subsequent harvests;
the pasted island name, GetChildren index, and request-ID value are not embedded.
A learned, live remote is preferred over the prompt for matching target types.
Learning continues after the capture log reaches its size limit, without adding
more records; Stop still disables interception processing. The remote catalog now
contains the original 129 references plus this confirmed endpoint (130 total).
The tests verify the new envelope and preservation of player/context, original
packet immutability, and learning while the log is full. Live execution remains
unverified here.

### Updated bait capture

Confirmed endpoint: `ReplicatedStorage.rbxts_include.node_modules.@rbxts.net.out.Cq9pvIyZubkCrb.XPQExfDjDSUkYv` (`InvokeServer`). Its observed envelope is `{ E6N43ldyV5t9lg = currentSessionId, wGquKmyB3mV2Cf = { tool = actualBaitTool } }`. Recorder version 6 learns the entire live argument list from one manual bait action, retains the session fields and replaces only the bait Tool. Auto Bait prefers this learned binding over the legacy endpoint. No pasted session ID is embedded. The catalog now includes 131 endpoints.

### Missing mining endpoint

When neither the native request wrapper nor a live legacy mining context is available, mining and wood farming use ordinary equipped-tool mouse input. This lets the game's own client build its request. Targets must be visible, unobstructed and within tool reach (game config or 20 studs). UI controls block clicks; Fishing must be paused because it shares mouse input. Stop/cycle changes cancel queued presses, and button release is attempted after input errors. Explicitly rejected remote requests never trigger a duplicate input fallback. Existing removal/readiness confirmation remains required to count harvests.

### Updated placement capture

Confirmed `InvokeServer` endpoint: `ReplicatedStorage.rbxts_include.node_modules.@rbxts.net.out.Cq9pvIyZubkCrb.u71Y03otNIwj9g`. Envelope: `{ E6N43ldyV5t9lg = liveSessionId, wGquKmyB3mV2Cf = { cframe = CFrame, blockType = string } }`. Recorder version 7 learns the complete live arguments from one manual placement and replaces only CFrame/blockType. Auto Build, planting and replanting share this route. The pasted location and session ID are not embedded. A learned binding can come from the standalone recorder and is checked for a live remote before use. Native game placement remains preferred; a rejected request never falls through to another transport. Catalog: 132 endpoints.

### Axe/block-hit and AutoReplant setting

The supplied axe call targets `ReplicatedStorage.rbxts_include.node_modules.@rbxts.net.out.Cq9pvIyZubkCrb.qn1PInnZJmfDd1`, using `E6N43ldyV5t9lg` for live context and `wGquKmyB3mV2Cf = { block = actualTreeInstance }`. Version 9 learns complete live arguments and replaces only the target. Wood and mineral bindings are stored separately; a failed request is not repeated through another transport. Tool preference still equips a matching axe before wood actions.

Game AutoReplant uses `ReplicatedStorage.xC1fgcQXCzOPJ7.nrGQVrxpfb3dKr`, with the same observed envelope and `{ name = "AutoReplant", value = boolean }`. The setting binding preserves its context/name and changes only the Boolean. Server-setting state is updated after an accepted call; local replant is suppressed while that confirmed state is enabled. Neither the supplied user/island paths nor session ID is hardcoded. Catalog: 134 endpoints.

### Fruit-picking interaction

Confirmed endpoint: `ReplicatedStorage.rbxts_include.node_modules.@rbxts.net.out.Cq9pvIyZubkCrb.Y6oBjV1u9qIAAS` (`InvokeServer`). The envelope uses `E6N43ldyV5t9lg` and `wGquKmyB3mV2Cf = { player = LocalPlayer, fruit = actualStageFruit, model = actualTree }`. Recorder version 10 learns the complete live arguments, preserves the player/session context and replaces both tree and fruit targets. The replacement fruit must still belong to the replacement tree. Rejected calls remain failures. Catalog: 135 endpoints.

The supplied `Players.LocalPlayer.PlayerScripts.TS.interact.interact` path identifies the client interaction ModuleScript; its exported functions were not supplied. This implementation uses the observed fruit request rather than guessing that module's API. No supplied island ID, player name, session ID or world coordinates are hardcoded.

### Updated wooden-axe hotbar layout

Endpoint `ReplicatedStorage.rbxts_include.node_modules.@rbxts.net.out.fZy3jBDaMuAsal.Gu0tNi2YAOdeYv` takes `{ P1ZFEJgXWM4k62 = { layout = string }, fno9F0nWmx8xVf = liveSessionContext }`. Recorder version 12 preserves these observed field names and empty layout slots. On Wood Farm startup, a live captured layout containing an axe is applied once before the shared tree worker; the axe-hit endpoint remains responsible for cutting. Pickaxe-only layouts are ignored by this startup preparation. Layout failure leaves direct owned-tool equipping available. The supplied client-inventory-service path is already used for tool selection. Catalog: 136 endpoints.

### Rotated wood-cutting endpoint

Endpoint `ReplicatedStorage.rbxts_include.node_modules.@rbxts.net.out.fZy3jBDaMuAsal.OAVO4xgiY252ym` uses `{ P1ZFEJgXWM4k62 = { block = actualTree }, fno9F0nWmx8xVf = liveContext }`. Recorder version 13 recognizes it as a block-hit request. A detached original tree can establish the argument template, but subsequent calls replace that exact Instance with the current resource. The supplied GetNil helper/debug ID is never embedded or executed; its identifier cannot select future trees. Context and payload keys remain unchanged. Catalog: 137 endpoints. Tests cover detached original targets, new target replacement, packet immutability and structured rejection.

### Current wood-cutting envelope

Recorder version 14 recognizes `out.wRLHwn9X7tFCOv.T5XIZMc0DxnCFt` with `HrGxW0IGeHngmz` context and `H3ZxjzDRyU5tvI = { block = actualTree }`. It learns nested block payloads without fixed envelope keys. Future unknown aliases are eligible only under `out` when a matching axe/resource or pickaxe/mineral is observed. Recording remains manually enabled, and live context is preserved; detached capture targets are replaced rather than replayed. Catalog: 138 endpoints.

Berry harvest: `out.wRLHwn9X7tFCOv.UctIHHAfsCxxzj` uses `HrGxW0IGeHngmz` session context and `H3ZxjzDRyU5tvI={model,player}`. Recorder v16 learns it from a live manual harvest. The supplied interact ModuleScript path does not establish an exported API, so no functions are guessed. Confirmed crop actions use an 80 ms cooldown/delay cap; unconfirmed calls retain backoff and confirmation checks. Catalog: 139 endpoints.

Current bait endpoint: `out.wRLHwn9X7tFCOv.wKCeyGAO4SqdMY` with `HrGxW0IGeHngmz` session context and `H3ZxjzDRyU5tvI={tool=actualBaitTool}`. Recorder v17 learns and preserves the live envelope. The supplied `Character.bait.food` identifies the tool client script, not an additional remote or payload argument. No script internals or fixed session ID are assumed. Manual Auto Bait control and 60-second refresh are unchanged. Catalog: 140 endpoints.

Recorder v18 learns `out.EJWEYYJBHKFykg.GDbJa5Ix6UZ8mg`, preserving its `o2PTfAjMDqKi5j` context and `YcuvKDybdDE9ik={tool}` body. Bait body keys are now discovered from the actual bait Tool Instance. Unknown future aliases are eligible under a network out group, without assuming shared context across remotes. Auto Bait prepares temporary no-log learning when no live binding exists; the next outgoing bait use establishes the template and stops learning. If native activation emits no call, one manual bait use is still needed. Catalog: 141 endpoints.

Newest bait capture: `out.skLtAq4BgI4AnK.yrIxXd1d5bBQji` uses `GzIfeyeyrx62Dp` live context and `KjPN9j5XhwOHKO={tool}`. Recorder v20 timestamps bait bindings. The hub selects the newest valid bait binding across its local recorder and standalone RebornCapture, and dispatches through that selected recorder. This prevents a still-parented old binding from masking newly captured context. Account, character and server checks remain in place. Catalog: 143 endpoints.

### Carrot chest withdrawal (chest-25)

The supplied `out.zqRqLAHd5h4QeC.kAnpiAlDrqMuEh` call withdraws `carrotHarvested` using a chest instance, slot and amount. Recorder v22 learns the observed envelope, including rotating keys and trailing arguments, without embedding the supplied account token. Rotated endpoints under `out` are recognized by the exact withdrawal body. Only finite positive integer amounts and nonnegative integer slots qualify.

Harvest → **Learn carrot chest withdrawal**, withdraw once manually, then **Withdraw carrots** repeats that chest/slot/amount. This is a single request, not a chest-emptying loop. The server determines availability and acceptance; the UI reports a request sent, not confirmed inventory gain. Relearn after respawn, account/server changes or slot/content changes. The hub requires the chest on your island within 20 studs. Quiet chest, bait and wood learning coexist, and Stop All cancels chest learning. Nothing starts on launch. The supplied `PlayerScripts.TS.interact.interact` path identifies a client script; it does not supply its source or an importable API.

### Bait engine activation (bait-activation-27)

A diagnostic with `Tool.ManualActivationOnly: true`, no learned binding and unconfirmed `Tool.Activated signal` now selects the real `Tool:Activate()` route first on initial setup. That route pairs activation with `Tool:Deactivate()` even if the press fails or Auto Bait stops during its hold. The quantity/removal check remains the consumption authority. Inventory replacement within the same character preserves fallback progress rather than restarting a failing signal route; respawn or toggling Auto Bait on resets the sequence. Diagnostics include the next activation method. Regression fixtures cover manual-only selection, replacement continuity, engine press/release and Stop/error cleanup; live account verification is still required.

### Newly captured bait templates (bait-binding-28)

An unconfirmed normal-input attempt could capture a usable bait template, then incorrectly assign that same new template to `BaitFailedBinding`. This kept refresh mode enabled and prevented the first learned replay (`Last learned request: not tried`). Dispatch now identifies the exact binding it actually replayed, and clears that attempt marker for normal/native activation. Failed input preserves the prior failed template instead of blacklisting a newly observed one. Existing consumption checks still control confirmation, including late quantity drops before the next scheduled attempt. Regression tests cover new capture during failed input, late confirmation, and replacement of a binding while an older replay fails.

### Chest quantities and response detail (chest-amount-29)

Harvest chest withdrawal defaults to one carrot, with a dropdown for 1/5/10/25 or the captured amount. Recorder v23 modifies only the cloned withdrawal body's amount and retains the chest, slot, rotating envelope and trailing arguments. Invalid, fractional and nonfinite quantities send nothing. A learned slot still needs to contain carrots; the server remains authoritative about available quantity. The hub displays bounded readable error fields (including nested errors) and offers Copy chest result rather than rendering a table memory address. This addresses stale stack counts and makes other server rejections diagnosable; the original screenshot did not expose the underlying rejection reason.

### Food mouse input fallback (bait-food-input-30)

Bait input now inspects enabled `LocalPlayer:GetMouse().Button1Down` connections owned by the exact equipped bait `food` script, in addition to Tool.Activated. If observed, the food mouse handler is tried without synthetic host input; its matching Button1Up handlers are released even on callback failure or Stop. Foreign and disabled handlers are excluded. A failed normal mouse attempt can select this route on the next retry; failed food mouse attempts yield to the existing signal/tool sequence. Quantity/removal remains required for confirmation. Reports include food mouse handler availability and bait learner state. Tests exercise both Tool and Mouse food channels through the real Auto Bait switch and Fishing handoff, including the final inventory item, plus filtering and error/Stop release. The failing accounts still require live verification; no mouse-bound handler was established from their diagnostics alone.

### Automatic carrot withdrawal (chest-water-31)

Auto Max repeatedly requests up to the learned batch amount from the captured carrot chest/slot. After no gain/rejection it halves the batch down to one, then stops after three one-item attempts without inventory progress. It does not scan unknown slots, invent a session token or send an unbounded amount. Counts come from owned `carrotHarvested` Tool attributes using the existing quantity reader; unreadable counts halt automation. Successful sends alone are not transfer confirmation. Only observed inventory increases after a non-rejected request are counted, so simultaneous external carrot gains can affect the displayed total.

A single generation-controlled worker shares the manual request lock, waits for up to two seconds for inventory replication, and enforces at least 0.6 seconds between batches. OFF, Stop All, GUI destruction, binding replacement or invalid account/character/server state prevents further requests; an in-flight RPC cannot be recalled. New learning stops the worker. The approach range is configurable to 30/60/120/240 studs, with default Walk mode approaching the owned chest through existing pathfinding before normal-distance requests. Stay mode never moves the character. Another active farming movement mode pauses chest walking. Full-startup tests exercise range controls and path cancellation; chest-auto tests cover remaining-stack collection, no-progress bounds, unreadable quantities, waiting/resume, single-worker and lock ownership, in-flight stop/restart and exception/session/GUI cleanup.

Water-hole teleport uses only the local character root CFrame saved by the user; it does not invent a remote endpoint or a map coordinate. The save is held in the current hub session with account/place/server metadata. Teleport refuses missing, dead, anchored or busy characters and cancels gameplay workers before changing CFrame and clearing momentum. Unit tests exercise these guards and cancellation; the server may still reject or correct movement in-game.

### Explicit chest movement and teleport feedback (teleport-32)

Chest motion is opt-in via Walk, with Stay as the new default. Navigation owns each approach by generation and optional owner tag. Stop("Chest") cancels only that owner's tween/path, clears the retained MoveTo destination with MoveTo(root.Position), and clears current movement. Beginning another approach invalidates the old generation; cancelled workers cannot report success or stop the new owner. Stay and Auto Withdraw OFF stop chest navigation immediately.

The dedicated Teleport tab supports three independent user-saved destinations, Back and Clear. All points are account/place/server-scoped. Back stores the location before each successful local movement. Arrival verification is delayed and generation/character/GUI guarded; it detects large post-teleport corrections but cannot attribute them to anti-cheat versus physics. No correction causes an automatic retry. Tests cover owned-only stops, immediate cancellation, default Stay, independent saves, Back/Clear UI and delayed arrival/correction checks.

### Supplied teleport presets (spawn-33)

The user supplied seven full CFrames in PlaceId `137524393306210`: Spawn `(6000.14014,-1.20368242,5997.77197)`, Own Island Portal `(6001.06689,-1.20368242,5868.05078)`, Hub Return Portal `(272.612946,97.3866577,-560.961792)`, Fishing Pond `(424.779266,87.5868607,-640.204895)`, Slime Portal `(546.674561,94.422081,-496.263855)`, Slime Return Portal `(659.497559,184.839874,-230.143631)`, and Buffalkor `(806.163635,181.826767,17.0179768)`. Presets retain all twelve CFrame components and refuse another PlaceId; unlike user-saved points, they are fixed coordinates and do not bind to the current account/JobId. They neither query nor infer each player's island location. Presets survive Clear while session saves remain account/server scoped.

### Multiple chest bindings (multi-chest-35)

Recorder v24 retains and upserts bindings by concrete chest Instance and slot, preserving each request envelope and trailing arguments. GetChestBindings filters account/character/server/remote/chest validity; explicit replay takes an optional binding without mutating the latest observed template. Existing single-chest recordings migrate on upgrade. Continuous quiet chest learning remains active until stopped, while one-shot callers retain their earlier behavior. The hub merges local/standalone bindings, deduplicates chest+slot by observation time, and offers All or one target. Auto Max uses one round-robin worker with independent amount backoff/no-progress counters; empty or invalid slots cannot stop healthy slots, and range-blocked targets cannot block reachable ones. Manual multi-chest batches are sequential and generation-cancellable. Tests exercise separate chests/envelopes/slots, duplicate updates/removal, round-robin collection, empty/invalid/unreachable target isolation, actual selector callbacks, manual All dispatch and Stop All cancellation.

### Whole I/O chests (whole-chest-37)

Recorder v25 can clone a valid observed carrot withdrawal onto another `chestMediumIndustrialIO` Instance of the same type, retaining the current envelope and trailing arguments. The hub discovers candidates only in the owned island Blocks folder within Approach range. Whole mode probes indices 0 through 12 because the supplied 12-slot chest footage does not establish zero- versus one-based indexing; a rejected boundary is skipped. No endpoint or account token is inferred. Each new slot starts at one carrot and must produce inventory gain before larger adaptive batches are used. Empty or rejected probes receive one attempt per run. The packet always requests `carrotHarvested`; arbitrary items and unknown chest layouts are not supported by discovery. Learned-only scope and captured-slot mode remain available. Runtime tests cover discovery bounds, individual selection, unchanged templates, exact cloned replay, invalid sessions, all-slot depletion and single-attempt empty probes. Live server acceptance still needs an in-game check.

### Chest routing and pass feedback (chest-routing-38)

Walk stably orders initial targets by distance and pins scheduling to the current physical chest until its pending slots finish. Failed approaches clear the preference so another target can run. Stay retains round-robin scheduling. The ON button reports completed checks; normal completion reports confirmed inventory gain and retains the last response, without claiming skipped or unconfirmed slots were empty. Tests cover nearest-first ordering, stable slot order, no return trips between batches, blocked-target isolation, and completion totals.

### Manual collection preflight and cancellation (chest-manual-39)

Manual batches cache an ownership/proximity preflight per physical chest for the duration of one pass. Blocked containers skip their remaining slots without individual RPCs or per-slot waits; every actual replay still checks ownership and distance again. Slot-level rejection does not skip other slots in an otherwise reachable chest. Pressing the manual button while busy invalidates its generation, preventing remaining requests after any in-flight response. Summaries distinguish sent requests from skipped/rejected checks and retain at most four response details. Full-startup tests exercise a 13-slot distant chest followed by a reachable chest, summary counts, and cancellation through the real manual button.

### General item withdrawals (chest-items-40)

Recorder v26 accepts a nonempty observed item string up to 128 bytes in the existing withdraw schema. Bindings retain Item; replay requires it to match the cloned observed body and never changes item identifiers. Old carrot captures retain their carrot fallback. WithdrawItems aliases the existing replay API for compatibility. Whole-chest/discovery targets are deduplicated per physical chest and item, preserving each item template. The Chests tab provides a dynamically populated item dropdown. Inventory confirmation reads the requested item quantity, so unrelated item gains cannot confirm a transfer. Mixed contents require one observed withdrawal for each desired item type; this does not infer unknown chest inventory. Tests cover generic captures and unchanged envelopes, item identity validation, per-item discovery/filters, mixed inventory confirmation, real dropdown callbacks, layout expansion and cancellation.

### Multiple item selection and remainder batches (chest-selection-41)

The Items checklist tracks independent item identifiers; nil means all learned items and an empty map means none. Changes invalidate pending manual generations and stop Auto Withdraw. Done closes the inline menu without changing selection. Automatic non-probe success caps that slot's maximum at its current successful request size, avoiding repeated resets to an oversized learned amount after backoff. Successful one-item discovery probes retain the learned maximum. Tests cover actual checklist callbacks, multiple choices, independent removal, explicit none/all, cancellation generation changes and successful reduced-batch retention.

### Collection planner (chest-planner-42)

Collection goals and selection preview reuse v41 bindings without changing the
withdraw envelope or item identity. Preview only checks local ownership and
proximity. Goals cap the requested batch to the remaining combined confirmed
item total; failures halve the actual attempted quantity. No inventory gain
means no goal progress. Unlimited remains the default, discovery still starts
with a one-item probe, and successful reduced batches retain their maximum.
Per-item totals use each binding's item-specific inventory reader. Goal changes
stop the existing generation before a new run can start.

### Session controls (session-dashboard-43)

The dashboard, stop timer and run history introduce no remote request formats.
Timer expiry calls existing Stop All cleanup and invalidates worker generations.
History retains only confirmed count summaries for at most five automatic runs;
no session identifiers, request payloads or live chest references are stored.
Cancelled in-flight withdrawals retain only previously confirmed counts.

### Mode goals (session-goals-44)

Mode goals introduce no remote formats. Fishing advances through its existing
catch counter; resource goals advance through confirmed target changes. Final
crop replanting precedes goal stopping. Mode limits invalidate only the relevant
worker through its existing OFF control. Session reporting reads counters and
mode flags without replaying requests. All mode limits default to Unlimited.

### Saved island layouts (island-blueprints-45)

The build library adds local versioned JSON block-layout data, not remote schemas.
Only the owned island Blocks folder is eligible for nearby capture. Each saved
cell contains a known block name and twelve relative CFrame components; it does
not contain session envelopes, inventory contents or scripts. Preview reconstructs
cells at the current character ground anchor. Start uses the existing placement
wrapper with unchanged `{cframe, blockType}` payloads. Save/load never place
blocks. The existing 300-block cap, normal reach and confirmation rules remain.

### Build checks and resume (build-checks-46)

No new remote format is introduced. Preflight reads existing world occupancy
and owned-item counts without requesting placement. The placement worker retains
its ownership token after Stop until an in-flight call returns; restarting waits
for cleanup. Resumed passes use the existing request and confirmation path and
recheck occupied cells before normal-reach placement. Slot inspection reads only
local validated blueprint data and never starts a build.

### Blueprint editing (blueprint-editing-47)

Material replacement edits a validated working copy's block names while retaining
its relative CFrames; it does not change saved files until Save preview. Rename
and copy use the same local JSON schema and fixed account/slot filenames. No new
remote requests or session fields are introduced. Placement still occurs only
through Start and the existing reach, occupancy and confirmation checks.

### Layer selection (build-layers-48)

Layer filters introduce no saved-file or remote-schema changes. The full layout
is retained while a stable selected-cell list feeds the existing placement
worker. Read-only material checks use the same filter. Start still applies
normal reach, occupied-cell skipping and placement confirmation. Selection is
locked through active and cancelled in-flight worker cleanup. Save preview
continues to serialize every planned cell, including unselected layers.

### Preview positioning (blueprint-position-49)

In-place rotation and centering only transform local preview/queued CFrames. No
requests, saved-file fields or session envelopes are added. Centering translates
in whole horizontal block steps; rotation composes full CFrames around the
preview anchor. Actual placement still requires Start and the existing reach,
occupancy and confirmation path. Spatial controls retain worker guards through
in-flight cancellation cleanup.

### Build workspace presentation (build-workspace-50)

Collapsible sections, shared menu cleanup and optional reach markers add no
remote formats or saved blueprint fields. Markers read character/preview distance
using the same CLIENT_REACH configuration and 20-stud fallback used by the
builder. Unknown data stays explicitly unknown. No material, occupancy, support
or server-acceptance claim is inferred from a marker color. All actual placement
continues through the existing guarded Start workflow.

### Blueprint tools and build results (blueprint-tools-51)

New Room/Bridge/Fence plans and blueprint-only block removal/replacement add no
remote formats. Named removal operates on the full working layout; layer
removal requires an explicitly selected preview layer. Surviving cells alone
feed the unchanged Start workflow. Undo, preview editing and favorites do not
send placement or demolition requests. Saved layouts keep the version-1 schema.

Material favorites use a separate bounded account-specific local JSON file,
validated before loading, with session fallback when file APIs fail. Build
history keeps up to five session-only count/outcome snapshots. Only observations
confirmed before cancellation are counted; in-flight cleanup precedes recording.
No request payloads, live instances, session identifiers or new server fields are
persisted by either feature. Actual placement still uses normal reach,
occupied-cell checks, single-worker ownership and observed block confirmation.

### Individual editing and chest pacing (editor-chests-52)

Preview block selection uses local oriented-box ray intersections and a world
occlusion distance. It does not change ghost query/collision properties or add
placement/demolition requests. Single-cell changes and bounded Undo/Redo use the
existing version-1 working blueprint schema; saved slots change only on Save.

Optional Fast chest pacing changes local waits after attempts/confirmation.
Standard remains the default. Inventory confirmation, reach, captured payloads,
learned batch ceilings, unobserved-slot probes, goals, retries and cancellation
remain on their existing paths. The learned-slots shortcut narrows target
selection and previews it without sending requests. No remote format, session
envelope or additional server field is introduced.

### Chest profiles (chest-profiles-53)

Chest profiles persist only validated local collection preferences: item names,
scope, whole-chest flag, pace, movement mode, range and goal. They introduce no
remote formats. Chest instances, slots, capture/session bindings and request
payloads are excluded. Startup only caches profiles; Load applies settings and
runs the existing read-only preview without movement or withdrawal. Loading
clears stale physical-chest selection and still requires valid learned bindings
in the current session. Active/manual/learning and cancelled in-flight workers
lock profile Save/Load. Actual collection retains the existing reach, confirmation,
retry, goal and single-worker behavior.

### Blueprint backup/transfer and native plowing (blueprint-plow-54)

Blueprint backup and import/export use the existing version-1 local layout
schema. The saved-slot writer accepts an optional validated previous layout and
writes its fixed account/slot backup filename before replacing the primary file.
Imports decode JSON and validate plain data before changing the working copy;
export/restore/import do not place blocks or store request/session envelopes.

Auto Plow introduces no remote schema. It equips an owned hoe through the
existing tool selector and uses the normal mouse-input path on owned exposed
grass/dirt, with reach, visibility, UI/chat, tool, character and cancellation
checks. Only observed owned `soil` replacements count. Input-release and worker
ownership cover Stop, errors, GUI cleanup and handoffs to other modes. Existing
resource input exposes its held-input lock so Plow cannot overlap its cleanup.
Actual native hoe effects and server acceptance remain unverified.

### Captured plowing (captured-plow-55)

The supplied hoe capture adds RemoteFunction
`out.Pyrlndnwplmt4r.PdqfVEBKHDSMfE` under
`ReplicatedStorage.rbxts_include.node_modules["@rbxts"].net`. Its observed
InvokeServer packet has a live context field `zt6b4gE9dQAF6k` and nested body
`rB3z9j3yJfeiRZ={block=grassInstance}`. Neither the pasted context value nor
the nil-instance debug ID is embedded. The catalog now contains 144 endpoints.

Recorder v27 learns the actual packet while a hoe Tool is equipped. Known plow
endpoints can be recognized during normal capture; rotated endpoint names are
learned only during explicit quiet hoe learning and must reside in an `out`
group. The packet must contain a grass/dirt BasePart as `block`, directly or in
one nested table. Learning accepts a detached sample, since normal game code may
remove it before the call. Replay clones the original complete argument list,
preserves envelope keys, context and nil positions, and replaces only that sample
instance with a live grass/dirt block in the current player's owned Blocks
folder. The nested `Character.hoe.hoe` asset is not a further request argument.

Bindings require the same user, character, JobId and a parented RemoteFunction.
The Auto Plow adapter additionally checks the equipped selected hoe, owned
exposed surface, radius and normal reach before each request. Auto chooses its
transport before starting a pass; Input preserves v54 behavior and Captured
requires a current binding. A captured rejection, exception or expiry does not
trigger native input. Only an observed owned `soil` replacement counts; Stop
invalidates the worker and retains its lock until any in-flight request returns.
Quiet learning, Stop All and GUI cleanup send no plow requests themselves.

Regression tests preserve the v41–v54 behaviors and exercise this protocol with
mock instances and placeholder context. Actual server acceptance remains
unverified in live Roblox.

### Continuous control lifecycle (continuous-controls-56)

Continuous Auto Plow reuses v55's learned hoe packet and input adapter; it adds no
remote endpoints, envelope fields or saved session data. The catalog remains at
144 entries. Default continuous operation rescans every 0.5 seconds when idle,
selects at most 100 eligible targets per scan and keeps the same normal-reach,
owned-surface, equipped-hoe and observed-soil checks. Failed targets wait at least
10 seconds before retry, with a 3-second pause after three consecutive failures.
One pass remains available with the previous bounded stop behavior.

OFF invalidates the current generation before any further target attempt. Its
worker lock stays held through input release or a pending InvokeServer return.
A UI restart request records only local intent, and starts one new worker after
cleanup if the character/island and automation state still permit it. Stop, Stop
All and GUI cleanup clear that intent. Captured-context expiry requires learning
again and never switches an active run to native input. Dropdowns, pointer access
and visual state changes introduce no server calls. Runtime tests use mocks;
live Roblox rendering, input dispatch and server behavior remain unverified.

### Potato salad withdrawals (salad-chests-57)

The new RemoteFunction is `out.cuWyO3sRPqwiuD.FiAxD3JcLWBD6I` under
`ReplicatedStorage.rbxts_include.node_modules["@rbxts"].net`. The observed
InvokeServer packet has a live context field `ptT2graQXL5nZ4` and body
`FrOcxUDTzCT48d={chest=<live instance>, action="withdraw", slot=8,
item="potatoSalad", amount=17}`. The pasted context value, island ID and
`GetChildren()[1538]` index are not embedded. `PlayerScripts.TS.interact.interact`
identifies the originating interaction script; it is not another request argument.
Catalog size: 145 endpoints. Read-only discovery now also resolves captured
endpoint names when their grouping folder changes, with the same class check.

Recorder v28 uses the generic withdrawal parser to retain the actual envelope,
chest, item, slot and learned amount. Replay clones that packet and changes only
the selected count/slot or a validated matching chest target. Slot 8 and count 17
are not constants in the collector. Known industrial I/O whole-chest collection
probes slots 0–12, including the indexing boundary retained by the existing
adapter; unknown layouts continue to use individually learned slots.

Whole-chest target generation and matching-chest discovery prefer the most recent
observed packet for each item. Separate exact slot samples are retained for
learned-slot mode, and another item observed in the same physical slot replaces
the previous binding for that slot. Only an increase in the exact requested
item's inventory total confirms collection. Existing ownership, reach, actor,
server, character, cancellation and bounded-retry rules are unchanged. Mock tests
cover the supplied schema, varying slots and counts, newest-template selection,
food-name search and item-specific confirmation; live acceptance is unverified.

### Inventory top-up limits (inventory-topup-58)

Optional Auto Take top-up targets add no remotes or request fields. The catalog
remains at 145 entries and recorder v28 retains the observed per-item packet.
The collector uses the exact requested item's current inventory count before
approach and reads it again afterward. The request amount is bounded by that
item's remaining deficit, the learned batch/remainder ceiling and the shared run
goal. Unobserved slots keep the existing one-item probe. Explicit manual batches
do not apply the auto cap, and No limit preserves v57 behavior.

Stock already at target skips approach/request work. Unreadable counts are not
converted to zero, and a response alone cannot confirm a transfer. Different
slots of one item share its live inventory count, while different items have
independent deficits. The target is frozen for the worker and does not alter
Stop, ownership, reach, current-session checks or in-flight cancellation.

Profile version 1 now accepts optional `StockTarget`, validated as 0, 25, 50,
100, 250 or 500; an absent value means 0. Only this local preference is saved,
never current inventory or a request/session envelope. Session history snapshots
the run's target and observed new transfers. Mock tests verify these limits and
adapters; actual live server and input behavior remain unverified.

### Delayed food stack quantities (salad-confirmation-59)

No new endpoint, envelope key or packet schema is introduced. The inventory
adapter can return a pending-metadata reason while a matching Tool lacks readable
quantity attributes/values. Chest confirmation polls that state inside the
existing two-second window. A valid increase for the exact requested item permits
the next learned batch; an invalid count or unresolved timeout stops the run.
No secondary request is sent while the quantity is unknown. Pre-request/top-up
waiting uses the same cancellation checks, and late counts after Stop remain
unconfirmed.

Manual batch defaults to the observed **Learned** count rather than one item.
Explicit counts still pass through the existing replay validator, and a count of
1 remains selectable. Captured chest, item, slot, session envelope, reach and
ownership rules remain in place; unknown quantities are never replaced by a
guessed stack size. The catalog remains at 145 entries and recorder v28 is
unchanged. Mock regression tests exercise actual quantity parsing with delayed
attributes, batch continuation, timeout/Stop and manual 17-versus-1 dispatch.

### Explicit thirty-item batches (stack-thirty-60)

The user requested thirty-item withdrawals followed by continued collection from
the same stack. Auto Take now snapshots a requested maximum of 30 per slot, and
the manual dropdown defaults to 30. This explicitly selected amount can exceed
the count in the manual learning sample. Replay still clones the live packet and
changes only its existing amount/validated target fields; captured metadata is
not overwritten. No endpoint, envelope or schema is introduced (145 catalog
entries, recorder v28).

A confirmed stack keeps priority through subsequent batches and bounded remainder
retries. Unknown slots retain the one-item probe; an empty, invalid or completed
slot releases priority, as does loss of reach. Goal/top-up limits can reduce a
request below 30 and stop collection before the stack empties. Session, ownership,
reach, exact-item confirmation and cancellation checks remain. Tests exercise
same-slot request order, thirty-item payload amounts and smaller remainders;
actual live acceptance remains unverified.

### Optional repeat passes (repeat-chests-61)

Repeat collection introduces no remote or packet fields; the catalog remains at
145 entries and recorder v28 is unchanged. One pass stays the default. An
explicitly started Repeat worker waits five seconds between completed passes,
with no withdrawal requests during that interval. It then rebuilds states from
current selected/valid learned targets and starts refreshed checks with one-item
probes. Confirmed stacks retain the thirty-item maximum and same-slot priority.
Empty probes do not inherit a sequence of large rejected batch attempts.

The worker retains its original batch, run goal and top-up preference. Confirmed
totals are cumulative across passes, while each request is limited by the live
per-item deficit and remaining combined goal. If top-up is already satisfied,
the worker can wait without approach or withdrawal until a later check observes
consumption. It stops if no current learned targets survive or inventory becomes
unreadable; session, ownership, reach and confirmation checks remain in place.

The repeat delay checks cancellation every 0.1 seconds. Stop invalidates the
generation, and the single-worker lock remains through cleanup. Profile schema
version 1 accepts optional boolean `Repeat`, default false; it persists only the
local preference, not bindings or requests. Tests cover fresh slot selection,
bounded probes, timing, cumulative goals, top-up, cancellation and profile/UI
adapters. Live Roblox acceptance remains unverified.


### Shorter collection pacing (clean-chests-62)

This version changes local pauses and UI only: 145 catalog entries and recorder
v28 remain. Manual and confirmed automatic batch pauses are now 0.25 seconds on
Standard and 0.1 seconds on Fast. Repeat waits two seconds after each completed
pass. Auto remainder retries pause 0.35/0.2 seconds and single-item no-progress
retries pause 1/0.5 seconds; the existing retry limits remain.

The two-second inventory confirmation window, exact-item counting, unknown-slot
probes, same-stack priority and current-session/ownership/reach validation remain.
Manual replay stays serialized and checks cancellation before each next request.
No payload, endpoint or profile schema changes. Mock timing, cancellation,
confirmation and complete regression checks pass; live acceptance is unverified.


### Rate rejection handling and adaptive batches (adaptive-chests-63)

The supplied live v62 result was `{error="TOO_FAST", success=false}` for a carrot
withdrawal. Recorder v28 already reports that as a rejected request. The worker
now recognizes that exact code in bounded structured error fields and retries
the same amount after a server cooldown, keeping probe/maximum/remainder state.
The same handling applies to manual withdrawal. Exponential cooldowns are bounded
to 4 seconds and five consecutive rate rejections stop the check/run. Learned
pacing carries across later chest requests in the current script session.

Requested Auto Max now grows from 30 or a larger observed count, up to a local
1000-item request ceiling. Growth requires full exact-item inventory gain. A
partially fulfilled request or confirmed smaller fallback retains the smaller
ceiling. A one-item unknown-slot probe still precedes growth. Goal/top-up limits,
current owned chest/session/reach validation and quantity confirmation remain.
Learned slots are checked first without omitting any supported whole-chest slot.
Neither the catalog (145 entries) nor the replay packet shape/recorder changes.
Actual acceptance of larger amounts must be verified live; the local ceiling is
not a discovered Roblox server limit.

Pause keeps the same worker/bindings and lets sent transfers settle; it blocks
new sends and freezes Repeat/cooldown timers. Stop/GUI cleanup can cancel a paused
worker. No packet contains pause or pacing state. Profiles accept only the new
validated optional `AutoBatch` preference (old profiles retain fixed 30), never
live bindings, pause state or rate timing. Mock rate-limit, amount, cancellation,
confirmation, profile and full regression checks pass; live v63 is unverified.


### Recovering learned pacing (paced-chests-64)

The v63 recording confirms collected inventory and a long normal inter-request
wait; it does not establish the server's maximum batch or required interval.
V64 keeps the `TOO_FAST` handling but reduces a previously raised interval by
20 percent after three non-throttled server replies, never below the selected
base pace. A fresh rate rejection resets the streak and uses the existing bounded
backoff without changing the batch or treating the slot as empty.

Structured empty/rejected replies with a boolean `success` also provide server
pacing evidence. Local validation strings and transport errors do not. Manual
and automatic loops share this runtime policy. Ordinary request pacing and retry
cooldowns have separate UI labels; Pause/Stop and GUI cleanup apply to both.

An optional Fast slot setup selects the existing matching-chest/learned-slot mode
while preserving item filters, distinct learned slots and packet bindings. It
never starts collection and leaves whole-chest coverage available as an explicit
choice. No remote, payload, catalog (145 entries), recorder v28 or persisted
profile schema changes. Mock pacing, retry, amount, target/UI and complete
regression checks pass; live v64 acceptance remains unverified.


### Stable server interval estimation (stable-chests-65)

The new v64 recordings show successful 30-item batches with renewed multi-second
cooldowns. V65 replaces repeated fixed-percentage probing with measured accepted
and rejected request-start intervals. It can reuse a known accepted interval on
`TOO_FAST`, bisect a wider rejected/accepted bracket, and hold a narrow working
bracket. Rejected accepted-bounds are invalidated, while stale rejection bounds
expire after twelve non-throttled replies. Unknown/new limits retain the four-
second backoff bound and five-consecutive-rejection stop.

Adaptive waiting subtracts request/confirmation work and checks the remaining
interval before an immediate new run can resend. Pause, Stop, current bindings,
ownership, reach, exact inventory confirmation and amount/goal/top-up limits
remain. Timing state is shared by manual/automatic chest workers during this
script session and is never persisted or sent in packets. Fixed batch and scan
preferences remain unchanged. The catalog stays at 145 entries and recorder v28.

Mock stable/changing-limit, latency, restart, full-batch, manual/UI and complete
regression checks pass. Actual Roblox request timing and throughput of v65 must
still be verified live.


### Balanced target scheduling (balanced-chests-66)

An optional Balance chests preference rotates to another physical chest after
confirmed progress and rotates selected item/slot cursors within each chest.
Same stack remains the default. Retry amounts, captured bindings and exact-item
confirmation remain: `TOO_FAST` and remainder retries stay on their original
slot before scheduling another target. Unreachable/invalid states cannot
monopolize reachable targets. Only one request worker runs, using the same
learned global pacing and bounded backoff.

Cumulative goals, live per-item deficits, Pause/Resume and Stop are preserved.
Repeat refreshes cursors with current target bindings. Profiles accept optional
validated `Order` (Same stack / Balance chests); missing values retain the former
behavior. No packet, remote, catalog (145 entries) or recorder v28 changes.
Mock scheduling, rate-retry, target, profile/UI and full regressions pass; live
v66 behavior remains unverified. Balancing does not establish why a server
rejects all requests in a run with zero confirmed inventory gain.

### Bait crafting (craft-bait-67)

The supplied outgoing Cobalt call uses RemoteFunction
`ReplicatedStorage.rbxts_include.node_modules.@rbxts.net.out.cuWyO3sRPqwiuD.tIFPj2BFAwqodE`:

```lua
{
    ptT2graQXL5nZ4 = currentRequestContext,
    FrOcxUDTzCT48d = {
        toolName = "bait",
        workbenchBlock = actualWorkbench2,
        amount = 100,
    },
}
```

The `PlayerScripts.TS.interact.interact` path identifies the observing client
module; it is not another RPC argument. The pasted context and island ID are not
embedded. Catalog size is now 146 and the recorder is version 29. Quiet **Learn
bait craft** accepts only the bait recipe, a live `workbench2`, and an integer
batch of 1–100. The complete observed argument list, including trailing nils and
unknown envelope fields, is retained. Replays clone it and change only `amount`;
they retain the captured workbench. A rotated group/endpoint can be learned under
`out` from the same exact payload shape. Other recipes are ignored.

Bindings belong to the current account, character and server. Removed remotes or
workbenches invalidate them. The application additionally requires the workbench
to remain on the player's own island and within its local 20-stud guard. The
controller requests at most its chosen batch or current target deficit. The
capture does not establish recipe costs, output-per-craft, server reach, or a
working server response; those are not guessed. Only an observed increase in
bait inventory confirms progress, and unconfirmed gain or server rejection stops
the run. Cooldown retries are bounded and respect Stop. No automatic purchasing,
material withdrawal, or switching to another player's workbench is introduced.

v67 also groups unreachable chest slots by physical chest and rescans all deferred
targets once per second without changing Stay/Walk selection or packet formats.
The reported v65 "stand within 20 studs" message describes a local reach wait,
not evidence of `TOO_FAST`. Tests cover the recorded craft packet and controller
behavior with mocked Roblox services; live v67 behavior remains unverified.

### Explicit craft amount versus inventory target (craft-amount-68)

The user clarified that crafting accepts a maximum of **100 per request**.
The existing learned `tIFPj2BFAwqodE` replay already rejects amounts outside
1–100. v68 retains this limit and the exact recorded bait/workbench envelope;
no remote, token, recorder format or catalog entry changes (recorder v29,
146 endpoints). A total run goal above 100 is fulfilled only by successive
requests capped by the selected 25/50/100 batch and confirmed remaining goal.

**Make amount** now counts confirmed positive bait inventory growth during the
run and ignores pre-existing stock when computing the remaining goal. **Top up
stock** retains v67's comparison against total inventory. This resolves the
reported 3,770-stock case, where v67's maximum target of 1,000 could not initiate
a craft even with a valid binding. The expanded total goal choices do not raise
the RPC amount limit. Craft mode/batch/goal are frozen for each run. Recipe
output is still observed rather than inferred, and unconfirmed growth stops.

The new craft report is read-only, distinguishes craft binding/learning from
bait-use binding/learning, and omits captured session context. Regression tests
verify the high-stock scenario, request caps, final remainder and both goal
semantics. Live server acceptance remains unverified.

### Learned recipe catalog and Continuous mode (auto-craft-69)

Recorder v30 generalizes the existing observed crafting shape. A live
RemoteFunction invocation on the known craft endpoint, or beneath `out` with
that same payload shape, can teach a nonempty `toolName` (up to 128 bytes), a
live Model/BasePart `workbenchBlock`, and integer `amount` 1–100. The learner
retains one latest binding per exact recipe name in `CraftBindings`. Learning
another recipe does not rewrite the former recipe's item, workbench or envelope.
No new endpoint/catalog entry is added (146 endpoints).

`CraftItem(amount, binding)` clones the selected recipe's observed arguments and
changes only `amount`. It checks the captured account, character, server, remote
and workbench. The legacy `CraftBait` helper selects the bait binding explicitly,
even after another recipe was learned. Upgrading a v29 recorder migrates its
existing bait template into the recipe catalog without changing its envelope.
The application checks own-island membership/reach and confirms inventory growth
under that selected `toolName`; an unobservable or differently named output
stops instead of inventing a successful craft. A new recipe/workbench cannot be
substituted into a running operation.

Continuous mode changes only local scheduling. It repeats successful confirmed
batches, each capped at 100, until Stop or the existing bounded failure policy.
It does not skip server rejection, material requirements, output confirmation or
normal access/range checks. Other recipe shapes, output ratios and server costs
are not established by the supplied bait capture. Tests use synthetic second
recipe captures to validate isolation; live non-bait compatibility remains
unverified.

### Conveyor I/O exclusion (conveyor-guard-70)

The subsequent video shows the v68 Chests UI collecting from a scope of 25
matching chests, with the known industrial Input/Output chest type at the
conveyor. v70 adds local **Skip / Include** selection for
`chestMediumIndustrialIO`. Skip is the startup default. It blocks both automatic
and manual hub withdrawals from that type, including discovered, whole-chest and
repeat targets, before invoking any withdrawal request. Normal game/manual
learning remains pass-through. Explicit Include restores the prior observed
withdrawal format and behavior; it does not establish priority over the belt.

This changes no endpoint, packet, session context, slot range or request pacing.
Catalog size remains 146 and recorder v30 is unchanged. Tests cover mixed regular
and protected chests, all-protected selections, repeat queue construction,
preflight rejection, Include and profile-load isolation. It is a type-based
exclusion, not inferred conveyor topology; live behavior remains unverified.

### Sequential crafting jobs (craft-queue-71)

v71 changes local scheduling/UI only. It adds up to eight finite crafting jobs,
each with an explicit learned recipe name, mode, batch and amount/target. At Run
Queue, the application resolves and validates every job's binding before sending
anything, then freezes those references for one sequential worker. The displayed
configured queue stores no captured argument list, remote or token and is not
persisted. Recorder v30 and the catalog of 146 endpoints are unchanged.

Each job uses its own exact recorded crafting envelope/workbench and confirms
only growth of that recipe's inventory item. Per-request amounts remain 1–100;
a final partial batch can be smaller than the selected batch. The queue advances
only when a finite job's confirmed goal is met. Failure stops remaining jobs;
TOO_FAST retains its existing bounded retry policy on the same active recipe.
Stop invalidates the single worker generation and prevents later jobs from
starting. An in-flight request still needs to finish before cleanup/restart.

Make amount, Top up stock and single-recipe Continuous are unchanged. Continuous
is excluded from finite queues. Tests cover recipe order, original binding and
settings remaining fixed, complete preflight, capped quantities, failure/Stop
isolation and the existing build/plow/chest/fishing regressions. No server cost,
output ratio, dependency graph or live queue compatibility is inferred; live
Roblox operation remains unverified.

### Automatic recipe listing and propeller observation (recipes-propellers-72)

v72 adds no endpoint, packet, token or recorder format (146 catalog endpoints,
recorder v30). The explicit recipe-list loader inspects cached/loaded recipe and
item metadata exports and, when necessary, clearly named recipe/config metadata
ModuleScripts under ReplicatedStorage. It parses tables for actual recipe output
IDs; it neither invokes export functions nor constructs a request for those IDs.
Catalog-only selections remain unlearned until their own manual craft supplies
the complete observed binding. This is bounded client-data discovery, not a
claim that every server-only/locked recipe is exposed or craftable.

Craft Pause retains the existing generation and queue state. Only unsent work
waits: accepted in-flight output can still be confirmed. Resume revalidates
binding/actor/reach immediately before another request; Stop cancels the same
worker. Existing request caps, context checks and cooldown behavior remain.

Propeller stats use validated owned-inventory quantities and a bounded window
around an actual Auto Fishing reel. Bobber removal must be confirmed before a
positive quantity difference is credited. No new pickup, fishing or reward
remote is invoked. Chest/craft request dispatch invalidates an overlapping
propeller window to prevent those hub actions being attributed to fishing.
Unobservable quantities or external simultaneous inventory gains cannot establish
an exact server reward source. Tests cover stacked and delayed quantities,
repeated samples, respawn/OFF, timer/reset, hub conflicts and the UI. Live v72
recipe compatibility and reward attribution remain unverified.
