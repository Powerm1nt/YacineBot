import { executeScheduledAnalysis } from '../src/services/analysisService.js';

/**
 * Test script to verify the relevanceScore calculation
 * 
 * This script directly tests the executeScheduledAnalysis function,
 * bypassing the database dependency.
 */
async function testRelevanceScore() {
  console.log('Testing relevanceScore calculation with executeScheduledAnalysis...');

  // Test cases with different expected relevance scores
  const testCases = [
    { 
      content: 'Can someone help me with a JavaScript problem?', 
      expected: 'High relevance (tech/help question)'
    },
    { 
      content: 'Hello everyone, how are you today?', 
      expected: 'Medium relevance (general greeting)'
    },
    { 
      content: 'k', 
      expected: 'Low relevance (very short message)'
    }
  ];

  // Test each case in both server and private message contexts
  for (const testCase of testCases) {
    console.log(`\n=== Testing: "${testCase.content}" ===`);
    console.log(`Expected: ${testCase.expected}`);

    try {
      // Test in server context (guildId provided)
      console.log("\nTesting in SERVER context:");
      const serverTaskData = {
        content: testCase.content,
        contextInfo: '',
        isFromBot: false,
        channelName: 'general',
        guildId: 'server123', // Simulating a server message
        channelPermissions: ['SEND_MESSAGES']
      };

      const serverResult = await executeScheduledAnalysis(serverTaskData);
      console.log(`Server result: relevanceScore = ${serverResult.relevanceScore}, hasKeyInfo = ${serverResult.hasKeyInfo}`);

      // Test in private message context (guildId null)
      console.log("\nTesting in PRIVATE MESSAGE context:");
      const privateTaskData = {
        content: testCase.content,
        contextInfo: '',
        isFromBot: false,
        channelName: 'private',
        guildId: null, // Simulating a private message
        channelPermissions: ['SEND_MESSAGES']
      };

      const privateResult = await executeScheduledAnalysis(privateTaskData);
      console.log(`Private result: relevanceScore = ${privateResult.relevanceScore}, hasKeyInfo = ${privateResult.hasKeyInfo}`);

      // Compare the scores
      console.log(`\nComparison: Private message score is ${privateResult.relevanceScore > serverResult.relevanceScore ? 'HIGHER' : 'LOWER'} than server score`);
      console.log(`Difference: ${(privateResult.relevanceScore - serverResult.relevanceScore).toFixed(2)}`);

      // Basic validation
      if (privateResult.relevanceScore <= serverResult.relevanceScore) {
        console.log('WARNING: Private message score should be higher than server score!');
      } else {
        console.log('SUCCESS: Private message score is higher than server score, as expected.');
      }
    } catch (error) {
      console.error('Error during testing:', error);
    }
  }

  console.log('\nTest completed!');
}

// Run the test
testRelevanceScore();
