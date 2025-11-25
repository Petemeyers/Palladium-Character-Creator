import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axiosInstance from '../utils/axios';

const PartyContext = createContext();

export const useParty = () => {
  const context = useContext(PartyContext);
  if (!context) {
    throw new Error('useParty must be used within a PartyProvider');
  }
  return context;
};

export const PartyProvider = ({ children }) => {
  const [activeParty, setActiveParty] = useState(null);
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(null);

  const fetchActiveParty = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setActiveParty(null);
        setLoading(false);
        return;
      }

      const response = await axiosInstance.get('/parties/active');
      // Backend now returns null instead of 404 when no party exists
      setActiveParty(response.data || null);
    } catch (error) {
      // Only log unexpected errors (not 404s since backend now returns 200 with null)
      console.error('Error fetching active party:', error);
      setActiveParty(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshActiveParty = useCallback(async () => {
    await fetchActiveParty();
  }, [fetchActiveParty]);

  const clearActiveParty = useCallback(() => {
    setActiveParty(null);
  }, []);

  useEffect(() => {
    fetchActiveParty();

    // Set up refresh interval (every 30 seconds)
    const interval = setInterval(() => {
      fetchActiveParty();
    }, 30000);
    setRefreshInterval(interval);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [fetchActiveParty]);

  const value = {
    activeParty,
    parties,
    setActiveParty,
    setParties,
    loading,
    refreshActiveParty,
    clearActiveParty,
    refreshInterval,
  };

  return <PartyContext.Provider value={value}>{children}</PartyContext.Provider>;
};

export default PartyContext;

