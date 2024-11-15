import axios from 'axios';
import { useState } from 'react';

export const useChatAPI = () => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Function to send a message without requiring a token
  const sendMessage = async (message) => {
    if (!message.trim()) return;

    try {
      setIsLoading(true);

      // Send the message to the backend
      const response = await axios.post(
        'http://localhost:5000/chat', // Make sure this matches your backend URL
        { message }
      );

      // Store the bot response along with the user message
      setMessages((prevMessages) => [
        ...prevMessages,
        { sender: 'user', text: message },
        { sender: 'GM', text: response.data.message },
      ]);

      return response.data;
    } catch (error) {
      console.error('Error details:', error); // Log detailed error for debugging

      if (axios.isAxiosError(error)) {
        console.error('Axios Error:', error.response?.data);
        throw new Error(`Chat API Error: ${error.response?.data?.message || error.message}`);
      } else {
        throw new Error('An unexpected error occurred. Please try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return { sendMessage, messages, isLoading };
};
