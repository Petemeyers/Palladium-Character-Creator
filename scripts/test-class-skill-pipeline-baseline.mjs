import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const notes = [];

function moduleUrlFromSource(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}

function fileUrl(relativePath) {
  return pathToFileURL(resolve(repoRoot, relativePath)).href;
}

async function loadSkillSystem() {
  let source = await readFile(resolve(repoRoot, "src/utils/skillSystem.js"), "utf8");
  source = source.replace(
    /from\s+['"]\.\.\/data\/skillProgression['"]/g,
    `from ${JSON.stringify(fileUrl("src/data/skillProgression.js"))}`,
  );
  return import(moduleUrlFromSource(source));
}

async function loadSkillBonuses() {
  let source = await readFile(resolve(repoRoot, "src/data/skillBonuses.js"), "utf8");
  source = source.replace(
    /from\s+['"]\.\/skillProgression['"]/g,
    `from ${JSON.stringify(fileUrl("src/data/skillProgression.js"))}`,
  );
  return import(moduleUrlFromSource(source));
}

async function loadProfessionSkills(skillSystemUrl) {
  let source = await readFile(resolve(repoRoot, "src/utils/professionSkills.js"), "utf8");
  source = source.replace(
    /from\s+['"]\.\/skillSystem\.js['"]/g,
    `from ${JSON.stringify(skillSystemUrl)}`,
  );
  return import(moduleUrlFromSource(source));
}

async function loadProfessionSkillMapper(professionSkillsUrl) {
  let source = await readFile(resolve(repoRoot, "src/utils/professionSkillMapper.js"), "utf8");
  source = source.replace(
    /from\s+['"]\.\.\/data\/professionData\.js['"]/g,
    `from ${JSON.stringify(fileUrl("src/data/professionData.js"))}`,
  );
  source = source.replace(
    /from\s+['"]\.\/professionSkills\.js['"]/g,
    `from ${JSON.stringify(professionSkillsUrl)}`,
  );
  source = source.replace(
    /from\s+['"]\.\.\/data\/skillProgression\.js['"]/g,
    `from ${JSON.stringify(fileUrl("src/data/skillProgression.js"))}`,
  );
  return import(moduleUrlFromSource(source));
}

async function loadUnifiedAbilities(skillBonusesUrl) {
  let source = await readFile(resolve(repoRoot, "src/utils/unifiedAbilities.js"), "utf8");
  source = source.replace(
    /from\s+['"]\.\.\/data\/skillBonuses\.js['"]/g,
    `from ${JSON.stringify(skillBonusesUrl)}`,
  );
  return import(moduleUrlFromSource(source));
}

const skillProgression = await import(fileUrl("src/data/skillProgression.js"));
const savingThrows = await import(fileUrl("src/utils/savingThrowsSystem.js"));
const skillSystemUrl = moduleUrlFromSource(
  (await readFile(resolve(repoRoot, "src/utils/skillSystem.js"), "utf8")).replace(
    /from\s+['"]\.\.\/data\/skillProgression['"]/g,
    `from ${JSON.stringify(fileUrl("src/data/skillProgression.js"))}`,
  ),
);
const skillSystem = await import(skillSystemUrl);
const skillBonusesUrl = moduleUrlFromSource(
  (await readFile(resolve(repoRoot, "src/data/skillBonuses.js"), "utf8")).replace(
    /from\s+['"]\.\/skillProgression['"]/g,
    `from ${JSON.stringify(fileUrl("src/data/skillProgression.js"))}`,
  ),
);
const skillBonuses = await import(skillBonusesUrl);
const professionSkills = await loadProfessionSkills(skillSystemUrl);
const professionSkillMapper = await loadProfessionSkillMapper(
  moduleUrlFromSource(
    (await readFile(resolve(repoRoot, "src/utils/professionSkills.js"), "utf8")).replace(
      /from\s+['"]\.\/skillSystem\.js['"]/g,
      `from ${JSON.stringify(skillSystemUrl)}`,
    ),
  ),
);
const unifiedAbilities = await loadUnifiedAbilities(skillBonusesUrl);

function assertObjectKeys(object, keys) {
  for (const key of keys) {
    assert.equal(Object.prototype.hasOwnProperty.call(object, key), true, `missing key: ${key}`);
  }
}

function testExports() {
  assert.equal(typeof professionSkillMapper.mapPROFESSIONSkillsToCombat, "function");
  assert.equal(typeof professionSkillMapper.getAttacksPerMelee, "function");
  assert.equal(typeof professionSkillMapper.getProwlSkill, "function");
  assert.equal(typeof skillSystem.normalizeSkillName, "function");
  assert.equal(typeof skillSystem.getSkillPercentage, "function");
  assert.equal(typeof skillBonuses.calculateSkillBonuses, "function");
  assert.equal(typeof skillProgression.getSkillBonusesAtLevel, "function");
  assert.equal(typeof savingThrows.getPROFESSIONCategory, "function");
  assert.equal(typeof unifiedAbilities.getUnifiedAbilities, "function");
  assert.equal(typeof unifiedAbilities.getCombatBonus, "function");
}

function testProfessionClassSkillMapping() {
  const knight = professionSkillMapper.mapPROFESSIONSkillsToCombat({
    profession: "Knight",
    skills: { Prowl: 33, Track: 22 },
  });

  assertObjectKeys(knight, [
    "prowl",
    "track",
    "handToHand",
    "actionsPerRound",
    "horsemanship",
    "tactics",
    "trainingUser",
    "detectAmbush",
    "scaleWalls",
    "other",
  ]);
  assert.equal(knight.prowl, 33);
  assert.equal(knight.track, 22);
  assert.equal(knight.actionsPerRound, 1);
  assert.equal(knight.trainingUser, false);

  const unknown = professionSkillMapper.mapPROFESSIONSkillsToCombat({
    profession: "Unknown Class",
  });
  assert.equal(unknown.actionsPerRound, 1);
  assert.equal(unknown.prowl, 0);
  assert.equal(unknown.track, 0);

  assert.equal(professionSkillMapper.getProwlSkill({ profession: "Knight" }), 15);
  assert.equal(professionSkillMapper.getTrackSkill({ profession: "Knight" }), 20);
  assert.equal(professionSkillMapper.hasHorsemanship({ profession: "Knight" }), true);
  assert.equal(professionSkillMapper.getAttacksPerMelee({ actionsPerRound: 4 }), 4);
  assert.throws(() => professionSkillMapper.mapPROFESSIONSkillsToCombat(null), TypeError);
  notes.push("professionSkillMapper null input currently throws; baseline records this as existing behavior.");
}

function testSkillSystemBehavior() {
  assert.deepEqual(skillSystem.normalizeSkillName(""), {
    normalizedName: "",
    occBonus: 0,
    meta: {},
  });
  assert.deepEqual(skillSystem.normalizeSkillName("Scale Walls (+10%)"), {
    normalizedName: "Scale Walls",
    occBonus: 10,
    meta: {},
  });
  assert.deepEqual(skillSystem.normalizeSkillName("Speak Additional Languages (Knows 2) (+30%)"), {
    normalizedName: "Speak Additional Language",
    occBonus: 30,
    meta: { knows: 2 },
  });
  assert.equal(skillSystem.lookupSkill("Prowl", 1, 10)?.basePercentage, 18);
  assert.equal(skillSystem.lookupSkill("Unknown Legacy Skill", 1, 10), null);
  assert.equal(skillSystem.getSkillPercentage({ level: 1, IQ: 12 }, "Scale Walls (+10%)"), 0);
  assert.equal(skillSystem.getSkillPercentage({ level: 1, IQ: 12 }, ""), 0);
  assert.equal(skillSystem.hasSkill(null, "Prowl"), false);
  assert.equal(
    skillSystem.hasSkill(
      { professionSkills: ["Prowl"], electiveSkills: [], secondarySkills: [] },
      "Prowl",
    ),
    true,
  );
  assert.deepEqual(
    skillSystem.performSkillCheck(null, "Prowl", 0, () => 10),
    {
      success: false,
      roll: 0,
      skillValue: 0,
      total: 0,
      target: 0,
    },
  );
  assert.deepEqual(skillSystem.rollSkillCheck(40, 0, () => 41), {
    success: false,
    roll: 41,
    skillValue: 40,
    total: 41,
    target: 40,
    difficulty: 0,
    message: "Failure! Rolled 41 (needed 40 or less)",
  });
  notes.push("skillSystem normalize/lookup/percentage paths no longer throw on stale occBonus.");
}

function testSkillProgressionAndBonuses() {
  assert.deepEqual(skillProgression.getSkillBonusesAtLevel("Hand to Hand: Basic", 1), {
    bonuses: { attack: 0, block: 0, evade: 2, damage: 0, throwAttack: 0 },
    attacks: 1,
    specials: {},
  });
  assert.equal(skillProgression.getSkillPercentageAtLevel("Prowl", 1, 10), 18);
  assert.equal(skillProgression.getSecondarySkillBonus("Prowl"), 0);
  assert.equal(skillProgression.getWeaponRateOfFire("Weapon Training: Crossbow", 1), 0);
  assert.equal(skillProgression.getWeaponMaxRange("Weapon Training: Long Bow"), 0);

  const totals = skillBonuses.calculateSkillBonuses(
    ["Hand to Hand: Basic", "Weapon Training: Sword"],
    ["Detect Ambush"],
    [],
    1,
  );
  assert.equal(totals.attack, 0);
  assert.equal(totals.block, 0);
  assert.equal(totals.evade, 2);
  assert.equal(totals.damage, 0);
  assert.equal(totals.actionsPerRound, 1);
  assert.equal(totals.initiative, 1);
  assert.equal(totals.weaponProficiencies.length, 1);
  assert.equal(totals.weaponProficiencies[0].name, "Weapon Training: Sword");

  assert.equal(
    skillBonuses.inferWeaponProficiencyName({ name: "Long Sword", category: "sword" }),
    "Weapon Training: Large sword",
  );
  assert.deepEqual(
    skillBonuses.getWeaponProficiencyBonusesForWeapon(
      {
        weaponProficiencies: [
          {
            name: "Weapon Training: Long Sword",
            bonuses: { attack: 1, block: 1, throwAttack: 0 },
            specials: {},
          },
        ],
      },
      { name: "Long Sword", category: "sword" },
    ),
    { attack: 0, block: 0, throwAttack: 0, rateOfFire: null, proficient: false },
  );
  assert.deepEqual(
    skillBonuses.getWeaponProficiencyBonusesForWeapon({}, { name: "Mystery", category: "bow" }),
    { attack: 0, block: 0, throwAttack: 0, rateOfFire: 1, proficient: false },
  );
}

function testProfessionSkillsTables() {
  assert.equal(professionSkills.professionSkillTables.Knight.horsemanship, 40);
  assert.equal(professionSkills.iqBonus(16), 5);
  assert.equal(professionSkills.ppBonus(20), 7);
  assert.equal(professionSkills.meBonus(16), 5);

  const knightSkills = professionSkills.buildSkillSet("Knight", 16, 12, 12, 1);
  assert.equal(typeof knightSkills, "object");
  assert.equal(Object.keys(knightSkills).length > 0, true);
  notes.push("professionSkills.buildSkillSet no longer inherits the stale occBonus ReferenceError.");
}

function testSavingThrowsBehavior() {
  assert.deepEqual(savingThrows.BASE_SAVES, {
    training: 12,
    tactics: 15,
    poison: 14,
    horror: 12,
  });
  assert.equal(savingThrows.getLevelSaveBonus(1), 0);
  assert.equal(savingThrows.getLevelSaveBonus(5), 3);
  assert.equal(savingThrows.getLevelSaveBonus(10), 4);
  assert.equal(savingThrows.getLevelSaveBonus(15), 5);
  assert.equal(savingThrows.getPROFESSIONCategory({ profession: "Knight" }), "Human Arms");
  assert.equal(savingThrows.getPROFESSIONCategory({ profession: "Unknown" }), "Men of Arms");
  assert.equal(savingThrows.getPsychicLevel({ profession: "Knight" }), "none");
  assert.equal(savingThrows.getPsychicLevel({ profession: "Knight", focus: 1 }), "minor");

  assert.throws(() => savingThrows.getPROFESSIONCategory({ profession: "Tactician" }), ReferenceError);
  assert.throws(
    () =>
      savingThrows.rollSavingThrow({
        character: { name: "Test Knight", profession: "Knight", attributes: { PE: 12 }, level: 1 },
        type: "training",
        log: () => {},
      }),
    ReferenceError,
  );
  notes.push(
    "savingThrowsSystem exported rollSavingThrow/saveVs* paths currently hit stale variable references; baseline records the throw instead of changing code.",
  );
}

function testUnifiedAbilitiesBehavior() {
  assert.deepEqual(unifiedAbilities.ABILITY_TYPES, {
    TRAINING: "training",
    TACTICAL: "tactical",
    SPECIAL: "special",
    RACIAL: "racial",
  });
  assert.equal(unifiedAbilities.activateAbility({ name: "Brace" }, { name: "Knight" }, null), true);
  assert.equal(unifiedAbilities.activateAbility(null, { name: "Knight" }, null), false);
  assert.equal(unifiedAbilities.hasResources({ stamina: 0 }, { cost: 100 }), true);
  assert.deepEqual(unifiedAbilities.getAvailableAbilities({}), []);
  assert.deepEqual(
    unifiedAbilities.getUnifiedAbilities({
      training: [{ name: "Brace" }],
      tacticalOptions: [{ name: "Feint" }],
      specialAbilities: [{ name: "Veteran" }],
    }),
    {
      training: [{ name: "Brace", type: "training" }],
      tactical: [{ name: "Feint", type: "tactical" }],
      special: [{ name: "Veteran", type: "special" }],
      racial: [],
    },
  );

  assert.equal(unifiedAbilities.castTechnique({ name: "Knight" }, null, { name: "Brace" }), true);
  assert.equal(unifiedAbilities.castTechnique(null, null, { name: "Brace" }), false);
  assert.equal(
    unifiedAbilities.getCombatBonus(
      {
        skillBonuses: {
          weaponProficiencies: [
            {
              name: "Weapon Training: Long Sword",
              bonuses: { attack: 1, block: 1, throwAttack: 0 },
              specials: {},
            },
          ],
        },
      },
      "attack",
      { name: "Long Sword", category: "sword" },
    ),
    0,
  );
  assert.equal(unifiedAbilities.getCombatBonus({ attributes: { PP: 16 } }, "attack"), 1);
  assert.equal(unifiedAbilities.getCombatBonus({ attributes: { PS: 16 } }, "damage"), 1);
}

testExports();
testProfessionClassSkillMapping();
testSkillSystemBehavior();
testSkillProgressionAndBonuses();
testProfessionSkillsTables();
testSavingThrowsBehavior();
testUnifiedAbilitiesBehavior();

console.log("Class/skill/save pipeline baseline tests passed.");
console.log("Covered modules:");
console.log("- professionSkillMapper: combat skill mapping, skill lookups, action mapping fallback");
console.log("- skillSystem: name normalization, lookup, percentage checks, percentile check shape");
console.log("- skillProgression: skill percentages, combat bonuses, weapon rate/range helpers");
console.log("- skillBonuses: aggregate bonuses and weapon training inference");
console.log("- professionSkills: profession skill tables and legacy stat modifier helpers");
console.log("- savingThrowsSystem: constants, category/level helpers, current stale throw behavior");
console.log("- unifiedAbilities: ability shape, resources, technique wrapper, combat bonus lookup");
if (notes.length) {
  console.log("Notes:");
  for (const note of notes) {
    console.log(`- ${note}`);
  }
}
