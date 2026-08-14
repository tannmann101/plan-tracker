import { useState, useEffect } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { SANS, SERIF, MONO, PAGE, CARD, INK, MUTE, LINE, INKBLUE, BRICK, RADIUS, RADIUS_SM, SHADOW_CARD } from "./theme";
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
    return <Centered bare><span style={{ fontFamily: MONO, color: MUTE, fontSize: 13 }}>One moment…</span></Centered>;
  }

  if (!user) {
    return (
      <Centered>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: INKBLUE, margin: "0 auto 14px" }} />
        <h1 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, letterSpacing: "-0.005em", margin: "0 0 6px", color: INK }}>Secretary</h1>
        <p style={{ fontFamily: MONO, fontSize: 12.5, color: MUTE, margin: "0 0 22px" }}>
          Good day. Kindly sign in so I may attend to the household.
        </p>
        <GoogleButton onClick={doSignIn} label={signingIn ? "Signing in…" : "Sign in with Google"} />
        {error && <p style={{ fontFamily: MONO, fontSize: 11.5, color: BRICK, marginTop: 14 }}>{error}</p>}
      </Centered>
    );
  }

  if (forbidden) {
    return (
      <Centered>
        <h1 style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, letterSpacing: "-0.005em", margin: "0 0 6px", color: INK }}>I'm afraid I don't recognize you</h1>
        <p style={{ fontFamily: MONO, fontSize: 12.5, color: MUTE, margin: "0 0 6px" }}>
          Signed in as <strong style={{ color: INK }}>{user.email}</strong>
        </p>
        <p style={{ fontFamily: MONO, fontSize: 12.5, color: MUTE, margin: "0 0 22px" }}>
          This household's affairs are private. Please sign out and try the account you were given.
        </p>
        <button
          className="ui-btn"
          onClick={() => signOut(auth)}
          style={{ "--btn-c": INKBLUE, border: `1px solid ${INKBLUE}`, background: "transparent", color: INKBLUE, fontFamily: MONO, fontSize: 12, padding: "7px 14px", borderRadius: RADIUS_SM, cursor: "pointer" }}
        >
          sign out
        </button>
      </Centered>
    );
  }

  return children;
}
