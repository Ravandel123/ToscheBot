import { defineRandomResponseCommand } from '../_randomResponse.js';
import { ORACLE_ANSWERS } from '../../../fun/oracle.js';

export default defineRandomResponseCommand({
   name: 'is',
   // Common question-opening verbs, so `h!are Tosche the best?` also works.
   aliases: ['am', 'are', 'can', 'could', 'did', 'do', 'does', 'have', 'had', 'has', 'shall', 'should', 'was', 'were', 'will', 'would', '8ball', '8b'],
   description: 'Tosch answers a yes/no question.',
   usage: 'Tosche the best?',
   responses: ORACLE_ANSWERS,
   funny: true,
});
