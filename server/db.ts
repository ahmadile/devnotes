import { MongoClient } from 'mongodb';

let client: MongoClient | null = null;

export function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Missing MONGODB_URI env var');
  }
  return uri;
}

export function getMongoDbName(): string {
  return process.env.MONGODB_DB || 'devnotes';
}

export async function getMongoClient(): Promise<MongoClient> {
  if (client) return client;
  client = new MongoClient(getMongoUri());
  await client.connect();
  return client;
}

