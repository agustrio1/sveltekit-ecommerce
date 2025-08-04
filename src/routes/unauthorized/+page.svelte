<script lang="ts">
  import {
    AlertTriangle
  } from 'lucide-svelte';
</script>

<section class="unauthorized">
  <AlertTriangle size={48} />
  <h1>Akses Ditolak</h1>
  <p>
    Anda tidak memiliki izin untuk mengakses halaman ini.
  </p>
  <a href="/" class="back-link">Kembali ke Beranda</a>
</section>

<style lang="scss">
  .unauthorized {
    max-width: 600px;
    margin: 4rem auto;
    text-align: center;
    padding: 2rem;
    background: #fff3f3;
    border: 1px solid #ffcccc;
    border-radius: 12px;
    color: #d8000c;

    svg {
      margin-bottom: 1rem;
    }

    h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }

    .back-link {
      margin-top: 1rem;
      display: inline-block;
      color: #d8000c;
      text-decoration: underline;
    }
  }
</style>