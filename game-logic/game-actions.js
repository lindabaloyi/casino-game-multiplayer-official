import { updateGameState, nextPlayer } from './game-state.js';
import { rankValue, removeCardFromHand, removeCardsFromTable, sortCardsByRank, calculateCardSum, generateBuildId, findOpponentMatchingCards, createCaptureStack } from './card-operations.js';
import { canPartitionIntoSums } from './algorithms.js';
import { validateBuild, findPossibleBuildsFromStack } from './validation.js';
import { logGameState } from './game-state.js';

export const handleTrail = (gameState, card) => {
  const { playerHands, tableCards, currentPlayer } = gameState;

  // Remove card from hand
  const removalResult = removeCardFromHand(playerHands, currentPlayer, card);
  if (!removalResult) {
    return gameState; // Card not found
  }

  const { updatedHands, cardRemoved } = removalResult;

  // Create new state
  const newState = updateGameState(gameState, {
    playerHands: updatedHands,
    tableCards: [...tableCards, cardRemoved],
  });

  logGameState(`Player ${currentPlayer + 1} trailed a ${cardRemoved.rank}`, nextPlayer(newState));
  return nextPlayer(newState);
};

export const handleBuild = (gameState, draggedItem, tableCardsInBuild, buildValue, biggerCard, smallerCard) => {
  const { playerHands, tableCards, playerCaptures, currentPlayer } = gameState;
  const { card: playerCard, source } = draggedItem;
  const playerHand = playerHands[currentPlayer];

  // 1. Validate the build
  const validation = validateBuild(playerHand, playerCard, buildValue, tableCards, currentPlayer);
  if (!validation.valid) {
    console.warn(validation.message);
    return gameState;
  }

  // 2. Remove the played card from its source (hand or table)
  let newPlayerHands = playerHands;
  let tempTableCards = tableCards; // Start with the original table
  let actualCardUsed = playerCard; // Default to the provided card

  if (source === 'table') {
    tempTableCards = removeCardsFromTable(tableCards, [playerCard]);
  } else { // Default to hand for builds
    const removalResult = removeCardFromHand(playerHands, currentPlayer, playerCard);
    if (!removalResult) return gameState;
    newPlayerHands = removalResult.updatedHands;
    actualCardUsed = removalResult.cardRemoved;
  }

  // 3. Determine the cards that make up the initial build action
  let initialBuildCards;
  if (biggerCard && smallerCard) {
    // Sum build: e.g., player's 6 on table's 2
    initialBuildCards = [biggerCard, smallerCard];
  } else {
    // Same-value build: e.g., player's 8 on table's 8
    const sortedTableCards = sortCardsByRank(tableCardsInBuild);
    initialBuildCards = [...sortedTableCards, playerCard];
  }

  // Create the build using only the explicitly selected cards
  const newBuild = {
    buildId: generateBuildId(),
    type: 'build',
    cards: initialBuildCards,
    value: buildValue,
    owner: currentPlayer,
    isExtendable: true, // Builds are extendable by default
  };

  const finalTableCards = removeCardsFromTable(tempTableCards, tableCardsInBuild);
  finalTableCards.push(newBuild);

  const newState = updateGameState(gameState, {
    playerHands: newPlayerHands,
    tableCards: finalTableCards,
    playerCaptures: playerCaptures,
  });

  logGameState(`Player ${currentPlayer + 1} built a ${buildValue}`, nextPlayer(newState));
  return nextPlayer(newState);
};

export const handleReinforceBuildWithStack = (gameState, stack, targetBuild) => {
  let { playerHands, tableCards, playerCaptures, currentPlayer } = gameState;

  // Validation is handled in useGameActions.js

  // --- EXECUTION ---
  // The card from hand was already removed when the staging stack was created.
  const newPlayerHands = playerHands;
  const cardsForPartition = stack.cards.map(({ source, ...card }) => card); // Strip source for validation

  // NOTE: Opponent capture cards are now removed during temp stack creation
  // to avoid double-removal bug. No need to remove them again here.
  let newPlayerCaptures = [...playerCaptures];

  // Create the new, reinforced build by concatenating the existing build with the new cards.
  // The cards from the stack are already ordered as the user arranged them.
  const allNewBuildCards = [...targetBuild.cards, ...cardsForPartition];

  const newBuild = {
    buildId: generateBuildId(),
    type: 'build',
    cards: allNewBuildCards,
    value: targetBuild.value, // The value of the build does not change
    owner: currentPlayer,      // Ownership is always transferred to the current player
    isExtendable: false,       // Reinforced builds cannot be extended further
  };

  // Update the table by removing the old build and the temporary stack, then adding the new build.
  const itemsToRemoveFromTable = [targetBuild, stack];
  const finalTableCards = removeCardsFromTable(tableCards, itemsToRemoveFromTable);
  finalTableCards.push(newBuild);

  const newState = updateGameState(gameState, {
    playerHands: newPlayerHands,
    tableCards: finalTableCards,
    playerCaptures: newPlayerCaptures,
  });

  logGameState(`Player ${currentPlayer + 1} reinforced a build of ${targetBuild.value}`, nextPlayer(newState));
  return nextPlayer(newState);
};

