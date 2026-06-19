import React, { useState } from 'react';
import PropTypes from 'prop-types';
import RulesReferenceModal from './RulesReferenceModal';

const RulesReferenceButton = ({ className = '', label = 'Rules Reference' }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setIsOpen(true)}
      >
        {label}
      </button>
      <RulesReferenceModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};

RulesReferenceButton.propTypes = {
  className: PropTypes.string,
  label: PropTypes.string,
};

export default RulesReferenceButton;
