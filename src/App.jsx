import { useState, useCallback } from "react";
import { signOut } from "firebase/auth";
import AuthGate, { useAuthUser } from "./AuthGate";
import { auth } from "./firebase";
import { useSecretary } from "./useSecretary";
import { useRoute } from "./useRoute";
import { useViewport } from "./useViewport";
import { SANS, MONO, SERIF, PAGE, CARD, MUTE, INK, INKBLUE, INKBLUE_SOFT, BRICK, LINE, RADIUS_SM } from "./theme";
import { GlobalStyle, FAB, Btn, IconButton, Wordmark } from "./ui";
import { triageCapture } from "./lib/claude";
import { CaptureBar } from "./components/CaptureBar";
import AddForm from "./components/AddForm";
import { SecretaryChatPanel } from "./pages/Secretary";

import Today from "./pages/Today";
import ThisWeek from "./pages/ThisWeek";
import Plans from "./pages/Plans";
import Workspace from "./pages/Workspace";
import Trends from "./pages/Trends";
import Log from "./pages/Log";
import Secretary from "./pages/Secretary";
import SearchPage from "./pages/Search";
import Settings from "./pages/Settings";

// §4 -- flat tabbed shell on mobile: top bar (Today/Week/Plans/Workspace/
// Trends) + hamburger (Search/Log/Secretary/Settings), completely unchanged
// from the original mobile-first design. Desktop (see useViewport) gets its
// own shell below -- a persistent sidebar covering the same nine routes
// (no hamburger needed, there's room) plus a dockable Secretary chat panel
// -- reusing every page/hook/handler here unchanged, just laid out
// differently. Both accounts render and act identically (§13) -- there is
// no isOwner branch left anywhere here.
const TOP_TABS = [
  { path: "/today", label: "Today" },
  { path: "/week", label: "Week" },
  { path: "/plans", label: "Plans" },
  { path: "/workspace", label: "Workspace" },
  { path: "/trends", label: "Trends" },
];

const MENU_ITEMS = [
  { path: "/search", label: "Search" },
  { path: "/log", label: "Log" },
  { path: "/secretary", label: "Secretary" },
  { path: "/settings", label: "Settings" },
];

const CHAT_DOCK_WIDTH = 360;

