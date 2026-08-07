# Milestone 8 Status

## Phase 8A — Canonical Formation Movement AI

Implemented against the post-Milestone-7 package.

### Implemented

- Shared deterministic formation-movement planner
- AI `Close Ranks` movement
- AI `Withdraw in Order` movement
- Manual and AI movement commands use the same planner
- Legal adjacent-hex filtering
- Occupied-hex rejection
- Formation-support improvement scoring
- Cohesion and supporter-count scoring
- Line-depth and forward-exposure penalties
- Supported withdrawal scoring
- Facing preservation
- Terrain movement-cost awareness in candidate ranking
- Same-round repeat prevention for `Close Ranks`
- Same-round repeat prevention for `Withdraw in Order`
- Formation-command action and stamina affordability checks
- Movement releases an anchored stance
- Developer events for accepted and rejected automated formation movement

### AI decision priorities

1. A disrupted fighter with an existing supporting line uses `Reform Line`.
2. A disrupted fighter outside support uses `Close Ranks` when a legal
   support-improving hex exists.
3. A pressured, badly injured, or exhausted supported fighter may use
   `Withdraw in Order` when a legal supported retreat exists.
4. An unsupported or loose fighter closes ranks when movement improves the
   formation.
5. A supported fighter may anchor when movement recovery is unnecessary.

### Canonical movement rules

`Close Ranks`:

- considers only adjacent legal and unoccupied hexes;
- must improve support, supporter count, or cohesion;
- will not choose a destination with no spatial supporter;
- penalizes stepping substantially ahead of the line;
- keeps the actor's current facing;
- may move a disrupted fighter into position without clearing disruption;
  the fighter must use `Reform Line` or `Rally Formation` afterward.

`Withdraw in Order`:

- requires support before moving;
- increases distance from the current target;
- requires support after moving;
- prioritizes retained support and cohesion over raw retreat distance;
- keeps the actor's current facing.

### Developer events

- `automated-formation-movement-resolved`
- `automated-formation-movement-rejected`

The existing nonmovement event remains:

- `automated-formation-command-resolved`

## Validation completed

- Formation movement planner executable scenarios passed
- Automated command-selection scenarios passed
- Formation command authority regression passed
- Terrain formation authority regression passed
- Shield aftermath authority regression passed
- Milestone 7 source contract passed
- Milestone 8A source contract passed
- Milestone 7 calibration sample contract passed
- Twelve-scenario 5v5/10v10/20v20 calibration smoke run completed
- New JavaScript and MJS syntax checks passed
- `CombatPage.jsx` JSX/JavaScript syntax parsing passed with TypeScript

The partial package does not contain every inherited Milestone 6 authority file.
The weapon-bind regression therefore requires the complete game repository,
as do the production Vite build and browser combat run.

## Next Phase

### Phase 8B — Terrain Movement Authority

- Apply mud movement-stamina costs
- Apply rubble movement-stamina costs
- Add uneven-ground retreat control
- Add narrow-passage congestion
- Route terrain costs through canonical movement commits
- Add terrain-aware movement diagnostics and tests
