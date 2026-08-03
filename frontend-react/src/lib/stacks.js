// Stacks wallet integration for BlessMed.
// Talks directly to the Leather browser extension's injected provider
// (window.LeatherProvider) instead of going through @stacks/connect's
// popup UI — see the original frontend/js/stacks.js for the full
// rationale. Same approach, ported to an ES module for the React app.

import { apiRequest } from "./api";

function getProvider() {
  return window.LeatherProvider || null;
}

/**
 * Opens the Leather extension's own popup asking the user to share an
 * address. On success, saves the returned testnet STX address to the
 * BlessMed profile via the API.
 */
export async function connectStacksWallet() {
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
  return user;
}

export async function disconnectStacksWallet() {
  const { user } = await apiRequest("/profile/wallet", { method: "DELETE" });
  return user;
}

export async function fetchWalletBalance() {
  return apiRequest("/profile/wallet/balance");
}

/**
 * Asks the connected wallet (Leather) to sign an arbitrary message — turns
 * a daily check-in into a wallet-verified action instead of a plain button
 * click. No transaction, no gas fee.
 * @param {string} message - the exact challenge text from GET /api/checkin/challenge
 */
export async function signCheckinMessage(message) {
  if (!message) throw new Error("No message to sign");

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
  return { signature, publicKey };
}

export function truncateAddress(addr) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
