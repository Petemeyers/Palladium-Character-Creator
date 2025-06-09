import { useState } from 'react';
import axiosInstance from '../utils/axios';

const useChatAPI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sendMessage = async (message, character) => {
    setLoading(true);
    setError(null);

    try {
      const response = await axiosInstance.post('/chat', {
        message,
        character: {
          name: character.name,
          level: character.level,
          class: character.class,
          alignment: character.alignment,
          background: character.background,
          species: character.species,
          attributes: character.attributes
        }
      });

      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send message');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    sendMessage,
    loading,
    error
  };
};

export default useChatAPI;
