import { db } from '$lib/server/db';
import { products, productImages, orders, orderItems } from '$lib/server/db/schema';
import { like, eq, sql, and, inArray } from 'drizzle-orm';
import { json, error, type RequestEvent } from '@sveltejs/kit';
import slugify from 'slugify';
import { uploadImageKit } from '$lib/server/utils/upload-imageKit';
import crypto from 'crypto';
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

async function generateUniqueSlug(base: string, excludeId?: number): Promise<string> {
	let slug = slugify(base, { lower: true, strict: true });
	let uniqueSlug = slug;
	let count = 1;

	while (true) {
		let query = db
			.select()
			.from(products)
			.where(eq(products.slug, uniqueSlug))
			.limit(1);

		// Exclude current product when editing
		if (excludeId) {
			query = db
				.select()
				.from(products)
				.where(sql`${products.slug} = ${uniqueSlug} AND ${products.id} != ${excludeId}`)
				.limit(1);
		}

		const existing = await query;
		if (existing.length === 0) break;

		uniqueSlug = `${slug}-${count}`;
		count++;
	}

	return uniqueSlug;
}

// Helper function to get sold count for products
async function getSoldCountForProducts(productIds: number[]): Promise<Map<number, number>> {
	if (productIds.length === 0) return new Map();

	try {
		// Query untuk mendapatkan total quantity yang terjual per produk
		// Hanya menghitung order dengan status yang sudah selesai
		const soldCountQuery = await db
			.select({
				productId: orderItems.productId,
				totalSold: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)`.as('totalSold')
			})
			.from(orderItems)
			.innerJoin(orders, eq(orderItems.orderId, orders.id))
			.where(
				and(
					inArray(orderItems.productId, productIds),
					inArray(orders.status, ['completed', 'shipped', 'delivered'])
				)
			)
			.groupBy(orderItems.productId);

		return new Map(
			soldCountQuery.map(item => [item.productId, Number(item.totalSold)])
		);
	} catch (err) {
		console.error('Error fetching sold counts:', err);
		return new Map();
	}
}

// Helper function to attach images and sold count to products
async function enrichProductsData(productsData: any[], withSoldCount: boolean = false) {
	const productIds = productsData.map(product => product.id);

	// Get images for all products
	const allImages = await db
		.select()
		.from(productImages)
		.where(inArray(productImages.productId, productIds));

	// Group images by productId
	const imagesByProduct = new Map<number, string[]>();
	allImages.forEach(img => {
		if (!imagesByProduct.has(img.productId)) {
			imagesByProduct.set(img.productId, []);
		}
		imagesByProduct.get(img.productId)!.push(img.image);
	});

	// Get sold count if requested
	let soldCountMap = new Map<number, number>();
	if (withSoldCount) {
		soldCountMap = await getSoldCountForProducts(productIds);
	}

	// Enrich products with images and sold count
	return productsData.map(product => ({
		...product,
		images: imagesByProduct.get(product.id) || [],
		...(withSoldCount && { soldCount: soldCountMap.get(product.id) || 0 })
	}));
}

// GET - Fetch all products with search and pagination
export async function GET({ url }) {
	const q = url.searchParams.get('q') || '';
	const page = parseInt(url.searchParams.get('page') || '1', 10);
	const perPage = parseInt(url.searchParams.get('perPage') || '10', 10);
	const categoryId = url.searchParams.get('categoryId');
	const slug = url.searchParams.get('slug');
	const withSoldCount = url.searchParams.get('withSoldCount') === 'true';
	const sortBy = url.searchParams.get('sortBy') || 'id'; // id, name, price, soldCount
	const sortOrder = url.searchParams.get('sortOrder') || 'desc'; // asc, desc
	const offset = (page - 1) * perPage;

	try {
		// If slug is provided, return single product
		if (slug) {
			const product = await db
				.select()
				.from(products)
				.where(eq(products.slug, slug))
				.limit(1);

			if (product.length === 0) {
				throw error(404, 'Product not found');
			}

			// Enrich single product data
			const enrichedProduct = await enrichProductsData([product[0]], withSoldCount);

			return json({
				success: true,
				data: enrichedProduct[0]
			});
		}

		// Build where conditions
		let whereConditions = sql`1=1`;
		
		if (q) {
			whereConditions = sql`${whereConditions} AND (${products.name} LIKE ${`%${q}%`} OR ${products.description} LIKE ${`%${q}%`})`;
		}
		
		if (categoryId) {
			const categoryIdNum = parseInt(categoryId, 10);
			if (!isNaN(categoryIdNum)) {
				whereConditions = sql`${whereConditions} AND ${products.categoryId} = ${categoryIdNum}`;
			}
		}

		// Determine order by clause
		let orderByClause;
		const isAsc = sortOrder.toLowerCase() === 'asc';
		
		switch (sortBy) {
			case 'name':
				orderByClause = isAsc ? products.name : sql`${products.name} DESC`;
				break;
			case 'price':
				orderByClause = isAsc ? products.price : sql`${products.price} DESC`;
				break;
			case 'stock':
				orderByClause = isAsc ? products.stock : sql`${products.stock} DESC`;
				break;
			case 'createdAt':
				orderByClause = isAsc ? products.createdAt : sql`${products.createdAt} DESC`;
				break;
			default:
				orderByClause = isAsc ? products.id : sql`${products.id} DESC`;
		}

		// Get products with pagination
		const data = await db
			.select()
			.from(products)
			.where(whereConditions)
			.limit(perPage)
			.offset(offset)
			.orderBy(orderByClause);

		// Get total count
		const [{ total }] = await db
			.select({ total: sql<number>`COUNT(*)`.as('total') })
			.from(products)
			.where(whereConditions);

		// Enrich products with images and sold count
		const enrichedProducts = await enrichProductsData(data, withSoldCount);

		// If sorting by soldCount, we need to sort after enriching the data
		let finalProducts = enrichedProducts;
		if (sortBy === 'soldCount' && withSoldCount) {
			finalProducts = enrichedProducts.sort((a, b) => {
				const aCount = a.soldCount || 0;
				const bCount = b.soldCount || 0;
				return isAsc ? aCount - bCount : bCount - aCount;
			});
		}

		return json({
			success: true,
			data: finalProducts,
			pagination: {
				total: Number(total),
				page,
				perPage,
				totalPages: Math.ceil(Number(total) / perPage)
			},
			meta: {
				query: q,
				categoryId,
				sortBy,
				sortOrder,
				withSoldCount
			}
		});
	} catch (err) {
		console.error('Error fetching products:', err);
		if (err.status) throw err;
		throw error(500, 'Internal Server Error');
	}
}

// POST - Create new product
export async function POST(event: RequestEvent) {
	const { request } = event;
	const user = requireAdmin(event);

  if (!validateCSRFToken(request)) {
		throw error(403, 'Invalid CSRF token');
	 }

	try {
		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim();
		const description = formData.get('description')?.toString().trim();
		const price = formData.get('price')?.toString();
		const stock = formData.get('stock')?.toString();
		const categoryId = formData.get('categoryId')?.toString();
		
		// Optional dimensions for Biteship
		const height = formData.get('height')?.toString();
		const length = formData.get('length')?.toString();
		const weight = formData.get('weight')?.toString();
		const width = formData.get('width')?.toString();

		// Validation
		if (!name) throw error(400, 'Name is required');
		if (!price || isNaN(parseFloat(price))) throw error(400, 'Valid price is required');
		if (!categoryId || isNaN(parseInt(categoryId))) throw error(400, 'Valid category ID is required');

		// Check if product already exists
		const existing = await db
			.select()
			.from(products)
			.where(like(products.name, name));

		if (existing.length > 0) throw error(409, 'Product already exists');

		const slug = await generateUniqueSlug(name);

		// Prepare insert data
		const insertData: any = {
			name,
			slug,
			description: description || null,
			price: parseFloat(price),
			stock: stock ? parseInt(stock, 10) : 0,
			categoryId: parseInt(categoryId, 10),
			createdAt: new Date(),
			updatedAt: new Date()
		};

		// Add optional dimensions if provided
		if (height && !isNaN(parseInt(height))) insertData.height = parseInt(height, 10);
		if (length && !isNaN(parseInt(length))) insertData.length = parseInt(length, 10);
		if (weight && !isNaN(parseInt(weight))) insertData.weight = parseInt(weight, 10);
		if (width && !isNaN(parseInt(width))) insertData.width = parseInt(width, 10);

		// Insert product
		const result = await db.insert(products).values(insertData);
		const productId = result[0].insertId;

		// Handle multiple images
		const imageFiles: File[] = [];
		const entries = Array.from(formData.entries());
		
		for (const [key, value] of entries) {
			if (key.startsWith('images') && value instanceof File && value.size > 0) {
				imageFiles.push(value);
			}
		}

		// Upload and save images
		const uploadedImages: string[] = [];
		for (const imageFile of imageFiles) {
			const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
			if (!allowed.includes(imageFile.type)) throw error(400, 'Invalid image type');
			if (imageFile.size > 5 * 1024 * 1024) throw error(400, 'Image too large');

			const imageUrl = await uploadImageKit(imageFile, 'products');
			uploadedImages.push(imageUrl);

			// Save to product_images table
			await db.insert(productImages).values({
				productId: productId,
				image: imageUrl
			});
		}

		// Get the created product with images
		const createdProduct = await db
			.select()
			.from(products)
			.where(eq(products.id, productId))
			.limit(1);

		return json({
			success: true,
			message: 'Product created successfully',
			data: {
				...createdProduct[0],
				images: uploadedImages,
				soldCount: 0
			}
		});
	} catch (err: any) {
		console.error('POST /api/products error:', err);
		if (err.status) throw err;
		throw error(500, 'Failed to create product');
	}
}

// PUT - Update product
export async function PUT(event: RequestEvent) {
	const { request, url } = event;
	const user = requireAdmin(event);
	const productId = url.searchParams.get('id');

	if (!productId || isNaN(parseInt(productId))) {
		throw error(400, 'Valid product ID is required');
	}

  if (!validateCSRFToken(request)) {
		throw error(403, 'Invalid CSRF token');
	}

	try {
		const id = parseInt(productId, 10);

		// Check if product exists
		const existingProduct = await db
			.select()
			.from(products)
			.where(eq(products.id, id))
			.limit(1);

		if (existingProduct.length === 0) {
			throw error(404, 'Product not found');
		}

		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim();
		const description = formData.get('description')?.toString().trim();
		const price = formData.get('price')?.toString();
		const stock = formData.get('stock')?.toString();
		const categoryId = formData.get('categoryId')?.toString();
		
		// Optional dimensions
		const height = formData.get('height')?.toString();
		const length = formData.get('length')?.toString();
		const weight = formData.get('weight')?.toString();
		const width = formData.get('width')?.toString();

		// Validation
		if (!name) throw error(400, 'Name is required');
		if (!price || isNaN(parseFloat(price))) throw error(400, 'Valid price is required');
		if (!categoryId || isNaN(parseInt(categoryId))) throw error(400, 'Valid category ID is required');

		// Check if another product with same name exists (excluding current)
		const nameConflict = await db
			.select()
			.from(products)
			.where(sql`${products.name} = ${name} AND ${products.id} != ${id}`);

		if (nameConflict.length > 0) throw error(409, 'Product with this name already exists');

		// Generate slug if name changed
		let slug = existingProduct[0].slug;
		if (name !== existingProduct[0].name) {
			slug = await generateUniqueSlug(name, id);
		}

		// Prepare update data
		const updateData: any = {
			name,
			slug,
			description: description || null,
			price: parseFloat(price),
			stock: stock ? parseInt(stock, 10) : 0,
			categoryId: parseInt(categoryId, 10),
			updatedAt: new Date()
		};

		// Update optional dimensions
		updateData.height = height && !isNaN(parseInt(height)) ? parseInt(height, 10) : null;
		updateData.length = length && !isNaN(parseInt(length)) ? parseInt(length, 10) : null;
		updateData.weight = weight && !isNaN(parseInt(weight)) ? parseInt(weight, 10) : null;
		updateData.width = width && !isNaN(parseInt(width)) ? parseInt(width, 10) : null;

		// Update product
		await db
			.update(products)
			.set(updateData)
			.where(eq(products.id, id));

		// Handle new images
		const imageFiles: File[] = [];
		const entries = Array.from(formData.entries());
		
		for (const [key, value] of entries) {
			if (key.startsWith('images') && value instanceof File && value.size > 0) {
				imageFiles.push(value);
			}
		}

		// Upload new images if any
		const uploadedImages: string[] = [];
		for (const imageFile of imageFiles) {
			const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
			if (!allowed.includes(imageFile.type)) throw error(400, 'Invalid image type');
			if (imageFile.size > 5 * 1024 * 1024) throw error(400, 'Image too large');

			const imageUrl = await uploadImageKit(imageFile, 'products');
			uploadedImages.push(imageUrl);

			// Save to product_images table
			await db.insert(productImages).values({
				productId: id,
				image: imageUrl
			});
		}

		// Get updated product with enriched data
		const updatedProduct = await db
			.select()
			.from(products)
			.where(eq(products.id, id))
			.limit(1);

		const enrichedProduct = await enrichProductsData([updatedProduct[0]], true);

		return json({
			success: true,
			message: 'Product updated successfully',
			data: enrichedProduct[0]
		});
	} catch (err: any) {
		console.error('PUT /api/products error:', err);
		if (err.status) throw err;
		throw error(500, 'Failed to update product');
	}
}

// DELETE - Delete product
export async function DELETE(event: RequestEvent) {
	const { request, url } = event;
	const user = requireAdmin(event);
	const productId = url.searchParams.get('id');

	if (!productId || isNaN(parseInt(productId))) {
		throw error(400, 'Valid product ID is required');
	}

	// Use the same CSRF validation logic
	if (!validateCSRFToken(request)) {
		throw error(403, 'Invalid CSRF token');
	}

	try {
		const id = parseInt(productId, 10);

		// Check if product exists
		const existingProduct = await db
			.select()
			.from(products)
			.where(eq(products.id, id))
			.limit(1);

		if (existingProduct.length === 0) {
			throw error(404, 'Product not found');
		}

		// Check if product has any orders (prevent deletion if sold)
		const orderItemsCount = await db
			.select({ count: sql<number>`COUNT(*)`.as('count') })
			.from(orderItems)
			.where(eq(orderItems.productId, id));

		if (orderItemsCount[0].count > 0) {
			throw error(400, 'Cannot delete product that has been ordered. Consider marking it as inactive instead.');
		}

		// Delete product images first (foreign key constraint)
		await db
			.delete(productImages)
			.where(eq(productImages.productId, id));

		// Delete product
		await db
			.delete(products)
			.where(eq(products.id, id));

		return json({
			success: true,
			message: 'Product deleted successfully'
		});
	} catch (err: any) {
		console.error('DELETE /api/products error:', err);
		if (err.status) throw err;
		throw error(500, 'Failed to delete product');
	}
}
