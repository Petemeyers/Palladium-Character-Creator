import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import CopyCharactersButton from './CopyCharactersButton';
import BulkCharacterGenerator from './BulkCharacterGenerator';
import './CharacterList.css';

const characterNames = [
  'Alaalwen', 'Baar', 'Alaamar', 'Bada', 'Alaamra', 'Bago',
  // ... rest of the names
  'Zenortan'
];

const CharacterList = ({ characters, onBack, onDelete = () => {}, onUpdateCharacter, onAddBulkCharacters }) => {
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

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

  return (
    <>
      <Navbar />
      <div className="character-list">
        <h1>Character List</h1>
        <button onClick={onBack || (() => navigate(-1))}>Back</button>
        
        <BulkCharacterGenerator 
          names={characterNames}
          onComplete={() => {
            // Refresh the character list after generation
            window.location.reload();
          }}
        />
        
        <button onClick={handleBulkAdd}>Add Bulk Characters</button>
        
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Species</th>
              <th>Class</th>
              <th>Level</th>
              <th>HP</th>
              <th>Alignment</th>
              <th>Background</th>
              <th>Origin</th>
              <th>Age</th>
              <th>Disposition</th>
              <th>Hostility</th>
              <th>Attributes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {characters.map((character, index) => (
              <tr key={index}>
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
                <td>{character.species}</td>
                <td>{character.class}</td>
                <td>{character.level}</td>
                <td>{character.hp}</td>
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
                </td>
                <td className="actions-cell">
                  <button 
                    onClick={() => onDelete(character._id)}
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
    </>
  );
};

CharacterList.propTypes = {
  characters: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      species: PropTypes.string.isRequired,
      class: PropTypes.string.isRequired,
      socialBackground: PropTypes.string.isRequired,
      level: PropTypes.number.isRequired,
      hp: PropTypes.number,
      alignment: PropTypes.string.isRequired,
      origin: PropTypes.string,
      age: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      disposition: PropTypes.string.isRequired,
      hostility: PropTypes.string.isRequired,
      attributes: PropTypes.object,
      _id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    })
  ).isRequired,
  onBack: PropTypes.func,
  onDelete: PropTypes.func,
  onUpdateCharacter: PropTypes.func.isRequired,
  onAddBulkCharacters: PropTypes.func.isRequired,
};

export default CharacterList;
