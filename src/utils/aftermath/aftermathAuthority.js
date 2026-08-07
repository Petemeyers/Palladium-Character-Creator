import {
  buildShieldAftermathItem,
  resolveShieldAftermathAction,
} from "./shieldAftermathAuthority.js";

const AFTERMATH_SCHEMA_VERSION = 1;
export const AFTERMATH_STORAGE_KEY = "combat-sim.aftermath-campaign.v1";

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
const nowIso = () => new Date().toISOString();
const clone = (value) => JSON.parse(JSON.stringify(value));
const secureRandomUnit = () => {
  const cryptoObject = globalThis?.crypto;
  if (cryptoObject?.getRandomValues) {
    const value = new Uint32Array(1);
    cryptoObject.getRandomValues(value);
    return value[0] / 0x100000000;
  }
  return Math.random();
};

const getActorId = (fighter = {}) => String(fighter.id ?? fighter._id ?? "unknown-actor");
const getCurrentHp = (fighter = {}) => Number(
  fighter.currentHP ?? fighter.currentHp ?? fighter.HP ?? fighter.hp ?? fighter.derivedStats?.hp ?? 0
) || 0;
const getMaxHp = (fighter = {}) => Math.max(1, Number(
  fighter.maxHP ?? fighter.maxHp ?? fighter.hpMax ?? fighter.totalHP ?? fighter.derivedStats?.maxHp ?? fighter.derivedStats?.hp ?? 1
) || 1);
const normalizeCondition = (fighter = {}) => String(
  fighter.condition ?? fighter.status ?? fighter.combatState ?? "conscious"
).toLowerCase().replace(/[\s_-]+/g, "");

const isDeadFighter = (fighter = {}) => {
  const condition = normalizeCondition(fighter);
  return fighter.dead === true || fighter.isDead === true || condition === "dead" || getCurrentHp(fighter) <= -21;
};

const isDyingFighter = (fighter = {}) => {
  const condition = normalizeCondition(fighter);
  return fighter.dying === true || fighter.isDying === true || ["dying", "critical"].includes(condition);
};

const isUnconsciousFighter = (fighter = {}) => {
  const condition = normalizeCondition(fighter);
  return fighter.unconscious === true || fighter.isUnconscious === true || [
    "unconscious",
    "unconsciousstable",
    "unconsciousbleeding",
  ].includes(condition);
};

const severityRank = {
  none: 0,
  minor: 1,
  moderate: 2,
  severe: 3,
  critical: 4,
  fatal: 5,
};

const deriveSeverity = ({ fighter, wound = null }) => {
  const explicit = String(wound?.severity ?? wound?.grade ?? "").toLowerCase();
  if (severityRank[explicit] !== undefined) return explicit;

  const damage = Number(wound?.damage ?? wound?.hpLoss ?? wound?.damageAmount ?? 0) || 0;
  if (damage >= 18) return "critical";
  if (damage >= 10) return "severe";
  if (damage >= 5) return "moderate";
  if (damage > 0) return "minor";

  if (isDeadFighter(fighter)) return "fatal";
  if (isDyingFighter(fighter)) return "critical";
  const hpRatio = getCurrentHp(fighter) / getMaxHp(fighter);
  if (hpRatio <= 0) return "critical";
  if (hpRatio <= 0.25) return "severe";
  if (hpRatio <= 0.55) return "moderate";
  if (hpRatio < 1) return "minor";
  return "none";
};

const normalizeBodyRegion = (fighter = {}, wound = {}) => String(
  wound.bodyRegion ?? wound.location ?? wound.hitLocation ?? fighter.lastHitLocation?.location ??
  fighter.lastHitLocation ?? fighter.lastDamageLocation ?? "unknown"
);

const normalizeMechanism = (wound = {}) => String(
  wound.mechanism ?? wound.damageType ?? wound.type ?? wound.kind ?? "combat-trauma"
).toLowerCase();

