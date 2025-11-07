import { useState, useCallback, useEffect } from 'react';
import { getErrorInfo } from '../utils/errorMapping';
import { hasAnyContact } from '../utils/simpleContactDetection';
import { useNotifications as importedUseNotifications } from '../hooks/useNotifications';
import { useModalManager } from '../hooks/useModalManager';
import {
  createActionOption as importedCreateActionOption,
  canCreateBuild as importedCanCreateBuild,
  generatePossibleActions as importedGeneratePossibleActions
} from '../utils/gameActionHelpers';
import { handleTableCardDrop } from '../handlers/handleTableCardDrop';
import { handleHandCardDrop } from '../handlers/handleHandCardDrop';
import { handleTemporaryStackDrop } from '../handlers/handleTemporaryStackDrop';
import {
  initializeGame,
  updateGameState,
  handleBuild,
  handleCapture,
  handleTrail,
  handleBaseBuild,
  handleAddToOpponentBuild,
  startNextRound,
  handleSweep,
  calculateScores,
  endGame,
  handleAddToOwnBuild,
  handleCreateBuildFromStack,
  handleCreateStagingStack,
  handleReinforceBuildWithStack,
  handleAddToStagingStack,
  handleDisbandStagingStack,
  handleCancelStagingStack,
  handleMergeIntoOwnBuild,
  handleStageOpponentCard,
  handleExtendToMerge,
  handleReinforceOpponentBuildWithStack,
  handleFinalizeStagingStack,
  handleCreateBuildWithValue,
  handleStageSingleCardFromHand,
  handleFinalizeTrail
} from '../game-logic/index.js';

import { 
  rankValue, 
  findBaseBuilds, 
  findOpponentMatchingCards, 
  countIdenticalCardsInHand, 
  getCardId, 
  calculateCardSum, 
  canPartitionIntoSums 
} from '../game-logic/index.js';

import { 
  validateAddToOpponentBuild, 
  validateTrail, 
  validateAddToOwnBuild, 
  validateTemporaryStackBuild, 
  validateReinforceBuildWithStack, 
  validateMergeIntoOwnBuild, 
  validateExtendToMerge, 
  validateReinforceOpponentBuildWithStack, 
  findPossibleBuildsFromStack 
} from '../game-logic/validation.js';

import { analyzeCardStack, validateNewCardAddition, getCandidateTargetValues, validateComboSorting } from '../game-logic/combo-analyzer';

import {
  GameState,
  ErrorModalState,
  Card,
  DraggedItem,
  TargetInfo,
  ActionOption,
  ModalInfo,
  TemporaryStack,
  GameActionsReturn,
  Build
} from '../types/gameTypes';

