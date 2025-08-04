<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { 
		cartStore, 
		cartItems, 
		cartTotal, 
		cartCount, 
		cartLoading, 
		cartError,
		formatPrice,
		type CartItem 
	} from '$lib/stores/cart';
	import { 
		ShoppingCart, 
		Plus, 
		Minus, 
		Trash2, 
		ShoppingBag, 
		ArrowLeft,
		AlertCircle,
		Loader2
	} from 'lucide-svelte';

	let showDeleteConfirm = false;
	let itemToDelete: number | null = null;
	let isUpdating = false;

	onMount(() => {
		cartStore.load();
	});

	async function updateQuantity(productId: number, newQuantity: number) {
		if (isUpdating) return;
		
		isUpdating = true;
		try {
			if (newQuantity === 0) {
				await cartStore.removeItem(productId);
			} else {
				await cartStore.updateItem(productId, newQuantity);
			}
		} finally {
			isUpdating = false;
		}
	}

	async function removeItem(productId: number) {
		if (isUpdating) return;
		
		isUpdating = true;
		try {
			await cartStore.removeItem(productId);
			showDeleteConfirm = false;
			itemToDelete = null;
		} finally {
			isUpdating = false;
		}
	}

	async function clearCart() {
		if (isUpdating) return;
		
		isUpdating = true;
		try {
			await cartStore.clearCart();
		} finally {
			isUpdating = false;
		}
	}

	function confirmDelete(productId: number) {
		itemToDelete = productId;
		showDeleteConfirm = true;
	}

	function cancelDelete() {
		showDeleteConfirm = false;
		itemToDelete = null;
	}

	function goToProducts() {
		goto('/products');
	}

	function goToCheckout() {
		goto('/checkout');
	}

	function goBack() {
		history.back();
	}
</script>

<svelte:head>
	<title>Keranjang Belanja</title>
</svelte:head>

