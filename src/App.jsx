import { useState } from "react";
import { signOut } from "firebase/auth";
import AuthGate, { useAuthUser } from "./AuthGate";
import { auth } from "./firebase";
import { useItems } from "./useItems";
import { SANS, MONO, PAGE, INK, MUTE, TEAL, BRICK, LINE, RADIUS_SM } from "./theme";
import { GlobalStyle, TabBar, Btn } from "./ui";
import ItemForm from "./ItemForm";
import Today from "./Today";
import WeeklyTriage from "./WeeklyTriage";
import MonthlyCheckin from "./MonthlyCheckin";
import Overview from "./Overview";
import Trends from "./Trends";
import { IconToday, IconTriage, IconCalendar, IconOverview, IconTrends } from "./icons";

const TABS = [
  { id: "today", label: "Today", icon: <IconToday /> },
  { id: "weekly", label: "Weekly Triage", icon: <IconTriage /> },
  { id: "monthly", label: "Monthly Check-In", icon: <IconCalendar /> },
  { id: "overview", label: "Overview", icon: <IconOverview /> },
  { id: "trends", label: "Trends", icon: <IconTrends /> },
];

function Shell({ user }) {
  const { items, events, status, saveStatus, refresh, saveItem, deleteItem } = useItems(true);
  const [tab, setTab] = useState("today");
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  if (status === "forbidden") {
    return <AuthGate user={user} forbidden />;
  }

  const openForm = (item) => {
    setEditingItem(item || null);
    setFormOpen(true);
  };

  const handleSave = async (item) => {
    await saveItem(item);
    setFormOpen(false);
    setEditingItem(null);
  };

  const handleStatusChange = (item, newStatus) => {
    saveItem({ ...item, status: newStatus });
  };

  const handleDelete = (item) => {
    deleteItem(item.id);
  };

  return (
    <div style={{ minHeight: "100vh", background: PAGE, fontFamily: SANS }}>
      <GlobalStyle />
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "28px 18px 60px" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: TEAL }} />
            <h1 style={{ fontFamily: SANS, fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em", color: INK, margin: 0 }}>3-Year Plan Tracker</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: MUTE }}>{user.email}</span>
            <button
              onClick={() => signOut(auth)}
              style={{ border: `1px solid ${LINE}`, background: "transparent", color: MUTE, fontFamily: MONO, fontSize: 11, padding: "5px 10px", borderRadius: RADIUS_SM, cursor: "pointer" }}
            >
              sign out
            </button>
          </div>
        </header>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
          <TabBar tabs={TABS} active={tab} onChange={setTab} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {saveStatus === "saving" && <span style={{ fontFamily: MONO, fontSize: 11, color: MUTE }}>saving…</span>}
            {saveStatus === "error" && <span style={{ fontFamily: MONO, fontSize: 11, color: BRICK }}>save failed</span>}
            <Btn small onClick={refresh} color={MUTE}>Refresh</Btn>
            <Btn small primary color={TEAL} onClick={() => openForm(null)}>+ Add item</Btn>
          </div>
        </div>

        {formOpen && (
          <ItemForm
            item={editingItem}
            currentUserEmail={user.email}
            onSave={handleSave}
            onCancel={() => { setFormOpen(false); setEditingItem(null); }}
          />
        )}

        {status === "loading" && !items ? (
          <div style={{ fontFamily: MONO, fontSize: 12.5, color: MUTE, padding: "30px 4px" }}>loading…</div>
        ) : status === "error" ? (
          <div style={{ fontFamily: MONO, fontSize: 12.5, color: BRICK, padding: "30px 4px" }}>
            Couldn't load items. <Btn small onClick={refresh} color={BRICK}>Retry</Btn>
          </div>
        ) : tab === "today" ? (
          <Today items={items || []} onEdit={openForm} onStatusChange={handleStatusChange} onDelete={handleDelete} />
        ) : tab === "weekly" ? (
          <WeeklyTriage items={items || []} onEdit={openForm} onStatusChange={handleStatusChange} onDelete={handleDelete} />
        ) : tab === "monthly" ? (
          <MonthlyCheckin items={items || []} onEdit={openForm} onStatusChange={handleStatusChange} onDelete={handleDelete} />
        ) : tab === "overview" ? (
          <Overview items={items || []} onEdit={openForm} onStatusChange={handleStatusChange} onDelete={handleDelete} />
        ) : (
          <Trends items={items || []} events={events || []} />
        )}
      </div>
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
