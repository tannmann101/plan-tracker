import { useState, useCallback } from "react";
import { signOut } from "firebase/auth";
import AuthGate, { useAuthUser } from "./AuthGate";
import { auth } from "./firebase";
import { useSecretary } from "./useSecretary";
import { useRoute } from "./useRoute";
import { useViewport } from "./useViewport";
import { SANS, MONO, SERIF, PAGE, CARD, MUTE, INK, INKBLUE, BRICK, LINE, RADIUS_SM, SHADOW_RGB } from "./theme";
import { GlobalStyle, FAB, Btn, IconButton, ThemeToggle, Wordmark } from "./ui";
import { triageCapture } from "./lib/claude";
import { CaptureBar } from "./components/CaptureBar";
import AddForm from "./components/AddForm";
import { SecretaryChatPanel } from "./pages/Secretary";

import Today from "./pages/Today";
import ThisWeek from "./pages/ThisWeek";
import Plans from "./pages/Plans";
import Workspace from "./pages/Workspace";
import Log from "./pages/Log";
import Secretary from "./pages/Secretary";
import SearchPage from "./pages/Search";
import Settings from "./pages/Settings";

// §4 -- flat tabbed shell on mobile: top bar (Today/Week/Plans/Workspace)
// + hamburger (Search/Log/Secretary/Settings), completely unchanged from
// the original mobile-first design. Desktop (see useViewport) gets its own
// shell below -- a persistent sidebar for the same four primary tabs, a
// "More" dropdown standing in for the hamburger (Search/Log/Settings), a
// distinctly-styled Secretary shortcut (its own page, not lumped into
// More), and a dockable Secretary chat panel for quick in-context questions
// without leaving the current page -- reusing every page/hook/handler here
// unchanged, just laid out differently. Both accounts render and act
// identically (§13) -- there is no isOwner branch left anywhere here.
//
// Trends used to be a fifth tab here; it's retired (folded into
// Workspace's own Views gallery, per the household's "land every view in
// one place" request) rather than kept as a second, now-redundant
// analytics page.
const TOP_TABS = [
  { path: "/today", label: "Today" },
  { path: "/week", label: "Week" },
  { path: "/plans", label: "Plans" },
  { path: "/workspace", label: "Workspace" },
];

const MENU_ITEMS = [
  { path: "/search", label: "Search" },
  { path: "/log", label: "Log" },
  { path: "/secretary", label: "Secretary" },
  { path: "/settings", label: "Settings" },
];

// Everything but Secretary -- desktop's "More" dropdown stands in for the
// mobile hamburger with just the plain utility pages; Secretary gets its
// own distinct button instead (see DESKTOP_MORE_ITEMS' comment at the call
// site below).
const DESKTOP_MORE_ITEMS = MENU_ITEMS.filter((m) => m.path !== "/secretary");

const CHAT_DOCK_WIDTH = 360;

