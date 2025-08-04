<script>
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { 
    ShoppingCart, 
    Heart, 
    Share2, 
    Star, 
    Truck, 
    Shield, 
    ArrowLeft,
    Plus,
    Minus,
    MapPin
  } from 'lucide-svelte';
  import { goto } from '$app/navigation';

  export let data;

  let product = data?.product;
  let quantity = 1;
  let selectedImageIndex = 0;
  let loading = !product; // Show skeleton if no product data initially
  let addingToCart = false;
  let isWishlisted = false;

  // Simulate loading delay for demonstration
  onMount(async () => {
    if (!product) {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // This would normally come from your API
      product = data?.product || {
        id: 1,
        name: "Sample Product Name",
        description: "This is a sample product description...",
        price: 299000,
        originalPrice: 399000,
        images: ['/placeholder-product.jpg'],
        stock: 10,
        rating: 4.5,
        reviewCount: 123,
        soldCount: 1500,
        isOfficial: true,
        location: "Jakarta",
        weight: 500,
        height: 10,
        length: 15,
        width: 8
      };
      loading = false;
    }
  });

  function formatPrice(price) {
    return new Intl.NumberFormat('id-ID', { 
      style: 'currency', 
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(price);
  }

  function formatSoldCount(count) {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}jt`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}rb`;
    }
    return count?.toString() || '0';
  }

  function calculateDiscountPercentage(original, current) {
    if (!original || original <= current) return 0;
    return Math.round(((original - current) / original) * 100);
  }

  function increaseQuantity() {
    if (quantity < product.stock) {
      quantity++;
    }
  }

  function decreaseQuantity() {
    if (quantity > 1) {
      quantity--;
    }
  }

  function selectImage(index) {
    selectedImageIndex = index;
  }

  async function addToCart() {
    if (addingToCart || !product) return;
    
    addingToCart = true;
    try {
      // Import cart store dynamically to avoid SSR issues
      const { cartStore } = await import('$lib/stores/cart');
      const result = await cartStore.addItem(product.id, quantity);
      
      if (result?.success) {
        // Show success message (you can replace with a toast notification)
        alert(result.message || `${product.name} berhasil ditambahkan ke keranjang!`);
      } else {
        alert(result?.message || 'Gagal menambahkan ke keranjang');
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('Gagal menambahkan ke keranjang');
    } finally {
      addingToCart = false;
    }
  }

  async function toggleWishlist() {
    try {
      isWishlisted = !isWishlisted;
      console.log('Wishlist toggled:', isWishlisted);
    } catch (error) {
      console.error('Error toggling wishlist:', error);
    }
  }

  function shareProduct() {
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: product.description,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link produk disalin ke clipboard!');
    }
  }

  function goBack() {
    history.back();
  }

  $: discountPercentage = product ? calculateDiscountPercentage(product.originalPrice, product.price) : 0;
  $: isOutOfStock = product ? product.stock <= 0 : false;
  $: maxQuantity = product ? Math.min(product.stock, 10) : 1;
</script>

<svelte:head>
  <title>{product?.name || 'Loading...'} - Toko Online</title>
  <meta name="description" content={product?.description || 'Loading product details...'} />
</svelte:head>

