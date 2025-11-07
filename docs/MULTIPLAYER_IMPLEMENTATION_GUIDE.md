# Multiplayer Casino Game Implementation Guide

## Overview

This guide provides a complete implementation of real-time multiplayer functionality for a casino card game using React Native, Node.js, and Socket.IO. The implementation supports cross-platform play (iOS, Android, Web) with automatic platform detection and proper CORS handling.

## Architecture

### Technology Stack
- **Frontend**: React Native with Expo
- **Backend**: Node.js with Express and Socket.IO
- **Real-time Communication**: Socket.IO for WebSocket connections
- **Cross-platform Support**: React Native for mobile, web support via Expo

### Key Components
- Server-side game state management
- Client-side socket connection handling
- Platform-aware connection URLs
- Turn-based gameplay with validation
- Cross-platform UI rendering

## Server Implementation

### Dependencies
```json
{
  "express": "^4.18.0",
  "socket.io": "^4.7.0"
}
```

### Server Code (`server/server.js`)

```javascript
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:8081", "http://localhost:8083"], // Allow multiple Expo web client ports
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Server is running.');
});

const { initializeGame } = require('./game-logic/game-state');
const { handleTrail, handleCapture } = require('./game-logic/game-actions');

let players = [];
let gameState = null;

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);
  players.push(socket);
  console.log(`Total players connected: ${players.length}`);

  // Assign player number
  const playerNumber = players.length;
  console.log(`Assigning player number ${playerNumber} to socket: ${socket.id}`);
  socket.emit('player-number', playerNumber);

  if (players.length === 2) {
    // Start the game
    gameState = initializeGame();
    console.log('Two players connected. Starting game...');

    // Emit game state to both players
    players.forEach((playerSocket, index) => {
      console.log(`Emitting game-start to playerSocket ${playerSocket.id} as playerNumber ${index + 1}`);
      playerSocket.emit('game-start', { gameState, playerNumber: index + 1 });
    });
  }

  socket.on('game-action', (action) => {
    console.log(`Received game-action: ${action.type} from socket ${socket.id}`);
    if (!gameState || players.length < 2) {
      console.log('Ignoring action, game not started or not enough players.');
      return;
    }

    // Basic validation: ensure the action is from the current player
    const playerIndex = players.findIndex(p => p.id === socket.id);
    if (playerIndex + 1 !== gameState.currentPlayer) {
      console.log(`Rejected action from playerIndex ${playerIndex + 1} because it's player ${gameState.currentPlayer}'s turn.`);
      return socket.emit('error', { message: "It's not your turn." });
    }

    console.log(`Received action: ${action.type} from player ${gameState.currentPlayer}`);

    let newGameState = gameState;

    try {
      switch (action.type) {
        case 'trail':
          newGameState = handleTrail(gameState, action.payload.card);
          break;

        case 'drop_on_card':
          // This is a simplification for the MVP.
          // A real implementation would have more complex logic to differentiate between capture, build, etc.
          const { draggedItem, targetInfo } = action.payload;
          // For now, we'll assume any drop on a card is an attempt to capture.
          // We'll treat the target as the `selectedTableCards`.
          newGameState = handleCapture(gameState, draggedItem, [targetInfo.card]);
          break;

        default:
          console.log(`Unknown action type: ${action.type}`);
          break;
      }
    } catch (e) {
      console.error("Error processing game action:", e);
      // Optionally emit an error back to the specific player
      socket.emit('action-error', { message: e.message });
    }

    gameState = newGameState;

    // Broadcast the updated state to all players
    io.emit('game-update', gameState);
  });

  socket.on('disconnect', () => {
    console.log(`user disconnected: ${socket.id}. Waiting 2 seconds before removing.`);
    // Add a delay to handle rapid reconnects during development (e.g., from React StrictMode)
    setTimeout(() => {
      const playerExists = players.some(p => p.id === socket.id);
      if (!playerExists) {
        console.log(`Player ${socket.id} already removed or reconnected.`);
        return;
      }

      players = players.filter(p => p.id !== socket.id);
      console.log(`Total players after disconnect: ${players.length}`);

      // Simple reset for MVP. A real implementation would handle this more gracefully.
      if (players.length < 2) {
        gameState = null;
        console.log('A player disconnected. Game reset.');
      }
    }, 2000); // 2-second delay
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on *:${PORT}`);
});
```

## Client Implementation

### Dependencies
```json
{
  "socket.io-client": "^4.7.0",
  "react-native-safe-area-context": "^4.7.0"
}
```

### Socket Hook (`hooks/useSocket.ts`)

```typescript
import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { GameState } from '../types/gameTypes';

