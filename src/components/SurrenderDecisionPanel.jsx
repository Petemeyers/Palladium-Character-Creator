import React, { useState } from "react";
import PropTypes from "prop-types";
import { Alert, AlertIcon, Box, Button, HStack, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Text, VStack, Wrap } from "@chakra-ui/react";
import { getCombatDisplayLabel } from "../utils/presentation/getCombatDisplayLabel.js";

const OUTCOMES = [
  ["takePrisoner", "Take prisoner"],
  ["disarmAndRelease", "Disarm and release"],
  ["setRansomDisposition", "Mark for ransom"],
  ["confiscateAndCapture", "Confiscate and capture"],
  ["acceptYieldWithoutCapture", "Accept yield"],
  ["executeSurrenderedOpponent", "Execute"],
];

export default function SurrenderDecisionPanel({
  decision, onRespond, onResolve, onCopyEntireLog, onDownloadEntireLog,
  isSubmitting = false, submissionError = null, onReturnToCombat,
}) {
  const [executionConfirmation, setExecutionConfirmation] = useState(false);
  if (!decision) return null;
  const responsePending = decision.phase === "response";
  const actorName = decision.surrenderingActor?.name || "Opponent";
  const weaponDisposition = decision.surrenderingActor?.surrenderState?.weaponDisposition;
  return (
    <Modal isOpen closeOnEsc={false} closeOnOverlayClick={false} onClose={() => {}} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{responsePending ? `${actorName} offers surrender` : `Decide ${actorName}'s fate`}</ModalHeader>
        <ModalBody>
          <VStack align="stretch" spacing={3}>
            <Text>{decision.reason || `${actorName} has yielded and awaits your decision.`}</Text>
            {weaponDisposition?.weaponId && (
              <Text fontSize="sm">Surrendered weapon: {getCombatDisplayLabel(weaponDisposition.weaponName || weaponDisposition.weaponId)}</Text>
            )}
            {submissionError && <Alert status="warning"><AlertIcon />{submissionError}</Alert>}
            {responsePending ? (
              <Alert status="info"><AlertIcon />Combat positions and initiative are preserved while you decide.</Alert>
            ) : executionConfirmation ? (
              <Alert status="error"><AlertIcon />Execution is irreversible and creates a terminal combat result.</Alert>
            ) : (
              <Box><Text fontSize="sm">The surrendered fighter remains alive, conscious, and present in the encounter until this decision resolves.</Text></Box>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter display="block">
          <VStack align="stretch" spacing={3}>
            {responsePending ? (
              <HStack justify="flex-end">
                <Button colorScheme="green" isDisabled={isSubmitting} onClick={() => onRespond("accept")}>Accept surrender</Button>
                <Button colorScheme="red" variant="outline" isDisabled={isSubmitting} onClick={() => onRespond("refuse")}>Refuse surrender</Button>
              </HStack>
            ) : executionConfirmation ? (
              <HStack justify="flex-end">
                <Button isDisabled={isSubmitting} onClick={() => setExecutionConfirmation(false)}>Cancel</Button>
                <Button colorScheme="red" isDisabled={isSubmitting} onClick={() => { setExecutionConfirmation(false); onResolve("executeSurrenderedOpponent"); }}>Confirm execution</Button>
              </HStack>
            ) : decision.isPending !== false ? (
              <Wrap justify="flex-end">
                {OUTCOMES.map(([key, label]) => (
                  <Button key={key} size="sm" isDisabled={isSubmitting} colorScheme={key === "executeSurrenderedOpponent" ? "red" : "blue"} variant={key === "executeSurrenderedOpponent" ? "outline" : "solid"} onClick={() => key === "executeSurrenderedOpponent" ? setExecutionConfirmation(true) : onResolve(key)}>{label}</Button>
                ))}
              </Wrap>
            ) : (
              <Button onClick={onReturnToCombat}>Return to combat</Button>
            )}
            <HStack justify="flex-end">
              <Button size="sm" variant="ghost" onClick={onCopyEntireLog}>Copy Entire Log</Button>
              <Button size="sm" variant="ghost" onClick={onDownloadEntireLog}>Download Entire Log</Button>
            </HStack>
          </VStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

SurrenderDecisionPanel.propTypes = {
  decision: PropTypes.shape({ phase: PropTypes.string, reason: PropTypes.string, surrenderingActor: PropTypes.object, isPending: PropTypes.bool }),
  onRespond: PropTypes.func.isRequired,
  onResolve: PropTypes.func.isRequired,
  onCopyEntireLog: PropTypes.func.isRequired,
  onDownloadEntireLog: PropTypes.func.isRequired,
  isSubmitting: PropTypes.bool,
  submissionError: PropTypes.string,
  onReturnToCombat: PropTypes.func,
};
