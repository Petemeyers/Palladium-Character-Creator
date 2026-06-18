import { useState, useEffect, useCallback } from 'react';

/**
 * useArmorDurability Hook
 * Manages armor durability, damage, and repair for Medieval Combat Simulator armor system
 * 
 * @param {Object} armorData - Initial armor data
 * @param {Function} onDamageApplied - Callback when damage is applied
 * @param {Function} onRepairApplied - Callback when repair is applied
 * @returns {Object} Armor state and control functions
 */
export default function useArmorDurability(armorData, onDamageApplied = null, onRepairApplied = null) {
  // Initialize armor state
  const [armor, setArmor] = useState(() => {
    if (!armorData) {
      return null;
    }

    return {
      name: armorData.name || 'Unknown Armor',
      currentarmorDurability: armorData.currentarmorDurability ?? armorData.armorDurability ?? 100,
      armorDurability: armorData.armorDurability || armorData.currentarmorDurability || 100,
      guardRating: armorData.guardRating || armorData.guardRating || 0,
      broken: false,
      encumbered: false,
      weight: armorData.weight || 0,
      price: armorData.price || armorData.value || 0,
      // Preserve original data
      originalData: armorData,
    };
  });

  // Update armor when armorData changes
  useEffect(() => {
    if (armorData) {
      setArmor(prev => ({
        ...prev,
        name: armorData.name || prev.name,
        armorDurability: armorData.armorDurability || armorData.currentarmorDurability || prev.armorDurability,
        currentarmorDurability: armorData.currentarmorDurability ?? prev.currentarmorDurability ?? prev.armorDurability,
        guardRating: armorData.guardRating || armorData.guardRating || prev.guardRating,
        weight: armorData.weight || prev.weight,
        price: armorData.price || armorData.value || prev.price,
        originalData: armorData,
      }));
    }
  }, [armorData]);

  // Update broken and encumbered status based on currentarmorDurability
  useEffect(() => {
    if (armor) {
      const percentage = (armor.currentarmorDurability / armor.armorDurability) * 100;
      const isBroken = armor.currentarmorDurability <= 0;
      const isEncumbered = percentage <= 25 && !isBroken;

      setArmor(prev => ({
        ...prev,
        broken: isBroken,
        encumbered: isEncumbered,
      }));
    }
  }, [armor?.currentarmorDurability, armor?.armorDurability]);

  /**
   * Apply damage to armor
   * @param {number} damageAmount - Amount of armorDurability damage to apply
   * @returns {boolean} - True if armor is now broken
   */
  const applyDamage = useCallback((damageAmount) => {
    if (!armor || armor.broken) {
      return armor?.broken || false;
    }

    setArmor(prev => {
      const newarmorDurability = Math.max(0, prev.currentarmorDurability - damageAmount);
      const isNowBroken = newarmorDurability <= 0;

      return {
        ...prev,
        currentarmorDurability: newarmorDurability,
        broken: isNowBroken,
        encumbered: !isNowBroken && (newarmorDurability / prev.armorDurability) * 100 <= 25,
      };
    });

    const newarmorDurability = Math.max(0, armor.currentarmorDurability - damageAmount);
    const isNowBroken = newarmorDurability <= 0;

    if (onDamageApplied) {
      onDamageApplied(damageAmount, isNowBroken);
    }

    return isNowBroken;
  }, [armor, onDamageApplied]);

  /**
   * Repair armor
   * @param {number} repairAmount - Amount of armorDurability to restore
   * @param {number} characterGold - Character's available gold
   * @returns {Object} - { success: boolean, cost: number, message: string }
   */
  const repairArmor = useCallback((repairAmount, characterGold = Infinity) => {
    if (!armor) {
      return { success: false, cost: 0, message: 'No armor to repair' };
    }

    if (armor.currentarmorDurability >= armor.armorDurability) {
      return { success: false, cost: 0, message: 'Armor is already at full armorDurability' };
    }

    const cost = calculateRepairCost(repairAmount);
    
    if (characterGold < cost) {
      return { 
        success: false, 
        cost, 
        message: `Not enough gold. Need ${cost} gp, have ${characterGold} gp` 
      };
    }

    setArmor(prev => {
      const newarmorDurability = Math.min(prev.armorDurability, prev.currentarmorDurability + repairAmount);
      const percentage = (newarmorDurability / prev.armorDurability) * 100;

      return {
        ...prev,
        currentarmorDurability: newarmorDurability,
        broken: false,
        encumbered: percentage <= 25,
      };
    });

    if (onRepairApplied) {
      onRepairApplied(repairAmount, cost);
    }

    return { success: true, cost, message: `Repaired ${repairAmount} armorDurability` };
  }, [armor, onRepairApplied]);

  /**
   * Reset armor to full armorDurability
   */
  const resetArmor = useCallback(() => {
    if (!armor) return;

    setArmor(prev => ({
      ...prev,
      currentarmorDurability: prev.armorDurability,
      broken: false,
      encumbered: false,
    }));
  }, [armor]);

  /**
   * Get remaining armorDurability percentage
   * @returns {number} - Percentage (0-100)
   */
  const getRemainingPercentage = useCallback(() => {
    if (!armor || armor.armorDurability === 0) return 0;
    return Math.max(0, Math.min(100, (armor.currentarmorDurability / armor.armorDurability) * 100));
  }, [armor]);

  /**
   * Check if armor can absorb an attack
   * @param {number} damage - Damage amount
   * @returns {boolean} - True if armor can absorb the damage
   */
  const canAbsorbAttack = useCallback((damage) => {
    if (!armor || armor.broken) return false;
    return armor.currentarmorDurability >= damage;
  }, [armor]);

  /**
   * Calculate repair cost
   * Repair cost is typically 1 gp per 10 armorDurability repaired
   * @param {number} repairAmount - Amount of armorDurability to repair
   * @returns {number} - Cost in gold pieces
   */
  const calculateRepairCost = useCallback((repairAmount) => {
    // Base cost: 1 gp per 10 armorDurability
    // Minimum cost: 1 gp
    return Math.max(1, Math.ceil(repairAmount / 10));
  }, []);

  /**
   * Get encumbrance information
   * @returns {Object} - { encumbered: boolean, movementPenalty: number, prowlPenalty: number }
   */
  const getEncumbranceInfo = useCallback(() => {
    if (!armor) {
      return { encumbered: false, movementPenalty: 0, prowlPenalty: 0 };
    }

    const percentage = getRemainingPercentage();
    const isEncumbered = percentage <= 25 && !armor.broken;

    if (!isEncumbered) {
      return { encumbered: false, movementPenalty: 0, prowlPenalty: 0 };
    }

    // Heavy damage penalties (25% or less armorDurability)
    // Movement reduced by 25%, Prowl skill reduced by 30%
    return {
      encumbered: true,
      movementPenalty: 25,
      prowlPenalty: 30,
    };
  }, [armor, getRemainingPercentage]);

  return {
    armor,
    applyDamage,
    repairArmor,
    resetArmor,
    getRemainingPercentage,
    canAbsorbAttack,
    calculateRepairCost,
    getEncumbranceInfo,
  };
}