function Shell({ user }) {
  const secretary = useSecretary(true);
  const { path, navigate } = useRoute();
  const { isDesktop } = useViewport();
  const [menuOpen, setMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [focusKindId, setFocusKindId] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);

  const goToday = () => navigate("/today");

  // Threaded down through every page that renders a "why is this here"
  // trace -- tapping a Kind in that chain always lands on Workspace,
  // focused on it, regardless of which page the tap happened from.
  const navigateKind = useCallback((kindId) => {
    setFocusKindId(kindId);
    navigate("/workspace");
  }, [navigate]);

  // triageCapture drafts a pendingOperation server-side (see
  // functions/index.js) -- this just kicks that off and refreshes so the
  // Secretary review log picks it up; nothing here decides a placement.
  const handleCapture = useCallback(async (text) => {
    setCaptureBusy(true);
    try {
      const existingKinds = (secretary.kinds || []).map((k) => ({ id: k.id, title: k.title, kindType: k.kindType, domain: k.domain }));
      await triageCapture({ text, existingKinds });
      await secretary.refresh();
    } finally {
      setCaptureBusy(false);
    }
  }, [secretary]);

  if (secretary.status === "forbidden") return <AuthGate user={user} forbidden />;

  const stillLoading = secretary.status === "loading" && !secretary.kinds;
  const unsortedCount = (secretary.pendingOperations || []).filter((o) => o.status === "pending").length;

  const pageProps = { secretary, onBack: goToday, onNavigateKind: navigateKind, onNavigate: navigate };

  const pageContent = stillLoading ? (
    <div style={{ fontFamily: MONO, fontSize: 12.5, color: MUTE, padding: "30px 4px" }}>Gathering your affairs…</div>
  ) : secretary.status === "error" ? (
    <div style={{ fontFamily: MONO, fontSize: 12.5, color: BRICK, padding: "30px 4px" }}>
      I could not retrieve your records. <Btn small onClick={secretary.refresh} color={BRICK}>Retry</Btn>
    </div>
  ) : path === "/week" ? (
    <ThisWeek {...pageProps} />
  ) : path === "/plans" ? (
    <Plans {...pageProps} />
  ) : path === "/workspace" ? (
    <Workspace {...pageProps} focusKindId={focusKindId} onFocusHandled={() => setFocusKindId(null)} />
  ) : path === "/trends" ? (
    <Trends {...pageProps} />
  ) : path === "/search" ? (
    <SearchPage {...pageProps} />
  ) : path === "/log" ? (
    <Log {...pageProps} />
  ) : path === "/secretary" ? (
    <Secretary {...pageProps} />
  ) : path === "/settings" ? (
    <Settings {...pageProps} />
  ) : (
    <Today {...pageProps} />
  );

  const fab = (
    <FAB
      onClick={() => setAddOpen(true)}
      title="Add"
      offsetRight={isDesktop && chatOpen ? CHAT_DOCK_WIDTH + 20 : 20}
    />
  );
  const addForm = addOpen && <AddForm secretary={secretary} onClose={() => setAddOpen(false)} onNavigate={navigate} />;

  if (isDesktop) {
    const allRoutes = [...TOP_TABS, ...MENU_ITEMS];
    return (
      <div style={{ minHeight: "100vh", background: PAGE, fontFamily: SANS, display: "flex" }}>
        <GlobalStyle />

        <aside style={{
          width: 220, flex: "none", position: "sticky", top: 0, height: "100vh",
          display: "flex", flexDirection: "column", padding: "22px 14px",
          borderRight: `1px solid ${LINE}`, background: CARD,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", padding: "0 6px 20px" }} onClick={goToday}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: INKBLUE }} />
            <Wordmark />
          </div>

          <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {allRoutes.map((r) => (
              <button
                key={r.path}
                type="button"
                onClick={() => navigate(r.path)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  border: "none", textAlign: "left", background: path === r.path ? INK : "transparent",
                  color: path === r.path ? "#fff" : INK, fontFamily: MONO, fontSize: 12.5,
                  fontWeight: path === r.path ? 600 : 400, padding: "8px 10px", borderRadius: RADIUS_SM, cursor: "pointer",
                }}
              >
                <span>{r.label}</span>
                {r.path === "/secretary" && unsortedCount > 0 && (
                  <span style={{
                    fontFamily: MONO, fontSize: 10, fontWeight: 600, color: path === r.path ? "#fff" : BRICK,
                  }}>{unsortedCount}</span>
                )}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setChatOpen((o) => !o)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14,
              border: `1px solid ${chatOpen ? INKBLUE : LINE}`, textAlign: "left", background: chatOpen ? INKBLUE_SOFT : "transparent",
              color: chatOpen ? INKBLUE : MUTE, fontFamily: MONO, fontSize: 12, padding: "8px 10px", borderRadius: RADIUS_SM, cursor: "pointer",
            }}
          >
            <span>Ask Secretary</span>
            <span>{chatOpen ? "✕" : "→"}</span>
          </button>

          <div style={{ marginTop: "auto", paddingTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
            {secretary.saveStatus === "saving" && <span style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE }}>saving…</span>}
            {secretary.saveStatus === "error" && <span style={{ fontFamily: MONO, fontSize: 10.5, color: BRICK }}>save failed</span>}
            <span style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, wordBreak: "break-all" }}>{user.email}</span>
            <button
              onClick={() => signOut(auth)}
              style={{ border: `1px solid ${LINE}`, background: "transparent", color: MUTE, fontFamily: MONO, fontSize: 11, padding: "5px 10px", borderRadius: RADIUS_SM, cursor: "pointer" }}
            >
              sign out
            </button>
          </div>
        </aside>

        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ maxWidth: 1120, width: "100%", margin: "0 auto", padding: "22px 32px 70px" }}>
            <div style={{ marginBottom: 18 }}>
              <CaptureBar onCapture={handleCapture} busy={captureBusy} />
            </div>
            {pageContent}
          </div>
        </main>

        {chatOpen && (
          <aside style={{
            width: CHAT_DOCK_WIDTH, flex: "none", position: "sticky", top: 0, height: "100vh",
            borderLeft: `1px solid ${LINE}`, background: CARD, display: "flex", flexDirection: "column",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 16px 12px", borderBottom: `1px solid ${LINE}` }}>
              <span style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: INK }}>Secretary</span>
              <IconButton title="Close" onClick={() => setChatOpen(false)}>×</IconButton>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              <SecretaryChatPanel secretary={secretary} />
            </div>
          </aside>
        )}

        {fab}
        {addForm}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: PAGE, fontFamily: SANS }}>
      <GlobalStyle />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 18px 110px" }}>
        <header style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={goToday}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: INKBLUE }} />
              <Wordmark />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {secretary.saveStatus === "saving" && <span style={{ fontFamily: MONO, fontSize: 11, color: MUTE }}>saving…</span>}
              {secretary.saveStatus === "error" && <span style={{ fontFamily: MONO, fontSize: 11, color: BRICK }}>save failed</span>}
              <span style={{ fontFamily: MONO, fontSize: 11, color: MUTE }}>{user.email}</span>
              <button
                onClick={() => signOut(auth)}
                style={{ border: `1px solid ${LINE}`, background: "transparent", color: MUTE, fontFamily: MONO, fontSize: 11, padding: "5px 10px", borderRadius: RADIUS_SM, cursor: "pointer" }}
              >
                sign out
              </button>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <nav style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {TOP_TABS.map((t) => (
                <button
                  key={t.path}
                  type="button"
                  onClick={() => navigate(t.path)}
                  style={{
                    border: "none", background: path === t.path ? INK : "transparent", color: path === t.path ? "#fff" : MUTE,
                    fontFamily: MONO, fontSize: 12, fontWeight: path === t.path ? 600 : 400, padding: "6px 13px",
                    borderRadius: 999, cursor: "pointer",
                  }}
                >{t.label}</button>
              ))}
            </nav>
            <div style={{ position: "relative" }}>
              <Btn small onClick={() => setMenuOpen((m) => !m)} color={unsortedCount ? BRICK : MUTE}>
                ☰{unsortedCount > 0 ? ` (${unsortedCount})` : ""}
              </Btn>
              {menuOpen && (
                <div style={{
                  position: "absolute", right: 0, top: "calc(100% + 6px)", background: "#fff", border: `1px solid ${LINE}`,
                  borderRadius: 10, boxShadow: "0 4px 14px rgba(36,34,32,0.16)", zIndex: 50, minWidth: 140, overflow: "hidden",
                }}>
                  {MENU_ITEMS.map((m) => (
                    <button
                      key={m.path}
                      type="button"
                      onClick={() => { navigate(m.path); setMenuOpen(false); }}
                      style={{
                        display: "block", width: "100%", textAlign: "left", border: "none",
                        background: path === m.path ? "#F2EEE3" : "transparent", color: INK,
                        fontFamily: MONO, fontSize: 12, padding: "9px 14px", cursor: "pointer",
                      }}
                    >
                      {m.label}{m.path === "/secretary" && unsortedCount > 0 ? ` (${unsortedCount})` : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <CaptureBar onCapture={handleCapture} busy={captureBusy} />
          </div>
        </header>

        {pageContent}
      </div>

      {fab}
      {addForm}
    </div>
  );
}

export default function App() {
  const user = useAuthUser();
  return (
    <AuthGate user={user}>
      {user && <Shell user={user} />}
    </AuthGate>
  );
}
