import { 
  getCardId, 
  updateGameState
} from '../game-logic/index.js';
import { 
  validateReinforceBuildWithStack,
  validateMergeIntoOwnBuild,
  validateReinforceOpponentBuildWithStack
} from '../game-logic/validation.js';
import { 
  handleDisbandStagingStack,
  handleReinforceBuildWithStack,
  handleMergeIntoOwnBuild,
  handleReinforceOpponentBuildWithStack
} from '../game-logic/index.js';
import {
  DraggedItem,
  TargetInfo,
  GameState,
  Card,
  TemporaryStack,
  Build
} from '../types/gameTypes';

/**
 * Handles dropping temporary stacks onto targets
 * Extracted from useGameActions.js handleDropOnCard function
 * Manages temporary stack interactions with builds and other stacks
 * Now fully typed for TypeScript safety
 */
export const handleTemporaryStackDrop = (
  draggedItem: DraggedItem, 
  targetInfo: TargetInfo, 
  currentGameState: GameState, 
  showError: (message: string) => void
): GameState => {
  const { currentPlayer, tableCards } = currentGameState;

  // Handle dropping temporary stacks on builds
  if (targetInfo.type === 'build') {
    const buildToDropOn = tableCards.find(b => 
      (b as Build).type === 'build' && 
      (b as Build).buildId === targetInfo.buildId
    ) as Build;
    
    if (!buildToDropOn) {
      showError("Target build not found on table. The build may have already been captured.");
      return currentGameState;
    }

    // Find the staging stack by stackId from the table cards
    const stagingStack = tableCards.find(s => 
      (s as TemporaryStack).type === 'temporary_stack' && 
      (s as TemporaryStack).stackId === draggedItem.stackId
    ) as TemporaryStack;
    
    if (!stagingStack) {
      showError("Staging stack not found on table.");
      return currentGameState;
    }
    
    const handCardsInStack = stagingStack.cards.filter(c => c.source === 'hand');

    if (handCardsInStack.length > 0) {
      // This is a "Reinforce" action that uses a hand card and ends the turn.
      const validation = validateReinforceBuildWithStack(stagingStack, buildToDropOn);
      if (!validation.valid) {
        showError(validation.message);
        return handleDisbandStagingStack(currentGameState, stagingStack);
      }
      return handleReinforceBuildWithStack(currentGameState, stagingStack, buildToDropOn);
    } else {
      // No hand cards in stack, so this is a staging move.
      if (buildToDropOn.owner === currentPlayer) {
        // This is a "Merge" action with only table cards that does NOT end the turn.
        const validation = validateMergeIntoOwnBuild(stagingStack, buildToDropOn, currentPlayer);
        if (!validation.valid) {
          showError(validation.message);
          return currentGameState; // Snap back on invalid merge
        }
        return handleMergeIntoOwnBuild(currentGameState, stagingStack, buildToDropOn);
      } else {
        // Disable auto-play: Keep as staging stack instead of auto-reinforcing
        // Player can add more cards and use the existing done button to finalize
        return currentGameState;
      }
    }
  }

  // Handle dropping temporary stacks on other temporary stacks
  if (targetInfo.type === 'temporary_stack') {
    // Find both stacks
    const draggedStack = tableCards.find(s => 
      (s as TemporaryStack).type === 'temporary_stack' && 
      (s as TemporaryStack).stackId === draggedItem.stackId
    ) as TemporaryStack;
    
    const targetStack = tableCards.find(s => 
      (s as TemporaryStack).type === 'temporary_stack' && 
      (s as TemporaryStack).stackId === targetInfo.stackId
    ) as TemporaryStack;
    
    if (!draggedStack || !targetStack) {
      showError("Cannot find stack to combine.");
      return currentGameState;
    }

    if (targetStack.owner !== currentPlayer) {
      showError("You cannot add to another player's temporary stack.");
      return currentGameState;
    }

    // Combine the two stacks
    const combinedCards: Card[] = [...targetStack.cards, ...draggedStack.cards];
    
    const newCombinedStack: TemporaryStack = {
      stackId: `temp-${Date.now()}`,
      type: 'temporary_stack',
      cards: combinedCards,
      owner: currentPlayer,
    };

    // Remove both stacks and add combined stack
    const finalTableCards = tableCards
      .filter(c => 
        (c as TemporaryStack).stackId !== targetStack.stackId && 
        (c as TemporaryStack).stackId !== draggedStack.stackId
      )
      .concat([newCombinedStack]);

    return updateGameState(currentGameState, { tableCards: finalTableCards });
  }

  // Handle dropping temporary stacks on loose cards
  if (targetInfo.type === 'loose') {
    // Find the staging stack by stackId from the table cards
    const stagingStack = tableCards.find(s => 
      (s as TemporaryStack).type === 'temporary_stack' && 
      (s as TemporaryStack).stackId === draggedItem.stackId
    ) as TemporaryStack;
    
    if (!stagingStack) {
      showError("Staging stack not found on table.");
      return currentGameState;
    }

    const targetCard = tableCards.find(c => 
      !(c as any).type && 
      getCardId(c as Card) === targetInfo.cardId
    ) as Card;
    
    if (!targetCard) {
      showError("Target card not found on table.");
      return currentGameState;
    }

    // Create a new temporary stack by combining the existing stack with the loose card
    // The loose card goes to the bottom (beginning of cards array) as the base
    const combinedCards: Card[] = [{ ...targetCard, source: 'table' }, ...stagingStack.cards];
    
    const newStack: TemporaryStack = {
      stackId: `temp-${Date.now()}`,
      type: 'temporary_stack',
      cards: combinedCards,
      owner: currentPlayer,
    };

    // Remove the original stack and loose card, add the new combined stack
    const newTableCards = tableCards
      .filter(c => 
        (c as TemporaryStack).stackId !== stagingStack.stackId && 
        getCardId(c as Card) !== getCardId(targetCard)
      )
      .concat([newStack]);

    return updateGameState(currentGameState, { tableCards: newTableCards });
  }

  // Fallback for unhandled temporary stack drops
  showError("Temporary stack drop not handled properly. This should not occur.");
  return currentGameState;
};