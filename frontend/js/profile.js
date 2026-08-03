document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();

  const params = new URLSearchParams(window.location.search);
  if (params.get("welcome")) {
    showAlert("alert-box", "Account created! Complete your health profile below.", "success");
  }

  await loadProfile();
  await loadQr();
  renderWalletState();

  document.getElementById("profile-form").addEventListener("submit", saveProfile);
  document.getElementById("picture-input").addEventListener("change", uploadPicture);
  document.getElementById("connect-wallet-btn").addEventListener("click", handleConnectWallet);
  document.getElementById("disconnect-wallet-btn").addEventListener("click", handleDisconnectWallet);
});

async function loadProfile() {
  try {
    const { user } = await apiRequest("/profile");
    Auth.setUser(user);

    document.getElementById("firstName").value = user.firstName || "";
    document.getElementById("lastName").value = user.lastName || "";
    document.getElementById("otherNames").value = user.otherNames || "";
    document.getElementById("age").value = user.age || "";
    document.getElementById("bloodGroup").value = user.bloodGroup || "Unknown";
    document.getElementById("genotype").value = user.genotype || "Unknown";
    document.getElementById("allergies").value = (user.allergies || []).join(", ");
    document.getElementById("medicalConditions").value = (user.medicalConditions || []).join(", ");
    document.getElementById("emergencyName").value = user.emergencyContact?.name || "";
    document.getElementById("emergencyPhone").value = user.emergencyContact?.phone || "";
    document.getElementById("emergencyRelationship").value = user.emergencyContact?.relationship || "";

    const avatar = document.getElementById("avatar-img");
    avatar.src = user.profilePicture
      ? fileUrl(user.profilePicture)
      : "https://api.dicebear.com/7.x/initials/svg?seed=" + encodeURIComponent(user.name);
  } catch (err) {
    showAlert("alert-box", err.message);
  }
}

async function saveProfile(e) {
  e.preventDefault();
  const btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true;
  try {
    const body = {
      firstName: document.getElementById("firstName").value.trim(),
      lastName: document.getElementById("lastName").value.trim(),
      otherNames: document.getElementById("otherNames").value.trim(),
      age: Number(document.getElementById("age").value) || undefined,
      bloodGroup: document.getElementById("bloodGroup").value,
      genotype: document.getElementById("genotype").value,
      allergies: splitCsv(document.getElementById("allergies").value),
      medicalConditions: splitCsv(document.getElementById("medicalConditions").value),
      emergencyContact: {
        name: document.getElementById("emergencyName").value.trim(),
        phone: document.getElementById("emergencyPhone").value.trim(),
        relationship: document.getElementById("emergencyRelationship").value.trim(),
      },
    };
    const { user } = await apiRequest("/profile", { method: "PUT", body });
    Auth.setUser(user);
    showAlert("alert-box", "Profile saved successfully.", "success");
    await loadQr(); // emergency info may have changed
  } catch (err) {
    showAlert("alert-box", err.message);
  } finally {
    btn.disabled = false;
  }
}

async function uploadPicture(e) {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append("picture", file);
  try {
    const { user } = await apiRequest("/profile/picture", {
      method: "PUT",
      isFormData: true,
      body: formData,
    });
    Auth.setUser(user);
    document.getElementById("avatar-img").src = fileUrl(user.profilePicture);
  } catch (err) {
    showAlert("alert-box", err.message);
  }
}

async function loadQr() {
  try {
    const { qrDataUrl } = await apiRequest("/profile/qr");
    document.getElementById("qr-img").src = qrDataUrl;
  } catch (err) {
    console.error(err);
  }
}

function splitCsv(value) {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function renderWalletState() {
  const user = Auth.getUser();
  const connectedEl = document.getElementById("wallet-connected-state");
  const disconnectedEl = document.getElementById("wallet-disconnected-state");

  if (user?.walletAddress) {
    connectedEl.style.display = "block";
    disconnectedEl.style.display = "none";
    document.getElementById("wallet-address").textContent = truncateAddress(user.walletAddress);
    loadWalletBalance();
  } else {
    connectedEl.style.display = "none";
    disconnectedEl.style.display = "block";
  }
}

async function loadWalletBalance() {
  const el = document.getElementById("wallet-balance");
  el.textContent = "Fetching balance...";
  try {
    const { balance } = await window.BlessMedStacks.fetchWalletBalance();
    el.textContent = `Balance: ${balance.stx.toFixed(2)} STX (testnet)`;
  } catch (err) {
    el.textContent = "Balance unavailable right now.";
  }
}

function handleConnectWallet() {
  const btn = document.getElementById("connect-wallet-btn");
  btn.disabled = true;
  window.BlessMedStacks.connectStacksWallet({
    onSuccess: (user) => {
      Auth.setUser(user);
      showAlert("alert-box", "Wallet connected.", "success");
      renderWalletState();
      btn.disabled = false;
    },
    onError: (err) => {
      showAlert("alert-box", err.message);
      btn.disabled = false;
    },
  });
}

function handleDisconnectWallet() {
  const btn = document.getElementById("disconnect-wallet-btn");
  btn.disabled = true;
  window.BlessMedStacks.disconnectStacksWallet({
    onSuccess: (user) => {
      Auth.setUser(user);
      showAlert("alert-box", "Wallet disconnected.", "success");
      renderWalletState();
      btn.disabled = false;
    },
    onError: (err) => {
      showAlert("alert-box", err.message);
      btn.disabled = false;
    },
  });
}

function truncateAddress(addr) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
