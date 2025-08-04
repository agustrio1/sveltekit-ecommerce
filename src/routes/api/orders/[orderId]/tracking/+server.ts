// routes/api/orders/[orderId]/tracking/+server.ts
import { db } from '$lib/server/db';
import { orders } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { json, error, type RequestEvent } from '@sveltejs/kit';
import { trackOrder, getOrderLabel } from '$lib/server/biteship-utils';

// GET - Handle both tracking and label requests
export async function GET({ params, url }: RequestEvent) {
  try {
    const { orderId } = params;
    const action = url.searchParams.get('action');

    if (!orderId) {
      throw error(400, 'Order ID is required');
    }

    // Get order from database
    const orderData = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderData.length === 0) {
      throw error(404, 'Order not found');
    }

    const order = orderData[0];
    const metadata = JSON.parse(order.metadata || '{}');
    const shippingData = metadata.shipping;

    // Handle shipping label request
    if (action === 'label') {
      if (!shippingData || !shippingData.id) {
        throw error(400, 'Shipping order not found');
      }

      // Get label URL
      const labelUrl = await getOrderLabel(shippingData.id);

      if (!labelUrl) {
        throw error(404, 'Shipping label not available');
      }

      return json({
        success: true,
        data: {
          order_number: order.orderNumber,
          label_url: labelUrl
        }
      });
    }

    // Default: Handle tracking request
    if (!shippingData || !shippingData.id) {
      return json({
        success: true,
        data: {
          order_number: order.orderNumber,
          status: order.status,
          message: 'Shipping order not created yet',
          tracking_data: null
        }
      });
    }

    // Track order via Biteship
    const trackingData = await trackOrder(shippingData.id);

    if (!trackingData) {
      return json({
        success: true,
        data: {
          order_number: order.orderNumber,
          status: order.status,
          message: 'Unable to fetch tracking information',
          tracking_data: null
        }
      });
    }

    // Update order status based on tracking data if needed
    const biteshipStatus = trackingData.status;
    let newOrderStatus = order.status;

    switch (biteshipStatus) {
      case 'confirmed':
        newOrderStatus = 'processing';
        break;
      case 'allocated':
      case 'picking_up':
        newOrderStatus = 'pickup_scheduled';
        break;
      case 'picked':
        newOrderStatus = 'shipped';
        break;
      case 'dropping_off':
        newOrderStatus = 'out_for_delivery';
        break;
      case 'delivered':
        newOrderStatus = 'delivered';
        break;
      case 'cancelled':
        newOrderStatus = 'cancelled';
        break;
      case 'rejected':
        newOrderStatus = 'failed';
        break;
    }

    // Update order status if changed
    if (newOrderStatus !== order.status) {
      await db
        .update(orders)
        .set({ 
          status: newOrderStatus,
          updatedAt: new Date()
        })
        .where(eq(orders.id, orderId));
    }

    return json({
      success: true,
      data: {
        order_number: order.orderNumber,
        status: newOrderStatus,
        biteship_order_id: shippingData.id,
        tracking_id: trackingData.courier?.tracking_id || trackingData.waybill_id,
        courier: {
          name: trackingData.courier?.company || order.courierName,
          service: trackingData.courier?.type || order.courierService,
          tracking_url: trackingData.courier?.link
        },
        tracking_data: {
          status: trackingData.status,
          status_description: getStatusDescription(trackingData.status),
          created_at: trackingData.created_at,
          updated_at: trackingData.updated_at,
          pickup_time: trackingData.pickup_time,
          delivered_time: trackingData.delivered_time,
          history: trackingData.history || []
        }
      }
    });

  } catch (err: any) {
    console.error('Error in tracking API:', err);
    if (err.status) throw err;
    throw error(500, 'Failed to process request: ' + err.message);
  }
}

function getStatusDescription(status: string): string {
  const statusDescriptions: Record<string, string> = {
    'confirmed': 'Pesanan dikonfirmasi, menunggu penjemputan',
    'allocated': 'Kurir dialokasikan untuk penjemputan',
    'picking_up': 'Kurir sedang menuju lokasi penjemputan',
    'picked': 'Paket telah dijemput kurir',
    'dropping_off': 'Paket sedang dalam perjalanan ke tujuan',
    'delivered': 'Paket telah diterima',
    'cancelled': 'Pengiriman dibatalkan',
    'rejected': 'Pengiriman ditolak',
    'returned': 'Paket dikembalikan ke pengirim'
  };

  return statusDescriptions[status] || status;
}