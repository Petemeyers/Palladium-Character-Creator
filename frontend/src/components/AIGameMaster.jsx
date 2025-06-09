import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AIGameMaster = () => {
    const [sessionId, setSessionId] = useState(null);
    const [context, setContext] = useState('');
    const [playerInput, setPlayerInput] = useState('');
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Initialize game session
    const createSession = async () => {
        try {
            setLoading(true);
            const result = await axios.post('/api/session/create', {
                campaignSettings: {
                    gameSystem: 'Palladium',
                    campaign: 'Default'
                }
            });
            setSessionId(result.data.sessionId);
            setError(null);
        } catch (err) {
            setError('Failed to create game session');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Send player input to AI
    const sendInput = async () => {
        if (!playerInput.trim()) return;

        try {
            setLoading(true);
            const result = await axios.post('/api/game/interact', {
                sessionId,
                playerInput,
                playerState: {
                    context,
                    lastInput: playerInput
                }
            });
            setResponse(result.data.response);
            setPlayerInput('');
            setError(null);
        } catch (err) {
            setError('Failed to get AI response');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Initialize session on component mount
    useEffect(() => {
        if (!sessionId) {
            createSession();
        }
    }, []);

    return (
        <div className="ai-gamemaster-container">
            <h2>Palladium RPG Game Master</h2>
            
            {/* Context Setting */}
            <div className="context-section">
                <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="Set the scene or campaign context..."
                    className="context-input"
                />
                <button 
                    onClick={() => setContext('')}
                    className="clear-button"
                >
                    Clear Context
                </button>
            </div>

            {/* Chat Interface */}
            <div className="chat-interface">
                {response && (
                    <div className="gm-response">
                        <strong>Game Master:</strong>
                        <p>{response}</p>
                    </div>
                )}

                <div className="input-section">
                    <textarea
                        value={playerInput}
                        onChange={(e) => setPlayerInput(e.target.value)}
                        placeholder="What would you like to do?"
                        className="player-input"
                        disabled={loading}
                    />
                    <button 
                        onClick={sendInput}
                        disabled={loading || !playerInput.trim()}
                        className="send-button"
                    >
                        {loading ? 'Thinking...' : 'Send'}
                    </button>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            {/* Optional: Session ID Display for debugging */}
            <div className="debug-info">
                Session ID: {sessionId || 'Creating...'}
            </div>
        </div>
    );
};

export default AIGameMaster; 