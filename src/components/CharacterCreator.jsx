import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import '../app.css';
import '../styles/CharacterCreation.css';
import { Button } from '@chakra-ui/react';
import psionics from '../data/psionics.json';
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
import palladiumData from "../data/palladium_dataset.json";
import clothingEquipmentData from "../data/clothingEquipment.json";
import traderEquipment from "../data/traderEquipment.js";
import PsionicsRoll from './PsionicsRoll';
import DiceLoadingSpinner from './DiceLoadingSpinner';
// import D20LoadingSpinner from './D20LoadingSpinner'; // Temporarily disabled
import { getStatsForLevel } from '../utils/levelProgression';
import { getRandomName } from '../data/characterNames';
import { occSkillTables } from '../utils/occSkills';
import { lookupSkill, getSkillPercentage } from '../utils/skillSystem';
import { getSkillBonusesAtLevel } from '../data/skillProgression';
import { skillBonuses as staticSkillBonuses } from '../data/skillBonuses';

// Function to get Mind Mage psionics based on level and psionic type
const getMindMagePsionics = async (psionicResult, level) => {
  const powers = [];
  
  // Master psionics get all powers, Major psionics limited to levels 1-3, Minor to level 1 only
  const psionicLevel = psionicResult === "Master Psionic" ? "Master" : 
                       psionicResult === "Major Psionic" ? "Major" : "Minor";
  
  // Level 1: 6 total powers (2 Physical + 2 Sensitive + 2 Healing)
  if (level >= 1) {
    const physicalPowers = psionics.filter(p => p.category === "Physical").slice(0, 2);
    const sensitivePowers = psionics.filter(p => p.category === "Sensitive").slice(0, 2);
    const healingPowers = psionics.filter(p => p.category === "Healing").slice(0, 2);
    
    powers.push(...physicalPowers, ...sensitivePowers, ...healingPowers);
  }
  
  // Level 2: +1 Physical + 1 Sensitive
  if (level >= 2 && psionicLevel !== "Minor") {
    const additionalPhysical = psionics.filter(p => p.category === "Physical")[2];
    const additionalSensitive = psionics.filter(p => p.category === "Sensitive")[2];
    if (additionalPhysical) powers.push(additionalPhysical);
    if (additionalSensitive) powers.push(additionalSensitive);
  }
  
  // Level 3: +1 Healing + 1 Super
  if (level >= 3 && psionicLevel !== "Minor") {
    const additionalHealing = psionics.filter(p => p.category === "Healing")[2];
    const firstSuper = psionics.filter(p => p.category === "Super")[0];
    if (additionalHealing) powers.push(additionalHealing);
    if (firstSuper) powers.push(firstSuper);
  }
  
  // Levels 4-5: +1 Super each level
  if (level >= 4 && psionicLevel !== "Minor") {
    const superPowers = psionics.filter(p => p.category === "Super");
    for (let i = 1; i < Math.min(level - 2, superPowers.length); i++) {
      if (superPowers[i]) powers.push(superPowers[i]);
    }
  }
  
  // Level 6+: Master psionics automatically know all remaining lower powers
  if (level >= 6 && psionicLevel === "Master") {
    const remainingPowers = psionics.filter(p => !powers.includes(p));
    powers.push(...remainingPowers);
  }
  
  return powers;
};

