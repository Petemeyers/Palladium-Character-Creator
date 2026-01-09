import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useParty } from '../context/PartyContext';
import '../styles/Navbar.css';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  
  // Safely get activeParty with error handling
  let activeParty = null;
  try {
    const partyContext = useParty();
    activeParty = partyContext.activeParty;
  } catch (error) {
    console.error('Error accessing PartyContext:', error);
  }

  useEffect(() => {
    // Get username from localStorage or token
    const user = localStorage.getItem('username') || 'Player';
    setUsername(user);
  }, []);

  // Close menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [location]);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    navigate('/login');
    closeMenu();
  };

  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/" className="navbar-title" onClick={closeMenu}>
          <span className="navbar-icon">⚔️</span>
        </Link>
      </div>

      {/* User Info Display */}
      <div className="navbar-user-info">
        {activeParty && (
          <span className="active-party-badge">
            👥 {activeParty.name}
          </span>
        )}
        <span className="username-badge">🎭 {username}</span>
      </div>

      {/* Hamburger Menu Button */}
      <button 
        className={`hamburger ${isOpen ? 'open' : ''}`} 
        onClick={toggleMenu} 
        aria-label="Toggle navigation menu"
        aria-expanded={isOpen}
      >
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
      </button>

      {/* Navigation Menu */}
      <div className={`nav-menu ${isOpen ? 'open' : ''}`}>
        {/* Overlay for mobile */}
        {isOpen && <div className="nav-overlay" onClick={closeMenu}></div>}
        
        <div className="nav-menu-content">
          {/* Main Section */}
          <div className="nav-section">
            <h3 className="nav-section-title">Main</h3>
            <Link to="/" className={`nav-link ${isActive('/')}`} onClick={closeMenu}>
              🏠 Home
            </Link>
            <Link to="/gm-panel" className={`nav-link ${isActive('/gm-panel')}`} onClick={closeMenu}>
              🎮 GM Control Panel
            </Link>
            <Link to="/auto-roll-demo" className={`nav-link ${isActive('/auto-roll-demo')}`} onClick={closeMenu}>
              🎲 Auto-Roll Demo
            </Link>
          </div>

          {/* Character Section */}
          <div className="nav-section">
            <h3 className="nav-section-title">Characters</h3>
            <Link to="/character-creation" className={`nav-link ${isActive('/character-creation')}`} onClick={closeMenu}>
              ✨ Create Character
            </Link>
            <Link to="/character-list" className={`nav-link ${isActive('/character-list')}`} onClick={closeMenu}>
              👥 Character List
            </Link>
          </div>

          {/* Party Section */}
          <div className="nav-section">
            <h3 className="nav-section-title">Party</h3>
            <Link to="/party-builder" className={`nav-link ${isActive('/party-builder')}`} onClick={closeMenu}>
              👫 Party Builder
            </Link>
            <Link to="/party-list" className={`nav-link ${isActive('/party-list')}`} onClick={closeMenu}>
              📋 Party List
            </Link>
          </div>

          {/* Combat Section */}
          <div className="nav-section">
            <h3 className="nav-section-title">Combat</h3>
            <Link to="/combat" className={`nav-link ${isActive('/combat')}`} onClick={closeMenu}>
              ⚔️ Combat Arena
            </Link>
            <Link to="/map-maker" className={`nav-link ${isActive('/map-maker')}`} onClick={closeMenu}>
              🗺️ Map Maker
            </Link>
          </div>

          {/* Shopping Section */}
          <div className="nav-section">
            <h3 className="nav-section-title">Shopping</h3>
            <Link to="/trader-shop" className={`nav-link ${isActive('/trader-shop')}`} onClick={closeMenu}>
              🛒 Trader Shop
            </Link>
            <Link to="/weapon-shop" className={`nav-link ${isActive('/weapon-shop')}`} onClick={closeMenu}>
              🗡️ Weapon Shop
            </Link>
            <Link to="/armor-shop" className={`nav-link ${isActive('/armor-shop')}`} onClick={closeMenu}>
              🛡️ Armor Shop
            </Link>
          </div>

          {/* Adventure Section */}
          <div className="nav-section">
            <h3 className="nav-section-title">Adventure</h3>
            <Link to="/chat" className={`nav-link ${isActive('/chat')}`} onClick={closeMenu}>
              🎭 Begin Adventure
            </Link>
            <Link to="/world-map" className={`nav-link ${isActive('/world-map')}`} onClick={closeMenu}>
              🗺️ World Map
            </Link>
            <Link to="/npc-memory" className={`nav-link ${isActive('/npc-memory')}`} onClick={closeMenu}>
              🧠 NPC Memory
            </Link>
          </div>

          {/* Logout */}
          <div className="nav-section nav-section-logout">
            <button 
              className="nav-link logout-btn" 
              onClick={handleLogout}
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 