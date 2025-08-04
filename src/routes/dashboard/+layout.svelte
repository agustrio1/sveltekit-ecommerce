<style lang="scss">
  @use './dashboard-layout.scss';
</style>

<script lang="ts">
  import {
    page
  } from '$app/stores';
  import type {
    LayoutData
  } from './$types';
  import {
    LayoutDashboard,
    Package,
    Layers,
    ShoppingCart,
    Users,
    Settings,
    Menu,
    X,
    ChevronLeft
  } from 'lucide-svelte';

  export let data: LayoutData;

  let sidebar_open = false;
  let sidebar_collapsed = false;

  const toggleSidebarMobile = () => {
    sidebar_open = !sidebar_open;
  };

  const toggleSidebarDesktop = () => {
    sidebar_collapsed = !sidebar_collapsed;
  };

  const closeSidebar = () => {
    sidebar_open = false;
  };

  const menu = [{
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard
  },
    {
      href: '/dashboard/products',
      label: 'Produk',
      icon: Package
    },
    {
      href: '/dashboard/categories',
      label: 'Kategori',
      icon: Layers
    },
    {
      href: '/dashboard/orders',
      label: 'Pesanan',
      icon: ShoppingCart
    },
    {
      href: '/dashboard/users',
      label: 'User',
      icon: Users
    },
    {
      href: '/dashboard/settings',
      label: 'Pengaturan',
      icon: Settings
    }];
</script>

<div class="dashboard_layout">
  <!-- Mobile Header -->
  <header class="mobile_header">
    <button class="hamburger_btn" on:click={toggleSidebarMobile} aria-label="Toggle menu">
      <Menu size={24} />
    </button>
    <h1 class="mobile_title">Admin Panel</h1>
  </header>

  <!-- Sidebar -->
  <aside
    class="dashboard_sidebar"
    class:sidebar_open={sidebar_open}
    class:sidebar_collapsed={sidebar_collapsed}
    >
    <div class="sidebar_header">
      <div class="brand_container">
        <h1 class="brand" class:hidden={sidebar_collapsed}>Admin Panel</h1>
        <div class="brand_icon" class:visible={sidebar_collapsed}>
          AP
        </div>
      </div>

      <!-- Desktop collapse button -->
      <button
        class="toggle_desktop"
        on:click={toggleSidebarDesktop}
        aria-label="Toggle sidebar"
        >
        <div class="chevron-wrapper" class:rotated={sidebar_collapsed}>
          <ChevronLeft size={20} />
        </div>
      </button>

      <!-- Mobile close button -->
      <button
        class="toggle_mobile"
        on:click={closeSidebar}
        aria-label="Close menu"
        >
        <X size={24} />
      </button>
    </div>

    <nav class="sidebar_menu">
      {#each menu as item}
      <a
      href={item.href}
      class:selected={$page.url.pathname === item.href || ($page.url.pathname.startsWith(item.href) && item.href !== '/dashboard')}
      class="sidebar_link"
      on:click={closeSidebar}
      >
      <div class="icon_wrapper">
        <svelte:component this={item.icon} size={20} class="sidebar_icon" />
      </div>
      <span class="sidebar_label" class:hidden={sidebar_collapsed}>{item.label}</span>
      </a>
      {/each}
      </nav>
    </aside>

    <!-- Overlay -->
    {#if sidebar_open}
    <div class="overlay" on:click={closeSidebar} on:keydown={(e) => e.key === 'Escape' && closeSidebar()}>
  </div>
  {/if }

  <!-- Main Content -->
  <main class="dashboard_main" class:shifted={!sidebar_collapsed}>
    <slot />
  </main>
</div>