<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { slide } from 'svelte/transition';
  import { 
    ChevronDown,
    Truck,
    Shield,
    Zap,
    Package,
    Eye,
    CheckCircle,
    Monitor,
    ShoppingCart,
    ShoppingBag
  } from 'lucide-svelte';
  import './home.scss';

  interface Category {
    id: number;
    name: string;
    slug: string;
    parentId: number | null;
    image: string;
    children?: Category[];
    showChildren?: boolean;
  }

  interface Product {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    price: number;
    stock: number;
    categoryId: number;
    images: string[];
    height?: number | null;
    length?: number | null;
    weight?: number | null;
    width?: number | null;
    soldCount?: number; // Jumlah terjual dari order
  }

  let categories: Category[] = [];
  let products: Product[] = [];
  let isLoadingProducts = false;
  let isLoadingCategories = false;

  function formatPrice(price: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  }

  function formatSoldCount(soldCount: number): string {
    if (soldCount >= 1000) {
      return Math.floor(soldCount / 1000) + 'rb+';
    }
    return soldCount.toString();
  }

  // Ambil kategori parent
  onMount(async () => {
    isLoadingCategories = true;
    try {
      const res = await fetch('/api/categories/parent');
      const json = await res.json();
      categories = json.data;
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      isLoadingCategories = false;
    }

    // Load products with sold count
    await loadProducts();
  });

  // Load products from API with sold count from orders
  async function loadProducts() {
    isLoadingProducts = true;
    try {
      const res = await fetch('/api/products?perPage=12&withSoldCount=true');
      const json = await res.json();
      products = json.data || [];
    } catch (error) {
      console.error('Error fetching products:', error);
      products = [];
    } finally {
      isLoadingProducts = false;
    }
  }

  // Toggle anak kategori dengan reactivity fix
  async function toggleChildren(category: Category) {
    const index = categories.findIndex(cat => cat.id === category.id);
    const current = categories[index];

    // Toggle showChildren
    categories[index] = { ...current, showChildren: !current.showChildren };

    // Jika belum fetch children, ambil dari server
    if (categories[index].showChildren && !categories[index].children) {
      try {
        const res = await fetch(`/api/categories/${category.slug}/children`);
        const json = await res.json();
        categories[index] = { ...categories[index], children: json.data };
        await tick();
      } catch (error) {
        console.error('Error fetching child categories:', error);
        categories[index] = { ...categories[index], children: [] };
      }
    }
  }

  function getProductImage(product: Product): string {
    return product.images && product.images.length > 0 
      ? product.images[0] 
      : 'https://via.placeholder.com/300x300?text=No+Image';
  }

  function handleProductClick(product: Product) {
    // Navigate to product detail
    window.location.href = `/products/${product.slug}`;
  }

  function handleAddToCart(event: Event, product: Product) {
    event.stopPropagation();
    // Add to cart logic
    console.log('Adding to cart:', product.name);
  }

  // Handle child category click with proper parent reference
  function handleChildClick(parent: Category, child: Category) {
    window.location.href = `/categories/${parent.slug}/${child.slug}`;
  }

  // Handle keyboard events for accessibility
  function handleChildKeydown(event: KeyboardEvent, parent: Category, child: Category) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleChildClick(parent, child);
    }
  }

  function handleProductKeydown(event: KeyboardEvent, product: Product) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleProductClick(product);
    }
  }
</script>

<svelte:head>
  <title>Home - ShopApp</title>
  <meta name="description" content="Belanja online mudah dan terpercaya. Temukan jutaan produk dengan harga terbaik." />
</svelte:head>

