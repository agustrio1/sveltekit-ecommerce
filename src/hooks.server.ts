import type { Handle } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const JWT_SECRET = process.env.JWT_SECRET!;

export const handle: Handle = async ({ event, resolve }) => {
  const session = event.cookies.get('session');

  if (session) {
    try {
      const decoded = jwt.verify(session, JWT_SECRET) as { sub: string; role: string };
      event.locals.user = { id: decoded.sub, role: decoded.role };
    } catch {
      event.locals.user = null;
    }
  } else {
    event.locals.user = null;
  }

  return resolve(event);
};