const normalizeFracture = (wound = {}) => {
  const explicit = wound.fracture;
  if (explicit && typeof explicit === "object") {
    return {
      present: explicit.present !== false,
      open: explicit.open === true || explicit.type === "open",
      displaced: explicit.displaced === true || ["moderate", "severe"].includes(explicit.displacement),
      splinted: explicit.splinted === true,
    };
  }
  const text = `${wound.type ?? ""} ${wound.description ?? ""} ${wound.name ?? ""}`.toLowerCase();
  const present = wound.brokenBone === true || wound.isFracture === true || text.includes("fracture") || text.includes("broken bone");
  return {
    present,
    open: present && (wound.openFracture === true || text.includes("open fracture")),
    displaced: present && (wound.displaced === true || text.includes("displaced")),
    splinted: wound.splinted === true,
  };
};

const normalizeExplicitWound = (fighter, wound, index) => {
  const severity = deriveSeverity({ fighter, wound });
  const bleeding = wound?.bleeding === true || wound?.activeBleeding === true;
  const contamination = clamp(
    wound?.contamination ?? wound?.contaminationRisk ?? (normalizeMechanism(wound).includes("puncture") ? 45 : 30),
    0,
    100
  );
  return {
    woundId: String(wound?.woundId ?? wound?.id ?? `${getActorId(fighter)}:wound:${index + 1}`),
    source: "canonical-combat-wound",
    mechanism: normalizeMechanism(wound),
    damageType: String(wound?.damageType ?? wound?.type ?? "unknown").toLowerCase(),
    bodyRegion: normalizeBodyRegion(fighter, wound),
    severity,
    depth: String(wound?.depth ?? (severityRank[severity] >= 3 ? "deep" : "superficial")),
    bleeding,
    contamination,
    fracture: normalizeFracture(wound),
    pain: clamp(wound?.pain ?? severityRank[severity] * 18, 0, 100),
    functionalImpairment: String(wound?.functionalImpairment ?? wound?.impairment ?? "unknown"),
    notes: wound?.description ? [String(wound.description)] : [],
    treatments: Array.isArray(wound?.treatments) ? clone(wound.treatments) : [],
  };
};

const createFallbackWound = (fighter) => {
  const severity = deriveSeverity({ fighter });
  if (severity === "none") return null;
  const activeBleeding = fighter?.bleeding?.active === true && fighter?.bleeding?.stabilized !== true;
  return {
    woundId: `${getActorId(fighter)}:wound:unresolved-trauma`,
    source: "derived-from-combat-state",
    mechanism: "unresolved-combat-trauma",
    damageType: "unknown",
    bodyRegion: normalizeBodyRegion(fighter),
    severity,
    depth: severityRank[severity] >= 3 ? "deep-or-uncertain" : "superficial-or-uncertain",
    bleeding: activeBleeding,
    contamination: severityRank[severity] >= 3 ? 45 : 25,
    fracture: { present: false, open: false, displaced: false, splinted: false },
    pain: clamp(severityRank[severity] * 18, 0, 100),
    functionalImpairment: isUnconsciousFighter(fighter) ? "incapacitated" : "unknown",
    notes: ["Exact anatomy was not recorded by the combat injury pipeline."],
    treatments: [],
  };
};

export const deriveCanonicalWounds = (fighter = {}) => {
  const sourceWounds = [
    ...(Array.isArray(fighter.wounds) ? fighter.wounds : []),
    ...(Array.isArray(fighter.state?.wounds) ? fighter.state.wounds : []),
    ...(Array.isArray(fighter.injuries) ? fighter.injuries : []),
  ];
  const normalized = sourceWounds.map((wound, index) => normalizeExplicitWound(fighter, wound, index));
  if (normalized.length > 0) return normalized;
  const fallback = createFallbackWound(fighter);
  return fallback ? [fallback] : [];
};

const getWorstSeverity = (wounds = []) => wounds.reduce(
  (worst, wound) => severityRank[wound?.severity] > severityRank[worst] ? wound.severity : worst,
  "none"
);

const deriveShock = ({ fighter, wounds, activeBleeding }) => {
  const severity = getWorstSeverity(wounds);
  const hpRatio = getCurrentHp(fighter) / getMaxHp(fighter);
  return clamp(
    (1 - Math.max(0, hpRatio)) * 45 +
    severityRank[severity] * 8 +
    (activeBleeding ? 20 : 0) +
    (isUnconsciousFighter(fighter) ? 12 : 0),
    0,
    100
  );
};

