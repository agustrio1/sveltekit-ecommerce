<script lang="ts">
  import { 
    Package,
    Eye,
    CreditCard,
    XCircle,
    RotateCcw,
    Loader,
    Clock,
    Truck,
    CheckCircle,
    AlertCircle
  } from 'lucide-svelte';

  export let transaction;
  export let loadingAction = false;
  export let onViewDetail = () => {};
  export let onContinuePayment = () => {};
  export let onCancelOrder = () => {};
  export let onReorder = () => {};
  export let formatPrice = (value) => value;
  export let formatDate = (date) => date;

  const STATUS_OPTIONS = [
    { value: '', label: 'Semua Status' },
    { value: 'pending', label: 'Menunggu Pembayaran' },
    { value: 'paid', label: 'Sudah Dibayar' },
    { value: 'processing', label: 'Diproses' },
    { value: 'shipped', label: 'Dikirim' },
    { value: 'delivered', label: 'Diterima' },
    { value: 'cancelled', label: 'Dibatalkan' },
    { value: 'failed', label: 'Gagal' }
  ];

  function getStatusIcon(status) {
    const icons = {
      'pending': Clock,
      'paid': CreditCard,
      'processing': Package,
      'shipped': Truck,
      'delivered': CheckCircle,
      'cancelled': XCircle,
      'failed': AlertCircle
    };
    return icons[status] || Clock;
  }

  function getStatusClass(status) {
    return `status-${status}` || 'status-pending';
  }

  function getStatusLabel(status) {
    const option = STATUS_OPTIONS.find(opt => opt.value === status);
    return option ? option.label : status;
  }

  function canCancelOrder(transaction) {
    return ['pending', 'processing'].includes(transaction.status);
  }

  function canReorder(transaction) {
    return ['delivered', 'cancelled', 'failed'].includes(transaction.status);
  }

  // PERBAIKAN: Fungsi untuk mengecek apakah tombol pembayaran harus ditampilkan
  function shouldShowPaymentButton(transaction) {
    return transaction.status === 'pending' && transaction.paymentUrl;
  }

  function getCancelButtonInfo(status) {
    const buttonInfo = {
      'pending': { text: 'Batal', tooltip: 'Batalkan pesanan yang belum dibayar' },
      'processing': { text: 'Batal', tooltip: 'Batalkan pesanan yang sedang diproses' }
    };
    return buttonInfo[status] || { text: 'Batal', tooltip: 'Batalkan pesanan' };
  }

  function getActionMessage(transaction) {
    const messages = {
      'shipped': 'Pesanan sudah dikirim, tidak dapat dibatalkan',
      'delivered': 'Pesanan sudah diterima',
      'paid': 'Pesanan sudah dibayar, sedang diproses',
      'cancelled': 'Pesanan telah dibatalkan',
      'failed': 'Pesanan gagal diproses'
    };
    return messages[transaction.status] || null;
  }

  // PERBAIKAN: Handler untuk tombol pembayaran
  function handleContinuePayment() {
    if (!shouldShowPaymentButton(transaction)) {
      console.warn('Payment button should not be visible for this transaction');
      return;
    }
    onContinuePayment(transaction);
  }

  function handleCancelOrder() {
    if (!canCancelOrder(transaction)) return;
    onCancelOrder(transaction.id, 'cancel');
  }

  function handleReorder() {
    if (!canReorder(transaction)) return;
    onReorder(transaction.id, 'reorder');
  }
</script>

<div class="transaction-card">
  <div class="transaction-header">
    <div class="transaction-info">
      <div class="transaction-number">
        <Package size={16} />
        {transaction.orderNumber}
      </div>
      <div class="transaction-date">
        {formatDate(transaction.createdAt)}
      </div>
    </div>
    
    <div class="transaction-status">
      <div class="status-badge {getStatusClass(transaction.status)}">
        <svelte:component this={getStatusIcon(transaction.status)} size={14} />
        {getStatusLabel(transaction.status)}
      </div>
    </div>
  </div>

  <div class="transaction-body">
    <div class="transaction-details">
      <div class="detail-row">
        <span class="detail-label">Penerima:</span>
        <span class="detail-value">{transaction.recipientName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Alamat:</span>
        <span class="detail-value">
          {transaction.address}
          {#if transaction.city || transaction.province || transaction.postalCode}
            <br>
            {#if transaction.city}{transaction.city}{/if}{#if transaction.province && transaction.city}, {/if}{#if transaction.province}{transaction.province}{/if}{#if transaction.postalCode}, {transaction.postalCode}{/if}
          {/if}
        </span>
      </div>
      {#if transaction.courierName && transaction.courierService}
        <div class="detail-row">
          <span class="detail-label">Kurir:</span>
          <span class="detail-value">{transaction.courierName} - {transaction.courierService}</span>
        </div>
      {/if}
      {#if transaction.items && transaction.items.length > 0}
        <div class="detail-row">
          <span class="detail-label">Item:</span>
          <span class="detail-value">{transaction.items.length} produk</span>
        </div>
      {/if}
    </div>

    <div class="transaction-amount">
      <div class="amount-label">Total</div>
      <div class="amount-value">{formatPrice(transaction.total)}</div>
    </div>
  </div>

  <!-- Status Message for non-actionable transactions -->
  {#if getActionMessage(transaction)}
    <div class="transaction-message">
      <AlertCircle size={14} />
      <span>{getActionMessage(transaction)}</span>
    </div>
  {/if}

  <div class="transaction-actions">
    <!-- Tombol Detail - Selalu ada -->
    <button 
      class="btn btn-outline btn-sm"
      on:click={() => onViewDetail(transaction)}
      title="Lihat detail lengkap pesanan"
    >
      <Eye size={14} />
      Detail
    </button>

    <!-- PERBAIKAN: Tombol Pembayaran - Hanya untuk pending dengan paymentUrl -->
    {#if shouldShowPaymentButton(transaction)}
      <button 
        class="btn btn-primary btn-sm"
        disabled={loadingAction}
        on:click={handleContinuePayment}
        title="Lanjutkan pembayaran ke Midtrans"
      >
        {#if loadingAction}
          <Loader size={14} class="spinning" />
        {:else}
          <CreditCard size={14} />
        {/if}
        Bayar Sekarang
      </button>
    {/if}

    <!-- Tombol Batal - Untuk pending dan processing -->
    {#if canCancelOrder(transaction)}
      {@const cancelInfo = getCancelButtonInfo(transaction.status)}
      <button 
        class="btn btn-danger btn-sm"
        disabled={loadingAction}
        title={cancelInfo.tooltip}
        on:click={handleCancelOrder}
      >
        {#if loadingAction}
          <Loader size={14} class="spinning" />
        {:else}
          <XCircle size={14} />
        {/if}
        {cancelInfo.text}
      </button>
    {/if}

    <!-- Tombol Pesan Lagi - Untuk delivered, cancelled, failed -->
    {#if canReorder(transaction)}
      <button 
        class="btn btn-outline btn-sm"
        disabled={loadingAction}
        title="Pesan ulang dengan item yang sama"
        on:click={handleReorder}
      >
        {#if loadingAction}
          <Loader size={14} class="spinning" />
        {:else}
          <RotateCcw size={14} />
        {/if}
        Pesan Lagi
      </button>
    {/if}
  </div>

  <!-- Debug info untuk development (akan tersembunyi di production) -->
  {#if transaction.status === 'pending'}
    <div class="payment-debug" style="display: none;">
      Payment URL: {transaction.paymentUrl ? 'Available' : 'Not Available'}
      Status: {transaction.status}
    </div>
  {/if}
</div>