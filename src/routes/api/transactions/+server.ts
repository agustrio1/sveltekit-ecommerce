import { db } from '$lib/server/db';
import { orders, orderItems, products, users } from '$lib/server/db/schema';
import { eq, and, inArray, desc, asc, sql, gte, lte, like, or } from 'drizzle-orm';
import { json, error, type RequestEvent } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import 'dotenv/config';

const JWT_SECRET = process.env.JWT_SECRET!;

// SECURITY: Rate limiting configuration
const RATE_LIMIT = {
  windowMs: 15 * 60 * 1000, 
  maxRequests: 200, 
  maxTransactionRequests: 100,
};

// SECURITY: Request size limits
const MAX_REQUEST_SIZE = 1024 * 512;
const MAX_ITEMS_PER_PAGE = 50;
const MAX_STRING_LENGTH = 500;

// SECURITY: In-memory rate limiting (production should use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number; transactions: number }>();

// SECURITY: Rate limiting middleware
function checkRateLimit(ip: string, type: 'general' | 'transactions' = 'general'): boolean {
  const now = Date.now();
  const key = ip;
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { 
      count: 0, 
      resetTime: now + RATE_LIMIT.windowMs,
      transactions: 0
    });
  }
  
  const record = rateLimitStore.get(key)!;
  
  if (now > record.resetTime) {
    record.count = 0;
    record.transactions = 0;
    record.resetTime = now + RATE_LIMIT.windowMs;
  }
  
  switch (type) {
    case 'transactions':
      if (record.transactions >= RATE_LIMIT.maxTransactionRequests) return false;
      record.transactions++;
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
  
  const sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
    
  return sanitized.length > maxLength ? sanitized.substring(0, maxLength) : sanitized;
}

// SECURITY: Enhanced user authentication
function authenticateUser(request: Request): { userId: number; role: string } | null {
  try {
    const sessionCookie = request.headers.get('cookie')?.split('; ').find(row => row.startsWith('session='));
    if (!sessionCookie) return null;

    const tokenFromCookie = sessionCookie.split('=')[1];
    if (!tokenFromCookie) return null;

    const decoded = jwt.verify(tokenFromCookie, JWT_SECRET, { algorithms: ['HS256'] });

    if (typeof decoded === 'object' && decoded !== null && 'sub' in decoded) {
      return {
        userId: decoded.sub as number,
        role: (decoded as any).role || 'user'
      };
    }
    
    return null;
  } catch (err) {
    return null;
  }
}

// SECURITY: CSRF token validation
function validateCSRFToken(request: Request): boolean {
  try {
    const csrfHeaderToken = request.headers.get('x-csrf-token');
    const sessionCookie = request.headers.get('cookie')?.split('; ').find(row => row.startsWith('session='));
    
    if (!csrfHeaderToken || !sessionCookie) return false;

    const tokenFromCookie = sessionCookie.split('=')[1];
    const decoded = jwt.verify(tokenFromCookie, JWT_SECRET, { algorithms: ['HS256'] });

    if (typeof decoded === 'object' && decoded !== null && 'csrf' in decoded) {
      return csrfHeaderToken === decoded.csrf;
    }
    
    return false;
  } catch (err) {
    return false;
  }
}

// SECURITY: Request validation
function validateOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  
  if (allowedOrigins.length === 0) return true;
  
  return allowedOrigins.some(allowed => 
    origin?.startsWith(allowed) || referer?.startsWith(allowed)
  );
}

function validateRequestSize(request: Request): boolean {
  const contentLength = request.headers.get('content-length');
  return !contentLength || parseInt(contentLength) <= MAX_REQUEST_SIZE;
}

// Helper function to get date range filters
function getDateRangeFilter(period: string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (period) {
    case 'today':
      return {
        start: today,
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
      };
    case 'week':
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      return { start: weekStart, end: weekEnd };
    case 'month':
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);
      return { start: monthStart, end: monthEnd };
    case 'year':
      const yearStart = new Date(today.getFullYear(), 0, 1);
      const yearEnd = new Date(today.getFullYear(), 11, 31);
      yearEnd.setHours(23, 59, 59, 999);
      return { start: yearStart, end: yearEnd };
    default:
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      return { start: thirtyDaysAgo, end: now };
  }
}

