import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Image,
  Input,
  Select,
  SimpleGrid,
  Switch,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import {
  BATTLEFIELD_MAP_SOURCES,
  normalizeBattlefieldMap,
} from "../../utils/maps/battlefieldMapAuthority.js";
import {
  deleteBattlefieldMapFromLibrary,
  loadBattlefieldMapLibrary,
  saveBattlefieldMapToLibrary,
} from "../../utils/maps/battlefieldMapLibrary.js";
import {
  BATTLEFIELD_GENERATOR_PRESETS,
  createRandomBattlefieldSeed,
  generateSeededBattlefield,
} from "../../utils/maps/seededBattlefieldGenerator.js";
import { createBuiltInBattlefieldMaps } from "../../data/battlefieldBuiltInMaps.js";
import { launchBattlefieldTestBattle } from "../../utils/maps/battlefieldTestBattle.js";
import {
  describeBattlefieldMap,
  groupBattlefieldLibraryEntries,
} from "../../utils/maps/battlefieldMapUiModel.js";

const MAP_SIZES = Object.freeze([
  { key: "30x20", label: "30 × 20 — Standard", width: 30, height: 20 },
  { key: "40x30", label: "40 × 30 — Large", width: 40, height: 30 },
  { key: "60x40", label: "60 × 40 — Very Large", width: 60, height: 40 },
]);

const FILTERS = Object.freeze([
  ["all", "All"],
  ["builtIn", "Built-in"],
  ["saved", "Saved"],
  ["generated", "Generated"],
  ["imported", "Imported"],
]);

const loadEntries = () => loadBattlefieldMapLibrary({ builtInMaps: createBuiltInBattlefieldMaps() });

function BattlefieldCard({ card, selected, onSelect, onOpen, onDelete }) {
  return (
    <Box
      borderWidth={selected ? "2px" : "1px"}
      borderColor={selected ? "blue.400" : "gray.200"}
      borderRadius="lg"
      overflow="hidden"
      bg={selected ? "blue.50" : "white"}
      cursor="pointer"
      onClick={onSelect}
      transition="all 0.15s ease"
      _hover={{ borderColor: "blue.300", boxShadow: "sm" }}
    >
      {card.thumbnail ? (
        <Image src={card.thumbnail} alt={`${card.name} battlefield preview`} width="100%" height="94px" objectFit="cover" bg="gray.100" />
      ) : (
        <Box height="94px" bg="gray.100" display="flex" alignItems="center" justifyContent="center">
          <Text fontSize="xs" color="gray.500">No preview</Text>
        </Box>
      )}
      <Box p={2.5}>
        <Text fontSize="sm" fontWeight="bold" noOfLines={1}>{card.name}</Text>
        <HStack mt={1} spacing={1} wrap="wrap">
          <Badge fontSize="9px">{card.sourceLabel}</Badge>
          <Badge fontSize="9px" variant="outline">{card.sizeLabel}</Badge>
          {card.seed && <Badge fontSize="9px" colorScheme="purple">Seeded</Badge>}
        </HStack>
        <Text fontSize="10px" color="gray.500" mt={1} noOfLines={2}>
          {card.lightingLabel} · {card.fogLabel}{card.fogOfWarEnabled ? " · Fog of War" : ""}
        </Text>
        <HStack mt={2} spacing={2}>
          <Button size="xs" colorScheme="blue" onClick={(event) => { event.stopPropagation(); onOpen?.(); }}>Open</Button>
          {card.source !== BATTLEFIELD_MAP_SOURCES.BUILT_IN && (
            <Button size="xs" variant="ghost" colorScheme="red" onClick={(event) => { event.stopPropagation(); onDelete?.(); }}>Delete</Button>
          )}
        </HStack>
      </Box>
    </Box>
  );
}

