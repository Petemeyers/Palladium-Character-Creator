import React, { useState } from 'react';
import PropTypes from 'prop-types';
import axiosInstance from '../utils/axios';
import { rollDice, calculateAttributeRolls } from './util';
import { 
  speciesData, 
  socialBackgrounds, 
  dispositions, 
  hostilities, 
  landsOfOrigin,
  getAvailableClasses 
} from './data.jsx';
import { characterNames } from '../data/characterNames.js'; // Import characterNames

// Helper functions for random generation
const getRandomSpecies = () => {
  const species = Object.keys(speciesData);
  return species[Math.floor(Math.random() * species.length)];
};

const getRandomAlignment = () => {
  const alignments = [
    'Good: Principled',
    'Good: Scrupulous',
    'Selfish: Unprincipled',
    'Selfish: Anarchist',
    'Evil: Miscreant',
    'Evil: Aberrant',
    'Evil: Diabolic'
  ];
  return alignments[Math.floor(Math.random() * alignments.length)];
};

const getRandomOrigin = () => {
  const roll = rollDice(100, 1);
  return landsOfOrigin.find(entry => 
    roll >= entry.range[0] && roll <= entry.range[1]
  )?.text || 'Unknown';
};

const calculateAge = () => {
  return Math.floor(Math.random() * 50) + 18; // Random age between 18-67
};

const getRandomDisposition = () => {
  const roll = rollDice(100, 1);
  return dispositions.find(entry => 
    roll >= entry.range[0] && roll <= entry.range[1]
  )?.text || 'Unknown';
};

const getRandomHostility = () => {
  const roll = rollDice(100, 1);
  return hostilities.find(entry => 
    roll >= entry.range[0] && roll <= entry.range[1]
  )?.text || 'None';
};

const getRandomSocialBackground = () => {
  const roll = rollDice(100, 1);
  return socialBackgrounds.find(entry => 
    roll >= entry.range[0] && roll <= entry.range[1]
  )?.background || 'Unknown';
};

const calculateHP = () => {
  return rollDice(6, 1) + 10; // Basic HP calculation
};

// Function to get unused random names
const getUnusedRandomNames = (count, usedNames) => {
  const availableNames = characterNames.filter(name => !usedNames.includes(name));
  
  if (availableNames.length < count) {
    throw new Error('Not enough unique names available');
  }

  const selectedNames = [];
  const tempAvailable = [...availableNames];

  for (let i = 0; i < count; i++) {
    const randomIndex = Math.floor(Math.random() * tempAvailable.length);
    selectedNames.push(tempAvailable.splice(randomIndex, 1)[0]);
  }

  return selectedNames;
};

// BulkCharacterGenerator component
const BulkCharacterGenerator = ({ onComplete }) => {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [usedNames, setUsedNames] = useState([]);
  const [numCharacters, setNumCharacters] = useState(5); // Default to 5 characters

  const generateCharacters = async () => {
    setGenerating(true);
    try {
      const names = getUnusedRandomNames(numCharacters, usedNames);
      
      const characters = names.map(name => {
        // Generate random attributes first
        const species = getRandomSpecies();
        const diceRolls = speciesData[species];
        const generatedAttributes = calculateAttributeRolls(diceRolls, true);
        const level = 1;
        const hp = calculateHP();
        const alignment = getRandomAlignment();
        const origin = getRandomOrigin();
        const age = calculateAge();
        const disposition = getRandomDisposition();
        const hostility = getRandomHostility();
        const socialBackground = getRandomSocialBackground();
        const gender = Math.random() > 0.33 ? 
          (Math.random() > 0.5 ? 'Male' : 'Female') : 
          'Non-Binary';

        // Create character object for class selection
        const characterForClassSelection = {
          species,
          attributes: generatedAttributes,
          alignment
        };

        // Get available classes based on attributes and species
        const availableClasses = getAvailableClasses(characterForClassSelection);

        // Randomly select a class from available ones
        const characterClass = availableClasses[Math.floor(Math.random() * availableClasses.length)];

        return {
          name,
          species,
          class: characterClass || 'Peasant',
          level,
          hp,
          alignment,
          origin,
          age,
          disposition,
          hostility,
          attributes: generatedAttributes,
          socialBackground,
          isBulkCharacter: true,
          gender,
          psionics: null
        };
      });

      const response = await axiosInstance.post('/characters/bulk', characters);

      if (response.data.success) {
        setProgress(100);
        setUsedNames(prev => [...prev, ...names]);
        if (onComplete) {
          onComplete(response.data.characters);
        }
      }
    } catch (error) {
      console.error('Error generating characters:', error);
      alert(`Failed to generate characters: ${error.response?.data?.message || error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bulk-generator">
      <div>
        <label htmlFor="num-characters">Number of Characters:</label>
        <input
          type="number"
          id="num-characters"
          value={numCharacters}
          onChange={(e) => setNumCharacters(Math.min(Math.max(1, parseInt(e.target.value) || 1), characterNames.length - usedNames.length))}
          min="1"
          max={characterNames.length - usedNames.length}
          disabled={generating}
        />
        <p>Available names: {characterNames.length - usedNames.length}</p>
      </div>

      <button 
        onClick={generateCharacters} 
        disabled={generating || usedNames.length >= characterNames.length}
        className="generate-button"
      >
        {generating ? 'Generating...' : `Generate ${numCharacters} Characters`}
      </button>
      
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
  onComplete: PropTypes.func
};

export default BulkCharacterGenerator;
