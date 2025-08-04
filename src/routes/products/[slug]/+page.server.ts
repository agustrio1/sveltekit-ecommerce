
import { error } from '@sveltejs/kit';

export async function load({ params, fetch }) {
  const { slug } = params;

  if (!slug) {
    throw error(404, 'Product not found');
  }

  try {
    // Fetch product data using the slug with sold count
    const response = await fetch(`/api/products?slug=${encodeURIComponent(slug)}&withSoldCount=true`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw error(404, 'Product not found');
      }
      throw error(500, 'Failed to load product');
    }

    const result = await response.json();

    if (!result.success || !result.data) {
      throw error(404, 'Product not found');
    }

    return {
      product: result.data
    };
  } catch (err) {
    console.error('Error loading product:', err);
    
    if (err.status) {
      throw err;
    }
    
    throw error(500, 'Failed to load product');
  }
}