import { aiService } from '../src/services/aiService.js';
import { userPreferencesMcp } from '../src/utils/userPreferencesMcp.js';

// Test the detectUserPreferenceCommand function
function testUserPreferenceCommandDetection() {
  console.log('Testing user preference command detection...');

  // Test cases for talking less
  const talkLessTestCases = [
    'parle moins',
    'parles moins s\'il te plaît',
    'réponds moins souvent',
    'répond moins',
    'communique moins',
    'écris moins',
    'écrit pas autant'
  ];

  // Test cases for talking more
  const talkMoreTestCases = [
    'parle plus',
    'parles plus s\'il te plaît',
    'réponds plus souvent',
    'répond davantage',
    'communique plus',
    'écris plus',
    'écrit davantage'
  ];

  // Test cases for resetting talk behavior
  const resetTalkTestCases = [
    'recommence à parler comme avant',
    'reprends ton comportement normal',
    'reviens à ta communication normale',
    'retourne à parler comme avant',
    'reset ta communication',
    'réinitialise ton comportement',
    'reviens comme avant'
  ];

  // Test cases that should not be detected as user preference commands
  const negativeTestCases = [
    'bonjour',
    'comment ça va?',
    'parle-moi de toi',
    'je veux parler moins',
    'tu devrais écrire un livre'
  ];

  console.log('\nTalk less test cases:');
  for (const testCase of talkLessTestCases) {
    const result = aiService.detectUserPreferenceCommand(testCase);
    console.log(`"${testCase}" => ${result ? `"${result}"` : 'null'}`);
    if (result !== userPreferencesMcp.TALK_PREFERENCES.LESS) {
      console.log(`  ERROR: Expected ${userPreferencesMcp.TALK_PREFERENCES.LESS}, got ${result}`);
    }
  }

  console.log('\nTalk more test cases:');
  for (const testCase of talkMoreTestCases) {
    const result = aiService.detectUserPreferenceCommand(testCase);
    console.log(`"${testCase}" => ${result ? `"${result}"` : 'null'}`);
    if (result !== userPreferencesMcp.TALK_PREFERENCES.MORE) {
      console.log(`  ERROR: Expected ${userPreferencesMcp.TALK_PREFERENCES.MORE}, got ${result}`);
    }
  }

  console.log('\nReset talk test cases:');
  for (const testCase of resetTalkTestCases) {
    const result = aiService.detectUserPreferenceCommand(testCase);
    console.log(`"${testCase}" => ${result ? `"${result}"` : 'null'}`);
    if (result !== userPreferencesMcp.TALK_PREFERENCES.NORMAL) {
      console.log(`  ERROR: Expected ${userPreferencesMcp.TALK_PREFERENCES.NORMAL}, got ${result}`);
    }
  }

  console.log('\nNegative test cases:');
  for (const testCase of negativeTestCases) {
    const result = aiService.detectUserPreferenceCommand(testCase);
    console.log(`"${testCase}" => ${result ? `"${result}"` : 'null'}`);
    if (result !== null) {
      console.log(`  ERROR: Expected null, got ${result}`);
    }
  }
}

// Run the tests
testUserPreferenceCommandDetection();
