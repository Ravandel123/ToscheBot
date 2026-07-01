import { defineRandomResponseCommand } from '../_randomResponse.js';
import { COMEBACKS } from '../../../fun/comebacks.js';

export default defineRandomResponseCommand({
   name: 'you',
   description: 'Tosch responds to a direct provocation or compliment.',
   usage: 'are an awesome general, Tosche',
   responses: COMEBACKS,
});
