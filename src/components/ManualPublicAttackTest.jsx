import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { getPublicCombatHpInfo } from "../utils/publicCombatHp.js";
import { applyArmorMitigation, getArmorProfile } from "../utils/combatArmor.js";
import { previewWound } from "../utils/combatWounds.js";
import { getWoundRecords } from "../utils/combatWoundRecords.js";

const getId = (combatant, index) =>
  String(combatant?.id || combatant?._id || combatant?.name || index);

const ManualPublicAttackTest = ({
  combatants = [],
  onApplyDamage,
  preferredAttackerId = "",
  currentTurnId = "",
  currentTurnActions = null,
  currentTurnStamina = null,
  selectedCombatAction = null,
}) => {
  const [attackerId, setAttackerId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [attackIndex, setAttackIndex] = useState("0");
  const [result, setResult] = useState(null);
  const lastPreferredAttackerId = useRef("");
  const lastSelectedCombatActionId = useRef("");

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
  const targetHpInfo = getPublicCombatHpInfo(targetRow?.combatant || {});
  const targetArmorProfile = getArmorProfile(targetRow?.combatant || {});
  const targetWoundRecords = getWoundRecords(targetRow?.combatant || {});
  const selectedAttackerIsCurrentTurn = currentTurnId && attackerId === String(currentTurnId);
  const currentTurnHasNoActions =
    selectedAttackerIsCurrentTurn &&
    currentTurnActions &&
    Number(currentTurnActions.remainingActions) <= 0;
  const staminaCost = 1;
  const currentTurnHasNoStamina =
    selectedAttackerIsCurrentTurn &&
    currentTurnStamina &&
    Number(currentTurnStamina.currentStamina) <= 0;
  const canApplyDamage =
    typeof onApplyDamage === "function" &&
    result?.hit === true &&
    Number.isFinite(Number(result.damageTotal)) &&
    targetHpInfo.ok &&
    !currentTurnHasNoActions &&
    !currentTurnHasNoStamina &&
    result.applied !== true;

  const handleAttackerChange = (value) => {
    setAttackerId(value);
    setTargetId("");
    setAttackIndex("0");
    setResult(null);
  };

  const normalizeActionName = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/^attack with\s+/, "")
      .replace(/\s+\([^)]*\)$/, "")
      .replace(/[^a-z0-9]+/g, "");

  useEffect(() => {
    if (!preferredAttackerId) return;
    if (lastPreferredAttackerId.current === String(preferredAttackerId)) return;
    const hasPreferredAttacker = rows.some((row) => row.id === String(preferredAttackerId));
    if (!hasPreferredAttacker) return;
    lastPreferredAttackerId.current = String(preferredAttackerId);
    setAttackerId(String(preferredAttackerId));
    setTargetId("");
    setAttackIndex("0");
    setResult(null);
  }, [preferredAttackerId, rows]);

  useEffect(() => {
    if (!selectedCombatAction || selectedCombatAction.type !== "attack") return;
    if (!selectedCombatAction.id || lastSelectedCombatActionId.current === selectedCombatAction.id) return;

    const actorId = String(selectedCombatAction.metadata?.actorId || preferredAttackerId || currentTurnId || "");
    const nextAttackerRow =
      rows.find((row) => row.id === actorId) ||
      rows.find((row) => row.id === String(preferredAttackerId)) ||
      rows.find((row) => row.id === String(currentTurnId));
    if (!nextAttackerRow) return;

    const nextAttacks = nextAttackerRow.summary.actionPreviews || [];
    const catalogAttackName =
      selectedCombatAction.metadata?.attackName ||
      selectedCombatAction.name;
    const normalizedCatalogAttack = normalizeActionName(catalogAttackName);
    const nextAttackIndex = nextAttacks.findIndex((attack) =>
      normalizeActionName(attack?.name || attack?.attackName) === normalizedCatalogAttack
    );
    if (nextAttackIndex < 0) return;

    const nextTargets = rows.filter((row) =>
      row.id !== nextAttackerRow.id && row.summary.side !== nextAttackerRow.summary.side
    );
    const nextTarget = selectedCombatAction.targetId
      ? nextTargets.find((row) => row.id === String(selectedCombatAction.targetId))
      : null;

    lastSelectedCombatActionId.current = selectedCombatAction.id;
    setAttackerId(nextAttackerRow.id);
    if (nextTarget) setTargetId(nextTarget.id);
    setAttackIndex(String(nextAttackIndex));
    setResult(null);
  }, [currentTurnId, preferredAttackerId, rows, selectedCombatAction]);

  const handleResolve = () => {
    const nextResult = resolvePublicBasicAttack({
      attacker: attackerRow?.combatant,
      target: targetRow?.combatant,
      attack: selectedAttack,
    });
    const armorMitigation = nextResult.hit
      ? applyArmorMitigation({
          target: targetRow?.combatant,
          attack: selectedAttack,
          rawDamage: nextResult.damageTotal,
        })
      : null;
    const woundPreview = armorMitigation
      ? previewWound({
          attack: selectedAttack,
          target: targetRow?.combatant,
          rawDamage: armorMitigation.rawDamage,
          armorReduction: armorMitigation.armorReduction,
          finalDamage: armorMitigation.finalDamage,
        })
      : null;

    setResult({
      ...nextResult,
      armorMitigation,
      woundPreview,
      finalDamage: armorMitigation?.finalDamage ?? nextResult.damageTotal,
    });
  };

  const handleApplyDamage = () => {
    if (!canApplyDamage) return;
    const applyResult = onApplyDamage({
      attackerId,
      targetId,
      damageTotal: result.finalDamage ?? result.damageTotal,
      result,
    });

    setResult({
      ...result,
      applied: applyResult?.ok === true,
      applyMessage: applyResult?.message || "Damage application did not complete.",
      applyMissingFields: applyResult?.missingFields || [],
    });
  };

  if (rows.length === 0) return null;

  return (
    <Box borderWidth="1px" borderRadius="md" p={3} bg="white">
      <VStack align="stretch" spacing={3}>
        <HStack justify="space-between" align="center" wrap="wrap">
          <Text fontWeight="bold">Manual Attack Resolver</Text>
          <Badge colorScheme="gray">Preview</Badge>
        </HStack>

        {currentTurnId && attackerId && !selectedAttackerIsCurrentTurn && (
          <Text fontSize="xs" color="orange.700">
            Manual override/test mode: selected attacker is not the current turn combatant.
          </Text>
        )}

        {selectedCombatAction?.type === "attack" && (
          <Text fontSize="xs" color="purple.700">
            Selected from Combat Action Catalog.
          </Text>
        )}

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

        {attackerRow && (
          <Text fontSize="xs" color="gray.600">
            Stamina cost: {staminaCost}
          </Text>
        )}

        {targetRow && (
          <Text fontSize="xs" color="gray.600">
            Armor reduction: {targetArmorProfile.reduction} ({targetArmorProfile.source})
          </Text>
        )}

        {targetRow && targetWoundRecords.length > 0 && (
          <Box borderWidth="1px" borderRadius="md" p={2} bg="gray.50">
            <VStack align="stretch" spacing={1}>
              <Text fontSize="xs" fontWeight="bold">
                Wounds
              </Text>
              {targetWoundRecords.map((wound, index) => (
                <Text key={wound.id || index} fontSize="xs" color="gray.700">
                  {wound.severity} - {wound.location} - {wound.finalDamage} final damage
                </Text>
              ))}
            </VStack>
          </Box>
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
                  {result.hit && result.damageTotal !== null ? `; Raw damage ${result.damageTotal}${result.damageType ? ` ${result.damageType}` : ""}` : ""}
                </Text>
              )}
              {result.hit && result.armorMitigation && (
                <Text fontSize="xs">
                  Raw damage {result.armorMitigation.rawDamage}; Armor reduction {result.armorMitigation.armorReduction}; Final damage {result.armorMitigation.finalDamage}
                  {result.armorMitigation.finalDamage === 0 ? "; Armor absorbed the blow." : ""}
                </Text>
              )}
              {result.hit && result.woundPreview && (
                <Text fontSize="xs">
                  Struck location: {result.woundPreview.location}; Wound severity: {result.woundPreview.severity}
                  {result.woundPreview.note ? `; ${result.woundPreview.note}` : ""}
                </Text>
              )}
              {!result.ok && result.missingFields.length > 0 && (
                <Text fontSize="xs">
                  Missing: {result.missingFields.join(", ")}
                </Text>
              )}
              {result.hit && Number.isFinite(Number(result.damageTotal)) && (
                <HStack spacing={2} wrap="wrap">
                  <Button
                    size="xs"
                    colorScheme="red"
                    onClick={handleApplyDamage}
                    isDisabled={!canApplyDamage}
                  >
                    Apply Damage
                  </Button>
                  {!targetHpInfo.ok && (
                    <Text fontSize="xs" color="orange.700">
                      Missing: {targetHpInfo.missingFields.join(", ")}
                    </Text>
                  )}
                  {currentTurnHasNoActions && (
                    <Text fontSize="xs" color="orange.700">
                      No actions remaining. End Turn manually.
                    </Text>
                  )}
                  {currentTurnHasNoStamina && (
                    <Text fontSize="xs" color="orange.700">
                      No stamina remaining. End Turn manually.
                    </Text>
                  )}
                  {result.applied && (
                    <Badge colorScheme="green">Applied</Badge>
                  )}
                </HStack>
              )}
              {result.applyMessage && (
                <Text fontSize="xs" color={result.applied ? "green.700" : "orange.700"}>
                  {result.applyMessage}
                </Text>
              )}
              <Text fontSize="xs" color="gray.600">
                Resolve is a preview. HP changes only after Apply Damage.
              </Text>
            </VStack>
          </Alert>
        )}
      </VStack>
    </Box>
  );
};

export default ManualPublicAttackTest;
