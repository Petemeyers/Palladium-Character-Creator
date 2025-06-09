import React, { useState, useEffect } from 'react';
import axiosInstance from '../utils/axios';
import ItemCard from './ItemCard';
import LoadingSpinner from './LoadingSpinner';
import Navbar from './Navbar';
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
      setItems(response.data);
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
      <Navbar />
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

        {errorMessage && (
          <p style={{ color: 'red' }}>{errorMessage}</p>
        )}

        {/* Display items by category */}
        {sortedCategories.map((category) => (
          <div key={category} className="category-section">
            <h2>{category}</h2>
            <div className="items-grid">
              {categories[category].map((item) => (
                <ItemCard
                  key={item._id}
                  item={item}
                  onBuy={() => handleBuyItem(item.itemId)}
                  disabled={purchaseLoading || !selectedCharacter}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TraderShop;
