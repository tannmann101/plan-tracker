import { useState, useEffect } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { SANS, MONO, PAGE, CARD, INK, MUTE, LINE, TEAL, BRICK, RADIUS, RADIUS_SM, SHADOW_CARD } from "./theme";
import { GlobalStyle } from "./ui";

export function Centered({ children, bare }) {
  return (
    <div style={{ minHeight: "100vh", background: PAGE, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, padding: 20 }}>
      <GlobalStyle />
      {bare ? (
        <div style={{ maxWidth: 360, textAlign: "center" }}>{children}</div>
      ) : (
        <div style={{
          maxWidth: 380, width: "100%", textAlign: "center", background: CARD, border: `1px solid ${LINE}`,
          borderRadius: RADIUS, boxShadow: SHADOW_CARD, padding: "36px 32px",
        }}>{children}</div>
      )}
    </div>
  );
}

function GoogleButton({ onClick, label = "Sign in with Google" }) {
  return (
    <button
      onClick={onClick}
      className="ui-btn ui-btn-primary"
      style={{
        "--btn-c": INK, border: `1px solid ${INK}`, background: INK, color: "#fff", fontFamily: SANS, fontWeight: 600,
        fontSize: 14, padding: "11px 20px", borderRadius: RADIUS, cursor: "pointer", width: "100%",
      }}
    >
      {label}
    </button>
  );
}

export function useAuthUser() {
  const [user, setUser] = useState(undefined); // undefined = still checking, null = signed out
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return user;
}

export default function AuthGate({ user, forbidden, children }) {
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");

  const doSignIn = async () => {
    setSigningIn(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(err.message || "Sign-in failed.");
    } finally {
      setSigningIn(false);
    }
  };

  if (user === undefined) {
    return <Centered bare><span style={{ fontFamily: MONO, color: MUTE, fontSize: 13 }}>loading…</span></Centered>;
  }

  if (!user) {
    return (
      <Centered>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: TEAL, margin: "0 auto 14px" }} />
        <h1 style={{ fontFamily: SANS, fontSize: 21, fontWeight: 700, letterSpacing: "-0.01em", margin: "0 0 6px", color: INK }}>3-Year Plan Tracker</h1>
        <p style={{ fontFamily: MONO, fontSize: 12.5, color: MUTE, margin: "0 0 22px" }}>Sign in to see the shared item list.</p>
        <GoogleButton onClick={doSignIn} label={signingIn ? "Signing in…" : "Sign in with Google"} />
        {error && <p style={{ fontFamily: MONO, fontSize: 11.5, color: BRICK, marginTop: 14 }}>{error}</p>}
      </Centered>
    );
  }

  if (forbidden) {
    return (
      <Centered>
        <h1 style={{ fontFamily: SANS, fontSize: 21, fontWeight: 700, letterSpacing: "-0.01em", margin: "0 0 6px", color: INK }}>Not authorized</h1>
        <p style={{ fontFamily: MONO, fontSize: 12.5, color: MUTE, margin: "0 0 6px" }}>
          Signed in as <strong style={{ color: INK }}>{user.email}</strong>
        </p>
        <p style={{ fontFamily: MONO, fontSize: 12.5, color: MUTE, margin: "0 0 22px" }}>
          This tracker is restricted to specific accounts. Sign out and try a different one.
        </p>
        <button
          className="ui-btn"
          onClick={() => signOut(auth)}
          style={{ "--btn-c": TEAL, border: `1px solid ${TEAL}`, background: "transparent", color: TEAL, fontFamily: MONO, fontSize: 12, padding: "7px 14px", borderRadius: RADIUS_SM, cursor: "pointer" }}
        >
          sign out
        </button>
      </Centered>
    );
  }

  return children;
}
