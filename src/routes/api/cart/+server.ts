import { db } from '$lib/server/db';
import { products, productImages } from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { json, error, type RequestEvent } from '@sveltejs/kit';
import crypto from 'crypto';
import 'dotenv/config';

const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) throw new Error('JWT_SECRET is not defined');

interface CartItem {
	productId: number;
	quantity: number;
	addedAt: number;
}

interface SecureCartSession {
	items: CartItem[];
	signature: string;
	sessionId: string;
	createdAt: number;
	updatedAt: number;
}

interface CartItemWithDetails extends CartItem {
	id: number;
	name: string;
	slug: string;
	price: number;
	stock: number;
	images: string[];
	isAvailable: boolean;
	totalPrice: number;
}

const COOKIE_NAME = 'cart_session';
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// --- Utility Functions for Security ---

function generateSessionId(): string {
	return crypto.randomBytes(32).toString('hex');
}

/**
 * Creates the data string to be signed. This schema must be consistent for signing and verification.
 */
function createDataToSign(items: CartItem[], timestamp: number): string {
	return JSON.stringify({ items, timestamp });
}

/**
 * Creates a secure HMAC signature for the cart data.
 */
function createSignature(items: CartItem[], timestamp: number, sessionId: string): string {
	const dataToSign = createDataToSign(items, timestamp);
	return crypto
		.createHmac('sha256', JWT_SECRET)
		.update(`${dataToSign}:${sessionId}`)
		.digest('hex');
}

/**
 * Verifies the integrity of the cart session signature.
 */
function verifySignature(cartSession: SecureCartSession): boolean {
	const dataToSign = createDataToSign(cartSession.items, cartSession.updatedAt);
	const expectedSignature = createSignature(
		cartSession.items,
		cartSession.updatedAt,
		cartSession.sessionId
	);
	
	// Use timingSafeEqual to prevent timing attacks
	return crypto.timingSafeEqual(
		Buffer.from(cartSession.signature, 'hex'),
		Buffer.from(expectedSignature, 'hex')
	);
}

/**
 * Creates a new secure cart session.
 */
function createSecureCart(items: CartItem[]): SecureCartSession {
	const sessionId = generateSessionId();
	const timestamp = Date.now();
	const signature = createSignature(items, timestamp, sessionId);

	return {
		items,
		signature,
		sessionId,
		createdAt: timestamp,
		updatedAt: timestamp
	};
}

/**
 * Updates an existing secure cart session.
 */
function updateSecureCart(existingCart: SecureCartSession, newItems: CartItem[]): SecureCartSession {
	const timestamp = Date.now();
	const signature = createSignature(newItems, timestamp, existingCart.sessionId);

	return {
		...existingCart,
		items: newItems,
		signature,
		updatedAt: timestamp
	};
}

/**
 * Validates the entire cart session, including its signature and expiry.
 */
function validateCartSession(cartSession: SecureCartSession): boolean {
	if (!cartSession.items || !cartSession.signature || !cartSession.sessionId) {
		return false;
	}

	// Check if session is not too old (24 hours)
	if (Date.now() - cartSession.createdAt > SESSION_EXPIRY_MS) {
		return false;
	}

	// Verify the signature
	return verifySignature(cartSession);
}

/**
 * Safely parses the cart cookie, returning a validated SecureCartSession or null.
 */
function getValidatedCartSession(cookies: RequestEvent['cookies']): SecureCartSession | null {
	const cartData = cookies.get(COOKIE_NAME);
	if (!cartData) {
		return null;
	}

	try {
		const cartSession = JSON.parse(decodeURIComponent(cartData));
		if (validateCartSession(cartSession)) {
			return cartSession;
		}
	} catch {
		// Invalid cart data, will be treated as non-existent
	}

	// If parsing or validation fails, clear the invalid cookie
	cookies.delete(COOKIE_NAME, { path: '/' });
	return null;
}

/**
 * Sets the cart session cookie with all necessary security flags.
 */
function setCartCookie(cookies: RequestEvent['cookies'], cartSession: SecureCartSession | null) {
	if (cartSession === null || cartSession.items.length === 0) {
		cookies.delete(COOKIE_NAME, { path: '/' });
		return;
	}

	cookies.set(COOKIE_NAME, encodeURIComponent(JSON.stringify(cartSession)), {
		path: '/',
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'strict',
		maxAge: COOKIE_MAX_AGE
	});
}

