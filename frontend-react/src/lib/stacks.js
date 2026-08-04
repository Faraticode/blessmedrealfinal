// Stacks wallet integration for BlessMed.
// Talks directly to the browser extension / in-app browser injected provider
// instead of going through @stacks/connect's popup UI — see the original
// frontend/js/stacks.js for the full rationale. Same approach, ported to
// an ES module for the React app.
//
// Two wallets are supported, each with its own provider object and request
// shape:
//   - Leather injects window.LeatherProvider and understands "getAddresses"
//     / "stx_signMessage" (message + messageType + network).
//   - Xverse injects window.XverseProviders (BitcoinProvider on extension +
//     mobile in-app browser; some builds also expose StacksProvider) and
//     understands "wallet_connect" / "stx_signMessage" via the sats-connect
//     JSON-RPC shape (status/result). Prefer BitcoinProvider — that is what
//     mobile reliably injects.
//
// Mobile note: Xverse only injects the provider when the page is opened
// inside the Xverse in-app browser (or the extension on desktop). Opening
// the site in Safari/Chrome on the phone will not see a provider.

import { apiRequest } from "./api";

const WALLET_PROVIDER_KEY = "blessmed_wallet_provider";

function getLeatherProvider() {
  const p = window.LeatherProvider || null;
  if (p && typeof p.request === "function") return p;
  return null;
}

/**
 * Xverse injects under window.XverseProviders.
 * - BitcoinProvider: standard sats-connect target (extension + mobile webview)
 * - StacksProvider: present on some extension builds; not always on mobile
 * Prefer BitcoinProvider, then StacksProvider, then any sibling with .request.
 */
function getXverseProvider() {
  const root = window.XverseProviders;
  if (!root || typeof root !== "object") return null;

  const candidates = [root.BitcoinProvider, root.StacksProvider, root.provider, root];
  for (const p of candidates) {
    if (p && typeof p.request === "function") return p;
  }
  return null;
}

function detectAvailableProviderId() {
  const remembered = localStorage.getItem(WALLET_PROVIDER_KEY);
  if (remembered === "leather" && getLeatherProvider()) return "leather";
  if (remembered === "xverse" && getXverseProvider()) return "xverse";

  const hasLeather = !!getLeatherProvider();
  const hasXverse = !!getXverseProvider();
  if (hasLeather && !hasXverse) return "leather";
  if (hasXverse && !hasLeather) return "xverse";
  if (hasLeather && hasXverse) return "leather"; // both installed, no prior choice
  return null;
}

/**
 * Call provider.request and normalize sats-connect-style responses.
 * sats-connect returns { status: "success"|"error", result?, error? }.
 * Older Leather responses are { result } or the raw payload.
 */
async function providerRequest(provider, method, params) {
  if (!provider || typeof provider.request !== "function") {
    throw new Error(
      "Wallet provider is present but does not support request(). Open this site inside the Xverse or Leather in-app browser (or install the browser extension) and try again."
    );
  }

  let response;
  try {
    // Some providers accept (method, params); others accept a single object.
    response = await provider.request(method, params ?? null);
  } catch (err) {
    // Retry with object form used by a few older builds
    if (params && typeof params === "object") {
      try {
        response = await provider.request({ method, params });
      } catch {
        throw err;
      }
    } else {
      throw err;
    }
  }

  if (response == null) {
    throw new Error(`Wallet returned an empty response for ${method}`);
  }

  if (typeof response === "object" && "status" in response) {
    if (response.status === "error") {
      const msg =
        response.error?.message ||
        response.error?.error?.message ||
        (typeof response.error === "string" ? response.error : null) ||
        `${method} was rejected or failed`;
      throw new Error(msg);
    }
    return response.result ?? response;
  }

  return response?.result ?? response;
}

/**
 * Asks Xverse for the user's Stacks address (and its public key, needed
 * later for message signing). Uses wallet_connect, which re-resolves
 * silently (no popup) if the user already granted permission.
 */
