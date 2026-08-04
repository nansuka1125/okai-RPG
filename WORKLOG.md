# Work Log

## Chapter 1 Development Recovery Baseline

Status: confirmed development recovery baseline

### Baseline

- Branch and commit: `main@2536c9c`
- This commit is the confirmed recovery point for continuing Chapter 1 development.
- This is not a release build. It intentionally includes a debug acquisition route, development tools, provisional balance values, partially implemented systems, and known unimplemented work.
- `DEBUG_GRANT_BLOOD_AMBER_FROM_RAT_10=true` at this baseline. Claiming the rat-10 notebook reward grants the normal three herbs plus one Vampire Amber for development access.
- The working tree was clean and the locally recorded `origin/main` matched `2536c9c` when the baseline audit was completed.
- The complete automated Playwright suite passed: `224 passed`, with no failures or skips.
- Integrated manual gameplay verification of this combined state has not yet been completed; it is the next human gate.
- All runtime and test JavaScript passed `node --check`; `git diff --check` passed.
- This section records the historical recovery baseline. The synchronized implementation-status entries below describe the current branch.

### Currently implemented

- Chapter 1 record selection and non-destructive new-game startup through `chapter1.html?new=1`; starting over preserves all five journal pages and the suspend record.
- The five-entry bounty notebook: rat, weasel, amber sap, amberized rat, and amberized weasel, including their currently defined normal reward tiers.
- Rat and weasel ALL progression, including unlock conversations, independent post-unlock progress, claimable rewards, and final-normal-random-enemy suppression after completion.
- Vampire Amber equipment, combat drain and Cain-only damage multiplier, battle-chain handling, post-battle conversations, dynamic description, forced removal after the sixth chain battle, and save/load persistence.
- Cain's provisional battle kit: 15% criticals; 20% sword-technique rate with equal 《強撃》/《連撃》 selection; complete direct-attack 《受け流し》; and Fireproof Gloves' defense +2 plus counterattack. All tunable values are in `RPG.Config.CAIN_COMBAT`.
- Blue Amber raises Cain's sword-technique rate by the provisional +10 percentage points for both attack techniques and parries.
- The Vampire Amber / matatabi conflict: mutual use/equip blocking and the repeatable post-battle accident route.
- The complete inn-repair thread: the two inn-rat battles, consultation, three inspections, report, forest-8m amber-tree timber retrieval, timber delivery without oils, post-rain repair start, the daughter's three-oil event, repair completion, and save/load persistence.
- The amber-root thread: sap-source awareness, independent 6m/7m/8m root states, Shiny Oil scars, shared non-consuming Hard Oil ignition, fixed burning-root battles, rematches after defeat, per-site defeat persistence, defeat-order-based first/second/third victory scenes, and 30%-of-max-HP stress-relief recovery.
- The three-root pacification follow-through: the one-time forest-2m conversation, the one-time ordinary-room peaceful night, and finite encounters plus saved ALL targets for Amber Sap, Amberized Rat, and Amberized Weasel. Targets are fixed from the cumulative defeat counts only when the third root is defeated; old three-root saves without saved targets are intentionally unsupported.
- The Key-Inside Amber / Forest Hut route: burn a held Key-Inside Amber at the freshly defeated root site for one Old Key, discover the 10m hut, enter its exterior and interior scenes, unlock it through the confirmed choice and snake scene, use Key-Inside Amber manually without consuming it, and receive Fireproof Gloves on the following interior examination.
- At `ae75f53`, the focused inn-repair suite (100 tests), focused amber suite (187 tests), and full Playwright suite (504 tests) passed before this documentation/comment synchronization.
- Level-11 opening of the Hard Bottle through its opening flourish.
- Owen intervention text currently in code: four freeze lines, the two-line freeze activation, the frozen-turn line, wolf attack/swallow wording, the consolidated disappearance line, and the intimidation wording.
- The existing Chapter 1 backgrounds, amber trade/appraisal and hardened-enemy systems, journal/suspend saves, forest presentation layer, inn conversation availability rules, phase-7 legacy handoff, and current Former Highway route described below.

