import React, { useState, useEffect } from "react";
import {
  Box,
  Heading,
  Table,
  Tr,
  Th,
  Td,
  Tbody,
  Button,
  Select,
  Input,
  VStack,
  HStack,
  Text,
  Badge,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  FormControl,
  FormLabel,
  Textarea,
} from "@chakra-ui/react";
import axiosInstance from "../utils/axios";
import { useParty } from "../context/PartyContext";
import getSocket from "../utils/socket";

const socket = getSocket(); // Use centralized socket manager

const QuestTracker = () => {
  const { activeParty } = useParty();
  const [quests, setQuests] = useState(activeParty?.quests || []);
  const [newQuest, setNewQuest] = useState({
    title: "",
    description: "",
    rewards: [],
  });
  const [claimTarget, setClaimTarget] = useState({ item: null, charId: null });
  const { isOpen, onOpen, onClose } = useDisclosure();

  useEffect(() => {
    if (activeParty?.quests) {
      setQuests(activeParty.quests);
    }
  }, [activeParty?.quests]);

  const updateStatus = async (index, newStatus) => {
    try {
      const res = await axiosInstance.post(`/quest/${activeParty._id}/update`, {
        questIndex: index,
        status: newStatus,
      });
      setQuests(res.data);
    } catch (err) {
      console.error("Failed to update quest:", err);
    }
  };

  const addQuest = async () => {
    try {
      const res = await axiosInstance.post(`/quest/${activeParty._id}/add`, newQuest);
      setQuests(res.data);
      setNewQuest({ title: "", description: "", rewards: [] });
      onClose();
    } catch (err) {
      console.error("Failed to add quest:", err);
    }
  };

  const claimReward = async (reward) => {
    try {
      await axiosInstance.post(`/quest/${activeParty._id}/claim-reward`, {
        charId: claimTarget.charId,
        reward,
      });
      setClaimTarget({ item: null, charId: null });
    } catch (err) {
      console.error("Failed to claim reward:", err);
    }
  };

  const splitGold = async (amount) => {
    try {
      await axiosInstance.post(`/quest/${activeParty._id}/split-gold`, { amount });
    } catch (err) {
      console.error("Fair split failed:", err);
    }
  };

  const splitItem = async (itemName, quantity) => {
    try {
      await axiosInstance.post(`/quest/${activeParty._id}/split-item`, {
        itemName,
        quantity,
      });
    } catch (err) {
      console.error("Item split failed:", err);
    }
  };

  return (
    <Box className="container" p={4}>
      <Heading mb={4}>Quest Tracker</Heading>
      
      <HStack mb={4} spacing={4}>
        <Button colorScheme="green" onClick={onOpen}>
          Add New Quest
        </Button>
        <Button
          colorScheme="yellow"
          onClick={() => splitGold(100)}
        >
          Split 100 Gold Evenly
        </Button>
        <Button
          colorScheme="teal"
          onClick={() => splitItem("Healing Potion", 8)}
        >
          Split 8 Healing Potions Evenly
        </Button>
      </HStack>

      <Table variant="simple">
        <thead>
          <Tr>
            <Th>Title</Th>
            <Th>Description</Th>
            <Th>Status</Th>
            <Th>Rewards</Th>
            <Th>Actions</Th>
          </Tr>
        </thead>
        <Tbody>
          {quests.map((quest, idx) => (
            <Tr key={idx}>
              <Td fontWeight="bold">{quest.title}</Td>
              <Td>{quest.description}</Td>
              <Td>
                <Badge
                  colorScheme={
                    quest.status === "completed" ? "green" :
                    quest.status === "failed" ? "red" : "blue"
                  }
                >
                  {quest.status}
                </Badge>
              </Td>
              <Td>
                {quest.rewards?.map((reward, rewardIdx) => (
                  <Text key={rewardIdx} fontSize="sm">
                    {reward.type === "gold" ? `${reward.amount} gold` : 
                     reward.type === "item" ? `${reward.quantity}x ${reward.name}` : 
                     reward}
                  </Text>
                ))}
              </Td>
              <Td>
                <Select
                  placeholder="Update Status"
                  size="sm"
                  onChange={(e) => updateStatus(idx, e.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </Select>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      {/* Party Inventory for Claiming Rewards */}
      {activeParty?.inventory && activeParty.inventory.length > 0 && (
        <Box mt={6}>
          <Heading size="md" mb={4}>Party Rewards Available</Heading>
          <Table variant="simple" size="sm">
            <thead>
              <Tr>
                <Th>Item</Th>
                <Th>Quantity</Th>
                <Th>Claim</Th>
              </Tr>
            </thead>
            <Tbody>
              {activeParty.inventory.map((item, idx) => (
                <Tr key={idx}>
                  <Td>{item.name}</Td>
                  <Td>{item.quantity}</Td>
                  <Td>
                    <HStack spacing={2}>
                      <Select
                        placeholder="Assign to character"
                        size="sm"
                        width="150px"
                        onChange={(e) => setClaimTarget({ item, charId: e.target.value })}
                      >
                        {activeParty.characters?.map((char) => (
                          <option key={char._id} value={char._id}>
                            {char.name}
                          </option>
                        ))}
                      </Select>
                      <Button
                        size="sm"
                        colorScheme="green"
                        onClick={() => claimReward({ 
                          type: "item", 
                          name: item.name, 
                          quantity: 1 
                        })}
                        isDisabled={!claimTarget.charId || claimTarget.item?.name !== item.name}
                      >
                        Claim
                      </Button>
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      )}

      {/* Add Quest Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add New Quest</ModalHeader>
          <ModalBody>
            <VStack spacing={4}>
              <FormControl>
                <FormLabel>Quest Title</FormLabel>
                <Input
                  value={newQuest.title}
                  onChange={(e) => setNewQuest({ ...newQuest, title: e.target.value })}
                  placeholder="Enter quest title"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Description</FormLabel>
                <Textarea
                  value={newQuest.description}
                  onChange={(e) => setNewQuest({ ...newQuest, description: e.target.value })}
                  placeholder="Enter quest description"
                />
              </FormControl>
              <FormControl>
                <FormLabel>Rewards (one per line)</FormLabel>
                <Textarea
                  placeholder="100 gold&#10;Healing Potion x2&#10;Magic Sword"
                  onChange={(e) => {
                    const rewards = e.target.value.split('\n').filter(line => line.trim());
                    setNewQuest({ ...newQuest, rewards });
                  }}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={addQuest}>
              Add Quest
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default QuestTracker;
