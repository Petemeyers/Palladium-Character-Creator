import React, { useState, useEffect } from 'react';
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

/**
 * CharacterSheet Component
 * Editable Palladium Fantasy RPG Character Sheet (1994 edition)
 * Allows editing character data and exporting to JSON or PDF
 */
export default function CharacterSheet({ characterData = null, onSave = null }) {
  const toast = useToast();
  
  const [character, setCharacter] = useState({
    name: '',
    race: '',
    occ: '',
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
    sdc: '',
    ppe: '',
    isp: '',
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
        race: characterData.species || characterData.race || '',
        occ: characterData.class || characterData.occ || '',
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
        sdc: characterData.sdc || '',
        ppe: characterData.ppe || '',
        isp: characterData.isp || '',
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
    if (char.occSkills?.length) {
      skills.push('O.C.C. Skills:');
      char.occSkills.forEach(skill => {
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
      occ: '',
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
      sdc: '',
      ppe: '',
      isp: '',
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
    { key: 'iq', label: 'I.Q.' },
    { key: 'me', label: 'M.E.' },
    { key: 'ma', label: 'M.A.' },
    { key: 'ps', label: 'P.S.' },
    { key: 'pp', label: 'P.P.' },
    { key: 'pe', label: 'P.E.' },
    { key: 'pb', label: 'P.B.' },
    { key: 'spd', label: 'Spd' },
  ];

  return (
    <Box className="character-sheet" maxW="4xl" mx="auto" p={4} bg="white" borderRadius="md" boxShadow="lg">
      <VStack spacing={4} align="stretch">
        {/* Header */}
        <Box textAlign="center" pb={4}>
          <Heading size="lg" mb={2}>
            Palladium Fantasy RPG Character Sheet
          </Heading>
          <Text fontSize="sm" color="gray.600">
            (1994 Edition)
          </Text>
        </Box>

        <Divider />

        {/* Basic Information */}
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
              placeholder="Race / Species"
              value={character.race}
              onChange={handleChange}
              size="md"
            />
          </GridItem>
          <GridItem>
            <Input
              name="occ"
              placeholder="O.C.C."
              value={character.occ}
              onChange={handleChange}
              size="md"
            />
          </GridItem>
          <GridItem>
            <Input
              name="alignment"
              placeholder="Alignment"
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

        <Divider />

        {/* Attributes */}
        <Box>
          <Text fontWeight="bold" mb={2} fontSize="sm" color="gray.700">
            Attributes
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

        <Divider />

        {/* Combat Stats */}
        <Box>
          <Text fontWeight="bold" mb={2} fontSize="sm" color="gray.700">
            Combat Statistics
          </Text>
          <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }} gap={3}>
            <Input
              name="hitPoints"
              placeholder="Hit Points (HP)"
              value={character.hitPoints}
              onChange={handleChange}
              size="md"
            />
            <Input
              name="sdc"
              placeholder="S.D.C."
              value={character.sdc}
              onChange={handleChange}
              size="md"
            />
            <Input
              name="ppe"
              placeholder="P.P.E."
              value={character.ppe}
              onChange={handleChange}
              size="md"
            />
            <Input
              name="isp"
              placeholder="I.S.P."
              value={character.isp}
              onChange={handleChange}
              size="md"
            />
          </Grid>
        </Box>

        <Divider />

        {/* Skills */}
        <Box>
          <Text fontWeight="bold" mb={2} fontSize="sm" color="gray.700">
            Skills / Percentages
          </Text>
          <Textarea
            name="skills"
            placeholder="List skills and their percentages (e.g., Climbing 60%, Swimming 55%)"
            value={character.skills}
            onChange={handleChange}
            rows={6}
            resize="vertical"
          />
        </Box>

        {/* Weapons */}
        <Box>
          <Text fontWeight="bold" mb={2} fontSize="sm" color="gray.700">
            Weapons / Proficiencies
          </Text>
          <Textarea
            name="weapons"
            placeholder="List weapons and proficiencies (e.g., Longsword 85%, Shortbow 70%)"
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
            💾 Save Character
          </Button>
          <HStack spacing={2}>
            <Button
              variant="outline"
              onClick={exportToJSON}
              size="md"
            >
              📄 Export JSON
            </Button>
            <Button
              variant="outline"
              onClick={exportToPDF}
              size="md"
            >
              📑 Export PDF
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

