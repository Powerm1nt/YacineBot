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

  // Test each case
  for (const testCase of testCases) {
    console.log(`\nTesting: "${testCase.content}"`);
    console.log(`Expected: ${testCase.expected}`);

    try {
      // Create mock task data
      const taskData = {
        content: testCase.content,
        contextInfo: '',
        isFromBot: false,
        channelName: 'general',
        guildId: null,
        channelPermissions: ['SEND_MESSAGES']
      };

      // Call the executeScheduledAnalysis function directly
      const result = await executeScheduledAnalysis(taskData);

      console.log(`Result: relevanceScore = ${result.relevanceScore}, hasKeyInfo = ${result.hasKeyInfo}`);

      // Basic validation
      if (result.relevanceScore === 0) {
        console.log('WARNING: relevanceScore is 0, which might indicate a problem!');
      } else {
        console.log('relevanceScore is non-zero, which is good.');
      }
    } catch (error) {
      console.error('Error during testing:', error);
    }
  }

  console.log('\nTest completed!');
}

// Run the test
testRelevanceScore();
