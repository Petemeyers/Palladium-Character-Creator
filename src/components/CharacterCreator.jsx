import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import '../app.css';
import '../styles/CharacterCreation.css';
import { Alert, AlertIcon, Button } from '@chakra-ui/react';
import tactics from '../data/tactics.json';
import {
  speciesData,
  socialBackgrounds,
  dispositions,
  hostilities,
  landsOfOrigin,
  getBonus,
  characterClasses,
  getAvailableClasses,
  speciesCharacteristics
} from './data.jsx';
import {
  rollDice,
  calculateAttributeRolls,
  determineCharacterAge,
  rollFromTable,
  evaluateDice,
  applyBonus,
} from './util';
import gameData from "../data/originalGameData.js";
import clothingEquipmentData from "../data/clothingEquipment.json";
import traderEquipment from "../data/traderEquipment.js";
import TacticsRoll from './TacticsRoll';
import DiceLoadingSpinner from './DiceLoadingSpinner';
// import D20LoadingSpinner from './D20LoadingSpinner'; // Temporarily disabled
import { getStatsForLevel } from '../utils/levelProgression';
import { getRandomName } from '../data/characterNames';
import { professionSkillTables } from '../utils/professionSkills';
import { lookupSkill, getSkillPercentage } from '../utils/skillSystem';
import { getSkillBonusesAtLevel } from '../data/skillProgression';
import { skillBonuses as staticSkillBonuses, calculateSkillBonuses } from '../data/skillBonuses';
import { BASE_SAVES, PROFESSION_SAVE_MODIFIERS, getLevelSaveBonus } from '../utils/savingThrowsSystem';
import { PROFESSIONS, ELECTIVE_SKILLS, SECONDARY_SKILLS } from '../data/professionData';
import {
  calculateAbilityModifier,
  calculateBackgroundAbilityBonuses,
  calculateFinalAbilityScores,
  convertPublicScoresToLegacyAttributes,
  getPointCostTotal,
  POINT_COSTS,
  PUBLIC_ABILITIES,
  rollRandomAbilityScores,
  STANDARD_ARRAY_SCORES,
} from '../utils/publicAbilityScores.js';
import {
  getPublicBackgroundById,
  getPublicBackgrounds,
  getPublicClassById,
  getPublicClasses,
  getPublicSkillById,
} from '../utils/publicClassAdapter.js';
import {
  getPublicAlignments,
  getPublicLanguageById,
  getPublicLanguages,
  getPublicSpecies,
  getPublicSpeciesById,
} from '../utils/publicSpeciesAdapter.js';
import { calculatePublicDerivedStats, formatSignedModifier } from '../utils/publicDerivedStats.js';
import {
  DUELIST_COMMON_TECHNIQUE_NAMES,
  normalizeTechniqueName,
  isDuelistClassName,
  getDuelistTechniqueProgression,
  getDuelistEligibleTechniques,
  buildDuelistTechniqueBookForLevel,
  createDeterministicRng,
  normalizestaminaState,
} from '../utils/techniqueUtils.js';
import HumanPreviewPanel from './creator/HumanPreviewPanel.jsx';
import { buildHumanVisualProfile } from '../utils/visuals/buildHumanVisualProfile.js';
import { saveCharacterWithAuth } from '../utils/characterSave.js';

const PUBLIC_CLASS_COMPATIBILITY_KEYS = {
  barbarian: "Brigand",
  bard: "Squire",
  cleric: "Squire",
  druid: "Longbowman",
  fighter: "Knight",
  monk: "Brigand",
  paladin: "Man-at-Arms",
  ranger: "Longbowman",
  rogue: "Brigand",
  sorcerer: "Squire",
  warlock: "Squire",
  wizard: "Squire",
};

const PUBLIC_SPECIES_COMPATIBILITY_KEYS = {
  dragonborn: "HUMAN",
  dwarf: "HUMAN",
  elf: "HUMAN",
  gnome: "HUMAN",
  goliath: "HUMAN",
  halfling: "HUMAN",
  human: "HUMAN",
  orc: "HUMAN",
  tiefling: "HUMAN",
};

// Function to get Tactician tactics based on level and tactical type
const getMindMageTactics = async (tacticalResult, level) => {
  const powers = [];
  
  // Master tactics get all powers, Major tactics limited to levels 1-3, Minor to level 1 only
  const tacticalLevel = tacticalResult === "Master Tactical" ? "Master" : 
                       tacticalResult === "Major Tactical" ? "Major" : "Minor";
  
  // Level 1: 6 total powers (2 Physical + 2 Sensitive + 2 Healing)
  if (level >= 1) {
    const physicalPowers = tactics.filter(p => p.category === "Physical").slice(0, 2);
    const sensitivePowers = tactics.filter(p => p.category === "Sensitive").slice(0, 2);
    const healingPowers = tactics.filter(p => p.category === "Healing").slice(0, 2);
    
    powers.push(...physicalPowers, ...sensitivePowers, ...healingPowers);
  }
  
  // Level 2: +1 Physical + 1 Sensitive
  if (level >= 2 && tacticalLevel !== "Minor") {
    const additionalPhysical = tactics.filter(p => p.category === "Physical")[2];
    const additionalSensitive = tactics.filter(p => p.category === "Sensitive")[2];
    if (additionalPhysical) powers.push(additionalPhysical);
    if (additionalSensitive) powers.push(additionalSensitive);
  }
  
  // Level 3: +1 Healing + 1 Super
  if (level >= 3 && tacticalLevel !== "Minor") {
    const additionalHealing = tactics.filter(p => p.category === "Healing")[2];
    const firstSuper = tactics.filter(p => p.category === "Super")[0];
    if (additionalHealing) powers.push(additionalHealing);
    if (firstSuper) powers.push(firstSuper);
  }
  
  // Levels 4-5: +1 Super each level
  if (level >= 4 && tacticalLevel !== "Minor") {
    const superPowers = tactics.filter(p => p.category === "Super");
    for (let i = 1; i < Math.min(level - 2, superPowers.length); i++) {
      if (superPowers[i]) powers.push(superPowers[i]);
    }
  }
  
  // Level 6+: Master tactics automatically know all remaining lower powers
  if (level >= 6 && tacticalLevel === "Master") {
    const remainingPowers = tactics.filter(p => !powers.includes(p));
    powers.push(...remainingPowers);
  }
  
  return powers;
};

