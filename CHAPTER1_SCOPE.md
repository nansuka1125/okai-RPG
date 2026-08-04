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

Rare-amber equipment is implemented; Vampire Amber has its dedicated combat effect, while the other described rare-amber effects remain outside the current implementation. Chapter 1 does not use a separate amber-case acquisition system.

The current active development slice is manual adjustment of the completed Forest Hut guidance. Root discovery, ignition, three root battles, victory aftermath, forest pacification, finite encounters, and the Key-Inside Amber / Forest Hut route are implemented. Do not select a new feature slice until the current hut flow is manually confirmed.

## Required Work Before Release

### 1. Amber Inn repair — complete

- Timber delivery consumes one Amber-Tree Timber and grants no oils.
- Once timber is delivered and `phase6PostDeliverySleepDone` is true, the inn front shows `【修理を手伝う】`.
- The daughter's three choices each grant one Shiny Oil, one Glossy Oil, and one Hard Oil.
- Repair completion consumes only Glossy Oil; Shiny Oil and Hard Oil remain in inventory.
- The nails are resolved inside the repair dialogue and are never added as an inventory item.
- Completion sets `innRepairCompleted`; the command then disappears. The thread is resumable in Phase 6, Phase 7, and after a highway-defeat return to the inn front.
- The repaired-wall investigation, post-repair inn dialogue differences, and departure send-off differences will not be added.

### 2. Key-Inside Amber and Forest Hut — implemented; manual adjustment pending

- Key-Inside Amber costs 3 in the existing exchange data and can be manually used without consumption; its three usage stages persist in saves.
- When a held Key-Inside Amber is present at the freshly defeated root site, `鍵入り琥珀を燃やす` grants one Old Key and consumes the amber. The opportunity closes when the player leaves that site.
- An ordinary first examination at forest 10m discovers the hut. `【森小屋】` then enters the exterior scene without changing the distance; the hut has only back, examine, and item commands.
- The Old Key has an exclusive open/cancel choice. Opening consumes it, changes from the exterior to the interior during blackout, then plays the snake event. Key-Inside Amber alone only plays its locked-door reaction.
- The following interior examination grants Fireproof Gloves once. The glove effect and existing acquisition tracking remain unchanged.

### 3. Amber-root aftermath and forest pacification — implemented core

- Root discovery, Shiny Oil scarring, Hard Oil ignition, fixed burning-root battles, defeat/rematch handling, and independent 6m/7m/8m site persistence are complete.
- First, second, and third victories are selected by defeated-site count, each includes the confirmed stress-relief text, and each restores `Math.floor(maxHP * 0.3)` without exceeding maximum HP.
- All three roots trigger the one-time forest-2m conversation and the first eligible ordinary-room peaceful night.
- On the third root only, saved ALL targets for Amber Sap, Amberized Rat, and Amberized Weasel are calculated from current cumulative defeats and then fixed. Their existing ALL tiers and rewards are active, and each normal random encounter ends at its own target.
- Remaining forest work is limited to burned-site investigation, the three Unknown Amber rewards including one rare amber, and the daughter walk/picnic after all bounty entries are complete. Do not add an extra item reward.
- Perform an integrated manual playtest of the deep-forest frequency, empowered sap, root battles, reward UI, finite encounters, forest completion, and the current hut guidance before selecting the next slice.

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

1. Manually verify the current Forest Hut guidance, including its text, exclusive command layout, blackout, background switch, screen shake, and item branches.
2. Select an approved remaining forest slice: burned-site mining and rewards, or the forest-completion daughter walk/picnic.
3. Complete Cain's sword techniques and battle balance.
4. Complete departure, highway retry, final boss, and the Chapter 1 ending.
5. Implement the Herb Garden back route last.
6. Perform release cleanup and full-route verification.

## Implementation Rules

- Work on one approved design problem at a time.
- For cross-system work, inspect state fields, event priority, save behavior, and tests before editing.
- Do not redesign already implemented systems unless gameplay verification finds a problem.
- Preserve uncommitted Director-owned changes.
- Do not commit or push unless explicitly instructed for the current task.
- After implementation, report changed files, automated checks, unverified gameplay points, and exact manual test steps.
