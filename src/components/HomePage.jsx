import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/HomePage.css';

const HomePage = () => {
  return (
    <>
      <div className="main-content">
        <h1>Medieval Combat Simulator Character Creator</h1>
        <p>Create your character for Medieval Combat Simulator.</p>
        <div className="button-container">
          <Link to="/character-creation" className="home-button">
            Create Character
          </Link>
          <Link to="/character-list" className="home-button">
            Character List
          </Link>
          <Link to="/character-sheet" className="home-button">
            Character Sheet
          </Link>
          <Link to="/combat" className="home-button">
            Combat Arena
          </Link>
          <Link to="/map-maker" className="home-button">
            Map Maker
          </Link>
          <Link to="/trader-shop" className="home-button">
            Trader Shop
          </Link>
          <Link to="/weapon-shop" className="home-button">
            Weapon Shop
          </Link>
          <Link to="/auto-roll-demo" className="home-button">
            Auto-Roll Demo
          </Link>
        </div>
      </div>
    </>
  );
};

export default HomePage;