// --- Product Data Fetching and Enrichment ---

async function enrichCartItems(items: CartItem[]): Promise<CartItemWithDetails[]> {
	if (items.length === 0) return [];

	const productIds = items.map(item => item.productId);
	
	const productsData = await db
		.select({
			id: products.id,
			name: products.name,
			slug: products.slug,
			price: products.price,
			stock: products.stock
		})
		.from(products)
		.where(inArray(products.id, productIds));

	const imagesData = await db
		.select({
			productId: productImages.productId,
			image: productImages.image
		})
		.from(productImages)
		.where(inArray(productImages.productId, productIds));

	const productMap = new Map(productsData.map(p => [p.id, p]));
	const imagesMap = new Map<number, string[]>();
	imagesData.forEach(img => {
		if (!imagesMap.has(img.productId)) {
			imagesMap.set(img.productId, []);
		}
		imagesMap.get(img.productId)!.push(img.image);
	});

	return items.map(item => {
		const product = productMap.get(item.productId);
		const images = imagesMap.get(item.productId) || [];
		
		if (!product) {
			return {
				...item,
				id: item.productId,
				name: 'Product not found',
				slug: '',
				price: 0,
				stock: 0,
				images: [],
				isAvailable: false,
				totalPrice: 0
			};
		}

		const isAvailable = product.stock >= item.quantity;
		const totalPrice = isAvailable ? product.price * item.quantity : 0;

		return {
			...item,
			id: product.id,
			name: product.name,
			slug: product.slug,
			price: product.price,
			stock: product.stock,
			images,
			isAvailable,
			totalPrice
		};
	});
}

// --- API Endpoints ---

export async function GET({ cookies }: RequestEvent) {
	try {
		const cartSession = getValidatedCartSession(cookies);
		
		if (!cartSession) {
			return json({
				success: true,
				data: { items: [], totalItems: 0, totalPrice: 0, sessionId: null }
			});
		}

		const enrichedItems = await enrichCartItems(cartSession.items);
		const totalItems = enrichedItems.reduce((sum, item) => sum + item.quantity, 0);
		const totalPrice = enrichedItems.reduce((sum, item) => sum + item.totalPrice, 0);

		return json({
			success: true,
			data: {
				items: enrichedItems,
				totalItems,
				totalPrice,
				sessionId: cartSession.sessionId
			}
		});
	} catch (err) {
		console.error('Error getting cart:', err);
		throw error(500, 'Failed to get cart');
	}
}

export async function POST({ request, cookies }: RequestEvent) {
	try {
		const { productId, quantity = 1 } = await request.json();

		if (!productId || typeof productId !== 'number') {
			throw error(400, 'Valid product ID is required');
		}

		if (typeof quantity !== 'number' || quantity < 1 || quantity > 10) {
			throw error(400, 'Quantity must be between 1 and 10');
		}

		const productData = await db
			.select({ id: products.id, name: products.name, stock: products.stock })
			.from(products)
			.where(eq(products.id, productId))
			.limit(1)
			.then(res => res[0]);

		if (!productData) {
			throw error(404, 'Product not found');
		}

		let cartSession = getValidatedCartSession(cookies);
		let existingItems = cartSession?.items || [];

		const existingItemIndex = existingItems.findIndex(item => item.productId === productId);
		let newItems: CartItem[];

		if (existingItemIndex >= 0) {
			const newQuantity = existingItems[existingItemIndex].quantity + quantity;
			
			if (newQuantity > productData.stock) {
				throw error(400, `Only ${productData.stock - existingItems[existingItemIndex].quantity} more available`);
			}
			if (newQuantity > 10) {
				throw error(400, 'Maximum 10 items per product allowed');
			}

			newItems = [...existingItems];
			newItems[existingItemIndex] = { ...newItems[existingItemIndex], quantity: newQuantity, addedAt: Date.now() };
		} else {
			if (quantity > productData.stock) {
				throw error(400, `Only ${productData.stock} items available in stock`);
			}
			newItems = [...existingItems, { productId, quantity, addedAt: Date.now() }];
		}

		const totalItems = newItems.reduce((sum, item) => sum + item.quantity, 0);
		if (totalItems > 50) {
			throw error(400, 'Maximum 50 items allowed in cart');
		}

		const newCartSession = cartSession ? updateSecureCart(cartSession, newItems) : createSecureCart(newItems);
		setCartCookie(cookies, newCartSession);

		const enrichedItems = await enrichCartItems(newItems);
		const totalPrice = enrichedItems.reduce((sum, item) => sum + item.totalPrice, 0);

		return json({
			success: true,
			message: `${productData.name} added to cart`,
			data: { items: enrichedItems, totalItems, totalPrice, sessionId: newCartSession.sessionId }
		});
	} catch (err: any) {
		console.error('Error adding to cart:', err);
		if (err.status) throw err;
		throw error(500, 'Failed to add to cart');
	}
}