export const useGameActions = (): GameActionsReturn => {
  const [gameState, setGameState] = useState<GameState>(initializeGame());
  const [errorModal, setErrorModal] = useState<ErrorModalState>({ visible: false, title: '', message: '' });
  const { modalInfo, setModalInfo, handleModalAction: modalHandleAction, showModal, closeModal } = useModalManager();
  const { showError, showWarning, showInfo } = importedUseNotifications(setErrorModal);

  // Effect to handle end of round and end of game
  useEffect(() => {
    const { playerHands, deck, gameOver, round } = gameState;

    // Don't run if game is already over
    if (gameOver) return;

    // Condition for end of a round: both hands are empty
    if (playerHands[0].length === 0 && playerHands[1].length === 0) {
      // Use a timeout to allow players to see the final board state
      const timer = setTimeout(() => {
        setGameState(currentState => {
          // Re-check to prevent race conditions
          if (currentState.gameOver || (currentState.playerHands[0].length !== 0 || currentState.playerHands[1].length !== 0)) {
            return currentState;
          }

          // After round 1, start round 2
          if (currentState.round === 1) {
            showInfo("🎰 Round 1 Complete! 🎰\n\nStarting Round 2 with table cards carried over...", 3000);
            return startNextRound(currentState);
          }
          // After round 2, end the game
          else if (currentState.round === 2) {
            let finalState = { ...currentState };
            // Sweep remaining cards if any
            if (finalState.tableCards.length > 0 && finalState.lastCapturer !== null) {
              showInfo(`Player ${finalState.lastCapturer + 1} sweeps the table.`);
              finalState = handleSweep(finalState);
            }
            showInfo("Game over! Tallying points...");
            return endGame(finalState);
          }
          return currentState;
        });
      }, 2000); // 2-second delay

      return () => clearTimeout(timer); // Cleanup timer on unmount or re-render
    }
  }, [gameState, showInfo]);

  const handleTrailCard = useCallback((card: Card, player: number, dropPosition: any = null): void => {
    setGameState(currentGameState => {
      // Turn validation removed - players can play anytime
      
      const { tableCards, round, currentPlayer, playerHands } = currentGameState;

      // In Round 2, trailing a card creates a temporary stack instead.
      if (round === 2) { // In Round 2, trailing a card creates a temporary stack instead.
        const playerAlreadyHasTempStack = tableCards.some(
          s => (s as TemporaryStack).type === 'temporary_stack' && (s as TemporaryStack).owner === (currentPlayer - 1)
        );
        if (playerAlreadyHasTempStack) {
          showError("You can only have one staging stack at a time.");
          return currentGameState;
        }
        return handleStageSingleCardFromHand(currentGameState, card);
      }

      // A trail action is initiated by dropping a card on an empty area of the table.
      // The `handleDropOnCard` function will handle drops on other cards.
      // Validate the trail before executing

      const validation = validateTrail(tableCards, card, player - 1, round); // Convert to 0-based for validation
      if (!validation.valid) {
        showError(validation.message);
        return currentGameState;
      }

      // Execute trail action directly without confirmation
      return handleTrail(currentGameState, card);
    });
  }, [showError, setModalInfo]);

  // Centralized helper to execute actions and update state.
  // Wrapped in useCallback to be stable and prevent re-renders of dependent hooks.
  const executeAction = useCallback((currentGameState: GameState, action: ActionOption): GameState => {
    if (!action) return currentGameState;
    // Special case for end_game which doesn't need payload
    if (action.type === 'end_game') {
      // Handle end game immediately without payload requirements
      console.log('Manual game end triggered');
      let finalState = { ...currentGameState };
      
      // If there are cards on the table and someone captured last, sweep them first
      if (finalState.tableCards.length > 0 && finalState.lastCapturer !== null) {
        console.log(`Sweeping remaining ${finalState.tableCards.length} table cards to player ${finalState.lastCapturer + 1}`);
        finalState = handleSweep(finalState);
      }
      
      return endGame(finalState);
    }
    
    if (!action.payload) return currentGameState;
    const { draggedItem } = action.payload;

    switch (action.type) { // Execute the action based on its type
      case 'capture':
        return handleCapture(currentGameState, draggedItem, [action.payload.targetCard]);
      case 'build':
        return handleBuild(
          currentGameState,
          draggedItem,
          [action.payload.targetCard],
          action.payload.buildValue,
          action.payload.biggerCard,
          action.payload.smallerCard
        );
      case 'baseBuild':
        return handleBaseBuild(currentGameState, draggedItem, action.payload.baseCard, action.payload.otherCardsInBuild);
      case 'addToOpponentBuild':
        return handleAddToOpponentBuild(currentGameState, { ...draggedItem, player: currentGameState.currentPlayer - 1 }, action.payload.buildToAddTo); // Pass 0-based player index
      case 'addToOwnBuild':
        return handleAddToOwnBuild(currentGameState, draggedItem, action.payload.buildToAddTo);
      case 'createBuildFromStack':
        return handleCreateBuildFromStack(currentGameState, draggedItem, action.payload.stackToBuildFrom);
      case 'extendToMerge':
        return handleExtendToMerge(currentGameState, draggedItem.card, action.payload.opponentBuild, action.payload.ownBuild);
      case 'reinforceOpponentBuild':
        return handleReinforceOpponentBuildWithStack(currentGameState, action.payload.stack, action.payload.targetBuild); // This function already handles currentPlayer internally
      case 'createBuildWithValue':
        return handleCreateBuildWithValue(currentGameState, action.payload.stack, action.payload.buildValue);
      default:
        return currentGameState;
    }
  }, []);

  const handleModalAction = useCallback((action: ActionOption): void => {
    modalHandleAction(action, (action: ActionOption) => {
      setGameState(currentGameState => executeAction(currentGameState, action));
    });
  }, [modalHandleAction, executeAction]);

  const handleDropOnCard = useCallback((draggedItem: DraggedItem, targetInfo: TargetInfo): void => {
    console.log(`🎯 DROP ON CARD: ${draggedItem.source} -> ${targetInfo?.type || 'empty'}`, { draggedItem, targetInfo });

    if (!draggedItem) {
      console.warn("Drop action is missing dragged item information.");
      return;
    }

    // Allow empty area drops for opponent's cards if player has active build
    const isEmptyAreaDrop = !targetInfo || !targetInfo.type;
    if (isEmptyAreaDrop && draggedItem.source !== 'opponentCapture') {
      console.warn("Empty area drops are only allowed for opponent's cards.");
      return;
    }
    // This check is now more robust. It allows items that are either a single card, a stack, or a temporary stack.
    if (!draggedItem.card && !draggedItem.stack && draggedItem.source !== 'temporary_stack') {
      console.warn("Drop on card stack was ambiguous, no action taken. Dragged item is missing 'card' or 'stack' property.", draggedItem);
      return;
    }

    // Get fresh game state for turn validation
    setGameState(currentGameState => {
      const { currentPlayer, playerHands, tableCards, playerCaptures } = currentGameState;
      // Handle different payload structures: regular cards vs temporary stacks
      const draggedCard = draggedItem.card; // May be undefined for temporary stacks
      const draggedSource = draggedItem.source; // Source of the dragged item

      console.log(`🎯 DROP PROCESSING: Player ${currentPlayer + 1} dropping ${draggedCard?.rank}${draggedCard?.suit} from ${draggedSource} onto ${targetInfo.type}`);

      // Turn validation removed - players can drop anytime

      // Route to appropriate handler based on source type
      if (draggedSource === 'table' || draggedSource === 'opponentCapture' || draggedSource === 'captured') {
        // Handle empty area drops for opponent's cards (create single-card temp builds)
        if (isEmptyAreaDrop && draggedSource === 'opponentCapture') {
          // Create empty targetInfo for single-card temp build creation
          const emptyTargetInfo = { type: null }; // No specific target, just an empty area
          return handleTableCardDrop(draggedItem, emptyTargetInfo as any, currentGameState, showError);
        }
        return handleTableCardDrop(draggedItem, targetInfo, currentGameState, showError);
      } else if (draggedSource === 'hand') {
        // Handle hand card drops with inline build logic to prevent trail fallback
        if (targetInfo.type === 'build') {
          // INLINE BUILD DROP LOGIC - Prevents trail fallback when showing modal
          console.log(`🎯 BUILD DROP: Processing build drop for ${draggedCard.rank} on build ${targetInfo.buildId}`);
          
          const buildToDropOn = tableCards.find(b =>
            (b as any).type === 'build' && (b as any).buildId === targetInfo.buildId
          ) as Build;
          
          if (!buildToDropOn) {
            console.log(`❌ BUILD DROP: Build ${targetInfo.buildId} not found`);
            showError("Target build not found on table. The build may have already been captured.");
            return currentGameState;
          }

          console.log(`✅ BUILD DROP: Found build owned by player ${buildToDropOn.owner + 1}, current player is ${currentPlayer + 1}`);
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
          if (buildToDropOn.owner !== (currentPlayer - 1)) {
            const playerOwnsBuild = tableCards.find(c =>
              (c as any).type === 'build' && (c as any).owner === (currentPlayer - 1) // Check with 0-based index
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
          if (buildToDropOn.owner === (currentPlayer - 1)) { // Check with 0-based index
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
              const validation = validateAddToOwnBuild(buildToDropOn, draggedCard, playerHand); // playerHand is already 0-indexed
              showError(validation.message || "You cannot add this card to your own build.");
            } else {
              const validation = validateAddToOpponentBuild(buildToDropOn, draggedCard, playerHand, tableCards, currentPlayer - 1);
              showError(validation.message || `Invalid move on build of ${buildToDropOn.value}.`);
            }
            return currentGameState;
          } else if (actions.length === 1) {
            return executeAction(currentGameState, actions[0]);  // Immediate execution
          } else {
            setModalInfo({  // Show modal for multiple choices
              title: 'Choose Your Action',
              message: `What would you like to do with your ${draggedCard.rank}?`,
              actions: actions,
            });
            return currentGameState;  // State unchanged, but drop is "handled" via modal
          }
        } else {
          // For non-build targets, use external handler (loose cards, temp stacks)
          return handleHandCardDrop(
            draggedItem,
            targetInfo,
            currentGameState,
            showError,
            setModalInfo,
            executeAction,
            importedCreateActionOption,
            importedGeneratePossibleActions
          );
        }
      } else if (draggedSource === 'temporary_stack') {
        return handleTemporaryStackDrop(draggedItem, targetInfo, currentGameState, showError);
      } else {
        showError("Unknown drop source type.");
        return currentGameState;
      }
    });
  }, [showError, setModalInfo, executeAction]);

  const handleStageOpponentCardAction = useCallback((item: { card: Card; player: number }): void => {
    setGameState(currentGameState => {
      // Turn validation removed - players can stage anytime
      
      // --- NEW VALIDATION: Enforce one temp stack at a time ---
      const { tableCards, currentPlayer } = currentGameState;
      const playerAlreadyHasTempStack = tableCards.some(
        s => (s as TemporaryStack).type === 'temporary_stack' && (s as TemporaryStack).owner === (currentPlayer - 1) // Check with 0-based index
      );
      if (playerAlreadyHasTempStack) {
        showError("You can only have one staging stack at a time.");
        return currentGameState;
      }
      return handleStageOpponentCard(currentGameState, item.card);
    });
  }, [showError]);

  const handleCancelStagingStackAction = useCallback((stack: TemporaryStack): void => {
    setGameState(currentGameState => {
      return handleCancelStagingStack(currentGameState, stack);
    });
  }, []);

  const handleConfirmStagingStackAction = useCallback((stack: TemporaryStack): void => {
    setGameState(currentGameState => {
      // If multiplayer (sendAction exists), send finalizeStagingStack action to server instead of local modal logic
      if (typeof window !== 'undefined' && (window as any).multiplayer && (window as any).sendAction) {
        (window as any).sendAction('finalizeStagingStack', { stack });
        return currentGameState; // Wait for server response to update state/modal
      }
  
      // --- Handle single-card trail confirmation ---
      if (stack.cards.length === 1 && stack.cards[0].source === 'hand') {
        // This is a confirmation of a trail action in round 2.
        return handleFinalizeTrail(currentGameState, stack);
      }
  
      const { playerHands, tableCards, currentPlayer } = currentGameState;
      const playerHand = playerHands[currentPlayer - 1]; // Use 0-based index for playerHand
      const actions: ActionOption[] = [];
  
      // --- Validation: A final stack must have exactly one hand card ---
      const handCardsInStack = stack.cards.filter(c => c.source === 'hand'); // Filter hand cards from the stack
      if (handCardsInStack.length !== 1) {
        showError("A final move must be made with exactly one card from your hand.");
        return handleDisbandStagingStack(currentGameState, stack);
      }
      const handCard = handCardsInStack[0];
      const tableCardsInStack = stack.cards.filter(c => c.source !== 'hand');
  
      // --- NEW VALIDATION: Check if combos are sorted correctly ---
      const sortingValidation = validateComboSorting(stack.cards);
      if (!sortingValidation.isValid) {
        const errorMessage = sortingValidation.error +
          (sortingValidation.suggestion ? `\n\n${sortingValidation.suggestion}` : '');
        showError(errorMessage);
        return currentGameState; // Don't disband, let player fix the sorting
      }
  
      // --- Possibility 1: Capture ---
      const sumOfTableCards = calculateCardSum(tableCardsInStack);
      const captureValue = rankValue(handCard.rank);
  
      if (tableCardsInStack.length > 0 && sumOfTableCards % captureValue === 0) {
        if (sumOfTableCards === captureValue || canPartitionIntoSums(tableCardsInStack, captureValue)) {
          actions.push(importedCreateActionOption('capture', `Capture for ${captureValue}`, {
            draggedItem: { card: handCard, source: 'hand', player: currentPlayer },
            targetCard: stack // The whole stack is the target
          }));
        }
      }
  
      // --- Possibility 2: Build ---
      const possibleBuilds = findPossibleBuildsFromStack(stack, playerHand, tableCards, currentPlayer - 1); // Pass 0-based index
      possibleBuilds.forEach(value => {
        actions.push(importedCreateActionOption('createBuildWithValue', `Create a Build of ${value}`, {
          stack: stack,
          buildValue: value,
          draggedItem: { card: handCard, source: 'hand', player: currentPlayer }
        }));
      });
  
      // --- Possibility 3: Reinforce Opponent's Build ---
      const opponentBuilds = tableCards.filter(card => (card as any).type === 'build' && (card as any).owner !== (currentPlayer - 1)); // Filter opponent's builds
      opponentBuilds.forEach(build => {
        const buildTyped = build as Build;
        const validation = validateReinforceOpponentBuildWithStack(stack, buildTyped, currentPlayer - 1); // Pass 0-based index
        if (validation.valid) {
          actions.push(importedCreateActionOption('reinforceOpponentBuild', `Reinforce opponent's build of ${buildTyped.value}`, {
            stack: stack,
            targetBuild: buildTyped,
            draggedItem: { card: handCard, source: 'hand', player: currentPlayer }
          }));
        }
      });
  
      // --- Decision Logic ---
      if (actions.length === 0) {
        showError("This combination is not a valid capture or build.");
        return handleDisbandStagingStack(currentGameState, stack);
      }
  
      if (actions.length === 1) {
        return executeAction(currentGameState, actions[0]);
      }
  
      // More than one action, show the modal
      setModalInfo({
        title: 'Choose Your Action',
        message: `This combination can form multiple actions. Please choose one:`,
        actions: actions
      });
      return currentGameState;
    });
  }, [showError, setModalInfo, importedCreateActionOption, executeAction]);

  return { 
    gameState, 
    modalInfo, 
    errorModal,
    handleTrailCard, 
    handleDropOnCard, 
    handleModalAction, 
    setModalInfo, 
    executeAction, 
    handleCancelStagingStackAction, 
    handleStageOpponentCardAction, 
    handleConfirmStagingStackAction,
    closeErrorModal: () => setErrorModal({ visible: false, title: '', message: '', autoDismissMs: undefined })
  };
};
