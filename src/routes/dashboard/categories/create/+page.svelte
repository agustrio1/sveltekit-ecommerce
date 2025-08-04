<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import './form-page.scss';
  // Import ikon Lucide yang diperlukan
  import ArrowLeft from 'lucide-svelte/icons/arrow-left';
  import AlertTriangle from 'lucide-svelte/icons/alert-triangle';
  import Plus from 'lucide-svelte/icons/plus';
  import Image from 'lucide-svelte/icons/image';
  import Trash2 from 'lucide-svelte/icons/trash-2';

  /**
   * Represents a category object from the API.
   */
  interface Category {
    id: number;
    name: string;
  }

  // --- State Management ---
  let name = '';
  let parent_id: number | null = null;
  let image: File | null = null;
  let parentOptions: Category[] = [];
  let loading = true;
  let saving = false;
  let errorMessage = '';

  onMount(async () => {
    try {
      const res = await fetch('/api/categories?perPage=100');
      const data = await res.json();
      parentOptions = data.data;
    } catch (err) {
      console.error('Failed to load parent categories:', err);
      errorMessage = 'Gagal memuat kategori induk. Coba muat ulang halaman.';
    } finally {
      loading = false;
    }
  });

  /**
   * Retrieves the CSRF token from the browser cookies.
   * This token is set by the login API and is used to protect against CSRF attacks.
   * @returns {string} The CSRF token string, or an empty string if not found.
   */
  function getCSRFTokenFromCookie(): string {
    const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
    return match ? match[1] : '';
  }

  /**
   * Handles the form submission to create a new category.
   * It sends a POST request with form data and CSRF token to the backend.
   */
  async function handleSubmit() {
    if (saving) return;

    saving = true;
    errorMessage = '';

    try {
      const formData = new FormData();
      formData.append('name', name);
      
      if (parent_id !== null) {
        formData.append('parent_id', String(parent_id));
      }
      
      if (image) formData.append('image', image);

      const csrfToken = getCSRFTokenFromCookie();
      if (!csrfToken) {
        throw new Error('CSRF token not found. Please log in again.');
      }
      
      const res = await fetch('/api/categories', {
        method: 'POST',
        body: formData,
        headers: {
          'x-csrf-token': csrfToken
        },
        credentials: 'include'
      });

      if (res.ok) {
        goto('/dashboard/categories');
      } else {
        const err = await res.json();
        errorMessage = err.message || 'Gagal menambahkan kategori';
      }
    } catch (err) {
      console.error('Submission error:', err);
      if (err instanceof Error) {
        errorMessage = err.message;
      } else {
        errorMessage = 'Terjadi kesalahan saat menambahkan kategori';
      }
    } finally {
      saving = false;
    }
  }

  /**
   * Handles the file input change event for the category image.
   * @param {Event} e - The DOM event.
   */
  function handleImageChange(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      image = file;
    }
  }

  /**
   * Removes the selected image from the form.
   */
  function removeImage() {
    image = null;
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  /**
   * Handles the change event for the parent category select input.
   * @param {Event} e - The DOM event.
   */
  function handleParentChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    const value = target.value;
    
    parent_id = value === '' ? null : Number(value);
  }
</script>

<section class="form-page">
  <div class="container">
    <div class="page-header">
      <div class="breadcrumb">
        <button class="breadcrumb-link" on:click={() => goto('/dashboard/categories')}>
          <ArrowLeft size={16} />
          Kembali ke Daftar Kategori
        </button>
      </div>
      <div class="header-content">
        <h1 class="page-title">Tambah Kategori Baru</h1>
        <p class="page-subtitle">Buat kategori baru untuk mengorganisir produk Anda</p>
      </div>
    </div>

    {#if loading}
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Memuat data...</p>
      </div>
    {:else}
      <div class="form-section">
        <form class="category-form" on:submit|preventDefault={handleSubmit}>
          {#if errorMessage}
            <div class="error-alert">
              <AlertTriangle size={20} />
              <span>{errorMessage}</span>
            </div>
          {/if}

          <div class="form-grid">
            <div class="form-group">
              <label for="name" class="form-label">Nama Kategori <span class="required">*</span></label>
              <input
                id="name"
                type="text"
                class="form-input"
                bind:value={name}
                placeholder="Masukkan nama kategori"
                required
              />
            </div>

            <div class="form-group">
              <label for="parent_id" class="form-label">Parent Kategori</label>
              <select
                id="parent_id"
                class="form-select"
                bind:value={parent_id}
                on:change={handleParentChange}
              >
                <option value={null}>-- Tidak ada parent --</option>
                {#each parentOptions as cat (cat.id)}
                  <option value={cat.id}>{cat.name}</option>
                {/each}
              </select>
              <small class="form-help">Pilih kategori induk jika ini adalah sub-kategori</small>
            </div>

            <div class="form-group image-group">
              <label class="form-label">Gambar Kategori</label>

              {#if image}
                <div class="current-image">
                  <div class="image-preview">
                    <img src={URL.createObjectURL(image)} alt="Preview" />
                    <div class="image-overlay">
                      <button
                        type="button"
                        class="btn-remove-image"
                        on:click={removeImage}
                        title="Hapus gambar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <p class="image-status">Gambar yang dipilih</p>
                </div>
              {/if}

              <div class="file-input-wrapper">
                <input
                  id="image"
                  type="file"
                  class="file-input"
                  accept="image/*"
                  on:change={handleImageChange}
                />
                <label for="image" class="file-input-label">
                  <Image size={20} />
                  {image ? 'Ganti Gambar' : 'Pilih Gambar'}
                </label>
              </div>
              <small class="form-help">Format: JPG, PNG, GIF. Maksimal 2MB</small>
            </div>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn-primary" disabled={saving}>
              {#if saving}
                <div class="btn-spinner"></div>
                Menyimpan...
              {:else}
                <Plus size={16} />
                Tambah Kategori
              {/if}
            </button>
            <button
              type="button"
              class="btn-secondary"
              on:click={() => goto('/dashboard/categories')}
              disabled={saving}
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    {/if}
  </div>
</section>