export async function PUT({ request, cookies }: RequestEvent) {
	try {
		const { productId, quantity } = await request.json();

		if (!productId || typeof productId !== 'number') {
			throw error(400, 'Valid product ID is required');
		}
		if (typeof quantity !== 'number' || quantity < 0 || quantity > 10) {
			throw error(400, 'Quantity must be between 0 and 10');
		}

		const cartSession = getValidatedCartSession(cookies);
		if (!cartSession) {
			throw error(404, 'Cart not found');
		}

		const itemIndex = cartSession.items.findIndex(item => item.productId === productId);
		if (itemIndex === -1) {
			throw error(404, 'Product not found in cart');
		}

		let newItems: CartItem[];
		if (quantity === 0) {
			newItems = cartSession.items.filter(item => item.productId !== productId);
		} else {
			const product = await db
				.select({ stock: products.stock })
				.from(products)
				.where(eq(products.id, productId))
				.limit(1)
				.then(res => res[0]);

			if (!product) {
				throw error(404, 'Product not found');
			}
			if (product.stock < quantity) {
				throw error(400, `Only ${product.stock} items available in stock`);
			}

			newItems = [...cartSession.items];
			newItems[itemIndex] = { ...newItems[itemIndex], quantity, addedAt: Date.now() };
		}
		
		const totalItems = newItems.reduce((sum, item) => sum + item.quantity, 0);
		if (totalItems > 50) {
			throw error(400, 'Maximum 50 items allowed in cart');
		}

		const newCartSession = newItems.length > 0 ? updateSecureCart(cartSession, newItems) : null;
		setCartCookie(cookies, newCartSession);

		const enrichedItems = await enrichCartItems(newItems);
		const totalPrice = enrichedItems.reduce((sum, item) => sum + item.totalPrice, 0);

		return json({
			success: true,
			message: quantity === 0 ? 'Item removed from cart' : 'Cart updated',
			data: { items: enrichedItems, totalItems, totalPrice, sessionId: newCartSession?.sessionId }
		});
	} catch (err: any) {
		console.error('Error updating cart:', err);
		if (err.status) throw err;
		throw error(500, 'Failed to update cart');
	}
}

export async function DELETE({ request, cookies }: RequestEvent) {
	try {
		const url = new URL(request.url);
		const productIdParam = url.searchParams.get('productId');
		const clearAll = url.searchParams.get('clearAll') === 'true';

		if (clearAll) {
			setCartCookie(cookies, null);
			return json({
				success: true,
				message: 'Cart cleared',
				data: { items: [], totalItems: 0, totalPrice: 0, sessionId: null }
			});
		}

		if (!productIdParam || isNaN(parseInt(productIdParam))) {
			throw error(400, 'Valid product ID is required');
		}

		const productIdNum = parseInt(productIdParam);

		const cartSession = getValidatedCartSession(cookies);
		if (!cartSession) {
			throw error(404, 'Cart not found');
		}

		const newItems = cartSession.items.filter(item => item.productId !== productIdNum);

		if (newItems.length === cartSession.items.length) {
			throw error(404, 'Product not found in cart');
		}

		const newCartSession = newItems.length > 0 ? updateSecureCart(cartSession, newItems) : null;
		setCartCookie(cookies, newCartSession);

		const enrichedItems = await enrichCartItems(newItems);
		const totalItems = enrichedItems.reduce((sum, item) => sum + item.quantity, 0);
		const totalPrice = enrichedItems.reduce((sum, item) => sum + item.totalPrice, 0);

		return json({
			success: true,
			message: 'Item removed from cart',
			data: { items: enrichedItems, totalItems, totalPrice, sessionId: newCartSession?.sessionId }
		});
	} catch (err: any) {
		console.error('Error removing from cart:', err);
		if (err.status) throw err;
		throw error(500, 'Failed to remove from cart');
	}
}
