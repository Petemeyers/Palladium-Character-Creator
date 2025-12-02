import React from "react";
import { Button, Box, Text, VStack, HStack, Badge, Alert, AlertIcon } from "@chakra-ui/react";

// ===== Helper functions =====
const rollDice = (sides) => Math.floor(Math.random() * sides) + 1;

const getDistance = (pos1, pos2) => {
  if (!pos1 || !pos2 || typeof pos1.x !== 'number' || typeof pos2.x !== 'number') {
    console.warn('getDistance: Invalid position data', { pos1, pos2 });
    return 0;
  }
  return Math.sqrt((pos2.x - pos1.x) ** 2 + (pos2.y - pos1.y) ** 2);
};

const moveToward = (from, to, distance) => {
  if (!from || !to) return from;
  const totalDist = getDistance(from, to);
  if (totalDist === 0) return from;
  const ratio = distance / totalDist;
  return {
    x: from.x + (to.x - from.x) * ratio,
    y: from.y + (to.y - from.y) * ratio,
  };
};

const coordsToString = (pos) => {
  if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') {
    return '(0, 0)';
  }
  return `(${Math.round(pos.x)}, ${Math.round(pos.y)})`;
};

// ===== Component =====
export default function RunActionLogger({ attacker, target, onUpdate, disabled = false }) {
  if (!attacker || !target) return null;
  
  // Check if positions exist and are valid
  if (!attacker.position || !target.position) {
    console.warn('RunActionLogger: Missing position data', { 
      attacker: attacker ? { name: attacker.name, hasPosition: !!attacker.position } : null,
      target: target ? { name: target.name, hasPosition: !!target.position } : null
    });
    return null;
  }

  // Validate position coordinates
  if (typeof attacker.position.x !== 'number' || typeof attacker.position.y !== 'number' ||
      typeof target.position.x !== 'number' || typeof target.position.y !== 'number') {
    console.warn('RunActionLogger: Invalid position coordinates', { 
      attacker: attacker.position, 
      target: target.position 
    });
    return null;
  }

  // --- Movement setup ---
  const speed = attacker.Spd || attacker.spd || attacker.attributes?.Spd || attacker.attributes?.spd || 10;
  const attacksPerMelee = attacker.attacksPerMelee || 1;
  const runPerMelee = speed * 18; // Palladium 1994: Speed × 6 yards = Speed × 18 ft
  const movePerAction = runPerMelee / attacksPerMelee;
  const distance = getDistance(attacker.position, target.position);
  const weaponRange = attacker.weapon?.range || 5;

  // --- Generic updater ---
  const updateLog = (logText, newPos, newActions) => {
    if (!onUpdate) {
      console.warn('RunActionLogger: onUpdate callback not provided');
      return;
    }
    onUpdate({
      ...attacker,
      position: newPos,
      remainingAttacks: newActions,
      log: logText,
    });
  };

  // ===== RUN ACTION =====
  const handleRun = () => {
    if (attacker.remainingAttacks <= 0) return;

    const moveDistance = Math.min(movePerAction, distance);
    const newPos = moveToward(attacker.position, target.position, moveDistance);
    const stillOutOfRange = distance - moveDistance > weaponRange;
    const newActions = attacker.remainingAttacks - 1;

    const log = [
      `🏃 ${attacker.name} uses one action to RUN (Speed ${speed} → ${runPerMelee}ft/melee)`,
      `📍 Moves ${Math.round(moveDistance)}ft toward ${target.name} → new position ${coordsToString(newPos)}`,
      stillOutOfRange
        ? `📍 Still ${Math.round(distance - moveDistance)}ft out of melee range`
        : `⚔️ Now within melee range!`,
      `⏭️ ${attacker.name} has ${newActions} action(s) remaining this melee.`,
    ];

    updateLog(log, newPos, newActions);
  };

  // ===== CHARGE ATTACK =====
  const handleCharge = () => {
    if (attacker.remainingAttacks <= 1) return; // need 2 actions (attack + recovery)
    if (distance < 20 || distance > 60) {
      const msg = `⚠️ ${attacker.name} needs 20–60ft to charge (currently ${Math.round(distance)}ft).`;
      updateLog([msg], attacker.position, attacker.remainingAttacks);
      return;
    }

    const newPos = moveToward(attacker.position, target.position, distance - weaponRange);
    const newActions = attacker.remainingAttacks - 2; // lose next attack
    const strikeRoll = rollDice(20) + 2; // +2 strike for charge
    const damageDie = attacker.weapon?.damageDie || 6;
    const damageRoll = rollDice(damageDie) * 2; // double damage

    const log = [
      `⚡ ${attacker.name} performs a CHARGE ATTACK!`,
      `🏇 Distance covered: ${Math.round(distance)}ft (Speed ${speed})`,
      `🎯 Strike Roll: ${strikeRoll} (+2 for charge)`,
      `💥 Damage: ${damageRoll} (double for charge)`,
      `⚔️ ${attacker.name} slams into ${target.name}!`,
      `⏭️ ${attacker.name} loses next action (now ${newActions} remaining).`,
    ];

    updateLog(log, newPos, newActions);
  };

  const canRun = attacker.remainingAttacks > 0 && !disabled;
  const canCharge = attacker.remainingAttacks > 1 && !disabled && distance >= 20 && distance <= 60;

  return (
    <Box p={3} bg="blue.50" borderRadius="md" border="1px solid" borderColor="blue.200">
      <VStack spacing={3} align="stretch">
        <HStack justify="space-between">
          <Text fontSize="sm" fontWeight="bold" color="blue.700">
            🏃 Movement Actions
          </Text>
          <Badge colorScheme={canRun ? "green" : "red"}>
            {Math.round(movePerAction)}ft
          </Badge>
        </HStack>
        
        <Text fontSize="xs" color="gray.600">
          Speed {speed} × 18 = {runPerMelee}ft/melee ÷ {attacksPerMelee} = {Math.round(movePerAction)}ft/action
        </Text>
        
        <Text fontSize="xs" color="gray.600">
          Distance to {target.name}: {Math.round(distance)}ft
        </Text>

        {/* Charge Range Warning */}
        {distance < 20 && (
          <Alert status="warning" size="sm">
            <AlertIcon />
            <Text fontSize="xs">Too close for charge (need 20-60ft)</Text>
          </Alert>
        )}
        
        {distance > 60 && (
          <Alert status="warning" size="sm">
            <AlertIcon />
            <Text fontSize="xs">Too far for charge (need 20-60ft)</Text>
          </Alert>
        )}

        <HStack spacing={2}>
          <Button
            onClick={handleRun}
            disabled={!canRun}
            colorScheme="blue"
            size="sm"
            variant={canRun ? "solid" : "outline"}
            flex={1}
          >
            🏃 Run ({Math.round(movePerAction)}ft)
          </Button>

          <Button
            onClick={handleCharge}
            disabled={!canCharge}
            colorScheme="red"
            size="sm"
            variant={canCharge ? "solid" : "outline"}
            flex={1}
          >
            ⚡ Charge (+2 strike)
          </Button>
        </HStack>
        
        {!canRun && !canCharge && (
          <Text fontSize="xs" color="red.500" textAlign="center">
            {attacker.remainingAttacks <= 0 ? "No actions remaining" : 
             attacker.remainingAttacks <= 1 ? "Need 2+ actions for charge" : 
             "Action disabled"}
          </Text>
        )}

        {/* Action Requirements */}
        <Box fontSize="xs" color="gray.500" textAlign="center">
          <Text>Run: 1 action | Charge: 2 actions (+2 strike, double damage)</Text>
        </Box>
      </VStack>
    </Box>
  );
}
