<script lang="ts">
  import { 
    CreditCard,
    RotateCcw,
    Loader,
    Clock,
    Truck,
    CheckCircle,
    XCircle,
    AlertCircle,
    Package
  } from 'lucide-svelte';

  export let show = false;
  export let transaction = null;
  export let loadingAction = false;
  export let onClose = () => {};
  export let onContinuePayment = () => {};
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
    switch (status) {
      case 'pending': return Clock;
      case 'paid': return CreditCard;
      case 'processing': return Package;
      case 'shipped': return Truck;
      case 'delivered': return CheckCircle;
      case 'cancelled': return XCircle;
      case 'failed': return AlertCircle;
      default: return Clock;
    }
  }

  function getStatusClass(status) {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'paid': return 'status-paid';
      case 'processing': return 'status-processing';
      case 'shipped': return 'status-shipped';
      case 'delivered': return 'status-delivered';
      case 'cancelled': return 'status-cancelled';
      case 'failed': return 'status-failed';
      default: return 'status-pending';
    }
  }

  function getStatusLabel(status) {
    const option = STATUS_OPTIONS.find(opt => opt.value === status);
    return option ? option.label : status;
  }

  function canReorder(transaction) {
    return ['delivered', 'cancelled'].includes(transaction.status);
  }
</script>

{#if show && transaction}
  <div class="modal-overlay" on:click={onClose}>
    <div class="modal-content transaction-detail" on:click|stopPropagation>
      <div class="modal-header">
        <h3>Detail Transaksi</h3>
        <button class="modal-close" on:click={onClose}>×</button>
      </div>

      <div class="modal-body">
        <div class="detail-section">
          <h4>Informasi Pesanan</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="label">Nomor Pesanan:</span>
              <span class="value">{transaction.orderNumber}</span>
            </div>
            <div class="detail-item">
              <span class="label">Tanggal Pesanan:</span>
              <span class="value">{formatDate(transaction.createdAt)}</span>
            </div>
            <div class="detail-item">
              <span class="label">Status:</span>
              <div class="status-badge {getStatusClass(transaction.status)}">
                <svelte:component this={getStatusIcon(transaction.status)} size={14} />
                {getStatusLabel(transaction.status)}
              </div>
            </div>
            <div class="detail-item">
              <span class="label">Total:</span>
              <span class="value total">{formatPrice(transaction.total)}</span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <h4>Informasi Penerima</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="label">Nama:</span>
              <span class="value">{transaction.recipientName}</span>
            </div>
            <div class="detail-item">
              <span class="label">Telepon:</span>
              <span class="value">{transaction.phone}</span>
            </div>
            <div class="detail-item">
              <span class="label">Email:</span>
              <span class="value">{transaction.email}</span>
            </div>
            <div class="detail-item full-width">
              <span class="label">Alamat:</span>
              <span class="value">
                {transaction.address}
                {#if transaction.city || transaction.province || transaction.postalCode}
                  <br>
                  {#if transaction.city}{transaction.city}{/if}{#if transaction.province && transaction.city}, {/if}{#if transaction.province}{transaction.province}{/if}{#if transaction.postalCode}, {transaction.postalCode}{/if}
                {/if}
              </span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <h4>Informasi Pengiriman</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="label">Kurir:</span>
              <span class="value">{transaction.courierName}</span>
            </div>
            <div class="detail-item">
              <span class="label">Layanan:</span>
              <span class="value">{transaction.courierService}</span>
            </div>
            <div class="detail-item">
              <span class="label">Ongkir:</span>
              <span class="value">{formatPrice(transaction.shippingCost)}</span>
            </div>
            {#if transaction.courierInsurance && parseFloat(transaction.courierInsurance) > 0}
              <div class="detail-item">
                <span class="label">Asuransi:</span>
                <span class="value">{formatPrice(transaction.courierInsurance)}</span>
              </div>
            {/if}
          </div>
        </div>

        {#if transaction.items && transaction.items.length > 0}
          <div class="detail-section">
            <h4>Item Pesanan</h4>
            <div class="items-list">
              {#each transaction.items as item}
                <div class="item-row">
                  <div class="item-info">
                    <div class="item-name">{item.name}</div>
                    {#if item.description}
                      <div class="item-description">{item.description}</div>
                    {/if}
                  </div>
                  <div class="item-details">
                    <div class="item-price">{formatPrice(item.price)} × {item.quantity}</div>
                    <div class="item-total">{formatPrice(parseFloat(item.price) * item.quantity)}</div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <div class="detail-section">
          <h4>Ringkasan Biaya</h4>
          <div class="cost-summary">
            <div class="cost-row">
              <span>Subtotal:</span>
              <span>{formatPrice(transaction.subtotal)}</span>
            </div>
            <div class="cost-row">
              <span>Ongkos Kirim:</span>
              <span>{formatPrice(transaction.shippingCost)}</span>
            </div>
            {#if transaction.courierInsurance && parseFloat(transaction.courierInsurance) > 0}
              <div class="cost-row">
                <span>Asuransi:</span>
                <span>{formatPrice(transaction.courierInsurance)}</span>
              </div>
            {/if}
            <div class="cost-divider"></div>
            <div class="cost-row total">
              <span>Total:</span>
              <span>{formatPrice(transaction.total)}</span>
            </div>
          </div>
        </div>

        {#if transaction.orderNote}
          <div class="detail-section">
            <h4>Catatan Pesanan</h4>
            <p class="order-note">{transaction.orderNote}</p>
          </div>
        {/if}
      </div>

      <!-- Mobile Actions Bar - Fixed to modal bottom, not screen bottom -->
      <div class="modal-actions-mobile">
        <button class="btn btn-outline" on:click={onClose}>
          Tutup
        </button>
        
        {#if transaction.status === 'pending'}
          <button 
            class="btn btn-primary"
            on:click={() => {
              onClose();
              onContinuePayment(transaction);
            }}
          >
            <CreditCard size={16} />
            Bayar
          </button>
        {/if}

        {#if canReorder(transaction)}
          <button 
            class="btn btn-primary"
            disabled={loadingAction}
            on:click={() => {
              onClose();
              onReorder(transaction.id, 'reorder');
            }}
          >
            {#if loadingAction}
              <Loader size={16} class="spinning" />
            {:else}
              <RotateCcw size={16} />
            {/if}
            Pesan Lagi
          </button>
        {/if}
      </div>

      <!-- Desktop Modal Footer -->
      <div class="modal-footer">
        <button class="btn btn-outline" on:click={onClose}>
          Tutup
        </button>
        
        {#if transaction.status === 'pending'}
          <button 
            class="btn btn-primary"
            on:click={() => {
              onClose();
              onContinuePayment(transaction);
            }}
          >
            <CreditCard size={16} />
            Bayar Sekarang
          </button>
        {/if}

        {#if canReorder(transaction)}
          <button 
            class="btn btn-primary"
            disabled={loadingAction}
            on:click={() => {
              onClose();
              onReorder(transaction.id, 'reorder');
            }}
          >
            {#if loadingAction}
              <Loader size={16} class="spinning" />
            {:else}
              <RotateCcw size={16} />
            {/if}
            Pesan Lagi
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}