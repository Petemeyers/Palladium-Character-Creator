import React from 'react';
import PropTypes from 'prop-types';
import { isItemEquipped } from '../utils/equipmentManager';

const ItemCard = ({ 
  item, 
  onBuy, 
  onSelect, 
  mode = 'buy', 
  selected = false, 
  disabled = false,
  character = null
}) => {
  const handleAction = () => {
    if (mode === 'buy') {
      onBuy(item.itemId);
    } else {
      onSelect(item);
    }
  };

  // Check if this item is equipped by the character
  const isEquipped = character ? isItemEquipped(character, item) : false;

  return (
    <div
      style={{
        border: isEquipped ? '2px solid #28a745' : '1px solid #ddd',
        borderRadius: '6px',
        padding: '12px',
        backgroundColor: isEquipped ? '#e8f5e8' : (selected ? '#e8f4e8' : 'white'),
        opacity: disabled ? 0.7 : 1,
        boxShadow: isEquipped ? '0 4px 8px rgba(40, 167, 69, 0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '150px',
        justifyContent: 'space-between',
        position: 'relative'
      }}
    >
      {/* Equipped indicator */}
      {isEquipped && (
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          backgroundColor: '#28a745',
          color: 'white',
          borderRadius: '50%',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 'bold'
        }}>
          ⚔️
        </div>
      )}
      
      <div>
        <h3 style={{ 
          margin: '0 0 8px 0', 
          fontSize: '1.1em', 
          color: isEquipped ? '#155724' : '#333',
          fontWeight: isEquipped ? 'bold' : 'normal'
        }}>
          {item.name}
          {isEquipped && <span style={{ color: '#28a745', marginLeft: '8px' }}>(Equipped)</span>}
        </h3>
        {item.description && (
          <p style={{ margin: '0 0 8px 0', fontSize: '0.9em', color: '#666' }}>{item.description}</p>
        )}
        {/* Highlight "Low Quality Weapon" items */}
        {item.name.toLowerCase().includes('low quality weapon') && (
          <div style={{ 
            backgroundColor: '#fff2cc', 
            border: '2px solid #ffd700', 
            borderRadius: '4px', 
            padding: '4px', 
            margin: '4px 0',
            fontSize: '0.8em',
            fontWeight: 'bold',
            textAlign: 'center',
            color: '#b8860b'
          }}>
            🔄 Trade-in for 10 Gold Credit
          </div>
        )}
        {/* Enhanced weapon stats */}
        {(item.damage || item.weight || item.category || item.handed || item.reach || item.range || item.strengthRequired) && (
          <div style={{ margin: '8px 0', fontSize: '0.85em', color: '#555' }}>
            {item.damage && <div>⚔️ Damage: <strong>{item.damage}</strong></div>}
            {item.weight && <div>⚖️ Weight: <strong>{item.weight} lbs</strong></div>}
            {item.category && <div>📦 Type: <strong>{item.category}</strong></div>}
            {item.handed && <div>✋ Handed: <strong>{item.handed}</strong></div>}
            {/* Enhanced stats */}
            {item.reach && <div>📏 Reach: <strong>{item.reach} ft</strong></div>}
            {item.range && <div>🎯 Range: <strong>{item.range} ft</strong></div>}
            {item.rateOfFire && <div>⚡ Rate: <strong>{item.rateOfFire} attacks/melee</strong></div>}
            {item.ammunition && <div>🏹 Ammo: <strong>{item.ammunition}</strong></div>}
            {item.strengthRequired && <div>💪 P.S. Req: <strong>{item.strengthRequired}</strong></div>}
          </div>
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
    // Enhanced weapon stats
    reach: PropTypes.number,
    range: PropTypes.number,
    rateOfFire: PropTypes.number,
    ammunition: PropTypes.string,
    strengthRequired: PropTypes.number,
    description: PropTypes.string,
    price: PropTypes.number.isRequired,
    damage: PropTypes.string,
    weight: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number
    ]),
    category: PropTypes.string,
    handed: PropTypes.string,
  }).isRequired,
  onBuy: PropTypes.func.isRequired,
  onSelect: PropTypes.func,
  mode: PropTypes.oneOf(['buy', 'sell']),
  selected: PropTypes.bool,
  disabled: PropTypes.bool,
  character: PropTypes.object,
};

export default ItemCard;