// SECURITY: Input validation for query parameters
function validateQueryParams(url: URL): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  const page = url.searchParams.get('page');
  if (page && (isNaN(Number(page)) || Number(page) < 1)) {
    errors.push('Invalid page number');
  }
  
  const limit = url.searchParams.get('limit');
  if (limit && (isNaN(Number(limit)) || Number(limit) < 1 || Number(limit) > MAX_ITEMS_PER_PAGE)) {
    errors.push(`Invalid limit (max ${MAX_ITEMS_PER_PAGE})`);
  }
  
  const period = url.searchParams.get('period');
  if (period && !['today', 'week', 'month', 'year', 'all'].includes(period)) {
    errors.push('Invalid period parameter');
  }
  
  const status = url.searchParams.get('status');
  if (status && !['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'failed'].includes(status)) {
    errors.push('Invalid status parameter');
  }
  
  const sortBy = url.searchParams.get('sortBy');
  if (sortBy && !['createdAt', 'total', 'status', 'orderNumber'].includes(sortBy)) {
    errors.push('Invalid sortBy parameter');
  }
  
  const sortOrder = url.searchParams.get('sortOrder');
  if (sortOrder && !['asc', 'desc'].includes(sortOrder)) {
    errors.push('Invalid sortOrder parameter');
  }
  
  return { isValid: errors.length === 0, errors };
}

// Helper function to format price
function formatPrice(value: any): string {
  const num = typeof value === 'number' ? value : parseFloat(value) || 0;
  return num.toFixed(2);
}

// Extract payment URL from metadata - ONLY for pending orders
function extractPaymentUrl(transaction: any): string | null {
  if (transaction.status !== 'pending') return null;
  
  try {
    const metadata = JSON.parse(transaction.metadata || '{}');
    return metadata.payment?.redirect_url || null;
  } catch {
    return null;
  }
}

