import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ChakraProvider } from "@chakra-ui/react";
import App from "./App";
import theme from "./theme";     
import { ColorModeScript } from "@chakra-ui/react";
import { PartyProvider } from "./context/PartyContext";
import TokenManager from "./utils/tokenManager";

// Validate and clean up tokens on app startup
TokenManager.validateAndCleanup();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ChakraProvider theme={theme}>   
    <ColorModeScript initialColorMode={theme.config.initialColorMode} />
    <BrowserRouter>
      <PartyProvider>
        <App />
      </PartyProvider>
      </BrowserRouter>
    </ChakraProvider>
  </React.StrictMode>
);
