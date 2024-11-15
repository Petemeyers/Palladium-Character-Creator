import axios from 'axios';

const API_URL = 'http://localhost:5000/api/characters';

export const getCharacters = async () => {
  try {
    const response = await axios.get(API_URL);
    return response.data;
  } catch (error) {
    console.error("Error fetching characters:", error.message);
    throw error; // Optionally rethrow to handle it elsewhere
  }
};

export const addCharacter = async (character) => {
  try {
    const response = await axios.post(API_URL, character);
    return response.data;
  } catch (error) {
    console.error("Error adding character:", error.message);
    throw error; // Optionally rethrow to handle it elsewhere
  }
};
