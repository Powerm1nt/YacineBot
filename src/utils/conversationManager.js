// Conversation manager for OpenAI Responses API

// Map to store conversation state by user
const userConversations = new Map();

/**
 * Gets the conversation state for a user
 * @param {string} userId - User ID
 * @returns {Object} - Conversation state with lastResponseId
 */
export function getConversationState(userId) {
  if (!userConversations.has(userId)) {
    return { lastResponseId: null }
  }

  return userConversations.get(userId)
}

/**
 * Resets the conversation for a user
 * @param {string} userId - User ID
 * @returns {boolean} - Success status
 */
export function resetConversation(userId) {
  try {
    userConversations.delete(userId)
    console.log(`Conversation reset for user ${userId}`)
    return true
  } catch (error) {
    console.error(`Error resetting conversation for ${userId}:`, error)
    return false
  }
}

/**
 * Saves response ID for a user's conversation
 * @param {string} userId - User ID
 * @param {string} responseId - OpenAI response ID
 */
export function saveResponseId(userId, responseId) {
  userConversations.set(userId, {
    lastResponseId: responseId,
    lastUpdated: new Date().toISOString()
  })

  console.log(`Response ID saved for user ${userId}: ${responseId}`)

  return true
}