### Confirmed current specifications

- Rat ALL unlocks after the rat-20 reward has been received and the notebook is next opened. Its independent target is five Cain defeats and its reward is one Grateful Talisman.
- Weasel ALL unlocks after the weasel-20 reward has been received and the notebook is next opened. Its independent target is three Cain defeats and its reward is three High Herbs.
- Owen defeats and matatabi weasel escapes do not advance rat/weasel ALL progress. Completing an ALL target suppresses only the matching final normal random encounter; amberized variants and fixed battles remain available.
- The amber-sap-20 reward is the Hard Bottle. Rat ALL is the Grateful Talisman reward.
- Vampire Amber drains 10%, 15%, and 20% of maximum HP at the start of chain battles 1, 4, and 6 without reducing Cain below 1 HP. Cain's damage multiplier is 1.5x for battles 1-5 and 2x for battle 6. Glowing Cat Rabbit battles are excluded.
- A normal defeat before battle 6 resets the Vampire Amber chain without removing the amber. Completing battle 6 removes it. Entering the inn, manually detaching it, or swapping it out also resets the chain.
- If matatabi would activate at a battle ending while Vampire Amber is equipped, the accident takes priority. The accident removes the amber, bypasses normal EXP, rewards, drops, kill/death counts, and matatabi activation, then returns Cain to the inn at 10% HP with poison cleared.
- New-game startup through `?new=1` does not delete existing records. Existing saves continue through the default-state merge path, which supplies defaults for fields missing from older saves.
- Inn-repair damage inspection requires the innkeeper consultation, receipt of the rat-20 reward, and mining the amber-tree coin. Timber delivery consumes one Amber-Tree Timber and grants no oils. Once `phase6PostDeliverySleepDone` is true, the inn-front repair command starts the daughter's event; every choice grants one each of Shiny Oil, Glossy Oil, and Hard Oil. Completion consumes only Glossy Oil, leaves the other two oils, uses nails as dialogue only, and sets `innRepairCompleted`.
- The inn-repair thread can be resumed safely from Phase 6, Phase 7, and a highway-defeat return to the inn front. Interrupted oil and completion events do not commit partial item or flag changes. The repaired-wall investigation, post-repair inn dialogue, and departure send-off differences will not be added.
- Amber roots at forest 6m, 7m, and 8m each persist `unexamined -> examined -> scarred -> ignited -> defeated`. A normal knife and ordinary fire fail; Shiny Oil scars one site and Hard Oil ignites any site without being consumed. Burning roots are fixed bosses (HP 200, ATK 22, EXP 150, self-burn 10), can be rematched after defeat, and are excluded from the notebook and normal/Unknown Amber drops.
- The first, second, and third root victories are determined by the number of defeated sites, not their distance. Each plays its own aftermath and restores `Math.floor(maxHP * 0.3)` without exceeding maximum HP or showing a numeric recovery log.
- After the third root, Amber Sap, Amberized Rat, and Amberized Weasel receive fixed saved ALL targets based on their current cumulative defeats and stop appearing as normal random encounters when their own target is reached. Their existing notebook ALL tiers and rewards are active.
- Forest 10m first reveals the hut through an ordinary examination. Thereafter `【森小屋】` enters the hut front at the same distance; the hut has no forward command. The Old Key branch is exclusive to `【開ける】` / `【…嫌な予感がする】`, consumes the key only when opened, transitions from the exterior to the interior under blackout, then plays the snake event. Key-Inside Amber alone leaves the hut locked and is not consumed.

### Test-only and provisional implementation

