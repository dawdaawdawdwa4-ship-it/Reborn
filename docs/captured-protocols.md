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
