"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/chat");
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Incorrect password. Please try again.");
      setLoading(false);
    } else {
      router.replace("/chat");
    }
  };

  if (status === "loading") {
    return (
      <div className="login-container">
        <div className="loading-dots">
          <div className="loading-dot" />
          <div className="loading-dot" />
          <div className="loading-dot" />
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="glass-card login-card">
        {/* Logo */}
        <div className="login-logo">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>

        {/* Title */}
        <h1 className="login-title">DocMind AI</h1>
        <p className="login-subtitle">
          Intelligent multi-document RAG chatbot.
          <br />
          Upload PDFs, ask questions, get cited answers.
        </p>

        {/* Error */}
        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        {/* Form */}
        <form className="login-form" onSubmit={handleSubmit}>
          <div>
            <label className="login-label" htmlFor="password">
              Access Password
            </label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="Enter access password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            className="btn btn-primary w-full"
            style={{ padding: "13px 20px" }}
            disabled={loading || !password.trim()}
          >
            {loading ? (
              <>
                <span style={{ fontSize: "12px" }}>Authenticating</span>
                <div className="loading-dots" style={{ gap: "4px" }}>
                  <div className="loading-dot" style={{ width: "5px", height: "5px" }} />
                  <div className="loading-dot" style={{ width: "5px", height: "5px" }} />
                  <div className="loading-dot" style={{ width: "5px", height: "5px" }} />
                </div>
              </>
            ) : (
              <>Enter DocMind</>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="login-footer">
          <p>Powered by Google Gemini · Pinecone · Next.js</p>
          <p style={{ marginTop: "4px" }}>
            RAG · Semantic Search · Streaming
          </p>
        </div>
      </div>
    </div>
  );
}