const deriveTriage = ({ dead, dying, unconscious, activeBleeding, shock, worstSeverity }) => {
  if (dead) return "deceased";
  if (dying || activeBleeding || shock >= 70 || worstSeverity === "critical") return "immediate";
  if (unconscious || shock >= 45 || worstSeverity === "severe") return "delayed";
  if (worstSeverity === "moderate") return "delayed";
  if (worstSeverity === "minor") return "minimal";
  return "fit";
};

const buildObservedSigns = ({ dead, dying, unconscious, activeBleeding, wounds, shock }) => {
  const signs = [];
  if (dead) signs.push("No signs of life");
  if (unconscious && !dead) signs.push("Unresponsive");
  if (dying) signs.push("Life appears in immediate danger");
  if (activeBleeding) signs.push("Active external bleeding");
  if (shock >= 70) signs.push("Very weak, pale, and cold");
  else if (shock >= 45) signs.push("Weakness and pallor");
  if (wounds.some((wound) => wound.fracture?.present)) signs.push("Possible broken bone or deformity");
  if (wounds.some((wound) => severityRank[wound.severity] >= 3)) signs.push("Deep or severe wound");
  if (signs.length === 0) signs.push("No urgent wound signs observed");
  return signs;
};

const collectEquipment = (fighter = {}) => {
  const seen = new Set();
  const items = [];
  const candidates = [
    ...(Array.isArray(fighter.equipment) ? fighter.equipment : []),
    ...(Array.isArray(fighter.inventory) ? fighter.inventory : []),
    ...(Array.isArray(fighter.weapons) ? fighter.weapons : []),
    ...(Array.isArray(fighter.equistaminadWeapons) ? fighter.equistaminadWeapons : []),
    fighter.equippedArmor,
    fighter.wornArmor,
  ].filter(Boolean);
  candidates.forEach((item, index) => {
    const name = String(item?.displayName ?? item?.name ?? item?.label ?? `Item ${index + 1}`);
    const key = String(item?.id ?? item?.weaponId ?? item?.profileKey ?? `${name}:${index}`);
    if (seen.has(key)) return;
    seen.add(key);
    items.push({
      itemId: key,
      name,
      category: String(item?.category ?? item?.type ?? "equipment"),
      confiscated: false,
      sourceActorId: getActorId(fighter),
      condition: item?.condition ?? item?.integrityState ?? null,
      broken: item?.broken === true,
    });
  });

  const shieldItem = buildShieldAftermathItem({
    shield: fighter.equippedShield || fighter?.equipped?.shield || fighter?.shield || fighter?.armorProfile?.shield || null,
    shieldIntegrity: fighter.shieldIntegrity || null,
    sourceActorId: getActorId(fighter),
  });
  if (shieldItem && !seen.has(String(shieldItem.itemId))) {
    seen.add(String(shieldItem.itemId));
    items.push(shieldItem);
  }
  return items;
};

