<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import './form-page.scss';
  
  let { data } = $props();
  const { product, categories: allCategories } = data;

  let name = product.name || '';
  let description = product.description || '';
  let price: string = product.price?.toString() || '';
  let stock: string = product.stock?.toString() || '';
  let categoryId: string | number = product.categoryId || '';
  let height: string = product.height?.toString() || '';
  let length: string = product.length?.toString() || '';
  let weight: string = product.weight?.toString() || '';
  let width: string = product.width?.toString() || '';
  
  let existingImages: string[] = product.images || [];
  let newImages: File[] = [];
  let imagesToDelete: string[] = [];

  let filteredCategories = allCategories;
  let showCategoryDropdown = false;
  let categorySearchQuery = '';
  let saving = false;
  let errorMessage = '';

  onMount(() => {
    // Cari nama kategori yang sesuai
    const category = allCategories.find(cat => cat.id === product.categoryId);
    if (category) {
      categorySearchQuery = category.name;
    }
  });

  function getCSRFTokenFromCookie(): string {
    const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
    return match ? match[1] : '';
  }

  async function handleSubmit() {
    if (saving) return;
    
    if (!name.trim()) { errorMessage = 'Nama produk harus diisi'; return; }
    if (!price || isNaN(parseFloat(price))) { errorMessage = 'Harga produk harus berupa angka'; return; }
    if (!categoryId) { errorMessage = 'Kategori harus dipilih'; return; }
    if (existingImages.length + newImages.length - imagesToDelete.length === 0) { errorMessage = 'Minimal harus ada satu gambar produk'; return; }

    saving = true;
    errorMessage = '';

    try {
      const slug = get(page).params.slug;
      const formData = new FormData();

      formData.append('name', name.trim());
      formData.append('description', description.trim());
      formData.append('price', price);
      formData.append('stock', stock || '0');
      formData.append('categoryId', String(categoryId));
      
      if (height) formData.append('height', height);
      if (length) formData.append('length', length);
      if (weight) formData.append('weight', weight);
      if (width) formData.append('width', width);

      newImages.forEach((image, index) => { formData.append(`newImages[${index}]`, image); });
      imagesToDelete.forEach((imagePath) => { formData.append('imagesToDelete[]', imagePath); });

      const csrfToken = getCSRFTokenFromCookie();
      const res = await fetch(`/api/products/${slug}`, {
        method: 'PUT',
        body: formData,
        headers: { 'x-csrf-token': csrfToken },
        credentials: 'include'
      });

      if (res.ok) {
        goto('/dashboard/products');
      } else {
        const err = await res.json();
        errorMessage = err.message || 'Gagal memperbarui produk';
      }
    } catch (err) {
      errorMessage = 'Terjadi kesalahan saat memperbarui produk';
      console.error(err);
    } finally {
      saving = false;
    }
  }

  function handleNewImagesChange(e) {
    const files = Array.from(e.target.files || []);
    newImages = [...newImages, ...files];
  }

  function removeExistingImage(imagePath: string) {
    imagesToDelete = [...imagesToDelete, imagePath];
    existingImages = existingImages.filter(img => img !== imagePath);
  }

  function removeNewImage(index: number) {
    newImages = newImages.filter((_, i) => i !== index);
  }

  function handleCategorySearch(e) {
    categorySearchQuery = e.target.value;
    filteredCategories = allCategories.filter(cat => cat.name.toLowerCase().includes(categorySearchQuery.toLowerCase()));
  }

  function selectCategory(category) {
    categoryId = category.id;
    categorySearchQuery = category.name;
    showCategoryDropdown = false;
    filteredCategories = allCategories;
  }

  function handleCategoryInputFocus() {
    showCategoryDropdown = true;
    if (!categorySearchQuery) {
      filteredCategories = allCategories;
    }
  }

  function handleCategoryInputBlur() {
    setTimeout(() => { showCategoryDropdown = false; }, 150);
  }

  function clearCategorySelection() {
    categoryId = '';
    categorySearchQuery = '';
    filteredCategories = allCategories;
  }
</script>

