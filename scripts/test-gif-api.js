import { attachmentService } from '../src/services/attachmentService.js';

// Test function to search for GIFs
async function testGifSearch() {
  try {
    console.log('Testing GIF search functionality...');
    
    // Test search with a simple term
    const searchTerm = 'happy';
    console.log(`Searching for GIFs with term: "${searchTerm}"`);
    
    const gifs = await attachmentService.searchGifs(searchTerm, 5);
    console.log(`Found ${gifs.length} GIFs`);
    
    if (gifs.length > 0) {
      // Display the first GIF details
      const firstGif = gifs[0];
      console.log('First GIF details:');
      console.log(`- Title: ${firstGif.title}`);
      console.log(`- ID: ${firstGif.id}`);
      
      // Get URL for different formats
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
    
    // Test random GIF
    console.log('\nTesting random GIF functionality...');
    const randomGif = await attachmentService.getRandomGif(searchTerm);
    
    if (randomGif) {
      console.log(`Random GIF: "${randomGif.title}"`);
      console.log(`URL: ${attachmentService.getGifUrl(randomGif)}`);
    } else {
      console.log('No random GIF found');
    }
    
    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Error during GIF testing:', error);
  }
}

// Run the test
testGifSearch();
