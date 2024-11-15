// PartyBuilder.jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Navbar from './Navbar'; // Import the Navbar component
import './styles/partybuilder.css';

const PartyBuilder = ({ characters = [], onAddToParty = () => {}, onRemoveFromParty = () => {} }) => {
  const [parties, setParties] = useState([]);
  const [currentParty, setCurrentParty] = useState([]);
  const [partyName, setPartyName] = useState('');
  const [selectedPartyIndex, setSelectedPartyIndex] = useState(null);

  const createNewParty = () => {
    if (!partyName.trim()) {
      alert('Please enter a party name');
      return;
    }
    const newParty = {
      name: partyName,
      members: [...currentParty]
    };
    setParties([...parties, newParty]);
    setCurrentParty([]);
    setPartyName('');
    setSelectedPartyIndex(null);
  };

  const selectParty = (index) => {
    setSelectedPartyIndex(index);
    setCurrentParty(parties[index].members);
    setPartyName(parties[index].name);
  };

  const updateExistingParty = () => {
    if (selectedPartyIndex !== null) {
      const updatedParties = [...parties];
      updatedParties[selectedPartyIndex] = {
        name: partyName,
        members: currentParty
      };
      setParties(updatedParties);
      setCurrentParty([]);
      setPartyName('');
      setSelectedPartyIndex(null);
    }
  };

  const deleteParty = (index) => {
    const updatedParties = parties.filter((_, i) => i !== index);
    setParties(updatedParties);
    if (selectedPartyIndex === index) {
      setSelectedPartyIndex(null);
      setCurrentParty([]);
      setPartyName('');
    }
  };

  const addCharacterToCurrentParty = (character) => {
    if (currentParty.length >= 1000) {
      alert('Maximum party size is 1000 characters');
      return;
    }
    if (currentParty.some(member => member._id === character._id)) {
      alert('This character is already in the party');
      return;
    }
    setCurrentParty([...currentParty, character]);
    onAddToParty(character);
  };

  const removeCharacterFromCurrentParty = (characterId) => {
    setCurrentParty(currentParty.filter(char => char._id !== characterId));
    onRemoveFromParty(characterId);
  };

  return (
    <>
      <Navbar />
      <div className="main-content party-builder-container">
        <h2>Party Builder</h2>
        
        <div className="party-builder-layout">
          {/* Left Side - Party Creation and Saved Parties */}
          <div className="left-panel">
            {/* Party Creation Section */}
            <div className="party-creation-section">
              <h3>{selectedPartyIndex !== null ? 'Edit Party' : 'Create New Party'}</h3>
              <input
                type="text"
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                placeholder="Enter party name"
                className="party-name-input"
              />
              {selectedPartyIndex !== null ? (
                <div className="button-group">
                  <button onClick={updateExistingParty} className="update-party-btn">
                    Update Party
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedPartyIndex(null);
                      setCurrentParty([]);
                      setPartyName('');
                    }} 
                    className="cancel-btn"
                  >
                    Cancel Edit
                  </button>
                </div>
              ) : (
                <button onClick={createNewParty} className="create-party-btn">
                  Create New Party
                </button>
              )}
              
              <div className="current-party-members">
                <h4>Current Party Members: ({currentParty.length}/1000)</h4>
                <div className="party-members-grid">
                  <div className="party-members-header">
                    <span>Name</span>
                    <span>Class</span>
                    <span>Species</span>
                    <span>Actions</span>
                  </div>
                  {currentParty.map((character, index) => (
                    <div key={index} className="party-member-row">
                      <span>{character.name}</span>
                      <span>{character.class}</span>
                      <span>{character.species}</span>
                      <span>
                        <button 
                          onClick={() => removeCharacterFromCurrentParty(character._id)}
                          className="remove-btn"
                        >
                          Remove
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Saved Parties Section */}
            <div className="saved-parties-section">
              <h3>Saved Parties</h3>
              {parties.map((party, index) => (
                <div key={index} className="saved-party-card">
                  <div className="party-header">
                    <h4>{party.name} ({party.members.length} members)</h4>
                    <div className="party-actions">
                      <button 
                        onClick={() => selectParty(index)} 
                        className="edit-btn"
                        disabled={selectedPartyIndex === index}
                      >
                        Edit Party
                      </button>
                      <button onClick={() => deleteParty(index)} className="delete-party-btn">
                        Delete Party
                      </button>
                    </div>
                  </div>
                  <div className="party-members-grid">
                    <div className="party-members-header">
                      <span>Name</span>
                      <span>Class</span>
                      <span>Species</span>
                    </div>
                    {party.members.map((member, memberIndex) => (
                      <div key={memberIndex} className="party-member-row">
                        <span>{member.name}</span>
                        <span>{member.class}</span>
                        <span>{member.species}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Side - Available Characters */}
          <div className="right-panel">
            <div className="available-characters-section">
              <h3>Available Characters</h3>
              <div className="character-grid">
                <div className="character-grid-header">
                  <span>Name</span>
                  <span>Class</span>
                  <span>Species</span>
                  <span>Actions</span>
                </div>
                {characters.map((character, index) => (
                  <div key={index} className="character-grid-row">
                    <span>{character.name}</span>
                    <span>{character.class}</span>
                    <span>{character.species}</span>
                    <span>
                      <button 
                        onClick={() => addCharacterToCurrentParty(character)}
                        className="add-btn"
                      >
                        Add to Party
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

PartyBuilder.propTypes = {
  characters: PropTypes.arrayOf(PropTypes.shape({
    _id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    species: PropTypes.string.isRequired,
    class: PropTypes.string.isRequired,
    attributes: PropTypes.object.isRequired,
  })),
  onAddToParty: PropTypes.func,
  onRemoveFromParty: PropTypes.func,
};

export default PartyBuilder;