export const createCasualtyRecord = ({ fighter = {}, position = null, encounterId }) => {
  const wounds = deriveCanonicalWounds(fighter);
  const dead = isDeadFighter(fighter);
  const dying = !dead && isDyingFighter(fighter);
  const unconscious = !dead && isUnconsciousFighter(fighter);
  const activeBleeding = !dead && (
    (fighter?.bleeding?.active === true && fighter?.bleeding?.stabilized !== true) ||
    wounds.some((wound) => wound.bleeding === true)
  );
  const worstSeverity = getWorstSeverity(wounds);
  const shock = dead ? 100 : deriveShock({ fighter, wounds, activeBleeding });
  const triage = deriveTriage({ dead, dying, unconscious, activeBleeding, shock, worstSeverity });
  const side = String(fighter.team ?? fighter.side ?? fighter.type ?? "unknown");
  const hostileToParty = side === "enemy" || fighter.type === "enemy";

  return {
    schemaVersion: AFTERMATH_SCHEMA_VERSION,
    casualtyId: `${encounterId}:${getActorId(fighter)}`,
    encounterId,
    actorId: getActorId(fighter),
    name: String(fighter.battleLabel ?? fighter.displayName ?? fighter.name ?? getActorId(fighter)),
    side,
    originalType: fighter.type ?? null,
    finalBattlePosition: position ? { ...position } : null,
    currentLocation: "battlefield",
    hpAtBattleEnd: getCurrentHp(fighter),
    maxHpAtBattleEnd: getMaxHp(fighter),
    dead,
    dying,
    unconscious,
    conscious: !dead && !unconscious,
    activeBleeding,
    bleedingControlled: fighter?.bleeding?.stabilized === true,
    shock,
    worstSeverity,
    triage,
    assessed: false,
    observedSigns: buildObservedSigns({ dead, dying, unconscious, activeBleeding, wounds, shock }),
    wounds,
    treatments: [],
    complications: [],
    infectionPressure: clamp(
      wounds.reduce((sum, wound) => sum + (Number(wound.contamination) || 0), 0) / Math.max(1, wounds.length),
      0,
      100
    ),
    recoveryProgress: dead ? 0 : worstSeverity === "none" ? 100 : 0,
    recoveryStatus: dead ? "dead" : worstSeverity === "none" ? "fit" : "acute",
    outcome: dead ? "died-during-combat" : null,
    permanentImpairment: null,
    prisoner: {
      eligible: hostileToParty && !dead,
      bound: fighter.isPrisoner === true || fighter.prisoner === true,
      status: fighter.isPrisoner === true || fighter.prisoner === true ? "bound" : "unsecured",
    },
    equipment: collectEquipment(fighter),
    equipmentConfiscated: false,
    dayHistory: [],
    lastUpdatedAt: nowIso(),
  };
};

export const createAftermathEncounter = ({
  fighters = [],
  positions = {},
  result = "resolved",
  endedAt = Date.now(),
  environment = null,
} = {}) => {
  const encounterId = `aftermath:${Number(endedAt) || Date.now()}`;
  const casualties = fighters.map((fighter) => createCasualtyRecord({
    fighter,
    position: positions?.[getActorId(fighter)] ?? null,
    encounterId,
  }));
  return {
    schemaVersion: AFTERMATH_SCHEMA_VERSION,
    encounterId,
    result,
    endedAt: Number(endedAt) || Date.now(),
    createdAt: nowIso(),
    currentDay: 0,
    maximumSimulatedDay: 7,
    phase: "battlefield-aftermath",
    environment: environment ? clone(environment) : null,
    positions: clone(positions || {}),
    casualties,
    supplies: {
      bandages: Math.max(4, Math.ceil(fighters.length * 0.75)),
      splints: Math.max(2, Math.ceil(fighters.length * 0.25)),
      restraints: Math.max(2, Math.ceil(fighters.length * 0.35)),
      litters: Math.max(1, Math.ceil(fighters.length * 0.15)),
      repairMaterials: Math.max(2, Math.ceil(fighters.length * 0.2)),
    },
    lootLedger: [],
    eventLog: [{
      eventId: `${encounterId}:event:created`,
      day: 0,
      type: "aftermath-created",
      message: `Battlefield aftermath opened with ${casualties.length} combatants recorded.`,
      createdAt: nowIso(),
    }],
  };
};

export const createEmptyAftermathCampaign = () => ({
  schemaVersion: AFTERMATH_SCHEMA_VERSION,
  currentEncounterId: null,
  encounters: [],
  updatedAt: nowIso(),
});

export const loadAftermathCampaign = () => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return createEmptyAftermathCampaign();
    const raw = window.localStorage.getItem(AFTERMATH_STORAGE_KEY);
    if (!raw) return createEmptyAftermathCampaign();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.encounters)) return createEmptyAftermathCampaign();
    return {
      ...createEmptyAftermathCampaign(),
      ...parsed,
      encounters: parsed.encounters,
    };
  } catch {
    return createEmptyAftermathCampaign();
  }
};

export const saveAftermathCampaign = (campaign) => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    window.localStorage.setItem(AFTERMATH_STORAGE_KEY, JSON.stringify(campaign));
    return true;
  } catch {
    return false;
  }
};

export const upsertAftermathEncounter = (campaign, encounter) => {
  const safeCampaign = campaign?.encounters ? clone(campaign) : createEmptyAftermathCampaign();
  const index = safeCampaign.encounters.findIndex((candidate) => candidate.encounterId === encounter.encounterId);
  if (index >= 0) safeCampaign.encounters[index] = clone(encounter);
  else safeCampaign.encounters.push(clone(encounter));
  safeCampaign.currentEncounterId = encounter.encounterId;
  safeCampaign.updatedAt = nowIso();
  return safeCampaign;
};