export const handleBaseBuild = (gameState, draggedItem, baseCard, otherCardsInBuild) => {
  const { playerHands, tableCards, playerCaptures, currentPlayer } = gameState;
  const { card: playerCard, source } = draggedItem;

  let newPlayerHands = playerHands;
  let newTableCards = tableCards;
  let newPlayerCaptures = playerCaptures;

  // A base build should only be initiated from the hand, but we handle sources just in case.
  let actualCardUsed = playerCard; // Default to the provided card

  if (source === 'table') {
    newTableCards = removeCardsFromTable(tableCards, [playerCard]);
  } else { // Default to hand
    const removalResult = removeCardFromHand(playerHands, currentPlayer, playerCard);
    if (!removalResult) return gameState;
    newPlayerHands = removalResult.updatedHands;
    actualCardUsed = removalResult.cardRemoved;
  }


  // Remove baseCard and otherCardsInBuild from table
  const cardsToRemoveFromTable = [baseCard, ...otherCardsInBuild];
  const finalTableCards = removeCardsFromTable(newTableCards, cardsToRemoveFromTable);

  // Construct the new build's cards array with proper combination grouping
  // otherCardsInBuild is an array of combinations, each combination is an array of cards
  let buildCards = [baseCard]; // Start with base card

  // Process each combination: sort within combination (bigger to smaller) and add to build
  otherCardsInBuild.forEach(combination => {
    // Sort each combination by rank (bigger to smaller for proper stacking)
    const sortedCombination = [...combination].sort((a, b) => rankValue(b.rank) - rankValue(a.rank));
    buildCards = [...buildCards, ...sortedCombination];
  });

  // Add player's card on top
  buildCards = [...buildCards, playerCard];

  const newBuild = {
    buildId: generateBuildId(),
    type: 'build',
    cards: buildCards,
    value: playerCard.value,
    owner: currentPlayer,
    isExtendable: false,
  };

  finalTableCards.push(newBuild);

  const newState = updateGameState(gameState, {
    playerHands: newPlayerHands,
    tableCards: finalTableCards,
    playerCaptures: newPlayerCaptures,
  });

  logGameState(`Player ${currentPlayer + 1} created a base build with a ${playerCard.rank}`, nextPlayer(newState));
  return nextPlayer(newState);
};

export const handleCreateBuildFromStack = (gameState, draggedItem, stack) => {
  const { currentPlayer, playerHands, tableCards } = gameState;
  const { card: handCard } = draggedItem;

  // 1. Calculate new build properties
  const stackValue = calculateCardSum(stack.cards);
  const handCardValue = rankValue(handCard.rank);
  const isReinforce = stackValue === handCardValue;
  const newBuildValue = isReinforce ? stackValue : stackValue + handCardValue;


  // Maintain consistent ordering with temp builds - bigger cards at index 0 (bottom of pile)
  // EXCEPTION: Opponent's equal-value capture cards should not be sorted - they stay where player placed them
  const allCardsInBuild = [...stack.cards, handCard];

  // Separate opponent's equal-value capture cards from other cards for sorting
  const opponentEqualValueCards = allCardsInBuild.filter(card =>
    card.source === 'opponentCapture' && rankValue(card.rank) === newBuildValue
  );
  const otherCards = allCardsInBuild.filter(card =>
    !(card.source === 'opponentCapture' && rankValue(card.rank) === newBuildValue)
  );

  // Sort only the other cards, keep opponent's equal-value cards in their original positions
  const sortedOtherCards = otherCards.sort((a, b) => rankValue(b.rank) - rankValue(a.rank));

  // Reconstruct the array: opponent's equal-value cards first (in their original order), then sorted other cards
  const finalCardsInBuild = [...opponentEqualValueCards, ...sortedOtherCards];

  // 2. Create the new build object
  const newBuild = {
    buildId: generateBuildId(),
    type: 'build',
    cards: allCardsInBuild,
    value: newBuildValue,
    owner: currentPlayer,
    isExtendable: !isReinforce,
  };

  // 3. Update game state
  // Remove hand card
  const removalResult = removeCardFromHand(playerHands, currentPlayer, handCard);
  if (!removalResult) {
    console.error("Card for build not found in hand.");
    return gameState;
  }

  const newPlayerHands = removalResult.updatedHands;
  const actualCardUsed = removalResult.cardRemoved;

  // Remove temporary stack from table and add new build (consistent with reinforcement approach)
  const newTableCards = removeCardsFromTable(tableCards, [stack]);
  newTableCards.push(newBuild);

  const newState = updateGameState(gameState, { playerHands: newPlayerHands, tableCards: newTableCards });
  logGameState(`Player ${currentPlayer + 1} created a build of ${newBuildValue} from a stack`, nextPlayer(newState));
  return nextPlayer(newState);
};

export const handleAddToOpponentBuild = (gameState, draggedItem, buildToAddTo) => {
  const { playerHands, tableCards, playerCaptures, currentPlayer } = gameState;
  const { card: playerCard, source } = draggedItem;
  // Validation is handled in useGameActions.

  const newBuildValue = buildToAddTo.value + rankValue(playerCard.rank);

  // Create the new set of cards for the build, maintaining consistent ordering (bigger cards at index 0)
  const newBuildCards = [...buildToAddTo.cards, playerCard];
  const sortedCards = newBuildCards.sort((a, b) => rankValue(b.rank) - rankValue(a.rank));

  const newBuild = {
    buildId: generateBuildId(),
    type: 'build',
    cards: sortedCards,
    value: newBuildValue,
    owner: currentPlayer, // Ownership is transferred to the current player
    isExtendable: sortedCards.length < 5, // A build is extendable until it has 5 cards.
  };

  let newPlayerHands = playerHands;
  let newTableCards = tableCards;
  let newPlayerCaptures = playerCaptures;

  // This action should only come from the hand, but we handle sources for robustness.
  let actualCardUsed = playerCard; // Default to the provided card

  if (source === 'table') {
    newTableCards = removeCardsFromTable(tableCards, [playerCard]);
  } else { // Default to hand
    const removalResult = removeCardFromHand(playerHands, currentPlayer, playerCard);
    if (!removalResult) return gameState;
    newPlayerHands = removalResult.updatedHands;
    actualCardUsed = removalResult.cardRemoved;
  }

  // Remove old build from table and add the new one
  const finalTableCards = removeCardsFromTable(newTableCards, [buildToAddTo]);
  finalTableCards.push(newBuild);

  const newState = updateGameState(gameState, {
    playerHands: newPlayerHands,
    tableCards: finalTableCards,
    playerCaptures: newPlayerCaptures,
  });

  logGameState(`Player ${currentPlayer + 1} extended opponent's build to ${newBuild.value}`, nextPlayer(newState));
  return nextPlayer(newState);
};

