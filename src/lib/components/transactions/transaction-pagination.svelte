<script lang="ts">
  import { ChevronLeft, ChevronRight } from 'lucide-svelte';

  export let pagination = null;
  export let currentPage = 1;
  export let itemsPerPage = 10;
  export let onChangePage = () => {};
  export let onChangeItemsPerPage = () => {};
</script>

{#if pagination && pagination.totalPages > 1}
  <div class="pagination">
    <div class="pagination-info">
      Menampilkan {(pagination.currentPage - 1) * itemsPerPage + 1} - 
      {Math.min(pagination.currentPage * itemsPerPage, pagination.totalCount)} dari 
      {pagination.totalCount} transaksi
    </div>

    <div class="pagination-controls">
      <div class="items-per-page">
        <label>Items per halaman:</label>
        <select 
          bind:value={itemsPerPage}
          on:change={() => onChangeItemsPerPage(itemsPerPage)}
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </div>

      <div class="page-navigation">
        <button 
          class="btn btn-outline btn-sm"
          disabled={!pagination.hasPrevPage}
          on:click={() => onChangePage(pagination.currentPage - 1)}
        >
          <ChevronLeft size={14} />
          Prev
        </button>

        <div class="page-numbers">
          {#each Array(Math.min(5, pagination.totalPages)) as _, i}
            {@const pageNum = Math.max(1, pagination.currentPage - 2) + i}
            {#if pageNum <= pagination.totalPages}
              <button 
                class="page-btn"
                class:active={pageNum === pagination.currentPage}
                on:click={() => onChangePage(pageNum)}
              >
                {pageNum}
              </button>
            {/if}
          {/each}
        </div>

        <button 
          class="btn btn-outline btn-sm"
          disabled={!pagination.hasNextPage}
          on:click={() => onChangePage(pagination.currentPage + 1)}
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  </div>
{/if}