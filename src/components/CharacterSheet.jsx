import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Input,
  Textarea,
  Button,
  VStack,
  HStack,
  Heading,
  Text,
  Grid,
  GridItem,
  Divider,
  useToast,
} from '@chakra-ui/react';
import axiosInstance from '../utils/axios';
import { getPublicSkillById } from '../utils/publicClassAdapter.js';
import { formatSignedModifier, getPublicDerivedStatsForCharacter } from '../utils/publicDerivedStats.js';
import { buildActorSheetDisplay } from '../utils/actorSheetDisplay.js';

const getDisplayClassName = (character) =>
  character?.publicClassName || character?.class || character?.profession || '';

const getDisplayBackgroundName = (character) =>
  character?.publicBackgroundName || character?.background || character?.socialBackground || '';

const getDisplaySpeciesName = (character) =>
  character?.publicSpeciesName || character?.species || character?.race || character?.category || '';

const getDisplayAge = (character) => {
  const value = character?.age;
  if (value === undefined || value === null || value === '' || value === 0 || value === '0' || value === 'Not set') {
    return '';
  }
  return value;
};

const PUBLIC_ABILITY_LABELS = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

const getDisplayAbilityScores = (character) => {
  if (!character?.finalAbilityScores) {
    return [];
  }

  return Object.entries(PUBLIC_ABILITY_LABELS)
    .map(([key, label]) => {
      const score = character.finalAbilityScores?.[key];
      if (score === undefined || score === null || score === '') {
        return null;
      }

      const modifier = character.abilityModifiers?.[key];
      return {
        key,
        label,
        score,
        modifier:
          modifier === undefined || modifier === null
            ? ''
            : `${modifier >= 0 ? '+' : ''}${modifier}`,
      };
    })
    .filter(Boolean);
};

const getDisplayPublicSkillNames = (character) =>
  [...new Set(character?.publicSkillProficiencies || [])].map((skillId) => {
    const skill = getPublicSkillById(skillId);
    return skill?.name || String(skillId);
  });

const formatClassSkillLabel = () => 'Class Skills:';

/**
 * CharacterSheet Component
 * Editable Medieval Combat Simulator Character Sheet (1994 edition)
 * Allows editing character data and exporting to JSON or PDF
 */
