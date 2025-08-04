<script lang="ts">
  import './categories-page.scss';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Plus from 'lucide-svelte/icons/plus';
  import Search from 'lucide-svelte/icons/search';
  import AlertTriangle from 'lucide-svelte/icons/alert-triangle';
  import BookOpen from 'lucide-svelte/icons/book-open';
  import Image from 'lucide-svelte/icons/image';
  import Edit from 'lucide-svelte/icons/edit';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import ChevronLeft from 'lucide-svelte/icons/chevron-left';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';

  let categories = [];
  let allCategories = []; // For parent lookup
  let search = '';
  let pageNum = 1;
  let perPage = 10;
  let total = 0;
  let loading = false;
  let errorMessage = '';

  // Helper function to get parent category name
  function getParentName(parentId) {
    if (!parentId) return '-';
    const parent = allCategories.find(cat => cat.id === parentId);
    return parent ? parent.name : `ID: ${parentId}`;
  }

  async function loadAllCategories() {
    try {
      // Load all categories for parent lookup (without pagination)
      const res = await fetch('/api/categories?perPage=1000');
      if (res.ok) {
        const data = await res.json();
        allCategories = data.data || [];
      }
    } catch (err) {
      console.error('Failed to load all categories:', err);
    }
  }

  async function loadCategories() {
    loading = true;
    errorMessage = '';
    try {
      const query = new URLSearchParams({
        q: search,
        page: pageNum.toString(),
        perPage: perPage.toString()
      });

      const res = await fetch(`/api/categories?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        categories = data.data || [];
        total = data.total || 0;
      } else {
        errorMessage = 'Gagal mengambil data kategori.';
        categories = [];
        total = 0;
      }
    } catch (err) {
      errorMessage = 'Terjadi kesalahan saat mengambil kategori.';
      console.error(err);
      categories = [];
      total = 0;
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    await loadAllCategories();
    await loadCategories();
  });

  function handleSearch() {
    pageNum = 1;
    loadCategories();
  }

  function getCSRFTokenFromCookie(): string {
    const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  async function handleDelete(slug: string) {
    if (!confirm('Yakin hapus kategori ini?')) return;

    const csrfToken = getCSRFTokenFromCookie();

    const res = await fetch(`/api/categories/${slug}`, {
      method: 'DELETE',
      headers: {
        'x-csrf-token': csrfToken
      },
      credentials: 'include'
    });

    if (res.ok) {
      await loadAllCategories(); // Refresh parent lookup
      await loadCategories();
    } else {
      const err = await res.json();
      alert(err.message || 'Gagal menghapus kategori');
    }
  }

  function totalPages() {
    return Math.ceil(total / perPage);
  }

  function changePage(delta: number) {
    pageNum += delta;
    loadCategories();
  }

  function goToPage(page: number) {
    pageNum = page;
    loadCategories();
  }
</script>

<section class="categories-page">
  <div class="container">
    <div class="page-header">
      <div class="header-content">
        <h1 class="page-title">Manajemen Kategori</h1>
        <p class="page-subtitle">Kelola semua kategori produk Anda dengan mudah</p>
      </div>
      <button class="btn-primary" on:click={() => goto('/dashboard/categories/create')}>
        <Plus size={16} />
        Tambah Kategori
      </button>
    </div>

    <div class="search-section">
      <form class="search-form" on:submit|preventDefault={handleSearch}>
        <div class="search-input-wrapper">
          <Search size={16} class="search-icon" />
          <input 
            bind:value={search} 
            placeholder="Cari nama kategori..." 
            class="search-input"
          />
        </div>
        <button type="submit" class="btn-search" disabled={loading}>
          {loading ? 'Mencari...' : 'Cari'}
        </button>
      </form>
    </div>

    <div class="content-section">
      {#if loading}
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <p>Memuat data kategori...</p>
        </div>
      {:else if errorMessage}
        <div class="error-state">
          <AlertTriangle size={48} />
          <p class="error-message">{errorMessage}</p>
          <button class="btn-retry" on:click={loadCategories}>Coba Lagi</button>
        </div>
      {:else if categories.length === 0}
        <div class="empty-state">
          <BookOpen size={64} />
          <h3>Belum ada kategori</h3>
          <p>Mulai dengan membuat kategori pertama untuk mengorganisir produk Anda</p>
          <button class="btn-primary" on:click={() => goto('/dashboard/categories/create')}>
            <Plus size={16} />
            Tambah Kategori Pertama
          </button>
        </div>
      {:else}
        <div class="table-container">
          <table class="categories-table">
            <thead>
              <tr>
                <th>Kategori</th>
                <th>Slug</th>
                <th>Parent</th>
                <th>Gambar</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {#each categories as cat}
                <tr class="table-row">
                  <td class="category-name">
                    <div class="category-info">
                      <span class="name">{cat.name}</span>
                    </div>
                  </td>
                  <td class="slug">
                    <code>{cat.slug}</code>
                  </td>
                  <td class="parent">
                    {getParentName(cat.parent_id || cat.parentId || cat.parent)}
                  </td>
                  <td class="image">
                    {#if cat.image}
                      <div class="image-wrapper">
                        <img src={cat.image} alt={cat.name} />
                      </div>
                    {:else}
                      <div class="no-image">
                        <Image size={20} />
                      </div>
                    {/if}
                  </td>
                  <td class="actions">
                    <div class="action-buttons">
                      <button 
                        class="btn-edit" 
                        on:click={() => goto(`/dashboard/categories/edit/${cat.slug}`)}
                        title="Edit kategori"
                      >
                        <Edit size={12} />
                        Edit
                      </button>
                      <button 
                        class="btn-delete" 
                        on:click={() => handleDelete(cat.slug)}
                        title="Hapus kategori"
                      >
                        <Trash2 size={12} />
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <div class="mobile-cards">
          {#each categories as cat}
            <div class="category-card">
              <div class="card-header">
                <div class="category-main">
                  {#if cat.image}
                    <div class="category-image">
                      <img src={cat.image} alt={cat.name} />
                    </div>
                  {:else}
                    <div class="category-placeholder">
                      <Image size={24} />
                    </div>
                  {/if}
                  <div class="category-details">
                    <h4 class="category-name">{cat.name}</h4>
                    <p class="category-slug"><code>{cat.slug}</code></p>
                    {#if cat.parent_id || cat.parentId || cat.parent}
                      <p class="category-parent">
                        Parent: {getParentName(cat.parent_id || cat.parentId || cat.parent)}
                      </p>
                    {/if}
                  </div>
                </div>
                <div class="card-actions">
                  <button 
                    class="btn-edit-mobile" 
                    on:click={() => goto(`/dashboard/categories/edit/${cat.slug}`)}
                    title="Edit kategori"
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    class="btn-delete-mobile" 
                    on:click={() => handleDelete(cat.slug)}
                    title="Hapus kategori"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          {/each}
        </div>

        {#if totalPages() > 1}
          <div class="pagination">
            <button 
              class="btn-pagination btn-prev" 
              on:click={() => changePage(-1)} 
              disabled={pageNum === 1}
              title="Halaman sebelumnya"
            >
              <ChevronLeft size={14} />
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
              <ChevronRight size={14} />
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
