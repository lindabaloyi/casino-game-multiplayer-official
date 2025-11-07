
import { 
  getCardId, 
  calculateCardSum, 
  rankValue,
  updateGameState
} from '../game-logic/index.js';
import { analyzeCardStack } from '../game-logic/combo-analyzer';
import {
  DraggedItem,
  TargetInfo,
  GameState,
  Card,
  TemporaryStack,
  TableEntity
} from '../types/gameTypes';

/**
 * Handles dropping cards from table/captured sources onto targets
 * Extracted from useGameActions.js handleDropOnCard function
 * Manages temporary stack creation and manipulation for table cards
 * Now fully typed for TypeScript safety
 */
export const handleTableCardDrop = (
  draggedItem: DraggedItem, 
  targetInfo: TargetInfo, 
  currentGameState: GameState, 
  showError: (message: string) => void
): GameState => {
  const { currentPlayer, tableCards, playerCaptures } = currentGameState;
  const draggedCard = draggedItem.card;
  const draggedSource = draggedItem.source;

  if (!draggedCard) {
    showError("No card found in dragged item.");
    return currentGameState;
  }

  let newTableCards = tableCards;
  let newPlayerCaptures = playerCaptures;
  let cardRemoved = false;

  // Step 1: Remove the dragged card from its source
  // NOTE: Opponent capture cards are removed here during staging to avoid double-removal. 
  if (draggedSource === 'table') {
    const originalLength = tableCards.length;
    newTableCards = tableCards.filter(c => getCardId(c as Card) !== getCardId(draggedCard));
    cardRemoved = newTableCards.length < originalLength;
    
    if (!cardRemoved) {
      showError("Could not find the dragged card's source to move it.");
      return currentGameState;
    }
  } else if (draggedSource === 'opponentCapture' || draggedSource === 'captured') {
    // For opponent capture cards, remove them here to avoid double-removal
    const opponentIndex = 1 - (currentPlayer - 1); // Convert currentPlayer to 0-based, then get opponent's 0-based index
    const opponentCaps = [...playerCaptures[opponentIndex]];
    if (opponentCaps.length > 0) {
      const lastGroup = [...opponentCaps[opponentCaps.length - 1]];
      if (lastGroup.length > 0) {
        lastGroup.pop(); // Remove the top card
        if (lastGroup.length > 0) {
          opponentCaps[opponentCaps.length - 1] = lastGroup;
        } else {
          opponentCaps.pop(); // Remove empty group
        }
        const updatedCaptures = [...playerCaptures];
        updatedCaptures[opponentIndex] = opponentCaps;
        newPlayerCaptures = updatedCaptures;
        cardRemoved = true;
      }
    }
    if (!cardRemoved) {
      showError("Could not find the dragged card in opponent's capture pile.");
      return currentGameState;
    }
  } else {
    showError("Unknown card source for temp stack operation.");
    return currentGameState;
  }

  // Step 2: Add the card to the target on the table

  // A.0: Dropped opponent's card on empty area to create single-card temp build
  // ANY player can stage opponent's cards as temp builds for strategic flexibility
  if ((!targetInfo || !targetInfo.type) && draggedSource === 'opponentCapture') {
    // CASINO RULE: Players can only have one temp build active at a time
    const playerAlreadyHasTempStack = tableCards.some( // Check if player already has a temporary stack
      s => (s as TemporaryStack).type === 'temporary_stack' && (s as TemporaryStack).owner === (currentPlayer - 1)
    );
    if (playerAlreadyHasTempStack) {
      showError("You can only have one staging stack at a time.");
      return currentGameState;
    }

    // Create single-card temp build from opponent's card
    const newStack: TemporaryStack = {
      stackId: `temp-${Date.now()}`,
      type: 'temporary_stack',
      cards: [{
        ...draggedCard,
        source: draggedSource,
        rank: draggedCard.rank,
        suit: draggedCard.suit
      }],
      owner: currentPlayer - 1,
    };

    // Add the new temp build to table
    const finalTableCards = [...tableCards, newStack];

    return { ...currentGameState, tableCards: finalTableCards, playerCaptures: newPlayerCaptures };
  }

  // A.1: Dropped on a loose card to create a new stack
  if (targetInfo.type === 'loose') {
    const targetCard = tableCards.find(c => !(c as any).type && getCardId(c as Card) === targetInfo.cardId) as Card;
    if (!targetCard) {
      showError("Target card for stack not found.");
      return currentGameState;
    }
    if (getCardId(draggedCard) === getCardId(targetCard)) {
      return currentGameState; // Prevent self-drop
    }

    // CASINO RULE: Players can only have one temp build active at a time
    const playerAlreadyHasTempStack = tableCards.some( // Check if player already has a temporary stack
      s => (s as TemporaryStack).type === 'temporary_stack' && (s as TemporaryStack).owner === (currentPlayer - 1)
    );
    if (playerAlreadyHasTempStack) {
      showError("You can only have one staging stack at a time.");
      return currentGameState;
    }

    // Find the target card position in the ORIGINAL array before any removals
    const targetIndex = tableCards.findIndex(c => getCardId(c as Card) === getCardId(targetCard));

    // Annotate cards with their source and preserve ALL original properties
    const annotatedTarget: Card = {
      ...targetCard,
      source: 'table',
      rank: targetCard.rank,
      suit: targetCard.suit
    };
    const annotatedDragged: Card = {
      ...draggedCard,
      source: draggedSource,
      rank: draggedCard.rank,
      suit: draggedCard.suit
    };

    // Create ordered cards array
    const orderedCards = [annotatedTarget, annotatedDragged];
    
    // SMART COMBO DETECTION for first drop
    const initialAnalysis = analyzeCardStack(orderedCards);
    if (initialAnalysis.completeCombos.length > 0) {
      console.log(`🎯 Combo detected: ${initialAnalysis.completeCombos[0].cards.map(c => c.rank).join('+')} = ${initialAnalysis.completeCombos[0].value}`);
    }

    const newStack: TemporaryStack = {
      stackId: `temp-${Date.now()}`,
      type: 'temporary_stack',
      cards: orderedCards, // Cards in the new stack
      owner: currentPlayer - 1,
    };

    // FIXED: Maintain exact positions to prevent visual jumping
    // Replace target card with new stack, remove dragged card from wherever it was
    const finalTableCards = tableCards.map((item, index) => {
      const itemCard = item as Card;
      
      // Replace target card with the new stack
      if (getCardId(itemCard) === getCardId(targetCard)) {
        return newStack;
      }
      
      // Remove dragged card (return null, will be filtered out)
      if (getCardId(itemCard) === getCardId(draggedCard)) {
        return null;
      }
      
      // Keep all other cards in their exact positions
      return item;
    }).filter(item => item !== null); // Remove null entries
    
    return { ...currentGameState, tableCards: finalTableCards, playerCaptures: newPlayerCaptures };
  }

  // A.2: Dropped on an existing temporary stack to add to it
  if (targetInfo.type === 'temporary_stack') {
    const targetStack = tableCards.find(s =>
      (s as TemporaryStack).type === 'temporary_stack' &&
      (s as TemporaryStack).stackId === targetInfo.stackId
    ) as TemporaryStack;

    if (!targetStack) {
      showError("Target stack not found.");
      return currentGameState;
    }
    if (targetStack.owner !== (currentPlayer - 1)) {
      showError("You cannot add to another player's temporary stack.");
      return currentGameState;
    }

    // Check if the new card is equal-value to the stack sum (opponent capture rule)
    const stackSum = calculateCardSum(targetStack.cards);
    const draggedValue = rankValue(draggedCard.rank);
    const isEqualValueCapture = draggedValue === stackSum && (draggedSource === 'captured' || draggedSource === 'opponentCapture');
    
    // Preserve all card properties when adding to stack
    const newCardToAdd: Card = {
      ...draggedCard,
      source: draggedSource,
      rank: draggedCard.rank,
      suit: draggedCard.suit
    };
    
    let newCards: Card[];
    if (isEqualValueCapture) {
      // CASINO RULE: Equal-value captured cards go on TOP (player's choice)
      newCards = [...targetStack.cards, newCardToAdd];
    } else {
      // Add card to stack - preserve order and properties
      newCards = [...targetStack.cards, newCardToAdd];
      
      // Optional logging for combo detection (no validation)
      const analysis = analyzeCardStack(newCards);
      if (analysis.completeCombos.length > 0) {
        console.log(`🎯 Combo detected: ${analysis.completeCombos[0].cards.map(c => c.rank).join('+')} = ${analysis.completeCombos[0].value}`);
      }
    }
    
    const newStack: TemporaryStack = { ...targetStack, cards: newCards }; // Create new stack with updated cards
    
    // FIXED: Maintain exact positions to prevent visual jumping
    // Replace target stack with updated stack, remove dragged card from wherever it was
    const finalTableCards = tableCards.map((item, index) => {
      const itemCard = item as Card;
      const itemStack = item as TemporaryStack;
      
      // Replace target stack with updated stack
      if (itemStack.stackId === targetStack.stackId) {
        return newStack;
      }
      
      // Remove dragged card (return null, will be filtered out)
      if (getCardId(itemCard) === getCardId(draggedCard)) {
        return null;
      }
      
      // Keep all other cards in their exact positions
      return item;
    }).filter(item => item !== null); // Remove null entries
    
    return { ...currentGameState, tableCards: finalTableCards, playerCaptures: newPlayerCaptures };
  }

  showError("Invalid move: Cards can only be stacked on loose cards or other temporary stacks.");
  return currentGameState;
};
