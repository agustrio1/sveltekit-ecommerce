import { db } from '$lib/server/db';
import { orders, orderItems, products, productImages } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { json, error, type RequestEvent } from '@sveltejs/kit';
import { ulid } from 'ulid';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import midtransClient from 'midtrans-client';
import { 
  calculateShippingRates, 
  calculatePackageDimensions,
  isValidIndonesianPostalCode 
} from '$lib/server/biteship-utils';

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY!;
const MIDTRANS_CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY!;
const MIDTRANS_IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION === 'true';
const BITESHIP_API_KEY = process.env.BITESHIP_API_KEY!;
const JWT_SECRET = process.env.JWT_SECRET!;

// SECURITY: Rate limiting configuration
const RATE_LIMIT = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // requests per window
  maxOrdersPerHour: 10, // max orders per IP per hour
  maxShippingRequests: 50 // max shipping requests per IP per hour
};

// SECURITY: Request size limits
const MAX_REQUEST_SIZE = 1024 * 1024; // 1MB
const MAX_ITEMS_PER_ORDER = 50;
const MAX_STRING_LENGTH = 1000;

// SECURITY: In-memory rate limiting (production should use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number; orders: number; shipping: number }>();

// Initialize Midtrans
const snap = new midtransClient.Snap({
  isProduction: MIDTRANS_IS_PRODUCTION,
  serverKey: MIDTRANS_SERVER_KEY,
  clientKey: MIDTRANS_CLIENT_KEY
});

// Store config
const STORE_CONFIG = {
  name: process.env.STORE_NAME! || 'Toko Online Anda',
  ownerName: process.env.STORE_OWNER_NAME! || 'Nama Pemilik Toko',
  phone: process.env.STORE_PHONE! || '08123456789',
  email: process.env.STORE_EMAIL! || 'info@tokoonline.com',
  address: process.env.STORE_ADDRESS! || 'Jl. Raya Utama No. 123, Kelurahan ABC',
  city: process.env.STORE_CITY! || 'Jakarta Selatan',
  province: process.env.STORE_PROVINCE! || 'DKI Jakarta',
  postalCode: process.env.STORE_POSTAL_CODE! || '12110',
  note: process.env.STORE_NOTE! || 'Dekat dengan minimarket atau patokan lainnya'
};

const BITESHIP_BASE_URL = 'https://api.biteship.com/v1';

// SECURITY: Rate limiting middleware
function checkRateLimit(ip: string, type: 'general' | 'orders' | 'shipping' = 'general'): boolean {
  const now = Date.now();
  const key = ip;
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { 
      count: 0, 
      resetTime: now + RATE_LIMIT.windowMs,
      orders: 0,
      shipping: 0
    });
  }
  
  const record = rateLimitStore.get(key)!;
  
  // Reset if window expired
  if (now > record.resetTime) {
    record.count = 0;
    record.orders = 0;
    record.shipping = 0;
    record.resetTime = now + RATE_LIMIT.windowMs;
  }
  
  // Check specific limits
  switch (type) {
    case 'orders':
      if (record.orders >= RATE_LIMIT.maxOrdersPerHour) return false;
      record.orders++;
      break;
    case 'shipping':
      if (record.shipping >= RATE_LIMIT.maxShippingRequests) return false;
      record.shipping++;
      break;
    default:
      if (record.count >= RATE_LIMIT.maxRequests) return false;
      record.count++;
  }
  
  return true;
}

// SECURITY: Input sanitization
function sanitizeString(input: any, maxLength: number = MAX_STRING_LENGTH): string {
  if (typeof input !== 'string') return '';
  
  // Remove potential XSS characters and trim
  const sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
    
  return sanitized.length > maxLength ? sanitized.substring(0, maxLength) : sanitized;
}

