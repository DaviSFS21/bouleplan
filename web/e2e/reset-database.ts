import { Client } from 'pg';

export async function resetDatabase(): Promise<void> {
  const connectionString = process.env.E2E_DATABASE_URL;
  if (!connectionString) throw new Error('Set E2E_DATABASE_URL to reset the database.');

  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('truncate initiative cascade');
  } finally {
    await client.end();
  }
}