export default function CharacterSheet({ characterData = null, onSave = null }) {
  const toast = useToast();
  
  const [character, setCharacter] = useState({
    name: '',
    race: '',
    profession: '',
    alignment: '',
    level: 1,
    iq: '',
    me: '',
    ma: '',
    ps: '',
    pp: '',
    pe: '',
    pb: '',
    spd: '',
    hitPoints: '',
    armorDurability: '',
    stamina: '',
    focus: '',
    skills: '',
    weapons: '',
    gear: '',
    notes: '',
  });

  // Load character data if provided
  useEffect(() => {
    if (characterData) {
      setCharacter({
        name: characterData.name || '',
        race: getDisplaySpeciesName(characterData),
        profession: getDisplayClassName(characterData),
        alignment: characterData.alignment || '',
        level: characterData.level || 1,
        iq: characterData.attributes?.iq || '',
        me: characterData.attributes?.me || '',
        ma: characterData.attributes?.ma || '',
        ps: characterData.attributes?.ps || '',
        pp: characterData.attributes?.pp || '',
        pe: characterData.attributes?.pe || '',
        pb: characterData.attributes?.pb || '',
        spd: characterData.attributes?.spd || '',
        hitPoints: characterData.hp || characterData.hitPoints || '',
        armorDurability: characterData.armorDurability || '',
        stamina: characterData.stamina || '',
        focus: characterData.focus || '',
        skills: formatSkills(characterData),
        weapons: formatWeapons(characterData),
        gear: formatGear(characterData),
        notes: characterData.notes || '',
      });
    }
  }, [characterData]);

  // Helper function to format skills from character data
  const formatSkills = (char) => {
    if (!char) return '';
    const skills = [];
    if (char.professionSkills?.length) {
      skills.push(formatClassSkillLabel());
      char.professionSkills.forEach(skill => {
        skills.push(`  ${skill.name || skill}: ${skill.percentage || skill.percent || ''}%`);
      });
    }
    if (char.electiveSkills?.length) {
      skills.push('\nElective Skills:');
      char.electiveSkills.forEach(skill => {
        skills.push(`  ${skill.name || skill}: ${skill.percentage || skill.percent || ''}%`);
      });
    }
    if (char.secondarySkills?.length) {
      skills.push('\nSecondary Skills:');
      char.secondarySkills.forEach(skill => {
        skills.push(`  ${skill.name || skill}: ${skill.percentage || skill.percent || ''}%`);
      });
    }
    return skills.join('\n');
  };

  // Helper function to format weapons from character data
  const formatWeapons = (char) => {
    if (!char) return '';
    const weapons = [];
    if (char.weapons?.length) {
      char.weapons.forEach(weapon => {
        const weaponName = weapon.name || weapon.weaponName || weapon;
        const proficiency = weapon.proficiency || weapon.prof || '';
        weapons.push(`${weaponName}${proficiency ? ` (${proficiency}%)` : ''}`);
      });
    }
    return weapons.join('\n');
  };

  // Helper function to format gear from character data
  const formatGear = (char) => {
    if (!char) return '';
    const gear = [];
    if (char.inventory?.length) {
      char.inventory.forEach(item => {
        const itemName = item.name || item.itemName || item;
        const quantity = item.quantity || item.qty || '';
        gear.push(`${itemName}${quantity ? ` x${quantity}` : ''}`);
      });
    }
    return gear.join('\n');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCharacter((prev) => ({ ...prev, [name]: value }));
  };

  // Export to JSON
  const exportToJSON = () => {
    try {
      const blob = new Blob([JSON.stringify(character, null, 2)], {
        type: 'application/json',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${character.name || 'character'}.json`;
      link.click();
      
      toast({
        title: 'Export Successful',
        description: `Character exported as ${character.name || 'character'}.json`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: error.message,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Export to PDF (requires jspdf and html2canvas)
  const exportToPDF = async () => {
    try {
      // Dynamic import to avoid breaking if libraries aren't installed
      const jsPDF = (await import('jspdf')).default;
      const html2canvas = (await import('html2canvas')).default;

      const sheet = document.querySelector('.character-sheet');
      if (!sheet) {
        throw new Error('Character sheet element not found');
      }

      const canvas = await html2canvas(sheet, {
        scale: 2,
        useCORS: true,
        logging: false,
      });
      
      const pdf = new jsPDF('p', 'pt', 'a4');
      const img = canvas.toDataURL('image/png');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 40; // 20pt margin on each side
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 20;

      pdf.addImage(img, 'PNG', 20, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight - 40;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 20;
        pdf.addPage();
        pdf.addImage(img, 'PNG', 20, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight - 40;
      }

      pdf.save(`${character.name || 'character'}.pdf`);
      
      toast({
        title: 'PDF Export Successful',
        description: `Character exported as ${character.name || 'character'}.pdf`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      // Check if it's a missing dependency error
      if (error.message.includes('Cannot find module') || error.message.includes('jspdf') || error.message.includes('html2canvas')) {
        toast({
          title: 'PDF Export Not Available',
          description: 'Please install jspdf and html2canvas: npm install jspdf html2canvas',
          status: 'warning',
          duration: 5000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'PDF Export Failed',
          description: error.message,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    }
  };

  // Save to backend if onSave callback is provided
  const saveToBackend = async () => {
    if (onSave) {
      try {
        await onSave(character);
        toast({
          title: 'Character Saved',
          description: 'Character data saved successfully',
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } catch (error) {
        toast({
          title: 'Save Failed',
          description: error.message || 'Failed to save character',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } else {
      // Try to save via axios if character has an ID
      if (characterData?._id) {
        try {
          await axiosInstance.put(`/characters/${characterData._id}`, character);
          toast({
            title: 'Character Saved',
            description: 'Character updated successfully',
            status: 'success',
            duration: 3000,
            isClosable: true,
          });
        } catch (error) {
          toast({
            title: 'Save Failed',
            description: error.response?.data?.message || error.message || 'Failed to save character',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
        }
      } else {
        toast({
          title: 'Save Failed',
          description: 'No save handler provided and character has no ID',
          status: 'warning',
          duration: 3000,
          isClosable: true,
        });
      }
    }
  };

  const clearSheet = () => {
    setCharacter({
      name: '',
      race: '',
      profession: '',
      alignment: '',
      level: 1,
      iq: '',
      me: '',
      ma: '',
      ps: '',
      pp: '',
      pe: '',
      pb: '',
      spd: '',
      hitPoints: '',
      armorDurability: '',
      stamina: '',
      focus: '',
      skills: '',
      weapons: '',
      gear: '',
      notes: '',
    });
    
    toast({
      title: 'Sheet Cleared',
      description: 'Character sheet has been cleared',
      status: 'info',
      duration: 2000,
      isClosable: true,
    });
  };

  const attributeFields = [
    { key: 'iq', label: 'intellect' },
    { key: 'me', label: 'willpower' },
    { key: 'ma', label: 'presence' },
    { key: 'ps', label: 'strength' },
    { key: 'pp', label: 'agility' },
    { key: 'pe', label: 'endurance' },
    { key: 'pb', label: 'charisma' },
    { key: 'spd', label: 'Speed' },
  ];
  const displayClassName = getDisplayClassName(characterData);
  const displayBackgroundName = getDisplayBackgroundName(characterData);
  const displaySpeciesName = getDisplaySpeciesName(characterData);
  const displayAge = getDisplayAge(characterData);
  const displayAbilityScores = getDisplayAbilityScores(characterData);
  const displayLanguages = Array.isArray(characterData?.publicLanguages)
    ? characterData.publicLanguages.filter(Boolean).join(', ')
    : '';
  const publicSkillNames = getDisplayPublicSkillNames(characterData);
  const publicDerivedStats = getPublicDerivedStatsForCharacter(characterData || {});
  const sheetDisplay = useMemo(
    () => buildActorSheetDisplay(characterData || character),
    [characterData, character]
  );

  return (
    <Box className="character-sheet" maxW="4xl" mx="auto" p={4} bg="white" borderRadius="md" boxShadow="lg">
      <VStack spacing={4} align="stretch">
        {/* Header */}
        <Box textAlign="center" pb={4}>
          <Heading size="lg" mb={2}>
            Medieval Combat Simulator Character Sheet
          </Heading>
          <Text fontSize="sm" color="gray.600">
            Current Edition
          </Text>
        </Box>

        <Divider />

        <Box>
          <Heading size="sm" mb={3}>Identity</Heading>
          <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={3}>
            <Text fontSize="sm"><strong>Name:</strong> {sheetDisplay.identity.name}</Text>
            <Text fontSize="sm"><strong>Battle Side:</strong> {sheetDisplay.identity.battleSide}</Text>
            <Text fontSize="sm"><strong>Team:</strong> {sheetDisplay.identity.team}</Text>
            <Text fontSize="sm"><strong>Species / Category:</strong> {sheetDisplay.identity.species}</Text>
            <Text fontSize="sm"><strong>Profession / Role:</strong> {sheetDisplay.identity.role}</Text>
            <Text fontSize="sm"><strong>Source:</strong> {sheetDisplay.identity.source}</Text>
            <Text fontSize="sm"><strong>Control Mode:</strong> {sheetDisplay.identity.controlMode}</Text>
          </Grid>
        </Box>

        <Divider />

        <Box>
          <Heading size="sm" mb={3}>Combat State</Heading>
          <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }} gap={3}>
            <Text fontSize="sm"><strong>HP:</strong> {sheetDisplay.combatState.hpCurrent} / {sheetDisplay.combatState.hpMax}</Text>
            <Text fontSize="sm"><strong>Living State:</strong> {sheetDisplay.combatState.livingState}</Text>
            <Text fontSize="sm"><strong>Combat State:</strong> {sheetDisplay.combatState.combatState}</Text>
            <Text fontSize="sm"><strong>Current Posture:</strong> {sheetDisplay.combatState.posture}</Text>
            <Text fontSize="sm"><strong>Actions Remaining:</strong> {sheetDisplay.combatState.actionsRemaining}</Text>
          </Grid>
          {sheetDisplay.combatState.inactive && (
            <Text mt={2} fontWeight="bold" color="orange.700">No longer active combatant</Text>
          )}
        </Box>

        <Divider />

        <Box>
          <Heading size="sm" mb={3}>Core Simulator Attributes</Heading>
          {sheetDisplay.coreAttributes.entries.length > 0 ? (
            <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }} gap={3}>
              {sheetDisplay.coreAttributes.entries.map((entry) => (
                <Text key={entry.key} fontSize="sm"><strong>{entry.label}:</strong> {entry.value}</Text>
              ))}
            </Grid>
          ) : (
            <Text fontSize="sm" color="orange.700">Not yet assigned. Using compatibility fallback.</Text>
          )}
        </Box>

        <Divider />

        <Grid templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }} gap={5}>
          <Box>
            <Heading size="sm" mb={3}>Stamina &amp; Fatigue</Heading>
            <VStack align="stretch" spacing={1}>
              <Text fontSize="sm"><strong>Stamina:</strong> {sheetDisplay.stamina.current} / {sheetDisplay.stamina.max}</Text>
              <Text fontSize="sm"><strong>Band:</strong> {sheetDisplay.stamina.band}</Text>
              <Text fontSize="sm"><strong>Fatigue Notes:</strong> {sheetDisplay.stamina.fatigueNotes}</Text>
              <Text fontSize="sm"><strong>Recovery:</strong> Catch Breath restores 3 stamina</Text>
              <Text fontSize="sm"><strong>Defensive Posture:</strong> may recover 1 stamina if not attacked</Text>
              <Text fontSize="sm"><strong>Armor Burden:</strong> {sheetDisplay.armor.burden}</Text>
            </VStack>
          </Box>
          <Box>
            <Heading size="sm" mb={3}>Morale &amp; Resolve</Heading>
            <VStack align="stretch" spacing={1}>
              <Text fontSize="sm"><strong>Morale:</strong> {sheetDisplay.morale.state}</Text>
              <Text fontSize="sm"><strong>Resolve:</strong> {sheetDisplay.morale.resolve ?? 'Not assigned'}</Text>
              <Text fontSize="sm"><strong>Pressure:</strong> {sheetDisplay.morale.pressure}</Text>
              <Text fontSize="sm"><strong>Rally:</strong> {sheetDisplay.morale.rally}</Text>
            </VStack>
          </Box>
        </Grid>

        <Divider />

        <Box>
          <Heading size="sm" mb={3}>Defense &amp; Armor</Heading>
          <Text fontSize="sm" fontWeight="bold">{sheetDisplay.armor.name}</Text>
          {sheetDisplay.armor.kind === 'itemized' ? (
            <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={2} mt={2}>
              <Text fontSize="sm"><strong>Class:</strong> {sheetDisplay.armor.armorClass}</Text>
              <Text fontSize="sm"><strong>Coverage:</strong> {sheetDisplay.armor.coverage}</Text>
              <Text fontSize="sm"><strong>Condition:</strong> {sheetDisplay.armor.condition}</Text>
              <Text fontSize="sm"><strong>Lootable:</strong> {sheetDisplay.armor.lootable}</Text>
              <Text fontSize="sm"><strong>Guard / Defense Bonus:</strong> {sheetDisplay.armor.guardBonus ?? 'Not recorded'}</Text>
              <Text fontSize="sm"><strong>Stamina Burden:</strong> {sheetDisplay.armor.burden}</Text>
              <Text fontSize="sm"><strong>Morale Protection:</strong> {sheetDisplay.armor.moraleProtection}</Text>
            </Grid>
          ) : (
            <VStack align="stretch" spacing={1} mt={2}>
              <Text fontSize="sm"><strong>Source:</strong> {sheetDisplay.armor.source}</Text>
              <Text fontSize="sm"><strong>Lootable:</strong> {sheetDisplay.armor.lootable}</Text>
              <Text fontSize="sm"><strong>Stamina Burden:</strong> {sheetDisplay.armor.burden}</Text>
            </VStack>
          )}
          {sheetDisplay.armor.shield && (
            <Box mt={3} pl={3} borderLeftWidth="3px" borderColor="blue.300">
              <Text fontSize="sm" fontWeight="bold">Shield: {sheetDisplay.armor.shield.name}</Text>
              <Text fontSize="sm">Stamina Burden: {sheetDisplay.armor.shield.burden}</Text>
              <Text fontSize="sm">Defensive Use: {sheetDisplay.armor.shield.defensiveUse}</Text>
            </Box>
          )}
        </Box>

        <Divider />

        <Box>
          <Heading size="sm" mb={3}>Weapons</Heading>
          {sheetDisplay.weapons.length > 0 ? sheetDisplay.weapons.map((weapon) => (
            <Box key={weapon.key} borderWidth="1px" borderRadius="md" p={2} mb={2}>
              <Text fontWeight="bold" fontSize="sm">{weapon.name}</Text>
              <Text fontSize="sm">Slot: {weapon.slot} | Damage: {weapon.damage} | Reach: {weapon.reach ?? 'Not recorded'} | Attack Type: {weapon.attackType} | Attack Cost: {weapon.staminaCost} stamina</Text>
            </Box>
          )) : <Text fontSize="sm" color="gray.600">No equipped weapon data available.</Text>}
        </Box>

        <Box>
          <Heading size="sm" mb={3}>Actions / Techniques</Heading>
          {sheetDisplay.actions.standard.map((action) => <Text key={action} fontSize="sm">{action}</Text>)}
          {sheetDisplay.actions.techniques.map((technique) => <Text key={technique} fontSize="sm">Technique: {technique}</Text>)}
        </Box>

        <Divider />

        {/* Basic Information */}
        <Box>
          <Text fontWeight="bold" mb={1} fontSize="sm" color="gray.700">
            Legacy Compatibility Editor
          </Text>
          <Text fontSize="sm" color="gray.600">
            For simulator-profile characters, use Character Creator.
          </Text>
        </Box>
        <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }} gap={4}>
          <GridItem>
            <Input
              name="name"
              placeholder="Character Name"
              value={character.name}
              onChange={handleChange}
              size="md"
            />
          </GridItem>
          <GridItem>
            <Input
              name="race"
              placeholder="Category"
              value={character.race}
              onChange={handleChange}
              size="md"
            />
          </GridItem>
          <GridItem>
            <Input
              name="profession"
              placeholder="Class"
              value={character.profession}
              onChange={handleChange}
              size="md"
            />
          </GridItem>
          <GridItem>
            <Input
              name="alignment"
              placeholder="Legacy Alignment"
              value={character.alignment}
              onChange={handleChange}
              size="md"
            />
          </GridItem>
          <GridItem>
            <Input
              name="level"
              type="number"
              placeholder="Level"
              value={character.level}
              onChange={handleChange}
              size="md"
            />
          </GridItem>
        </Grid>

        {(displayClassName || displayBackgroundName || displaySpeciesName || displayLanguages || displayAge || displayAbilityScores.length > 0 || publicSkillNames.length > 0 || publicDerivedStats) && (
          <Box>
            <Text fontWeight="bold" mb={2} fontSize="sm" color="gray.700">
              Imported Character Details
            </Text>
            <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={3}>
              {displayClassName && (
                <GridItem>
                  <Text fontSize="sm">
                    <strong>Class:</strong> {displayClassName}
                  </Text>
                </GridItem>
              )}
              {displayBackgroundName && (
                <GridItem>
                  <Text fontSize="sm">
                    <strong>Background:</strong> {displayBackgroundName}
                  </Text>
                </GridItem>
              )}
              {displaySpeciesName && (
                <GridItem>
                  <Text fontSize="sm">
                    <strong>Species:</strong> {displaySpeciesName}
                  </Text>
                </GridItem>
              )}
              {displayLanguages && (
                <GridItem>
                  <Text fontSize="sm">
                    <strong>Languages:</strong> {displayLanguages}
                  </Text>
                </GridItem>
              )}
              {displayAge && (
                <GridItem>
                  <Text fontSize="sm">
                    <strong>Age:</strong> {displayAge}
                  </Text>
                </GridItem>
              )}
              {publicSkillNames.length > 0 && (
                <GridItem>
                  <Text fontSize="sm">
                    <strong>Public Proficiencies:</strong> {publicSkillNames.join(', ')}
                  </Text>
                </GridItem>
              )}
            </Grid>
            {publicDerivedStats && (
              <Box mt={3}>
                <Text fontWeight="bold" mb={2} fontSize="sm" color="gray.700">
                  Public Derived Numbers
                </Text>
                <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }} gap={3}>
                  <GridItem>
                    <Text fontSize="sm"><strong>Proficiency Bonus:</strong> {formatSignedModifier(publicDerivedStats.proficiencyBonus)}</Text>
                  </GridItem>
                  <GridItem>
                    <Text fontSize="sm"><strong>Hit Points:</strong> {publicDerivedStats.hitPoints}</Text>
                  </GridItem>
                  <GridItem>
                    <Text fontSize="sm"><strong>Hit Die:</strong> {publicDerivedStats.hitDie}</Text>
                  </GridItem>
                  <GridItem>
                    <Text fontSize="sm"><strong>Initiative:</strong> {formatSignedModifier(publicDerivedStats.initiative)}</Text>
                  </GridItem>
                  <GridItem>
                    <Text fontSize="sm"><strong>Legacy Base AC:</strong> {publicDerivedStats.baseArmorClass}</Text>
                  </GridItem>
                  <GridItem>
                    <Text fontSize="sm"><strong>Passive Perception:</strong> {publicDerivedStats.passivePerception}</Text>
                  </GridItem>
                </Grid>
                <Box as="details" mt={3}>
                  <Box as="summary" fontWeight="bold" fontSize="sm" color="gray.700">
                    Saving Throws
                  </Box>
                  <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }} gap={2} mt={2}>
                    {Object.entries(publicDerivedStats.savingThrows || {}).map(([abilityId, save]) => (
                      <GridItem key={abilityId}>
                        <Text fontSize="sm">
                          <strong>{save.label}:</strong> {formatSignedModifier(save.total)}{save.proficient ? ' proficient' : ''}
                        </Text>
                      </GridItem>
                    ))}
                  </Grid>
                </Box>
                <Box as="details" mt={3}>
                  <Box as="summary" fontWeight="bold" fontSize="sm" color="gray.700">
                    Skills
                  </Box>
                  <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }} gap={2} mt={2}>
                    {(publicDerivedStats.skills || []).map((skill) => (
                      <GridItem key={skill.id}>
                        <Text fontSize="sm">
                          <strong>{skill.name}:</strong> {formatSignedModifier(skill.total)}{skill.proficient ? ' proficient' : ''}
                        </Text>
                      </GridItem>
                    ))}
                  </Grid>
                </Box>
              </Box>
            )}
          </Box>
        )}

        <Divider />

        {/* Attributes */}
        {displayAbilityScores.length > 0 ? (
          <Box as="details">
            <Box as="summary" fontWeight="bold" mb={2} fontSize="sm" color="gray.700">
              Legacy Compatibility
            </Box>
            <Text fontSize="sm" mb={2}><strong>Legacy Alignment:</strong> {sheetDisplay.legacy.alignment}</Text>
            {displayAbilityScores.length > 0 && (
              <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }} gap={3} mb={3}>
                {displayAbilityScores.map((ability) => (
                  <GridItem key={ability.key}>
                    <Text fontSize="sm"><strong>{ability.label}:</strong> {ability.score}{ability.modifier ? ` (${ability.modifier})` : ''}</Text>
                  </GridItem>
                ))}
              </Grid>
            )}
            <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }} gap={3}>
              {attributeFields.map(({ key, label }) => (
                <Input
                  key={key}
                  name={key}
                  placeholder={label}
                  value={character[key]}
                  onChange={handleChange}
                  size="md"
                />
              ))}
            </Grid>
          </Box>
        ) : (
          <Box>
            <Text fontWeight="bold" mb={2} fontSize="sm" color="gray.700">
              Legacy Compatibility Attributes
            </Text>
            <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }} gap={3}>
              {attributeFields.map(({ key, label }) => (
                <Input
                  key={key}
                  name={key}
                  placeholder={label}
                  value={character[key]}
                  onChange={handleChange}
                  size="md"
                />
              ))}
            </Grid>
          </Box>
        )}

        <Divider />

        {/* Combat Stats */}
        <Box>
          <Text fontWeight="bold" mb={2} fontSize="sm" color="gray.700">
            Compatibility Combat Values
          </Text>
          <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }} gap={3}>
            <Input
              name="hitPoints"
              placeholder="Hit Points"
              value={character.hitPoints}
              onChange={handleChange}
              size="md"
            />
            <Input
              name="armorDurability"
              placeholder="Armor Durability"
              value={character.armorDurability}
              onChange={handleChange}
              size="md"
            />
            <Input
              name="stamina"
              placeholder="Stamina"
              value={character.stamina}
              onChange={handleChange}
              size="md"
            />
            <Input
              name="focus"
              placeholder="Focus"
              value={character.focus}
              onChange={handleChange}
              size="md"
            />
          </Grid>
        </Box>

        <Divider />

        {/* Skills */}
        <Box>
          <Text fontWeight="bold" mb={2} fontSize="sm" color="gray.700">
            Compatibility Skills
          </Text>
          <Textarea
            name="skills"
            placeholder="List compatibility skills and values"
            value={character.skills}
            onChange={handleChange}
            rows={6}
            resize="vertical"
          />
        </Box>

        {/* Weapons */}
        <Box>
          <Text fontWeight="bold" mb={2} fontSize="sm" color="gray.700">
            Compatibility Weapons
          </Text>
          <Textarea
            name="weapons"
            placeholder="List compatibility weapons and values"
            value={character.weapons}
            onChange={handleChange}
            rows={4}
            resize="vertical"
          />
        </Box>

        {/* Equipment */}
        <Box>
          <Text fontWeight="bold" mb={2} fontSize="sm" color="gray.700">
            Equipment / Inventory
          </Text>
          <Textarea
            name="gear"
            placeholder="List equipment and inventory items"
            value={character.gear}
            onChange={handleChange}
            rows={4}
            resize="vertical"
          />
        </Box>

        {/* Notes */}
        <Box>
          <Text fontWeight="bold" mb={2} fontSize="sm" color="gray.700">
            Notes / Background
          </Text>
          <Textarea
            name="notes"
            placeholder="Character background, notes, and other information"
            value={character.notes}
            onChange={handleChange}
            rows={4}
            resize="vertical"
          />
        </Box>

        <Divider />

        {/* Action Buttons */}
        <HStack spacing={3} justify="space-between" flexWrap="wrap">
          <Button
            colorScheme="blue"
            onClick={saveToBackend}
            size="md"
          >
            Save Character
          </Button>
          <HStack spacing={2}>
            <Button
              variant="outline"
              onClick={exportToJSON}
              size="md"
            >
              Export JSON
            </Button>
            <Button
              variant="outline"
              onClick={exportToPDF}
              size="md"
            >
              Export PDF
            </Button>
            <Button
              variant="ghost"
              onClick={clearSheet}
              size="md"
            >
              Clear
            </Button>
          </HStack>
        </HStack>
      </VStack>
    </Box>
  );
}

CharacterSheet.propTypes = {
  characterData: PropTypes.object,
  onSave: PropTypes.func,
};