<div class="product-detail-container">
  <!-- Header -->
  <div class="product-header">
    {#if loading}
      <div class="skeleton skeleton-header-back"></div>
      <div class="header-actions">
        <div class="skeleton skeleton-action-btn"></div>
        <div class="skeleton skeleton-action-btn"></div>
      </div>
    {:else}
      <button class="back-button" on:click={goBack}>
        <ArrowLeft size={20} />
        <span>Kembali</span>
      </button>
      
      <div class="header-actions">
        <button class="action-btn" on:click={shareProduct}>
          <Share2 size={20} />
        </button>
        <button 
          class="action-btn wishlist-btn" 
          class:active={isWishlisted}
          on:click={toggleWishlist}
        >
          <Heart size={20} fill={isWishlisted ? 'currentColor' : 'none'} />
        </button>
      </div>
    {/if}
  </div>

  <div class="product-content">
    <!-- Product Images -->
    <div class="product-images">
      {#if loading}
        <div class="skeleton skeleton-main-image"></div>
        <div class="image-thumbnails">
          {#each Array(4) as _, index}
            <div class="skeleton skeleton-thumbnail"></div>
          {/each}
        </div>
      {:else}
        <div class="main-image">
          <img 
            src={product.images?.[selectedImageIndex] || '/placeholder-product.jpg'} 
            alt={product.name}
          />
          
          {#if discountPercentage > 0}
            <div class="discount-badge">
              -{discountPercentage}%
            </div>
          {/if}
        </div>
        
        {#if product.images && product.images.length > 1}
          <div class="image-thumbnails">
            {#each product.images as image, index}
              <button 
                class="thumbnail" 
                class:active={selectedImageIndex === index}
                on:click={() => selectImage(index)}
              >
                <img src={image} alt={`${product.name} ${index + 1}`} />
              </button>
            {/each}
          </div>
        {/if}
      {/if}
    </div>

    <!-- Product Info -->
    <div class="product-info">
      {#if loading}
        <!-- Skeleton for product info -->
        <div class="skeleton skeleton-badge"></div>
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-title-short"></div>
        
        <div class="skeleton-meta">
          <div class="skeleton skeleton-text-short"></div>
          <div class="skeleton skeleton-text-short"></div>
        </div>

        <div class="skeleton-price">
          <div class="skeleton skeleton-price-original"></div>
          <div class="skeleton skeleton-price-current"></div>
        </div>

        <div class="skeleton-description">
          <div class="skeleton skeleton-subtitle"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text-short"></div>
        </div>

        <div class="skeleton-specs">
          <div class="skeleton skeleton-subtitle"></div>
          <div class="skeleton-spec-grid">
            {#each Array(4) as _, index}
              <div class="skeleton skeleton-spec-item"></div>
            {/each}
          </div>
        </div>

        <div class="skeleton-stock">
          <div class="skeleton skeleton-text-short"></div>
          <div class="skeleton skeleton-quantity-selector"></div>
        </div>

        <div class="skeleton skeleton-shipping"></div>

        <div class="skeleton-buttons">
          <div class="skeleton skeleton-button"></div>
          <div class="skeleton skeleton-button"></div>
        </div>
      {:else}
        <div class="product-badges">
          {#if product.isOfficial}
            <div class="official-badge">
              <Shield size={12} />
              Official Store
            </div>
          {/if}
        </div>

        <h1 class="product-title">{product.name}</h1>
        
        <div class="product-meta">
          <div class="sold-info">
            <span class="sold-count">{formatSoldCount(product.soldCount || 0)} terjual</span>
            {#if product.rating}
              <div class="rating">
                <Star size={14} fill="currentColor" />
                <span>{product.rating.toFixed(1)}</span>
                {#if product.reviewCount}
                  <span class="review-count">({product.reviewCount} ulasan)</span>
                {/if}
              </div>
            {/if}
          </div>
        </div>

        <div class="price-section">
          {#if product.originalPrice && product.originalPrice > product.price}
            <div class="original-price">{formatPrice(product.originalPrice)}</div>
          {/if}
          <div class="current-price">{formatPrice(product.price)}</div>
        </div>

        {#if product.description}
          <div class="description">
            <h3>Deskripsi Produk</h3>
            <p>{product.description}</p>
          </div>
        {/if}

        <!-- Product Specifications -->
        {#if product.weight || product.height || product.length || product.width}
          <div class="specifications">
            <h3>Spesifikasi</h3>
            <div class="spec-grid">
              {#if product.weight}
                <div class="spec-item">
                  <span class="spec-label">Berat:</span>
                  <span class="spec-value">{product.weight} gram</span>
                </div>
              {/if}
              {#if product.height}
                <div class="spec-item">
                  <span class="spec-label">Tinggi:</span>
                  <span class="spec-value">{product.height} cm</span>
                </div>
              {/if}
              {#if product.length}
                <div class="spec-item">
                  <span class="spec-label">Panjang:</span>
                  <span class="spec-value">{product.length} cm</span>
                </div>
              {/if}
              {#if product.width}
                <div class="spec-item">
                  <span class="spec-label">Lebar:</span>
                  <span class="spec-value">{product.width} cm</span>
                </div>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Stock & Quantity -->
        <div class="stock-section">
          <div class="stock-info">
            <span class="stock-label">Stok:</span>
            <span class="stock-value" class:out-of-stock={isOutOfStock}>
              {isOutOfStock ? 'Habis' : `${product.stock} tersedia`}
            </span>
          </div>

          {#if !isOutOfStock}
            <div class="quantity-selector">
              <span class="quantity-label">Jumlah:</span>
              <div class="quantity-controls">
                <button 
                  class="quantity-btn" 
                  disabled={quantity <= 1}
                  on:click={decreaseQuantity}
                >
                  <Minus size={16} />
                </button>
                <span class="quantity-value">{quantity}</span>
                <button 
                  class="quantity-btn" 
                  disabled={quantity >= maxQuantity}
                  on:click={increaseQuantity}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          {/if}
        </div>

        <!-- Shipping Info -->
        <div class="shipping-info">
          <div class="shipping-item">
            <Truck size={16} />
            <span>Pengiriman tersedia ke seluruh Indonesia</span>
          </div>
          {#if product.location}
            <div class="shipping-item">
              <MapPin size={16} />
              <span>Dikirim dari {product.location}</span>
            </div>
          {/if}
        </div>

        <!-- Action Buttons -->
        <div class="action-buttons">
          <button 
            class="add-to-cart-btn"
            disabled={isOutOfStock || addingToCart}
            on:click={addToCart}
          >
            {#if addingToCart}
              <div class="loading-spinner"></div>
              Menambahkan...
            {:else}
              <ShoppingCart size={20} />
              {isOutOfStock ? 'Stok Habis' : 'Tambah ke Keranjang'}
            {/if}
          </button>
          
          <button 
            class="buy-now-btn"
            disabled={isOutOfStock}
            on:click={() => {
              console.log('Buy now:', { product: product.id, quantity });
            }}
          >
            Beli Sekarang
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style lang="scss">
  .product-detail-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    background: white;
    min-height: 100vh;
  }

  .product-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid #f0f0f0;
  }

  .back-button {
    display: flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 16px;
    color: #333;
    transition: color 0.3s ease;

    &:hover {
      color: #007bff;
    }
  }

  .header-actions {
    display: flex;
    gap: 12px;
  }

  .action-btn {
    width: 44px;
    height: 44px;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;

    &:hover {
      border-color: #007bff;
      color: #007bff;
    }

    &.wishlist-btn.active {
      border-color: #ff4757;
      color: #ff4757;
      background: rgba(255, 71, 87, 0.1);
    }
  }

  .product-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
      gap: 24px;
    }
  }

  .product-images {
    .main-image {
      position: relative;
      width: 100%;
      height: auto;
      border-radius: 16px;
      overflow: hidden;
      background: #f8f9fa;
      margin-bottom: 16px;

      img {
        width: 100%;
        height: auto;
        object-fit: cover;
      }
    }

    .discount-badge {
      position: absolute;
      top: 16px;
      left: 16px;
      background: linear-gradient(135deg, #ff4757, #ff3742);
      color: white;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
    }

    .image-thumbnails {
      display: flex;
      gap: 12px;
      overflow-x: auto;
      padding: 4px 0;

      .thumbnail {
        width: 80px;
        height: 80px;
        border: 2px solid transparent;
        border-radius: 12px;
        overflow: hidden;
        cursor: pointer;
        transition: border-color 0.3s ease;
        background: none;
        padding: 0;

        &.active {
          border-color: #007bff;
        }

        &:hover {
          border-color: #ccc;
        }

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      }
    }
  }

  .product-info {
    .product-badges {
      margin-bottom: 12px;
    }

    .official-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, #2ed573, #1dd1a1);
      color: white;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
    }

    .product-title {
      font-size: 28px;
      font-weight: 700;
      color: #2c3e50;
      line-height: 1.3;
      margin: 0 0 16px 0;
    }

    .product-meta {
      margin-bottom: 20px;
    }

    .sold-info {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .sold-count {
      font-size: 14px;
      color: #666;
      font-weight: 500;
    }

    .rating {
      display: flex;
      align-items: center;
      gap: 4px;
      color: #ffa502;

      span {
        font-size: 14px;
        font-weight: 600;
        color: #333;
      }

      .review-count {
        font-size: 13px;
        color: #999;
        font-weight: 400;
      }
    }

    .price-section {
      margin-bottom: 24px;
    }

    .original-price {
      font-size: 16px;
      color: #999;
      text-decoration: line-through;
      margin-bottom: 4px;
    }

    .current-price {
      font-size: 32px;
      font-weight: 800;
      color: #007bff;
    }

    .description {
      margin-bottom: 24px;

      h3 {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 12px;
        color: #333;
      }

      p {
        line-height: 1.6;
        color: #555;
        margin: 0;
      }
    }

    .specifications {
      margin-bottom: 24px;

      h3 {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 12px;
        color: #333;
      }

      .spec-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
      }

      .spec-item {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid #f0f0f0;

        .spec-label {
          color: #666;
          font-weight: 500;
        }

        .spec-value {
          color: #333;
          font-weight: 600;
        }
      }
    }

    .stock-section {
      margin-bottom: 24px;
    }

    .stock-info {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;

      .stock-label {
        font-weight: 600;
        color: #333;
      }

      .stock-value {
        color: #2ca540;
        font-weight: 600;

        &.out-of-stock {
          color: #ff4757;
        }
      }
    }

    .quantity-selector {
      display: flex;
      align-items: center;
      gap: 16px;

      .quantity-label {
        font-weight: 600;
        color: #333;
      }

      .quantity-controls {
        display: flex;
        align-items: center;
        border: 2px solid #e0e0e0;
        border-radius: 12px;
        overflow: hidden;
      }

      .quantity-btn {
        width: 40px;
        height: 40px;
        border: none;
        background: white;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background-color 0.3s ease;

        &:hover:not(:disabled) {
          background: #f8f9fa;
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }

      .quantity-value {
        min-width: 60px;
        text-align: center;
        font-weight: 600;
        padding: 0 16px;
        border-left: 1px solid #e0e0e0;
        border-right: 1px solid #e0e0e0;
      }
    }

    .shipping-info {
      margin-bottom: 32px;
      padding: 16px;
      background: #f8f9fa;
      border-radius: 12px;

      .shipping-item {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #666;
        font-size: 14px;
        margin-bottom: 8px;

        &:last-child {
          margin-bottom: 0;
        }
      }
    }

    .action-buttons {
      display: flex;
      gap: 16px;

      button {
        flex: 1;
        height: 4rem;
        border: none;
        border-radius: 16px;
        font-size: 16px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: .8rem 0.2rem;

        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      }

      .add-to-cart-btn {
        background: #007bff;
        color: white;

        &:hover:not(:disabled) {
          background: #0056b3;
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 123, 255, 0.3);
        }
      }

      .buy-now-btn {
        background: #2ca540;
        color: white;

        &:hover:not(:disabled) {
          background: #1dd1a1;
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(44, 165, 64, 0.3);
        }
      }
    }
  }

  .loading-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Skeleton Loading Styles */
  .skeleton {
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  .skeleton-header-back {
    width: 100px;
    height: 24px;
  }

  .skeleton-action-btn {
    width: 44px;
    height: 44px;
    border-radius: 12px;
  }

  .skeleton-main-image {
    width: 100%;
    height: 400px;
    border-radius: 16px;
    margin-bottom: 16px;
  }

  .skeleton-thumbnail {
    width: 80px;
    height: 80px;
    border-radius: 12px;
  }

  .skeleton-badge {
    width: 120px;
    height: 28px;
    border-radius: 8px;
    margin-bottom: 12px;
  }

  .skeleton-title {
    width: 100%;
    height: 32px;
    margin-bottom: 8px;
    border-radius: 6px;
  }

  .skeleton-title-short {
    width: 70%;
    height: 32px;
    margin-bottom: 16px;
    border-radius: 6px;
  }

  .skeleton-meta {
    display: flex;
    gap: 16px;
    margin-bottom: 20px;
  }

  .skeleton-text-short {
    width: 80px;
    height: 20px;
    border-radius: 4px;
  }

  .skeleton-text {
    width: 100%;
    height: 16px;
    margin-bottom: 8px;
    border-radius: 4px;

    &:last-child {
      width: 60%;
    }
  }

  .skeleton-price {
    margin-bottom: 24px;
  }

  .skeleton-price-original {
    width: 120px;
    height: 20px;
    margin-bottom: 4px;
    border-radius: 4px;
  }

  .skeleton-price-current {
    width: 160px;
    height: 36px;
    border-radius: 6px;
  }

  .skeleton-description {
    margin-bottom: 24px;
  }

  .skeleton-subtitle {
    width: 140px;
    height: 24px;
    margin-bottom: 12px;
    border-radius: 4px;
  }

  .skeleton-specs {
    margin-bottom: 24px;
  }

  .skeleton-spec-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }

  .skeleton-spec-item {
    width: 100%;
    height: 20px;
    border-radius: 4px;
  }

  .skeleton-stock {
    margin-bottom: 24px;
  }

  .skeleton-quantity-selector {
    width: 200px;
    height: 44px;
    border-radius: 12px;
    margin-top: 16px;
  }

  .skeleton-shipping {
    width: 100%;
    height: 80px;
    border-radius: 12px;
    margin-bottom: 32px;
  }

  .skeleton-buttons {
    display: flex;
    gap: 16px;
  }

  .skeleton-button {
    flex: 1;
    height: 64px;
    border-radius: 16px;
  }

  @media (max-width: 768px) {
    .product-detail-container {
      padding: 16px;
    }

    .product-info {
      .product-title {
        font-size: 24px;
      }

      .current-price {
        font-size: 28px;
      }

      .action-buttons {
        flex-direction: column;
      }
    }

    .product-images {
      .main-image {
        height: 300px;
      }

      .image-thumbnails .thumbnail {
        width: 60px;
        height: 60px;
      }
    }

    .skeleton-main-image {
      height: 300px;
    }

    .skeleton-buttons {
      flex-direction: column;
    }
  }
</style>