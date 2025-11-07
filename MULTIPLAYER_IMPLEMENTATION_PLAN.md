
# Multiplayer Implementation Plan (MVP)

This document outlines a step-by-step plan to refactor the existing single-player card game into a real-time multiplayer game. This plan focuses on a Minimum Viable Product (MVP) using a client-server architecture with WebSockets.

## Core Technology Stack

*   **Server:** Node.js with Express and Socket.IO for real-time communication.
*   **Client:** Continue with React Native, integrating Socket.IO client to communicate with the server.

---

## Step 1: Project Setup & Server Scaffolding

1.  **Create a `server` directory:** In the project root, create a new `server` directory to house all backend code.
2.  **Initialize Node.js project:**
    *   Navigate into the `server` directory.
    *   Run `npm init -y` to create a `package.json` file.
3.  **Install server dependencies:**
    *   Run `npm install express socket.io` to install the necessary libraries.
4.  **Create basic server file:**
    *   Create a `server.js` file inside the `server` directory.
    *   Set up a basic Express server and integrate Socket.IO.

---

## Step 2: Server-Side Game Logic

1.  **Move Game Logic:**
    *   Copy the existing `game-logic` directory into the `server` directory. This logic will now be the single source of truth, managed by the server.
2.  **Game State Management:**
    *   In `server.js`, create a `gameState` object based on the `initializeGame` function from your game logic.
    *   This object will manage all aspects of the game: deck, player hands, table cards, and current turn.
3.  **Socket.IO Connection Handling:**
    *   Implement connection logic in `server.js`.
    *   When a new player connects:
        *   Assign them a player number (Player 1 or Player 2).
        *   If two players are connected, start the game.
        *   Emit a `game-start` event to both players with the initial `gameState`.
4.  **Handling Player Actions:**
    *   Create Socket.IO event listeners for each game action (e.g., `play-card`, `take-cards`, `trail-card`).
    *   When an action is received from a client:
        *   Validate the action using the logic in `game-logic/validation.js`.
        *   If valid, update the central `gameState` using the functions in `game-logic/game-actions.js`.
        *   Broadcast the updated `gameState` to all connected clients using a `game-update` event.

---

## Step 3: Client-Side Refactoring

1.  **Install Client Dependencies:**
    *   In your React Native project root, run `npm install socket.io-client`.
2.  **Establish Server Connection:**
    *   In `App.js` or a new `hooks/useSocket.js` hook, establish a connection to the Socket.IO server.
    *   The client should listen for `game-start` and `game-update` events.
3.  **Refactor `GameBoard.tsx`:**
    *   Remove the local `useState` for `gameState`. The game state will now be received from the server.
    *   Create a `useState` to hold the `gameState` received from the server.
    *   Update the component to render based on the server-provided state.
4.  **Modify Event Handlers:**
    *   Refactor the `handle...Drop` functions in the `handlers` directory.
    *   Instead of updating the local state directly, these functions should now emit a Socket.IO event to the server with the details of the action (e.g., `socket.emit('play-card', { card, target })`).
    *   The client will then wait for a `game-update` event from the server to re-render the UI with the new state.
5.  **Player-Specific Views:**
    *   The client needs to know which player it is. The server should send this information upon connection.
    *   The UI should be rendered from the perspective of the current player (e.g., "Your Hand" vs. "Opponent's Hand"). The `GameBoard.tsx` will need to be adjusted to correctly display the hands for `player1Hand` and `player2Hand` based on which player the client is.

---

## Step 4: Turn Management and UI Feedback

1.  **Display Current Player:**
    *   Use the `currentPlayer` property from the server's `gameState` to display whose turn it is.
2.  **Disable Opponent's Actions:**
    *   The UI should prevent a player from making moves when it is not their turn. The `DraggableCard` component and other interactive elements should be disabled if `socket.id` does not match the current player's turn.
3.  **Notifications:**
    *   Use the existing notification system to provide feedback from the server (e.g., "Player 2 played the 7 of Spades," "Invalid move").

---

## Step 5: Testing and Refinement (Post-MVP)

1.  **Handling Disconnections:**
    *   Implement logic on the server to handle player disconnections (e.g., pause the game, notify the other player).
2.  **Reconnect Logic:**
    *   Add logic to the client to attempt to reconnect to the server if the connection is lost.
3.  **Game Over and Restart:**
    *   Implement the end-of-game logic on the server.
    *   When the game ends, the server should calculate scores and emit a `game-over` event.
    *   Add a "Play Again" feature that allows players to start a new game without reconnecting.
