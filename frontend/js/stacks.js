// Stacks wallet integration for BlessMed.
// Loaded as a <script type="module"> — no build step, no bundler.
//
// Talks directly to the Leather browser extension's injected provider
// (window.LeatherProvider) instead of going through @stacks/connect's
// showConnect()/connect-ui popup — that popup is a third-party web-component
// library (Stencil.js) that's known to break when loaded via CDN (throws
// "$instanceValues$ of undefined" from inside its own rendering code, not
// something in this file). Talking to the extension directly avoids that
// layer completely and uses Leather's own native, stable popup instead.
// If you use Xverse instead of Leather, let me know and I'll add support
// for its provider (window.XverseProviders), which uses a slightly
// different request shape.

function getProvider() {
  return window.LeatherProvider || null;
}

const APP_DETAILS = {
  name: "BlessMed",
  icon: window.location.origin + "/favicon.ico",
};

/**
 * Opens the Leather extension's own popup asking the user to share an
 * address. On success, saves the returned testnet STX address to the
 * BlessMed profile via the API.
 */
async function connectStacksWallet({ onSuccess, onError } = {}) {
  try {
    const provider = getProvider();
    if (!provider) {
      throw new Error("No Stacks wallet extension detected. Please install Leather (leather.io) and reload the page.");
    }

    const response = await provider.request("getAddresses");
    const stxEntry = response?.result?.addresses?.find((a) => a.symbol === "STX");
    const address = stxEntry?.address;
    if (!address) throw new Error("Wallet did not return a Stacks address");

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
 * Asks the connected wallet (Leather) to sign an arbitrary message —
 * used to turn a daily check-in into a wallet-verified action instead of a
 * plain button click. No transaction, no gas fee, just a signature the
 * backend can verify against the connected wallet's public key.
 * @param {string} message - the exact challenge text from GET /api/checkin/challenge
 */
async function signCheckinMessage({ message, onSuccess, onError }) {
  if (!message) {
    onError?.(new Error("No message to sign"));
    return;
  }
  try {
    const provider = getProvider();
    if (!provider) {
      throw new Error("No Stacks wallet extension detected. Please install Leather (leather.io) and reload the page.");
    }

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
