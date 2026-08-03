// Handles verify.html — submitting the OTP code and resending it.

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  // Some static servers (e.g. `serve`'s clean-URL redirect) strip query
  // strings, so fall back to sessionStorage set right before the redirect.
  const email = params.get("email") || sessionStorage.getItem("blessmed_verify_email");

  if (!email) {
    // No email to verify — send them back to sign up.
    window.location.href = "signup.html";
    return;
  }

  document.getElementById("verify-subtitle").textContent =
    `We've sent a 6-digit code to ${email}.`;

  const verifyForm = document.getElementById("verify-form");
  const resendLink = document.getElementById("resend-link");

  verifyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = verifyForm.querySelector("button[type=submit]");
    btn.disabled = true;
    try {
      const otp = document.getElementById("otp").value.trim();
      const data = await apiRequest("/auth/verify-otp", {
        method: "POST",
        body: { email, otp },
      });
      Auth.setToken(data.token);
      Auth.setUser(data.user);
      sessionStorage.removeItem("blessmed_verify_email");
      window.location.href = "profile.html?welcome=1";
    } catch (err) {
      showAlert("alert-box", err.message);
    } finally {
      btn.disabled = false;
    }
  });

  resendLink.addEventListener("click", async (e) => {
    e.preventDefault();
    resendLink.textContent = "Sending...";
    try {
      const data = await apiRequest("/auth/resend-otp", {
        method: "POST",
        body: { email },
      });
      showAlert("alert-box", data.message, "success");
    } catch (err) {
      showAlert("alert-box", err.message);
    } finally {
      resendLink.textContent = "Resend code";
    }
  });
});