export default function BattlefieldMapManagerPanel({
  getCurrentMap,
  onOpenMap,
  compact = false,
  refreshToken = 0,
}) {
  const toast = useToast();
  const [entries, setEntries] = useState(() => loadEntries());
  const [selectedEntryId, setSelectedEntryId] = useState("");
  const [filter, setFilter] = useState("all");
  const [seed, setSeed] = useState(() => createRandomBattlefieldSeed());
  const [preset, setPreset] = useState("mixed-wilderness");
  const [sizeKey, setSizeKey] = useState("40x30");
  const [balanceMode, setBalanceMode] = useState("natural");
  const [randomizeEnvironment, setRandomizeEnvironment] = useState(false);
  const [generatedPreview, setGeneratedPreview] = useState(null);

  const grouped = useMemo(() => groupBattlefieldLibraryEntries(entries), [entries]);
  const cards = useMemo(() => {
    if (filter !== "all") return grouped[filter] || [];
    return [...grouped.builtIn, ...grouped.saved, ...grouped.generated, ...grouped.imported];
  }, [filter, grouped]);
  const selectedCard = useMemo(
    () => cards.find((card) => String(card.entryId) === String(selectedEntryId))
      || [...grouped.builtIn, ...grouped.saved, ...grouped.generated, ...grouped.imported].find((card) => String(card.entryId) === String(selectedEntryId))
      || null,
    [cards, grouped, selectedEntryId],
  );

  const refresh = useCallback(() => setEntries(loadEntries()), []);
  useEffect(() => { refresh(); }, [refresh, refreshToken]);

  const openMap = useCallback((map) => {
    if (!map || typeof onOpenMap !== "function") return;
    onOpenMap(normalizeBattlefieldMap(map));
  }, [onOpenMap]);

  const handleGenerate = useCallback(() => {
    const size = MAP_SIZES.find((item) => item.key === sizeKey) || MAP_SIZES[1];
    const map = generateSeededBattlefield({
      seed,
      preset,
      width: size.width,
      height: size.height,
      balanceMode,
      randomizeEnvironment,
      fogOfWarEnabled: false,
    });
    setGeneratedPreview(map);
    openMap(map);
    toast({ title: "Seeded battlefield generated", description: `Seed: ${seed}`, status: "success", duration: 1600, isClosable: true });
  }, [balanceMode, openMap, preset, randomizeEnvironment, seed, sizeKey, toast]);

  const handleSaveCurrent = useCallback(() => {
    const current = typeof getCurrentMap === "function" ? getCurrentMap() : null;
    if (!current) return;
    const normalized = normalizeBattlefieldMap({
      ...current,
      source: current.source === BATTLEFIELD_MAP_SOURCES.BUILT_IN ? BATTLEFIELD_MAP_SOURCES.SAVED : (current.source || BATTLEFIELD_MAP_SOURCES.SAVED),
    });
    saveBattlefieldMapToLibrary(normalized);
    refresh();
    toast({ title: "Battlefield saved", status: "success", duration: 1400, isClosable: true });
  }, [getCurrentMap, refresh, toast]);

  const handleSaveGenerated = useCallback(() => {
    if (!generatedPreview) return;
    saveBattlefieldMapToLibrary({ ...generatedPreview, source: BATTLEFIELD_MAP_SOURCES.GENERATED });
    refresh();
    toast({ title: "Generated map saved", description: `Seed ${generatedPreview.generator?.seed || ""}`, status: "success", duration: 1400, isClosable: true });
  }, [generatedPreview, refresh, toast]);

  const handleDelete = useCallback((card) => {
    if (!card || card.source === BATTLEFIELD_MAP_SOURCES.BUILT_IN) return;
    deleteBattlefieldMapFromLibrary(card.entryId);
    if (String(selectedEntryId) === String(card.entryId)) setSelectedEntryId("");
    refresh();
    toast({ title: "Map removed from library", status: "info", duration: 1200, isClosable: true });
  }, [refresh, selectedEntryId, toast]);

  const handleTestBattle = useCallback(() => {
    const current = typeof getCurrentMap === "function" ? getCurrentMap() : null;
    if (current) launchBattlefieldTestBattle(current);
  }, [getCurrentMap]);

  const selectedDescription = selectedCard ? describeBattlefieldMap(selectedCard.map) : null;

  return (
    <Box borderWidth={compact ? "0" : "1px"} borderRadius="lg" p={compact ? 0 : 4} bg="white">
      <VStack align="stretch" spacing={3}>
        {!compact && (
          <Box>
            <Text fontWeight="bold" fontSize="md">Battlefield Library</Text>
            <Text fontSize="sm" color="gray.600">Open a premade map, saved map, or deterministic seeded battlefield.</Text>
          </Box>
        )}

        <HStack spacing={2}>
          <Button size="xs" colorScheme="blue" onClick={handleSaveCurrent}>Save Current</Button>
          <Button size="xs" colorScheme="green" onClick={handleTestBattle}>Test Battle</Button>
        </HStack>

        <Tabs size="sm" variant="enclosed" colorScheme="blue">
          <TabList>
            <Tab>Library</Tab>
            <Tab>Generate</Tab>
          </TabList>
          <TabPanels>
            <TabPanel px={0} pb={0}>
              <HStack spacing={1} mb={3} wrap="wrap">
                {FILTERS.map(([key, label]) => (
                  <Button
                    key={key}
                    size="xs"
                    variant={filter === key ? "solid" : "outline"}
                    colorScheme={filter === key ? "blue" : "gray"}
                    onClick={() => setFilter(key)}
                  >
                    {label}
                  </Button>
                ))}
              </HStack>

              {cards.length ? (
                <SimpleGrid columns={{ base: 1, xl: compact ? 1 : 2 }} spacing={3}>
                  {cards.map((card) => (
                    <BattlefieldCard
                      key={`${card.source}:${card.entryId}`}
                      card={card}
                      selected={String(card.entryId) === String(selectedEntryId)}
                      onSelect={() => setSelectedEntryId(String(card.entryId))}
                      onOpen={() => openMap(card.map)}
                      onDelete={() => handleDelete(card)}
                    />
                  ))}
                </SimpleGrid>
              ) : (
                <Text fontSize="xs" color="gray.500">No maps in this category.</Text>
              )}

              {selectedDescription && (
                <Text fontSize="xs" color="gray.500" mt={3}>
                  {selectedDescription.sizeLabel} {selectedDescription.mapTypeLabel} · {selectedDescription.lightingLabel} · {selectedDescription.fogLabel}
                  {selectedDescription.seed ? ` · Seed ${selectedDescription.seed}` : ""}
                </Text>
              )}
            </TabPanel>

            <TabPanel px={0} pb={0}>
              <VStack align="stretch" spacing={3}>
                <FormControl>
                  <FormLabel fontSize="xs">Seed</FormLabel>
                  <HStack>
                    <Input size="sm" value={seed} onChange={(event) => setSeed(event.target.value)} />
                    <Button size="xs" onClick={() => setSeed(createRandomBattlefieldSeed())}>Random</Button>
                  </HStack>
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="xs">Battlefield style</FormLabel>
                  <Select size="sm" value={preset} onChange={(event) => setPreset(event.target.value)}>
                    {Object.entries(BATTLEFIELD_GENERATOR_PRESETS).map(([key, profile]) => <option key={key} value={key}>{profile.label}</option>)}
                  </Select>
                </FormControl>
                <SimpleGrid columns={2} spacing={2}>
                  <FormControl>
                    <FormLabel fontSize="xs">Map size</FormLabel>
                    <Select size="sm" value={sizeKey} onChange={(event) => setSizeKey(event.target.value)}>
                      {MAP_SIZES.map((size) => <option key={size.key} value={size.key}>{size.label}</option>)}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="xs">Balance</FormLabel>
                    <Select size="sm" value={balanceMode} onChange={(event) => setBalanceMode(event.target.value)}>
                      <option value="natural">Natural</option>
                      <option value="mirrored">Mirrored</option>
                    </Select>
                  </FormControl>
                </SimpleGrid>
                <FormControl display="flex" alignItems="center">
                  <Switch size="sm" isChecked={randomizeEnvironment} onChange={(event) => setRandomizeEnvironment(event.target.checked)} mr={2} />
                  <FormLabel fontSize="xs" mb="0">Randomize weather and lighting from seed</FormLabel>
                </FormControl>
                <HStack>
                  <Button size="sm" colorScheme="purple" onClick={handleGenerate} isDisabled={!seed.trim()}>Generate & Edit</Button>
                  <Button size="sm" variant="outline" onClick={handleSaveGenerated} isDisabled={!generatedPreview}>Save Generated</Button>
                </HStack>
                {generatedPreview && (
                  <Text fontSize="xs" color="gray.500">Same seed, generator version, size, and balance mode reproduce this battlefield.</Text>
                )}
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>
      </VStack>
    </Box>
  );
}