// SECURITY: Input validation with detailed checks
function validateOrderInput(input: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Required fields validation
  if (!input.recipientName || typeof input.recipientName !== 'string') {
    errors.push('Recipient name is required');
  } else if (input.recipientName.length < 2 || input.recipientName.length > 100) {
    errors.push('Recipient name must be between 2-100 characters');
  }
  
  // Phone validation (Indonesian format)
  if (!input.phone || typeof input.phone !== 'string') {
    errors.push('Phone number is required');
  } else if (!/^(\+62|62|0)[0-9]{8,13}$/.test(input.phone.replace(/[\s-]/g, ''))) {
    errors.push('Invalid Indonesian phone number format');
  }
  
  // Email validation
  if (!input.email || typeof input.email !== 'string') {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.push('Invalid email format');
  }
  
  // Address validation
  if (!input.address || typeof input.address !== 'string') {
    errors.push('Address is required');
  } else if (input.address.length < 10 || input.address.length > 500) {
    errors.push('Address must be between 10-500 characters');
  }
  
  // City and province validation
  if (!input.city || input.city.length < 2 || input.city.length > 100) {
    errors.push('Valid city is required');
  }
  if (!input.province || input.province.length < 2 || input.province.length > 100) {
    errors.push('Valid province is required');
  }
  
  // Postal code validation
  if (!isValidIndonesianPostalCode(input.postalCode)) {
    errors.push('Invalid Indonesian postal code');
  }
  
  // Courier validation
  if (!input.courierName || typeof input.courierName !== 'string') {
    errors.push('Courier name is required');
  }
  if (!input.courierService || typeof input.courierService !== 'string') {
    errors.push('Courier service is required');
  }
  
  // Items validation if provided
  if (input.items && Array.isArray(input.items)) {
    if (input.items.length > MAX_ITEMS_PER_ORDER) {
      errors.push(`Maximum ${MAX_ITEMS_PER_ORDER} items allowed per order`);
    }
    
    for (let i = 0; i < input.items.length; i++) {
      const item = input.items[i];
      if (!Number.isInteger(item.productId) || item.productId <= 0) {
        errors.push(`Invalid product ID at item ${i + 1}`);
      }
      if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 100) {
        errors.push(`Invalid quantity at item ${i + 1} (must be 1-100)`);
      }
    }
  }
  
  return { isValid: errors.length === 0, errors };
}

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

// SECURITY: Enhanced signature verification
function verifySignature(data: string, sessionId: string, signature: string): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${data}:${sessionId}`)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    return false;
  }
}

// SECURITY: Enhanced cart session validation
function validateCartSession(cartSession: any): { isValid: boolean; error?: string } {
  if (!cartSession || typeof cartSession !== 'object') {
    return { isValid: false, error: 'Invalid cart session format' };
  }
  
  if (!cartSession.items || !Array.isArray(cartSession.items)) {
    return { isValid: false, error: 'Invalid cart items' };
  }
  
  if (!cartSession.signature || !cartSession.sessionId) {
    return { isValid: false, error: 'Missing cart session signature' };
  }
  
  // Check expiration (24 hours)
  const twentyFourHours = 24 * 60 * 60 * 1000;
  if (!cartSession.createdAt || Date.now() - cartSession.createdAt > twentyFourHours) {
    return { isValid: false, error: 'Cart session expired' };
  }
  
  // Validate items count
  if (cartSession.items.length > MAX_ITEMS_PER_ORDER) {
    return { isValid: false, error: 'Too many items in cart' };
  }
  
  const dataString = JSON.stringify({ 
    items: cartSession.items, 
    timestamp: cartSession.updatedAt 
  });
  
  if (!verifySignature(dataString, cartSession.sessionId, cartSession.signature)) {
    return { isValid: false, error: 'Invalid cart session signature' };
  }
  
  return { isValid: true };
}

// SECURITY: Request origin validation
function validateOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  
  if (allowedOrigins.length === 0) return true; // Skip if not configured
  
  return allowedOrigins.some(allowed => 
    origin?.startsWith(allowed) || referer?.startsWith(allowed)
  );
}

// SECURITY: Request size validation
function validateRequestSize(request: Request): boolean {
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
    return false;
  }
  return true;
}

// Helper function to ensure number conversion
function ensureNumber(value: any, defaultValue: number = 0): number {
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}

// Helper function to format currency
function formatPrice(value: any): string {
  const num = ensureNumber(value);
  return num.toFixed(2);
}

// Helper function to format currency for Midtrans (integer)
function formatPriceForMidtrans(value: any): number {
  const num = ensureNumber(value);
  return Math.round(num);
}

// Helper function to format date for Midtrans
function formatDateForMidtrans(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} +0700`;
}