- `DEBUG_GRANT_BLOOD_AMBER_FROM_RAT_10=true` is an active development-only acquisition route.
- Fresh state includes the usable `debug_poison` and `debug_lvl10` items. The encounter toggle, Glowing Cat Rabbit spawn hook, and Space-key dialogue acceleration remain development tools.
- The debug-poison description says it sets HP to 1, while the current implementation sets HP to 30. This is a known text/behavior mismatch in development tooling.
- Amberized rat/weasel replacement remains a provisional 25% roll.
- Hardened-part durability remains provisional: Hungry Amber Tree 50, amberized rat 20, and amberized weasel 30.

### Partially implemented

- The Hard Bottle can be opened at level 11, but it is retained and has no implemented contents.
- Rare-amber equipment UI is implemented. Vampire Amber and Blue Amber have combat effects; the other rare-amber effects described in item data are not implemented.
- The current save merge supplies safe defaults for missing Vampire Amber fields and current-state round trips are tested. There is no dedicated automated case for a pre-effect save that already has Vampire Amber equipped, nor a targeted deletion test for every new chain/talk scalar.

### Unimplemented

- The Hard Bottle's contents and any post-opening result.
- Burned-root-site investigation and the three Unknown Amber rewards, including the one rare amber.
- Gameplay effects for Hated, Sweet, Herb, Monster, Milk, Bee, and Ignored Amber.
- Acquisition events for Bee Amber and Ignored Amber.
- The new morning wagon-departure cutover that will replace or gate the legacy phase-7 entry.
- A boss-specific defeat/retry route for `amber_husk_giant_larva`, plus the proposed late-battle lethal-attack and blood-loss pressure.

### On hold

- Hard Bottle contents.
- The forest-completion daughter walk/picnic after all bounty entries are complete.
- Final values for the provisional amberized-enemy replacement rate and hardened-part durability.
- The morning wagon-departure scene pending its latest text, exact interaction flow, and handoff decision.
- Final-boss defeat handling pending the Director-provided defeat scene and retry/return destination.

### Do not do at this baseline

- Do not infer or implement unresolved story, reward, bottle-content, amber-root aftermath, or remaining-ALL specifications.
- Do not remove the legacy `finale_wagon_encounter` before the new morning departure route is implemented and tested.
- Do not alter `transitionToHighway()` or the Former Highway event block unless the approved departure handoff requires it.
- Do not implement the final-boss follow-up before the Director supplies the defeat scene.
- Do not expand final-boss work into ordinary-enemy defeat behavior or the shared three-defeat bad-end system.
- Do not redesign `EVENT_DATA`, UI logging, save format, script order, or the runtime architecture as incidental cleanup.

### Deferred cleanup candidates

- Narrow the broad amber test name that says rare amber has no gameplay effect even though the test covers Hated Amber and Vampire Amber now has an effect.
- Review the `state.js` `Chapter 1 Complete` label against the still-pending morning departure cutover and final-boss defeat route.
- Keep these as later cleanup candidates; do not change the code, test name, or build label as part of this documentation-only baseline update.

### Next human gate

- Before selecting the next development slice, the Director must manually play the current forest-hut guidance and confirm its latest text, command layout, blackout, background change, and screen shake.
- Manual confirmation targets:
  - `【はじめから】` starts a new game without deleting existing journal or suspend records.
  - All five bounty-notebook entries appear, and rat/weasel ALL unlock, progress, suppression, and reward flows work as specified.
  - The rat-10 debug reward grants Vampire Amber while `DEBUG_GRANT_BLOOD_AMBER_FROM_RAT_10=true`.
  - Vampire Amber's combat effect, conversations, sixth-battle forced removal, and save/load persistence work through normal play.
  - Vampire Amber and matatabi mutually block each other, and the conflict accident returns Cain to the inn in the documented state.
