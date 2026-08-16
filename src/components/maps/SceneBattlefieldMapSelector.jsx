import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  FormControl,
  FormLabel,
  HStack,
  Image,
  Select,
  Switch,
  Text,
  VStack,
} from "@chakra-ui/react";
import {
  BATTLEFIELD_FOG,
  BATTLEFIELD_LIGHTING,
  normalizeBattlefieldMap,
} from "../../utils/maps/battlefieldMapAuthority.js";
import { loadBattlefieldMapLibrary } from "../../utils/maps/battlefieldMapLibrary.js";
import { createBuiltInBattlefieldMaps } from "../../data/battlefieldBuiltInMaps.js";
import {
  clearBattlefieldTestBattleRequest,
  loadBattlefieldTestBattleRequest,
  markBattlefieldTestBattleApplied,
} from "../../utils/maps/battlefieldTestBattle.js";
import { FOG_LABELS, LIGHTING_LABELS, describeBattlefieldMap, groupBattlefieldLibraryEntries } from "../../utils/maps/battlefieldMapUiModel.js";

export default function SceneBattlefieldMapSelector({
  selectedMap,
  onMapChange,
  lighting = BATTLEFIELD_LIGHTING.BRIGHT_DAYLIGHT,
  onLightingChange,
  environmentalFog = BATTLEFIELD_FOG.CLEAR,
  onEnvironmentalFogChange,
  fogOfWarEnabled = false,
  onFogOfWarChange,
}) {
  const [entries] = useState(() => loadBattlefieldMapLibrary({ builtInMaps: createBuiltInBattlefieldMaps() }));
  const consumedTestRequestRef = useRef(false);
  const grouped = useMemo(() => groupBattlefieldLibraryEntries(entries), [entries]);
  const selectedId = selectedMap?.id || "";
  const selectedEntry = entries.find((entry) => String(entry.mapDefinition?.id || entry.id) === String(selectedId)) || null;
  const description = selectedMap ? describeBattlefieldMap(selectedMap) : null;

  useEffect(() => {
    if (consumedTestRequestRef.current) return;
    consumedTestRequestRef.current = true;
    const request = loadBattlefieldTestBattleRequest();
    if (!request?.map) return;
    const map = normalizeBattlefieldMap(request.map);
    if (typeof onMapChange !== "function") return;
    const accepted = onMapChange(map);
    if (accepted === false) return;
    onLightingChange?.(map.environment?.lighting || BATTLEFIELD_LIGHTING.BRIGHT_DAYLIGHT);
    onEnvironmentalFogChange?.(map.environment?.environmentalFog?.type || BATTLEFIELD_FOG.CLEAR);
    onFogOfWarChange?.(map.environment?.fogOfWar?.enabled === true);
    markBattlefieldTestBattleApplied(request);
    queueMicrotask(() => clearBattlefieldTestBattleRequest());
  }, [onEnvironmentalFogChange, onFogOfWarChange, onLightingChange, onMapChange]);

  const selectMap = (entryId) => {
    if (!entryId) {
      onMapChange?.(null);
      return;
    }
    const entry = entries.find((candidate) => String(candidate.id) === String(entryId));
    onMapChange?.(entry?.mapDefinition ? normalizeBattlefieldMap(entry.mapDefinition) : null);
  };

  return (
    <Box borderWidth="1px" borderRadius="md" p={3} bg="gray.50">
      <VStack align="stretch" spacing={3}>
        <Box>
          <Text fontWeight="bold">Battle Map</Text>
          <Text fontSize="xs" color="gray.600">Use the default arena or load a premade/generated map from the Map Maker library.</Text>
        </Box>
        <FormControl>
          <FormLabel fontSize="sm">Map Selection</FormLabel>
          <Select value={selectedId} onChange={(event) => selectMap(event.target.value)}>
            <option value="">Default Arena / Generate From Terrain Below</option>
            {grouped.builtIn.length > 0 && <optgroup label="Built-in Maps">{grouped.builtIn.map((card) => <option key={card.entryId} value={card.entryId}>{card.name}</option>)}</optgroup>}
            {grouped.saved.length > 0 && <optgroup label="Saved Maps">{grouped.saved.map((card) => <option key={card.entryId} value={card.entryId}>{card.name}</option>)}</optgroup>}
            {grouped.generated.length > 0 && <optgroup label="Generated Maps">{grouped.generated.map((card) => <option key={card.entryId} value={card.entryId}>{card.name}</option>)}</optgroup>}
          </Select>
          {description && (
            <HStack mt={2} align="start">
              {selectedEntry?.thumbnail && <Image src={selectedEntry.thumbnail} alt={`${description.name || "Battlefield"} thumbnail`} w="160px" h="90px" objectFit="cover" borderRadius="md" borderWidth="1px" />}
              <Text fontSize="xs" color="gray.600">{description.sizeLabel} {description.mapTypeLabel} • {description.sourceLabel}{description.seed ? ` • Seed ${description.seed}` : ""}</Text>
            </HStack>
          )}
        </FormControl>

        <HStack align="end" spacing={3} wrap="wrap">
          <FormControl minW="190px" flex="1">
            <FormLabel fontSize="sm">Lighting</FormLabel>
            <Select value={lighting} onChange={(event) => onLightingChange?.(event.target.value)}>
              {Object.entries(LIGHTING_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </Select>
          </FormControl>
          <FormControl minW="190px" flex="1">
            <FormLabel fontSize="sm">Environmental Fog</FormLabel>
            <Select value={environmentalFog} onChange={(event) => onEnvironmentalFogChange?.(event.target.value)}>
              {Object.entries(FOG_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </Select>
          </FormControl>
        </HStack>

        <FormControl display="flex" alignItems="center">
          <Switch isChecked={fogOfWarEnabled} onChange={(event) => onFogOfWarChange?.(event.target.checked)} mr={2} />
          <FormLabel mb="0" fontSize="sm">Fog of War</FormLabel>
        </FormControl>
        <Text fontSize="xs" color="gray.600">Environmental fog limits physical visibility. Fog of War controls what each side has discovered; they remain separate settings.</Text>
      </VStack>
    </Box>
  );
}
