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
} from './data.jsx';
import {
  rollDice,
  calculateAttributeRolls,
  determineCharacterAge,
  rollFromTable,
} from './util';
import PsionicsRoll from './PsionicsRoll';
import DiceLoadingSpinner from './DiceLoadingSpinner';
import D20LoadingSpinner from './D20LoadingSpinner';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <nav className="navbar">
      <div className="logo">Palladium Character Creator</div>
      <div className="hamburger" onClick={toggleMenu}>
        &#9776;
      </div>
      <ul className={`nav-links ${isOpen ? 'open' : ''}`}>
        <li>
          <Link to="/">Home</Link>
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
        {token ? (
          <li>
            <button onClick={handleLogout} className="logout-btn">Logout</button>
          </li>
        ) : (
          <li>
            <Link to="/login">Login</Link>
          </li>
        )}
      </ul>
    </nav>
  );
};

const CharacterCreator = ({ onCreateCharacter }) => {
  const navigate = useNavigate();
  const [species, setSpecies] = useState('HUMAN');
  const [attributes, setAttributes] = useState({});
  const [level, setLevel] = useState('1');
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
  const [psionics, setPsionics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [attributesRolled, setAttributesRolled] = useState(false);
  const [autoRollEnabled, setAutoRollEnabled] = useState(false);
  const [minTotalValue, setMinTotalValue] = useState(70); // Default minimum total
  const [isAutoRolling, setIsAutoRolling] = useState(false);
  const [gender, setGender] = useState('Male');
  const [customGender, setCustomGender] = useState('');
  const [isRolling, setIsRolling] = useState(false);
  const [rollType, setRollType] = useState('');

  const handleAutoRoll = async () => {
    setIsAutoRolling(true);
    let currentTotal = 0;
    let rollCount = 0;
    const maxRolls = 10000; // Safety limit to prevent infinite loops

    while (currentTotal <= minTotalValue && rollCount < maxRolls) {
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
          
          totalSum += results[attr];
        });
        
        updatedAttributes.total = totalSum;
        currentTotal = totalSum;
        
        setAttributes(updatedAttributes);
        setBonusRolled(false);
        
        // Add a small delay to prevent browser freezing
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      rollCount++;
    }
    
    setIsAutoRolling(true);
    setAttributesRolled(true);
    
    if (rollCount >= maxRolls) {
      alert('Maximum roll attempts reached. Please try again or adjust your minimum total.');
    }
  };

  const regenerateAttributes = async () => {
    setLoading(true);
    try {
      if (autoRollEnabled) {
        await handleAutoRoll();
      } else {
        // Original roll logic
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
            
            totalSum += results[attr];
          });
          
          updatedAttributes.total = totalSum;
          
          setAttributes(updatedAttributes);
          setBonusRolled(false);
          setAttributesRolled(true);
        }
      }
    } finally {
      setLoading(false);
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
    if (hp !== null) return; // Prevent re-rolling
    const baseHP = 10;
    const hpRoll = rollDice(6, 1);
    const totalHP = baseHP + hpRoll;
    setHp(totalHP);
    console.log('Rolled HP:', totalHP);
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
      setIsRolling(true);
      setRollType('Social Background');
    }
  };

  const handleRollDisposition = () => {
    if (disposition === '') {
      setIsRolling(true);
      setRollType('Disposition');
    }
  };

  const handleRollHostility = () => {
    if (hostility === '') {
      setIsRolling(true);
      setRollType('Personal Hostility');
    }
  };

  const handleRollOrigin = () => {
    if (origin === '') {
      setIsRolling(true);
      setRollType('Land of Origin');
    }
  };

  const handleRollFinish = (result) => {
    const roll = result * 5; // Convert d20 to d100 range
    switch (rollType) {
      case 'Social Background':
        setSocialBackground(rollFromTable(roll, socialBackgrounds));
        break;
      case 'Disposition':
        setDisposition(rollFromTable(roll, dispositions));
        break;
      case 'Personal Hostility':
        setHostility(rollFromTable(roll, hostilities));
        break;
      case 'Land of Origin':
        setOrigin(rollFromTable(roll, landsOfOrigin));
        break;
    }
    setIsRolling(false);
    setRollType('');
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

  const handlePsionicsRoll = (result) => {
    setPsionics(result);
  };

  const handleSubmit = async () => {
    if (!hp) {
      alert('Please roll HP before creating character');
      return;
    }

    console.log('Submitting character data:', {
      name: characterName,
      species,
      class: characterClass,
      level: 1,
      hp: Number(hp),
      alignment,
      attributes,
      age,
      socialBackground,
      disposition,
      hostility,
      origin,
      gender
    });

    try {
      const response = await onCreateCharacter({
        name: characterName,
        species,
        class: characterClass,
        level: 1,
        hp: Number(hp),
        alignment,
        attributes,
        age,
        socialBackground,
        disposition,
        hostility,
        origin,
        gender
      });

      console.log('Character creation response:', response);
      navigate('/character-list');
    } catch (error) {
      console.error('Error creating character:', {
        message: error.message,
        response: error.response?.data,
        data: error.response?.data?.details
      });
      alert(`Failed to create character: ${error.message}`);
    }
  };

  const renderClassSelection = () => {
    // Group available classes by category
    const groupedClasses = availableClasses.reduce((acc, className) => {
      // Filter out Mind Mage if psionics isn't Major or Master
      if (className === 'Mind Mage' && 
          (!psionics || typeof psionics !== 'string' || 
           (!psionics.includes('Major') && !psionics.includes('Master')))) {
        return acc;
      }
      
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
                  {attr === 'psionics' && 'Must have Major or Master psionics ability'}
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

  // Update level handler to properly handle string/number conversion
  const handleLevelChange = (e) => {
    const value = e.target.value;
    if (value === '' || (parseInt(value) > 0 && !isNaN(parseInt(value)))) {
      setLevel(value);
    }
  };

  if (loading) {
    return <DiceLoadingSpinner />;
  }

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

      <div id="gender-section">
        <label htmlFor="gender-select">Choose Gender:</label>
        <select
          id="gender-select"
          value={gender}
          onChange={(e) => {
            setGender(e.target.value);
            if (e.target.value !== 'Custom') {
              setCustomGender(''); // Reset custom gender when selecting a preset option
            }
          }}
          disabled={attributesRolled}
          className={attributesRolled ? 'disabled-select' : ''}
        >
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Non-Binary">Non-Binary</option>
          <option value="Custom">Custom</option>
        </select>

        {/* Show custom gender input when 'Custom' is selected */}
        {gender === 'Custom' && (
          <div className="custom-gender-input">
            <label htmlFor="custom-gender">Enter Gender:</label>
            <input
              type="text"
              id="custom-gender"
              value={customGender}
              onChange={(e) => setCustomGender(e.target.value)}
              placeholder="Enter your gender identity"
              disabled={attributesRolled}
            />
          </div>
        )}
      </div>

      <label htmlFor="species">Choose Species:</label>
      <select
        id="species"
        value={species}
        onChange={(e) => setSpecies(e.target.value)}
        disabled={attributesRolled}
        className={attributesRolled ? 'disabled-select' : ''}
      >
        {Object.keys(speciesData).map((spec) => (
          <option key={spec} value={spec}>
            {spec}
          </option>
        ))}
      </select>

      <label htmlFor="alignment-select">Choose Alignment:</label>
      <select
        id="alignment-select"
        value={alignment}
        onChange={(e) => setAlignment(e.target.value)}
        disabled={attributesRolled}
        className={attributesRolled ? 'disabled-select' : ''}
      >
        <option value="Good: Principled">Good: Principled</option>
        <option value="Good: Scrupulous">Good: Scrupulous</option>
        <option value="Selfish: Unprincipled">Selfish: Unprincipled</option>
        <option value="Selfish: Anarchist">Selfish: Anarchist</option>
        <option value="Evil: Miscreant">Evil: Miscreant</option>
        <option value="Evil: Aberrant">Evil: Aberrant</option>
        <option value="Evil: Diabolic">Evil: Diabolic</option>
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

      <div className="auto-roll-controls">
        <label htmlFor="autoRollEnabled">
          <input
            type="checkbox"
            id="autoRollEnabled"
            checked={autoRollEnabled}
            onChange={(e) => setAutoRollEnabled(e.target.checked)}
            disabled={attributesRolled}
          />
          Auto-roll until minimum total
        </label>
        
        {autoRollEnabled && (
          <div className="min-total-input">
            <label htmlFor="minTotalValue">Minimum Total:</label>
            <input
              type="number"
              id="minTotalValue"
              value={minTotalValue}
              onChange={(e) => setMinTotalValue(parseInt(e.target.value, 10))}
              min="0"
              max="200"
              disabled={attributesRolled || isAutoRolling}
            />
          </div>
        )}
      </div>

      <button 
        onClick={regenerateAttributes}
        disabled={isAutoRolling}
      >
        {isAutoRolling ? 'Auto-Rolling...' : 'Roll Attributes'}
      </button>

      <label htmlFor="character-level">Level:</label>
      <input
        type="number"
        id="character-level"
        min="1"
        value={level}
        onChange={handleLevelChange}
        className="form-input"
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

      {/* Move psionics section here, before class selection */}
      {attributes.IQ && (
        <PsionicsRoll
          IQ={attributes.IQ}
          mentalEndurance={attributes.ME || 0}
          onRollPsionics={handlePsionicsRoll}
        />
      )}

      {/* Class selection after psionics */}
      {renderClassSelection()}

      <button onClick={handleSubmit}>Create Character</button>

      <button onClick={() => navigate(-1)} className="back-button">
        Back
      </button>
      {isRolling && (
        <D20LoadingSpinner 
          onFinish={handleRollFinish}
          rollType={rollType}
        />
      )}

      {attributes.PS && (
        <div className="carry-weight-section">
          <h3>Carry Weight Calculations</h3>
          <p>Maximum Carry Weight: {attributes.PS * 10} lbs</p>
          <p>Light Activity Duration: {attributes.PE * 2} minutes</p>
          <p>Heavy Activity Duration: {attributes.PE} minutes</p>
        </div>
      )}
    </div>
  );
};

CharacterCreator.propTypes = {
  onCreateCharacter: PropTypes.func.isRequired
};

export default CharacterCreator;