<div class="cart-page">
	<!-- Header -->
	<header class="cart-header">
		<div class="container">
			<button class="back-btn" on:click={goBack} aria-label="Kembali">
				<ArrowLeft size={20} />
			</button>
			<h1 class="cart-title">
				<ShoppingCart size={24} />
				Keranjang Belanja
				{#if $cartCount > 0}
					<span class="cart-count">({$cartCount})</span>
				{/if}
			</h1>
		</div>
	</header>

	<main class="cart-main">
		<div class="container">
			{#if $cartError}
				<div class="error-message">
					<AlertCircle size={20} />
					<span>{$cartError}</span>
					<button on:click={() => cartStore.clearError()}>Tutup</button>
				</div>
			{/if}

			{#if $cartLoading}
				<div class="loading-state">
					<Loader2 size={32} class="spin" />
					<p>Memuat keranjang...</p>
				</div>
			{:else if $cartItems.length === 0}
				<!-- Empty Cart State -->
				<div class="empty-cart">
					<div class="empty-cart-icon">
						<ShoppingBag size={80} />
					</div>
					<h2>Keranjang Belanja Kosong</h2>
					<p>Yuk, isi dengan barang-barang impianmu!</p>
					<button class="btn btn-primary" on:click={goToProducts}>
						<ShoppingCart size={20} />
						Mulai Belanja
					</button>
				</div>
			{:else}
				<!-- Cart Items -->
				<div class="cart-content">
					<div class="cart-items">
						<div class="cart-header-actions">
							<h2>Produk dalam Keranjang</h2>
							<button 
								class="btn btn-text btn-danger" 
								on:click={clearCart}
								disabled={isUpdating}
							>
								<Trash2 size={16} />
								Kosongkan Keranjang
							</button>
						</div>

						{#each $cartItems as item (item.productId)}
							<div class="cart-item" class:unavailable={!item.isAvailable}>
								<div class="item-image">
									{#if item.images && item.images.length > 0}
										<img 
											src={item.images[0]} 
											alt={item.name}
											loading="lazy"
										/>
									{:else}
										<div class="no-image">
											<ShoppingBag size={32} />
										</div>
									{/if}
								</div>

								<div class="item-details">
									<h3 class="item-name">{item.name}</h3>
									<div class="item-price">
										{formatPrice(item.price)}
									</div>
									{#if !item.isAvailable}
										<div class="item-status unavailable">
											<AlertCircle size={14} />
											Stok tidak tersedia
										</div>
									{:else if item.stock < 5}
										<div class="item-status low-stock">
											Tersisa {item.stock} pcs
										</div>
									{/if}
								</div>

								<div class="item-actions">
									<div class="quantity-controls">
										<button 
											class="qty-btn" 
											on:click={() => updateQuantity(item.productId, item.quantity - 1)}
											disabled={isUpdating || item.quantity <= 1}
											aria-label="Kurangi jumlah"
										>
											<Minus size={16} />
										</button>
										<span class="quantity">{item.quantity}</span>
										<button 
											class="qty-btn" 
											on:click={() => updateQuantity(item.productId, item.quantity + 1)}
											disabled={isUpdating || item.quantity >= 10 || item.quantity >= item.stock}
											aria-label="Tambah jumlah"
										>
											<Plus size={16} />
										</button>
									</div>

									<button 
										class="remove-btn" 
										on:click={() => confirmDelete(item.productId)}
										disabled={isUpdating}
										aria-label="Hapus produk"
									>
										<Trash2 size={16} />
									</button>
								</div>

								<div class="item-total">
									{formatPrice(item.totalPrice)}
								</div>
							</div>
						{/each}
					</div>

					<!-- Cart Summary -->
					<div class="cart-summary">
						<div class="summary-card">
							<h3>Ringkasan Belanja</h3>
							
							<div class="summary-row">
								<span>Total Produk</span>
								<span>{$cartCount} barang</span>
							</div>
							
							<div class="summary-row total">
								<span>Total Harga</span>
								<span class="total-price">{formatPrice($cartTotal)}</span>
							</div>

							<button 
								class="btn btn-primary btn-checkout" 
								on:click={goToCheckout}
								disabled={$cartItems.some(item => !item.isAvailable)}
							>
								Beli Sekarang
							</button>

							<p class="checkout-note">
								*Harga sudah termasuk PPN dan biaya layanan
							</p>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</main>

	<!-- Delete Confirmation Modal -->
	{#if showDeleteConfirm}
		<div class="modal-overlay" on:click={cancelDelete}>
			<div class="modal" on:click|stopPropagation>
				<h3>Hapus Produk</h3>
				<p>Apakah Anda yakin ingin menghapus produk ini dari keranjang?</p>
				<div class="modal-actions">
					<button class="btn btn-secondary" on:click={cancelDelete}>
						Batal
					</button>
					<button 
						class="btn btn-danger" 
						on:click={() => itemToDelete && removeItem(itemToDelete)}
						disabled={isUpdating}
					>
						{#if isUpdating}
							<Loader2 size={16} class="spin" />
						{:else}
							<Trash2 size={16} />
						{/if}
						Hapus
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style lang="scss">
	@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

	// Variables
	:global(:root) {
		--primary-color: #42b883;
		--primary-dark: #369870;
		--secondary-color: #f8f9fa;
		--danger-color: #dc3545;
		--warning-color: #ffc107;
		--text-primary: #212529;
		--text-secondary: #6c757d;
		--text-muted: #9ca3af;
		--border-color: #e9ecef;
		--border-radius: 8px;
		--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
		--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
		--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
		--container-max-width: 1200px;
		--header-height: 60px;
	}

	* {
		box-sizing: border-box;
	}

	.cart-page {
		font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
		background-color: #f5f7fa;
		min-height: 100vh;
		padding-bottom: 2rem;
	}

	.container {
		max-width: var(--container-max-width);
		margin: 0 auto;
		padding: 0 1rem;

		@media (max-width: 768px) {
			padding: 0 0.75rem;
		}
	}

	// Header
	.cart-header {
		background: white;
		border-bottom: 1px solid var(--border-color);
		position: sticky;
		top: 0;
		z-index: 10;
		height: var(--header-height);

		.container {
			display: flex;
			align-items: center;
			height: 100%;
			gap: 1rem;
		}
	}

	.back-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border: none;
		background: none;
		border-radius: 50%;
		cursor: pointer;
		transition: background-color 0.2s;

		&:hover {
			background-color: var(--secondary-color);
		}
	}

	.cart-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;

		.cart-count {
			color: var(--text-secondary);
			font-weight: 400;
		}
	}

	// Main Content
	.cart-main {
		padding: 2rem 0;

		@media (max-width: 768px) {
			padding: 1rem 0;
		}
	}

	// Loading State
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		text-align: center;

		:global(.spin) {
			animation: spin 1s linear infinite;
		}

		p {
			margin-top: 1rem;
			color: var(--text-secondary);
		}
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	// Error Message
	.error-message {
		background: #fee;
		border: 1px solid #fcc;
		border-radius: var(--border-radius);
		padding: 1rem;
		margin-bottom: 2rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--danger-color);

		button {
			margin-left: auto;
			background: none;
			border: none;
			color: var(--danger-color);
			cursor: pointer;
			text-decoration: underline;
		}
	}

	// Empty Cart
	.empty-cart {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		text-align: center;
		background: white;
		border-radius: var(--border-radius);
		box-shadow: var(--shadow-sm);

		.empty-cart-icon {
			color: var(--text-muted);
			margin-bottom: 2rem;
		}

		h2 {
			font-size: 1.5rem;
			font-weight: 600;
			color: var(--text-primary);
			margin: 0 0 0.5rem 0;
		}

		p {
			color: var(--text-secondary);
			margin: 0 0 2rem 0;
		}
	}

	// Cart Content
	.cart-content {
		display: grid;
		grid-template-columns: 1fr 350px;
		gap: 2rem;

		@media (max-width: 1024px) {
			grid-template-columns: 1fr;
		}
	}

	.cart-items {
		background: white;
		border-radius: var(--border-radius);
		box-shadow: var(--shadow-sm);
		overflow: hidden;
	}

	.cart-header-actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 1px solid var(--border-color);

		h2 {
			font-size: 1.125rem;
			font-weight: 600;
			margin: 0;
		}
	}

	// Cart Item
	.cart-item {
		display: grid;
		grid-template-columns: 80px 1fr auto auto;
		gap: 1rem;
		padding: 1.5rem;
		border-bottom: 1px solid var(--border-color);
		align-items: center;

		&:last-child {
			border-bottom: none;
		}

		&.unavailable {
			opacity: 0.6;
			background-color: #fafafa;
		}

		@media (max-width: 768px) {
			grid-template-columns: 60px 1fr;
			grid-template-rows: auto auto;
			gap: 0.75rem;

			.item-actions {
				grid-column: 1 / -1;
				justify-self: stretch;
			}

			.item-total {
				grid-column: 1 / -1;
				justify-self: end;
			}
		}
	}

	.item-image {
		width: 80px;
		height: 80px;
		border-radius: var(--border-radius);
		overflow: hidden;
		background: var(--secondary-color);

		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}

		.no-image {
			display: flex;
			align-items: center;
			justify-content: center;
			height: 100%;
			color: var(--text-muted);
		}

		@media (max-width: 768px) {
			width: 60px;
			height: 60px;
		}
	}

	.item-details {
		min-width: 0;
	}

	.item-name {
		font-size: 1rem;
		font-weight: 500;
		color: var(--text-primary);
		margin: 0 0 0.25rem 0;
		line-height: 1.4;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.item-price {
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--primary-color);
		margin-bottom: 0.25rem;
	}

	.item-status {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.75rem;
		font-weight: 500;

		&.unavailable {
			color: var(--danger-color);
		}

		&.low-stock {
			color: var(--warning-color);
		}
	}

	.item-actions {
		display: flex;
		align-items: center;
		gap: 1rem;

		@media (max-width: 768px) {
			justify-content: space-between;
		}
	}

	.quantity-controls {
		display: flex;
		align-items: center;
		border: 1px solid var(--border-color);
		border-radius: var(--border-radius);
		overflow: hidden;
	}

	.qty-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border: none;
		background: white;
		cursor: pointer;
		transition: background-color 0.2s;

		&:hover:not(:disabled) {
			background-color: var(--secondary-color);
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}

	.quantity {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 40px;
		height: 32px;
		border-left: 1px solid var(--border-color);
		border-right: 1px solid var(--border-color);
		font-weight: 500;
		background: white;
	}

	.remove-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border: none;
		background: none;
		color: var(--danger-color);
		cursor: pointer;
		border-radius: var(--border-radius);
		transition: background-color 0.2s;

		&:hover:not(:disabled) {
			background-color: rgba(220, 53, 69, 0.1);
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}

	.item-total {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text-primary);
		text-align: right;
	}

	// Cart Summary
	.cart-summary {
		@media (max-width: 1024px) {
			position: sticky;
			bottom: 0;
			background: white;
			padding: 1rem 0;
			margin: 0 -1rem;
			border-top: 1px solid var(--border-color);
			z-index: 5;
		}
	}

	.summary-card {
		background: white;
		border-radius: var(--border-radius);
		box-shadow: var(--shadow-sm);
		padding: 1.5rem;

		@media (max-width: 1024px) {
			border-radius: 0;
			box-shadow: none;
			padding: 1rem;
		}

		h3 {
			font-size: 1.125rem;
			font-weight: 600;
			margin: 0 0 1rem 0;
		}
	}

	.summary-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--border-color);

		&.total {
			border-bottom: none;
			padding-top: 1rem;
			font-weight: 600;
			font-size: 1.125rem;

			.total-price {
				color: var(--primary-color);
			}
		}

		&:last-of-type {
			border-bottom: none;
		}
	}

	.checkout-note {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin: 0.5rem 0 0 0;
		text-align: center;
	}

	// Buttons
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: var(--border-radius);
		font-size: 0.875rem;
		font-weight: 500;
		text-decoration: none;
		cursor: pointer;
		transition: all 0.2s;
		line-height: 1;

		&:disabled {
			opacity: 0.6;
			cursor: not-allowed;
		}

		&.btn-primary {
			background-color: var(--primary-color);
			color: white;

			&:hover:not(:disabled) {
				background-color: var(--primary-dark);
			}
		}

		&.btn-secondary {
			background-color: var(--secondary-color);
			color: var(--text-primary);
			border: 1px solid var(--border-color);

			&:hover:not(:disabled) {
				background-color: #e9ecef;
			}
		}

		&.btn-danger {
			background-color: var(--danger-color);
			color: white;

			&:hover:not(:disabled) {
				background-color: #c82333;
			}
		}

		&.btn-text {
			background: none;
			padding: 0.5rem;

			&.btn-danger {
				color: var(--danger-color);
				background: none;

				&:hover:not(:disabled) {
					background-color: rgba(220, 53, 69, 0.1);
				}
			}
		}

		&.btn-checkout {
			width: 100%;
			margin-top: 1rem;
			padding: 1rem;
			font-size: 1rem;
		}
	}

	// Modal
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.modal {
		background: white;
		border-radius: var(--border-radius);
		padding: 2rem;
		max-width: 400px;
		width: 100%;
		box-shadow: var(--shadow-lg);

		h3 {
			margin: 0 0 1rem 0;
			font-size: 1.25rem;
			font-weight: 600;
		}

		p {
			margin: 0 0 2rem 0;
			color: var(--text-secondary);
			line-height: 1.5;
		}
	}

	.modal-actions {
		display: flex;
		gap: 1rem;
		justify-content: flex-end;

		@media (max-width: 480px) {
			flex-direction: column;
		}
	}
</style>