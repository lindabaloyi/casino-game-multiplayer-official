const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

app.get('/', (req, res) => {
  res.send('Server is running.');
});

const { initializeGame } = require('./game-logic/game-state');
const {
  handleTrail,
  handleCapture,
  handleBuild,
  handleAddToOpponentBuild,
  handleAddToOwnBuild,
  handleBaseBuild,
  handleCreateBuildFromStack,
  handleExtendToMerge,
  handleReinforceOpponentBuildWithStack,
  handleCreateBuildWithValue,
  handleCreateStagingStack
} = require('./game-logic/game-actions');

let players = [];
let gameState = null;

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);
  players.push(socket);
  console.log(`Total players connected: ${players.length}`);

  // Assign player number
  const playerNumber = players.length;
  console.log(`Assigning player number ${playerNumber - 1} to socket: ${socket.id}`); // Emit 0-indexed player number
  socket.emit('player-number', playerNumber - 1); // Emit 0-indexed player number

  if (players.length === 2) {
    // Start the game
    gameState = initializeGame(); // initializeGame should return 0-indexed currentPlayer
    console.log('Two players connected. Starting game...');

    // Emit game state to both players
    players.forEach((playerSocket, index) => {
      console.log(`Emitting game-start to playerSocket ${playerSocket.id} as playerNumber ${index}`);
      playerSocket.emit('game-start', { gameState, playerNumber: index });
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
      if (playerIndex !== gameState.currentPlayer) {
        console.log(`Rejected action from playerIndex ${playerIndex} because it's player ${gameState.currentPlayer}'s turn.`);
        return socket.emit('error', { message: "It's not your turn." });
      }
    console.log(`Received action: ${action.type} from player ${gameState.currentPlayer}`);

    let newGameState = gameState;

    try {
      switch (action.type) {
        case 'trail':
          console.log(`DEBUG: Received card for trail:`, action.payload.card);
          console.log(`DEBUG: Player ${playerIndex + 1} hand before trail:`, gameState.playerHands[playerIndex]);
          newGameState = handleTrail(gameState, action.payload.card);
          break;

        case 'capture':
          // Client now sends a specific 'capture' action.
          const { draggedItem, selectedTableCards, targetCard } = action.payload;
          // Handle both old format (selectedTableCards) and new format (targetCard)
          const cardsToCapture = selectedTableCards || (targetCard ? [targetCard] : []);
          newGameState = handleCapture(gameState, draggedItem, cardsToCapture);
          break;
        
        case 'createStagingStack':
          console.log(`DEBUG: Received createStagingStack action:`, action.payload);
          const { draggedItem: stagingDraggedItem, targetCard: stagingTargetCard } = action.payload;
          newGameState = handleCreateStagingStack(gameState, stagingDraggedItem.card, stagingTargetCard);
          break;

        case 'build':
          console.log(`DEBUG: Received build action:`, action.payload);
          const { draggedItem: buildDraggedItem, targetCard: buildTargetCard, buildValue, biggerCard, smallerCard } = action.payload;
          newGameState = handleBuild(gameState, buildDraggedItem, [buildTargetCard], buildValue, biggerCard, smallerCard);
          break;

        case 'addToOpponentBuild':
          console.log(`DEBUG: Received addToOpponentBuild action:`, action.payload);
          const { draggedItem: opponentBuildDraggedItem, buildToAddTo } = action.payload;
          newGameState = handleAddToOpponentBuild(gameState, opponentBuildDraggedItem, buildToAddTo);
          break;

        case 'addToOwnBuild':
          console.log(`DEBUG: Received addToOwnBuild action:`, action.payload);
          const { draggedItem: ownBuildDraggedItem, buildToAddTo: ownBuildToAddTo } = action.payload;
          newGameState = handleAddToOwnBuild(gameState, ownBuildDraggedItem, ownBuildToAddTo);
          break;

        case 'baseBuild':
          console.log(`DEBUG: Received baseBuild action:`, action.payload);
          const { draggedItem: baseBuildDraggedItem, baseCard, otherCardsInBuild } = action.payload;
          newGameState = handleBaseBuild(gameState, baseBuildDraggedItem, baseCard, otherCardsInBuild);
          break;

        case 'createBuildFromStack':
          console.log(`DEBUG: Received createBuildFromStack action:`, action.payload);
          const { draggedItem: stackDraggedItem, stackToBuildFrom } = action.payload;
          newGameState = handleCreateBuildFromStack(gameState, stackDraggedItem, stackToBuildFrom);
          break;

        case 'extendToMerge':
          console.log(`DEBUG: Received extendToMerge action:`, action.payload);
          const { draggedItem: mergeDraggedItem, opponentBuild, ownBuild } = action.payload;
          newGameState = handleExtendToMerge(gameState, mergeDraggedItem.card, opponentBuild, ownBuild);
          break;

        case 'reinforceOpponentBuild':
          console.log(`DEBUG: Received reinforceOpponentBuild action:`, action.payload);
          const { stack, targetBuild } = action.payload;
          newGameState = handleReinforceOpponentBuildWithStack(gameState, stack, targetBuild);
          break;

        case 'createBuildWithValue':
          console.log(`DEBUG: Received createBuildWithValue action:`, action.payload);
          const { stack: buildStack, buildValue: chosenBuildValue } = action.payload;
          newGameState = handleCreateBuildWithValue(gameState, buildStack, chosenBuildValue);
          break;

        default:
          console.log(`Unknown action type: ${action.type}`);
          return socket.emit('error', { message: `Unknown action type: ${action.type}` });
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
    console.log('user disconnected:', socket.id);
    players = players.filter(p => p.id !== socket.id);
    console.log(`Total players after disconnect: ${players.length}`);
    // Simple reset for MVP. A real implementation would handle this more gracefully.
    if (players.length < 2) {
        gameState = null;
        console.log('A player disconnected. Game reset.');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on *:${PORT}`);
});
