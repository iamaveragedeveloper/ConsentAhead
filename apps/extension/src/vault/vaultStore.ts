// Vault Store — CRUD operations for personal vault data
// Reads/writes encrypted data via vaultDB.
// Simple symmetric encryption using a user-set PIN via PBKDF2 + AES-GCM.

import { dbGet, dbPut, dbGetAll, dbDelete, dbClear, STORES } from "./vaultDB";
import type { VaultProfile, DisclosureEvent, CompanyProfile } from "@consent-ahead/shared-types";

// ─── Simple key storage (MVP: uses localStorage for key, production would use PBKDF2) ──

const ENC_KEY_STORAGE = "pdfw_enc_key";

async function getOrCreateKey(): Promise<CryptoKey> {
  const stored = localStorage.getItem(ENC_KEY_STORAGE);

  if (stored) {
    const raw = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
    return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  }

  // Generate a new key
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const exported = await crypto.subtle.exportKey("raw", key);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
  localStorage.setItem(ENC_KEY_STORAGE, b64);
  return key;
}

async function encrypt(data: unknown): Promise<{ ciphertext: string; iv: string }> {
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

async function decrypt<T>(ciphertext: string, ivStr: string): Promise<T> {
  const key = await getOrCreateKey();
  const ct = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivStr), (c) => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}

// ─── Vault Profile (personal data) ───────────────────────────────────────────

interface VaultRecord {
  key: string;
  ciphertext: string;
  iv: string;
}

export async function saveVaultProfile(profile: VaultProfile): Promise<void> {
  const enc = await encrypt(profile);
  await dbPut<VaultRecord>(STORES.VAULT, {
    key: "profile",
    ciphertext: enc.ciphertext,
    iv: enc.iv,
  });
}

export type VaultState = "empty" | "ok" | "unreadable";

/** Reads the vault and reports why it may be unusable (missing vs. cannot be decrypted). */
export async function getVaultState(): Promise<{ state: VaultState; profile: VaultProfile | null }> {
  const record = await dbGet<VaultRecord>(STORES.VAULT, "profile");
  if (!record) return { state: "empty", profile: null };
  try {
    return { state: "ok", profile: await decrypt<VaultProfile>(record.ciphertext, record.iv) };
  } catch (err) {
    console.error("[DataFirewall] Vault could not be decrypted:", err);
    return { state: "unreadable", profile: null };
  }
}

export async function getVaultProfile(): Promise<VaultProfile | null> {
  return (await getVaultState()).profile;
}

/** Looks up a dotted key (e.g. "address.city") in a profile. "name" falls back to first + last. */
export function resolveVaultValue(profile: VaultProfile | null, key: string): string | undefined {
  if (!profile) return undefined;

  if (key === "name" && !profile.name) {
    const full = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
    return full || undefined;
  }

  // A date of birth split over several boxes: take the part from the stored YYYY-MM-DD
  const part = /^dateOfBirth\.(day|month|year)$/.exec(key);
  if (part) {
    const d = /^(\d{4})-(\d{2})-(\d{2})/.exec(profile.dateOfBirth ?? "");
    if (!d) return undefined;
    return part[1] === "year" ? d[1] : part[1] === "month" ? d[2] : d[3];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = profile;
  for (const part of key.split(".")) {
    if (value && typeof value === "object") value = value[part];
    else return undefined;
  }
  return typeof value === "string" && value.trim() ? value : undefined;
}

export async function getVaultValue(key: string): Promise<string | undefined> {
  return resolveVaultValue(await getVaultProfile(), key);
}

// ─── Disclosure Events ────────────────────────────────────────────────────────

export async function saveDisclosureEvent(event: DisclosureEvent): Promise<void> {
  await dbPut<DisclosureEvent>(STORES.DISCLOSURE_EVENTS, event);
}

export async function getAllDisclosureEvents(): Promise<DisclosureEvent[]> {
  return dbGetAll<DisclosureEvent>(STORES.DISCLOSURE_EVENTS);
}

export async function deleteDisclosureEvent(id: string): Promise<void> {
  await dbDelete(STORES.DISCLOSURE_EVENTS, id);
}

// ─── Company Profiles ─────────────────────────────────────────────────────────

export async function saveCompanyProfile(company: CompanyProfile): Promise<void> {
  await dbPut<CompanyProfile>(STORES.COMPANIES, company);
}

export async function getCompanyProfile(domain: string): Promise<CompanyProfile | null> {
  return (await dbGet<CompanyProfile>(STORES.COMPANIES, domain)) ?? null;
}

export async function getAllCompanies(): Promise<CompanyProfile[]> {
  return dbGetAll<CompanyProfile>(STORES.COMPANIES);
}

export async function deleteCompanyProfile(domain: string): Promise<void> {
  await dbDelete(STORES.COMPANIES, domain);
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const record = await dbGet<{ key: string; value: T }>(STORES.SETTINGS, key);
  return record?.value;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await dbPut(STORES.SETTINGS, { key, value });
}

// ─── Clear all data ───────────────────────────────────────────────────────────

export async function clearAllVaultData(): Promise<void> {
  await Promise.all([
    dbClear(STORES.VAULT),
    dbClear(STORES.DISCLOSURE_EVENTS),
    dbClear(STORES.COMPANIES),
    dbClear(STORES.SETTINGS),
  ]);
  localStorage.removeItem(ENC_KEY_STORAGE);
}
