// src/routes/dashboard/categories/edit/[slug]/+page.svelte

<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import './form-page.scss';
  // Import ikon Lucide yang diperlukan
  import ArrowLeft from 'lucide-svelte/icons/arrow-left';
  import AlertTriangle from 'lucide-svelte/icons/alert-triangle';
  import Plus from 'lucide-svelte/icons/plus';
  import Image from 'lucide-svelte/icons/image';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import Save from 'lucide-svelte/icons/save'; // Menggunakan ikon save untuk edit

  /**
   * Represents a category object from the API.
   */
  interface Category {
    id: number;
    slug: string;
    name: string;
    parentId: number | null;
    image: string | null;
  }

  // --- State Management ---
  let name = '';
  let parentId: number | null = null;
  let imageFile: File | null = null;
  let imageUrl: string | null = null; // untuk menampilkan gambar yang sudah ada
  let parentOptions: Category[] = [];
  let loading = true;
  let saving = false;
  let errorMessage = '';

  // Dapatkan slug dari URL
  $: slug = $page.params.slug;

  onMount(async () => {
    try {
      // 1. Ambil data kategori yang akan diedit
      const categoryRes = await fetch(`/api/categories/${slug}`);
      if (!categoryRes.ok) {
        throw new Error('Kategori tidak ditemukan');
      }
      const categoryData = await categoryRes.json();
      const currentCategory = categoryData.data;

      // Isi form dengan data yang ada
      name = currentCategory.name;
      parentId = currentCategory.parentId;
      imageUrl = currentCategory.image;

      // 2. Ambil semua kategori untuk opsi parent, kecuali kategori yang sedang diedit
      const parentRes = await fetch('/api/categories?perPage=100');
      const parentData = await parentRes.json();
      parentOptions = parentData.data.filter((cat: Category) => cat.slug !== slug);
    } catch (err: any) {
      console.error('Failed to load category data:', err);
      errorMessage = err.message || 'Gagal memuat data kategori. Coba muat ulang halaman.';
    } finally {
      loading = false;
    }
  });

  /**
   * Retrieves the CSRF token from the browser cookies.
   */
  function getCSRFTokenFromCookie(): string {
    const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
    return match ? match[1] : '';
  }

  /**
   * Handles the form submission to update a category.
   * It sends a PUT request with form data and CSRF token to the backend.
   */
  async function handleSubmit() {
    if (saving) return;

    saving = true;
    errorMessage = '';

    try {
      const formData = new FormData();
      formData.append('name', name);
      
      if (parentId !== null) {
        formData.append('parent_id', String(parentId));
      }
      
      // Hanya tambahkan gambar ke FormData jika ada file baru yang dipilih
      if (imageFile) {
        formData.append('image', imageFile);
      }

      const csrfToken = getCSRFTokenFromCookie();
      if (!csrfToken) {
        throw new Error('CSRF token not found. Please log in again.');
      }
      
      // Perhatikan: Menggunakan method 'PUT' dan URL yang spesifik
      const res = await fetch(`/api/categories/${slug}`, {
        method: 'PUT',
        body: formData,
        headers: {
          'x-csrf-token': csrfToken
        },
        credentials: 'include'
      });

      if (res.ok) {
        await goto('/dashboard/categories');
      } else {
        const err = await res.json();
        errorMessage = err.message || 'Gagal memperbarui kategori';
      }
    } catch (err) {
      console.error('Submission error:', err);
      if (err instanceof Error) {
        errorMessage = err.message;
      } else {
        errorMessage = 'Terjadi kesalahan saat memperbarui kategori';
      }
    } finally {
      saving = false;
    }
  }

  /**
   * Handles the file input change event for the category image.
   */
  function handleImageChange(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      imageFile = file;
    }
  }

  /**
   * Removes the selected image from the form.
   */
  function removeImage() {
    imageFile = null;
    imageUrl = null;
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  /**
   * Handles the change event for the parent category select input.
   */
  function handleParentChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    const value = target.value;
    
    parentId = value === '' ? null : Number(value);
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
        <h1 class="page-title">Edit Kategori</h1>
        <p class="page-subtitle">Ubah detail kategori produk Anda</p>
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
                bind:value={parentId}
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

              {#if imageFile}
                <div class="current-image">
                  <div class="image-preview">
                    <img src={URL.createObjectURL(imageFile)} alt="Preview" />
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
                  <p class="image-status">Gambar baru yang dipilih</p>
                </div>
              {:else if imageUrl}
                <div class="current-image">
                  <div class="image-preview">
                    <img src={imageUrl} alt="Preview" />
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
                  <p class="image-status">Gambar yang ada</p>
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
                  {imageFile || imageUrl ? 'Ganti Gambar' : 'Pilih Gambar'}
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
                <Save size={16} />
                Simpan Perubahan
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
