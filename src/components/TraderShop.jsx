import React, { useState, useEffect } from 'react';
import axiosInstance from '../utils/axios';
import ItemCard from './ItemCard';
import LoadingSpinner from './LoadingSpinner';
import clothingEquipmentData from '../data/clothingEquipment.json';
import traderEquipment from '../data/traderEquipment.js';
import { isItemEquipped } from '../utils/equipmentManager';
import '../styles/TraderShop.css';

const TraderShop = () => {
  const [items, setItems] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  useEffect(() => {
    fetchItems();
    fetchCharacters();
  }, []);

  const fetchCharacters = async () => {
    try {
      const response = await axiosInstance.get('/characters');
      setCharacters(response.data);
    } catch (error) {
      console.error('Error fetching characters:', error);
    }
  };

  const fetchItems = async () => {
    try {
      const response = await axiosInstance.get('/shop/items?shop=trader');
      console.log('Fetched items:', response.data);
      const shopItems = response.data;
      
      // Add enhanced equipment items from traderEquipment with armor penalties
      const equipmentItems = [];
      Object.keys(traderEquipment).forEach(slot => {
        traderEquipment[slot].forEach(item => {
          equipmentItems.push({
            _id: `equipment_${slot}_${item.name.replace(/\s+/g, '_').toLowerCase()}`,
            itemId: `equipment_${slot}_${item.name.replace(/\s+/g, '_').toLowerCase()}`,
            name: item.name,
            category: `Equipment - ${slot.charAt(0).toUpperCase() + slot.slice(1)}`,
            price: item.value,
            weight: item.weight,
            description: item.description,
            type: item.type,
            armorRating: item.armorRating || 0,
            slot: slot,
            // Include armor penalties for authentic 1994 Palladium Fantasy RPG
            speedPenalty: item.speedPenalty || 0,
            prowlPenalty: item.prowlPenalty || 0,
            dodgePenalty: item.dodgePenalty || 0,
            // Storage capacity for storage items
            capacity: item.capacity || null,
            ...item
          });
        });
      });
      
      // Combine shop items with equipment items
      setItems([...shopItems, ...equipmentItems]);
    } catch (error) {
      console.error('Error fetching items:', error);
      const message = error.response?.data?.message || 'Failed to load items. Please try again later.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const handleBuyItem = async (itemId) => {
    if (!selectedCharacter) {
      alert('Please select a character first');
      return;
    }

    setPurchaseLoading(true);
    try {
      const response = await axiosInstance.post('/shop/purchase', { 
        itemId: itemId,
        characterId: selectedCharacter 
      });
      
      alert(response.data.message);
      // Refresh character data after purchase
      await fetchCharacters();
    } catch (error) {
      console.error('Error purchasing item:', error);
      const message = error.response?.data?.message || 'Failed to purchase item. Please try again.';
      setErrorMessage(message);
      alert(message);
    } finally {
      setPurchaseLoading(false);
    }
  };

  // Group items by category
  const categories = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

  // Sort categories alphabetically
  const sortedCategories = Object.keys(categories).sort();

  if (loading) {
    return (
      <div className="loading-overlay">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div>
      <div className="inventory-bar">
        {selectedCharacter && (
          <div className="selected-character-info">
            <span>
              {characters.find(char => char._id === selectedCharacter)?.name} - 
              Gold: {characters.find(char => char._id === selectedCharacter)?.gold || 0}
            </span>
            <div className="character-inventory">
              {characters.find(char => char._id === selectedCharacter)?.inventory?.map((item, idx) => (
                <span key={idx} className="inventory-item">{item.name}</span>
              ))}
            </div>
          </div>
        )}
      </div>
      <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', marginTop: '60px' }}>
        <h1>Trader&apos;s Shop</h1>
        
        {/* Shop Navigation */}
        <div style={{ marginBottom: '20px' }}>
          <a 
            href="/weapon-shop" 
            style={{
              display: 'inline-block',
              backgroundColor: '#1a365d',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '5px',
              textDecoration: 'none',
              fontWeight: 'bold',
              border: '2px solid #2d3748',
              fontSize: '14px'
            }}
          >
            ⚔️ Visit Weapon Shop
          </a>
        </div>
        
        {/* Character Selection */}
        <div className="character-selection">
          <h2>Select Character</h2>
          <select 
            value={selectedCharacter || ''} 
            onChange={(e) => setSelectedCharacter(e.target.value)}
            style={{ padding: '8px', marginBottom: '20px' }}
          >
            <option value="">Select a character...</option>
            {characters.map(char => (
              <option key={char._id} value={char._id}>
                {char.name} - Gold: {char.gold || 0}
              </option>
            ))}
          </select>
        </div>

        {/* Clothing Inventory Panel */}
        {selectedCharacter && (
          <div className="clothing-inventory-panel" style={{
            backgroundColor: '#f5f5f5',
            border: '2px solid #ddd',
            borderRadius: '8px',
            padding: '15px',
            marginBottom: '20px'
          }}>
            <h3>👕 Clothing & Equipment</h3>
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
              💡 <strong>Tip:</strong> Items in inventory need to be equipped to show here. 
              <a href="/" style={{ color: '#007bff', textDecoration: 'underline', marginLeft: '5px' }}>
                Go to Character List to equip items
              </a>
            </p>
            {(() => {
              const character = characters.find(c => c._id === selectedCharacter);
              if (!character) return <p>Character not found</p>;
              
              // Use the modern equipment system
              const equipped = character.equipped || {};
              
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
                  {/* Head */}
                  <div>
                    <h4 style={{ margin: '0 0 8px 0', color: '#2e7d32', fontSize: '14px' }}>👤 Head</h4>
                    <div style={{
                      backgroundColor: 'white',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      padding: '8px',
                      minHeight: '50px',
                      fontSize: '12px'
                    }}>
                      <strong>{equipped.head?.name || "None"}</strong>
                      <br />
                      <small>{equipped.head?.type || "clothing"}</small>
                    </div>
                  </div>
                  
                  {/* Torso */}
                  <div>
                    <h4 style={{ margin: '0 0 8px 0', color: '#2e7d32', fontSize: '14px' }}>👔 Torso</h4>
                    <div style={{
                      backgroundColor: 'white',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      padding: '8px',
                      minHeight: '50px',
                      fontSize: '12px'
                    }}>
                      <strong>{equipped.torso?.name || "None"}</strong>
                      <br />
                      <small>{equipped.torso?.type || "clothing"}</small>
                    </div>
                  </div>
                  
                  {/* Legs */}
                  <div>
                    <h4 style={{ margin: '0 0 8px 0', color: '#2e7d32', fontSize: '14px' }}>👖 Legs</h4>
                    <div style={{
                      backgroundColor: 'white',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      padding: '8px',
                      minHeight: '50px',
                      fontSize: '12px'
                    }}>
                      <strong>{equipped.legs?.name || "None"}</strong>
                      <br />
                      <small>{equipped.legs?.type || "clothing"}</small>
                    </div>
                  </div>
                  
                  {/* Feet */}
                  <div>
                    <h4 style={{ margin: '0 0 8px 0', color: '#2e7d32', fontSize: '14px' }}>👟 Feet</h4>
                    <div style={{
                      backgroundColor: 'white',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      padding: '8px',
                      minHeight: '50px',
                      fontSize: '12px'
                    }}>
                      <strong>{equipped.feet?.name || "None"}</strong>
                      <br />
                      <small>{equipped.feet?.type || "clothing"}</small>
                    </div>
                  </div>
                  
                  {/* Hands */}
                  <div>
                    <h4 style={{ margin: '0 0 8px 0', color: '#2e7d32', fontSize: '14px' }}>🧤 Hands</h4>
                    <div style={{
                      backgroundColor: 'white',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      padding: '8px',
                      minHeight: '50px',
                      fontSize: '12px'
                    }}>
                      <strong>{equipped.hands?.name || "None"}</strong>
                      <br />
                      <small>{equipped.hands?.type || "clothing"}</small>
                    </div>
                  </div>
                  
                  {/* Waist */}
                  <div>
                    <h4 style={{ margin: '0 0 8px 0', color: '#2e7d32', fontSize: '14px' }}>🔗 Waist</h4>
                    <div style={{
                      backgroundColor: 'white',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      padding: '8px',
                      minHeight: '50px',
                      fontSize: '12px'
                    }}>
                      <strong>{equipped.waist?.name || "None"}</strong>
                      <br />
                      <small>{equipped.waist?.type || "utility"}</small>
                    </div>
                  </div>
                  
                  {/* Inventory Clothing Count */}
                  <div>
                    <h4 style={{ margin: '0 0 8px 0', color: '#2e7d32', fontSize: '14px' }}>🎒 Storage</h4>
                    <div style={{
                      backgroundColor: 'white',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      padding: '8px',
                      minHeight: '50px',
                      fontSize: '12px'
                    }}>
                      {(() => {
                        const inventoryClothing = (character.inventory || []).filter(item => 
                          item.type === "clothing" || item.type === "armor" || 
                          item.category?.toLowerCase().includes('clothing') ||
                          item.category?.toLowerCase().includes('armor')
                        );
                        const totalItems = (character.inventory || []).length;
                        return (
                          <>
                            <strong>{inventoryClothing.length} clothing</strong>
                            <br />
                            <small>{totalItems} total items</small>
                            <br />
                            <small style={{ color: '#666' }}>in inventory</small>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {errorMessage && (
          <p style={{ color: 'red' }}>{errorMessage}</p>
        )}

        {/* Display items by category */}
        {sortedCategories.map((category) => (
          <div key={category} className="category-section">
            <h2>{category}</h2>
            <div className="items-grid">
              {categories[category].map((item) => {
                const character = characters.find(c => c._id === selectedCharacter);
                return (
                  <ItemCard
                    key={item._id}
                    item={item}
                    onBuy={() => handleBuyItem(item.itemId)}
                    disabled={purchaseLoading || !selectedCharacter}
                    character={character}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TraderShop;
