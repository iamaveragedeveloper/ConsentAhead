# ConsentAhead — Personal Data Firewall (Chrome Extension + AWS Serverless)

> **Privacy-first Chrome Extension (Manifest V3) powered by Amazon Bedrock & AWS Serverless.**  
> Intercepts web forms before submission, analyzes privacy policies using AI, exposes hidden data practices, minimizes optional field disclosures, and tracks your global Data Footprint — all while keeping your raw personal data strictly on your local device.

---

## 🛡️ Key Features

- **Form Detection & Field Classification**: Intercepts forms and classifies every field into categories (Email, Phone, Date of Birth, Address, Financial, SSN, etc.) with sensitivity levels (Low, Medium, High, Critical) and requirement status (Required vs. Optional).
- **Bedrock Privacy Policy Analysis**: Scans domain privacy policies in real-time, matching form fields to actual policy clauses (marketing opt-ins, third-party sharing, data retention) backed by direct text evidence quotes.
- **Local Encrypted Vault**: Stores personal profile information locally in IndexedDB with Web Crypto AES-GCM encryption. Raw data **NEVER** leaves your browser.
- **One-Click Data Minimization**:
  - **Minimum Fill**: Fills ONLY compulsory/required fields.
  - **Approved Fill**: Fills compulsory fields + only user-approved optional fields.
  - **Manual Fill**: Fills standard fields while skipping high-sensitivity flags.
- **Data Footprint Dashboard**: Options page with visual analytics:
  - Total disclosures over time
  - Per-category breakdown (Email, Phone, Address, DOB, etc.)
  - Per-company profile tracker
  - **Reclaim Tab**: Direct links to account deletion & data request portals discovered across web services.

---

## 🏗️ Architecture Diagram

```
                       ┌─────────────────────────────────────────┐
                       │           Chrome Browser                │
                       │                                         │
                       │   ┌─────────────────────────────────┐   │
                       │   │          Target Webpage         │   │
                       │   │  (Form Detection & Shield Badge)│   │
                       │   └────────────────┬────────────────┘   │
                       │                    │ Message            │
                       │   ┌────────────────▼────────────────┐   │
                       │   │   Extension Service Worker      │   │
                       │   │   (Background Script & Router)  │   │
                       │   └──────┬──────────────────┬───────┘   │
                       │          │                  │           │
                       │          │ Local Vault      │ HTTPS     │
                       │   ┌──────▼──────┐    ┌──────▼───────┐   │
                       │   │  IndexedDB  │    │ Extension    │   │
                       │   │  (AES-GCM   │    │ Popup UI     │   │
                       │   │ Encrypted)  │    │  (React)     │   │
                       │   └─────────────┘    └──────────────┘   │
                       └─────────────────────────────┬───────────┘
                                                     │ HTTPS REST API
                                                     ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           AWS Serverless Backend                                │
│                                                                                 │
│   ┌───────────────────────┐                                                     │
│   │     API Gateway       │                                                     │
│   └───────────┬───────────┘                                                     │
│               │                                                                 │
│   ┌───────────▼───────────┐    Converse API    ┌────────────────────────────┐   │
│   │   AWS Lambda API      ├───────────────────►│       Amazon Bedrock       │   │
│   │   (TypeScript Handlers)│                   │ (Nova Lite / Claude Haiku) │   │
│   └───────────────────────┘                    └────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```
ConsentAhead/
├── apps/
│   ├── extension/          # Chrome Extension (Manifest V3, Vite, React, TypeScript)
│   │   ├── src/
│   │   │   ├── background/ # Service Worker
│   │   │   ├── content/    # Form detector & page overlay
│   │   │   ├── popup/      # Shield popup React App
│   │   │   ├── options/    # Full-page Data Footprint Dashboard
│   │   │   ├── vault/      # Encrypted IndexedDB vault
│   │   │   └── disclosure/ # Footprint tracker & recorder
│   │   └── manifest.json
│   └── demo-site/          # Purpose-built DataHaven test site with form & policy
├── packages/
│   ├── shared-types/       # Shared TypeScript interfaces & API schemas
│   └── field-classifier/   # Deterministic fallback field classification engine
├── services/
│   └── api/                # AWS Lambda API handlers (TypeScript)
│       └── src/
│           ├── bedrock/    # Amazon Bedrock Converse API & system prompts
│           ├── policy/     # Policy fetcher, extractor & chunker
│           └── local-dev.ts# Local HTTP server for offline testing
├── infra/
│   └── template.yaml       # AWS SAM IaC deployment template
├── pnpm-workspace.yaml
└── README.md
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher (`node -v`)
- **pnpm**: installed globally (`npm install -g pnpm`)

---

### Step 1: Install Dependencies & Build Workspace

Run from the root workspace directory:

```bash
# Install dependencies across all monorepo packages
pnpm install

# Build all packages & extension
pnpm build
```

---

### Step 2: Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the build directory: `d:\ConsentAhead\apps\extension\dist`
5. The **Personal Data Firewall** shield icon will appear in your browser toolbar!

---

### Step 3: Run the Local Backend API (Optional / Development)

To test the backend locally on port `3001` without AWS deployment:

```bash
cd services/api
pnpm dev
```

The local API will start at `http://localhost:3001`. You can configure the extension to point to this endpoint or use the built-in deterministic fallback engine.

---

### Step 4: Launch & Test with the Demo Web Site

Open the included demo web application directly in Chrome:

```
file:///d:/ConsentAhead/apps/demo-site/index.html
```

Or serve it locally using any static web server (`npx serve apps/demo-site`).

**What to try:**
1. Open `index.html` in Chrome.
2. Notice the **Personal Data Firewall** floating shield badge at the bottom right.
3. Click the extension icon in the toolbar.
4. View the 8 detected form fields, field sensitivity badges, and policy findings.
5. Open the Extension Dashboard (right-click icon → Options or click "Dashboard" in popup) to setup your local Vault.
6. Return to the registration page, choose **"Minimum Fill"**, and watch compulsory fields autofill automatically while optional fields are left untouched!

---

## ☁️ AWS SAM Deployment (Production)

To deploy the backend to AWS using SAM:

```bash
cd infra
sam build
sam deploy --guided
```

This provisions:
- API Gateway Endpoint (`/form/analyze`, `/policy/discover`, `/policy/analyze`, `/company/pathways`)
- 5 AWS Lambda functions with Node.js 20.x
- IAM Least-Privilege roles for Bedrock `InvokeModel`

---

## 🔐 Security & Privacy Architecture

1. **Zero Raw Personal Data Transmission**: Your name, email, phone, and address remain 100% inside your local browser's IndexedDB. Only field metadata (e.g. `type: "email", name: "work_email"`) is sent to the backend for policy analysis.
2. **SSRF Protection**: Backend URL fetchers reject private IP ranges (`127.0.0.1`, `10.x.x.x`, `169.254.x.x`), cloud metadata endpoints, and non-HTTP protocols.
3. **Evidence-Based LLM Guardrails**: Amazon Bedrock system prompts enforce strict evidence quoting rules to prevent AI hallucinations.

---

## 📜 License

MIT License — Built for Privacy Innovation.
