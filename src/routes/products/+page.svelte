<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { get } from 'svelte/store';
    import { 
      Search, 
      Grid3X3, 
      List, 
      ChevronDown 
    } from 'lucide-svelte';
  
    import ProductCard from '$lib/components/products/product-card.svelte';
    import ProductSkeleton from '$lib/components/products/product-skeleton.svelte';
    import Pagination from '$lib/components/products/pagination.svelte';
    import './products.scss';
  
    export let data;
  
    let products = [];
    let loading = true;
    let searchQuery = '';
    let selectedCategory = '';
    let sortBy = 'newest';
    let viewMode = 'grid';
    let currentPage = 1;
    let totalPages = 1;
    let totalProducts = 0;
  
    let seoTitle = 'Produk Terlengkap & Terpercaya | TokoKita';
    let seoDescription = 'Temukan berbagai produk berkualitas dengan harga terbaik. Gratis ongkir, garansi resmi, dan pembayaran aman.';
  
    const sortOptions = [
      { value: 'newest', label: 'Terbaru' },
      { value: 'price_low', label: 'Harga Terendah' },
      { value: 'price_high', label: 'Harga Tertinggi' },
      { value: 'popular', label: 'Terpopuler' },
      { value: 'rating', label: 'Rating Tertinggi' }
    ];
  
    let pageStore;
  page.subscribe(value => {
    pageStore = value;
  });
  
    onMount(async () => {
      await loadProducts();
      updateSEO();
    });
  
    async function loadProducts() {
      loading = true;
      try {
        const params = new URLSearchParams({
          page: currentPage.toString(),
          perPage: '20',
          withSoldCount: 'true'
        });
  
        if (searchQuery) params.append('q', searchQuery);
        if (selectedCategory) params.append('categoryId', selectedCategory);
        if (sortBy) {
          const [sortField, sortOrder] = getSortParams(sortBy);
          params.append('sortBy', sortField);
          params.append('sortOrder', sortOrder);
        }
  
        const response = await fetch(`/api/products?${params}`);
        const result = await response.json();
  
        if (result.success) {
          products = result.data;
          totalPages = result.pagination.totalPages;
          totalProducts = result.pagination.total;
        }
      } catch (error) {
        console.error('Failed to load products:', error);
      } finally {
        loading = false;
      }
    }
  
    function getSortParams(sortBy) {
      switch (sortBy) {
        case 'price_low': return ['price', 'asc'];
        case 'price_high': return ['price', 'desc'];
        case 'popular': return ['soldCount', 'desc'];
        case 'rating': return ['rating', 'desc'];
        case 'newest': return ['id', 'desc'];
        default: return ['id', 'desc'];
      }
    }
  
    function updateSEO() {
      if (searchQuery) {
        seoTitle = `${searchQuery} | Cari Produk di TokoKita`;
        seoDescription = `Temukan ${searchQuery} terbaik dengan harga murah dan kualitas terjamin. ${totalProducts} produk tersedia.`;
      } else if (selectedCategory) {
        seoTitle = `Kategori ${selectedCategory} | TokoKita`;
        seoDescription = `Koleksi lengkap produk ${selectedCategory} dengan kualitas terbaik dan harga terjangkau.`;
      }
    }
  
    function handleSearch() {
      currentPage = 1;
      loadProducts();
      updateSEO();
  
      const params = new URLSearchParams($pageStore.url.searchParams);
      if (searchQuery) {
        params.set('q', searchQuery);
      } else {
        params.delete('q');
      }
      params.set('page', '1');
      goto(`?${params.toString()}`, { replaceState: true });
    }
  
    function handleSort(event) {
      sortBy = event.target.value;
      currentPage = 1;
      loadProducts();
    }
  
    function handleCategoryFilter(categoryId) {
      selectedCategory = categoryId;
      currentPage = 1;
      loadProducts();
      updateSEO();
    }
  
    function handlePageChange(page) {
      currentPage = page;
      loadProducts();
      window.scrollTo({ top: 0, behavior: 'smooth' });
  
      const params = new URLSearchParams($pageStore.url.searchParams);
      params.set('page', page.toString());
      goto(`?${params.toString()}`, { replaceState: true });
    }
  
    function toggleViewMode() {
      viewMode = viewMode === 'grid' ? 'list' : 'grid';
    }
  
    function addToCart(productId) {
      console.log('Add to cart:', productId);
    }
  
    function addToWishlist(productId) {
      console.log('Add to wishlist:', productId);
    }
  </script>
  
  <svelte:head>
    <title>{seoTitle}</title>
    <meta name="description" content={seoDescription} />
    <meta name="keywords" content="produk, belanja online, toko online, marketplace, Indonesia" />
  
    <meta property="og:title" content={seoTitle} />
    <meta property="og:description" content={seoDescription} />
    <meta property="og:type" content="website" />
  
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "{seoTitle}",
        "description": "{seoDescription}",
        "url": "{$pageStore.url.href}",
        "mainEntity": {
          "@type": "ItemList",
          "numberOfItems": "{totalProducts}",
          "itemListElement": []
        }
      }
    </script>
  </svelte:head>
  
  <div class="products-page">
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <ol>
        <li><a href="/">Beranda</a></li>
        <li aria-current="page">Semua Produk</li>
      </ol>
    </nav>
  
    <div class="products-container">
      <main class="products-main">
        <div class="products-toolbar">
          <div class="toolbar-left">
            <div class="results-info">
              {#if loading}
                <div class="skeleton-text"></div>
              {:else}
                <span>{totalProducts.toLocaleString('id-ID')} produk ditemukan</span>
              {/if}
            </div>
          </div>
  
          <div class="toolbar-right">
            <div class="view-toggle">
              <button
                class="view-btn"
                class:active={viewMode === 'grid'}
                on:click={() => viewMode = 'grid'}
                aria-label="Grid view"
              >
                <Grid3X3 size={18} />
              </button>
              <button
                class="view-btn"
                class:active={viewMode === 'list'}
                on:click={() => viewMode = 'list'}
                aria-label="List view"
              >
                <List size={18} />
              </button>
            </div>
  
            <div class="sort-dropdown">
              <select bind:value={sortBy} on:change={handleSort} aria-label="Urutkan produk">
                {#each sortOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
              <ChevronDown size={16} />
            </div>
          </div>
        </div>
  
        <div class="products-grid" class:list-view={viewMode === 'list'}>
          {#if loading}
            {#each Array(12) as _}
              <ProductSkeleton />
            {/each}
          {:else if products.length > 0}
            {#each products as product (product.id)}
              <ProductCard 
                {product}
                {viewMode}
                on:addToCart={() => addToCart(product.id)}
                on:addToWishlist={() => addToWishlist(product.id)}
              />
            {/each}
          {:else}
            <div class="empty-state">
              <div class="empty-icon">
                <Search size={64} />
              </div>
              <h3>Produk tidak ditemukan</h3>
              <p>Coba ubah kata kunci pencarian atau filter yang dipilih</p>
              <button class="btn-primary" on:click={() => {
                searchQuery = '';
                selectedCategory = '';
                handleSearch();
              }}>
                Lihat Semua Produk
              </button>
            </div>
          {/if}
        </div>
  
        {#if !loading && totalPages > 1}
          <Pagination
            {currentPage}
            {totalPages}
            on:pageChange={(e) => handlePageChange(e.detail)}
          />
        {/if}
      </main>
    </div>
  </div>