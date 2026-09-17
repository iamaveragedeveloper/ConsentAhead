import React, { useState, useEffect, useCallback } from "react";
import type { DisclosureEvent, CompanyProfile, VaultProfile, DataCategory } from "@consent-ahead/shared-types";
import {
  getAllDisclosureEvents,
  getAllCompanies,
  getVaultProfile,
  saveVaultProfile,
  clearAllVaultData,
} from "../vault/vaultStore";
import { getFootprintSummary, type FootprintSummary } from "../disclosure/disclosureRecorder";
import { getCategoryLabel } from "@consent-ahead/field-classifier";

type Tab = "overview" | "footprint" | "companies" | "reclaim" | "vault" | "settings";

const NAV_ITEMS: { id: Tab; icon: string; label: string }[] = [
  { id: "overview", icon: "🏠", label: "Overview" },
  { id: "footprint", icon: "👣", label: "Data Footprint" },
  { id: "companies", icon: "🏢", label: "Companies" },
  { id: "reclaim", icon: "🗑️", label: "Reclaim" },
  { id: "vault", icon: "🔐", label: "My Vault" },
  { id: "settings", icon: "⚙️", label: "Settings" },
];

const CATEGORY_COLORS: Record<DataCategory, string> = {
  contact: "#6366f1",
  basic_personal: "#8b5cf6",
  location: "#06b6d4",
  identity: "#ef4444",
  financial: "#f59e0b",
  professional: "#10b981",
  health: "#ec4899",
  sensitive_other: "#f97316",
  consent: "#a855f7",
  unknown: "#64748b",
};