function generateOrderNumber(): string {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${timestamp.slice(-8)}-${random}`;
}

// SECURITY: Enhanced Biteship order creation with input validation
async function createBiteshipOrder(orderData: any) {
  try {
    console.log('Creating Biteship order...');
    
    // Validate required fields
    if (!orderData.recipientName || !orderData.phone || !orderData.address) {
      throw new Error('Missing required recipient information');
    }
    
    const packageData = calculatePackageDimensions(
      orderData.items.map((item: any) => ({
        weight: ensureNumber(item.weight, 100),
        height: ensureNumber(item.height, 5),
        length: ensureNumber(item.length, 10),
        width: ensureNumber(item.width, 10),
        quantity: ensureNumber(item.quantity, 1),
        value: ensureNumber(item.price)
      }))
    );

    const requestBody = {
      origin_contact_name: sanitizeString(STORE_CONFIG.ownerName, 100),
      origin_contact_phone: sanitizeString(STORE_CONFIG.phone, 20),
      origin_address: sanitizeString(STORE_CONFIG.address, 500),
      origin_note: sanitizeString(STORE_CONFIG.note, 200),
      origin_postal_code: STORE_CONFIG.postalCode,
      
      destination_contact_name: sanitizeString(orderData.recipientName, 100),
      destination_contact_phone: sanitizeString(orderData.phone, 20),
      destination_contact_email: sanitizeString(orderData.email, 100),
      destination_address: sanitizeString(orderData.address, 500),
      destination_postal_code: orderData.postalCode,
      destination_note: sanitizeString(orderData.orderNote || "", 200),
      
      courier_company: orderData.courierName.toLowerCase(),
      courier_type: orderData.courierService,
      delivery_type: orderData.deliveryType || "now",
      
      items: [{
        name: "Package",
        description: `Order ${orderData.orderNumber} from ${STORE_CONFIG.name}`,
        category: "fashion",
        value: packageData.value,
        weight: packageData.weight,
        height: packageData.height,
        length: packageData.length,
        width: packageData.width,
        quantity: 1
      }],
      
      reference_id: orderData.orderNumber,
      
      ...(orderData.courierInsurance && ensureNumber(orderData.courierInsurance) > 0 && {
        courier_insurance: Math.round(ensureNumber(orderData.courierInsurance))
      })
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${BITESHIP_BASE_URL}/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${BITESHIP_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to create shipping order: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Biteship order creation failed: ' + JSON.stringify(data));
      }

      return data;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (err) {
    console.error('Error creating Biteship order:', err);
    throw err;
  }
}

// SECURITY: Enhanced Midtrans payment creation with validation
async function createMidtransPayment(orderData: any) {
  try {
    const orderId = sanitizeString(orderData.orderNumber, 50);
    const grossAmount = formatPriceForMidtrans(orderData.total);
    
    // Validate amount
    if (grossAmount < 1000 || grossAmount > 999999999) {
      throw new Error('Invalid payment amount');
    }
    
    const startTime = formatDateForMidtrans();
    
    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: grossAmount
      },
      customer_details: {
        first_name: sanitizeString(orderData.recipientName.split(' ')[0], 50),
        last_name: sanitizeString(orderData.recipientName.split(' ').slice(1).join(' ') || '', 50),
        email: sanitizeString(orderData.email, 100),
        phone: sanitizeString(orderData.phone, 20),
        shipping_address: {
          first_name: sanitizeString(orderData.recipientName.split(' ')[0], 50),
          last_name: sanitizeString(orderData.recipientName.split(' ').slice(1).join(' ') || '', 50),
          email: sanitizeString(orderData.email, 100),
          phone: sanitizeString(orderData.phone, 20),
          address: sanitizeString(orderData.address, 500),
          city: sanitizeString(orderData.city, 100),
          postal_code: orderData.postalCode
        }
      },
      item_details: [
        ...orderData.items.map((item: any) => ({
          id: String(item.productId),
          price: formatPriceForMidtrans(item.price),
          quantity: ensureNumber(item.quantity, 1),
          name: sanitizeString(item.name, 50),
          category: sanitizeString(item.category || 'general', 50)
        })),
        {
          id: 'SHIPPING',
          price: formatPriceForMidtrans(orderData.shippingCost),
          quantity: 1,
          name: sanitizeString(`Shipping via ${orderData.courierName} ${orderData.courierService}`, 50),
          category: 'shipping'
        }
      ],
      enabled_payments: [
        "credit_card", "bca_va", "bni_va", "bri_va", "echannel", "permata_va",
        "other_va", "gopay", "shopeepay", "qris", "cstore", "akulaku"
      ],
      credit_card: {
        secure: true
      },
      expiry: {
        start_time: startTime,
        unit: "hours",
        duration: 24
      },
      callbacks: {
        finish: `${process.env.FRONTEND_URL}/orders/${orderData.id}/payment-success`,
        error: `${process.env.FRONTEND_URL}/orders/${orderData.id}/payment-error`,
        pending: `${process.env.FRONTEND_URL}/orders/${orderData.id}/payment-pending`
      }
    };

    console.log('Creating Midtrans transaction with:');
    console.log('- Order ID:', orderId);
    console.log('- Gross Amount:', grossAmount);
    console.log('- Start Time:', startTime);
    
    const transaction = await snap.createTransaction(parameter);
    return transaction;
  } catch (err) {
    console.error('Error creating Midtrans payment:', err);
    throw err;
  }
}

// GET - Get shipping rates
export async function GET({ url, locals, getClientAddress }: RequestEvent) {
  try {
    const clientIP = getClientAddress();
    
    // SECURITY: Rate limiting check
    if (!checkRateLimit(clientIP, 'shipping')) {
      throw error(429, 'Too many shipping requests. Please try again later.');
    }
    
    const destinationPostal = url.searchParams.get('destinationPostal');
    const itemsParam = url.searchParams.get('items');
    
    console.log('GET shipping rates - Postal:', destinationPostal);

    if (!destinationPostal) {
      throw error(400, 'Destination postal code is required');
    }

    if (!isValidIndonesianPostalCode(destinationPostal)) {
      throw error(400, 'Invalid postal code format. Please use 5-digit postal code.');
    }

    let items = [];
    if (itemsParam) {
      try {
        const parsedItems = JSON.parse(itemsParam);
        
        if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
          throw new Error('Items must be a non-empty array');
        }
        
        // SECURITY: Limit number of items
        if (parsedItems.length > MAX_ITEMS_PER_ORDER) {
          throw new Error(`Maximum ${MAX_ITEMS_PER_ORDER} items allowed`);
        }

        const productIds = parsedItems.map((item: any) => {
          if (!item.productId || !Number.isInteger(item.productId) || item.productId <= 0) {
            throw new Error('Invalid product ID');
          }
          if (!item.quantity || !Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 100) {
            throw new Error('Invalid quantity (must be 1-100)');
          }
          return item.productId;
        });
        
        const productsData = await db
          .select({
            id: products.id,
            price: products.price,
            weight: products.weight,
            height: products.height,
            length: products.length,
            width: products.width
          })
          .from(products)
          .where(inArray(products.id, productIds));

        if (productsData.length !== productIds.length) {
          throw new Error('Some products not found');
        }

        const productMap = new Map(productsData.map(p => [p.id, p]));

        items = parsedItems.map((item: any) => {
          const product = productMap.get(item.productId);
          if (!product) {
            throw new Error(`Product ${item.productId} not found`);
          }
          
          return {
            weight: Math.max(ensureNumber(product.weight, 100), 100),
            height: Math.max(ensureNumber(product.height, 5), 5),
            length: Math.max(ensureNumber(product.length, 10), 10),
            width: Math.max(ensureNumber(product.width, 10), 10),
            quantity: ensureNumber(item.quantity, 1),
            value: Math.max(ensureNumber(product.price, 10000), 10000)
          };
        });
      } catch (parseError: any) {
        console.error('Error parsing items:', parseError);
        throw error(400, `Invalid items parameter: ${parseError.message}`);
      }
    } else {
      items = [{
        weight: 500,
        height: 10,
        length: 15,
        width: 15,
        quantity: 1,
        value: 50000
      }];
    }

    console.log(`Processing ${items.length} items for shipping calculation`);
    
    const shippingRates = await calculateShippingRates(
      STORE_CONFIG.postalCode,
      destinationPostal,
      items
    );

    console.log(`Returning ${shippingRates.length} shipping rates`);

    return json({
      success: true,
      data: shippingRates,
      store_info: {
        name: STORE_CONFIG.name,
        city: STORE_CONFIG.city,
        province: STORE_CONFIG.province,
        postal_code: STORE_CONFIG.postalCode
      },
      request_info: {
        destination_postal: destinationPostal,
        total_items: items.length,
        total_weight: items.reduce((sum, item) => sum + (item.weight * item.quantity), 0),
        total_value: items.reduce((sum, item) => sum + (item.value * item.quantity), 0)
      }
    });

  } catch (err: any) {
    console.error('Error getting shipping rates:', err);
    if (err.status) throw err;
    throw error(500, `Failed to get shipping rates: ${err.message}`);
  }
}

// POST - Create order
export async function POST(event: RequestEvent) {
  const { request, cookies, locals, getClientAddress } = event;
  const user = locals?.user;
  const clientIP = getClientAddress();
  
  try {
    // SECURITY: Request size validation
    if (!validateRequestSize(request)) {
      throw error(413, 'Request too large');
    }
    
    // SECURITY: Origin validation
    if (!validateOrigin(request)) {
      throw error(403, 'Invalid request origin');
    }
    
    // SECURITY: Rate limiting
    if (!checkRateLimit(clientIP, 'orders')) {
      throw error(429, 'Too many order requests. Please try again later.');
    }
    
    // PERBAIKAN CSRF: Simplified validation
    if (!validateCSRFToken(request)) {
      console.log('❌ CSRF token validation failed');
      throw error(403, 'Invalid CSRF token');
    }
    
    console.log('✅ CSRF token validation passed');
    
    const orderRequest = await request.json();
    
    // SECURITY: Input validation
    const validation = validateOrderInput(orderRequest);
    if (!validation.isValid) {
      throw error(400, validation.errors.join(', '));
    }
    
    // SECURITY: Sanitize inputs
    const sanitizedRequest = {
      ...orderRequest,
      recipientName: sanitizeString(orderRequest.recipientName, 100),
      phone: sanitizeString(orderRequest.phone, 20),
      email: sanitizeString(orderRequest.email, 100),
      address: sanitizeString(orderRequest.address, 500),
      city: sanitizeString(orderRequest.city, 100),
      province: sanitizeString(orderRequest.province, 100),
      courierName: sanitizeString(orderRequest.courierName, 50),
      courierService: sanitizeString(orderRequest.courierService, 50),
      orderNote: sanitizeString(orderRequest.orderNote || '', 500)
    };

    // Get items from cart or direct items
    let cartItems: any[] = [];
    
    if (sanitizedRequest.useCart) {
      const cartData = cookies.get('cart_session');
      if (!cartData) {
        throw error(400, 'Cart is empty');
      }

      let cartSession;
      try {
        cartSession = JSON.parse(decodeURIComponent(cartData));
      } catch {
        throw error(400, 'Invalid cart data');
      }

      // SECURITY: Enhanced cart validation
      const cartValidation = validateCartSession(cartSession);
      if (!cartValidation.isValid) {
        throw error(400, cartValidation.error || 'Invalid cart session');
      }

      cartItems = cartSession.items;
    } else if (sanitizedRequest.items && sanitizedRequest.items.length > 0) {
      // SECURITY: Validate direct items
      if (sanitizedRequest.items.length > MAX_ITEMS_PER_ORDER) {
        throw error(400, `Maximum ${MAX_ITEMS_PER_ORDER} items allowed`);
      }
      
      cartItems = sanitizedRequest.items.map((item: any) => ({
        productId: item.productId,
        quantity: ensureNumber(item.quantity, 1),
        addedAt: Date.now()
      }));
    } else {
      throw error(400, 'No items provided');
    }

    if (cartItems.length === 0) {
      throw error(400, 'No items to order');
    }

    // Get product details
    const productIds = cartItems.map(item => item.productId);
    const productsData = await db
      .select({
        id: products.id,
        name: products.name,
        description: products.description,
        price: products.price,
        stock: products.stock,
        categoryId: products.categoryId,
        weight: products.weight,
        height: products.height,
        length: products.length,
        width: products.width
      })
      .from(products)
      .where(inArray(products.id, productIds));

    const productMap = new Map(productsData.map(p => [p.id, p]));

    // Validate stock and prepare order items
    const orderItemsData: any[] = [];
    let subtotal = 0;

    for (const cartItem of cartItems) {
      const product = productMap.get(cartItem.productId);
      if (!product) {
        throw error(400, `Product with ID ${cartItem.productId} not found`);
      }

      if (product.stock < cartItem.quantity) {
        throw error(400, `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${cartItem.quantity}`);
      }

      const productPrice = ensureNumber(product.price);
      const quantity = ensureNumber(cartItem.quantity, 1);
      const itemTotal = productPrice * quantity;
      subtotal += itemTotal;

      orderItemsData.push({
        productId: product.id,
        name: sanitizeString(product.name, 200),
        description: sanitizeString(product.description || '', 500),
        category: 'general',
        price: productPrice,
        quantity: quantity,
        weight: ensureNumber(product.weight, 100),
        height: ensureNumber(product.height, 5),
        length: ensureNumber(product.length, 10),
        width: ensureNumber(product.width, 10)
      });
    }

    // Calculate shipping cost using the new function
    const shippingItems = orderItemsData.map(item => ({
      weight: item.weight,
      height: item.height,
      length: item.length,
      width: item.width,
      quantity: item.quantity,
      value: item.price
    }));

    console.log('✅ Using cached shipping rates');
    const shippingRates = await calculateShippingRates(
      STORE_CONFIG.postalCode,
      sanitizedRequest.postalCode,
      shippingItems
    );

    // Find the selected shipping rate
    const selectedRate = shippingRates.find((rate: any) => 
      rate.courier_name.toLowerCase() === sanitizedRequest.courierName.toLowerCase() &&
      rate.courier_service_code === sanitizedRequest.courierService
    );

    if (!selectedRate) {
      throw error(400, 'Selected shipping method not available');
    }

    const shippingCost = ensureNumber(selectedRate.price);
    const insuranceFee = ensureNumber(selectedRate.insurance_fee);
    const total = subtotal + shippingCost + insuranceFee;

    // SECURITY: Validate total amount
    if (total < 1000 || total > 999999999) {
      throw error(400, 'Invalid order total amount');
    }

    // Create order
    const orderId = ulid();
    const orderNumber = generateOrderNumber();

    const orderData = {
      id: orderId,
      orderNumber,
      userId: user?.id || null,
      subtotal: formatPrice(subtotal),
      shippingCost: formatPrice(shippingCost),
      total: formatPrice(total),
      recipientName: sanitizedRequest.recipientName,
      phone: sanitizedRequest.phone,
      email: sanitizedRequest.email,
      address: sanitizedRequest.address,
      city: sanitizedRequest.city,
      province: sanitizedRequest.province,
      postalCode: sanitizedRequest.postalCode,
      shipperName: STORE_CONFIG.ownerName,
      shipperPhone: STORE_CONFIG.phone,
      shipperEmail: STORE_CONFIG.email,
      originAddress: STORE_CONFIG.address,
      originNote: STORE_CONFIG.note,
      originPostal: STORE_CONFIG.postalCode,
      courierName: sanitizedRequest.courierName,
      courierService: sanitizedRequest.courierService,
      courierInsurance: formatPrice(insuranceFee),
      deliveryType: sanitizedRequest.deliveryType || 'now',
      orderNote: sanitizedRequest.orderNote || null,
      metadata: JSON.stringify({
        biteship_rate: selectedRate,
        store_config: STORE_CONFIG,
        created_from: 'web',
        client_ip: clientIP,
        user_agent: request.headers.get('user-agent')
      }),
      status: 'pending'
    };

    // Start transaction
    await db.transaction(async (tx) => {
      // Insert order
      await tx.insert(orders).values(orderData);

      // Insert order items and update stock
      for (const item of orderItemsData) {
        await tx.insert(orderItems).values({
          orderId,
          productId: item.productId,
          name: item.name,
          description: item.description,
          category: item.category,
          price: formatPrice(item.price),
          quantity: item.quantity,
          weight: item.weight,
          height: item.height,
          length: item.length,
          width: item.width
        });

        // Update product stock
        const product = productMap.get(item.productId);
        if (product) {
          await tx
            .update(products)
            .set({ 
              stock: product.stock - item.quantity,
              updatedAt: new Date()
            })
            .where(eq(products.id, item.productId));
        }
      }
    });

    // Create Midtrans payment
    const midtransData = await createMidtransPayment({
      ...orderData,
      items: orderItemsData,
      total: total
    });

    // Clear cart if using cart
    if (sanitizedRequest.useCart) {
      cookies.delete('cart_session', { path: '/' });
    }

    console.log('✅ Order created successfully:', orderNumber);

    return json({
      success: true,
      message: 'Order created successfully',
      data: {
        orderId,
        orderNumber,
        total: formatPrice(total),
        store_info: STORE_CONFIG,
        payment: {
          token: midtransData.token,
          redirect_url: midtransData.redirect_url
        }
      }
    });

  } catch (err: any) {
    console.error('Error creating order:', err);
    if (err.status) throw err;
    throw error(500, 'Failed to create order: ' + err.message);
  }
}

// PUT - Update order status
export async function PUT(event: RequestEvent) {
  const { request, locals, getClientAddress } = event;
  const user = locals?.user;
  const clientIP = getClientAddress();
  
  try {
    // SECURITY: Request size validation
    if (!validateRequestSize(request)) {
      throw error(413, 'Request too large');
    }
    
    // SECURITY: Origin validation
    if (!validateOrigin(request)) {
      throw error(403, 'Invalid request origin');
    }
    
    // SECURITY: Rate limiting
    if (!checkRateLimit(clientIP, 'general')) {
      throw error(429, 'Too many requests. Please try again later.');
    }
    
    // CSRF validation
    if (!validateCSRFToken(request)) {
      throw error(403, 'Invalid CSRF token');
    }

    const requestBody = await request.json();
    
    // SECURITY: Input validation and sanitization
    const orderId = sanitizeString(requestBody.orderId, 50);
    const status = sanitizeString(requestBody.status, 50);
    
    if (!orderId || !status) {
      throw error(400, 'Order ID and status are required');
    }
    
    // SECURITY: Validate status values
    const allowedStatuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'failed'];
    if (!allowedStatuses.includes(status)) {
      throw error(400, 'Invalid status value');
    }

    const existingOrder = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (existingOrder.length === 0) {
      throw error(404, 'Order not found');
    }
    
    // SECURITY: Authorization check - only allow user to update their own orders or admin
    if (user && existingOrder[0].userId !== user.id && !user.isAdmin) {
      throw error(403, 'Not authorized to update this order');
    }

    const updateData: any = {
      status,
      updatedAt: new Date()
    };

    // SECURITY: Sanitize and validate optional data
    if (requestBody.paymentData && typeof requestBody.paymentData === 'object') {
      const existingMetadata = JSON.parse(existingOrder[0].metadata || '{}');
      updateData.metadata = JSON.stringify({
        ...existingMetadata,
        payment: {
          ...requestBody.paymentData,
          updated_at: new Date().toISOString(),
          updated_by: user?.id || 'system'
        }
      });
    }

    if (requestBody.shippingData && typeof requestBody.shippingData === 'object') {
      const existingMetadata = JSON.parse(existingOrder[0].metadata || '{}');
      updateData.metadata = JSON.stringify({
        ...existingMetadata,
        shipping: {
          ...requestBody.shippingData,
          updated_at: new Date().toISOString(),
          updated_by: user?.id || 'system'
        }
      });
    }

    await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, orderId));

    // Create shipping order when payment is confirmed
    if (status === 'paid' && !JSON.parse(existingOrder[0].metadata || '{}').shipping) {
      try {
        const orderItemsData = await db
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, orderId));

        const biteshipData = await createBiteshipOrder({
          ...existingOrder[0],
          items: orderItemsData
        });

        await db
          .update(orders)
          .set({
            metadata: JSON.stringify({
              ...JSON.parse(existingOrder[0].metadata || '{}'),
              shipping: {
                ...biteshipData,
                created_at: new Date().toISOString(),
                created_by: user?.id || 'system'
              }
            }),
            status: 'processing'
          })
          .where(eq(orders.id, orderId));

        console.log('Shipping order created successfully:', biteshipData.id);
      } catch (shippingErr) {
        console.error('Error creating shipping order:', shippingErr);
        // Don't fail the whole request if shipping creation fails
      }
    }

    return json({
      success: true,
      message: 'Order updated successfully'
    });

  } catch (err: any) {
    console.error('Error updating order:', err);
    if (err.status) throw err;
    throw error(500, 'Failed to update order: ' + err.message);
  }
}

// SECURITY: Additional security middleware for webhook endpoints
export async function PATCH(event: RequestEvent) {
  const { request, getClientAddress } = event;
  const clientIP = getClientAddress();
  
  try {
    // SECURITY: Webhook signature validation (for Midtrans/Biteship webhooks)
    const signature = request.headers.get('x-signature') || request.headers.get('signature');
    const webhookSecret = process.env.WEBHOOK_SECRET;
    
    if (!signature || !webhookSecret) {
      throw error(401, 'Missing webhook signature');
    }
    
    const body = await request.text();
    
    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');
    
    if (!crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )) {
      throw error(401, 'Invalid webhook signature');
    }
    
    // SECURITY: Rate limiting for webhooks
    if (!checkRateLimit(clientIP, 'general')) {
      throw error(429, 'Too many webhook requests');
    }
    
    const webhookData = JSON.parse(body);
    
    console.log('Webhook received:', webhookData);
    
    return json({
      success: true,
      message: 'Webhook processed successfully'
    });
    
  } catch (err: any) {
    console.error('Error processing webhook:', err);
    if (err.status) throw err;
    throw error(500, 'Failed to process webhook');
  }
}

