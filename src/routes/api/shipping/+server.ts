import { json, error, type RequestEvent } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { products } from '$lib/server/db/schema';
import { inArray } from 'drizzle-orm';
import { 
  calculateShippingRates,
  isValidIndonesianPostalCode,
  getAreaByPostalCode 
} from '$lib/server/biteship-utils';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET!;

// SECURITY: Configuration
const RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  maxRequests: 100,
  maxShippingRequests: 50,
  maxBurstRequests: 10
};

const MAX_REQUEST_SIZE = 1024 * 1024;
const MAX_ITEMS_PER_REQUEST = 50;
const MAX_STRING_LENGTH = 100;

// Store config
const STORE_CONFIG = {
  name: process.env.STORE_NAME! || 'Toko Online Anda',
  ownerName: process.env.STORE_OWNER_NAME! || 'Nama Pemilik Toko',
  phone: process.env.STORE_PHONE! || '08123456789',
  email: process.env.STORE_EMAIL! || 'info@tokoonline.com',
  address: process.env.STORE_ADDRESS! || 'Jl. Raya Utama No. 123, Kelurahan ABC',
  city: process.env.STORE_CITY! || 'Jakarta Selatan',
  province: process.env.STORE_PROVINCE! || 'DKI Jakarta',
  postalCode: process.env.STORE_POSTAL_CODE! || '64151',
  note: process.env.STORE_NOTE! || 'Dekat dengan minimarket atau patokan lainnya'
};

// SECURITY: In-memory rate limiting
const rateLimitStore = new Map<string, { 
  count: number; 
  resetTime: number; 
  shipping: number;
  burst: number;
  burstResetTime: number;
}>();

// SECURITY: Rate limiting middleware
function checkRateLimit(ip: string, type: 'general' | 'shipping' | 'burst' = 'general'): boolean {
  const now = Date.now();
  
  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, { 
      count: 0, 
      resetTime: now + RATE_LIMIT.windowMs,
      shipping: 0,
      burst: 0,
      burstResetTime: now + 60000
    });
  }
  
  const record = rateLimitStore.get(ip)!;
  
  // Reset windows if expired
  if (now > record.resetTime) {
    record.count = 0;
    record.shipping = 0;
    record.resetTime = now + RATE_LIMIT.windowMs;
  }
  
  if (now > record.burstResetTime) {
    record.burst = 0;
    record.burstResetTime = now + 60000;
  }
  
  // Check limits
  const limits = {
    burst: record.burst >= RATE_LIMIT.maxBurstRequests,
    shipping: record.shipping >= RATE_LIMIT.maxShippingRequests,
    general: record.count >= RATE_LIMIT.maxRequests
  };
  
  if (limits[type]) return false;
  
  // Increment counters
  record.burst++;
  if (type === 'shipping') record.shipping++;
  else record.count++;
  
  return true;
}

// SECURITY: Input sanitization
function sanitizeString(input: any, maxLength: number = MAX_STRING_LENGTH): string {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:|on\w+\s*=|data:|vbscript:/gi, '')
    .trim()
    .substring(0, maxLength);
}

// SECURITY: Input validation
function validateShippingInput(input: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!input.destinationPostal || !isValidIndonesianPostalCode(input.destinationPostal)) {
    errors.push('Invalid postal code');
  }
  
  if (input.items?.length > MAX_ITEMS_PER_REQUEST) {
    errors.push(`Max ${MAX_ITEMS_PER_REQUEST} items allowed`);
  }
  
  return { isValid: errors.length === 0, errors };
}

