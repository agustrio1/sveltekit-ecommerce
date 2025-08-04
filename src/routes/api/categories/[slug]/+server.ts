// src/routes/api/categories/[slug]/+server.ts

import { db } from '$lib/server/db';
import { categories } from '$lib/server/db/schema';
import { eq, like, and, not, sql } from 'drizzle-orm';
import { json, error, type RequestEvent } from '@sveltejs/kit';
import slugify from 'slugify';
import { uploadImageKit } from '$lib/server/utils/upload-imageKit';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) throw new Error('JWT_SECRET is not defined');

/**
 * Validates the CSRF token using the double submit cookie pattern.
 * It compares the token from the 'x-csrf-token' header with the one stored in the JWT payload.
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
 * Generates a unique slug for a category, ensuring it doesn't conflict with existing slugs.
 * It can also exclude a specific slug during the check, which is useful for updates.
 * @param {string} base - The base name for the slug.
 * @param {string} [excludeSlug] - The slug to be excluded from the uniqueness check.
 * @returns {Promise<string>} The unique slug.
 */
async function generateUniqueSlug(base: string, excludeSlug?: string): Promise<string> {
  let slug = slugify(base, { lower: true, strict: true });
  let uniqueSlug = slug;
  let count = 1;

  while (true) {
    let query = db.select().from(categories).where(eq(categories.slug, uniqueSlug));

    if (excludeSlug) {
      query = db.select().from(categories).where(and(eq(categories.slug, uniqueSlug), not(eq(categories.slug, excludeSlug))));
    }

    const existing = await query.limit(1);
    if (existing.length === 0) break;

    uniqueSlug = `${slug}-${count}`;
    count++;
  }

  return uniqueSlug;
}

// ---
// ==========================
// GET /api/categories/[slug]
// ==========================
/**
 * Handles GET requests to fetch a single category by its slug.
 * @param {RequestEvent} event - The SvelteKit request event.
 * @returns {Promise<Response>} A JSON response containing the category data.
 */
export async function GET(event: RequestEvent): Promise<Response> {
  const { slug } = event.params;

  try {
    const result = await db.select().from(categories).where(eq(categories.slug, slug));
    if (result.length === 0) throw error(404, 'Category not found');

    return json({ data: result[0] });
  } catch (err: any) {
    console.error('GET /api/categories/[slug] error:', err);
    if (err.status) throw err;
    throw error(500, 'Failed to fetch category');
  }
}

// ---
// ==========================
// PUT /api/categories/[slug]
// ==========================
/**
 * Handles PUT requests to update an existing category.
 * Requires admin privileges and a valid CSRF token.
 * @param {RequestEvent} event - The SvelteKit request event.
 * @returns {Promise<Response>} A JSON response indicating the success of the update.
 */
export async function PUT(event: RequestEvent): Promise<Response> {
  const { request } = event;
  requireAdmin(event);

  if (!validateCSRFToken(request)) {
    throw error(403, 'Invalid CSRF token');
  }

  const { slug: currentSlug } = event.params;

  try {
    const existing = await db.select().from(categories).where(eq(categories.slug, currentSlug));
    if (existing.length === 0) throw error(404, 'Category not found');

    const formData = await request.formData();
    const name = formData.get('name')?.toString().trim();
    const parentIdRaw = formData.get('parent_id');
    const imageFile = formData.get('image') as File | null;

    if (!name) throw error(400, 'Name is required');

    const duplicate = await db
      .select()
      .from(categories)
      .where(and(like(categories.name, name), not(eq(categories.slug, currentSlug))));
    if (duplicate.length > 0) throw error(409, 'Category with this name already exists');

    const slug = await generateUniqueSlug(name, currentSlug);

    let imageUrl: string | undefined;
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

    const updateData: any = {
      name,
      slug,
      updated_at: new Date(),
      parentId: parentId,
      image: imageUrl 
    };
    
    await db.update(categories).set(updateData).where(eq(categories.slug, currentSlug));
    
    const updated = await db.select().from(categories).where(eq(categories.slug, slug));

    return json({
      success: true,
      message: 'Category updated successfully',
      category: updated[0]
    });
  } catch (err: any) {
    console.error('PUT /api/categories/[slug] error:', err);
    if (err.status) throw err;
    throw error(500, 'Failed to update category');
  }
}

// ---
// =============================
// DELETE /api/categories/[slug]
// =============================
/**
 * Handles DELETE requests to remove a category.
 * Requires admin privileges and a valid CSRF token.
 * @param {RequestEvent} event - The SvelteKit request event.
 * @returns {Promise<Response>} A JSON response indicating the success of the deletion.
 */
export async function DELETE(event: RequestEvent): Promise<Response> {
  const { request } = event;
  requireAdmin(event);

  if (!validateCSRFToken(request)) {
    throw error(403, 'Invalid CSRF token');
  }

  const { slug } = event.params;

  try {
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, slug));

    if (!category) {
      throw error(404, 'Category not found');
    }

    const categoryId = category.id;
    if (!categoryId || isNaN(categoryId)) {
      throw error(500, 'Invalid category ID');
    }

    const children = await db
      .select()
      .from(categories)
      .where(eq(categories.parentId, categoryId));

    if (children.length > 0) {
      throw error(409, 'Cannot delete category with subcategories');
    }

    await db.delete(categories).where(eq(categories.slug, slug));

    return json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (err: any) {
    console.error('DELETE /api/categories/[slug] error:', err);
    if (err.status) throw err;
    throw error(500, 'Failed to delete category');
  }
}
