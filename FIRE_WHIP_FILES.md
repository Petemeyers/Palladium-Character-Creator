# Fire Whip Weapon - File Locations and Status

## Summary
The Fire Whip is a special supernatural weapon used by Baal-Rog demons. It is:
- ✅ In the weapon database (`src/data/weapons.js`)
- ✅ Excluded from the weapon shop (not purchasable)
- ✅ Assigned to Baal-Rog's left hand in combat
- ✅ Lootable when Baal-Rog is defeated
- ✅ Has fire immunity (Baal-Rog is impervious to fire)

## File Locations

### 1. **`src/data/weapons.js`** (Main Weapon Database)
- **Line 374-422**: Fire Whip added to main `weapons` array
- **Properties**:
  - `isSpecial: true` - Flag to exclude from shop
  - `purchasable: false` - Explicitly not purchasable
  - `price: 0` - Not for sale
  - `isSupernatural: true` - Supernatural weapon
  - `isMagical: true` - Magical weapon
  - `reach: 15` - 15 feet reach (3 hexes)
  - `weaponType: "flexible"` - Flexible weapon type
  - Special properties: entangle, disarm, trip, pull, anti-air, fire damage

- **Line 523-569**: Separate export `baalRogFireWhip` for backward compatibility
  - References the weapon from the array using `getWeaponByName("Fire Whip")`

### 2. **`src/pages/CombatPage.jsx`** (Combat Arena)
- **Line 90**: Import statement - `import { weapons, getWeaponByName, baalRogFireWhip } from "../data/weapons.js";`
- **Line 63**: Import `SPELL_ELEMENT_MAP` for fire spell detection
- **Line 1224-1236**: Fire Whip handling in available weapons list
- **Line 8627-8675**: Fire Whip assignment to Baal-Rog's left hand
  - Prioritizes Fire Whip when selecting natural attacks
  - Sets `equippedWeapons[1]` (Left Hand)
  - Sets `equipped.weaponSecondary` for consistency
- **Line 9742-9794**: Fire immunity check in spell execution
  - Checks if spell is fire-based using `SPELL_ELEMENT_MAP`
  - Checks if target is impervious to fire
  - Prevents fire damage if impervious

### 3. **`src/components/WeaponShop.jsx`** (Weapon Store)
- **Line 57-74**: Filter to exclude special weapons from shop
  - Filters out weapons with `isSpecial: true`
  - Filters out weapons with `isSupernatural: true`
  - Filters out weapons with `purchasable: false`
  - Filters out magical weapons with `price: 0`

### 4. **`src/utils/captureSystem.js`** (Looting System)
- **Line 64-88**: `lootPrisoner` function updated
  - Includes equipped weapons in loot (including Fire Whip)
  - Filters out "Unarmed" and "None" weapons
  - Fire Whip will be lootable when Baal-Rog is defeated

### 5. **`src/utils/whipReachSystem.js`** (3D Reach Calculation)
- **Purpose**: Implements 3D reach for flexible weapons like Fire Whip
- **Functions**:
  - `calculate3DDistance()` - Calculates 3D distance (horizontal + vertical)
  - `isWithinWhipReach()` - Checks if target is within whip reach
  - `isFlexibleReachWeapon()` - Identifies flexible reach weapons
  - `validateFlexibleWeaponReach()` - Validates reach for flexible weapons

### 6. **`src/utils/distanceCombatSystem.js`** (Distance Combat)
- **Line 438-443**: Detects flexible reach weapons
- Uses `validateFlexibleWeaponReach` for 3D reach validation

### 7. **`src/utils/magicAbilitiesParser.js`** (Magic Parser)
- **Line 56**: "Fire Whip" mapped as fire element (but skipped as it's a weapon, not a spell)
- **Line 294-301**: Skips Fire Whip when parsing spells (it's a weapon, not a spell)
- **Line 432-433**: Skips Fire Whip when adding specific spells

### 8. **`src/data/bestiary.json`** (Creature Database)
- **Line 5632-5636**: Baal-Rog's Fire Whip attack entry
  - `name: "Fire Whip"`
  - `damage: "4d6"`
  - `reach: 15`
  - `type: "flexible"`
- **Line 5658**: Baal-Rog's ability - `"Impervious to fire (no damage)"`

## Weapon Properties

### Fire Whip Stats
- **Damage**: 4d6
- **Reach**: 15 feet (3 hexes)
- **Type**: Flexible melee weapon
- **Weight**: 5
- **Strength Required**: 20 (supernatural)
- **Price**: 0 (not purchasable)

### Special Properties
- ✅ Entangle capable
- ✅ Disarm capable
- ✅ Trip capable
- ✅ Pull capable
- ✅ Anti-air (can hit flying targets)
- ✅ Fire damage type
- ✅ 3D reach (horizontal + vertical)

### Special Attacks
- Entangle
- Disarm
- Trip
- Pull

### Combat Modifiers
- **Parry Penalty**: -2 (hard to parry flexible weapons)
- **Dodge Allowed**: Yes
- **Shield Block**: No (whips are difficult to block with shields)

### Restrictions
- **Requires Supernatural Strength**: Yes
- **Non-Demonic Penalty**: -4 (non-demons have difficulty using it)

## Current Status

✅ **Fire Whip is in weapon database** (`src/data/weapons.js` - line 374)
✅ **Fire Whip is excluded from shop** (filtered in `WeaponShop.jsx`)
✅ **Fire Whip assigned to Baal-Rog's left hand** (`CombatPage.jsx` - line 8651)
✅ **Fire Whip is lootable** (`captureSystem.js` - includes equipped weapons)
✅ **Baal-Rog is impervious to fire** (spell execution checks fire immunity)
✅ **Fire Whip uses 3D reach** (`whipReachSystem.js` for flexible reach)

## Testing Checklist

- [ ] Add Baal-Rog to combat arena
- [ ] Verify Fire Whip appears in "Left Hand" slot in party member selection
- [ ] Verify Fire Whip is NOT in weapon shop
- [ ] Cast fire spells at Baal-Rog - should show "impervious to fire" message
- [ ] Defeat Baal-Rog and loot - Fire Whip should be in loot
- [ ] Verify Fire Whip has 15ft reach in combat

