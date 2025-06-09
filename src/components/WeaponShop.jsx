import React, { useState, useEffect } from 'react';
import axiosInstance from '../utils/axios';
import ItemCard from './ItemCard';
import Navbar from './Navbar';
import Confetti from 'react-confetti';
import '../styles/WeaponShop.css';

const WeaponShop = () => {
  const [weapons, setWeapons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [weaponsResponse, charactersResponse] = await Promise.all([
          axiosInstance.get('/shop/weapons'),
          axiosInstance.get('/characters')
        ]);
        setWeapons(weaponsResponse.data);
        setCharacters(charactersResponse.data);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleBuyWeapon = async (itemId) => {
    if (!selectedCharacter) {
      alert('Please select a character first');
      return;
    }

    try {
      const response = await axiosInstance.post('/shop/purchase', {
        itemId,
        characterId: selectedCharacter
      });
      
      // Update character list after purchase
      const updatedCharacters = await axiosInstance.get('/characters');
      setCharacters(updatedCharacters.data);
      
      // Show success modal and confetti
      setPurchaseMessage(response.data.message);
      setShowPurchaseModal(true);
      setShowConfetti(true);

      // Hide confetti and modal after delay
      setTimeout(() => {
        setShowConfetti(false);
        setShowPurchaseModal(false);
      }, 3000);
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to purchase weapon');
    }
  };

  const categories = ['All', ...new Set(weapons.map(weapon => weapon.category))];
  const filteredWeapons = selectedCategory === 'All' 
    ? weapons 
    : weapons.filter(weapon => weapon.category === selectedCategory);

  if (loading) return <div>Loading weapons...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <>
      <Navbar />
      {showConfetti && (
        <Confetti
          width={window.innerWidth}
          height={window.innerHeight}
          recycle={false}
          numberOfPieces={200}
          gravity={0.3}
          colors={['#4CAF50', '#FFC107', '#2196F3', '#F44336']}
        />
      )}
      <div className="weapon-shop">
        <h1>Weapon Shop</h1>
        
        <div className="character-selector">
          <select 
            onChange={(e) => setSelectedCharacter(e.target.value)}
            value={selectedCharacter || ''}
          >
            <option value="">Select Character</option>
            {characters.map(char => (
              <option key={char._id} value={char._id}>
                {char.name} - Gold: {char.gold || 0}
              </option>
            ))}
          </select>
        </div>

        <div className="category-filter">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={selectedCategory === category ? 'active' : ''}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="items-grid">
          {filteredWeapons.map(weapon => (
            <ItemCard
              key={weapon.itemId}
              item={weapon}
              onBuy={() => handleBuyWeapon(weapon.itemId)}
              disabled={!selectedCharacter}
            />
          ))}
        </div>

        {showPurchaseModal && (
          <div className="purchase-modal">
            <div className="modal-content">
              <p>{purchaseMessage}</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default WeaponShop; 