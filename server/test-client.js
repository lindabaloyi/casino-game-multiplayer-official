const { io } = require("socket.io-client");

// Connect to the server
const socket = io("http://localhost:3000");

console.log('Attempting to connect to the server...');

socket.on('connect', () => {
  console.log('Successfully connected with ID:', socket.id);
});

socket.on('player-number', (number) => {
    console.log(`The server assigned me as Player #${number}`);
});

socket.on('game-start', (data) => {
  console.log('\n--- GAME HAS STARTED! ---');
  console.log(`I am Player #${data.playerNumber}`);
  console.log('Initial table cards:', data.gameState.table.map(c => `${c.rank} of ${c.suit}`));
  console.log('-------------------------\n');
});

socket.on('disconnect', () => {
  console.log('Disconnected from server.');
});

socket.on('connect_error', (err) => {
    console.error('Connection Error:', err.message);
});
