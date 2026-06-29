import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Badge, Box, HStack, Heading, Text, VStack } from "@chakra-ui/react";
import { summarizeOriginalTraitAwardProposals } from "../utils/originalActorTraitAwardProposals.js";

export default function ProposedChronicleAwardsPanel({ proposals = [] }) {
  const summaries = useMemo(
    () => summarizeOriginalTraitAwardProposals(proposals),
    [proposals]
  );

  if (summaries.length === 0) return null;

  return (
    <Box as="section" mb={3} pb={3} borderBottomWidth="1px" borderColor="gray.200">
      <Heading size="xs" mb={1}>Proposed Chronicle Awards</Heading>
      <Text fontSize="xs" color="gray.600" mb={3}>
        These are proposed character-history traits from this encounter. They are not applied or saved yet.
      </Text>
      <VStack align="stretch" spacing={2}>
        {summaries.map((summary, index) => (
          <Box
            key={`${summary.actorId || summary.actorName}:${summary.traitId || summary.traitName}:${index}`}
            pb={2}
            borderBottomWidth={index < summaries.length - 1 ? "1px" : "0"}
            borderColor="gray.100"
          >
            <Text fontSize="sm" fontWeight="semibold">{summary.headline}</Text>
            <Text fontSize="xs" color="gray.700">Reason: {summary.reason}</Text>
            <HStack spacing={2} mt={1} wrap="wrap">
              {summary.layer && <Badge colorScheme="blue">Layer: {summary.layer}</Badge>}
              {summary.source && <Badge colorScheme="gray">Source: {summary.source}</Badge>}
              {summary.confidence && <Badge colorScheme="green">Confidence: {summary.confidence}</Badge>}
            </HStack>
          </Box>
        ))}
      </VStack>
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
  })),
};
