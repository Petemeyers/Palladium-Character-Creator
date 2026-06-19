# Medieval Combat Simulator

Medieval Combat Simulator is a React/Vite tabletop combat tool for grounded medieval arena battles.

The active game identity is original:

- Human fighters and realistic animals only.
- No fantasy races or fantasy monsters.
- No excluded supernatural power systems or legacy licensed terminology.
- Combat uses original terminology such as Guard Rating, Armor Durability, Health, Stamina, Combat Round, Actions per Round, Profession, Combat Technique, Courage Check, and Resistance Check.

## Core Mechanics

The rules are original and use common tabletop ideas in plain language:

- Attack checks use a d20-style roll plus relevant modifiers against Guard Rating.
- Ability modifiers and trainingBonus can affect checks.
- Skill checks use a d20-style roll plus an ability modifier and trainingBonus against a difficulty.
- Combat proceeds in initiative order through combat rounds.
- Fighters spend actions to attack, move, block, evade, ready gear, use items, or perform mundane combat techniques.
- Conditions use plain tactical wording such as prone, grappled, bleeding, stunned, fatigued, and guardBroken.

## Data Scope

Arena Roster data is limited to humans and realistic animals such as knights, footmen, archers, guards, brigands, horses, dogs, wolves, boars, bears, bulls, and trained falcons.

## Development

Install dependencies and run:

```bash
npm run dev
npm run build
npm run test:stamina
```

## Attribution Note

This project uses original rules inspired by common d20-style tabletop mechanics. No SRD prose is copied.
