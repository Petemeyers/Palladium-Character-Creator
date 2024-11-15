import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from './Navbar';
import './HomePage.css';

const HomePage = () => {
  return (
    <>
      <Navbar />
      <div className="main-content">
        <h1>Welcome to My App</h1>
        <p>This is the home page of the application.</p>
        <div className="button-container">
          <Link to="/character-creation" className="home-button">
            Create Character
          </Link>
          <Link to="/character-list" className="home-button">
            Bulk Generate Characters
          </Link>
        </div>
      </div>
    </>
  );
};

export default HomePage;
