<script lang="ts">
  import {
    Package,
    ClipboardList,
    Users
  } from 'lucide-svelte';

  const stats = [{
    title: 'Total Produk',
    icon: Package,
    value: 154,
    color: '#3b82f6'
  },
    {
      title: 'Total Pesanan',
      icon: ClipboardList,
      value: 89,
      color: '#10b981'
    },
    {
      title: 'Total Pengguna',
      icon: Users,
      value: 420,
      color: '#f59e0b'
    }];
</script>

<style lang="scss">
  @use './dashboard-page.scss';
</style>

<section class="dashboard_home">
  <h2 class="dashboard_title">Selamat datang di Admin Dashboard</h2>

  <div class="dashboard_cards">
    {#each stats as stat}
    <div class="card">
      <div class="card_icon" style="background-color: {stat.color}1A;">
        <svelte:component this={stat.icon} color={stat.color} size="24" />
      </div>
      <div class="card_info">
        <p class="card_label">
          {stat.title}</p>
          <h3 class="card_value">{stat.value}</h3>
          </div>
        </div>
        {/each}
        </div>
      </section>