export const handleAddToOwnBuild = (gameState, draggedItem, buildToAddTo) => {
  const { card: playerCard } = draggedItem;
  const { currentPlayer, playerHands, tableCards } = gameState;

  // Validation is assumed to have happened in useGameActions

  // Determine if this is a "reinforce" (7 on a 7) or "increase" (2 on a 5) action
  const isReinforce = rankValue(playerCard.rank) === buildToAddTo.value;
  const newBuildValue = isReinforce
    ? buildToAddTo.value
    : buildToAddTo.value + rankValue(playerCard.rank);

  // The new card is always placed on top of the existing build cards.
  const newBuildCards = [...buildToAddTo.cards, playerCard];

  const newBuild = {
    ...buildToAddTo, // Retains original buildId, owner
    value: newBuildValue,
    cards: newBuildCards,
    isExtendable: !isReinforce, // A reinforced build (e.g., 7,7) cannot be extended further
  };

  // Update table: remove old build, add new one
  const newTableCards = tableCards.filter(b => b.buildId !== buildToAddTo.buildId);
  newTableCards.push(newBuild);

  // Update player hand
  const removalResult = removeCardFromHand(playerHands, currentPlayer, playerCard);
  if (!removalResult) {
      console.error("Card for 'add to own build' not found in hand.");
      return gameState; // Should not happen if validation is correct
  }

  const newPlayerHands = removalResult.updatedHands;
  const actualCardUsed = removalResult.cardRemoved;

  const newState = updateGameState(gameState, {
    tableCards: newTableCards,
    playerHands: newPlayerHands,
  });

  logGameState(`Player ${currentPlayer + 1} added to their build, creating a new build of ${newBuildValue}`, nextPlayer(newState));
  return nextPlayer(newState);
};

