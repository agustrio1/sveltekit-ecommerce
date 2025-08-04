import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export interface CartItem {
	productId: number;
	quantity: number;
	addedAt: number;
	id: number;
	name: string;
	slug: string;
	price: number;
	stock: number;
	image?: string;
	isAvailable: boolean;
	totalPrice: number;
}

export interface CartData {
	items: CartItem[];
	totalItems: number;
	totalPrice: number;
	sessionId: string | null;
}

interface CartState {
	data: CartData;
	loading: boolean;
	error: string | null;
}

const initialState: CartState = {
	data: {
		items: [],
		totalItems: 0,
		totalPrice: 0,
		sessionId: null
	},
	loading: false,
	error: null
};

// Create the cart store
function createCartStore() {
	const { subscribe, set, update } = writable<CartState>(initialState);

	return {
		subscribe,
		
		// Load cart from server
		async load() {
			if (!browser) return;
			
			update(state => ({ ...state, loading: true, error: null }));
			
			try {
				const response = await fetch('/api/cart');
				const result = await response.json();
				
				if (result.success) {
					update(state => ({
						...state,
						data: result.data,
						loading: false
					}));
				} else {
					throw new Error(result.message || 'Failed to load cart');
				}
			} catch (error) {
				console.error('Error loading cart:', error);
				update(state => ({
					...state,
					loading: false,
					error: error instanceof Error ? error.message : 'Failed to load cart'
				}));
			}
		},

		// Add item to cart
		async addItem(productId: number, quantity: number = 1) {
			if (!browser) return;
			
			update(state => ({ ...state, loading: true, error: null }));
			
			try {
				const response = await fetch('/api/cart', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ productId, quantity })
				});
				
				const result = await response.json();
				
				if (result.success) {
					update(state => ({
						...state,
						data: result.data,
						loading: false
					}));
					return { success: true, message: result.message };
				} else {
					throw new Error(result.message || 'Failed to add item to cart');
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Failed to add item to cart';
				update(state => ({
					...state,
					loading: false,
					error: errorMessage
				}));
				return { success: false, message: errorMessage };
			}
		},

		// Update item quantity
		async updateItem(productId: number, quantity: number) {
			if (!browser) return;
			
			update(state => ({ ...state, loading: true, error: null }));
			
			try {
				const response = await fetch('/api/cart', {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ productId, quantity })
				});
				
				const result = await response.json();
				
				if (result.success) {
					update(state => ({
						...state,
						data: result.data,
						loading: false
					}));
					return { success: true, message: result.message };
				} else {
					throw new Error(result.message || 'Failed to update cart item');
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Failed to update cart item';
				update(state => ({
					...state,
					loading: false,
					error: errorMessage
				}));
				return { success: false, message: errorMessage };
			}
		},

		// Remove item from cart
		async removeItem(productId: number) {
			if (!browser) return;
			
			update(state => ({ ...state, loading: true, error: null }));
			
			try {
				const response = await fetch(`/api/cart?productId=${productId}`, {
					method: 'DELETE'
				});
				
				const result = await response.json();
				
				if (result.success) {
					update(state => ({
						...state,
						data: result.data,
						loading: false
					}));
					return { success: true, message: result.message };
				} else {
					throw new Error(result.message || 'Failed to remove item from cart');
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Failed to remove item from cart';
				update(state => ({
					...state,
					loading: false,
					error: errorMessage
				}));
				return { success: false, message: errorMessage };
			}
		},

		// Clear entire cart
		async clearCart() {
			if (!browser) return;
			
			update(state => ({ ...state, loading: true, error: null }));
			
			try {
				const response = await fetch('/api/cart?clearAll=true', {
					method: 'DELETE'
				});
				
				const result = await response.json();
				
				if (result.success) {
					update(state => ({
						...state,
						data: result.data,
						loading: false
					}));
					return { success: true, message: result.message };
				} else {
					throw new Error(result.message || 'Failed to clear cart');
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Failed to clear cart';
				update(state => ({
					...state,
					loading: false,
					error: errorMessage
				}));
				return { success: false, message: errorMessage };
			}
		},

		// Clear error
		clearError() {
			update(state => ({ ...state, error: null }));
		},

		// Reset store
		reset() {
			set(initialState);
		}
	};
}

export const cartStore = createCartStore();

// Derived stores for easier access
export const cartItems = derived(cartStore, $cart => $cart.data.items);
export const cartTotal = derived(cartStore, $cart => $cart.data.totalPrice);
export const cartCount = derived(cartStore, $cart => $cart.data.totalItems);
export const cartLoading = derived(cartStore, $cart => $cart.loading);
export const cartError = derived(cartStore, $cart => $cart.error);

// Helper functions
export function formatPrice(price: number): string {
	return new Intl.NumberFormat('id-ID', {
		style: 'currency',
		currency: 'IDR',
		minimumFractionDigits: 0
	}).format(price);
}

export function getItemByProductId(items: CartItem[], productId: number): CartItem | undefined {
	return items.find(item => item.productId === productId);
}

export function isProductInCart(items: CartItem[], productId: number): boolean {
	return items.some(item => item.productId === productId);
}