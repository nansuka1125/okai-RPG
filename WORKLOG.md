# Work Log

## Confirmed Legacy Cleanup

Status: implemented; Director smoke test pending

### Removed

- Deleted the unloaded duplicate `data.js` and its commented script tag.
- Removed the deleted Duel system's state, export, HTML/CSS comments, and stale documentation references.
- Removed the unreferenced legacy `hungry_tree` enemy and cinematic scaling branch; the active `hungry_amber_tree` route is unchanged.
- Removed unused `gotTestCoin`, `forest8mTreeHintShown`, `talkIndex`, and `battleStatus` state residue.
- Added load cleanup for those retired state keys so older saves do not restore them.
- Removed obsolete console debug logging and the unused rat `attackLog` text copied from the old tree enemy.

### Protected

- Kept `finale_wagon_encounter`, `transitionToHighway()`, `onWagon`, and the Former Highway events.
- Kept development tools: debug items, encounter toggle, glowing-rabbit spawn hook, and Space-key dialogue acceleration.
- Kept current legacy global shims documented in `PROJECT_MAP.md`; removing them requires a separate compatibility audit.

### Static verification completed

- All runtime JavaScript files pass `node --check`.
- `git diff --check` reports no whitespace errors.
- No runtime script or document references the deleted `data.js`, Duel system, or old `hungry_tree` ID.

## State and Event Integrity Fixes

Status: implemented; Director gameplay verification pending

### Changes

- Added immutable `RPG.DefaultState` data for old-save migration so missing fields no longer inherit values from the previously active slot.
- Added per-save `innEventViewedIds` tracking for the three random inn-stay events; old saves start these events as unread.
- Removed manual one-time `completedEvents` writes from event actions and left completion ownership with `explorationSystem.checkEvents()`.
- Deduplicate legacy `completedEvents` arrays when a save is loaded.
- Restored a complete inn-front state after the giant-larva bad ending, including location, exploration area, poison, and battle cleanup.
- Kept `silverCoins` and `inventory.silverCoin` synchronized for generic enemy coin rewards.
- Aligned the default `isAtInn` value with the initial inn location.

### Static verification completed

- All runtime JavaScript files pass `node --check`.
- `git diff --check` reports no whitespace errors.
- Focused runtime tests cover old-save isolation, inn-event persistence, one-time event completion, and giant-larva defeat return state.

### Director gameplay verification

- Load a current save, then an older save missing recent phase-6 flags; confirm recent progress does not leak into the older slot.
- View one random inn-stay event, save and reload, then confirm the remaining unread inn-stay events are still prioritized.
- Trigger a one-time Former Highway event, save/reload, and confirm it does not replay.
- Lose to the giant larva and confirm the game returns to `宿屋前` with normal inn-front controls and no poison state.

## Inn Conversation Availability Audit

Status: implemented; Director gameplay verification pending

### Protected behavior

- Phase-specific command overrides must resolve before the normal unread `話す` / `様子を見る` queues.
- Existing dialogue arrays, reward actions, `talkPhaseReached`, and `observePhaseReached` remain compatible.
- Old unread conversations may carry forward only when their content is still natural.
- Current-phase normal conversations should resolve before eligible older unread conversations.

### Dedicated command routes

- Phase 4 fortune route: `占い師に相談` -> `オーエンに相談` -> `占い師と話す` / `納品する`.
- Phase 6 talk route: wagon information -> scent-pouch information -> empty bottle.
- Phase 6 observe route: fortune consultation -> material briefing/hints -> brooch return.
- Phase 6 blacksmith route yields to active fortune/herb-garden progression.

### Known conflicts being addressed

- Fixed: Phase 4 fur delivery remains enabled after both fortune follow-ups.
- Fixed: Phase 6 empty-bottle label and execution now share `needsPhase6EmptyBottle()`.
- Fixed: Generic Phase 4 fortune-observe lines do not replay after the automatic introduction.
- Fixed: Time-sensitive coin/theft/battle conversations expire outside their natural phase.
- Fixed: Current-phase normal conversations resolve before eligible older unread lines.
- Preserved: dedicated command routes still resolve before both normal unread queues.
- Preserved: existing herb and charm reward actions remain attached to their original entries.

