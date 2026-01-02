"use client";

import { useState } from "react";
import { ethers } from "ethers";
import axios from "axios";

const PINN_CONTRACT_ADDRESS =
  "0xB20CB06536d421798Cb1bb10b6aA10b468bbb662";

const PINN_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
];

const ADMIN_WALLET =
  "0x5c990ef8da7bafb7f9d618f436c36589aa5be408";

type Submission = {
  wallet: string;
  cid: string;
  status: "Pending" | "Paid";
};

export default function Home() {
 const [job, setJob] = useState({
  title: "Produce a ~100 page screenplay for THE AiGent",
  reward: 5000,
  description: "Submit your screenplay as a PDF file.",
}); 
  const [wallet, setWallet] = useState<string | null>(null);
const [airdropDone, setAirdropDone] = useState(false);
const [wrongNetwork, setWrongNetwork] = useState(false);
const [agreed, setAgreed] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [cid, setCid] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);

  /* ---------------- WALLET CONNECT ---------------- */

  async function connectWallet() {
    if (!window.ethereum) {
      alert("Please install MetaMask");
      return;
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send("eth_requestAccounts", []);
    setWallet(accounts[0]);

    const network = await provider.getNetwork();

if (network.chainId !== 137n) {
  setWrongNetwork(true);
} else {
  setWrongNetwork(false);
}

// MVP airdrop (first signup only)
if (!localStorage.getItem("pinn_airdropped")) {
  await airdropTokens(accounts[0]);
}
  }

  async function airdropTokens(userWallet: string) {
  if (!window.ethereum) return;

  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    const contract = new ethers.Contract(
      PINN_CONTRACT_ADDRESS,
      PINN_ABI,
      signer
    );

    // 100 PINN airdrop
    const amount = ethers.parseUnits("100", 18);
    const tx = await contract.transfer(userWallet, amount);
    await tx.wait();

    setAirdropDone(true);
    localStorage.setItem("pinn_airdropped", "true");
  } catch (err) {
    console.error("Airdrop failed", err);
  }
}

  async function addPINNToMetaMask() {
  if (!window.ethereum) {
    alert("MetaMask not found");
    return;
  }

  try {
    await window.ethereum.request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC20",
        options: {
          address: PINN_CONTRACT_ADDRESS,
          symbol: "PINN",
          decimals: 18,
        },
      },
    });
  } catch (error) {
    console.error(error);
    alert("Failed to add PINN token");
  }
}

  /* ---------------- FILE UPLOAD ---------------- */

  async function uploadToIPFS() {
    if (!file || !wallet) return;

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await axios.post("/api/upload", formData);
      const uploadedCid = res.data.cid;

      setCid(uploadedCid);

      setSubmissions((prev) => [
        ...prev,
        {
          wallet,
          cid: uploadedCid,
          status: "Pending",
        },
      ]);
    } catch (err) {
      alert("Upload failed");
      console.error(err);
    }

    setLoading(false);
  }

  /* ---------------- PAY REWARD ---------------- */

  async function payReward(recipient: string, index: number) {
  if (!window.ethereum) {
    alert("MetaMask not found");
    return;
  }

  // 🔒 HARD LOCK: prevent double payment
  if (submissions[index].status === "Paid") {
    alert("This submission has already been paid.");
    return;
  }

  try {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    const network = await provider.getNetwork();
    if (network.chainId !== 137n) {
      alert("❌ Please switch MetaMask to Polygon Mainnet");
      return;
    }

    const contract = new ethers.Contract(
      PINN_CONTRACT_ADDRESS,
      PINN_ABI,
      signer
    );

    const amount = ethers.parseUnits("5000", 18);

    const tx = await contract.transfer(recipient, amount);
    await tx.wait();

    // ✅ Lock after successful payment
    setSubmissions((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, status: "Paid" } : s
      )
    );

    alert("✅ 5000 PINN sent successfully");
  } catch (error) {
    console.error(error);
    alert("❌ Transfer failed");
  }
}

  const isAdmin =
    wallet &&
    wallet.toLowerCase() === ADMIN_WALLET.toLowerCase();

  /* ---------------- UI ---------------- */

  return (
  <main
    style={{
      padding: "40px",
      fontFamily: "Arial, sans-serif",
      maxWidth: "900px",
      margin: "0 auto",
      background: "#f9fafb",
      borderRadius: "10px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
      color: "#374151",
    }}
  >
    {/* HEADER */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        marginBottom: "24px",
      }}
    >
      <img
        src="/pinn44-logo.jpg"
        alt="PINN44 Logo"
        style={{
          height: "50px",
          width: "auto",
          borderRadius: "6px",
          border: "1px solid #ddd",
          background: "#fff",
          padding: "4px",
        }}
      />
      <h1 style={{ margin: 0, fontSize: "28px" }}>
        PINN44 MVP
      </h1>
    </div>

    {/* WALLET CONNECT */}
    <div
  style={{
    background: "#ffffff",
    padding: "16px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    marginBottom: "20px",
    color: "#111827",
  }}