export const handleCapture = (gameState, draggedItem, selectedTableCards, opponentCard = null) => {
  const { playerHands, tableCards, playerCaptures, currentPlayer } = gameState;
  const { card: selectedCard, source } = draggedItem;

  // --- Contextual check for "Implicit Add to Build" ---
  // If a player has a build, and makes a combination that matches their build's value,
  // it should be treated as adding to the build, not a capture.
  // This should only apply when combining loose cards, not when targeting a build directly.
  const playerOwnBuild = tableCards.find(item => item.type === 'build' && item.owner === currentPlayer);
  const isTargetingBuild = selectedTableCards.some(item => item.type === 'build');

  if (playerOwnBuild && source === 'hand' && !opponentCard && !isTargetingBuild) {
    const potentialStackCards = [selectedCard, ...selectedTableCards.flatMap(item => item.cards || [item])];

    // Check if the combined cards can be partitioned into sums of the build's value.
    // e.g., hand(4) + table(4) for a build of 8.
    if (canPartitionIntoSums(potentialStackCards, playerOwnBuild.value)) {
      // This is an "add to build" action, not a capture.
      const removalResult = removeCardFromHand(playerHands, currentPlayer, selectedCard);
      if (!removalResult) return gameState;
      const newPlayerHands = removalResult.updatedHands;
      const actualCardUsed = removalResult.cardRemoved;

      const allNewBuildCards = [...playerOwnBuild.cards, ...potentialStackCards];

      const newBuild = {
        buildId: generateBuildId(),
        type: 'build',
        cards: allNewBuildCards,
        value: playerOwnBuild.value,
        owner: currentPlayer,
        isExtendable: false, // Reinforced builds cannot be extended further
      };

      const itemsToRemoveFromTable = [playerOwnBuild, ...selectedTableCards];
      const finalTableCards = removeCardsFromTable(tableCards, itemsToRemoveFromTable);
      finalTableCards.push(newBuild);

      const newState = updateGameState(gameState, {
        playerHands: newPlayerHands,
        tableCards: finalTableCards,
      });

      logGameState(`Player ${currentPlayer + 1} reinforced their build of ${playerOwnBuild.value}`, nextPlayer(newState));
      return nextPlayer(newState);
    }
  }

  let newPlayerHands = playerHands;
  let newTableCards = tableCards;
  let newPlayerCaptures = playerCaptures;

  const isFinalizingStack = selectedTableCards.some(item => item.type === 'temporary_stack');

  console.log(`🎯 CAPTURE DEBUG: Player ${currentPlayer + 1} capturing with ${selectedCard.rank}${selectedCard.suit} from ${source}`);
  console.log(`🎯 Table cards before capture:`, tableCards.map(c => c.type ? `${c.type}(${c.cards?.length || 'N/A'})` : `${c.rank}${c.suit}`));
  console.log(`🎯 Selected table cards:`, selectedTableCards.map(c => c.type ? `${c.type}(${c.cards?.length || 'N/A'})` : `${c.rank}${c.suit}`));

  // Update game state
  let actualCardUsed = selectedCard; // Default to the provided card

  if (source === 'table') {
    console.log(`🎯 Removing capturing card ${selectedCard.rank}${selectedCard.suit} from table`);
    newTableCards = removeCardsFromTable(tableCards, [selectedCard]);
    console.log(`🎯 Table after removing capturing card:`, newTableCards.map(c => c.type ? `${c.type}(${c.cards?.length || 'N/A'})` : `${c.rank}${c.suit}`));
  } else { // Default to hand
    // If we are finalizing a stack, the hand card has already been removed.
    if (!isFinalizingStack) {
      const removalResult = removeCardFromHand(playerHands, currentPlayer, selectedCard);
      if (!removalResult) return gameState;
      newPlayerHands = removalResult.updatedHands;
      actualCardUsed = removalResult.cardRemoved;
      console.log(`🎯 Removed ${actualCardUsed.rank}${actualCardUsed.suit} from hand`);
    }
  }

  // Remove captured cards from table
  console.log(`🎯 Removing selected table cards from table...`);
  const finalTableCards = newTableCards.filter(item => {
    // Check if the current table item 'item' is one of the selectedTableCards
    const shouldRemove = selectedTableCards.some(capturedItem => {
      if (item.type === 'build' && capturedItem.type === 'build') {
        return item.buildId === capturedItem.buildId;
      }
      if (item.type === 'temporary_stack' && capturedItem.type === 'temporary_stack') {
        return item.stackId === capturedItem.stackId;
      }
      if (!item.type && !capturedItem.type) {
        const match = item.rank === capturedItem.rank && item.suit === capturedItem.suit;
        if (match) {
          console.log(`🎯 Removing captured card ${item.rank}${item.suit} from table`);
        }
        return match;
      }
      return false;
    });
    return !shouldRemove;
  });
  
  console.log(`🎯 Final table cards after removal:`, finalTableCards.map(c => c.type ? `${c.type}(${c.cards?.length || 'N/A'})` : `${c.rank}${c.suit}`));

  // Handle opponent's card removal if involved
  let finalPlayerCaptures = [...newPlayerCaptures];
  if (opponentCard) {
    const opponentIndex = 1 - currentPlayer; // Get opponent's index
    finalPlayerCaptures[opponentIndex] = newPlayerCaptures[opponentIndex].map(group =>
      group.filter(card =>
        !(card.rank === opponentCard.rank && card.suit === opponentCard.suit)
      )
    ).filter(group => group.length > 0); // Remove empty groups
  }

  // Flatten captured cards from builds and loose cards
  const allCapturedItems = selectedTableCards.flatMap(item =>
    (item.type === 'build' || item.type === 'temporary_stack') ? item.cards : [item]
  );
  console.log(`🎯 All captured items:`, allCapturedItems.map(c => `${c.rank}${c.suit}`));

  // If we are finalizing a stack, the `selectedCard` (from hand) is already inside `allCapturedItems`.
  // We need to remove it to avoid duplication in the capture pile.
  let flattenedCapturedCards = isFinalizingStack
    ? allCapturedItems.filter(c => !(c.source === 'hand' && c.rank === selectedCard.rank && c.suit === selectedCard.suit))
    : allCapturedItems;
  console.log(`🎯 Flattened captured cards after deduplication:`, flattenedCapturedCards.map(c => `${c.rank}${c.suit}`));

  // If the capturing card is from the table, it needs to be included in the capture pile
  if (source === 'table') {
    flattenedCapturedCards = [...flattenedCapturedCards, actualCardUsed];
    console.log(`🎯 Added table capturing card to captured cards:`, flattenedCapturedCards.map(c => `${c.rank}${c.suit}`));
  }

  // Create properly ordered capture stack - use actualCardUsed for hand cards, selectedCard for others
  const capturingCardForStack = source === 'hand' ? actualCardUsed : selectedCard;
  console.log(`🎯 Creating capture stack with:`, {
    capturingCard: `${capturingCardForStack.rank}${capturingCardForStack.suit}`,
    capturedCards: flattenedCapturedCards.map(c => `${c.rank}${c.suit}`),
    opponentCard: opponentCard ? `${opponentCard.rank}${opponentCard.suit}` : 'none'
  });
  const capturedGroup = createCaptureStack(capturingCardForStack, flattenedCapturedCards, opponentCard);
  console.log(`🎯 Final capture group:`, capturedGroup.map(c => `${c.rank}${c.suit}`));

  // Add captured cards to player's captures
  finalPlayerCaptures[currentPlayer] = [...finalPlayerCaptures[currentPlayer], capturedGroup];

  // CRITICAL DEBUG: Check for corrupted cards before state update
  console.log(`🔍 CORRUPTION CHECK - Final table cards:`, finalTableCards.map(c => {
    if (c.type) {
      return `${c.type}(owner:${c.owner || 'none'})`;
    } else {
      return `${c.rank}${c.suit}(player:${c.player || 'none'})`;
    }
  }));
  
  // Check for any cards with invalid player data
  const corruptedCards = finalTableCards.filter(c =>
    (!c.type && c.player && (c.player < 0 || c.player > 1)) ||
    (c.type && c.owner && (c.owner < 0 || c.owner > 1))
  );
  
  if (corruptedCards.length > 0) {
    console.error(`🚨 CORRUPTED CARDS DETECTED:`, corruptedCards.map(c => ({
      card: c.type ? c.type : `${c.rank}${c.suit}`,
      player: c.player,
      owner: c.owner,
      source: c.source
    })));
  }

  const newState = updateGameState(gameState, {
    playerHands: newPlayerHands,
    tableCards: finalTableCards,
    playerCaptures: finalPlayerCaptures,
    lastCapturer: currentPlayer,
  });

  const captureDescription = opponentCard
    ? `Player ${currentPlayer + 1} captured with a ${selectedCard.rank} (using opponent's ${opponentCard.rank})`
    : `Player ${currentPlayer + 1} captured with a ${selectedCard.rank}`;

  logGameState(captureDescription, nextPlayer(newState));
  return nextPlayer(newState);
};

/**
 * Transitions the game to the next round, dealing new cards and carrying over table cards.
 * @param {object} gameState - The current game state.
 * @returns {object} The updated game state for the new round.
 */
export const startNextRound = (gameState) => {
  let { deck, playerHands, tableCards } = gameState;

  // Per the rules, 20 cards should be left for round 2.
  if (deck.length < 20) {
    console.error("Not enough cards in the deck to start round 2.", deck.length);
    // This might indicate an end-of-game condition if the deck is empty.
    return gameState;
  }

  const newPlayerHands = [[...playerHands[0]], [...playerHands[1]]];

  // Create a copy of the deck to avoid mutating the original
  let workingDeck = [...deck];

  // Deal 10 cards to each player for round 2
  for (let i = 0; i < 10; i++) {
    if (workingDeck.length > 0) newPlayerHands[0].push(workingDeck.pop());
    if (workingDeck.length > 0) newPlayerHands[1].push(workingDeck.pop());
  }

  return updateGameState(gameState, {
    deck: workingDeck,
    playerHands: newPlayerHands,
    round: 2,
    // Keep the same table cards from round 1
    tableCards: [...tableCards],
  });
};

/**
 * Sweeps the remaining table cards and gives them to the last player who captured.
 * @param {object} gameState - The current game state.
 * @returns {object} The updated game state.
 */
