import React from "react";
import PropTypes from "prop-types";
import {
  Box,
  VStack,
  HStack,
  Text,
  Progress,
  Badge,
  Tooltip,
  Alert,
  AlertIcon,
  Grid,
  GridItem,
  Divider
} from "@chakra-ui/react";
import { getMissileWeapon, getRangeInfo } from "../data/missileWeapons";
import { getWeaponByName } from "../data/weapons.js";
import { getInventoryAmmoCount } from "../utils/combatAmmoManager.js";

/**
 * MissileWeaponTracker Component
 * Tracks ammunition and displays range information for missile weapons in combat
 */
const MissileWeaponTracker = ({ 
  character, 
  targetDistance = null,
  isCompact = false
}) => {
  // Helper to get weapon data from either missileWeapons.js or weapons.js
  const getWeaponData = (item) => {
    return getMissileWeapon(item?.name) || getWeaponByName(item?.name) || null;
  };

  // Find missile weapons in character's inventory (from either source)
  const missileWeapons = character.inventory?.filter(item => {
    const w = getWeaponData(item);
    const ammoType = w?.ammunition;
    const hasRange = Number.isFinite(w?.maxRange) || Number.isFinite(w?.range);
    return ammoType && ammoType !== "self" && hasRange;
  }) || [];

  // Get equipped missile weapon
  const equippedItem = character.inventory?.find(w => w.name === character.equippedWeapon);
  const weaponData = equippedItem ? getWeaponData(equippedItem) : null;

  if (missileWeapons.length === 0 && !weaponData) {
    return null; // No missile weapons
  }

  // Normalize range -> maxRange for getRangeInfo()
  const normalizedWeaponData = weaponData ? {
    ...weaponData,
    maxRange: weaponData.maxRange || weaponData.range
  } : null;

  // Get current ammo count from inventory (not separate state)
  const ammoType = weaponData?.ammunition;
  const currentAmmo = ammoType ? getInventoryAmmoCount(character, ammoType) : 0;
  const maxAmmo = weaponData?.startingAmmo || 20;
  const ammoPercentage = maxAmmo > 0 ? (currentAmmo / maxAmmo) * 100 : 0;

  // Calculate range info if target distance provided
  const rangeInfo = targetDistance && normalizedWeaponData ? getRangeInfo(targetDistance, normalizedWeaponData) : null;

  // Get ammo color based on remaining
  const getAmmoColor = (percentage) => {
    if (percentage > 50) return "green";
    if (percentage > 25) return "yellow";
    if (percentage > 0) return "orange";
    return "red";
  };

  // Compact view for initiative tracker
  if (isCompact) {
    if (!equippedItem || !weaponData) return null;

    return (
      <Tooltip label={`${currentAmmo}/${maxAmmo} ${weaponData.ammunition}`} placement="top">
        <HStack spacing={1} fontSize="xs">
          <Text>🏹</Text>
          <Progress 
            value={ammoPercentage} 
            size="sm" 
            width="40px"
            colorScheme={getAmmoColor(ammoPercentage)}
          />
          <Text fontWeight="bold" color={currentAmmo === 0 ? "red.500" : "inherit"}>
            {currentAmmo}
          </Text>
        </HStack>
      </Tooltip>
    );
  }

  // Full detailed view
  return (
    <Box 
      p={3} 
      borderWidth="1px" 
      borderRadius="md" 
      bg="blue.50" 
      _dark={{ bg: "blue.900" }}
    >
      <VStack align="stretch" spacing={3}>
        <HStack justify="space-between">
          <Text fontWeight="bold" fontSize="sm">
            🏹 Missile Weapon Tracker
          </Text>
          {equippedItem && (
            <Badge colorScheme="blue" fontSize="xs">
              {equippedItem.name}
            </Badge>
          )}
        </HStack>

        {weaponData && (
          <>
            {/* Ammunition Display */}
            <Box>
              <HStack justify="space-between" mb={1}>
                <Text fontSize="xs" fontWeight="medium">
                  {weaponData.ammunition}:
                </Text>
                <Text fontSize="xs" fontWeight="bold">
                  {currentAmmo} / {maxAmmo}
                </Text>
              </HStack>
              <Progress 
                value={ammoPercentage} 
                size="sm"
                colorScheme={getAmmoColor(ammoPercentage)}
                hasStripe
                isAnimated={ammoPercentage < 25}
              />
              {currentAmmo === 0 && (
                <Alert status="error" mt={2} size="sm">
                  <AlertIcon />
                  <Text fontSize="xs">Out of ammunition!</Text>
                </Alert>
              )}
              {currentAmmo > 0 && currentAmmo <= 5 && (
                <Alert status="warning" mt={2} size="sm">
                  <AlertIcon />
                  <Text fontSize="xs">Low ammunition!</Text>
                </Alert>
              )}
            </Box>

            <Divider />

            {/* Weapon Stats */}
            <Grid templateColumns="repeat(2, 1fr)" gap={2} fontSize="xs">
              <GridItem>
                <Text color="gray.600">Damage:</Text>
                <Text fontWeight="bold">{weaponData.damage}</Text>
              </GridItem>
              <GridItem>
                <Text color="gray.600">Max Range:</Text>
                <Text fontWeight="bold">{weaponData.maxRange} ft</Text>
              </GridItem>
              <GridItem>
                <Text color="gray.600">Rate of Fire:</Text>
                <Text fontWeight="bold">{weaponData.rateOfFire}/melee</Text>
              </GridItem>
              <GridItem>
                <Text color="gray.600">Category:</Text>
                <Text fontWeight="bold">{weaponData.category}</Text>
              </GridItem>
            </Grid>

            {/* Range Information */}
            {rangeInfo && (
              <>
                <Divider />
                <Box p={2} bg={rangeInfo.category === "OUT_OF_RANGE" ? "red.100" : "green.50"} borderRadius="md">
                  <Text fontSize="xs" fontWeight="bold" mb={1}>
                    Target Range: {targetDistance} ft
                  </Text>
                  <HStack justify="space-between">
                    <Badge 
                      colorScheme={
                        rangeInfo.category === "POINT_BLANK" ? "green" :
                        rangeInfo.category === "SHORT" ? "blue" :
                        rangeInfo.category === "MEDIUM" ? "yellow" :
                        rangeInfo.category === "LONG" ? "orange" : "red"
                      }
                    >
                      {rangeInfo.description}
                    </Badge>
                    {rangeInfo.modifier !== null && (
                      <Text fontSize="xs" fontWeight="bold" color={rangeInfo.modifier >= 0 ? "green.600" : "red.600"}>
                        {rangeInfo.modifier >= 0 ? "+" : ""}{rangeInfo.modifier} to strike
                      </Text>
                    )}
                  </HStack>
                </Box>
              </>
            )}

            {/* Range Brackets */}
            {!rangeInfo && (
              <>
                <Divider />
                <Box fontSize="xs">
                  <Text fontWeight="bold" mb={1}>Range Brackets:</Text>
                  <VStack align="stretch" spacing={1}>
                    <HStack justify="space-between">
                      <Text>Point-Blank (0-10 ft):</Text>
                      <Badge colorScheme="green" size="sm">+2</Badge>
                    </HStack>
                    <HStack justify="space-between">
                      <Text>Short (0-{Math.floor(weaponData.maxRange / 3)} ft):</Text>
                      <Badge colorScheme="blue" size="sm">+0</Badge>
                    </HStack>
                    <HStack justify="space-between">
                      <Text>Medium ({Math.floor(weaponData.maxRange / 3)}-{Math.floor(weaponData.maxRange * 2 / 3)} ft):</Text>
                      <Badge colorScheme="yellow" size="sm">-1</Badge>
                    </HStack>
                    <HStack justify="space-between">
                      <Text>Long ({Math.floor(weaponData.maxRange * 2 / 3)}-{weaponData.maxRange} ft):</Text>
                      <Badge colorScheme="orange" size="sm">-3</Badge>
                    </HStack>
                  </VStack>
                </Box>
              </>
            )}

            {/* Ammo Info Alert (inventory-based, no free reload) */}
            <Alert status="info" mt={2} size="sm">
              <AlertIcon />
              <Text fontSize="xs">
                Ammunition is managed through inventory. Add arrows/bolts/stones to inventory to replenish.
              </Text>
            </Alert>

            {/* Special Notes */}
            {weaponData.special && (
              <Text fontSize="xs" color="purple.600" fontStyle="italic">
                ✨ {weaponData.special}
              </Text>
            )}
          </>
        )}

        {/* All Missile Weapons in Inventory */}
        {missileWeapons.length > 1 && (
          <>
            <Divider />
            <Box>
              <Text fontSize="xs" fontWeight="bold" mb={1}>
                Other Missile Weapons:
              </Text>
              <VStack align="stretch" spacing={1}>
                {missileWeapons
                  .filter(w => w.name !== character.equippedWeapon)
                  .map((weapon, idx) => {
                    const wData = getWeaponData(weapon);
                    const wAmmoType = wData?.ammunition;
                    const wAmmo = wAmmoType ? getInventoryAmmoCount(character, wAmmoType) : 0;
                    return (
                      <HStack key={idx} justify="space-between" fontSize="xs">
                        <Text>{weapon.name}</Text>
                        {wData && (
                          <Badge size="sm">
                            {wAmmo}/{wData.startingAmmo} {wData.ammunition}
                          </Badge>
                        )}
                      </HStack>
                    );
                  })}
              </VStack>
            </Box>
          </>
        )}
      </VStack>
    </Box>
  );
};

MissileWeaponTracker.propTypes = {
  character: PropTypes.object.isRequired,
  ammoCount: PropTypes.object,
  onAmmoChange: PropTypes.func,
  targetDistance: PropTypes.number,
  isCompact: PropTypes.bool
};

export default MissileWeaponTracker;

