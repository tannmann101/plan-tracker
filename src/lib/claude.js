// claude.js
// Client for the parseWeeklyPhoto / triageCapture / secretaryChat Cloud
// Functions (functions/index.js), which proxy to the real Claude API
// server-side -- the API key never reaches the browser. Firebase's
// callable protocol handles auth (the signed-in user's ID token) and CORS
// automatically. All three functions draft into pendingOperations
// server-side (§5's "propose-then-confirm always") -- the client never
// gets a shape it could write straight into kinds/items itself.

import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase.js";

const parseWeeklyPhotoFn = httpsCallable(functions, "parseWeeklyPhoto");
const triageCaptureFn = httpsCallable(functions, "triageCapture");
const secretaryChatFn = httpsCallable(functions, "secretaryChat");

export async function parseWeeklyPhoto({ imageBase64, mediaType, existingKinds }) {
  try {
    const result = await parseWeeklyPhotoFn({ imageBase64, mediaType, existingKinds });
    return result.data.result;
  } catch (err) {
    throw new Error(err.message || "Could not parse the weekly-meeting photo.");
  }
}

export async function triageCapture({ text, existingKinds }) {
  try {
    const result = await triageCaptureFn({ text, existingKinds });
    return result.data.result;
  } catch (err) {
    throw new Error(err.message || "Could not triage this capture.");
  }
}

export async function secretaryChat({
  messages, entityContext, existingKinds, existingItems,
  practiceHabits, disciplines, attention, existingResources,
}) {
  try {
    const result = await secretaryChatFn({
      messages, entityContext, existingKinds, existingItems,
      practiceHabits, disciplines, attention, existingResources,
    });
    return result.data.result;
  } catch (err) {
    throw new Error(err.message || "Could not reach Secretary.");
  }
}

// Reads a File/Blob into the { imageBase64, mediaType } shape both the
// weekly-meeting import and richer captures need.
export function fileToImagePayload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("Could not read the file."));
    reader.onload = () => {
      const dataUrl = reader.result;
      const commaIndex = dataUrl.indexOf(",");
      resolve({ imageBase64: dataUrl.slice(commaIndex + 1), mediaType: file.type });
    };
    reader.readAsDataURL(file);
  });
}
