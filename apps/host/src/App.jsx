import React from "react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import SafeRemoteLoader from "./components/SafeRemoteLoader";

const DashboardIndex = React.lazy(
  () => import("adminDashboard/DashboardIndex")
);

function GatewayHome() {
  return (
    <main className="gateway-shell">
      <section className="gateway-panel" aria-labelledby="gateway-title">
        <p className="gateway-eyebrow">NexaSphere MFE Gateway</p>
        <h1 id="gateway-title">Host shell is online</h1>
        <p>
          The admin dashboard is loaded as a federated remote and isolated
          behind a circuit-breaker boundary.
        </p>
        <Link className="gateway-link" to="/admin">
          Open admin dashboard
        </Link>
      </section>
    </main>
  );
}

function AdminFallback() {
  return (
    <main className="remote-state-shell" role="status" aria-live="polite">
      <div className="remote-state-card">
        <p className="remote-state-eyebrow">Loading remote</p>
        <h1>Opening admin dashboard</h1>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GatewayHome />} />
        <Route
          path="/admin/*"
          element={
            <SafeRemoteLoader fallback={<AdminFallback />}>
              <DashboardIndex />
            </SafeRemoteLoader>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
