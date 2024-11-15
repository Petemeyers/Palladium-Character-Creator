import React from 'react';
import PropTypes from 'prop-types';

const CopyCharactersButton = ({ characters }) => {
  const handleCopy = () => {
    const formattedCharacters = characters.map(char => ({
      ...char,
      attributes: Object.fromEntries(
        Object.entries(char.attributes)
          .filter(([key]) => !key.endsWith('_highlight'))
      )
    }));
    
    navigator.clipboard.writeText(JSON.stringify(formattedCharacters, null, 2))
      .then(() => {
        alert('Character data copied to clipboard!');
      })
      .catch((err) => {
        console.error('Failed to copy character data: ', err);
      });
  };

  return (
    <button onClick={handleCopy}>
      Copy Character Data
    </button>
  );
};

CopyCharactersButton.propTypes = {
  characters: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      species: PropTypes.string.isRequired,
      class: PropTypes.string.isRequired,
      socialBackground: PropTypes.string.isRequired,
      level: PropTypes.number.isRequired,
      hp: PropTypes.number.isRequired,
      alignment: PropTypes.string.isRequired,
      origin: PropTypes.string.isRequired,
      age: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      disposition: PropTypes.string.isRequired,
      hostility: PropTypes.string.isRequired,
      attributes: PropTypes.object.isRequired,
      _id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    })
  ).isRequired,
};

export default CopyCharactersButton;

// Usage Example
// Assuming you have a "characters" object that represents your character list:
// <CopyCharactersButton characters={characters} />

// In characterList.jsx, add the CopyCharactersButton next to delete button
// Example:
// return (
//   <tr>
//     <td>{character.name}</td>
//     <td>{character.species}</td>
//     <td>{character.socialBackground}</td>
//     <td>{character.level}</td>
//     <td>{character.hp}</td>
//     <td>{character.alignment}</td>
//     <td>{character.origin}</td>
//     <td>{character.age}</td>
//     <td>
//       {character.attributes &&
//         Object.entries(character.attributes).map(([key, value]) => (
//           <div key={key}>{key}: {value}</div>
//         ))}
//     </td>
//     <td>
//       <button onClick={() => onDelete(character._id)}>Delete</button>
//       <CopyCharactersButton characters={[character]} />
//     </td>
//   </tr>
// );
