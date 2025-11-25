import { useState, useEffect, useCallback } from 'react';

/**
 * useArmorDurability Hook
 * Manages armor durability, damage, and repair for Palladium Fantasy RPG armor system
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
      currentSDC: armorData.currentSDC ?? armorData.sdc ?? 100,
      sdc: armorData.sdc || armorData.currentSDC || 100,
      armorRating: armorData.armorRating || armorData.ar || 0,
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
        sdc: armorData.sdc || armorData.currentSDC || prev.sdc,
        currentSDC: armorData.currentSDC ?? prev.currentSDC ?? prev.sdc,
        armorRating: armorData.armorRating || armorData.ar || prev.armorRating,
        weight: armorData.weight || prev.weight,
        price: armorData.price || armorData.value || prev.price,
        originalData: armorData,
      }));
    }
  }, [armorData]);

  // Update broken and encumbered status based on currentSDC
  useEffect(() => {
    if (armor) {
      const percentage = (armor.currentSDC / armor.sdc) * 100;
      const isBroken = armor.currentSDC <= 0;
      const isEncumbered = percentage <= 25 && !isBroken;

      setArmor(prev => ({
        ...prev,
        broken: isBroken,
        encumbered: isEncumbered,
      }));
    }
  }, [armor?.currentSDC, armor?.sdc]);

  /**
   * Apply damage to armor
   * @param {number} damageAmount - Amount of S.D.C. damage to apply
   * @returns {boolean} - True if armor is now broken
   */
  const applyDamage = useCallback((damageAmount) => {
    if (!armor || armor.broken) {
      return armor?.broken || false;
    }

    setArmor(prev => {
      const newSDC = Math.max(0, prev.currentSDC - damageAmount);
      const isNowBroken = newSDC <= 0;

      return {
        ...prev,
        currentSDC: newSDC,
        broken: isNowBroken,
        encumbered: !isNowBroken && (newSDC / prev.sdc) * 100 <= 25,
      };
    });

    const newSDC = Math.max(0, armor.currentSDC - damageAmount);
    const isNowBroken = newSDC <= 0;

    if (onDamageApplied) {
      onDamageApplied(damageAmount, isNowBroken);
    }

    return isNowBroken;
  }, [armor, onDamageApplied]);

  /**
   * Repair armor
   * @param {number} repairAmount - Amount of S.D.C. to restore
   * @param {number} characterGold - Character's available gold
   * @returns {Object} - { success: boolean, cost: number, message: string }
   */
  const repairArmor = useCallback((repairAmount, characterGold = Infinity) => {
    if (!armor) {
      return { success: false, cost: 0, message: 'No armor to repair' };
    }

    if (armor.currentSDC >= armor.sdc) {
      return { success: false, cost: 0, message: 'Armor is already at full S.D.C.' };
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
      const newSDC = Math.min(prev.sdc, prev.currentSDC + repairAmount);
      const percentage = (newSDC / prev.sdc) * 100;

      return {
        ...prev,
        currentSDC: newSDC,
        broken: false,
        encumbered: percentage <= 25,
      };
    });

    if (onRepairApplied) {
      onRepairApplied(repairAmount, cost);
    }

    return { success: true, cost, message: `Repaired ${repairAmount} S.D.C.` };
  }, [armor, onRepairApplied]);

  /**
   * Reset armor to full S.D.C.
   */
  const resetArmor = useCallback(() => {
    if (!armor) return;

    setArmor(prev => ({
      ...prev,
      currentSDC: prev.sdc,
      broken: false,
      encumbered: false,
    }));
  }, [armor]);

  /**
   * Get remaining S.D.C. percentage
   * @returns {number} - Percentage (0-100)
   */
  const getRemainingPercentage = useCallback(() => {
    if (!armor || armor.sdc === 0) return 0;
    return Math.max(0, Math.min(100, (armor.currentSDC / armor.sdc) * 100));
  }, [armor]);

  /**
   * Check if armor can absorb an attack
   * @param {number} damage - Damage amount
   * @returns {boolean} - True if armor can absorb the damage
   */
  const canAbsorbAttack = useCallback((damage) => {
    if (!armor || armor.broken) return false;
    return armor.currentSDC >= damage;
  }, [armor]);

  /**
   * Calculate repair cost
   * Repair cost is typically 1 gp per 10 S.D.C. repaired
   * @param {number} repairAmount - Amount of S.D.C. to repair
   * @returns {number} - Cost in gold pieces
   */
  const calculateRepairCost = useCallback((repairAmount) => {
    // Base cost: 1 gp per 10 S.D.C.
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

    // Heavy damage penalties (25% or less S.D.C.)
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

