import React from 'react';
import { Navigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { isDevAuthBypassEnabled } from '../utils/devAuthBypass';

const PrivateRoute = ({ children }) => {
  if (isDevAuthBypassEnabled()) {
    return children;
  }

  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
};

PrivateRoute.propTypes = {
  children: PropTypes.node.isRequired,
};

export default PrivateRoute; 
