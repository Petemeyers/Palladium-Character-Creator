import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axiosInstance from '../utils/axios';
import { isBackendOffline, isBackendOfflineError, markBackendOffline } from '../utils/backendStatus';

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
  const fetchInFlightRef = useRef(false); // Track if a request is already in flight
  const backendOfflineRef = useRef(false);

  const fetchActiveParty = useCallback(async () => {
    // Deduplication: skip if a request is already in flight
    if (fetchInFlightRef.current) {
      return;
    }

    try {
      fetchInFlightRef.current = true;
      if (backendOfflineRef.current || isBackendOffline()) {
        setActiveParty(null);
        setLoading(false);
        return 'offline';
      }

      const token = localStorage.getItem('token');
      if (!token) {
        setActiveParty(null);
        setLoading(false);
        return 'no-token';
      }

      const response = await axiosInstance.get('/parties/active');
      // Backend now returns null instead of 404 when no party exists
      setActiveParty(response.data || null);
      return 'ok';
    } catch (error) {
      if (isBackendOfflineError(error)) {
        backendOfflineRef.current = true;
        markBackendOffline();
        setActiveParty(null);
        return 'offline';
      }
      // Only log unexpected errors (not 404s since backend now returns 200 with null)
      console.error('Error fetching active party:', error);
      setActiveParty(null);
      return 'error';
    } finally {
      setLoading(false);
      fetchInFlightRef.current = false;
    }
  }, []);

  const refreshActiveParty = useCallback(async () => {
    await fetchActiveParty();
  }, [fetchActiveParty]);

  const clearActiveParty = useCallback(() => {
    setActiveParty(null);
  }, []);

  useEffect(() => {
    let interval = null;
    fetchActiveParty().then((status) => {
      if (status === 'offline') return;

      // Set up refresh interval (every 30 seconds)
      interval = setInterval(() => {
        fetchActiveParty();
      }, 30000);
      setRefreshInterval(interval);
    });

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

