<!-- src/routes/orders/[orderId]/payment-success/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { CheckCircle, Package, Truck, CreditCard, Home, Receipt } from 'lucide-svelte';

  export let data;

  let order = null;
  let loading = true;
  let error = '';

  onMount(async () => {
    try {
      // Get order ID from URL
      const orderId = $page.params.orderId;
      
      // Fetch order details
      const response = await fetch(`/api/orders/${orderId}`);
      
      if (!response.ok) {
        throw new Error('Gagal memuat detail pesanan');
      }
      
      const result = await response.json();
      
      if (result.success) {
        order = result.data;
        
        // Update order status to paid if not already
        if (order.status === 'pending') {
          await updateOrderStatus(orderId, 'paid');
        }
      } else {
        throw new Error(result.message || 'Pesanan tidak ditemukan');
      }
    } catch (err) {
      console.error('Error loading order:', err);
      error = err.message || 'Terjadi kesalahan saat memuat pesanan';
    } finally {
      loading = false;
    }
  });

  async function updateOrderStatus(orderId: string, status: string) {
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status,
          paymentData: {
            status: 'success',
            timestamp: new Date().toISOString(),
            source: 'midtrans_callback'
          }
        })
      });
      
      if (response.ok) {
        console.log('Order status updated to paid');
        // Refresh order data
        const result = await response.json();
        if (result.success && order) {
          order.status = status;
        }
      }
    } catch (err) {
      console.error('Error updating order status:', err);
    }
  }

  function formatPrice(price) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(price);
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function goToHome() {
    goto('/');
  }

  function viewOrderDetails() {
    goto(`/orders/${order.id}`);
  }
</script>

<svelte:head>
  <title>Pembayaran Berhasil - Toko Online</title>
  <meta name="description" content="Pembayaran Anda telah berhasil diproses" />
</svelte:head>