### Availability implementation

- `RPG.Assets.TALK_DATA.innTalk.availability` owns normal-talk entry conditions.
- `RPG.Assets.GAME_TEXT.innObserveAvailability` owns normal-observe entry conditions.
- Expired entries advance the existing reached counter without being displayed.
- No new save field or migration is required; older saves keep using the merged default state and existing reached maps.

### Static verification completed

- All JavaScript files pass `node --check`.
- `git diff --check` reports no whitespace errors.
- Branch tests cover current-phase priority, eligible backlog, expired theft dialogue, Phase 7 charm, Phase 6 herb rewards, dedicated-route priority, and Phase 4 fur-delivery button enablement.
- Browser gameplay verification remains with the Director.

### Out of scope for this pass

- Rewriting all inn dialogue into a new event architecture.
- Changing dialogue text or reward quantities.
- Changing story phases, `EVENT_DATA`, save format, or non-inn interaction systems.

## Phase 7 Cutover Map

Updated: Build 15.2.113

### Current completed entry

- `scentPouchCrafted` and `wagonReadyForDeparture` become true after the driver has tested the calming scent pouch.
- In phase 6, selecting `泊まる` then plays `Cinematics.playChapter1FinaleNight()`.
- The scene `【馬小屋の裏にて】` is one-time and ends by setting:
  - `flags.phase7DepartureNightSeen = true`
  - `storyPhase = 7`
- Later phase 7 stays use the short full-recovery scene instead of normal inn events.
- On the Former Highway at 1m, the player must hand `💐香草袋` to the driver before advancing to the opening rat battles. This consumes the item and sets `flags.scentPouchHandedToDriver`.
- The uncollected 5m glowing brooch remains inspectable in every forest phase. Its persistent `きらり。` cue is also shown at 5m until collected; phase 6 presents `光るものを調べる` before the wagon-driver command.

### Legacy route still active

The following route predates the scent-pouch quest and must not be deleted until the new departure scene replaces its entry point.

- `assets.js` `finale_wagon_encounter`
  - Runs in phase 7 at Amber Forest 2m while `flags.onWagon` is false.
  - Contains the old wagon boarding choice and advances the route toward phase 8.
- `exploration.js` `transitionToHighway()`
  - Moves the party to `かつての街道` and sets phase 9.
- `assets.js` highway event block
  - Contains the existing Former Highway 1m-10m events, fixed battles, night boss setup, and chapter-end path.
- `state.flags.onWagon` and `state.highwayBattleCount`
  - Belong to this legacy handoff and remain in use by the old road route.

### Cutover rule

When implementing the new morning wagon-departure scene:

1. Add the new departure event first, using the current phase 7 state after `【馬小屋の裏にて】`.
2. Replace or gate only `finale_wagon_encounter`; retain the old event data with a `LEGACY PHASE7` comment until the new route has been fully tested.
3. Do not alter the Former Highway block or `transitionToHighway()` unless the new departure sequence needs a different handoff.
4. Test the complete boundary: scent pouch test -> departure night -> morning departure -> highway arrival.

### Next input needed

- Latest text and exact interaction flow for the morning wagon departure.
- Whether the new departure should hand off directly to the existing Former Highway route or include a new wagon-travel segment first.

### Final Boss Follow-up

Status: design pending; do not implement before Director supplies the defeat scene.

- `amber_husk_giant_larva` can currently reduce Cain below the defeat threshold through its dedicated AI, but has no boss-specific defeat route. A normal defeat would likely make the completed 10m arrival event non-repeatable.
- Next input: the Director will provide the final-boss defeat event text and desired retry/return destination.
- After the defeat route is in place, add late-battle pressure in the boss AI:
  - an explicit lethal-attack chance during the visual dodge sequence;
  - a later "blood loss" phase that reduces Cain's evasion.
- Keep these mechanics scoped to `amber_husk_giant_larva`; do not alter ordinary enemy defeat behavior or the shared three-defeat bad-end system without explicit approval.
