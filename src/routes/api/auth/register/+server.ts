import {
  db
} from '$lib/server/db/index';
import {
  users
} from '$lib/server/db/schema';
import * as bcryptjs from 'bcryptjs';
import {
  json
} from '@sveltejs/kit';
import {
  eq,
  sql
} from 'drizzle-orm';

export async function POST({
  request
}) {
  const {
    name,
    email,
    password
  } = await request.json();

  const existing = await db.select().from(users).where(eq(users.email, email));
  if (existing.length > 0) {
    return json( {
      error: 'Email already registered'
    }, {
      status: 400
    });
  }

  const hashedPassword = await bcryptjs.hash(password, 10);

  const countResult = await db.select({
    count: sql < number > `COUNT(*)`
  }).from(users);
  const isFirstUser = countResult[0]?.count === 0;

  await db.insert(users).values({
    name,
    email,
    password: hashedPassword,
    role: isFirstUser ? 'admin': 'customer',
  });

  return json( {
    success: true
  });
}