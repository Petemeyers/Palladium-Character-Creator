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
  Button,
  Grid,
  GridItem,
  Divider
} from "@chakra-ui/react";
import { getMissileWeapon, getRangeInfo, isMissileWeapon } from "../data/missileWeapons";

/**
 * MissileWeaponTracker Component
 * Tracks ammunition and displays range information for missile weapons in combat
 */
const MissileWeaponTracker = ({ 
  character, 
  ammoCount = {},
  onAmmoChange,
  targetDistance = null,
  isCompact = false
}) => {
  // Find missile weapons in character's inventory
  const missileWeapons = character.inventory?.filter(item => 
    isMissileWeapon(item) || getMissileWeapon(item.name)
  ) || [];

  // Get equipped missile weapon
  const equippedMissile = missileWeapons.find(w => w.name === character.equippedWeapon);
  const weaponData = equippedMissile ? getMissileWeapon(equippedMissile.name) : null;

  if (missileWeapons.length === 0 && !weaponData) {
    return null; // No missile weapons
  }

  // Get current ammo count for equipped weapon
  const currentAmmo = weaponData ? (ammoCount[character._id]?.[weaponData.ammunition] || 0) : 0;
  const maxAmmo = weaponData?.startingAmmo || 20;
  const ammoPercentage = (currentAmmo / maxAmmo) * 100;

  // Calculate range info if target distance provided
  const rangeInfo = targetDistance && weaponData ? getRangeInfo(targetDistance, weaponData) : null;

  // Get ammo color based on remaining
  const getAmmoColor = (percentage) => {
    if (percentage > 50) return "green";
    if (percentage > 25) return "yellow";
    if (percentage > 0) return "orange";
    return "red";
  };

  // Compact view for initiative tracker
  if (isCompact) {
    if (!equippedMissile || !weaponData) return null;

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
          {equippedMissile && (
            <Badge colorScheme="blue" fontSize="xs">
              {equippedMissile.name}
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

            {/* Reload/Replenish Buttons */}
            {onAmmoChange && (
              <HStack spacing={2} mt={2}>
                {currentAmmo > 0 && (
                  <Button 
                    size="xs" 
                    colorScheme="red" 
                    onClick={() => onAmmoChange(character._id, weaponData.ammunition, currentAmmo - 1)}
                    isDisabled={currentAmmo === 0}
                  >
                    Fire (-1)
                  </Button>
                )}
                <Button 
                  size="xs" 
                  colorScheme="blue" 
                  onClick={() => onAmmoChange(character._id, weaponData.ammunition, Math.min(currentAmmo + 10, maxAmmo))}
                  isDisabled={currentAmmo === maxAmmo}
                >
                  Reload (+10)
                </Button>
                <Button 
                  size="xs" 
                  colorScheme="green" 
                  onClick={() => onAmmoChange(character._id, weaponData.ammunition, maxAmmo)}
                  variant="outline"
                >
                  Replenish
                </Button>
              </HStack>
            )}

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
                    const wData = getMissileWeapon(weapon.name);
                    const wAmmo = wData ? (ammoCount[character._id]?.[wData.ammunition] || 0) : 0;
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

