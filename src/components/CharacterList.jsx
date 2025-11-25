import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, Link } from 'react-router-dom';
import CopyCharactersButton from './CopyCharactersButton';
import BulkCharacterGenerator from './BulkCharacterGenerator';
import WeaponEquipModal from './WeaponEquipModal';
import EquipmentModal from './EquipmentModal';
import StorageModal from './StorageModal';
import ArmorDurabilityCard from './ArmorDurabilityCard';
import { assignInitialEquipment } from '../utils/characterUtils';
import { getWeaponDisplayInfo, autoEquipWeapons, getAvailableWeapons, isWeapon } from '../utils/weaponManager';
import { getEquipmentDisplayInfo, getTotalArmorRating, getTotalCarryingCapacity, getContainerCapacityBonus, isItemEquipped } from '../utils/equipmentManager';
import { calculateStorageCapacity, calculateMonthlyCosts } from '../utils/storageManager';
import { getUnifiedAbilities } from '../utils/unifiedAbilities';
import axiosInstance from '../utils/axiosConfig';
import '../styles/CharacterList.css';

const characterNames = [
  'Alaalwen', 'Baar', 'Alaamar', 'Bada', 'Alaamra', 'Bago',
  // ... rest of the names
  'Zenortan'
];

const ImageUpload = ({ character, onUpdateCharacter }) => {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result;
        await onUpdateCharacter(character._id, { imageUrl: base64String });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="character-image">
      {character.imageUrl ? (
        <div className="image-container">
          <img 
            src={character.imageUrl} 
            alt={character.name}
            style={{ width: '100px', height: '100px', objectFit: 'cover' }}
          />
          <button 
            onClick={() => fileInputRef.current.click()}
            className="change-image-btn"
          >
            Change
          </button>
        </div>
      ) : (
        <button 
          onClick={() => fileInputRef.current.click()}
          disabled={uploading}
          className="upload-image-btn"
        >
          {uploading ? 'Uploading...' : 'Upload Image'}
        </button>
      )}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        style={{ display: 'none' }}
      />
    </div>
  );
};

ImageUpload.propTypes = {
  character: PropTypes.shape({
    _id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string.isRequired,
    imageUrl: PropTypes.string,
    // Add other character properties as needed
  }).isRequired,
  onUpdateCharacter: PropTypes.func.isRequired,
};

