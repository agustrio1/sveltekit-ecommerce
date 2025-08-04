<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import TopNavbar from '../lib/components/top-navbar.svelte';
  import BottomNavbar from '../lib/components/bottom-navbar.svelte';
  import type { LayoutData } from './$types';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { cartStore } from '$lib/stores/cart';

  export let data: LayoutData;

  $: user = data.user;
  
  $: excludeNavbarPages = [
    '/login',
    '/register',
    '/dashboard',
    '/dashboard/',
    '/profile'
  ];
  
  $: isExcludedPage = excludeNavbarPages.some(excludedPath => 
    $page.url.pathname.startsWith(excludedPath)
  );

  function handleAccountNavigation() {
    if (user) {
      if (user.role === 'admin') {
        goto('/dashboard');
      } else {
        goto('/profile');
      }
    } else {
      goto('/login');
    }
  }
  
  
  //cart
  
  onMount(() => {
    if (browser) {
      cartStore.load();
    }
  });
</script>

<svelte:head>
  <title>E-Commerce App</title>
</svelte:head>

<div class="app-container">
  {#if !isExcludedPage}
    <TopNavbar {user} />
  {/if}
  
  <main class="main-content" class:with-navbar={!isExcludedPage}>
    <slot />
  </main>
  
  {#if !isExcludedPage}
    <BottomNavbar {user} on:account-click={handleAccountNavigation} />
  {/if}
</div>

<style>
  .app-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  
  .main-content {
    flex: 1;
    padding-bottom: 80px; /* Space for bottom navbar */
  }
  
  .main-content.with-navbar {
    padding-top: 60px; /* Space for top navbar */
  }
  
  @media (min-width: 768px) {
    .main-content {
      padding-bottom: 0;
    }
  }
</style>