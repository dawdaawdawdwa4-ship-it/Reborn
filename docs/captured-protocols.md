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
