<script>
  import { createEventDispatcher } from 'svelte';
  import { goto } from '$app/navigation';
  import { 
    Heart, 
    ShoppingCart, 
    Star, 
    Eye,
    MapPin,
    Shield,
    Flame,
    TrendingUp
  } from 'lucide-svelte';

  export let product;
  export let viewMode = 'grid';

  const dispatch = createEventDispatcher();

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

  function handleNavigateToProduct() {
    if (product.slug) {
      goto(`/products/${product.slug}`);
    }
  }

  function handleAddToCart(e) {
    e.preventDefault();
    e.stopPropagation();
    dispatch('addToCart', { product });
  }

  function handleAddToWishlist(e) {
    e.preventDefault();
    e.stopPropagation();
    dispatch('addToWishlist', { product });
  }

  function handleQuickView(e) {
    e.preventDefault();
    e.stopPropagation();
    dispatch('quickView', { product });
  }

  // Calculate discount percentage
  $: discountPercentage = calculateDiscountPercentage(product.originalPrice, product.price);
  $: isHotSelling = (product.soldCount || 0) > 100;
  $: isTrending = (product.soldCount || 0) > 50;
</script>

<article 
  class="product-card" 
  class:list-view={viewMode === 'list'}
  role="button"
  tabindex="0"
  on:click={handleNavigateToProduct}
  on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleNavigateToProduct()}
