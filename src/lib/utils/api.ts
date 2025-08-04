export async function makeAuthenticatedRequest(url: string, options: RequestInit = {}) {
  const csrfToken = getCSRFTokenFromCookie();

  const headers: HeadersInit = {
    ...options.headers,
  };

  if (csrfToken && ['POST', 'PUT', 'DELETE'].includes(options.method || 'GET')) {
    headers['x-csrf-token'] = csrfToken;
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include', 
  });
}

function getCSRFTokenFromCookie(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

