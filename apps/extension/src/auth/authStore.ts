// Local accounts: a simple sign-in that lives entirely on this device.
//
// There is no server. Each account (name, email and a salted PBKDF2 hash of the password) is kept in
// chrome.storage.local, and signing in only unlocks the extension's screens. Passwords are never
// stored. Several accounts can share one device; each has its own separate vault (see
// accountStorage.ts). This is a convenience lock, not a substitute for device security.

import { LEGACY_ID, SESSION_KEY, dbNameFor, keyNameFor } from "./accountStorage";

const ACCOUNTS_KEY = "pdfw_accounts";
const OLD_ACCOUNT_KEY = "pdfw_account"; // the single-account format used before multiple accounts
const REMEMBER_KEY = "pdfw_session_remembered"; // chrome.storage.local, "keep me signed in"
const ATTEMPTS_KEY = "pdfw_auth_attempts";
const LAST_KEY = "pdfw_last_account";

const ITERATIONS = 310_000; // PBKDF2-SHA256 work factor
const REMEMBER_DAYS = 30;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;
export const MIN_PASSWORD_LENGTH = 8;

interface StoredAccount {
  id: string;
  name: string;
  email: string;
  salt: string; // base64
  hash: string; // base64
  iterations: number;
  createdAt: string;
}

export interface Account {
  id: string;
  name: string;
  email: string;
}

interface Session {
  accountId: string;
  email: string;
  createdAt: string;
  expiresAt?: string; // only for "keep me signed in"
}

type Attempts = Record<string, { count: number; lockedUntil?: number }>;

export class AuthError extends Error {}

// ─── helpers ─────────────────────────────────────────────────────────────────

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

// Compare without stopping at the first difference
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const normEmail = (email: string) => email.trim().toLowerCase();
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const publicOf = (a: StoredAccount): Account => ({ id: a.id, name: a.name, email: a.email });

/** All accounts on this device. The single account from before multi-account support is carried over. */
async function readAccounts(): Promise<StoredAccount[]> {
  const data = await chrome.storage.local.get([ACCOUNTS_KEY, OLD_ACCOUNT_KEY]);
  const list = data[ACCOUNTS_KEY] as StoredAccount[] | undefined;
  if (list) return list;

  const old = data[OLD_ACCOUNT_KEY] as Omit<StoredAccount, "id"> | undefined;
  if (!old) return [];

  // It keeps the original database and key names (id "legacy"), so its vault is still there
  const migrated: StoredAccount[] = [{ ...old, id: LEGACY_ID }];
  await chrome.storage.local.set({ [ACCOUNTS_KEY]: migrated });
  await chrome.storage.local.remove(OLD_ACCOUNT_KEY);
  return migrated;
}

const writeAccounts = (list: StoredAccount[]) => chrome.storage.local.set({ [ACCOUNTS_KEY]: list });

