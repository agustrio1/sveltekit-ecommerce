import { db } from '$lib/server/db';
import { categories } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { json } from '@sveltejs/kit';

export async function GET({ params }) {
  const slug = params.slug;

  // Cari ID parent dari slug
  const parent = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);

  if (!parent.length) return json({ data: [] });

  const children = await db
    .select()
    .from(categories)
    .where(eq(categories.parentId, parent[0].id));

  return json({ data: children });
}
