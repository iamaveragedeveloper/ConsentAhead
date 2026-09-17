import React, { useState, useEffect, useCallback } from "react";
import type {
  DisclosurePreview,
  DisclosureField,
  PrivacyFinding,
} from "@consent-ahead/shared-types";
import { getVaultValue, saveCompanyProfile, getCompanyProfile } from "../vault/vaultStore";
import { recordDisclosure } from "../disclosure/disclosureRecorder";
import { getCategoryLabel } from "@consent-ahead/field-classifier";

type Screen = "loading" | "no-form" | "overview" | "fields" | "findings" | "confirm" | "success";
type FillMode = "minimum" | "full" | "manual";

const SEVERITY_ICON: Record<string, string> = {
  warning: "⚠️",
  attention: "ℹ️",
  info: "📋",
};

const SENSITIVITY_BADGE: Record<string, string> = {
  high: "badge-high",
  medium: "badge-medium",
  low: "badge-low",
  unknown: "badge-unknown",
};

const SENSITIVITY_LABEL: Record<string, string> = {
  high: "Sensitive",
  medium: "Moderate",
  low: "Low",
  unknown: "Unknown",
};

export function PopupApp() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [preview, setPreview] = useState<DisclosurePreview | null>(null);
  const [selectedFields, setSelectedFields] = useState<DisclosureField[]>([]);
  const [fillMode, setFillMode] = useState<FillMode>("full");
  const [activeTab, setActiveTab] = useState<"fields" | "findings">("fields");
  const [domain, setDomain] = useState("");

  // Load analysis from background worker
  useEffect(() => {
    let cancelled = false;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.url) { setScreen("no-form"); return; }

      try {
        const url = new URL(tab.url);
        setDomain(url.hostname);
      } catch { /* ignore */ }

      chrome.runtime.sendMessage({ type: "GET_ANALYSIS" }, (response) => {
        if (cancelled) return;

        if (response?.preview) {
          const p: DisclosurePreview = response.preview;
          setPreview(p);
          setSelectedFields(p.fields);
          setScreen("overview");
        } else {
          // Trigger fresh analysis
          chrome.tabs.sendMessage(tab.id!, { type: "TRIGGER_SCAN" }, () => {
            setTimeout(() => {
              chrome.runtime.sendMessage({ type: "GET_ANALYSIS" }, (r2) => {
                if (cancelled) return;
                if (r2?.preview) {
                  setPreview(r2.preview);
                  setSelectedFields(r2.preview.fields);
                  setScreen("overview");
                } else {
                  setScreen("no-form");
                }
              });
            }, 1200);
          });
        }
      });
    });

    return () => { cancelled = true; };
  }, []);

  // Update selected fields when fill mode changes
  useEffect(() => {
    if (!preview) return;
    if (fillMode === "minimum") {
      setSelectedFields(preview.fields.filter((f) => f.requirement === "required"));
    } else if (fillMode === "full") {
      setSelectedFields(preview.fields);
    }
    // manual: don't change selection
  }, [fillMode, preview]);

  const toggleField = useCallback((fieldId: string) => {
    setSelectedFields((prev) =>
      prev.map((f) =>
        f.fieldId === fieldId ? { ...f, selected: !f.selected } : f
      )
    );
  }, []);

  const handleFill = useCallback(async () => {
    if (!preview) return;

    setScreen("confirm");

    // Build fill operations from vault
    const fillOps: { selector: string; value: string }[] = [];

    for (const field of selectedFields) {
      if (!field.selected || !field.vaultKey) continue;
      const value = await getVaultValue(field.vaultKey);
      if (value) {
        // Find original field selector from preview
        // We need to ask the content script to find the selector
        fillOps.push({ selector: `[id="${field.fieldId}"], [name="${field.fieldId}"]`, value });
      }
    }

    if (fillOps.length > 0) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: "FILL_FIELDS",
            payload: { fields: fillOps },
          });
        }
      });
    }

    // Record disclosure
    await recordDisclosure({
      domain: preview.domain,
      pageUrl: preview.domain,
      selectedFields: selectedFields.filter((f) => f.selected),
      findings: preview.findings,
      fillMode,
      policyUrl: preview.policyUrl,
    });

    // Update company pathways if available
    if (preview.policyUrl) {
      const existing = await getCompanyProfile(preview.domain);
      if (existing) {
        await saveCompanyProfile({ ...existing, privacyPolicyUrl: preview.policyUrl, termsUrl: preview.termsUrl });
      }
    }

    setScreen("success");
  }, [preview, selectedFields, fillMode]);

  const openDashboard = () => {
    chrome.runtime.openOptionsPage();
  };

  const sensitiveCount = selectedFields.filter((f) => f.sensitivity === "high").length;
  const optionalCount = selectedFields.filter((f) => f.requirement === "optional").length;
  const warningCount = preview?.findings.filter((f) => f.severity === "warning").length ?? 0;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div className="popup-header">
        <div className="header-shield">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z" fill="white" fillOpacity="0.9"/>
            <path d="M9 12l2 2 4-4" stroke="#1e1b4b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="header-title">
          <h1>Data Firewall</h1>
          <div className="header-domain">{domain || "—"}</div>
        </div>
        <button className="btn-dashboard" onClick={openDashboard}>Dashboard →</button>
      </div>

      {/* Content */}
      <div className="popup-scroll" style={{ flex: 1 }}>
        {screen === "loading" && <LoadingScreen />}
        {screen === "no-form" && <NoFormScreen />}
        {screen === "overview" && preview && (
          <OverviewScreen
            preview={preview}
            selectedFields={selectedFields}
            sensitiveCount={sensitiveCount}
            optionalCount={optionalCount}
            warningCount={warningCount}
            fillMode={fillMode}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onFillModeChange={setFillMode}
            onToggleField={toggleField}
          />
        )}
        {screen === "success" && <SuccessScreen fieldsCount={selectedFields.filter(f => f.selected).length} onViewFootprint={openDashboard} />}
      </div>

      {/* Action Bar */}
      {(screen === "overview") && preview && (
        <div className="action-bar">
          <button className="btn btn-primary" onClick={handleFill} id="btn-fill-fields">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z"/>
            </svg>
            Fill {selectedFields.filter(f=>f.selected).length} Field{selectedFields.filter(f=>f.selected).length !== 1 ? "s" : ""} from Vault
          </button>
          <button className="btn btn-secondary" onClick={() => setScreen("no-form")} id="btn-cancel">
            Cancel — I'll fill manually
          </button>
        </div>
      )}

      {screen === "no-form" && (
        <div className="action-bar">
          <button className="btn btn-secondary" onClick={openDashboard} id="btn-open-dashboard">
            Open Dashboard
          </button>
        </div>
      )}

      <div className="tagline">The internet can ask. You decide what it gets.</div>
    </div>
  );
}

