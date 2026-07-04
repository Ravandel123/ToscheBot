import { randomInt, weightedItem } from '../../lib/random.js';
import { LOCATIONS, resolveLocationId, type LocationDefinition } from './locations.js';

// Weather catalog (D10/D31): the KINDS live here; each location's current spell
// lives in LocationState (rolled lazily when the previous one lapses). A
// location biases the odds via its `climate` weight overrides (locations.ts).
// 🟡 Weights/durations are placeholder flavor — no mechanics read weather yet
// beyond encounter/action conditions.

export interface WeatherDefinition {
   name: string;
   emoji: string;
   /** In-character line shown on the /play hub while this weather holds. */
   hubLine: string;
   /** How long one spell lasts before the next roll (whole hours). */
   durationHours: { min: number; max: number };
   /** Baseline pick weight; a location's `climate` overrides per kind. */
   defaultWeight: number;
}

export const WEATHER = {
   clear: {
      name: 'Clear skies',
      emoji: '☀️',
      hubLine: 'The sky is clear and the banners barely stir.',
      durationHours: { min: 3, max: 8 },
      defaultWeight: 5,
   },
   overcast: {
      name: 'Overcast',
      emoji: '☁️',
      hubLine: 'Grey clouds hang low over the rooftops.',
      durationHours: { min: 3, max: 8 },
      defaultWeight: 4,
   },
   rain: {
      name: 'Rain',
      emoji: '🌧️',
      hubLine: 'Steady rain drums on stone and canvas alike.',
      durationHours: { min: 2, max: 5 },
      defaultWeight: 3,
   },
   storm: {
      name: 'Storm',
      emoji: '⛈️',
      hubLine: 'Thunder rolls in the distance; sensible folk stay indoors.',
      durationHours: { min: 1, max: 3 },
      defaultWeight: 1,
   },
   fog: {
      name: 'Fog',
      emoji: '🌫️',
      hubLine: 'A pale fog swallows shapes a stone\'s throw away.',
      durationHours: { min: 1, max: 4 },
      defaultWeight: 1,
   },
} as const satisfies Record<string, WeatherDefinition>;

export type WeatherId = keyof typeof WEATHER;

/** Resolves a stored weather kind, falling back to clear skies (D10 rule 3). */
export function resolveWeatherId(id: string): WeatherId {
   return id in WEATHER ? (id as WeatherId) : 'clear';
}

export interface WeatherSpell {
   kind: WeatherId;
   since: Date;
   until: Date;
}

/** Rolls a fresh weather spell for a location (its climate biases the odds).
 *  The location is widened off the `as const` union so `climate` type-checks. */
export function rollWeather(locationId: string, now = new Date()): WeatherSpell {
   const { climate }: LocationDefinition = LOCATIONS[resolveLocationId(locationId)];
   const kind = weightedItem(
      (Object.keys(WEATHER) as WeatherId[]).map((id) => [id, climate?.[id] ?? WEATHER[id].defaultWeight] as const),
   );
   const hours = randomInt(WEATHER[kind].durationHours.min, WEATHER[kind].durationHours.max);

   return { kind, since: now, until: new Date(now.getTime() + hours * 3_600_000) };
}
