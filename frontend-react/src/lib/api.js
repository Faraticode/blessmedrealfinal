// Central API client for the BlessMed React frontend.
// Same-origin relative paths — works unchanged on localhost, LAN, or a
// deployed host, exactly like the original no-build frontend.
const API_BASE_URL = "/api";

export const Auth = {
  getToken: () => localStorage.getItem("blessmed_token"),
  setToken: (token) => localStorage.setItem("blessmed_token", token),
  clear: () => {
    localStorage.removeItem("blessmed_token");
    localStorage.removeItem("blessmed_user");
  },
  getUser: () => {
    const raw = localStorage.getItem("blessmed_user");
    return raw ? JSON.parse(raw) : null;
  },
  setUser: (user) => localStorage.setItem("blessmed_user", JSON.stringify(user)),
  isLoggedIn: () => !!localStorage.getItem("blessmed_token"),
};

/**
 * Wrapper around fetch that injects the JWT, base URL, and parses JSON.
 * @param {string} path - e.g. "/auth/login"
 * @param {object} options - { method, body, isFormData }
 */
export async function apiRequest(path, options = {}) {
  const headers = options.isFormData ? {} : { "Content-Type": "application/json" };
  const token = Auth.getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.isFormData ? options.body : options.body ? JSON.stringify(options.body) : undefined,
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const error = new Error(data.message || "Something went wrong");
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

export function fileUrl(path) {
  if (!path) return "";
  return path; // already same-origin, no host needed
}

// ---------- Points → BMed token conversion ----------
// Fixed conversion used everywhere points are shown alongside their future
// BMed token value. 100 points = 1 BMed.
export const POINTS_PER_BMED = 100;

export function pointsToBmed(points) {
  return (points || 0) / POINTS_PER_BMED;
}

export function formatBmed(points) {
  return pointsToBmed(points).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
