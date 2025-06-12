/**
 * Test script for the Tenor API MCP implementation
 * 
 * This script tests the Message Consumer Processor (MCP) implementation
 * for the Tenor API by sending messages directly to the MCP and through
 * the attachmentService.
 */
import { tenorApiMcp } from '../src/utils/tenorApiMcp.js';
import { attachmentService } from '../src/services/attachmentService.js';

// Test direct MCP communication
async function testDirectMcp() {
  console.log('=== Testing direct MCP communication ===');
  
  try {
    // Test searching for GIFs
    console.log('\nTesting SEARCH_GIFS message:');
    const searchMessage = {
      type: tenorApiMcp.MESSAGE_TYPES.SEARCH_GIFS,
      payload: {
        searchTerm: 'coding',
        limit: 3
      }
    };
    
    const searchResponse = await tenorApiMcp.processMessage(searchMessage);
    console.log(`Received ${searchResponse.payload.length} GIFs for "coding"`);
    if (searchResponse.payload.length > 0) {
      const firstGif = searchResponse.payload[0];
      console.log(`First GIF title: "${firstGif.title}"`);
    }
    
    // Test getting a random GIF
    console.log('\nTesting GET_RANDOM_GIF message:');
    const randomMessage = {
      type: tenorApiMcp.MESSAGE_TYPES.GET_RANDOM_GIF,
      payload: {
        searchTerm: 'happy',
        limit: 10
      }
    };
    
    const randomResponse = await tenorApiMcp.processMessage(randomMessage);
    if (randomResponse.payload) {
      console.log(`Random GIF title: "${randomResponse.payload.title}"`);
    } else {
      console.log('No random GIF found');
    }
    
    // Test error handling with invalid message type
    console.log('\nTesting error handling with invalid message type:');
    try {
      const invalidMessage = {
        type: 'INVALID_TYPE',
        payload: {}
      };
      
      await tenorApiMcp.processMessage(invalidMessage);
      console.log('ERROR: Should have thrown an error for invalid message type');
    } catch (error) {
      console.log(`Success: Caught error for invalid message type: ${error.message}`);
    }
    
    // Test error handling with missing search term
    console.log('\nTesting error handling with missing search term:');
    try {
      const invalidPayloadMessage = {
        type: tenorApiMcp.MESSAGE_TYPES.SEARCH_GIFS,
        payload: {
          // Missing searchTerm
          limit: 5
        }
      };
      
      await tenorApiMcp.processMessage(invalidPayloadMessage);
      console.log('ERROR: Should have thrown an error for missing search term');
    } catch (error) {
      console.log(`Success: Caught error for missing search term: ${error.message}`);
    }
    
  } catch (error) {
    console.error('Error during direct MCP testing:', error);
  }
}

// Test through attachmentService
async function testViaAttachmentService() {
  console.log('\n=== Testing via attachmentService ===');
  
  try {
    // Test searchGifs
    console.log('\nTesting searchGifs:');
    const gifs = await attachmentService.searchGifs('programming', 3);
    console.log(`Found ${gifs.length} GIFs for "programming"`);
    
    if (gifs.length > 0) {
      // Get URL for different formats of the first GIF
      const firstGif = gifs[0];
      console.log(`First GIF title: "${firstGif.title}"`);
      
      const gifUrl = attachmentService.getGifUrl(firstGif, 'gif');
      const mediumGifUrl = attachmentService.getGifUrl(firstGif, 'mediumgif');
      const tinyGifUrl = attachmentService.getGifUrl(firstGif, 'tinygif');
      
      console.log('GIF URLs:');
      console.log(`- Full GIF: ${gifUrl}`);
      console.log(`- Medium GIF: ${mediumGifUrl}`);
      console.log(`- Tiny GIF: ${tinyGifUrl}`);
      
      // Test preparing for Discord
      const discordGif = attachmentService.prepareGifForDiscord(firstGif);
      console.log('Prepared for Discord:', discordGif);
    }
    
    // Test getRandomGif
    console.log('\nTesting getRandomGif:');
    const randomGif = await attachmentService.getRandomGif('excited');
    
    if (randomGif) {
      console.log(`Random GIF: "${randomGif.title}"`);
      console.log(`URL: ${attachmentService.getGifUrl(randomGif)}`);
    } else {
      console.log('No random GIF found');
    }
    
  } catch (error) {
    console.error('Error during attachmentService testing:', error);
  }
}

// Run all tests
async function runTests() {
  try {
    console.log('Starting Tenor API MCP tests...\n');
    
    await testDirectMcp();
    await testViaAttachmentService();
    
    console.log('\nAll tests completed!');
  } catch (error) {
    console.error('Error during testing:', error);
  }
}

// Execute tests
runTests();
