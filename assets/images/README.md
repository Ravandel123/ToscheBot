# assets/images — art the bot's renderer draws ON

Repo-committed images used by the compositing pipeline (`src/game/images/`, D46):
map bases, avatar frames, board/piece art. Every file here is referenced by an
entry in the `IMAGE_ASSETS` catalog (`src/game/images/assets.ts`) — id, relative
path, and optional named anchor coordinates. Add the file and the catalog entry
in the same commit; a test validates that every catalog entry's file exists.

Art that is only *linked* (a plain embed image, nothing drawn on it) does not
have to live here — see `Ruleset/images.md` §Open questions (hosting).

Fonts live next door in `assets/fonts/` and are auto-registered by
`src/game/images/fonts.ts`.
