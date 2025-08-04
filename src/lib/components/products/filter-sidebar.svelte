<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { 
    X, 
    ChevronDown, 
    ChevronUp, 
    Star, 
    MapPin,
    Truck,
    Shield,
    Tag
  } from 'lucide-svelte';

  export let selectedCategory = '';

  const dispatch = createEventDispatcher();

  let categories = [];
  let priceRanges = [
    { id: 'under-100k', label: 'Di bawah Rp 100.000', min: 0, max: 100000 },
    { id: '100k-500k', label: 'Rp 100.000 - Rp 500.000', min: 100000, max: 500000 },
    { id: '500k-1m', label: 'Rp 500.000 - Rp 1.000.000', min: 500000, max: 1000000 },
    { id: '1m-5m', label: 'Rp 1.000.000 - Rp 5.000.000', min: 1000000, max: 5000000 },
    { id: 'above-5m', label: 'Di atas Rp 5.000.000', min: 5000000, max: null }
  ];

  let locations = [
    'Jakarta',
    'Surabaya',
    'Bandung',
    'Medan',
    'Semarang',
    'Makassar',
    'Palembang',
    'Tangerang'
  ];

  let ratings = [5, 4, 3, 2, 1];

  // Filter states
  let selectedPriceRange = '';
  let selectedLocation = '';
  let selectedRating = 0;
  let minPrice = '';
  let maxPrice = '';
  let freeShipping = false;
  let officialStore = false;
  let hasDiscount = false;

  // Accordion states
  let categoryExpanded = true;
  let priceExpanded = true;
  let locationExpanded = false;
  let ratingExpanded = false;
  let featureExpanded = false;

  onMount(async () => {
    await loadCategories();
  });

  async function loadCategories() {
    try {
      const response = await fetch('/api/categories');
      const result = await response.json();
      if (result.success) {
        categories = result.data;
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
      // Fallback categories
      categories = [
        { id: 1, name: 'Elektronik', count: 1250 },
        { id: 2, name: 'Fashion', count: 2100 },
        { id: 3, name: 'Kesehatan & Kecantikan', count: 890 },
        { id: 4, name: 'Rumah & Taman', count: 650 },
        { id: 5, name: 'Olahraga', count: 420 },
        { id: 6, name: 'Otomotif', count: 380 },
        { id: 7, name: 'Buku & Alat Tulis', count: 290 },
        { id: 8, name: 'Mainan & Hobi', count: 180 }
      ];
    }
  }

  function handleCategoryChange(categoryId) {
    selectedCategory = categoryId;
    dispatch('categoryChange', categoryId);
  }

  function handlePriceRangeChange(rangeId) {
    selectedPriceRange = rangeId;
    const range = priceRanges.find(r => r.id === rangeId);
    if (range) {
      minPrice = range.min.toString();
      maxPrice = range.max ? range.max.toString() : '';
    }
    applyFilters();
  }

  function handleCustomPriceChange() {
    selectedPriceRange = '';
    applyFilters();
  }

  function handleLocationChange(location) {
    selectedLocation = location;
    applyFilters();
  }

  function handleRatingChange(rating) {
    selectedRating = rating;
    applyFilters();
  }

  function handleFeatureChange() {
    applyFilters();
  }

  function applyFilters() {
    const filters = {
      category: selectedCategory,
      priceRange: selectedPriceRange,
      minPrice: minPrice ? parseInt(minPrice) : null,
      maxPrice: maxPrice ? parseInt(maxPrice) : null,
      location: selectedLocation,
      rating: selectedRating,
      freeShipping,
      officialStore,
      hasDiscount
    };
    dispatch('filtersChange', filters);
  }

  function clearAllFilters() {
    selectedCategory = '';
    selectedPriceRange = '';
    selectedLocation = '';
    selectedRating = 0;
    minPrice = '';
    maxPrice = '';
    freeShipping = false;
    officialStore = false;
    hasDiscount = false;
    dispatch('categoryChange', '');
    applyFilters();
  }

  function closeFilters() {
    dispatch('close');
  }

  function formatPrice(price) {
    return new Intl.NumberFormat('id-ID', { 
      style: 'currency', 
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(price);
  }
</script>

<div class="filter-sidebar">
  <div class="filter-header">
    <h3>Filter Produk</h3>
    <button class="close-btn" on:click={closeFilters} aria-label="Tutup filter">
      <X size={20} />
    </button>
  </div>

  <div class="filter-actions">
    <button class="clear-all-btn" on:click={clearAllFilters}>
      Hapus Semua Filter
    </button>
  </div>

  <div class="filter-sections">
    <!-- Categories -->
    <div class="filter-section">
      <button 
        class="section-header"
        class:expanded={categoryExpanded}
        on:click={() => categoryExpanded = !categoryExpanded}
      >
        <span>Kategori</span>
        {#if categoryExpanded}
          <ChevronUp size={16} />
        {:else}
          <ChevronDown size={16} />
        {/if}
      </button>
      
      {#if categoryExpanded}
        <div class="section-content">
          <div class="category-list">
            {#each categories as category}
              <label class="category-item">
                <input 
                  type="radio" 
                  name="category"
                  value={category.id}
                  bind:group={selectedCategory}
                  on:change={() => handleCategoryChange(category.id)}
                />
                <span class="category-name">{category.name}</span>
                <span class="category-count">({category.count || 0})</span>
              </label>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <!-- Price Range -->
    <div class="filter-section">
      <button 
        class="section-header"
        class:expanded={priceExpanded}
        on:click={() => priceExpanded = !priceExpanded}
      >
        <span>Harga</span>
        {#if priceExpanded}
          <ChevronUp size={16} />
        {:else}
          <ChevronDown size={16} />
        {/if}
      </button>
      
      {#if priceExpanded}
        <div class="section-content">
          <div class="price-ranges">
            {#each priceRanges as range}
              <label class="price-item">
                <input 
                  type="radio" 
                  name="priceRange"
                  value={range.id}
                  bind:group={selectedPriceRange}
                  on:change={() => handlePriceRangeChange(range.id)}
                />
                <span>{range.label}</span>
              </label>
            {/each}
          </div>
          
          <div class="custom-price">
            <div class="price-inputs">
              <input 
                type="number" 
                placeholder="Min"
                bind:value={minPrice}
                on:input={handleCustomPriceChange}
              />
              <span>-</span>
              <input 
                type="number" 
                placeholder="Max"
                bind:value={maxPrice}
                on:input={handleCustomPriceChange}
              />
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Location -->
    <div class="filter-section">
      <button 
        class="section-header"
        class:expanded={locationExpanded}
        on:click={() => locationExpanded = !locationExpanded}
      >
        <span>Lokasi</span>
        <MapPin size={14} />
        {#if locationExpanded}
          <ChevronUp size={16} />
        {:else}
          <ChevronDown size={16} />
        {/if}
      </button>
      
      {#if locationExpanded}
        <div class="section-content">
          <div class="location-list">
            {#each locations as location}
              <label class="location-item">
                <input 
                  type="radio" 
                  name="location"
                  value={location}
                  bind:group={selectedLocation}
                  on:change={() => handleLocationChange(location)}
                />
                <span>{location}</span>
              </label>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <!-- Rating -->
    <div class="filter-section">
      <button 
        class="section-header"
        class:expanded={ratingExpanded}
        on:click={() => ratingExpanded = !ratingExpanded}
      >
        <span>Rating</span>
        <Star size={14} />
        {#if ratingExpanded}
          <ChevronUp size={16} />
        {:else}
          <ChevronDown size={16} />
        {/if}
      </button>
      
      {#if ratingExpanded}
        <div class="section-content">
          <div class="rating-list">
            {#each ratings as rating}
              <label class="rating-item">
                <input 
                  type="radio" 
                  name="rating"
                  value={rating}
                  bind:group={selectedRating}
                  on:change={() => handleRatingChange(rating)}
                />
                <div class="rating-stars">
                  {#each Array(5) as _, i}
                    <Star 
                      size={14} 
                      fill={i < rating ? '#ffa502' : 'none'}
                      color={i < rating ? '#ffa502' : '#ddd'}
                    />
                  {/each}
                  <span>& ke atas</span>
                </div>
              </label>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <!-- Features -->
    <div class="filter-section">
      <button 
        class="section-header"
        class:expanded={featureExpanded}
        on:click={() => featureExpanded = !featureExpanded}
      >
        <span>Fitur</span>
        {#if featureExpanded}
          <ChevronUp size={16} />
        {:else}
          <ChevronDown size={16} />
        {/if}
      </button>
      
      {#if featureExpanded}
        <div class="section-content">
          <div class="feature-list">
            <label class="feature-item">
              <input 
                type="checkbox" 
                bind:checked={freeShipping}
                on:change={handleFeatureChange}
              />
              <Truck size={16} />
              <span>Gratis Ongkir</span>
            </label>
            
            <label class="feature-item">
              <input 
                type="checkbox" 
                bind:checked={officialStore}
                on:change={handleFeatureChange}
              />
              <Shield size={16} />
              <span>Toko Official</span>
            </label>
            
            <label class="feature-item">
              <input 
                type="checkbox" 
                bind:checked={hasDiscount}
                on:change={handleFeatureChange}
              />
              <Tag size={16} />
              <span>Ada Diskon</span>
            </label>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style lang="scss">
  .filter-sidebar {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    width: 280px;
    height: fit-content;
    max-height: calc(100vh - 40px);
    overflow-y: auto;
    position: sticky;
    top: 20px;

    @media (max-width: 1024px) {
      position: fixed;
      top: 0;
      left: 0;
      width: 320px;
      height: 100vh;
      max-height: none;
      z-index: 100;
      border-radius: 0;
      transform: translateX(-100%);
      transition: transform 0.3s ease;

      &.show {
        transform: translateX(0);
      }
    }

    @media (max-width: 480px) {
      width: 100vw;
    }
  }

  .filter-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid #f0f0f0;

    h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #333;
    }

    .close-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      border-radius: 50%;
      transition: background-color 0.3s ease;

      &:hover {
        background: #f0f0f0;
      }

      @media (min-width: 1025px) {
        display: none;
      }
    }
  }

  .filter-actions {
    padding: 16px 20px;
    border-bottom: 1px solid #f0f0f0;

    .clear-all-btn {
      background: none;
      border: 1px solid #007bff;
      color: #007bff;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.3s ease;
      width: 100%;

      &:hover {
        background: #007bff;
        color: white;
      }
    }
  }

  .filter-sections {
    padding: 0 0 20px;
  }

  .filter-section {
    border-bottom: 1px solid #f0f0f0;

    &:last-child {
      border-bottom: none;
    }
  }

  .section-header {
    width: 100%;
    padding: 16px 20px;
    background: none;
    border: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    font-size: 15px;
    font-weight: 500;
    color: #333;
    transition: background-color 0.3s ease;
    gap: 8px;

    &:hover {
      background: #f8f9fa;
    }

    &.expanded {
      background: #f8f9fa;
    }

    span {
      flex: 1;
      text-align: left;
    }
  }

  .section-content {
    padding: 0 20px 16px;
    animation: slideDown 0.3s ease;
  }

  .category-list,
  .location-list,
  .rating-list,
  .feature-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .category-item,
  .location-item,
  .price-item {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    padding: 6px 0;
    font-size: 14px;

    input[type="radio"] {
      width: 16px;
      height: 16px;
      accent-color: #007bff;
    }

    .category-name {
      flex: 1;
      color: #333;
    }

    .category-count {
      color: #666;
      font-size: 12px;
    }

    &:hover {
      color: #007bff;
    }
  }

  .rating-item {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    padding: 6px 0;

    input[type="radio"] {
      width: 16px;
      height: 16px;
      accent-color: #007bff;
    }

    .rating-stars {
      display: flex;
      align-items: center;
      gap: 2px;
      font-size: 12px;
      color: #666;

      span {
        margin-left: 4px;
      }
    }
  }

  .feature-item {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    padding: 8px 0;
    font-size: 14px;
    color: #333;

    input[type="checkbox"] {
      width: 16px;
      height: 16px;
      accent-color: #007bff;
    }

    &:hover {
      color: #007bff;
    }
  }

  .price-ranges {
    margin-bottom: 16px;
  }

  .custom-price {
    .price-inputs {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;

      input {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        font-size: 14px;

        &:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
        }
      }

      span {
        color: #666;
        font-weight: 500;
      }
    }
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  // Scrollbar styling
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
  }

  &::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 3px;

    &:hover {
      background: #a8a8a8;
    }
  }
</style>