const CharacterCreator = ({ onCreateCharacter }) => {
  const navigate = useNavigate();
  const [species, setSpecies] = useState('HUMAN');
  const [attributes, setAttributes] = useState({});
  const [level, setLevel] = useState('1');
  const [hp, setHp] = useState(null);
  const [alignment, setAlignment] = useState('Good: Principled');
  const [characterName, setCharacterName] = useState('');
  const [age, setAge] = useState('');
  const [socialBackground, setSocialBackground] = useState('');
  const [disposition, setDisposition] = useState('');
  const [hostility, setHostility] = useState('');
  const [origin, setOrigin] = useState('');
  const [bonusRolled, setBonusRolled] = useState(false);
  const [useCryptoRandom, setUseCryptoRandom] = useState(false);
  const [characterClass, setCharacterClass] = useState('');
  const [availableClasses, setAvailableClasses] = useState([]);
  const [filteredClasses, setFilteredClasses] = useState([]);
  const [psionics, setPsionics] = useState(null);
  const [occSkills, setOccSkills] = useState([]);
  const [electiveSkills, setElectiveSkills] = useState([]);
  const [secondarySkills, setSecondarySkills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [attributesRolled, setAttributesRolled] = useState(false);
  const [autoRollEnabled, setAutoRollEnabled] = useState(false);
  const [minTotalValue, setMinTotalValue] = useState(70); // Default minimum total
  const [isAutoRolling, setIsAutoRolling] = useState(false);
  const [gender, setGender] = useState('Male');
  // const [isRolling, setIsRolling] = useState(false); // Temporarily disabled
  // const [rollType, setRollType] = useState(''); // Temporarily disabled
  const [occData, setOccData] = useState(null);
  const [useDeterministicHP, setUseDeterministicHP] = useState(true);
  const [previousLevel, setPreviousLevel] = useState(1); // Track previous level for skill gains
  const [showSkillSelectionModal, setShowSkillSelectionModal] = useState(false);
  const [pendingLevelChange, setPendingLevelChange] = useState(null); // Store pending level change
  const [pendingSkillSelections, setPendingSkillSelections] = useState({
    elective: { count: 0, selected: [] },
    secondary: { count: 0, selected: [] }
  });
  
  // Level-based stats
  const [levelStats, setLevelStats] = useState({
    hp: null,
    attacksPerMelee: 2,
    saves: { vsMagic: 14, vsPoison: 14, vsPsionics: 15 },
    combatBonuses: { strike: 0, parry: 0, dodge: 0, damage: 0 },
    ppe: 0,
    isp: 0,
    skillIncreases: { elective: 0, secondary: 0 }
  });

  // Recalculate stats when level or class changes
  useEffect(() => {
    // Calculate HP even if O.C.C. isn't selected yet (use defaults)
    if (level && attributes.PE) {
      const peBonus = Math.floor((attributes.PE || 0) / 4);
      const currentLevel = parseInt(level) || 1;
      
      let calculatedHP = hp;
      if (useDeterministicHP && occData) {
        // Calculate deterministic HP for character creator (only if O.C.C. is selected)
        calculatedHP = calculateCreatorHP(currentLevel, peBonus, hp);
      } else if (useDeterministicHP && !occData) {
        // If no O.C.C. selected, use simple calculation: base HP + (level-1) * 8 + PE bonus
        const baseHP = 20;
        const hpPerLevel = 8; // Default
        calculatedHP = baseHP + (currentLevel - 1) * hpPerLevel + (peBonus * currentLevel);
      } else if (!useDeterministicHP) {
        // Use rolled HP if available, otherwise calculate
        calculatedHP = hp || (20 + (currentLevel - 1) * 8 + (peBonus * currentLevel));
      }
      
      // Only call getStatsForLevel if occData exists
      let stats = {};
      if (occData) {
        stats = getStatsForLevel(
          occData,
          currentLevel,
          attributes,
          calculatedHP,
          psionics?.ppe || 0,
          psionics?.isp || 0,
          occSkills,
          electiveSkills,
          secondarySkills
        ) || {};
      }
      
      // Ensure all required properties exist by merging with defaults
      setLevelStats({
        hp: calculatedHP || null, // Always use calculatedHP
        attacksPerMelee: 2,
        saves: { vsMagic: 14, vsPoison: 14, vsPsionics: 15 },
        combatBonuses: { strike: 0, parry: 0, dodge: 0, damage: 0 },
        ppe: 0,
        isp: 0,
        skillIncreases: { elective: 0, secondary: 0 },
        ...stats, // Override with actual stats if provided
        // Ensure saves and combatBonuses are always objects
        saves: stats?.saves || { vsMagic: 14, vsPoison: 14, vsPsionics: 15 },
        combatBonuses: stats?.combatBonuses || { strike: 0, parry: 0, dodge: 0, damage: 0 },
        // Override hp with calculatedHP (calculatedHP takes precedence)
        hp: calculatedHP || stats?.hp || null,
      });
    } else if (Object.keys(attributes).length === 0) {
      // Reset levelStats if no attributes are rolled yet
      setLevelStats({
        hp: null,
        attacksPerMelee: 2,
        saves: { vsMagic: 14, vsPoison: 14, vsPsionics: 15 },
        combatBonuses: { strike: 0, parry: 0, dodge: 0, damage: 0 },
        ppe: 0,
        isp: 0,
        skillIncreases: { elective: 0, secondary: 0 },
      });
    }
  }, [level, occData, attributes, hp, psionics, occSkills, electiveSkills, secondarySkills, useDeterministicHP]);

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
    if (diceRoll.startsWith('3d6') && attrValue >= 16 && attrValue <= 18) {
      return 'green';
    } else if (
      (numDice === 4 && attrValue >= 18) ||
      (numDice === 5 && attrValue >= 24)
    ) {
      return 'red';
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
        const [numDice] = diceRoll.split('d').map(Number);
        const highlight = attributes[`${attr}_highlight`];
        
        let newValue = value;
        if (attr !== 'Spd' && 
            ((highlight === 'green' && numDice <= 3) || 
             (highlight === 'red' && numDice >= 4))) {
          const bonusRoll = rollDice(6, 1, useCryptoRandom);
          newValue += bonusRoll;
          bonusesApplied++;
          console.log(`Bonus applied to ${attr}: +${bonusRoll} (${value} → ${newValue})`);
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
    if (!occData) return baseHP || 10;
    
    const progression = occData.category ? 
      palladiumData.levelProgression[occData.category] : null;
    
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

  // Generate starting clothing based on race (1994 Palladium Fantasy RPG)
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

  // const handleRollFinish = (result) => {
  //   const roll = result * 5; // Convert d20 to d100 range
  //   switch (rollType) {
  //     case 'Social Background':
  //       setSocialBackground(rollFromTable(roll, socialBackgrounds));
  //       break;
  //     case 'Disposition':
  //       setDisposition(rollFromTable(roll, dispositions));
  //       break;
  //     case 'Personal Hostility':
  //       setHostility(rollFromTable(roll, hostilities));
  //       break;
  //     case 'Land of Origin':
  //       setOrigin(rollFromTable(roll, landsOfOrigin));
  //       break;
  //   }
  //   setIsRolling(false);
  //   setRollType('');
  // };

  const updateAvailableClasses = () => {
    if (species && Object.keys(attributes).length > 0 && alignment) {
      const character = {
        species,
        attributes: Object.fromEntries(
          Object.entries(attributes).filter(([key]) => !key.endsWith('_highlight'))
        ),
        alignment
      };
      const classes = getAvailableClasses(character);
      setAvailableClasses(classes);
      
      // Reset character class if current selection is no longer valid
      if (characterClass && !classes.includes(characterClass)) {
        setCharacterClass('');
      }
    }
  };

  // Add useEffect to update available classes when relevant data changes
  useEffect(() => {
    updateAvailableClasses();
  }, [species, attributes, alignment]);

  // Initialize filtered classes when available classes change
  useEffect(() => {
    filterAvailableOCCs(species);
  }, [availableClasses, species]);

  // Handle OCC selection with automatic bonuses, PPE/ISP, and skills
  const filterAvailableOCCs = (selectedSpecies) => {
    if (!selectedSpecies) {
      setFilteredClasses(availableClasses);
      return;
    }

    const raceData = palladiumData.races[selectedSpecies];
    if (!raceData) {
      setFilteredClasses(availableClasses);
      return;
    }

    // Get all O.C.C.s that are NOT restricted for this race
    const allowedOCCs = availableClasses.filter(occName => {
      const occData = palladiumData.occs[occName];
      if (!occData) return true;
      
      // Check if this O.C.C. is restricted for this race
      return !occData.restrictedRaces.includes(selectedSpecies);
    });

    setFilteredClasses(allowedOCCs);
  };

  const handleOccSelection = (selectedOcc) => {
    setCharacterClass(selectedOcc);
    
    if (!selectedOcc) {
      setOccSkills([]);
      setElectiveSkills([]);
      setSecondarySkills([]);
      setPreviousLevel(1);
      return;
    }
    
    const occData = palladiumData.occs[selectedOcc];
    if (!occData) return;
    
    // Reset previous level when OCC changes
    const currentLevel = parseInt(level) || 1;
    setPreviousLevel(1);
    
    // Check if level > 1 and we need to prompt for skill selection
    if (currentLevel > 1) {
      const skillGains = calculateSkillGains(occData, currentLevel, 1);
      
      if (skillGains.elective > 0 || skillGains.secondary > 0) {
        // Show skill selection modal after a brief delay to allow OCC data to be set
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
    for (const [attr, bonusExpr] of Object.entries(occData.bonuses || {})) {
      updatedAttributes[attr] = applyBonus(updatedAttributes[attr] || 0, bonusExpr);
    }
    setAttributes(updatedAttributes);

    // Roll PPE/ISP
    let ppe = 0;
    let isp = 0;
    if (occData.PPE) ppe = evaluateDice(occData.PPE);
    if (occData.ISP) isp = evaluateDice(occData.ISP);

    // Apply racial modifiers
    const raceData = palladiumData.races[species];
    if (raceData?.saveMods) {
      // Apply racial save modifiers (will be applied to character on creation)
      // This is handled in the character creation process
    }

    // Auto-assign O.C.C. skills
    setOccSkills(occData.occSkills || []);
    
    // Reset elective and secondary skills
    setElectiveSkills([]);
    setSecondarySkills([]);

    // Store OCC data for character creation (include skill progression data)
    setOccData({
      name: selectedOcc,
      category: occData.category,
      ppe: ppe,
      isp: isp,
      notes: occData.notes,
      electiveSkills: occData.electiveSkills,
      secondarySkills: occData.secondarySkills,
      saveMods: raceData?.saveMods || { vsMagic: 0, vsPsionics: 0 },
      combatMods: raceData?.combatMods || { damage: 0, initiative: 0, speedBonus: 0 },
      abilities: raceData?.abilities || []
    });
  };

  const handlePsionicsRoll = (psionicsData) => {
    if (typeof psionicsData === 'string') {
      // Handle old format for backward compatibility
      setPsionics(psionicsData);
    } else {
      // Handle new format with ISP
      setPsionics(psionicsData.result);
      // Store ISP for character creation
      if (psionicsData.isp > 0) {
        setAttributes(prev => ({ ...prev, baseISP: psionicsData.isp }));
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
      alert('Please select a character class');
      return;
    }
    
    if (!socialBackground || !socialBackground.trim()) {
      alert('Please enter a social background');
      return;
    }
    
    if (!disposition || !disposition.trim()) {
      alert('Please enter a disposition');
      return;
    }
    
    if (!hostility || !hostility.trim()) {
      alert('Please enter a hostility level');
      return;
    }
    
    if (!origin || !origin.trim()) {
      alert('Please enter an origin');
      return;
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
      class: characterClass,
      level: Number(level) || 1, // Use actual level state
      hp: Number(hp),
      alignment,
      attributes,
      age,
      socialBackground,
      disposition,
      hostility,
      origin,
      gender,
      occ: occData?.name || characterClass,
      PPE: occData?.ppe || 0,
      ISP: occData?.isp || 0,
      saves: {
        vsMagic: 12 + (occData?.saveMods?.vsMagic || 0),
        vsPsionics: 15 + (occData?.saveMods?.vsPsionics || 0),
        vsPoison: 14
      },
      combatMods: occData?.combatMods || { damage: 0, initiative: 0, speedBonus: 0 },
      abilities: occData?.abilities || [],
      occSkills: occSkills,
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
      
      // Calculate the total HP for this level (same logic as levelStats)
      const peBonus = Math.floor((validatedAttributes.PE || 0) / 4);
      const currentLevel = Number(level) || 1;
      const calculatedHP = useDeterministicHP ? 
        calculateCreatorHP(currentLevel, peBonus, Number(hp) || 10) :
        Number(hp) || 10;

      // Import assignInitialEquipment to get proper starting equipment
      const { assignInitialEquipment } = await import('../utils/characterUtils');
      
      // Get initial equipment based on class and race (modern system)
      const { inventory, gold } = await assignInitialEquipment(characterClass, species);

      // Add psionics for Mind Mages
      let psionicPowers = [];
      if (characterClass === "Mind Mage" && psionics) {
        psionicPowers = await getMindMagePsionics(psionics, level);
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
      console.log('🔍 FINAL INVENTORY BEFORE API CALL:', inventory);
      inventory.forEach((item, index) => {
        console.log(`🔍 Item ${index}:`, { name: item.name, type: item.type, category: item.category });
      });

      // Calculate ISP for Mind Mages
      let characterISP = 0;
      if (characterClass === 'Mind Mage' && attributes.baseISP) {
        // Base ISP + 10 per level (level 1 = base ISP)
        characterISP = attributes.baseISP + ((Number(level) || 1) - 1) * 10;
      }

      const characterData = {
        name: characterName || "Unnamed Character",
        species,
        class: characterClass,
        occ: characterClass, // Set occ to same as class
        level: Number(level) || 1,
        hp: calculatedHP, // Use calculated total HP instead of base HP
        alignment: alignment || "Neutral",
        attributes: validatedAttributes,
        age: age || 25, // Default to number if not provided
        socialBackground: socialBackground || "Unknown",
        disposition: disposition || "Unknown",
        hostility: hostility || "Unknown",
        origin: origin || "Unknown",
        gender: normalizedGender,
        ISP: characterISP,
        psionicPowers: psionicPowers || [],
        occSkills: occSkills || [],
        electiveSkills: electiveSkills || [],
        secondarySkills: secondarySkills || [],
        // Add starting equipment using modern system
        inventory: inventory || [],
        gold: gold || 100
      };

      console.log('Submitting character data for validation:', characterData);
      console.log('occ field value:', characterData.occ);
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
      console.log('occSkills:', characterData.occSkills);
      console.log('electiveSkills:', characterData.electiveSkills);
      console.log('secondarySkills:', characterData.secondarySkills);
      
      const response = await onCreateCharacter(characterData);

      console.log('Character creation response:', response);
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
      alert(errorMessage);
    }
  };

  const renderClassSelection = () => {
    // Use filtered classes (based on race restrictions) instead of all available classes
    const classesToShow = filteredClasses.length > 0 ? filteredClasses : availableClasses;
    
    console.log('=== CLASS FILTERING DEBUG ===');
    console.log('Species:', species);
    console.log('Psionics:', psionics);
    console.log('IQ:', attributes.IQ);
    console.log('Available Classes:', availableClasses);
    console.log('Filtered Classes:', filteredClasses);
    console.log('Classes To Show:', classesToShow);
    console.log('Has Mind Mage:', classesToShow.includes('Mind Mage'));
    console.log('================================');
    
    // Group available classes by category
    const groupedClasses = classesToShow.reduce((acc, className) => {
      // Filter out Mind Mage if psionics isn't Major or Master AND IQ < 9
      if (className === 'Mind Mage') {
        const hasMajorOrMaster = psionics && 
                                 (psionics.includes('Major') || psionics.includes('Master'));
        const meetsIQRequirement = attributes.IQ >= 9;
        
        console.log('Mind Mage eligibility check:', {
          psionics,
          psionicsType: typeof psionics,
          hasMajorOrMaster,
          IQ: attributes.IQ,
          meetsIQRequirement,
          eligible: hasMajorOrMaster && meetsIQRequirement
        });
        
        if (!hasMajorOrMaster || !meetsIQRequirement) {
          return acc;
        }
      }
      
      const category = characterClasses[className].category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(className);
      return acc;
    }, {});

    return (
      <div className="class-selection">
        <label htmlFor="character-class">Character Class:</label>
        <select
          id="character-class"
          value={characterClass}
          onChange={(e) => handleOccSelection(e.target.value)}
          disabled={availableClasses.length === 0}
        >
          <option value="">Select a class</option>
          {Object.entries(groupedClasses).map(([category, classes]) => (
            <optgroup key={category} label={category}>
              {classes.map(className => (
                <option key={className} value={className}>
                  {className}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {/* Display class requirements when a class is selected */}
        {characterClass && (
          <div className="class-requirements">
            <h4>{characterClass} Requirements:</h4>
            <ul>
              {Object.entries(characterClasses[characterClass].requirements).map(([attr, value]) => (
                <li key={attr}>
                  {attr === 'alignment' && 'Alignment: Evil required'}
                  {attr === 'psionics' && 'Must be Major (80-89%) or Master Psionic (90-100%)'}
                  {attr !== 'alignment' && attr !== 'psionics' && `${attr}: ${value}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Display race restrictions info */}
        {species && (
          <div className="race-restrictions">
            <h4>{species} O.C.C. Restrictions:</h4>
            {(() => {
              const raceData = palladiumData.races[species];
              if (!raceData || raceData.restrictedOCCs.length === 0) {
                return <p>No O.C.C. restrictions for {species}.</p>;
              }
              return (
                <div>
                  <p><strong>Cannot be:</strong> {raceData.restrictedOCCs.join(', ')}</p>
                  <p><em>Available O.C.C.s are filtered above based on race restrictions.</em></p>
                </div>
              );
            })()}
          </div>
        )}

        {/* Display OCC data when selected */}
        {occData && (
          <div className="occ-data">
            <h4>OCC Information:</h4>
            <p><strong>Class:</strong> {occData.name} ({occData.category})</p>
            <p><strong>PPE:</strong> {occData.ppe}</p>
            <p><strong>ISP:</strong> {occData.isp}</p>
            <p><strong>Notes:</strong> {occData.notes}</p>
            {occData.abilities.length > 0 && (
              <div>
                <strong>Racial Abilities:</strong>
                <ul>
                  {occData.abilities.map((ability, idx) => (
                    <li key={idx}>{ability}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* O.C.C. Skills Selection */}
        {characterClass && palladiumData.occs[characterClass] && (
          <div className="occ-skills-selection">
            <h4>O.C.C. Skills</h4>
            
            {/* O.C.C. Skills (auto-assigned) */}
            <div className="occ-skills">
              <h5>O.C.C. Skills (Automatic):</h5>
              <ul>
                {occSkills.map((skill, idx) => {
                  const formattedSkill = formatSkillWithPercent(skill, characterClass, parseInt(level) || 1);
                  return (
                    <li key={idx}>{formattedSkill}</li>
                  );
                })}
              </ul>
            </div>

            {/* Elective Skills */}
            {palladiumData.occs[characterClass].electiveSkills?.level1 > 0 && (
              <div className="elective-skills">
                <h5>Elective Skills (Choose {palladiumData.occs[characterClass].electiveSkills.level1}):</h5>
                <select
                  multiple
                  size="6"
                  value={electiveSkills}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    if (selected.length <= palladiumData.occs[characterClass].electiveSkills.level1) {
                      setElectiveSkills(selected);
                    }
                  }}
                >
                  {palladiumData.occs[characterClass].electiveSkills?.list
                    ?.filter(skill => !isSkillInOccSkills(skill, occSkills)) // Filter out skills already in OCC skills
                    .map((skill, idx) => {
                    const skillData = palladiumData.skills[skill];
                      const formattedSkill = formatSkillWithPercent(skill, characterClass, parseInt(level) || 1);
                    return (
                      <option key={idx} value={skill} title={skillData?.description || skill}>
                          {formattedSkill}
                      </option>
                    );
                  })}
                </select>
                <p>Selected: {electiveSkills.length}/{palladiumData.occs[characterClass].electiveSkills.level1}</p>
              </div>
            )}

            {/* Secondary Skills */}
            {palladiumData.occs[characterClass].secondarySkills?.level1 > 0 && (
              <div className="secondary-skills">
                <h5>Secondary Skills (Choose {palladiumData.occs[characterClass].secondarySkills.level1}):</h5>
                <p className="skill-hint">Basic/general skills only - no advanced or OCC-specific skills</p>
                <select
                  multiple
                  size="8"
                  value={secondarySkills}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    if (selected.length <= palladiumData.occs[characterClass].secondarySkills.level1) {
                      setSecondarySkills(selected);
                    }
                  }}
                >
                  {palladiumData.secondarySkills
                    .filter(skill => !isSkillInOccSkills(skill, occSkills)) // Filter out skills already in OCC skills
                    .map((skill, idx) => {
                      const formattedSkill = formatSkillWithPercent(skill, characterClass, parseInt(level) || 1);
                      return (
                    <option key={idx} value={skill} title={`Basic skill: ${skill}`}>
                          {formattedSkill}
                    </option>
                      );
                    })}
                </select>
                <p>Selected: {secondarySkills.length}/{palladiumData.occs[characterClass].secondarySkills.level1}</p>
              </div>
            )}

            {/* O.C.C. Special Notes */}
            {palladiumData.occs[characterClass].special && (
              <div className="occ-special">
                <h5>Special:</h5>
                <p>{palladiumData.occs[characterClass].special}</p>
              </div>
            )}
          </div>
        )}

        {/* Display species class restrictions */}
        <div className="species-limitations">
          <h4>{species} Class Limitations:</h4>
          <p>{speciesCharacteristics[species].occLimitations}</p>
        </div>
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

  // Helper function to get skill base percentage for display
  const getSkillBasePercent = (skillName, occName) => {
    // Map skill names to occSkillTables keys - OCC-specific first
    const occSpecificMap = {
      "Language: Native Tongue (98%)": 98,
      "Literacy (Own Language)": occSkillTables[occName]?.readWrite || occSkillTables[occName]?.literacy || 30,
      "Literacy (Additional Language)": 25,
      "Lore: Magic": occSkillTables[occName]?.loreMagic || 35,
      "Lore: History": occSkillTables[occName]?.loreHistory || 20,
      "Lore: Demons & Monsters": occSkillTables[occName]?.loreDemonic || occSkillTables[occName]?.loreMonsters || 25,
      "Lore: Demon & Monster": occSkillTables[occName]?.loreDemonic || occSkillTables[occName]?.loreMonsters || 25,
      "Lore: Religion": occSkillTables[occName]?.loreReligion || 30,
      "Lore: Geography": 30,
      "Lore: Alchemy": 25,
      "Lore: Runes & Circles": 20,
      "Lore: Ancient": 20,
      "Lore: Military": occSkillTables[occName]?.loreMilitary || 30,
      "Lore: Heraldry": 25,
      "Lore: Local History": 20,
      "Lore: Spirits": 25,
      "Lore: Psionics": occSkillTables[occName]?.lorePsionics || 40,
      "Lore: Herbs": occSkillTables[occName]?.loreHerbs || 35,
      "Identify Plants & Herbs": occSkillTables[occName]?.identifyPlants || 15,
      "Identify Plants & Animals": occSkillTables[occName]?.identifyPlants || 15,
      "Prowl": occSkillTables[occName]?.prowl || 10,
      "Meditation": occSkillTables[occName]?.meditation || 40,
      "Track": occSkillTables[occName]?.track || 25,
      "Tracking": occSkillTables[occName]?.track || 25,
      "Track Animals": 25,
      "Track Humanoids": 25,
      "Horsemanship": occSkillTables[occName]?.horsemanship || 30,
      "Horsemanship (Basic)": occSkillTables[occName]?.horsemanship || 30,
      "First Aid": occSkillTables[occName]?.medical || 30,
      "Medical": occSkillTables[occName]?.medical || 30,
      "Herbal Lore": occSkillTables[occName]?.loreHerbs || 35,
      "Holistic Medicine": 30,
      "Diagnose Illness": 25,
      "Healing Touch": 30,
      "Pick Locks": occSkillTables[occName]?.pickLocks || 25,
      "Pick Pockets": occSkillTables[occName]?.pickPockets || 25,
      "Disguise": occSkillTables[occName]?.disguise || 25,
      "Streetwise": occSkillTables[occName]?.streetwise || 25,
      "Camouflage": occSkillTables[occName]?.camouflage || 20,
      "Survival": occSkillTables[occName]?.survival || 30,
      "Survival (Wilderness)": occSkillTables[occName]?.survival || 30,
      "Survival (Forest)": 30,
      "Survival (Plains)": 30,
      "Survival (Arctic)": 25,
      "Survival (Desert)": 25,
      "Climb": 60, // Base percentage from skillSystem.js (Palladium rules)
      "Climbing": 60, // Base percentage from skillSystem.js
      "Scale Walls": 50, // Base percentage from skillSystem.js
      "Swim": 50, // Base percentage from skillSystem.js (Palladium rules)
      "Swimming": 50, // Base percentage from skillSystem.js
      // Running is NOT a percentage skill - removed from map
      "Mathematics: Basic": 20,
      "Math (Basic)": 20,
      "Mathematics: Advanced": 25,
      "Math (Advanced)": 25,
      "Intimidation": occSkillTables[occName]?.intimidation || 25,
      "Hypnosis": occSkillTables[occName]?.hypnosis || 35,
      "Detect Deception": occSkillTables[occName]?.detectDeception || 30,
      "Weapon Maintenance": occSkillTables[occName]?.weaponMaintenance || 25,
      "Weapon Smithing": occSkillTables[occName]?.weaponSmithing || 20,
      "Heraldry": occSkillTables[occName]?.heraldry || 25,
      "Brewing": occSkillTables[occName]?.brewing || 35,
      "Poison Craft": occSkillTables[occName]?.poisonCraft || 35,
      "Palming": occSkillTables[occName]?.palming || 30,
      "Gambling": occSkillTables[occName]?.gamble || 30,
      "Farming": occSkillTables[occName]?.farming || 40,
      "Animal Husbandry": occSkillTables[occName]?.animalHusbandry || 30,
      "Cooking": occSkillTables[occName]?.cooking || 30,
      "Research": occSkillTables[occName]?.research || 25,
    };
    
    // Check direct mapping first
    if (occSpecificMap[skillName]) {
      return occSpecificMap[skillName];
    }
    
    // Try to match skill name patterns
    if (skillName.includes("Literacy") || skillName.includes("Read/Write")) {
      return occSkillTables[occName]?.readWrite || 30;
    }
    if (skillName.includes("Lore: Magic")) {
      return occSkillTables[occName]?.loreMagic || 35;
    }
    if (skillName.includes("Lore: History")) {
      return occSkillTables[occName]?.loreHistory || 20;
    }
    if (skillName.includes("Identify Plants") || skillName.includes("Herbs")) {
      return occSkillTables[occName]?.identifyPlants || 15;
    }
    if (skillName.includes("Prowl")) {
      return occSkillTables[occName]?.prowl || 10;
    }
    if (skillName.includes("Meditation")) {
      return occSkillTables[occName]?.meditation || 40;
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
    if (skillName.includes("Lore: Demons") || skillName.includes("Lore: Demon")) {
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
      return 60; // Base percentage from Palladium rules (Climb: 60% base)
    }
    if (skillName.includes("Swim") || skillName.includes("Swimming")) {
      return 50; // Base percentage from Palladium rules (Swim: 50% base)
    }
    // Running is NOT a percentage skill - it provides static bonuses (+1 PE, +4D4 Spd, +1D6 SDC)
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
      return occSkillTables[occName]?.medical || 30;
    }
    if (skillName.includes("Medical")) {
      return occSkillTables[occName]?.medical || 30;
    }
    if (skillName.includes("Track")) {
      return occSkillTables[occName]?.track || 25;
    }
    if (skillName.includes("Horsemanship")) {
      return occSkillTables[occName]?.horsemanship || 30;
    }
    if (skillName.includes("Pick Locks")) {
      return occSkillTables[occName]?.pickLocks || 25;
    }
    if (skillName.includes("Pick Pockets")) {
      return occSkillTables[occName]?.pickPockets || 25;
    }
    if (skillName.includes("Disguise")) {
      return occSkillTables[occName]?.disguise || 25;
    }
    if (skillName.includes("Streetwise")) {
      return occSkillTables[occName]?.streetwise || 25;
    }
    if (skillName.includes("Camouflage")) {
      return occSkillTables[occName]?.camouflage || 20;
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
    if (skillName.startsWith("W.P.")) {
      return 0; // Weapon proficiencies start at 0
    }
    if (skillName.includes("Hand to Hand")) {
      return 0; // Combat skills start at 0
    }
    
    // Try lookupSkill for other skills
    const skillData = lookupSkill(skillName);
    if (skillData && skillData.base !== undefined) {
      return skillData.base;
    }
    
    return null; // No percentage found
  };

  // Helper function to format skill name with percentage or bonuses
  const formatSkillWithPercent = (skillName, occName, currentLevel = 1) => {
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
    
    // Running is a bonus skill (provides +1 PE, +4D4 Spd, +1D6 SDC) - not percentage-based
    if (skillName.includes("Running")) {
      return `${skillName} (+1 PE, +4D4 Spd, +1D6 SDC)`;
    }
    
    const isCombatSkill = combatSkills.some(cs => skillName.includes(cs));
    const isWeaponProficiency = skillName.startsWith('W.P.');
    
    if (isCombatSkill || isWeaponProficiency) {
      // Get bonuses for this skill at current level
      const skillBonuses = getSkillBonusesAtLevel(skillName, currentLevel);
      const bonuses = skillBonuses.bonuses || { strike: 0, parry: 0, dodge: 0, damage: 0 };
      const attacks = skillBonuses.attacks || 0;
      
      // For W.P. skills not in progression, check static bonuses
      if (isWeaponProficiency && bonuses.strike === 0 && bonuses.parry === 0 && bonuses.dodge === 0 && bonuses.damage === 0) {
        // Try to get base bonuses from skillBonuses.js
        const staticBonus = staticSkillBonuses[skillName];
        if (staticBonus) {
          bonuses.strike = staticBonus.strike || 0;
          bonuses.parry = staticBonus.parry || 0;
          bonuses.dodge = staticBonus.dodge || 0;
          bonuses.damage = staticBonus.damage || 0;
        }
      }
      
      // Build bonus string
      const bonusParts = [];
      if (bonuses.strike > 0) bonusParts.push(`+${bonuses.strike} strike`);
      if (bonuses.parry > 0) bonusParts.push(`+${bonuses.parry} parry`);
      if (bonuses.dodge > 0) bonusParts.push(`+${bonuses.dodge} dodge`);
      if (bonuses.damage > 0) bonusParts.push(`+${bonuses.damage} damage`);
      if (attacks > 0) bonusParts.push(`+${attacks} attack/melee`);
      
      if (bonusParts.length > 0) {
        return `${skillName} (${bonusParts.join(', ')})`;
      } else {
        // For W.P. skills, show at least that it's a weapon proficiency
        if (isWeaponProficiency) {
          return `${skillName} (weapon proficiency)`;
        }
        return skillName; // No bonuses to display
      }
    }
    
    // For percentage-based skills, calculate and display percentage
    const basePercent = getSkillBasePercent(skillName, occName);
    
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

  // Helper function to check if a skill is already in OCC skills
  const isSkillInOccSkills = (skillName, occSkillsList) => {
    const normalized = normalizeSkillName(skillName);
    return occSkillsList.some(occSkill => {
      const normalizedOcc = normalizeSkillName(occSkill);
      // Check for exact match or if one contains the other
      return normalizedOcc === normalized || 
             normalizedOcc.includes(normalized) || 
             normalized.includes(normalizedOcc);
    });
  };

  // Calculate skill gains for level progression
  const calculateSkillGains = (occData, currentLevel, previousLevel) => {
    if (!occData || currentLevel <= previousLevel) {
      return { elective: 0, secondary: 0 };
    }
    
    let electiveGains = 0;
    let secondaryGains = 0;
    
    // Check elective skill gains
    if (occData.electiveSkills) {
      const electiveLevels = Object.keys(occData.electiveSkills)
        .filter(key => key.startsWith('level'))
        .map(key => parseInt(key.replace('level', '')))
        .sort((a, b) => a - b);
      
      electiveLevels.forEach(threshold => {
        if (currentLevel >= threshold && previousLevel < threshold) {
          electiveGains += occData.electiveSkills[`level${threshold}`] || 0;
        }
      });
    }
    
    // Check secondary skill gains
    if (occData.secondarySkills) {
      const secondaryLevels = Object.keys(occData.secondarySkills)
        .filter(key => key.startsWith('level'))
        .map(key => parseInt(key.replace('level', '')))
        .sort((a, b) => a - b);
      
      secondaryLevels.forEach(threshold => {
        if (currentLevel >= threshold && previousLevel < threshold) {
          secondaryGains += occData.secondarySkills[`level${threshold}`] || 0;
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
      
      // If level increased and OCC is selected, check for skill gains
      if (newLevel > oldLevel && occData) {
        const skillGains = calculateSkillGains(occData, newLevel, oldLevel);
        
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
      <div className="character-creation">
        <h1 className="page-title">⚔️ Character Creator</h1>
        
        {/* Basic Information Section */}
        <section className="creation-section">
          <h2 className="section-title">📝 Basic Information</h2>
          
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
                  🎲 Random Name
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
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="species">Species</label>
              <select
                id="species"
                value={species}
                onChange={(e) => {
                  setSpecies(e.target.value);
                  setCharacterClass(''); // Reset class when species changes
                  setOccData(null);
                  setOccSkills([]);
                  setElectiveSkills([]);
                  setSecondarySkills([]);
                  
                  // Filter available O.C.C.s based on race restrictions
                  filterAvailableOCCs(e.target.value);
                }}
                disabled={attributesRolled}
                className={attributesRolled ? 'disabled-select' : 'select-input'}
              >
                {Object.keys(speciesData).map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="alignment-select">Alignment</label>
              <select
                id="alignment-select"
                value={alignment}
                onChange={(e) => setAlignment(e.target.value)}
                disabled={attributesRolled}
                className={attributesRolled ? 'disabled-select' : 'select-input'}
              >
                <option value="Good: Principled">Good: Principled</option>
                <option value="Good: Scrupulous">Good: Scrupulous</option>
                <option value="Selfish: Unprincipled">Selfish: Unprincipled</option>
                <option value="Selfish: Anarchist">Selfish: Anarchist</option>
                <option value="Evil: Miscreant">Evil: Miscreant</option>
                <option value="Evil: Aberrant">Evil: Aberrant</option>
                <option value="Evil: Diabolic">Evil: Diabolic</option>
              </select>
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
              <span className="checkbox-text">Use Cryptographic Randomness 🎲</span>
            </label>
          </div>
        </section>

        {/* Attributes Section */}
        <section className="creation-section">
          <h2 className="section-title">🎲 Attributes & Level</h2>
          
          <div className="attributes-controls">
            <div className="checkbox-group">
              <label htmlFor="autoRollEnabled" className="checkbox-label">
                <input
                  type="checkbox"
                  id="autoRollEnabled"
                  checked={autoRollEnabled}
                  onChange={(e) => setAutoRollEnabled(e.target.checked)}
                  disabled={attributesRolled}
                  className="checkbox-input"
                />
                <span className="checkbox-text">Auto-roll until minimum total 🎯</span>
              </label>
            </div>
            
            {autoRollEnabled && (
              <div className="form-group">
                <label htmlFor="minTotalValue">Minimum Total:</label>
                <input
                  type="number"
                  id="minTotalValue"
                  value={minTotalValue}
                  onChange={(e) => setMinTotalValue(parseInt(e.target.value, 10))}
                  min="0"
                  max="200"
                  disabled={attributesRolled || isAutoRolling}
                  className="number-input"
                />
              </div>
            )}
          </div>

          <div className="button-row">
            <Button 
              onClick={regenerateAttributes}
              disabled={isAutoRolling || attributesRolled}
              className="primary-button"
            >
              {isAutoRolling ? '🎲 Auto-Rolling...' : attributesRolled ? '✅ Attributes Locked' : '🎲 Roll Attributes'}
            </Button>
          </div>

          <div className="button-row">

            <Button 
              onClick={rollHP} 
              disabled={hp !== null}
              className="secondary-button"
            >
              {hp !== null ? `✓ HP: ${hp}` : '❤️ Roll HP'}
            </Button>
            <Button 
              onClick={rollBonus} 
              disabled={bonusRolled}
              className={`secondary-button ${bonusRolled ? 'disabled-button' : ''}`}
              title={`Bonus rolled: ${bonusRolled}`}
              style={{
                opacity: bonusRolled ? 0.6 : 1,
                cursor: bonusRolled ? 'not-allowed' : 'pointer'
              }}
            >
              {bonusRolled ? '✓ Bonus Rolled' : '🎯 Roll Bonus'}
            </Button>
          </div>
        </section>

      <table id="attributes-table">
        <thead>
          <tr>
            <th>Attribute</th>
            <th>Value</th>
            <th>Bonus</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(attributes)
            .filter(([key]) => !key.endsWith('_highlight') && !key.endsWith('_total') && key !== 'total')
            .map(([key, value]) => {
              const bonusData = getBonus(key, value);
              let bonusDisplay = 'None';
              if (bonusData) {
                if (typeof bonusData === 'string') {
                  bonusDisplay = bonusData;
                } else if (bonusData.description) {
                  bonusDisplay = bonusData.description;
                }
              }

              return (
                <tr
                  key={key}
                  style={getHighlightStyle(attributes[`${key}_highlight`])}
                >
                  <td>{key}</td>
                  <td>{value}</td>
                  <td>{bonusDisplay}</td>
                </tr>
              );
            })}
          {/* Add sum total row */}
          <tr>
            <td colSpan="2">Total of All Attributes:</td>
            <td>{attributes.total || '-'}</td>
          </tr>
        </tbody>
      </table>


        {/* Random Rolls Section */}
        <section className="creation-section">
          <h2 className="section-title">🎯 Random Background Rolls</h2>
          
          <div className="button-row">
            <Button 
              onClick={rollAge} 
              disabled={age !== '' && age !== 'Unknown'}
              className="secondary-button"
            >
              🎂 Roll Age
            </Button>
            <Button
              onClick={rollSocialBackground}
              disabled={socialBackground !== ''}
              className="secondary-button"
            >
              🏛️ Roll Social Background
            </Button>
            <Button 
              onClick={handleRollDisposition} 
              disabled={disposition !== ''}
              className="secondary-button"
            >
              😊 Roll Disposition
            </Button>
          </div>
          
          <div className="button-row">
            <Button 
              onClick={handleRollHostility} 
              disabled={hostility !== ''}
              className="secondary-button"
            >
              😡 Roll Personal Hostility
            </Button>
            <Button 
              onClick={handleRollOrigin} 
              disabled={origin !== ''}
              className="secondary-button"
            >
              🌍 Roll Land of Origin
            </Button>
          </div>

          {/* Background Information Display */}
          <div className="background-info">
            <h3>📋 Background Information</h3>
            <div className="background-section">
              <div className="info-item">
                <strong>Age:</strong> {age || "Not rolled"}
              </div>
              <div className="info-item">
                <strong>Social Background:</strong> {socialBackground || "Not rolled"}
              </div>
              <div className="info-item">
                <strong>Disposition:</strong> {disposition || "Not rolled"}
              </div>
              <div className="info-item">
                <strong>Personal Hostility:</strong> {hostility || "Not rolled"}
              </div>
              <div className="info-item">
                <strong>Land of Origin:</strong> {origin || "Not rolled"}
              </div>
            </div>
          </div>
        </section>

        {/* Psionics Section */}
        {attributes.IQ && species && (
          <section className="creation-section">
            <h2 className="section-title">🧠 Psionics</h2>
            <PsionicsRoll
              IQ={attributes.IQ}
              mentalEndurance={attributes.ME || 0}
              species={species}
              onRollPsionics={handlePsionicsRoll}
            />
          </section>
        )}

        {/* Class Selection & Level */}
        <section className="creation-section">
          <h2 className="section-title">⚔️ Class Selection & Level</h2>
          
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
                  {occData && parseInt(level) > 1 && (() => {
                    const skillGains = calculateSkillGains(occData, parseInt(level), 1);
                    return (
                      <div style={{ 
                        backgroundColor: '#e6fffa', 
                        padding: '10px', 
                        borderRadius: '5px', 
                        marginBottom: '15px',
                        border: '1px solid #81e6d9'
                      }}>
                        <p style={{ margin: '5px 0', fontSize: '14px', fontWeight: 'bold', color: '#234e52' }}>
                          📚 Skills Available:
                        </p>
                        {skillGains.elective > 0 && (
                          <p style={{ margin: '3px 0', fontSize: '13px', color: '#2c7a7b' }}>
                            • Elective: {skillGains.elective} skill(s)
                          </p>
                        )}
                        {skillGains.secondary > 0 && (
                          <p style={{ margin: '3px 0', fontSize: '13px', color: '#2c7a7b' }}>
                            • Secondary: {skillGains.secondary} skill(s)
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
          
          {/* Level Stats Display - Shows below both columns */}
              {occData && (
            <div className="level-stats" style={{
              backgroundColor: '#f7fafc',
              padding: '20px',
              borderRadius: '8px',
              border: '2px solid #cbd5e0',
              marginTop: '20px'
            }}>
              <h3 style={{ marginTop: 0, color: '#2d3748', borderBottom: '2px solid #cbd5e0', paddingBottom: '10px' }}>
                📊 Level {level} Statistics
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginTop: '15px' }}>
                <div className="stat-row" style={{ 
                  backgroundColor: 'white', 
                  padding: '10px', 
                  borderRadius: '5px',
                  border: '1px solid #e2e8f0'
                }}>
                  <span style={{ fontWeight: 'bold', color: '#4a5568' }}>❤️ HP:</span>
                  <strong style={{ color: '#e53e3e', fontSize: '18px' }}>{levelStats.hp || 'Roll attributes first'}</strong>
                    <button
                      onClick={() => setUseDeterministicHP(!useDeterministicHP)}
                      className={`hp-toggle-btn ${useDeterministicHP ? 'deterministic' : 'random'}`}
                      title={useDeterministicHP ? 'Using average HP values (click to use random rolls)' : 'Using random HP rolls (click to use averages)'}
                    style={{ marginLeft: '10px', cursor: 'pointer' }}
                    >
                      {useDeterministicHP ? '📊' : '🎲'}
                    </button>
                  </div>
                <div className="stat-row" style={{ 
                  backgroundColor: 'white', 
                  padding: '10px', 
                  borderRadius: '5px',
                  border: '1px solid #e2e8f0'
                }}>
                  <span style={{ fontWeight: 'bold', color: '#4a5568' }}>⚔️ Attacks/Melee:</span>
                  <strong style={{ color: '#2d3748', fontSize: '18px' }}>{levelStats.attacksPerMelee ?? 2}</strong>
                  </div>
                <div className="stat-row" style={{ 
                  backgroundColor: 'white', 
                  padding: '10px', 
                  borderRadius: '5px',
                  border: '1px solid #e2e8f0'
                }}>
                  <span style={{ fontWeight: 'bold', color: '#4a5568' }}>🛡️ Save vs Magic:</span>
                  <strong style={{ color: '#2d3748', fontSize: '18px' }}>{levelStats.saves?.vsMagic ?? 14}</strong>
                  </div>
                <div className="stat-row" style={{ 
                  backgroundColor: 'white', 
                  padding: '10px', 
                  borderRadius: '5px',
                  border: '1px solid #e2e8f0'
                }}>
                  <span style={{ fontWeight: 'bold', color: '#4a5568' }}>💀 Save vs Poison:</span>
                  <strong style={{ color: '#2d3748', fontSize: '18px' }}>{levelStats.saves?.vsPoison ?? 14}</strong>
                  </div>
                <div className="stat-row" style={{ 
                  backgroundColor: 'white', 
                  padding: '10px', 
                  borderRadius: '5px',
                  border: '1px solid #e2e8f0'
                }}>
                  <span style={{ fontWeight: 'bold', color: '#4a5568' }}>🧠 Save vs Psionics:</span>
                  <strong style={{ color: '#2d3748', fontSize: '18px' }}>{levelStats.saves?.vsPsionics ?? 15}</strong>
                  </div>
                <div className="stat-row" style={{ 
                  backgroundColor: 'white', 
                  padding: '10px', 
                  borderRadius: '5px',
                  border: '1px solid #e2e8f0'
                }}>
                  <span style={{ fontWeight: 'bold', color: '#4a5568' }}>🎯 Strike Bonus:</span>
                  <strong style={{ color: '#38a169', fontSize: '18px' }}>+{levelStats.combatBonuses?.strike ?? 0}</strong>
                  </div>
                <div className="stat-row" style={{ 
                  backgroundColor: 'white', 
                  padding: '10px', 
                  borderRadius: '5px',
                  border: '1px solid #e2e8f0'
                }}>
                  <span style={{ fontWeight: 'bold', color: '#4a5568' }}>🛡️ Parry Bonus:</span>
                  <strong style={{ color: '#38a169', fontSize: '18px' }}>+{levelStats.combatBonuses?.parry ?? 0}</strong>
                  </div>
                <div className="stat-row" style={{ 
                  backgroundColor: 'white', 
                  padding: '10px', 
                  borderRadius: '5px',
                  border: '1px solid #e2e8f0'
                }}>
                  <span style={{ fontWeight: 'bold', color: '#4a5568' }}>🏃 Dodge Bonus:</span>
                  <strong style={{ color: '#38a169', fontSize: '18px' }}>+{levelStats.combatBonuses?.dodge ?? 0}</strong>
                  </div>
                  {levelStats.ppe > 0 && (
                  <div className="stat-row" style={{ 
                    backgroundColor: 'white', 
                    padding: '10px', 
                    borderRadius: '5px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <span style={{ fontWeight: 'bold', color: '#4a5568' }}>🔮 PPE:</span>
                    <strong style={{ color: '#805ad5', fontSize: '18px' }}>{levelStats.ppe}</strong>
                    </div>
                  )}
                  {levelStats.isp > 0 && (
                  <div className="stat-row" style={{ 
                    backgroundColor: 'white', 
                    padding: '10px', 
                    borderRadius: '5px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <span style={{ fontWeight: 'bold', color: '#4a5568' }}>🧠 ISP:</span>
                    <strong style={{ color: '#805ad5', fontSize: '18px' }}>{levelStats.isp}</strong>
                    </div>
                  )}
                </div>
              <div className="hp-info" style={{ marginTop: '15px', padding: '10px', backgroundColor: '#edf2f7', borderRadius: '5px' }}>
                <small style={{ color: '#4a5568', fontStyle: 'italic', fontSize: '13px' }}>
                  💾 Will save: {(() => {
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
              {(occSkills.length > 0 || electiveSkills.length > 0 || secondarySkills.length > 0) && (
                <div className="skill-bonuses-section" style={{ marginTop: '20px' }}>
                  {/* General Skill Bonuses */}
                  {(levelStats.skillBonuses?.strike > 0 || 
                    levelStats.skillBonuses?.parry > 0 || 
                    levelStats.skillBonuses?.dodge > 0 || 
                    levelStats.skillBonuses?.damage > 0 ||
                    levelStats.skillBonuses?.attacksPerMelee > 0) && (
                    <div className="general-skill-bonuses">
                      <h4>🥊 Active Skill Bonuses (Always Applied):</h4>
                      <div className="bonus-grid">
                        {levelStats.skillBonuses.strike > 0 && (
                          <div className="bonus-item">
                            <span className="bonus-label">Strike:</span>
                            <span className="bonus-value">+{levelStats.skillBonuses.strike}</span>
                          </div>
                        )}
                        {levelStats.skillBonuses.parry > 0 && (
                          <div className="bonus-item">
                            <span className="bonus-label">Parry:</span>
                            <span className="bonus-value">+{levelStats.skillBonuses.parry}</span>
                          </div>
                        )}
                        {levelStats.skillBonuses.dodge > 0 && (
                          <div className="bonus-item">
                            <span className="bonus-label">Dodge:</span>
                            <span className="bonus-value">+{levelStats.skillBonuses.dodge}</span>
                          </div>
                        )}
                        {levelStats.skillBonuses.damage > 0 && (
                          <div className="bonus-item">
                            <span className="bonus-label">Damage:</span>
                            <span className="bonus-value">+{levelStats.skillBonuses.damage}</span>
                          </div>
                        )}
                        {levelStats.skillBonuses.attacksPerMelee > 0 && (
                          <div className="bonus-item">
                            <span className="bonus-label">Attacks/Melee:</span>
                            <span className="bonus-value">+{levelStats.skillBonuses.attacksPerMelee}</span>
                          </div>
                        )}
                      </div>
                      <p className="bonus-note">From: {[...occSkills, ...electiveSkills, ...secondarySkills]
                        .filter(skill => !skill.startsWith('W.P.') && 
                          ['Hand to Hand: Basic', 'Hand to Hand: Expert', 'Hand to Hand: Mercenary', 
                           'Hand to Hand: Knight', 'Hand to Hand: Assassin', 'Hand to Hand: Martial Arts',
                           'Boxing', 'Wrestling', 'Acrobatics', 'Gymnastics'].includes(skill))
                        .join(', ') || 'Your combat skills'}</p>
                    </div>
                  )}
                  
                  {/* Weapon Proficiencies */}
                  {levelStats.skillBonuses?.weaponProficiencies?.length > 0 && (
                    <div className="weapon-proficiencies">
                      <h4>⚔️ Weapon Proficiencies (Weapon-Specific):</h4>
                      <ul>
                        {levelStats.skillBonuses.weaponProficiencies.map((wp, index) => (
                          <li key={index}>
                            <strong>{wp.name.replace('W.P. ', '')}:</strong>
                            {wp.bonuses.strike > 0 && ` +${wp.bonuses.strike} strike`}
                            {wp.bonuses.parry > 0 && ` +${wp.bonuses.parry} parry`}
                            {wp.bonuses.dodge > 0 && ` +${wp.bonuses.dodge} dodge`}
                            {wp.bonuses.damage > 0 && ` +${wp.bonuses.damage} damage`}
                            <span className="wp-level-note"> (at level {level})</span>
                          </li>
                        ))}
                      </ul>
                      <p className="wp-note">* W.P. bonuses only apply when using that weapon type and improve with level</p>
                    </div>
                  )}
                </div>
              )}
              
              <p className="level-hint" style={{ marginTop: '15px', padding: '10px', backgroundColor: '#edf2f7', borderRadius: '5px', color: '#4a5568', fontSize: '14px' }}>
                💡 Stats update automatically based on your level and class
              </p>
            </div>
          )}
        </section>

        {/* Action Buttons */}
        <section className="creation-section action-section">
          <div className="button-row">
            <Button 
              onClick={handleSubmit} 
              className="create-button"
            >
              ✨ Create Character
            </Button>
            <button 
              onClick={() => navigate(-1)} 
              className="back-button"
            >
              ← Back
            </button>
          </div>
        </section>
      {/* Temporarily disabled D20 spinner for background rolls */}
      {/* {isRolling && (
        <D20LoadingSpinner 
          onFinish={handleRollFinish}
          rollType={rollType}
        />
      )} */}

      {attributes.PS && (
        <div className="carry-weight-section">
          <h3>Carry Weight Calculations</h3>
          <p>Maximum Carry Weight: {attributes.PS * 10} lbs</p>
          <p>Light Activity Duration: {attributes.PE * 2} minutes</p>
          <p>Heavy Activity Duration: {attributes.PE} minutes</p>
        </div>
        )}
      </div>

      {/* Skill Selection Modal for Level Up */}
      {showSkillSelectionModal && occData && (
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
              ⬆️ Level Up: Select New Skills
            </h2>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              You are leveling up from level {level} to level {pendingLevelChange}. 
              Please select your new skills according to your O.C.C. progression.
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
                  {occData.electiveSkills?.list
                    ?.filter(skill => !electiveSkills.includes(skill) && !isSkillInOccSkills(skill, occSkills))
                    .map((skill, idx) => {
                      const skillData = palladiumData.skills?.[skill];
                      const formattedSkill = formatSkillWithPercent(skill, occData.name, parseInt(pendingLevelChange) || parseInt(level) || 1);
                      return (
                        <option key={idx} value={skill} title={skillData?.description || skill}>
                          {formattedSkill}
                        </option>
                      );
                    })}
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
                  Basic/general skills only - no advanced or OCC-specific skills
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
                  {palladiumData.secondarySkills
                    ?.filter(skill => !secondarySkills.includes(skill) && !isSkillInOccSkills(skill, occSkills))
                    .map((skill, idx) => {
                      const formattedSkill = formatSkillWithPercent(skill, occData.name, parseInt(pendingLevelChange) || parseInt(level) || 1);
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

