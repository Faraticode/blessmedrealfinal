import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { apiRequest } from "../lib/api";

export default function Emergency() {
  const [params] = useSearchParams();
  const id = params.get("id");
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setError("No QR code ID provided.");
      return;
    }
    apiRequest(`/profile/emergency/${id}`)
      .then((data) => setInfo(data.info))
      .catch((err) => setError(err.message));
  }, [id]);

  return (
    <>
      <Navbar />
      <div className="container" style={{ maxWidth: 520 }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>🚑 Emergency Health Info</h2>
          {error ? (
            <p className="alert alert-error">{error}</p>
          ) : !info ? (
            <p className="muted">Loading...</p>
          ) : (
            <div>
              <p>
                <strong>Name:</strong> {info.name}
              </p>
              <p>
                <strong>Blood group:</strong> {info.bloodGroup}
              </p>
              <p>
                <strong>Genotype:</strong> {info.genotype}
              </p>
              <p>
                <strong>Allergies:</strong> {info.allergies?.length ? info.allergies.join(", ") : "None on file"}
              </p>
              <p>
                <strong>Medical conditions:</strong>{" "}
                {info.medicalConditions?.length ? info.medicalConditions.join(", ") : "None on file"}
              </p>
              <hr />
              <p>
                <strong>Emergency contact:</strong>
                <br />
                {info.emergencyContact?.name || "Not provided"}{" "}
                {info.emergencyContact?.relationship ? `(${info.emergencyContact.relationship})` : ""}
                <br />
                {info.emergencyContact?.phone && <a href={`tel:${info.emergencyContact.phone}`}>{info.emergencyContact.phone}</a>}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
