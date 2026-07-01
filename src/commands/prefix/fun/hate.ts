import { defineRandomResponseCommand } from '../_randomResponse.js';
import { randomInt } from '../../../lib/random.js';
import { INSULTS } from '../../../fun/insults.js';

export default defineRandomResponseCommand({
   name: 'hate',
   aliases: ['insult'],
   description: 'Tosch shares his honest opinion of you.',
   responses: INSULTS,
   // One freshly generated line joins the curated pool for variety.
   extraResponses: () => [`I have calculated your IQ and it is exactly ${randomInt(0, 40)}.`],
});