// GET - Get user transactions with filtering, pagination, and search
export async function GET({ url, request, getClientAddress }: RequestEvent) {
  const clientIP = getClientAddress();
  
  try {
    // SECURITY: Validations
    if (!validateRequestSize(request)) throw error(413, 'Request too large');
    if (!validateOrigin(request)) throw error(403, 'Invalid request origin');
    if (!checkRateLimit(clientIP, 'transactions')) throw error(429, 'Too many transaction requests. Please try again later.');
    
    // SECURITY: Authentication
    const auth = authenticateUser(request);
    if (!auth) throw error(401, 'Authentication required');
    
    // SECURITY: Query parameter validation
    const validation = validateQueryParams(url);
    if (!validation.isValid) throw error(400, validation.errors.join(', '));
    
    // Parse query parameters
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(MAX_ITEMS_PER_PAGE, Math.max(1, parseInt(url.searchParams.get('limit') || '10')));
    const period = sanitizeString(url.searchParams.get('period') || 'all', 10);
    const status = sanitizeString(url.searchParams.get('status') || '', 20);
    const search = sanitizeString(url.searchParams.get('search') || '', 100);
    const sortBy = sanitizeString(url.searchParams.get('sortBy') || 'createdAt', 20);
    const sortOrder = sanitizeString(url.searchParams.get('sortOrder') || 'desc', 4);
    const includeItems = url.searchParams.get('includeItems') === 'true';
    
    const offset = (page - 1) * limit;
    
    // Build where conditions - USER can only see their own transactions
    const whereConditions = [eq(orders.userId, auth.userId)];
    
    // Add filters
    if (period !== 'all') {
      const dateRange = getDateRangeFilter(period);
      whereConditions.push(
        gte(orders.createdAt, dateRange.start),
        lte(orders.createdAt, dateRange.end)
      );
    }
    
    if (status) whereConditions.push(eq(orders.status, status));
    
    if (search) {
      const searchTerm = `%${search.toLowerCase()}%`;
      whereConditions.push(
        or(
          like(sql`LOWER(${orders.orderNumber})`, searchTerm),
          like(sql`LOWER(${orders.recipientName})`, searchTerm),
          like(sql`LOWER(${orders.email})`, searchTerm)
        )
      );
    }
    
    // Build sort order
    const sortColumn = {
      'createdAt': orders.createdAt,
      'total': orders.total,
      'status': orders.status,
      'orderNumber': orders.orderNumber
    }[sortBy] || orders.createdAt;
    
    const orderDirection = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);
    
    // Get total count for pagination
    const totalCountResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(orders)
      .where(and(...whereConditions));
    
    const totalCount = totalCountResult[0]?.count || 0;
    const totalPages = Math.ceil(totalCount / limit);
    
    // Get transactions
    const transactions = await db
      .select()
      .from(orders)
      .where(and(...whereConditions))
      .orderBy(orderDirection)
      .limit(limit)
      .offset(offset);
    
    // Process transactions
    let transactionsWithItems = transactions;
    
    if (includeItems && transactions.length > 0) {
      const orderIds = transactions.map(t => t.id);
      
      const items = await db
        .select({
          orderId: orderItems.orderId,
          productId: orderItems.productId,
          name: orderItems.name,
          description: orderItems.description,
          category: orderItems.category,
          price: orderItems.price,
          quantity: orderItems.quantity,
          weight: orderItems.weight,
          height: orderItems.height,
          length: orderItems.length,
          width: orderItems.width
        })
        .from(orderItems)
        .where(inArray(orderItems.orderId, orderIds));
      
      // Group items by order ID
      const itemsByOrderId = items.reduce((acc, item) => {
        if (!acc[item.orderId]) acc[item.orderId] = [];
        acc[item.orderId].push(item);
        return acc;
      }, {} as Record<string, typeof items>);
      
      // Attach items and payment URLs to transactions
      transactionsWithItems = transactions.map(transaction => {
        const transactionData = {
          ...transaction,
          items: itemsByOrderId[transaction.id] || []
        };

        // Add payment URL ONLY for pending transactions
        const paymentUrl = extractPaymentUrl(transaction);
        if (paymentUrl) {
          transactionData.paymentUrl = paymentUrl;
        }

        return transactionData;
      });
    } else {
      // Even without items, add payment URLs for pending orders
      transactionsWithItems = transactions.map(transaction => {
        const transactionData = { ...transaction };
        
        const paymentUrl = extractPaymentUrl(transaction);
        if (paymentUrl) {
          transactionData.paymentUrl = paymentUrl;
        }

        return transactionData;
      });
    }
    
    // Get summary statistics
    const summaryResult = await db
      .select({
        totalOrders: sql<number>`COUNT(*)`,
        totalAmount: sql<number>`COALESCE(SUM(CAST(${orders.total} AS DECIMAL(10,2))), 0)`,
        avgOrderValue: sql<number>`COALESCE(AVG(CAST(${orders.total} AS DECIMAL(10,2))), 0)`,
        pendingOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'pending' THEN 1 ELSE 0 END)`,
        paidOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'paid' THEN 1 ELSE 0 END)`,
        processingOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'processing' THEN 1 ELSE 0 END)`,
        shippedOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'shipped' THEN 1 ELSE 0 END)`,
        deliveredOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'delivered' THEN 1 ELSE 0 END)`,
        cancelledOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'cancelled' THEN 1 ELSE 0 END)`,
        failedOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'failed' THEN 1 ELSE 0 END)`
      })
      .from(orders)
      .where(and(...whereConditions));
    
    const summary = summaryResult[0] || {
      totalOrders: 0, totalAmount: 0, avgOrderValue: 0,
      pendingOrders: 0, paidOrders: 0, processingOrders: 0,
      shippedOrders: 0, deliveredOrders: 0, cancelledOrders: 0, failedOrders: 0
    };
    
    return json({
      success: true,
      data: {
        transactions: transactionsWithItems,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        },
        summary: {
          ...summary,
          totalAmount: formatPrice(summary.totalAmount),
          avgOrderValue: formatPrice(summary.avgOrderValue)
        },
        filters: { period, status, search, sortBy, sortOrder }
      }
    });
    
  } catch (err: any) {
    if (err.status) throw err;
    throw error(500, `Failed to get transactions: ${err.message}`);
  }
}

// POST - Update transaction status (for user actions like cancel)
export async function POST({ request, getClientAddress }: RequestEvent) {
  const clientIP = getClientAddress();
  
  try {
    // SECURITY: Validations
    if (!validateRequestSize(request)) throw error(413, 'Request too large');
    if (!validateOrigin(request)) throw error(403, 'Invalid request origin');
    if (!checkRateLimit(clientIP, 'general')) throw error(429, 'Too many requests. Please try again later.');
    
    // SECURITY: Authentication
    const auth = authenticateUser(request);
    if (!auth) throw error(401, 'Authentication required');
    
    // SECURITY: CSRF validation
    if (!validateCSRFToken(request)) throw error(403, 'Invalid CSRF token');
    
    const requestBody = await request.json();
    
    // SECURITY: Input validation
    const orderId = sanitizeString(requestBody.orderId, 50);
    const action = sanitizeString(requestBody.action, 20);
    
    if (!orderId || !action) throw error(400, 'Order ID and action are required');
    
    const allowedActions = ['cancel', 'reorder'];
    if (!allowedActions.includes(action)) throw error(400, 'Invalid action');
    
    // Get the order and verify ownership
    const existingOrder = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.userId, auth.userId)))
      .limit(1);
    
    if (existingOrder.length === 0) throw error(404, 'Order not found');
    
    const order = existingOrder[0];
    
    if (action === 'cancel') {
      const cancellableStatuses = ['pending', 'processing'];
      if (!cancellableStatuses.includes(order.status)) {
        const errorMessages = {
          'shipped': 'Pesanan yang sudah dikirim tidak dapat dibatalkan',
          'delivered': 'Pesanan yang sudah diterima tidak dapat dibatalkan',
          'cancelled': 'Pesanan sudah dibatalkan sebelumnya',
          'failed': 'Pesanan yang gagal tidak dapat dibatalkan',
          'paid': 'Pesanan yang sudah dibayar sedang diproses, hubungi customer service untuk pembatalan'
        };
        throw error(400, errorMessages[order.status] || `Pesanan dengan status '${order.status}' tidak dapat dibatalkan`);
      }
      
      // Update order status to cancelled
      await db
        .update(orders)
        .set({
          status: 'cancelled',
          updatedAt: new Date(),
          metadata: JSON.stringify({
            ...JSON.parse(order.metadata || '{}'),
            cancelled: {
              cancelled_at: new Date().toISOString(),
              cancelled_by: auth.userId,
              reason: 'User cancellation',
              previous_status: order.status
            }
          })
        })
        .where(eq(orders.id, orderId));
      
      // Restore product stock
      if (['processing', 'pending'].includes(order.status)) {
        const orderItemsData = await db
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, orderId));
        
        for (const item of orderItemsData) {
          await db
            .update(products)
            .set({
              stock: sql`${products.stock} + ${item.quantity}`,
              updatedAt: new Date()
            })
            .where(eq(products.id, item.productId));
        }
      }
      
      return json({
        success: true,
        message: 'Pesanan berhasil dibatalkan'
      });
    }
    
    if (action === 'reorder') {
      const orderItemsData = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));
      
      return json({
        success: true,
        message: 'Redirecting to checkout',
        data: {
          action: 'reorder',
          items: orderItemsData.map(item => ({
            productId: item.productId,
            quantity: item.quantity
          }))
        }
      });
    }
    
  } catch (err: any) {
    if (err.status) throw err;
    throw error(500, `Failed to update transaction: ${err.message}`);
  }
}