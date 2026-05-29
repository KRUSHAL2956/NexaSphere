const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
const EMAIL_KEY = 'ns_admin_email';
const EXPIRY_KEY = 'ns_admin_token_expiry';

export const auth = {
  async login(email, password) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cleanEmail, email: cleanEmail, password: cleanPassword }),
      credentials: 'include',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Invalid credentials');
    }
    const data = await res.json();
    localStorage.setItem(EMAIL_KEY, cleanEmail);
    if (data.expiresAt) {
      localStorage.setItem(EXPIRY_KEY, data.expiresAt);
    }
    return data;
  },

  async logout() {
    fetch(`${API_BASE}/api/admin/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    localStorage.removeItem(EMAIL_KEY);
    localStorage.removeItem(EXPIRY_KEY);
  },

  async verifySession() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/me`, {
        credentials: 'include',
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  getEmail() { return localStorage.getItem(EMAIL_KEY); },
  isOffline() { return false; },
  isOfflineMode() { return false; },
};
