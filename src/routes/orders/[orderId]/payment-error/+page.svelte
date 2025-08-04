<!-- src/routes/orders/[orderId]/payment-error/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { XCircle, RefreshCw, Home, CreditCard, AlertTriangle } from 'lucide-svelte';

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
        
        // Update order status to failed if needed
        if (order.status === 'pending') {
          await updateOrderStatus(orderId, 'failed');
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
      const response = await fetch(`/api/orders`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderId,
          status,
          paymentData: {
            status: 'failed',
            timestamp: new Date().toISOString(),
            source: 'midtrans_callback'
          }
        })
      });
      
      if (response.ok) {
        console.log('Order status updated to failed');
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

  function retryPayment() {
    goto(`/checkout/${order.id}`);
  }

  function viewOrderDetails() {
    goto(`/orders/${order.id}`);
  }
</script>

<svelte:head>
  <title>Pembayaran Gagal - Toko Online</title>
  <meta name="description" content="Pembayaran Anda gagal diproses" />
</svelte:head>

<div class="payment-error-container">
  {#if loading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Memuat informasi pesanan...</p>
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
    <div class="error-content">
      <!-- Error Header -->
      <div class="error-header">
        <div class="error-icon">
          <XCircle size={64} color="#dc2626" />
        </div>
        <h1 class="error-title">Pembayaran Gagal</h1>
        <p class="error-subtitle">
          Maaf, pembayaran Anda tidak dapat diproses. Silakan coba lagi atau hubungi customer service.
        </p>
      </div>

      <!-- Order Summary Card -->
      <div class="order-summary-card">
        <div class="card-header">
          <AlertTriangle size={24} />
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
            <span class="value status failed">Pembayaran Gagal</span>
          </div>
          
          <div class="info-row">
            <span class="label">Total Pembayaran:</span>
            <span class="value total-amount">{formatPrice(parseFloat(order.total))}</span>
          </div>
        </div>
      </div>

      <!-- Common Issues -->
      <div class="common-issues-card">
        <h3>Kemungkinan Penyebab</h3>
        <div class="issues-list">
          <div class="issue-item">
            <div class="issue-icon">💳</div>
            <div class="issue-content">
              <h4>Kartu Ditolak</h4>
              <p>Saldo tidak mencukupi atau kartu diblokir oleh bank</p>
            </div>
          </div>
          
          <div class="issue-item">
            <div class="issue-icon">🌐</div>
            <div class="issue-content">
              <h4>Koneksi Terputus</h4>
              <p>Koneksi internet tidak stabil saat proses pembayaran</p>
            </div>
          </div>
          
          <div class="issue-item">
            <div class="issue-icon">⏱️</div>
            <div class="issue-content">
              <h4>Waktu Habis</h4>
              <p>Proses pembayaran melebihi batas waktu yang ditentukan</p>
            </div>
          </div>
          
          <div class="issue-item">
            <div class="issue-icon">🔒</div>
            <div class="issue-content">
              <h4>Keamanan</h4>
              <p>Transaksi ditolak karena alasan keamanan</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Solutions -->
      <div class="solutions-card">
        <h3>Apa yang Bisa Anda Lakukan?</h3>
        <div class="solutions-list">
          <div class="solution">
            <div class="solution-number">1</div>
            <div class="solution-content">
              <h4>Coba Lagi</h4>
              <p>Klik tombol "Coba Bayar Lagi" untuk mengulangi proses pembayaran</p>
            </div>
          </div>
          
          <div class="solution">
            <div class="solution-number">2</div>
            <div class="solution-content">
              <h4>Ganti Metode Pembayaran</h4>
              <p>Gunakan kartu atau metode pembayaran yang berbeda</p>
            </div>
          </div>
          
          <div class="solution">
            <div class="solution-number">3</div>
            <div class="solution-content">
              <h4>Hubungi Bank</h4>
              <p>Pastikan kartu Anda aktif dan tidak diblokir</p>
            </div>
          </div>
          
          <div class="solution">
            <div class="solution-number">4</div>
            <div class="solution-content">
              <h4>Customer Service</h4>
              <p>Hubungi tim dukungan kami jika masalah berlanjut</p>
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
        
        <button class="tertiary-button" on:click={viewOrderDetails}>
          <AlertTriangle size={20} />
          Lihat Detail Pesanan
        </button>
        
        <button class="primary-button" on:click={retryPayment}>
          <RefreshCw size={20} />
          Coba Bayar Lagi
        </button>
      </div>

      <!-- Support Info -->
      <div class="support-info">
        <h4>Butuh Bantuan?</h4>
        <p>Tim customer service kami siap membantu Anda 24/7</p>
        <div class="support-contacts">
          <a href="tel:+6281234567890" class="support-link">
            📞 +62 812-3456-7890
          </a>
          <a href="mailto:support@tokoonline.com" class="support-link">
            ✉️ support@tokoonline.com
          </a>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .payment-error-container {
    min-height: 100vh;
    background: linear-gradient(135deg, #fef2f2 0%, #fef7f7 100%);
    padding: 2rem 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .loading-state, .error-state {
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
    border-top: 4px solid #dc2626;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .error-content {
    max-width: 600px;
    width: 100%;
  }

  .error-header {
    text-align: center;
    background: white;
    padding: 3rem 2rem;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    margin-bottom: 2rem;
  }

  .error-icon {
    margin-bottom: 1.5rem;
  }

  .error-title {
    font-size: 2rem;
    font-weight: 700;
    color: #991b1b;
    margin-bottom: 0.5rem;
  }

  .error-subtitle {
    font-size: 1.125rem;
    color: #6b7280;
    margin: 0;
  }

  .order-summary-card, .common-issues-card, .solutions-card {
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

  .status.failed {
    background: #fee2e2;
    color: #991b1b;
  }

  .total-amount {
    font-size: 1.25rem;
    color: #dc2626;
  }

  .common-issues-card, .solutions-card {
    padding: 1.5rem;
  }

  .common-issues-card h3, .solutions-card h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 1.5rem;
  }

  .issues-list, .solutions-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .issue-item {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem;
    background: #fef7f7;
    border-radius: 8px;
    border-left: 4px solid #f87171;
  }

  .issue-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .issue-content h4 {
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.25rem;
  }

  .issue-content p {
    color: #6b7280;
    margin: 0;
    font-size: 0.875rem;
  }

  .solution {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .solution-number {
    width: 32px;
    height: 32px;
    background: #dc2626;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.875rem;
    flex-shrink: 0;
  }

  .solution-content h4 {
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.25rem;
  }

  .solution-content p {
    color: #6b7280;
    margin: 0;
    font-size: 0.875rem;
  }

  .action-buttons {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-bottom: 2rem;
  }

  .primary-button, .secondary-button, .tertiary-button {
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
    background: #dc2626;
    color: white;
  }

  .primary-button:hover {
    background: #b91c1c;
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

  .tertiary-button {
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
  }

  .tertiary-button:hover {
    background: #fee2e2;
    transform: translateY(-1px);
  }

  .support-info {
    background: white;
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    text-align: center;
  }

  .support-info h4 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .support-info p {
    color: #6b7280;
    margin-bottom: 1.5rem;
  }

  .support-contacts {
    display: flex;
    gap: 1rem;
    justify-content: center;
  }

  .support-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #f9fafb;
    border-radius: 8px;
    text-decoration: none;
    color: #374151;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .support-link:hover {
    background: #f3f4f6;
    transform: translateY(-1px);
  }

  @media (max-width: 768px) {
    .payment-error-container {
      padding: 1rem;
    }

    .error-header {
      padding: 2rem 1.5rem;
    }

    .error-title {
      font-size: 1.5rem;
    }

    .error-subtitle {
      font-size: 1rem;
    }

    .action-buttons {
      flex-direction: column;
    }

    .primary-button, .secondary-button, .tertiary-button {
      width: 100%;
      justify-content: center;
    }

    .info-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
    }

    .support-contacts {
      flex-direction: column;
    }

    .support-link {
      justify-content: center;
    }
  }
</style>