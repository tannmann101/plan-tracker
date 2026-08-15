// claude.js
// Client for the parseWeeklyPhoto / triageCapture Cloud Functions
// (functions/index.js), which proxy to the real Claude API server-side --
// the API key never reaches the browser. Firebase's callable protocol
// handles auth (the signed-in user's ID token) and CORS automatically.

import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase.js";

const parseWeeklyPhotoFn = httpsCallable(functions, "parseWeeklyPhoto");
const triageCaptureFn = httpsCallable(functions, "triageCapture");
const suggestGoalBreakdownFn = httpsCallable(functions, "suggestGoalBreakdown");

export async function parseWeeklyPhoto({ imageBase64, mediaType, existingGoals }) {
  try {
    const result = await parseWeeklyPhotoFn({ imageBase64, mediaType, existingGoals });
    return result.data.result;
  } catch (err) {
    throw new Error(err.message || "Could not parse the weekly-meeting photo.");
  }
}

export async function triageCapture({ text, existingGoals, priorAnswers }) {
  try {
    const result = await triageCaptureFn({ text, existingGoals, priorAnswers });
    return result.data.result;
  } catch (err) {
    throw new Error(err.message || "Could not triage this capture.");
  }
}

export async function suggestGoalBreakdown({ goalTitle, domain, tier }) {
  try {
    const result = await suggestGoalBreakdownFn({ goalTitle, domain, tier });
    return result.data.result;
  } catch (err) {
    throw new Error(err.message || "Could not draft a breakdown for this Goal.");
  }
}

// Reads a File/Blob into the { imageBase64, mediaType } shape both the
// weekly-meeting import and (eventually) richer captures need.
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
