import { useState } from "react";
import { Modal, Btn, Note } from "../ui";
import { SERIF, MONO, INK, MUTE, BRICK, INKBLUE } from "../theme";
import { parseWeeklyPhoto, fileToImagePayload } from "../lib/claude";

// The weekly-meeting photo import, relocated onto the Secretary page (§5).
// Extraction now lands straight in pendingOperations server-side (see
// functions/index.js' parseWeeklyPhoto) -- this modal is just the upload
// step; the actual per-row review/edit/approve checklist is the Secretary
// review log itself, reusing its ReviewOperationCard rather than a second,
// forked editing UI here.
export default function WeeklyMeetingImport({ secretary, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);

  const run = async (f) => {
    setFile(f);
    setError(null);
    setLoading(true);
    try {
      const { imageBase64, mediaType } = await fileToImagePayload(f);
      const existingKinds = (secretary.kinds || []).map((k) => ({ id: k.id, title: k.title, kindType: k.kindType, domain: k.domain }));
      const result = await parseWeeklyPhoto({ imageBase64, mediaType, existingKinds });
      const created = result.created || [];
      setSummary({
        kinds: created.filter((c) => c.family === "kind").length,
        items: created.filter((c) => c.family === "item").length,
      });
      onImported?.();
    } catch (err) {
      setError(err.message || "Could not parse that photo.");
    } finally {
      setLoading(false);
    }
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (f) run(f);
  };

  return (
    <Modal onClose={onClose} width={420}>
      <h3 style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: INK, margin: "0 0 12px" }}>Import weekly-meeting photo</h3>

      {summary ? (
        <>
          <Note>
            {summary.kinds + summary.items === 0
              ? "Nothing clearly extractable was found on that page."
              : `${summary.kinds} Kind${summary.kinds === 1 ? "" : "s"} and ${summary.items} Item${summary.items === 1 ? "" : "s"} were proposed -- review them below in the queue before anything is placed.`}
          </Note>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <Btn primary color={INKBLUE} onClick={onClose}>Done</Btn>
            <Btn color={MUTE} onClick={() => setSummary(null)}>Import another page</Btn>
          </div>
        </>
      ) : (
        <>
          <Note>Upload a photo of the handwritten weekly-meeting notebook page. Nothing is placed directly -- everything lands in the review queue below for you to check and approve.</Note>
          <div style={{ marginTop: 12 }}>
            <input type="file" accept="image/*" onChange={onFile} disabled={loading} />
          </div>
          {loading && <p style={{ fontFamily: MONO, fontSize: 12, color: MUTE, marginTop: 10 }}>Reading the page…</p>}
          {error && (
            <p style={{ fontFamily: MONO, fontSize: 11.5, color: BRICK, marginTop: 10 }}>
              {error} <button type="button" onClick={() => file && run(file)} style={{ border: "none", background: "none", color: INKBLUE, cursor: "pointer", textDecoration: "underline" }}>Try again</button>
            </p>
          )}
          <div style={{ marginTop: 16 }}>
            <Btn color={MUTE} onClick={onClose}>Cancel</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}
