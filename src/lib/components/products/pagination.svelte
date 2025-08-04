<script>
  import { createEventDispatcher } from 'svelte';
  import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-svelte';

  export let currentPage = 1;
  export let totalPages = 1;
  export let maxVisiblePages = 5;

  const dispatch = createEventDispatcher();

  $: visiblePages = calculateVisiblePages(currentPage, totalPages, maxVisiblePages);

  function calculateVisiblePages(current, total, max) {
    if (total <= max) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const half = Math.floor(max / 2);
    let start = Math.max(1, current - half);
    let end = Math.min(total, start + max - 1);

    // Adjust start if we're near the end
    if (end - start + 1 < max) {
      start = Math.max(1, end - max + 1);
    }

    const pages = [];
    
    // Always show first page
    if (start > 1) {
      pages.push(1);
      if (start > 2) {
        pages.push('...');
      }
    }

    // Add visible page numbers
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    // Always show last page
    if (end < total) {
      if (end < total - 1) {
        pages.push('...');
      }
      pages.push(total);
    }

    return pages;
  }

  function goToPage(page) {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      dispatch('pageChange', page);
    }
  }

  function goToPrevious() {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  }

  function goToNext() {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  }
</script>

<nav class="pagination" aria-label="Navigasi halaman produk">
  <div class="pagination-info">
    <span>
      Halaman {currentPage} dari {totalPages}
    </span>
  </div>

  <div class="pagination-controls">
    <button 
      class="pagination-btn prev-btn"
      class:disabled={currentPage === 1}
      on:click={goToPrevious}
      aria-label="Halaman sebelumnya"
      disabled={currentPage === 1}
    >
      <ChevronLeft size={18} />
      <span class="btn-text">Sebelumnya</span>
    </button>

    <div class="page-numbers">
      {#each visiblePages as page}
        {#if page === '...'}
          <span class="pagination-ellipsis">
            <MoreHorizontal size={16} />
          </span>
        {:else}
          <button
            class="pagination-btn page-btn"
            class:active={page === currentPage}
            on:click={() => goToPage(page)}
            aria-label="Halaman {page}"
            aria-current={page === currentPage ? 'page' : null}
          >
            {page}
          </button>
        {/if}
      {/each}
    </div>

    <button 
      class="pagination-btn next-btn"
      class:disabled={currentPage === totalPages}
      on:click={goToNext}
      aria-label="Halaman selanjutnya"
      disabled={currentPage === totalPages}
    >
      <span class="btn-text">Selanjutnya</span>
      <ChevronRight size={18} />
    </button>
  </div>

  <!-- Mobile simple navigation -->
  <div class="mobile-pagination">
    <button 
      class="mobile-btn"
      class:disabled={currentPage === 1}
      on:click={goToPrevious}
      disabled={currentPage === 1}
    >
      <ChevronLeft size={20} />
    </button>

    <div class="mobile-page-info">
      <input 
        type="number" 
        bind:value={currentPage}
        min="1" 
        max={totalPages}
        on:change={() => goToPage(currentPage)}
      />
      <span>/ {totalPages}</span>
    </div>

    <button 
      class="mobile-btn"
      class:disabled={currentPage === totalPages}
      on:click={goToNext}
      disabled={currentPage === totalPages}
    >
      <ChevronRight size={20} />
    </button>
  </div>
</nav>

<style lang="scss">
  .pagination {
    margin: 40px 0 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .pagination-info {
    font-size: 14px;
    color: #666;
    text-align: center;
  }

  .pagination-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;

    @media (max-width: 768px) {
      display: none;
    }
  }

  .pagination-btn {
    border: 1px solid #e0e0e0;
    background: white;
    color: #333;
    padding: 8px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;

    &:hover:not(.disabled) {
      background: #f8f9fa;
      border-color: #007bff;
      color: #007bff;
    }

    &.active {
      background: #007bff;
      border-color: #007bff;
      color: white;
      font-weight: 600;
    }

    &.disabled {
      opacity: 0.5;
      cursor: not-allowed;
      background: #f8f9fa;
      color: #999;
    }

    &.page-btn {
      min-width: 40px;
      justify-content: center;
    }

    &.prev-btn,
    &.next-btn {
      font-weight: 600;
      padding: 8px 16px;
    }
  }

  .page-numbers {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .pagination-ellipsis {
    padding: 8px 4px;
    color: #999;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
  }

  .mobile-pagination {
    display: none;
    align-items: center;
    gap: 16px;
    width: 100%;
    justify-content: center;

    @media (max-width: 768px) {
      display: flex;
    }
  }

  .mobile-btn {
    width: 44px;
    height: 44px;
    border: 1px solid #e0e0e0;
    background: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;

    &:hover:not(.disabled) {
      background: #f8f9fa;
      border-color: #007bff;
      color: #007bff;
    }

    &.disabled {
      opacity: 0.5;
      cursor: not-allowed;
      background: #f8f9fa;
      color: #999;
    }
  }

  .mobile-page-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 500;

    input {
      width: 60px;
      padding: 8px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      text-align: center;
      font-size: 16px;
      font-weight: 500;

      &:focus {
        outline: none;
        border-color: #007bff;
        box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
      }
    }

    span {
      color: #666;
    }
  }

  .btn-text {
    @media (max-width: 480px) {
      display: none;
    }
  }

  // Ultra mobile optimization
  @media (max-width: 480px) {
    .pagination {
      margin: 32px 0 16px;
    }

    .mobile-btn {
      width: 40px;
      height: 40px;
    }

    .mobile-page-info {
      input {
        width: 50px;
        padding: 6px;
        font-size: 14px;
      }
    }
  }
</style>