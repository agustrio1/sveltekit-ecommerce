<script lang="ts">
import {
onMount
} from 'svelte';
import {
Mail,
Lock,
User,
Eye,
EyeOff
} from 'lucide-svelte';
import './auth-from.scss';

export let type: 'login' | 'register' = 'login';

let name = '';
let email = '';
let password = '';
let error = '';
let showPassword = false;
let mounted = false;

onMount(() => {
mounted = true;
});

function getCSRFTokenFromCookie() {
const match = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
return match ? decodeURIComponent(match[1]): null;
}

const handleSubmit = async () => {
const csrfToken = getCSRFTokenFromCookie();

const res = await fetch(`/api/auth/${type}`, {
method: 'POST',
body: JSON.stringify({
name, email, password
}),
headers: {
'Content-Type': 'application/json',
...(csrfToken && {
'x-csrf-token': csrfToken
})
}
});

if (res.ok) {
location.href = type === 'register' ? '/login': '/';
} else {
const {
error: msg
} = await res.json();
error = msg || 'Gagal';
}
};

const togglePasswordVisibility = () => {
showPassword = !showPassword;
};
</script>

<div class="auth-container">
<div class="auth-wrapper">
<div class="auth-header">
<div class="brand-circle">
<div class="brand-icon"></div>
</div>
<h2>{type === 'login' ? 'Masuk ke Akun': 'Daftar Akun Baru'}</h2>
<p class="subtitle">
{type === 'login'
? 'Silakan masuk untuk melanjutkan': 'Bergabunglah dengan jutaan pengguna lainnya'}
</p>
</div>

<form class="auth-form" on:submit|preventDefault={handleSubmit}>
{#if type === 'register'}
<div class="input-group">
<label for="name">Nama Lengkap</label>
<div class="input-wrapper">
<User class="input-icon" />
<input
id="name"
bind:value={name}
placeholder="Masukkan nama lengkap Anda"
required
class="form-input"
/>
</div>
</div>
{/if }

<div class="input-group">
<label for="email">Email</label>
<div class="input-wrapper">
<Mail class="input-icon" />
<input
id="email"
type="email"
bind:value={email}
placeholder="contoh@email.com"
required
class="form-input"
/>
</div>
</div>

<div class="input-group">
<label for="password">Password</label>
<div class="input-wrapper password-wrapper">
<Lock class="input-icon" />
<input
id="password"
type={mounted && showPassword ? 'text': 'password'}
bind:value={password}
placeholder="Masukkan password Anda"
required
class="form-input"
/>
{#if mounted}
<button
type="button"
class="password-toggle"
on:click={togglePasswordVisibility}
aria-label={showPassword ? 'Sembunyikan password': 'Tampilkan password'}
>
{#if showPassword}
<EyeOff class="toggle-icon" />
{:else}
<Eye class="toggle-icon" />
{/if }
</button>
{/if }
</div>
</div>

{#if error}
<div class="error-message">
<div class="error-icon">
!
</div>
{error}
</div>
{/if }

<button type="submit" class="submit-btn">
<span class="btn-text">
{type === 'login' ? 'Masuk Sekarang': 'Daftar Sekarang'}
</span>
<div class="btn-shine"></div>
</button>

<div class="auth-footer">
{#if type === 'login'}
<p>
Belum punya akun? <a href="/register" class="auth-link">Daftar di sini</a>
</p>
{:else}
<p>
Sudah punya akun? <a href="/login" class="auth-link">Masuk di sini</a>
</p>
{/if }
</div>
</form>
</div>
</div>