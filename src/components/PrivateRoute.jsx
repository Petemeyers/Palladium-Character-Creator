import React from 'react';
import { Navigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { isDevAuthBypassEnabled } from '../utils/devAuthBypass';
import { hasStoredAuthToken } from '../utils/authStorage.js';

const PrivateRoute = ({ children, allowWithoutToken = false }) => {
  if (isDevAuthBypassEnabled() || allowWithoutToken) {
    return children;
  }

  return hasStoredAuthToken() ? children : <Navigate to="/login" />;
};

PrivateRoute.propTypes = {
  children: PropTypes.node.isRequired,
  allowWithoutToken: PropTypes.bool,
};

export default PrivateRoute; 
