// Stacks wallet integration for BlessMed.
// Loaded as a <script type="module"> — no build step, no bundler.
//
// Talks directly to the browser extension's injected provider instead of
// going through @stacks/connect's showConnect()/connect-ui popup — that
// popup is a third-party web-component library (Stencil.js) that's known
// to break when loaded via CDN (throws "$instanceValues$ of undefined"
// from inside its own rendering code, not something in this file). Talking
// to the extension directly avoids that layer completely.
//
// Two wallets are supported, each with its own provider object and request
// shape:
//   - Leather injects window.LeatherProvider and understands "getAddresses"
//     / "stx_signMessage" (message + messageType + network).
//   - Xverse injects window.XverseProviders.StacksProvider and understands
//     "wallet_connect" (returns an addresses array incl. publicKey) /
//     "stx_signMessage" (message + publicKey — no messageType/network).

const WALLET_PROVIDER_KEY = "blessmed_wallet_provider";

function getLeatherProvider() {
  return window.LeatherProvider || null;
}

function getXverseProvider() {
  return window.XverseProviders?.StacksProvider || null;
}

function detectAvailableProviderId() {
  const remembered = localStorage.getItem(WALLET_PROVIDER_KEY);
  if (remembered === "leather" && getLeatherProvider()) return "leather";
  if (remembered === "xverse" && getXverseProvider()) return "xverse";

  const hasLeather = !!getLeatherProvider();
  const hasXverse = !!getXverseProvider();
  if (hasLeather && !hasXverse) return "leather";
  if (hasXverse && !hasLeather) return "xverse";
  if (hasLeather && hasXverse) return "leather"; // both installed, no prior choice — Leather was the original default
  return null;
}

async function getXverseStacksAccount(provider) {
  const response = await provider.request("wallet_connect", { addresses: ["stacks"] });
  const entry = response?.result?.addresses?.find((a) => a.purpose === "stacks" || a.addressType === "stacks");
  if (!entry?.address) throw new Error("Wallet did not return a Stacks address");
  return { address: entry.address, publicKey: entry.publicKey };
}

const APP_DETAILS = {
  name: "BlessMed",
  icon: window.location.origin + "/favicon.ico",
};

const NO_WALLET_MESSAGE =
  "No Stacks wallet extension detected. Please install Leather (leather.io) or Xverse (xverse.app) and reload the page.";

/**
 * Opens the wallet extension's own popup asking the user to share an
 * address. On success, saves the returned testnet STX address to the
 * BlessMed profile via the API.
 * @param {{providerId?: "leather"|"xverse", onSuccess?: Function, onError?: Function}} opts
 */
async function connectStacksWallet({ providerId, onSuccess, onError } = {}) {
  try {
    const id = providerId || detectAvailableProviderId();
    if (!id) throw new Error(NO_WALLET_MESSAGE);

    let address;
    if (id === "leather") {
      const provider = getLeatherProvider();
      if (!provider) throw new Error(NO_WALLET_MESSAGE);
      const response = await provider.request("getAddresses");
      const stxEntry = response?.result?.addresses?.find((a) => a.symbol === "STX");
      address = stxEntry?.address;
    } else if (id === "xverse") {
      const provider = getXverseProvider();
      if (!provider) throw new Error(NO_WALLET_MESSAGE);
      const account = await getXverseStacksAccount(provider);
      address = account.address;
    } else {
      throw new Error("Unsupported wallet");
    }

    if (!address) throw new Error("Wallet did not return a Stacks address");
    localStorage.setItem(WALLET_PROVIDER_KEY, id);

    const { user } = await apiRequest("/profile/wallet", {
      method: "PUT",
      body: { walletAddress: address },
    });
    Auth.setUser(user);
    onSuccess?.(user);
  } catch (err) {
    onError?.(err);
  }
}

async function disconnectStacksWallet({ onSuccess, onError } = {}) {
  try {
    localStorage.removeItem(WALLET_PROVIDER_KEY);
    const { user } = await apiRequest("/profile/wallet", { method: "DELETE" });
    Auth.setUser(user);
    onSuccess?.(user);
  } catch (err) {
    onError?.(err);
  }
}

async function fetchWalletBalance() {
  return apiRequest("/profile/wallet/balance");
}

/**
 * Asks the connected wallet to sign an arbitrary message — used to turn a
 * daily check-in into a wallet-verified action instead of a plain button
 * click. No transaction, no gas fee, just a signature the backend can
 * verify against the connected wallet's public key.
 * @param {string} message - the exact challenge text from GET /api/checkin/challenge
 */
async function signCheckinMessage({ message, onSuccess, onError }) {
  if (!message) {
    onError?.(new Error("No message to sign"));
    return;
  }
  try {
    const id = detectAvailableProviderId();
    if (!id) throw new Error(NO_WALLET_MESSAGE);

    if (id === "xverse") {
      const provider = getXverseProvider();
      if (!provider) throw new Error(NO_WALLET_MESSAGE);
      const { publicKey } = await getXverseStacksAccount(provider);
      if (!publicKey) throw new Error("Wallet did not return a public key");
      const response = await provider.request("stx_signMessage", { message, publicKey });
      const signature = response?.result?.signature || response?.signature;
      if (!signature) throw new Error("Wallet did not return a signature");
      onSuccess?.({ signature, publicKey: response?.result?.publicKey || publicKey });
      return;
    }

    const provider = getLeatherProvider();
    if (!provider) throw new Error(NO_WALLET_MESSAGE);

    const response = await provider.request("stx_signMessage", {
      message,
      messageType: "utf8",
      network: "testnet",
    });

    const signature = response?.result?.signature || response?.signature;
    const publicKey = response?.result?.publicKey || response?.publicKey;
    if (!signature || !publicKey) {
      throw new Error("Wallet did not return a signature");
    }
    onSuccess?.({ signature, publicKey });
  } catch (err) {
    onError?.(err);
  }
}

// Expose on window so non-module page scripts (profile.js) can call these.
window.BlessMedStacks = { connectStacksWallet, disconnectStacksWallet, fetchWalletBalance, signCheckinMessage };
