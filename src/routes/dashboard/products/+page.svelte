<script lang="ts">
  import './products-page.scss';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  let products = [];
  let categories = [];
  let search = '';
  let pageNum = 1;
  let perPage = 10;
  let total = 0;
  let loading = false;
  let errorMessage = '';
  let selectedCategory = '';

  // Helper function to get category name
  function getCategoryName(categoryId) {
    if (!categoryId) return '-';
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : `ID: ${categoryId}`;
  }

  // Format price in IDR
  function formatPrice(price) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  }

  async function loadCategories() {
    try {
      const res = await fetch('/api/categories?perPage=1000');
      if (res.ok) {
        const data = await res.json();
        categories = data.data || [];
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }

  async function loadProducts() {
    loading = true;
    errorMessage = '';
    try {
      const query = new URLSearchParams({
        q: search,
        page: pageNum.toString(),
        perPage: perPage.toString()
      });

      if (selectedCategory) {
        query.append('categoryId', selectedCategory);
      }

      const res = await fetch(`/api/products?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        products = data.data || [];
        total = data.total || 0;
      } else {
        errorMessage = 'Gagal mengambil data produk.';
        products = [];
        total = 0;
      }
    } catch (err) {
      errorMessage = 'Terjadi kesalahan saat mengambil produk.';
      console.error(err);
      products = [];
      total = 0;
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    await loadCategories();
    await loadProducts();
  });

  function handleSearch() {
    pageNum = 1;
    loadProducts();
  }

  function handleCategoryFilter() {
    pageNum = 1;
    loadProducts();
  }

  function getCSRFTokenFromCookie(): string {
    const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
    return match ? match[1] : '';
  }

  async function handleDelete(productId: number) {
    if (!confirm('Yakin hapus produk ini?')) return;

    const csrfToken = getCSRFTokenFromCookie();

    const res = await fetch(`/api/products?id=${productId}`, {
      method: 'DELETE',
      headers: {
        'x-csrf-token': csrfToken
      },
      credentials: 'include'
    });

    if (res.ok) {
      await loadProducts();
    } else {
      const err = await res.json();
      alert(err.message || 'Gagal menghapus produk');
    }
  }

  function totalPages() {
    return Math.ceil(total / perPage);
  }

  function changePage(delta: number) {
    pageNum += delta;
    loadProducts();
  }

  function goToPage(page: number) {
    pageNum = page;
    loadProducts();
  }
</script>

<section class="products-page">
  <div class="container">
    <!-- Header Section -->
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">Manajemen Produk</h1>
        <p class="page-subtitle">Kelola semua produk dalam toko Anda dengan mudah</p>
      </div>
      <button class="btn-primary" on:click={() => goto('/dashboard/products/create')}>
        <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
        </svg>
        Tambah Produk
      </button>
    </div>

    <!-- Search and Filter Section -->
    <div class="search-section">
      <form class="search-form" on:submit|preventDefault={handleSearch}>
        <div class="search-input-wrapper">
          <svg class="search-icon" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
          </svg>
          <input 
            bind:value={search} 
            placeholder="Cari nama produk..." 
            class="search-input"
          />
        </div>
        <button type="submit" class="btn-search" disabled={loading}>
          {loading ? 'Mencari...' : 'Cari'}
        </button>
      </form>
    </div>

    <!-- Content Section -->
    <div class="content-section">
      {#if loading}
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>Memuat data produk...</p>
        </div>
      {:else if errorMessage}
        <div class="error-state">
          <svg width="48" height="48" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
          </svg>
          <p class="error-message">{errorMessage}</p>
          <button class="btn-retry" on:click={loadProducts}>Coba Lagi</button>
        </div>
      {:else if products.length === 0}
        <div class="empty-state">
          <svg width="64" height="64" fill="currentColor" viewBox="0 0 16 16">
            <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
          </svg>
          <h3>Belum ada produk</h3>
          <p>Mulai dengan menambahkan produk pertama untuk mulai berjualan</p>
        </div>
      {:else}
        <!-- Desktop Table -->
        <div class="table-container">
          <table class="products-table">
            <thead>
              <tr>
                <th>Produk</th>
                <th>Kategori</th>
                <th>Harga</th>
                <th>Stok</th>
                <th>Gambar</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {#each products as product}
                <tr class="table-row">
                  <td class="product-name">
                    <div class="product-info">
                      <span class="name">{product.name}</span>
                      <small class="slug"><code>{product.slug}</code></small>
                      {#if product.description}
                        <p class="description">{product.description.substring(0, 100)}...</p>
                      {/if}
                    </div>
                  </td>
                  <td class="category">
                    <span class="category-badge">
                      {getCategoryName(product.categoryId)}
                    </span>
                  </td>
                  <td class="price">
                    <span class="price-value">{formatPrice(product.price)}</span>
                  </td>
                  <td class="stock">
                    <span class="stock-badge" class:low-stock={product.stock < 10}>
                      {product.stock}
                    </span>
                  </td>
                  <td class="image">
                    {#if product.images && product.images.length > 0}
                      <div class="image-wrapper">
                        <img src={product.images[0]} alt={product.name} />
                        {#if product.images.length > 1}
                          <span class="image-count">+{product.images.length - 1}</span>
                        {/if}
                      </div>
                    {:else}
                      <div class="no-image">
                        <svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/>
                          <path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z"/>
                        </svg>
                      </div>
                    {/if}
                  </td>
                  <td class="actions">
                    <div class="action-buttons">
                      <button 
                        class="btn-edit" 
                        on:click={() => goto(`/dashboard/products/edit/${product.slug}`)}
                        title="Edit produk"
                      >
                        <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708L4.707 14.707a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168L12.146.146z"/>
                        </svg>
                        Edit
                      </button>
                      <button 
                        class="btn-delete" 
                        on:click={() => handleDelete(product.id)}
                        title="Hapus produk"
                      >
                        <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1H2.5zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5zM8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5zm3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0z"/>
                        </svg>
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Mobile Cards -->
        <div class="mobile-cards">
          {#each products as product}
            <div class="product-card">
              <div class="card-header">
                <div class="product-main">
                  {#if product.images && product.images.length > 0}
                    <div class="product-image">
                      <img src={product.images[0]} alt={product.name} />
                      {#if product.images.length > 1}
                        <span class="image-count">+{product.images.length - 1}</span>
                      {/if}
                    </div>
                  {:else}
                    <div class="product-placeholder">
                      <svg width="32" height="32" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/>
                        <path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z"/>
                      </svg>
                    </div>
                  {/if}
                  <div class="product-details">
                    <h4 class="product-name">{product.name}</h4>
                    <p class="product-slug"><code>{product.slug}</code></p>
                    <p class="product-category">
                      Kategori: <span class="category-name">{getCategoryName(product.categoryId)}</span>
                    </p>
                    <div class="product-meta">
                      <span class="price">{formatPrice(product.price)}</span>
                      <span class="stock" class:low-stock={product.stock < 10}>
                        Stok: {product.stock}
                      </span>
                    </div>
                    {#if product.description}
                      <p class="product-description">{product.description.substring(0, 80)}...</p>
                    {/if}
                  </div>
                </div>
                <div class="card-actions">
                  <button 
                    class="btn-edit-mobile" 
                    on:click={() => goto(`/dashboard/products/edit/${product.slug}`)}
                    title="Edit produk"
                  >
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708L4.707 14.707a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168L12.146.146z"/>
                    </svg>
                  </button>
                  <button 
                    class="btn-delete-mobile" 
                    on:click={() => handleDelete(product.id)}
                    title="Hapus produk"
                  >
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1H2.5z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          {/each}
        </div>

        <!-- Pagination -->
        {#if totalPages() > 1}
          <div class="pagination">
            <button 
              class="btn-pagination btn-prev" 
              on:click={() => changePage(-1)} 
              disabled={pageNum === 1}
              title="Halaman sebelumnya"
            >
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                <path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
              </svg>
              <span class="btn-text">Prev</span>
            </button>
            
            <div class="pagination-numbers">
              {#if totalPages() <= 5}
                {#each Array(totalPages()).fill(0) as _, i}
                  <button 
                    class="btn-page {pageNum === i + 1 ? 'active' : ''}"
                    on:click={() => goToPage(i + 1)}
                  >
                    {i + 1}
                  </button>
                {/each}
              {:else}
                {#if pageNum <= 3}
                  {#each [1, 2, 3, 4] as page}
                    <button 
                      class="btn-page {pageNum === page ? 'active' : ''}"
                      on:click={() => goToPage(page)}
                    >
                      {page}
                    </button>
                  {/each}
                  <span class="pagination-dots">...</span>
                  <button class="btn-page" on:click={() => goToPage(totalPages())}>
                    {totalPages()}
                  </button>
                {:else if pageNum >= totalPages() - 2}
                  <button class="btn-page" on:click={() => goToPage(1)}>1</button>
                  <span class="pagination-dots">...</span>
                  {#each [totalPages() - 3, totalPages() - 2, totalPages() - 1, totalPages()] as page}
                    <button 
                      class="btn-page {pageNum === page ? 'active' : ''}"
                      on:click={() => goToPage(page)}
                    >
                      {page}
                    </button>
                  {/each}
                {:else}
                  <button class="btn-page" on:click={() => goToPage(1)}>1</button>
                  <span class="pagination-dots">...</span>
                  {#each [pageNum - 1, pageNum, pageNum + 1] as page}
                    <button 
                      class="btn-page {pageNum === page ? 'active' : ''}"
                      on:click={() => goToPage(page)}
                    >
                      {page}
                    </button>
                  {/each}
                  <span class="pagination-dots">...</span>
                  <button class="btn-page" on:click={() => goToPage(totalPages())}>
                    {totalPages()}
                  </button>
                {/if}
              {/if}
            </div>

            <button 
              class="btn-pagination btn-next" 
              on:click={() => changePage(1)} 
              disabled={pageNum === totalPages()}
              title="Halaman berikutnya"
            >
              <span class="btn-text">Next</span>
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                <path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
              </svg>
            </button>

            <div class="mobile-pagination-info">
              <span class="current-page">{pageNum}</span>
              <span class="separator">dari</span>
              <span class="total-pages">{totalPages()}</span>
            </div>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</section>