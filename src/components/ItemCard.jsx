import React from 'react';
import PropTypes from 'prop-types';

const ItemCard = ({ 
  item, 
  onBuy, 
  onSelect, 
  mode = 'buy', 
  selected = false, 
  disabled = false 
}) => {
  const handleAction = () => {
    if (mode === 'buy') {
      onBuy(item.itemId);
    } else {
      onSelect(item);
    }
  };

  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: '6px',
        padding: '12px',
        backgroundColor: selected ? '#e8f4e8' : 'white',
        opacity: disabled ? 0.7 : 1,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '150px',
        justifyContent: 'space-between'
      }}
    >
      <div>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1em', color: '#333' }}>{item.name}</h3>
        {item.description && (
          <p style={{ margin: '0 0 8px 0', fontSize: '0.9em', color: '#666' }}>{item.description}</p>
        )}
      </div>
      <div>
        <p style={{ margin: '8px 0', fontWeight: 'bold', color: '#4a4a4a' }}>
          {mode === 'buy' ? 'Price:' : 'Sell for:'} {mode === 'buy' ? item.price : Math.floor(item.price * 0.5)} gold
        </p>
        <button
          style={{
            width: '100%',
            backgroundColor: mode === 'buy' ? '#4CAF50' : '#f44336',
            color: 'white',
            border: 'none',
            padding: '8px 12px',
            borderRadius: '4px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: '0.9em',
            transition: 'background-color 0.2s'
          }}
          onClick={handleAction}
          disabled={disabled}
        >
          {mode === 'buy' ? 'Buy' : selected ? 'Unselect' : 'Select to Sell'}
        </button>
      </div>
    </div>
  );
};

ItemCard.propTypes = {
  item: PropTypes.shape({
    itemId: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number
    ]).isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    price: PropTypes.number.isRequired,
  }).isRequired,
  onBuy: PropTypes.func.isRequired,
  onSelect: PropTypes.func,
  mode: PropTypes.oneOf(['buy', 'sell']),
  selected: PropTypes.bool,
  disabled: PropTypes.bool,
};

export default ItemCard;
