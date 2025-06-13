import { aiService } from '../src/services/aiService.js';
import { analysisService } from '../src/services/analysisService.js';

// Mock the necessary functions for testing
const mockAnalyzeMessageRelevance = async (content, contextInfo, isFromBot, channelName, guildId, channelPermissions) => {
  console.log(`[TEST] Analyzing message relevance for: "${content}"`);
  
  // For testing purposes, assign different relevance scores based on content
  if (content.includes('important') || content.includes('urgent')) {
    return { relevanceScore: 0.8, hasKeyInfo: true };
  } else if (content.includes('please') || content.includes('help')) {
    return { relevanceScore: 0.6, hasKeyInfo: true };
  } else {
    return { relevanceScore: 0.2, hasKeyInfo: false };
  }
};

// Store the original function to restore it later
const originalAnalyzeMessageRelevance = analysisService.analyzeMessageRelevance;

// Test function
async function testGifRelevanceCheck() {
  console.log('Testing GIF relevance check functionality...');
  
  try {
    // Replace the real function with our mock
    analysisService.analyzeMessageRelevance = mockAnalyzeMessageRelevance;
    
    // Test cases with different expected relevance scores
    const testCases = [
      { 
        message: 'envoie un gif de chat important', 
        expected: 'High relevance (0.8) - GIF should be sent'
      },
      { 
        message: 'please send a gif of a dog', 
        expected: 'Medium relevance (0.5) - GIF should be sent'
      },
      { 
        message: 'gif de danse', 
        expected: 'Low relevance (0.2) - GIF should NOT be sent'
      }
    ];
    
    // Test each case
    for (const testCase of testCases) {
      console.log(`\nTesting: "${testCase.message}"`);
      console.log(`Expected: ${testCase.expected}`);
      
      // Check if it's a GIF request
      const gifSearchTerm = aiService.detectGifRequest(testCase.message);
      
      if (gifSearchTerm) {
        console.log(`GIF request detected with search term: "${gifSearchTerm}"`);
        
        // Get the relevance score
        const relevanceAnalysis = await mockAnalyzeMessageRelevance(testCase.message, '', false, '', null, null);
        
        console.log(`Relevance score: ${relevanceAnalysis.relevanceScore}`);
        
        // Check if GIF would be sent
        if (relevanceAnalysis.relevanceScore >= 0.1) {
          console.log('RESULT: GIF would be sent ✅');
        } else {
          console.log('RESULT: GIF would NOT be sent ❌');
        }
      } else {
        console.log('Not a GIF request');
      }
    }
    
  } catch (error) {
    console.error('Error during testing:', error);
  } finally {
    // Restore the original function
    analysisService.analyzeMessageRelevance = originalAnalyzeMessageRelevance;
  }
  
  console.log('\nTest completed!');
}

// Run the test
testGifRelevanceCheck();
