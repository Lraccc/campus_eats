/**
 * Bad word filter utility for livestream chat
 * Censors profanity and inappropriate language
 */

// List of bad words to censor (English)
const englishBadWords = [
  'fuck',
  'fucking',
  'fucked',
  'fucker',
  'shit',
  'bitch',
  'bastard',
  'asshole',
  'ass',
  'damn',
  'hell',
  'dick',
  'cock',
  'pussy',
  'cunt',
  'whore',
  'slut',
  'piss',
  'fag',
  'nigger',
  'nigga',
  'retard',
];

// List of Bisaya/Cebuano bad words
const bisayaBadWords = [
  'yawa',
  'yawaa',
  'atay',
  'piste',
  'pisteng',
  'gago',
  'gaga',
  'buang',
  'boang',
  'animal',
  'hayop',
  'putang',
  'puta',
  'punyeta',
  'punyemas',
  'tarantado',
  'leche',
  'pakshet',
  'pakyu',
  'kupal',
  'tangina',
  'tanga',
  'giatay',
];

// Combine all bad words
const allBadWords = [...englishBadWords, ...bisayaBadWords];

// Replacement text
const REPLACEMENT_TEXT = 'CIT-U Tops';

/**
 * Escapes special regex characters in a string
 */
const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Creates a regex pattern that matches bad words with word boundaries
 * Handles variations like spaces, special characters, repeated letters
 */
const createBadWordPattern = (word: string): string => {
  // Create a pattern that matches the word with possible variations
  // e.g., "f u c k", "f.u.c.k", "fuuuuck", etc.
  const chars = word.split('');
  const pattern = chars
    .map((char) => `${escapeRegex(char)}+`) // Allow repeated letters
    .join('[\\s\\-_\\.]*'); // Allow spaces, dashes, underscores, dots between letters
  
  return `\\b${pattern}\\b`;
};

/**
 * Filters and censors bad words from a message
 * @param message - The message to filter
 * @returns The filtered message with bad words replaced
 */
export const filterBadWords = (message: string): string => {
  if (!message || typeof message !== 'string') {
    return message;
  }

  let filteredMessage = message;

  // Create regex patterns for all bad words
  allBadWords.forEach((badWord) => {
    const pattern = createBadWordPattern(badWord);
    const regex = new RegExp(pattern, 'gi'); // Case-insensitive, global
    
    // Replace bad word with replacement text
    filteredMessage = filteredMessage.replace(regex, REPLACEMENT_TEXT);
  });

  return filteredMessage;
};

/**
 * Checks if a message contains any bad words
 * @param message - The message to check
 * @returns True if message contains bad words, false otherwise
 */
export const containsBadWords = (message: string): boolean => {
  if (!message || typeof message !== 'string') {
    return false;
  }

  const lowerMessage = message.toLowerCase();
  
  return allBadWords.some((badWord) => {
    const pattern = createBadWordPattern(badWord);
    const regex = new RegExp(pattern, 'i'); // Case-insensitive
    return regex.test(lowerMessage);
  });
};

/**
 * Gets statistics about censored content
 * @param originalMessage - The original message
 * @param filteredMessage - The filtered message
 * @returns Object with statistics
 */
export const getCensorStats = (originalMessage: string, filteredMessage: string) => {
  const wasCensored = originalMessage !== filteredMessage;
  const censorCount = (filteredMessage.match(new RegExp(escapeRegex(REPLACEMENT_TEXT), 'g')) || []).length;
  
  return {
    wasCensored,
    censorCount,
    originalLength: originalMessage.length,
    filteredLength: filteredMessage.length,
  };
};
