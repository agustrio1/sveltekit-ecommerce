// src/routes/api/orders/[orderId]/+server.ts

import { db } from '$lib/server/db';
import { orders, orderItems, products, productImages } from '$lib/server/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { json, error, type RequestEvent } from '@sveltejs/kit';

// GET - Get order details by ID
export async function GET({ params, locals }: RequestEvent) {
  try {
    const { orderId } = params;
    const user = locals?.user;

    if (!orderId) {
      throw error(400, 'Order ID is required');
    }

    console.log('🔍 Fetching order details for:', orderId);

    // 1. Get order from database
    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId));

    if (!order) {
      console.log('❌ Order not found:', orderId);
      throw error(404, 'Order not found');
    }

    // 2. Check authorization
    if (user && order.userId !== user.id && !user.isAdmin) {
      console.log('❌ Unauthorized access attempt for order:', orderId, 'by user:', user.id);
      throw error(403, 'Not authorized to view this order');
    }

    console.log('✅ Order found:', order.orderNumber);

    // 3. Get all order items for this order
    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    console.log(`✅ Found ${items.length} order items`);

    // 4. If there are items, get all images for all products in the order
    const productImagesMap = new Map();
    if (items.length > 0) {
      const productIds = items.map(item => item.productId);
      
      const images = await db
        .select()
        .from(productImages)
        .where(inArray(productImages.productId, productIds));
      
      images.forEach(img => {
        const key = img.productId;
        if (!productImagesMap.has(key)) {
          productImagesMap.set(key, []);
        }
        productImagesMap.get(key).push({
          url: img.imageUrl,
          alt: img.altText || img.name
        });
      });
    }

    // 5. Combine order items and images
    const combinedItems = items.map(item => ({
      ...item,
      // `parseFloat` dan konversi lainnya bisa dilakukan di sini.
      price: parseFloat(item.price),
      totalPrice: parseFloat(item.price) * item.quantity,
      images: productImagesMap.get(item.productId) || []
    }));

    // 6. Parse metadata
    let metadata = {};
    try {
      metadata = JSON.parse(order.metadata || '{}');
    } catch (err) {
      console.log('⚠️ Failed to parse order metadata:', err);
    }

    // 7. Prepare final response data
    const responseData = {
      ...order,
      subtotal: parseFloat(order.subtotal),
      shippingCost: parseFloat(order.shippingCost),
      total: parseFloat(order.total),
      courierInsurance: parseFloat(order.courierInsurance || '0'),
      
      items: combinedItems,
      metadata: metadata,
      
      // Computed fields
      itemCount: combinedItems.reduce((sum, item) => sum + item.quantity, 0),
      hasShippingData: !!(metadata.shipping && metadata.shipping.id),
      hasPaymentData: !!(metadata.payment),
      
      // Status helpers
      isPending: order.status === 'pending',
      isPaid: ['paid', 'processing', 'shipped', 'delivered'].includes(order.status),
      isCompleted: order.status === 'delivered',
      isCancelled: ['cancelled', 'failed'].includes(order.status),
      
      // Tracking info
      trackingInfo: metadata.shipping ? {
        biteshipOrderId: metadata.shipping.id,
        trackingUrl: metadata.shipping.tracking_url,
        waybillId: metadata.shipping.waybill_id
      } : null
    };

    console.log('✅ Returning order data for:', order.orderNumber);

    return json({
      success: true,
      data: responseData
    });

  } catch (err: any) {
    console.error('❌ Error fetching order details:', err);
    if (err.status) throw err;
    throw error(500, 'Failed to fetch order details: ' + err.message);
  }
}

