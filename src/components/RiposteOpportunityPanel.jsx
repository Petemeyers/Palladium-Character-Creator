import React from "react";
import PropTypes from "prop-types";
import { Alert, AlertIcon, Box, Button, HStack, Text, VStack, Wrap, WrapItem } from "@chakra-ui/react";

const RESPONSE_LABELS = Object.freeze({
  riposte: "Riposte",
  maintain_bind: "Maintain Bind",
  weapon_displacement: "Displace Weapon",
  grapple_entry: "Enter Grapple",
  controlled_disengage: "Step Away",
  shield_pressure: "Shield Pressure",
  decline: "Decline",
});

const RESPONSE_HELP = Object.freeze({
  riposte: "Immediate attack",
  maintain_bind: "Impair the weapon's next attack",
  weapon_displacement: "Impair its next parry",
  grapple_entry: "Make an opposed grapple attempt",
  controlled_disengage: "Move one legal hex",
  shield_pressure: "Impair its next melee attack",
  decline: "Let the opening pass",
});

export default function RiposteOpportunityPanel({
  opportunity,
  onAccept,
  onDecline,
  onChoose,
  isResolving = false,
}) {
  if (!opportunity) return null;
  if (opportunity.opportunityType === "dominant_opening") {
    return (
      <Alert
        status="info"
        position="fixed"
        left="50%"
        bottom="24px"
        transform="translateX(-50%)"
        zIndex={1600}
        maxW="660px"
        boxShadow="xl"
        borderRadius="md"
      >
        <AlertIcon />
        <VStack flex="1" align="stretch" spacing={2}>
          <Box>
            <Text fontWeight="bold">Dominant Opening</Text>
            <Text fontSize="sm">
              Strong opening against {opportunity.targetName}
              {opportunity.defenseLabel ? ` with ${opportunity.defenseLabel}` : ""}.
            </Text>
          </Box>
          <Wrap spacing={2}>
            {(opportunity.legalResponses || []).map((response) => {
              const cost = Number(opportunity.responseCosts?.[response] || 0);
              return (
                <WrapItem key={response}>
                  <Button
                    size="sm"
                    variant={response === "decline" ? "outline" : "solid"}
                    colorScheme={response === "decline" ? "gray" : "blue"}
                    isDisabled={isResolving}
                    title={`${RESPONSE_HELP[response] || RESPONSE_LABELS[response]}${cost ? `, ${cost} stamina` : ""}`}
                    onClick={() => onChoose?.(response)}
                  >
                    {RESPONSE_LABELS[response] || response}
                    {cost ? ` (${cost})` : ""}
                  </Button>
                </WrapItem>
              );
            })}
          </Wrap>
        </VStack>
      </Alert>
    );
  }
  const quality = opportunity.openingLevel >= 2 ? "Strong" : "Moderate";
  return (
    <Alert
      status="info"
      position="fixed"
      left="50%"
      bottom="24px"
      transform="translateX(-50%)"
      zIndex={1600}
      maxW="520px"
      boxShadow="xl"
      borderRadius="md"
    >
      <AlertIcon />
      <Box flex="1">
        <Text fontWeight="bold">Riposte opportunity</Text>
        <Text fontSize="sm">
          {quality} opening against {opportunity.targetName}. Riposte with{" "}
          {opportunity.weaponName} — {opportunity.staminaCost} stamina.
        </Text>
      </Box>
      <HStack ml={3}>
        <Button
          size="sm"
          colorScheme="blue"
          isDisabled={isResolving || opportunity.canAccept === false}
          onClick={onAccept}
        >
          Riposte
        </Button>
        <Button size="sm" variant="outline" isDisabled={isResolving} onClick={onDecline}>
          Decline
        </Button>
      </HStack>
    </Alert>
  );
}

RiposteOpportunityPanel.propTypes = {
  opportunity: PropTypes.shape({
    opportunityType: PropTypes.string,
    openingLevel: PropTypes.number,
    targetName: PropTypes.string,
    defenseLabel: PropTypes.string,
    weaponName: PropTypes.string,
    staminaCost: PropTypes.number,
    canAccept: PropTypes.bool,
    legalResponses: PropTypes.arrayOf(PropTypes.string),
    responseCosts: PropTypes.objectOf(PropTypes.number),
  }),
  onAccept: PropTypes.func.isRequired,
  onDecline: PropTypes.func.isRequired,
  onChoose: PropTypes.func,
  isResolving: PropTypes.bool,
};
