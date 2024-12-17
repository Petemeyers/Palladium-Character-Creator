import { useState, useEffect } from 'react';
import { localChatModel } from '../utils/localChatModel';

const useChatAPI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const initModel = async () => {
      const success = await localChatModel.initialize();
      setInitialized(success);
    };
    initModel();
  }, []);

  const sendMessage = async (message, character) => {
    if (!initialized) {
      throw new Error('Chat model not initialized');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await localChatModel.getResponse(message, character);
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    sendMessage,
    loading,
    error,
    initialized
  };
};

export default useChatAPI;
