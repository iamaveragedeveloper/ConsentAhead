import React, { useState } from "react";
import { CheckCircle2, Fingerprint, Lock, ShieldCheck } from "lucide-react";
import type { VaultProfile } from "@consent-ahead/shared-types";
import { saveVaultProfile } from "../../vault/vaultStore";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Progress } from "../../components/ui/progress";
import type { DashData } from "../types";

const TRACKED: { key: string; label: string }[] = [
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "dateOfBirth", label: "Date of birth" },
  { key: "jobTitle", label: "Job title" },
  { key: "company", label: "Company" },
  { key: "address.line1", label: "Street address" },
  { key: "address.city", label: "City" },
  { key: "address.state", label: "State" },
  { key: "address.postalCode", label: "Postal code" },
  { key: "address.country", label: "Country" },
];

const read = (p: VaultProfile, key: string): string => {
  const v = key.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), p);
  return typeof v === "string" ? v : "";
};

export function VaultPage({ data }: { data: DashData }) {
  const saved = data.vault?.profile ?? {};
  // First visit after sign-up: suggest the name and email the account was made with (not saved
  // until you press Save, so it shows as an unsaved change)
  const suggestion: VaultProfile =
    data.vault?.profile || !data.account
      ? {}
      : {
          firstName: data.account.name.split(" ").filter(Boolean)[0],
          lastName: data.account.name.split(" ").filter(Boolean).slice(1).join(" ") || undefined,
          email: data.account.email,
        };
  const [form, setForm] = useState<VaultProfile>({ ...saved, ...suggestion });
  const [baseline, setBaseline] = useState(JSON.stringify(saved));
  const [justSaved, setJustSaved] = useState(false);

  const dirty = JSON.stringify(form) !== baseline;
  const filled = TRACKED.filter((t) => read(form, t.key).trim()).length;
  const pct = Math.round((filled / TRACKED.length) * 100);

  const set = (key: string, value: string) =>
    setForm((prev) =>
      key.startsWith("address.")
        ? { ...prev, address: { ...(prev.address ?? {}), [key.slice(8)]: value } }
        : { ...prev, [key]: value }
    );

  const save = async () => {
    await saveVaultProfile(form);
    setBaseline(JSON.stringify(form));
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);
    await data.reload();
  };

  const field = (key: string, label: string, placeholder?: string, type = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input id={key} type={type} value={read(form, key)} placeholder={placeholder} onChange={(e) => set(key, e.target.value)} />
    </div>
  );

  return (
    <div className="space-y-4 pb-24">
      {data.vault?.state === "unreadable" && (
        <Alert variant="warning">
          <AlertTitle>Your saved vault could not be read</AlertTitle>
          <AlertDescription>Enter your details again and save to replace it.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section title="About you" description="Used for name and date-of-birth fields.">
            <div className="grid gap-4 sm:grid-cols-2">
              {field("firstName", "First name", "Jane")}
              {field("lastName", "Last name", "Doe")}
              {field("dateOfBirth", "Date of birth", undefined, "date")}
            </div>
          </Section>

          <Section title="Contact" description="Used for email and phone fields.">
            <div className="grid gap-4 sm:grid-cols-2">
              {field("email", "Email", "jane@example.com", "email")}
              {field("phone", "Phone", "+91 98765 43210", "tel")}
            </div>
          </Section>

          <Section title="Work" description="Used for job title and company fields.">
            <div className="grid gap-4 sm:grid-cols-2">
              {field("jobTitle", "Job title", "Engineer")}
              {field("company", "Company")}
            </div>
          </Section>

          <Section title="Address" description="Only filled when a form asks for it.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">{field("address.line1", "Street address", "123 Main Street")}</div>
              {field("address.city", "City")}
              {field("address.state", "State")}
              {field("address.postalCode", "Postal code")}
              {field("address.country", "Country")}
            </div>
          </Section>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vault completeness</CardTitle>
              <CardDescription>
                {filled} of {TRACKED.length} details saved
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end justify-between">
                <span className="text-3xl font-semibold tabular-nums">{pct}%</span>
                {pct === 100 && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
              </div>
              <Progress value={pct} indicatorClassName={pct === 100 ? "bg-emerald-400" : undefined} />
              <ul className="space-y-1.5 text-xs">
                {TRACKED.filter((t) => !read(form, t.key).trim()).slice(0, 5).map((t) => (
                  <li key={t.key} className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> {t.label} is empty
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-5">
              <Info icon={<Lock className="h-4 w-4" />} title="Encrypted on this device">
                Your details are stored with AES-256 encryption in this browser only.
              </Info>
              <Info icon={<ShieldCheck className="h-4 w-4" />} title="Never sent anywhere">
                No server ever receives your name, email or address.
              </Info>
              <Info icon={<Fingerprint className="h-4 w-4" />} title="Filled only when you say so">
                Values go into a form only when you press Fill in the popup.
              </Info>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Save bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background/90 backdrop-blur md:left-64">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <p className="text-sm text-muted-foreground">
            {justSaved ? (
              <span className="text-emerald-400">Vault saved ✓</span>
            ) : dirty ? (
              <span className="text-amber-400">You have unsaved changes</span>
            ) : (
              "All changes saved"
            )}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={!dirty} onClick={() => setForm(JSON.parse(baseline))}>
              Discard
            </Button>
            <Button disabled={!dirty} onClick={save}>
              Save vault
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Info({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">{icon}</div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
