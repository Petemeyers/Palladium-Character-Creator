// src/components/WeaknessDebugHUD.jsx
/**
 * Weakness Debug HUD Component
 * 
 * Displays AI threat analysis and weakness memory data for debugging.
 * Read-only component that displays data from fighter.meta.aiDebug.
 */

import React from "react";
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Divider,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
} from "@chakra-ui/react";

export default function WeaknessDebugHUD({ fighters = [] }) {
  // Filter to only fighters with AI debug data
  const fightersWithDebug = fighters.filter(
    (f) => f.meta?.aiDebug && Object.keys(f.meta.aiDebug).length > 0
  );

  if (fightersWithDebug.length === 0) {
    return (
      <Box p={3} bg="gray.50" borderRadius="md" borderWidth="1px" borderColor="gray.200">
        <Text fontSize="xs" color="gray.600" fontStyle="italic">
          No AI debug data available. AI spell selection debug info will appear here when enemies cast spells.
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      <Divider my={2} />
      <Text fontSize="sm" fontWeight="bold" mb={2}>
        🧠 AI Threat Analysis & Weakness Memory
      </Text>
      <Accordion allowToggle defaultIndex={[]} size="sm">
        {fightersWithDebug.map((fighter) => {
          const debug = fighter.meta?.aiDebug || {};
          const weaknessMemory = debug.weaknessMemory || {};
          const threatProfile = debug.threatProfile || {};

          return (
            <AccordionItem key={fighter.id}>
              <AccordionButton>
                <Box flex="1" textAlign="left">
                  <HStack>
                    <Text fontSize="xs" fontWeight="bold">
                      {fighter.name}
                    </Text>
                    {debug.casterRole && (
                      <Badge colorScheme="purple" size="xs">
                        {debug.casterRole}
                      </Badge>
                    )}
                    {debug.selectedSpell && (
                      <Badge colorScheme="blue" size="xs">
                        {debug.selectedSpell}
                      </Badge>
                    )}
                  </HStack>
                </Box>
                <AccordionIcon />
              </AccordionButton>
              <AccordionPanel pb={4}>
                <VStack align="stretch" spacing={2} fontSize="xs">
                  {/* Caster Role */}
                  {debug.casterRole && (
                    <Box>
                      <Text fontWeight="bold">🎭 Caster Role:</Text>
                      <Badge colorScheme="purple" size="sm">
                        {debug.casterRole}
                      </Badge>
                    </Box>
                  )}

                  {/* Target Info */}
                  {debug.targetName && (
                    <Box>
                      <Text fontWeight="bold">🎯 Target:</Text>
                      <Text>{debug.targetName}</Text>
                      {debug.distanceFeet !== null && (
                        <Text color="gray.600">{debug.distanceFeet}ft away</Text>
                      )}
                    </Box>
                  )}

                  {/* Selected Spell */}
                  {debug.selectedSpell && (
                    <Box>
                      <Text fontWeight="bold">🔮 Selected Spell:</Text>
                      <Badge colorScheme="blue" size="sm">
                        {debug.selectedSpell}
                      </Badge>
                    </Box>
                  )}

                  {/* Avoided Recent Spells */}
                  {debug.avoidedRecent && debug.avoidedRecent.length > 0 && (
                    <Box>
                      <Text fontWeight="bold">🚫 Avoided (Recent):</Text>
                      <HStack spacing={1} flexWrap="wrap">
                        {debug.avoidedRecent.map((spell, idx) => (
                          <Badge key={idx} colorScheme="red" size="xs">
                            {spell}
                          </Badge>
                        ))}
                      </HStack>
                    </Box>
                  )}

                  {/* Weakness Memory */}
                  {weaknessMemory && (
                    <Box>
                      <Text fontWeight="bold">💡 Weakness Memory:</Text>
                      <VStack align="stretch" spacing={1} pl={2}>
                        {/* Confirmed Weaknesses */}
                        {weaknessMemory.confirmed && weaknessMemory.confirmed.length > 0 && (
                          <Box>
                            <Text fontSize="xs" fontWeight="semibold" color="green.600">
                              ✅ Confirmed:
                            </Text>
                            <HStack spacing={1} flexWrap="wrap">
                              {weaknessMemory.confirmed.map((weakness, idx) => (
                                <Badge key={idx} colorScheme="green" size="xs">
                                  {weakness}
                                </Badge>
                              ))}
                            </HStack>
                          </Box>
                        )}

                        {/* Suspected Weaknesses */}
                        {weaknessMemory.suspected && weaknessMemory.suspected.length > 0 && (
                          <Box>
                            <Text fontSize="xs" fontWeight="semibold" color="yellow.600">
                              🟨 Suspected:
                            </Text>
                            <HStack spacing={1} flexWrap="wrap">
                              {weaknessMemory.suspected.map((weakness, idx) => (
                                <Badge key={idx} colorScheme="yellow" size="xs">
                                  {weakness}
                                </Badge>
                              ))}
                            </HStack>
                          </Box>
                        )}

                        {/* Disproven Weaknesses */}
                        {weaknessMemory.disproven && weaknessMemory.disproven.length > 0 && (
                          <Box>
                            <Text fontSize="xs" fontWeight="semibold" color="red.600">
                              ❌ Disproven:
                            </Text>
                            <HStack spacing={1} flexWrap="wrap">
                              {weaknessMemory.disproven.map((weakness, idx) => (
                                <Badge key={idx} colorScheme="red" size="xs">
                                  {weakness}
                                </Badge>
                              ))}
                            </HStack>
                          </Box>
                        )}

                        {/* Last Updated */}
                        {weaknessMemory.lastUpdated && (
                          <Text fontSize="xs" color="gray.500" fontStyle="italic">
                            Last updated: Round {weaknessMemory.lastUpdated}
                          </Text>
                        )}
                      </VStack>
                    </Box>
                  )}

                  {/* Threat Profile */}
                  {threatProfile && (
                    <Box>
                      <Text fontWeight="bold">🧬 Threat Profile:</Text>
                      <VStack align="stretch" spacing={1} pl={2}>
                        {/* Supernatural Flags */}
                        {(threatProfile.supernatural ||
                          threatProfile.undead ||
                          threatProfile.demonic ||
                          threatProfile.fae ||
                          threatProfile.astral ||
                          threatProfile.summoned ||
                          threatProfile.construct) && (
                          <Box>
                            <Text fontSize="xs" fontWeight="semibold">Type:</Text>
                            <HStack spacing={1} flexWrap="wrap">
                              {threatProfile.supernatural && (
                                <Badge colorScheme="purple" size="xs">Supernatural</Badge>
                              )}
                              {threatProfile.undead && (
                                <Badge colorScheme="gray" size="xs">Undead</Badge>
                              )}
                              {threatProfile.demonic && (
                                <Badge colorScheme="red" size="xs">Demonic</Badge>
                              )}
                              {threatProfile.fae && (
                                <Badge colorScheme="green" size="xs">Fae</Badge>
                              )}
                              {threatProfile.astral && (
                                <Badge colorScheme="blue" size="xs">Astral</Badge>
                              )}
                              {threatProfile.summoned && (
                                <Badge colorScheme="orange" size="xs">Summoned</Badge>
                              )}
                              {threatProfile.construct && (
                                <Badge colorScheme="teal" size="xs">Construct</Badge>
                              )}
                            </HStack>
                          </Box>
                        )}

                        {/* Vulnerabilities */}
                        {(threatProfile.holyVulnerable ||
                          threatProfile.silverVulnerable ||
                          threatProfile.ironVulnerable ||
                          threatProfile.fireSensitive) && (
                          <Box>
                            <Text fontSize="xs" fontWeight="semibold">Vulnerabilities:</Text>
                            <HStack spacing={1} flexWrap="wrap">
                              {threatProfile.holyVulnerable && (
                                <Badge colorScheme="yellow" size="xs">Holy</Badge>
                              )}
                              {threatProfile.silverVulnerable && (
                                <Badge colorScheme="gray" size="xs">Silver</Badge>
                              )}
                              {threatProfile.ironVulnerable && (
                                <Badge colorScheme="gray" size="xs">Iron</Badge>
                              )}
                              {threatProfile.fireSensitive && (
                                <Badge colorScheme="red" size="xs">Fire</Badge>
                              )}
                            </HStack>
                          </Box>
                        )}

                        {/* Durability */}
                        {(threatProfile.mundaneResistant || threatProfile.magicRequired) && (
                          <Box>
                            <Text fontSize="xs" fontWeight="semibold">Durability:</Text>
                            <HStack spacing={1} flexWrap="wrap">
                              {threatProfile.mundaneResistant && (
                                <Badge colorScheme="orange" size="xs">Mundane Resistant</Badge>
                              )}
                              {threatProfile.magicRequired && (
                                <Badge colorScheme="purple" size="xs">Magic Required</Badge>
                              )}
                            </HStack>
                          </Box>
                        )}

                        {/* Confidence Levels */}
                        {threatProfile.confidence && (
                          <Box>
                            <Text fontSize="xs" fontWeight="semibold">Confidence:</Text>
                            <VStack align="stretch" spacing={0.5} pl={2}>
                              {threatProfile.confidence.supernatural > 0 && (
                                <Text fontSize="xs" color="gray.600">
                                  Supernatural: {threatProfile.confidence.supernatural}%
                                </Text>
                              )}
                              {threatProfile.confidence.vulnerability > 0 && (
                                <Text fontSize="xs" color="gray.600">
                                  Vulnerability: {threatProfile.confidence.vulnerability}%
                                </Text>
                              )}
                            </VStack>
                          </Box>
                        )}
                      </VStack>
                    </Box>
                  )}

                  {/* Last Resolution */}
                  {debug.lastResolution && (
                    <Box>
                      <Text fontWeight="bold">📊 Last Resolution:</Text>
                      <VStack align="stretch" spacing={1} pl={2}>
                        <Text fontSize="xs">
                          Outcome:{" "}
                          <Badge
                            colorScheme={
                              debug.lastResolution.outcome === "confirmed"
                                ? "green"
                                : debug.lastResolution.outcome === "disproven"
                                ? "red"
                                : "gray"
                            }
                            size="xs"
                          >
                            {debug.lastResolution.outcome}
                          </Badge>
                        </Text>
                        {debug.lastResolution.spellName && (
                          <Text fontSize="xs" color="gray.600">
                            Spell: {debug.lastResolution.spellName}
                          </Text>
                        )}
                        {debug.lastResolution.notes && (
                          <Text fontSize="xs" color="gray.600">
                            {debug.lastResolution.notes}
                          </Text>
                        )}
                      </VStack>
                    </Box>
                  )}

                  {/* Debug Timestamp */}
                  {debug.updatedAt && (
                    <Text fontSize="xs" color="gray.400" fontStyle="italic" mt={2}>
                      Updated: {new Date(debug.updatedAt).toLocaleTimeString()}
                    </Text>
                  )}
                </VStack>
              </AccordionPanel>
            </AccordionItem>
          );
        })}
      </Accordion>
    </Box>
  );
}

