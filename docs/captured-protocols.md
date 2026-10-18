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