export const handleSweep = (gameState) => {
  const { tableCards, playerCaptures, lastCapturer } = gameState;

  if (tableCards.length === 0 || lastCapturer === null) {
    return gameState; // Nothing to sweep or no one to give it to
  }

  const flattenedTableCards = tableCards.flatMap(item =>
    item.type === 'build' ? item.cards : [item]
  );

  const newPlayerCaptures = [...playerCaptures];
  // Create a new capture group for the swept cards. The order is immaterial.
  newPlayerCaptures[lastCapturer] = [...newPlayerCaptures[lastCapturer], flattenedTableCards];

  const newState = updateGameState(gameState, {
    tableCards: [], // Clear the table
    playerCaptures: newPlayerCaptures,
  });

  logGameState(`Player ${lastCapturer + 1} swept the remaining cards`, newState);
  return newState;
};

/**
 * Calculates the final scores for each player based on the rules in GEMINI.md.
 * @param {Array<Array<Array<Card>>>} playerCaptures - The captured cards for both players.
 * @returns {Array<number>} The final scores for player 1 and player 2.
 */
export const calculateScores = (playerCaptures) => {
  const details = [
    { mostCards: 0, mostSpades: 0, bigCasino: 0, littleCasino: 0, aces: 0, total: 0, cardCount: 0, spadeCount: 0 },
    { mostCards: 0, mostSpades: 0, bigCasino: 0, littleCasino: 0, aces: 0, total: 0, cardCount: 0, spadeCount: 0 }
  ];

  const allPlayerCards = playerCaptures.map(captures => captures.flat());

  // Tally card counts and spade counts
  details[0].cardCount = allPlayerCards[0].length;
  details[1].cardCount = allPlayerCards[1].length;
  details[0].spadeCount = allPlayerCards[0].filter(c => c.suit === '♠').length;
  details[1].spadeCount = allPlayerCards[1].filter(c => c.suit === '♠').length;

  // Award points for Most Cards (2 pts for most, 1 pt each for a tie)
  if (details[0].cardCount > details[1].cardCount) {
    details[0].mostCards = 2;
  } else if (details[1].cardCount > details[0].cardCount) {
    details[1].mostCards = 2;
  } else if (details[0].cardCount > 0 && details[0].cardCount === details[1].cardCount) {
    details[0].mostCards = 1;
    details[1].mostCards = 1;
  }

  // Award points for Most Spades (2 pts for most, 1 pt each for a tie)
  if (details[0].spadeCount > details[1].spadeCount) {
    details[0].mostSpades = 2;
  } else if (details[1].spadeCount > details[0].spadeCount) {
    details[1].mostSpades = 2;
  } else if (details[0].spadeCount > 0 && details[0].spadeCount === details[1].spadeCount) {
    details[0].mostSpades = 1;
    details[1].mostSpades = 1;
  }

  // Award points for specific cards
  allPlayerCards.forEach((cards, playerIndex) => {
    cards.forEach(card => {
      if (card.rank === 'A') details[playerIndex].aces += 1;
      if (card.rank === '10' && card.suit === '♦') details[playerIndex].bigCasino = 2;
      if (card.rank === '2' && card.suit === '♠') details[playerIndex].littleCasino = 1;
    });
  });

  // Calculate total scores
  details.forEach((playerDetails) => {
    playerDetails.total =
      playerDetails.mostCards +
      playerDetails.mostSpades +
      playerDetails.bigCasino +
      playerDetails.littleCasino +
      playerDetails.aces;
  });

  const finalScores = details.map(d => d.total);
  const winner = finalScores[0] > finalScores[1] ? 0 : (finalScores[1] > finalScores[0] ? 1 : null);

  return { scores: finalScores, details, winner };
};

/**
 * Ends the game, calculates scores, and determines the winner.
 * @param {object} gameState - The current game state.
 * @returns {object} The final game state with scores and winner.
 */
export const endGame = (gameState) => {
  const { scores, details, winner } = calculateScores(gameState.playerCaptures);
  return updateGameState(gameState, { scores, winner, scoreDetails: details, gameOver: true });
};

/**
 * Creates a temporary "staging stack" on the table without ending the player's turn.
 * This is used when a player who already owns a build combines cards on the table.
 * @param {object} gameState - The current game state.
 * @param {object} handCard - The card from the player's hand.
 * @param {object} tableCard - The loose card on the table to stack on.
 * @returns {object} The updated game state with the new staging stack.
 */
export const handleCreateStagingStack = (gameState, handCard, tableCard) => {
  const { playerHands, tableCards, currentPlayer } = gameState;

  // CASINO RULE: Players can only have one temp build active at a time
  const playerAlreadyHasTempStack = tableCards.some(
    s => s.type === 'temporary_stack' && s.owner === currentPlayer
  );
  if (playerAlreadyHasTempStack) {
    console.error("You can only have one staging stack at a time.");
    return gameState;
  }

  const targetIndex = tableCards.findIndex(c => !c.type && c.rank === tableCard.rank && c.suit === tableCard.suit);
  if (targetIndex === -1) {
    console.error("Target card for staging stack not found on table.");
    return gameState;
  }

  // CASINO RULE: Build combinations - smaller cards on top
  const handValue = rankValue(handCard.rank);
  const tableValue = rankValue(tableCard.rank);
  
  const orderedCards = handValue < tableValue
    ? [{ ...tableCard, source: 'table' }, { ...handCard, source: 'hand' }]  // Smaller hand card on top
    : [{ ...handCard, source: 'hand' }, { ...tableCard, source: 'table' }];  // Smaller table card on top

  const newStack = {
    stackId: `temp-${Date.now()}`,
    type: 'temporary_stack',
    cards: orderedCards,
    owner: currentPlayer,
  };

  const removalResult = removeCardFromHand(playerHands, currentPlayer, handCard);
  if (!removalResult) return gameState;
  const newPlayerHands = removalResult.updatedHands;
  const actualCardUsed = removalResult.cardRemoved;

  const finalTableCards = [...tableCards];
  finalTableCards.splice(targetIndex, 1, newStack); // Replace the target card with the new stack

  return updateGameState(gameState, { playerHands: newPlayerHands, tableCards: finalTableCards });
};

