import React, { useState } from "react";
import {
  Box,
  Heading,
  Button,
  Select,
  Text,
  VStack,
  HStack,
  Badge,
  Alert,
  AlertIcon,
  Divider,
} from "@chakra-ui/react";
import { useParty } from "../context/PartyContext";
import { defaultMerchants, shopItems, racialStocks } from "./data";
import axiosInstance from "../utils/axios";
import getSocket from "../utils/socket";

const socket = getSocket(); // Use centralized socket manager

const MerchantPanel = ({ characters = [], merchant = null }) => {
  const { activeParty } = useParty();
  const [selectedMerchant, setSelectedMerchant] = useState(merchant || null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [mode, setMode] = useState("buy"); // buy or sell
  const [transactionResult, setTransactionResult] = useState(null);

  // Get merchant's available stock
  const getMerchantStock = () => {
    if (!selectedMerchant || !selectedMerchant.stock) return shopItems;
    
    const stock = [];
    const merchantStock = selectedMerchant.stock;
    
    // Add weapons
    (merchantStock.weapons || []).forEach(weaponName => {
      const item = shopItems.find(item => item.name === weaponName);
      if (item) stock.push(item);
    });
    
    // Add armors
    (merchantStock.armors || []).forEach(armorName => {
      const item = shopItems.find(item => item.name === armorName);
      if (item) stock.push(item);
    });
    
    // Add consumables
    (merchantStock.consumables || []).forEach(consumableName => {
      const item = shopItems.find(item => item.name === consumableName);
      if (item) stock.push(item);
    });
    
    // Add misc items
    (merchantStock.misc || []).forEach(miscName => {
      const item = shopItems.find(item => item.name === miscName);
      if (item) stock.push(item);
    });
    
    return stock;
  };

  if (!activeParty) {
    return (
      <Box className="container" p={4}>
        <Heading size="md" mb={4}>Merchant</Heading>
        <Text>Load a party first to access merchant trading.</Text>
      </Box>
    );
  }

  const handleTransaction = async () => {
    if (!selectedMerchant || !selectedItem || !selectedCharacter) {
      alert("Please select a merchant, item, and character.");
      return;
    }

    try {
      if (mode === "buy") {
        const res = await axiosInstance.post(`/merchant/${activeParty._id}/buy`, {
          item: selectedItem,
          cost: selectedItem.cost,
          merchant: selectedMerchant,
          buyerRace: selectedCharacter.species,
        });

        if (res.data.refused) {
          setTransactionResult({
            type: "error",
            message: res.data.error,
          });
          return;
        }

        // Announce successful purchase to PartyChat
        const haggledText = res.data.haggled ? " (after haggling)" : "";
        socket.emit("partyMessage", {
          partyId: activeParty._id,
          user: "System",
          text: `🛒 ${selectedMerchant.name} sold ${selectedItem.name} to ${selectedCharacter.name} for ${res.data.finalCost}g${haggledText} (${activeParty.gold - res.data.finalCost}g left)`,
          type: "system",
        });

        setTransactionResult({
          type: "success",
          message: `Bought ${selectedItem.name} for ${res.data.finalCost}g${haggledText}`,
        });
      } else {
        // Check if party has the item
        const partyItem = activeParty.inventory?.find(i => i.name === selectedItem.name);
        if (!partyItem || partyItem.quantity < 1) {
          setTransactionResult({
            type: "error",
            message: "Party doesn't have this item to sell.",
          });
          return;
        }

        const res = await axiosInstance.post(`/merchant/${activeParty._id}/sell`, {
          itemName: selectedItem.name,
          quantity: 1,
          price: selectedItem.sellPrice,
          merchant: selectedMerchant,
          sellerRace: selectedCharacter.species,
        });

        if (res.data.refused) {
          setTransactionResult({
            type: "error",
            message: res.data.error,
          });
          return;
        }

        // Announce successful sale to PartyChat
        const haggledText = res.data.haggled ? " (after haggling)" : "";
        socket.emit("partyMessage", {
          partyId: activeParty._id,
          user: "System",
          text: `🛒 ${selectedMerchant.name} bought ${selectedItem.name} from ${selectedCharacter.name} for ${res.data.finalPrice}g${haggledText} (${activeParty.gold + res.data.finalPrice}g total)`,
          type: "system",
        });

        setTransactionResult({
          type: "success",
          message: `Sold ${selectedItem.name} for ${res.data.finalPrice}g${haggledText}`,
        });
      }
    } catch (err) {
      console.error("Transaction failed:", err);
      setTransactionResult({
        type: "error",
        message: err.response?.data?.error || "Transaction failed. Please try again.",
      });
    }
  };

  const getMerchantInfo = (merchant) => {
    if (!merchant) return null;
    
    const racialBiasText = merchant.racialBias?.length > 0 
      ? merchant.racialBias.map(b => 
          b.penalty >= 100 
            ? `${b.race} (refuses)` 
            : `${b.race} (+${b.penalty}%)`
        ).join(", ")
      : "None";

    return {
      attitude: merchant.personality.attitude,
      markup: merchant.personality.markup,
      markdown: merchant.personality.markdown,
      haggleChance: Math.floor(merchant.personality.haggleChance * 100),
      racialBias: racialBiasText,
      specialties: merchant.specialties.join(", "),
    };
  };

  const merchantInfo = getMerchantInfo(selectedMerchant);

  return (
    <Box className="container" p={4}>
      <Heading mb={4}>Merchant Trading</Heading>
      
      {/* Current Merchant Info */}
      {selectedMerchant && (
        <Box p={3} bg="blue.50" borderRadius="md" mb={4}>
          <VStack align="start" spacing={1}>
            <Text fontWeight="bold">Current Merchant: {selectedMerchant.name}</Text>
            <HStack spacing={2}>
              <Badge colorScheme="blue">{selectedMerchant.race}</Badge>
              <Badge colorScheme="purple">{selectedMerchant.personality.attitude}</Badge>
            </HStack>
            <Text fontSize="sm">
              Markup: +{selectedMerchant.personality.markup}% | 
              Markdown: -{selectedMerchant.personality.markdown}% | 
              Haggle Chance: {Math.round(selectedMerchant.personality.haggleChance * 100)}%
            </Text>
            {selectedMerchant.racialBias && selectedMerchant.racialBias.length > 0 && (
              <Text fontSize="sm" color="red.600">
                Racial Biases: {selectedMerchant.racialBias.map(bias => 
                  `${bias.race} (${bias.penalty >= 100 ? 'refuses' : `+${bias.penalty}%`})`
                ).join(', ')}
              </Text>
            )}
          </VStack>
        </Box>
      )}
      
      <VStack align="stretch" spacing={4}>
        {/* Party Gold Display */}
        <Box p={3} bg="yellow.50" borderRadius="md" border="1px solid" borderColor="yellow.200">
          <Text fontWeight="bold" color="yellow.800">
            Party Gold: {activeParty.gold}g
          </Text>
        </Box>

        {/* Merchant Selection */}
        <Box>
          <Heading size="sm" mb={2}>Select Merchant</Heading>
          <Select
            placeholder="Choose a merchant"
            onChange={(e) => {
              const merchant = defaultMerchants.find(m => m.name === e.target.value);
              setSelectedMerchant(merchant);
              setTransactionResult(null);
            }}
            value={selectedMerchant?.name || ""}
          >
            {defaultMerchants.map((merchant) => (
              <option key={merchant.name} value={merchant.name}>
                {merchant.name} ({merchant.race}, {merchant.personality.attitude})
              </option>
            ))}
          </Select>
        </Box>

        {/* Merchant Info */}
        {selectedMerchant && (
          <Box p={3} bg="blue.50" borderRadius="md" border="1px solid" borderColor="blue.200">
            <VStack align="start" spacing={1}>
              <Text fontWeight="bold">
                {selectedMerchant.name} ({selectedMerchant.race})
              </Text>
              <Text fontSize="sm">
                <strong>Attitude:</strong> {merchantInfo.attitude} | 
                <strong> Markup:</strong> {merchantInfo.markup}% | 
                <strong> Markdown:</strong> {merchantInfo.markdown}% | 
                <strong> Haggle:</strong> {merchantInfo.haggleChance}%
              </Text>
              <Text fontSize="sm">
                <strong>Racial Bias:</strong> {merchantInfo.racialBias}
              </Text>
              <Text fontSize="sm">
                <strong>Specialties:</strong> {merchantInfo.specialties}
              </Text>
            </VStack>
          </Box>
        )}

        {/* Character Selection */}
        <Box>
          <Heading size="sm" mb={2}>Select Character</Heading>
          <Select
            placeholder="Choose character for transaction"
            onChange={(e) => {
              const char = characters.find(c => c._id === e.target.value);
              setSelectedCharacter(char);
              setTransactionResult(null);
            }}
            value={selectedCharacter?._id || ""}
          >
            {characters.map((char) => (
              <option key={char._id} value={char._id}>
                {char.name} ({char.species})
              </option>
            ))}
          </Select>
        </Box>

        {/* Transaction Mode */}
        <Box>
          <Heading size="sm" mb={2}>Transaction Type</Heading>
          <HStack spacing={4}>
            <Button
              colorScheme={mode === "buy" ? "green" : "gray"}
              onClick={() => {
                setMode("buy");
                setTransactionResult(null);
              }}
            >
              Buy
            </Button>
            <Button
              colorScheme={mode === "sell" ? "orange" : "gray"}
              onClick={() => {
                setMode("sell");
                setTransactionResult(null);
              }}
            >
              Sell
            </Button>
          </HStack>
        </Box>

        {/* Item Selection */}
        <Box>
          <Heading size="sm" mb={2}>
            {mode === "buy" ? "Select Item to Buy" : "Select Item to Sell"}
          </Heading>
          <Select
            placeholder={`Choose item to ${mode}`}
            onChange={(e) => {
              const item = mode === "buy" 
                ? shopItems.find(i => i.name === e.target.value)
                : activeParty.inventory?.find(i => i.name === e.target.value);
              setSelectedItem(item);
              setTransactionResult(null);
            }}
            value={selectedItem?.name || ""}
          >
            {mode === "buy" ? (
              getMerchantStock().map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name} - {item.cost}g (Buy) / {item.sellPrice}g (Sell)
                </option>
              ))
            ) : (
              activeParty.inventory?.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name} x{item.quantity} - {item.sellPrice || Math.floor(item.cost / 2)}g
                </option>
              )) || []
            )}
          </Select>
        </Box>

        {/* Item Details */}
        {selectedItem && (
          <Box p={3} bg="gray.50" borderRadius="md">
            <VStack align="start" spacing={1}>
              <Text fontWeight="bold">{selectedItem.name}</Text>
              <HStack spacing={2}>
                <Badge colorScheme={
                  selectedItem.type === "weapon" ? "red" :
                  selectedItem.type === "armor" ? "blue" :
                  selectedItem.type === "consumable" ? "green" : "gray"
                }>
                  {selectedItem.type}
                </Badge>
                {selectedItem.damage && <Text fontSize="sm">Damage: {selectedItem.damage}</Text>}
                {selectedItem.defense && <Text fontSize="sm">Defense: {selectedItem.defense}</Text>}
                {selectedItem.effect && <Text fontSize="sm">Effect: {selectedItem.effect}</Text>}
                <Text fontSize="sm">{selectedItem.weight} lbs</Text>
              </HStack>
              <Text fontSize="sm">
                <strong>Price:</strong> {mode === "buy" ? selectedItem.cost : (selectedItem.sellPrice || Math.floor(selectedItem.cost / 2))}g
              </Text>
            </VStack>
          </Box>
        )}

        {/* Transaction Button */}
        <Button
          colorScheme={mode === "buy" ? "green" : "orange"}
          onClick={handleTransaction}
          isDisabled={!selectedMerchant || !selectedItem || !selectedCharacter}
          size="lg"
        >
          {mode === "buy" ? "Buy Item" : "Sell Item"}
        </Button>

        {/* Transaction Result */}
        {transactionResult && (
          <Alert status={transactionResult.type === "success" ? "success" : "error"}>
            <AlertIcon />
            {transactionResult.message}
          </Alert>
        )}
      </VStack>
    </Box>
  );
};

export default MerchantPanel;