export function DashboardApp() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [events, setEvents] = useState<DisclosureEvent[]>([]);
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [footprint, setFootprint] = useState<FootprintSummary | null>(null);
  const [vault, setVault] = useState<VaultProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [evts, comps, vlt] = await Promise.all([
        getAllDisclosureEvents(),
        getAllCompanies(),
        getVaultProfile(),
      ]);
      setEvents(evts);
      setCompanies(comps);
      setVault(vlt);
      setFootprint(await getFootprintSummary(evts));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="dashboard-layout">
      <Sidebar active={activeTab} onSelect={setActiveTab} />
      <main className="main-content">
        {loading ? (
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <div className="empty-title">Loading your data...</div>
          </div>
        ) : (
          <>
            {activeTab === "overview" && <OverviewTab footprint={footprint} events={events} />}
            {activeTab === "footprint" && <FootprintTab footprint={footprint} />}
            {activeTab === "companies" && <CompaniesTab companies={companies} />}
            {activeTab === "reclaim" && <ReclaimTab companies={companies} />}
            {activeTab === "vault" && <VaultTab vault={vault} onSave={loadData} />}
            {activeTab === "settings" && <SettingsTab onClearData={loadData} />}
          </>
        )}
      </main>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ active, onSelect }: { active: Tab; onSelect: (t: Tab) => void }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-shield">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z" fill="white" fillOpacity="0.9"/>
            <path d="M9 12l2 2 4-4" stroke="#1e1b4b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="logo-title">Data Firewall</div>
        <div className="logo-subtitle">Privacy Dashboard</div>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${active === item.id ? "active" : ""}`}
            onClick={() => onSelect(item.id)}
            id={`nav-${item.id}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        The internet can ask.<br/>You decide what it gets.
      </div>
    </aside>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ footprint, events }: { footprint: FootprintSummary | null; events: DisclosureEvent[] }) {
  const stats = [
    { icon: "🏢", value: footprint?.totalCompanies ?? 0, label: "Companies", color: "#6366f1" },
    { icon: "📤", value: footprint?.totalDisclosures ?? 0, label: "Disclosures", color: "#8b5cf6" },
    { icon: "🔴", value: footprint?.sensitiveDisclosures ?? 0, label: "Sensitive", color: "#ef4444" },
    { icon: "🛡️", value: events.filter(e => e.fillMode === "minimum").length, label: "Minimized", color: "#22c55e" },
  ];

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Privacy Overview</h1>
        <p className="page-subtitle">Your personal data disclosure history at a glance</p>
      </div>

      <div className="stats-grid">
        {stats.map((s) => (
          <div key={s.label} className="stat-card-big" style={{ "--accent-color": s.color } as React.CSSProperties}>
            <span className="stat-icon">{s.icon}</span>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Recent Activity</div>
            <div className="card-subtitle">Your last {Math.min(events.length, 10)} disclosures</div>
          </div>
        </div>
        {footprint?.recentActivity.length ? (
          <div className="timeline">
            {footprint.recentActivity.map((event) => (
              <ActivityItem key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: "32px 0" }}>
            <div className="empty-icon" style={{ fontSize: 32 }}>👋</div>
            <div className="empty-title">No activity yet</div>
            <div className="empty-desc">Browse to a website with a form to get started</div>
          </div>
        )}
      </div>
    </>
  );
}

function ActivityItem({ event }: { event: DisclosureEvent }) {
  const date = new Date(event.timestamp);
  const cats = [...new Set(event.fields.map((f) => f.category))];

  return (
    <div className="timeline-item">
      <div className="timeline-dot" />
      <div className="timeline-content">
        <div className="timeline-domain">{event.domain}</div>
        <div className="timeline-time">
          {date.toLocaleDateString()} · {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ·{" "}
          {event.fields.length} field{event.fields.length !== 1 ? "s" : ""}
          {event.fillMode === "minimum" && " · 🛡️ Minimized"}
        </div>
        <div className="timeline-tags">
          {cats.slice(0, 4).map((c) => (
            <span key={c} className="timeline-tag">{getCategoryLabel(c)}</span>
          ))}
        </div>
      </div>
      {event.fields.some(f => f.sensitivity === "high") && (
        <span className="badge badge-high">Sensitive</span>
      )}
    </div>
  );
}

// ── Footprint Tab ─────────────────────────────────────────────────────────────

function FootprintTab({ footprint }: { footprint: FootprintSummary | null }) {
  if (!footprint || footprint.categoryBreakdown.length === 0) {
    return (
      <>
        <div className="page-header">
          <h1 className="page-title">Data Footprint</h1>
          <p className="page-subtitle">What types of personal data you've shared and with whom</p>
        </div>
        <div className="empty-state">
          <div className="empty-icon">👣</div>
          <div className="empty-title">No data footprint yet</div>
          <div className="empty-desc">Your footprint will appear here after you use the extension to fill forms</div>
        </div>
      </>
    );
  }

  const maxCount = Math.max(...footprint.categoryBreakdown.map((c) => c.count));

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Data Footprint</h1>
        <p className="page-subtitle">What types of personal data you've shared and with whom</p>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Data Type Breakdown</div>
          <div className="card-subtitle">By number of companies</div>
        </div>
        <div className="category-bar">
          {footprint.categoryBreakdown.map(({ category, count, companies }) => (
            <div key={category} className="category-row">
              <div className="category-name">{getCategoryLabel(category)}</div>
              <div className="category-bar-track">
                <div
                  className="category-bar-fill"
                  style={{
                    width: `${(count / maxCount) * 100}%`,
                    background: `linear-gradient(90deg, ${CATEGORY_COLORS[category]}, ${CATEGORY_COLORS[category]}aa)`,
                  }}
                />
              </div>
              <div className="category-count">{count} {count === 1 ? "company" : "companies"}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Summary Statistics</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#6366f1" }}>{footprint.totalDisclosures}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Total Disclosures</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#ef4444" }}>{footprint.sensitiveDisclosures}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Sensitive Data Shared</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#22c55e" }}>{footprint.totalCompanies}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Companies Tracked</div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Companies Tab ─────────────────────────────────────────────────────────────

function CompaniesTab({ companies }: { companies: CompanyProfile[] }) {
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Companies</h1>
        <p className="page-subtitle">{companies.length} {companies.length === 1 ? "company" : "companies"} in your data history</p>
      </div>

      {companies.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏢</div>
          <div className="empty-title">No companies tracked yet</div>
          <div className="empty-desc">Companies will appear here after you fill forms with the extension</div>
        </div>
      ) : (
        <div className="company-grid">
          {companies.sort((a, b) => new Date(b.lastInteraction).getTime() - new Date(a.lastInteraction).getTime()).map((company) => (
            <CompanyCard key={company.domain} company={company} />
          ))}
        </div>
      )}
    </>
  );
}

function CompanyCard({ company }: { company: CompanyProfile }) {
  const date = new Date(company.lastInteraction);

  return (
    <div className="company-card">
      <div className="company-domain">{company.name || company.domain}</div>
      <div className="company-meta">
        Last interaction: {date.toLocaleDateString()} · {company.disclosureCount} disclosure{company.disclosureCount !== 1 ? "s" : ""}
      </div>
      <div className="company-categories">
        {company.sharedCategories.slice(0, 5).map((cat) => (
          <span key={cat} className="category-chip">{getCategoryLabel(cat)}</span>
        ))}
      </div>
      <div className="company-actions">
        {company.privacyPolicyUrl && (
          <a href={company.privacyPolicyUrl} target="_blank" rel="noopener noreferrer" className="action-link action-link-secondary">
            📄 Privacy Policy
          </a>
        )}
        {company.deletionUrl && (
          <a href={company.deletionUrl} target="_blank" rel="noopener noreferrer" className="action-link action-link-primary">
            🗑️ Delete Account
          </a>
        )}
      </div>
    </div>
  );
}

// ── Reclaim Tab ───────────────────────────────────────────────────────────────

function ReclaimTab({ companies }: { companies: CompanyProfile[] }) {
  const reclaimable = companies.filter((c) => c.deletionUrl || c.dataRequestUrl || c.pathways?.length);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Reclaim Your Data</h1>
        <p className="page-subtitle">Official deletion and data-request pathways found from company documentation</p>
      </div>

      <div className="alert alert-warning">
        ⚠️ These links go to the company's own pages. The extension identifies them — you perform the action.
      </div>

      {reclaimable.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🗑️</div>
          <div className="empty-title">No deletion pathways found yet</div>
          <div className="empty-desc">
            Deletion pathways are discovered when the backend analyzes company privacy policies.
            Activate the AWS backend and re-scan forms to populate this list.
          </div>
        </div>
      ) : (
        <div className="company-grid">
          {reclaimable.map((company) => (
            <div key={company.domain} className="company-card">
              <div className="company-domain">{company.name || company.domain}</div>
              <div className="company-meta">
                {company.disclosureCount} disclosure{company.disclosureCount !== 1 ? "s" : ""}
              </div>
              <div className="company-actions" style={{ flexDirection: "column", alignItems: "flex-start" }}>
                {company.deletionUrl && (
                  <a href={company.deletionUrl} target="_blank" rel="noopener noreferrer" className="action-link action-link-primary" style={{ width: "100%", justifyContent: "center" }}>
                    🗑️ Delete Account →
                  </a>
                )}
                {company.dataRequestUrl && (
                  <a href={company.dataRequestUrl} target="_blank" rel="noopener noreferrer" className="action-link action-link-secondary" style={{ width: "100%", justifyContent: "center" }}>
                    📋 Request My Data →
                  </a>
                )}
                {company.pathways?.filter(p => !["account_deletion","data_request"].includes(p.type)).map((p) => (
                  <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer" className="action-link action-link-secondary" style={{ width: "100%", justifyContent: "center" }}>
                    🔗 {p.type.replace("_", " ")} →
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Vault Tab ─────────────────────────────────────────────────────────────────

function VaultTab({ vault, onSave }: { vault: VaultProfile | null; onSave: () => void }) {
  const [form, setForm] = useState<VaultProfile>(vault ?? {});
  const [saved, setSaved] = useState(false);

  const update = (key: string, value: string) => {
    setForm((prev) => {
      if (key.startsWith("address.")) {
        const addrKey = key.replace("address.", "");
        return { ...prev, address: { ...(prev.address ?? {}), [addrKey]: value } };
      }
      return { ...prev, [key]: value };
    });
  };

  const handleSave = async () => {
    await saveVaultProfile(form);
    setSaved(true);
    onSave();
    setTimeout(() => setSaved(false), 2000);
  };

  const addr = form.address ?? {};

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">My Vault</h1>
        <p className="page-subtitle">Your personal data — stored locally and encrypted. Never sent to any server.</p>
      </div>

      {saved && <div className="alert alert-success">✅ Vault saved successfully!</div>}

      <div className="card">
        <div className="card-header">
          <div className="card-title">🔐 Personal Information</div>
          <div className="card-subtitle">AES-256 encrypted · Local only</div>
        </div>
        <div className="vault-form">
          <div className="form-group">
            <label className="form-label">First Name</label>
            <input id="vault-firstName" className="form-input" value={form.firstName ?? ""} onChange={e => update("firstName", e.target.value)} placeholder="Jane" />
          </div>
          <div className="form-group">
            <label className="form-label">Last Name</label>
            <input id="vault-lastName" className="form-input" value={form.lastName ?? ""} onChange={e => update("lastName", e.target.value)} placeholder="Smith" />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input id="vault-email" className="form-input" type="email" value={form.email ?? ""} onChange={e => update("email", e.target.value)} placeholder="jane@example.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input id="vault-phone" className="form-input" type="tel" value={form.phone ?? ""} onChange={e => update("phone", e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <div className="form-group">
            <label className="form-label">Date of Birth</label>
            <input id="vault-dob" className="form-input" type="date" value={form.dateOfBirth ?? ""} onChange={e => update("dateOfBirth", e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Company</label>
            <input id="vault-company" className="form-input" value={form.company ?? ""} onChange={e => update("company", e.target.value)} placeholder="Acme Corp" />
          </div>
          <div className="form-group">
            <label className="form-label">Job Title</label>
            <input id="vault-jobTitle" className="form-input" value={form.jobTitle ?? ""} onChange={e => update("jobTitle", e.target.value)} placeholder="Software Engineer" />
          </div>
          <div className="form-group">
            <label className="form-label">Website</label>
            <input id="vault-website" className="form-input" type="url" value={form.website ?? ""} onChange={e => update("website", e.target.value)} placeholder="https://janesmith.dev" />
          </div>
          <div className="form-group full-width">
            <label className="form-label">Address Line 1</label>
            <input id="vault-addr1" className="form-input" value={addr.line1 ?? ""} onChange={e => update("address.line1", e.target.value)} placeholder="123 Main Street" />
          </div>
          <div className="form-group">
            <label className="form-label">City</label>
            <input id="vault-city" className="form-input" value={addr.city ?? ""} onChange={e => update("address.city", e.target.value)} placeholder="Bengaluru" />
          </div>
          <div className="form-group">
            <label className="form-label">State / Province</label>
            <input id="vault-state" className="form-input" value={addr.state ?? ""} onChange={e => update("address.state", e.target.value)} placeholder="Karnataka" />
          </div>
          <div className="form-group">
            <label className="form-label">PIN / Postal Code</label>
            <input id="vault-postal" className="form-input" value={addr.postalCode ?? ""} onChange={e => update("address.postalCode", e.target.value)} placeholder="560001" />
          </div>
          <div className="form-group">
            <label className="form-label">Country</label>
            <input id="vault-country" className="form-input" value={addr.country ?? ""} onChange={e => update("address.country", e.target.value)} placeholder="India" />
          </div>
        </div>
        <div style={{ marginTop: 20 }}>
          <button className="btn btn-primary" onClick={handleSave} id="btn-save-vault">
            💾 Save to Vault
          </button>
        </div>
      </div>
    </>
  );
}

// ── Settings Tab ──────────────────────────────────────────────────────────────

function SettingsTab({ onClearData }: { onClearData: () => void }) {
  const [confirmed, setConfirmed] = useState(false);
  const [cleared, setCleared] = useState(false);

  const handleClear = async () => {
    if (!confirmed) { setConfirmed(true); return; }
    const { clearAllVaultData } = await import("../vault/vaultStore");
    await clearAllVaultData();
    setCleared(true);
    setConfirmed(false);
    onClearData();
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Extension configuration and data management</p>
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom: 12 }}>About Personal Data Firewall</div>
        <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>
          Personal Data Firewall is a privacy-first Chrome extension built for the First Commit 2026 hackathon.
          It detects personal data forms, analyzes privacy policies using Amazon Bedrock, and lets you minimize disclosure
          before submitting any form. Your personal vault is encrypted locally — it never leaves your device.
        </p>
        <div style={{ marginTop: 16, fontSize: 12, color: "#475569" }}>
          Version 1.0.0 · Built with AWS Bedrock + Lambda
        </div>
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom: 8, color: "#f87171" }}>⚠️ Danger Zone</div>
        {cleared && <div className="alert alert-success">✅ All local data cleared.</div>}
        {confirmed && !cleared && (
          <div className="alert alert-warning">
            This will delete your vault, all disclosure history, and all company profiles. This cannot be undone.
          </div>
        )}
        <button
          className="btn btn-danger"
          onClick={handleClear}
          id="btn-clear-data"
        >
          {confirmed ? "⚠️ Confirm: Clear All Data" : "🗑️ Clear All Local Data"}
        </button>
        {confirmed && (
          <button
            className="btn"
            style={{ marginLeft: 8, background: "none", color: "#64748b", border: "1px solid #1e293b" }}
            onClick={() => setConfirmed(false)}
          >
            Cancel
          </button>
        )}
      </div>
    </>
  );
}
