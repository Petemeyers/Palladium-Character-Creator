# Species Behavior Inconsistencies Report

## Overview

This report documents inconsistencies between `speciesBehavior.json` (recently created) and other data files, particularly those referencing the `annotated_rulebook.json`.

## Issues Found

### 1. Missing Alignment Categories in speciesBehavior.json

**Problem**: The `bestiary.json` file uses both:

- **Specific alignments**: `principled`, `scrupulous`, `aberrant`, `diabolic`, `anarchist`, `miscreant`, `unprincipled`
- **Broad alignment categories**: `good`, `selfish`, `evil`

However, `speciesBehavior.json` only contains entries for the specific alignments, missing:

- `good` (should map to principled/scrupulous behavior)
- `selfish` (should map to unprincipled/anarchist behavior)
- `evil` (should map to miscreant/aberrant/diabolic behavior)
- `neutral` (not found in bestiary, but exists in preCombatSystem.json)

**Impact**: When a creature has alignment "good", "selfish", or "evil" in bestiary.json, the `getSurrenderProfile()` function in `moraleSystem.js` will fall back to the "default" alignment (surrenderBiasDelta: 0), which may not accurately reflect their behavior.

**Examples from bestiary.json**:

- Line 12: Minotaur has `"selfish"` in alignment array
- Line 54: Scarecrow has `"evil"` in alignment array
- Line 126: Unicorn has `"good"` and `"selfish"` in alignment array
- Line 1505: Brownie has `"good"` in alignment_options

**Recommendation**: Add mapping entries to `speciesBehavior.json`:

```json
"good": {
  "surrenderBiasDelta": -1,
  "notes": "Good alignment; resists surrender (maps to principled/scrupulous behavior)."
},
"selfish": {
  "surrenderBiasDelta": 1,
  "notes": "Selfish alignment; will surrender to survive (maps to unprincipled/anarchist behavior)."
},
"evil": {
  "surrenderBiasDelta": -1,
  "notes": "Evil alignment; might flee but rarely surrenders (maps to miscreant/aberrant/diabolic behavior)."
},
"neutral": {
  "surrenderBiasDelta": 0,
  "notes": "Neutral alignment; baseline behavior."
}
```

### 2. Missing Species in speciesBehavior.json

**Problem**: The `bestiary.json` contains many species/races that are not present in `speciesBehavior.json`. When these creatures are used in combat, they will fall back to `defaultHumanoid` behavior, which may not be accurate.

**Species in bestiary.json but missing from speciesBehavior.json**:

- Minotaur
- Scarecrow (undead category)
- Spectre (undead category)
- Unicorn
- Pegasus
- Harpy
- Chimera
- Mummy (undead category)
- Gryphon
- Ghost (undead category)
- Werewolf
- Weretiger
- Werepanther
- Werebear
- Sphinx
- Bug Bear
- Various bears (Black Bear, Brown Bear, Grizzly Bear, Silver Bear)
- Various birds (Song Bird, Game Bird, Hawk, Owl, Vulture, Booted Eagle)
- And many more...

**Recommendation**: Add entries for common combat creatures, especially:

- Undead variants (mummy, ghost, spectre, scarecrow)
- Magical creatures (unicorn, pegasus, gryphon, sphinx)
- Shape-shifters (werewolf, weretiger, werepanther, werebear)
- At minimum, add a catch-all for undead category creatures

### 3. Referenced Files Status

**Status**: ✅ **RESOLVED** - Both `annotated_rulebook.json` and `Palladium.docx` now exist in `src/data/`

**Files Found**:

- ✅ `src/data/annotated_rulebook.json` - Contains species/race data with OCC limitations and favorite weapons
- ✅ `src/data/Palladium.docx` - Source document referenced in bestiary.json

**Additional Referenced Files**:

- ⚠️ `Rulebook.txt` - Referenced in bestiary.json and healingSystem.js, but not found (empty placeholder created)
- ⚠️ `OCC.txt` - Referenced in bestiary.json and healingSystem.js, but not found (empty placeholder created)

