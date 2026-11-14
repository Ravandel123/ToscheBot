import { Schema, model, type Model } from 'mongoose';

// One small doc per piece of recurring work that must happen once per period,
// whatever restarts or downtime do: an hourly job stores the last clock hour it
// accounted for (and makes up the hours it missed), a daily routine stores the
// last day it ran for.
export interface JobStateDoc {
   _id: string; // job / routine name
   /** Hours since the Unix epoch of the last tick an hourly job accounted for. */
   lastHour?: number;
   /** The last day number a daily routine ran for (the caller defines the calendar). */
   lastDay?: number;
}

const jobStateSchema = new Schema({
   _id: { type: String, required: true },
   lastHour: { type: Number },
   lastDay: { type: Number },
}, { timestamps: true });

export const JobState = model('JobState', jobStateSchema) as unknown as Model<JobStateDoc>;
