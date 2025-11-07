import { 
  getCardId, 
  calculateCardSum, 
  rankValue,
  updateGameState,
  handleCapture,
  handleAddToStagingStack,
  handleCreateStagingStack
} from '../game-logic/index.js';
import { 
  validateTemporaryStackBuild,
  validateAddToOpponentBuild,
  validateAddToOwnBuild,
  validateExtendToMerge
} from '../game-logic/validation.js';
import { canPartitionIntoSums } from '../game-logic/index.js';
import {
  DraggedItem,
  TargetInfo,
  GameState,
  Card,
  TemporaryStack,
  TableEntity,
  ActionOption,
  ModalInfo,
  Build
} from '../types/gameTypes';

/**
 * Handles dropping cards from hand onto targets
 * Extracted from useGameActions.js handleDropOnCard function
 * Manages hand card interactions with temporary stacks, loose cards, and builds
 * Now fully typed for TypeScript safety
 */
export const handleHandCardDrop = (
  draggedItem: DraggedItem, 
  targetInfo: TargetInfo, 
  currentGameState: GameState, 
  showError: (message: string) => void, 
  setModalInfo: (modalInfo: ModalInfo | null) => void, 
  executeAction: (gameState: GameState, action: ActionOption) => GameState,
  importedCreateActionOption: (type: string, label: string, payload: any) => ActionOption,
  importedGeneratePossibleActions: (
    draggedItem: DraggedItem,
    looseCard: Card, // This parameter is not used in the current implementation
    playerHand: Card[],
    tableCards: TableEntity[],
    playerCaptures: Card[][][],
    currentPlayer: number
  ) => ActionOption[]
): GameState => {
  const { currentPlayer, playerHands, tableCards, playerCaptures } = currentGameState;
  const draggedCard = draggedItem.card;

  if (!draggedCard) { // Ensure a card is being dragged
    showError("No card found in dragged item.");
    return currentGameState;
  }

  // B.1: Dropped on a temporary stack
  if (targetInfo.type === 'temporary_stack') {
    const stack = tableCards.find(s => 
      (s as TemporaryStack).type === 'temporary_stack' && 
      (s as TemporaryStack).stackId === targetInfo.stackId
    ) as TemporaryStack; // Find the target temporary stack
    
    if (!stack) { 
      showError("Stack not found."); 
      return currentGameState; 
    }
    if (stack.owner !== (currentPlayer - 1)) { // Check owner with 0-based index
      showError("You can only interact with your own temporary stacks."); 
      return currentGameState; 
    }

    const actions: ActionOption[] = [];
    const playerHand = playerHands[currentPlayer - 1];

    // --- Possibility 1: Direct Capture from Temporary Stack ---
    const sumOfStack = calculateCardSum(stack.cards);
    const captureValue = rankValue(draggedCard.rank);

    // Direct capture: if hand card value equals stack sum, perform immediate capture
    if (captureValue === sumOfStack) {
      // Immediately execute capture without going through action selection
      console.log(`Direct capture: ${draggedCard.rank} captures temp stack (sum=${sumOfStack})`);
      return handleCapture(currentGameState, draggedItem, [stack]);
    } 
    
    // Complex capture: if hand card can partition the stack  
    if (sumOfStack % captureValue === 0 && canPartitionIntoSums(stack.cards, captureValue)) { // Check if stack can be partitioned
      actions.push(importedCreateActionOption('capture', `Capture for ${captureValue}`, { draggedItem, targetCard: stack }));
    }

    // --- Possibility 2: Create a permanent build ---
    const buildValidation = validateTemporaryStackBuild(stack, draggedCard, playerHand, tableCards, currentPlayer);
    if (buildValidation.valid) {
      actions.push(importedCreateActionOption('createBuildFromStack', `Build ${buildValidation.newValue}`, { draggedItem, stackToBuildFrom: stack }));
    }

    // --- Decision Logic ---
    if (actions.length === 0) {
      // If no final move is possible, assume the player wants to add the card to the stack.
      
      // Allow adding cards to temp stack without validation during creation
      // Validation will happen at finalization when player clicks tick

      return handleAddToStagingStack(currentGameState, draggedCard, stack);
    } else if (actions.length === 1) {
      return executeAction(currentGameState, actions[0]);
    } else {
      setModalInfo({ title: 'Choose Your Action', message: `What would you like to do with this stack?`, actions: actions });
      return currentGameState;
    }
  }

  // B.2: Dropped on a loose card
  if (targetInfo.type === 'loose') {
    const playerHand = playerHands[currentPlayer - 1];

    // Try to find target card using cardId first (more reliable), then fallback to rank/suit
    let targetCard: Card | undefined = undefined;
    if (targetInfo.cardId) {
      targetCard = tableCards.find(c => !(c as any).type && getCardId(c as Card) === targetInfo.cardId) as Card;
    }
    if (!targetCard) {
      // Fallback to rank/suit matching
      targetCard = tableCards.find(c => !(c as any).type && (c as Card).rank === targetInfo.rank && (c as Card).suit === targetInfo.suit) as Card;
    }

    if (!targetCard) {
      showError("Target card not found on table.");
      return currentGameState;
    }

    // --- Handle dropping a temporary stack onto a loose card ---
    if (draggedItem.source === 'temporary_stack') {
      // Find the staging stack by stackId from the table cards
      const stagingStack = tableCards.find(s => 
        (s as TemporaryStack).type === 'temporary_stack' && 
        (s as TemporaryStack).stackId === draggedItem.stackId
      ) as TemporaryStack;
      
      if (!stagingStack) {
        showError("Staging stack not found on table.");
        return currentGameState;
      }

      // Create a new temporary stack by combining the existing stack with the loose card
      // The loose card goes to the bottom (beginning of cards array) as the base
      const combinedCards: Card[] = [{ ...targetCard, source: 'table' }, ...stagingStack.cards];
      
      const newStack: TemporaryStack = {
        stackId: `temp-${Date.now()}`,
        type: 'temporary_stack',
        cards: combinedCards,
      owner: (currentPlayer - 1), // Set owner with 0-based index
      };

      // FIXED: Maintain exact positions to prevent visual jumping
      // Replace staging stack with new combined stack, remove target card from wherever it was
      const newTableCards = tableCards.map((item, index) => {
        const itemCard = item as Card;
        const itemStack = item as TemporaryStack;
        
        // Replace staging stack with new combined stack
        if (itemStack.stackId === stagingStack.stackId) {
          return newStack;
        }
        
        // Remove target card (return null, will be filtered out)
        if (getCardId(itemCard) === getCardId(targetCard)) {
          return null;
        }
        
        // Keep all other cards in their exact positions
        return item;
      }).filter(item => item !== null); // Remove null entries

      return updateGameState(currentGameState, { tableCards: newTableCards });
    }

    // --- CAPTURE & STAGING LOGIC ---

    // CASINO RULE: Players can only have one temp build active at a time
    const playerAlreadyHasTempStack = tableCards.some(
      s => (s as TemporaryStack).type === 'temporary_stack' && (s as TemporaryStack).owner === (currentPlayer - 1) // check with 0-based index
    );
    if (playerAlreadyHasTempStack) {
      showError("You can only have one staging stack at a time.");
      return currentGameState;
    }

    // Always create staging stack - action selection happens at "done" button
    return handleCreateStagingStack(currentGameState, draggedCard, targetCard);
  }

  // B.3: Dropped on a build
  if (targetInfo.type === 'build') {
    const buildToDropOn = tableCards.find(b => 
      (b as Build).type === 'build' && 
      (b as Build).buildId === targetInfo.buildId
    ) as Build;
    
    if (!buildToDropOn) {
      showError("Target build not found on table. The build may have already been captured.");
      return currentGameState;
    }

    const playerHand = playerHands[currentPlayer - 1]; // Use 0-based index for playerHand
    const actions: ActionOption[] = [];

    // Possibility 1: Capture the build
    if (rankValue(draggedCard.rank) === buildToDropOn.value) {
      actions.push(importedCreateActionOption(
        'capture', `Capture Build (${buildToDropOn.value})`,
        { draggedItem, targetCard: buildToDropOn }
      ));
    }

    // Possibility 2: Extend an opponent's build
    if (buildToDropOn.owner !== (currentPlayer - 1)) { // Check owner with 0-based index
      const playerOwnsBuild = tableCards.find(c =>
        (c as Build).type === 'build' &&
        (c as Build).owner === (currentPlayer - 1)
      ) as Build;

      if (playerOwnsBuild) {
        // Player has a build, so this is a potential "Extend-to-Merge"
        const validation = validateExtendToMerge(playerOwnsBuild, buildToDropOn, draggedCard);
        if (validation.valid) {
          actions.push(importedCreateActionOption(
            'extendToMerge',
            `Merge into your build of ${playerOwnsBuild.value}`,
            { draggedItem, opponentBuild: buildToDropOn, ownBuild: playerOwnsBuild }
          ));
        }
      } else {
        // Standard "Add to Opponent Build"
        const validation = validateAddToOpponentBuild(buildToDropOn, draggedCard, playerHand, tableCards, currentPlayer - 1); // Pass 0-based index
        if (validation.valid) {
          const newBuildValue = buildToDropOn.value + rankValue(draggedCard.rank);
          actions.push(importedCreateActionOption('addToOpponentBuild', `Extend to ${newBuildValue}`, { draggedItem, buildToAddTo: buildToDropOn }));
        }
      }
    }

    // Possibility 3: Add to your own build
    if (buildToDropOn.owner === (currentPlayer - 1)) { // Check owner with 0-based index
      const validation = validateAddToOwnBuild(buildToDropOn, draggedCard, playerHand);
      if (validation.valid) {
        actions.push(importedCreateActionOption(
          'addToOwnBuild', `Add to Build (${validation.newValue})`,
          { draggedItem, buildToAddTo: buildToDropOn }
        ));
      }
    }

    // --- Decision Logic ---
    if (actions.length === 0) {
      if (buildToDropOn.owner === (currentPlayer - 1)) {
        // Try to get a more specific error from validation
        const validation = validateAddToOwnBuild(buildToDropOn, draggedCard, playerHand);
        showError(validation.message || "You cannot add this card to your own build.");
      } else {
        const validation = validateAddToOpponentBuild(buildToDropOn, draggedCard, playerHand, tableCards, currentPlayer - 1);
        showError(validation.message || `Invalid move on build of ${buildToDropOn.value}.`);
      }
      return currentGameState;
    } else if (actions.length === 1) {
      return executeAction(currentGameState, actions[0]);
    } else {
      setModalInfo({
        title: 'Choose Your Action',
        message: `What would you like to do with your ${draggedCard.rank}?`,
        actions: actions,
      });
      return currentGameState;
    }
  }

  // Fallback - should not reach here for hand cards
  showError("Invalid target for hand card drop.");
  return currentGameState;
};
