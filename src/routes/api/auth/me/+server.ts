// src/routes/api/auth/me/+server.ts
import { json, error, type RequestEvent } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import 'dotenv/config';

const JWT_SECRET = process.env.JWT_SECRET!;

interface AuthToken {
  sub: number;
  role: string;
  iat: number;
  exp: number;
}

export async function GET({ cookies }: RequestEvent) {
  try {
    const sessionToken = cookies.get('session');
    
    if (!sessionToken) {
      throw error(401, 'No authentication token provided');
    }

    // Verify JWT token
    let decoded: AuthToken;
    try {
      decoded = jwt.verify(sessionToken, JWT_SECRET) as AuthToken;
    } catch (jwtError) {
      // Clear invalid token
      cookies.delete('session', { path: '/' });
      cookies.delete('csrf_token', { path: '/' });
      throw error(401, 'Invalid authentication token');
    }

    // Get user from database - only get ID to verify user exists
    const userResult = await db
      .select({
        id: users.id,
        role: users.role
      })
      .from(users)
      .where(eq(users.id, decoded.sub))
      .limit(1);

    if (userResult.length === 0) {
      // User not found in database
      cookies.delete('session', { path: '/' });
      cookies.delete('csrf_token', { path: '/' });
      throw error(401, 'User not found');
    }

    const user = userResult[0];

    return json({
      success: true,
      user: {
        id: user.id,
        role: user.role
      }
    });

  } catch (err: any) {
    console.error('Auth me error:', err);
    
    if (err.status) {
      throw err;
    }
    
    throw error(500, 'Internal server error');
  }
}