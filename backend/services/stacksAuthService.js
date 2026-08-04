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

/**
 * The exact message a wallet must sign to prove today's check-in.
 * Deterministic per user + date, so a signature can never be replayed
 * on a different day or copied to another account.
 */
function buildCheckinChallenge(userId, date) {
  return `BlessMed daily check-in\nuser:${userId}\ndate:${date}\nPurpose: prove I control this wallet to earn today's check-in points.`;
}

/**
 * Derive a Stacks address from a public key, trying both mainnet and testnet.
 * Xverse mobile defaults to mainnet (SP...); test setups / Leather testnet use ST...
 * We accept whichever version matches the address already saved on the profile.
 */
function deriveAddressFromPublicKey(publicKey, preferredVersion) {
  const versions = [];
  if (preferredVersion != null) versions.push(preferredVersion);
  // Always try both — order by preference
  for (const v of [AddressVersion.MainnetSingleSig, AddressVersion.TestnetSingleSig]) {
    if (!versions.includes(v)) versions.push(v);
  }

  const derived = [];
  for (const version of versions) {
    try {
      derived.push(publicKeyToAddress(version, publicKey));
    } catch {
      // ignore malformed attempts for one version
    }
  }
  return derived;
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

  // Prefer the network that matches the connected address prefix
  let preferred = null;
  if (typeof expectedWalletAddress === "string") {
    if (expectedWalletAddress.startsWith("ST")) preferred = AddressVersion.TestnetSingleSig;
    else if (expectedWalletAddress.startsWith("SP") || expectedWalletAddress.startsWith("SM")) {
      preferred = AddressVersion.MainnetSingleSig;
    }
  }

  const candidates = deriveAddressFromPublicKey(publicKey, preferred);
  if (!candidates.length) {
    return { valid: false, reason: "Could not derive an address from the public key" };
  }

  if (candidates.includes(expectedWalletAddress)) {
    return { valid: true, address: expectedWalletAddress };
  }

  return {
    valid: false,
    reason: "Signature belongs to a different wallet than the one connected to this account",
    address: candidates[0],
  };
}

module.exports = { buildCheckinChallenge, verifyCheckinSignature };