>
  <h3 style={{ fontWeight: 700, marginBottom: "10px" }}>
    How to use THE AiGent MVP (4 simple steps)
  </h3>

  <ol style={{ paddingLeft: "18px", lineHeight: "1.7" }}>
    <li>Connect your MetaMask wallet</li>
    <li>
  Switch MetaMask to <strong>Polygon Mainnet</strong> (required)
</li>
    <li>Receive <strong>100 PINN tokens</strong> (first-time users)</li>
    <li>Submit your screenplay for review</li>
  </ol>
  <p style={{ marginTop: "10px", fontWeight: 600 }}>
  You’ll see a clear confirmation message after each successful step.
</p>
</div>
    
    {!wallet ? (
      <button
        onClick={connectWallet}
        style={{
          padding: "12px 18px",
          fontSize: "16px",
          cursor: "pointer",
        }}
      >
        Click here to connect your MetaMask wallet and receive 100 PINN tokens (free for first applicants)
      </button>
    ) : (
      <>
        <p style={{ marginBottom: "6px" }}>
          <strong>Connected wallet:</strong>
        </p>
        <p
          style={{
            wordBreak: "break-all",
            background: "#eef2f7",
            padding: "10px",
            borderRadius: "6px",
            fontSize: "14px",
          }}
        >
          {wallet}
        </p>

<div
  style={{
    marginTop: "10px",
    padding: "10px 14px",
    background: "#dcfce7",
    border: "1px solid #22c55e",
    borderRadius: "6px",
    color: "#166534",
    fontWeight: 600,
    fontSize: "15px",
lineHeight: "1.5",
  }}
>
  ✅ Wallet connected successfully  
  <br />
  Network: Polygon Mainnet
</div>

{wrongNetwork && (
  <div
    style={{
      marginTop: "10px",
      padding: "10px 14px",
      background: "#fee2e2",
      border: "1px solid #ef4444",
      borderRadius: "6px",
      color: "#991b1b",
      fontWeight: 600,
      fontSize: "15px",
lineHeight: "1.5",
    }}
  >
    ⚠ Please switch your wallet to Polygon Mainnet to continue
  </div>
)}

        {airdropDone && (
  <div
    style={{
      marginTop: "12px",
      padding: "12px",
      background: "#ecfeff",
      border: "1px solid #06b6d4",
      borderRadius: "6px",
      color: "#0e7490",
      fontWeight: 600,
      fontSize: "15px",
lineHeight: "1.5",
    }}
  >
    🎉 Success!  
    <br />
    100 PINN tokens have been airdropped to your wallet.
  </div>
)}
      </>
    )}

    <hr style={{ margin: "32px 0" }} />

    {/* USER JOB SUBMISSION */}
    {wallet && (
      <section id="job-submit-section" style={{ marginBottom: "40px" }}>
        <h2>Open Job Listing</h2>
<button
  style={{
    margin: "12px 0",
    padding: "12px 18px",
    fontSize: "16px",
    cursor: "pointer",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
  }}
  onClick={() => {
    document
      .getElementById("job-submit-section")
      ?.scrollIntoView({ behavior: "smooth" });
  }}
>
  Click here to submit your screenplay for THE AiGent
</button>

        <p>
          Produce a ~100 page screenplay for{" "}
          <strong>THE AiGent</strong>.
        </p>

        <p>
          <strong>Reward:</strong> 5000 PINN
        </p>

        <label
          style={{
            display: "block",
            margin: "16px 0",
            background: "#fff",
            padding: "12px",
            borderRadius: "6px",
            border: "1px solid #ddd",
          }}
        >
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            style={{ marginRight: "8px" }}
          />
          I agree to the platform terms and conditions (required to submit work)
        </label>

        <input
          type="file"
          onChange={(e) =>
            setFile(e.target.files ? e.target.files[0] : null)
          }
        />

        <br />
        <br />

        <button
          onClick={uploadToIPFS}
          disabled={loading || !agreed}
          style={{
            padding: "10px 16px",
            cursor: loading || !agreed ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Uploading... please wait" : "Submit Screenplay for THE AiGent"}
        </button>

        {cid && (
          <div
            style={{
              marginTop: "20px",
              background: "#fff",
              padding: "14px",
              borderRadius: "6px",
              border: "1px solid #ddd",
            }}
          >
            <p style={{ color: "green", marginBottom: "8px" }}>
              ✅ Submission received and stored on IPFS
            </p>

            <p style={{ marginBottom: "6px" }}>
              <strong>IPFS Hash (on-chain reference):</strong>
            </p>

            <code
              style={{
                display: "block",
                wordBreak: "break-all",
                background: "#f1f5f9",
                padding: "8px",
                borderRadius: "4px",
                fontSize: "13px",
              }}
            >
              {cid}
            </code>

            <a
              href={`https://gateway.pinata.cloud/ipfs/${cid}`}
              target="_blank"
              style={{ display: "inline-block", marginTop: "10px" }}
            >
              Open submission on IPFS
            </a>
          </div>
        )}
      </section>
   )}

    {/* ADMIN DASHBOARD */}
    {isAdmin && (
      <>
      <hr style={{ margin: "40px 0" }} />

        <h2>Admin Dashboard</h2>
<div
  style={{
    background: "#f8fafc",
    padding: "16px",
    borderRadius: "6px",
    border: "1px solid #ddd",
    marginBottom: "20px",
  }}
>
  <h3>Active Job Listing</h3>

  <p><strong>Title:</strong> {job.title}</p>
  <p><strong>Description:</strong> {job.description}</p>
  <p><strong>Reward:</strong> {job.reward} PINN</p>
</div>
        {submissions.length === 0 ? (
          <p>No submissions yet</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              border={1}
              cellPadding={12}
              cellSpacing={0}
              style={{
                width: "100%",
                marginTop: "20px",
                background: "#fff",
              }}
            >
              <thead>
                <tr>
                  <th>Wallet</th>
                  <th>IPFS</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s, i) => (
                  <tr key={i}>
                    <td
                      style={{
                        wordBreak: "break-all",
                        fontSize: "13px",
                      }}
                    >
                      {s.wallet}
                    </td>
                    <td>
                      <a
                        href={`https://gateway.pinata.cloud/ipfs/${s.cid}`}
                        target="_blank"
                      >
                        Open
                      </a>
                    </td>
                    <td>{s.status}</td>
                    <td>
                      {s.status.includes("Winner") ? (
                        "✅ Paid"
                      ) : (
                        <button
                          onClick={() => payReward(s.wallet, i)}
                        >
                          Select winner & send 5000 PINN
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    )}
  </main>
);}
