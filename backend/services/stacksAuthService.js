// Verifies that a daily check-in was actually signed by the Stacks wallet
// the user has connected — turning "check in" from a simple button click
// into a lightweight blockchain-verified action, the same way a dApp would
// ask a wallet to sign a message to prove control of an address, but
// without spending gas or submitting an on-chain transaction.
//
// Isolated in its own service (like stacksService.js) so the exact
// stacks.js package API can change without touching the controller logic.

const { verifyMessageSignatureRsv } = require("@stacks/encryption");
const { publicKeyToAddress, AddressVersion } = require("@stacks/transactions");

const NETWORK_IS_TESTNET = (process.env.STACKS_API_BASE || "https://api.testnet.hiro.so").includes("testnet");
const ADDRESS_VERSION = NETWORK_IS_TESTNET ? AddressVersion.TestnetSingleSig : AddressVersion.MainnetSingleSig;

/**
 * The exact message a wallet must sign to prove today's check-in.
 * Deterministic per user + date, so a signature can never be replayed
 * on a different day or copied to another account.
 */
function buildCheckinChallenge(userId, date) {
  return `BlessMed daily check-in\nuser:${userId}\ndate:${date}\nPurpose: prove I control this wallet to earn today's check-in points.`;
}

/**
 * Verifies a wallet signature over today's check-in challenge and confirms
 * the signing key belongs to the wallet address already linked on the
 * user's profile (so someone can't sign with a different wallet and credit
 * this account).
 *
 * @returns {{ valid: boolean, reason?: string, address?: string }}
 */
function verifyCheckinSignature({ message, signature, publicKey, expectedWalletAddress }) {
  if (!message || !signature || !publicKey) {
    return { valid: false, reason: "Missing signature, public key, or message" };
  }

  let signatureValid = false;
  try {
    signatureValid = verifyMessageSignatureRsv({ message, signature, publicKey });
  } catch (err) {
    return { valid: false, reason: "Malformed signature or public key" };
  }

  if (!signatureValid) {
    return { valid: false, reason: "Signature does not match the message and public key" };
  }

  let derivedAddress;
  try {
    derivedAddress = publicKeyToAddress(ADDRESS_VERSION, publicKey);
  } catch (err) {
    return { valid: false, reason: "Could not derive an address from the public key" };
  }

  if (derivedAddress !== expectedWalletAddress) {
    return { valid: false, reason: "Signature belongs to a different wallet than the one connected to this account", address: derivedAddress };
  }

  return { valid: true, address: derivedAddress };
}

module.exports = { buildCheckinChallenge, verifyCheckinSignature };
