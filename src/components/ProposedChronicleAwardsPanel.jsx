import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Badge, Box, Button, Collapse, HStack, Heading, Text, VStack } from "@chakra-ui/react";
import { summarizeOriginalTraitAwardProposal } from "../utils/originalActorTraitAwardProposals.js";

export default function ProposedChronicleAwardsPanel({ proposals = [], onApply }) {
  const [isExpanded, setIsExpanded] = useState(false);
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
        Applied awards affect only the current combat session. Saved characters are not updated yet.
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
              </HStack>
            </Box>
            );
          })}
        </VStack>
      </Collapse>
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
  })),
  onApply: PropTypes.func,
};
