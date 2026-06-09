# 3D Map Controls Audit

This audit covers the current active 3D map in combat: `CombatPage.jsx` -> `HexArena3D.jsx` -> `src/utils/three/HexArena.js`.

## Where The 3D Open Button Lives

The main 3D open button lives in `src/pages/CombatPage.jsx` near the map/editor toolbar. It sits near the existing 2D map button:

- 2D button toggles `showTacticalMap`.
- 3D button toggles `show3DView`.

The labels are currently equivalent to:

- `Hide Map` / `Show Map`
- `Hide 3D Window` / `Show 3D Window`

There is also a small `2D On` / `2D Off` button inside the 3D panel's bottom control strip. That only toggles `showTacticalMap`; it does not close the 3D panel.

## Existing Close/Toggle Path

There is a toggle path through the toolbar 3D button: clicking the button again sets `show3DView` false.

There is also a close icon in `FloatingPanel.jsx`, but it is not wired to parent state. Its `onClick` only logs `Close panel`. Because the 3D panel is shown by `show3DView`, the close icon must eventually call a parent `onClose` callback so `CombatPage.jsx` can set `show3DView(false)`.

## Why The 3D Map Can Feel Stuck

The 3D panel can feel stuck for several reasons:

- The visible close icon does not actually close the panel.
- The actual close path is outside the panel in the original toolbar button, which may be covered, off-screen, or visually disconnected once the floating 3D window is open.
- The 3D panel is large by default: `initialWidth={1200}`, `initialHeight={700}`, `minWidth={700}`, `minHeight={450}`.
- The panel has high z-index and can cover combat controls.
- The 3D panel contains its own bottom combat-control overlay, but the movement buttons inside that overlay are disabled unless `showTacticalMap` is true.

## Pointer And Camera Controls

Pointer/camera controls are enabled in `src/utils/three/HexArena.js` through `OrbitControls`.

Current behavior:

- Damping is enabled.
- Pan is enabled.
- Screen-space panning is enabled.
- Left mouse rotates.
- Middle mouse dollies/zooms.
- Right mouse pans.
- Zoom-to-cursor is enabled when supported by the installed Three.js version.
- Min/max zoom distance and polar-angle limits are configured.

The controls exist, but there is no visible in-app control hint, reset-view button, focus-selected button, or 2D/3D toggle embedded in the panel header. Also, since `FloatingPanel` uses dragging and resizing, users may not immediately understand which parts drag the panel versus orbit the scene.

## Whether 3D Blocks Combat Controls

Yes, it can. The 3D view is a fixed `FloatingPanel` with high z-index. It can cover the center map, the toolbar, and parts of the combat UI.

There is a bottom combat-control strip inside the 3D panel. It includes:

- execute/next-turn button
- move button
- run button
- withdraw button
- compact combat log
- collapse/expand controls button
- 2D on/off button

This helps, but it is not a complete replacement for all combat controls. The default panel size still occupies a large amount of screen space.

## Small Safe Toggle Patch

The smallest safe first patch should stay in `CombatPage.jsx` plus a tiny optional `FloatingPanel.jsx` callback.

Recommended behavior:

- Put explicit `2D Map` and `3D Map` buttons side by side in the existing map toolbar.
- Make them reflect visibility, not a separate unused mode:
  - `2D Map` toggles `showTacticalMap`.
  - `3D Map` toggles `show3DView`.
- Add a reliable close path inside the 3D floating panel:
  - Preferred small patch: add `onClose` prop to `FloatingPanel`.
  - Wire the 3D panel as `<FloatingPanel ... onClose={() => setShow3DView(false)}>` .
  - Keep existing panel behavior otherwise unchanged.

This patch should not rewrite `HexArena3D`, should not change turn timing, and should not touch movement validation.