<div class="payment-success-container">
  {#if loading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Memproses pembayaran...</p>
    </div>
  {:else if error}
    <div class="error-state">
      <div class="error-icon">❌</div>
      <h1>Terjadi Kesalahan</h1>
      <p>{error}</p>
      <button class="primary-button" on:click={goToHome}>
        Kembali ke Beranda
      </button>
    </div>
  {:else if order}
    <div class="success-content">
      <!-- Success Header -->
      <div class="success-header">
        <div class="success-icon">
          <CheckCircle size={64} color="#10b981" />
        </div>
        <h1 class="success-title">Pembayaran Berhasil!</h1>
        <p class="success-subtitle">
          Terima kasih! Pesanan Anda telah berhasil dibayar dan sedang diproses.
        </p>
      </div>

      <!-- Order Summary Card -->
      <div class="order-summary-card">
        <div class="card-header">
          <Receipt size={24} />
          <h2>Detail Pesanan</h2>
        </div>
        
        <div class="order-info">
          <div class="info-row">
            <span class="label">Nomor Pesanan:</span>
            <span class="value order-number">{order.orderNumber}</span>
          </div>
          
          <div class="info-row">
            <span class="label">Tanggal Pesanan:</span>
            <span class="value">{formatDate(order.createdAt)}</span>
          </div>
          
          <div class="info-row">
            <span class="label">Status:</span>
            <span class="value status paid">Dibayar</span>
          </div>
          
          <div class="info-row">
            <span class="label">Total Pembayaran:</span>
            <span class="value total-amount">{formatPrice(parseFloat(order.total))}</span>
          </div>
        </div>
      </div>

      <!-- Shipping Information -->
      <div class="shipping-info-card">
        <div class="card-header">
          <Truck size={24} />
          <h2>Informasi Pengiriman</h2>
        </div>
        
        <div class="shipping-details">
          <div class="shipping-method">
            <Package size={20} />
            <div>
              <div class="courier-name">{order.courierName}</div>
              <div class="service-name">{order.courierService}</div>
            </div>
          </div>
          
          <div class="shipping-address">
            <h4>Alamat Pengiriman:</h4>
            <p>
              {order.recipientName}<br>
              {order.address}<br>
              {order.city}, {order.province} {order.postalCode}<br>
              {order.phone}
            </p>
          </div>
        </div>
      </div>

      <!-- Next Steps -->
      <div class="next-steps-card">
        <h3>Langkah Selanjutnya</h3>
        <div class="steps-list">
          <div class="step">
            <div class="step-number">1</div>
            <div class="step-content">
              <h4>Pesanan Diproses</h4>
              <p>Tim kami akan segera memproses pesanan Anda</p>
            </div>
          </div>
          
          <div class="step">
            <div class="step-number">2</div>
            <div class="step-content">
              <h4>Pengiriman</h4>
              <p>Pesanan akan dikirim menggunakan {order.courierName}</p>
            </div>
          </div>
          
          <div class="step">
            <div class="step-number">3</div>
            <div class="step-content">
              <h4>Notifikasi</h4>
              <p>Anda akan menerima nomor resi melalui email</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <button class="secondary-button" on:click={goToHome}>
          <Home size={20} />
          Kembali ke Beranda
        </button>
        
        <button class="primary-button" on:click={viewOrderDetails}>
          <Receipt size={20} />
          Lihat Detail Pesanan
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .payment-success-container {
    min-height: 100vh;
    background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
    padding: 2rem 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .loading-state, 
  .error-state {
    text-align: center;
    background: white;
    padding: 3rem;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    max-width: 400px;
    width: 100%;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f4f6;
    border-top: 4px solid #10b981;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .error-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .success-content {
    max-width: 600px;
    width: 100%;
  }

  .success-header {
    text-align: center;
    background: white;
    padding: 3rem 2rem;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    margin-bottom: 2rem;
  }

  .success-icon {
    margin-bottom: 1.5rem;
  }

  .success-title {
    font-size: 2rem;
    font-weight: 700;
    color: #065f46;
    margin-bottom: 0.5rem;
  }

  .success-subtitle {
    font-size: 1.125rem;
    color: #6b7280;
    margin: 0;
  }

  .order-summary-card, 
  .shipping-info-card, 
  .next-steps-card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    margin-bottom: 1.5rem;
    overflow: hidden;
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1.5rem;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }

  .card-header h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #374151;
    margin: 0;
  }

  .order-info {
    padding: 1.5rem;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 0;
    border-bottom: 1px solid #f3f4f6;
  }

  .info-row:last-child {
    border-bottom: none;
  }

  .label {
    color: #6b7280;
    font-weight: 500;
  }

  .value {
    font-weight: 600;
    color: #374151;
  }

  .order-number {
    font-family: 'Courier New', monospace;
    background: #f3f4f6;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.875rem;
  }

  .status {
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.875rem;
    text-transform: uppercase;
  }

  .status.paid {
    background: #d1fae5;
    color: #065f46;
  }

  .total-amount {
    font-size: 1.25rem;
    color: #10b981;
  }

  .shipping-details {
    padding: 1.5rem;
  }

  .shipping-method {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: #f9fafb;
    border-radius: 8px;
  }

  .courier-name {
    font-weight: 600;
    color: #374151;
  }

  .service-name {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .shipping-address h4 {
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .shipping-address p {
    color: #6b7280;
    line-height: 1.6;
    margin: 0;
  }

  .next-steps-card {
    padding: 1.5rem;
  }

  .next-steps-card h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 1.5rem;
  }

  .steps-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .step {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .step-number {
    width: 32px;
    height: 32px;
    background: #10b981;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.875rem;
    flex-shrink: 0;
  }

  .step-content h4 {
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.25rem;
  }

  .step-content p {
    color: #6b7280;
    margin: 0;
    font-size: 0.875rem;
  }

  .action-buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-top: 2rem;
  }

  .primary-button, 
  .secondary-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 1rem;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: none;
  }

  .primary-button {
    background: #10b981;
    color: white;
  }

  .primary-button:hover {
    background: #059669;
    transform: translateY(-1px);
  }

  .secondary-button {
    background: white;
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .secondary-button:hover {
    background: #f9fafb;
    transform: translateY(-1px);
  }

  @media (max-width: 768px) {
    .payment-success-container {
      padding: 1rem;
    }

    .success-header {
      padding: 2rem 1.5rem;
    }

    .success-title {
      font-size: 1.5rem;
    }

    .success-subtitle {
      font-size: 1rem;
    }

    .action-buttons {
      flex-direction: column;
    }

    .primary-button, 
    .secondary-button {
      width: 100%;
      justify-content: center;
    }

    .info-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
    }
  }
</style>