function Shell({ user }) {
  const secretary = useSecretary(true);
  const { path, navigate } = useRoute();
  const { isDesktop } = useViewport();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [focusKindId, setFocusKindId] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [askSecretaryContext, setAskSecretaryContext] = useState(null); // { family, entity }

  const goToday = () => navigate("/today");

  // Threaded down through every page that renders a "why is this here"
  // trace -- tapping a Kind in that chain always lands on Workspace,
  // focused on it, regardless of which page the tap happened from.
  const navigateKind = useCallback((kindId) => {
    setFocusKindId(kindId);
    navigate("/workspace");
  }, [navigate]);

  // The "Ask Secretary about this" affordance every entity card, practice
  // row, and discipline card now carries (EntityCard, Plans, Discipline
  // DetailModal, ...) -- one handler, threaded through pageProps so every
  // page gets it for free. Desktop already has a persistent chat dock, so
  // scoping it and opening it is enough; mobile has no such dock, so it
  // hands the scope off to the dedicated Secretary page instead (picked up
  // once via focusEntityContext, the same one-shot pattern Workspace's own
  // focusKindId already uses).
  const askSecretary = useCallback((family, entity) => {
    setAskSecretaryContext({ family, entity });
    if (isDesktop) setChatOpen(true);
    else navigate("/secretary");
  }, [isDesktop, navigate]);

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

  const pageProps = { secretary, onBack: goToday, onNavigateKind: navigateKind, onNavigate: navigate, onAskSecretary: askSecretary };

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
  ) : path === "/search" ? (
    <SearchPage {...pageProps} />
  ) : path === "/log" ? (
    <Log {...pageProps} />
  ) : path === "/secretary" ? (
    <Secretary
      {...pageProps}
      focusEntityContext={!isDesktop ? askSecretaryContext : null}
      onFocusHandled={() => setAskSecretaryContext(null)}
    />
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
    return (
      <div style={{ minHeight: "100vh", background: PAGE, fontFamily: SANS, display: "flex" }}>
        <GlobalStyle />

        <aside style={{
          width: 210, flex: "none", position: "sticky", top: 0, height: "100vh",
          display: "flex", flexDirection: "column", padding: "22px 14px",
          borderRight: `1px solid ${LINE}`, background: CARD,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", padding: "0 6px 20px" }} onClick={goToday}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: INKBLUE }} />
            <Wordmark />
          </div>

          <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {TOP_TABS.map((t) => (
              <button
                key={t.path}
                type="button"
                onClick={() => navigate(t.path)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  border: "none", textAlign: "left", background: path === t.path ? INK : "transparent",
                  color: path === t.path ? CARD : INK, fontFamily: MONO, fontSize: 12.5,
                  fontWeight: path === t.path ? 600 : 400, padding: "8px 10px", borderRadius: RADIUS_SM, cursor: "pointer",
                }}
              >
                <span>{t.label}</span>
              </button>
            ))}
          </nav>

          <div style={{ marginTop: "auto", paddingTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ThemeToggle />
              {secretary.saveStatus === "saving" && <span style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE }}>saving…</span>}
              {secretary.saveStatus === "error" && <span style={{ fontFamily: MONO, fontSize: 10.5, color: BRICK }}>save failed</span>}
            </div>
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
          <div style={{ maxWidth: 1640, width: "100%", margin: "0 auto", padding: "20px 32px 70px", flex: 1 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "flex-end", marginBottom: 12 }}>
              <IconButton title={chatOpen ? "Close quick chat" : "Ask Secretary (quick chat)"} onClick={() => setChatOpen((o) => !o)} color={chatOpen ? INKBLUE : MUTE}>
                💬
              </IconButton>
              <button
                type="button"
                onClick={() => navigate("/secretary")}
                title="Open Secretary"
                style={{
                  display: "flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer",
                  background: path === "/secretary" ? INK : INKBLUE, color: CARD,
                  fontFamily: MONO, fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: 999,
                }}
              >
                Secretary
                {unsortedCount > 0 && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 16, height: 16,
                    borderRadius: 999, background: CARD, color: BRICK, fontSize: 10, fontWeight: 700, padding: "0 4px",
                  }}>{unsortedCount}</span>
                )}
              </button>
              <div style={{ position: "relative" }}>
                <Btn small onClick={() => setMoreOpen((m) => !m)} color={MUTE}>More ▾</Btn>
                {moreOpen && (
                  <div style={{
                    position: "absolute", right: 0, top: "calc(100% + 6px)", background: CARD, border: `1px solid ${LINE}`,
                    borderRadius: 10, boxShadow: `0 4px 14px rgb(${SHADOW_RGB} / 0.16)`, zIndex: 50, minWidth: 140, overflow: "hidden",
                  }}>
                    {DESKTOP_MORE_ITEMS.map((m) => (
                      <button
                        key={m.path}
                        type="button"
                        onClick={() => { navigate(m.path); setMoreOpen(false); }}
                        style={{
                          display: "block", width: "100%", textAlign: "left", border: "none",
                          background: path === m.path ? PAGE : "transparent", color: INK,
                          fontFamily: MONO, fontSize: 12, padding: "9px 14px", cursor: "pointer",
                        }}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

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
              <span style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: INK }}>
                Quick chat{askSecretaryContext ? ` — ${askSecretaryContext.entity.title}` : ""}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {askSecretaryContext && <Btn small color={MUTE} onClick={() => setAskSecretaryContext(null)}>Unfocus</Btn>}
                <IconButton title="Close" onClick={() => { setChatOpen(false); setAskSecretaryContext(null); }}>×</IconButton>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              <SecretaryChatPanel
                secretary={secretary}
                entityContext={askSecretaryContext ? { family: askSecretaryContext.family, id: askSecretaryContext.entity.id, title: askSecretaryContext.entity.title } : null}
              />
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
              <ThemeToggle />
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
                    border: "none", background: path === t.path ? INK : "transparent", color: path === t.path ? CARD : MUTE,
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
                  position: "absolute", right: 0, top: "calc(100% + 6px)", background: CARD, border: `1px solid ${LINE}`,
                  borderRadius: 10, boxShadow: `0 4px 14px rgb(${SHADOW_RGB} / 0.16)`, zIndex: 50, minWidth: 140, overflow: "hidden",
                }}>
                  {MENU_ITEMS.map((m) => (
                    <button
                      key={m.path}
                      type="button"
                      onClick={() => { navigate(m.path); setMenuOpen(false); }}
                      style={{
                        display: "block", width: "100%", textAlign: "left", border: "none",
                        background: path === m.path ? PAGE : "transparent", color: INK,
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