>
  <div class="product-image">
    <img 
      src={product.images?.[0] || '/placeholder-product.jpg'} 
      alt={product.name}
      loading="lazy"
    />
    
    <!-- Enhanced badges with animations -->
    <div class="badges-container">
      {#if discountPercentage > 0}
        <div class="discount-badge animate-pulse">
          <Flame size={12} />
          -{discountPercentage}%
        </div>
      {/if}

      {#if isHotSelling}
        <div class="hot-badge">
          <TrendingUp size={10} />
          HOT
        </div>
      {/if}

      {#if product.isOfficial}
        <div class="official-badge">
          <Shield size={10} />
          Official
        </div>
      {/if}
    </div>

    <!-- Enhanced overlay with smooth animations -->
    <div class="product-overlay">
      <button 
        class="overlay-btn wishlist-btn"
        on:click={handleAddToWishlist}
        aria-label="Tambah ke wishlist"
      >
        <Heart size={16} />
      </button>
      
      <button 
        class="overlay-btn quick-view-btn"
        on:click={handleQuickView}
        aria-label="Lihat cepat"
      >
        <Eye size={16} />
      </button>
    </div>

    <!-- Image shimmer effect -->
    <div class="image-shimmer"></div>
  </div>

  <div class="product-info">
    <div class="product-meta">
      <div class="sold-count">
        <span class="sold-number">{formatSoldCount(product.soldCount || 0)}</span>
        <span class="sold-text">terjual</span>
        {#if isTrending}
          <TrendingUp size={12} class="trending-icon" />
        {/if}
      </div>
      
      {#if product.rating && product.rating > 0}
        <div class="rating">
          <Star size={12} fill="currentColor" />
          <span class="rating-score">{product.rating.toFixed(1)}</span>
          {#if product.reviewCount}
            <span class="rating-count">({product.reviewCount})</span>
          {/if}
        </div>
      {/if}
    </div>

    <h3 class="product-name" title={product.name}>{product.name}</h3>
    
    <div class="price-container">
      {#if product.originalPrice && product.originalPrice > product.price}
        <span class="original-price">{formatPrice(product.originalPrice)}</span>
      {/if}
      <span class="current-price">{formatPrice(product.price)}</span>
    </div>

    {#if product.location}
      <div class="location">
        <MapPin size={12} />
        <span>{product.location}</span>
      </div>
    {/if}

    {#if product.features && product.features.length > 0}
      <div class="product-features">
        {#each product.features.slice(0, 2) as feature}
          <span class="feature-tag">{feature}</span>
        {/each}
        {#if product.features.length > 2}
          <span class="feature-tag more">+{product.features.length - 2}</span>
        {/if}
      </div>
    {/if}

    <button 
      class="add-to-cart-btn"
      on:click={handleAddToCart}
      aria-label="Tambah ke keranjang"
    >
      <ShoppingCart size={16} />
      <span class="btn-text">Keranjang</span>
      <div class="btn-ripple"></div>
    </button>
  </div>
</article>

<style lang="scss">
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.8; }
  }

  @keyframes slideInUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes ripple {
    0% {
      transform: scale(0);
      opacity: 1;
    }
    100% {
      transform: scale(4);
      opacity: 0;
    }
  }

  .animate-pulse {
    animation: pulse 2s infinite;
  }

  .product-card {
    background: white;
    border-radius: 16px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    position: relative;
    overflow: hidden;
    border: 1px solid #f0f0f0;
    backdrop-filter: blur(10px);

    &:hover {
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
      transform: translateY(-4px);
      border-color: #2ca540;

      .product-overlay {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }

      .product-image img {
        transform: scale(1.08);
      }

      .image-shimmer {
        opacity: 1;
      }

      .add-to-cart-btn {
        background: linear-gradient(135deg, #0056b3, #004494);
        transform: translateY(-2px);
        box-shadow: 0 8px 20px rgba(0, 123, 255, 0.3);
      }
    }

    &:focus {
      outline: 2px solid #2ca540;
      outline-offset: 4px;
    }

    // Enhanced list view
    &.list-view {
      display: flex;
      flex-direction: row;
      align-items: stretch;
      padding: 20px;
      gap: 20px;
      border-radius: 12px;

      .product-image {
        width: 140px;
        height: 140px;
        flex-shrink: 0;
        border-radius: 4px;
        overflow: hidden;

        img {
          width: 100%;
          height: 100%;
        }
      }

      .product-info {
        flex: 1;
        padding: 0;
        justify-content: space-between;
      }

      .add-to-cart-btn {
        align-self: flex-end;
        margin-top: auto;
        width: auto;
      }
    }
  }

  .product-image {
    position: relative;
    width: 100%;
    height: 220px;
    overflow: hidden;
    border-radius: 0 0;
    background: linear-gradient(135deg, #f8f9fa, #e9ecef);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }
  }

  .image-shimmer {
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.4),
      transparent
    );
    transition: opacity 0.3s ease;
    opacity: 0;
    animation: shimmer 1.5s infinite;
  }

  @keyframes shimmer {
    0% { left: -100%; }
    100% { left: 100%; }
  }

  .badges-container {
    position: absolute;
    top: 12px;
    left: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    z-index: 3;
  }

  .discount-badge {
    background: linear-gradient(135deg, #ff4757, #ff3742);
    color: white;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 4px;
    box-shadow: 0 2px 8px rgba(255, 71, 87, 0.3);
  }

  .hot-badge {
    background: linear-gradient(135deg, #ff9ff3, #f368e0);
    color: white;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 3px;
    animation: slideInUp 0.5s ease;
  }

  .official-badge {
    background: linear-gradient(135deg, #2ed573, #1dd1a1);
    color: white;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .product-overlay {
    position: absolute;
    top: 12px;
    right: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    opacity: 0;
    visibility: hidden;
    transform: translateY(-10px);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .overlay-btn {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    border: none;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);

    &:hover {
      background: white;
      transform: scale(1.1) rotate(5deg);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
    }

    &.wishlist-btn:hover {
      color: #ff4757;
      background: rgba(255, 71, 87, 0.1);
    }

    &.quick-view-btn:hover {
      color: #007bff;
      background: rgba(0, 123, 255, 0.1);
    }
  }

  .product-info {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
  }

  .product-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  .sold-count {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #666;

    .sold-number {
      font-weight: 700;
      color: #2ca540;
    }

    .sold-text {
      font-weight: 500;
    }

    .trending-icon {
      color: #ff9ff3;
    }
  }

  .rating {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #ffa502;
    font-size: 12px;

    .rating-score {
      font-weight: 600;
      color: #333;
    }

    .rating-count {
      color: #999;
      font-size: 11px;
    }
  }

  .product-name {
    font-size: 15px;
    font-weight: 600;
    color: #2c3e50;
    line-height: 1.4;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 42px;
    transition: color 0.3s ease;

    &:hover {
      color: #2ca540;
    }
  }

  .price-container {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 4px 0;
  }

  .original-price {
    font-size: 13px;
    color: #bbb;
    text-decoration: line-through;
    font-weight: 500;
  }

  .current-price {
    font-size: 18px;
    font-weight: 800;
    color: #007bff;
    background: linear-gradient(135deg, #007bff, #0056b3);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .location {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #777;
    margin-bottom: 4px;

    span {
      font-weight: 500;
    }
  }

  .product-features {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }

  .feature-tag {
    background: linear-gradient(135deg, #f8f9fa, #e9ecef);
    color: #495057;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 600;
    border: 1px solid #dee2e6;
    transition: all 0.3s ease;

    &:hover {
      background: linear-gradient(135deg, #2ca540, #1dd1a1);
      color: white;
      transform: translateY(-1px);
    }

    &.more {
      background: linear-gradient(135deg, #6c757d, #495057);
      color: white;
    }
  }

  .add-to-cart-btn {
    background: linear-gradient(135deg, #007bff, #0056b3);
    color: white;
    border: none;
    border-radius: 12px;
    padding: 14px 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    margin-top: auto;
    position: relative;
    overflow: hidden;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 123, 255, 0.3);
    }

    &:active {
      transform: translateY(0);
      
      .btn-ripple {
        animation: ripple 0.6s linear;
      }
    }

    .btn-ripple {
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.6);
      width: 20px;
      height: 20px;
      pointer-events: none;
    }

    .btn-text {
      @media (max-width: 480px) {
        display: none;
      }
    }
  }

  // Enhanced mobile optimizations
  @media (max-width: 768px) {
    .product-card {
      border-radius: 12px;
      
      &.list-view {
        .product-image {
          width: 120px;
          height: 120px;
        }

        .product-info {
          gap: 8px;
        }

        .add-to-cart-btn {
          padding: 10px 16px;
          font-size: 13px;
        }
      }
    }

    .product-image {
      height: 200px;
    }

    .product-info {
      padding: 12px;
      gap: 6px;
    }

    .product-name {
      font-size: 14px;
      min-height: 38px;
    }

    .current-price {
      font-size: 16px;
    }

    .add-to-cart-btn {
      padding: 12px 18px;
      font-size: 13px;
    }

    .overlay-btn {
      width: 36px;
      height: 36px;
    }
  }

  @media (max-width: 480px) {
    .product-card {
      &.list-view {
        flex-direction: column;
        
        .product-image {
          width: 100%;
          height: 160px;
        }
      }
    }

    .product-image {
      height: 180px;
    }

    .product-overlay {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }

    .badges-container {
      top: 8px;
      left: 8px;
    }

    .discount-badge,
    .hot-badge,
    .official-badge {
      font-size: 9px;
      padding: 3px 6px;
    }
  }

  // Dark mode support
  @media (prefers-color-scheme: dark) {
    .product-card {
      background: white;
      border-color: #f0f0f0;
      color: #333;

      .product-name {
        color: #2c3e50;
      }

      .feature-tag {
        background: linear-gradient(135deg, #f8f9fa, #e9ecef);
        color: #495057;
        border-color: #dee2e6;
      }
    }
  }
</style>