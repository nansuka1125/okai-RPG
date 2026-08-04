# Chapter 1 Implementation Scope

This file is the implementation boundary for completing Chapter 1.

- The Google Drive design ledger remains the canonical game-design source.
- `WORKLOG.md` records implemented behavior, temporary development state, and unfinished handoffs.
- `PROJECT_MAP.md` records stable architecture and protected contracts.
- This file records what Chapter 1 still includes, what has been removed, and the required implementation order.
- If live code, `WORKLOG.md`, and this file disagree, report the mismatch before editing. Treat live code as current behavior, `WORKLOG.md` as implementation history, and this file as the approved future scope.
- Do not fill unresolved game-design decisions by inference.

## Current Chapter 1 Shape

The three retained side threads are:

1. Amber appraisal and trade
2. Bounty notebook and forest pacification
3. Amber Inn repair

The merchant side thread is no longer part of Chapter 1. The wagon driver remains a separate main-story character and must not be reconnected to the removed merchant thread.

All rare-amber effects are implemented. Chapter 1 does not use a separate amber-case acquisition system.

The current active development slice is the amber-root aftermath: distinct first/second/third-root victory dialogue and the confirmed stress-relief HP recovery. Root discovery, ignition, and all three root battles are already implemented.

## Required Work Before Release

### 1. Amber Inn repair — complete

- Timber delivery consumes one Amber-Tree Timber and grants no oils.
- Once timber is delivered and `phase6PostDeliverySleepDone` is true, the inn front shows `【修理を手伝う】`.
- The daughter's three choices each grant one Shiny Oil, one Glossy Oil, and one Hard Oil.
- Repair completion consumes only Glossy Oil; Shiny Oil and Hard Oil remain in inventory.
- The nails are resolved inside the repair dialogue and are never added as an inventory item.
- Completion sets `innRepairCompleted`; the command then disappears. The thread is resumable in Phase 6, Phase 7, and after a highway-defeat return to the inn front.
- The repaired-wall investigation, post-repair inn dialogue differences, and departure send-off differences will not be added.

### 2. Connect Key-Inside Amber to the Forest Hut

- Amber-root discovery, Shiny Oil scarring, Hard Oil ignition, fixed burning-root battles, defeat/rematch handling, and independent 6m/7m/8m site persistence are complete.
- Decide the Key-Inside Amber exchange price and unlock timing against the actual Chapter 1 amber supply.
- Add ordinary inn chatter establishing that amber can burn.
- When igniting a root while Key-Inside Amber is held, offer `鍵入り琥珀を燃やす` and grant the Old Key.
- Do not create a separate long key-burning event.
- Decide and implement the miss-prevention route if all root ignition opportunities can end before the player obtains Key-Inside Amber.
- Use the Old Key to unlock the Forest Hut at forest 10m.

### 3. Complete the amber-root aftermath and forest pacification

- Next implementation target: add distinct post-victory dialogue for the first, second, and third burning roots together with the confirmed stress-relief HP recovery.
- Add investigation of the three burned root sites and three Unknown Amber rewards, including one rare amber.
- Add the forest-2m conversation after all three roots are defeated.
- Add the normal-room-only peaceful-night event, with the giant-larva aftermath night taking priority.
- Connect root completion to finite encounters and ALL progression for Amber Sap, Amberized Rat, and Amberized Weasel.
- Decide the remaining ALL rewards.
- Stop each corresponding forest encounter after its saved ALL target is reached.
- Add the daughter walk/picnic event after all forest bounty entries are complete. Do not add an extra item reward.
- Perform an integrated manual playtest of the deep-forest frequency, empowered sap, root battles, reward UI, finite encounters, and forest completion.

### 4. Complete Cain's battle kit

- Define and implement critical hits, sword-technique rate, and the Chapter 1 sword techniques.
- Decide how sword techniques interact with hardened enemy parts.
- Connect implemented rare-amber effects to the finalized battle rules and tune their values through playtesting.
- Design and implement the final boss critical attack `首狩り` using the shared direct-damage/parry structure where approved.
- Decide the Hard Bottle contents.
- Give Vampire Amber its formal acquisition route and disable the development grant before release.
- Rebalance ordinary enemies, bosses, Fireproof Gloves, parry, criticals, and sword techniques together.

### 5. Close the main progression and ending

- Audit the Phase-2-to-thief-boy trigger against current code.
- Compare all approved BAD END designs with current implementation.
- Add the post-payment lodging-fee exemption explanation.
- Finish the new morning wagon-departure route and its priority against departure-eve events.
- Keep the wagon driver independent from the removed merchant thread.
- Return completed side-thread results to the inn view, send-off, wagon, highway, or final preparation only where already approved.
- Finish final-boss behavior, boss-specific defeat, inn retreat, retry, and Chapter 1 clear flow.
- Verify title return and record-opening behavior after completion.

### 6. Implement the Herb Garden back route last

Only after the main story, Amber Forest, battle system, departure, final boss, and ending are complete:

- design the branch point
- design and implement the strong enemy
- define the merge point with the normal route
- define the reward
- decide whether the empty brooch is processed there
- add route-specific deepest-garden differences
- test both normal and back-route completion

### 7. Release cleanup and verification

- Remove debug items, hooks, provisional grants, dead code, stale comments, and obsolete test names.
- Remove any partial implementation left behind for excluded features.
- Run the full automated suite.
- Play from a new game through Chapter 1 completion.
- Verify a minimal-side-thread route, full-forest route, BAD END routes, highway defeat/retry, and target-phone layout.
- Perform final text, item-description, reward, and balance review.

## Removed From Chapter 1

Do not design, restore, or implement these features:

- the merchant side thread, lost cargo, rewards, and merchant-to-driver convergence
## Explicitly Out of Scope

Do not implement these for Chapter 1:

- thief flying-squirrel event
- Ignored Amber delivery choice
- inventory deposit/storage system
- amber-case acquisition system
- state- or history-reactive roadside dialogue
- wild-berry event

Remove partial code or stale documentation for these only during an approved cleanup task. Do not expand the cleanup into unrelated refactoring.

## Required Implementation Order

1. Complete the root aftermath's distinct first/second/third-root victory dialogue and stress-relief HP recovery.
2. Complete burned-site mining, the forest-2m conversation, and the peaceful-night event.
3. Complete finite encounters, remaining ALL progression, and the daughter picnic.
4. Connect Key-Inside Amber, the Old Key, and Forest Hut unlocking.
5. Complete Cain's sword techniques and battle balance.
6. Complete departure, highway retry, final boss, and the Chapter 1 ending.
7. Implement the Herb Garden back route last.
8. Perform release cleanup and full-route verification.

## Implementation Rules

- Work on one approved design problem at a time.
- For cross-system work, inspect state fields, event priority, save behavior, and tests before editing.
- Do not redesign already implemented systems unless gameplay verification finds a problem.
- Preserve uncommitted Director-owned changes.
- Do not commit or push unless explicitly instructed for the current task.
- After implementation, report changed files, automated checks, unverified gameplay points, and exact manual test steps.
