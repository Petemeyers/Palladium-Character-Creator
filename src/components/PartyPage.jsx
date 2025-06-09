// PartyPage.jsx
import React, { useState } from 'react';
import CharacterList from './CharacterList';
import PartyBuilder from './PartyBuilder';
import '../styles/HomePage.css';
import PropTypes from 'prop-types';

const PartyPage = ({ characters, onDelete }) => {
  const [party, setParty] = useState([]);

  // Function to add a character to the party
  const handleAddToParty = (character) => {
    setParty((prevParty) => {
      if (prevParty.find((char) => char._id === character._id)) {
        alert(`${character.name} is already in the party.`);
        return prevParty;
      }
      return [...prevParty, character];
    });
  };

  // Function to remove a character from the party
  const handleRemoveFromParty = (characterId) => {
    setParty((prevParty) =>
      prevParty.filter((char) => char._id !== characterId)
    );
  };

  return (
    <div>
      <h1>Party Builder</h1>
      <CharacterList
        characters={characters}
        onAddToParty={handleAddToParty}
        onDelete={onDelete}
      />
      <PartyBuilder party={party} onRemoveFromParty={handleRemoveFromParty} />
    </div>
  );
};

PartyPage.propTypes = {
  characters: PropTypes.array.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default PartyPage;
