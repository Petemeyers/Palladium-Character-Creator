import React, { useMemo } from "react";
import PropTypes from "prop-types";
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Divider,
  HStack,
  Heading,
  SimpleGrid,
  Text,
  VStack,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import {
  getCurrentAftermathEncounter,
  summarizeAftermathEncounter,
} from "../../utils/aftermath/aftermathAuthority.js";
import {
  getShieldAftermathOptions,
} from "../../utils/aftermath/shieldAftermathAuthority.js";

const triageColor = {
  immediate: "red",
  delayed: "orange",
  minimal: "yellow",
  fit: "green",
  deceased: "gray",
};

const statusColor = {
  dead: "gray",
  acute: "red",
  stabilizing: "orange",
  recovering: "blue",
  "extended-care": "purple",
  "returned-to-duty": "green",
  fit: "green",
};

const formatWound = (wound) => {
  const fracture = wound?.fracture?.present
    ? `; ${wound.fracture.splinted ? "splinted" : "unsplinted"} fracture`
    : "";
  return `${wound?.severity || "unknown"} ${wound?.mechanism || "wound"} — ${wound?.bodyRegion || "unknown location"}${fracture}`;
};

const EmptyAftermath = () => (
  <Alert status="info" borderRadius="md">
    <AlertIcon />
    Finish a battle to open the persistent aftermath record.
  </Alert>
);

const SupplyBar = ({ encounter }) => (
  <Wrap spacing={2}>
    {Object.entries(encounter?.supplies || {}).map(([name, count]) => (
      <WrapItem key={name}>
        <Badge colorScheme={count > 0 ? "blue" : "red"}>
          {name}: {count}
        </Badge>
      </WrapItem>
    ))}
  </Wrap>
);

SupplyBar.propTypes = {
  encounter: PropTypes.object,
};

const CasualtyCard = ({ casualty, onAction, compact = false }) => {
  const hasFracture = casualty.wounds?.some((wound) => wound.fracture?.present && !wound.fracture?.splinted);
  const hasLoot = casualty.equipment?.some((item) => !item.confiscated);
  return (
    <Box borderWidth="1px" borderRadius="md" p={3} bg="white">
      <HStack justify="space-between" align="start" spacing={3}>
        <Box minW={0}>
          <Heading size="xs" noOfLines={1}>{casualty.name}</Heading>
          <Text fontSize="xs" color="gray.600">
            {casualty.side} · {casualty.currentLocation.replaceAll("-", " ")}
          </Text>
        </Box>
        <VStack spacing={1} align="end">
          <Badge colorScheme={triageColor[casualty.triage] || "gray"}>{casualty.triage}</Badge>
          <Badge colorScheme={statusColor[casualty.recoveryStatus] || "gray"}>
            {casualty.recoveryStatus.replaceAll("-", " ")}
          </Badge>
        </VStack>
      </HStack>

      {!compact && (
        <VStack align="stretch" spacing={1} mt={2}>
          <Text fontSize="xs">
            HP at battle end: {casualty.hpAtBattleEnd}/{casualty.maxHpAtBattleEnd} · Shock: {Math.round(casualty.shock)}
          </Text>
          <Text fontSize="xs">
            {casualty.assessed ? casualty.observedSigns.join("; ") : "Not assessed."}
          </Text>
          {(casualty.wounds || []).map((wound) => (
            <Text key={wound.woundId} fontSize="xs" color="gray.700">
              • {formatWound(wound)}
            </Text>
          ))}
          {casualty.complications?.length > 0 && (
            <Text fontSize="xs" color="red.600">
              Complications: {casualty.complications.map((entry) => entry.replaceAll("-", " ")).join(", ")}
            </Text>
          )}
          {casualty.permanentImpairment && (
            <Text fontSize="xs" color="purple.700">
              Long-term risk: {casualty.permanentImpairment.replaceAll("-", " ")}
            </Text>
          )}
        </VStack>
      )}

      <Wrap spacing={2} mt={3}>
        {!casualty.assessed && !casualty.dead && (
          <WrapItem><Button size="xs" onClick={() => onAction(casualty.casualtyId, "assess", casualty.encounterId)}>Assess</Button></WrapItem>
        )}
        {casualty.activeBleeding && !casualty.dead && (
          <WrapItem><Button size="xs" colorScheme="red" onClick={() => onAction(casualty.casualtyId, "stop-bleeding", casualty.encounterId)}>Stop Bleeding</Button></WrapItem>
        )}
        {hasFracture && !casualty.dead && (
          <WrapItem><Button size="xs" colorScheme="orange" onClick={() => onAction(casualty.casualtyId, "splint", casualty.encounterId)}>Splint</Button></WrapItem>
        )}
        {!casualty.dead && casualty.currentLocation === "battlefield" && (
          <WrapItem><Button size="xs" colorScheme="blue" onClick={() => onAction(casualty.casualtyId, "carry", casualty.encounterId)}>Carry to Infirmary</Button></WrapItem>
        )}
        {casualty.prisoner?.eligible && !casualty.prisoner?.bound && !casualty.dead && (
          <WrapItem><Button size="xs" colorScheme="purple" onClick={() => onAction(casualty.casualtyId, "bind-prisoner", casualty.encounterId)}>Bind Prisoner</Button></WrapItem>
        )}
        {hasLoot && (
          <WrapItem><Button size="xs" colorScheme="yellow" onClick={() => onAction(casualty.casualtyId, "confiscate-equipment", casualty.encounterId)}>Confiscate Equipment</Button></WrapItem>
        )}
        {!casualty.dead && (casualty.dying || casualty.unconscious || casualty.prisoner?.bound) && (
          <WrapItem>
            <Button
              size="xs"
              colorScheme="red"
              variant="outline"
              onClick={() => {
                const accepted = typeof window === "undefined" || window.confirm(`Kill incapacitated ${casualty.name}? This is permanent.`);
                if (accepted) onAction(casualty.casualtyId, "coup-de-grace", casualty.encounterId);
              }}
            >
              Coup de Grâce
            </Button>
          </WrapItem>
        )}
      </Wrap>
    </Box>
  );
};