/**
 * Adds a card from the player's hand to an existing temporary staging stack.
 * This does not end the player's turn.
 * @param {object} gameState - The current game state.
 * @param {object} handCard - The card from the player's hand to add.
 * @param {object} targetStack - The temporary stack to add the card to.
 * @returns {object} The updated game state.
 */
export const handleAddToStagingStack = (gameState, handCard, targetStack) => {
  const { playerHands, tableCards, currentPlayer } = gameState;

  // 1. Remove card from hand
  const removalResult = removeCardFromHand(playerHands, currentPlayer, handCard);
  if (!removalResult) return gameState;
  const newPlayerHands = removalResult.updatedHands;
  const actualCardUsed = removalResult.cardRemoved;

  // 2. Create the updated stack by adding the new card
  const newStack = { ...targetStack, cards: [...targetStack.cards, { ...handCard, source: 'hand' }] };

  // 3. Update the table by replacing the old stack with the new one
  const stackIndex = tableCards.findIndex(s => s.stackId === targetStack.stackId);
  const newTableCards = [...tableCards];
  if (stackIndex !== -1) {
    newTableCards[stackIndex] = newStack;
  } else {
    // Fallback if something went wrong
    const filteredTable = tableCards.filter(s => s.stackId !== targetStack.stackId);
    filteredTable.push(newStack);
    newTableCards = filteredTable;
  }

  // 4. Return the new state (turn does not end)
  return updateGameState(gameState, { playerHands: newPlayerHands, tableCards: newTableCards });
};

/**
 * Disbands a temporary staging stack when an invalid move is attempted with it.
 * Returns its cards to the table as loose cards and ends the player's turn.
 * @param {object} gameState - The current game state.
 * @param {object} stackToDisband - The temporary stack to disband.
 * @returns {object} The updated game state.
 */
export const handleDisbandStagingStack = (gameState, stackToDisband) => {
  let { playerHands, tableCards, playerCaptures, currentPlayer } = gameState;

  const handCards = [];
  const newLooseCards = [];
  const opponentCards = [];

  // 1. Sort cards back to their original sources by reading their 'source' property
  for (const card of stackToDisband.cards) {
    const cardData = { ...card };
    delete cardData.source; // Clean up the source property

    if (card.source === 'hand') handCards.push(cardData);
    else if (card.source === 'opponentCapture') opponentCards.push(cardData);
    else newLooseCards.push(cardData); // Default to table
  }

  // 2. Update player's hand
  const currentHand = [...playerHands[currentPlayer], ...handCards];
  const newPlayerHands = [...playerHands];
  newPlayerHands[currentPlayer] = currentHand;

  // 3. Update opponent's capture pile (if applicable)
  if (opponentCards.length > 0) {
    const opponentIndex = 1 - currentPlayer;
    let opponentCaps = [...(playerCaptures[opponentIndex] || [])];
    if (opponentCaps.length > 0) {
      // Add cards back to the last capture group
      opponentCaps[opponentCaps.length - 1].push(...opponentCards);
    } else {
      // If opponent had no captures, create a new group
      opponentCaps.push(opponentCards);
    }
    const newPlayerCaptures = [...playerCaptures];
    newPlayerCaptures[opponentIndex] = opponentCaps;
    playerCaptures = newPlayerCaptures;
  }

  // 4. Update table cards by removing the stack and adding back any loose cards
  let newTableCards = tableCards.filter(s => s.stackId !== stackToDisband.stackId);
  newTableCards.push(...newLooseCards);

  // 5. Return the new state and end the player's turn.
  const newState = updateGameState(gameState, { playerHands: newPlayerHands, tableCards: newTableCards, playerCaptures });
  logGameState(`Player ${currentPlayer + 1}'s temporary stack was invalid and disbanded.`, nextPlayer(newState));
  return nextPlayer(newState);
};

/**
 * Cancels a temporary staging stack, returning its cards to their original positions.
 * This does not end the player's turn.
 * @param {object} gameState - The current game state.
 * @param {object} stackToCancel - The temporary stack to cancel.
 * @returns {object} The updated game state.
 */
export const handleCancelStagingStack = (gameState, stackToCancel) => {
  let { playerHands, tableCards, playerCaptures, currentPlayer } = gameState;

  const handCards = [];
  const newLooseCards = [];
  const opponentCards = [];

  // 1. Sort cards back to their original sources by reading their 'source' property
  console.log(`🔧 Cancelling stack with ${stackToCancel.cards.length} cards:`, stackToCancel.cards.map(c => `${c.rank}${c.suit}(${c.source})`));
  
  for (const card of stackToCancel.cards) {
    const cardData = { ...card };
    delete cardData.source; // Clean up the source property

    if (card.source === 'hand') {
      console.log(`🏠 Returning ${card.rank}${card.suit} to hand`);
      handCards.push(cardData);
    } else if (card.source === 'opponentCapture') {
      console.log(`👥 Returning ${card.rank}${card.suit} to opponent captures`);
      opponentCards.push(cardData);
    } else {
      console.log(`🎮 Returning ${card.rank}${card.suit} to table (source: ${card.source || 'undefined'})`);
      newLooseCards.push(cardData); // Default to table
    }
  }
  
  console.log(`🔧 Cancel summary: ${handCards.length} to hand, ${newLooseCards.length} to table, ${opponentCards.length} to opponent`);

  // 2. Update player's hand
  const currentHand = [...playerHands[currentPlayer], ...handCards];
  playerHands = [...playerHands];
  playerHands[currentPlayer] = currentHand;

  // 3. Update opponent's capture pile (if applicable)
  if (opponentCards.length > 0) {
    const opponentIndex = 1 - currentPlayer;
    let opponentCaps = [...(playerCaptures[opponentIndex] || [])];
    if (opponentCaps.length > 0) {
      // Add cards back to the last capture group
      opponentCaps[opponentCaps.length - 1].push(...opponentCards);
    } else {
      // If opponent had no captures, create a new group
      opponentCaps.push(opponentCards);
    }
    playerCaptures = [...playerCaptures];
    playerCaptures[opponentIndex] = opponentCaps;
  }

  // 4. Update table cards by removing the stack and adding back any loose cards
  let newTableCards = tableCards.filter(s => s.stackId !== stackToCancel.stackId);
  newTableCards.push(...newLooseCards);

  // 5. Return the new state (turn does not end)
  return updateGameState(gameState, { playerHands, tableCards: newTableCards, playerCaptures });
};

