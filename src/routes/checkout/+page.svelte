<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { 
    cartStore, 
    cartItems, 
    cartTotal, 
    cartCount, 
    cartLoading,
    formatPrice
  } from '$lib/stores/cart';
  import { 
    ShoppingCart, 
    MapPin, 
    Truck, 
    CreditCard, 
    User, 
    Mail, 
    Phone, 
    Home,
    AlertCircle,
    Loader,
    ArrowLeft,
    Package,
    Search
  } from 'lucide-svelte';
  import { 
    requireAuth, 
    createAuthenticatedFetch,
    handleAuthenticatedResponse
  } from '$lib/auth/utils';
  import './checkout.scss';

  // Authentication
  let user = null;
  let authenticatedFetch = createAuthenticatedFetch();

  // Form data
  let formData = {
    recipientName: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    province: '',
    postalCode: '',
    courierName: '',
    courierService: '',
    courierInsurance: 0,
    deliveryType: 'now',
    orderNote: ''
  };

  // States
  let loading = true;
  let submitting = false;
  let errorMessage = '';
  let successMessage = '';
  let shippingRates = [];
  let loadingShipping = false;
  let selectedShipping = null;
  let shippingCost = 0;
  let totalWithShipping = 0;

  // Area search states
  let areaSearchResults = [];
  let selectedArea = null;
  let searchingArea = false;
  let showAreaSearch = false;

  // Form validation
  let formErrors = {};

  // Request tracking - PERBAIKAN 1: Gunakan WeakRef atau simple tracking
  let currentShippingRequest = null;
  let currentAreaRequest = null;
  let lastAreaSearchKeyword = '';
  let lastShippingPostalCode = '';

  // PERBAIKAN 2: Debounce timers
  let areaSearchTimeout = null;
  let shippingCalculationTimeout = null;

 function getCSRFTokenFromCookie(): string {
    const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
    return match ? match[1] : '';
  }

  onMount(async () => {
    // Check authentication - will redirect if not authenticated
    user = await requireAuth($page.url.pathname);
    
    if (!user) {
      return; // requireAuth will handle the redirect
    }

    // Load cart
    await cartStore.load();
    
    // Check if cart has items
    if ($cartItems.length === 0) {
      goto('/cart');
      return;
    }
    
    // Pre-fill user data
    formData.recipientName = user.name || '';
    formData.email = user.email || '';
    formData.phone = user.phone || '';

    loading = false;
  });

  function validateForm() {
    formErrors = {};
    
    if (!formData.recipientName.trim()) {
      formErrors.recipientName = 'Nama penerima harus diisi';
    }
    
    if (!formData.phone.trim()) {
      formErrors.phone = 'Nomor telepon harus diisi';
    } else if (!/^(\+62|62|0)[0-9]{9,13}$/.test(formData.phone.replace(/\s/g, ''))) {
      formErrors.phone = 'Format nomor telepon tidak valid';
    }
    
    if (!formData.email.trim()) {
      formErrors.email = 'Email harus diisi';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      formErrors.email = 'Format email tidak valid';
    }
    
    if (!formData.address.trim()) {
      formErrors.address = 'Alamat harus diisi';
    }
    
    if (!selectedArea) {
      formErrors.area = 'Pilih area/kota dari pencarian';
    }
    
    if (!formData.postalCode.trim()) {
      formErrors.postalCode = 'Kode pos harus diisi';
    } else if (!/^\d{5}$/.test(formData.postalCode)) {
      formErrors.postalCode = 'Kode pos harus 5 digit angka';
    }
    
    if (!selectedShipping) {
      formErrors.shipping = 'Pilih metode pengiriman';
    }
    
    return Object.keys(formErrors).length === 0;
  }

  // PERBAIKAN 3: Area search dengan proper debouncing dan duplicate prevention
  async function searchAreas(keyword) {
    // Prevent empty or too short searches
    if (!keyword || keyword.length < 2) {
      areaSearchResults = [];
      return;
    }

    // Prevent duplicate searches
    if (keyword === lastAreaSearchKeyword) {
      console.log('🔄 Skipping duplicate area search for:', keyword);
      return;
    }

    lastAreaSearchKeyword = keyword;

    // Cancel any existing area request
    if (currentAreaRequest) {
      console.log('🚫 Cancelling previous area request');
      currentAreaRequest.abort();
      currentAreaRequest = null;
    }

    const controller = new AbortController();
    currentAreaRequest = controller;
    searchingArea = true;

    try {
      console.log('🔍 Searching areas for:', keyword);
      
      const response = await fetch(
        `/api/areas?search=${encodeURIComponent(keyword)}&limit=10`,
        { 
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }
      );

      // Check if request was aborted
      if (controller.signal.aborted) {
        console.log('🚫 Area search aborted');
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Double check abortion before setting results
      if (controller.signal.aborted) {
        return;
      }

      if (data.success) {
        areaSearchResults = data.data || [];
        console.log(`✅ Found ${areaSearchResults.length} areas for "${keyword}"`);
      } else {
        areaSearchResults = [];
        console.log('❌ Area search failed:', data.message);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('❌ Error searching areas:', err);
        areaSearchResults = [];
        errorMessage = 'Gagal mencari area. Silakan coba lagi.';
      }
    } finally {
      // Only update state if request wasn't aborted
      if (controller.signal && !controller.signal.aborted) {
        searchingArea = false;
        currentAreaRequest = null;
      }
    }
  }

  // PERBAIKAN 4: Select area dengan cleanup
  function selectArea(area) {
    console.log('📍 Selecting area:', area.formatted_name);
    
    selectedArea = area;
    formData.city = area.administrative_division_level_2_name || '';
    formData.province = area.administrative_division_level_1_name || '';
    formData.postalCode = area.postal_code || '';
    showAreaSearch = false;
    areaSearchResults = [];
    
    // Reset search tracking
    lastAreaSearchKeyword = '';
    
    // Clear previous shipping data
    shippingRates = [];
    selectedShipping = null;
    shippingCost = 0;
    lastShippingPostalCode = ''; // Reset shipping tracking
    
    // Auto calculate shipping when area is selected
    if (formData.postalCode) {
      debouncedCalculateShipping();
    }
  }

  // PERBAIKAN 5: Debounced shipping calculation
  function debouncedCalculateShipping() {
    if (shippingCalculationTimeout) {
      clearTimeout(shippingCalculationTimeout);
    }
    
    shippingCalculationTimeout = setTimeout(() => {
      calculateShipping();
    }, 500); // 500ms debounce
  }

  // PERBAIKAN 6: Shipping calculation dengan duplicate prevention
  async function calculateShipping() {
    if (!formData.postalCode || formData.postalCode.length !== 5) {
      console.log('❌ Invalid postal code for shipping calculation');
      return;
    }

    // Prevent duplicate calculations
    if (formData.postalCode === lastShippingPostalCode) {
      console.log('🔄 Skipping duplicate shipping calculation for:', formData.postalCode);
      return;
    }

    lastShippingPostalCode = formData.postalCode;

    // Cancel any existing shipping request
    if (currentShippingRequest) {
      console.log('🚫 Cancelling previous shipping request');
      currentShippingRequest.abort();
      currentShippingRequest = null;
    }

    const controller = new AbortController();
    currentShippingRequest = controller;
    
    loadingShipping = true;
    shippingRates = [];
    selectedShipping = null;
    shippingCost = 0;
    errorMessage = '';

    try {
      console.log('🚚 Calculating shipping for postal code:', formData.postalCode);
      
      const items = $cartItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      }));

      const params = new URLSearchParams({
        destinationPostal: formData.postalCode,
        items: JSON.stringify(items)
      });

      const response = await fetch(
        `/api/shipping?${params}&t=${Date.now()}`, // Add timestamp to prevent caching
        { 
          method: 'GET',
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }
      );

      // Check if request was aborted
      if (controller.signal.aborted) {
        console.log('🚫 Shipping calculation aborted');
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Double check abortion before setting results
      if (controller.signal.aborted) {
        return;
      }
      
      if (data.success) {
        shippingRates = data.data || [];
        console.log(`✅ Found ${shippingRates.length} shipping rates for ${formData.postalCode}`);
        
        if (shippingRates.length === 0) {
          errorMessage = 'Tidak ada layanan pengiriman tersedia untuk area ini';
        }
      } else {
        throw new Error(data.message || 'Gagal menghitung ongkos kirim');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('❌ Shipping calculation error:', err);
        errorMessage = err.message || 'Terjadi kesalahan saat menghitung ongkos kirim';
        shippingRates = [];
      }
    } finally {
      // Only update state if request wasn't aborted
      if (controller.signal && !controller.signal.aborted) {
        loadingShipping = false;
        currentShippingRequest = null;
      }
    }
  }

  // PERBAIKAN 7: Postal code verification dengan debouncing
  async function verifyPostalCode() {
    if (!formData.postalCode || formData.postalCode.length !== 5) {
      return;
    }

    try {
      console.log('🔍 Verifying postal code:', formData.postalCode);
      
      const response = await fetch(
        `/api/areas?postal_code=${formData.postalCode}&t=${Date.now()}`,
        {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        selectedArea = data.data;
        formData.city = data.data.administrative_division_level_2_name || formData.city;
        formData.province = data.data.administrative_division_level_1_name || formData.province;
        
        console.log('✅ Postal code verified:', selectedArea.formatted_name);
        // Calculate shipping after verification with debounce
        debouncedCalculateShipping();
      } else {
        errorMessage = 'Kode pos tidak ditemukan atau tidak valid';
        selectedArea = null;
        lastShippingPostalCode = ''; // Reset tracking
      }
    } catch (err) {
      console.error('❌ Error verifying postal code:', err);
      errorMessage = 'Gagal memverifikasi kode pos';
      lastShippingPostalCode = ''; // Reset tracking
    }
  }

function selectShipping(rate) {
    console.log('📦 Selecting shipping:', rate);
    
    // Clear previous selection completely
    selectedShipping = null;
    
    // Set new selection dengan unique identifier
    selectedShipping = {
      ...rate,
      unique_id: `${rate.courier_name}_${rate.courier_service_code}_${rate.price}` // Tambahan unique identifier
    };
    
    formData.courierName = rate.courier_name;
    formData.courierService = rate.courier_service_code;
    shippingCost = rate.price;
    formData.courierInsurance = rate.insurance_fee || 0;
    updateTotal();
    
    console.log('✅ Selected shipping details:', {
      courier: rate.courier_name,
      service: rate.courier_service_name,
      service_code: rate.courier_service_code,
      cost: rate.price,
      unique_id: selectedShipping.unique_id
    });
  }

  // PERBAIKAN: Function untuk check apakah shipping option terpilih
  function isShippingSelected(rate) {
    if (!selectedShipping) return false;
    
    // Gunakan kombinasi unique untuk memastikan hanya satu yang terpilih
    const currentId = `${rate.courier_name}_${rate.courier_service_code}_${rate.price}`;
    const selectedId = selectedShipping.unique_id || `${selectedShipping.courier_name}_${selectedShipping.courier_service_code}_${selectedShipping.price}`;
    
    return currentId === selectedId;
  }

  function updateTotal() {
    totalWithShipping = $cartTotal + shippingCost + (formData.courierInsurance || 0);
  }

  // PERBAIKAN CSRF: Update submit order function dengan CSRF token yang benar
  async function submitOrder() {
    if (submitting) return;
    
    if (!validateForm()) {
      errorMessage = 'Mohon lengkapi semua field yang diperlukan';
      return;
    }

    submitting = true;
    errorMessage = '';

    try {
      console.log('📝 Submitting order...');
      
      // PERBAIKAN: Dapatkan CSRF token dari cookie
      const csrfToken = getCSRFTokenFromCookie();
      
      if (!csrfToken) {
        throw new Error('CSRF token tidak ditemukan. Silakan refresh halaman.');
      }

      const orderData = {
        ...formData,
        useCart: true
      };

      // PERBAIKAN: Gunakan fetch biasa dengan CSRF token dari cookie
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken, // Gunakan header yang sama seperti create produk
        },
        credentials: 'include', // Pastikan cookie dikirim
        body: JSON.stringify(orderData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        successMessage = 'Pesanan berhasil dibuat!';
        console.log('✅ Order created successfully:', data.data.orderNumber);
        
        // Redirect to payment page
        setTimeout(() => {
          if (data.data.payment?.redirect_url) {
            window.location.href = data.data.payment.redirect_url;
          } else {
            goto(`/orders/${data.data.orderId}`);
          }
        }, 1000);
      } else {
        throw new Error(data.message || 'Gagal membuat pesanan');
      }
    } catch (err) {
      console.error('❌ Order submission error:', err);
      errorMessage = err.message || 'Terjadi kesalahan saat membuat pesanan';
    } finally {
      submitting = false;
    }
  }

  // PERBAIKAN 8: Enhanced cleanup function
  function cleanup() {
    console.log('🧹 Cleaning up requests and timers...');
    
    // Cancel ongoing requests
    if (currentShippingRequest) {
      currentShippingRequest.abort();
      currentShippingRequest = null;
    }
    if (currentAreaRequest) {
      currentAreaRequest.abort();
      currentAreaRequest = null;
    }
    
    // Clear timeouts
    if (areaSearchTimeout) {
      clearTimeout(areaSearchTimeout);
      areaSearchTimeout = null;
    }
    if (shippingCalculationTimeout) {
      clearTimeout(shippingCalculationTimeout);
      shippingCalculationTimeout = null;
    }
    
    // Reset tracking variables
    lastAreaSearchKeyword = '';
    lastShippingPostalCode = '';
  }

  // PERBAIKAN 9: Improved reactive statements dengan proper checks
  let previousPostalCode = '';
  $: {
    if (formData.postalCode && 
        formData.postalCode.length === 5 && 
        formData.postalCode !== previousPostalCode) {
      previousPostalCode = formData.postalCode;
      verifyPostalCode();
    }
  }
  $: updateTotal();

  // Cleanup on destroy
  onDestroy(() => {
    cleanup();
  });

  function goBack() {
    cleanup();
    goto('/cart');
  }

  function formatDuration(duration) {
    return duration.replace(/(\d+)-(\d+)/, '$1-$2 hari');
  }

  function getProductImage(item) {
    if (item.images && item.images.length > 0) {
      return item.images[0];
    }
    return '/placeholder-product.jpg';
  }

  // PERBAIKAN 10: Improved city search handler dengan proper debouncing
  function handleCitySearch(event) {
    const keyword = event.target.value.trim();
    
    // Clear existing timeout
    if (areaSearchTimeout) {
      clearTimeout(areaSearchTimeout);
      areaSearchTimeout = null;
    }
    
    if (keyword.length >= 2) {
      showAreaSearch = true;
      // Debounce the search
      areaSearchTimeout = setTimeout(() => {
        searchAreas(keyword);
      }, 300);
    } else {
      showAreaSearch = false;
      areaSearchResults = [];
      lastAreaSearchKeyword = ''; // Reset tracking
      
      // Cancel any ongoing search
      if (currentAreaRequest) {
        currentAreaRequest.abort();
        currentAreaRequest = null;
      }
    }
  }

  // PERBAIKAN 11: Handle click outside untuk menutup search results
  function handleClickOutside(event) {
    const searchContainer = event.target.closest('.search-container');
    if (!searchContainer) {
      showAreaSearch = false;
    }
  }