CasualtyCard.propTypes = {
  casualty: PropTypes.object.isRequired,
  onAction: PropTypes.func.isRequired,
  compact: PropTypes.bool,
};

const AftermathOverview = ({ encounter, onAction }) => {
  const summary = summarizeAftermathEncounter(encounter);
  const sorted = [...encounter.casualties].sort((a, b) => {
    const order = { immediate: 0, delayed: 1, minimal: 2, fit: 3, deceased: 4 };
    return (order[a.triage] ?? 9) - (order[b.triage] ?? 9);
  });
  return (
    <VStack align="stretch" spacing={3}>
      <HStack justify="space-between" align="start">
        <Box>
          <Heading size="sm">Battlefield Aftermath</Heading>
          <Text fontSize="xs" color="gray.600">Day {encounter.currentDay} of the first seven-day recovery window</Text>
        </Box>
        <Badge colorScheme="purple">{encounter.phase.replaceAll("-", " ")}</Badge>
      </HStack>
      <Wrap spacing={2}>
        <WrapItem><Badge colorScheme="red">Immediate: {summary.immediate}</Badge></WrapItem>
        <WrapItem><Badge colorScheme="orange">Delayed: {summary.delayed}</Badge></WrapItem>
        <WrapItem><Badge colorScheme="yellow">Minimal: {summary.minimal}</Badge></WrapItem>
        <WrapItem><Badge colorScheme="gray">Dead: {summary.dead}</Badge></WrapItem>
        <WrapItem><Badge colorScheme="purple">Prisoners: {summary.prisoners}</Badge></WrapItem>
      </Wrap>
      <SupplyBar encounter={encounter} />
      <Divider />
      <VStack align="stretch" spacing={2} maxH="430px" overflowY="auto">
        {sorted.map((casualty) => (
          <CasualtyCard key={casualty.casualtyId} casualty={casualty} onAction={onAction} />
        ))}
      </VStack>
    </VStack>
  );
};

const PrisonerView = ({ encounter, onAction }) => {
  const candidates = encounter.casualties.filter((casualty) => casualty.prisoner?.eligible && !casualty.dead);
  return (
    <VStack align="stretch" spacing={3}>
      <Heading size="sm">Prisoners</Heading>
      <Text fontSize="xs" color="gray.600">
        Enemy wounded remain people with casualty records. Binding and confiscation are separate decisions from treatment.
      </Text>
      {candidates.length === 0 ? <Text fontSize="sm">No living prisoner candidates.</Text> : candidates.map((casualty) => (
        <CasualtyCard key={casualty.casualtyId} casualty={casualty} onAction={onAction} />
      ))}
    </VStack>
  );
};