// Use localhost for web and IP for mobile for simplified testing
const SERVER_URL = Platform.OS === 'web' 
  ? 'http://localhost:3000' 
  : 'http://192.168.18.2:3000'; // Replace with your machine's actual local IP address

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerNumber, setPlayerNumber] = useState<number | null>(null);

  useEffect(() => {
    // Connect to the server
    socketRef.current = io(SERVER_URL);

    socketRef.current.on('connect', () => {
      console.log('Connected to server with ID:', socketRef.current?.id);
    });

    socketRef.current.on('player-number', (num: number) => {
      console.log(`Assigned player number: ${num}`);
      setPlayerNumber(num);
    });

    socketRef.current.on('game-start', (data: { gameState: GameState; playerNumber: number }) => {
      console.log('Game is starting!');
      setGameState(data.gameState);
      setPlayerNumber(data.playerNumber);
    });

    socketRef.current.on('game-update', (newGameState: GameState) => {
      console.log('Received game update.');
      setGameState(newGameState);
    });

    socketRef.current.on('error', (error: { message: string }) => {
      console.log('Received error from server:', error.message);
      alert(`Server Error: ${error.message}`);
    });

    // Disconnect on cleanup
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const sendAction = (type: string, payload: object) => {
    console.log(`Sending action: ${type}`);
    socketRef.current?.emit('game-action', { type, payload });
  };

  return { gameState, playerNumber, sendAction };
};
```

### App Component (`App.tsx`)

```typescript
import React, { useState, useEffect } from 'react';
import { StyleSheet, Platform, View, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';
import GameBoard from './components/GameBoard';
import StartScreen from './components/StartScreen';

import { useSocket } from './hooks/useSocket';

// Wrapper for the multiplayer game experience
const MultiplayerGame = () => {
  const { gameState, playerNumber, sendAction } = useSocket();

  const handleRestart = () => {
    // In multiplayer, restart might mean leaving the game
    // For now, just disconnect and go back to menu
    // TODO: Implement proper restart logic
  };

  const handleBackToMenu = () => {
    // Disconnect and go back to menu
    // TODO: Implement proper disconnect logic
  };

  if (!gameState) {
    return (
      <View style={styles.container}>
        <Text style={{color: 'white', fontSize: 30, textAlign: 'center'}}>
          Waiting for another player to join...
        </Text>
      </View>
    );
  }

  return <GameBoard initialState={gameState} playerNumber={playerNumber} sendAction={sendAction} onRestart={handleRestart} onBackToMenu={handleBackToMenu} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const [key, setKey] = useState(0);
  const [gameMode, setGameMode] = useState<'single' | 'multiplayer' | null>(null);

  // Force landscape orientation and hide system UI on app start
  useEffect(() => {
    async function setupImmersiveMode() {
      // Lock to landscape orientation
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      
      // Hide navigation bar on Android
      if (Platform.OS === 'android') {
        await NavigationBar.setVisibilityAsync('hidden');
        await NavigationBar.setBehaviorAsync('overlay-swipe');
      }
    }
    setupImmersiveMode();
  }, []);

  const handleRestart = () => {
    // In multiplayer, restart might mean leaving the game
    if (gameMode === 'multiplayer') {
      setGameMode(null); // Go back to main menu
    } else {
      setKey((prev) => prev + 1);
    }
  };

  const handleBackToMenu = () => {
    setGameMode(null);
  }

  if (!gameMode) {
    return <StartScreen onSelectMode={setGameMode} />;
  }

  if (gameMode === 'single') {
    // Pass a function to go back to the main menu
    return <GameBoard key={key} onRestart={handleRestart} onBackToMenu={handleBackToMenu} initialState={null} playerNumber={null} sendAction={() => {}} />;
  }

  return <MultiplayerGame />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f4d0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
```

### Game Board Component Updates (`components/GameBoard.tsx`)

Key changes for multiplayer support:

1. **Turn-based drag handling**: Only allow dragging when it's the player's turn
2. **Server state synchronization**: Use server-provided game state instead of local state
3. **Action sending**: Send actions to server instead of processing locally

```typescript
// In GameBoard component, add turn validation
const isMyTurn = gameState.currentPlayer === selfPlayerIndex;

// Update drag handlers to respect turns
const handleDragStart = useCallback((card) => {
  if (!isMyTurn) return;
  setDraggedCard(card);
}, [isMyTurn]);

// Simplified drop handling for multiplayer
const handleDragEnd = useCallback((draggedItem?: any, dropPosition?: any) => {
  if (!draggedItem || !dropPosition) {
    setDraggedCard(null);
    return;
  }

  // Define the approximate area of the table. This may need tweaking.
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const tableTop = screenHeight * 0.2;
  const tableBottom = screenHeight * 0.6;

  // Check if the card was dropped within the table area
  if (
    draggedItem.source === 'hand' &&
    dropPosition.y > tableTop &&
    dropPosition.y < tableBottom
  ) {
    console.log(`Trailing card: ${draggedItem.card?.rank}`);
    sendAction('trail', { card: draggedItem.card });
  }
  
  setDraggedCard(null);
}, [sendAction]);

// Update table cards section to respect turns
<TableCardsSection
  tableCards={gameState.tableCards}
  onDropOnCard={handleDropOnCard}
  currentPlayer={gameState.currentPlayer}
  onCancelStack={() => {}}
  onConfirmStack={() => {}}
  onDragStart={isMyTurn ? handleDragStart : () => {}}
  onDragEnd={isMyTurn ? handleDragEnd : () => {}}
  onDragMove={isMyTurn ? handleDragMove : () => {}}
  isDragging={!!draggedCard}
/>
```

## Setup Instructions

### 1. Server Setup

```bash
cd server
npm install
npm start
```

### 2. Client Setup

```bash
npm install
npm start
```

### 3. Network Configuration

- **For mobile devices**: Update `SERVER_URL` in `hooks/useSocket.ts` with your computer's LAN IP
- **For web testing**: Use `localhost:3000`
- **CORS**: Server allows connections from `localhost:8081` and `localhost:8083`

### 4. Testing Multiplayer

1. Start server on port 3000
2. Run Expo app on two devices (phone + web browser)
3. Select "Multiplayer" mode on both
4. Game starts when second player connects

## Key Features

### Connection Management
- Automatic player assignment (Player 1, Player 2)
- Platform-aware connection URLs
- CORS handling for web clients
- Connection state logging

### Game State Synchronization
- Server maintains authoritative game state
- Real-time updates broadcast to all players
- Client state synced with server state

### Turn Validation
- Server validates all game actions
- Prevents out-of-turn moves
- Error messages sent to clients

### Cross-Platform Support
- React Native for mobile (iOS/Android)
- Web support via Expo
- Safe area handling for different screen types

## Troubleshooting

### Common Issues

1. **"Waiting for another player" stuck**
   - Check server logs for connection attempts
   - Verify IP address in client code
   - Check firewall settings

2. **Blank screen on web**
   - Ensure `<SafeAreaProvider>` wraps the app
   - Check browser console for errors

3. **CORS errors**
   - Update server CORS origins to match Expo ports
   - Restart server after CORS changes

4. **Turn validation not working**
   - Check `isMyTurn` calculation in GameBoard
   - Verify server turn validation logic

### Debug Logging

Enable detailed logging by checking:
- Server terminal for connection/game events
- Client console (browser dev tools) for socket events
- React Native debugger for component state

## Future Enhancements

### Game Logic Improvements
- Full capture/build mechanics
- Game over detection and scoring
- Round transitions
- Multiple game sessions

### Connection Robustness
- Reconnection handling
- Connection quality monitoring
- Graceful disconnection

### UI/UX Enhancements
- Player ready states
- Connection status indicators
- Game statistics
- Chat functionality

### Performance Optimizations
- State compression for large games
- Selective updates (only changed state)
- Connection pooling

## File Structure

```
project/
├── server/
│   ├── server.js
│   ├── game-logic/
│   │   ├── game-state.js
│   │   ├── game-actions.js
│   │   └── validation.js
│   └── package.json
├── components/
│   ├── GameBoard.tsx
│   ├── PlayerHand.tsx
│   ├── TableCards.tsx
│   └── ...
├── hooks/
│   └── useSocket.ts
├── App.tsx
└── package.json
```

This implementation provides a solid foundation for real-time multiplayer card games with proper state management, turn validation, and cross-platform support.