export const getCurrentAftermathEncounter = (campaign) => campaign?.encounters?.find(
  (encounter) => encounter.encounterId === campaign.currentEncounterId
) ?? null;

const appendEncounterEvent = (encounter, { type, message, casualtyId = null, day = encounter.currentDay }) => {
  encounter.eventLog = [
    ...(encounter.eventLog || []),
    {
      eventId: `${encounter.encounterId}:event:${(encounter.eventLog?.length || 0) + 1}`,
      type,
      message,
      casualtyId,
      day,
      createdAt: nowIso(),
    },
  ];
};

const addTreatment = (casualty, type, notes = null, day = 0) => {
  casualty.treatments = [
    ...(casualty.treatments || []),
    {
      treatmentId: `${casualty.casualtyId}:treatment:${(casualty.treatments?.length || 0) + 1}`,
      type,
      notes,
      day,
      performedAt: nowIso(),
    },
  ];
  casualty.lastUpdatedAt = nowIso();
};

const failAction = (encounter, reason) => ({ accepted: false, reason, encounter });

export const applyAftermathAction = (sourceEncounter, {
  casualtyId,
  action,
  actorId = null,
} = {}) => {
  const encounter = clone(sourceEncounter);
  const casualty = encounter.casualties.find((candidate) => candidate.casualtyId === casualtyId);
  if (!casualty) return failAction(encounter, "casualty-not-found");
  const day = encounter.currentDay || 0;

  if (action === "assess") {
    casualty.assessed = true;
    addTreatment(casualty, "assessment", `Assessed by ${actorId || "aftermath staff"}.`, day);
    appendEncounterEvent(encounter, {
      type: "casualty-assessed",
      casualtyId,
      message: `${casualty.name} was assessed: triage ${casualty.triage}.`,
    });
    return { accepted: true, encounter, casualty, message: `${casualty.name} assessed.` };
  }

  if (action === "stop-bleeding") {
    if (casualty.dead) return failAction(encounter, "casualty-dead");
    if (!casualty.activeBleeding) return failAction(encounter, "no-active-bleeding");
    if ((encounter.supplies?.bandages || 0) <= 0) return failAction(encounter, "no-bandages");
    encounter.supplies.bandages -= 1;
    casualty.activeBleeding = false;
    casualty.bleedingControlled = true;
    casualty.shock = clamp(casualty.shock - 18, 0, 100);
    casualty.wounds = casualty.wounds.map((wound) => ({ ...wound, bleeding: false }));
    casualty.triage = deriveTriage({
      dead: casualty.dead,
      dying: casualty.dying,
      unconscious: casualty.unconscious,
      activeBleeding: false,
      shock: casualty.shock,
      worstSeverity: casualty.worstSeverity,
    });
    addTreatment(casualty, "bleeding-control", "Pressure, packing, and binding applied.", day);
    appendEncounterEvent(encounter, {
      type: "bleeding-controlled",
      casualtyId,
      message: `Bleeding was controlled for ${casualty.name}.`,
    });
    return { accepted: true, encounter, casualty, message: `${casualty.name}'s bleeding was controlled.` };
  }

  if (action === "splint") {
    if (casualty.dead) return failAction(encounter, "casualty-dead");
    const fractureIndex = casualty.wounds.findIndex((wound) => wound.fracture?.present && !wound.fracture?.splinted);
    if (fractureIndex < 0) return failAction(encounter, "no-unsplinted-fracture");
    if ((encounter.supplies?.splints || 0) <= 0) return failAction(encounter, "no-splints");
    encounter.supplies.splints -= 1;
    casualty.wounds[fractureIndex].fracture.splinted = true;
    casualty.shock = clamp(casualty.shock - 6, 0, 100);
    addTreatment(casualty, "splint", `Splinted ${casualty.wounds[fractureIndex].bodyRegion}.`, day);
    appendEncounterEvent(encounter, {
      type: "fracture-splinted",
      casualtyId,
      message: `${casualty.name}'s suspected fracture was splinted.`,
    });
    return { accepted: true, encounter, casualty, message: `${casualty.name}'s fracture was splinted.` };
  }

  if (action === "carry") {
    if (casualty.dead) return failAction(encounter, "casualty-dead");
    casualty.currentLocation = "field-infirmary";
    addTreatment(casualty, "evacuation", "Carried from the fighting ground to the field infirmary.", day);
    appendEncounterEvent(encounter, {
      type: "casualty-evacuated",
      casualtyId,
      message: `${casualty.name} was carried to the field infirmary.`,
    });
    return { accepted: true, encounter, casualty, message: `${casualty.name} carried to the infirmary.` };
  }

  if (action === "bind-prisoner") {
    if (!casualty.prisoner?.eligible) return failAction(encounter, "not-prisoner-eligible");
    if (casualty.dead) return failAction(encounter, "casualty-dead");
    if (casualty.prisoner.bound) return failAction(encounter, "already-bound");
    if ((encounter.supplies?.restraints || 0) <= 0) return failAction(encounter, "no-restraints");
    encounter.supplies.restraints -= 1;
    casualty.prisoner.bound = true;
    casualty.prisoner.status = "bound";
    appendEncounterEvent(encounter, {
      type: "prisoner-bound",
      casualtyId,
      message: `${casualty.name} was disarmed and bound as a prisoner.`,
    });
    return { accepted: true, encounter, casualty, message: `${casualty.name} is now a bound prisoner.` };
  }

  if (action === "confiscate-equipment") {
    const available = casualty.equipment.filter((item) => !item.confiscated);
    if (available.length === 0) return failAction(encounter, "no-equipment-available");
    casualty.equipment = casualty.equipment.map((item) => ({ ...item, confiscated: true }));
    casualty.equipmentConfiscated = true;
    encounter.lootLedger = [
      ...(encounter.lootLedger || []),
      ...available.map((item) => ({
        ...item,
        casualtyId,
        ownerName: casualty.name,
        confiscatedDay: day,
      })),
    ];
    appendEncounterEvent(encounter, {
      type: "equipment-confiscated",
      casualtyId,
      message: `${available.length} item${available.length === 1 ? "" : "s"} confiscated from ${casualty.name}.`,
    });
    return { accepted: true, encounter, casualty, items: available, message: `${casualty.name}'s equipment was confiscated.` };
  }

  if (action === "coup-de-grace") {
    if (casualty.dead) return failAction(encounter, "already-dead");
    casualty.dead = true;
    casualty.dying = false;
    casualty.unconscious = false;
    casualty.conscious = false;
    casualty.activeBleeding = false;
    casualty.triage = "deceased";
    casualty.recoveryStatus = "dead";
    casualty.outcome = "killed-after-combat";
    addTreatment(casualty, "coup-de-grace", `Performed by ${actorId || "unknown actor"}.`, day);
    appendEncounterEvent(encounter, {
      type: "coup-de-grace",
      casualtyId,
      message: `${casualty.name} was killed after combat.`,
    });
    return { accepted: true, encounter, casualty, message: `${casualty.name} was killed after combat.` };
  }

  return failAction(encounter, "unknown-action");
};


