import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from './Navbar';
import CopyCharactersButton from './CopyCharactersButton';
import BulkCharacterGenerator from './BulkCharacterGenerator';
import { assignInitialEquipment } from '../utils/characterUtils';
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
  const [selectedForDelete, setSelectedForDelete] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

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

  const getSortIndicator = (columnName) => {
    if (sortConfig.key === columnName) {
      return sortConfig.direction === 'ascending' ? ' ↑' : ' ↓';
    }
    return '';
  };

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

      // Get initial equipment based on class
      const { inventory, gold } = assignInitialEquipment(character.class);
      
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

  const handleDelete = async (characterId) => {
    try {
      await onDeleteCharacter(characterId);
    } catch (error) {
      console.error('Error deleting character:', error);
      alert('Failed to delete character');
    }
  };

  return (
    <>
      <Navbar />
      <div className="character-list">
        <h1>Character List</h1>
        <button onClick={onBack || (() => navigate(-1))}>Back</button>
        
        <BulkCharacterGenerator 
          names={characterNames}
          onComplete={() => {
            window.location.reload();
          }}
        />
        
        <button onClick={handleBulkAdd}>Add Bulk Characters</button>
        
        <table>
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </th>
              <th onClick={() => requestSort('name')} className="sortable">
                Name {getSortIndicator('name')}
              </th>
              <th onClick={() => requestSort('gender')} className="sortable">
                Gender {getSortIndicator('gender')}
              </th>
              <th onClick={() => requestSort('species')} className="sortable">
                Species {getSortIndicator('species')}
              </th>
              <th onClick={() => requestSort('class')} className="sortable">
                Class {getSortIndicator('class')}
              </th>
              <th onClick={() => requestSort('level')} className="sortable">
                Level {getSortIndicator('level')}
              </th>
              <th onClick={() => requestSort('hp')} className="sortable">
                HP {getSortIndicator('hp')}
              </th>
              <th onClick={() => requestSort('gold')} className="sortable">
                Gold {getSortIndicator('gold')}
              </th>
              <th>Inventory</th>
              <th onClick={() => requestSort('alignment')} className="sortable">
                Alignment {getSortIndicator('alignment')}
              </th>
              <th onClick={() => requestSort('socialBackground')} className="sortable">
                Background {getSortIndicator('socialBackground')}
              </th>
              <th onClick={() => requestSort('origin')} className="sortable">
                Origin {getSortIndicator('origin')}
              </th>
              <th onClick={() => requestSort('age')} className="sortable">
                Age {getSortIndicator('age')}
              </th>
              <th onClick={() => requestSort('disposition')} className="sortable">
                Disposition {getSortIndicator('disposition')}
              </th>
              <th onClick={() => requestSort('hostility')} className="sortable">
                Hostility {getSortIndicator('hostility')}
              </th>
              <th onClick={() => requestSort('attributes')} className="sortable">
                Attributes {getSortIndicator('attributes')}
              </th>
              <th>Image</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedCharacters.map((character, index) => (
              <tr key={index}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedForDelete.includes(character._id)}
                    onChange={() => toggleCharacterSelection(character._id)}
                  />
                </td>
                <td>
                  {editingId === character._id ? (
                    <div className="edit-name-container">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="edit-name-input"
                      />
                      <div className="edit-name-buttons">
                        <button 
                          onClick={() => handleNameChange(character._id)}
                          className="save-btn"
                        >
                          Save
                        </button>
                        <button 
                          onClick={cancelEditing}
                          className="cancel-btn"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="name-container">
                      <span>{character.name}</span>
                      <button 
                        onClick={() => startEditing(character)}
                        className="edit-btn"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </td>
                <td>{character.gender}</td>
                <td>{character.species}</td>
                <td>{character.class}</td>
                <td>{character.level}</td>
                <td>{character.hp}</td>
                <td>{character.gold || 0} gold</td>
                <td>
                  <div className="inventory-preview">
                    {character.inventory && character.inventory.length > 0 ? (
                      <div className="inventory-list">
                        {character.inventory.map((item, idx) => (
                          <div key={idx} className="inventory-item-preview">
                            {item.name}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div>
                        <span>No items</span>
                        <button 
                          onClick={() => handleAssignStartingEquipment(character)}
                          className="assign-equipment-btn"
                          style={{
                            marginLeft: '10px',
                            padding: '5px 10px',
                            backgroundColor: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Assign Starting Equipment
                        </button>
                      </div>
                    )}
                  </div>
                </td>
                <td>{character.alignment}</td>
                <td>{character.socialBackground}</td>
                <td>{character.origin}</td>
                <td>{character.age}</td>
                <td>{character.disposition}</td>
                <td>{character.hostility}</td>
                <td className="attributes-cell">
                  {character.attributes &&
                    Object.entries(character.attributes)
                      .filter(([key]) => !key.endsWith('_highlight'))
                      .map(([key, value]) => (
                        <div key={key} className="attribute">
                          {key}: {value}
                        </div>
                      ))}
                  {character.attributes && (
                    <div className="attribute-total">
                      Total: {
                        Object.entries(character.attributes)
                          .filter(([key]) => !key.endsWith('_highlight') && key !== 'total')
                          .reduce((sum, [, value]) => sum + value, 0)
                      }
                    </div>
                  )}
                </td>
                <td className="image-cell">
                  <ImageUpload 
                    character={character}
                    onUpdateCharacter={onUpdateCharacter}
                  />
                </td>
                <td className="actions-cell">
                  <button 
                    onClick={() => handleDelete(character._id)}
                    className="delete-btn"
                  >
                    Delete
                  </button>
                  <CopyCharactersButton characters={[character]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bulk-actions">
        <button
          onClick={handleBulkDelete}
          className="delete-all-btn"
          disabled={selectedForDelete.length === 0}
        >
          Delete Selected ({selectedForDelete.length})
        </button>
      </div>
      <div className="navigation-links" style={{ margin: '20px 0' }}>
        <Link 
          to="/trader-shop" 
          style={{
            padding: '10px 20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '4px',
            marginRight: '10px'
          }}
        >
          Visit Trader Shop
        </Link>
      </div>
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
