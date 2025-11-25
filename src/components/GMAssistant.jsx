import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Heading,
  Textarea,
  Button,
  VStack,
  HStack,
  Text,
  Badge,
  Alert,
  AlertIcon,
  Divider,
  Spinner,
  Code,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  useColorModeValue,
} from '@chakra-ui/react';
import axiosInstance from '../utils/axios';

const GMAssistant = () => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [citations, setCitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [context, setContext] = useState('');
  const [diceResult, setDiceResult] = useState(null);
  const [mapStarts, setMapStarts] = useState([]);
  const textareaRef = useRef(null);

  const bgColor = useColorModeValue('gray.50', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  // Load map starts on component mount
  useEffect(() => {
    fetchMapStarts();
  }, []);

  const fetchMapStarts = async () => {
    try {
      const response = await axiosInstance.get('/gm/map-starts');
      setMapStarts(response.data.starts);
    } catch (err) {
      console.error('Failed to fetch map starts:', err);
    }
  };

  const handleGMQuery = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setResponse('');
    setCitations([]);
    setContext('');

    try {
      const response = await axiosInstance.post('/gm', {
        prompt: prompt.trim(),
      });

      setResponse(response.data.reply);
      setCitations(response.data.citations || []);
      setContext(response.data.context || '');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to get GM response');
      console.error('GM query error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDiceRoll = async (expr = '1d20') => {
    try {
      const response = await axiosInstance.post('/gm/roll', { expr });
      setDiceResult(response.data);
    } catch (err) {
      console.error('Dice roll error:', err);
    }
  };

  const handleRandomStart = async () => {
    try {
      const response = await axiosInstance.get('/gm/map-starts/random');
      const start = response.data.start;
      setPrompt(`We start at: ${start.label}. ${start.scene}`);
    } catch (err) {
      console.error('Random start error:', err);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleGMQuery();
    }
  };

  const quickPrompts = [
    "What armor should a Paladin pick at level 1?",
    "Roll a Fireball at the troll.",
    "We start on a boat—hook us.",
    "Run an ambush with Wolfen scouts.",
    "What weapons can a Wolfen ranger use?",
    "Introduce the party arriving at a coastal village during a storm."
  ];

  return (
    <Box className="container" p={4}>
      <Heading mb={4}>GM Assistant</Heading>
      
      <VStack spacing={4} align="stretch">
        {/* Quick Prompts */}
        <Box>
          <Text fontSize="sm" color="gray.600" mb={2}>Quick Prompts:</Text>
          <HStack wrap="wrap" spacing={2}>
            {quickPrompts.map((quickPrompt, index) => (
              <Button
                key={index}
                size="sm"
                variant="outline"
                onClick={() => setPrompt(quickPrompt)}
              >
                {quickPrompt}
              </Button>
            ))}
          </HStack>
        </Box>

        {/* Input Area */}
        <Box>
          <Textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask the GM anything about rules, combat, spells, or request a scene..."
            rows={3}
            resize="vertical"
          />
          <HStack mt={2} justify="space-between">
            <Text fontSize="xs" color="gray.500">
              Ctrl+Enter to send
            </Text>
            <HStack>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDiceRoll('1d20')}
              >
                Roll 1d20
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDiceRoll('3d6')}
              >
                Roll 3d6
              </Button>
              <Button
                size="sm"
                colorScheme="blue"
                onClick={handleRandomStart}
              >
                Random Start
              </Button>
              <Button
                colorScheme="purple"
                onClick={handleGMQuery}
                isLoading={loading}
                loadingText="Thinking..."
              >
                Ask GM
              </Button>
            </HStack>
          </HStack>
        </Box>

        {/* Dice Result */}
        {diceResult && (
          <Alert status="info">
            <AlertIcon />
            <VStack align="start" spacing={1}>
              <Text fontWeight="bold">
                Dice Roll: {diceResult.total}
              </Text>
              <Text fontSize="sm">
                Parts: [{diceResult.parts.join(', ')}]
                {diceResult.mod !== 0 && ` + ${diceResult.mod}`}
              </Text>
            </VStack>
          </Alert>
        )}

        {/* Error Display */}
        {error && (
          <Alert status="error">
            <AlertIcon />
            {error}
          </Alert>
        )}

        {/* Response */}
        {response && (
          <Box
            p={4}
            bg={bgColor}
            borderRadius="md"
            border="1px"
            borderColor={borderColor}
          >
            <VStack align="stretch" spacing={3}>
              <Text whiteSpace="pre-wrap">{response}</Text>
              
              {citations.length > 0 && (
                <>
                  <Divider />
                  <Box>
                    <Text fontSize="sm" fontWeight="bold" mb={2}>
                      Citations:
                    </Text>
                    <HStack wrap="wrap" spacing={2}>
                      {citations.map((citation, index) => (
                        <Badge key={index} colorScheme="blue" variant="outline">
                          {citation}
                        </Badge>
                      ))}
                    </HStack>
                  </Box>
                </>
              )}
            </VStack>
          </Box>
        )}

        {/* Debug Info (Collapsible) */}
        {context && (
          <Accordion allowToggle>
            <AccordionItem>
              <h2>
                <AccordionButton>
                  <Box flex="1" textAlign="left">
                    <Text fontSize="sm">Debug: Retrieved Context</Text>
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
              </h2>
              <AccordionPanel pb={4}>
                <Code
                  p={2}
                  borderRadius="md"
                  fontSize="xs"
                  whiteSpace="pre-wrap"
                  display="block"
                  bg={bgColor}
                >
                  {context}
                </Code>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        )}

        {/* Map Starts Reference */}
        {mapStarts.length > 0 && (
          <Accordion allowToggle>
            <AccordionItem>
              <h2>
                <AccordionButton>
                  <Box flex="1" textAlign="left">
                    <Text fontSize="sm">Available Starting Locations</Text>
                  </Box>
                  <AccordionIcon />
                </AccordionButton>
              </h2>
              <AccordionPanel pb={4}>
                <VStack align="stretch" spacing={2}>
                  {mapStarts.map((start) => (
                    <Box key={start.id} p={2} bg={bgColor} borderRadius="md">
                      <Text fontWeight="bold">{start.label}</Text>
                      <Text fontSize="sm" color="gray.600">{start.scene}</Text>
                    </Box>
                  ))}
                </VStack>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        )}
      </VStack>
    </Box>
  );
};

export default GMAssistant;

