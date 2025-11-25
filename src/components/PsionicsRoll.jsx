import React, { useState } from 'react';
import PropTypes from 'prop-types';

const PsionicsRoll = ({ IQ, mentalEndurance, species, onRollPsionics }) => {
  const [result, setResult] = useState(null);
  const [hasRolled, setHasRolled] = useState(false);
  const [rollValue, setRollValue] = useState(null);

  // Races that CANNOT have psionics (per Palladium rules)
  const excludedRaces = ['HOB_GOBLIN', 'ORC', 'TROLL', 'TROGLODYTE', 'GNOME'];
  const canRollForPsionics = !excludedRaces.includes(species);

  const rollForPsionics = () => {
    if (hasRolled) return;
    
    if (!canRollForPsionics) {
      setResult('None (Race cannot have psionics)');
      setHasRolled(true);
      onRollPsionics('None');
      return;
    }

    // Official Palladium percentile roll (1d100)
    const roll = Math.floor(Math.random() * 100) + 1;
    setRollValue(roll);
    
    let psionicResult = 'None';
    let isp = 0;

    // Official Palladium psionic determination table
    if (roll >= 90) {
      psionicResult = 'Master Psionic';      // 90-100 (11%)
      // Base ISP = M.E. + 1d20 for Master Psionic
      isp = mentalEndurance + Math.floor(Math.random() * 20) + 1;
    } else if (roll >= 80) {
      psionicResult = 'Major Psionic';  // 80-89 (10%)
      // Base ISP = M.E. + 1d20 for Major Psionic
      isp = mentalEndurance + Math.floor(Math.random() * 20) + 1;
    } else if (roll >= 61) {
      psionicResult = 'Minor Psionic';  // 61-79 (19%)
      // Base ISP = M.E. + 1d20 for Minor Psionic
      isp = mentalEndurance + Math.floor(Math.random() * 20) + 1;
    } else {
      psionicResult = 'None';                            // 01-60 (60%)
      isp = 0;
    }

    setResult(psionicResult);
    setHasRolled(true);
    onRollPsionics({ result: psionicResult, isp: isp });
  };

  return (
    <div className="psionics-section">
      <h3>🧠 Psionics Determination</h3>
      
      {!canRollForPsionics ? (
        <div className="psionics-info">
          <p className="psionics-requirement">
            ⚠️ <strong>{species.replace(/_/g, ' ')}</strong> cannot have psionic abilities
          </p>
          <p className="psionics-current" style={{ fontSize: '0.9rem', marginTop: '8px' }}>
            Races excluded from psionics: Hob-Goblins, Orcs, Trolls, Troglodytes, Gnomes
          </p>
        </div>
      ) : (
        <>
          <div className="psionics-info">
            <p className="psionics-eligible" style={{ fontSize: '0.95rem', marginBottom: '10px' }}>
              Roll percentile dice to determine innate mental potential:
            </p>
            <div style={{ fontSize: '0.85rem', lineHeight: '1.6', color: '#495057' }}>
              <div><strong>01-60:</strong> None (60%)</div>
              <div><strong>61-79:</strong> Minor Psionic (19%) - Level 1 abilities only</div>
              <div><strong>80-89:</strong> Major Psionic (10%) - Levels 1-3, can become Pseudo-Mind Mage</div>
              <div><strong>90-100:</strong> Master Psionic (11%) - Levels 1-10, eligible for Mind Mage O.C.C.</div>
            </div>
            {mentalEndurance && (
              <p style={{ fontSize: '0.85rem', marginTop: '10px', color: '#6c757d', fontStyle: 'italic' }}>
                If psionic: I.S.P. = M.E. ({mentalEndurance}) + 1d20 at level 1
              </p>
            )}
          </div>
          <button onClick={rollForPsionics} disabled={hasRolled} className="psionics-button">
            {hasRolled ? '✓ Rolled' : '🎲 Roll Percentile (d100)'}
          </button>
        </>
      )}
      
      {result && (
        <div className={`psionics-result ${
          result.includes('Master') ? 'master' : 
          result.includes('Major') ? 'major' : 
          result.includes('Minor') ? 'minor' : 
          'none'
        }`}>
          {rollValue && <div style={{ fontSize: '0.9rem', marginBottom: '5px' }}>Roll: {rollValue}/100</div>}
          <div><strong>Result:</strong> {result}</div>
          {result.includes('Major') && (
            <div style={{ fontSize: '0.85rem', marginTop: '8px', fontStyle: 'italic' }}>
              Can become Pseudo-Mind Mage (requires IQ 9+)
            </div>
          )}
          {result.includes('Master') && (
            <div style={{ fontSize: '0.85rem', marginTop: '8px', fontStyle: 'italic' }}>
              Eligible for Mind Mage O.C.C. (requires IQ 9+)
            </div>
          )}
          {!result.includes('None') && mentalEndurance && (
            <div style={{ fontSize: '0.85rem', marginTop: '8px', fontWeight: 'bold', color: '#2d3748' }}>
              Base I.S.P.: {mentalEndurance} (M.E.) + 1d20 = {mentalEndurance + Math.floor(Math.random() * 20) + 1}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

PsionicsRoll.propTypes = {
  IQ: PropTypes.number.isRequired,
  mentalEndurance: PropTypes.number.isRequired,
  species: PropTypes.string.isRequired,
  onRollPsionics: PropTypes.func.isRequired,
};

export default PsionicsRoll;
