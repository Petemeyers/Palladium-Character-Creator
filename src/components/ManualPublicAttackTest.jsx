import React, { useMemo, useState } from "react";
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Select,
  Text,
  VStack,
} from "@chakra-ui/react";
import { getEncounterReadinessSummary } from "../utils/publicCombatReadiness.js";
import { resolvePublicBasicAttack } from "../utils/publicBasicAttackResolver.js";

const getId = (combatant, index) =>
  String(combatant?.id || combatant?._id || combatant?.name || index);

const ManualPublicAttackTest = ({ combatants = [] }) => {
  const [attackerId, setAttackerId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [attackIndex, setAttackIndex] = useState("0");
  const [result, setResult] = useState(null);

  const rows = useMemo(() => (
    (Array.isArray(combatants) ? combatants : []).map((combatant, index) => {
      const summary = getEncounterReadinessSummary(combatant);
      return {
        id: getId(combatant, index),
        combatant,
        summary,
      };
    })
  ), [combatants]);

  const attackerRow = rows.find((row) => row.id === attackerId) || null;
  const availableTargets = attackerRow
    ? rows.filter((row) => row.id !== attackerRow.id && row.summary.side !== attackerRow.summary.side)
    : [];
  const targetRow = availableTargets.find((row) => row.id === targetId) || null;
  const attacks = attackerRow?.summary.actionPreviews || [];
  const selectedAttack = attacks[Number(attackIndex)] || null;

  const handleAttackerChange = (value) => {
    setAttackerId(value);
    setTargetId("");
    setAttackIndex("0");
    setResult(null);
  };

  const handleResolve = () => {
    const nextResult = resolvePublicBasicAttack({
      attacker: attackerRow?.combatant,
      target: targetRow?.combatant,
      attack: selectedAttack,
    });
    setResult(nextResult);
  };

  if (rows.length === 0) return null;

  return (
    <Box borderWidth="1px" borderRadius="md" p={3} bg="white">
      <VStack align="stretch" spacing={3}>
        <HStack justify="space-between" align="center" wrap="wrap">
          <Text fontWeight="bold">Manual Public Attack Test</Text>
          <Badge colorScheme="gray">Dry Run</Badge>
        </HStack>

        <HStack align="end" spacing={3} wrap="wrap">
          <FormControl maxW="260px">
            <FormLabel fontSize="xs">Attacker</FormLabel>
            <Select
              size="sm"
              value={attackerId}
              onChange={(event) => handleAttackerChange(event.target.value)}
              placeholder="Select attacker"
            >
              {rows.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.summary.name} ({row.summary.side})
                </option>
              ))}
            </Select>
          </FormControl>

          <FormControl maxW="260px" isDisabled={!attackerRow}>
            <FormLabel fontSize="xs">Target</FormLabel>
            <Select
              size="sm"
              value={targetId}
              onChange={(event) => {
                setTargetId(event.target.value);
                setResult(null);
              }}
              placeholder="Select target"
            >
              {availableTargets.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.summary.name} ({row.summary.side})
                </option>
              ))}
            </Select>
          </FormControl>

          <FormControl maxW="260px" isDisabled={!attackerRow || attacks.length === 0}>
            <FormLabel fontSize="xs">Attack</FormLabel>
            <Select
              size="sm"
              value={attackIndex}
              onChange={(event) => {
                setAttackIndex(event.target.value);
                setResult(null);
              }}
            >
              {attacks.map((attack, index) => (
                <option key={`${attack.name || "attack"}-${index}`} value={String(index)}>
                  {attack.name || "Unnamed attack"}
                </option>
              ))}
            </Select>
          </FormControl>

          <Button
            size="sm"
            colorScheme="purple"
            onClick={handleResolve}
            isDisabled={!attackerRow || !targetRow || !selectedAttack}
          >
            Resolve Basic Attack
          </Button>
        </HStack>

        {attackerRow && attacks.length === 0 && (
          <Text fontSize="xs" color="gray.600">
            No public attack preview available.
          </Text>
        )}

        {result && (
          <Alert status={result.ok ? (result.hit ? "success" : "info") : "warning"} borderRadius="md">
            <AlertIcon />
            <VStack align="start" spacing={1}>
              <Text fontSize="sm" fontWeight="bold">
                {result.hit ? "Hit" : result.ok ? "Miss" : "Cannot Resolve"}
              </Text>
              <Text fontSize="sm">{result.message}</Text>
              {result.ok && (
                <Text fontSize="xs">
                  Roll {result.d20Roll} + {result.attackBonus} = {result.totalToHit}; AC/Guard {result.targetArmor}
                  {result.hit && result.damageTotal !== null ? `; Damage ${result.damageTotal}${result.damageType ? ` ${result.damageType}` : ""}` : ""}
                </Text>
              )}
              {!result.ok && result.missingFields.length > 0 && (
                <Text fontSize="xs">
                  Missing: {result.missingFields.join(", ")}
                </Text>
              )}
              <Text fontSize="xs" color="gray.600">
                Preview only. HP is not changed.
              </Text>
            </VStack>
          </Alert>
        )}
      </VStack>
    </Box>
  );
};

export default ManualPublicAttackTest;
