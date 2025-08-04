<!-- src/routes/orders/[orderId]/payment-pending/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { Clock, RefreshCw, Home, CreditCard, AlertCircle, CheckCircle, XCircle } from 'lucide-svelte';

  export let data;

  let order = null;
  let loading = true;
  let error = '';
  let checkingStatus = false;
  let autoRefreshInterval = null;

  onMount(async () => {
    try {
      // Get order ID from URL
      const orderId = $page.params.orderId;
      
      // Fetch order details
      await loadOrderDetails(orderId);
      
      // Start auto-refresh to check payment status
      startAutoRefresh(orderId);
    } catch (err) {
      console.error('Error loading order:', err);
      error = err.message || 'Terjadi kesalahan saat memuat pesanan';
      loading = false;
    }

    // Cleanup on component destroy
    return () => {
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
      }
    };
  });

  async function loadOrderDetails(orderId) {
    const response = await fetch(`/api/orders/${orderId}`);
    
    if (!response.ok) {
      throw new Error('Gagal memuat detail pesanan');
    }
    
    const result = await response.json();
    
    if (result.success) {
      order = result.data;
      
      // Check if status has changed
      if (order.status === 'paid') {
        // Redirect to success page
        goto(`/orders/${orderId}/payment-success`);
        return;
      } else if (order.status === 'failed' || order.status === 'cancelled') {
        // Redirect to error page
        goto(`/orders/${orderId}/payment-error`);
        return;
      }
    } else {
      throw new Error(result.message || 'Pesanan tidak ditemukan');
    }
    
    loading = false;
  }

  function startAutoRefresh(orderId) {
    // Check payment status every 10 seconds
    autoRefreshInterval = setInterval(async () => {
      try {
        await loadOrderDetails(orderId);
      } catch (err) {
        console.error('Auto-refresh error:', err);
      }
    }, 10000);
  }

  async function checkPaymentStatus() {
    if (checkingStatus) return;
    
    checkingStatus = true;
    try {
      const orderId = $page.params.orderId;
      await loadOrderDetails(orderId);
    } catch (err) {
      console.error('Error checking payment status:', err);
    } finally {
      checkingStatus = false;
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

  function goToPayment() {
    goto(`/checkout/${order.id}`);
  }
</script>

<svelte:head>
  <title>Pembayaran Menunggu - Toko Online</title>
  <meta name="description" content="Pembayaran Anda sedang diproses" />
</svelte:head>

<div class="payment-pending-container">
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
    <div class="pending-content">
      <!-- Pending Header -->
      <div class="pending-header">
        <div class="pending-icon">
          <Clock size={64} color="#f59e0b" />
        </div>
        <h1 class="pending-title">Pembayaran Menunggu</h1>
        <p class="pending-subtitle">
          Pesanan Anda sedang menunggu konfirmasi pembayaran. Proses ini biasanya memakan waktu beberapa menit.
        </p>
      </div>

      <!-- Status Indicator -->
      <div class="status-indicator">
        <div class="status-steps">
          <div class="step completed">
            <div class="step-icon">
              <CheckCircle size={20} />
            </div>
            <span>Pesanan Dibuat</span>
          </div>
          
          <div class="step active">
            <div class="step-icon pulsing">
              <Clock size={20} />
            </div>
            <span>Menunggu Pembayaran</span>
          </div>
          
          <div class="step">
            <div class="step-icon">
              <CheckCircle size={20} />
            </div>
            <span>Pembayaran Dikonfirmasi</span>
          </div>
        </div>
      </div>

      <!-- Order Summary Card -->
      <div class="order-summary-card">
        <div class="card-header">
          <AlertCircle size={24} />
          <h2>Detail Pesanan</h2>
          <button 
            class="refresh-button" 
            on:click={checkPaymentStatus}
            disabled={checkingStatus}
          >
            <RefreshCw size={16} class={checkingStatus ? 'spinning' : ''} />
            {checkingStatus ? 'Mengecek...' : 'Refresh'}
          </button>
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
            <span class="value status pending">Menunggu Pembayaran</span>
          </div>
          
          <div class="info-row">
            <span class="label">Total Pembayaran:</span>
            <span class="value total-amount">{formatPrice(parseFloat(order.total))}</span>
          </div>
        </div>
      </div>

      <!-- Payment Instructions -->
      <div class="payment-instructions-card">
        <h3>Instruksi Pembayaran</h3>
        <div class="instructions-content">
          <div class="instruction-item">
            <div class="instruction-number">1</div>
            <div class="instruction-text">
              <h4>Selesaikan Pembayaran</h4>
              <p>Jika Anda belum menyelesaikan pembayaran, silakan lanjutkan proses pembayaran melalui metode yang Anda pilih.</p>
            </div>
          </div>
          
          <div class="instruction-item">
            <div class="instruction-number">2</div>
            <div class="instruction-text">
              <h4>Tunggu Konfirmasi</h4>
              <p>Setelah pembayaran berhasil, sistem akan otomatis memperbarui status pesanan Anda dalam 1-5 menit.</p>
            </div>
          </div>
          
          <div class="instruction-item">
            <div class="instruction-number">3</div>
            <div class="instruction-text">
              <h4>Notifikasi Otomatis</h4>
              <p>Halaman ini akan otomatis refresh setiap 10 detik. Anda juga akan menerima email konfirmasi.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Payment Methods Info -->
      <div class="payment-methods-card">
        <h3>Waktu Konfirmasi Berdasarkan Metode Pembayaran</h3>
        <div class="methods-grid">
          <div class="method-item">
            <div class="method-icon">💳</div>
            <div class="method-info">
              <h4>Kartu Kredit/Debit</h4>
              <p class="method-time">1-3 menit</p>
            </div>
          </div>
          
          <div class="method-item">
            <div class="method-icon">🏦</div>
            <div class="method-info">
              <h4>Bank Transfer</h4>
              <p class="method-time">5-15 menit</p>
            </div>
          </div>
          
          <div class="method-item">
            <div class="method-icon">📱</div>
            <div class="method-info">
              <h4>E-Wallet</h4>
              <p class="method-time">1-5 menit</p>
            </div>
          </div>
          
          <div class="method-item">
            <div class="method-icon">🏪</div>
            <div class="method-info">
              <h4>Convenience Store</h4>
              <p class="method-time">5-30 menit</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Auto Refresh Info -->
      <div class="auto-refresh-info">
        <div class="refresh-indicator">
          <div class="refresh-dot pulsing"></div>
          <span>Halaman ini akan otomatis refresh setiap 10 detik</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <button class="secondary-button" on:click={goToHome}>
          <Home size={20} />
          Kembali ke Beranda
        </button>
        
        <button class="tertiary-button" on:click={viewOrderDetails}>
          <AlertCircle size={20} />
          Lihat Detail Pesanan
        </button>
        
        <button class="primary-button" on:click={goToPayment}>
          <CreditCard size={20} />
          Lanjutkan Pembayaran
        </button>
      </div>

      <!-- Support Info -->
      <div class="support-info">
        <h4>Butuh Bantuan?</h4>
        <p>Jika pembayaran tidak terkonfirmasi dalam 30 menit, silakan hubungi customer service</p>
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
  .payment-pending-container {
    min-height: 100vh;
    background: linear-gradient(135deg, #fefbf3 0%, #fef7ed 100%);
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
    border-top: 4px solid #f59e0b;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .spinning {
    animation: spin 1s linear infinite;
  }

  .pending-content {
    max-width: 600px;
    width: 100%;
  }

  .pending-header {
    text-align: center;
    background: white;
    padding: 3rem 2rem;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    margin-bottom: 2rem;
  }

  .pending-icon {
    margin-bottom: 1.5rem;
  }

  .pending-title {
    font-size: 2rem;
    font-weight: 700;
    color: #d97706;
    margin-bottom: 0.5rem;
  }

  .pending-subtitle {
    font-size: 1.125rem;
    color: #6b7280;
    margin: 0;
  }

  .status-indicator {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    padding: 2rem;
    margin-bottom: 2rem;
  }

  .status-steps {
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
  }

  .status-steps::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 2px;
    background: #e5e7eb;
    z-index: 1;
  }

  .step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    position: relative;
    z-index: 2;
    background: white;
    padding: 0 1rem;
  }

  .step-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f3f4f6;
    color: #9ca3af;
    border: 2px solid #e5e7eb;
  }

  .step.completed .step-icon {
    background: #d1fae5;
    color: #059669;
    border-color: #059669;
  }

  .step.active .step-icon {
    background: #fef3c7;
    color: #d97706;
    border-color: #d97706;
  }

  .step span {
    font-size: 0.875rem;
    font-weight: 500;
    color: #6b7280;
    text-align: center;
  }

  .step.completed span {
    color: #059669;
  }

  .step.active span {
    color: #d97706;
    font-weight: 600;
  }

  .pulsing {
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .order-summary-card, .payment-instructions-card, .payment-methods-card {
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
    justify-content: space-between;
  }

  .card-header h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #374151;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .refresh-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #f59e0b;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .refresh-button:hover:not(:disabled) {
    background: #d97706;
  }

  .refresh-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
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
    animation: pulse 2s infinite;
  }

  .status.pending {
    background: #fef3c7;
    color: #d97706;
  }

  .total-amount {
    font-size: 1.25rem;
    color: #f59e0b;
  }

  .payment-instructions-card, .payment-methods-card {
    padding: 1.5rem;
  }

  .payment-instructions-card h3, .payment-methods-card h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 1.5rem;
  }

  .instructions-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .instruction-item {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .instruction-number {
    width: 32px;
    height: 32px;
    background: #f59e0b;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.875rem;
    flex-shrink: 0;
  }

  .instruction-text h4 {
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .instruction-text p {
    color: #6b7280;
    margin: 0;
    line-height: 1.6;
  }

  .methods-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .method-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: #fefbf3;
    border-radius: 8px;
    border: 1px solid #fed7aa;
  }

  .method-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .method-info h4 {
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.25rem;
    font-size: 0.875rem;
  }

  .method-time {
    color: #f59e0b;
    font-weight: 600;
    margin: 0;
    font-size: 0.75rem;
  }

  .auto-refresh-info {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    padding: 1rem;
    margin-bottom: 2rem;
    text-align: center;
  }

  .refresh-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: #6b7280;
    font-size: 0.875rem;
  }

  .refresh-dot {
    width: 8px;
    height: 8px;
    background: #f59e0b;
    border-radius: 50%;
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
    background: #f59e0b;
    color: white;
  }

  .primary-button:hover {
    background: #d97706;
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
    background: #fef3c7;
    color: #d97706;
    border: 1px solid #fcd34d;
  }

  .tertiary-button:hover {
    background: #fde68a;
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
    background: #fef3c7;
    border-radius: 8px;
    text-decoration: none;
    color: #d97706;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .support-link:hover {
    background: #fde68a;
    transform: translateY(-1px);
  }

  @media (max-width: 768px) {
    .payment-pending-container {
      padding: 1rem;
    }

    .pending-header {
      padding: 2rem 1.5rem;
    }

    .pending-title {
      font-size: 1.5rem;
    }

    .pending-subtitle {
      font-size: 1rem;
    }

    .status-steps {
      flex-direction: column;
      gap: 1rem;
    }

    .status-steps::before {
      display: none;
    }

    .step {
      flex-direction: row;
      justify-content: flex-start;
      width: 100%;
      padding: 0;
      text-align: left;
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

    .methods-grid {
      grid-template-columns: 1fr;
    }

    .support-contacts {
      flex-direction: column;
    }

    .support-link {
      justify-content: center;
    }

    .card-header {
      flex-direction: column;
      gap: 1rem;
      align-items: flex-start;
    }

    .card-header h2 {
      width: 100%;
    }

    .refresh-button {
      align-self: flex-end;
    }
  }
</style>