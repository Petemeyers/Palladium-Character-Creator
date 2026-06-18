import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/HomePage.css';

const HomePage = () => {
  return (
    <>
      <div className="main-content">
        <h1>Welcome to Medieval Combat Simulator Character Creator</h1>
        <p>Create your character for Medieval Combat Simulators.</p>
        <div className="button-container">
          <Link to="/character-creation" className="home-button">
            Create Character
          </Link>
          <Link to="/character-list" className="home-button">
            Character List
          </Link>
          <Link to="/character-sheet" className="home-button">
            ðŸ“„ Character Sheet
          </Link>
          <Link to="/combat" className="home-button">
            âš”ï¸ Combat Arena
          </Link>
          <Link to="/map-maker" className="home-button">
            ðŸ—ºï¸ Map Maker
          </Link>
          <Link to="/trader-shop" className="home-button">
            Trader Shop
          </Link>
          <Link to="/weapon-shop" className="home-button">
            âš”ï¸ Weapon Shop
          </Link>
          <Link to="/auto-roll-demo" className="home-button">
            ðŸŽ² Auto-Roll Demo
          </Link>
        </div>
      </div>
    </>
  );
};

export default HomePage;
