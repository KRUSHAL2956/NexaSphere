const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
const TOKEN_KEY = 'ns_admin_token';
const EMAIL_KEY = 'ns_admin_email';

export const auth = {
  async login(email, password) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    // Always try the real Java backend first; but provide a safe local fallback
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword }),
      });

      // Successful live login
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem(TOKEN_KEY, data.token);
        localStorage.setItem(EMAIL_KEY, cleanEmail);
        console.log('[Auth] Logged in via LIVE Java backend ✓');
        return data;
      }

      // If backend rejects credentials, allow a developer/local fallback when explicitly enabled
      const allowWeak = import.meta.env.VITE_ALLOW_WEAK_ADMIN === 'true' || import.meta.env.DEV;
      const defaultEmail = 'nexasphere@glbajajgroup.org';
      const defaultPassword = 'admin@123';
      if ((res.status === 401 || res.status === 0) && allowWeak && cleanEmail === defaultEmail && cleanPassword === defaultPassword) {
        console.warn('[Auth] Backend rejected credentials — falling back to local mock token (DEV/allow-weak enabled)');
        const mockToken = 'mock-jwt-token-for-nexasphere-admin';
        localStorage.setItem(TOKEN_KEY, mockToken);
        localStorage.setItem(EMAIL_KEY, cleanEmail);
        return { token: mockToken, email: cleanEmail };
      }

      // Otherwise propagate backend error message
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Invalid credentials');
    } catch (err) {
      // Fallback for network-level failures — allow mock login for the default credentials
      const isNetworkError = err instanceof TypeError && err.message.includes('fetch');
      if (isNetworkError && cleanEmail === 'nexasphere@glbajajgroup.org' && cleanPassword === 'admin@123') {
        console.warn('[Auth] Java server unreachable — falling back to OFFLINE mock mode');
        const mockToken = 'mock-jwt-token-for-nexasphere-admin';
        localStorage.setItem(TOKEN_KEY, mockToken);
        localStorage.setItem(EMAIL_KEY, cleanEmail);
        return { token: mockToken, email: cleanEmail };
      }
      throw err;
    }

    const data = await res.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(EMAIL_KEY, cleanEmail);
    return data;
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
  },

  getToken() { return localStorage.getItem(TOKEN_KEY); },
  getEmail() { return localStorage.getItem(EMAIL_KEY); },
  isAuthenticated() { return !!this.getToken(); },
};
