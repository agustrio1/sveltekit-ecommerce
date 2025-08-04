import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, params }) => {
  const { slug } = params;

  try {
    const productRes = await fetch(`/api/products?slug=${slug}`);
    if (!productRes.ok) {
      throw error(productRes.status, 'Produk tidak ditemukan');
    }
    const productData = await productRes.json();

    // Ambil data kategori
    const categoriesRes = await fetch('/api/categories?perPage=1000');
    if (!categoriesRes.ok) {
      throw error(categoriesRes.status, 'Gagal memuat kategori');
    }
    const categoriesData = await categoriesRes.json();
    
    // Kembalikan kedua data untuk digunakan di komponen Svelte
    return {
      product: productData,
      categories: categoriesData.data || []
    };
  } catch (e) {
    if (e.status === 404) {
      throw error(404, 'Produk tidak ditemukan.');
    }
    throw error(500, 'Gagal memuat data produk.');
  }
};
