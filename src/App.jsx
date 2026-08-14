import { useState, useCallback } from "react";
import { signOut } from "firebase/auth";
import AuthGate, { useAuthUser } from "./AuthGate";
import { auth } from "./firebase";
import { useSecretary } from "./useSecretary";
import { SANS, MONO, PAGE, MUTE, INKBLUE, BRICK, LINE, RADIUS_SM } from "./theme";
import { GlobalStyle, FAB, Btn, Wordmark } from "./ui";
import { isOwnerEmail } from "./constants";
import { triageCapture } from "./lib/claude";
import { placeCapture } from "./lib/placeCapture";
import { CaptureBar, RichCaptureModal } from "./components/CaptureBar";
import CaptureConfirmModal from "./components/CaptureConfirmModal";

import Hub from "./pages/Hub";
import Today from "./pages/Today";
import ThisWeek from "./pages/ThisWeek";
import Goals from "./pages/Goals";
import Domains from "./pages/Domains";
import Inbox from "./pages/Inbox";
import WeeklyMeetingImport from "./pages/WeeklyMeetingImport";
import WeeklyView from "./pages/WeeklyView";
import SearchPage from "./pages/Search";
import Settings from "./pages/Settings";

function Shell({ user }) {
  const secretary = useSecretary(true);
  const isOwner = isOwnerEmail(user.email);
  const [screen, setScreen] = useState("hub");
  const [richCaptureOpen, setRichCaptureOpen] = useState(false);
  const [confirmCapture, setConfirmCapture] = useState(null);
  const [captureBusy, setCaptureBusy] = useState(false);

  const goBack = () => setScreen("hub");

  const existingGoalsContext = useCallback(
    () => (secretary.goals || []).map((g) => ({ id: g.id, title: g.title, tier: g.tier, domain: g.domain })),
    [secretary.goals]
  );

  const handleCapture = useCallback(async (text, hold) => {
    setCaptureBusy(true);
    try {
      if (hold) {
        await secretary.saveCapture({ status: "holding", rawText: text });
        return;
      }
      const captureId = await secretary.saveCapture({ status: "pending-triage", rawText: text });
      try {
        const draft = await triageCapture({ text, existingGoals: existingGoalsContext(), priorAnswers: [] });
        if (draft.confidence === "high" && !draft.clarifyingQuestion) {
          await placeCapture(secretary, captureId, text, draft);
        } else {
          await secretary.saveCapture({ id: captureId, status: "pending-triage", rawText: text, triageDraft: draft });
          setConfirmCapture({ id: captureId, rawText: text, triageDraft: draft });
        }
      } catch (err) {
        console.error("Triage failed", err);
      }
    } finally {
      setCaptureBusy(false);
    }
  }, [secretary, existingGoalsContext]);

  if (secretary.status === "forbidden") return <AuthGate user={user} forbidden />;

  const reviewCount = (secretary.captures || []).filter((c) => c.status === "drift" || c.status === "pending-triage").length;
  const stillLoading = secretary.status === "loading" && !secretary.goals;

  return (
    <div style={{ minHeight: "100vh", background: PAGE, fontFamily: SANS }}>
      <GlobalStyle />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 18px 110px" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={goBack}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: INKBLUE }} />
            <Wordmark />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {secretary.saveStatus === "saving" && <span style={{ fontFamily: MONO, fontSize: 11, color: MUTE }}>saving…</span>}
            {secretary.saveStatus === "error" && <span style={{ fontFamily: MONO, fontSize: 11, color: BRICK }}>save failed</span>}
            <Btn small onClick={() => setScreen("search")} color={MUTE}>Search</Btn>
            {isOwner && (
              <Btn small onClick={() => setScreen("inbox")} color={reviewCount ? BRICK : MUTE}>
                Review{reviewCount > 0 ? ` (${reviewCount})` : ""}
              </Btn>
            )}
            <Btn small onClick={() => setScreen("settings")} color={MUTE}>Settings</Btn>
            <span style={{ fontFamily: MONO, fontSize: 11, color: MUTE }}>{isOwner ? user.email : `${user.email} · viewing only`}</span>
            <button
              onClick={() => signOut(auth)}
              style={{ border: `1px solid ${LINE}`, background: "transparent", color: MUTE, fontFamily: MONO, fontSize: 11, padding: "5px 10px", borderRadius: RADIUS_SM, cursor: "pointer" }}
            >
              sign out
            </button>
          </div>
        </header>

        {isOwner && (
          <div style={{ marginBottom: 18 }}>
            <CaptureBar onCapture={handleCapture} busy={captureBusy} />
          </div>
        )}

        {stillLoading ? (
          <div style={{ fontFamily: MONO, fontSize: 12.5, color: MUTE, padding: "30px 4px" }}>Gathering your affairs…</div>
        ) : secretary.status === "error" ? (
          <div style={{ fontFamily: MONO, fontSize: 12.5, color: BRICK, padding: "30px 4px" }}>
            I could not retrieve your records. <Btn small onClick={secretary.refresh} color={BRICK}>Retry</Btn>
          </div>
        ) : screen === "hub" ? (
          <Hub secretary={secretary} isOwner={isOwner} onNavigate={setScreen} reviewCount={reviewCount} />
        ) : screen === "today" ? (
          <Today secretary={secretary} isOwner={isOwner} onBack={goBack} />
        ) : screen === "thisweek" ? (
          <ThisWeek secretary={secretary} isOwner={isOwner} onBack={goBack} onNavigate={setScreen} />
        ) : screen === "goals" ? (
          <Goals secretary={secretary} isOwner={isOwner} onBack={goBack} />
        ) : screen === "domains" ? (
          <Domains secretary={secretary} isOwner={isOwner} onBack={goBack} />
        ) : screen === "inbox" ? (
          <Inbox secretary={secretary} isOwner={isOwner} onBack={goBack} />
        ) : screen === "weeklyimport" ? (
          <WeeklyMeetingImport secretary={secretary} onBack={() => setScreen("thisweek")} />
        ) : screen === "weeklyview" ? (
          <WeeklyView secretary={secretary} onBack={() => setScreen("thisweek")} />
        ) : screen === "search" ? (
          <SearchPage secretary={secretary} onBack={goBack} />
        ) : screen === "settings" ? (
          <Settings secretary={secretary} isOwner={isOwner} onBack={goBack} />
        ) : null}
      </div>

      {isOwner && <FAB onClick={() => setRichCaptureOpen(true)} />}
      {richCaptureOpen && (
        <RichCaptureModal
          onClose={() => setRichCaptureOpen(false)}
          onCapture={handleCapture}
          onOpenWeeklyImport={() => setScreen("weeklyimport")}
          busy={captureBusy}
        />
      )}
      {confirmCapture && (
        <CaptureConfirmModal capture={confirmCapture} secretary={secretary} onClose={() => setConfirmCapture(null)} />
      )}
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