- The inn-repair thread completes after the post-rain start, daughter's three-oil event, and Glossy Oil repair step; confirm the command disappears after `innRepairCompleted`.
- Amber-root verification reaches the 6m/7m/8m fixed battles, defeat/rematch behavior, independent per-site `defeated` persistence, defeat-order aftermath, recovery, three-root forest-2m / peaceful-night flow, and finite ALL targets.
- Forest-hut verification covers first 10m discovery, the exterior-only command layout, key cancellation, blackout-to-interior opening, the Key-Inside Amber-only reaction, manual Key-Inside Amber use stages, and the following Fireproof Gloves examination.
  - Owen's freeze, transparent-wolf, and intimidation battle text appears as intended.
- Record any visible or progression mismatch before selecting the next development slice.
- Morning wagon-departure decisions and selection of the next development slice remain post-verification candidates only.

## Chapter 1 Location Backgrounds

Status: implemented; Director visual and gameplay verification pending

### Implementation

- Added optimized static backgrounds for the inn front, stable exterior by day and night, deep forest by day and night, forest 10m, herb-garden entrance/interior/depths, wagon travel, and the Former Highway.
- Background selection is presentation-only and derives from existing `location`, `explorationArea`, distance, day/night, and `onWagon` state. No save field or migration was added.
- Amber Forest 0m–6m keeps the established forest art; 7m–9m uses the deep-forest day/night art; 10m uses its dedicated image.
- Herb Garden 0m uses the portrait entrance composition on both desktop and phone; 1m–6m uses the portrait overgrown interior and only the 7m deepest point uses the open herb garden.
- The phase-7 wagon route uses the wagon image while `onWagon` is active, and the Former Highway uses its dedicated night road.
- The departure-eve `【馬小屋の裏にて】` scene now uses the supplied night exterior instead of black. The supplied daytime exterior is ready as a presentation override but remains unused until a matching daytime scene exists.
- All backdrops remain fixed behind the log and reuse the existing reading veil; story events, movement, commands, and save data are unchanged.
- After Director feedback, removed the compounded heavy dimming: daytime art now stays near source brightness, dedicated night art is no longer darkened twice, and the reading veil keeps a darker left-side reading corridor while leaving the right-side scenery clearly visible on desktop and phone.
- After screenshot review, changed the veil from a broad dimmer into a defined reading corridor: the left half is nearly black, the fade clears quickly across the middle, the right edge retains the source image, and phone log lines stop before the scenery strip.

### Verification completed

- All runtime and test JavaScript passes `node --check`; `git diff --check` reports no whitespace errors.
- All CSS WebP references resolve to repository files.
- Focused browser coverage includes scene resolution, stale-class cleanup, and responsive herb-entrance behavior. The current complete-suite result is recorded in the recovery-baseline section.
- Automated browser checks loaded the inn-front, highway, and both herb-entrance variants without page errors.

### Director verification

- Leave and re-enter the inn; confirm the inn-front image appears while the location name remains `宿屋前`.
- Walk through forest 6m -> 7m -> 10m by day, then revisit 7m after nightfall; confirm the intended background cutovers without UI movement or recropping during battle.
- Enter the Herb Garden and walk 0m -> 1m -> 6m -> 7m; confirm entrance, overgrown interior, and deepest open-garden backgrounds remain readable behind the log.
- Board the wagon, enter the Former Highway, and play the departure-eve scene; confirm wagon, night road, and stable-back night backgrounds appear in order.
- Check the same routes on the target phone, especially the portrait entrance/interior, forest 10m, and highway crops.

## Chapter 1 Amber Trade and Hardened Enemies

Status: implemented; Director gameplay and pacing verification pending

### Implementation

