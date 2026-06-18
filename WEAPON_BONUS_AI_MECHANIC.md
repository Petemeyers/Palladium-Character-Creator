# Weapon Bonus AI Mechanic

## Overview

The Weapon Bonus AI system evaluates weapons for combat bonuses and makes intelligent decisions about:
1. **Which weapon to use** (prefers weapons with bonuses)
2. **When to close distance** (to gain close-range attack bonuses)
3. **How to maximize combat effectiveness** (by leveraging all available bonuses)

---

## Key Features

### 1. **Weapon Bonus Evaluation**

The AI evaluates all available weapons and identifies bonuses including:

- **Reach Advantage**: +1 to +3 attack bonus for longer weapons
- **First Attack Bonus**: +1 attack on first combat round for longer weapons
- **Close Range Bonus**: +2 attack for short weapons in grapple range (<3ft)
- **Close Combat Bonus**: +1 attack for short weapons in close combat (<5ft)
- **Weapon Size Bonus**: +1 die damage for heavy races
- **Size Category Bonus**: +1 to +3 attack based on combatant size
- **Two-Handed Bonus**: +1 attack, +2 damage for two-handed grip
- **Weapon-Specific Bonuses**: Bonuses from weapon.bonuses property

### 2. **Weapon Ranking**

Weapons are ranked by a **bonus score** that considers:
- Attack bonuses (weighted 2x)
- Damage bonuses (weighted 1.5x)
- Reach advantages (weighted 1.5x)
- Close range bonuses (weighted 2x)
- Weapon size bonuses (weighted 2x)
- Penalties (reduce score)

### 3. **Distance Closing Analysis**

The AI analyzes whether closing distance would provide bonuses:
- **Short weapons** benefit from closing to grapple range (+2 attack)
- **Long weapons** are penalized at close range (-3 attack)
- Closing neutralizes defender's reach advantage

### 4. **Optimal Weapon Selection**

The AI recommends:
- **Best weapon** with highest bonus score
- **Action to take** (attack, close_distance, defend)
- **Reasoning** for the decision

---

## How It Works

### Step 1: Evaluate All Weapons

```javascript
const rankedWeapons = rankWeaponsByBonuses(
  availableWeapons,
  attacker,
  defender,
  combatState
);
```

Each weapon is evaluated for:
- Attack bonuses
- Damage bonuses
- Reach advantages
- Close range benefits
- Size-based bonuses

### Step 2: Analyze Distance Closing

```javascript
const closeAnalysis = analyzeClosingDistance(
  attacker,
  defender,
  currentWeapon,
  combatState
);
```

Determines if closing distance would:
- Provide close-range bonuses
- Neutralize defender's reach advantage
- Penalize attacker's long weapon

### Step 3: Make Recommendation

```javascript
const recommendation = getOptimalWeaponRecommendation(
  availableWeapons,
  attacker,
  defender,
  combatState
);
```

Returns:
- **Best weapon** to use
- **Action** to take (attack or close_distance)
- **Reasoning** for the decision
- **Score** indicating benefit

### Step 4: Integrate with AI Decision

The enemy AI system:
1. Gets weapon recommendation
2. Scores actions based on weapon bonuses
3. Prefers actions with weapon bonuses
4. Prioritizes closing distance if beneficial

---

## Integration Points

### Enemy AI System (`src/utils/enemyAI.js`)

**Enhanced `chooseAction()` method**:
- Gets optimal weapon recommendation before choosing action
- Prioritizes closing distance if it provides bonuses
- Selects best weapon based on bonuses

**New `evaluateWeaponBonusesForAction()` method**:
- Scores offensive actions based on weapon bonuses
- Adds bonus score to action scoring
- Prefers weapons with bonuses

**New `getOptimalWeaponForTarget()` method**:
- Gets best weapon for specific target
- Considers all bonuses and penalties
- Returns recommendation with reasoning

---

## Example Scenarios

### Scenario 1: Champion with Long Sword vs Human with Dagger

**Champion's Evaluation**:
- Reach advantage: +2 attack (3ft vs 1ft)
- First attack: +1 attack (first round)
- Heavy weapon: +1 die damage
- Size category: +1 attack (Large vs Medium)
- **Total Score**: High (multiple bonuses)

