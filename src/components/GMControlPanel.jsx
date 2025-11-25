import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Box,
  Heading,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Text,
  Alert,
  AlertIcon,
  Button,
  Select,
  HStack,
} from "@chakra-ui/react";

import PartyList from "./PartyList";
import WorldMap from "./WorldMap";
import PartyChat from "./PartyChat";
import NpcMemoryEditor from "./NpcMemoryEditor";
import CombatPanel from "./CombatPanel";
import InitiativeTracker from "./InitiativeTracker";
import InventoryManager from "./InventoryManager";
import EquipmentShop from "./EquipmentShop";
import GMAssistant from "./GMAssistant";
import AbilitiesPanel from "./AbilitiesPanel";
import TimeTracker from "./TimeTracker";
import PartyInventory from "./PartyInventory";
import MerchantPanel from "./MerchantPanel";
import BestiaryPanel from "./BestiaryPanel";
import QuestTracker from "./QuestTracker";
import NPCChat from "./NPCChat";
import GMWorldMap from "./GMWorldMap";
import { useParty } from "../context/PartyContext";
import axiosInstance from "../utils/axios";
import getSocket from "../utils/socket";

const socket = getSocket(); // Use centralized socket manager

const GMControlPanel = ({
  parties,
  onDeleteParty,
  onLoadParty,
  onUpdateCharacter,
}) => {
  const { activeParty } = useParty();
  const [exportFormat, setExportFormat] = useState("txt");
  const [restHours, setRestHours] = useState(8);
  const [defaultRolloff, setDefaultRolloff] = useState(activeParty?.defaultRolloffMethod || "d20");
  const [selectedNPC, setSelectedNPC] = useState(null);
  const [npcs, setNPCs] = useState([]);

  const handleExportLog = async () => {
    if (!activeParty?._id) {
      alert("Load a party first!");
      return;
    }
    try {
      const res = await axiosInstance.get(
        `/messages/export/${activeParty._id}?format=${exportFormat}`,
        { responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${activeParty.name}-log.${exportFormat}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export log:", err);
      alert("Failed to export session log. Please try again.");
    }
  };

  const handleExportCombatLog = async () => {
    if (!activeParty?._id) {
      alert("Load a party first!");
      return;
    }
    try {
      const res = await axiosInstance.get(
        `/combat-log/export/${activeParty._id}?format=${exportFormat}`,
        { responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${activeParty.name}-combat.${exportFormat}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export combat log:", err);
      alert("Failed to export combat log. Please try again.");
    }
  };

  const handleEndSession = async () => {
    if (!activeParty?._id) {
      alert("Load a party first!");
      return;
    }
    
    if (!window.confirm(`Are you sure you want to end the session for "${activeParty.name}"? This will auto-export the session log.`)) {
      return;
    }
    
    try {
      const res = await axiosInstance.post(`/messages/end-session/${activeParty._id}`, {
        format: exportFormat, // pdf/md/txt
      });
      alert(`Session ended and exported as ${res.data.session.filename}`);
      
      // Optionally clear the active party after session end
      if (window.confirm("Would you like to unload the party from the session?")) {
        // This would need to be implemented in PartyContext
        console.log("Party unload requested");
      }
    } catch (err) {
      console.error("Failed to end session:", err);
      alert("Failed to end session. Please try again.");
    }
  };

  const handleRestParty = async () => {
    if (!activeParty?._id) {
      alert("Load a party first!");
      return;
    }
    try {
      const res = await axiosInstance.post(`/rest/${activeParty._id}`, {
        hours: restHours,
      });
      alert(res.data.message);

      socket.emit("partyMessage", {
        partyId: activeParty._id,
        user: "System",
        text: `🌙 The party rests ${restHours} hours. Time is now ${new Date(
          res.data.newTime
        ).toLocaleString()}. Abilities restored.`,
        type: "system",
      });
    } catch (err) {
      console.error("Failed to reset abilities:", err);
      alert("Failed to rest party. Please try again.");
    }
  };

  const updateDefaultRolloff = async () => {
    if (!activeParty?._id) {
      alert("Load a party first!");
      return;
    }
    try {
      await axiosInstance.post(`/loot/${activeParty._id}/set-rolloff-method`, {
        method: defaultRolloff,
      });
      alert(`Default Roll-Off set to ${defaultRolloff}`);
    } catch (err) {
      console.error("Failed to update roll-off method:", err);
      alert("Failed to update roll-off method. Please try again.");
    }
  };

  // OpenAI Integration Functions
  const handleCombatNarration = async (event) => {
    try {
      const res = await axiosInstance.post("/api/openai/narrate", { event });
      socket.emit("partyMessage", {
        partyId: activeParty._id,
        user: "Narrator",
        text: res.data.text,
        type: "flavor",
      });
    } catch (error) {
      console.error("Failed to generate narration:", error);
    }
  };

  const handleQuestGeneration = async (context) => {
    try {
      const res = await axiosInstance.post("/api/openai/quest", { context });
      socket.emit("partyMessage", {
        partyId: activeParty._id,
        user: "Quest",
        text: res.data.text,
        type: "quest",
      });
    } catch (error) {
      console.error("Failed to generate quest:", error);
    }
  };

  const handleEncounterNarration = async (encounter) => {
    try {
      const res = await axiosInstance.post("/api/openai/encounter", { encounter });
      socket.emit("partyMessage", {
        partyId: activeParty._id,
        user: "Narrator",
        text: res.data.text,
        type: "flavor",
      });
    } catch (error) {
      console.error("Failed to generate encounter narration:", error);
    }
  };

  const handleGMAssist = async (question) => {
    try {
      const res = await axiosInstance.post("/api/openai/assist", { question });
      socket.emit("partyMessage", {
        partyId: activeParty._id,
        user: "GM Assistant",
        text: res.data.text,
        type: "system",
      });
    } catch (error) {
      console.error("Failed to get GM assistance:", error);
    }
  };

  return (
    <Box className="container">
      <Heading mb={4}>GM Control Panel</Heading>

      {/* OpenAI Integration Buttons */}
      <Box mb={4} p={4} border="1px solid" borderColor="purple.200" borderRadius="md" bg="purple.50">
        <Heading size="md" mb={3}>AI Assistant</Heading>
        <HStack spacing={3} wrap="wrap">
          <Button
            colorScheme="purple"
            size="sm"
            onClick={() => handleCombatNarration("Samuel the Wizard casts Fireball at an Orc, dealing 17 damage")}
          >
            🎭 Combat Narration
          </Button>
          <Button
            colorScheme="blue"
            size="sm"
            onClick={() => handleQuestGeneration("Merchant caravan encounter")}
          >
            📜 Generate Quest
          </Button>
          <Button
            colorScheme="green"
            size="sm"
            onClick={() => handleEncounterNarration("Three bandits ambush the party at night")}
          >
            ⚔️ Encounter Narration
          </Button>
          <Button
            colorScheme="orange"
            size="sm"
            onClick={() => handleGMAssist("What's a fun complication if the party delays 3 days here?")}
          >
            🧠 GM Assist
          </Button>
        </HStack>
      </Box>
      
      {activeParty && (
        <Alert status="info" mb={4}>
          <AlertIcon />
          Active Party: <strong>{activeParty.name}</strong> - {activeParty.startLocation?.label || "No location set"}
        </Alert>
      )}

      {activeParty && (
        <Box mb={4}>
          <HStack spacing={3}>
            <Select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              width="200px"
              size="md"
            >
              <option value="txt">📄 Text (.txt)</option>
              <option value="md">📝 Markdown (.md)</option>
              <option value="pdf">📋 PDF (.pdf)</option>
            </Select>
            <Button 
              colorScheme="blue" 
              onClick={handleExportLog}
              size="md"
            >
              Export Session Log
            </Button>
            <Button 
              colorScheme="purple" 
              onClick={handleExportCombatLog}
              size="md"
            >
              ⚔️ Export Combat Log
            </Button>
            <Button 
              colorScheme="red" 
              onClick={handleEndSession}
              size="md"
            >
              🏁 End Session & Auto-Export
            </Button>
          </HStack>
        </Box>
      )}

      {activeParty && (
        <Box mb={4}>
          <HStack spacing={3}>
            <Select
              value={restHours}
              onChange={(e) => setRestHours(Number(e.target.value))}
              width="200px"
              size="md"
            >
              <option value={4}>Short Rest (4h)</option>
              <option value={8}>Full Rest (8h)</option>
              <option value={12}>Extended Rest (12h)</option>
            </Select>
            <Button 
              colorScheme="green" 
              onClick={handleRestParty}
              size="md"
            >
              🌙 Rest & Reset Abilities
            </Button>
          </HStack>
        </Box>
      )}

      {activeParty && (
        <Box mb={4}>
          <Heading size="sm" mb={2}>Roll-Off Settings</Heading>
          <HStack spacing={3}>
            <Select
              value={defaultRolloff}
              onChange={(e) => setDefaultRolloff(e.target.value)}
              width="200px"
              size="md"
            >
              <option value="d20">d20 (default)</option>
              <option value="2d6">2d6</option>
              <option value="attribute:PE">PE vs PE</option>
              <option value="attribute:IQ">IQ vs IQ</option>
              <option value="attribute:PP">PP vs PP</option>
            </Select>
            <Button 
              colorScheme="blue" 
              onClick={updateDefaultRolloff}
              size="md"
            >
              Save Default Roll-Off
            </Button>
          </HStack>
        </Box>
      )}

      <Tabs variant="enclosed" isFitted>
        <TabList>
          <Tab>Parties</Tab>
          <Tab>World Map</Tab>
          <Tab>Party Chat</Tab>
          <Tab>NPC Memories</Tab>
          <Tab>GM Assistant</Tab>
          <Tab>Equipment Shop</Tab>
          <Tab>Inventory</Tab>
          <Tab>O.C.C. Abilities</Tab>
          <Tab>Time</Tab>
          <Tab>Party Inventory</Tab>
          <Tab>Merchant</Tab>
          <Tab>Bestiary</Tab>
          <Tab>Quest Tracker</Tab>
          <Tab>NPC Chat</Tab>
          <Tab>World Map</Tab>
          <Tab>Combat & Skills</Tab>
          <Tab>Combat</Tab>
        </TabList>

        <TabPanels>
          {/* Party Management */}
          <TabPanel>
            <PartyList
              parties={parties}
              onDeleteParty={onDeleteParty}
              onLoadParty={onLoadParty}
            />
          </TabPanel>

          {/* Map & starting location */}
          <TabPanel>
            {activeParty ? (
              <WorldMap />
            ) : (
              <Box textAlign="center" py={8}>
                <Heading size="sm" color="gray.500">Load a party first</Heading>
                <Text color="gray.400" mt={2}>
                  Go to the Parties tab to load a party, then return here to manage their location.
                </Text>
              </Box>
            )}
          </TabPanel>

          {/* Party Chat */}
          <TabPanel>
            {activeParty ? (
              <PartyChat username="GM" />
            ) : (
              <Box textAlign="center" py={8}>
                <Heading size="sm" color="gray.500">Load a party first</Heading>
                <Text color="gray.400" mt={2}>
                  Go to the Parties tab to load a party, then return here to chat with players and NPCs.
                </Text>
              </Box>
            )}
          </TabPanel>

          {/* NPC Memories */}
          <TabPanel>
            {activeParty ? (
              <NpcMemoryEditor />
            ) : (
              <Box textAlign="center" py={8}>
                <Heading size="sm" color="gray.500">Load a party first</Heading>
                <Text color="gray.400" mt={2}>
                  Go to the Parties tab to load a party, then return here to manage NPC memories.
                </Text>
              </Box>
            )}
          </TabPanel>

          {/* GM Assistant */}
          <TabPanel>
            <GMAssistant />
          </TabPanel>

          {/* Equipment Shop */}
          <TabPanel>
            <EquipmentShop onUpdateCharacter={onUpdateCharacter} />
          </TabPanel>

          {/* Inventory Management */}
          <TabPanel>
            {activeParty ? (
              <InventoryManager onUpdateCharacter={onUpdateCharacter} />
            ) : (
              <Box textAlign="center" py={8}>
                <Heading size="sm" color="gray.500">Load a party first</Heading>
                <Text color="gray.400" mt={2}>
                  Go to the Parties tab to load a party, then return here to manage character inventories and weapons.
                </Text>
              </Box>
            )}
          </TabPanel>

          {/* O.C.C. Abilities */}
          <TabPanel>
            <AbilitiesPanel />
          </TabPanel>

          {/* Time Tracker */}
          <TabPanel>
            <TimeTracker />
          </TabPanel>

          {/* Party Inventory */}
          <TabPanel>
            <PartyInventory characters={activeParty?.members || []} />
          </TabPanel>

          {/* Merchant */}
          <TabPanel>
            <MerchantPanel characters={activeParty?.members || []} />
          </TabPanel>

          {/* Bestiary */}
          <TabPanel>
            <BestiaryPanel />
          </TabPanel>

          {/* Quest Tracker */}
          <TabPanel>
            <QuestTracker />
          </TabPanel>

          {/* NPC Chat */}
          <TabPanel>
            <NPCChat npc={selectedNPC} onClose={() => setSelectedNPC(null)} />
          </TabPanel>

          {/* World Map */}
          <TabPanel>
            <GMWorldMap />
          </TabPanel>

          {/* Combat & Skills */}
          <TabPanel>
            <CombatPanel />
          </TabPanel>

          {/* Combat Tracker */}
          <TabPanel>
            <InitiativeTracker />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

GMControlPanel.propTypes = {
  parties: PropTypes.array,
  onDeleteParty: PropTypes.func,
  onLoadParty: PropTypes.func,
  onUpdateCharacter: PropTypes.func,
};

export default GMControlPanel;
