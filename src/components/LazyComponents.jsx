import React, { Suspense } from 'react';
import { Box, Spinner, Text, VStack } from '@chakra-ui/react';
import ErrorBoundary from './ErrorBoundary';

// Loading component for suspense fallback
const LoadingSpinner = ({ message = "Loading..." }) => (
  <Box display="flex" justifyContent="center" alignItems="center" minH="200px">
    <VStack spacing={4}>
      <Spinner size="xl" color="blue.500" thickness="4px" />
      <Text color="gray.600">{message}</Text>
    </VStack>
  </Box>
);

// Lazy load heavy components
export const LazyCharacterCreator = React.lazy(() => import('./CharacterCreator'));
export const LazyCharacterList = React.lazy(() => import('./CharacterList'));
export const LazyCharacterSheet = React.lazy(() => import('./CharacterSheet'));
export const LazyPartyBuilder = React.lazy(() => import('./PartyBuilder'));
export const LazyPartyList = React.lazy(() => import('./PartyList'));
export const LazyGMControlPanel = React.lazy(() => import('./GMControlPanel'));
export const LazyCombatPanel = React.lazy(() => import('./CombatPanel'));
export const LazyInitiativeTracker = React.lazy(() => import('./InitiativeTracker'));
export const LazyInventoryManager = React.lazy(() => import('./InventoryManager'));
export const LazyEquipmentShop = React.lazy(() => import('./EquipmentShop'));
export const LazyNpcMemoryEditor = React.lazy(() => import('./NpcMemoryEditor'));
export const LazyWorldMap = React.lazy(() => import('./WorldMap'));
export const LazyPartyChat = React.lazy(() => import('./PartyChat'));

// HOC for lazy loading with error boundary and suspense
export const withLazyLoading = (LazyComponent, loadingMessage) => {
  return function LazyWrapper(props) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<LoadingSpinner message={loadingMessage} />}>
          <LazyComponent {...props} />
        </Suspense>
      </ErrorBoundary>
    );
  };
};

// Pre-configured lazy components with loading messages
export const CharacterCreator = withLazyLoading(
  LazyCharacterCreator, 
  "Loading character creator..."
);

export const CharacterList = withLazyLoading(
  LazyCharacterList, 
  "Loading character list..."
);

export const CharacterSheet = withLazyLoading(
  LazyCharacterSheet,
  "Loading character sheet..."
);

export const PartyBuilder = withLazyLoading(
  LazyPartyBuilder, 
  "Loading party builder..."
);

export const PartyList = withLazyLoading(
  LazyPartyList, 
  "Loading party list..."
);

export const GMControlPanel = withLazyLoading(
  LazyGMControlPanel, 
  "Loading GM control panel..."
);

export const CombatPanel = withLazyLoading(
  LazyCombatPanel, 
  "Loading combat panel..."
);

export const InitiativeTracker = withLazyLoading(
  LazyInitiativeTracker, 
  "Loading initiative tracker..."
);

export const InventoryManager = withLazyLoading(
  LazyInventoryManager, 
  "Loading inventory manager..."
);

export const EquipmentShop = withLazyLoading(
  LazyEquipmentShop, 
  "Loading equipment shop..."
);

export const NpcMemoryEditor = withLazyLoading(
  LazyNpcMemoryEditor, 
  "Loading NPC memory editor..."
);

export const WorldMap = withLazyLoading(
  LazyWorldMap, 
  "Loading world map..."
);

export const PartyChat = withLazyLoading(
  LazyPartyChat, 
  "Loading party chat..."
);

// Utility for preloading components (for better UX)
export const preloadComponents = () => {
  // Preload critical components when user is authenticated
  const preloadPromises = [
    import('./CharacterCreator'),
    import('./CharacterList'),
    import('./PartyBuilder'),
    import('./GMControlPanel'),
  ];
  
  return Promise.all(preloadPromises);
};

// Hook for lazy loading with error handling
export const useLazyComponent = (importFn, deps = []) => {
  const [Component, setComponent] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    
    importFn()
      .then((module) => {
        setComponent(() => module.default);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
        console.error('Failed to load component:', err);
      });
  }, deps);

  return { Component, loading, error };
};
