# Phase 3C4B Carcass, Harvest, and Inventory Audit

Phase 3C4B extends the Phase 3C4A post-hunt boundary. Combat and hunting outcomes remain authoritative parents; carcass processing is a child lifecycle.

| Area | Existing authority | Finding | Phase 3C4B decision |
| --- | --- | --- | --- |
| Carcass state | `canonicalHuntingEncounter.js` | A death-only carcass boundary already retained actor identity, injuries, location, projectiles, and recovery state | Enrich the same record with death-event identity, condition, claim, processing ownership, resource ledger, spoilage, and transfer state |
| Death and survival | animal survival and combat finalizers | Death, unconsciousness, capture, and escape are distinct | Require explicit committed `dead` plus a stable death-event ID; reject unconscious, surrendered, captured, escaped, and ambiguous actors |
| Corpse loot | `LootWindow.jsx`, capture/enemy loot helpers | UI callbacks can add arbitrary defeated-actor equipment and do not enforce capacity | Do not use generic loot for animal harvests; use a capacity-checked processing transfer authority |
| Inventory schema | character inventory arrays and inventory UI | Items use IDs/names/types/weights/quantities, but stack identity is inconsistent | Add minimal resource records with stable `itemKey`, explicit quantity, unit weight, stack profile, raw state, and deferred-use tags |
| Stack behavior | ammunition manager and inventory arrays | Ammunition supports stack quantities; general inventory has no universal stack transaction | Stack harvest resources deterministically by stable item key and source carcass |
| Weight behavior | `encumbrance.js` | Inventory weight sums each record’s `weight` | Store harvest stack `weight` as quantity × unit weight; do not modify encumbrance formulas |
| Capacity | `getEncumbranceInfo` / `calculateMaxCarry` | Existing PS/species and explicit `carryWeight.maxWeight` are authoritative | Query existing capacity; transfer only legal whole units and leave the remainder on the carcass |
| Carrier capacity | canonical carrier/mounted helpers | Carrier loads have separate relationship authority | Do not place carcasses into ordinary inventory or reuse mount links for cargo |
| Existing meat/hide items | shop, equipment, flavor data | No canonical raw game-resource family with suitable stable processing identity | Add the minimum neutral processing items required by migrated animals |
| Existing animal materials | Spirit Bones and flavor references | Existing records are setting-specific and unsuitable as generic animal resources | Keep them unchanged; add neutral raw hide, fur, bone, tusk, claw, tooth, feather, fat, and meat identities |
| Projectile ownership | canonical ranged/ammunition helpers | Shot admission and exactly-once ammunition spending exist; no carcass recovery authority | Preserve original spend and create explicit embedded-projectile records after impact |
| Missed projectile | ranged impact paths | Misses are not embedded in targets | Expose a terrain-search-deferred record only; battlefield scavenging remains deferred |
| Field dressing tools | canonical weapon/item profiles | Knives, daggers, misericordes, axes, and similar tools exist but have no processing tags | Derive noncombat capability records without mutating weapon statistics |
| Skills | public `Survival` and legacy `Wilderness Survival` | Existing survival skills can represent uncertain processing | Reference them only when meaningful uncertainty exists; do not invent a skill |
| Cooking/food | consumption and cooking-adjacent data | Runtime consumption exists, but there is no complete raw-game cooking pipeline | Mark cooking and preservation as deferred; raw resources have no combat or food effects |
| Spoilage | scattered food references | No authoritative environmental spoilage curve | Add a descriptive clock boundary with no temperature formula or unmanaged timers |
| Presentation | Phase 3C4A Hunting Encounter Panel | Compact hunting status exists | Add a compact post-hunt row without developer IDs or map-token text |
| Hydration | combat actor normalization | Phase 3C4A preserved carcass boundary state | Preserve processing ledger, projectile, spoilage, transfer, and owner-token fields; block normalization during owned processing |

## Minimal project-owned yield authority

The new harvest profiles use conservative, explicit project-owned quantities and compatibility classes for deterministic processing. These are not claims of biological precision or market value. Every transferable record has an explicit unit weight, and the existing encumbrance authority decides what fits.

No cooking effects, nutrition, trade prices, detailed spoilage curves, tanning, trapping, fishing, culture/law rules, or carcass transportation system are introduced.
