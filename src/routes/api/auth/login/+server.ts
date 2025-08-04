import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import * as bcryptjs from 'bcryptjs';
import { json, error, type RequestEvent } from '@sveltejs/kit';
import { serialize } from 'cookie';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import 'dotenv/config';

/**
 * HashiCorp Vault is a secure secrets management tool.
 * @see https://www.vaultproject.io/
 */

// --- Konfigurasi dan Variabel Lingkungan ---
const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) {
  throw new Error('Environment variable JWT_SECRET is not defined');
}

const isProduction = process.env.NODE_ENV === 'production';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 hari
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 menit
const MAX_LOGIN_ATTEMPTS = 5; // Maksimal 5x percobaan login gagal per IP dalam 15 menit

// --- In-memory rate limiting store (gunakan Redis di produksi) ---
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();

/**
 * Memverifikasi dan mencatat percobaan login untuk mencegah brute-force.
 * @param {string} ip - Alamat IP klien yang melakukan permintaan.
 * @param {boolean} isSuccess - Status percobaan login (berhasil/gagal).
 * @returns {boolean} - True jika percobaan diizinkan, false jika melebihi batas.
 */
function checkRateLimit(ip: string, isSuccess: boolean): boolean {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, lastAttempt: now };

  // Reset hitungan jika jendela waktu sudah habis
  if (now - record.lastAttempt > RATE_LIMIT_WINDOW_MS) {
    record.count = 0;
  }

  // Jika login berhasil, reset hitungan
  if (isSuccess) {
    loginAttempts.delete(ip);
    return true;
  }
  
  // Jika percobaan gagal, tambah hitungan
  record.count++;
  record.lastAttempt = now;
  loginAttempts.set(ip, record);

  return record.count <= MAX_LOGIN_ATTEMPTS;
}

/**
 * Menghasilkan token CSRF yang acak dan unik.
 * Token ini akan digunakan untuk melindungi dari serangan Cross-Site Request Forgery (CSRF).
 * @returns {string} - Token CSRF acak dalam format hex.
 */
function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Menangani permintaan POST untuk otentikasi pengguna.
 * Proses ini mencakup validasi input, verifikasi kata sandi,
 * pembuatan token JWT, dan pengaturan cookie sesi dan CSRF yang aman.
 * @param {RequestEvent} event - Objek RequestEvent dari SvelteKit.
 * @returns {Promise<Response>} - Respon JSON yang menunjukkan status login.
 */
export async function POST(event: RequestEvent): Promise<Response> {
  const { request, getClientAddress } = event;
  const clientIP = getClientAddress();

  try {
    const { email, password } = await request.json();

    // --- Langkah 1: Rate Limiting Pre-check ---
    const isAllowed = checkRateLimit(clientIP, false);
    if (!isAllowed) {
      throw error(429, 'Too many login attempts. Please try again later.');
    }

    // --- Langkah 2: Validasi Input Dasar ---
    if (!email || !password) {
      throw error(400, 'Email and password are required');
    }

    // --- Langkah 3: Cari Pengguna dan Verifikasi Kata Sandi ---
    const userResult = await db.select().from(users).where(eq(users.email, email));
    const user = userResult[0];

    const isPasswordValid = user ? await bcryptjs.compare(password, user.password) : false;

    if (!isPasswordValid) {
      // Catat percobaan gagal dan lemparkan error
      checkRateLimit(clientIP, false);
      throw error(401, 'Invalid email or password');
    }
    
    // --- Langkah 4: Jika login berhasil, reset hitungan rate limit ---
    checkRateLimit(clientIP, true);

    // --- Langkah 5: Generate Token CSRF dan JWT ---
    const csrfToken = generateCSRFToken();

    const jwtPayload = {
      sub: user.id,
      role: user.role,
      csrf: csrfToken
    };

    const token = jwt.sign(jwtPayload, JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '7d'
    });

    // --- Langkah 6: Buat dan Atur Cookie yang Aman ---
    const sessionCookie = serialize('session', token, {
      httpOnly: true,
      path: '/',
      maxAge: COOKIE_MAX_AGE,
      sameSite: 'lax',
      secure: isProduction
    });

    const csrfCookie = serialize('csrf_token', csrfToken, {
      httpOnly: false,
      path: '/',
      maxAge: COOKIE_MAX_AGE,
      sameSite: 'lax',
      secure: isProduction
    });
    
    // --- Langkah 7: Kirim Respons Berhasil ---
    return new Response(JSON.stringify({ success: true }), {
      headers: {
        'Set-Cookie': [sessionCookie, csrfCookie],
        'Content-Type': 'application/json'
      }
    });

  } catch (err: any) {
    if (err.status) {
      // Tangani error yang sudah didefinisikan (misalnya 401, 429)
      throw err;
    }
    console.error('Login error:', err);
    // Tangani error internal server
    throw error(500, 'Internal Server Error');
  }
}
