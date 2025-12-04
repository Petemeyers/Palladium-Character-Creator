import React from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  VStack,
  Checkbox,
  Text,
  Divider,
} from "@chakra-ui/react";
import { useGameSettings } from "../context/GameSettingsContext";

export default function GameSettingsPanel({ isOpen, onClose }) {
  const { settings, updateSettings, resetSettings } = useGameSettings();

  const handleToggle = (key) => (e) => {
    updateSettings({ [key]: e.target.checked });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Game Settings</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="stretch" spacing={4}>
            <Text fontSize="sm" color="gray.600">
              Toggle advanced combat mechanics on or off. Settings are saved automatically.
            </Text>
            <Divider />
            <Checkbox
              isChecked={settings.usePainStagger}
              onChange={handleToggle("usePainStagger")}
              size="lg"
            >
              <VStack align="start" spacing={0}>
                <Text fontWeight="medium">Use Pain Stagger</Text>
                <Text fontSize="xs" color="gray.500">
                  Heavy blunt hits can cause pain and steal actions from unarmored targets
                </Text>
              </VStack>
            </Checkbox>

            <Checkbox
              isChecked={settings.useMoraleRouting}
              onChange={handleToggle("useMoraleRouting")}
              size="lg"
            >
              <VStack align="start" spacing={0}>
                <Text fontWeight="medium">Use Morale & Routing</Text>
                <Text fontSize="xs" color="gray.500">
                  Units can break (SHAKEN/ROUTED) and flee when morale fails
                </Text>
              </VStack>
            </Checkbox>

            <Checkbox
              isChecked={settings.useInsanityTrauma}
              onChange={handleToggle("useInsanityTrauma")}
              size="lg"
            >
              <VStack align="start" spacing={0}>
                <Text fontWeight="medium">Use Insanity / Trauma</Text>
                <Text fontSize="xs" color="gray.500">
                  Horror Factor checks and long-term mental effects from trauma
                </Text>
              </VStack>
            </Checkbox>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={resetSettings} size="sm">
            Reset to Defaults
          </Button>
          <Button colorScheme="blue" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