const CharacterList = ({ 
  characters, 
  onBack, 
  onDeleteCharacter, 
  onUpdateCharacter, 
  onAddBulkCharacters,
  onBulkDelete
}) => {
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: 'ascending'
  });
  const [weaponEquipModalOpen, setWeaponEquipModalOpen] = useState(false);
  const [selectedCharacterForWeapon, setSelectedCharacterForWeapon] = useState(null);
  const [equipmentModalOpen, setEquipmentModalOpen] = useState(false);
  const [selectedCharacterForEquipment, setSelectedCharacterForEquipment] = useState(null);
  const [storageModalOpen, setStorageModalOpen] = useState(false);
  const [selectedCharacterForStorage, setSelectedCharacterForStorage] = useState(null);
  const [selectedForDelete, setSelectedForDelete] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // Derived sorting variables for the new UI
  const sortField = sortConfig.key || 'name';
  const sortDirection = sortConfig.direction === 'ascending' ? 'asc' : 'desc';

  // Sorting function
  const sortedCharacters = React.useMemo(() => {
    let sortableItems = [...characters];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        // Handle nested attributes object
        if (sortConfig.key === 'attributes') {
          const aTotal = Object.entries(a.attributes)
            .filter(([key]) => !key.endsWith('_highlight') && key !== 'total')
            .reduce((sum, [, value]) => sum + value, 0);
          const bTotal = Object.entries(b.attributes)
            .filter(([key]) => !key.endsWith('_highlight') && key !== 'total')
            .reduce((sum, [, value]) => sum + value, 0);
          return sortConfig.direction === 'ascending' ? aTotal - bTotal : bTotal - aTotal;
        }

        // Handle regular properties
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [characters, sortConfig]);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  // Removed unused getSortIndicator function - now using dropdown sorting

  const startEditing = (character) => {
    setEditingId(character._id);
    setEditingName(character.name);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleNameChange = async (characterId) => {
    try {
      await onUpdateCharacter(characterId, { name: editingName });
      setEditingId(null);
      setEditingName('');
    } catch (error) {
      console.error('Error updating character name:', error);
      alert('Failed to update character name');
    }
  };

  const handleBulkAdd = () => {
    const newCharacters = [
      { name: 'Character 1', species: 'Human', class: 'Warrior', level: 1, hp: 10, alignment: 'Good', origin: 'Earth', age: 25, disposition: 'Friendly', hostility: 'None', attributes: {} },
      { name: 'Character 2', species: 'Elf', class: 'Mage', level: 1, hp: 8, alignment: 'Neutral', origin: 'Forest', age: 100, disposition: 'Curious', hostility: 'None', attributes: {} },
      // Add more characters as needed
    ];
    onAddBulkCharacters(newCharacters);
  };

  const handleBulkDelete = async () => {
    if (selectedForDelete.length === 0) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${selectedForDelete.length} characters? This action cannot be undone.`
    );

    if (confirmDelete) {
      try {
        await onBulkDelete(selectedForDelete);
        setSelectedForDelete([]); // Clear selection after deletion
      } catch (error) {
        console.error('Error deleting characters:', error);
        alert('Failed to delete characters. Please try again.');
      }
    }
  };

  const toggleCharacterSelection = (characterId) => {
    setSelectedForDelete(prev => 
      prev.includes(characterId)
        ? prev.filter(id => id !== characterId)
        : [...prev, characterId]
    );
  };

  const handleSelectAll = (checked) => {
    setSelectAll(checked);
    if (checked) {
      // Select all characters
      setSelectedForDelete(characters.map(char => char._id));
    } else {
      // Deselect all characters
      setSelectedForDelete([]);
    }
  };

  const handleAssignStartingEquipment = async (character) => {
    try {
      console.log('Assigning equipment to character:', character); // Debug log

      // Get initial equipment based on class and race
      const { inventory, gold } = assignInitialEquipment(character.class, character.species);
      
      // Create update object
      const updates = {
        inventory: inventory || [],
        gold: gold || 100
      };

      console.log('Equipment to assign:', updates); // Debug log

      // Update character
      const updatedCharacter = await onUpdateCharacter(character._id, updates);
      
      if (!updatedCharacter) {
        throw new Error('Failed to update character');
      }

      console.log('Character updated successfully:', updatedCharacter); // Debug log
      
      // Show success message
      alert(`Starting equipment assigned to ${character.name}`);
    } catch (error) {
      console.error('Error assigning starting equipment:', {
        error,
        message: error.message,
        response: error.response?.data,
        character: character
      });
      alert(`Failed to assign equipment: ${error.message}`);
    }
  };

  const handleAssignSkills = async (character) => {
    try {
      console.log('Assigning skills to character:', character); // Debug log

      // Call the skill assignment API
      const response = await fetch('/api/v1/skills/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` // Assuming JWT token storage
        },
        body: JSON.stringify({
          characterId: character._id,
          skillType: 'Physical' // Default to Physical, could be made selectable
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to assign skills');
      }

      const result = await response.json();
      console.log('Skills assigned successfully:', result);

      // Refresh the character list to show updated skills
      window.location.reload(); // Simple refresh - could be more elegant with state management
      
      alert(`Skills assigned to ${character.name}! Check the updated character list.`);
    } catch (error) {
      console.error('Error assigning skills:', {
        error,
        message: error.message
      });
      alert(`Failed to assign skills: ${error.message}`);
    }
  };

  const handleDelete = async (characterId) => {
    try {
      await onDeleteCharacter(characterId);
    } catch (error) {
      console.error('Error deleting character:', error);
      alert('Failed to delete character');
    }
  };

  const handleOpenWeaponEquip = (character) => {
    setSelectedCharacterForWeapon(character);
    setWeaponEquipModalOpen(true);
  };

  const handleCloseWeaponEquip = () => {
    setWeaponEquipModalOpen(false);
    setSelectedCharacterForWeapon(null);
  };

  const handleOpenEquipmentEquip = (character) => {
    setSelectedCharacterForEquipment(character);
    setEquipmentModalOpen(true);
  };

  const handleCloseEquipmentEquip = () => {
    setEquipmentModalOpen(false);
    setSelectedCharacterForEquipment(null);
  };

  const handleOpenStorage = (character) => {
    setSelectedCharacterForStorage(character);
    setStorageModalOpen(true);
  };

  const handleCloseStorage = () => {
    setStorageModalOpen(false);
    setSelectedCharacterForStorage(null);
  };

  const handleAutoEquipWeapons = async (character) => {
    try {
      console.log('🔍 Auto-equip clicked for:', character.name);
      console.log('🔍 Character inventory:', character.inventory);
      
      const availableWeapons = getAvailableWeapons(character);
      console.log('🔍 Available weapons found:', availableWeapons);
      
      if (availableWeapons.length === 0) {
        const hasInventory = character.inventory && character.inventory.length > 0;
        if (!hasInventory) {
          alert(`${character.name} has no inventory. Please assign starting equipment first using the "Assign Equipment" button.`);
        } else {
          alert(`No weapons found in ${character.name}'s inventory. The character has ${character.inventory.length} items but none are weapons. Please assign starting equipment first.`);
        }
        return;
      }
      
      const updatedCharacter = autoEquipWeapons(character);
      await onUpdateCharacter(character._id, updatedCharacter);
      
      // No page refresh - let's see the debug output
    } catch (error) {
      console.error('Error auto-equipping weapons:', error);
      alert('Failed to auto-equip weapons');
    }
  };

  return (
    <>
      <div className="character-list">
        <h1>Character List</h1>
        
        <div className="actions-container">
          <button 
            className="back-button" 
            onClick={onBack || (() => navigate(-1))}
          >
            ← Back
          </button>
          
          <BulkCharacterGenerator 
            names={characterNames}
            onComplete={() => {
              window.location.reload();
            }}
          />
          
          <button 
            className="bulk-add-btn" 
            onClick={handleBulkAdd}
          >
            Add Bulk Characters
          </button>
        </div>
        
        {/* Modern Character Grid */}
        <div className="character-grid">
          {/* Grid Header */}
          <div className="grid-header">
            <div className="header-controls">
              <div className="select-all-container">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="select-all-checkbox"
                />
                <span>Select All</span>
              </div>
              <div className="character-count">
                {sortedCharacters.length} Characters
              </div>
            </div>
            <div className="sort-controls">
              <select 
                value={sortField} 
                onChange={(e) => requestSort(e.target.value)}
                className="sort-dropdown"
              >
                <option value="name">Sort by Name</option>
                <option value="level">Sort by Level</option>
                <option value="class">Sort by Class</option>
                <option value="species">Sort by Species</option>
                <option value="alignment">Sort by Alignment</option>
                <option value="gold">Sort by Gold</option>
              </select>
              <button 
                onClick={() => requestSort(sortField)}
                className="sort-direction-btn"
              >
                {sortDirection === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>

          {/* Character Cards */}
          <div className="character-cards">
            {sortedCharacters.map((character, index) => (
              <div key={index} className="character-card">
                {/* Card Header */}
                <div className="card-header">
                  <div className="card-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedForDelete.includes(character._id)}
                      onChange={() => toggleCharacterSelection(character._id)}
                    />
                  </div>
                  <div className="character-image">
                    <ImageUpload 
                      character={character}
                      onUpdateCharacter={onUpdateCharacter}
                    />
                  </div>
                  <div className="character-basic-info">
                    {editingId === character._id ? (
                      <div className="edit-name-container">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="edit-name-input"
                          autoFocus
                        />
                        <div className="edit-buttons">
                          <button 
                            onClick={() => handleNameChange(character._id)}
                            className="save-btn"
                          >
                            ✓
                          </button>
                          <button 
                            onClick={cancelEditing}
                            className="cancel-btn"
                          >
                            ✗
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="name-section">
                        <h3 className="character-name">{character.name}</h3>
                        <button 
                          onClick={() => startEditing(character)}
                          className="edit-name-btn"
                          title="Edit name"
                        >
                          ✏️
                        </button>
                      </div>
                    )}
                       <div className="character-title">
                         Level {character.level} {character.species} {character.class}
                       </div>
                       {character.experiencePoints && (
                         <div className="character-xp">
                           XP: {character.experiencePoints.toLocaleString()}
                         </div>
                       )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="card-body">
                  <div className="stats-grid">
                    <div className="stat-item">
                      <span className="stat-label">HP</span>
                      <span className="stat-value">{character.derived?.hitPoints || character.hp}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">AR</span>
                      <span className="stat-value">{getTotalArmorRating(character) || 0}</span>
                    </div>
                    {(() => {
                      const unified = getUnifiedAbilities(character);
                      const isp = unified?.psionics?.currentISP ?? unified?.energy?.ISP ?? character.ISP ?? 0;
                      return isp > 0 ? (
                        <div className="stat-item">
                          <span className="stat-label">ISP</span>
                          <span className="stat-value">{isp}</span>
                        </div>
                      ) : null;
                    })()}
                    <div className="stat-item">
                      <span className="stat-label">Gold</span>
                      <span className="stat-value">{character.gold || 0}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Gender</span>
                      <span className="stat-value">{character.gender}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Age</span>
                      <span className="stat-value">{character.age}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Alignment</span>
                      <span className="stat-value">{character.alignment}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Origin</span>
                      <span className="stat-value">{character.origin}</span>
                    </div>
                  </div>

                  {/* Inventory Section */}
                  <div className="inventory-section">
                    <h4>Inventory ({character.inventory?.length || 0})</h4>
                    {character.inventory && character.inventory.length > 0 ? (
                      <div className="inventory-items-scrollable">
                        {character.inventory.map((item, idx) => {
                          const isEquipped = isItemEquipped(character, item);
                          return (
                            <div 
                              key={idx} 
                              className={`inventory-item ${isEquipped ? 'equipped' : ''}`}
                              title={isEquipped ? 'Currently equipped' : ''}
                            >
                              {item.name}
                              {isEquipped && <span className="equipped-indicator"> ⚔️</span>}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="inventory-empty">
                        <span>No items</span>
                        <div className="inventory-actions">
                          <button 
                            onClick={() => handleAssignStartingEquipment(character)}
                            className="assign-equipment-btn"
                          >
                            Assign Equipment
                          </button>
                          <button 
                            onClick={() => handleAssignSkills(character)}
                            className={`assign-skills-btn ${character.skillsAssigned ? 'disabled' : ''}`}
                            disabled={character.skillsAssigned}
                          >
                            {character.skillsAssigned ? 'Skills ✓' : 'Assign Skills'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Weapons Section */}
                  <div className="weapons-section">
                    <h4>⚔️ Weapons</h4>
                    {(() => {
                      console.log('🔍 Displaying weapons for:', character.name);
                      console.log('🔍 Character equippedWeapons:', character.equippedWeapons);
                      if (character.equippedWeapons && character.equippedWeapons.length > 0) {
                        console.log('🔍 Right hand weapon:', character.equippedWeapons[0]);
                        console.log('🔍 Left hand weapon:', character.equippedWeapons[1]);
                      }
                      const weaponInfo = getWeaponDisplayInfo(character);
                      console.log('🔍 Weapon display info:', weaponInfo);
                      
                      return (
                        <div className="weapons-display">
                          <div className="weapon-slots">
                            <div className="weapon-slot">
                              <span className="weapon-slot-label">Right Hand:</span>
                              <span className="weapon-name">{weaponInfo.rightHand.name}</span>
                              <span className="weapon-damage">({weaponInfo.rightHand.damage})</span>
                            </div>
                            <div className="weapon-slot">
                              <span className="weapon-slot-label">Left Hand:</span>
                              <span className="weapon-name">{weaponInfo.leftHand.name}</span>
                              <span className="weapon-damage">({weaponInfo.leftHand.damage})</span>
                            </div>
                          </div>
                          <div className="weapon-actions">
                            <button 
                              onClick={() => handleOpenWeaponEquip(character)}
                              className="equip-weapons-btn"
                            >
                              Equip Weapons
                            </button>
                            <button 
                              onClick={() => handleAutoEquipWeapons(character)}
                              className="auto-equip-btn"
                            >
                              Auto-Equip
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Equipment Section */}
                  <div className="equipment-section">
                    {(() => {
                      const equipmentInfo = getEquipmentDisplayInfo(character);
                      const totalArmor = getTotalArmorRating(character);
                      const totalCapacity = getTotalCarryingCapacity(character);
                      const containerBonus = getContainerCapacityBonus(character);
                      const storageCapacity = calculateStorageCapacity(character);
                      const monthlyCosts = calculateMonthlyCosts(character);
                      
                      return (
                        <div className="equipment-display">
                          <h4>Equipment {totalArmor > 0 && <span className="armor-rating">(AR: {totalArmor})</span>}</h4>
                          <div className="storage-info" style={{ fontSize: '0.8em', color: '#888', marginBottom: '8px' }}>
                            🎒 Capacity: {character.carryWeight?.maxWeight || 0} + {containerBonus} = {totalCapacity} lbs
                            {storageCapacity.totalCapacity > 0 && (
                              <span> | 🏠 Storage: {storageCapacity.totalCapacity} lbs ({monthlyCosts.totalMonthlyCost} gp/month)</span>
                            )}
                          </div>
                          <div className="equipment-slots">
                            {Object.entries(equipmentInfo)
                              .filter(([slot]) => slot !== 'hasEquipment') // Exclude boolean flag
                              .map(([slot, item]) => (
                              <div key={slot} className="equipment-slot">
                                <span className="equipment-slot-label">{slot.charAt(0).toUpperCase() + slot.slice(1)}:</span>
                                <span className="equipment-name">{item.name}</span>
                                {item.armorRating > 0 && (
                                  <span className="equipment-defense">(A.R.: {item.armorRating})</span>
                                )}
                                {item.capacity && item.capacity > 0 && (
                                  <span className="equipment-capacity" style={{ fontSize: '0.85em', color: '#4CAF50' }}>
                                    {slot === 'waist' && ` [Storage: ${item.capacity}]`}
                                  </span>
                                )}
                                {item.broken && (
                                  <span className="equipment-broken">BROKEN</span>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="equipment-actions">
                            <button 
                              onClick={() => handleOpenEquipmentEquip(character)}
                              className="equip-equipment-btn"
                            >
                              Equip Clothing & Armor
                            </button>
                            <button 
                              onClick={() => handleOpenStorage(character)}
                              className="equip-equipment-btn"
                              style={{ backgroundColor: '#9C27B0', marginTop: '8px' }}
                            >
                              🏠 Storage & Housing
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Armor Durability Section */}
                  {(() => {
                    const equipmentInfo = getEquipmentDisplayInfo(character);
                    const hasArmor = Object.values(equipmentInfo).some(item => 
                      item && item.armorRating > 0 && item.name !== "None"
                    );
                    
                    if (!hasArmor) return null;
                    
                    return (
                      <div className="durability-section">
                        <h4>🛡️ Armor Durability</h4>
                        <div className="durability-display">
                          {Object.entries(equipmentInfo).map(([slot, item]) => {
                            if (!item || item.name === "None" || !item.armorRating) return null;
                            return (
                              <ArmorDurabilityCard
                                key={slot}
                                armorData={item}
                                showControls={false}
                                compact={true}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Attributes Section */}
                  {character.attributes && (
                    <div className="attributes-section">
                      <h4>Attributes ({Object.keys(character.attributes).filter(key => !key.endsWith('_highlight') && key !== 'total').length})</h4>
                      <div className="attributes-grid-scrollable">
                        {Object.entries(character.attributes)
                          .filter(([key]) => !key.endsWith('_highlight') && key !== 'total')
                          .map(([key, value]) => (
                            <div key={key} className="attribute-item">
                              <span className="attr-name">{key}</span>
                              <span className="attr-value">{value}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Skills Section */}
                  {(character.occSkills || character.electiveSkills || character.secondarySkills) && (
                    <div className="skills-section">
                      <h4>Skills</h4>
                      <div className="skills-container">
                        {character.occSkills && character.occSkills.length > 0 && (
                          <div className="skill-category">
                            <h5>OCC Skills ({character.occSkills.length})</h5>
                            <div className="skills-list-scrollable">
                              {character.occSkills.map((skill, idx) => (
                                <div key={idx} className="skill-item occ-skill">
                                  {skill}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {character.electiveSkills && character.electiveSkills.length > 0 && (
                          <div className="skill-category">
                            <h5>Elective Skills ({character.electiveSkills.length})</h5>
                            <div className="skills-list-scrollable">
                              {character.electiveSkills.map((skill, idx) => (
                                <div key={idx} className="skill-item elective-skill">
                                  {skill}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {character.secondarySkills && character.secondarySkills.length > 0 && (
                          <div className="skill-category">
                            <h5>Secondary Skills ({character.secondarySkills.length})</h5>
                            <div className="skills-list-scrollable">
                              {character.secondarySkills.map((skill, idx) => (
                                <div key={idx} className="skill-item secondary-skill">
                                  {skill}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Bonuses Section */}
                  {character.abilities && character.abilities.length > 0 && (
                    <div className="bonuses-section">
                      <h4>Bonuses & Abilities ({character.abilities.length})</h4>
                      <div className="bonuses-list-scrollable">
                        {character.abilities.map((ability, idx) => (
                          <div key={idx} className="bonus-item">
                            <div className="bonus-name">{ability.name}</div>
                            {ability.bonus && (
                              <div className="bonus-value">{ability.bonus}</div>
                            )}
                            {ability.effect && (
                              <div className="bonus-effect">{ability.effect}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="card-footer">
                  <div className="character-actions">
                    <button 
                      onClick={() => handleDelete(character._id)}
                      className="delete-btn"
                      title="Delete character"
                    >
                      🗑️ Delete
                    </button>
                    <CopyCharactersButton characters={[character]} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="navigation-links">
        <button
          onClick={handleBulkDelete}
          className="delete-all-btn"
          disabled={selectedForDelete.length === 0}
        >
          Delete Selected ({selectedForDelete.length})
        </button>
        <Link to="/trader-shop">
          Visit Trader Shop
        </Link>
      </div>
      
      {/* Weapon Equip Modal */}
      {selectedCharacterForWeapon && (
        <WeaponEquipModal
          isOpen={weaponEquipModalOpen}
          onClose={handleCloseWeaponEquip}
          character={selectedCharacterForWeapon}
          onUpdateCharacter={onUpdateCharacter}
        />
      )}

      {/* Equipment Modal */}
      {selectedCharacterForEquipment && (
        <EquipmentModal
          isOpen={equipmentModalOpen}
          onClose={handleCloseEquipmentEquip}
          character={selectedCharacterForEquipment}
          onUpdateCharacter={onUpdateCharacter}
        />
      )}

      {/* Storage Modal */}
      {selectedCharacterForStorage && (
        <StorageModal
          isOpen={storageModalOpen}
          onClose={handleCloseStorage}
          character={selectedCharacterForStorage}
          onCharacterUpdate={onUpdateCharacter}
        />
      )}
    </>
  );
};

CharacterList.propTypes = {
  characters: PropTypes.array.isRequired,
  onBack: PropTypes.func,
  onDeleteCharacter: PropTypes.func.isRequired,
  onUpdateCharacter: PropTypes.func.isRequired,
  onAddBulkCharacters: PropTypes.func.isRequired,
  onBulkDelete: PropTypes.func.isRequired
};

export default CharacterList;
