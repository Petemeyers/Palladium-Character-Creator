import React, { useState, useEffect, useCallback } from 'react';
import useChatAPI from '../hooks/useChatAPI';
import axiosInstance from '../utils/axios';
import { getSkillsForLocation } from '../data/skills';
import { rollDice } from './util';
import { useParty } from '../context/PartyContext';
import PartyChat from './PartyChat';
import '../styles/Chat.css';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedParty, setSelectedParty] = useState(null);
  const [parties, setParties] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [availableSkills, setAvailableSkills] = useState([]);
  const [showSkillRoller, setShowSkillRoller] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState('');
  const { sendMessage, loading, error } = useChatAPI();
  const { activeParty, clearActiveParty, refreshActiveParty, refreshInterval } = useParty();

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
    
    // Check if a location was selected from WorldMap
    const savedLocation = localStorage.getItem('selectedLocation');
    if (savedLocation) {
      try {
        const location = JSON.parse(savedLocation);
        handleLocationSelect(location);
        localStorage.removeItem('selectedLocation'); // Clear after use
      } catch (error) {
        console.error('Error parsing saved location:', error);
      }
    }
  }, [fetchParties]);

  const handleLocationSelect = (location) => {
    setCurrentLocation(location);
    const skills = getSkillsForLocation(location.id);
    setAvailableSkills(skills);
    
    // Add location message to chat
    const locationMessage = {
      id: Date.now(),
      text: `📍 You arrive at ${location.label} in the ${location.region}. ${location.description}`,
      sender: 'system',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, locationMessage]);
  };

  const handleSkillRoll = (skillName, character) => {
    const skill = availableSkills.find(s => s.name === skillName);
    if (!skill) return;

    // Get character's attribute value
    const attributeValue = character.attributes[skill.attribute] || 10;
    
    // Roll d20 for skill check
    const roll = rollDice(20, 1);
    const success = roll <= attributeValue;
    
    const rollMessage = {
      id: Date.now(),
      text: `🎲 ${character.name} rolls ${skillName} (${skill.attribute}: ${attributeValue}): Rolled ${roll} - ${success ? 'SUCCESS!' : 'FAILURE!'}`,
      sender: 'system',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, rollMessage]);
    setShowSkillRoller(false);
  };

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
      <div className="chat-container">
        <div className="chat-header">
          <h2>🗺️ Begin Adventure - Chat & Map System</h2>
          
          {activeParty ? (
            <div className="active-party-info">
              <h3>🎯 Active Party: {activeParty.name}</h3>
              <p>Members: {activeParty.members?.length || 0} characters</p>
              <p>Starting Location: {activeParty.startLocation?.label || "Unknown"} ({activeParty.startLocation?.region || "Unknown Region"})</p>
              <p className="auto-refresh-info">🔄 Auto-refresh every {refreshInterval}s + Party-specific real-time updates</p>
              <div className="party-controls">
                <button
                  className="unload-party-btn"
                  onClick={() => {
                    clearActiveParty();
                    alert("Party unloaded from session!");
                  }}
                >
                  Unload Party
                </button>
                <button
                  className="refresh-party-btn"
                  onClick={() => {
                    refreshActiveParty();
                    alert("Party data refreshed from database!");
                  }}
                >
                  Refresh Party
                </button>
              </div>
            </div>
          ) : (
            <div className="no-active-party">
              <p>⚠️ No active party loaded. Load a party from the Party List to begin your adventure!</p>
              <p>Or select a party below to use temporarily:</p>
            </div>
          )}
          
          {Array.isArray(parties) && parties.length > 0 ? (
            <select 
              value={selectedParty?._id || ''} 
              onChange={(e) => setSelectedParty(parties.find(p => p._id === e.target.value))}
            >
              <option value="">Select a party (temporary)</option>
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

        {currentLocation && (
          <div className="location-info">
            <h3>📍 Current Location: {currentLocation.label}</h3>
            <p><strong>Region:</strong> {currentLocation.region}</p>
            <p><strong>Description:</strong> {currentLocation.description}</p>
            
            {availableSkills.length > 0 && (
              <div className="available-skills">
                <h4>Available Skills:</h4>
                <div className="skills-grid">
                  {availableSkills.map(skill => (
                    <button
                      key={skill.name}
                      className="skill-button"
                      onClick={() => {
                        setSelectedSkill(skill.name);
                        setShowSkillRoller(true);
                      }}
                    >
                      {skill.name} ({skill.attribute})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!currentLocation && selectedParty && (
          <div className="location-prompt">
            <h3>🗺️ Choose Your Starting Location</h3>
            <p>Select a location to begin your adventure!</p>
            <button 
              className="choose-location-btn"
              onClick={() => {
                window.location.href = '/world-map';
              }}
            >
              🗺️ Choose Location
            </button>
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

        {showSkillRoller && selectedParty && selectedSkill && (
          <div className="skill-roller-modal">
            <div className="skill-roller-content">
              <h3>🎲 Roll {selectedSkill}</h3>
              <p>Choose a character to roll this skill:</p>
              <div className="character-selector">
                {selectedParty.members.map(char => (
                  <button
                    key={char._id}
                    className="character-roll-btn"
                    onClick={() => handleSkillRoll(selectedSkill, char)}
                  >
                    {char.name} ({char.attributes[availableSkills.find(s => s.name === selectedSkill)?.attribute] || 10})
                  </button>
                ))}
              </div>
              <button 
                className="close-skill-roller"
                onClick={() => setShowSkillRoller(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Party Chat Section */}
        <PartyChat username="GM" />
      </div>
    </>
  );
};

export default Chat;
