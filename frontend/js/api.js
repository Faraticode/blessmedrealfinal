// Central API client for the BlessMed frontend.
// No build step — plain script included via <script src="js/api.js"> on every page.

// The backend now serves this frontend directly (see server.js), so the
// API is always on the same origin the page was loaded from — no need to
// hardcode a host or port, and this works unchanged whether you're on
// localhost, a LAN IP, or an ngrok tunnel URL.
const API_BASE_URL = "/api";

const Auth = {
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
  logout: () => {
    Auth.clear();
    window.location.href = "login.html";
  },
};

/**
 * Wrapper around fetch that injects the JWT, base URL, and parses JSON.
 * @param {string} path - e.g. "/auth/login"
 * @param {object} options - { method, body, isFormData }
 */
async function apiRequest(path, options = {}) {
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

// Guard: redirect to login if not authenticated. Call at top of protected pages.
function requireAuth() {
  if (!Auth.isLoggedIn()) {
    window.location.href = "login.html";
  }
}

function showAlert(containerId, message, type = "error") {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
}

function fileUrl(path) {
  if (!path) return "";
  return path; // already same-origin, no host needed
}

// ---------- Points → BMed token conversion ----------
// Fixed conversion used everywhere points are shown alongside their future
// BMed token value. 100 points = 1 BMed.
const POINTS_PER_BMED = 100;

function pointsToBmed(points) {
  return (points || 0) / POINTS_PER_BMED;
}

function formatBmed(points) {
  return pointsToBmed(points).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Small "X pts" badge shown in the navbar on every logged-in page, using
// whatever points value is cached locally. Pages that fetch a fresh user
// object (e.g. the dashboard) should call this again with the fresh count.
function renderNavPointsBadge(points) {
  const nav = document.querySelector(".nav-links");
  if (!nav) return;

  const value = points ?? Auth.getUser()?.points ?? 0;
  let badge = document.getElementById("nav-points-badge");
  if (!badge) {
    badge = document.createElement("a");
    badge.id = "nav-points-badge";
    badge.className = "points-badge";
    badge.href = "dashboard.html";
    badge.title = `≈ ${formatBmed(value)} BMed at ${POINTS_PER_BMED} pts = 1 BMed`;
    const logoutLink = Array.from(nav.querySelectorAll("a")).find((a) => a.textContent.trim() === "Log out");
    if (logoutLink) nav.insertBefore(badge, logoutLink);
    else nav.appendChild(badge);
  }
  badge.textContent = `⭐ ${value.toLocaleString()} pts`;
  badge.title = `≈ ${formatBmed(value)} BMed at ${POINTS_PER_BMED} pts = 1 BMed`;
}

document.addEventListener("DOMContentLoaded", () => {
  if (Auth.isLoggedIn() && document.querySelector(".nav-links")) {
    renderNavPointsBadge();
  }
});
