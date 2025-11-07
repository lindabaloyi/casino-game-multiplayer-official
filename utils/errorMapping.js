/**
 * Maps technical error messages to user-friendly titles and shortened messages
 */

export const getErrorInfo = (message) => {
  const lowerMessage = message.toLowerCase();

  // Trail-related errors
  // Removed - validation no longer prevents temporary stack creation with matching builds
  
  
  if (lowerMessage.includes('trail') && lowerMessage.includes('own')) {
    return {
      title: 'Invalid Trail',
      message: 'Cannot trail while you own a build. Capture or build instead.'
    };
  }

  // Build-related errors
  if (lowerMessage.includes('build') && lowerMessage.includes('one')) {
    return {
      title: 'Invalid Build',
      message: 'Only one build allowed at a time.'
    };
  }
  
  if (lowerMessage.includes('build') && lowerMessage.includes('capture')) {
    return {
      title: 'Invalid Build',
      message: 'Need matching card in hand to capture this build later.'
    };
  }
  
  if (lowerMessage.includes('build') && lowerMessage.includes('opponent')) {
    return {
      title: 'Invalid Build',
      message: 'Opponent already has a build of this value.'
    };
  }

  if (lowerMessage.includes('extend') && lowerMessage.includes('build')) {
    return {
      title: 'Invalid Build',
      message: 'Cannot extend this build - check value limits.'
    };
  }

  // Capture-related errors
  if (lowerMessage.includes('capture') && (lowerMessage.includes('match') || lowerMessage.includes('total'))) {
    return {
      title: 'Invalid Capture',
      message: 'Card value does not match selected cards total.'
    };
  }

  if (lowerMessage.includes('capture') && lowerMessage.includes('table')) {
    return {
      title: 'Invalid Capture',
      message: 'All captured cards must be from the table.'
    };
  }

  // Turn-related errors - REMOVED: No longer validating turns

  // Stack-related errors
  if (lowerMessage.includes('staging') && lowerMessage.includes('one')) {
    return {
      title: 'Invalid Move',
      message: 'Only one staging stack allowed. Add to existing stack.'
    };
  }

  // Removed overly broad error mapping for stack operations
  // Players should be able to freely drag opponent's cards to generate combos
  // Specific validation errors will be handled by individual game logic functions

  // Source/state errors
  if (lowerMessage.includes('find') || lowerMessage.includes('not found')) {
    return {
      title: 'Invalid Move',
      message: 'Card or target not found. Try again.'
    };
  }

  // Generic/fallback
  return {
    title: 'Invalid Move',
    message: message.length > 60 ? message.substring(0, 57) + '...' : message
  };
};