async function getXverseStacksAccount(provider) {
  const result = await providerRequest(provider, "wallet_connect", {
    addresses: ["stacks"],
  });

  const addresses = result?.addresses || (Array.isArray(result) ? result : null);
  if (!addresses?.length) {
    throw new Error("Wallet did not return any addresses. Make sure Stacks is enabled in Xverse.");
  }

  const entry =
    addresses.find((a) => a.purpose === "stacks" || a.addressType === "stacks" || a.symbol === "STX") ||
    addresses.find((a) => typeof a.address === "string" && a.address.startsWith("S"));

  if (!entry?.address) {
    throw new Error("Wallet did not return a Stacks address. Switch Xverse to a Stacks-capable account and try again.");
  }

  return { address: entry.address, publicKey: entry.publicKey };
}

const NO_WALLET_MESSAGE =
  "No Stacks wallet detected. On desktop, install Leather (leather.io) or Xverse (xverse.app) and reload. On mobile, open this site inside the Xverse (or Leather) in-app browser — the regular phone browser cannot reach the wallet.";

/**
 * Opens the wallet's own popup asking the user to share an address.
 * On success, saves the returned STX address to the BlessMed profile via the API.
 * @param {"leather"|"xverse"} [providerId]
 */
export async function connectStacksWallet(providerId) {
  const id = providerId || detectAvailableProviderId();
  if (!id) throw new Error(NO_WALLET_MESSAGE);

  let address;
  if (id === "leather") {
    const provider = getLeatherProvider();
    if (!provider) throw new Error(NO_WALLET_MESSAGE);
    const result = await providerRequest(provider, "getAddresses");
    const addresses = result?.addresses || (Array.isArray(result) ? result : []);
    const stxEntry =
      addresses.find((a) => a.symbol === "STX") ||
      addresses.find((a) => typeof a.address === "string" && a.address.startsWith("S"));
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
  return user;
}

export async function disconnectStacksWallet() {
  localStorage.removeItem(WALLET_PROVIDER_KEY);
  const { user } = await apiRequest("/profile/wallet", { method: "DELETE" });
  return user;
}

export async function fetchWalletBalance() {
  return apiRequest("/profile/wallet/balance");
}

/**
 * Asks the connected wallet to sign an arbitrary message — turns a daily
 * check-in into a wallet-verified action instead of a plain button click.
 * No transaction, no gas fee.
 * @param {string} message - the exact challenge text from GET /api/checkin/challenge
 */
export async function signCheckinMessage(message) {
  if (!message) throw new Error("No message to sign");

  const id = detectAvailableProviderId();
  if (!id) throw new Error(NO_WALLET_MESSAGE);

  if (id === "xverse") {
    const provider = getXverseProvider();
    if (!provider) throw new Error(NO_WALLET_MESSAGE);
    const { publicKey } = await getXverseStacksAccount(provider);
    if (!publicKey) throw new Error("Wallet did not return a public key");

    const result = await providerRequest(provider, "stx_signMessage", {
      message,
      publicKey,
    });

    const signature = result?.signature;
    if (!signature) throw new Error("Wallet did not return a signature");
    return { signature, publicKey: result?.publicKey || publicKey };
  }

  const provider = getLeatherProvider();
  if (!provider) throw new Error(NO_WALLET_MESSAGE);

  const result = await providerRequest(provider, "stx_signMessage", {
    message,
    messageType: "utf8",
    network: "testnet",
  });

  const signature = result?.signature;
  const publicKey = result?.publicKey;
  if (!signature || !publicKey) {
    throw new Error("Wallet did not return a signature");
  }
  return { signature, publicKey };
}

export function truncateAddress(addr) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/** True if at least one supported wallet provider is injected right now. */
export function isWalletAvailable() {
  return !!(getLeatherProvider() || getXverseProvider());
}
