import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/Navbar.css';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <h1 style={{ color: 'white', margin: 0 }}>Palladium Character Creator</h1>
      <button className="hamburger" onClick={toggleMenu}>
        ☰
      </button>
      {isOpen && (
        <>
          <div className={`nav-center ${isOpen ? 'open' : ''}`}>
            <Link to="/" className="nav-link" onClick={closeMenu}>Home</Link>
            <Link to="/character-creation" className="nav-link" onClick={closeMenu}>Create Character</Link>
            <Link to="/trader-shop" className="nav-link" onClick={closeMenu}>Trader Shop</Link>
            <Link to="/character-list" className="nav-link" onClick={closeMenu}>Character List</Link>
            <Link to="/weapon-shop" className="nav-link" onClick={closeMenu}>Weapon Shop</Link>
            <Link to="/party-builder" className="nav-link" onClick={closeMenu}>Party Builder</Link>
            <Link to="/chat" className="nav-link" onClick={closeMenu}>Begin Adventure</Link>
            <button 
              className="nav-link logout-btn" 
              onClick={() => {
                handleLogout();
                closeMenu();
              }}
            >
              Logout
            </button>
          </div>
        </>
      )}
    </nav>
  );
};

export default Navbar; 