const CharacterCreator = ({ onCreateCharacter }) => {
  const navigate = useNavigate();
  const [species, setSpecies] = useState('HUMAN');
  const [publicSpeciesId, setPublicSpeciesId] = useState('human');
  const [attributes, setAttributes] = useState({});
  const [level, setLevel] = useState('1');
  const [hp, setHp] = useState(null);
  const [alignment, setAlignment] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [age, setAge] = useState('');
  const [socialBackground, setSocialBackground] = useState('');
  const [publicBackgroundId, setPublicBackgroundId] = useState('soldier');
  const [disposition, setDisposition] = useState('');
  const [hostility, setHostility] = useState('');
  const [origin, setOrigin] = useState('');
  const [bonusRolled, setBonusRolled] = useState(false);
  const [useCryptoRandom, setUseCryptoRandom] = useState(false);
  const [characterClass, setCharacterClass] = useState('');
  const [publicClassId, setPublicClassId] = useState('');
  const [selectedClassEquipmentOptionId, setSelectedClassEquipmentOptionId] = useState('');
  const [selectedPublicSkillIds, setSelectedPublicSkillIds] = useState([]);
  const [selectedPublicLanguageIds, setSelectedPublicLanguageIds] = useState([]);
  const [abilityScoreMethod, setAbilityScoreMethod] = useState('standard-array');
  const [generatedAbilityScores, setGeneratedAbilityScores] = useState(STANDARD_ARRAY_SCORES);
  const [abilityAssignments, setAbilityAssignments] = useState({});
  const [backgroundAbilityMode, setBackgroundAbilityMode] = useState('split');
  const [backgroundPlusTwoAbility, setBackgroundPlusTwoAbility] = useState('');
  const [backgroundPlusOneAbility, setBackgroundPlusOneAbility] = useState('');
  const [availableClasses, setAvailableClasses] = useState([]);
  const [filteredClasses, setFilteredClasses] = useState([]);
  const [tactics, setTactics] = useState(null);
  const [professionSkills, setProfessionSkills] = useState([]);
  const [electiveSkills, setElectiveSkills] = useState([]);
  const [secondarySkills, setSecondarySkills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pendingCharacter, setPendingCharacter] = useState(null);
  const [saveMessage, setSaveMessage] = useState(null);
  const [attributesRolled, setAttributesRolled] = useState(false);
  const [autoRollEnabled, setAutoRollEnabled] = useState(false);
  const [minTotalValue, setMinTotalValue] = useState(70); // Default minimum total
  const [isAutoRolling, setIsAutoRolling] = useState(false);
  const [gender, setGender] = useState('Male');
  // const [isRolling, setIsRolling] = useState(false); // Temporarily disabled
  // const [rollType, setRollType] = useState(''); // Temporarily disabled
  const [professionData, setProfessionData] = useState(null);
  const [useDeterministicHP, setUseDeterministicHP] = useState(true);
  const [previousLevel, setPreviousLevel] = useState(1); // Track previous level for skill gains
  const [showSkillSelectionModal, setShowSkillSelectionModal] = useState(false);
  const [pendingLevelChange, setPendingLevelChange] = useState(null); // Store pending level change
  const [pendingSkillSelections, setPendingSkillSelections] = useState({
    elective: { count: 0, selected: [] },
    secondary: { count: 0, selected: [] }
  });
  const [, setVisualProfile] = useState(null);
  const publicSpeciesOptions = useMemo(() => getPublicSpecies(), []);
  const publicAlignmentOptions = useMemo(() => getPublicAlignments(), []);
  const publicLanguageOptions = useMemo(() => getPublicLanguages(), []);
  const selectedPublicSpecies = useMemo(
    () => getPublicSpeciesById(publicSpeciesId) || getPublicSpeciesById('human'),
    [publicSpeciesId]
  );
  const selectedPublicLanguages = useMemo(() => {
    const common = getPublicLanguageById('common');
    const choices = selectedPublicLanguageIds
      .map((languageId) => getPublicLanguageById(languageId))
      .filter(Boolean);

    return [common, ...choices].filter(Boolean);
  }, [selectedPublicLanguageIds]);
  const publicClasses = useMemo(() => getPublicClasses(), []);
  const selectedPublicClass = useMemo(
    () => getPublicClassById(publicClassId),
    [publicClassId]
  );
  const publicBackgrounds = useMemo(() => getPublicBackgrounds(), []);
  const selectedPublicBackground = useMemo(
    () => getPublicBackgroundById(publicBackgroundId) || getPublicBackgroundById('soldier'),
    [publicBackgroundId]
  );
  const classEquipmentOptions = selectedPublicClass?.startingEquipmentOptions || [];
  const selectedClassEquipmentOption = useMemo(() => {
    return (
      classEquipmentOptions.find((option) => option.id === selectedClassEquipmentOptionId) ||
      classEquipmentOptions[0] ||
      null
    );
  }, [classEquipmentOptions, selectedClassEquipmentOptionId]);
  const backgroundEquipmentTags = useMemo(
    () => selectedPublicBackground?.startingEquipmentTags || selectedPublicBackground?.equipmentTags || [],
    [selectedPublicBackground]
  );
  const startingGold = selectedClassEquipmentOption?.gold || 0;
  const publicStartingEquipment = useMemo(
    () => ({
      classOption: selectedClassEquipmentOption
        ? {
            id: selectedClassEquipmentOption.id,
            label: selectedClassEquipmentOption.label,
            items: selectedClassEquipmentOption.items || [],
            gold: selectedClassEquipmentOption.gold || 0,
          }
        : null,
      backgroundTags: backgroundEquipmentTags,
      startingGold,
    }),
    [backgroundEquipmentTags, selectedClassEquipmentOption, startingGold]
  );
  const publicSkillSuggestions = useMemo(() => {
    const fixedSkillIds = selectedPublicClass?.fixedSkills || [];
    const choiceSkillIds = selectedPublicClass?.skillChoices?.from || [];
    const backgroundSkillIds = selectedPublicBackground?.skillProficiencies || [];
    const formatSkill = (skillId) => {
      const skill = getPublicSkillById(skillId);
      return {
        id: skillId,
        name: skill?.name || skillId,
        ability: skill?.ability || '',
        description: skill?.description || '',
      };
    };

    return {
      fixed: fixedSkillIds.map(formatSkill),
      choices: choiceSkillIds.map(formatSkill),
      choiceCount: selectedPublicClass?.skillChoices?.choose || 0,
      background: backgroundSkillIds.map(formatSkill),
      proficiencyIds: [...new Set([...fixedSkillIds, ...backgroundSkillIds])],
      choiceIds: [...new Set(choiceSkillIds)],
    };
  }, [selectedPublicClass, selectedPublicBackground]);
  const publicSkillMetadata = useMemo(() => {
    const validSelectedChoices = selectedPublicSkillIds.filter((skillId) =>
      publicSkillSuggestions.choiceIds.includes(skillId)
    );

    return {
      proficiencies: [...new Set([...publicSkillSuggestions.proficiencyIds, ...validSelectedChoices])],
      choices: [...new Set(validSelectedChoices)],
    };
  }, [publicSkillSuggestions.choiceIds, publicSkillSuggestions.proficiencyIds, selectedPublicSkillIds]);
  const backgroundAbilityOptions = selectedPublicBackground?.abilityScoreOptions || [];
  const assignedScoreIndexes = useMemo(
    () => new Set(Object.values(abilityAssignments).filter((value) => value !== '')),
    [abilityAssignments]
  );
  const baseAbilityScores = useMemo(() => {
    return PUBLIC_ABILITIES.reduce((acc, ability) => {
      const scoreIndex = abilityAssignments[ability.id];
      const score = generatedAbilityScores[Number(scoreIndex)];
      if (score !== undefined) {
        acc[ability.id] = score;
      }
      return acc;
    }, {});
  }, [abilityAssignments, generatedAbilityScores]);
  const backgroundAbilityBonuses = useMemo(
    () => calculateBackgroundAbilityBonuses({
      mode: backgroundAbilityMode,
      options: backgroundAbilityOptions,
      plusTwoAbility: backgroundPlusTwoAbility,
      plusOneAbility: backgroundPlusOneAbility,
    }),
    [backgroundAbilityMode, backgroundAbilityOptions, backgroundPlusOneAbility, backgroundPlusTwoAbility]
  );
  const finalAbilityScores = useMemo(
    () => calculateFinalAbilityScores(baseAbilityScores, backgroundAbilityBonuses),
    [backgroundAbilityBonuses, baseAbilityScores]
  );
  const abilityModifiers = useMemo(() => {
    return PUBLIC_ABILITIES.reduce((acc, ability) => {
      if (finalAbilityScores[ability.id] !== undefined) {
        acc[ability.id] = calculateAbilityModifier(finalAbilityScores[ability.id]);
      }
      return acc;
    }, {});
  }, [finalAbilityScores]);
  const publicDerivedStats = useMemo(
    () => calculatePublicDerivedStats({
      level,
      publicClassId,
      publicClassName: selectedPublicClass?.name,
      finalAbilityScores,
      abilityModifiers,
      publicSkillProficiencies: publicSkillMetadata.proficiencies,
    }),
    [abilityModifiers, finalAbilityScores, level, publicClassId, publicSkillMetadata.proficiencies, selectedPublicClass]
  );
  const allPublicAbilitiesAssigned = PUBLIC_ABILITIES.every((ability) => baseAbilityScores[ability.id] !== undefined);
  const pointCostTotal = getPointCostTotal(baseAbilityScores);

  useEffect(() => {
    setSelectedPublicSkillIds((current) =>
      current.filter((skillId) => publicSkillSuggestions.choiceIds.includes(skillId))
    );
  }, [publicSkillSuggestions.choiceIds]);

  useEffect(() => {
    setSelectedClassEquipmentOptionId((current) => {
      if (classEquipmentOptions.some((option) => option.id === current)) {
        return current;
      }
      return classEquipmentOptions[0]?.id || '';
    });
  }, [classEquipmentOptions]);

  useEffect(() => {
    setBackgroundPlusTwoAbility((current) =>
      backgroundAbilityOptions.includes(current) ? current : ''
    );
    setBackgroundPlusOneAbility((current) =>
      backgroundAbilityOptions.includes(current) ? current : ''
    );
  }, [backgroundAbilityOptions]);

  useEffect(() => {
    if (!allPublicAbilitiesAssigned) {
      setAttributes({});
      setAttributesRolled(false);
      setHp(null);
      return;
    }

    setAttributes(convertPublicScoresToLegacyAttributes(finalAbilityScores));
    setAttributesRolled(true);
    setBonusRolled(false);
  }, [allPublicAbilitiesAssigned, finalAbilityScores]);

  const togglePublicSkillChoice = (skillId) => {
    setSelectedPublicSkillIds((current) => {
      if (current.includes(skillId)) {
        return current.filter((id) => id !== skillId);
      }

      const choiceLimit = publicSkillSuggestions.choiceCount;
      if (choiceLimit > 0 && current.length >= choiceLimit) {
        return current;
      }

      return [...current, skillId];
    });
  };

  const humanStatsForVisuals = useMemo(() => {
    const ageNum = Number(age);
    const normalizedAge = Number.isFinite(ageNum) ? ageNum : 25;

    return {
      PS: Number(attributes.PS) || 10,
      PP: Number(attributes.PP) || 10,
      PE: Number(attributes.PE) || 10,
      PB: Number(attributes.PB) || 10,
      MA: Number(attributes.MA) || 10,
      ME: Number(attributes.ME) || 10,
      Spd: Number(attributes.Spd) || 10,
      age: normalizedAge,
    };
  }, [attributes.MA, attributes.ME, attributes.PB, attributes.PE, attributes.PP, attributes.PS, attributes.Spd, age]);

  // ---------------------------
  // STRICT Duelist technique selection (Medieval Combat Simulator style)
  // ---------------------------

  const isStrictDuelist = (professionName) => isDuelistClassName(professionName);

  const [duelistTechniquePicks, setDuelistTechniquePicks] = useState({ 1: [] });

  const [duelistTechniqueSearch, setDuelistTechniqueSearch] = useState('');
  
  // Level-based stats
  const [levelStats, setLevelStats] = useState({
    hp: null,
    actionsPerRound: 2,
    saves: { vsTraining: 14, vsPoison: 14, vsTactics: 15 },
    combatBonuses: { attack: 0, block: 0, evade: 0, damage: 0 },
    stamina: 0,
    focus: 0,
    skillIncreases: { elective: 0, secondary: 0 }
  });

  // Recalculate stats when level or class changes
  useEffect(() => {
    // Calculate HP even if profession isn't selected yet (use defaults)
    if (level && attributes.PE) {
      const peBonus = Math.floor((attributes.PE || 0) / 4);
      const currentLevel = parseInt(level) || 1;
      
      let calculatedHP = hp;
      if (useDeterministicHP && professionData) {
        // Calculate deterministic HP for character creator (only if profession is selected)
        calculatedHP = calculateCreatorHP(currentLevel, peBonus, hp);
      } else if (useDeterministicHP && !professionData) {
        // If no profession selected, use simple calculation: base HP + (level-1) * 8 + PE bonus
        const baseHP = 20;
        const hpPerLevel = 8; // Default
        calculatedHP = baseHP + (currentLevel - 1) * hpPerLevel + (peBonus * currentLevel);
      } else if (!useDeterministicHP) {
        // Use rolled HP if available, otherwise calculate
        calculatedHP = hp || (20 + (currentLevel - 1) * 8 + (peBonus * currentLevel));
      }
      
      // Only call getStatsForLevel if professionData exists
      let stats = {};
      if (professionData) {
        stats = getStatsForLevel(
          professionData,
          currentLevel,
          attributes,
          calculatedHP,
          tactics?.stamina || 0,
          tactics?.focus || 0,
          professionSkills,
          electiveSkills,
          secondarySkills
        ) || {};
      }
      
      // Calculate skill bonuses
      const skillBonuses = calculateSkillBonuses(
        professionSkills || [],
        electiveSkills || [],
        secondarySkills || [],
        currentLevel
      );
      
      // Calculate Save vs dreadRating
      const professionCategory = professionData?.category || "Men of Arms";
      const baseHorrorSave = BASE_SAVES.horror || 12;
      const professionHorrorMod = PROFESSION_SAVE_MODIFIERS[professionCategory]?.horror || 0;
      const levelHorrorBonus = getLevelSaveBonus(currentLevel);
      const peHorrorBonus = Math.floor((attributes.PE || 0) / 2) - 5; // PE bonus: (PE-10)/2
      const courageCheck = baseHorrorSave - professionHorrorMod - levelHorrorBonus - peHorrorBonus;
      
      // Get combat mods from race and profession
      const raceData = species ? (gameData.races?.[species] || null) : null;
      const raceCombatMods = raceData?.combatMods || { damage: 0, initiative: 0, speedBonus: 0 };
      const professionCombatMods = professionData?.combatMods || { damage: 0, initiative: 0, speedBonus: 0 };
      const totalInitiativeBonus = (skillBonuses.initiative || 0) + (raceCombatMods.initiative || 0) + (professionCombatMods.initiative || 0);
      const totalSpeedBonus = (raceCombatMods.speedBonus || 0) + (professionCombatMods.speedBonus || 0);
      
      // Ensure all required properties exist by merging with defaults
      setLevelStats({
        // Defaults
        actionsPerRound: 2,
        combatBonuses: { attack: 0, block: 0, evade: 0, damage: 0 },
        skillIncreases: { elective: 0, secondary: 0 },
        // Override with stats from getStatsForLevel
        ...stats,
        // Override with calculated values (these take precedence)
        hp: calculatedHP || stats?.hp || null,
        saves: {
          ...(stats?.saves || { vsTraining: 14, vsPoison: 14, vsTactics: 15 }),
          courageCheck: courageCheck
        },
        skillBonuses: skillBonuses,
        initiativeBonus: totalInitiativeBonus,
        speedBonus: totalSpeedBonus,
        focusBonus: skillBonuses.focusBonus || 0,
        focusRecovery: skillBonuses.focusRecovery || 1,
        stamina: stats?.stamina || tactics?.stamina || 0,
        focus: stats?.focus || tactics?.focus || 0,
      });
    } else if (Object.keys(attributes).length === 0) {
      // Reset levelStats if no attributes are rolled yet
      setLevelStats({
        hp: null,
        actionsPerRound: 2,
        saves: { vsTraining: 14, vsPoison: 14, vsTactics: 15, courageCheck: 12 },
        combatBonuses: { attack: 0, block: 0, evade: 0, damage: 0 },
        stamina: 0,
        focus: 0,
        skillIncreases: { elective: 0, secondary: 0 },
        skillBonuses: { attack: 0, block: 0, evade: 0, damage: 0, initiative: 0, focusBonus: 0, focusRecovery: 1, actionsPerRound: 0, weaponProficiencies: [] },
        initiativeBonus: 0,
        speedBonus: 0,
        focusBonus: 0,
        focusRecovery: 1,
      });
    }
  }, [level, professionData, attributes, hp, tactics, professionSkills, electiveSkills, secondarySkills, useDeterministicHP]);

  useEffect(() => {
    if (!isStrictDuelist(characterClass)) {
      setDuelistTechniquePicks({ 1: [] });
      setDuelistTechniqueSearch('');
    }
  }, [characterClass]);

  useEffect(() => {
    if (!isStrictDuelist(characterClass)) return;
    const all = getAllTechniquesFromDataset();
    const eligible = getDuelistEligibleTechniques(all, Number(level) || 1);
    const eligibleNames = new Set(eligible.map((sp) => normalizeTechniqueName(sp?.name)));
    const cap = getDuelistTechniqueProgression(Number(level) || 1).requiredPickCount;

    setDuelistTechniquePicks((prev) => {
      const current = prev[1] || [];
      const filtered = current
        .filter((nm) => eligibleNames.has(normalizeTechniqueName(nm)))
        .slice(0, cap);
      if (filtered.length === current.length && filtered.every((nm, i) => nm === current[i])) {
        return prev;
      }
      return { ...prev, 1: filtered };
    });
  }, [characterClass, level]);

  useEffect(() => {
    if (!isStrictDuelist(characterClass)) return;
    const all = getAllTechniquesFromDataset();
    const missing = DUELIST_COMMON_TECHNIQUE_NAMES.filter(
      (nm) => !all.some((sp) => normalizeTechniqueName(sp?.name) === normalizeTechniqueName(nm))
    );
    if (missing.length) {
      console.warn('Duelist common techniques missing from dataset keys:', missing);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterClass]);

  const handleAutoRoll = async () => {
    setIsAutoRolling(true);
    let currentTotal = 0;
    let rollCount = 0;
    const maxRolls = 10000; // Safety limit to prevent infinite loops

    while (currentTotal <= minTotalValue && rollCount < maxRolls) {
      const diceRolls = speciesData[species];
      if (diceRolls) {
        const results = calculateAttributeRolls(diceRolls, useCryptoRandom);
        const updatedAttributes = {};
        let totalSum = 0;
        
        Object.keys(results).forEach((attr) => {
          updatedAttributes[attr] = results[attr];
          const dice = diceRolls[attr];
          updatedAttributes[`${attr}_highlight`] = getHighlightColor(
            results[attr],
            dice
          );
          
          totalSum += results[attr];
        });
        
        updatedAttributes.total = totalSum;
        currentTotal = totalSum;
        
        setAttributes(updatedAttributes);
        setBonusRolled(false);
        
        // Add a small delay to prevent browser freezing
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      rollCount++;
    }
    
    setIsAutoRolling(true);
    setAttributesRolled(true);
    
    if (rollCount >= maxRolls) {
      alert('Maximum roll attempts reached. Please try again or adjust your minimum total.');
    }
  };

  const regenerateAttributes = async () => {
    setLoading(true);
    try {
      if (autoRollEnabled) {
        await handleAutoRoll();
      } else {
        // Original roll logic
        const diceRolls = speciesData[species];
        if (diceRolls) {
          const results = calculateAttributeRolls(diceRolls, useCryptoRandom);
          const updatedAttributes = {};
          let totalSum = 0;
          
          Object.keys(results).forEach((attr) => {
            updatedAttributes[attr] = results[attr];
            const dice = diceRolls[attr];
            updatedAttributes[`${attr}_highlight`] = getHighlightColor(
              results[attr],
              dice
            );
            
            totalSum += results[attr];
          });
          
          updatedAttributes.total = totalSum;
          
          setAttributes(updatedAttributes);
          setBonusRolled(false);
          setAttributesRolled(true);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const getHighlightColor = (attrValue, diceRoll) => {
    const [numDice] = diceRoll.split('d').map(Number);
    // Bonus die rule (Medieval Combat Simulator): only 3d6 rolls of 17-18, or 2d6 rolls of 12.
    // No bonus die for 4d6/5d6 attributes.
    if (diceRoll.startsWith('3d6') && (attrValue === 17 || attrValue === 18)) {
      return 'green';
    } else if (diceRoll.startsWith('2d6') && attrValue === 12) {
      return 'green';
    }
    return '';
  };

  const rollBonus = () => {
    console.log('Roll bonus clicked, bonusRolled:', bonusRolled);
    if (bonusRolled || Object.keys(attributes).length === 0) {
      console.log('Roll bonus blocked - already rolled or no attributes');
      return;
    }
    
    const updatedAttributes = { ...attributes };
    let totalSum = 0;
    let bonusesApplied = 0;
    
    Object.entries(attributes)
      .filter(([key]) => !key.endsWith('_highlight') && key !== 'total')
      .forEach(([attr, value]) => {
        const diceRoll = speciesData[species][attr];
        const highlight = attributes[`${attr}_highlight`];
        
        let newValue = value;
        // Apply bonus die only when the base roll qualified (green highlight),
        // and never for 4d6/5d6 attributes.
        if (attr !== 'Spd' && highlight === 'green') {
          const bonusRoll = rollDice(6, 1, useCryptoRandom);
          newValue += bonusRoll;
          bonusesApplied++;
          console.log(`Bonus applied to ${attr}: +${bonusRoll} (${value} -> ${newValue})`);
          // Update the highlight based on new value
          updatedAttributes[attr] = newValue;
          updatedAttributes[`${attr}_highlight`] = getHighlightColor(
            newValue,
            diceRoll
          );
        }
        totalSum += newValue;
      });

    // Update total
    updatedAttributes.total = totalSum;
    
    console.log(`Roll bonus complete: ${bonusesApplied} bonuses applied, setting bonusRolled to true`);
    setAttributes(updatedAttributes);
    setBonusRolled(true);
  };

  const rollHP = () => {
    if (hp !== null) return; // Prevent re-rolling
    const baseHP = 10;
    const hpRoll = rollDice(6, 1);
    const totalHP = baseHP + hpRoll;
    setHp(totalHP);
    console.log('Rolled HP:', totalHP);
  };

  // Calculate HP for character creator (deterministic, not random)
  const calculateCreatorHP = (level, peBonus = 0, baseHP = null) => {
    if (!professionData) return baseHP || 10;
    
    const progression = professionData.category ? 
      gameData.levelProgression[professionData.category] : null;
    
    if (!progression) return baseHP || 10;

    // Use average values instead of rolling dice
    const averageHPPerLevel = getAverageRoll(progression.hpPerLevel);
    
    // Calculate total HP deterministically
    let totalHP = baseHP || averageHPPerLevel;
    
    // Add HP for each additional level (using average values)
    for (let lvl = 2; lvl <= level; lvl++) {
      totalHP += averageHPPerLevel;
    }
    
    // Add PE bonus per level
    totalHP += peBonus * level;
    
    return Math.max(1, Math.round(totalHP));
  };

  // Helper function to calculate average roll for dice notation
  const getAverageRoll = (diceNotation) => {
    if (!diceNotation) return 3.5; // Default average for 1d6
    
    const [numDice, diceSize] = diceNotation.split('d').map(Number);
    const averagePerDie = (diceSize + 1) / 2;
    return numDice * averagePerDie;
  };

  // Generate starting clothing based on race (1994 Medieval Combat Simulator)
  const generateStartingClothing = (race) => {
    const raceKey = race.charAt(0).toUpperCase() + race.slice(1).toLowerCase();
    const raceClothing = clothingEquipmentData.raceClothing[raceKey];
    
    // Use basic clothing items from traderEquipment for starting gear
    const basicClothing = {
      head: traderEquipment.head.find(item => item.type === "clothing") || traderEquipment.head[0],
      torso: traderEquipment.torso.find(item => item.type === "clothing") || traderEquipment.torso[0],
      legs: traderEquipment.legs.find(item => item.type === "clothing") || traderEquipment.legs[0],
      feet: traderEquipment.feet.find(item => item.type === "clothing") || traderEquipment.feet[0],
      hands: traderEquipment.hands.find(item => item.type === "clothing") || traderEquipment.hands[0],
      storage: traderEquipment.storage.find(item => item.name === "Belt Pouch") || traderEquipment.storage[0]
    };

    // Customize clothing names based on race if race data exists
    if (raceClothing) {
      return {
        head: { 
          ...basicClothing.head,
          name: raceClothing.head,
          race: raceKey,
          description: `Standard ${raceKey.toLowerCase()} headwear`
        },
        torso: { 
          ...basicClothing.torso,
          name: raceClothing.torso,
          race: raceKey,
          description: `Standard ${raceKey.toLowerCase()} torso clothing`
        },
        legs: { 
          ...basicClothing.legs,
          name: raceClothing.legs,
          race: raceKey,
          description: `Standard ${raceKey.toLowerCase()} legwear`
        },
        feet: { 
          ...basicClothing.feet,
          name: raceClothing.feet,
          race: raceKey,
          description: `Standard ${raceKey.toLowerCase()} footwear`
        },
        hands: { 
          ...basicClothing.hands,
          name: raceClothing.hands,
          race: raceKey,
          description: `Standard ${raceKey.toLowerCase()} handwear`
        },
        storage: basicClothing.storage
      };
    }

    // Default to basic clothing if race not found
    return basicClothing;
  };

  const rollAge = () => {
    if (age === '' || age === 'Unknown') {
      const ageRoll = rollDice(100, 1, useCryptoRandom);
      try {
        const characterAge = determineCharacterAge(species, ageRoll);
        setAge(characterAge);
      } catch (error) {
        console.error(error);
        alert('An error occurred while determining the age.');
        setAge('Unknown');
      }
    }
  };

  const rollSocialBackground = () => {
    if (socialBackground === '') {
      const roll = rollDice(100, 1, useCryptoRandom);
      setSocialBackground(rollFromTable(roll, socialBackgrounds));
    }
  };

  const handleRollDisposition = () => {
    if (disposition === '') {
      const roll = rollDice(100, 1, useCryptoRandom);
      setDisposition(rollFromTable(roll, dispositions));
    }
  };

  const handleRollHostility = () => {
    if (hostility === '') {
      const roll = rollDice(100, 1, useCryptoRandom);
      setHostility(rollFromTable(roll, hostilities));
    }
  };

  const handleRollOrigin = () => {
    if (origin === '') {
      const roll = rollDice(100, 1, useCryptoRandom);
      setOrigin(rollFromTable(roll, landsOfOrigin));
    }
  };

  const updateAvailableClasses = () => {
    if (species) {
      const classes = publicClasses.map((entry) => entry.id);
      setAvailableClasses(classes);
      
      // Reset character class if current selection is no longer valid
      if (publicClassId && !classes.includes(publicClassId)) {
        setPublicClassId('');
        setCharacterClass('');
      }
    }
  };

  // Add useEffect to update available classes when relevant data changes
  useEffect(() => {
    updateAvailableClasses();
  }, [species, attributes, publicClasses, publicClassId]);

  // Initialize filtered classes when available classes change
  useEffect(() => {
    filterAvailableprofessions(species);
  }, [availableClasses, species]);

  // Handle profession selection with automatic bonuses, stamina/focus, and skills
  const filterAvailableprofessions = (selectedSpecies) => {
    if (!selectedSpecies) {
      setFilteredClasses(availableClasses);
      return;
    }

    const raceData = gameData.races[selectedSpecies];
    if (!raceData) {
      setFilteredClasses(availableClasses);
      return;
    }

    // Keep public class options visible while legacy compatibility data remains in place.
    const allowedClasses = availableClasses.filter((classId) => {
      const publicClass = getPublicClassById(classId);
      return Boolean(publicClass);
    });

    setFilteredClasses(allowedClasses);
  };

  const togglePublicLanguageChoice = (languageId) => {
    if (languageId === 'common') {
      return;
    }

    setSelectedPublicLanguageIds((current) => {
      if (current.includes(languageId)) {
        return current.filter((id) => id !== languageId);
      }

      if (current.length >= 2) {
        return current;
      }

      return [...current, languageId];
    });
  };

  const resetAbilityAssignmentState = (scores) => {
    setGeneratedAbilityScores(scores);
    setAbilityAssignments({});
    setHp(null);
    setBonusRolled(false);
  };

  const handleAbilityScoreMethodChange = (method) => {
    if (method === 'point-cost') {
      return;
    }

    setAbilityScoreMethod(method);
    if (method === 'standard-array') {
      resetAbilityAssignmentState(STANDARD_ARRAY_SCORES);
      return;
    }

    resetAbilityAssignmentState([]);
  };

  const handleGenerateRandomAbilityScores = () => {
    const rollDie = () => rollDice(6, 1, useCryptoRandom);
    setAbilityScoreMethod('random-generation');
    resetAbilityAssignmentState(rollRandomAbilityScores({ rollDie }));
  };

  const handleAbilityAssignmentChange = (abilityId, scoreIndex) => {
    setAbilityAssignments((current) => {
      const next = { ...current };
      if (scoreIndex === '') {
        delete next[abilityId];
      } else {
        next[abilityId] = scoreIndex;
      }
      return next;
    });
    setHp(null);
  };

  const handlePublicSpeciesSelection = (selectedSpeciesId) => {
    const publicSpecies = getPublicSpeciesById(selectedSpeciesId) || getPublicSpeciesById('human');
    const compatibilitySpecies = PUBLIC_SPECIES_COMPATIBILITY_KEYS[publicSpecies?.id] || 'HUMAN';

    setPublicSpeciesId(publicSpecies?.id || 'human');
    setSpecies(compatibilitySpecies);
    setCharacterClass('');
    setProfessionData(null);
    setProfessionSkills([]);
    setElectiveSkills([]);
    setSecondarySkills([]);
    filterAvailableprofessions(compatibilitySpecies);
  };

  const handleProfessionSelection = (selectedClassId) => {
    const publicClass = getPublicClassById(selectedClassId);
    const compatibilityClass = publicClass
      ? PUBLIC_CLASS_COMPATIBILITY_KEYS[publicClass.id] || publicClass.name
      : '';

    setPublicClassId(publicClass?.id || '');
    setCharacterClass(compatibilityClass);
    
    if (!publicClass || !compatibilityClass) {
      setProfessionSkills([]);
      setElectiveSkills([]);
      setSecondarySkills([]);
      setPreviousLevel(1);
      setProfessionData(null);
      return;
    }
    
    // Try clean profession data first, fall back to old gameData for compatibility
    const professionData = PROFESSIONS[compatibilityClass] || gameData.professions[compatibilityClass];
    if (!professionData) return;
    
    // Reset previous level when profession changes
    const currentLevel = parseInt(level) || 1;
    setPreviousLevel(1);
    
    // Check if level > 1 and we need to prompt for skill selection
    if (currentLevel > 1) {
      const skillGains = calculateSkillGains(professionData, currentLevel, 1);
      
      if (skillGains.elective > 0 || skillGains.secondary > 0) {
        // Show skill selection modal after a brief delay to allow profession data to be set
        setTimeout(() => {
          setPendingLevelChange(level);
          setPendingSkillSelections({
            elective: { count: skillGains.elective, selected: [] },
            secondary: { count: skillGains.secondary, selected: [] }
          });
          setShowSkillSelectionModal(true);
        }, 100);
      }
    }

    // Apply attribute bonuses
    const updatedAttributes = { ...attributes };
    for (const [attr, bonusExpr] of Object.entries(professionData.bonuses || {})) {
      updatedAttributes[attr] = applyBonus(updatedAttributes[attr] || 0, bonusExpr);
    }
    setAttributes(updatedAttributes);

    // Roll stamina/focus
    let stamina = 0;
    let focus = 0;
    if (professionData.stamina) stamina = evaluateDice(professionData.stamina);
    if (professionData.focus) focus = evaluateDice(professionData.focus);

    // Apply racial modifiers
    const raceData = gameData.races[species];
    if (raceData?.saveMods) {
      // Apply racial save modifiers (will be applied to character on creation)
      // This is handled in the character creation process
    }

    // Auto-assign profession skills
    setProfessionSkills(professionData.professionSkills || []);
    
    // Reset elective and secondary skills
    setElectiveSkills([]);
    setSecondarySkills([]);

    // Store profession data for character creation (include skill progression data)
    setProfessionData({
      name: publicClass.name,
      compatibilityClass,
      publicClassId: publicClass.id,
      publicClassName: publicClass.name,
      publicDescription: publicClass.description,
      category: professionData.category,
      stamina: stamina,
      focus: focus,
      notes: professionData.notes,
      electiveSkills: professionData.electiveSkills,
      secondarySkills: professionData.secondarySkills,
      saveMods: raceData?.saveMods || { vsTraining: 0, vsTactics: 0 },
      combatMods: raceData?.combatMods || { damage: 0, initiative: 0, speedBonus: 0 },
      abilities: raceData?.abilities || []
    });
  };

  const handleTacticsRoll = (tacticsData) => {
    if (typeof tacticsData === 'string') {
      // Handle old format for backward compatibility
      setTactics(tacticsData);
    } else {
      // Handle new format with focus
      setTactics(tacticsData.result);
      // Store focus for character creation
      if (tacticsData.focus > 0) {
        setAttributes(prev => ({ ...prev, basefocus: tacticsData.focus }));
      }
    }
  };

  const handleGenerateRandomName = () => {
    const randomName = getRandomName();
    if (randomName) {
      setCharacterName(randomName);
    }
  };

  const handleSubmit = async () => {
    setSaveMessage(null);
    // Validate required fields
    if (!hp) {
      alert('Please roll HP before creating character');
      return;
    }
    
    if (!characterName?.trim()) {
      alert('Please enter a character name');
      return;
    }
    
    if (!species) {
      alert('Please select a species');
      return;
    }
    
    if (!characterClass) {
      alert('Please select a class');
      return;
    }

    if (!allPublicAbilitiesAssigned) {
      alert('Please assign all six ability scores before creating character');
      return;
    }

    if (
      backgroundAbilityMode === 'split' &&
      backgroundAbilityOptions.length >= 3 &&
      (!backgroundPlusTwoAbility || !backgroundPlusOneAbility || backgroundPlusTwoAbility === backgroundPlusOneAbility)
    ) {
      alert('Please choose different background abilities for the +2 and +1 increases');
      return;
    }

    if (isStrictDuelist(characterClass)) {
      const v = validateDuelistTechniqueSelections();
      if (!v.ok) {
        alert(v.message);
        return;
      }
    }
    
    // Validate attributes are present
    const hasAllAttributes = ['IQ', 'ME', 'MA', 'PS', 'PP', 'PE', 'PB', 'Spd'].every(attr => 
      attributes[attr] !== undefined && attributes[attr] !== null
    );
    
    if (!hasAllAttributes) {
      alert('Please roll all attributes before creating character');
      return;
    }

      console.log('Submitting character data:', {
        name: characterName,
        species,
        publicSpeciesId,
        publicSpeciesName: selectedPublicSpecies?.name,
        creatureType: selectedPublicSpecies?.creatureType || "Humanoid",
        publicLanguages: selectedPublicLanguages.map((language) => language.name),
        class: characterClass,
        publicClassId,
        publicClassName: professionData?.publicClassName,
        publicBackgroundId,
        publicBackgroundName: selectedPublicBackground?.name,
        publicSkillProficiencies: publicSkillMetadata.proficiencies,
        publicSkillChoices: publicSkillMetadata.choices,
        level: Number(level) || 1, // Use actual level state
      hp: Number(hp),
      alignment,
      abilityScoreMethod,
      baseAbilityScores,
      backgroundAbilityBonuses,
      finalAbilityScores,
      abilityModifiers,
      publicDerivedStats,
      attributes,
      age,
      socialBackground,
      disposition,
      hostility,
      origin,
      gender,
      profession: professionData?.name || characterClass,
      stamina: professionData?.stamina || 0,
      focus: professionData?.focus || 0,
      saves: {
        vsTraining: 12 + (professionData?.saveMods?.vsTraining || 0),
        vsTactics: 15 + (professionData?.saveMods?.vsTactics || 0),
        vsPoison: 14
      },
      combatMods: professionData?.combatMods || { damage: 0, initiative: 0, speedBonus: 0 },
      abilities: professionData?.abilities || [],
      professionSkills: professionSkills,
      electiveSkills: electiveSkills,
      secondarySkills: secondarySkills
    });

    try {
      // Convert gender to lowercase for validation  
      const normalizedGender = gender.toLowerCase();
      
      // Filter attributes to only include required ones for backend validation
      const validatedAttributes = {
        IQ: Number(attributes.IQ) || 3,
        ME: Number(attributes.ME) || 3,
        MA: Number(attributes.MA) || 3,
        PS: Number(attributes.PS) || 3,
        PP: Number(attributes.PP) || 3,
        PE: Number(attributes.PE) || 3,
        PB: Number(attributes.PB) || 3,
        Spd: Number(attributes.Spd) || 3
      };

      const ageNum = Number(age);
      const hasEnteredAge = String(age).trim() !== '' && Number.isFinite(ageNum);
      const normalizedAge = hasEnteredAge ? ageNum : undefined;
      const visualAge = hasEnteredAge ? ageNum : 25;
      const computedVisualProfile =
        selectedPublicSpecies?.id === 'human'
          ? buildHumanVisualProfile({ ...validatedAttributes, age: visualAge })
          : null;
      
      // Calculate the total HP for this level (same logic as levelStats)
      const peBonus = Math.floor((validatedAttributes.PE || 0) / 4);
      const currentLevel = Number(level) || 1;
      const calculatedHP = useDeterministicHP ? 
        calculateCreatorHP(currentLevel, peBonus, Number(hp) || 10) :
        Number(hp) || 10;

      // Import assignInitialEquipment to get proper starting equipment
      const { assignInitialEquipment } = await import('../utils/characterUtils');
      
      // Get initial equipment based on class and race (modern system)
      const { inventory, gold, equipment, equistaminad, equistaminadArmor, guardRating } = await assignInitialEquipment(characterClass, species);

      // Add tactics for Tacticians
      let tacticalOptions = [];
      if (characterClass === "Tactician" && tactics) {
        tacticalOptions = await getMindMageTactics(tactics, level);
      }

      // DEBUG: Test the inventory directly

      console.log('Raw inventory from assignInitialEquipment:', inventory);
      console.log('Inventory length:', inventory.length);
      console.log('First few inventory items:', inventory.slice(0, 3));
      
      // Check each item for missing fields
      inventory.forEach((item, index) => {
        if (!item.type) {
          console.error(`Item ${index} missing type:`, item);
        }
        if (!item.category) {
          console.error(`Item ${index} missing category:`, item);
        }
      });

      // DEBUG: Log the final inventory before sending to API
      console.log('Final inventory before API call:', inventory);
      inventory.forEach((item, index) => {
        console.log(`Item ${index}:`, { name: item.name, type: item.type, category: item.category });
      });

      // Calculate focus for Tacticians
      let characterfocus = 0;
      if (characterClass === 'Tactician' && attributes.basefocus) {
        // Base focus + 10 per level (level 1 = base focus)
        characterfocus = attributes.basefocus + ((Number(level) || 1) - 1) * 10;
      }

      // HARD profession GATES (prevents illegal tactics/training on Men of Arms)
      const professionCategory = String(professionData?.category || "").toLowerCase();
      const isMenOfArms =
        professionCategory.includes("men of arms") ||
        professionCategory.includes("man of arms") ||
        professionCategory.includes("men-of-arms");

      if (isMenOfArms) {
        characterfocus = 0;
      }

      const allTechniques = getAllTechniquesFromDataset();
      let selectedTechniques = [];
      if (isStrictDuelist(characterClass)) {
        const chosenNames = duelistTechniquePicks[1] || [];
        const duelistBuild = buildDuelistTechniqueBookForLevel({
          allTechniques,
          level: Number(level) || 1,
          pickedTechniqueNames: chosenNames,
        });
        selectedTechniques = duelistBuild.techniqueBook;
      }

      const characterData = {
        name: characterName || "Unnamed Character",
        ruleset: "core-d20",
        sizePolicy: "legacy-compatible",
        legacyCompatibility: true,
        publicClassId: professionData?.publicClassId || publicClassId || undefined,
        publicClassName: professionData?.publicClassName || selectedPublicClass?.name || undefined,
        publicBackgroundId: selectedPublicBackground?.id || publicBackgroundId || undefined,
        publicBackgroundName: selectedPublicBackground?.name || undefined,
        publicSkillProficiencies: publicSkillMetadata.proficiencies,
        publicSkillChoices: publicSkillMetadata.choices,
        publicSpeciesId: selectedPublicSpecies?.id || publicSpeciesId || "human",
        publicSpeciesName: selectedPublicSpecies?.name || "Human",
        creatureType: selectedPublicSpecies?.creatureType || "Humanoid",
        size: selectedPublicSpecies?.sizeOptions?.[0] || "Medium",
        speed: selectedPublicSpecies?.speed ?? 30,
        publicLanguages: selectedPublicLanguages.map((language) => language.name),
        species,
        race: species,
        category: species,
        class: characterClass,
        profession: characterClass, // Set profession to same as class
        level: Number(level) || 1,
        hp: calculatedHP, // Use calculated total HP instead of base HP
        alignment: alignment || "",
        abilityScoreMethod,
        baseAbilityScores,
        backgroundAbilityBonuses,
        finalAbilityScores,
        abilityModifiers,
        publicDerivedStats,
        publicStartingEquipment,
        selectedClassEquipmentOptionId: selectedClassEquipmentOption?.id || selectedClassEquipmentOptionId || undefined,
        backgroundEquipmentTags,
        startingGold,
        attributes: validatedAttributes,
        age: normalizedAge ?? "Not set",
        socialBackground: socialBackground || "Unknown",
        disposition: disposition || "Unknown",
        hostility: hostility || "Unknown",
        origin: origin || "Unknown",
        gender: normalizedGender,
        focus: isMenOfArms ? 0 : characterfocus,
        currentfocus: isMenOfArms ? 0 : characterfocus,
        tacticalOptions: isMenOfArms ? [] : (tacticalOptions || []),
        techniques: selectedTechniques,
        training: [],
        professionSkills: professionSkills || [],
        electiveSkills: electiveSkills || [],
        secondarySkills: secondarySkills || [],
        visualProfile: computedVisualProfile,
        // Add starting equipment using modern system
        inventory: inventory || [],
        equipment: equipment || undefined,
        equistaminad: equistaminad || undefined,
        equistaminadArmor: equistaminadArmor || undefined,
        guardRating: guardRating || undefined,
        gold: gold || 100
      };

      const normalizedstamina = normalizestaminaState(
        {
          ...characterData,
          profession: characterData.profession || characterData.class,
          training: characterData.techniques,
        },
        {
          rollMissingLevelGains: true,
          rng: createDeterministicRng(
            `${characterData.name || "character"}|create|${characterData.level || 1}`
          ),
        }
      );
      characterData.stamina = normalizedstamina.stamina;
      characterData.maxstamina = normalizedstamina.maxstamina;
      characterData.currentstamina = normalizedstamina.currentstamina;
      characterData.staminaType = normalizedstamina.staminaType;
      characterData.staminaBase = normalizedstamina.staminaBase;
      characterData.staminaLevelGainsTotal = normalizedstamina.staminaLevelGainsTotal;
      characterData.staminaLevelGainRolls = normalizedstamina.staminaLevelGainRolls;

      console.log('Submitting character data for validation:', characterData);
      console.log('profession field value:', characterData.profession);
      console.log('class field value:', characterData.class);
      console.log('level state:', level);
      console.log('level number:', Number(level));
      console.log('level in characterData:', characterData.level);
      console.log('HP calculation:', {
        baseHP: Number(hp) || 10,
        calculatedHP: calculatedHP,
        peBonus: peBonus,
        currentLevel: currentLevel,
        useDeterministicHP: useDeterministicHP
      });
      console.log('professionSkills:', characterData.professionSkills);
      console.log('electiveSkills:', characterData.electiveSkills);
      console.log('secondarySkills:', characterData.secondarySkills);
      
      const saveResult = await saveCharacterWithAuth({
        character: characterData,
        onSave: onCreateCharacter,
      });

      if (!saveResult.saved) {
        setPendingCharacter(saveResult.character);
        setSaveMessage({ status: "warning", text: saveResult.message });
        return;
      }

      setPendingCharacter(null);
      console.log('Character creation response:', saveResult.character);
      navigate('/character-list');
    } catch (error) {
      console.error('Full error object:', error);
      console.error('Error creating character:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        details: error.response?.data?.details || error.response?.data?.error
      });
      
      let errorMessage = error.response?.data?.message || error.message || 'Failed to create character';
      
      // Show detailed validation errors if available
      if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        const validationErrors = errors.map(err => 
          `${err.field}: ${err.message}`
        ).join('\n');
        errorMessage += '\n\nValidation Errors:\n' + validationErrors;
      }
      
      console.error('Character creation error details:', error.response?.data);
      setSaveMessage({ status: "error", text: errorMessage });
    }
  };

  const renderClassSelection = () => {
    // Use public classes for display while preserving the existing compatibility class key internally.
    const classesToShow = filteredClasses.length > 0 ? filteredClasses : availableClasses;
    
    console.log('=== CLASS FILTERING DEBUG ===');
    console.log('Species:', species);
    console.log('Tactics:', tactics);
    console.log('IQ:', attributes.IQ);
    console.log('Available Classes:', availableClasses);
    console.log('Filtered Classes:', filteredClasses);
    console.log('Classes To Show:', classesToShow);
    console.log('================================');
    
    const validPublicClasses = classesToShow
      .map((classId) => getPublicClassById(classId))
      .filter((publicClass) => {
        if (!publicClass) {
          if (import.meta.env?.DEV || import.meta.env?.MODE === 'development') {
            console.warn('Invalid public class entry skipped in Character Creator');
          }
          return false;
        }

        return true;
      });

    // Group public classes by ruleset for display.
    const groupedClasses = validPublicClasses.reduce((acc, publicClass) => {
      const category = publicClass.ruleset === "core-d20" ? "Core d20" : "General";
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(publicClass);
      return acc;
    }, {});

    return (
      <div className="class-selection">
        <label htmlFor="character-class">Class:</label>
        <select
          id="character-class"
          value={publicClassId}
          onChange={(e) => handleProfessionSelection(e.target.value)}
          disabled={availableClasses.length === 0}
        >
          <option value="">Select a class</option>
          {Object.entries(groupedClasses).map(([category, classes]) => (
            <optgroup key={category} label={category}>
              {classes.map(publicClass => (
                <option key={publicClass.id} value={publicClass.id}>
                  {publicClass.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {/* Display class requirements when a class is selected */}
        {characterClass && characterClasses[characterClass]?.requirements && (
          <div className="class-requirements">
            <h4>{characterClass} Requirements:</h4>
            <ul>
              {Object.entries(characterClasses[characterClass].requirements).map(([attr, value]) => (
                <li key={attr}>
                  {attr === 'alignment' && 'Alignment: Evil required'}
                  {attr === 'tactics' && 'Must be Major (80-89%) or Master Tactical (90-100%)'}
                  {attr !== 'alignment' && attr !== 'tactics' && `${formatAttributeLabel(attr)}: ${value}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Display class data when selected */}
        {professionData && (
          <div className="profession-data">
            <h4>Class Information:</h4>
            <p><strong>Class:</strong> {professionData.name} ({professionData.category || "General"})</p>
            {professionData.publicDescription && (
              <p><strong>Description:</strong> {professionData.publicDescription}</p>
            )}
            <p><strong>Stamina:</strong> {professionData.stamina}</p>
            <p><strong>Focus:</strong> {professionData.focus}</p>
            <p><strong>Notes:</strong> {formatPublicCreatorText(professionData.notes)}</p>
            {(professionData.abilities || []).length > 0 && (
              <div>
                <strong>Abilities:</strong>
                <ul>
                  {professionData.abilities.map((ability, idx) => (
                    <li key={idx}>{ability}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Class Skills Selection */}
        {characterClass && (PROFESSIONS[characterClass] || gameData.professions[characterClass]) && (
          <details className="profession-skills-selection">
            <summary style={{ fontWeight: 'bold', cursor: 'pointer' }}>Compatibility Details</summary>
            
            {/* Class Skills (auto-assigned) */}
            <div className="profession-skills">
              <h5>Class Skills (Automatic):</h5>
              <ul>
                {professionSkills.map((skill, idx) => {
                  const formattedSkill = formatPublicCreatorText(formatSkillWithPercent(skill, characterClass, parseInt(level) || 1));
                  return (
                    <li key={idx}>{formattedSkill}</li>
                  );
                })}
              </ul>
            </div>

            {/* Elective Skills */}
            {(() => {
              const professionData = PROFESSIONS[characterClass] || gameData.professions[characterClass];
              const electiveCount = professionData?.electiveSkills?.level1 || 0;
              
              if (electiveCount > 0) {
                // Use all ELECTIVE_SKILLS instead of just the profession's specific list
                const availableElectiveSkills = ELECTIVE_SKILLS.filter(skill => 
                  !isSkillInProfessionSkills(skill, professionSkills)
                );
                
                return (
                  <div className="elective-skills">
                    <h5>Elective Skills (Choose {electiveCount}):</h5>
                    <select
                      multiple
                      size="10"
                      value={electiveSkills}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, option => option.value);
                        if (selected.length <= electiveCount) {
                          setElectiveSkills(selected);
                        }
                      }}
                    >
                      {availableElectiveSkills.map((skill, idx) => {
                        const skillData = gameData.skills?.[skill];
                        const formattedSkill = formatPublicCreatorText(formatSkillWithPercent(skill, characterClass, parseInt(level) || 1));
                        return (
                          <option key={idx} value={skill} title={skillData?.description || skill}>
                            {formattedSkill}
                          </option>
                        );
                      })}
                    </select>
                    <p>Selected: {electiveSkills.length}/{electiveCount}</p>
                  </div>
                );
              }
              return null;
            })()}

            {/* Secondary Skills */}
            {(() => {
              const professionData = PROFESSIONS[characterClass] || gameData.professions[characterClass];
              const secondaryCount = professionData?.secondarySkills?.level1 || 0;
              
              if (secondaryCount > 0) {
                return (
                  <div className="secondary-skills">
                    <h5>Secondary Skills (Choose {secondaryCount}):</h5>
                    <p className="skill-hint">Basic/general skills only - no advanced or class-specific skills</p>
                    <select
                      multiple
                      size="8"
                      value={secondarySkills}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, option => option.value);
                        if (selected.length <= secondaryCount) {
                          setSecondarySkills(selected);
                        }
                      }}
                    >
                      {(SECONDARY_SKILLS || gameData.secondarySkills || [])
                        .filter(skill => !isSkillInProfessionSkills(skill, professionSkills)) // Filter out skills already in profession skills
                        .map((skill, idx) => {
                          const formattedSkill = formatPublicCreatorText(formatSkillWithPercent(skill, characterClass, parseInt(level) || 1));
                          return (
                            <option key={idx} value={skill} title={`Basic skill: ${skill}`}>
                              {formattedSkill}
                            </option>
                          );
                        })}
                </select>
                <p>Selected: {secondarySkills.length}/{secondaryCount}</p>
                  </div>
                );
              }
              return null;
            })()}

            {/* Class Special Notes */}
            {(() => {
              const professionData = PROFESSIONS[characterClass] || gameData.professions[characterClass];
              if (professionData?.special) {
                return (
                  <div className="profession-special">
                    <h5>Special:</h5>
                    <p>{formatPublicCreatorText(professionData.special)}</p>
                  </div>
                );
              }
              return null;
            })()}
          </details>
        )}

      </div>
    );
  };

  const getHighlightStyle = (highlight) => {
    switch (highlight) {
      case 'green':
        return { backgroundColor: '#90EE90' }; // Light green
      case 'red':
        return { backgroundColor: '#FFB6C1' }; // Light red
      default:
        return {};
    }
  };

  const formatAttributeLabel = (attr) => ({
    PS: 'Strength',
    PP: 'Dexterity',
    PE: 'Constitution',
    IQ: 'Intelligence',
    ME: 'Wisdom',
    MA: 'Charisma',
    PB: 'Appearance',
    Spd: 'Speed',
    ps: 'Strength',
    pp: 'Dexterity',
    pe: 'Constitution',
    iq: 'Intelligence',
    me: 'Wisdom',
    ma: 'Charisma',
    pb: 'Appearance',
    spd: 'Speed',
  }[attr] || attr);

  const formatAttributeBonusText = (text) => String(text || '')
    .replace(/\bPS\b/g, 'Strength')
    .replace(/\bPP\b/g, 'Dexterity')
    .replace(/\bPE\b/g, 'Constitution')
    .replace(/\bIQ\b/g, 'Intelligence')
    .replace(/\bME\b/g, 'Wisdom')
    .replace(/\bMA\b/g, 'Charisma')
    .replace(/\bPB\b/g, 'Appearance')
    .replace(/\bSpd\b/g, 'Speed');

  const formatPublicCreatorText = (text) => formatAttributeBonusText(text)
    .replace(/\bprofessions\b/gi, 'classes')
    .replace(/\bprofession\b/gi, 'class')
    .replace(/\braces\b/gi, 'categories')
    .replace(/\brace\b/gi, 'category')
    .replace(/\bHand to Hand\b/gi, 'Close Combat')
    .replace(/\bW\.P\.\b/g, 'Weapon Training');

  // Helper function to get skill base percentage for display
  const getSkillBasePercent = (skillName, professionName) => {
    // Map skill names to professionSkillTables keys - profession-specific first
    const PROFESSIONSpecificMap = {
      "Language: Native Tongue (98%)": 98,
      "Literacy (Own Language)": professionSkillTables[professionName]?.readWrite || professionSkillTables[professionName]?.literacy || 30,
      "Literacy (Additional Language)": 25,
      "Lore: Training": professionSkillTables[professionName]?.loreTraining || 35,
      "Lore: History": professionSkillTables[professionName]?.loreHistory || 20,
      "Lore: Raiders & Opponents": professionSkillTables[professionName]?.loreRaideric || professionSkillTables[professionName]?.loreOpponents || 25,
      "Lore: Raider & Opponent": professionSkillTables[professionName]?.loreRaideric || professionSkillTables[professionName]?.loreOpponents || 25,
      "Lore: Religion": professionSkillTables[professionName]?.loreReligion || 30,
      "Lore: Geography": 30,
      "Lore: Alchemy": 25,
      "Lore: Runes & Circles": 20,
      "Lore: Ancient": 20,
      "Lore: Military": professionSkillTables[professionName]?.loreMilitary || 30,
      "Lore: Heraldry": 25,
      "Lore: Local History": 20,
      "Lore: Spirits": 25,
      "Lore: Tactics": professionSkillTables[professionName]?.loreTactics || 40,
      "Lore: Herbs": professionSkillTables[professionName]?.loreHerbs || 35,
      "Identify Plants & Herbs": professionSkillTables[professionName]?.identifyPlants || 15,
      "Identify Plants & Animals": professionSkillTables[professionName]?.identifyPlants || 15,
      "Prowl": professionSkillTables[professionName]?.prowl || 10,
      "Meditation": professionSkillTables[professionName]?.meditation || 40,
      "Track": professionSkillTables[professionName]?.track || 25,
      "Tracking": professionSkillTables[professionName]?.track || 25,
      "Track Animals": 25,
      "Track Humanoids": 25,
      "Horsemanship": professionSkillTables[professionName]?.horsemanship || 30,
      "Horsemanship (Basic)": professionSkillTables[professionName]?.horsemanship || 30,
      "First Aid": professionSkillTables[professionName]?.medical || 30,
      "Medical": professionSkillTables[professionName]?.medical || 30,
      "Herbal Lore": professionSkillTables[professionName]?.loreHerbs || 35,
      "Holistic Medicine": 30,
      "Diagnose Illness": 25,
      "Healing Touch": 30,
      "Pick Locks": professionSkillTables[professionName]?.pickLocks || 25,
      "Pick Pockets": professionSkillTables[professionName]?.pickPockets || 25,
      "Disguise": professionSkillTables[professionName]?.disguise || 25,
      "Streetwise": professionSkillTables[professionName]?.streetwise || 25,
      "Camouflage": professionSkillTables[professionName]?.camouflage || 20,
      "Survival": professionSkillTables[professionName]?.survival || 30,
      "Survival (Wilderness)": professionSkillTables[professionName]?.survival || 30,
      "Survival (Forest)": 30,
      "Survival (Plains)": 30,
      "Survival (Arctic)": 25,
      "Survival (Desert)": 25,
      "Climb": 60, // Base percentage from skillSystem.js (Medieval Combat Simulator rules)
      "Climbing": 60, // Base percentage from skillSystem.js
      "Scale Walls": 50, // Base percentage from skillSystem.js
      "Swim": 50, // Base percentage from skillSystem.js (Medieval Combat Simulator rules)
      "Swimming": 50, // Base percentage from skillSystem.js
      // Running is NOT a percentage skill - removed from map
      "Mathematics: Basic": 20,
      "Math (Basic)": 20,
      "Mathematics: Advanced": 25,
      "Math (Advanced)": 25,
      "Intimidation": professionSkillTables[professionName]?.intimidation || 25,
      "Hypnosis": professionSkillTables[professionName]?.hypnosis || 35,
      "Detect Deception": professionSkillTables[professionName]?.detectDeception || 30,
      "Weapon Maintenance": professionSkillTables[professionName]?.weaponMaintenance || 25,
      "Weapon Smithing": professionSkillTables[professionName]?.weaponSmithing || 20,
      "Heraldry": professionSkillTables[professionName]?.heraldry || 25,
      "Brewing": professionSkillTables[professionName]?.brewing || 35,
      "Poison Craft": professionSkillTables[professionName]?.poisonCraft || 35,
      "Palming": professionSkillTables[professionName]?.palming || 30,
      "Gambling": professionSkillTables[professionName]?.gamble || 30,
      "Farming": professionSkillTables[professionName]?.farming || 40,
      "Animal Husbandry": professionSkillTables[professionName]?.animalHusbandry || 30,
      "Cooking": professionSkillTables[professionName]?.cooking || 30,
      "Research": professionSkillTables[professionName]?.research || 25,
    };
    
    // Check direct mapping first
    if (PROFESSIONSpecificMap[skillName]) {
      return PROFESSIONSpecificMap[skillName];
    }
    
    // Try to match skill name patterns
    if (skillName.includes("Literacy") || skillName.includes("Read/Write")) {
      return professionSkillTables[professionName]?.readWrite || 30;
    }
    if (skillName.includes("Lore: Training")) {
      return professionSkillTables[professionName]?.loreTraining || 35;
    }
    if (skillName.includes("Lore: History")) {
      return professionSkillTables[professionName]?.loreHistory || 20;
    }
    if (skillName.includes("Identify Plants") || skillName.includes("Herbs")) {
      return professionSkillTables[professionName]?.identifyPlants || 15;
    }
    if (skillName.includes("Prowl")) {
      return professionSkillTables[professionName]?.prowl || 10;
    }
    if (skillName.includes("Meditation")) {
      return professionSkillTables[professionName]?.meditation || 40;
    }
    if (skillName.includes("Mathematics: Basic") || skillName.includes("Math: Basic")) {
      return 20;
    }
    if (skillName.includes("Mathematics: Advanced") || skillName.includes("Math: Advanced")) {
      return 25;
    }
    if (skillName.includes("Language") && skillName.includes("Native")) {
      return 98;
    }
    if (skillName.includes("Language") && skillName.includes("Additional")) {
      return 25;
    }
    if (skillName.includes("Literacy") && skillName.includes("Additional")) {
      return 25;
    }
    if (skillName.includes("Lore: Raiders") || skillName.includes("Lore: Raider")) {
      return 25;
    }
    if (skillName.includes("Lore: Religion")) {
      return 30;
    }
    if (skillName.includes("Lore: Geography")) {
      return 30;
    }
    if (skillName.includes("Lore: Alchemy")) {
      return 25;
    }
    if (skillName.includes("Lore: Runes") || skillName.includes("Lore: Circles")) {
      return 20;
    }
    if (skillName.includes("Lore: Ancient")) {
      return 20;
    }
    if (skillName.includes("Research")) {
      return 25;
    }
    if (skillName.includes("Writing")) {
      return 25;
    }
    if (skillName.includes("Calligraphy")) {
      return 20;
    }
    if (skillName.includes("Art")) {
      return 20;
    }
    if (skillName.includes("Navigation")) {
      return 30;
    }
    if (skillName.includes("Astronomy")) {
      return 25;
    }
    if (skillName.includes("Astrology")) {
      return 20;
    }
    if (skillName.includes("History") && skillName.includes("Advanced")) {
      return 25;
    }
    if (skillName.includes("Anthropology")) {
      return 20;
    }
    if (skillName.includes("Archaeology")) {
      return 20;
    }
    if (skillName.includes("Gem Appraisal")) {
      return 20;
    }
    if (skillName.includes("Chemistry")) {
      return 25;
    }
    if (skillName.includes("Alchemy Theory")) {
      return 25;
    }
    if (skillName.includes("Herbology") && skillName.includes("Advanced")) {
      return 30;
    }
    if (skillName.includes("Public Speaking")) {
      return 30;
    }
    if (skillName.includes("Charm") || skillName.includes("Impress")) {
      return 25;
    }
    if (skillName.includes("Etiquette")) {
      return 25;
    }
    if (skillName.includes("Teaching")) {
      return 30;
    }
    if (skillName.includes("Tutoring")) {
      return 25;
    }
    if (skillName.includes("Climb") && !skillName.includes("Scale Walls")) {
      return 60; // Base percentage from Medieval Combat Simulator rules (Climb: 60% base)
    }
    if (skillName.includes("Swim") || skillName.includes("Swimming")) {
      return 50; // Base percentage from Medieval Combat Simulator rules (Swim: 50% base)
    }
    // Running is NOT a percentage skill - it provides static bonuses (+1 PE, +4D4 Spd, +1D6 armorDurability)
    // So we return null to indicate it shouldn't show a percentage
    if (skillName.includes("Running")) {
      return null;
    }
    if (skillName.includes("Horsemanship")) {
      return 30;
    }
    if (skillName.includes("Pilot: Boat")) {
      return 30;
    }
    if (skillName.includes("Survival")) {
      if (skillName.includes("Arctic") || skillName.includes("Desert")) return 25;
      return 30;
    }
    if (skillName.includes("First Aid")) {
      return professionSkillTables[professionName]?.medical || 30;
    }
    if (skillName.includes("Medical")) {
      return professionSkillTables[professionName]?.medical || 30;
    }
    if (skillName.includes("Track")) {
      return professionSkillTables[professionName]?.track || 25;
    }
    if (skillName.includes("Horsemanship")) {
      return professionSkillTables[professionName]?.horsemanship || 30;
    }
    if (skillName.includes("Pick Locks")) {
      return professionSkillTables[professionName]?.pickLocks || 25;
    }
    if (skillName.includes("Pick Pockets")) {
      return professionSkillTables[professionName]?.pickPockets || 25;
    }
    if (skillName.includes("Disguise")) {
      return professionSkillTables[professionName]?.disguise || 25;
    }
    if (skillName.includes("Streetwise")) {
      return professionSkillTables[professionName]?.streetwise || 25;
    }
    if (skillName.includes("Camouflage")) {
      return professionSkillTables[professionName]?.camouflage || 20;
    }
    if (skillName.includes("Detect Ambush")) {
      return 30;
    }
    if (skillName.includes("Detect Concealment")) {
      return 30;
    }
    if (skillName.includes("Scale Walls")) {
      return 50; // Percentage skill - used for climbing walls/fortifications
    }
    // Acrobatics, Gymnastics, Boxing, Wrestling are combat bonus skills, not percentage-based
    // They're handled in the combat skills section, so return null here
    if (skillName.includes("Acrobatics")) {
      return null; // Combat bonus skill
    }
    if (skillName.includes("Gymnastics")) {
      return null; // Combat bonus skill
    }
    if (skillName.includes("Boxing")) {
      return null; // Combat bonus skill
    }
    if (skillName.includes("Wrestling")) {
      return null; // Combat bonus skill
    }
    if (skillName.includes("Cooking") || skillName.includes("Cook")) {
      return 30;
    }
    if (skillName.includes("Dancing") || skillName.includes("Dance")) {
      return 30;
    }
    if (skillName.includes("Fishing")) {
      return 30;
    }
    if (skillName.includes("Sewing")) {
      return 30;
    }
    if (skillName.includes("Singing") || skillName.includes("Sing")) {
      return 30;
    }
    if (skillName.includes("Carpentry")) {
      return 30;
    }
    if (skillName.includes("Masonry")) {
      return 30;
    }
    // Pottery has two percentages: crafting (10%) and painting/glazing (5%)
    if (skillName.includes("Pottery")) {
      return { first: 10, second: 5 }; // Crafting/Painting per 1994 rulebook
    }
    if (skillName.includes("Weaving")) {
      return 30;
    }
    if (skillName.includes("Animal Husbandry")) {
      return 30;
    }
    if (skillName.includes("Farming")) {
      return 40;
    }
    if (skillName.includes("Gardening")) {
      return 30;
    }
    if (skillName.includes("Gambling")) {
      return 30;
    }
    if (skillName.includes("Forgery")) {
      return 20;
    }
    if (skillName.includes("Barter")) {
      return 30;
    }
    if (skillName.includes("Boat Building")) {
      return 25;
    }
    if (skillName.includes("Performance") || skillName.includes("Play Musical Instrument")) {
      return 25;
    }
    if (skillName.includes("Recognize Weapon Quality")) {
      return 25;
    }
    if (skillName.includes("Recognize Metals")) {
      return 25;
    }
    if (skillName.includes("Sense of Direction")) {
      return 40;
    }
    if (skillName.includes("Rope Use")) {
      return 40;
    }
    if (skillName.includes("General Repair") || skillName.includes("Maintenance")) {
      return 30;
    }
    if (skillName.includes("Philosophy")) {
      return 25;
    }
    if (skillName.includes("Herbal Lore") || skillName.includes("Herbal Remedies")) {
      return 35;
    }
    if (skillName.includes("Holistic Medicine")) {
      return 30;
    }
    if (skillName.includes("Diagnose Illness")) {
      return 25;
    }
    if (skillName.includes("Healing Touch")) {
      return 30;
    }
    if (skillName.includes("Poison") && skillName.includes("Use")) {
      return 30;
    }
    if (skillName.includes("Poison Craft")) {
      return 35;
    }
    if (skillName.includes("Brewing")) {
      return 35;
    }
    if (skillName.includes("Intimidation")) {
      return 25;
    }
    if (skillName.includes("Hypnosis")) {
      return 35;
    }
    if (skillName.includes("Detect Deception")) {
      return 30;
    }
    if (skillName.includes("Weapon Maintenance")) {
      return 25;
    }
    if (skillName.includes("Weapon Smithing")) {
      return 20;
    }
    if (skillName.includes("Heraldry")) {
      return 25;
    }
    if (skillName.includes("Palming")) {
      return 30;
    }
    if (skillName.startsWith("Weapon Training:")) {
      return 0; // Weapon proficiencies start at 0
    }
    if (skillName.includes("Hand to Hand")) {
      return 0; // Combat skills start at 0
    }
    
    try {
      const skillData = lookupSkill(skillName);
      if (skillData && skillData.basePercentage !== undefined) {
        return skillData.basePercentage;
      }
    } catch (error) {
      console.warn('Legacy skill lookup failed in Character Creator:', skillName, error);
    }
    
    return null; // No percentage found
  };

  // Helper function to format skill name with percentage or bonuses
  const formatSkillWithPercent = (skillName, professionName, currentLevel = 1) => {
    // Check if skill already has bonus notation like "(+10%)", "(+15%)", etc.
    // If it does, return as-is without adding percentage
    const bonusPattern = /\(\+\d+%\)/;
    if (bonusPattern.test(skillName)) {
      return skillName; // Return as-is if it already has bonus notation
    }
    
    // Check if skill already has a percentage notation (like "Language: Native Tongue (98%)")
    // This should match skills that already have a full percentage, not a bonus
    const percentPattern = /\(\d+%\)$/;
    if (percentPattern.test(skillName) && !bonusPattern.test(skillName)) {
      return skillName; // Return as-is if it already has percentage notation (but not bonus)
    }
    
    // Check if this is a combat skill that uses bonuses instead of percentages
    const combatSkills = [
      'Boxing', 'Wrestling', 'Acrobatics', 'Gymnastics',
      'Hand to Hand: Basic', 'Hand to Hand: Expert', 'Hand to Hand: Mercenary',
      'Hand to Hand: Knight', 'Hand to Hand: Assassin', 'Hand to Hand: Martial Arts',
      'Hand to Hand: Paladin', 'Hand to Hand: Ranger'
    ];
    
    // Running is a bonus skill (provides +1 PE, +4D4 Spd, +1D6 armorDurability) - not percentage-based
    if (skillName.includes("Running")) {
      return `${skillName} (+1 Endurance, +4D4 Speed, +1D6 Armor Durability)`;
    }
    
    const isCombatSkill = combatSkills.some(cs => skillName.includes(cs));
    const isWeaponProficiency = skillName.startsWith('Weapon Training:');
    
    if (isCombatSkill || isWeaponProficiency) {
      // Get bonuses for this skill at current level
      const skillBonuses = getSkillBonusesAtLevel(skillName, currentLevel);
      const bonuses = skillBonuses.bonuses || { attack: 0, block: 0, evade: 0, damage: 0 };
      const attacks = skillBonuses.attacks || 0;
      
      // For Weapon Training: skills not in progression, check static bonuses
      if (isWeaponProficiency && bonuses.attack === 0 && bonuses.block === 0 && bonuses.evade === 0 && bonuses.damage === 0) {
        // Try to get base bonuses from skillBonuses.js
        const staticBonus = staticSkillBonuses[skillName];
        if (staticBonus) {
          bonuses.attack = staticBonus.attack || 0;
          bonuses.block = staticBonus.block || 0;
          bonuses.evade = staticBonus.evade || 0;
          bonuses.damage = staticBonus.damage || 0;
        }
      }
      
      // Build bonus string
      const bonusParts = [];
      if (bonuses.attack > 0) bonusParts.push(`+${bonuses.attack} attack`);
      if (bonuses.block > 0) bonusParts.push(`+${bonuses.block} block`);
      if (bonuses.evade > 0) bonusParts.push(`+${bonuses.evade} evade`);
      if (bonuses.damage > 0) bonusParts.push(`+${bonuses.damage} damage`);
      if (attacks > 0) bonusParts.push(`+${attacks} action per round`);
      
      if (bonusParts.length > 0) {
        return `${skillName} (${bonusParts.join(', ')})`;
      } else {
        // For Weapon Training: skills, show at least that it's a weapon proficiency
        if (isWeaponProficiency) {
          return `${skillName} (weapon proficiency)`;
        }
        return skillName; // No bonuses to display
      }
    }
    
    let basePercent = null;
    try {
      basePercent = getSkillBasePercent(skillName, professionName);
    } catch (error) {
      console.warn('Legacy skill formatting failed in Character Creator:', skillName, error);
      return skillName;
    }
    
    if (basePercent === null) {
      return skillName; // Return as-is if no percentage found
    }
    
    // Check if this is a dual-percentage skill (object with first and second)
    if (typeof basePercent === 'object' && basePercent.first !== undefined && basePercent.second !== undefined) {
      // Calculate total percentages with level bonus (+5% per level after 1st)
      const levelBonus = (currentLevel - 1) * 5;
      const firstTotal = Math.min(98, basePercent.first + levelBonus);
      const secondTotal = Math.min(98, basePercent.second + levelBonus);
      
      // Remove any existing percentage notation from skill name
      const cleanSkillName = skillName.replace(/\s*\(\d+%\/\d+%\)\s*$/, '').trim();
      
      // Format: "Skill Name (first%/second%)" - both percentages increase with level
      return `${cleanSkillName} (${firstTotal}%/${secondTotal}%)`;
    }
    
    // Single percentage skill
    // Calculate total percentage with level bonus (+5% per level after 1st)
    const levelBonus = (currentLevel - 1) * 5;
    const totalPercent = Math.min(98, basePercent + levelBonus);
    
    // Format: "Skill Name (base%)" at level 1, "Skill Name (total%)" at higher levels
    // Remove any existing percentage notation from skill name first (but not bonus notation)
    const cleanSkillName = skillName.replace(/\s*\(\d+%\)\s*$/, '').trim();
    
    if (currentLevel === 1) {
      return `${cleanSkillName} (${basePercent}%)`;
    } else {
      return `${cleanSkillName} (${totalPercent}%)`;
    }
  };

  // Helper function to normalize skill names for comparison
  const normalizeSkillName = (skillName) => {
    return skillName.toLowerCase()
      .replace(/\(.*?\)/g, '') // Remove parenthetical notes
      .replace(/\s+/g, ' ')
      .trim();
  };

  const getAllTechniquesFromDataset = () => {
    const dict = gameData?.techniques || {};
    if (!dict || typeof dict !== 'object') return [];

    return Object.entries(dict).map(([name, data]) => ({
      name,
      ...(data || {})
    }));
  };

  const getDuelistTechniquesByLevel = () => {
    const all = getAllTechniquesFromDataset();
    return getDuelistEligibleTechniques(all, Number(level) || 1);
  };

  const getDuelistPickCount = () => Object.values(duelistTechniquePicks).flat().length;

  const toggleDuelistPick = (_lvlIgnored, techniqueName) => {
    const lvl = 1;
    const progression = getDuelistTechniqueProgression(Number(level) || 1);
    setDuelistTechniquePicks((prev) => {
      const current = prev[lvl] || [];
      const exists = current.some((n) => normalizeTechniqueName(n) === normalizeTechniqueName(techniqueName));

      if (exists) {
        return { ...prev, [lvl]: current.filter((n) => normalizeTechniqueName(n) !== normalizeTechniqueName(techniqueName)) };
      }

      const cap = progression.requiredPickCount;
      if (current.length >= cap) return prev;

      return { ...prev, [lvl]: [...current, techniqueName] };
    });
  };

  const validateDuelistTechniqueSelections = () => {
    const need = getDuelistTechniqueProgression(Number(level) || 1).requiredPickCount;
    const have = getDuelistPickCount();
    if (have !== need) {
      return {
        ok: false,
        message: `Duelist techniques: Select exactly ${need} technique(s) for level ${Number(level) || 1}. (Selected ${have})`
      };
    }
    return { ok: true, message: '' };
  };

  const getFinalDuelistTechniqueBookNames = () => {
    const allTechniques = getAllTechniquesFromDataset();
    const chosen = Object.values(duelistTechniquePicks).flat();
    const result = buildDuelistTechniqueBookForLevel({
      allTechniques,
      level: Number(level) || 1,
      pickedTechniqueNames: chosen,
    });
    return result.techniqueBook.map((sp) => sp.name);
  };

  const getFinalDuelistTechniqueBookObjects = () => {
    const allTechniques = getAllTechniquesFromDataset();
    const chosen = Object.values(duelistTechniquePicks).flat();
    const result = buildDuelistTechniqueBookForLevel({
      allTechniques,
      level: Number(level) || 1,
      pickedTechniqueNames: chosen,
    });
    return result.techniqueBook;
  };

  // Helper function to check if a skill is already in profession skills
  const isSkillInProfessionSkills = (skillName, professionSkillsList) => {
    const normalized = normalizeSkillName(skillName);
    return professionSkillsList.some(professionSkill => {
      const normalizedProfession = normalizeSkillName(professionSkill);
      // Check for exact match or if one contains the other
      return normalizedProfession === normalized || 
             normalizedProfession.includes(normalized) || 
             normalized.includes(normalizedProfession);
    });
  };

  // Calculate skill gains for level progression
  const calculateSkillGains = (professionData, currentLevel, previousLevel) => {
    if (!professionData || currentLevel <= previousLevel) {
      return { elective: 0, secondary: 0 };
    }
    
    let electiveGains = 0;
    let secondaryGains = 0;
    
    // Check elective skill gains
    if (professionData.electiveSkills) {
      const electiveLevels = Object.keys(professionData.electiveSkills)
        .filter(key => key.startsWith('level'))
        .map(key => parseInt(key.replace('level', '')))
        .sort((a, b) => a - b);
      
      electiveLevels.forEach(threshold => {
        if (currentLevel >= threshold && previousLevel < threshold) {
          electiveGains += professionData.electiveSkills[`level${threshold}`] || 0;
        }
      });
    }
    
    // Check secondary skill gains
    if (professionData.secondarySkills) {
      const secondaryLevels = Object.keys(professionData.secondarySkills)
        .filter(key => key.startsWith('level'))
        .map(key => parseInt(key.replace('level', '')))
        .sort((a, b) => a - b);
      
      secondaryLevels.forEach(threshold => {
        if (currentLevel >= threshold && previousLevel < threshold) {
          secondaryGains += professionData.secondarySkills[`level${threshold}`] || 0;
        }
      });
    }
    
    return { elective: electiveGains, secondary: secondaryGains };
  };

  // Update level handler to properly handle string/number conversion
  const handleLevelChange = (e) => {
    const value = e.target.value;
    if (value === '' || (parseInt(value) > 0 && !isNaN(parseInt(value)))) {
      const newLevel = parseInt(value) || 1;
      const oldLevel = parseInt(level) || 1;
      
      // If level increased and profession is selected, check for skill gains
      if (newLevel > oldLevel && professionData) {
        const skillGains = calculateSkillGains(professionData, newLevel, oldLevel);
        
        if (skillGains.elective > 0 || skillGains.secondary > 0) {
          // Store pending level change and show skill selection modal
          setPendingLevelChange(value);
          setPendingSkillSelections({
            elective: { count: skillGains.elective, selected: [] },
            secondary: { count: skillGains.secondary, selected: [] }
          });
          setShowSkillSelectionModal(true);
          // Don't update level yet - wait for skill selection
          return;
        }
      }
      
      // If level decreased or no skill gains, update normally
      setPreviousLevel(oldLevel);
      setLevel(value);
    }
  };

  // Handle skill selection completion
  const handleSkillSelectionComplete = () => {
    const { elective, secondary } = pendingSkillSelections;
    
    // Validate selections match required counts
    if (elective.count > 0 && elective.selected.length !== elective.count) {
      alert(`Please select exactly ${elective.count} elective skill(s).`);
      return;
    }
    
    if (secondary.count > 0 && secondary.selected.length !== secondary.count) {
      alert(`Please select exactly ${secondary.count} secondary skill(s).`);
      return;
    }
    
    // Add new elective skills
    if (elective.selected.length > 0) {
      setElectiveSkills(prev => [...prev, ...elective.selected]);
    }
    
    // Add new secondary skills
    if (secondary.selected.length > 0) {
      setSecondarySkills(prev => [...prev, ...secondary.selected]);
    }
    
    // Update level and close modal
    const oldLevel = parseInt(level) || 1;
    setPreviousLevel(oldLevel);
    if (pendingLevelChange) {
      setLevel(pendingLevelChange);
    }
    setShowSkillSelectionModal(false);
    setPendingLevelChange(null);
    setPendingSkillSelections({ elective: { count: 0, selected: [] }, secondary: { count: 0, selected: [] } });
  };

  // Handle skill selection cancellation (revert level)
  const handleSkillSelectionCancel = () => {
    setShowSkillSelectionModal(false);
    setPendingLevelChange(null);
    setPendingSkillSelections({ elective: { count: 0, selected: [] }, secondary: { count: 0, selected: [] } });
    // Level stays at previous value
  };

  if (loading) {
    return <DiceLoadingSpinner />;
  }

  return (
    <div className="character-creation-page">
      <div className="character-creation" style={{ display: 'flex', flexDirection: 'column' }}>
        <h1 className="page-title">Character Creator</h1>
        
        <section className="creation-section" style={{ order: 0 }}>
          <h2 className="section-title">Character Identity</h2>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="character-name">Character Name</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  id="character-name"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  placeholder="Enter character name..."
                  className="text-input"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={handleGenerateRandomName}
                  className="auto-name-button"
                  title="Generate random name"
                >
                  Random Name
                </button>
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="gender-select">Gender</label>
              <select
                id="gender-select"
                value={gender}
                onChange={e => setGender(e.target.value)}
                disabled={attributesRolled}
                className={attributesRolled ? 'disabled-select' : 'select-input'}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="character-age">Age</label>
              <input
                type="number"
                id="character-age"
                min="1"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Enter age..."
                className="number-input"
              />
            </div>
          </div>

          <div className="checkbox-group">
            <label htmlFor="useCryptoRandom" className="checkbox-label">
              <input
                type="checkbox"
                id="useCryptoRandom"
                checked={useCryptoRandom}
                onChange={(e) => setUseCryptoRandom(e.target.checked)}
                className="checkbox-input"
              />
              <span className="checkbox-text">Use Cryptographic Randomness</span>
            </label>
          </div>
        </section>

        <section className="creation-section" style={{ order: 7 }}>
          <h2 className="section-title">Determine Ability Scores</h2>
          
          <div className="background-info">
            <div className="background-section">
              <div className="info-item">
                <strong>Standard Array:</strong> 15, 14, 13, 12, 10, 8
              </div>
              <div className="info-item">
                <strong>Random Generation:</strong> Roll four d6 and keep the highest three, six times.
              </div>
              <div className="info-item">
                <strong>Point Cost:</strong> 27 points. Placeholder only in this pass.
              </div>
            </div>
          </div>

          <div className="button-row">
            <button
              type="button"
              onClick={() => handleAbilityScoreMethodChange('standard-array')}
              className={abilityScoreMethod === 'standard-array' ? 'primary-button' : 'secondary-button'}
            >
              Standard Array
            </button>
            <button
              type="button"
              onClick={handleGenerateRandomAbilityScores}
              className={abilityScoreMethod === 'random-generation' ? 'primary-button' : 'secondary-button'}
            >
              Random Generation
            </button>
            <button
              type="button"
              disabled
              className="secondary-button disabled-button"
              title={`Point Cost table: ${Object.entries(POINT_COSTS).map(([score, cost]) => `${score}=${cost}`).join(', ')}`}
            >
              Point Cost
            </button>
          </div>

          <div className="background-info">
            <h3>Generated Scores</h3>
            <p>{generatedAbilityScores.length > 0 ? generatedAbilityScores.join(', ') : 'Choose Random Generation to roll scores.'}</p>
            {abilityScoreMethod === 'point-cost' && (
              <p>Point Cost total: {pointCostTotal}/27</p>
            )}
          </div>

          <div className="background-info">
            <h3>Assign Scores</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {PUBLIC_ABILITIES.map((ability) => (
                <div key={ability.id} className="form-group">
                  <label htmlFor={`ability-${ability.id}`}>{ability.name}</label>
                  <select
                    id={`ability-${ability.id}`}
                    value={abilityAssignments[ability.id] ?? ''}
                    onChange={(event) => handleAbilityAssignmentChange(ability.id, event.target.value)}
                    className="select-input"
                    disabled={generatedAbilityScores.length !== 6}
                  >
                    <option value="">Assign score</option>
                    {generatedAbilityScores.map((score, index) => {
                      const value = String(index);
                      const isAssignedElsewhere = assignedScoreIndexes.has(value) && abilityAssignments[ability.id] !== value;
                      return (
                        <option key={`${score}-${index}`} value={value} disabled={isAssignedElsewhere}>
                          {score}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="background-info">
            <h3>Background Ability Increases</h3>
            {(backgroundAbilityOptions || []).length >= 3 ? (
              <>
                <div className="button-row">
                  <button
                    type="button"
                    onClick={() => setBackgroundAbilityMode('split')}
                    className={backgroundAbilityMode === 'split' ? 'primary-button' : 'secondary-button'}
                  >
                    +2 / +1
                  </button>
                  <button
                    type="button"
                    onClick={() => setBackgroundAbilityMode('all')}
                    className={backgroundAbilityMode === 'all' ? 'primary-button' : 'secondary-button'}
                  >
                    +1 / +1 / +1
                  </button>
                </div>
                {backgroundAbilityMode === 'split' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                    <div className="form-group">
                      <label htmlFor="background-plus-two">Increase by +2</label>
                      <select
                        id="background-plus-two"
                        value={backgroundPlusTwoAbility}
                        onChange={(event) => setBackgroundPlusTwoAbility(event.target.value)}
                        className="select-input"
                      >
                        <option value="">Choose ability</option>
                        {backgroundAbilityOptions.map((abilityId) => (
                          <option key={abilityId} value={abilityId} disabled={abilityId === backgroundPlusOneAbility}>
                            {formatAttributeLabel(abilityId)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="background-plus-one">Increase by +1</label>
                      <select
                        id="background-plus-one"
                        value={backgroundPlusOneAbility}
                        onChange={(event) => setBackgroundPlusOneAbility(event.target.value)}
                        className="select-input"
                      >
                        <option value="">Choose ability</option>
                        {backgroundAbilityOptions.map((abilityId) => (
                          <option key={abilityId} value={abilityId} disabled={abilityId === backgroundPlusTwoAbility}>
                            {formatAttributeLabel(abilityId)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                {backgroundAbilityMode === 'all' && (
                  <p>Increasing {backgroundAbilityOptions.map(formatAttributeLabel).join(', ')} by +1.</p>
                )}
              </>
            ) : (
              <p>Choose a background to apply ability increases.</p>
            )}
          </div>

          <table id="attributes-table">
            <thead>
              <tr>
                <th>Ability</th>
                <th>Base Score</th>
                <th>Background Bonus</th>
                <th>Final Score</th>
                <th>Modifier</th>
              </tr>
            </thead>
            <tbody>
              {PUBLIC_ABILITIES.map((ability) => (
                <tr key={ability.id}>
                  <td>{ability.name}</td>
                  <td>{baseAbilityScores[ability.id] ?? '-'}</td>
                  <td>+{backgroundAbilityBonuses[ability.id] || 0}</td>
                  <td>{finalAbilityScores[ability.id] ?? '-'}</td>
                  <td>
                    {abilityModifiers[ability.id] !== undefined
                      ? `${abilityModifiers[ability.id] >= 0 ? '+' : ''}${abilityModifiers[ability.id]}`
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="button-row">
            <Button
              onClick={rollHP}
              disabled={hp !== null || !allPublicAbilitiesAssigned}
              className="secondary-button"
            >
              {hp !== null ? `HP: ${hp}` : 'Roll HP'}
            </Button>
          </div>
        </section>

        <section className="creation-section" style={{ order: 4 }}>
          <h2 className="section-title">Determine Origin: Species</h2>
          <div className="form-group">
            <label htmlFor="public-species">Species</label>
            <select
              id="public-species"
              value={publicSpeciesId}
              onChange={(e) => handlePublicSpeciesSelection(e.target.value)}
              disabled={attributesRolled}
              className={attributesRolled ? 'disabled-select' : 'select-input'}
            >
              {publicSpeciesOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
          {selectedPublicSpecies && (
            <div className="background-info">
              <div className="background-section">
                <div className="info-item">
                  <strong>Description:</strong> {selectedPublicSpecies.description}
                </div>
                <div className="info-item">
                  <strong>Creature Type:</strong> {selectedPublicSpecies.creatureType}
                </div>
                <div className="info-item">
                  <strong>Size:</strong> {selectedPublicSpecies.sizeOptions.join(', ')}
                </div>
                <div className="info-item">
                  <strong>Speed:</strong> {selectedPublicSpecies.speed} ft.
                </div>
                <div className="info-item">
                  <strong>Traits:</strong> {selectedPublicSpecies.traits.join(', ')}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="creation-section" style={{ order: 5 }}>
          <h2 className="section-title">Determine Origin: Languages</h2>
          <div className="background-info">
            <div className="background-section">
              <div className="info-item">
                <strong>Included:</strong> Common
              </div>
              <div className="info-item">
                <strong>Additional Languages:</strong> Choose two.
              </div>
              <div>
                {publicLanguageOptions
                  .filter((language) => language.id !== 'common')
                  .map((language) => (
                    <label
                      key={language.id}
                      style={{ display: 'block', marginBottom: '8px' }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPublicLanguageIds.includes(language.id)}
                        disabled={
                          !selectedPublicLanguageIds.includes(language.id) &&
                          selectedPublicLanguageIds.length >= 2
                        }
                        onChange={() => togglePublicLanguageChoice(language.id)}
                      />
                      {' '}
                      {language.name}
                    </label>
                  ))}
              </div>
              <div className="info-item">
                <strong>Selected:</strong> {selectedPublicLanguages.map((language) => language.name).join(', ')}
              </div>
            </div>
          </div>
        </section>

        {(selectedPublicClass || selectedPublicBackground) && (
          <section className="creation-section" style={{ order: 2 }}>
            <h2 className="section-title">Proficiencies</h2>
            {(publicSkillSuggestions.fixed.length > 0 || publicSkillSuggestions.background.length > 0) && (
              <div className="background-info">
                <h3>Suggested Proficiencies</h3>
                <ul>
                  {publicSkillSuggestions.fixed.map((skill) => (
                    <li key={`fixed-${skill.id}`}>
                      {skill.name}{skill.ability ? ` (${skill.ability.toUpperCase()})` : ''}
                      {skill.description ? ` - ${skill.description}` : ''}
                    </li>
                  ))}
                  {publicSkillSuggestions.background.map((skill) => (
                    <li key={`background-${skill.id}`}>
                      {skill.name}{skill.ability ? ` (${skill.ability.toUpperCase()})` : ''}
                      {skill.description ? ` - ${skill.description}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {publicSkillSuggestions.choices.length > 0 && (
              <div className="background-info">
                <h3>Selected Proficiencies</h3>
                <p>
                  Selected {publicSkillMetadata.choices.length}/{publicSkillSuggestions.choiceCount}
                </p>
                <div>
                  {publicSkillSuggestions.choices.map((skill) => (
                    <label
                      key={`choice-${skill.id}`}
                      style={{ display: 'block', marginBottom: '8px' }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPublicSkillIds.includes(skill.id)}
                        disabled={
                          !selectedPublicSkillIds.includes(skill.id) &&
                          publicSkillSuggestions.choiceCount > 0 &&
                          publicSkillMetadata.choices.length >= publicSkillSuggestions.choiceCount
                        }
                        onChange={() => togglePublicSkillChoice(skill.id)}
                      />
                      {' '}
                      {skill.name}{skill.ability ? ` (${skill.ability.toUpperCase()})` : ''}
                      {skill.description ? ` - ${skill.description}` : ''}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {selectedPublicSpecies?.id === 'human' && (
          <section className="creation-section" style={{ order: 4 }}>
            <h2 className="section-title">Human Visual Profile (v1)</h2>
            <HumanPreviewPanel
              stats={humanStatsForVisuals}
              onVisualProfileChange={setVisualProfile}
            />
          </section>
        )}


        <section className="creation-section" style={{ order: 3 }}>
          <h2 className="section-title">Determine Origin: Background</h2>

          <div className="form-group">
            <label htmlFor="public-background">Background:</label>
            <select
              id="public-background"
              value={publicBackgroundId}
              onChange={(event) => setPublicBackgroundId(event.target.value)}
              className="select-input"
            >
              {publicBackgrounds.map((background) => (
                <option key={background.id} value={background.id}>
                  {background.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="background-info">
            <h3>Background Information</h3>
            {selectedPublicBackground && (
              <div className="background-section">
                <div className="info-item">
                  <strong>Background:</strong> {selectedPublicBackground.name}
                </div>
                <div className="info-item">
                  <strong>Description:</strong> {selectedPublicBackground.description}
                </div>
                <div className="info-item">
                  <strong>Feature:</strong> {selectedPublicBackground.feature}
                </div>
                {(selectedPublicBackground.abilityScoreOptions || []).length > 0 && (
                  <div className="info-item">
                    <strong>Ability Score Options:</strong> {selectedPublicBackground.abilityScoreOptions.map(formatAttributeLabel).join(', ')}
                  </div>
                )}
                {selectedPublicBackground.originFeat && (
                  <div className="info-item">
                    <strong>Origin Feat:</strong> {selectedPublicBackground.originFeat}
                  </div>
                )}
                <div className="info-item">
                <strong>Proficiencies:</strong> {publicSkillSuggestions.background.map((skill) => skill.name).join(', ')}
                </div>
                {(selectedPublicBackground.toolProficiencies || []).length > 0 && (
                  <div className="info-item">
                <strong>Tool Proficiencies:</strong> {selectedPublicBackground.toolProficiencies.join(', ')}
                  </div>
                )}
                {(selectedPublicBackground.equipmentTags || []).length > 0 && (
                  <div className="info-item">
                    <strong>Equipment Tags:</strong> {selectedPublicBackground.equipmentTags.join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {attributes.IQ && species && (
          <section className="creation-section" style={{ order: 11 }}>
            <h2 className="section-title">Tactics</h2>
            <TacticsRoll
              IQ={attributes.IQ}
              mentalEndurance={attributes.ME || 0}
              species={species}
              onRollTactics={handleTacticsRoll}
            />
          </section>
        )}

        <section className="creation-section" style={{ order: 1 }}>
          <h2 className="section-title">Choose Class</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            {/* Class Selection Column */}
            <div>
          {renderClassSelection()}
            </div>

            {/* Level Selection Column */}
            <div>
          <div className="form-group level-selector">
            <label htmlFor="character-level">Select Level (1-15):</label>
            <input
              type="number"
              id="character-level"
              min="1"
              max="15"
              value={level}
              onChange={handleLevelChange}
              className="number-input level-input"
                  style={{ width: '100%', fontSize: '18px', padding: '10px', marginBottom: '15px' }}
            />
            <div className="level-info">
                  <p style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px' }}>
                    Current Level: <strong style={{ color: '#2d3748', fontSize: '20px' }}>{level}</strong>
                  </p>
                  
                  {/* Skill Gains Info */}
                  {professionData && parseInt(level) > 1 && (() => {
                    const skillGains = calculateSkillGains(professionData, parseInt(level), 1);
                    return (
                      <div style={{ 
                        backgroundColor: '#e6fffa', 
                        padding: '10px', 
                        borderRadius: '5px', 
                        marginBottom: '15px',
                        border: '1px solid #81e6d9'
                      }}>
                        <p style={{ margin: '5px 0', fontSize: '14px', fontWeight: 'bold', color: '#234e52' }}>
                          Skills Available:
                        </p>
                        {skillGains.elective > 0 && (
                          <p style={{ margin: '3px 0', fontSize: '13px', color: '#2c7a7b' }}>
                            Elective: {skillGains.elective} skill(s)
                          </p>
                        )}
                        {skillGains.secondary > 0 && (
                          <p style={{ margin: '3px 0', fontSize: '13px', color: '#2c7a7b' }}>
                            Secondary: {skillGains.secondary} skill(s)
                          </p>
                        )}
                        {skillGains.elective === 0 && skillGains.secondary === 0 && (
                          <p style={{ margin: '3px 0', fontSize: '13px', color: '#718096' }}>
                            No new skills at this level
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
          
          {/* STRICT Duelist Technique Selection */}
        {isStrictDuelist(characterClass) && (
          <section className="creation-section">
            <h2 className="section-title">Duelist Technique Book (Strict)</h2>

            <div style={{ background: '#f7fafc', border: '1px solid #cbd5e0', borderRadius: 8, padding: 12 }}>
              <h3 style={{ marginTop: 0 }}>Common Knowledge (Locked)</h3>
              <ul style={{ marginTop: 6 }}>
                {DUELIST_COMMON_TECHNIQUE_NAMES.map((n) => (
                  <li key={n} style={{ opacity: 0.9 }}>
                    {n}
                  </li>
                ))}
              </ul>

              <div style={{ marginTop: 12 }}>
                <label style={{ fontWeight: 'bold' }}>Search techniques:</label>
                <input
                  type="text"
                  value={duelistTechniqueSearch}
                  onChange={(e) => setDuelistTechniqueSearch(e.target.value)}
                  placeholder="Type to filter by name..."
                  className="text-input"
                  style={{ width: '100%', marginTop: 6 }}
                />
              </div>

              {(() => {
                const lvl = 1;
                const progression = getDuelistTechniqueProgression(Number(level) || 1);
                const cap = progression.requiredPickCount;
                const picked = duelistTechniquePicks[lvl] || [];
                const available = getDuelistTechniquesByLevel(lvl).filter(
                  (sp) => !DUELIST_COMMON_TECHNIQUE_NAMES.some((n) => normalizeTechniqueName(n) === normalizeTechniqueName(sp?.name))
                );

                const filtered = available.filter((sp) =>
                  normalizeTechniqueName(sp?.name).includes(normalizeTechniqueName(duelistTechniqueSearch))
                );

                return (
                  <div key={lvl} style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
                    <h3 style={{ margin: 0 }}>
                      Duelist Techniques (Levels 1-{progression.maxTechniqueLevel}) - Selected {picked.length}/{cap}
                    </h3>

                    {filtered.length === 0 ? (
                      <p style={{ color: '#718096', marginTop: 8 }}>
                        No Level 1 techniques found in your dataset (or none match the search).
                      </p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8, marginTop: 10 }}>
                        {filtered.map((sp) => {
                          const name = sp?.name || 'Unnamed Technique';
                          const isPicked = picked.some((n) => normalizeTechniqueName(n) === normalizeTechniqueName(name));
                          const isDisabled = !isPicked && picked.length >= cap;

                          return (
                            <button
                              key={name}
                              type="button"
                              onClick={() => toggleDuelistPick(1, name)}
                              disabled={isDisabled}
                              style={{
                                textAlign: 'left',
                                padding: 10,
                                borderRadius: 8,
                                border: isPicked ? '2px solid #48bb78' : '1px solid #cbd5e0',
                                background: isPicked ? '#f0fff4' : 'white',
                                opacity: isDisabled ? 0.5 : 1,
                                cursor: isDisabled ? 'not-allowed' : 'pointer'
                              }}
                              title={`${sp?.description || name}\n\nRange: ${sp?.range ?? '?'}\nDuration: ${sp?.duration ?? '?'}\nstamina: ${sp?.stamina ?? '?'}`}
                            >
                              <div style={{ fontWeight: 'bold' }}>
                                {isPicked ? 'Selected: ' : ''}{name}
                              </div>
                              <div style={{ fontSize: 12, color: '#4a5568', marginTop: 4 }}>
                                Stamina: {sp?.stamina ?? '?'} | Range: {sp?.range ?? '?'} | Duration: {sp?.duration ?? '?'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setDuelistTechniquePicks({ 1: [] })}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e0',
                    background: 'white',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  Reset Picks
                </button>

                <div style={{ alignShuman: 'center', color: '#2d3748' }}>
                  Required picks at level {Number(level) || 1}: {getDuelistTechniqueProgression(Number(level) || 1).requiredPickCount}
                </div>
              </div>

              {/* TechniqueBook Summary */}
              <div style={{ marginTop: 16, padding: 12, borderRadius: 8, border: '1px solid #cbd5e0', background: 'white' }}>
                <h3 style={{ marginTop: 0, marginBottom: 8 }}>Final Technique Book Summary</h3>

                {(() => {
                  const v = validateDuelistTechniqueSelections();
                  return (
                    <div style={{ marginBottom: 10, fontWeight: 'bold', color: v.ok ? '#2f855a' : '#c53030' }}>
                      {v.ok ? 'Technique selections complete (Strict)' : v.message}
                    </div>
                  );
                })()}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: 6 }}>Locked Common Techniques</div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {DUELIST_COMMON_TECHNIQUE_NAMES.map((n) => (
                        <li key={n}>{n}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: 6 }}>Chosen Level 1 Techniques</div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {(duelistTechniquePicks[1] || []).length === 0 ? (
                        <li style={{ color: '#718096' }}>None yet</li>
                      ) : (
                        (duelistTechniquePicks[1] || []).map((title) => (
                          <li key={title}>{title}</li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>

                <div style={{ marginTop: 10, color: '#4a5568', fontSize: 13 }}>
                  Total techniques: <strong>{DUELIST_COMMON_TECHNIQUE_NAMES.length + (duelistTechniquePicks[1]?.length || 0)}</strong>
                  {' '}({DUELIST_COMMON_TECHNIQUE_NAMES.length} common + {(duelistTechniquePicks[1]?.length || 0)} chosen)
                </div>
              </div>
            </div>
          </section>
        )}

          {/* Level Stats Display - Shows below both columns */}
              {professionData && (
            <div className="level-stats" style={{
              backgroundColor: '#f7fafc',
              padding: '20px',
              borderRadius: '8px',
              border: '2px solid #cbd5e0',
              marginTop: '20px'
            }}>
              <h3 style={{ marginTop: 0, color: '#2d3748', borderBottom: '2px solid #cbd5e0', paddingBottom: '10px' }}>
                Level {level} Statistics
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '15px' }}>
                <div className="stat-row" style={{ 
                  backgroundColor: 'white', 
                  padding: '10px', 
                  borderRadius: '5px',
                  border: '1px solid #e2e8f0'
                }}>
                  <span style={{ fontWeight: 'bold', color: '#4a5568' }}>HP:</span>
                  <strong style={{ color: '#e53e3e', fontSize: '18px' }}>{levelStats.hp || 'Roll attributes first'}</strong>
                    <button
                      onClick={() => setUseDeterministicHP(!useDeterministicHP)}
                      className={`hp-toggle-btn ${useDeterministicHP ? 'deterministic' : 'random'}`}
                      title={useDeterministicHP ? 'Using average HP values (click to use random rolls)' : 'Using random HP rolls (click to use averages)'}
                    style={{ marginLeft: '10px', cursor: 'pointer' }}
                    >
                      {useDeterministicHP ? 'Average' : 'Random'}
                    </button>
                  </div>
                <div className="stat-row" style={{ 
                  backgroundColor: 'white', 
                  padding: '10px', 
                  borderRadius: '5px',
                  border: '1px solid #e2e8f0'
                }}>
                  <span style={{ fontWeight: 'bold', color: '#4a5568' }}>Actions per Round:</span>
                  <strong style={{ color: '#2d3748', fontSize: '18px' }}>{levelStats.actionsPerRound ?? 2}</strong>
                  </div>
                <div className="stat-row" style={{ 
                  backgroundColor: 'white', 
                  padding: '10px', 
                  borderRadius: '5px',
                  border: '1px solid #e2e8f0'
                }}>
                  <span style={{ fontWeight: 'bold', color: '#4a5568' }}>Training Check:</span>
                  <strong style={{ color: '#2d3748', fontSize: '18px' }}>{levelStats.saves?.vsTraining ?? 14}</strong>
                  </div>
                <div className="stat-row" style={{ 
                  backgroundColor: 'white', 
                  padding: '10px', 
                  borderRadius: '5px',
                  border: '1px solid #e2e8f0'
                }}>
                  <span style={{ fontWeight: 'bold', color: '#4a5568' }}>Poison Check:</span>
                  <strong style={{ color: '#2d3748', fontSize: '18px' }}>{levelStats.saves?.vsPoison ?? 14}</strong>
                  </div>
                <div className="stat-row" style={{ 
                  backgroundColor: 'white', 
                  padding: '10px', 
                  borderRadius: '5px',
                  border: '1px solid #e2e8f0'
                }}>
                  <span style={{ fontWeight: 'bold', color: '#4a5568' }}>Tactics Check:</span>
                  <strong style={{ color: '#2d3748', fontSize: '18px' }}>{levelStats.saves?.vsTactics ?? 15}</strong>
                  </div>
                <div className="stat-row" style={{ 
                  backgroundColor: 'white', 
                  padding: '10px', 
                  borderRadius: '5px',
                  border: '1px solid #e2e8f0'
                }}>
                  <span style={{ fontWeight: 'bold', color: '#4a5568' }}>Attack Bonus:</span>
                  <strong style={{ color: '#38a169', fontSize: '18px' }}>+{levelStats.combatBonuses?.attack ?? 0}</strong>
                  </div>
                <div className="stat-row" style={{ 
                  backgroundColor: 'white', 
                  padding: '10px', 
                  borderRadius: '5px',
                  border: '1px solid #e2e8f0'
                }}>
                  <span style={{ fontWeight: 'bold', color: '#4a5568' }}>Block Bonus:</span>
                  <strong style={{ color: '#38a169', fontSize: '18px' }}>+{levelStats.combatBonuses?.block ?? 0}</strong>
                  </div>
                <div className="stat-row" style={{ 
                  backgroundColor: 'white', 
                  padding: '10px', 
                  borderRadius: '5px',
                  border: '1px solid #e2e8f0'
                }}>
                  <span style={{ fontWeight: 'bold', color: '#4a5568' }}>Evade Bonus:</span>
                  <strong style={{ color: '#38a169', fontSize: '18px' }}>+{levelStats.combatBonuses?.evade ?? 0}</strong>
                  </div>
                <div className="stat-row" style={{ 
                  backgroundColor: 'white', 
                  padding: '10px', 
                  borderRadius: '5px',
                  border: '1px solid #e2e8f0'
                }}>
                  <span style={{ fontWeight: 'bold', color: '#4a5568' }}>Damage Bonus:</span>
                  <strong style={{ color: '#38a169', fontSize: '18px' }}>+{levelStats.combatBonuses?.damage ?? 0}</strong>
                  </div>
                <div className="stat-row" style={{ 
                  backgroundColor: 'white', 
                  padding: '10px', 
                  borderRadius: '5px',
                  border: '1px solid #e2e8f0'
                }}>
                  <span style={{ fontWeight: 'bold', color: '#4a5568' }}>Initiative Bonus:</span>
                  <strong style={{ color: '#38a169', fontSize: '18px' }}>+{levelStats.initiativeBonus ?? 0}</strong>
                  </div>
                {(levelStats.speedBonus ?? 0) !== 0 && (
                <div className="stat-row" style={{ 
                  backgroundColor: 'white', 
                  padding: '10px', 
                  borderRadius: '5px',
                  border: '1px solid #e2e8f0'
                }}>
                  <span style={{ fontWeight: 'bold', color: '#4a5568' }}>Speed Bonus:</span>
                  <strong style={{ color: '#38a169', fontSize: '18px' }}>+{levelStats.speedBonus ?? 0}</strong>
                  </div>
                )}
                <div className="stat-row" style={{ 
                  backgroundColor: 'white', 
                  padding: '10px', 
                  borderRadius: '5px',
                  border: '1px solid #e2e8f0'
                }}>
                  <span style={{ fontWeight: 'bold', color: '#4a5568' }}>Courage Check:</span>
                  <strong style={{ color: '#2d3748', fontSize: '18px' }}>{levelStats.saves?.courageCheck ?? 12}</strong>
                  </div>
                  {levelStats.stamina > 0 && (
                  <div className="stat-row" style={{ 
                    backgroundColor: 'white', 
                    padding: '10px', 
                    borderRadius: '5px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <span style={{ fontWeight: 'bold', color: '#4a5568' }}>Stamina:</span>
                    <strong style={{ color: '#805ad5', fontSize: '18px' }}>{levelStats.stamina}</strong>
                    </div>
                  )}
                  {levelStats.focus > 0 && (
                  <div className="stat-row" style={{ 
                    backgroundColor: 'white', 
                    padding: '10px', 
                    borderRadius: '5px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <span style={{ fontWeight: 'bold', color: '#4a5568' }}>Focus:</span>
                    <strong style={{ color: '#805ad5', fontSize: '18px' }}>{levelStats.focus}</strong>
                    </div>
                  )}
                  {(levelStats.focusBonus ?? 0) > 0 && (
                  <div className="stat-row" style={{ 
                    backgroundColor: 'white', 
                    padding: '10px', 
                    borderRadius: '5px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <span style={{ fontWeight: 'bold', color: '#4a5568' }}>Focus Bonus:</span>
                    <strong style={{ color: '#805ad5', fontSize: '18px' }}>+{levelStats.focusBonus ?? 0}</strong>
                    </div>
                  )}
                  {(levelStats.focusRecovery ?? 1) > 1 && (
                  <div className="stat-row" style={{ 
                    backgroundColor: 'white', 
                    padding: '10px', 
                    borderRadius: '5px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <span style={{ fontWeight: 'bold', color: '#4a5568' }}>Focus Recovery:</span>
                    <strong style={{ color: '#805ad5', fontSize: '18px' }}>{levelStats.focusRecovery ?? 1}</strong>
                    </div>
                  )}
                </div>
              <div className="hp-info" style={{ marginTop: '15px', padding: '10px', backgroundColor: '#edf2f7', borderRadius: '5px' }}>
                <small style={{ color: '#4a5568', fontStyle: 'italic', fontSize: '13px' }}>
                  Willpower Check: {(() => {
                    const peBonus = Math.floor((attributes.PE || 0) / 4);
                    const currentLevel = parseInt(level) || 1;
                    const calculatedHP = useDeterministicHP ? 
                      calculateCreatorHP(currentLevel, peBonus, hp || 10) :
                      hp || 10;
                    return calculatedHP;
                  })()} HP
                </small>
              </div>
              
              {/* Skill Bonuses Section */}
              {(professionSkills.length > 0 || electiveSkills.length > 0 || secondarySkills.length > 0) && (
                <div className="skill-bonuses-section" style={{ marginTop: '20px' }}>
                  {/* General Skill Bonuses */}
                  {(levelStats.skillBonuses?.attack > 0 || 
                    levelStats.skillBonuses?.block > 0 || 
                    levelStats.skillBonuses?.evade > 0 || 
                    levelStats.skillBonuses?.damage > 0 ||
                    levelStats.skillBonuses?.actionsPerRound > 0) && (
                    <div className="general-skill-bonuses">
                      <h4>Active Skill Bonuses (Always Applied):</h4>
                      <div className="bonus-grid">
                        {levelStats.skillBonuses.attack > 0 && (
                          <div className="bonus-item">
                            <span className="bonus-label">Attack:</span>
                            <span className="bonus-value">+{levelStats.skillBonuses.attack}</span>
                          </div>
                        )}
                        {levelStats.skillBonuses.block > 0 && (
                          <div className="bonus-item">
                            <span className="bonus-label">Block:</span>
                            <span className="bonus-value">+{levelStats.skillBonuses.block}</span>
                          </div>
                        )}
                        {levelStats.skillBonuses.evade > 0 && (
                          <div className="bonus-item">
                            <span className="bonus-label">Evade:</span>
                            <span className="bonus-value">+{levelStats.skillBonuses.evade}</span>
                          </div>
                        )}
                        {levelStats.skillBonuses.damage > 0 && (
                          <div className="bonus-item">
                            <span className="bonus-label">Damage:</span>
                            <span className="bonus-value">+{levelStats.skillBonuses.damage}</span>
                          </div>
                        )}
                        {levelStats.skillBonuses.actionsPerRound > 0 && (
                          <div className="bonus-item">
                            <span className="bonus-label">Actions per Round:</span>
                            <span className="bonus-value">+{levelStats.skillBonuses.actionsPerRound}</span>
                          </div>
                        )}
                      </div>
                      <p className="bonus-note">From: {[...professionSkills, ...electiveSkills, ...secondarySkills]
                        .filter(skill => !skill.startsWith('Weapon Training:') && 
                          ['Hand to Hand: Basic', 'Hand to Hand: Expert', 'Hand to Hand: Mercenary', 
                           'Hand to Hand: Knight', 'Hand to Hand: Assassin', 'Hand to Hand: Martial Arts',
                           'Boxing', 'Wrestling', 'Acrobatics', 'Gymnastics'].includes(skill))
                        .map((skill) => formatPublicCreatorText(skill))
                        .join(', ') || 'Your combat skills'}</p>
                    </div>
                  )}
                  
                  {/* Weapon Proficiencies */}
                  {levelStats.skillBonuses?.weaponProficiencies?.length > 0 && (
                    <div className="weapon-proficiencies">
                      <h4>Weapon Proficiencies (Weapon-Specific):</h4>
                      <ul>
                        {levelStats.skillBonuses.weaponProficiencies.map((wp, index) => {
                          // Recalculate bonuses at current level to ensure they're up to date
                          const currentLevel = parseInt(level) || 1;
                          const levelBasedBonuses = getSkillBonusesAtLevel(wp.name, currentLevel);
                          let bonuses = levelBasedBonuses.bonuses || { attack: 0, block: 0, evade: 0, damage: 0 };
                          
                          // If no progression found, fall back to static bonuses
                          if (bonuses.attack === 0 && bonuses.block === 0 && bonuses.evade === 0 && bonuses.damage === 0) {
                            const staticBonus = staticSkillBonuses[wp.name];
                            if (staticBonus) {
                              bonuses = {
                                attack: staticBonus.attack || 0,
                                block: staticBonus.block || 0,
                                evade: staticBonus.evade || 0,
                                damage: staticBonus.damage || 0,
                              };
                            }
                          }
                          
                          return (
                            <li key={index}>
                              <strong>{wp.name.replace('Weapon Training: ', '')}:</strong>
                              {bonuses.attack > 0 && ` +${bonuses.attack} attack`}
                              {bonuses.block > 0 && ` +${bonuses.block} block`}
                              {bonuses.evade > 0 && ` +${bonuses.evade} evade`}
                              {bonuses.damage > 0 && ` +${bonuses.damage} damage`}
                              <span className="wp-level-note"> (at level {currentLevel})</span>
                            </li>
                          );
                        })}
                      </ul>
                      <p className="wp-note">* Weapon Training bonuses only apply when using that weapon type and improve with level</p>
                    </div>
                  )}
                </div>
              )}
              
              <p className="level-hint" style={{ marginTop: '15px', padding: '10px', backgroundColor: '#edf2f7', borderRadius: '5px', color: '#4a5568', fontSize: '14px' }}>
                Stats update automatically based on your level and class
              </p>
            </div>
          )}
        </section>

        <section className="creation-section" style={{ order: 8 }}>
          <h2 className="section-title">Choose Alignment</h2>
          <div className="form-group">
            <label htmlFor="alignment-outlook">Alignment</label>
            <select
              id="alignment-outlook"
              value={alignment}
              onChange={(e) => setAlignment(e.target.value)}
              className="select-input"
            >
              {publicAlignmentOptions.map((option) => (
                <option key={option.id} value={option.value}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="creation-section action-section" style={{ order: 10 }}>
          <h2 className="section-title">Review / Create</h2>
          <div className="background-info">
            <div className="background-section">
              <div className="info-item">
                <strong>Class:</strong> {selectedPublicClass?.name || 'Not selected'}
              </div>
              <div className="info-item">
                <strong>Background:</strong> {selectedPublicBackground?.name || 'Not selected'}
              </div>
              <div className="info-item">
                <strong>Species:</strong> {selectedPublicSpecies?.name || 'Human'}
              </div>
              <div className="info-item">
                <strong>Languages:</strong> {selectedPublicLanguages.map((language) => language.name).join(', ')}
              </div>
              <div className="info-item">
                <strong>Alignment:</strong> {alignment || 'Unselected'}
              </div>
              <div className="info-item">
                <strong>Proficiencies:</strong> {publicSkillMetadata.proficiencies.join(', ') || 'None selected'}
              </div>
              <div className="info-item">
                <strong>Class Equipment:</strong> {selectedClassEquipmentOption
                  ? `${selectedClassEquipmentOption.label} - ${(selectedClassEquipmentOption.items || []).join(', ') || 'Starting gold'}`
                  : 'None selected'}
              </div>
              <div className="info-item">
                <strong>Background Equipment Tags:</strong> {backgroundEquipmentTags.join(', ') || 'None'}
              </div>
              <div className="info-item">
                <strong>Starting Gold Metadata:</strong> {startingGold} gp
              </div>
              <div className="info-item">
                <strong>Proficiency Bonus:</strong> {formatSignedModifier(publicDerivedStats.proficiencyBonus)}
              </div>
              <div className="info-item">
                <strong>Hit Points:</strong> {publicDerivedStats.hitPoints}
              </div>
              <div className="info-item">
                <strong>Hit Die:</strong> {publicDerivedStats.hitDie}
              </div>
              <div className="info-item">
                <strong>Initiative:</strong> {formatSignedModifier(publicDerivedStats.initiative)}
              </div>
              <div className="info-item">
                <strong>Base AC:</strong> {publicDerivedStats.baseArmorClass}
              </div>
              <div className="info-item">
                <strong>Passive Perception:</strong> {publicDerivedStats.passivePerception}
              </div>
              <details className="info-item">
                <summary><strong>Saving Throws</strong></summary>
                <div className="skill-list">
                  {Object.entries(publicDerivedStats.savingThrows).map(([abilityId, save]) => (
                    <div key={abilityId}>
                      {save.label}: {formatSignedModifier(save.total)}{save.proficient ? ' proficient' : ''}
                    </div>
                  ))}
                </div>
              </details>
              <details className="info-item">
                <summary><strong>Skills</strong></summary>
                <div className="skill-list">
                  {publicDerivedStats.skills.map((skill) => (
                    <div key={skill.id}>
                      {skill.name}: {formatSignedModifier(skill.total)}{skill.proficient ? ' proficient' : ''}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </div>
          <div className="button-row">
            {saveMessage && (
              <Alert status={saveMessage.status} role="status" borderRadius="md">
                <AlertIcon />
                {saveMessage.text}
                {pendingCharacter?.name ? ` ${pendingCharacter.name} remains available on this page.` : ''}
              </Alert>
            )}
            <Button
              onClick={handleSubmit}
              className="create-button"
            >
              Create Character
            </Button>
            <button
              onClick={() => navigate(-1)}
              className="back-button"
            >
              Back
            </button>
          </div>
        </section>
        <section className="creation-section" style={{ order: 6 }}>
          <h2 className="section-title">Determine Origin: Starting Equipment</h2>
          <div className="background-info">
            <div className="background-section">
              <div className="info-item">
                <strong>Class Equipment Options:</strong> {selectedPublicClass?.name || 'Select a class'}
              </div>
              <div>
                {classEquipmentOptions.length > 0 ? (
                  classEquipmentOptions.map((option) => (
                    <label
                      key={option.id}
                      style={{ display: 'block', marginBottom: '10px' }}
                    >
                      <input
                        type="radio"
                        name="class-starting-equipment"
                        value={option.id}
                        checked={selectedClassEquipmentOption?.id === option.id}
                        onChange={() => setSelectedClassEquipmentOptionId(option.id)}
                      />
                      {' '}
                      <strong>{option.label}:</strong> {(option.items || []).join(', ') || 'Starting gold'}
                      {(option.gold || 0) > 0 ? ` (${option.gold} gp)` : ''}
                    </label>
                  ))
                ) : (
                  <p>Select a class to choose starting equipment.</p>
                )}
              </div>
              <div className="info-item">
                <strong>Background Equipment Tags:</strong> {backgroundEquipmentTags.join(', ') || 'Select a background'}
              </div>
              <div className="info-item">
                <strong>Selected Class Equipment:</strong> {selectedClassEquipmentOption
                  ? `${selectedClassEquipmentOption.label} - ${(selectedClassEquipmentOption.items || []).join(', ') || 'Starting gold'}`
                  : 'None selected'}
              </div>
              <div className="info-item">
                <strong>Starting Gold Metadata:</strong> {startingGold} gp
              </div>
              <div className="info-item">
                <strong>Equipment Mechanics:</strong> Existing inventory, equipment, and combat slot rules are unchanged.
              </div>
              {attributes.PS && (
                <>
                  <div className="info-item">
                    <strong>Maximum Carry Weight:</strong> {attributes.PS * 10} lbs
                  </div>
                  <div className="info-item">
                    <strong>Light Activity Duration:</strong> {attributes.PE * 2} minutes
                  </div>
                  <div className="info-item">
                    <strong>Heavy Activity Duration:</strong> {attributes.PE} minutes
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Skill Selection Modal for Level Up */}
      {showSkillSelectionModal && professionData && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="modal-content" style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '10px',
            maxWidth: '800px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <h2 style={{ marginTop: 0, color: '#333' }}>
              Level Up: Select New Skills
            </h2>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              You are leveling up from level {level} to level {pendingLevelChange}. 
              Please select your new skills according to your class progression.
            </p>

            {/* Elective Skills Selection */}
            {pendingSkillSelections.elective.count > 0 && (
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ color: '#4a5568', marginBottom: '10px' }}>
                  Elective Skills (Select {pendingSkillSelections.elective.count}):
                </h3>
                <p style={{ fontSize: '0.9em', color: '#666', marginBottom: '10px' }}>
                  Already selected: {electiveSkills.join(', ')}
                </p>
                <select
                  multiple
                  size="8"
                  value={pendingSkillSelections.elective.selected}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    if (selected.length <= pendingSkillSelections.elective.count) {
                      setPendingSkillSelections(prev => ({
                        ...prev,
                        elective: { ...prev.elective, selected }
                      }));
                    } else {
                      alert(`You can only select ${pendingSkillSelections.elective.count} elective skill(s).`);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '2px solid #cbd5e0',
                    borderRadius: '5px',
                    fontSize: '14px'
                  }}
                >
                  {(() => {
                    // Use all ELECTIVE_SKILLS instead of just the profession's specific list
                    const availableElectiveSkills = ELECTIVE_SKILLS.filter(skill => 
                      !electiveSkills.includes(skill) && 
                      !isSkillInProfessionSkills(skill, professionSkills)
                    );
                    
                    return availableElectiveSkills.map((skill, idx) => {
                      const skillData = gameData.skills?.[skill];
                      const formattedSkill = formatPublicCreatorText(formatSkillWithPercent(skill, professionData.name, parseInt(pendingLevelChange) || parseInt(level) || 1));
                      return (
                        <option key={idx} value={skill} title={skillData?.description || skill}>
                          {formattedSkill}
                        </option>
                      );
                    });
                  })()}
                </select>
                <p style={{ marginTop: '8px', fontSize: '0.9em', color: '#666' }}>
                  Selected: {pendingSkillSelections.elective.selected.length}/{pendingSkillSelections.elective.count}
                </p>
              </div>
            )}

            {/* Secondary Skills Selection */}
            {pendingSkillSelections.secondary.count > 0 && (
              <div style={{ marginBottom: '30px' }}>
                <h3 style={{ color: '#4a5568', marginBottom: '10px' }}>
                  Secondary Skills (Select {pendingSkillSelections.secondary.count}):
                </h3>
                <p style={{ fontSize: '0.9em', color: '#666', marginBottom: '10px' }}>
                  Already selected: {secondarySkills.join(', ') || 'None'}
                </p>
                <p style={{ fontSize: '0.85em', color: '#888', fontStyle: 'italic', marginBottom: '10px' }}>
                  Basic/general skills only - no advanced or class-specific skills
                </p>
                <select
                  multiple
                  size="10"
                  value={pendingSkillSelections.secondary.selected}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    if (selected.length <= pendingSkillSelections.secondary.count) {
                      setPendingSkillSelections(prev => ({
                        ...prev,
                        secondary: { ...prev.secondary, selected }
                      }));
                    } else {
                      alert(`You can only select ${pendingSkillSelections.secondary.count} secondary skill(s).`);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '2px solid #cbd5e0',
                    borderRadius: '5px',
                    fontSize: '14px'
                  }}
                >
                  {(SECONDARY_SKILLS || gameData.secondarySkills || [])
                    ?.filter(skill => !secondarySkills.includes(skill) && !isSkillInProfessionSkills(skill, professionSkills))
                    .map((skill, idx) => {
                      const formattedSkill = formatPublicCreatorText(formatSkillWithPercent(skill, professionData.name, parseInt(pendingLevelChange) || parseInt(level) || 1));
                      return (
                        <option key={idx} value={skill} title={`Basic skill: ${skill}`}>
                          {formattedSkill}
                        </option>
                      );
                    })}
                </select>
                <p style={{ marginTop: '8px', fontSize: '0.9em', color: '#666' }}>
                  Selected: {pendingSkillSelections.secondary.selected.length}/{pendingSkillSelections.secondary.count}
                </p>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                onClick={handleSkillSelectionCancel}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#e2e8f0',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSkillSelectionComplete}
                disabled={
                  (pendingSkillSelections.elective.count > 0 && 
                   pendingSkillSelections.elective.selected.length !== pendingSkillSelections.elective.count) ||
                  (pendingSkillSelections.secondary.count > 0 && 
                   pendingSkillSelections.secondary.selected.length !== pendingSkillSelections.secondary.count)
                }
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#48bb78',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  opacity: (
                    (pendingSkillSelections.elective.count > 0 && 
                     pendingSkillSelections.elective.selected.length !== pendingSkillSelections.elective.count) ||
                    (pendingSkillSelections.secondary.count > 0 && 
                     pendingSkillSelections.secondary.selected.length !== pendingSkillSelections.secondary.count)
                  ) ? 0.5 : 1
                }}
              >
                Complete Level Up
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

CharacterCreator.propTypes = {
  onCreateCharacter: PropTypes.func.isRequired
};

export default CharacterCreator;