// ── Sub-screens ────────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="loading-state">
      <div className="spinner" />
      <div className="loading-text">
        <strong>Scanning form fields...</strong>
        <br />
        <span>Analyzing privacy policy</span>
      </div>
    </div>
  );
}

function NoFormScreen() {
  return (
    <div className="no-form-state">
      <div className="no-form-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z" fill="#6366f1" fillOpacity="0.5"/>
          <path d="M9 12l2 2 4-4" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div className="no-form-title">No Personal Data Forms Found</div>
      <div className="no-form-desc">
        Navigate to a page with a sign-up, registration, or contact form and click the extension again.
      </div>
    </div>
  );
}

interface OverviewScreenProps {
  preview: DisclosurePreview;
  selectedFields: DisclosureField[];
  sensitiveCount: number;
  optionalCount: number;
  warningCount: number;
  fillMode: FillMode;
  activeTab: "fields" | "findings";
  onTabChange: (tab: "fields" | "findings") => void;
  onFillModeChange: (mode: FillMode) => void;
  onToggleField: (id: string) => void;
}

function OverviewScreen({
  preview,
  selectedFields,
  sensitiveCount,
  optionalCount,
  warningCount,
  fillMode,
  activeTab,
  onTabChange,
  onFillModeChange,
  onToggleField,
}: OverviewScreenProps) {
  return (
    <>
      {/* Summary stats */}
      <div className="summary-bar">
        <div className="stat-card total">
          <div className="stat-number">{selectedFields.length}</div>
          <div className="stat-label">Fields</div>
        </div>
        <div className="stat-card sensitive">
          <div className="stat-number">{sensitiveCount}</div>
          <div className="stat-label">Sensitive</div>
        </div>
        <div className="stat-card optional">
          <div className="stat-number">{warningCount}</div>
          <div className="stat-label">Warnings</div>
        </div>
      </div>

      {/* Fill mode */}
      <div style={{ padding: "0 14px 10px" }}>
        <div className="section-title">Fill mode</div>
        <div className="fill-mode-selector">
          <button
            className={`fill-mode-btn ${fillMode === "minimum" ? "active" : ""}`}
            onClick={() => onFillModeChange("minimum")}
            id="btn-minimum-fill"
          >
            🛡️ Minimum Fill
            <div style={{ fontSize: 9, marginTop: 2, opacity: 0.7 }}>Required fields only</div>
          </button>
          <button
            className={`fill-mode-btn ${fillMode === "full" ? "active" : ""}`}
            onClick={() => onFillModeChange("full")}
            id="btn-full-fill"
          >
            ✅ Full Fill
            <div style={{ fontSize: 9, marginTop: 2, opacity: 0.7 }}>All approved fields</div>
          </button>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: "flex", padding: "0 14px 10px", gap: 6 }}>
        <button
          onClick={() => onTabChange("fields")}
          id="tab-fields"
          style={{
            flex: 1, padding: "7px 0", borderRadius: 8, border: "1px solid",
            fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
            background: activeTab === "fields" ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.03)",
            color: activeTab === "fields" ? "#818cf8" : "#64748b",
            borderColor: activeTab === "fields" ? "#6366f1" : "rgba(255,255,255,0.08)",
          }}
        >
          Fields ({selectedFields.length})
        </button>
        <button
          onClick={() => onTabChange("findings")}
          id="tab-findings"
          style={{
            flex: 1, padding: "7px 0", borderRadius: 8, border: "1px solid",
            fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
            background: activeTab === "findings" ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.03)",
            color: activeTab === "findings" ? "#fbbf24" : "#64748b",
            borderColor: activeTab === "findings" ? "rgba(245,158,11,0.4)" : "rgba(255,255,255,0.08)",
          }}
        >
          Policy Findings ({preview.findings.length})
        </button>
      </div>

      {/* Fields tab */}
      {activeTab === "fields" && (
        <div className="section">
          <div className="field-list">
            {selectedFields.map((field) => (
              <FieldItem
                key={field.fieldId}
                field={field}
                hasWarning={preview.findings.some((f) => f.fieldId === field.fieldId && f.severity === "warning")}
                onToggle={() => onToggleField(field.fieldId)}
              />
            ))}
          </div>
          {selectedFields.length === 0 && (
            <div style={{ textAlign: "center", color: "#64748b", fontSize: 12, padding: "24px 0" }}>
              No fields detected
            </div>
          )}
        </div>
      )}

      {/* Findings tab */}
      {activeTab === "findings" && (
        <div className="section">
          {preview.findings.length === 0 ? (
            <div className="findings-banner no-findings">
              <div className="findings-banner-title">✅ No concerning policy clauses found</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {preview.policyUrl ? "The privacy policy was analyzed and no major concerns were identified." : "No privacy policy was found for this site."}
              </div>
            </div>
          ) : (
            preview.findings.map((finding) => (
              <FindingCard key={finding.id} finding={finding} />
            ))
          )}
        </div>
      )}

      {/* Policy link */}
      {preview.policyUrl && (
        <div style={{ padding: "0 14px 12px" }}>
          <a
            href={preview.policyUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 11, color: "#6366f1", textDecoration: "none" }}
          >
            📄 View Privacy Policy →
          </a>
        </div>
      )}
    </>
  );
}

