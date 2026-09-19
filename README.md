# ConsentAhead: Personal Data Firewall (Chrome Extension + AWS Serverless)

> **Privacy-first Chrome Extension (Manifest V3) powered by Amazon Bedrock & AWS Serverless.**  
> Intercepts web forms before submission, analyzes privacy policies using AI, exposes hidden data practices, minimizes optional field disclosures, and tracks your global Data Footprint, all while keeping your raw personal data strictly on your local device.

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
│   └── template.yaml       # CloudFormation/SAM template (API, cache table, website)
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
2. Click the **Personal Data Firewall** icon in the toolbar (pin it from the puzzle-piece menu).
3. Optional: press **Turn on** at the bottom of the popup to show a small shield beside form fields on that site from then on.
4. View the 8 detected form fields, field sensitivity badges, and policy findings.
5. Open the Extension Dashboard (right-click icon → Options or click "Dashboard" in popup) to setup your local Vault.
6. Return to the registration page, choose **"Minimum Fill"**, and watch compulsory fields autofill automatically while optional fields are left untouched!

---

## ☁️ AWS Deployment

Needs Node and the AWS CLI (`aws configure` once, with an IAM user's keys). Region defaults to `us-east-1`.

```bash
pnpm deploy:aws      # build and deploy everything, then print your links
pnpm destroy:aws     # delete it all again (stops all charges)
```

This provisions:
- **API Gateway** with `/health`, `/form/analyze`, `/policy/discover`, `/policy/analyze`, `/company/pathways`, rate limited
- **Lambda** (Node.js 20) functions, each with least-privilege IAM (one Bedrock model, one table)
- **Amazon Bedrock** to read privacy policies
- **DynamoDB** cache of policy analyses, keyed by domain and policy hash, expiring after 30 days. Public data only.
- **S3 + CloudFront** website with the Privacy Policy, Terms of Use and demo pages

To point the extension at the API, build it with `VITE_API_BASE_URL=<ApiEndpoint>` (printed at the end of the deploy).

---

## 🔐 Security & Privacy Architecture

1. **Zero Raw Personal Data Transmission**: Your name, email, phone, and address remain 100% inside your local browser's IndexedDB. Only field metadata (e.g. `type: "email", name: "work_email"`) is sent to the backend for policy analysis.
2. **SSRF Protection**: Backend URL fetchers reject private IP ranges (`127.0.0.1`, `10.x.x.x`, `169.254.x.x`), cloud metadata endpoints, and non-HTTP protocols.
3. **Evidence-Based LLM Guardrails**: Amazon Bedrock system prompts enforce strict evidence quoting rules to prevent AI hallucinations.

---

## 📜 License

MIT License. Built for Privacy Innovation.
