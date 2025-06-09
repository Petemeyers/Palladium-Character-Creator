import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './Navbar';
import useChatAPI from '../hooks/useChatAPI';
import axiosInstance from '../utils/axios';
import '../styles/Chat.css';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedParty, setSelectedParty] = useState(null);
  const [parties, setParties] = useState([]);
  const { sendMessage, loading, error } = useChatAPI();

  const fetchParties = useCallback(async () => {
    try {
      const response = await axiosInstance.get('/parties');
      if (Array.isArray(response.data)) {
        setParties(response.data);
      } else {
        console.error('Expected array of parties, got:', response.data);
        setParties([]);
      }
    } catch (error) {
      console.error('Error fetching parties:', error);
      setParties([]);
    }
  }, []);

  useEffect(() => {
    fetchParties();
  }, [fetchParties]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedParty) return;

    try {
      const userMessage = {
        id: Date.now(),
        text: inputMessage,
        sender: 'user'
      };
      setMessages(prev => [...prev, userMessage]);
      setInputMessage('');

      // Send message for each character in party
      const partyResponses = await Promise.all(
        selectedParty.members.map(character => 
          sendMessage(inputMessage, character)
        )
      );
      
      // Add each character's response
      partyResponses.forEach((response, index) => {
        const aiMessage = {
          id: Date.now() + index + 1,
          text: `${response.message}`,
          sender: 'ai',
          character: selectedParty.members[index].name
        };
        setMessages(prev => [...prev, aiMessage]);
      });

    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: 'Error: Failed to get response from AI',
        sender: 'error'
      }]);
    }
  };

  const renderCharacterImage = (character) => {
    if (character.imageUrl) {
      return (
        <img 
          src={character.imageUrl} 
          alt={character.name}
          className="character-portrait"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = '/default-character.png'; // Add a default image
          }}
        />
      );
    }
    return <div className="character-portrait placeholder">No Image</div>;
  };

  return (
    <>
      <Navbar />
      <div className="chat-container">
        <div className="chat-header">
          <h2>Begin Adventure</h2>
          {Array.isArray(parties) && parties.length > 0 ? (
            <select 
              value={selectedParty?._id || ''} 
              onChange={(e) => setSelectedParty(parties.find(p => p._id === e.target.value))}
            >
              <option value="">Select a party</option>
              {parties.map(party => (
                <option key={party._id} value={party._id}>
                  {party.name} ({party.members.length} members)
                </option>
              ))}
            </select>
          ) : (
            <p>No parties available. Create one in the Party Builder first!</p>
          )}
        </div>
        
        {selectedParty && (
          <div className="party-info">
            <h3>Party Members:</h3>
            <div className="party-members-grid">
              {selectedParty.members.map(char => (
                <div key={char._id} className="party-member-card">
                  {renderCharacterImage(char)}
                  <div className="character-details">
                    <h4>{char.name}</h4>
                    <p>Level {char.level} {char.class}</p>
                    <p>{char.species}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="chat-messages">
          {messages.map(message => (
            <div 
              key={message.id} 
              className={`message ${message.sender}`}
            >
              {message.text}
            </div>
          ))}
          {loading && <div className="message loading">Thinking...</div>}
          {error && <div className="message error">Error: {error}</div>}
        </div>

        <form onSubmit={handleSendMessage} className="chat-input">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type your message..."
            disabled={!selectedParty || loading}
          />
          <button type="submit" disabled={!selectedParty || loading}>
            {loading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </>
  );
};

export default Chat;
