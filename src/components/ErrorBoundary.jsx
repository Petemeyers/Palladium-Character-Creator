import React from 'react';
import { Box, Heading, Text, Button, VStack, Alert, AlertIcon } from '@chakra-ui/react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorId: null 
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Generate unique error ID for tracking
    const errorId = `error_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    
    this.setState({
      error,
      errorInfo,
      errorId
    });

    // Log error to console and localStorage for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Store error in localStorage for debugging
    try {
      const errorLog = JSON.parse(localStorage.getItem('errorLog') || '[]');
      errorLog.push({
        id: errorId,
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        props: this.props,
      });
      
      // Keep only last 20 errors
      if (errorLog.length > 20) {
        errorLog.splice(0, errorLog.length - 20);
      }
      
      localStorage.setItem('errorLog', JSON.stringify(errorLog));
    } catch (e) {
      console.warn('Could not save error to localStorage:', e);
    }

    // In production, this would send to error reporting service
    if (import.meta.env?.PROD || import.meta.env?.MODE === 'production') {
      // Example: send to error reporting service
      // errorReportingService.captureException(error, {
      //   errorId,
      //   componentStack: errorInfo.componentStack,
      //   props: this.props
      // });
    }
  }

  handleRetry = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorId: null 
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      // Default fallback UI
      return (
        <Box p={8} textAlign="center">
          <VStack spacing={4}>
            <Alert status="error" borderRadius="md">
              <AlertIcon />
              <VStack align="start" spacing={2}>
                <Heading size="md">Something went wrong</Heading>
                <Text fontSize="sm">
                  An unexpected error occurred in the application.
                </Text>
                {this.state.errorId && (
                  <Text fontSize="xs" color="gray.500">
                    Error ID: {this.state.errorId}
                  </Text>
                )}
              </VStack>
            </Alert>

            <VStack spacing={2}>
              <Button colorScheme="blue" onClick={this.handleRetry}>
                Try Again
              </Button>
              <Button variant="outline" onClick={this.handleReload}>
                Reload Page
              </Button>
            </VStack>

            {(import.meta.env?.DEV || import.meta.env?.MODE === 'development') && this.state.error && (
              <Box 
                mt={4} 
                p={4} 
                bg="gray.100" 
                borderRadius="md" 
                textAlign="left"
                maxW="600px"
                overflow="auto"
              >
                <Heading size="sm" mb={2}>Error Details (Development Only)</Heading>
                <Text fontSize="xs" color="red.600" mb={2}>
                  <strong>Error:</strong> {this.state.error.message}
                </Text>
                <Text fontSize="xs" color="gray.600" whiteSpace="pre-wrap">
                  <strong>Stack:</strong> {this.state.error.stack}
                </Text>
                {this.state.errorInfo && (
                  <Text fontSize="xs" color="gray.600" whiteSpace="pre-wrap" mt={2}>
                    <strong>Component Stack:</strong> {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </Box>
            )}
          </VStack>
        </Box>
      );
    }

    return this.props.children;
  }
}

// HOC for wrapping components with error boundary
export const withErrorBoundary = (Component, fallback) => {
  return function WrappedComponent(props) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
};

// Specific error boundaries for different parts of the app
export const CharacterErrorBoundary = ({ children }) => (
  <ErrorBoundary 
    fallback={(error, retry) => (
      <Box p={4} textAlign="center">
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <VStack align="start" spacing={2}>
            <Text fontWeight="bold">Character Management Error</Text>
            <Text fontSize="sm">
              There was a problem loading character data. This might be a temporary issue.
            </Text>
            <Button size="sm" colorScheme="blue" onClick={retry}>
              Retry
            </Button>
          </VStack>
        </Alert>
      </Box>
    )}
  >
    {children}
  </ErrorBoundary>
);

export const PartyErrorBoundary = ({ children }) => (
  <ErrorBoundary 
    fallback={(error, retry) => (
      <Box p={4} textAlign="center">
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <VStack align="start" spacing={2}>
            <Text fontWeight="bold">Party Management Error</Text>
            <Text fontSize="sm">
              There was a problem with party data. Please try again.
            </Text>
            <Button size="sm" colorScheme="blue" onClick={retry}>
              Retry
            </Button>
          </VStack>
        </Alert>
      </Box>
    )}
  >
    {children}
  </ErrorBoundary>
);

export const ChatErrorBoundary = ({ children }) => (
  <ErrorBoundary 
    fallback={(error, retry) => (
      <Box p={4} textAlign="center">
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <VStack align="start" spacing={2}>
            <Text fontWeight="bold">Chat Error</Text>
            <Text fontSize="sm">
              There was a problem with the chat system. Your connection might be unstable.
            </Text>
            <Button size="sm" colorScheme="blue" onClick={retry}>
              Retry
            </Button>
          </VStack>
        </Alert>
      </Box>
    )}
  >
    {children}
  </ErrorBoundary>
);

export default ErrorBoundary;
