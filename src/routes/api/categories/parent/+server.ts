// src/routes/api/categories/parent/+server.ts
import { db } from '$lib/server/db';
import { categories } from '$lib/server/db/schema';
import { isNull } from 'drizzle-orm';
import { json } from '@sveltejs/kit';

export async function GET() {
  const result = await db
    .select()
    .from(categories)
    .where(isNull(categories.parentId));
  return json({ data: result });
}
