import { MongoClient } from 'mongodb';
import { config } from 'dotenv';

config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/carpool';
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true
};

let client: MongoClient | null;

export const connectToDatabase = async () => {
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }
  return client.db();
};

export const closeDatabaseConnection = async () => {
  if (client) {
    await client.close();
    client = null;
  }
};