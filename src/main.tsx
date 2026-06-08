import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { SuperModeProvider } from "@/contexts/SuperModeContext";

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <SuperModeProvider>
      <App />
    </SuperModeProvider>
  </AuthProvider>,
);
