import React, { useState } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { rollDice, calculateAttributeRolls, rollFromTable, determineCharacterAge } from './util';
import { speciesData, characterClasses, alignments, socialBackgrounds, dispositions, hostilities, landsOfOrigin } from './data';
import './BulkCharacterGenerator.css';

// Function to generate a single Palladium character
const generatePalladiumCharacter = (name, species = 'HUMAN', alignment = alignments[0].value, charClass) => { // Default to first alignment
  const diceRolls = speciesData[species];
  const attributes = calculateAttributeRolls(diceRolls, false);

  // Roll for various character aspects
  const ageRoll = rollDice(100, 1);
  const socialBackgroundRoll = rollDice(100, 1);
  const dispositionRoll = rollDice(100, 1);
  const hostilityRoll = rollDice(100, 1);
  const originRoll = rollDice(100, 1);

  // Calculate HP based on PE
  const pe = attributes.PE || 0;
  const level = Math.floor(Math.random() * 15) + 1; // 1-15 level range
  const baseHP = rollDice(6, level) + pe;

  return {
    name: name,
    species: species,
    class: charClass, // Use passed character class
    level: level,
    hp: baseHP,
    alignment: alignment, // Use passed alignment
    attributes: attributes,
    age: determineCharacterAge(species, ageRoll),
    socialBackground: rollFromTable(socialBackgroundRoll, socialBackgrounds),
    disposition: rollFromTable(dispositionRoll, dispositions),
    hostility: rollFromTable(hostilityRoll, hostilities),
    origin: rollFromTable(originRoll, landsOfOrigin), // Fixed reference here
  };
};

// Bulk character generation for multiple names
const generateBulkCharacters = (names, alignment, charClass) => {
  return names.map((name) => {
    try {
      return generatePalladiumCharacter(name, 'HUMAN', alignment, charClass);
    } catch (error) {
      console.error('Error generating character:', error);
      return null; // or handle the error as needed
    }
  }).filter(Boolean); // Remove any null values
};

// BulkCharacterGenerator component
const BulkCharacterGenerator = ({ names, onComplete }) => {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [alignment, setAlignment] = useState(alignments[0].value); // Default alignment
  const [charClass, setCharClass] = useState(characterClasses.length > 0 ? characterClasses[0].value : ''); // Default class with check

  // Convert characterClasses object to an array of entries
  const availableClasses = Object.entries(characterClasses).map(([key, value]) => ({
    value: key,
    label: key, // You can customize the label as needed
    ...value
  }));

  const generateCharacters = async () => {
    if (!alignment || !charClass) {
      alert('Please select both alignment and character class.');
      return;
    }
  
    setGenerating(true);
    let saved = 0;
  
    try {
      const batchSize = 10;
  
      for (let i = 0; i < names.length; i += batchSize) {
        const batch = names.slice(i, i + batchSize);
        const characters = generateBulkCharacters(batch, alignment, charClass); // Pass alignment and charClass
  
        // Save batch to database
        await axios.post('http://localhost:5000/api/characters/bulk', characters);
  
        saved += batch.length;
        setProgress((saved / names.length) * 100);
      }
  
      setGenerating(false);
      if (onComplete) onComplete();
    } catch (error) {
      console.error('Error generating characters:', error);
      if (error.response) {
        alert(`Error: ${error.response.data.message || 'Unknown server error'}`);
      } else if (error.code === 'ERR_NETWORK') {
        alert('Network error: Unable to connect to the server.');
      } else {
        alert('An unexpected error occurred. Please try again.');
      }
      setGenerating(false);
    }
  };
  
  
  console.log('Names:', names);
  console.log('Character Classes:', characterClasses);

  return (
    <div className="bulk-generator">
      {/* Alignment Select Dropdown */}
      <div>
        <label htmlFor="alignment-select">Choose Alignment:</label>
        <select
          id="alignment-select"
          value={alignment}
          onChange={(e) => setAlignment(e.target.value)}
        >
          {alignments.map((alignmentOption) => (
            <option key={alignmentOption.value} value={alignmentOption.value}>
              {alignmentOption.label}
            </option>
          ))}
        </select>
      </div>

 {/* Character Class Select Dropdown */}
 <div>
        <label htmlFor="class-select">Choose Character Class:</label>
        <select
          id="class-select"
          value={charClass}
          onChange={(e) => setCharClass(e.target.value)}
        >
          {availableClasses.map((charClass) => (
            <option key={charClass.value} value={charClass.value}>
              {charClass.label}
            </option>
          ))}
        </select>
      </div>

      {/* Button to generate characters */}
      <button 
        onClick={generateCharacters} 
        disabled={generating}
        className="generate-button"
      >
        {generating ? 'Generating...' : `Generate ${names.length} Characters`}
      </button>
      
      {/* Progress bar while generating */}
      {generating && (
        <div className="progress-bar">
          <div 
            className="progress" 
            style={{ width: `${progress}%` }}
          ></div>
          <span>{Math.round(progress)}%</span>
        </div>
      )}
    </div>
  );
};

BulkCharacterGenerator.propTypes = {
  names: PropTypes.arrayOf(PropTypes.string).isRequired,
  onComplete: PropTypes.func,
};

export default BulkCharacterGenerator;
