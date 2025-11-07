# Safe Refactoring Strategy: How to Break Apart useGameActions.js Without Breaking Anything

## The Golden Rule: **Copy First, Delete Later**

**Never move code directly!** Instead, follow this safe pattern:
1. **Copy** the code to a new file
2. **Import** it back into the original file  
3. **Test** that everything still works
4. **Only then** delete the original code

This way, if something breaks, you can instantly revert.

## Step 1: Extract Error Utilities (Safest First Step)

### What We're Moving
The `useNotifications` function (lines 58-81) in [`useGameActions.js`](components/useGameActions.js:58)

### Why This Is Safe
- It's completely self-contained
- Only depends on `setErrorModal` (which we'll pass as a parameter)
- No complex state interactions
- Easy to test

### Step-by-Step Process

#### Step 1a: Create the New File
```javascript
// File: hooks/useNotifications.js
import { getErrorInfo } from '../utils/errorMapping';

export const useNotifications = (setErrorModal) => ({
  showError: (message) => {
    const errorInfo = getErrorInfo(message);
    setErrorModal({
      visible: true,
      title: errorInfo.title,
      message: errorInfo.message,
    });
  },
  showWarning: (message) => {
    setErrorModal({
      visible: true,
      title: 'Notice',
      message: message,
    });
  },
  showInfo: (message) => {
    setErrorModal({
      visible: true,
      title: 'Game Info',
      message: message,
    });
  },
});
```

#### Step 1b: Import in Original File (DON'T DELETE ANYTHING YET!)
```javascript
// Add this import to useGameActions.js
import { useNotifications as importedUseNotifications } from '../hooks/useNotifications';

// Change line 87 from:
const { showError, showWarning, showInfo } = useNotifications(setErrorModal);

// To:
const { showError, showWarning, showInfo } = importedUseNotifications(setErrorModal);
```

#### Step 1c: Test Everything
- Run your game
- Try actions that show errors
- Make sure notifications still work
- If anything breaks, just remove the import and change the line back

#### Step 1d: Only After Testing Succeeds - Delete Original
Remove lines 58-81 (the original `useNotifications` function)

**Result**: Your main file is now 24 lines shorter and you have a reusable notification utility!

## Step 2: Extract Helper Functions 

### What We're Moving
- `createActionOption` (lines 193-197)
- `canCreateBuild` (lines 200-205)
- `generatePossibleActions` (lines 270-341)

### Step-by-Step Process

#### Step 2a: Create the New File
```javascript
// File: utils/gameActionHelpers.js
import { rankValue, findBaseBuilds } from '../game-logic/index.js';

export const createActionOption = (type, label, payload) => ({
  type,
  label,
  payload
});

export const canCreateBuild = (playerHand, draggedCard, buildValue) => {
  return playerHand.some(c => 
    rankValue(c.rank) === buildValue &&
    (c.rank !== draggedCard.rank || c.suit !== draggedCard.suit)
  );
};

export const generatePossibleActions = (draggedItem, looseCard, playerHand, tableCards, playerCaptures, currentPlayer) => {
  // Copy the entire function body from lines 271-341
  // Keep it exactly the same - just copy/paste
};
```

#### Step 2b: Import and Replace (Keep Originals!)
```javascript
// Add to imports in useGameActions.js
import { 
  createActionOption as importedCreateActionOption,
  canCreateBuild as importedCanCreateBuild,
  generatePossibleActions as importedGeneratePossibleActions
} from '../utils/gameActionHelpers';

// Replace calls throughout the file, but keep original functions
```

#### Step 2c: Test, Then Delete Originals

## Step 3: Extract Modal Management

### What We're Moving
- Modal state management (lines 85-86)
- `handleModalAction` (lines 264-267)
- `setModalInfo` usage

### The Strategy
Create a custom hook that manages all modal-related state and actions.

#### Step 3a: Create useModalManager Hook
```javascript
// File: hooks/useModalManager.js
import { useState, useCallback } from 'react';

export const useModalManager = () => {
  const [modalInfo, setModalInfo] = useState(null);

  const handleModalAction = useCallback((action, executeAction) => {
    if (executeAction) {
      executeAction(action);
    }
    setModalInfo(null);
  }, []);

  const showModal = useCallback((modalData) => {
    setModalInfo(modalData);
  }, []);

  const closeModal = useCallback(() => {
    setModalInfo(null);
  }, []);

  return {
    modalInfo,
    setModalInfo,
    handleModalAction,
    showModal,
    closeModal
  };
};
```

#### Step 3b: Import and Test
```javascript
// In useGameActions.js, add import
import { useModalManager } from '../hooks/useModalManager';

// Replace modal state management
const { modalInfo, setModalInfo, handleModalAction, showModal, closeModal } = useModalManager();

// Update handleModalAction to pass executeAction
const wrappedHandleModalAction = useCallback((action) => {
  handleModalAction(action, (currentGameState) => executeAction(currentGameState, action));
}, [handleModalAction, executeAction]);
```

## Step 4: The Big One - Breaking Down handleDropOnCard

### Why This Is Scary
The `handleDropOnCard` function (lines 343-845) is 500+ lines and handles everything. But we can break it down safely.

### The Strategy: Extract by Source Type First

#### Step 4a: Extract Table Card Drop Handler
```javascript
// File: handlers/handleTableCardDrop.js
export const handleTableCardDrop = (draggedItem, targetInfo, currentGameState, showError) => {
  // Copy lines 370-547 (the table card logic)
  // Keep everything exactly the same
  // Just wrap it in this function
};
```

#### Step 4b: Extract Hand Card Drop Handler  
```javascript
// File: handlers/handleHandCardDrop.js
export const handleHandCardDrop = (draggedItem, targetInfo, currentGameState, showError, setModalInfo, executeAction) => {
  // Copy lines 550-598 (the hand card logic)
};
```

#### Step 4c: Extract Temporary Stack Drop Handler
```javascript
// File: handlers/handleTemporaryStackDrop.js
export const handleTemporaryStackDrop = (draggedItem, targetInfo, currentGameState, showError) => {
  // Copy the temporary stack logic
};
```

#### Step 4d: Create the New handleDropOnCard
```javascript
// The new, much smaller handleDropOnCard becomes:
const handleDropOnCard = useCallback((draggedItem, targetInfo) => {
  // Validation logic (lines 343-367)
  
  // Route to appropriate handler based on source
  if (draggedSource === 'table' || draggedSource === 'opponentCapture' || draggedSource === 'captured') {
    return handleTableCardDrop(draggedItem, targetInfo, currentGameState, showError);
  } else if (draggedSource === 'hand') {
    return handleHandCardDrop(draggedItem, targetInfo, currentGameState, showError, setModalInfo, executeAction);
  } else if (draggedSource === 'temporary_stack') {
    return handleTemporaryStackDrop(draggedItem, targetInfo, currentGameState, showError);
  }
}, [/* dependencies */]);
```

## Safety Checklist for Each Step

### Before Starting Any Step:
- [ ] Commit your current working code to git
- [ ] Create a backup copy of useGameActions.js
- [ ] Make sure your game currently works

### For Each Extraction:
- [ ] Copy code to new file (don't modify original)
- [ ] Import the new function
- [ ] Test thoroughly
- [ ] Only delete original after testing passes
- [ ] If anything breaks, revert immediately

### Testing Strategy:
1. **Basic functionality**: Can you still play the game?
2. **Error cases**: Do error messages still show?
3. **Complex actions**: Try builds, captures, temporary stacks
4. **Edge cases**: Wrong turns, invalid moves

## Rollback Procedures

### If Step 1 Breaks:
```javascript
// Remove the import
// Change back to: const { showError, showWarning, showInfo } = useNotifications(setErrorModal);
```

### If Step 2 Breaks:
```javascript
// Remove the imports
// Change function calls back to original names
```

### If Step 3 Breaks:
```javascript
// Remove useModalManager import
// Restore original modal state: const [modalInfo, setModalInfo] = useState(null);
```

### If Step 4 Breaks:
```javascript
// Remove handler imports
// Restore the original 500-line handleDropOnCard function
```

## Success Metrics

### After Step 1:
- [ ] File is 24 lines shorter
- [ ] Error notifications still work
- [ ] New useNotifications hook can be reused elsewhere

### After Step 2:
- [ ] File is ~80 lines shorter
- [ ] All game actions still work
- [ ] Helper functions are reusable

### After Step 3:
- [ ] File is ~50 lines shorter
- [ ] Modal dialogs still work
- [ ] Modal logic is cleaner and reusable

### After Step 4:
- [ ] Main file is under 300 lines
- [ ] Each handler is under 100 lines
- [ ] All game functionality preserved
- [ ] Code is much easier to understand

## Final Result

**Before**: 1 file, 960 lines, impossible to maintain
**After**: 6+ smaller files, each focused on one thing, easy to understand and modify

Now you're ready for safe TypeScript conversion!