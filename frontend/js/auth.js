// Handles both login.html and signup.html forms.

document.addEventListener("DOMContentLoaded", () => {
  if (Auth.isLoggedIn()) {
    window.location.href = "dashboard.html";
    return;
  }

  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = loginForm.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const data = await apiRequest("/auth/login", { method: "POST", body: { email, password } });
        Auth.setToken(data.token);
        Auth.setUser(data.user);
        window.location.href = "dashboard.html";
      } catch (err) {
        if (err.data?.notVerified) {
          sessionStorage.setItem("blessmed_verify_email", err.data.email);
          window.location.href = `verify.html?email=${encodeURIComponent(err.data.email)}`;
          return;
        }
        showAlert("alert-box", err.message);
      } finally {
        btn.disabled = false;
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = signupForm.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        const firstName = document.getElementById("firstName").value.trim();
        const lastName = document.getElementById("lastName").value.trim();
        const otherNames = document.getElementById("otherNames").value.trim() || undefined;
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const walletAddress = document.getElementById("wallet").value.trim() || undefined;

        const data = await apiRequest("/auth/signup", {
          method: "POST",
          body: { firstName, lastName, otherNames, email, password, walletAddress },
        });
        Auth.setToken(data.token);
        Auth.setUser(data.user);
        window.location.href = "dashboard.html";
      } catch (err) {
        showAlert("alert-box", err.message);
      } finally {
        btn.disabled = false;
      }
    });
  }
});
