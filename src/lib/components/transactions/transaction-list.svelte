<script lang="ts">
  import { History, Package } from 'lucide-svelte';
  import TransactionCard from './transaction-card.svelte';

  export let transactions = [];
  export let loadingAction = false;
  export let onViewDetail = () => {};
  export let onContinuePayment = () => {};
  export let onCancelOrder = () => {};
  export let onReorder = () => {};
  export let onGoToCheckout = () => {};
  export let formatPrice = (value) => value;
  export let formatDate = (date) => date;

  function handleContinuePayment(transaction) {
    if (transaction.status !== 'pending') {
      console.warn('Continue payment called for non-pending transaction:', transaction.status);
      return;
    }

    if (!transaction.paymentUrl) {
      console.warn('No payment URL available for transaction:', transaction.orderNumber);
      return;
    }

    // Panggil handler dari parent (transactions page)
    onContinuePayment(transaction);
  }

  function handleCancelOrder(transactionId, action) {
    onCancelOrder(transactionId, action);
  }

  function handleReorder(transactionId, action) {
    onReorder(transactionId, action);
  }

  function handleViewDetail(transaction) {
    onViewDetail(transaction);
  }
</script>

<div class="transactions-content">
  {#if transactions.length === 0}
    <div class="empty-state">
      <History size={48} />
      <h3>Belum Ada Transaksi</h3>
      <p>Anda belum memiliki riwayat transaksi. Mulai berbelanja sekarang!</p>
      <button class="btn btn-primary" on:click={onGoToCheckout}>
        <Package size={16} />
        Mulai Belanja
      </button>
    </div>
  {:else}
    <div class="transactions-list">
      {#each transactions as transaction (transaction.id)}
        <TransactionCard
          {transaction}
          {loadingAction}
          onViewDetail={handleViewDetail}
          onContinuePayment={handleContinuePayment}
          onCancelOrder={handleCancelOrder}
          onReorder={handleReorder}
          {formatPrice}
          {formatDate}
        />
      {/each}
    </div>
  {/if}
</div>