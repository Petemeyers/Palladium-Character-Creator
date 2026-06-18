# Medieval Combat Simulator Game Coding Rules

This is a React/Vite/Electron tabletop RPG combat game.

## Sensitive files

- `src/pages/CombatPage.jsx` is large and fragile.
- Do not rewrite the whole file.
- Do not change combat turn advancement unless the task is specifically about turn logic.
- Do not change technique impact locking.
- Do not change enemy AI scheduling.
- Do not change attack resolution.

## UX task rules

- Make small, targeted patches.
- Improve only the setup/deployment duelist unless asked otherwise.
- Use minimal instructions.
- Show one obvious next action.
- Use pulsing tutorial highlights for the next required button.
- Beginner path should prefer Quick Start and Auto Deploy.
- Manual map placement should not be taught inside a modal that covers the map.

## Before finishing

- Show changed files.
- Summarize the diff.
- Run lint/build when available.
- Report errors honestly.
