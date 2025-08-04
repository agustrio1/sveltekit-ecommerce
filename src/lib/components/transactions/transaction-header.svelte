<script lang="ts">
  import { 
    History, 
    RefreshCw,
    Package,
    CreditCard,
    Clock,
    CheckCircle
  } from 'lucide-svelte';

  export let summary = null;
  export let loading = false;
  export let onRefresh = () => {};
  export let onGoToCheckout = () => {};
  export let formatPrice = (value) => value;
</script>

<div class="transactions-header">
  <div class="header-content">
    <div class="header-title">
      <History size={24} />
      <h1>Riwayat Transaksi</h1>
    </div>
    
    <div class="header-actions">
      <button 
        class="btn btn-outline"
        on:click={onRefresh}
        disabled={loading}
      >
        <RefreshCw size={16} class={loading ? 'spinning' : ''} />
        Refresh
      </button>
      
      <button 
        class="btn btn-primary"
        on:click={onGoToCheckout}
      >
        <Package size={16} />
        Buat Pesanan Baru
      </button>
    </div>
  </div>

  <!-- Summary Cards -->
  {#if summary}
    <div class="summary-cards">
      <div class="summary-card">
        <div class="card-icon total">
          <History size={20} />
        </div>
        <div class="card-content">
          <div class="card-value">{summary.totalOrders}</div>
          <div class="card-label">Total Pesanan</div>
        </div>
      </div>
      
      <div class="summary-card">
        <div class="card-icon amount">
          <CreditCard size={20} />
        </div>
        <div class="card-content">
          <div class="card-value">{formatPrice(summary.totalAmount)}</div>
          <div class="card-label">Total Nilai</div>
        </div>
      </div>
      
      <div class="summary-card">
        <div class="card-icon pending">
          <Clock size={20} />
        </div>
        <div class="card-content">
          <div class="card-value">{summary.pendingOrders}</div>
          <div class="card-label">Menunggu Bayar</div>
        </div>
      </div>
      
      <div class="summary-card">
        <div class="card-icon delivered">
          <CheckCircle size={20} />
        </div>
        <div class="card-content">
          <div class="card-value">{summary.deliveredOrders}</div>
          <div class="card-label">Selesai</div>
        </div>
      </div>
    </div>
  {/if}
</div>