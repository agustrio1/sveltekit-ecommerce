<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  
  // Import components
  import TransactionHeader from '$lib/components/transactions/transaction-header.svelte';
  import TransactionFilters from '$lib/components/transactions/transaction-filters.svelte';
  import TransactionList from '$lib/components/transactions/transaction-list.svelte';
  import TransactionPagination from '$lib/components/transactions/transaction-pagination.svelte';
  import TransactionDetailModal from '$lib/components/transactions/transaction-detail-modal.svelte';
  import AlertMessages from '$lib/components/transactions/alert-messages.svelte';
  
  import { 
    requireAuth, 
    createAuthenticatedFetch,
    handleAuthenticatedResponse
  } from '$lib/auth/utils';
  
  import './transactions.scss';

  // Authentication
  let user = null;
  let authenticatedFetch = createAuthenticatedFetch();

  // Data
  let transactions = [];
  let summary = null;
  let pagination = null;

  // States
  let loading = true;
  let loadingAction = false;
  let errorMessage = '';
  let successMessage = '';

  // Filters
  let filters = {
    period: 'all',
    status: '',
    search: '',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  };

  // Pagination
  let currentPage = 1;
  let itemsPerPage = 10;

  // UI States
  let showFilters = false;
  let selectedTransaction = null;
  let showTransactionDetail = false;

  // Request tracking
  let currentRequest = null;
  let refreshInterval = null;

  onMount(async () => {
    console.log('🚀 Initializing transactions page...');
    
    // Check authentication - will redirect if not authenticated
    user = await requireAuth($page.url.pathname);
    
    if (!user) {
      loading = false;
      return; // requireAuth will handle the redirect
    }

    // Parse URL parameters
    const urlParams = new URLSearchParams($page.url.search);
    filters.period = urlParams.get('period') || 'all';
    filters.status = urlParams.get('status') || '';
    filters.search = urlParams.get('search') || '';
    filters.sortBy = urlParams.get('sortBy') || 'createdAt';
    filters.sortOrder = urlParams.get('sortOrder') || 'desc';
    currentPage = parseInt(urlParams.get('page') || '1');
    itemsPerPage = parseInt(urlParams.get('limit') || '10');

    console.log('📋 URL params loaded:', { filters, currentPage, itemsPerPage });

    // Load initial transactions
    await loadTransactions();
    
    // Auto refresh every 30 seconds for pending transactions
    refreshInterval = setInterval(() => {
      if (hasUnfinishedTransactions()) {
        console.log('🔄 Auto-refreshing for unfinished transactions...');
        loadTransactions(true); // Silent refresh
      }
    }, 30000);

    loading = false;
    console.log('✅ Transactions page initialized');
  });

  onDestroy(() => {
    cleanup();
  });

  function cleanup() {
    if (currentRequest) {
      currentRequest.abort();
      currentRequest = null;
    }
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
    console.log('🧹 Cleaned up transactions page');
  }

  function hasUnfinishedTransactions(): boolean {
    return transactions.some(t => ['pending', 'paid', 'processing', 'shipped'].includes(t.status));
  }

  async function loadTransactions(silent = false) {
    if (!silent) {
      loading = true;
      console.log('📥 Loading transactions...');
    }
    
    errorMessage = '';

    // Cancel previous request
    if (currentRequest) {
      currentRequest.abort();
    }

    const controller = new AbortController();
    currentRequest = controller;

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        period: filters.period,
        status: filters.status,
        search: filters.search,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        includeItems: 'true'
      });

      const response = await fetch(`/api/transactions?${params}`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        credentials: 'include'
      });

      if (controller.signal.aborted) return;

      console.log('📥 Transactions API response status:', response.status);

      // Handle authentication errors
      if (response.status === 401) {
        console.log('❌ Session expired, redirecting to login');
        goto('/login?redirect=' + encodeURIComponent($page.url.pathname));
        return;
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('📥 Transactions data received:', { 
        success: data.success, 
        transactionCount: data.data?.transactions?.length || 0 
      });
      
      if (data.success) {
        transactions = data.data.transactions || [];
        summary = data.data.summary || null;
        pagination = data.data.pagination || null;
        
        console.log(`✅ Loaded ${transactions.length} transactions`);
        if (!silent) {
          console.log('📊 Summary:', summary);
          console.log('📄 Pagination:', pagination);
        }
      } else {
        throw new Error(data.message || 'Failed to load transactions');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('❌ Error loading transactions:', err);
        if (err.message.includes('Failed to fetch')) {
          errorMessage = 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
        } else {
          errorMessage = err.message || 'Gagal memuat riwayat transaksi';
        }
      }
    } finally {
      if (controller.signal && !controller.signal.aborted) {
        loading = false;
        currentRequest = null;
      }
    }
  }

  function updateURL() {
    const params = new URLSearchParams();
    
    if (filters.period !== 'all') params.set('period', filters.period);
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    if (filters.sortBy !== 'createdAt') params.set('sortBy', filters.sortBy);
    if (filters.sortOrder !== 'desc') params.set('sortOrder', filters.sortOrder);
    if (currentPage !== 1) params.set('page', currentPage.toString());
    if (itemsPerPage !== 10) params.set('limit', itemsPerPage.toString());

    const newURL = `/transactions${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState({}, '', newURL);
  }

  function applyFilters() {
    currentPage = 1;
    updateURL();
    loadTransactions();
  }

  function changePage(newPage) {
    if (newPage >= 1 && newPage <= pagination?.totalPages) {
      currentPage = newPage;
      updateURL();
      loadTransactions();
    }
  }

  function changeItemsPerPage(newLimit) {
    itemsPerPage = newLimit;
    currentPage = 1;
    updateURL();
    loadTransactions();
  }

  function resetFilters() {
    filters = {
      period: 'all',
      status: '',
      search: '',
      sortBy: 'createdAt',
      sortOrder: 'desc'
    };
    currentPage = 1;
    itemsPerPage = 10;
    updateURL();
    loadTransactions();
  }

  // Transaction action handler with improved error handling and CSRF
  async function handleTransactionAction(transactionId, action) {
    if (loadingAction) return;
    
    loadingAction = true;
    errorMessage = '';
    successMessage = '';

    console.log(`🔄 Processing transaction action: ${action} for order ${transactionId}`);

    try {
      const requestBody = {
        orderId: transactionId,
        action: action
      };

      console.log('📤 Sending transaction action request:', requestBody);

      const response = await authenticatedFetch('/api/transactions', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });
      
      console.log('📤 Transaction action response status:', response.status);
      
      const data = await handleAuthenticatedResponse(response);
      console.log('📤 Transaction action response data:', data);
      
      if (data.success) {
        if (action === 'cancel') {
          successMessage = 'Pesanan berhasil dibatalkan';
          await loadTransactions();
        } else if (action === 'reorder') {
          // Redirect to checkout with items
          if (data.data?.items) {
            // Store items in session storage temporarily
            sessionStorage.setItem('reorder_items', JSON.stringify(data.data.items));
            goto('/checkout?reorder=true');
          } else {
            throw new Error('Tidak dapat memuat item pesanan');
          }
        }
      } else {
        throw new Error(data.message || 'Gagal memproses aksi');
      }
    } catch (err) {
      if (err.message.includes('Failed to fetch')) {
        errorMessage = 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
      } else {
        errorMessage = err.message || 'Terjadi kesalahan saat memproses aksi';
      }
    } finally {
      loadingAction = false;
    }
  }

  function viewTransactionDetail(transaction) {
    selectedTransaction = transaction;
    showTransactionDetail = true;
  }

  function closeTransactionDetail() {
    selectedTransaction = null;
    showTransactionDetail = false;
  }

  function continuePayment(transaction) {
    // Validasi status transaction
    if (transaction.status !== 'pending') {
      errorMessage = 'Hanya pesanan dengan status "Menunggu Pembayaran" yang dapat dilanjutkan pembayarannya.';
      return;
    }

    if (!transaction.paymentUrl) {
      errorMessage = 'Link pembayaran tidak tersedia. Silakan hubungi customer service atau coba refresh halaman.';
      return;
    }

    try {
      console.log('🔗 Redirecting to payment URL:', transaction.paymentUrl);
      
      // Buka pembayaran di tab/window baru untuk UX yang lebih baik
      const paymentWindow = window.open(
        transaction.paymentUrl, 
        '_blank',
        'width=800,height=600,scrollbars=yes,resizable=yes'
      );
      
      if (!paymentWindow || paymentWindow.closed || typeof paymentWindow.closed === 'undefined') {
        const userConfirmed = confirm(
          'Popup pembayaran diblokir oleh browser!\n\n' +
          'Klik "OK" untuk membuka halaman pembayaran di tab ini, atau\n' +
          'Klik "Cancel" dan aktifkan popup untuk website ini.'
        );
        
        if (userConfirmed) {
          // Redirect di tab yang sama
          window.location.href = transaction.paymentUrl;
        } else {
          errorMessage = 'Pembayaran dibatalkan. Silakan aktifkan popup untuk pengalaman yang lebih baik.';
        }
        return;
      }

      // Monitor window pembayaran (opsional)
      let checkCount = 0;
      const maxChecks = 600; // 10 menit (600 detik)
      
      const checkPaymentWindow = setInterval(() => {
        checkCount++;
        
        // Jika window ditutup atau timeout
        if (paymentWindow.closed || checkCount >= maxChecks) {
          clearInterval(checkPaymentWindow);
          
          if (paymentWindow.closed) {
            console.log('💳 Payment window closed by user');
            
            // Refresh transactions untuk cek status pembayaran terbaru
            setTimeout(() => {
              console.log('🔄 Refreshing transactions after payment window closed');
              loadTransactions(true);
            }, 2000);
          } else {
            console.log('⏰ Payment window monitoring timeout');
          }
        }
      }, 1000);
      
      // Set focus ke window pembayaran
      paymentWindow.focus();
      
    } catch (error) {
      console.error('❌ Error opening payment window:', error);
      errorMessage = 'Terjadi kesalahan saat membuka halaman pembayaran. Silakan coba lagi.';
    }
  }

  function goToCheckout() {
    goto('/checkout');
  }

  function formatPrice(value) {
    const num = typeof value === 'number' ? value : parseFloat(value) || 0;
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  }

  // Search debouncing
  let searchTimeout;
  function handleSearchInput(event) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      filters.search = event.target.value;
      applyFilters();
    }, 500);
  }

  // Event handlers for components
  function handleRefresh() {
    loadTransactions();
  }

  function handleClearError() {
    errorMessage = '';
  }

  function handleClearSuccess() {
    successMessage = '';
  }

  // Retry authentication helper
  async function retryAuth() {
    loading = true;
    errorMessage = '';
    user = await requireAuth($page.url.pathname);
    if (user) {
      await loadTransactions();
    }
    loading = false;
  }
</script>

<svelte:head>
  <title>Riwayat Transaksi - Toko Online</title>
  <meta name="description" content="Lihat riwayat transaksi dan pesanan Anda" />
</svelte:head>

{#if loading}
  <div class="loading-page">
    <div class="loading-spinner large"></div>
    <p>Memuat riwayat transaksi...</p>
  </div>
{:else if errorMessage && !user}
  <!-- Show auth error with retry option -->
  <div class="auth-error-page">
    <div class="error-container">
      <h2>⚠️ Masalah Autentikasi</h2>
      <p>{errorMessage}</p>
      <div class="error-actions">
        <button class="btn btn-primary" on:click={retryAuth}>
          Coba Lagi
        </button>
        <button class="btn btn-secondary" on:click={() => goto('/login')}>
          Login Ulang
        </button>
      </div>
    </div>
  </div>
{:else}
  <div class="transactions-container">
    <!-- Header -->
    <TransactionHeader
      {summary}
      {loading}
      onRefresh={handleRefresh}
      onGoToCheckout={goToCheckout}
      {formatPrice}
    />

    <!-- Error/Success Messages -->
    <AlertMessages
      {errorMessage}
      {successMessage}
      onClearError={handleClearError}
      onClearSuccess={handleClearSuccess}
    />

    <!-- Filters -->
    <TransactionFilters
      bind:filters
      bind:showFilters
      onApplyFilters={applyFilters}
      onResetFilters={resetFilters}
      onSearchInput={handleSearchInput}
    />

    <!-- Transactions List -->
    <TransactionList
      {transactions}
      {loadingAction}
      onViewDetail={viewTransactionDetail}
      onContinuePayment={continuePayment}
      onCancelOrder={handleTransactionAction}
      onReorder={handleTransactionAction}
      onGoToCheckout={goToCheckout}
      {formatPrice}
      {formatDate}
    />

    <!-- Pagination -->
    <TransactionPagination
      {pagination}
      {currentPage}
      {itemsPerPage}
      onChangePage={changePage}
      onChangeItemsPerPage={changeItemsPerPage}
    />

    <!-- Transaction Detail Modal -->
    <TransactionDetailModal
      show={showTransactionDetail}
      transaction={selectedTransaction}
      {loadingAction}
      onClose={closeTransactionDetail}
      onContinuePayment={continuePayment}
      onReorder={handleTransactionAction}
      {formatPrice}
      {formatDate}
    />
  </div>
{/if}
