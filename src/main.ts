import "./styles/globals.css";
import { startSceneMotion } from "./sceneMotion";

// The page is already readable. Motion adds the journey through the notebook.
const page = document.querySelector<HTMLElement>(".steppa-site");

if (page) {
  const stopMotion = startSceneMotion(page);

  // Release listeners when Vite replaces this module during a local edit.
  if (import.meta.hot) import.meta.hot.dispose(stopMotion);
}
