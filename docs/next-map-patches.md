# Next Map Patches

Each patch should be one narrow implementation task. Do not combine these unless explicitly requested.

## Recommended Order

1. Add `2D Map` and `3D Map` buttons side by side.

   Scope: `src/pages/CombatPage.jsx`.

   Replace the current confusing map button labels with two adjacent explicit buttons. Keep their behavior tied to `showTacticalMap` and `show3DView`. Do not use `mapViewMode` as the source of truth yet.

2. Make the 3D map closable from its own panel.

   Scope: `src/components/FloatingPanel.jsx` and the 3D panel mount in `src/pages/CombatPage.jsx`.

   Add an optional `onClose` prop to `FloatingPanel`. Wire only the 3D panel to `onClose={() => setShow3DView(false)}`. Preserve existing drag/resize behavior.

3. Move 3D combat controls into a better bottom overlay/drawer.

   Scope: 3D panel JSX in `src/pages/CombatPage.jsx`.

   Keep the existing controls, but make the overlay easier to collapse and less likely to cover the scene. This should not change action execution logic.

4. Make 3D camera/pan/orbit controls user-friendly.

   Scope: `src/utils/three/HexArena.js` and possibly small UI buttons in the 3D panel.

   Add focused controls such as reset view, focus current fighter, clearer pan/orbit affordances, and possibly better initial framing. Do not rewrite rendering.

5. Make manual Walk/Run use the same movement state for both maps.

   Scope: start in `src/pages/CombatPage.jsx`, then pass a narrow interaction API to `HexArena3D.jsx`.

   First make the current 2D validation path canonical. Then let 3D select a destination through the same callback. Do not create a separate 3D movement resolver.

6. Add a local map editor prototype only after the above works.

   Scope: `TacticalMap` editor mode, `HexArena3D` preview sync, and `MapMakerPage`/combat editor controls.

   Add texture, terrain, and height controls in small increments. Save/load should come after the interaction state is stable.

## Exact First Patch Recommendation

First patch: add explicit `2D Map` and `3D Map` buttons side by side in the existing `CombatPage.jsx` toolbar, using `showTacticalMap` and `show3DView`.

Why first:

- It directly addresses the user's confusion.
- It is isolated to UI state and labels.
- It does not touch turn timing, movement validation, AI scheduling, or Three.js internals.
- It sets up the next close-button patch cleanly.

Expected build command after implementation: `npm run build`.

