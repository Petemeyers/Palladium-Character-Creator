import React, { useState } from 'react';
import PropTypes from 'prop-types';

const TacticsRoll = ({ IQ, mentalEndurance, species, onRollTactics }) => {
  const [result, setResult] = useState(null);
  const [hasRolled, setHasRolled] = useState(false);
  const [rollValue, setRollValue] = useState(null);

  // Races that CANNOT have tactics (per Medieval Combat Simulator rules)
  const excludedRaces = ['BRIGAND', 'RAIDER', 'CHAMPION', 'CAVE_FIGHTER', 'GNOME'];
  const canRollForTactics = !excludedRaces.includes(species);

  const rollForTactics = () => {
    if (hasRolled) return;
    
    if (!canRollForTactics) {
      setResult('None (Race cannot have tactics)');
      setHasRolled(true);
      onRollTactics('None');
      return;
    }

    // Official Medieval Combat Simulator percentile roll (1d100)
    const roll = Math.floor(Math.random() * 100) + 1;
    setRollValue(roll);
    
    let tacticalResult = 'None';
    let focus = 0;

    // Official Medieval Combat Simulator tactical determination table
    if (roll >= 90) {
      tacticalResult = 'Master Tactical';      // 90-100 (11%)
      // Base focus = willpower + 1d20 for Master Tactical
      focus = mentalEndurance + Math.floor(Math.random() * 20) + 1;
    } else if (roll >= 80) {
      tacticalResult = 'Major Tactical';  // 80-89 (10%)
      // Base focus = willpower + 1d20 for Major Tactical
      focus = mentalEndurance + Math.floor(Math.random() * 20) + 1;
    } else if (roll >= 61) {
      tacticalResult = 'Minor Tactical';  // 61-79 (19%)
      // Base focus = willpower + 1d20 for Minor Tactical
      focus = mentalEndurance + Math.floor(Math.random() * 20) + 1;
    } else {
      tacticalResult = 'None';                            // 01-60 (60%)
      focus = 0;
    }

    setResult(tacticalResult);
    setHasRolled(true);
    onRollTactics({ result: tacticalResult, focus: focus });
  };

  return (
    <div className="tactics-section">
      <h3>ÃƒÂ°Ã…Â¸Ã‚Â§Ã‚Â  Tactics Determination</h3>
      
      {!canRollForTactics ? (
        <div className="tactics-info">
          <p className="tactics-requirement">
            ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â <strong>{species.replace(/_/g, ' ')}</strong> cannot have tactical abilities
          </p>
          <p className="tactics-current" style={{ fontSize: '0.9rem', marginTop: '8px' }}>
            Races excluded from tactics: Hob-Brigands, Raiders, Champions, Cave Fighters, Humans
          </p>
        </div>
      ) : (
        <>
          <div className="tactics-info">
            <p className="tactics-eligible" style={{ fontSize: '0.95rem', marginBottom: '10px' }}>
              Roll percentile dice to determine innate mental potential:
            </p>
            <div style={{ fontSize: '0.85rem', lineHeight: '1.6', color: '#495057' }}>
              <div><strong>01-60:</strong> None (60%)</div>
              <div><strong>61-79:</strong> Minor Tactical (19%) - Level 1 abilities only</div>
              <div><strong>80-89:</strong> Major Tactical (10%) - Levels 1-3, can become Pseudo-Tactician</div>
              <div><strong>90-100:</strong> Master Tactical (11%) - Levels 1-10, eligible for Tactician profession</div>
            </div>
            {mentalEndurance && (
              <p style={{ fontSize: '0.85rem', marginTop: '10px', color: '#6c757d', fontStyle: 'italic' }}>
                If tactical: focus = willpower ({mentalEndurance}) + 1d20 at level 1
              </p>
            )}
          </div>
          <button onClick={rollForTactics} disabled={hasRolled} className="tactics-button">
            {hasRolled ? 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“ Rolled' : 'ÃƒÂ°Ã…Â¸Ã…Â½Ã‚Â² Roll Percentile (d100)'}
          </button>
        </>
      )}
      
      {result && (
        <div className={`tactics-result ${
          result.includes('Master') ? 'master' : 
          result.includes('Major') ? 'major' : 
          result.includes('Minor') ? 'minor' : 
          'none'
        }`}>
          {rollValue && <div style={{ fontSize: '0.9rem', marginBottom: '5px' }}>Roll: {rollValue}/100</div>}
          <div><strong>Result:</strong> {result}</div>
          {result.includes('Major') && (
            <div style={{ fontSize: '0.85rem', marginTop: '8px', fontStyle: 'italic' }}>
              Can become Pseudo-Tactician (requires IQ 9+)
            </div>
          )}
          {result.includes('Master') && (
            <div style={{ fontSize: '0.85rem', marginTop: '8px', fontStyle: 'italic' }}>
              Eligible for Tactician profession (requires IQ 9+)
            </div>
          )}
          {!result.includes('None') && mentalEndurance && (
            <div style={{ fontSize: '0.85rem', marginTop: '8px', fontWeight: 'bold', color: '#2d3748' }}>
              Base focus: {mentalEndurance} (willpower) + 1d20 = {mentalEndurance + Math.floor(Math.random() * 20) + 1}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

TacticsRoll.propTypes = {
  IQ: PropTypes.number.isRequired,
  mentalEndurance: PropTypes.number.isRequired,
  species: PropTypes.string.isRequired,
  onRollTactics: PropTypes.func.isRequired,
};

export default TacticsRoll;
