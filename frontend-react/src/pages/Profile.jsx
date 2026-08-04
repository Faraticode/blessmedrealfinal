import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Alert from "../components/Alert";
import { apiRequest, fileUrl } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { connectStacksWallet, disconnectStacksWallet, fetchWalletBalance, truncateAddress } from "../lib/stacks";

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  otherNames: "",
  age: "",
  bloodGroup: "Unknown",
  genotype: "Unknown",
  allergies: "",
  medicalConditions: "",
  emergencyName: "",
  emergencyPhone: "",
  emergencyRelationship: "",
};

function splitCsv(value) {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export default function Profile() {
  const { user, setUser } = useAuth();
  const [params] = useSearchParams();
  const [form, setForm] = useState(EMPTY_FORM);
  const [avatarSrc, setAvatarSrc] = useState("");
  const [qrSrc, setQrSrc] = useState("");
  const [status, setStatus] = useState({ message: "", type: "error" });
  const [busy, setBusy] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletBalance, setWalletBalance] = useState("");

  useEffect(() => {
    if (params.get("welcome")) {
      setStatus({ message: "Account created! Complete your health profile below.", type: "success" });
    }
    loadProfile();
    loadQr();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user?.walletAddress) {
      setWalletBalance("Fetching balance...");
      fetchWalletBalance()
        .then(({ balance }) => setWalletBalance(`Balance: ${balance.stx.toFixed(2)} STX (testnet)`))
        .catch(() => setWalletBalance("Balance unavailable right now."));
    }
  }, [user?.walletAddress]);

  async function loadProfile() {
    try {
      const { user: fresh } = await apiRequest("/profile");
      setUser(fresh);
      setForm({
        firstName: fresh.firstName || "",
        lastName: fresh.lastName || "",
        otherNames: fresh.otherNames || "",
        age: fresh.age || "",
        bloodGroup: fresh.bloodGroup || "Unknown",
        genotype: fresh.genotype || "Unknown",
        allergies: (fresh.allergies || []).join(", "),
        medicalConditions: (fresh.medicalConditions || []).join(", "),
        emergencyName: fresh.emergencyContact?.name || "",
        emergencyPhone: fresh.emergencyContact?.phone || "",
        emergencyRelationship: fresh.emergencyContact?.relationship || "",
      });
      setAvatarSrc(
        fresh.profilePicture ? fileUrl(fresh.profilePicture) : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fresh.name)}`
      );
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    }
  }

  async function loadQr() {
    try {
      const { qrDataUrl } = await apiRequest("/profile/qr");
      setQrSrc(qrDataUrl);
    } catch (err) {
      console.error(err);
    }
  }

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function saveProfile(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const { user: fresh } = await apiRequest("/profile", {
        method: "PUT",
        body: {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          otherNames: form.otherNames.trim(),
          age: Number(form.age) || undefined,
          bloodGroup: form.bloodGroup,
          genotype: form.genotype,
          allergies: splitCsv(form.allergies),
          medicalConditions: splitCsv(form.medicalConditions),
          emergencyContact: {
            name: form.emergencyName.trim(),
            phone: form.emergencyPhone.trim(),
            relationship: form.emergencyRelationship.trim(),
          },
        },
      });
      setUser(fresh);
      setStatus({ message: "Profile saved successfully.", type: "success" });
      await loadQr();
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function uploadPicture(e) {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("picture", file);
    try {
      const { user: fresh } = await apiRequest("/profile/picture", { method: "PUT", isFormData: true, body: formData });
      setUser(fresh);
      setAvatarSrc(fileUrl(fresh.profilePicture));
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    }
  }

  async function handleConnectWallet(providerId) {
    setWalletBusy(true);
    try {
      const fresh = await connectStacksWallet(providerId);
      setUser(fresh);
      setStatus({ message: "Wallet connected.", type: "success" });
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    } finally {
      setWalletBusy(false);
    }
  }

  async function handleDisconnectWallet() {
    setWalletBusy(true);
    try {
      const fresh = await disconnectStacksWallet();
      setUser(fresh);
      setStatus({ message: "Wallet disconnected.", type: "success" });
    } catch (err) {
      setStatus({ message: err.message, type: "error" });
    } finally {
      setWalletBusy(false);
    }
  }

  return (
    <div className="container">
      <Alert message={status.message} type={status.type} />

      <div className="grid grid-2">
        <div className="card">
          <div className="flex-between" style={{ marginBottom: 16 }}>
            <img id="avatar-img" className="avatar" src={avatarSrc} alt="Profile picture" />
            <div>
              <label className="btn btn-outline" htmlFor="picture-input" style={{ cursor: "pointer" }}>
                Change photo
              </label>
              <input type="file" id="picture-input" accept="image/*" hidden onChange={uploadPicture} />
            </div>
          </div>

          <form onSubmit={saveProfile}>
            <div className="field-row">
              <div>
                <label htmlFor="firstName">First name</label>
                <input type="text" id="firstName" required value={form.firstName} onChange={update("firstName")} />
              </div>
              <div>
                <label htmlFor="lastName">Last name</label>
                <input type="text" id="lastName" required value={form.lastName} onChange={update("lastName")} />
              </div>
            </div>
            <div>
              <label htmlFor="otherNames">
                Other names <span className="muted">(optional)</span>
              </label>
              <input type="text" id="otherNames" value={form.otherNames} onChange={update("otherNames")} />
            </div>
            <div className="field-row">
              <div>
                <label htmlFor="age">Age</label>
                <input type="number" id="age" min={0} max={130} value={form.age} onChange={update("age")} />
              </div>
              <div>
                <label htmlFor="bloodGroup">Blood group</label>
                <select id="bloodGroup" value={form.bloodGroup} onChange={update("bloodGroup")}>
                  {["Unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="genotype">Genotype</label>
              <select id="genotype" value={form.genotype} onChange={update("genotype")}>
                {["Unknown", "AA", "AS", "SS", "AC", "SC"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="allergies">
                Allergies <span className="muted">(comma separated)</span>
              </label>
              <input type="text" id="allergies" placeholder="Penicillin, Peanuts" value={form.allergies} onChange={update("allergies")} />
            </div>
            <div>
              <label htmlFor="medicalConditions">
                Medical conditions <span className="muted">(comma separated)</span>
              </label>
              <input
                type="text"
                id="medicalConditions"
                placeholder="Asthma, Hypertension"
                value={form.medicalConditions}
                onChange={update("medicalConditions")}
              />
            </div>

            <h3 style={{ marginBottom: 0 }}>Emergency contact</h3>
            <div className="field-row">
              <div>
                <label htmlFor="emergencyName">Name</label>
                <input type="text" id="emergencyName" value={form.emergencyName} onChange={update("emergencyName")} />
              </div>
              <div>
                <label htmlFor="emergencyPhone">Phone</label>
                <input type="tel" id="emergencyPhone" value={form.emergencyPhone} onChange={update("emergencyPhone")} />
              </div>
            </div>
            <div>
              <label htmlFor="emergencyRelationship">Relationship</label>
              <input
                type="text"
                id="emergencyRelationship"
                placeholder="Spouse, Parent, Sibling..."
                value={form.emergencyRelationship}
                onChange={update("emergencyRelationship")}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Saving..." : "Save profile"}
            </button>
          </form>
        </div>

        <div>
          <div className="card qr-box" style={{ marginBottom: 20 }}>
            <h3>Emergency QR code</h3>
            <p className="muted">
              First responders can scan this to see your blood group, allergies, and emergency contact — no login required.
            </p>
            {qrSrc && <img src={qrSrc} alt="Emergency QR code" />}
          </div>

          <div className="card">
            <h3>
              Stacks wallet <span className="tag">testnet</span>
            </h3>
            <p className="muted">
              Connect a Stacks wallet (Leather or Xverse) to link your account for future on-chain record verification
              and rewards.
            </p>
            {user?.walletAddress ? (
              <div>
                <p>
                  <strong>Connected:</strong> <span className="muted">{truncateAddress(user.walletAddress)}</span>
                </p>
                <p className="muted">{walletBalance}</p>
                <button className="btn btn-outline" disabled={walletBusy} onClick={handleDisconnectWallet}>
                  Disconnect wallet
                </button>
              </div>
            ) : (
              <div>
                <div className="flex-between" style={{ gap: 8 }}>
                  <button
                    className="btn btn-primary"
                    disabled={walletBusy}
                    onClick={() => handleConnectWallet("leather")}
                  >
                    Connect Leather
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={walletBusy}
                    onClick={() => handleConnectWallet("xverse")}
                  >
                    Connect Xverse
                  </button>
                </div>
                <p className="muted" style={{ marginTop: 8 }}>
                  Requires the Leather or Xverse browser extension installed.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
