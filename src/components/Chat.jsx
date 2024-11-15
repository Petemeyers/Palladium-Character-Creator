import React, { useState } from 'react';
import axios from 'axios';
import '../app.css';
import { Link } from 'react-router-dom';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <nav className="navbar">
      <div className="logo">MyApp</div>
      <div className="hamburger" onClick={toggleMenu}>
        &#9776; {/* Hamburger icon */}
      </div>
      <ul className={`nav-links ${isOpen ? 'open' : ''}`}>
        <li>
          <Link to="/">Home</Link>
        </li>
        <li>
          <Link to="/chat">Begin Adventure</Link>
        </li>
        <li>
          <Link to="/character-creation">Character Creation</Link>
        </li>
        <li>
          <Link to="/party-builder">Party Builder</Link>
        </li>
        <li>
          <Link to="/character-list">Character List</Link>
        </li>
      </ul>
    </nav>
  );
};

const Chat = () => {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');

  const handleSendMessage = async () => {
    if (!message) return;

    try {
      const res = await axios.post('http://localhost:5000/chat', { message });
      setResponse(res.data.message);
    } catch (error) {
      console.error('Error communicating with OpenAI:', error);
      setResponse('Error communicating with OpenAI. Please try again later.');
    }
  };

  return (
    <div className="chat-container">
      <Navbar />
      <h2>Chat with AI</h2>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your message here..."
      />
      <button onClick={handleSendMessage}>Send</button>
      <div className="chat-response">
        <strong>Response:</strong>
        <p>{response}</p>
      </div>
    </div>
  );
};

export default Chat;
