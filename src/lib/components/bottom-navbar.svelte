<script lang="ts">
  import {
    Home,
    ShoppingCart,
    FileText,
    User
  } from 'lucide-svelte';
  import {
    page
  } from '$app/stores';
  import {
    goto
  } from '$app/navigation';
  import './bottom-navbar.scss';

  export let user: any = null;

  $: currentPath = $page.url.pathname;
  $: accountLabel = user?.role === 'admin' ? 'Dashboard': 'Akun';

  function isActive(path: string): boolean {
    if (path === '/') return currentPath === '/';
    return currentPath.startsWith(path);
  }

  function handleNavigation(path: string) {
    if (path === '/account') {
      if (user?.role === 'admin') {
        goto('/dashboard');
      } else {
        goto('/profile');
      }
    } else {
      goto(path);
    }
  }

  $: navItems = [{
    path: '/',
    icon: Home,
    label: 'Home',
    badge: null
  },
    {
      path: '/cart',
      icon: ShoppingCart,
      label: 'Keranjang',
      badge: 0 // Ganti ini dengan jumlah item cart nanti
    },
    {
      path: '/transactions',
      icon: FileText,
      label: 'Transaksi',
      badge: null
    },
    {
      path: '/account',
      icon: User,
      label: accountLabel,
      badge: null
    }];
</script>

<nav class="bottom-navbar">
  <div class="bottom-navbar__container">
    {#each navItems as item}
    <button
      class="nav-item"
      class:nav-item--active={isActive(item.path)}
      on:click={() => handleNavigation(item.path)}
      type="button"
      >
      <div class="nav-item__icon">
        <svelte:component this={item.icon} size={22} />
        {#if item.badge}
        <span class="nav-badge">{item.badge}</span>
        {/if }
        </div>
        <span class="nav-item__label">{item.label}</span>
        </button>
        {/each}
        </div>
      </nav>