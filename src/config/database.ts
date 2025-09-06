import mongoose, { Mongoose, ConnectOptions } from 'mongoose';
import { config } from 'dotenv';

config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/carpool';
const options: ConnectOptions = {};

let client: Mongoose | null = null;

export async function connectToDatabase(): Promise<Mongoose> {
  mongoose.set('runValidators', true);
  if (client === null) {
    client = await mongoose.connect(uri, options);
  }
  return client;
};

export async function closeDatabaseConnection(): Promise<void> {
  if (client) {
    await client.disconnect();
    client = null;
  }
};