**Note**: The `Rulebook.txt` and `OCC.txt` files appear to be source documentation files. Empty placeholders have been created in `src/data/` to prevent broken references. These should be populated with actual content if the source documents become available.

### 4. Alignment Naming Inconsistency Across Files

**Problem**: Different files use different alignment naming conventions:

- **speciesBehavior.json**: Only specific alignments (principled, scrupulous, etc.)
- **bestiary.json**: Mix of specific and broad (good, selfish, evil, principled, etc.)
- **preCombatSystem.json**: Both specific AND broad (Principled, Scrupulous, Good, Selfish, Evil, Neutral)
- **data.jsx**: Uses compound format ("Good: Principled", "Selfish: Unprincipled", etc.)

**Impact**: Code needs to handle multiple alignment formats, which can lead to:

- Inconsistent behavior matching
- Fallback to default when alignment doesn't match exactly
- Potential bugs when alignment strings don't match expected format

**Recommendation**:

- Standardize on one format (preferably the specific alignments)
- Add normalization function to map broad categories to specific ones
- Update bestiary.json to use consistent alignment naming
- Or enhance `getSurrenderProfile()` to handle all formats more robustly

### 5. Code Handling of Alignment Mismatches

**Current Implementation** (`moraleSystem.js` lines 85-91):

```javascript
const alignProfile = alignmentMap[alignmentKey] ||
  // try loose match (e.g. "Principled (Good)")
  Object.entries(alignmentMap).find(([k]) => alignmentKey.includes(k))?.[1] ||
  alignmentMap["default"] || { surrenderBiasDelta: 0 };
```

**Issue**: This loose matching will work for "Good: Principled" (finds "principled"), but will NOT work for:

- "good" (doesn't contain "principled" or "scrupulous")
- "selfish" (doesn't contain "unprincipled" or "anarchist")
- "evil" (doesn't contain "miscreant", "aberrant", or "diabolic")

**Recommendation**: Add explicit mapping for broad alignment categories:

```javascript
// Map broad categories to specific alignments
const alignmentCategoryMap = {
  "good": "principled",      // or average of principled/scrupulous
  "selfish": "unprincipled",  // or average of unprincipled/anarchist
  "evil": "miscreant",        // or average of miscreant/aberrant/diabolic
  "neutral": "default"
};

const normalizedAlignment = alignmentCategoryMap[alignmentKey] || alignmentKey;
const alignProfile = alignmentMap[normalizedAlignment] || /* ... fallback ... */;
```

## Summary

### Critical Issues:

1. ✅ **RESOLVED: Missing alignment categories** - Added "good", "selfish", "evil", and "neutral" to speciesBehavior.json alignment section
2. ✅ **RESOLVED: Missing species entries** - Added 18 common species entries including undead variants, magical creatures, shape-shifters, and common monsters

### Medium Priority:

3. ✅ **RESOLVED**: annotated_rulebook.json and Palladium.docx now found in `src/data/`
4. ✅ **RESOLVED**: Rulebook.txt and OCC.txt now populated with content
5. ✅ **RESOLVED**: Alignment naming inconsistency - Enhanced normalization code in moraleSystem.js handles all alignment formats

### Recommendations Priority:

1. ✅ **RESOLVED**: Added "good", "selfish", "evil", and "neutral" to speciesBehavior.json alignment section
2. ✅ **RESOLVED**: Added common undead and magical creature entries to speciesBehavior.json (18 new species)
3. ✅ **RESOLVED**: annotated_rulebook.json and Palladium.docx now exist in `src/data/`
4. ✅ **RESOLVED**: Rulebook.txt and OCC.txt now populated with content
5. ✅ **RESOLVED**: Enhanced alignment normalization code in moraleSystem.js to handle all alignment formats (broad categories, specific alignments, and compound formats like "Good: Principled")
