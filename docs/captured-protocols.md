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