<section class="form-page">
  <div class="container">
    <div class="page-header">
      <div class="breadcrumb">
        <button class="breadcrumb-link" on:click={() => goto('/dashboard/products')}><svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/></svg>Kembali ke Daftar Produk</button>
      </div>
      <div class="header-content"><h1 class="page-title">Edit Produk</h1><p class="page-subtitle">Ubah detail produk yang sudah ada</p></div>
    </div>

    <div class="form-section">
      <form on:submit|preventDefault={handleSubmit}>
        {#if errorMessage}<div class="error-alert"><svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg><span>{errorMessage}</span></div>{/if}

        <div class="form-grid">
          <div class="form-group">
            <label for="name" class="form-label">Nama Produk <span class="required">*</span></label>
            <input id="name" type="text" class="form-input" bind:value={name} placeholder="Masukkan nama produk" required/>
          </div>
          <div class="form-group">
            <label for="description" class="form-label">Deskripsi</label>
            <textarea id="description" class="form-textarea" bind:value={description} placeholder="Masukkan deskripsi produk" rows="4"></textarea>
          </div>
          <div class="form-group">
            <label for="price" class="form-label">Harga <span class="required">*</span></label>
            <input id="price" type="number" class="form-input" bind:value={price} placeholder="0" min="0" step="0.01" required/>
            <small class="form-help">Harga dalam Rupiah</small>
          </div>
          <div class="form-group">
            <label for="stock" class="form-label">Stok</label>
            <input id="stock" type="number" class="form-input" bind:value={stock} placeholder="0" min="0"/>
            <small class="form-help">Jumlah stok yang tersedia</small>
          </div>
          <div class="form-group">
            <label for="category" class="form-label">Kategori <span class="required">*</span></label>
            <div class="category-search-wrapper">
              <input id="category" type="text" class="form-input category-search-input" bind:value={categorySearchQuery} on:input={handleCategorySearch} on:focus={handleCategoryInputFocus} on:blur={handleCategoryInputBlur} placeholder="Cari dan pilih kategori..." required/>
              {#if categoryId}
                <button type="button" class="clear-category-btn" on:click={clearCategorySelection} title="Hapus kategori"><svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/></svg></button>
              {/if}
              {#if showCategoryDropdown && filteredCategories.length > 0}
                <div class="category-dropdown">
                  {#each filteredCategories as category}<button type="button" class="category-option" on:click={() => selectCategory(category)}>{category.name}</button>{/each}
                </div>
              {/if}
            </div>
            <small class="form-help">Cari dan pilih kategori produk</small>
          </div>
          <div class="form-group dimensions-group">
            <label class="form-label">Dimensi & Berat (Opsional)</label>
            <div class="dimensions-grid">
              <div><input type="number" class="form-input" bind:value={height} placeholder="Tinggi (cm)" min="0"/></div>
              <div><input type="number" class="form-input" bind:value={length} placeholder="Panjang (cm)" min="0"/></div>
              <div><input type="number" class="form-input" bind:value={width} placeholder="Lebar (cm)" min="0"/></div>
              <div><input type="number" class="form-input" bind:value={weight} placeholder="Berat (gram)" min="0"/></div>
            </div>
            <small class="form-help">Untuk perhitungan ongkos kirim</small>
          </div>
          <div class="form-group image-group">
            <label class="form-label">Gambar Produk</label>
            <div class="images-preview">
              {#each existingImages as image, index}
                <div class="image-preview existing"><img src={image} alt="Existing {index + 1}" /><div class="image-overlay"><button type="button" class="btn-remove-image" on:click={() => removeExistingImage(image)} title="Hapus gambar"><svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1H2.5z"/></svg></button></div></div>
              {/each}
              {#each newImages as image, index}
                <div class="image-preview new"><img src={URL.createObjectURL(image)} alt="Preview {index + 1}" /><div class="image-overlay"><button type="button" class="btn-remove-image" on:click={() => removeNewImage(index)} title="Hapus gambar baru"><svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1H2.5z"/></svg></button></div></div>
              {/each}
            </div>
            <div class="file-input-wrapper">
              <input id="images" type="file" class="file-input" accept="image/*" multiple on:change={handleNewImagesChange}/>
              <label for="images" class="file-input-label"><svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/><path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z"/></svg>Tambah Gambar</label>
            </div>
            <small class="form-help">Format: JPG, PNG, WEBP, GIF. Maksimal 5MB per gambar. Bisa pilih multiple</small>
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-primary" disabled={saving}>
            {#if saving}<div class="btn-spinner"></div>Menyimpan...{:else}<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12.854.146a.5.5 0 0 0-.707 0L7 5.293 2.854 1.146a.5.5 0 1 0-.707.708L6.293 6 1.146 11.146a.5.5 0 0 0 .708.708L7 6.707l5.146 5.147a.5.5 0 0 0 .708-.708L7.707 6l5.147-5.146a.5.5 0 0 0 0-.708z"/></svg>Perbarui Produk{/if}
          </button>
          <button type="button" class="btn-secondary" on:click={() => goto('/dashboard/products')} disabled={saving}>Batal</button>
        </div>
      </form>
    </div>
  </div>
</section>
