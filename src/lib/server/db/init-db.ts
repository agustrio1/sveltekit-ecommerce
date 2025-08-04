import 'dotenv/config';
import mysql from 'mysql2/promise';
import {
  parse
} from 'url';

export async function ensureDatabaseExists() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set');

  const {
    hostname,
    port,
    auth,
    pathname
  } = parse(dbUrl);
  const [user,
    password] = auth?.split(':') ?? [];
  const database = pathname?.replace('/', '');

  const connection = await mysql.createConnection({
    host: hostname,
    port: port ? parseInt(port): 3306,
    user,
    password,
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
  console.log(`✅ Database '${database}' OK`);
  await connection.end();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  ensureDatabaseExists().catch(console.error);
}