<div class="home-page">
  <!-- Hero Banner -->
  <section class="hero-banner">
    <div class="hero-content">
      <div class="hero-text">
        <h1>Belanja Apapun Jadi Mudah</h1>
        <p>Temukan jutaan produk dengan harga terbaik dan pengiriman cepat</p>
        <div class="hero-features">
          <div class="feature-item">
            <div class="feature-icon">
              <Truck size={20} />
            </div>
            <span>Gratis Ongkir</span>
          </div>
          <div class="feature-item">
            <div class="feature-icon">
              <Shield size={20} />
            </div>
            <span>Garansi 100%</span>
          </div>
          <div class="feature-item">
            <div class="feature-icon">
              <Zap size={20} />
            </div>
            <span>Pengiriman Cepat</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Kategori Section -->
  <section class="kategori-section">
    <div class="container">
      <div class="section-header">
        <h2>Kategori Populer</h2>
        <p class="section-subtitle">Jelajahi berbagai kategori produk terlengkap</p>
      </div>
      
      {#if isLoadingCategories}
        <div class="category-loading">
          {#each Array(5) as _}
            <div class="category-skeleton">
              <div class="skeleton-header">
                <div class="skeleton-icon"></div>
                <div class="skeleton-text"></div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="category-accordion">
          {#each categories as category}
            <div class="category-item">
              <button
                type="button"
                class="category-header"
                on:click={() => toggleChildren(category)}
                aria-expanded={category.showChildren}
              >
                <div class="category-info">
                  <div class="category-icon">
                    <img src={category.image} alt={category.name} loading="lazy" />
                  </div>
                  <span class="category-name">{category.name}</span>
                </div>
                <ChevronDown 
                  size={20}
                  class="chevron {category.showChildren ? 'rotated' : ''}"
                />
              </button>

              {#if category.showChildren}
                <div class="category-children" transition:slide={{ duration: 300 }}>
                  {#if (category.children ?? []).length === 0}
                    <div class="empty-children">
                      <div class="empty-icon">
                        <Package size={32} />
                      </div>
                      <p>Tidak ada subkategori</p>
                    </div>
                  {:else}
                    <div class="children-grid">
                      {#each category.children ?? [] as child}
                        <div 
                          class="child-item" 
                          role="button"
                          tabindex="0"
                          on:click={() => handleChildClick(category, child)}
                          on:keydown={(e) => handleChildKeydown(e, category, child)}
                          aria-label="Kategori {child.name}"
                        >
                          <div class="child-icon">
                            <img src={child.image} alt={child.name} loading="lazy" />
                          </div>
                          <span class="child-name">{child.name}</span>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </section>

  <!-- Products Section -->
  <section class="products-section">
    <div class="container">
      <div class="section-header">
        <h2>Rekomendasi Untuk Anda</h2>
        <p class="section-subtitle">Produk pilihan terbaik dengan kualitas terjamin</p>
      </div>

      {#if isLoadingProducts}
        <div class="loading-products">
          <div class="product-grid">
            {#each Array(12) as _}
              <div class="product-skeleton">
                <div class="skeleton-image"></div>
                <div class="skeleton-content">
                  <div class="skeleton-line"></div>
                  <div class="skeleton-line short"></div>
                  <div class="skeleton-price"></div>
                  <div class="skeleton-meta"></div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {:else}
        <div class="product-grid">
          {#each products as product (product.id)}
            <div 
              class="product-card" 
              role="button"
              tabindex="0"
              on:click={() => handleProductClick(product)}
              on:keydown={(e) => handleProductKeydown(e, product)}
              aria-label="Produk {product.name}"
            >
              <div class="product-image">
                <img src={getProductImage(product)} alt={product.name} loading="lazy" />
                {#if product.stock < 10 && product.stock > 0}
                  <div class="stock-badge low">Stok {product.stock}</div>
                {:else if product.stock === 0}
                  <div class="stock-badge out">Habis</div>
                {/if}
                
                <div class="product-overlay">
                  <button 
                    class="quick-view-btn"
                    on:click|stopPropagation={() => console.log('Quick view:', product.name)}
                  >
                    <Eye size={16} />
                    Lihat Detail
                  </button>
                </div>
              </div>
              
              <div class="product-info">
                <h3 class="product-name">{product.name}</h3>
                <div class="product-price">{formatPrice(product.price)}</div>
                
                <div class="product-meta">
                  {#if product.soldCount && product.soldCount > 0}
                    <div class="product-sold">
                      <CheckCircle size={12} />
                      <span>Terjual {formatSoldCount(product.soldCount)}</span>
                    </div>
                  {/if}
                  
                  <div class="product-stock">
                    <Monitor size={12} />
                    <span>Stok {product.stock}</span>
                  </div>
                </div>

                <button 
                  class="add-to-cart" 
                  class:disabled={product.stock === 0}
                  on:click={(e) => handleAddToCart(e, product)}
                  disabled={product.stock === 0}
                  aria-label={product.stock === 0 ? 'Stok habis' : `Tambah ${product.name} ke keranjang`}
                >
                  <ShoppingCart size={16} />
                  {product.stock === 0 ? 'Habis' : 'Tambah'}
                </button>
              </div>
            </div>
          {/each}
        </div>

        {#if products.length === 0}
          <div class="empty-products">
            <div class="empty-icon">
              <ShoppingBag size={64} />
            </div>
            <h3>Belum ada produk tersedia</h3>
            <p>Produk akan segera hadir, pantau terus halaman ini!</p>
          </div>
        {/if}
      {/if}
    </div>
  </section>

  <!-- Load More Button -->
  {#if products.length > 0 && !isLoadingProducts}
    <section class="load-more-section">
      <div class="container">
        <button class="load-more-btn" on:click={loadProducts}>
          Muat Lebih Banyak Produk
        </button>
      </div>
    </section>
  {/if}
</div>