/**
 * Merges a temporary stack of table cards into the player's own existing build.
 * This action does not end the player's turn.
 * @param {object} gameState - The current game state.
 * @param {object} stack - The temporary stack to merge.
 * @param {object} targetBuild - The player's build to merge into.
 * @returns {object} The updated game state.
 */
export const handleMergeIntoOwnBuild = (gameState, stack, targetBuild) => {
  const { tableCards } = gameState;

  // 1. Get the cards from the stack, stripping the 'source' property.
  const cardsFromStack = stack.cards.map(({ source, ...card }) => card);

  // 2. Combine the cards. The new cards go on top.
  const newBuildCards = [...targetBuild.cards, ...cardsFromStack];

  // 3. Create the new, larger build object, replacing the old one.
  const newBuild = { ...targetBuild, cards: newBuildCards };

  // 4. Update the table by removing the old items and adding the new merged build.
  const newTableCards = removeCardsFromTable(tableCards, [targetBuild, stack]);
  newTableCards.push(newBuild);

  // 5. Return the new state, but DO NOT end the player's turn.
  return updateGameState(gameState, { tableCards: newTableCards });
};

/**
 * Stages a card from the opponent's capture pile onto the table as a new temporary stack.
 * This action does not end the player's turn.
 * @param {object} gameState - The current game state.
 * @param {object} opponentCard - The card from the opponent's capture pile.
 * @returns {object} The updated game state.
 */
export const handleStageOpponentCard = (gameState, opponentCard) => {
  let { playerCaptures, tableCards, currentPlayer } = gameState;

  // CASINO RULE: Players can only have one temp build active at a time
  const playerAlreadyHasTempStack = tableCards.some(
    s => s.type === 'temporary_stack' && s.owner === currentPlayer
  );
  if (playerAlreadyHasTempStack) {
    console.error("You can only have one staging stack at a time.");
    return gameState;
  }

  // 1. Remove the card from the opponent's capture pile
  const opponentIndex = 1 - currentPlayer;
  const opponentCaps = playerCaptures[opponentIndex] || [];

  const newOpponentCaps = opponentCaps.map((group, index) =>
    index === opponentCaps.length - 1 ? group.slice(0, -1) : group
  ).filter(group => group.length > 0); // Remove empty groups if the last card was taken

  const newPlayerCaptures = [...playerCaptures];
  newPlayerCaptures[opponentIndex] = newOpponentCaps;

  // 2. Create a new temporary stack on the table
  const newStack = {
    stackId: `temp-${Date.now()}`,
    type: 'temporary_stack',
    cards: [{ ...opponentCard, source: 'opponentCapture' }], // Tag the card with its origin
    owner: currentPlayer,
  };

  // 3. Return the new state without ending the turn
  return updateGameState(gameState, { playerCaptures: newPlayerCaptures, tableCards: [...tableCards, newStack] });
};

/**
 * Extends an opponent's build and merges it into the player's own build.
 * This is a staging action and does not end the player's turn.
 * @param {object} gameState - The current game state.
 * @param {object} handCard - The card from the player's hand.
 * @param {object} opponentBuild - The opponent's build to extend and absorb.
 * @param {object} ownBuild - The player's own build to merge into.
 * @returns {object} The updated game state.
 */
export const handleExtendToMerge = (gameState, handCard, opponentBuild, ownBuild) => {
  const { playerHands, tableCards, currentPlayer } = gameState;

  // 1. Remove the card from the player's hand.
  const removalResult = removeCardFromHand(playerHands, currentPlayer, handCard);
  if (!removalResult) return gameState;
  const newPlayerHands = removalResult.updatedHands;
  const actualCardUsed = removalResult.cardRemoved;

  // 2. Combine all cards: own build cards + opponent build cards + hand card.
  // Sort the combined cards to ensure bigger cards are at the bottom of the stack.
  const allCards = [...ownBuild.cards, ...opponentBuild.cards, handCard].sort((a, b) => rankValue(b.rank) - rankValue(a.rank));

  // 3. Create the new, massive build, replacing the player's original build.
  const newMergedBuild = { ...ownBuild, cards: allCards, isExtendable: false };

  // 4. Remove the old builds from the table and add the new one.
  const newTableCards = removeCardsFromTable(tableCards, [ownBuild, opponentBuild]);
  newTableCards.push(newMergedBuild);

  // 5. Return the new state without ending the turn.
  return updateGameState(gameState, { playerHands: newPlayerHands, tableCards: newTableCards });
};

/**
 * Finalizes a temporary staging stack. This can result in three outcomes:
 * 1. A single valid build is created, and the new game state is returned.
 * 2. Multiple valid builds are possible, and an 'options' object is returned for UI handling.
 * 3. No valid build is possible, and an 'error' object is returned.
 * @param {object} gameState - The current game state.
 * @param {object} stack - The temporary stack to finalize.
 * @returns {object} The new gameState, or an object with 'options' or 'error'.
 */