async function startSession(account: StoredAccount, remember: boolean): Promise<void> {
  const session: Session = { accountId: account.id, email: account.email, createdAt: new Date().toISOString() };
  await chrome.storage.session.set({ [SESSION_KEY]: session });
  await chrome.storage.local.set({ [LAST_KEY]: account.id });
  if (remember) {
    const expiresAt = new Date(Date.now() + REMEMBER_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await chrome.storage.local.set({ [REMEMBER_KEY]: { ...session, expiresAt } });
  } else {
    await chrome.storage.local.remove(REMEMBER_KEY);
  }
}

// ─── public API ──────────────────────────────────────────────────────────────

export async function listAccounts(): Promise<Account[]> {
  return (await readAccounts()).map(publicOf);
}

/** The account that signed in most recently (or the only one), used to greet a returning user. */
export async function getLastAccount(): Promise<Account | null> {
  const list = await readAccounts();
  if (list.length === 0) return null;
  const lastId = (await chrome.storage.local.get(LAST_KEY))[LAST_KEY] as string | undefined;
  return publicOf(list.find((a) => a.id === lastId) ?? list[0]);
}

/** Creates an account on this device and signs in. Emails are unique; there is no limit on accounts. */
export async function createAccount(input: { name: string; email: string; password: string }, remember = false): Promise<Account> {
  const name = input.name.trim();
  const email = normEmail(input.email);
  if (name.length < 1) throw new AuthError("Enter your name.");
  if (!isEmail(email)) throw new AuthError("Enter a valid email address.");
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
  }

  const list = await readAccounts();
  if (list.some((a) => a.email === email)) {
    throw new AuthError("An account with this email already exists on this device. Sign in instead.");
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(input.password, salt, ITERATIONS);
  const account: StoredAccount = {
    id: crypto.randomUUID(),
    name,
    email,
    salt: toB64(salt),
    hash: toB64(hash),
    iterations: ITERATIONS,
    createdAt: new Date().toISOString(),
  };

  await writeAccounts([...list, account]);
  await startSession(account, remember);
  return publicOf(account);
}

/** Verifies the password and signs in. Repeated failures for an email pause sign-in briefly. */
export async function signIn(emailInput: string, password: string, remember = false): Promise<Account> {
  const email = normEmail(emailInput);
  const account = (await readAccounts()).find((a) => a.email === email);

  const attempts = ((await chrome.storage.local.get(ATTEMPTS_KEY))[ATTEMPTS_KEY] as Attempts | undefined) ?? {};
  const now = Date.now();
  const entry = attempts[email];
  if (entry?.lockedUntil && entry.lockedUntil > now) {
    const secs = Math.ceil((entry.lockedUntil - now) / 1000);
    throw new AuthError(`Too many attempts. Try again in ${secs} seconds.`);
  }

  // Do the same work whether or not the email exists, so the two cases look alike
  const salt = account ? fromB64(account.salt) : new Uint8Array(16);
  const candidate = await derive(password, salt, account?.iterations ?? ITERATIONS);
  const ok = !!account && sameBytes(candidate, fromB64(account.hash));

  if (!ok) {
    const count = (entry?.count ?? 0) + 1;
    attempts[email] = count >= MAX_ATTEMPTS ? { count: 0, lockedUntil: now + LOCKOUT_MS } : { count };
    await chrome.storage.local.set({ [ATTEMPTS_KEY]: attempts });
    throw new AuthError("That email or password isn't right.");
  }

  delete attempts[email];
  await chrome.storage.local.set({ [ATTEMPTS_KEY]: attempts });
  await startSession(account, remember);
  return publicOf(account);
}

/** The signed-in account, or null. */
export async function getSession(): Promise<Account | null> {
  const list = await readAccounts();
  if (list.length === 0) return null;

  const findFor = (s?: Session) => (s ? list.find((a) => a.id === s.accountId || (!s.accountId && a.email === s.email)) : undefined);

  const fromSession = findFor((await chrome.storage.session.get(SESSION_KEY))[SESSION_KEY] as Session | undefined);
  if (fromSession) return publicOf(fromSession);

  // "Keep me signed in": restore a remembered session that hasn't expired
  const remembered = (await chrome.storage.local.get(REMEMBER_KEY))[REMEMBER_KEY] as Session | undefined;
  const account = findFor(remembered);
  if (account && remembered?.expiresAt && new Date(remembered.expiresAt) > new Date()) {
    await chrome.storage.session.set({ [SESSION_KEY]: { accountId: account.id, email: account.email, createdAt: remembered.createdAt } });
    return publicOf(account);
  }
  return null;
}

export async function signOut(): Promise<void> {
  await chrome.storage.session.remove(SESSION_KEY);
  await chrome.storage.local.remove(REMEMBER_KEY);
}

/** Deletes an indexedDB database, waiting for the browser to finish. */
function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
}

/**
 * Erases one account and everything stored for it (its vault, activity and companies). There is no
 * password recovery, so this is how someone who has forgotten a password starts over. Other accounts
 * on the device are not touched.
 */
export async function removeAccount(id: string): Promise<void> {
  const list = await readAccounts();
  const target = list.find((a) => a.id === id);
  if (!target) return;

  const active = (await chrome.storage.session.get(SESSION_KEY))[SESSION_KEY] as Session | undefined;
  if (active?.accountId === id) await signOut();

  await writeAccounts(list.filter((a) => a.id !== id));
  await deleteDatabase(dbNameFor(id));
  localStorage.removeItem(keyNameFor(id));

  const attempts = ((await chrome.storage.local.get(ATTEMPTS_KEY))[ATTEMPTS_KEY] as Attempts | undefined) ?? {};
  delete attempts[target.email];
  await chrome.storage.local.set({ [ATTEMPTS_KEY]: attempts });

  const lastId = (await chrome.storage.local.get(LAST_KEY))[LAST_KEY] as string | undefined;
  if (lastId === id) await chrome.storage.local.remove(LAST_KEY);
}
