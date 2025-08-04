import { db } from '$lib/server/db';
import { categories } from '$lib/server/db/schema';
import { like, eq, sql } from 'drizzle-orm';
import { json, error, type RequestEvent } from '@sveltejs/kit';
import slugify from 'slugify';
import { uploadImageKit } from '$lib/server/utils/upload-imageKit';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) throw new Error('JWT_SECRET is not defined');

/**
 * Validates the CSRF token using the double submit cookie pattern.
 * @param {Request} request - The incoming request object.
 * @returns {boolean} - True if the CSRF token is valid, otherwise false.
 */
function validateCSRFToken(request: Request): boolean {
  try {
    const csrfHeaderToken = request.headers.get('x-csrf-token');
    const sessionCookie = request.headers.get('cookie')?.split('; ').find(row => row.startsWith('session='));
    
    if (!csrfHeaderToken || !sessionCookie) {
      console.warn('CSRF validation failed: Missing token or session cookie');
      return false;
    }

    const tokenFromCookie = sessionCookie.split('=')[1];
    const decoded = jwt.verify(tokenFromCookie, JWT_SECRET, { algorithms: ['HS256'] });

    if (typeof decoded === 'object' && decoded !== null && 'csrf' in decoded) {
      const csrfPayloadToken = decoded.csrf;
      return csrfHeaderToken === csrfPayloadToken;
    }
    
    console.warn('CSRF validation failed: Invalid JWT payload');
    return false;

  } catch (err) {
    console.error('CSRF token validation error:', err);
    return false;
  }
}

/**
 * Ensures the user is an admin before processing the request.
 * @param {RequestEvent} event - The SvelteKit request event.
 * @returns {object} The user object if they are an admin.
 * @throws {Error} An error if the user is not an admin.
 */
function requireAdmin(event: RequestEvent) {
	const user = event.locals?.user;
	if (!user || user.role !== 'admin') {
		throw error(401, 'Unauthorized');
	}
	return user;
}

/**
 * Generates a unique slug for a category based on its name.
 * @param {string} base - The base name for the slug.
 * @returns {Promise<string>} The unique slug.
 */
async function generateUniqueSlug(base: string): Promise<string> {
	let slug = slugify(base, { lower: true, strict: true });
	let uniqueSlug = slug;
	let count = 1;

	while (true) {
		const existing = await db
			.select()
			.from(categories)
			.where(eq(categories.slug, uniqueSlug))
			.limit(1);

		if (existing.length === 0) break;

		uniqueSlug = `${slug}-${count}`;
		count++;
	}

	return uniqueSlug;
}

/**
 * Handles GET requests to fetch categories with pagination and search.
 * @param {RequestEvent} event - The SvelteKit request event.
 * @returns {Promise<Response>} A JSON response containing the categories and pagination info.
 */
export async function GET({ url }) {
	const q = url.searchParams.get('q') || '';
	const page = parseInt(url.searchParams.get('page') || '1', 10);
	const perPage = parseInt(url.searchParams.get('perPage') || '10', 10);
	const offset = (page - 1) * perPage;

	try {
		const data = await db
			.select()
			.from(categories)
			.where(like(categories.name, `%${q}%`))
			.limit(perPage)
			.offset(offset);

		const [{ total }] = await db
			.select({ total: sql<number>`COUNT(*)` })
			.from(categories)
			.where(like(categories.name, `%${q}%`));

		return json({
			data,
			total,
			page,
			perPage,
			totalPages: Math.ceil(total / perPage)
		});
	} catch (err) {
		console.error('Error fetching categories:', err);
		throw error(500, 'Internal Server Error');
	}
}

/**
 * Handles POST requests to create a new category.
 * @param {RequestEvent} event - The SvelteKit request event.
 * @returns {Promise<Response>} A JSON response indicating the success of the operation.
 */
export async function POST(event: RequestEvent) {
	const { request } = event;
	requireAdmin(event);

	// --- Perbaikan: Verifikasi CSRF ---
	if (!validateCSRFToken(request)) {
		throw error(403, 'Invalid CSRF token');
	}

	try {
		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim();
		const parentIdRaw = formData.get('parent_id');
		const imageFile = formData.get('image') as File | null;

		if (!name) throw error(400, 'Name is required');

		const existing = await db
			.select()
			.from(categories)
			.where(like(categories.name, name))
			.limit(1);

		if (existing.length > 0) throw error(409, 'Category already exists');

		const slug = await generateUniqueSlug(name);
		let imageUrl: string | null = null;

		if (imageFile && imageFile.size > 0) {
			const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
			if (!allowed.includes(imageFile.type)) throw error(400, 'Invalid image type');
			if (imageFile.size > 5 * 1024 * 1024) throw error(400, 'Image too large');
			imageUrl = await uploadImageKit(imageFile, 'categories');
		}

		let parentId: number | null = null;
		
		if (parentIdRaw !== null && typeof parentIdRaw === 'string') {
			const parentIdStr = parentIdRaw.toString().trim();
			if (parentIdStr !== '' && parentIdStr !== 'null') {
				const parsedParentId = parseInt(parentIdStr, 10);
				if (!isNaN(parsedParentId) && parsedParentId > 0) {
					parentId = parsedParentId;
				}
			}
		}

		const insertData = {
			name,
			slug,
			image: imageUrl,
			parent_id: parentId
		};

		const result = await db.insert(categories).values(insertData);

		const insertedCategory = await db
			.select()
			.from(categories)
			.where(eq(categories.slug, slug))
			.limit(1);
			
		return json({
			success: true,
			message: 'Category created successfully',
			category: insertedCategory[0]
		});
		
	} catch (err: any) {
		console.error('POST /api/categories error:', err);
		if (err.status) throw err;
		throw error(500, 'Failed to create category');
	}
}
