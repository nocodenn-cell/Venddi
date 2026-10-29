import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { isSupabaseConfigMissingInProduction } from "./lib/supabase";

const root = ReactDOM.createRoot(document.getElementById("root")!);

if (isSupabaseConfigMissingInProduction) {
  // Build de produção sem VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY: não carrega o app
  // (nada de modo simulado em produção), mas mostra uma mensagem em vez de tela branca.
  root.render(
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", padding: 24, textAlign: "center" }}>
      <div style={{ maxWidth: 480 }}>
        <h1 style={{ fontSize: 24, marginBottom: 12 }}>Venddi indisponível no momento</h1>
        <p style={{ color: "#4b5563" }}>
          Estamos ajustando a configuração deste ambiente. Tente novamente em alguns minutos.
        </p>
      </div>
    </div>
  );
} else {
  import("./App.tsx").then(({ default: App }) => {
    root.render(<App />);
  });
}