export const applyAftermathLootAction = (encounter, {
  itemId,
  action,
  currentDay = null,
} = {}) => resolveShieldAftermathAction({
  encounter,
  itemId,
  action,
  currentDay,
});

const randomValue = (random) => clamp(typeof random === "function" ? random() : Math.random(), 0, 0.999999);

const hasTreatment = (casualty, type) => casualty.treatments?.some((treatment) => treatment.type === type);
const hasUnsplintedFracture = (casualty) => casualty.wounds?.some(
  (wound) => wound.fracture?.present && !wound.fracture?.splinted
);

const chooseComplication = (casualty, roll) => {
  const infectionWeighted = casualty.infectionPressure >= 55 || casualty.wounds.some((wound) => wound.fracture?.open);
  if (infectionWeighted && roll < 0.45) return "wound-infection";
  if (hasUnsplintedFracture(casualty) && roll < 0.7) return "poor-fracture-alignment";
  if (casualty.shock >= 55) return "prolonged-weakness";
  return "delayed-healing";
};

const calculateDailyRisks = (casualty, day) => {
  const severity = severityRank[casualty.worstSeverity] || 0;
  const bleedingRisk = casualty.activeBleeding ? (day === 1 ? 0.38 : 0.25) : 0;
  const shockRisk = clamp((casualty.shock - 45) / 250, 0, 0.24);
  const infectionRisk = day >= 2 ? clamp((casualty.infectionPressure - 35) / 350, 0, 0.2) : 0;
  const severeRisk = severity >= 4 ? 0.09 : severity === 3 ? 0.035 : 0;
  const infirmaryReduction = casualty.currentLocation === "field-infirmary" ? 0.025 : 0;
  const assessedReduction = casualty.assessed ? 0.01 : 0;
  const deathRisk = clamp(bleedingRisk + shockRisk + infectionRisk + severeRisk - infirmaryReduction - assessedReduction, 0, 0.85);

  const fractureRisk = hasUnsplintedFracture(casualty) ? 0.18 : 0;
  const complicationRisk = clamp(
    0.04 + severity * 0.035 + fractureRisk + (day >= 2 ? casualty.infectionPressure / 500 : 0) -
    (hasTreatment(casualty, "bleeding-control") ? 0.035 : 0) -
    (casualty.currentLocation === "field-infirmary" ? 0.03 : 0),
    0,
    0.72
  );
  return { deathRisk, complicationRisk };
};

