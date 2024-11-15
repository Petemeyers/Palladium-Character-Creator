import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import '../app.css';
import {
  speciesData,
  socialBackgrounds,
  dispositions,
  hostilities,
  landsOfOrigin,
  getBonus,
  characterClasses,
  getAvailableClasses,
  speciesCharacteristics
} from './data';
import {
  rollDice,
  calculateAttributeRolls,
  determineCharacterAge,
  rollFromTable,
} from './util';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <nav className="navbar">
      <div className="logo">MyApp</div>
      <div className="hamburger" onClick={toggleMenu}>
        &#9776;
      </div>
      <ul className={`nav-links ${isOpen ? 'open' : ''}`}>
        <li>
          <Link to="/">Home</Link>
        </li>
        <li>
          <Link to="/chat">Begin Adventure</Link>
        </li>
        <li>
          <Link to="/character-creation">Character Creation</Link>
        </li>
        <li>
          <Link to="/party-builder">Party Builder</Link>
        </li>
        <li>
          <Link to="/character-list">Character List</Link>
        </li>
      </ul>
    </nav>
  );
};

const CharacterCreator = ({ onCharacterCreate = () => {} }) => {
  const navigate = useNavigate();
  const [species, setSpecies] = useState('HUMAN');
  const [attributes, setAttributes] = useState({});
  const [level, setLevel] = useState(1);
  const [hp, setHp] = useState(null);
  const [alignment, setAlignment] = useState('Good: Principled');
  const [characterName, setCharacterName] = useState('');
  const [age, setAge] = useState('');
  const [socialBackground, setSocialBackground] = useState('');
  const [disposition, setDisposition] = useState('');
  const [hostility, setHostility] = useState('');
  const [origin, setOrigin] = useState('');
  const [bonusRolled, setBonusRolled] = useState(false);
  const [useCryptoRandom, setUseCryptoRandom] = useState(false);
  const [characterClass, setCharacterClass] = useState('');
  const [availableClasses, setAvailableClasses] = useState([]);

  const regenerateAttributes = () => {
    const diceRolls = speciesData[species];
    if (diceRolls) {
      const results = calculateAttributeRolls(diceRolls, useCryptoRandom);
      const updatedAttributes = {};
      let totalSum = 0;
      
      Object.keys(results).forEach((attr) => {
        updatedAttributes[attr] = results[attr];
        const dice = diceRolls[attr];
        updatedAttributes[`${attr}_highlight`] = getHighlightColor(
          results[attr],
          dice
        );
        
        // Add to total sum
        totalSum += results[attr];
      });
      
      // Add total sum to attributes
      updatedAttributes.total = totalSum;
      
      setAttributes(updatedAttributes);
      setBonusRolled(false);
    }
  };

  const getHighlightColor = (attrValue, diceRoll) => {
    const [numDice] = diceRoll.split('d').map(Number);
    if (diceRoll.startsWith('3d6') && attrValue >= 16 && attrValue <= 18) {
      return 'green';
    } else if (
      (numDice === 4 && attrValue >= 18) ||
      (numDice === 5 && attrValue >= 24)
    ) {
      return 'red';
    }
    return '';
  };

  const rollBonus = () => {
    if (bonusRolled || Object.keys(attributes).length === 0) return;
    
    const updatedAttributes = { ...attributes };
    let totalSum = 0;
    
    Object.entries(attributes)
      .filter(([key]) => !key.endsWith('_highlight') && key !== 'total')
      .forEach(([attr, value]) => {
        const diceRoll = speciesData[species][attr];
        const [numDice] = diceRoll.split('d').map(Number);
        const highlight = attributes[`${attr}_highlight`];
        
        let newValue = value;
        if (attr !== 'Spd' && 
            ((highlight === 'green' && numDice <= 3) || 
             (highlight === 'red' && numDice >= 4))) {
          const bonusRoll = rollDice(6, 1, useCryptoRandom);
          newValue += bonusRoll;
          // Update the highlight based on new value
          updatedAttributes[attr] = newValue;
          updatedAttributes[`${attr}_highlight`] = getHighlightColor(
            newValue,
            diceRoll
          );
        }
        totalSum += newValue;
      });

    // Update total
    updatedAttributes.total = totalSum;
    
    setAttributes(updatedAttributes);
    setBonusRolled(true);
  };

  const rollHP = () => {
    if (hp === null || hp === '') {
      const pe = attributes.PE || 0;
      const totalHP = rollDice(6, level, useCryptoRandom) + pe;
      setHp(totalHP);
    }
  };

  const rollAge = () => {
    if (age === '' || age === 'Unknown') {
      const ageRoll = rollDice(100, 1, useCryptoRandom);
      try {
        const characterAge = determineCharacterAge(species, ageRoll);
        setAge(characterAge);
      } catch (error) {
        console.error(error);
        alert('An error occurred while determining the age.');
        setAge('Unknown');
      }
    }
  };

  const rollSocialBackground = () => {
    if (socialBackground === '') {
      const roll = rollDice(100, 1, useCryptoRandom);
      const background = rollFromTable(roll, socialBackgrounds);
      setSocialBackground(background);
    }
  };

  const handleRollDisposition = () => {
    if (disposition === '') {
      const roll = rollDice(100, 1, useCryptoRandom);
      const result = rollFromTable(roll, dispositions);
      setDisposition(result);
    }
  };

  const handleRollHostility = () => {
    if (hostility === '') {
      const roll = rollDice(100, 1, useCryptoRandom);
      const result = rollFromTable(roll, hostilities);
      setHostility(result);
    }
  };

  const handleRollOrigin = () => {
    if (origin === '') {
      const roll = rollDice(100, 1, useCryptoRandom);
      const result = rollFromTable(roll, landsOfOrigin);
      setOrigin(result);
    }
  };

  const updateAvailableClasses = () => {
    if (species && Object.keys(attributes).length > 0 && alignment) {
      const character = {
        species,
        attributes: Object.fromEntries(
          Object.entries(attributes).filter(([key]) => !key.endsWith('_highlight'))
        ),
        alignment
      };
      const classes = getAvailableClasses(character);
      setAvailableClasses(classes);
      
      // Reset character class if current selection is no longer valid
      if (characterClass && !classes.includes(characterClass)) {
        setCharacterClass('');
      }
    }
  };

  // Add useEffect to update available classes when relevant data changes
  useEffect(() => {
    updateAvailableClasses();
  }, [species, attributes, alignment]);

  const handleCreateCharacter = () => {
    if (
      !characterName ||
      !species ||
      Object.keys(attributes).length === 0 ||
      !hp ||
      !characterClass
    ) {
      alert(
        'Please ensure all character details, including class, are filled out before creating your character.'
      );
      return;
    }
    const newCharacter = {
      name: characterName,
      species,
      attributes,
      level,
      hp,
      alignment,
      age,
      socialBackground,
      disposition,
      hostility,
      origin,
      class: characterClass
    };
    onCharacterCreate(newCharacter);
    navigate('/character-list');
    // Reset state
    setSpecies('HUMAN');
    setAttributes({});
    setLevel(1);
    setHp(null);
    setAlignment('Good: Principled');
    setCharacterName('');
    setAge('');
    setSocialBackground('');
    setDisposition('');
    setHostility('');
    setOrigin('');
    setBonusRolled(false);
  };

  const renderClassSelection = () => {
    // Group available classes by category
    const groupedClasses = availableClasses.reduce((acc, className) => {
      const category = characterClasses[className].category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(className);
      return acc;
    }, {});

    return (
      <div className="class-selection">
        <label htmlFor="character-class">Character Class:</label>
        <select
          id="character-class"
          value={characterClass}
          onChange={(e) => setCharacterClass(e.target.value)}
          disabled={availableClasses.length === 0}
        >
          <option value="">Select a class</option>
          {Object.entries(groupedClasses).map(([category, classes]) => (
            <optgroup key={category} label={category}>
              {classes.map(className => (
                <option key={className} value={className}>
                  {className}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        
        {/* Display class requirements when a class is selected */}
        {characterClass && (
          <div className="class-requirements">
            <h4>{characterClass} Requirements:</h4>
            <ul>
              {Object.entries(characterClasses[characterClass].requirements).map(([attr, value]) => (
                <li key={attr}>
                  {attr === 'alignment' && 'Alignment: Evil required'}
                  {attr === 'psionics' && 'Must have psionics ability'}
                  {attr !== 'alignment' && attr !== 'psionics' && `${attr}: ${value}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Display species class restrictions */}
        <div className="species-limitations">
          <h4>{species} Class Limitations:</h4>
          <p>{speciesCharacteristics[species].occLimitations}</p>
        </div>
      </div>
    );
  };

  const getHighlightStyle = (highlight) => {
    switch (highlight) {
      case 'green':
        return { backgroundColor: '#90EE90' }; // Light green
      case 'red':
        return { backgroundColor: '#FFB6C1' }; // Light red
      default:
        return {};
    }
  };

  return (
    <div className="container">
      <Navbar />
      <h1>Character Creator</h1>
      <div id="name-section">
        <label htmlFor="character-name">Enter Character Name:</label>
        <input
          type="text"
          id="character-name"
          value={characterName}
          onChange={(e) => setCharacterName(e.target.value)}
        />
      </div>

      <label htmlFor="species">Choose Species:</label>
      <select
        id="species"
        value={species}
        onChange={(e) => setSpecies(e.target.value)}
      >
        {Object.keys(speciesData).map((spec) => (
          <option key={spec} value={spec}>
            {spec}
          </option>
        ))}
      </select>

      <div>
        <label htmlFor="useCryptoRandom">
          <input
            type="checkbox"
            id="useCryptoRandom"
            checked={useCryptoRandom}
            onChange={(e) => setUseCryptoRandom(e.target.checked)}
          />
          Use Stronger Randomness
        </label>
      </div>

      <button onClick={regenerateAttributes}>Roll Attributes</button>

      <label htmlFor="character-level">Level:</label>
      <input
        type="number"
        id="character-level"
        min="1"
        value={level}
        onChange={(e) => setLevel(parseInt(e.target.value, 10))}
      />

      <table id="attributes-table">
        <thead>
          <tr>
            <th>Attribute</th>
            <th>Value</th>
            <th>Bonus</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(attributes)
            .filter(([key]) => !key.endsWith('_highlight') && !key.endsWith('_total') && key !== 'total')
            .map(([key, value]) => {
              const bonusData = getBonus(key, value);
              let bonusDisplay = 'None';
              if (bonusData) {
                if (typeof bonusData === 'string') {
                  bonusDisplay = bonusData;
                } else if (bonusData.description) {
                  bonusDisplay = bonusData.description;
                }
              }

              return (
                <tr
                  key={key}
                  style={getHighlightStyle(attributes[`${key}_highlight`])}
                >
                  <td>{key}</td>
                  <td>{value}</td>
                  <td>{bonusDisplay}</td>
                </tr>
              );
            })}
          {/* Add sum total row */}
          <tr>
            <td colSpan="2">Total of All Attributes:</td>
            <td>{attributes.total || '-'}</td>
          </tr>
        </tbody>
      </table>

      <div>
        <button onClick={rollHP} disabled={hp !== null}>
          Roll HP
        </button>
        <div id="final-character-hp">HP: {hp}</div>
      </div>

      <select
        id="alignment-select"
        value={alignment}
        onChange={(e) => setAlignment(e.target.value)}
      >
        <option value="Good: Principled">Good: Principled</option>
        <option value="Good: Scrupulous">Good: Scrupulous</option>
        <option value="Selfish: Unprincipled">Selfish: Unprincipled</option>
        <option value="Selfish: Anarchist">Selfish: Anarchist</option>
        <option value="Evil: Miscreant">Evil: Miscreant</option>
        <option value="Evil: Aberrant">Evil: Aberrant</option>
        <option value="Evil: Diabolic">Evil: Diabolic</option>
      </select>

      <button onClick={rollBonus} disabled={bonusRolled}>
        Roll Bonus for Attributes
      </button>

      <button onClick={rollAge} disabled={age !== '' && age !== 'Unknown'}>
        Roll Age
      </button>
      <button
        onClick={rollSocialBackground}
        disabled={socialBackground !== ''}
      >
        Roll Social Background
      </button>
      <button onClick={handleRollDisposition} disabled={disposition !== ''}>
        Roll Disposition
      </button>
      <button onClick={handleRollHostility} disabled={hostility !== ''}>
        Roll Personal Hostility
      </button>
      <button onClick={handleRollOrigin} disabled={origin !== ''}>
        Roll Land of Origin
      </button>

      <div id="final-character">
        <div>Age: {age}</div>
        <div>Social Background: {socialBackground}</div>
        <div>Disposition: {disposition}</div>
        <div>Personal Hostility: {hostility}</div>
        <div>Land of Origin: {origin}</div>
      </div>

      {renderClassSelection()}

      <button onClick={handleCreateCharacter}>Create Character</button>

      <button onClick={() => navigate(-1)} className="back-button">
        Back
      </button>
    </div>
  );
};

CharacterCreator.propTypes = {
  onCharacterCreate: PropTypes.func,
};

export default CharacterCreator;
