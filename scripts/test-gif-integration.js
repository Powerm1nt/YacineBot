import { aiService } from '../src/services/aiService.js';

// Test the detectGifRequest function
function testGifRequestDetection() {
  console.log('Testing GIF request detection...');
  
  // Test cases in French
  const frenchTestCases = [
    'envoie un gif de chat',
    'envoie-moi un gif de chien qui court',
    'montre un gif d\'explosion',
    'cherche des gifs de bébés qui rient',
    'trouve un gif sur la programmation',
    'gif de danse',
    'gif avec des étoiles'
  ];
  
  // Test cases in English
  const englishTestCases = [
    'send a gif of a cat',
    'show me a gif of a dog running',
    'find a gif about explosion',
    'search for gifs of babies laughing',
    'gif of programming',
    'gif with stars'
  ];
  
  // Test cases that should not be detected as GIF requests
  const negativeTestCases = [
    'hello there',
    'how are you doing?',
    'what is a gif?',
    'I like gifs',
    'the word gif is in this sentence but not a request'
  ];
  
  console.log('\nFrench test cases:');
  for (const testCase of frenchTestCases) {
    const result = aiService.detectGifRequest(testCase);
    console.log(`"${testCase}" => ${result ? `"${result}"` : 'null'}`);
  }
  
  console.log('\nEnglish test cases:');
  for (const testCase of englishTestCases) {
    const result = aiService.detectGifRequest(testCase);
    console.log(`"${testCase}" => ${result ? `"${result}"` : 'null'}`);
  }
  
  console.log('\nNegative test cases:');
  for (const testCase of negativeTestCases) {
    const result = aiService.detectGifRequest(testCase);
    console.log(`"${testCase}" => ${result ? `"${result}"` : 'null'}`);
  }
}

// Run the tests
testGifRequestDetection();