**AI Decision**: Use Long Sword, attack immediately

### Scenario 2: Human with Dagger vs Champion with Long Sword

**Human's Evaluation**:
- Reach disadvantage: -2 attack
- No bonuses at current distance

**Close Distance Analysis**:
- Closing to grapple range: +2 attack bonus
- Neutralizes Champion's reach advantage
- **Benefit**: High

**AI Decision**: Close distance first, then attack

### Scenario 3: Human with Short Sword vs Human with Long Sword

**Human's Evaluation**:
- Reach disadvantage: -2 attack
- Small weapon: Reduced damage
- Size category: -1 attack (Small vs Medium)

**Close Distance Analysis**:
- Closing to grapple range: +2 attack bonus
- Neutralizes Human's reach advantage
- **Benefit**: Moderate

**AI Decision**: Close distance to gain bonuses

---

## Bonuses Evaluated

### 1. **Reach Advantage** (`calculateReachAdvantage`)
- **Bonus**: +1 to +3 attack
- **When**: Attacker's weapon is longer than defender's
- **Max**: +3 (for 3+ foot difference)

### 2. **First Attack** (`getFirstAttackAdvantage`)
- **Bonus**: +1 attack
- **When**: Longer weapon on first combat round
- **Requirement**: 2+ foot reach difference

### 3. **Close Range** (Grapple Range <3ft)
- **Bonus**: +2 attack for short weapons
- **Penalty**: -3 attack for long weapons
- **When**: Combat distance <3ft

### 4. **Close Combat** (<5ft)
- **Bonus**: +1 attack for short weapons
- **Penalty**: -2 attack for long weapons
- **When**: Combat distance <5ft and distance closed

### 5. **Weapon Size** (`getWeaponSizeForRace`)
- **Bonus**: +1 die damage
- **When**: Heavy race (Champion, Heavy Fighter, Wolf, etc.)
- **Effect**: 2d6 Ã¢â€ â€™ 3d6

### 6. **Size Category** (`getSizeCategory`)
- **Bonus**: +1 to +3 attack
- **When**: Larger combatant vs smaller
- **Examples**: Large +1, Huge +2, Heavy +3

### 7. **Two-Handed Grip**
- **Bonus**: +1 attack, +2 damage
- **When**: Weapon used two-handed
- **Requirement**: Weapon can be used two-handed

### 8. **Weapon-Specific Bonuses**
- **Source**: `weapon.bonuses` property
- **Types**: attack, block, damage bonuses
- **Example**: Training weapon with +2 attack

---

## Usage

### For Enemy AI

The system is automatically integrated into the enemy AI decision-making process. Enemies will:
- Prefer weapons with bonuses
- Close distance if it provides bonuses
- Switch to better weapons when available

### For Player AI (Future)

Can be used to provide recommendations to players:
```javascript
const recommendation = makeWeaponBonusAIDecision(
  playerCharacter,
  [enemy],
  combatState
);

console.log(`Recommended: ${recommendation.weapon.name}`);
console.log(`Action: ${recommendation.action}`);
console.log(`Reason: ${recommendation.reasoning}`);
```

---

## Files

- **`src/utils/weaponBonusAI.js`**: Core weapon bonus evaluation system
- **`src/utils/enemyAI.js`**: Enhanced with weapon bonus integration
- **`WEAPON_BONUS_AI_MECHANIC.md`**: This documentation

---

## Summary

The Weapon Bonus AI mechanic:
- Ã¢Å“â€¦ Evaluates all weapons for bonuses
- Ã¢Å“â€¦ Ranks weapons by bonus score
- Ã¢Å“â€¦ Analyzes distance closing benefits
- Ã¢Å“â€¦ Recommends optimal weapon and action
- Ã¢Å“â€¦ Integrated into enemy AI decision-making
- Ã¢Å“â€¦ Prefers weapons with bonuses
- Ã¢Å“â€¦ Favors closing distance for close-range bonuses

The AI will now intelligently select weapons and positions to maximize combat effectiveness!