const resolveDayOutcome = (casualty, day, random) => {
  if (casualty.dead || ["recovered", "returned-to-duty"].includes(casualty.recoveryStatus)) {
    return { casualty, event: null };
  }

  const risks = calculateDailyRisks(casualty, day);
  const mortalityRoll = randomValue(random);
  if (mortalityRoll < risks.deathRisk) {
    casualty.dead = true;
    casualty.dying = false;
    casualty.unconscious = false;
    casualty.conscious = false;
    casualty.activeBleeding = false;
    casualty.triage = "deceased";
    casualty.recoveryStatus = "dead";
    casualty.outcome = `died-from-wounds-day-${day}`;
    return {
      casualty,
      event: `${casualty.name} died from wounds on day ${day}.`,
      risks,
      mortalityRoll,
    };
  }

  const complicationRoll = randomValue(random);
  let complication = null;
  if (complicationRoll < risks.complicationRisk) {
    complication = chooseComplication(casualty, randomValue(random));
    if (!casualty.complications.includes(complication)) casualty.complications.push(complication);
    if (complication === "wound-infection") casualty.infectionPressure = clamp(casualty.infectionPressure + 18, 0, 100);
    if (complication === "prolonged-weakness") casualty.shock = clamp(casualty.shock + 8, 0, 100);
  } else {
    casualty.infectionPressure = clamp(casualty.infectionPressure - (casualty.currentLocation === "field-infirmary" ? 8 : 3), 0, 100);
    casualty.shock = clamp(casualty.shock - (casualty.activeBleeding ? 2 : 9), 0, 100);
  }

  if (casualty.activeBleeding && day >= 2) {
    casualty.activeBleeding = false;
    casualty.bleedingControlled = false;
    casualty.complications.push("bleeding-ended-without-treatment");
  }

  const baseProgress = casualty.worstSeverity === "minor" ? 24 : casualty.worstSeverity === "moderate" ? 15 : 8;
  const careBonus = casualty.currentLocation === "field-infirmary" ? 6 : 0;
  const treatmentBonus = casualty.assessed ? 3 : 0;
  const complicationPenalty = complication ? 8 : 0;
  casualty.recoveryProgress = clamp(casualty.recoveryProgress + baseProgress + careBonus + treatmentBonus - complicationPenalty, 0, 100);

  if (day >= 7) {
    if (casualty.recoveryProgress >= 85 && casualty.worstSeverity !== "critical") {
      casualty.recoveryStatus = "returned-to-duty";
      casualty.outcome = "recovered-within-first-week";
    } else if (casualty.worstSeverity === "minor" && casualty.recoveryProgress >= 60) {
      casualty.recoveryStatus = "recovering";
      casualty.outcome = "expected-full-recovery";
    } else {
      casualty.recoveryStatus = "extended-care";
      casualty.outcome = "requires-weeks-of-care";
      if (hasUnsplintedFracture(casualty)) casualty.permanentImpairment = "risk-of-limb-deformity";
      else if (casualty.complications.includes("wound-infection")) casualty.permanentImpairment = "risk-of-chronic-wound";
      else if (["severe", "critical"].includes(casualty.worstSeverity)) casualty.permanentImpairment = "risk-of-lasting-weakness";
    }
  } else if (casualty.recoveryProgress >= 70) {
    casualty.recoveryStatus = "recovering";
  } else if (casualty.shock < 45 && !casualty.activeBleeding) {
    casualty.recoveryStatus = "stabilizing";
  } else {
    casualty.recoveryStatus = "acute";
  }

  return {
    casualty,
    event: complication
      ? `${casualty.name} developed ${complication.replaceAll("-", " ")} on day ${day}.`
      : `${casualty.name} survived day ${day} and is ${casualty.recoveryStatus}.`,
    risks,
    mortalityRoll,
    complicationRoll,
  };
};

