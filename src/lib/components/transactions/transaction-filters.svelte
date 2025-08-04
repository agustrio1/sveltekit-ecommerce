<script lang="ts">
  import { Filter, Calendar, Search } from 'lucide-svelte';

  export let filters = {
    period: 'all',
    status: '',
    search: '',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  };
  export let showFilters = false;
  export let onApplyFilters = () => {};
  export let onResetFilters = () => {};
  export let onSearchInput = () => {};

  const PERIOD_OPTIONS = [
    { value: 'today', label: 'Hari Ini' },
    { value: 'week', label: 'Minggu Ini' },
    { value: 'month', label: 'Bulan Ini' },
    { value: 'year', label: 'Tahun Ini' },
    { value: 'all', label: 'Semua' }
  ];

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

  const SORT_OPTIONS = [
    { value: 'createdAt', label: 'Tanggal Pesanan' },
    { value: 'total', label: 'Total Harga' },
    { value: 'status', label: 'Status' },
    { value: 'orderNumber', label: 'Nomor Pesanan' }
  ];
</script>

<div class="filters-section">
  <div class="filters-header">
    <button 
      class="filters-toggle"
      class:active={showFilters}
      on:click={() => showFilters = !showFilters}
    >
      <Filter size={16} />
      Filter & Pencarian
    </button>
    
    <button 
      class="btn btn-outline btn-sm"
      on:click={onResetFilters}
    >
      Reset
    </button>
  </div>

  <div class="filters-content" class:show={showFilters}>
    <div class="filters-row">
      <!-- Period Filter -->
      <div class="filter-group">
        <label class="filter-label">
          <Calendar size={14} />
          Periode
        </label>
        <select 
          class="filter-select"
          bind:value={filters.period}
          on:change={onApplyFilters}
        >
          {#each PERIOD_OPTIONS as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>

      <!-- Status Filter -->
      <div class="filter-group">
        <label class="filter-label">Status</label>
        <select 
          class="filter-select"
          bind:value={filters.status}
          on:change={onApplyFilters}
        >
          {#each STATUS_OPTIONS as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>

      <!-- Sort Filter -->
      <div class="filter-group">
        <label class="filter-label">Urutkan</label>
        <select 
          class="filter-select"
          bind:value={filters.sortBy}
          on:change={onApplyFilters}
        >
          {#each SORT_OPTIONS as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>

      <!-- Sort Order -->
      <div class="filter-group">
        <label class="filter-label">Arah</label>
        <select 
          class="filter-select"
          bind:value={filters.sortOrder}
          on:change={onApplyFilters}
        >
          <option value="desc">Terbaru</option>
          <option value="asc">Terlama</option>
        </select>
      </div>
    </div>

    <!-- Search -->
    <div class="search-row">
      <div class="search-group">
        <Search size={16} class="search-icon" />
        <input
          type="text"
          class="search-input"
          placeholder="Cari nomor pesanan, nama, atau email..."
          value={filters.search}
          on:input={onSearchInput}
        />
      </div>
    </div>
  </div>
</div>