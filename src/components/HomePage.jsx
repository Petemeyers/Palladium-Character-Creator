import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from './Navbar';
import '../styles/HomePage.css';

const HomePage = () => {
  return (
    <>
      <Navbar />
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
          <Link to="/trader-shop" className="home-button">
            Trader Shop
          </Link>
        </div>
      </div>
    </>
  );
};

export default HomePage;