export const advanceAftermathDay = (sourceEncounter, { random = secureRandomUnit } = {}) => {
  const encounter = clone(sourceEncounter);
  if (encounter.currentDay >= encounter.maximumSimulatedDay) {
    return { accepted: false, reason: "seven-day-window-complete", encounter };
  }
  const day = encounter.currentDay + 1;
  const dailyEvents = [];
  encounter.casualties = encounter.casualties.map((sourceCasualty) => {
    const casualty = clone(sourceCasualty);
    const result = resolveDayOutcome(casualty, day, random);
    casualty.dayHistory = [
      ...(casualty.dayHistory || []),
      {
        day,
        dead: casualty.dead,
        recoveryStatus: casualty.recoveryStatus,
        recoveryProgress: casualty.recoveryProgress,
        shock: casualty.shock,
        infectionPressure: casualty.infectionPressure,
        activeBleeding: casualty.activeBleeding,
        complication: result.event?.includes("developed") ? casualty.complications.at(-1) : null,
        recordedAt: nowIso(),
      },
    ];
    casualty.lastUpdatedAt = nowIso();
    if (result.event) dailyEvents.push({ casualtyId: casualty.casualtyId, message: result.event });
    return casualty;
  });
  encounter.currentDay = day;
  encounter.phase = day >= encounter.maximumSimulatedDay ? "first-week-complete" : "infirmary";
  dailyEvents.forEach((event) => appendEncounterEvent(encounter, {
    type: "daily-recovery-check",
    casualtyId: event.casualtyId,
    message: event.message,
    day,
  }));
  return { accepted: true, encounter, day, events: dailyEvents };
};

export const updateCampaignEncounter = (campaign, encounterId, updater) => {
  const safeCampaign = campaign?.encounters ? clone(campaign) : createEmptyAftermathCampaign();
  const index = safeCampaign.encounters.findIndex((encounter) => encounter.encounterId === encounterId);
  if (index < 0) return safeCampaign;
  const updatedEncounter = updater(clone(safeCampaign.encounters[index]));
  safeCampaign.encounters[index] = updatedEncounter;
  safeCampaign.currentEncounterId = encounterId;
  safeCampaign.updatedAt = nowIso();
  return safeCampaign;
};

export const summarizeAftermathEncounter = (encounter) => {
  const casualties = encounter?.casualties || [];
  return {
    total: casualties.length,
    dead: casualties.filter((casualty) => casualty.dead).length,
    immediate: casualties.filter((casualty) => casualty.triage === "immediate" && !casualty.dead).length,
    delayed: casualties.filter((casualty) => casualty.triage === "delayed" && !casualty.dead).length,
    minimal: casualties.filter((casualty) => casualty.triage === "minimal" && !casualty.dead).length,
    prisoners: casualties.filter((casualty) => casualty.prisoner?.bound && !casualty.dead).length,
    untreatedBleeding: casualties.filter((casualty) => casualty.activeBleeding && !casualty.dead).length,
    infirmary: casualties.filter((casualty) => casualty.currentLocation === "field-infirmary" && !casualty.dead).length,
  };
};

export { AFTERMATH_SCHEMA_VERSION };