- Changed the Hungry Amber Tree victory aftermath so the embedded second silver coin remains in place.
- Restored the pre-battle `銀貨を取る` / `やめておく` display after another event has hidden a shared choice button; the existing leave dialogue remains unchanged and still leads into the battle.
- Moved the amber-trader vignette to the first inn `様子を見る` after obtaining one silver coin. Knife borrowing and first appraisal remain forced `様子を見る` events; the one-time return action is labeled `ナイフを返す`. Appraisal/exchange/trade-in commands unlock only after the trader moves to forest 0m.
- Added the borrowed knife route, 8m coin mining, first guaranteed sparkling appraisal with a non-interactive exchange preview, one-time knife return attempt, and the merchant's move to the forest entrance after one stay.
- Added free single/bulk appraisal with the confirmed 70/15/15 result weights. Appraised sparkling, junk, and insect amber are stored by the merchant and their counts remain visible in the merchant menu.
- Added the six confirmed rare-amber exchanges and price-derived trade-in values. Rare-amber equipment UI is implemented. Vampire Amber now has its dedicated combat effect; effects for the other rare amber remain unimplemented.
- Added the cumulative three-junk reward that renames the borrowed knife to the mining knife without changing its performance.
- Added amberized rat/weasel variants after the thief-boy encounter, using a tunable provisional 25% replacement roll and provisional hardened-part durability values of 20/30. The Hungry Amber Tree uses provisional durability 50.
- Added shared hardened-part damage, overflow, break, and critical-bypass handling. Player-facing logs use `硬化した皮膚` or `硬化した樹皮`; the internal design term is not displayed.
- Amberized beasts always award one unknown amber, including Owen instant-death victories; Owen victories retain the existing no-EXP rule.
- Added progression-aware journey memos for borrowing the knife, returning to 8m, and showing the unknown amber to the merchant.
- Bee/Ignored Amber acquisition events and non-Vampire rare-amber effects remain unimplemented. Rare-amber equipment and the shared old-save default merge are now implemented; current compatibility limits are recorded in the recovery-baseline section.

### Verification completed

- All runtime JavaScript and the new amber Playwright spec pass `node --check`; `git diff --check` reports no whitespace errors.
- Focused coverage includes the Hungry Amber Tree's restored two-choice branch and leave dialogue, the thief-boy encounter gate, the one-silver-coin merchant recognition boundary, the inn command labels, the first appraisal preview, and the forest-entrance menu unlock. The current complete-suite result is recorded in the recovery-baseline section.

### Director verification

- Play from the first silver coin through tree victory, merchant recognition, knife borrowing, 8m mining, first appraisal, knife return attempt, one stay, and the merchant's 0m appearance.
- Confirm the merchant menus remain readable on the target phone, especially the six-item exchange list.
- Fight the Hungry Amber Tree and both amberized beasts; judge the provisional 50/20/30 durability and the 25% replacement frequency.
- Confirm normal hits, overflow hits, critical bypass, Cain victory, Owen instant death, defeat, and rematch all show the intended logs and reset hardened durability per battle.
- Save to a spare slot after appraisal, reload it, and confirm merchant storage, knife state, amber progression, and rare-amber equipment remain intact. The current old-save default merge and its remaining Vampire Amber coverage gap are recorded in the recovery-baseline section.

## Amber Inn Scene Backgrounds

Status: implemented; Director visual and gameplay verification pending

### Implementation

- Added optimized static backgrounds for the Amber Inn lobby, storage room, stable, and modest guest room.
- Replaced the lobby source with the Director-cropped counter-and-stair view and a cache-safe filename. Desktop keeps the full composition centered; phones bias right to retain the counter. The lobby veil is slightly lighter than other inn scenes so the counter and ceiling remain visible.
- The lobby is the default whenever the player is inside the inn; normal talk, observe, delivery, and journal routes retain it.
- Early sleep and matatabi-night routes use the storage room; stable stays use the stable; post-delivery and room-specific sleep routes use the guest room.
- The daughter-room offer begins in the lobby and changes to the storage room under the sleep blackout, matching the existing morning text.
- First amber-tree defeat wakes in the storage room; ordinary defeat recovery uses the guest room.
- Inn scene overrides are presentation-only and clear through the shared dialogue-completion path. They are not serialized and require no save migration.
- `【馬小屋の裏にて】` now uses its dedicated night exterior; the daytime stable interior is not reused.

### Verification completed

