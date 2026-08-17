import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const must = (condition, message) => {
  if (!condition) throw new Error(message);
};

const page = read('src/pages/MapMakerPage.jsx');
const sidebar = read('src/components/maps/MapMakerToolSidebar.jsx');
const inspector = read('src/components/maps/MapMakerInspectorPanel.jsx');
const manager = read('src/components/maps/BattlefieldMapManagerPanel.jsx');
const tacticalMap = read('src/components/TacticalMap.jsx');
const textures = read('src/utils/terrainTextures.js');
const builder = read('src/utils/three/mapBuilder3D.js');

must(page.includes('MapMakerToolSidebar'), 'MapMakerPage must use the tool sidebar');
must(page.includes('MapMakerInspectorPanel'), 'MapMakerPage must use the inspector');
must(page.includes('viewMode === "split"'), 'MapMakerPage must support split view');
must(page.includes('showEditorOverlay={false}'), 'MapMakerPage must suppress the legacy floating editor overlay');
must(page.includes('autoFit'), 'MapMakerPage must request fit-to-viewport behavior');
must(page.includes('handleSaveToLibrary'), 'MapMakerPage must save to the battlefield map library');
must(page.includes('handleTestBattle'), 'MapMakerPage must expose Test Battle');
must(page.includes('const buildExportMap = useCallback'), 'MapMakerPage must define buildExportMap before save/export/test-battle callbacks use it');
must(page.includes('const validateImportedMap = useCallback'), 'MapMakerPage must define validateImportedMap for JSON import');
must(page.includes('const clearTransientEditorState = useCallback'), 'MapMakerPage must define clearTransientEditorState for map open/import');
must(!/[ðÃ]/.test(page), 'MapMakerPage must not contain mojibake markers');

for (const tab of ['Terrain', 'Height', 'Props', 'Environment', 'Maps']) {
  must(sidebar.includes(`>${tab}<`), `Sidebar missing ${tab} tool tab`);
}
must(sidebar.includes('BattlefieldPropPalettePanel'), 'Sidebar must use canonical prop palette');
must(sidebar.includes('BattlefieldMapManagerPanel'), 'Sidebar must use battlefield map manager');
must(inspector.includes('Delete Object'), 'Inspector must support prop deletion');
must(inspector.includes('Elevation'), 'Inspector must support exact hex elevation');

must(manager.includes('BattlefieldCard'), 'Map manager must render thumbnail cards');
must(manager.includes('Generate & Edit'), 'Map manager must retain seeded generation');
must(manager.includes('Test Battle'), 'Map manager must retain Test Battle');

must(tacticalMap.includes('showEditorOverlay = true'), 'TacticalMap must preserve legacy overlay compatibility');
must(tacticalMap.includes('showEditorOverlay &&'), 'TacticalMap must allow the overlay to be hidden');
must(tacticalMap.includes('autoFit = false'), 'TacticalMap must preserve opt-in auto-fit');
must(tacticalMap.includes('editorBrushModeProp'), 'TacticalMap must accept external editor brush authority');

must(textures.includes('terrain-mud.svg'), 'Mud must have a dedicated texture');
must(textures.includes('terrain-rubble.svg'), 'Rubble must have a dedicated texture');
must(builder.includes('terrain-mud.svg'), '3D builder must support mud texture');
must(builder.includes('terrain-rubble.svg'), '3D builder must support rubble texture');

console.log('PASS map maker UX source contract');
