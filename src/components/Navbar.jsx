import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <nav className="navbar">
      <div className="logo">MyApp</div>
      <div className="hamburger" onClick={toggleMenu}>&#9776;</div>
      <ul className={`nav-links ${isOpen ? 'open' : ''}`}>
        <li><Link to="/">Home</Link></li>
        <li><Link to="/chat">Begin Adventure</Link></li>
        <li><Link to="/character-creation">Character Creation</Link></li>
        <li><Link to="/party-builder">Party Builder</Link></li>
        <li><Link to="/character-list">Character List</Link></li>
      </ul>
    </nav>
  );
};

export default Navbar; 