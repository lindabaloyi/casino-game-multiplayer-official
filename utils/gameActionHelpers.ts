import { rankValue, findBaseBuilds } from '../game-logic/index.js';
import { 
  ActionOption, 
  ActionPayload, 
  DraggedItem, 
  Card, 
  TableEntity, 
  ActionType 
} from '../types/gameTypes';

/**
 * Game Action Helper Functions
 * Extracted from useGameActions.js for better organization and reusability
 * Now fully typed for TypeScript safety
 */

// Helper function to create action options for modal
export const createActionOption = (
  type: string, 
  label: string, 
  payload: ActionPayload
): ActionOption => ({
  type,
  label,
  payload
});

// Helper function to check if player can create a build
export const canCreateBuild = (
  playerHand: Card[], 
  draggedCard: Card, 
  buildValue: number
): boolean => {
  return playerHand.some(c => 
    rankValue(c.rank) === buildValue &&
    (c.rank !== draggedCard.rank || c.suit !== draggedCard.suit)
  );
};

// Helper function to generate possible actions for loose card drops
export const generatePossibleActions = (
  draggedItem: DraggedItem, 
  looseCard: Card, 
  playerHand: Card[], 
  tableCards: TableEntity[], 
  playerCaptures: Card[][][], 
  currentPlayer: number
): ActionOption[] => {
  const actions: ActionOption[] = [];
  const { card: draggedCard } = draggedItem;
  
  if (!draggedCard) {
    return actions; // Return empty array if no dragged card
  }
  
  const remainingHand = playerHand.filter(c =>
    c.rank !== draggedCard.rank || c.suit !== draggedCard.suit
  );

  const opponentIndex = 1 - (currentPlayer - 1);
  const opponentCaptures = playerCaptures[opponentIndex] || [];

  const canPlayerCreateBuild = !tableCards.some(c =>
    (c as any).type === 'build' && (c as any).owner === (currentPlayer - 1)
  );

  // --- Possibility 1: Capture ---
  if (rankValue(draggedCard.rank) === rankValue(looseCard.rank)) {
    actions.push(createActionOption(
      'capture',
      `Capture ${looseCard.rank}`,
      { draggedItem, targetCard: looseCard }
    ));
  }

  // --- Possibility 2: Same-Value Build ---
  if (canPlayerCreateBuild && rankValue(draggedCard.rank) === rankValue(looseCard.rank)) {
    // To create a same-value build, you must have another card of the same rank in your hand to capture it.
    const canCaptureBuild = remainingHand.some(c => rankValue(c.rank) === rankValue(draggedCard.rank));
    if (canCaptureBuild) {
      actions.push(createActionOption(
        'build',
        `Build ${rankValue(draggedCard.rank)}`,
        { draggedItem, targetCard: looseCard, buildValue: rankValue(draggedCard.rank) }
      ));
    }
  }

  // --- Possibility 3: Sum Build ---
  if (canPlayerCreateBuild) {
    const sumBuildValue = rankValue(draggedCard.rank) + rankValue(looseCard.rank);
    if (sumBuildValue <= 10) {
      // To create a sum build, you must have a card in hand matching the sum.
      const canCaptureSumBuild = remainingHand.some(c => rankValue(c.rank) === sumBuildValue);
      if (canCaptureSumBuild) {
        const biggerCard = rankValue(draggedCard.rank) > rankValue(looseCard.rank) ? draggedCard : looseCard;
        const smallerCard = rankValue(draggedCard.rank) > rankValue(looseCard.rank) ? looseCard : draggedCard;
        actions.push(createActionOption(
          'build',
          `Build ${sumBuildValue}`,
          {
            draggedItem,
            targetCard: looseCard,
            buildValue: sumBuildValue,
            biggerCard,
            smallerCard
          }
        ));
      }
    }
  }

  // --- Possibility 4: Base Builds (if applicable) ---
  if (canPlayerCreateBuild && rankValue(draggedCard.rank) !== rankValue(looseCard.rank)) {
    const baseBuildCombinations = findBaseBuilds(draggedCard, looseCard, tableCards);
    baseBuildCombinations.forEach(combination => {
      actions.push(createActionOption(
        'baseBuild',
        `Build ${rankValue(draggedCard.rank)} on ${looseCard.rank} with ${combination.map(c => c.rank).join('+')}`,
        { draggedItem, baseCard: looseCard, otherCardsInBuild: combination }
      ));
    });
  }

  return actions;
};
