# Tona-RPG Project Map

This document is the stable map of the current project. Use `WORKLOG.md` for the active story-development boundary and temporary handoff notes.

## Current Technical Shape

- Static GitHub Pages top page plus a browser game built with plain HTML, CSS, and JavaScript.
- The game has no application build step or framework; package metadata is used only for Playwright smoke tests.
- Runtime modules share the global `window.RPG` namespace and several legacy global shims.
- Script order in `chapter1.html` is a runtime dependency and must be preserved unless an architecture change is explicitly approved.

## Page Entrypoints

- `index.html`: GitHub Pages top page and chapter navigation.
- `chapter1.html`: Chapter 1 game entrypoint. It loads the existing runtime and keeps the script order below.

## Script Load Order

1. `state.js`
2. `assets.js`
3. `visualDirector.js`
4. `battleData.js`
5. `Cinematics.js`
6. `battle.js`
7. `uiControl.js`
8. `scenarioEvents.js`
9. `exploration.js`
10. `inn.js`
11. `main.js`

## File Ownership

| File | Primary responsibility | Important contracts |
| --- | --- | --- |
| `index.html` | GitHub Pages top page | Keep chapter links relative so they work under the repository Pages path. |
| `top.css` | Top-page presentation | Keep it separate from the game stylesheet. |
| `chapter1.html` | Chapter 1 DOM structure and script loading | Element IDs and script order are shared dependencies. |
| `style.css` | Global presentation and effect styling | Keep DOM/class changes synchronized with UI code. |
| `state.js` | `RPG.Config` and the default `RPG.State` | Persistent defaults and legacy `window.gameState` shim. |
| `assets.js` | Text and scenario/content data | Owns `GAME_TEXT`, `EVENT_DATA`, `BATTLE_EVENTS`, `TALK_DATA`, `INN_EVENTS`, and `LOCATIONS`; preserves legacy globals. |
| `visualDirector.js` | Non-persistent presentation cues | Coordinates forest/inn scene backgrounds, transient inn-room overrides, travel locks, the party marker, and status-bar battle feedback without changing story state. |
| `battleData.js` | Enemy definitions and battle behavior data | Owns enemy/AI content exposed through `RPG.Assets` and legacy globals. |
| `Cinematics.js` | Named cinematic sequences | Reuse for multi-step set pieces instead of duplicating orchestration. |
| `battle.js` | Battle runtime and battle outcomes | Coordinates `RPG.State`, battle data, UI, exploration dialogue, and defeat routing. |
| `uiControl.js` | Log, UI refresh, modal, save/load, dialogue input, and screen effects | Preserve log behavior, DOM IDs, save merging, and input-lock behavior. |
| `scenarioEvents.js` | Focused scenario-event logic extracted from other systems | Uses state gates and hands dialogue/battle work to existing systems. |
| `exploration.js` | Movement, exploration actions, event dispatch, items, and the main dialogue queue runner | `checkEvents()` and `playDialogueLoop()` are central flow points. |
| `inn.js` | Inn/base actions, stays, talk/observe/deliver routes, and defeat aftermath | Coordinates story phases, recovery, and return-to-base flows. |
| `main.js` | Initial page setup, event binding, and small debug entry points | Runs last after all systems are available. |

## Core Runtime Contracts

### State

- `RPG.State.mode` uses `base`, `event`, or `battle` to gate controls and flow.
- `storyPhase`, `flags`, `completedEvents`, inventory, and counters drive progression.
- Temporary UI/battle fields and persistent story fields currently live in the same serialized state object.
- New state fields require a deliberate default in `state.js`; persistent flags normally belong under `RPG.State.flags`.

### Save and Load

- Save slots serialize the complete `RPG.State` into `localStorage` keys named `okai_rpg_save_1` through `okai_rpg_save_5`.
- Manual slot writes are available from the inn journal only while the game is in a stable `base` state; outside the inn, `okai_rpg_suspend` stores one replaceable suspend bookmark.
- New saves include presentation-only `saveMeta` (`kind`, timestamp, memo, and location). Older saves without it remain valid and receive default metadata on load.
- New snapshots clear dialogue and battle residue before serialization. Loading legacy saves preserves the existing compatibility path.
- Loading merges the immutable `RPG.DefaultState` snapshot with saved values so newer fields survive old saves without inheriting progress from another slot.
- The current code version is retained on load.
- Changes that rename, move, remove, or change the meaning of saved fields are high-risk and require an explicit compatibility plan.

### Events

- `RPG.Assets.EVENT_DATA` entries use an `id`, `condition(state)`, and `action(state)` pattern.
- `explorationSystem.checkEvents()` evaluates events, sets event mode, manages `completedEvents`, and starts queued dialogue.
- One-time versus repeatable behavior must remain explicit. Do not silently change existing event IDs.
- Story content, state mutation, UI logging, and event completion order must be reviewed together.

### Dialogue and UI Logging

- Most multi-step scenes populate `RPG.State.dialogueQueue` and call `explorationSystem.playDialogueLoop()`.
- Queue entries may contain text/display properties and an `action` callback for state or UI changes.
- Text entries normally wait for player input; non-text actions may continue immediately or after a delay.
- Do not bypass `uiControl.addLog()` or change queue timing/input behavior without checking existing scene patterns.

### Battle Flow

- `battleData.js` owns enemy/AI content; `battle.js` owns runtime execution and outcomes.
- Battle endings can route into dialogue, cinematics, inn defeat sequences, rewards, and progression flags.
- Changes to battle results must inspect post-battle queues, one-time rewards, defeat routing, and return to `base` mode.

## Golden Recipes

Prefer an existing recipe before creating a new mechanism.

- Dialogue scene: assign `RPG.State.dialogueQueue`, set the appropriate mode, then use `explorationSystem.playDialogueLoop()`.
- Reusable line conversion: follow the existing `buildDialogueQueue()` patterns in `exploration.js` or `inn.js`.
- Screen shake: `uiControl.screenShake()`.
- Flash: `uiControl.flashFullScreen(...)`.
- Blackout/fade: `uiControl.fadeFullScreen(...)`; inspect its cleanup pattern in `battle.js` before use.
- Named scene transition or cinematic: use or extend `Cinematics` when the sequence is a distinct set piece.
- UI refresh after state changes: use `uiControl.updateUI()` at the same lifecycle point as the nearest matching feature.

## Protected Boundaries

- Preserve `EVENT_DATA` shape and UI logging behavior.
- Preserve save compatibility unless the Director explicitly approves a migration.
- Preserve script order and legacy shims while they remain in active use.
- Do not fold content, engine, and UI responsibilities together as an incidental cleanup.
- Do not alter the Former Highway handoff or other legacy routes outside the active scope described in `WORKLOG.md`.
- Treat all existing uncommitted changes as Director-owned work; never discard or overwrite them.

## Standard Complex-Task Flow

1. Recommend Medium, High, or Extra High reasoning with a short reason.
2. Read `WORKLOG.md`, this map, and the relevant source paths.
3. Trace current state transitions and find the nearest Golden Recipe.
4. Present only unresolved game-design decisions to the Director.
5. Present the affected files, risks, and minimal implementation plan before editing.
6. Implement only after required design direction is settled.
7. Perform static checks and diff review.
8. Hand the Director a focused manual test route using `TEST_CHECKLIST.md`.

## Document Maintenance

- Update this map only when stable architecture, ownership, or contracts change.
- Record temporary story work, cutovers, and unfinished routes in `WORKLOG.md`.
- Add a durable rule to `AGENTS.md` only after it is broadly applicable or a mistake has repeated.
