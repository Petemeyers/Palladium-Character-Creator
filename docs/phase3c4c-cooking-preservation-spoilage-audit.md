# Phase 3C4C Cooking, Preservation, and Spoilage Audit

Starting authority: `0c8dd93 feat: implement canonical carcass harvesting and recovery`.

| Area | Existing authority | Finding and Phase 3C4C decision |
| --- | --- | --- |
| Food items | `consumptionSystem.js`, compatibility Rations, Phase 3C4B `resource.raw-game-meat` | Legacy food removes a whole item and applies a generic rest recovery. Canonical harvested food now enters a batch/portion ledger; compatibility rations remain supported separately. |
| Raw resources | `CANONICAL_HARVEST_RESOURCE_ITEMS` | `resource.raw-game-meat`, with a transferred `sourceCarcassId`, is the authoritative Phase 3C4C boundary. Cooking cannot recreate or re-harvest a carcass. |
| Consumables | `consumptionSystem.js` | Preserved for compatibility items. Canonical meals use exact food IDs and portion tokens and never call the HP healing pipeline. |
| Quantity and stacks | Phase 3C4B resource quantities and inventory transfer | Input inventory quantities are reduced exactly once. Outputs retain source food, batch, carcass, actor, and resource-ledger lineage. |
| Inventory capacity | Phase 3C4B injected capacity authority and existing encumbrance snapshots | Reused through an injected capacity callback or explicit snapshot. Output that does not fit remains in a location-bound camp cache. |
| Crafting | No suitable canonical food transaction existed | Phase 3C4C adds a narrow food-processing transaction, not a general crafting system. |
| Fire and heat | No canonical persistent camp heat authority existed | Project-owned qualitative heat states are `none`, `low`, `moderate`, and `high`; fire states are `unlit`, `igniting`, `burning`, `embers`, and `extinguished`. |
| Delayed ownership | Existing generation/initiative/action-token patterns | Food contexts bind generation, actor, initiative turn, action token, schedule owner, reservations, and expected world-clock completion. |
| World time | No single repository-wide adventure clock was authoritative | World time is injected as a monotonic `worldClock`. Combat rounds are never treated as spoilage time. A broader adventure clock remains an integration boundary. |
| Recovery | Existing stamina/rest helpers and nourishment compatibility state | Meals may recover at most two stamina outside immediate exertion and may add a bounded comfort/rest result. They do not heal HP or clear injuries or collapse. |
| Spoilage | Phase 3C4B descriptive boundary only | Deterministic freshness now progresses `fresh -> aging -> questionable -> spoiled` from injected world time and storage factors. It never regresses. |
| Contamination | Phase 3C4B carcass condition tags | Source contamination becomes canonical food state and accelerates deterioration; disease simulation remains deferred. |
| Recipes | No authoritative recipe catalog | Conservative project-owned recipes are roast, cooked portions, smoked, dried, and salted meat. No historical claims or elaborate meals are introduced. |
| Tools | Inventory items and compatibility tags | Capabilities are explicit: cooking support, cooking vessel, smoking rack, and drying rack. Missing tools remain missing. |
| Fuel | No canonical fuel inventory contract | Firewood/charcoal-style items require explicit fuel tags. Reservation, consumption, and return quantities reconcile exactly. |
| Salt | No canonical default salt stock | Salting exists as a recipe but remains unavailable until an actual `resource.salt` item is present. No salt is invented. |
| Camp UI | Hunting encounter presentation | The existing hunting panel now presents food batches, portions, freshness, fire, heat, fuel, recipe, and processing state. |
| Compatibility to preserve | Rations, Cooking skill values, legacy food AI | These remain compatibility paths. New canonical food items use `type: canonical-food` and cannot be consumed by the old whole-item path. |
| Obsolete behavior | Whole-stack canonical meal consumption, scavenging-generated unowned meat | Neither is used for Phase 3C4C. Scavenging remains compatibility behavior pending a separate migration. |

## Explicitly unchanged

Weapon and natural-attack damage, armor, penetration, hit locations, injury,
bleeding, HP, combat stamina formulas, movement, flight, initiative, grappling,
mounted combat, falling, surrender, wildlife intent, Hawk and Boar behavior,
Hide, Sneak, Aim, range bands, carcass eligibility, death authorization,
Phase 3C4B harvest quantities, projectile recovery, hunting finalization, and
encounter-over ownership are unchanged.

No trapping, fishing, detailed disease simulation, elaborate crafting,
historical recipe claims, public animal actors, or meal-based HP healing were
introduced.
