// Thin integration layer for Stacks blockchain reads.
// Kept isolated so swapping testnet -> mainnet, or Hiro API -> a different
// indexer, only touches this file.

const HIRO_API_BASE = process.env.STACKS_API_BASE || "https://api.testnet.hiro.so";

/**
 * Fetch STX balance + basic account info for a Stacks address from Hiro's API.
 * @param {string} address - a Stacks address, e.g. ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
 */
async function getAccountBalance(address) {
  const res = await fetch(`${HIRO_API_BASE}/extended/v1/address/${address}/balances`);
  if (!res.ok) {
    const err = new Error("Failed to fetch balance from Stacks API");
    err.status = res.status === 404 ? 404 : 502;
    throw err;
  }
  const data = await res.json();
  const stxMicro = Number(data?.stx?.balance || 0);
  return {
    address,
    network: HIRO_API_BASE.includes("testnet") ? "testnet" : "mainnet",
    stx: stxMicro / 1_000_000, // microSTX -> STX
    stxMicro,
  };
}

module.exports = { getAccountBalance };
