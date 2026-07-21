import React, { useState } from "react";
import PropTypes from "prop-types";
import { Alert, AlertIcon, Box, Button, HStack, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Text, VStack, Wrap } from "@chakra-ui/react";

const OUTCOMES = [
  ["takePrisoner", "Take prisoner"],
  ["disarmAndRelease", "Disarm and release"],
  ["setRansomDisposition", "Mark for ransom"],
  ["confiscateAndCapture", "Confiscate and capture"],
  ["acceptYieldWithoutCapture", "Accept yield"],
  ["executeSurrenderedOpponent", "Execute"],
];

export default function SurrenderDecisionPanel({ decision, onRespond, onResolve }) {
  const [executionConfirmation, setExecutionConfirmation] = useState(false);
  if (!decision) return null;
  const responsePending = decision.phase === "response";
  const actorName = decision.surrenderingActor?.name || "Opponent";
  return (
    <Modal isOpen closeOnEsc={false} closeOnOverlayClick={false} onClose={() => {}} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{responsePending ? `${actorName} offers surrender` : `Decide ${actorName}'s fate`}</ModalHeader>
        <ModalBody>
          <VStack align="stretch" spacing={3}>
            <Text>{decision.reason || `${actorName} has yielded and awaits your decision.`}</Text>
            {responsePending ? (
              <Alert status="info"><AlertIcon />Combat positions and initiative are preserved while you decide.</Alert>
            ) : executionConfirmation ? (
              <Alert status="error"><AlertIcon />Execution is irreversible and creates a terminal combat result.</Alert>
            ) : (
              <Box><Text fontSize="sm">The surrendered fighter remains alive, conscious, and present in the encounter until this decision resolves.</Text></Box>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          {responsePending ? (
            <HStack>
              <Button colorScheme="green" onClick={() => onRespond("accept")}>Accept surrender</Button>
              <Button colorScheme="red" variant="outline" onClick={() => onRespond("refuse")}>Refuse surrender</Button>
            </HStack>
          ) : executionConfirmation ? (
            <HStack>
              <Button onClick={() => setExecutionConfirmation(false)}>Cancel</Button>
              <Button colorScheme="red" onClick={() => { setExecutionConfirmation(false); onResolve("executeSurrenderedOpponent"); }}>Confirm execution</Button>
            </HStack>
          ) : (
            <Wrap justify="flex-end">
              {OUTCOMES.map(([key, label]) => (
                <Button key={key} size="sm" colorScheme={key === "executeSurrenderedOpponent" ? "red" : "blue"} variant={key === "executeSurrenderedOpponent" ? "outline" : "solid"} onClick={() => key === "executeSurrenderedOpponent" ? setExecutionConfirmation(true) : onResolve(key)}>{label}</Button>
              ))}
            </Wrap>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

SurrenderDecisionPanel.propTypes = {
  decision: PropTypes.shape({ phase: PropTypes.string, reason: PropTypes.string, surrenderingActor: PropTypes.object }),
  onRespond: PropTypes.func.isRequired,
  onResolve: PropTypes.func.isRequired,
};