- Source art was matched visually against the Director-provided images and converted to WebP without changing source files.
- Static/runtime checks cover default lobby selection, room overrides, black exterior override, forest/inn exclusivity, and dialogue-end cleanup.

### Director verification

- Enter the inn and confirm the lobby appears without changing the location label or controls.
- Run one storage-room stay, one stable stay, and the post-delivery guest-room sleep; confirm each returns to the lobby after the dialogue.
- Trigger first amber-tree defeat and one ordinary defeat; confirm storage-room versus guest-room recovery.
- Start the departure-eve `馬小屋の裏` scene and confirm the dedicated night exterior appears, then the lobby returns after the dialogue.

## Inn Journal Saves

Status: implemented; Director visual and gameplay verification pending

### Experience target

- Turn manual saving into an in-world `旅の記録` action at `宿屋《琥珀亭》`.
- Keep bedtime play interruption-friendly with one outside-the-inn `中断` bookmark.
- Show a spoiler-safe memo describing the next known objective on every new save.

### Implementation

- Added five journal pages with timestamps, saved location, Cain's level, and a progression-aware memo.
- Added deterministic memo rules for coin collection, the theft/fortune route, rabbit fur, wagon discovery, herb-garden materials, scent-pouch preparation, departure morning, and the Former Highway.
- Added two-tap overwrite confirmation for occupied journal pages.
- Added one replaceable `okai_rpg_suspend` bookmark, writable only outside the inn in stable `base` mode.
- Manual journal saves are writable only inside the inn in stable `base` mode. Battle and active-dialogue saves are blocked.
- New snapshots clear dialogue/battle residue and include `saveMeta`; old saves without metadata still load and display a generated fallback memo.
- During an inn event, a small load-only `宿帳` entrance remains above the tap overlay so returning players can reach existing saves.

### Protected behavior

- Existing five local-storage keys and the default-state merge path are preserved.
- Story flags, event IDs, inventory, battle formulas, and dialogue progression are unchanged.
- Loading an old save does not require a migration or overwrite that slot.

### Verification completed

- Runtime tests cover memo priority, safe snapshot normalization, empty-slot saving, two-tap overwrite, suspend saving, old-save metadata fallback, and journal/suspend visibility gates.
- All runtime JavaScript files pass `node --check`; `git diff --check` reports no whitespace errors.

### Director verification

- Open `旅の記録` inside the inn and confirm the current memo and five pages fit and scroll on the target phone.
- Save to an empty page, then overwrite it using the required second tap.
- Leave the inn, create a `中断` bookmark, reload the page, and resume it from the journal.
- Confirm `旅の記録` cannot write during dialogue or battle and ordinary story progression is unchanged after loading.

## Amber Forest Experience Slice

Status: implemented; Director visual and gameplay verification pending

### Experience target

- Complete the first three-minute loop as a presentation vertical slice: enter the Amber Forest, move through the first distances, meet an ordinary enemy, fight, and return.
- Keep prose as the primary narrative surface while background art and symbols supply place, motion, and impact.

### Implementation

- Added the Director-provided forest art as optimized `images/amber-forest.webp` behind the scrolling log.
- Added a fixed scene backdrop and asymmetric black reading veil without changing `logContainer` ownership or blackout behavior.
- Added a subdued amber progress point and delayed valid forest movement until a short visual travel cue settles.
- Added non-persistent `visualDirector` presentation state; no save migration or story flag was introduced.
- Added compact encounter, attack, hit, Owen-action, victory, and defeat cues in the existing battle header and HP bar.
- Promoted `進む` to the primary forest action while retaining every existing command and event gate.
- Added reduced-motion handling, keyboard focus styling, and browser zoom support.
- After Director feedback, increased forest visibility, removed all background movement, and removed the extra log-area battle stage.
- The inn and inn front retain their location names while hiding only the exploration track; the battle HP row uses a fixed `👾` marker.
- Matched the exploration and battle context-row heights so `background-size: cover` does not visibly recrop when battle begins or ends.