</script>

<!-- Tambahkan event listener untuk click outside -->
<svelte:window on:click={handleClickOutside} />

<svelte:head>
  <title>Checkout - Toko Online</title>
  <meta name="description" content="Selesaikan pembelian Anda" />
</svelte:head>

{#if loading}
  <div class="loading-page">
    <div class="loading-spinner large"></div>
    <p>Memuat checkout...</p>
  </div>
{:else}
  <div class="checkout-container">
    <!-- Header -->
    <div class="checkout-header">
      <button class="back-button" on:click={goBack}>
        <ArrowLeft size={20} />
        <span>Kembali ke Keranjang</span>
      </button>
      
      <h1 class="checkout-title">
        <ShoppingCart size={24} />
        Checkout
      </h1>
      
      <div class="checkout-progress">
        <div class="progress-step active">
          <div class="step-circle">1</div>
          <span>Keranjang</span>
        </div>
        <div class="progress-line"></div>
        <div class="progress-step active">
          <div class="step-circle">2</div>
          <span>Checkout</span>
        </div>
        <div class="progress-line"></div>
        <div class="progress-step">
          <div class="step-circle">3</div>
          <span>Pembayaran</span>
        </div>
      </div>
    </div>

    <!-- Error/Success Messages -->
    {#if errorMessage}
      <div class="alert alert-error">
        <AlertCircle size={20} />
        <span>{errorMessage}</span>
        <button on:click={() => errorMessage = ''}>×</button>
      </div>
    {/if}

    {#if successMessage}
      <div class="alert alert-success">
        <span>{successMessage}</span>
      </div>
    {/if}

    <div class="checkout-content">
      <div class="checkout-main">
        <!-- Customer Information -->
        <section class="checkout-section">
          <div class="section-header">
            <User size={20} />
            <h2>Informasi Penerima</h2>
          </div>
          
          <div class="form-grid">
            <div class="form-group">
              <label for="recipientName" class="form-label">
                Nama Penerima <span class="required">*</span>
              </label>
              <input
                id="recipientName"
                type="text"
                class="form-input"
                class:error={formErrors.recipientName}
                bind:value={formData.recipientName}
                placeholder="Masukkan nama penerima"
                required
              />
              {#if formErrors.recipientName}
                <span class="form-error">{formErrors.recipientName}</span>
              {/if}
            </div>

            <div class="form-group">
              <label for="phone" class="form-label">
                Nomor Telepon <span class="required">*</span>
              </label>
              <input
                id="phone"
                type="tel"
                class="form-input"
                class:error={formErrors.phone}
                bind:value={formData.phone}
                placeholder="08123456789"
                required
              />
              {#if formErrors.phone}
                <span class="form-error">{formErrors.phone}</span>
              {/if}
            </div>

            <div class="form-group full-width">
              <label for="email" class="form-label">
                Email <span class="required">*</span>
              </label>
              <input
                id="email"
                type="email"
                class="form-input"
                class:error={formErrors.email}
                bind:value={formData.email}
                placeholder="nama@email.com"
                required
              />
              {#if formErrors.email}
                <span class="form-error">{formErrors.email}</span>
              {/if}
            </div>
          </div>
        </section>

        <!-- Shipping Address -->
        <section class="checkout-section">
          <div class="section-header">
            <MapPin size={20} />
            <h2>Alamat Pengiriman</h2>
          </div>
          
          <div class="form-grid">
            <div class="form-group full-width">
              <label for="address" class="form-label">
                Alamat Lengkap <span class="required">*</span>
              </label>
              <textarea
                id="address"
                class="form-textarea"
                class:error={formErrors.address}
                bind:value={formData.address}
                placeholder="Jl. Contoh No. 123, RT/RW 01/02"
                rows="3"
                required
              ></textarea>
              {#if formErrors.address}
                <span class="form-error">{formErrors.address}</span>
              {/if}
            </div>

            <!-- City Search with Autocomplete -->
            <div class="form-group full-width">
              <label for="citySearch" class="form-label">
                Cari Kota/Kabupaten <span class="required">*</span>
              </label>
              <div class="search-container">
                <input
                  id="citySearch"
                  type="text"
                  class="form-input"
                  class:error={formErrors.area}
                  placeholder="Ketik nama kota/kabupaten..."
                  on:input={handleCitySearch}
                  on:focus={() => showAreaSearch = true}
                />
                <Search size={20} class="search-icon" />
                
                {#if showAreaSearch && (searchingArea || areaSearchResults.length > 0)}
                  <div class="search-results">
                    {#if searchingArea}
                      <div class="search-result searching">
                        <Loader size={16} class="spinning" />
                        <span>Mencari...</span>
                      </div>
                    {:else}
                      {#each areaSearchResults as area}
                        <div 
                          class="search-result"
                          on:click={() => selectArea(area)}
                          role="button"
                          tabindex="0"
                        >
                          <div class="area-name">{area.formatted_name}</div>
                          <div class="area-postal">Kode Pos: {area.postal_code}</div>
                        </div>
                      {/each}
                    {/if}
                  </div>
                {/if}
              </div>
              {#if formErrors.area}
                <span class="form-error">{formErrors.area}</span>
              {/if}
            </div>

            {#if selectedArea}
              <div class="form-group">
                <label class="form-label">Kota/Kabupaten</label>
                <input
                  type="text"
                  class="form-input"
                  bind:value={formData.city}
                  readonly
                />
              </div>

              <div class="form-group">
                <label class="form-label">Provinsi</label>
                <input
                  type="text"
                  class="form-input"
                  bind:value={formData.province}
                  readonly
                />
              </div>

              <div class="form-group">
                <label for="postalCode" class="form-label">
                  Kode Pos <span class="required">*</span>
                </label>
                <input
                  id="postalCode"
                  type="text"
                  class="form-input"
                  class:error={formErrors.postalCode}
                  bind:value={formData.postalCode}
                  placeholder="12345"
                  maxlength="5"
                  readonly
                />
                {#if formErrors.postalCode}
                  <span class="form-error">{formErrors.postalCode}</span>
                {/if}
              </div>
            {/if}
          </div>
        </section>

        <!-- Shipping Method -->
        <section class="checkout-section">
          <div class="section-header">
            <Truck size={20} />
            <h2>Metode Pengiriman</h2>
          </div>
          
          {#if !selectedArea}
            <div class="shipping-placeholder">
              <p>Pilih area pengiriman terlebih dahulu untuk melihat opsi pengiriman</p>
            </div>
          {:else if loadingShipping}
            <div class="shipping-loading">
              <Loader size={20} class="spinning" />
              <span>Menghitung ongkos kirim...</span>
            </div>
          {:else if shippingRates.length > 0}
            <div class="shipping-options">
              {#each shippingRates as rate, index}
                <div 
                  class="shipping-option"
                  class:selected={isShippingSelected(rate)}
                  on:click={() => selectShipping(rate)}
                  on:keydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectShipping(rate);
                    }
                  }}
                  role="button"
                  tabindex="0"
                  data-courier="{rate.courier_name}"
                  data-service="{rate.courier_service_code}"
                  data-price="{rate.price}"
                  data-index="{index}"
                >
                  <div class="shipping-info">
                    <div class="courier-header">
                      <h4 class="courier-name">
                        {rate.courier_name.toUpperCase()}
                      </h4>
                      <span class="service-name">
                        {rate.courier_service_name}
                      </span>
                    </div>
                    <p class="shipping-description">{rate.description}</p>
                    <div class="shipping-details">
                      <span class="duration">
                        <Package size={14} />
                        {formatDuration(rate.duration)}
                      </span>
                      {#if rate.insurance_fee}
                        <span class="insurance">
                          Asuransi: {formatPrice(rate.insurance_fee)}
                        </span>
                      {/if}
                    </div>
                  </div>
                  <div class="shipping-price">
                    {formatPrice(rate.price)}
                  </div>
                </div>
              {/each}
            </div>
            {#if formErrors.shipping}
              <span class="form-error">{formErrors.shipping}</span>
            {/if}
          {:else}
            <div class="no-shipping">
              <AlertCircle size={24} />
              <p>Tidak ada layanan pengiriman tersedia untuk area ini</p>
            </div>
          {/if}
        </section>

        <!-- Order Notes -->
        <section class="checkout-section">
          <div class="section-header">
            <h2>Catatan Pesanan (Opsional)</h2>
          </div>
          
          <div class="form-group">
            <textarea
              class="form-textarea"
              bind:value={formData.orderNote}
              placeholder="Tambahkan catatan untuk pesanan Anda..."
              rows="3"
            ></textarea>
          </div>
        </section>
      </div>

      <!-- Order Summary Sidebar -->
      <div class="order-summary">
        <div class="summary-header">
          <h3>Ringkasan Pesanan</h3>
        </div>

        <div class="summary-items">
          {#each $cartItems as item}
            <div class="summary-item">
              <div class="item-image">
                <img 
                  src={getProductImage(item)} 
                  alt={item.name}
                  on:error={(e) => {
                    e.target.src = '/placeholder-product.jpg';
                  }}
                />
              </div>
              <div class="item-details">
                <h4 class="item-name">{item.name}</h4>
                <div class="item-quantity">Qty: {item.quantity}</div>
                <div class="item-price">{formatPrice(item.totalPrice)}</div>
              </div>
            </div>
          {/each}
        </div>

        <div class="summary-calculations">
          <div class="calculation-row">
            <span>Subtotal ({$cartCount} item):</span>
            <span>{formatPrice($cartTotal)}</span>
          </div>
          
          {#if shippingCost > 0}
            <div class="calculation-row">
              <span>Ongkos Kirim:</span>
              <span>{formatPrice(shippingCost)}</span>
            </div>
          {/if}
          
          {#if formData.courierInsurance > 0}
            <div class="calculation-row">
              <span>Asuransi:</span>
              <span>{formatPrice(formData.courierInsurance)}</span>
            </div>
          {/if}
          
          <div class="calculation-divider"></div>
          
          <div class="calculation-row total">
            <span>Total:</span>
            <span>{formatPrice(totalWithShipping)}</span>
          </div>
        </div>

        <button 
          class="checkout-button"
          disabled={submitting || !selectedShipping || Object.keys(formErrors).length > 0}
          on:click={submitOrder}
        >
          {#if submitting}
            <Loader size={20} class="spinning" />
            Memproses Pesanan...
          {:else}
            <CreditCard size={20} />
            Bayar Sekarang
          {/if}
        </button>

        <div class="payment-info">
          <p>Dengan melanjutkan, Anda menyetujui syarat dan ketentuan kami</p>
        </div>
      </div>
    </div>
  </div>
{/if}