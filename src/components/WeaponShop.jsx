import React, { useState, useEffect } from 'react';
import axiosInstance from '../utils/axios';
import ItemCard from './ItemCard';
import Confetti from 'react-confetti';
import { equipWeapon, getAvailableWeapons, getWeaponDisplayInfo, syncEquippedWeapons } from '../utils/weaponManager';
import { hasBasicClothes, getAvailableRaceClothing, getRaceClothingInfo } from '../utils/raceClothingManager';
import { 
  hasTradeableStartingEquipment, 
  getTradeableStartingEquipment, 
  getOccEquipmentAlternatives 
} from '../utils/startingEquipmentManager';
import '../styles/WeaponShop.css';

const WeaponShop = () => {
  const [weapons, setWeapons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [showWeaponSelection, setShowWeaponSelection] = useState(false);
  const [selectedWeapon, setSelectedWeapon] = useState('');
  const [showWeaponSlotModal, setShowWeaponSlotModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null); // 'right' or 'left'
  const [availableWeapons, setAvailableWeapons] = useState([]);
  const [showClothingSelection, setShowClothingSelection] = useState(false);
  const [selectedClothing, setSelectedClothing] = useState('');
  const [raceClothingOptions, setRaceClothingOptions] = useState([]);
  const [showStartingEquipmentSelection, setShowStartingEquipmentSelection] = useState(false);
  const [selectedStartingEquipment, setSelectedStartingEquipment] = useState([]);
  const [startingEquipmentOptions, setStartingEquipmentOptions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name'); // 'name', 'price', 'damage', 'weight'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc', 'desc'

  // Available weapons for trade-in
  const availableTradeInWeapons = [
    { name: 'Sling', damage: '1d4', category: 'ranged', weight: 1, price: 5 },
    { name: 'Stone Axe', damage: '1d6', category: 'one-handed', weight: 4, price: 8 },
    { name: 'Dagger', damage: '1d4', category: 'one-handed', weight: 2, price: 15 },
    { name: 'Throwing Axe', damage: '1d6', category: 'thrown', weight: 3, price: 15 },
    { name: 'Meat Cleaver', damage: '1d4', category: 'one-handed', weight: 3, price: 6 },
    { name: 'Shovel', damage: '1d4', category: 'two-handed', weight: 8, price: 4 }
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch weapons from the new database
        const weaponsResponse = await axiosInstance.get('/weapons');
        console.log('🔍 Fetched weapons from database:', weaponsResponse.data);
        
        // Transform database weapons to match frontend format
        const enhancedWeapons = weaponsResponse.data.map((weapon) => ({
          itemId: weapon.itemId,
          name: weapon.name,
          type: weapon.type || "weapon",
          category: weapon.category,
          price: weapon.price,
          damage: weapon.damage,
          weight: weapon.weight,
          length: weapon.length,
          handed: weapon.handed,
          reach: weapon.reach,
          range: weapon.range,
          rateOfFire: weapon.rateOfFire,
          ammunition: weapon.ammunition,
          strengthRequired: weapon.strengthRequired,
          notes: weapon.notes,
          description: weapon.description || `${weapon.name} - ${weapon.damage} damage`
        }));

        const charactersResponse = await axiosInstance.get('/characters');
        // Sync equippedWeapons from equipped object for all characters to ensure consistency
        const syncedCharacters = charactersResponse.data.map(char => syncEquippedWeapons(char));
        setWeapons(enhancedWeapons);
        setCharacters(syncedCharacters);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleBuyWeapon = async (itemId) => {
    if (!selectedCharacter) {
      alert('Please select a character first');
      return;
    }

    try {
      // Find the weapon in our enhanced weapons list
      const weapon = weapons.find(w => w.itemId === itemId);
      if (!weapon) {
        alert('Weapon not found');
        return;
      }

      // Get the selected character
      const character = characters.find(c => c._id === selectedCharacter);
      if (!character) {
        alert('Character not found');
        return;
      }

      // Check if character has enough gold
      if (character.gold < weapon.price) {
        alert('Not enough gold');
        return;
      }

      // Create the weapon item with enhanced stats
      const weaponItem = {
        name: weapon.name,
        type: "weapon",
        category: weapon.category,
        price: weapon.price,
        damage: weapon.damage,
        weight: weapon.weight,
        description: weapon.notes || "",
        // Enhanced stats
        reach: weapon.reach,
        range: weapon.range,
        rateOfFire: weapon.rateOfFire,
        ammunition: weapon.ammunition,
        strengthRequired: weapon.strengthRequired,
        notes: weapon.notes
      };

      // Auto-equip logic using combat system approach
      let updatedCharacter = { ...character };
      
      // Initialize equipped object if not exists (like combat system)
      if (!updatedCharacter.equipped) {
        updatedCharacter.equipped = {};
      }
      
      // Initialize equipped weapons array if not exists
      if (!updatedCharacter.equippedWeapons) {
        updatedCharacter.equippedWeapons = [
          { name: "Unarmed", damage: "1d3", type: "unarmed", category: "unarmed", slot: "Right Hand" },
          { name: "Unarmed", damage: "1d3", type: "unarmed", category: "unarmed", slot: "Left Hand" }
        ];
      }
      
      // Count current equipped weapons (excluding unarmed)
      const equippedWeaponCount = updatedCharacter.equippedWeapons.filter(w => w.name !== "Unarmed").length;
      
      // Determine where to equip the new weapon using combat system approach
      if (equippedWeaponCount === 0) {
        // First weapon: equip in right hand (weaponPrimary)
        updatedCharacter.equipped.weaponPrimary = {
          name: weaponItem.name,
          damage: weaponItem.damage || "1d6",
          range: weaponItem.range,
          reach: weaponItem.reach,
          category: weaponItem.category,
          type: weaponItem.type
        };
        updatedCharacter.equippedWeapons[0] = {
          ...weaponItem,
          slot: "Right Hand"
        };
        updatedCharacter.equippedWeapon = weaponItem.name; // Legacy support
      } else if (equippedWeaponCount === 1) {
        // Second weapon: equip in left hand (weaponSecondary)
        updatedCharacter.equipped.weaponSecondary = {
          name: weaponItem.name,
          damage: weaponItem.damage || "1d6",
          range: weaponItem.range,
          reach: weaponItem.reach,
          category: weaponItem.category,
          type: weaponItem.type
        };
        updatedCharacter.equippedWeapons[1] = {
          ...weaponItem,
          slot: "Left Hand"
        };
      }

      const existingInventory = Array.isArray(updatedCharacter.inventory)
        ? [...updatedCharacter.inventory]
        : [];
      const newInventory = [...existingInventory, weaponItem];

      // Add to inventory and deduct gold
      updatedCharacter = {
        ...updatedCharacter,
        inventory: newInventory,
        gold: (updatedCharacter.gold || 0) - weapon.price
      };

      // Update character in database
      await axiosInstance.put(`/characters/${selectedCharacter}`, updatedCharacter);
      
      // Update character list after purchase and sync equippedWeapons
      const updatedCharacters = await axiosInstance.get('/characters');
      const syncedCharacters = updatedCharacters.data.map(char => syncEquippedWeapons(char));
      setCharacters(syncedCharacters);
      
      // Show success modal and confetti with equip info
      let equipMessage = "";
      if (equippedWeaponCount === 0) {
        equipMessage = ` and auto-equipped in Right Hand!`;
      } else if (equippedWeaponCount === 1) {
        equipMessage = ` and auto-equipped in Left Hand!`;
      } else {
        equipMessage = ` and added to inventory!`;
      }
      
      setPurchaseMessage(`Successfully purchased ${weapon.name}${equipMessage}`);
      setShowPurchaseModal(true);
      setShowConfetti(true);

      // Hide confetti and modal after delay
      setTimeout(() => {
        setShowConfetti(false);
        setShowPurchaseModal(false);
      }, 3000);
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to purchase weapon');
    }
  };

  // Helper function to check if selected character has a low quality weapon
  const selectedCharacterHasLowQualityWeapon = () => {
    if (!selectedCharacter) return false;
    const character = characters.find(char => char._id === selectedCharacter);
    if (!character) return false;
    return character.inventory?.some(item => 
      item.name && item.name.toLowerCase().includes('low quality weapon')
    ) || false;
  };

  // Helper function to check if selected character has basic clothes
  const selectedCharacterHasBasicClothes = () => {
    if (!selectedCharacter) return false;
    const character = characters.find(char => char._id === selectedCharacter);
    if (!character) return false;
    return hasBasicClothes(character);
  };

  // Helper function to check if selected character has tradeable starting equipment
  const selectedCharacterHasStartingEquipment = () => {
    if (!selectedCharacter) return false;
    const character = characters.find(char => char._id === selectedCharacter);
    if (!character) return false;
    return hasTradeableStartingEquipment(character);
  };

  const handleTradeInLowQualityWeapon = async () => {
    if (!selectedCharacter) {
      alert('Please select a character first');
      return;
    }

    // Show weapon selection popup instead of trying to trade-in directly
    setShowWeaponSelection(true);
  };

  const handleTradeInBasicClothes = async () => {
    console.log('🔄 DEBUG: Starting clothing trade-in process');
    console.log('🔄 DEBUG: Selected character ID:', selectedCharacter);
    
    if (!selectedCharacter) {
      console.log('❌ DEBUG: No character selected');
      alert('Please select a character first');
      return;
    }

    const character = characters.find(char => char._id === selectedCharacter);
    console.log('🔄 DEBUG: Found character:', character);
    console.log('🔄 DEBUG: Character species:', character?.species);
    console.log('🔄 DEBUG: Character inventory:', character?.inventory);
    
    if (!character || !character.species) {
      console.log('❌ DEBUG: Character missing or no species');
      alert('Character must have a race to trade in basic clothes');
      return;
    }

    // Check if character has basic clothes
    const hasBasic = hasBasicClothes(character);
    console.log('🔄 DEBUG: Character has basic clothes:', hasBasic);
    
    if (!hasBasic) {
      console.log('❌ DEBUG: Character does not have basic clothes');
      alert('Character must have basic clothes to trade in');
      return;
    }

    // Get race-specific clothing options
    console.log('🔄 DEBUG: Getting race clothing options for:', character.species);
    const options = getAvailableRaceClothing(character.species);
    console.log('🔄 DEBUG: Available race clothing options:', options);
    
    if (options.length === 0) {
      console.log('❌ DEBUG: No race-specific clothing available');
      alert(`No race-specific clothing available for ${character.species}`);
      return;
    }

    console.log('✅ DEBUG: Setting race clothing options and showing selection modal');
    setRaceClothingOptions(options);
    setShowClothingSelection(true);
  };

  const handleClothingSelection = async () => {
    console.log('🔄 DEBUG: Starting clothing selection process');
    console.log('🔄 DEBUG: Selected clothing:', selectedClothing);
    console.log('🔄 DEBUG: Character ID:', selectedCharacter);
    
    if (!selectedClothing) {
      console.log('❌ DEBUG: No clothing selected');
      alert('Please select a clothing item to trade for');
      return;
    }

    try {
      console.log('🔄 DEBUG: Making API call to trade-in basic clothes');
      const requestData = {
        characterId: selectedCharacter,
        selectedClothing: selectedClothing
      };
      console.log('🔄 DEBUG: Request data:', requestData);
      
      const response = await axiosInstance.post('/shop/trade-in-basic-clothes', requestData);
      console.log('✅ DEBUG: API response:', response.data);
      
      // Update character list after trade-in
      console.log('🔄 DEBUG: Fetching updated characters');
      const updatedCharacters = await axiosInstance.get('/characters');
      setCharacters(updatedCharacters.data);
      
      // Show success modal and confetti
      setPurchaseMessage(response.data.message);
      setShowPurchaseModal(true);
      setShowConfetti(true);
      setShowClothingSelection(false);
      setSelectedClothing('');

      // Hide confetti and modal after delay
      setTimeout(() => {
        setShowConfetti(false);
        setShowPurchaseModal(false);
      }, 3000);
    } catch (error) {
      console.error('❌ DEBUG: Clothing trade-in error:', error);
      console.error('❌ DEBUG: Error response:', error.response?.data);
      console.error('❌ DEBUG: Error status:', error.response?.status);
      console.error('❌ DEBUG: Error message:', error.message);
      
      let errorMessage = error.response?.data?.message || 'Failed to trade in basic clothes';
      
      // Show detailed validation errors if available
      if (error.response?.data?.details) {
        const details = error.response.data.details;
        const validationErrors = Object.keys(details).map(key => 
          `${key}: ${details[key].message}`
        ).join('\n');
        errorMessage += '\n\nValidation Errors:\n' + validationErrors;
      }
      
      console.error('Clothing trade-in error details:', error.response?.data);
      alert(errorMessage);
    }
  };

  const handleTradeInStartingEquipment = async () => {
    console.log('🔄 DEBUG: Starting starting equipment trade-in process');
    console.log('🔄 DEBUG: Selected character ID:', selectedCharacter);
    
    if (!selectedCharacter) {
      console.log('❌ DEBUG: No character selected');
      alert('Please select a character first');
      return;
    }

    const character = characters.find(char => char._id === selectedCharacter);
    console.log('🔄 DEBUG: Found character:', character);
    console.log('🔄 DEBUG: Character OCC:', character?.occ);
    
    if (!character || !character.occ) {
      console.log('❌ DEBUG: Character missing or no OCC');
      alert('Character must have an OCC to trade in starting equipment');
      return;
    }

    // Get tradeable starting equipment
    const tradeableItems = getTradeableStartingEquipment(character);
    console.log('🔄 DEBUG: Tradeable starting equipment:', tradeableItems);
    
    if (tradeableItems.length === 0) {
      console.log('❌ DEBUG: No tradeable starting equipment found');
      alert('No tradeable starting equipment found');
      return;
    }

    // Get OCC-specific alternatives
    console.log('🔄 DEBUG: Getting OCC equipment alternatives for:', character.occ);
    const alternatives = getOccEquipmentAlternatives(character.occ);
    console.log('🔄 DEBUG: Available OCC alternatives:', alternatives);
    
    if (alternatives.length === 0) {
      console.log('❌ DEBUG: No OCC-specific alternatives available');
      alert(`No OCC-specific equipment alternatives available for ${character.occ}`);
      return;
    }

    console.log('✅ DEBUG: Setting starting equipment options and showing selection modal');
    setStartingEquipmentOptions(alternatives);
    setShowStartingEquipmentSelection(true);
  };

  const handleStartingEquipmentSelection = async () => {
    console.log('🔄 DEBUG: Starting starting equipment selection process');
    console.log('🔄 DEBUG: Selected equipment:', selectedStartingEquipment);
    console.log('🔄 DEBUG: Character ID:', selectedCharacter);
    
    if (!selectedStartingEquipment.length) {
      console.log('❌ DEBUG: No equipment selected');
      alert('Please select equipment to trade in for');
      return;
    }

    const character = characters.find(char => char._id === selectedCharacter);
    const tradeableItems = getTradeableStartingEquipment(character);

    try {
      console.log('🔄 DEBUG: Making API call to trade-in starting equipment');
      const requestData = {
        characterId: selectedCharacter,
        tradeInItems: tradeableItems,
        selectedAlternatives: selectedStartingEquipment // Now contains full item objects instead of just names
      };
      console.log('🔄 DEBUG: Request data:', requestData);
      
      const response = await axiosInstance.post('/shop/trade-in-starting-equipment', requestData);
      console.log('✅ DEBUG: API response:', response.data);
      
      // Update character list after trade-in
      console.log('🔄 DEBUG: Fetching updated characters');
      const updatedCharacters = await axiosInstance.get('/characters');
      setCharacters(updatedCharacters.data);
      
      // Show success modal and confetti
      setPurchaseMessage(response.data.message);
      setShowPurchaseModal(true);
      setShowConfetti(true);
      setShowStartingEquipmentSelection(false);
      setSelectedStartingEquipment([]);

      // Hide confetti and modal after delay
      setTimeout(() => {
        setShowConfetti(false);
        setShowPurchaseModal(false);
      }, 3000);
    } catch (error) {
      console.error('❌ DEBUG: Starting equipment trade-in error:', error);
      console.error('❌ DEBUG: Error response:', error.response?.data);
      console.error('❌ DEBUG: Error status:', error.response?.status);
      console.error('❌ DEBUG: Error message:', error.message);
      
      let errorMessage = error.response?.data?.message || 'Failed to trade in starting equipment';
      
      // Show detailed validation errors if available
      if (error.response?.data?.details) {
        const details = error.response.data.details;
        const validationErrors = Object.keys(details).map(key => 
          `${key}: ${details[key].message}`
        ).join('\n');
        errorMessage += '\n\nValidation Errors:\n' + validationErrors;
      }
      
      console.error('Starting equipment trade-in error details:', error.response?.data);
      alert(errorMessage);
    }
  };

  const handleWeaponSelection = async () => {
    if (!selectedWeapon) {
      alert('Please select a weapon to trade for');
      return;
    }

    try {
      const response = await axiosInstance.post('/shop/trade-in-low-quality', {
        characterId: selectedCharacter,
        selectedWeapon: selectedWeapon
      });
      
      // Update character list after trade-in
      const updatedCharacters = await axiosInstance.get('/characters');
      setCharacters(updatedCharacters.data);
      
      // Show success modal and confetti
      setPurchaseMessage(response.data.message);
      setShowPurchaseModal(true);
      setShowConfetti(true);
      setShowWeaponSelection(false);
      setSelectedWeapon('');

      // Hide confetti and modal after delay
      setTimeout(() => {
        setShowConfetti(false);
        setShowPurchaseModal(false);
      }, 3000);
    } catch (error) {
      let errorMessage = error.response?.data?.message || 'Failed to trade in weapon';
      
      // Show detailed validation errors if available
      if (error.response?.data?.details) {
        const details = error.response.data.details;
        const validationErrors = Object.keys(details).map(key => 
          `${key}: ${details[key].message}`
        ).join('\n');
        errorMessage += '\n\nValidation Errors:\n' + validationErrors;
      }
      
      // Show error details for debugging
      console.error('Trade-in error details:', error.response?.data);
      
      alert(errorMessage);
    }
  };

  // Handle weapon slot selection
  const handleWeaponSlotClick = (slot) => {
    if (!selectedCharacter) {
      alert('Please select a character first');
      return;
    }

    const character = characters.find(c => c._id === selectedCharacter);
    if (!character) {
      alert('Character not found');
      return;
    }

    // Get all weapons from character's inventory using combat system approach
    const inventorySources = [
      ...(character.inventory || []),
      ...(character.wardrobe || []),
      ...(character.items || []),
      ...(character.gear || []),
      ...(character.equipment || []),
    ];
    const inventory = inventorySources.filter(Boolean);
    
    console.log('🔍 Debug weapon slot click:', {
      characterName: character.name,
      inventory: inventory,
      inventoryLength: inventory.length
    });
    
    const inventoryWeapons = inventory.filter(item => {
      if (!item || !item.name) return false;
      
      // Check if it's explicitly marked as a weapon
      if (item.type === "weapon" || item.type === "Weapon" || item.category === "Weapons") {
        return true;
      }
      
      // Check weapon categories (must be a weapon category)
      if (item.category === 'one-handed' || 
          item.category === 'two-handed' || 
          item.category === 'ranged' || 
          item.category === 'thrown') {
        return true;
      }
      
      // Check weapon names - be more strict, only match if it's clearly a weapon
      const itemName = item.name?.toLowerCase() || '';
      const weaponKeywords = [
        'axe', 'sword', 'bow', 'dagger', 'sling', 'spear', 'mace', 'club',
        'hammer', 'staff', 'wand', 'crossbow', 'lance', 'halberd', 'rapier',
        'scimitar', 'flail', 'morningstar', 'warhammer', 'battleaxe', 'longsword',
        'shortsword', 'greatsword', 'handaxe', 'throwing axe', 'javelin', 'trident',
        'knife', 'blade', 'pike', 'polearm', 'glaive', 'katana', 'cutlass'
      ];
      
      // Only return true if it matches a weapon keyword AND has damage property (weapons should have damage)
      const hasWeaponKeyword = weaponKeywords.some(keyword => itemName.includes(keyword));
      const hasDamage = item.damage || itemName.includes('unarmed');
      
      return hasWeaponKeyword && hasDamage;
    });

    console.log('🔍 Found inventory weapons:', inventoryWeapons);

    // Only show actual weapons, not all items
    let weaponsToShow = inventoryWeapons;

    // Add current equipped weapons to the list
    const equippedWeapons = character.equippedWeapons || [
      { name: "Unarmed", damage: "1d3", type: "unarmed", category: "unarmed", slot: "Right Hand" },
      { name: "Unarmed", damage: "1d3", type: "unarmed", category: "unarmed", slot: "Left Hand" }
    ];

    // Add Unarmed option
    const unarmedOption = { name: "Unarmed", damage: "1d3", type: "unarmed", category: "unarmed" };

    // Combine all weapons and remove duplicates
    const allWeapons = [...weaponsToShow, ...equippedWeapons, unarmedOption];
    const uniqueWeapons = allWeapons.filter((weapon, index, self) => 
      index === self.findIndex(w => w.name === weapon.name)
    );

    console.log('🔍 Available weapons for selection:', uniqueWeapons);

    // Always show the modal, even if no weapons found
    setAvailableWeapons(uniqueWeapons);
    setSelectedSlot(slot);
    setShowWeaponSlotModal(true);
  };

  // Handle weapon selection for slot - using combat system logic
  const handleWeaponSlotSelection = async (weaponName) => {
    if (!selectedCharacter || !selectedSlot) {
      return;
    }

    try {
      const character = characters.find(c => c._id === selectedCharacter);
      if (!character) return;

      // Initialize equipped object if not exists (like combat system)
      if (!character.equipped) {
        character.equipped = {};
      }

      // Get current equipped weapons
      let equippedWeapons = character.equippedWeapons || [
        { name: "Unarmed", damage: "1d3", type: "unarmed", category: "unarmed", slot: "Right Hand" },
        { name: "Unarmed", damage: "1d3", type: "unarmed", category: "unarmed", slot: "Left Hand" }
      ];

      // Check equipped object (combat system approach)
      if (character.equipped.weaponPrimary) {
        equippedWeapons[0] = {
          name: character.equipped.weaponPrimary.name,
          damage: character.equipped.weaponPrimary.damage || "1d3",
          type: character.equipped.weaponPrimary.type,
          category: character.equipped.weaponPrimary.category,
          slot: "Right Hand"
        };
      }
      if (character.equipped.weaponSecondary) {
        equippedWeapons[1] = {
          name: character.equipped.weaponSecondary.name,
          damage: character.equipped.weaponSecondary.damage || "1d3",
          type: character.equipped.weaponSecondary.type,
          category: character.equipped.weaponSecondary.category,
          slot: "Left Hand"
        };
      }

      const slotIndex = selectedSlot === 'right' ? 0 : 1;
      const otherSlotIndex = selectedSlot === 'right' ? 1 : 0;
      const currentWeaponInSlot = equippedWeapons[slotIndex];
      const currentWeaponInOtherSlot = equippedWeapons[otherSlotIndex];

      // Check if the weapon being equipped is already in the other slot
      const isSwapping = currentWeaponInOtherSlot && 
                        currentWeaponInOtherSlot.name === weaponName && 
                        weaponName !== "Unarmed";

      // Check if the weapon is already in the current slot
      const isAlreadyEquipped = currentWeaponInSlot && 
                                currentWeaponInSlot.name === weaponName && 
                                weaponName !== "Unarmed";

      let weaponToEquip = null;
      let weaponToMoveToInventory = null;

      if (isAlreadyEquipped) {
        // Weapon is already in this slot, do nothing
        alert(`${weaponName} is already equipped in ${selectedSlot === 'right' ? 'Right Hand' : 'Left Hand'}`);
        return;
      }

      if (isSwapping) {
        // Swap weapons between slots
        console.log('🔄 Swapping weapons between slots');
        weaponToEquip = currentWeaponInOtherSlot;
        weaponToMoveToInventory = currentWeaponInSlot;
      } else {
        // Normal equip - find weapon in inventory
        const inventorySources = [
          ...(character.inventory || []),
          ...(character.wardrobe || []),
          ...(character.items || []),
          ...(character.gear || []),
          ...(character.equipment || []),
        ];
        const inventory = inventorySources.filter(Boolean);
        
        // Find weapon in inventory - improved detection logic
        const inventoryWeapon = inventory.find(item => {
          if (item.name !== weaponName) return false;
          
          // Check if it's explicitly marked as a weapon
          if (item.type === "weapon" || item.type === "Weapon" || item.category === "Weapons") {
            return true;
          }
          
          // Check weapon categories
          if (item.category === 'one-handed' || item.category === 'two-handed') {
            return true;
          }
          
          // Check weapon names
          const itemName = item.name?.toLowerCase() || '';
          const weaponKeywords = [
            'axe', 'sword', 'bow', 'dagger', 'sling', 'spear', 'mace', 'club',
            'hammer', 'staff', 'wand', 'crossbow', 'lance', 'halberd', 'rapier',
            'scimitar', 'flail', 'morningstar', 'warhammer', 'battleaxe', 'longsword',
            'shortsword', 'greatsword', 'handaxe', 'throwing axe', 'javelin', 'trident'
          ];
          
          return weaponKeywords.some(keyword => itemName.includes(keyword));
        });
        
        if (inventoryWeapon) {
          weaponToEquip = inventoryWeapon;
          weaponToMoveToInventory = currentWeaponInSlot;
        } else if (weaponName === "Unarmed") {
          weaponToEquip = {
            name: "Unarmed",
            damage: "1d3",
            type: "unarmed",
            category: "unarmed"
          };
          weaponToMoveToInventory = currentWeaponInSlot;
        } else {
          alert('Weapon not found in inventory');
          return;
        }
      }

      // Update the equipped weapon using combat system approach
      const slotKey = selectedSlot === 'right' ? 'weaponPrimary' : 'weaponSecondary';
      const otherSlotKey = selectedSlot === 'right' ? 'weaponSecondary' : 'weaponPrimary';
      
      // Update the selected slot
      if (weaponToEquip.name === "Unarmed") {
        // Remove weapon from equipped object if unarmed
        delete character.equipped[slotKey];
      } else {
        character.equipped[slotKey] = {
          name: weaponToEquip.name,
          damage: weaponToEquip.damage || "1d3",
          range: weaponToEquip.range,
          reach: weaponToEquip.reach,
          category: weaponToEquip.category,
          type: weaponToEquip.type
        };
      }

      // If swapping, update the other slot too
      if (isSwapping && weaponToMoveToInventory && weaponToMoveToInventory.name !== "Unarmed") {
        character.equipped[otherSlotKey] = {
          name: weaponToMoveToInventory.name,
          damage: weaponToMoveToInventory.damage || "1d3",
          range: weaponToMoveToInventory.range,
          reach: weaponToMoveToInventory.reach,
          category: weaponToMoveToInventory.category,
          type: weaponToMoveToInventory.type
        };
      } else if (isSwapping && weaponToMoveToInventory && weaponToMoveToInventory.name === "Unarmed") {
        // If swapping to unarmed, clear the other slot
        delete character.equipped[otherSlotKey];
      }
      
      // If NOT swapping but the weapon was in the other slot, clear it from there
      if (!isSwapping && currentWeaponInOtherSlot && currentWeaponInOtherSlot.name === weaponName && weaponName !== "Unarmed") {
        // Weapon is being moved from other slot to this slot - clear the other slot
        delete character.equipped[otherSlotKey];
        // Also update the equippedWeapons array for the other slot
        equippedWeapons[otherSlotIndex] = {
          name: "Unarmed",
          damage: "1d3",
          type: "unarmed",
          category: "unarmed",
          slot: selectedSlot === 'right' ? "Left Hand" : "Right Hand"
        };
      }

      // Update equippedWeapons array
      equippedWeapons[slotIndex] = {
        ...weaponToEquip,
        slot: selectedSlot === 'right' ? "Right Hand" : "Left Hand"
      };

      // If swapping, update the other slot in the array too
      if (isSwapping && weaponToMoveToInventory && weaponToMoveToInventory.name !== "Unarmed") {
        equippedWeapons[otherSlotIndex] = {
          ...weaponToMoveToInventory,
          slot: selectedSlot === 'right' ? "Left Hand" : "Right Hand"
        };
      }

      // Handle inventory updates
      let updatedInventory = [...(character.inventory || [])];
      
      // Check if weapon was already equipped in the other slot (moving, not from inventory)
      const wasInOtherSlot = !isSwapping && currentWeaponInOtherSlot && 
                             currentWeaponInOtherSlot.name === weaponName && 
                             weaponName !== "Unarmed";
      
      // If not swapping, not unarmed, and not moving from other slot, remove weapon from inventory
      if (!isSwapping && !wasInOtherSlot && weaponToEquip.name !== "Unarmed") {
        const weaponIndex = updatedInventory.findIndex(item => 
          item.name === weaponToEquip.name &&
          (item.type === "weapon" || item.type === "Weapon" || 
           item.category === 'one-handed' || item.category === 'two-handed' ||
           item.category === 'ranged' || item.category === 'thrown')
        );
        if (weaponIndex !== -1) {
          updatedInventory.splice(weaponIndex, 1);
        }
      }

      // If there's a weapon to move back to inventory (and it's not Unarmed), add it
      if (weaponToMoveToInventory && weaponToMoveToInventory.name !== "Unarmed") {
        // Check if it's already in inventory
        const alreadyInInventory = updatedInventory.some(item => 
          item.name === weaponToMoveToInventory.name &&
          (item.type === "weapon" || item.type === "Weapon" || 
           item.category === 'one-handed' || item.category === 'two-handed' ||
           item.category === 'ranged' || item.category === 'thrown')
        );
        
        if (!alreadyInInventory) {
          updatedInventory.push(weaponToMoveToInventory);
        }
      }
      
      // If weapon was moved from other slot (not swapped), add the old weapon from that slot to inventory
      if (wasInOtherSlot && currentWeaponInSlot && currentWeaponInSlot.name !== "Unarmed") {
        const alreadyInInventory = updatedInventory.some(item => 
          item.name === currentWeaponInSlot.name &&
          (item.type === "weapon" || item.type === "Weapon" || 
           item.category === 'one-handed' || item.category === 'two-handed' ||
           item.category === 'ranged' || item.category === 'thrown')
        );
        
        if (!alreadyInInventory) {
          updatedInventory.push(currentWeaponInSlot);
        }
      }

      // Update character with both systems
      const updatedCharacter = {
        ...character,
        equipped: character.equipped,
        equippedWeapons: equippedWeapons,
        inventory: updatedInventory,
        equippedWeapon: selectedSlot === 'right' ? weaponToEquip.name : character.equippedWeapon // Legacy support
      };

      // Update character in database
      await axiosInstance.put(`/characters/${selectedCharacter}`, updatedCharacter);
      
      // Update character list and sync equippedWeapons
      const updatedCharacters = await axiosInstance.get('/characters');
      const syncedCharacters = updatedCharacters.data.map(char => syncEquippedWeapons(char));
      setCharacters(syncedCharacters);
      
      // Close modal
      setShowWeaponSlotModal(false);
      setSelectedSlot(null);
      setAvailableWeapons([]);

      // Show success message
      if (isSwapping) {
        alert(`Swapped weapons! ${weaponName} moved to ${selectedSlot === 'right' ? 'Right Hand' : 'Left Hand'}!`);
      } else {
        alert(`Equipped ${weaponName} in ${selectedSlot === 'right' ? 'Right Hand' : 'Left Hand'}!`);
      }
      
    } catch (error) {
      console.error('Error equipping weapon:', error);
      alert('Failed to equip weapon');
    }
  };

  // Sorting function
  const sortWeapons = (weaponList) => {
    return [...weaponList].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'price':
          comparison = (a.price || 0) - (b.price || 0);
          break;
        case 'damage': {
          // Parse damage strings like "1d6" or "2d4"
          const parseDamage = (damageStr) => {
            if (!damageStr) return 0;
            const match = damageStr.match(/(\d+)d(\d+)/);
            if (match) {
              const dice = parseInt(match[1]);
              const sides = parseInt(match[2]);
              return dice * sides; // Average damage estimation
            }
            return 0;
          };
          comparison = parseDamage(a.damage) - parseDamage(b.damage);
          break;
        }
        case 'weight':
          comparison = (parseFloat(a.weight) || 0) - (parseFloat(b.weight) || 0);
          break;
        case 'name':
        default:
          comparison = (a.name || '').localeCompare(b.name || '');
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  // Filter and sort weapons
  const categories = ['All', ...new Set(weapons.map(weapon => weapon.category))];
  let filteredWeapons = selectedCategory === 'All' 
    ? weapons 
    : weapons.filter(weapon => weapon.category === selectedCategory);
  
  // Apply search filter
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filteredWeapons = filteredWeapons.filter(weapon => 
      weapon.name.toLowerCase().includes(query) ||
      (weapon.description && weapon.description.toLowerCase().includes(query)) ||
      (weapon.category && weapon.category.toLowerCase().includes(query)) ||
      (weapon.damage && weapon.damage.toLowerCase().includes(query))
    );
  }
  
  // Apply sorting
  filteredWeapons = sortWeapons(filteredWeapons);

  if (loading) return <div>Loading weapons...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <>
      {showConfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={200}
          gravity={0.3}
          colors={['#4CAF50', '#FFC107', '#2196F3', '#F44336']}
        />
      )}
      <div className="weapon-shop">
        <h1>Weapon Shop</h1>
        
        {/* Shop Navigation */}
        <div style={{ marginBottom: '15px' }}>
          <a 
            href="/trader-shop" 
            style={{
              display: 'inline-block',
              backgroundColor: '#1a73e8',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '5px',
              textDecoration: 'none',
              fontWeight: 'bold',
              border: '2px solid #1557b0',
              fontSize: '13px'
            }}
          >
            🛒 Visit Trader Shop
          </a>
        </div>
        
        <div className="character-selector" style={{ marginBottom: '20px' }}>
          <div style={{ 
            display: 'flex', 
            gap: '10px', 
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <select 
              onChange={(e) => setSelectedCharacter(e.target.value)}
              value={selectedCharacter || ''}
              style={{
                padding: '10px',
                fontSize: '14px',
                border: '2px solid #4CAF50',
                borderRadius: '6px',
                minWidth: '200px',
                cursor: 'pointer'
              }}
            >
              <option value="">Select Character</option>
              {characters.map(char => (
                <option key={char._id} value={char._id}>
                  {char.name} - Gold: {char.gold || 0}
                </option>
              ))}
            </select>
            
            {/* Display selected character's gold prominently */}
            {selectedCharacter && (() => {
              const character = characters.find(c => c._id === selectedCharacter);
              return character ? (
                <div style={{
                  padding: '10px 20px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}>
                  💰 {character.gold || 0} Gold Available
                </div>
              ) : null;
            })()}
          </div>
          
          {/* Trade-in button for low quality weapons - only show if character has one */}
          {selectedCharacter && selectedCharacterHasLowQualityWeapon() && (
            <button 
              onClick={handleTradeInLowQualityWeapon}
              className="trade-in-button"
              style={{
                backgroundColor: '#FF9800',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9em',
                marginTop: '8px',
                fontWeight: 'bold'
              }}
            >
              🔄 Trade-in Low Quality Weapon
            </button>
          )}
          
          {/* Trade-in button for basic clothes - only show if character has them */}
          {selectedCharacter && selectedCharacterHasBasicClothes() && (
            <button 
              onClick={handleTradeInBasicClothes}
              className="trade-in-button"
              style={{
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9em',
                marginTop: '8px',
                fontWeight: 'bold'
              }}
            >
              👕 Trade-in Basic Clothes
            </button>
          )}
          
          {/* Trade-in button for starting equipment - only show if character has tradeable starting equipment */}
          {selectedCharacter && selectedCharacterHasStartingEquipment() && (
            <button 
              onClick={handleTradeInStartingEquipment}
              className="trade-in-button"
              style={{
                backgroundColor: '#9C27B0',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9em',
                marginTop: '8px',
                fontWeight: 'bold'
              }}
            >
              ⚔️ Trade-in Starting Equipment
            </button>
          )}
        </div>

        {/* Weapon Inventory Panel */}
        {selectedCharacter && (
          <div className="weapon-inventory-panel" style={{
            backgroundColor: '#f5f5f5',
            border: '2px solid #ddd',
            borderRadius: '8px',
            padding: '15px',
            marginBottom: '20px'
          }}>
            <h3>⚔️ Weapon Inventory</h3>
            {(() => {
              const character = characters.find(c => c._id === selectedCharacter);
              if (!character) return <p>Character not found</p>;
              
              // Use combat system logic to get equipped weapons
              let equippedWeapons = [
                { name: "Unarmed", damage: "1d3", type: "unarmed", category: "unarmed", slot: "Right Hand" },
                { name: "Unarmed", damage: "1d3", type: "unarmed", category: "unarmed", slot: "Left Hand" }
              ];

              // Check equipped object (combat system approach)
              if (character.equipped) {
                if (character.equipped.weaponPrimary) {
                  equippedWeapons[0] = {
                    name: character.equipped.weaponPrimary.name,
                    damage: character.equipped.weaponPrimary.damage || "1d3",
                    type: character.equipped.weaponPrimary.type,
                    category: character.equipped.weaponPrimary.category,
                    slot: "Right Hand"
                  };
                }
                if (character.equipped.weaponSecondary) {
                  equippedWeapons[1] = {
                    name: character.equipped.weaponSecondary.name,
                    damage: character.equipped.weaponSecondary.damage || "1d3",
                    type: character.equipped.weaponSecondary.type,
                    category: character.equipped.weaponSecondary.category,
                    slot: "Left Hand"
                  };
                }
              }

              // Fallback to equippedWeapons array if equipped object doesn't exist
              if (character.equippedWeapons && (!character.equipped || (!character.equipped.weaponPrimary && !character.equipped.weaponSecondary))) {
                equippedWeapons = character.equippedWeapons;
              }
              
              return (
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  {/* Right Hand */}
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#2e7d32' }}>🖐️ Right Hand</h4>
                    <div 
                      onClick={() => handleWeaponSlotClick('right')}
                      style={{
                        backgroundColor: 'white',
                        border: '2px solid #4CAF50',
                        borderRadius: '4px',
                        padding: '10px',
                        minHeight: '60px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#f0f8ff';
                        e.target.style.borderColor = '#2196F3';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = 'white';
                        e.target.style.borderColor = '#4CAF50';
                      }}
                    >
                      <strong>{equippedWeapons[0]?.name || "Unarmed"}</strong>
                      <br />
                      <small>Damage: {equippedWeapons[0]?.damage || "1d3"}</small>
                      <br />
                      <small>Type: {equippedWeapons[0]?.category || "unarmed"}</small>
                      <br />
                      <small style={{ color: '#666', fontStyle: 'italic' }}>Click to change</small>
                    </div>
                  </div>
                  
                  {/* Left Hand */}
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#2e7d32' }}>🤚 Left Hand</h4>
                    <div 
                      onClick={() => handleWeaponSlotClick('left')}
                      style={{
                        backgroundColor: 'white',
                        border: '2px solid #4CAF50',
                        borderRadius: '4px',
                        padding: '10px',
                        minHeight: '60px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#f0f8ff';
                        e.target.style.borderColor = '#2196F3';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = 'white';
                        e.target.style.borderColor = '#4CAF50';
                      }}
                    >
                      <strong>{equippedWeapons[1]?.name || "Unarmed"}</strong>
                      <br />
                      <small>Damage: {equippedWeapons[1]?.damage || "1d3"}</small>
                      <br />
                      <small>Type: {equippedWeapons[1]?.category || "unarmed"}</small>
                      <br />
                      <small style={{ color: '#666', fontStyle: 'italic' }}>Click to change</small>
                    </div>
                  </div>
                  
                  {/* Inventory Weapons Count */}
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#2e7d32' }}>🎒 Inventory</h4>
                    <div style={{
                      backgroundColor: 'white',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      padding: '10px',
                      minHeight: '60px'
                    }}>
                      {(() => {
                        const inventoryWeapons = (character.inventory || []).filter(item => 
                          item.type === "weapon" || item.type === "Weapon"
                        );
                        return (
                          <>
                            <strong>{inventoryWeapons.length} weapons stored</strong>
                            <br />
                            <small>Future: Requires sheaths & belts</small>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Search and Sort Controls */}
        <div style={{ 
          display: 'flex', 
          gap: '15px', 
          marginBottom: '20px', 
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          {/* Search Bar */}
          <div style={{ flex: '1', minWidth: '200px' }}>
            <input
              type="text"
              placeholder="🔍 Search weapons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '14px',
                border: '2px solid #ddd',
                borderRadius: '6px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            />
          </div>
          
          {/* Sort Controls */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label style={{ fontSize: '14px', fontWeight: '500', color: '#555' }}>
              Sort by:
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                border: '2px solid #ddd',
                borderRadius: '6px',
                cursor: 'pointer',
                backgroundColor: 'white'
              }}
            >
              <option value="name">Name</option>
              <option value="price">Price</option>
              <option value="damage">Damage</option>
              <option value="weight">Weight</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                border: '2px solid #ddd',
                borderRadius: '6px',
                cursor: 'pointer',
                backgroundColor: 'white',
                fontWeight: 'bold'
              }}
              title={`Sort ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
          
          {/* Results Count */}
          <div style={{ 
            fontSize: '14px', 
            color: '#666',
            padding: '8px 12px',
            backgroundColor: '#f5f5f5',
            borderRadius: '6px'
          }}>
            {filteredWeapons.length} weapon{filteredWeapons.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Category Filter */}
        <div className="category-filter" style={{ marginBottom: '20px' }}>
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={selectedCategory === category ? 'active' : ''}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Weapons Grid */}
        {filteredWeapons.length > 0 ? (
          <div className="items-grid">
            {filteredWeapons.map(weapon => (
              <ItemCard
                key={weapon.itemId}
                item={weapon}
                onBuy={() => handleBuyWeapon(weapon.itemId)}
                disabled={!selectedCharacter}
                character={selectedCharacter ? characters.find(c => c._id === selectedCharacter) : null}
              />
            ))}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '2px dashed #ddd'
          }}>
            <div style={{ fontSize: '3em', marginBottom: '15px' }}>🔍</div>
            <h3 style={{ color: '#6c757d', marginBottom: '10px' }}>No Weapons Found</h3>
            <p style={{ color: '#6c757d', margin: '0' }}>
              {searchQuery.trim() 
                ? `No weapons match "${searchQuery}". Try a different search term.`
                : `No weapons in the "${selectedCategory}" category. Try selecting a different category.`
              }
            </p>
          </div>
        )}

        {showPurchaseModal && (
          <div className="purchase-modal">
            <div className="modal-content">
              <p>{purchaseMessage}</p>
            </div>
          </div>
        )}

        {showWeaponSelection && (
          <div className="weapon-selection-modal">
            <div className="modal-content">
              <h3>Select a Weapon to Trade For</h3>
              <p>Choose which weapon you&apos;d like to receive in exchange for your low quality weapon:</p>
              
              <div className="weapon-selection-grid">
                {availableTradeInWeapons.map((weapon, index) => (
                  <div 
                    key={index}
                    className={`weapon-option ${selectedWeapon === weapon.name ? 'selected' : ''}`}
                    onClick={() => setSelectedWeapon(weapon.name)}
                  >
                    <div className="weapon-name">{weapon.name}</div>
                    <div className="weapon-stats">
                      <div>Damage: {weapon.damage}</div>
                      <div>Category: {weapon.category}</div>
                      <div>Weight: {weapon.weight} lbs</div>
                      <div>Value: {weapon.price} gold</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="modal-actions">
                <button 
                  className="cancel-btn"
                  onClick={() => {
                    setShowWeaponSelection(false);
                    setSelectedWeapon('');
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="confirm-btn"
                  onClick={handleWeaponSelection}
                  disabled={!selectedWeapon}
                >
                  Trade for {selectedWeapon || 'Selected Weapon'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Starting Equipment Selection Modal */}
        {showStartingEquipmentSelection && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>Select Starting Equipment Alternatives</h3>
              <p>Choose which Scholar equipment you&apos;d like to receive in exchange for your starting equipment:</p>
              
              <div className="equipment-selection-grid">
                {startingEquipmentOptions.map((equipment, index) => (
                  <div 
                    key={index}
                    className={`equipment-option ${selectedStartingEquipment.some(item => item.name === equipment.name) ? 'selected' : ''}`}
                    onClick={() => {
                      const isSelected = selectedStartingEquipment.some(item => item.name === equipment.name);
                      const newSelection = isSelected
                        ? selectedStartingEquipment.filter(item => item.name !== equipment.name)
                        : [...selectedStartingEquipment, equipment];
                      setSelectedStartingEquipment(newSelection);
                    }}
                  >
                    <div className="equipment-name">{equipment.name}</div>
                    <div className="equipment-stats">
                      <div>Category: {equipment.category}</div>
                      <div>Weight: {equipment.weight} lbs</div>
                      <div>Value: {equipment.price} gold</div>
                      {equipment.description && <div>Description: {equipment.description}</div>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="modal-actions">
                <button 
                  className="cancel-btn"
                  onClick={() => {
                    setShowStartingEquipmentSelection(false);
                    setSelectedStartingEquipment([]);
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="confirm-btn"
                  onClick={handleStartingEquipmentSelection}
                  disabled={selectedStartingEquipment.length === 0}
                >
                  Trade for {selectedStartingEquipment.length} Selected Item{selectedStartingEquipment.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Weapon Slot Selection Modal */}
        {showWeaponSlotModal && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }}>
              <h3>Select weapon for {selectedSlot === 'right' ? 'Right Hand' : 'Left Hand'}:</h3>
              
              {availableWeapons.length > 0 ? (
                <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '20px' }}>
                  {availableWeapons.map((weapon, index) => (
                    <div 
                      key={`${weapon.name}-${index}`}
                      onClick={() => handleWeaponSlotSelection(weapon.name)}
                      style={{
                        padding: '15px',
                        border: '2px solid #e9ecef',
                        borderRadius: '8px',
                        marginBottom: '10px',
                        cursor: 'pointer',
                        backgroundColor: 'white',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#f0f8ff';
                        e.target.style.borderColor = '#2196F3';
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = 'white';
                        e.target.style.borderColor = '#e9ecef';
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ fontSize: '1.1em', color: '#2c3e50' }}>{weapon.name}</strong>
                          <div style={{ marginTop: '5px', fontSize: '0.9em', color: '#6c757d' }}>
                            <div>Damage: {weapon.damage || "1d3"}</div>
                            <div>Type: {weapon.category || weapon.type || "unarmed"}</div>
                            {weapon.reach && <div>Reach: {weapon.reach}</div>}
                            {weapon.range && <div>Range: {weapon.range}</div>}
                          </div>
                        </div>
                        <div style={{ fontSize: '1.5em', opacity: 0.7 }}>⚔️</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '40px 20px', 
                  backgroundColor: '#f8f9fa', 
                  borderRadius: '8px',
                  marginBottom: '20px'
                }}>
                  <div style={{ fontSize: '2em', marginBottom: '10px' }}>⚔️</div>
                  <h4 style={{ color: '#6c757d', marginBottom: '10px' }}>No Weapons Found</h4>
                  <p style={{ color: '#6c757d', margin: '0' }}>
                    This character doesn&apos;t have any weapons in their inventory.
                    <br />
                    You can still select &quot;Unarmed&quot; or purchase weapons from the shop.
                  </p>
                </div>
              )}
              
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button 
                  onClick={() => {
                    setShowWeaponSlotModal(false);
                    setSelectedSlot(null);
                    setAvailableWeapons([]);
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Clothing Selection Modal */}
        {showClothingSelection && (
          <div className="clothing-selection-modal">
            <div className="modal-content">
              <h3>Select Race-Specific Clothing</h3>
              <p>Choose which traditional clothing you&apos;d like to receive in exchange for your basic clothes:</p>
              
              <div className="clothing-selection-grid">
                {raceClothingOptions.map((clothing, index) => (
                  <div 
                    key={index}
                    className={`clothing-option ${selectedClothing === clothing.name ? 'selected' : ''}`}
                    onClick={() => setSelectedClothing(clothing.name)}
                  >
                    <div className="clothing-name">{clothing.name}</div>
                    <div className="clothing-slot">Slot: {clothing.slot}</div>
                    <div className="clothing-stats">
                      <div>Weight: {clothing.weight} lbs</div>
                      <div>Value: {clothing.price} gold</div>
                      {clothing.description && (
                        <div className="clothing-description">{clothing.description}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="modal-actions">
                <button 
                  className="cancel-btn"
                  onClick={() => {
                    setShowClothingSelection(false);
                    setSelectedClothing('');
                    setRaceClothingOptions([]);
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="confirm-btn"
                  onClick={handleClothingSelection}
                  disabled={!selectedClothing}
                >
                  Trade for {selectedClothing || 'Selected Clothing'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default WeaponShop; 