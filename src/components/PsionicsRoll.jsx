import React, { useState } from 'react';
import PropTypes from 'prop-types';

const PsionicsRoll = ({ IQ, mentalEndurance, onRollPsionics }) => {
  const [result, setResult] = useState(null);
  const [hasRolled, setHasRolled] = useState(false);

  const rollForPsionics = () => {
    if (hasRolled) return;

    const roll = Math.floor(Math.random() * 100) + 1;
    let psionicResult = 'None';

    if (IQ >= 16 && mentalEndurance >= 12) {
      if (roll <= 5) psionicResult = 'Master';
      else if (roll <= 15) psionicResult = 'Major';
      else if (roll <= 25) psionicResult = 'Minor';
    }

    setResult(psionicResult);
    setHasRolled(true);
    onRollPsionics(psionicResult);
  };

  return (
    <div className="psionics-section">
      <h3>Psionics Check</h3>
      <button onClick={rollForPsionics} disabled={hasRolled}>
        Roll for Psionics
      </button>
      {result && <p>Psionic Ability: {result}</p>}
    </div>
  );
};

PsionicsRoll.propTypes = {
  IQ: PropTypes.number.isRequired,
  mentalEndurance: PropTypes.number.isRequired,
  onRollPsionics: PropTypes.func.isRequired,
};

export default PsionicsRoll;
