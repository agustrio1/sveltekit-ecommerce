<script lang="ts">
  import {
    Search,
    ShoppingCart,
    Home,
    CreditCard,
    User
  } from 'lucide-svelte';
  import {
    goto
  } from '$app/navigation';
  import {
    page
  } from '$app/stores';
  import './top-navbar.scss';

  export let user: any = null;

  let searchQuery = '';

  // Menu items untuk desktop
  const menuItems = [{
    path: '/',
    icon: Home,
    label: 'Home'
  },
    {
      path: '/transactions',
      icon: CreditCard,
      label: 'Transaksi'
    },
    {
      path: '/account',
      icon: User,
      label: user?.role === 'admin' ? 'Dashboard': 'Akun'
    }];

  function handleSearch() {
    if (searchQuery.trim()) {
      goto(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  }

  function navigateToMenu(path: string) {
    goto(path);
  }

  $: currentPath = $page.url.pathname;
</script>

<nav class="top-navbar">
  <div class="top-navbar__container">
    <!-- Logo -->
    <div class="top-navbar__logo">
      <a href="/" class="logo-link">
        <span class="logo-text">ShopApp</span>
      </a>
    </div>

    <!-- Desktop Menu -->
    <div class="top-navbar__menu">
      {#each menuItems as item}
      <button
        class="menu-item {currentPath === item.path ? 'active': ''}"
        on:click={() => navigateToMenu(item.path)}
        type="button"
        >
        <svelte:component this={item.icon} size={18} />
        <span>{item.label}</span>
        </button>
        {/each}
        </div>

        <!-- Search Bar (Desktop) -->
        <div class="top-navbar__search">
          <div class="search-container">
            <input
            type="text"
            placeholder="Cari produk..."
            bind:value={searchQuery}
            on:keydown={(e) => e.key === 'Enter' && handleSearch()}
            class="search-input"
            />
          <button
            class="search-button"
            on:click={handleSearch}
            type="button"
            >
            <Search size={18} />
          </button>
        </div>
      </div>

      <div class="top-navbar__actions">
        <button class="action-button cart-button" on:click={() => goto('/cart')} type="button">
          <ShoppingCart size={20} />
          <span class="cart-badge">0</span>
        </button>
      </div>
    </div>

    <!-- Mobile Search -->
    <div class="mobile-search">
      <div class="search-container">
        <input
        type="text"
        placeholder="Cari produk..."
        bind:value={searchQuery}
        on:keydown={(e) => e.key === 'Enter' && handleSearch()}
        class="search-input"
        />
      <button
        class="search-button"
        on:click={handleSearch}
        type="button"
        >
        <Search size={18} />
      </button>
    </div>
  </div>
</nav>