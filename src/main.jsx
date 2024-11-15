import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom'; // Import Router
import App from '../app'; // Import the main App component

const root = ReactDOM.createRoot(document.getElementById('root')); // Create the root
root.render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>
);
