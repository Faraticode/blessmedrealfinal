// Stacks wallet integration for BlessMed.
// Loaded as a <script type="module"> — no build step, no bundler.
//
// Talks directly to the browser extension / in-app browser injected provider
// instead of going through @stacks/connect's showConnect()/connect-ui popup.
//
// Two wallets are supported:
//   - Leather → window.LeatherProvider ("getAddresses" / "stx_signMessage")
//   - Xverse  → window.XverseProviders.BitcoinProvider (preferred; also
//               StacksProvider on some builds). Methods: "wallet_connect" /
//               "stx_signMessage" via sats-connect JSON-RPC shape.
//
// Mobile: Xverse only injects when the page runs inside the Xverse in-app
// browser. Regular mobile Safari/Chrome will not see a provider.

const WALLET_PROVIDER_KEY = "blessmed_wallet_provider";

function getLeatherProvider() {
  const p = window.LeatherProvider || null;
  if (p && typeof p.request === "function") return p;
  return null;
}

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
  if (hasLeather && hasXverse) return "leather";
  return null;
}

async function providerRequest(provider, method, params) {
  if (!provider || typeof provider.request !== "function") {
    throw new Error(
      "Wallet provider is present but does not support request(). Open this site inside the Xverse or Leather in-app browser (or install the browser extension) and try again."
    );
  }

  let response;
  try {
    response = await provider.request(method, params ?? null);
  } catch (err) {
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
 * @param {{message: string, onSuccess?: Function, onError?: Function}} opts
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

      const result = await providerRequest(provider, "stx_signMessage", {
        message,
        publicKey,
      });
      const signature = result?.signature;
      if (!signature) throw new Error("Wallet did not return a signature");
      onSuccess?.({ signature, publicKey: result?.publicKey || publicKey });
      return;
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
    onSuccess?.({ signature, publicKey });
  } catch (err) {
    onError?.(err);
  }
}

window.BlessMedStacks = { connectStacksWallet, disconnectStacksWallet, fetchWalletBalance, signCheckinMessage };