### Protected behavior

- Movement bounds, poison timing, random encounter rate, event order, `EVENT_DATA`, battle formulas, and save data are unchanged.
- Former Highway wagon movement does not use the forest walking delay.
- The provided PNG remains untouched outside the repository; the game uses a 300KB WebP derivative.

### Verification completed

- All runtime JavaScript files pass `node --check`; `git diff --check` reports no whitespace errors.
- Focused runtime tests cover delayed single-step movement, rapid-tap locking, one movement log, scene-class switching, and enemy-symbol synchronization.
- DOM/script/image references were checked statically.

### Director verification

- Check background crop and the brighter reading-veil balance on the target phone.
- Walk 0m -> 1m -> 2m -> 3m, including rapid taps, and confirm one step per cue.
- Trigger an ordinary rat or weasel battle and confirm the battle header remains simple and each reaction is legible.
- Walk back to 0m and leave the forest; confirm the background fades to black and inn-front controls return.

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

### Known conflicts being addressed

- Fixed: standard defeat recovery keeps `mode = event` until the final recovery dialogue completes, preventing movement input from corrupting the inn return location.
- Fixed: choice mode now locks every command outside the active choice container; exploration inspect and forest entry also reject non-`base` input.
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

### Charm Revival Coverage

Status: implemented; Director gameplay verification pending.

- Both standard-enemy attack paths now use the shared defeat check, as do AI-driven boss attacks.
- The ordinary enemy's Owen-assisted battle escape keeps priority; a charm is the fallback when a route reaches the shared defeat check without that rescue.
- Charm revival clears the current battle's one-turn stun so the revived Cain receives a normal next turn; poison and other effects remain unchanged.

### Glowing Cat Rabbit Fur Pacing

Status: implemented; Director gameplay verification pending.

- Quest fur remains unavailable until the phase 4 fortune teller has set `needsGlowingRabbitFur`.
- During the fur quest, ordinary glowing cat rabbit encounters retain the existing 20% fur chance.
- While `matamatabiActive`, a fur-less quest encounter increments `phase4MatamatabiRabbitEncounters`; the second such encounter guarantees the fur, whether the rabbit escapes or is defeated.
- The encounter count persists if a matatabi activation expires, so repeated activations cannot create an open-ended grind. It resets when the request starts, when fur is acquired, and when the fur is delivered.
- Rabbit victory count, level progression, reward items, and Lv88 behavior remain driven only by actual victories and are unchanged.

### Hungry Amber Tree Rematch Location

Status: implemented; Director gameplay verification pending.

- A rematch is rediscovered at Amber Forest 8m, matching the original encounter point.
- The legacy 9m dialogue and 10m battle gate were replaced with an explicit 8m choice: red `戦う` starts the battle, while `戻る` safely retreats to 7m.

### Typewriter Skip Log Follow-up

Status: implemented; Director gameplay verification pending.

- Typewriter scenes remain skippable with Space.
- While skipping, log scrolling now moves immediately to the newest line instead of falling behind the scene's initial top position.
- Normal-speed dialogue keeps the existing smooth log-scroll behavior and scene-title presentation.

### Formal Chapter 1 Prologue

Status: implemented; Director gameplay verification pending.

- The initial `prologue_event` now presents the formal Chapter 1 introduction: black title card -> Amber Inn reveal -> player-advanced typewriter scene -> opening debt negotiation.
- The title card temporarily hides HUD, command UI, journal access, and debug mood display; the inn background and disabled UI fade in before the narration begins.
- After the opening scene, only `話す` is enabled. Its opening negotiation offers the one-time fur-sale joke before `わかった、なんとかする` returns normal inn controls.
- Persistent flags: `introDebtTalkPending`, `introDebtFurJokeTried`, and `introDebtNegotiationDone`. Existing saves retain `hasIntroFinished` and do not replay the new prologue.
