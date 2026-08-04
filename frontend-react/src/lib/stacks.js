// Stacks wallet integration for BlessMed.
// Talks directly to the browser extension's injected provider instead of
// going through @stacks/connect's popup UI — see the original
// frontend/js/stacks.js for the full rationale. Same approach, ported to
// an ES module for the React app.
//
// Two wallets are supported, each with its own provider object and request
// shape:
//   - Leather injects window.LeatherProvider and understands "getAddresses"
//     / "stx_signMessage" (message + messageType + network).
//   - Xverse injects window.XverseProviders.StacksProvider and understands
//     "wallet_connect" (returns an addresses array incl. publicKey) /
//     "stx_signMessage" (message + publicKey — no messageType/network).
// Both expose the same `.request(method, params)` shape, just with
// different method names/params, so we branch per-provider rather than
// trying to paper over the differences with one shared call.

import { apiRequest } from "./api";

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

/**
 * Asks Xverse for the user's Stacks address (and its public key, needed
 * later for message signing). Uses wallet_connect, which re-resolves
 * silently (no popup) if the user already granted permission.
 */
async function getXverseStacksAccount(provider) {
  const response = await provider.request("wallet_connect", { addresses: ["stacks"] });
  const entry = response?.result?.addresses?.find((a) => a.purpose === "stacks" || a.addressType === "stacks");
  if (!entry?.address) throw new Error("Wallet did not return a Stacks address");
  return { address: entry.address, publicKey: entry.publicKey };
}

const NO_WALLET_MESSAGE =
  "No Stacks wallet extension detected. Please install Leather (leather.io) or Xverse (xverse.app) and reload the page.";

/**
 * Opens the wallet extension's own popup asking the user to share an
 * address. On success, saves the returned testnet STX address to the
 * BlessMed profile via the API.
 * @param {"leather"|"xverse"} [providerId] - which wallet to use. Defaults
 *   to auto-detecting: whichever one is installed, or the last one the
 *   user connected with if both are.
 */
export async function connectStacksWallet(providerId) {
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
    const response = await provider.request("stx_signMessage", { message, publicKey });
    const signature = response?.result?.signature || response?.signature;
    if (!signature) throw new Error("Wallet did not return a signature");
    return { signature, publicKey: response?.result?.publicKey || publicKey };
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
  return { signature, publicKey };
}

export function truncateAddress(addr) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
