# Tona-RPG Manual Test Checklist

Gameplay testing is performed by the Director unless explicitly delegated. The AI selects the smallest relevant route from this checklist and provides exact setup, actions, and expected results after each implementation.

## Handoff Format

Every implementation handoff should state:

- Recommended reasoning level used
- Changed files
- Static checks performed and their results
- Gameplay areas affected
- Manual setup or required save state
- Exact player actions
- Expected visible result and expected state/progression result
- Regression checks
- Anything not verified

## Always Check for Gameplay Changes

- The page loads without a new browser-console error.
- The expected controls are visible and clickable before the changed sequence.
- Dialogue appears in the correct order, with the intended colors, delays, and tap behavior.
- Buttons and the tap overlay unlock after the sequence.
- The game returns to the correct `base`, `event`, or `battle` state.
- No unrelated story text or event triggers during the tested route.

## Event and Story Progression

- Test immediately before the event condition becomes true.
- Trigger the event through normal player actions.
- Confirm the event starts exactly once at the intended location and phase.
- Confirm choices cannot be double-triggered by repeated clicks/taps.
- Confirm the intended flags, inventory, counters, and `storyPhase` effects through subsequent visible behavior.
- Leave and revisit the location to verify one-time or repeatable behavior.
- Test the nearest alternative route where the event must not occur.
- Confirm the next existing story handoff still starts correctly.

## Dialogue, Cinematics, and Screen Effects

- Confirm every line appears once and in order.
- Confirm tap-to-advance, auto-advance, typewriter text, and delays match the intended rhythm.
- Confirm screen shake, flash, blackout, or transition starts at the intended line.
- Confirm temporary overlays/elements are removed when the scene ends.
- Confirm controls do not become active behind an unfinished scene.
- Confirm rapid tapping does not skip required state-changing actions or execute them twice.

## Exploration and Location Changes

- Test forward and backward movement around the affected distance.
- Confirm location name, distance, action buttons, and ambient text update together.
- Confirm encounters are enabled or suppressed as intended during special movement.
- Confirm entering and leaving the forest, herb garden, inn, or highway returns to the correct controls.
- Test boundary distances such as 0m and the area's maximum distance.

## Visual Experience Layer

- Confirm the forest background appears only in the Amber Forest, not the inn, herb garden, or Former Highway.
- Confirm the Amber Inn lobby appears for normal inn commands and does not appear at the inn front.
- Confirm storage-room, stable, and guest-room sleep scenes use their matching background and return to the lobby when dialogue ends.
- Confirm first amber-tree defeat uses the storage room and an ordinary inn recovery uses the guest room.
- Confirm `【馬小屋の裏にて】` remains black until its dedicated night exterior art is added.
- Confirm the black reading veil keeps long white dialogue readable across the full log width.
- Confirm the small amber point moves once per valid step without drawing attention away from the location name.
- Confirm the forest background remains completely stationary during movement.
- Confirm reduced-motion mode shortens or removes new travel and battle animations.
- Confirm the battle header shows `👾` beside the enemy HP gauge and only the icon or HP bar reacts.
- Confirm `宿屋《琥珀亭》` and `宿屋前` remain visible while their exploration track is hidden, then the full track returns on entering an exploration area.
- Confirm entering and leaving battle does not resize or recrop the forest background.
- Confirm the primary exploration button layout remains usable at narrow phone widths.

## Battle Changes

- Start the intended enemy through the normal route when possible.
- Confirm battle UI, enemy data, turn order, damage, status effects, and special choices.
- Test victory, defeat, and escape/special-ending paths that the change can affect.
- Confirm rewards and one-time rewards cannot be received twice.
- Confirm post-battle dialogue appears in the intended order.
- Confirm return location, controls, HP/status, counters, and story flags after battle.
- Run one unrelated ordinary battle as a regression check for battle-engine changes.

## Inn and Recovery Changes

- Enter and leave the inn before the changed condition is active.
- Test talk, observe, stay, deliver, or special buttons affected by the change.
- Confirm HP/status recovery and item/flag updates happen once at the intended moment.
- Confirm morning or inn-front follow-up scenes trigger in the intended order.
- Stay again to verify one-time scenes do not replace the repeat route.
- Confirm the player returns to the correct location and controls.

## Inventory and Item Changes

- Test with zero, one, and multiple copies when relevant.
- Confirm the action is unavailable when its condition is not met.
- Confirm the item is consumed or retained exactly once.
- Confirm inventory UI and follow-up dialogue update immediately.
- Save and load after acquisition or consumption when the item is progression-critical.

## Save Compatibility

Required for changes to `state.js`, persistent flags, inventory, counters, story phases, or save/load code.

- Keep a pre-change save slot when available.
- Load the older save and confirm there is no error.
- Confirm newly introduced fields behave from their default values.
- Save to a different slot, reload it, and confirm progression is preserved.
- Confirm inventory, currency, location, distance, phase, and critical flags through visible game behavior.
- Revisit the changed event after loading to check one-time/repeat behavior.
- Do not overwrite the only known-good save during compatibility testing.
- At the inn in `base` mode, confirm `旅の記録` opens the five-page journal and an empty page saves immediately.
- Confirm an occupied journal page requires a second tap before it is overwritten.
- Confirm each new page shows the saved time, location, Cain's level, and a memo matching the currently revealed objective.
- Outside the inn in `base` mode, confirm `中断` writes one replaceable bookmark; confirm it is hidden during dialogue and battle.
- Reload from an inn event and confirm the load-only `宿帳` entrance can open above the tap overlay without advancing dialogue.
- Load an older slot without `saveMeta` and confirm it shows a fallback memo, loads normally, and is not rewritten automatically.

## UI and Styling Changes

- Check the intended viewport size and at least one narrower mobile-like width.
- Confirm text does not overlap, clip, or push critical controls off-screen.
- Confirm modals and overlays open above the correct content and close cleanly.
- Confirm disabled/enabled button appearance matches actual click behavior.
- Check the log at both short and long content lengths.

## Minimal Regression Menu

Select only the paths related to the change, plus one nearby unaffected path.

- Start/load and initial UI
- Forest movement and inspect
- Inn entry/exit and one normal action
- One ordinary dialogue sequence
- One ordinary battle and return
- Save to a spare slot and reload
- Current active story boundary from `WORKLOG.md`

## Reporting Results

The Director can report results in plain language, for example:

> 手順3で会話は出たけど、最後に移動ボタンが戻らなかった。

The AI must translate that observation into the likely system boundary, investigate it, and avoid asking the Director for technical terminology.
