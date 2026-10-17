# Changelog

## Unreleased

- Enabled peer-to-peer multiplayer over STUN only (no TURN): host-authoritative validated moves, `POST /api/lobby/:lobbyId/start-game`, join rejection for started or full lobbies, and stricter signaling validation.
- Aligned game terminology with Contract/Shanghai Rummy: three-or-four of a kind are sets, suited sequences are runs, required combinations are contracts, and adding cards to table melds is laying off.
- Updated the seven round contracts and renamed corresponding game-state fields and actions. Older saved game states are normalized when loaded.