const LootView = ({ encounter, onAction }) => {
  const sources = encounter.casualties.filter((casualty) => casualty.equipment?.some((item) => !item.confiscated));
  return (
    <VStack align="stretch" spacing={3}>
      <Heading size="sm">Loot and Confiscated Equipment</Heading>
      <Text fontSize="xs" color="gray.600">
        Equipment is tied to its owner and is not automatically swept into inventory when combat ends.
      </Text>
      {encounter.lootLedger?.length > 0 && (
        <Box borderWidth="1px" borderRadius="md" p={2}>
          <Text fontSize="xs" fontWeight="bold">Ledger</Text>
          {encounter.lootLedger.map((item, index) => {
            const shieldOptions = getShieldAftermathOptions(item);
            return (
              <Box key={`${item.itemId}:${index}`} py={1}>
                <HStack justify="space-between" align="center" spacing={2}>
                  <Text fontSize="xs">
                    • {item.name} — from {item.ownerName}
                    {item.category === "shield" ? ` · ${item.currentDurability ?? 0}/${item.maxDurability ?? 0} ${item.integrityState || ""}` : ""}
                  </Text>
                  {shieldOptions.length > 0 && (
                    <Wrap spacing={1} justify="flex-end">
                      {shieldOptions.map((option) => (
                        <WrapItem key={option.id}>
                          <Button
                            size="xs"
                            variant="outline"
                            colorScheme={option.id.includes("salvage") ? "orange" : "green"}
                            onClick={() => onAction(item.itemId, option.id, encounter.encounterId)}
                          >
                            {option.label}
                          </Button>
                        </WrapItem>
                      ))}
                    </Wrap>
                  )}
                </HStack>
              </Box>
            );
          })}
        </Box>
      )}
      {sources.length === 0 ? <Text fontSize="sm">No unconfiscated equipment remains.</Text> : sources.map((casualty) => (
        <Box key={casualty.casualtyId} borderWidth="1px" borderRadius="md" p={3}>
          <HStack justify="space-between">
            <Box>
              <Text fontWeight="bold" fontSize="sm">{casualty.name}</Text>
              <Text fontSize="xs">{casualty.equipment.filter((item) => !item.confiscated).map((item) => item.name).join(", ")}</Text>
            </Box>
            <Button size="xs" colorScheme="yellow" onClick={() => onAction(casualty.casualtyId, "confiscate-equipment", casualty.encounterId)}>Confiscate</Button>
          </HStack>
        </Box>
      ))}
    </VStack>
  );
};

const InfirmaryView = ({ campaign, encounter, onAction, onAdvanceDay }) => {
  const openCasualties = useMemo(() => (campaign?.encounters || []).flatMap((entry) =>
    (entry.casualties || [])
      .filter((casualty) => !casualty.dead && !["fit", "returned-to-duty"].includes(casualty.recoveryStatus))
      .map((casualty) => ({ ...casualty, encounterDay: entry.currentDay, sourceEncounterId: entry.encounterId }))
  ), [campaign]);
  return (
    <VStack align="stretch" spacing={3}>
      <HStack justify="space-between">
        <Box>
          <Heading size="sm">Infirmary</Heading>
          <Text fontSize="xs" color="gray.600">Persistent casualties from recorded battles</Text>
        </Box>
        <Button
          size="sm"
          colorScheme="green"
          onClick={onAdvanceDay}
          isDisabled={!encounter || encounter.currentDay >= encounter.maximumSimulatedDay}
        >
          Advance Recovery Day
        </Button>
      </HStack>
      {encounter && (
        <Alert status={encounter.currentDay >= 7 ? "success" : "info"} borderRadius="md">
          <AlertIcon />
          Current battle recovery: day {encounter.currentDay}/{encounter.maximumSimulatedDay}.
        </Alert>
      )}
      <SimpleGrid columns={{ base: 1, xl: 2 }} spacing={2} maxH="430px" overflowY="auto">
        {openCasualties.map((casualty) => (
          <CasualtyCard key={`${casualty.sourceEncounterId}:${casualty.casualtyId}`} casualty={casualty} onAction={onAction} compact={false} />
        ))}
      </SimpleGrid>
      {openCasualties.length === 0 && <Text fontSize="sm">No wounded soldiers currently require care.</Text>}
    </VStack>
  );
};

const AftermathDashboard = ({ campaign, view, onAction, onAdvanceDay }) => {
  const encounter = getCurrentAftermathEncounter(campaign);
  if (!encounter) return <EmptyAftermath />;
  if (view === "prisoners") return <PrisonerView encounter={encounter} onAction={onAction} />;
  if (view === "loot") return <LootView encounter={encounter} onAction={onAction} />;
  if (view === "infirmary") return <InfirmaryView campaign={campaign} encounter={encounter} onAction={onAction} onAdvanceDay={onAdvanceDay} />;
  return <AftermathOverview encounter={encounter} onAction={onAction} />;
};

AftermathDashboard.propTypes = {
  campaign: PropTypes.object,
  view: PropTypes.oneOf(["aftermath", "prisoners", "loot", "infirmary"]).isRequired,
  onAction: PropTypes.func.isRequired,
  onAdvanceDay: PropTypes.func.isRequired,
};

export default AftermathDashboard;
