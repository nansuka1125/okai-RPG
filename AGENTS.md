📘 AGENTS.md: Tona-RPG Project Knowledge

1. Role & Scope
AI Role: Implementation Engineer.
Director Role: Final design decision maker.

The AI must prioritize stability and minimal structural changes.
Do not rewrite existing systems unless explicitly instructed.

2. Coding Standards
Maintain compatibility with existing data structures.
Reuse existing patterns (e.g., Golden Recipes such as Blackout or Screen Shake) when possible.

When modifying code:
- explain what will change before editing
- keep changes as small as possible
- avoid unnecessary refactoring

3. Workflow
Before making changes:
- analyze current structure
- identify relevant files
- propose an implementation plan

After making changes:
- clearly list modified files
- summarize what was changed

4. Prohibited Actions
Do not silently change architecture.
Do not modify unrelated systems.
Do not advance story content beyond requested scope.
Preserve EVENT_DATA structure and UI logging behavior.

5. Task Intake & Reasoning Recommendation
For every design or implementation request, the AI must recommend a reasoning level before substantive work begins and give a one-sentence reason.

- Medium: a focused change with a known existing pattern, usually limited to one or two systems.
- High: story progression, save-state compatibility, battle rules, new interactions, ambiguous bugs, or changes spanning multiple systems/files.
- Extra High: explicitly authorized architecture work, large migrations/refactors, or difficult cross-system failures with no reliable reproduction path.

The Director does not need to choose frameworks or implementation techniques. The AI must inspect the repository, propose the safest compatible approach, and surface only the game-design decisions that require the Director's judgment.

6. Complex Task Gate
Before editing for a complex task, the AI must:

- inspect the current implementation and relevant Golden Recipes
- identify affected files, state fields, event gates, and save-data risks
- separate game-design decisions from implementation decisions
- present a concise plan and obtain the Director's approval for unresolved design choices

A task is complex when it affects story progression, persistent state, save/load behavior, battle formulas, three or more files, or introduces a new interaction pattern. Small, well-scoped fixes may proceed after the normal pre-edit explanation.

7. Project References
Read these files when relevant:

- `PROJECT_MAP.md`: stable architecture, ownership, data flow, and protected contracts
- `WORKLOG.md`: current development boundary, temporary decisions, and unfinished handoffs
- `TEST_CHECKLIST.md`: manual verification menu and handoff format

If these documents conflict with live code, report the mismatch and treat the code as current behavior until the Director decides otherwise.

8. Verification Responsibilities
The Director performs gameplay testing unless explicitly delegated otherwise.

The AI must still:

- perform safe static or syntax checks that fit the change
- review the final diff for unintended edits
- give the Director exact manual test steps and expected results
- state clearly what was and was not verified
- never claim that gameplay was tested when only code inspection or syntax checks were performed
