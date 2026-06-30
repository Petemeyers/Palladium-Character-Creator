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
import {
  applyPostureEffectsToDamage,
  getPostureEffect,
} from "../utils/combatPostureEffects.js";
import { previewWound } from "../utils/combatWounds.js";
import { getWoundRecords } from "../utils/combatWoundRecords.js";
import { validateAttackRange } from "../utils/combatRangeValidation.js";
import { commandBlockedLog } from "../utils/combatCommandLog.js";
import {
  formatRangeModifier,
  getRangedAttackRangeModifier,
} from "../utils/rangedAttackRangeModifier.js";

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
  onCommandLog,
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
  const rangeValidation = validateAttackRange({
    attacker: attackerRow?.combatant,
    target: targetRow?.combatant,
    attack: selectedAttack,
  });
  const attackOutOfRange = rangeValidation.inRange === false;
  const rangedRangeModifier = getRangedAttackRangeModifier({
    actor: attackerRow?.combatant,
    attack: selectedAttack,
    distanceFt: rangeValidation.distanceFt,
    adjacentHostile: Number(rangeValidation.distanceFt) <= 5,
  });
  const attackChoices = attacks.map((attack, index) => {
    const validation = validateAttackRange({
      attacker: attackerRow?.combatant,
      target: targetRow?.combatant,
      attack,
    });
    const ranged = getRangedAttackRangeModifier({
      actor: attackerRow?.combatant,
      attack,
      distanceFt: validation.distanceFt,
      adjacentHostile: Number(validation.distanceFt) <= 5,
    });
    return { attack, index, validation, ranged };
  });
  const targetHpInfo = getPublicCombatHpInfo(targetRow?.combatant || {});
  const targetArmorProfile = getArmorProfile(targetRow?.combatant || {});
  const targetPostureEffect = getPostureEffect(targetRow?.combatant || {});
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
    setAttackIndex("0");
    setResult(null);
  }, [preferredAttackerId, rows]);

  useEffect(() => {
    if (!attackerRow) return;
    if (availableTargets.some((row) => row.id === targetId)) return;
    setTargetId(availableTargets.length === 1 ? availableTargets[0].id : "");
    setResult(null);
  }, [attackerRow?.id, availableTargets, targetId]);

  useEffect(() => {
    if (!attackerRow || attacks.length === 0) return;
    const selectedChoice = attackChoices[Number(attackIndex)];
    if (selectedChoice && selectedChoice.validation.inRange !== false) return;
    const legalChoices = attackChoices.filter((choice) => choice.validation.inRange !== false);
    if (legalChoices.length === 1) setAttackIndex(String(legalChoices[0].index));
  }, [attackChoices, attackIndex, attackerRow, attacks.length]);

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
    if (!attackerRow || !targetRow || !selectedAttack) {
      onCommandLog?.(
        commandBlockedLog({
          action: selectedCombatAction || "Attack",
          reason: "attacker, target, or attack is missing.",
        }),
        "warning"
      );
      return;
    }
    if (attackOutOfRange) {
      onCommandLog?.(
        commandBlockedLog({
          action: selectedCombatAction || "Attack",
          reason: rangeValidation.message || "target out of reach.",
        }),
        "warning"
      );
      return;
    }
    const nextResult = resolvePublicBasicAttack({
      attacker: attackerRow?.combatant,
      target: targetRow?.combatant,
      attack: selectedAttack,
      attackModifier: rangedRangeModifier.isRanged
        ? rangedRangeModifier.finalModifier ?? 0
        : 0,
    });
    if (rangedRangeModifier.isRanged && rangedRangeModifier.canAttack) {
      onCommandLog?.(
        `${attackerRow.summary.name} attacks at ${rangedRangeModifier.bandLabel.toLowerCase()}: ` +
        `${rangedRangeModifier.distanceFt}/${rangedRangeModifier.maxRangeFt} ft, ` +
        `range modifier ${formatRangeModifier(rangedRangeModifier.finalModifier)}.`,
        "info"
      );
    }
    const armorMitigation = nextResult.hit
      ? applyArmorMitigation({
          target: targetRow?.combatant,
          attack: selectedAttack,
          rawDamage: nextResult.damageTotal,
        })
      : null;
    const postureDamage = armorMitigation
      ? applyPostureEffectsToDamage({
          target: targetRow?.combatant,
          rawDamage: armorMitigation.rawDamage,
          armorReduction: armorMitigation.armorReduction,
          finalDamage: armorMitigation.finalDamage,
        })
      : null;
    const woundPreview = armorMitigation
      ? previewWound({
          attack: selectedAttack,
          target: targetRow?.combatant,
          rawDamage: postureDamage.rawDamage,
          armorReduction: postureDamage.armorReduction,
          finalDamage: postureDamage.finalDamage,
        })
      : null;

    setResult({
      ...nextResult,
      armorMitigation,
      postureDamage,
      woundPreview,
      finalDamage: postureDamage?.finalDamage ?? armorMitigation?.finalDamage ?? nextResult.damageTotal,
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
                  {row.summary.name} ({row.summary.side}) - {validateAttackRange({
                    attacker: attackerRow?.combatant,
                    target: row.combatant,
                    attack: selectedAttack,
                  }).distanceFt ?? "?"} ft
                </option>
              ))}
            </Select>
          </FormControl>

          <FormControl flex="1" minW="260px" isDisabled={!attackerRow || attacks.length === 0}>
            <FormLabel fontSize="xs">Weapons</FormLabel>
            <HStack spacing={2} wrap="wrap">
              {attackChoices.map(({ attack, index, validation, ranged }) => {
                const selected = String(index) === attackIndex;
                const unavailable = validation.inRange === false;
                const rangeText = ranged.isRanged
                  ? `${validation.distanceFt ?? "?"} / ${ranged.maxRangeFt ?? "?"} ft - ${ranged.bandLabel}`
                  : unavailable
                    ? "Out of melee range"
                    : `${validation.distanceFt ?? "?"} / ${validation.reachFt ?? "?"} ft - Melee`;
                return (
                  <Button
                    key={`${attack.name || "attack"}-${index}`}
                    size="sm"
                    variant={selected ? "solid" : "outline"}
                    colorScheme={selected ? "purple" : "gray"}
                    onClick={() => {
                      setAttackIndex(String(index));
                      setResult(null);
                    }}
                    isDisabled={unavailable}
                    title={validation.message}
                  >
                    {attack.name || "Unnamed attack"} - {rangeText}
                  </Button>
                );
              })}
            </HStack>
          </FormControl>

          <Button
            size="sm"
            colorScheme="purple"
            onClick={handleResolve}
          >
            {targetRow && selectedAttack
              ? `Attack ${targetRow.summary.name} with ${selectedAttack.name || "selected weapon"}`
              : "Resolve Attack"}
          </Button>
        </HStack>

        {targetRow && (
          <Text fontSize="sm" fontWeight="semibold">
            Target: {targetRow.summary.name} | Distance: {rangeValidation.distanceFt ?? "unknown"} ft
          </Text>
        )}

        {selectedAttack && (
          <Box borderWidth="1px" borderRadius="md" p={2} bg={attackOutOfRange ? "orange.50" : "gray.50"}>
            <VStack align="stretch" spacing={1}>
              <HStack spacing={2} wrap="wrap">
                <Badge colorScheme={rangeValidation.rangeType === "ranged" ? "blue" : rangeValidation.rangeType === "melee" ? "purple" : "gray"}>
                  {rangeValidation.rangeType === "unknown" ? "Range unknown" : rangeValidation.rangeType}
                </Badge>
                <Text fontSize="xs" color="gray.700">
                  Distance: {rangeValidation.distanceFt !== null ? `${rangeValidation.distanceFt} ft` : "unknown"}
                </Text>
                {rangeValidation.reachFt !== null && (
                  <Text fontSize="xs" color="gray.700">
                    Reach: {rangeValidation.reachFt} ft
                  </Text>
                )}
                {rangeValidation.rangeFt !== null && (
                  <Text fontSize="xs" color="gray.700">
                    Range: {rangeValidation.rangeFt} ft
                  </Text>
                )}
                {rangedRangeModifier.isRanged && rangedRangeModifier.canAttack && (
                  <Badge colorScheme="blue">{rangedRangeModifier.bandLabel}</Badge>
                )}
              </HStack>
              <Text fontSize="xs" color={attackOutOfRange ? "orange.700" : "gray.600"}>
                {rangeValidation.message}
              </Text>
              {rangedRangeModifier.isRanged && rangedRangeModifier.canAttack && (
                <Text fontSize="xs" color="gray.700">
                  Base range modifier {formatRangeModifier(rangedRangeModifier.baseModifier)}; Deftness/Awareness control {formatRangeModifier(rangedRangeModifier.controlModifier)}; Final range modifier {formatRangeModifier(rangedRangeModifier.finalModifier)}.
                </Text>
              )}
              {attackOutOfRange && rangeValidation.suggestedAction && (
                <Text fontSize="xs" color="orange.700">
                  Suggestion: {rangeValidation.suggestedAction}
                </Text>
              )}
            </VStack>
          </Box>
        )}

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
          <VStack align="stretch" spacing={1}>
            <Text fontSize="xs" color="gray.600">
              Armor reduction: {targetArmorProfile.reduction} ({targetArmorProfile.source})
            </Text>
            {targetPostureEffect.postureLabel && (
              <Text fontSize="xs" color="blue.700">
                Active target posture: {targetPostureEffect.postureLabel}
                {targetPostureEffect.defenseModifier > 0 ? `; Defense +${targetPostureEffect.defenseModifier}` : ""}
                {targetPostureEffect.damageReduction > 0 ? `; Final damage -${targetPostureEffect.damageReduction}` : ""}
              </Text>
            )}
          </VStack>
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
                  {result.postureEffect?.defenseModifier > 0 && result.baseTargetArmor !== result.targetArmor ? ` (base ${result.baseTargetArmor} + posture ${result.postureEffect.defenseModifier})` : ""}
                  {result.hit && result.damageTotal !== null ? `; Raw damage ${result.damageTotal}${result.damageType ? ` ${result.damageType}` : ""}` : ""}
                </Text>
              )}
              {result.postureEffect?.message && (
                <Text fontSize="xs" color="blue.700">
                  {result.postureEffect.message}
                </Text>
              )}
              {result.hit && result.armorMitigation && (
                <Text fontSize="xs">
                  Raw damage {result.armorMitigation.rawDamage}; Armor reduction {result.armorMitigation.armorReduction}; Final damage after armor {result.armorMitigation.finalDamage}; Final damage {result.finalDamage}
                  {result.armorMitigation.finalDamage === 0 ? "; Armor absorbed the blow." : ""}
                </Text>
              )}
              {result.hit && result.postureDamage?.postureDamageReduction > 0 && (
                <Text fontSize="xs" color="blue.700">
                  {result.postureDamage.message} Final damage after armor and posture: {result.postureDamage.finalDamage}
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
