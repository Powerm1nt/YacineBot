/**
 * Tests pour les utilitaires de mentions
 * 
 * Pour exécuter: node src/utils/mentionUtils.test.js
 */

import { convertAITextToDiscordMentions, extractUserIdsFromText } from './mentionUtils.js';

function testConvertAITextToDiscordMentions() {
  console.log('Test: convertAITextToDiscordMentions');

  const testCases = [
    {
      input: 'Salut John (ID: 123456789), comment ça va?',
      expected: 'Salut <@123456789>, comment ça va?',
      description: 'Format nom (ID: xxx)'
    },
    {
      input: 'Bonjour ID: 987654321 tu es là?',
      expected: 'Bonjour <@987654321> tu es là?',
      description: 'Format ID: xxx'
    },
    {
      input: 'Message sans mention',
      expected: 'Message sans mention',
      description: 'Pas de mention'
    },
    {
      input: 'Test multiple ID: 123 et aussi ID: 456',
      expected: 'Test multiple <@123> et aussi <@456>',
      description: 'Plusieurs mentions'
    }
  ];

  let passed = 0;

  testCases.forEach((testCase, index) => {
    const result = convertAITextToDiscordMentions(testCase.input);
    const success = result === testCase.expected;

    console.log(`  ${success ? '✅' : '❌'} Test ${index+1}: ${testCase.description}`);
    if (!success) {
      console.log(`    Attendu: "${testCase.expected}"`)
      console.log(`    Obtenu: "${result}"`)
    }

    if (success) passed++;
  });

  console.log(`${passed}/${testCases.length} tests passés\n`);
}

function testExtractUserIdsFromText() {
  console.log('Test: extractUserIdsFromText');

  const testCases = [
    {
      input: 'Salut <@123456789>, comment ça va?',
      expected: ['123456789'],
      description: 'Mention simple'
    },
    {
      input: 'Bonjour <@987654321> et <@123456789>',
      expected: ['987654321', '123456789'],
      description: 'Mentions multiples'
    },
    {
      input: 'Message sans mention',
      expected: [],
      description: 'Pas de mention'
    }
  ];

  let passed = 0;

  testCases.forEach((testCase, index) => {
    const result = extractUserIdsFromText(testCase.input);
    const success = JSON.stringify(result) === JSON.stringify(testCase.expected);

    console.log(`  ${success ? '✅' : '❌'} Test ${index+1}: ${testCase.description}`);
    if (!success) {
      console.log(`    Attendu: ${JSON.stringify(testCase.expected)}`);
      console.log(`    Obtenu: ${JSON.stringify(result)}`);
    }

    if (success) passed++;
  });

  console.log(`${passed}/${testCases.length} tests passés\n`);
}

// Exécuter les tests
console.log('===== Tests des utilitaires de mentions =====');
testConvertAITextToDiscordMentions();
testExtractUserIdsFromText();
console.log('===== Fin des tests =====');
