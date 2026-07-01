// BMI classification bands used by `h!bmi` / `h!bmiforheight`. Bot-flavoured labels
// (the old bot also rolled a random body shape for NPCs — hence "beefy"), kept as
// data here. Note: bands overlap on purpose (e.g. 27 is "overweight or beefy").

export interface BodyShape {
   name: string;
   minBmi: number;
   maxBmi: number;
}

export const BODY_SHAPES = [
   { name: 'gaunt', minBmi: 14.5, maxBmi: 16.99 },
   { name: 'underweight', minBmi: 17, maxBmi: 18.49 },
   { name: 'normal', minBmi: 18.5, maxBmi: 24.99 },
   { name: 'overweight', minBmi: 25, maxBmi: 29.99 },
   { name: 'obese', minBmi: 30, maxBmi: 100 },
   { name: 'beefy', minBmi: 25, maxBmi: 45 },
] as const satisfies readonly BodyShape[];
