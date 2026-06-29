import React, { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Box,
  Button,
  Collapse,
  HStack,
  Heading,
  Text,
  VStack,
} from "@chakra-ui/react";
import { summarizeOriginalTraitAwardProposal } from "../utils/originalActorTraitAwardProposals.js";

export default function ProposedChronicleAwardsPanel({
  proposals = [],
  onApply,
  onSave,
  isSaveEligible,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [proposalToSave, setProposalToSave] = useState(null);
  const cancelSaveRef = useRef(null);
  const rows = useMemo(
    () => (Array.isArray(proposals) ? proposals : [])
      .filter((proposal) => proposal && typeof proposal === "object")
      .map((proposal) => ({ proposal, summary: summarizeOriginalTraitAwardProposal(proposal) })),
    [proposals]
  );

  useEffect(() => {
    if (rows.length === 0) setIsExpanded(false);
  }, [rows.length]);

  if (rows.length === 0) return null;

  return (
    <Box as="section" mb={3} pb={3} borderBottomWidth="1px" borderColor="gray.200">
      <HStack justify="space-between" align="center" spacing={3} mb={1}>
        <Heading size="xs">Proposed Chronicle Awards ({rows.length})</Heading>
        <Button
          size="xs"
          variant="outline"
          onClick={() => setIsExpanded((current) => !current)}
          aria-expanded={isExpanded}
          aria-controls="proposed-chronicle-awards-list"
        >
          {isExpanded ? "Hide Awards" : "Show Awards"}
        </Button>
      </HStack>
      {!isExpanded && (
        <Text fontSize="xs" color="gray.600" mb={1}>
          {rows.length} proposed session-only {rows.length === 1 ? "award" : "awards"} available.
        </Text>
      )}
      <Text fontSize="xs" color="gray.600" mb={3}>
        Applied awards affect only the current combat session until explicitly saved. Saved characters are not updated automatically.
      </Text>
      <Collapse in={isExpanded} animateOpacity>
        <VStack
          id="proposed-chronicle-awards-list"
          align="stretch"
          spacing={2}
          maxH="220px"
          overflowY="auto"
          pr={1}
        >
          {rows.map(({ proposal, summary }, index) => {
            const isPending = summary.status === "pending";
            const saveEligible = isSaveEligible?.(proposal) === true;
            const isSaving = proposal.saveStatus === "saving";
            const isSaved = proposal.saveStatus === "saved";
            const saveFailed = proposal.saveStatus === "save_failed";
            const statusLabel = summary.status === "applied"
              ? "Applied this session"
              : summary.status === "already_applied"
                ? "Already applied this session"
                : summary.status === "actor_not_found"
                  ? "Current fighter unavailable"
                  : null;
            return (
            <Box
              key={`${summary.actorId || summary.actorName}:${summary.traitId || summary.traitName}:${index}`}
              pb={2}
              borderBottomWidth={index < rows.length - 1 ? "1px" : "0"}
              borderColor="gray.100"
            >
              <HStack justify="space-between" align="start" spacing={3}>
                <Text fontSize="sm" fontWeight="semibold">{summary.headline}</Text>
                {isPending ? (
                  <Button size="xs" colorScheme="blue" onClick={() => onApply?.(proposal)}>
                    Apply
                  </Button>
                ) : (
                  <Badge colorScheme={summary.status === "actor_not_found" ? "orange" : "green"}>
                    {statusLabel || "Unavailable"}
                  </Badge>
                )}
              </HStack>
              <Text fontSize="xs" color="gray.700">Reason: {summary.reason}</Text>
              {summary.applicationMessage && (
                <Text fontSize="xs" color="gray.600">{summary.applicationMessage}</Text>
              )}
              <HStack spacing={2} mt={1} wrap="wrap">
                {summary.layer && <Badge colorScheme="blue">Layer: {summary.layer}</Badge>}
                {summary.source && <Badge colorScheme="gray">Source: {summary.source}</Badge>}
                {summary.confidence && <Badge colorScheme="green">Confidence: {summary.confidence}</Badge>}
                {isSaved && <Badge colorScheme="teal">Saved to character</Badge>}
              </HStack>
              {saveEligible && !isSaved && (
                <Button
                  size="xs"
                  mt={2}
                  variant="outline"
                  colorScheme={saveFailed ? "orange" : "teal"}
                  isLoading={isSaving}
                  loadingText="Saving"
                  onClick={() => setProposalToSave(proposal)}
                >
                  {saveFailed ? "Retry Save" : "Save to Character"}
                </Button>
              )}
              {proposal.saveMessage && (
                <Text fontSize="xs" mt={1} color={saveFailed ? "orange.700" : "gray.600"}>
                  {proposal.saveMessage}
                </Text>
              )}
            </Box>
            );
          })}
        </VStack>
      </Collapse>
      <AlertDialog
        isOpen={Boolean(proposalToSave)}
        leastDestructiveRef={cancelSaveRef}
        onClose={() => setProposalToSave(null)}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Save Chronicle Award
            </AlertDialogHeader>
            <AlertDialogBody>
              Save {proposalToSave?.traitName || "this award"} to {proposalToSave?.actorName || "this character"}&apos;s saved character record?
              <Text mt={2} fontSize="sm" color="gray.600">
                This permanently adds the trait to the saved character. Combat results and stats will not change.
              </Text>
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelSaveRef} onClick={() => setProposalToSave(null)}>
                Cancel
              </Button>
              <Button
                colorScheme="teal"
                ml={3}
                onClick={() => {
                  const proposal = proposalToSave;
                  setProposalToSave(null);
                  onSave?.(proposal);
                }}
              >
                Confirm Save
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}

ProposedChronicleAwardsPanel.propTypes = {
  proposals: PropTypes.arrayOf(PropTypes.shape({
    actorId: PropTypes.string,
    actorName: PropTypes.string,
    traitId: PropTypes.string,
    traitName: PropTypes.string,
    reason: PropTypes.string,
    layer: PropTypes.string,
    source: PropTypes.string,
    confidence: PropTypes.string,
    status: PropTypes.string,
    appliedAt: PropTypes.number,
    applicationMessage: PropTypes.string,
    saveStatus: PropTypes.string,
    saveMessage: PropTypes.string,
  })),
  onApply: PropTypes.func,
  onSave: PropTypes.func,
  isSaveEligible: PropTypes.func,
};