export const handleFinalizeStagingStack = (gameState, stack) => {
  const { playerHands, tableCards, currentPlayer } = gameState;
  const playerHand = playerHands[currentPlayer];

  // Find all possible valid builds from this stack
  const possibleBuilds = findPossibleBuildsFromStack(stack, playerHand, tableCards, currentPlayer);

  if (possibleBuilds.length === 0) {
    return { error: true, message: "This stack does not form a valid build with any card in your hand." };
  }

  if (possibleBuilds.length > 1) {
    // Return options for the UI to handle
    const handCardUsed = stack.cards.find(c => c.source === 'hand');
    return {
      options: possibleBuilds,
      stack,
      draggedItem: { card: handCardUsed, source: 'hand' }
    };
  }

  // Only one possible build, so create it.
  const buildValue = possibleBuilds[0];

  // Preserve temp build arrangement: opponent's equal-value cards stay in their positions
  // Only sort cards that don't meet the equal-value capture criteria
  const finalCardsInBuild = stack.cards.map(({ source, ...card }) => card); // Remove source property for final build

  const newBuild = {
    buildId: generateBuildId(),
    type: 'build',
    cards: finalCardsInBuild.map(({ source, ...card }) => card), // Remove source property for final build
    value: buildValue,
    owner: currentPlayer,
    isExtendable: true,
  };

  const newTableCards = tableCards.filter(s => s.stackId !== stack.stackId);
  newTableCards.push(newBuild);

  // The hand card was already removed when the stack was created. The gameState is already correct.
  const newState = updateGameState(gameState, {
    tableCards: newTableCards,
  });
  logGameState(`Player ${currentPlayer + 1} finalized a build of ${newBuild.value}`, nextPlayer(newState));
  return nextPlayer(newState);
};

/**
 * Creates a permanent build from a staging stack with a specific, user-chosen value.
 * @param {object} gameState - The current game state.
 * @param {object} stack - The temporary stack to build from.
 * @param {number} buildValue - The specific value chosen by the user.
 * @returns {object} The updated game state.
 */
export const handleCreateBuildWithValue = (gameState, stack, buildValue) => {
  const { tableCards, currentPlayer } = gameState;

  // 1. Get the cards that make up the build from the stack
  const initialBuildCards = stack.cards.map(({ source, ...card }) => card);

  // Preserve temp build arrangement: maintain exact order from temp stack
  const finalBuildCards = initialBuildCards;

  const newBuild = {
    buildId: generateBuildId(),
    type: 'build',
    cards: finalBuildCards,
    value: buildValue,
    owner: currentPlayer,
    isExtendable: true, // Builds are extendable by default
  };

  // Remove only the staging stack from the table
  const newTableCards = removeCardsFromTable(tableCards, [stack]);
  newTableCards.push(newBuild);

  const newState = updateGameState(gameState, { tableCards: newTableCards });
  logGameState(`Player ${currentPlayer + 1} created a build of ${buildValue}`, nextPlayer(newState));
  return nextPlayer(newState);
};

/**
 * Creates a temporary staging stack with a single card from the player's hand.
 * This is used in Round 2 when a player trails a card. This action does not end the turn.
 * @param {object} gameState - The current game state.
 * @param {object} card - The card from the player's hand.
 * @returns {object} The updated game state.
 */
export const handleStageSingleCardFromHand = (gameState, card) => {
  const { playerHands, tableCards, currentPlayer } = gameState;

  // CASINO RULE: Players can only have one temp build active at a time
  const playerAlreadyHasTempStack = tableCards.some(
    s => s.type === 'temporary_stack' && s.owner === currentPlayer
  );
  if (playerAlreadyHasTempStack) {
    console.error("You can only have one staging stack at a time.");
    return gameState;
  }

  const removalResult = removeCardFromHand(playerHands, currentPlayer, card);
  if (!removalResult) return gameState;
  const newPlayerHands = removalResult.updatedHands;
  const actualCardUsed = removalResult.cardRemoved;

  const newStack = {
    stackId: `temp-${Date.now()}`,
    type: 'temporary_stack',
    cards: [{ ...card, source: 'hand' }], // The single card, tagged with its source
    owner: currentPlayer,
  };

  const newTableCards = [...tableCards, newStack];

  return updateGameState(gameState, { playerHands: newPlayerHands, tableCards: newTableCards });
};

/**
 * Finalizes a single-card staging stack as a trailed card on the table.
 * This action ends the player's turn.
 * @param {object} gameState - The current game state.
 * @param {object} stack - The single-card temporary stack to finalize.
 * @returns {object} The updated game state.
 */
export const handleFinalizeTrail = (gameState, stack) => {
  const { tableCards, currentPlayer } = gameState;

  const cardToTrail = { ...stack.cards[0] };
  delete cardToTrail.source;

  const newTableCards = tableCards.filter(s => s.stackId !== stack.stackId);
  newTableCards.push(cardToTrail);

  const newState = updateGameState(gameState, { tableCards: newTableCards });
  logGameState(`Player ${currentPlayer + 1} trailed a ${cardToTrail.rank}`, nextPlayer(newState));
  return nextPlayer(newState);
};

/**
 * Reinforces an opponent's build with a temporary stack of non-hand cards.
 * This is a staging action that does not end the player's turn.
 * @param {object} gameState - The current game state.
 * @param {object} stack - The temporary stack to merge.
 * @param {object} opponentBuild - The opponent's build to reinforce.
 * @returns {object} The updated game state.
 */
export const handleReinforceOpponentBuildWithStack = (gameState, stack, opponentBuild) => {
  const { tableCards } = gameState;

  // 1. Get the cards from the stack, stripping the 'source' property.
  const cardsFromStack = stack.cards.map(({ source, ...card }) => card);

  // 2. Combine the cards. The new cards go on top.
  const newBuildCards = [...opponentBuild.cards, ...cardsFromStack];

  // 3. Create the new, larger build object. Ownership does NOT change.
  const newBuild = {
    ...opponentBuild,
    cards: newBuildCards,
    isExtendable: false, // Reinforced builds cannot be extended further
  };

  // 4. Update the table by removing the old items and adding the new reinforced build.
  const newTableCards = removeCardsFromTable(tableCards, [opponentBuild, stack]);
  newTableCards.push(newBuild);

  // 5. Return the new state, but DO NOT end the player's turn.
  return updateGameState(gameState, { tableCards: newTableCards });
};