function FieldItem({ field, hasWarning, onToggle }: {
  field: DisclosureField;
  hasWarning: boolean;
  onToggle: () => void;
}) {
  const sensClass = SENSITIVITY_BADGE[field.sensitivity] ?? "badge-unknown";
  const reqClass = field.requirement === "required" ? "badge-required" : "badge-optional";

  return (
    <div className="field-item">
      <input
        type="checkbox"
        className="field-checkbox"
        checked={field.selected}
        onChange={onToggle}
        id={`field-check-${field.fieldId}`}
      />
      <div className="field-info">
        <div className="field-label">{field.label || getCategoryLabel(field.category)}</div>
        <div className="field-meta">
          <span className={`badge ${sensClass}`}>{SENSITIVITY_LABEL[field.sensitivity]}</span>
          <span className={`badge ${reqClass}`}>{field.requirement}</span>
          {field.category === "consent" && <span className="badge badge-consent">Consent</span>}
        </div>
      </div>
      {hasWarning && <span className="field-warning">⚠️</span>}
    </div>
  );
}

function FindingCard({ finding }: { finding: PrivacyFinding }) {
  const [expanded, setExpanded] = useState(false);
  const icon = SEVERITY_ICON[finding.severity] ?? "📋";

  return (
    <div className={`finding-card ${finding.severity}`} style={{ cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
      <div className="finding-header">
        <span className={`finding-severity ${finding.severity}`}>
          {icon} {finding.severity.toUpperCase()}
        </span>
        <span style={{ fontSize: 10, color: "#64748b", marginLeft: "auto" }}>{expanded ? "▲" : "▼"}</span>
      </div>
      <div className="finding-claim">{finding.claim}</div>
      {expanded && finding.evidence && (
        <>
          <div className="finding-evidence">
            "{finding.evidence.text}"
          </div>
          {finding.evidence.section && (
            <div style={{ fontSize: 10, color: "#6366f1", marginTop: 4 }}>
              📄 {finding.evidence.section}
            </div>
          )}
          {finding.evidence.sourceUrl && (
            <a
              href={finding.evidence.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="evidence-source"
              onClick={(e) => e.stopPropagation()}
            >
              View source →
            </a>
          )}
        </>
      )}
    </div>
  );
}

function SuccessScreen({ fieldsCount, onViewFootprint }: { fieldsCount: number; onViewFootprint: () => void }) {
  return (
    <div className="success-state">
      <div className="success-icon">✓</div>
      <div className="success-title">Fields Filled!</div>
      <div className="success-desc">
        {fieldsCount} field{fieldsCount !== 1 ? "s" : ""} filled from your local vault.
        Review the form before submitting — the extension will never submit for you.
      </div>
      <button
        className="btn btn-secondary"
        onClick={onViewFootprint}
        style={{ marginTop: 8, maxWidth: 200 }}
        id="btn-view-footprint"
      >
        View Data Footprint
      </button>
    </div>
  );
}
