import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// Load email test helpers (only in development)
import "./lib/email-test-helpers";

createRoot(document.getElementById("root")!).render(<App />);
