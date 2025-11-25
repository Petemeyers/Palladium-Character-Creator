import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/HomePage.css';

const HomePage = () => {
  return (
    <>
      <div className="main-content">
        <h1>Welcome to Palladium Character Creator</h1>
        <p>Create your character for Palladium RPGs.</p>
        <div className="button-container">
          <Link to="/character-creation" className="home-button">
            Create Character
          </Link>
          <Link to="/character-list" className="home-button">
            Generate Characters
          </Link>
          <Link to="/character-sheet" className="home-button">
            📄 Character Sheet
          </Link>
          <Link to="/combat" className="home-button">
            ⚔️ Combat Arena
          </Link>
          <Link to="/trader-shop" className="home-button">
            Trader Shop
          </Link>
          <Link to="/weapon-shop" className="home-button">
            ⚔️ Weapon Shop
          </Link>
          <Link to="/auto-roll-demo" className="home-button">
            🎲 Auto-Roll Demo
          </Link>
        </div>
      </div>
    </>
  );
};

export default HomePage;
