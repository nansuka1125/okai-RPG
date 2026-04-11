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