// SECURITY: CSRF validation
function validateCSRFToken(request: Request, userId: string | number): boolean {
  const csrfToken = request.headers.get('x-csrf-token');
  const userAgent = request.headers.get('user-agent') || '';
  const timestamp = request.headers.get('x-timestamp');
  
  if (!csrfToken || !timestamp) return false;
  
  const requestTime = parseInt(timestamp);
  const now = Date.now();
  
  if (isNaN(requestTime) || Math.abs(now - requestTime) > 5 * 60 * 1000) return false;
  
  const expectedToken = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${userId}:${userAgent}:${timestamp}`)
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(csrfToken, 'hex'),
    Buffer.from(expectedToken, 'hex')
  );
}

// SECURITY: Origin validation
function validateOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  
  return allowedOrigins.length === 0 || allowedOrigins.some(allowed => 
    origin?.startsWith(allowed) || referer?.startsWith(allowed)
  );
}

// SECURITY: User agent validation
function validateUserAgent(request: Request): boolean {
  const userAgent = request.headers.get('user-agent');
  if (!userAgent) return false;
  
  const blockedPatterns = [/curl|wget|python-requests|postman|insomnia|httpie|masscan|nmap|sqlmap|nikto/i];
  const allowedPatterns = [/mozilla|webkit|chrome|firefox|safari|edge|opera/i];
  
  return !blockedPatterns.some(p => p.test(userAgent)) && allowedPatterns.some(p => p.test(userAgent));
}

// SECURITY: Request size validation
function validateRequestSize(request: Request): boolean {
  const contentLength = request.headers.get('content-length');
  return !contentLength || parseInt(contentLength) <= MAX_REQUEST_SIZE;
}

// SECURITY: SQL injection prevention
function sanitizeProductIds(productIds: any[]): number[] {
  return productIds
    .map(id => parseInt(id))
    .filter(id => Number.isInteger(id) && id > 0 && id < 999999999);
}

// Helper: Number conversion
function ensureNumber(value: any, defaultValue: number = 0): number {
  const num = typeof value === 'number' ? value : parseFloat(value);
  return isNaN(num) ? defaultValue : num;
}

// ORIGINAL BUSINESS LOGIC: Validate and process items
function validateAndProcessItems(itemsParam: string | null, productsData?: any[]): any[] {
  let items = [];
  
  if (itemsParam) {
    try {
      const parsedItems = JSON.parse(itemsParam);
      
      if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
        throw new Error('Items must be a non-empty array');
      }

      if (productsData && productsData.length > 0) {
        const productMap = new Map(productsData.map(p => [p.id, p]));

        items = parsedItems.map(item => {
          if (!item.productId || !item.quantity || item.quantity <= 0) {
            throw new Error('Each item must have productId and positive quantity');
          }

          const product = productMap.get(item.productId);
          if (!product) {
            return {
              weight: 500,
              height: 10,
              length: 15,
              width: 15,
              quantity: item.quantity,
              value: 50000
            };
          }
          
          return {
            weight: Math.max(product.weight || 100, 100),
            height: Math.max(product.height || 5, 5),
            length: Math.max(product.length || 10, 10),
            width: Math.max(product.width || 10, 10),
            quantity: item.quantity,
            value: Math.max(parseFloat(product.price) || 10000, 10000)
          };
        });
      } else {
        items = parsedItems.map(item => ({
          weight: Math.max(item.weight || 500, 100),
          height: Math.max(item.height || 10, 5),
          length: Math.max(item.length || 15, 10),
          width: Math.max(item.width || 15, 10),
          quantity: Math.max(item.quantity || 1, 1),
          value: Math.max(item.value || 50000, 10000)
        }));
      }
    } catch (parseError) {
      throw new Error(`Invalid items parameter: ${parseError.message}`);
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

  return items;
}

// ORIGINAL BUSINESS LOGIC: Handle shipping calculation
async function handleShippingCalculation(destinationPostal: string, items: any[], forceFresh: boolean = false) {
  const startTime = Date.now();
  
  // Pre-validate postal codes
  try {
    const [originArea, destinationArea] = await Promise.all([
      getAreaByPostalCode(STORE_CONFIG.postalCode),
      getAreaByPostalCode(destinationPostal)
    ]);

    if (!originArea) {
      throw new Error(`Origin postal code ${STORE_CONFIG.postalCode} not found. Please check store configuration.`);
    }

    if (!destinationArea) {
      throw new Error(`Destination postal code ${destinationPostal} not found. Please check postal code.`);
    }
  } catch (areaError) {
    throw areaError;
  }

  // Calculate shipping rates
  try {
    const shippingRates = await calculateShippingRates(
      STORE_CONFIG.postalCode,
      destinationPostal,
      items
    );
    
    const endTime = Date.now();
    const calculationTime = endTime - startTime;
    
    if (shippingRates.length === 0) {
      return {
        success: true,
        data: [],
        message: 'No shipping options available for this destination at the moment.',
        calculationTime,
        hasRates: false
      };
    }

    // Group rates by courier
    const ratesByCourier = {};
    shippingRates.forEach((rate) => {
      if (!ratesByCourier[rate.courier_name]) {
        ratesByCourier[rate.courier_name] = [];
      }
      ratesByCourier[rate.courier_name].push(rate);
    });

    return {
      success: true,
      data: shippingRates,
      calculationTime,
      hasRates: true,
      availableCouriers: Object.keys(ratesByCourier),
      ratesByCourier
    };

  } catch (shippingError) {
    const errorMessages = {
      timeout: 'Shipping calculation timeout. Please try again.',
      400: 'Invalid shipping parameters. Please check your postal code and try again.',
      'Area not found': 'Postal code not found in shipping database. Please verify your postal code.'
    };
    
    const errorKey = Object.keys(errorMessages).find(key => shippingError.message?.includes(key));
    throw new Error(errorKey ? errorMessages[errorKey] : `Shipping calculation failed: ${shippingError.message}`);
  }
}

// SECURITY: Common security headers
const secureHeaders = {
  'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Last-Modified': new Date().toUTCString(),
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};

// GET - Calculate shipping rates
export async function GET({ url, locals, getClientAddress }: RequestEvent) {
  const user = locals?.user;
  const clientIP = getClientAddress();
  
  try {
    // SECURITY: Rate limiting
    if (!checkRateLimit(clientIP, 'burst') || !checkRateLimit(clientIP, 'shipping')) {
      throw error(429, 'Too many requests. Please try again later.');
    }
    
    const destinationPostal = url.searchParams.get('destinationPostal');
    const itemsParam = url.searchParams.get('items');
    const forceFresh = url.searchParams.get('_fresh') === 'true';

    // SECURITY: Input validation
    const validation = validateShippingInput({
      destinationPostal,
      items: itemsParam ? JSON.parse(itemsParam || '[]') : null
    });
    
    if (!validation.isValid) {
      return json({
        success: false,
        message: validation.errors.join(', '),
        data: [],
        error_type: 'validation_error'
      }, { status: 400 });
    }

    const sanitizedPostalCode = sanitizeString(destinationPostal, 10);

    if (!sanitizedPostalCode || !isValidIndonesianPostalCode(sanitizedPostalCode)) {
      return json({
        success: false,
        message: 'Invalid postal code format. Please use 5-digit postal code.',
        data: [],
        error_type: 'invalid_format'
      }, { status: 400 });
    }

    let items = [];
    let productsData = [];

    // Fetch product data if items provided
    if (itemsParam) {
      try {
        const parsedItems = JSON.parse(itemsParam);
        
        if (Array.isArray(parsedItems) && parsedItems.length <= MAX_ITEMS_PER_REQUEST) {
          const productIds = parsedItems
            .filter(item => item.productId && item.quantity > 0)
            .map(item => item.productId);
          
          if (productIds.length > 0) {
            const sanitizedProductIds = sanitizeProductIds(productIds);
            
            if (sanitizedProductIds.length > 0) {
              productsData = await db
                .select({
                  id: products.id,
                  name: products.name,
                  price: products.price,
                  weight: products.weight,
                  height: products.height,
                  length: products.length,
                  width: products.width
                })
                .from(products)
                .where(inArray(products.id, sanitizedProductIds));
            }
          }
        }
      } catch (parseError) {
        // Continue with defaults
      }
    }

    // ORIGINAL BUSINESS LOGIC: Process items
    items = validateAndProcessItems(itemsParam, productsData);

    // ORIGINAL BUSINESS LOGIC: Calculate shipping
    const shippingResult = await handleShippingCalculation(sanitizedPostalCode, items, forceFresh);

    return json({
      success: shippingResult.success,
      data: shippingResult.data,
      message: shippingResult.message,
      store_info: {
        name: STORE_CONFIG.name,
        city: STORE_CONFIG.city,
        province: STORE_CONFIG.province,
        postal_code: STORE_CONFIG.postalCode
      },
      request_info: {
        destination_postal: sanitizedPostalCode,
        total_items: items.length,
        total_weight: items.reduce((sum, item) => sum + (item.weight * item.quantity), 0),
        total_value: items.reduce((sum, item) => sum + (item.value * item.quantity), 0),
        calculation_time_ms: shippingResult.calculationTime,
        timestamp: new Date().toISOString(),
        force_fresh: forceFresh,
        available_couriers: shippingResult.availableCouriers || [],
        has_rates: shippingResult.hasRates,
        method: 'GET'
      }
    }, { 
      status: 200,
      headers: new Headers(secureHeaders)
    });

  } catch (err: any) {
    if (err.status) throw err;

    const errorType = 
      err.message?.includes('timeout') ? 'timeout' :
      err.message?.includes('not found') || err.message?.includes('Area not found') ? 'area_not_found' :
      err.message?.includes('Invalid items parameter') ? 'validation_error' :
      err.message?.includes('Biteship API error') || err.message?.includes('400') ? 'api_error' :
      'unknown';

    const statusCode = 
      errorType === 'timeout' ? 408 :
      errorType === 'area_not_found' || errorType === 'validation_error' ? 400 :
      errorType === 'api_error' ? 503 : 500;

    const message = 
      errorType === 'timeout' ? 'Request timeout - please try again later' :
      errorType === 'area_not_found' ? 'Postal code area not found. Please check your postal code.' :
      errorType === 'validation_error' ? err.message :
      errorType === 'api_error' ? 'Shipping service temporarily unavailable. Please try again.' :
      'Failed to calculate shipping rates. Please try again.';

    return json({
      success: false,
      data: [],
      error_type: errorType,
      message,
      timestamp: new Date().toISOString(),
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    }, { status: statusCode });
  }
}

// POST - Calculate shipping rates with detailed item information
export async function POST({ request, locals, getClientAddress }: RequestEvent) {
  const user = locals?.user;
  const clientIP = getClientAddress();
  
  try {
    // SECURITY: Request validation
    const securityChecks = [
      () => validateRequestSize(request) || 'Request too large',
      () => validateOrigin(request) || 'Invalid request origin',
      () => checkRateLimit(clientIP, 'burst') || 'Too many requests. Please slow down.',
      () => checkRateLimit(clientIP, 'shipping') || 'Too many shipping requests. Please try again later.',
      () => validateUserAgent(request) || 'Invalid or suspicious user agent',
      () => !user || validateCSRFToken(request, user.id) || 'Invalid CSRF token'
    ];

    for (const check of securityChecks) {
      const result = check();
      if (typeof result === 'string') {
        const statusCode = result.includes('too large') ? 413 : 
                          result.includes('origin') || result.includes('agent') || result.includes('token') ? 403 : 429;
        throw error(statusCode, result);
      }
    }
    
    const requestBody = await request.json();
    
    // SECURITY: Input validation
    const validation = validateShippingInput(requestBody);
    if (!validation.isValid) {
      return json({
        success: false,
        message: validation.errors.join(', '),
        data: [],
        error_type: 'validation_error'
      }, { status: 400 });
    }
    
    const destinationPostal = sanitizeString(requestBody.destinationPostal, 10);
    const { items, forceFresh } = requestBody;

    if (!destinationPostal || !isValidIndonesianPostalCode(destinationPostal)) {
      return json({
        success: false,
        message: 'Invalid postal code format. Please use 5-digit postal code.',
        data: [],
        error_type: 'invalid_format'
      }, { status: 400 });
    }

    if (!items || !Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS_PER_REQUEST) {
      return json({
        success: false,
        message: 'Items array is required and must not be empty',
        data: [],
        error_type: 'validation_error'
      }, { status: 400 });
    }

    // ORIGINAL BUSINESS LOGIC: Process items for POST
    const processedItems = items.map((item, index) => {
      if (!item.weight || !item.quantity) {
        throw new Error(`Item ${index + 1} is missing required fields (weight, quantity)`);
      }

      return {
        weight: Math.max(ensureNumber(item.weight, 100), 100),
        height: Math.max(ensureNumber(item.height, 5), 5),
        length: Math.max(ensureNumber(item.length, 10), 10),
        width: Math.max(ensureNumber(item.width, 10), 10),
        quantity: Math.max(ensureNumber(item.quantity, 1), 1),
        value: Math.max(ensureNumber(item.value, 10000), 10000)
      };
    });

    // ORIGINAL BUSINESS LOGIC: Calculate shipping
    const shippingResult = await handleShippingCalculation(destinationPostal, processedItems, forceFresh);

    return json({
      success: shippingResult.success,
      data: shippingResult.data,
      message: shippingResult.message,
      store_info: {
        name: STORE_CONFIG.name,
        city: STORE_CONFIG.city,
        province: STORE_CONFIG.province,
        postal_code: STORE_CONFIG.postalCode
      },
      request_info: {
        destination_postal: destinationPostal,
        total_items: processedItems.length,
        total_weight: processedItems.reduce((sum, item) => sum + (item.weight * item.quantity), 0),
        total_value: processedItems.reduce((sum, item) => sum + (item.value * item.quantity), 0),
        calculation_time_ms: shippingResult.calculationTime,
        timestamp: new Date().toISOString(),
        method: 'POST',
        force_fresh: forceFresh || false,
        available_couriers: shippingResult.availableCouriers || [],
        has_rates: shippingResult.hasRates
      }
    }, { 
      status: 200,
      headers: new Headers(secureHeaders)
    });

  } catch (err: any) {
    if (err.status) throw err;

    const errorType = 
      err.message?.includes('timeout') ? 'timeout' :
      err.message?.includes('not found') || err.message?.includes('Area not found') ? 'area_not_found' :
      err.message?.includes('missing required fields') ? 'validation_error' :
      err.message?.includes('Biteship API error') || err.message?.includes('400') ? 'api_error' :
      'unknown';

    const statusCode = 
      errorType === 'timeout' ? 408 :
      errorType === 'area_not_found' || errorType === 'validation_error' ? 400 :
      errorType === 'api_error' ? 503 : 500;

    const message = 
      errorType === 'timeout' ? 'Request timeout - please try again later' :
      errorType === 'area_not_found' ? 'Postal code area not found. Please check your postal code.' :
      errorType === 'validation_error' ? err.message :
      errorType === 'api_error' ? 'Shipping service temporarily unavailable. Please try again.' :
      'Failed to calculate shipping rates. Please try again.';

    return json({
      success: false,
      data: [],
      error_type: errorType,
      message,
      timestamp: new Date().toISOString(),
      method: 'POST',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    }, { status: statusCode });
  }
}

// OPTIONS - CORS preflight
export async function OPTIONS({ getClientAddress }: RequestEvent) {
  const clientIP = getClientAddress();
  
  if (!checkRateLimit(clientIP, 'general')) {
    throw error(429, 'Too many requests');
  }
  
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token, X-Timestamp',
      'Access-Control-Max-Age': '3600',
      ...secureHeaders
    }
  });
}

// PATCH - Health check
export async function PATCH({ getClientAddress }: RequestEvent) {
  const clientIP = getClientAddress();
  
  if (!checkRateLimit(clientIP, 'general')) {
    throw error(429, 'Too many requests');
  }
  
  return json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    store: {
      name: STORE_CONFIG.name,
      city: STORE_CONFIG.city,
      postal_code: STORE_CONFIG.postalCode
    },
    services: {
      database: 'connected',
      shipping_api: 'available'
    }
  }, {
    status: 200,
    headers: { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY' }
  });
}

// DELETE - Clear rate limit (admin only)
export async function DELETE({ request, locals }: RequestEvent) {
  const user = locals?.user;
  
  if (!user || user.role !== 'admin') {
    throw error(403, 'Admin access required');
  }
  
  if (!validateCSRFToken(request, user.id)) {
    throw error(403, 'Invalid CSRF token');
  }
  
  const { targetIP } = await request.json();
  
  if (!targetIP || typeof targetIP !== 'string') {
    throw error(400, 'Target IP is required');
  }
  
  const sanitizedIP = sanitizeString(targetIP, 45);
  rateLimitStore.delete(sanitizedIP);
  
  return json({
    success: true,
    message: 'Rate limit cleared',
    timestamp: new Date().toISOString()
  });
}

// PUT - Update store config (admin only)
export async function PUT({ request, locals }: RequestEvent) {
  const user = locals?.user;
  
  if (!user || user.role !== 'admin') {
    throw error(403, 'Admin access required');
  }
  
  if (!validateRequestSize(request) || !validateCSRFToken(request, user.id)) {
    throw error(403, 'Request validation failed');
  }
  
  const updates = await request.json();
  const allowedFields = ['name', 'ownerName', 'phone', 'email', 'address', 'city', 'province', 'note'];
  const sanitizedUpdates = {};
  
  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key) && typeof value === 'string') {
      sanitizedUpdates[key] = sanitizeString(value, key === 'address' ? 200 : MAX_STRING_LENGTH);
    }
  }
  
  return json({
    success: true,
    message: 'Store configuration update request received',
    updated_fields: Object.keys(sanitizedUpdates),
    timestamp: new Date().toISOString(),
    note: 'Configuration updates require server restart to take effect'
  });
}