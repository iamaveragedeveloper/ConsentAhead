// Which storage belongs to which account.
//
// Every account on this device gets its own IndexedDB database and its own encryption key, so one
// account can never read another's vault, activity or companies. The account that existed before
// multiple accounts were supported keeps the original names (id "legacy"), so its data carries over.

export const SESSION_KEY = "pdfw_session"; // chrome.storage.session, cleared when the browser closes
export const LEGACY_ID = "legacy";

export const dbNameFor = (id: string) => (id === LEGACY_ID ? "PDFW_LOCAL" : `PDFW_LOCAL_${id}`);
export const keyNameFor = (id: string) => (id === LEGACY_ID ? "pdfw_enc_key" : `pdfw_enc_key_${id}`);

/** The id of the signed-in account, or null when nobody is signed in. */
export async function getActiveAccountId(): Promise<string | null> {
  const stored = (await chrome.storage.session.get(SESSION_KEY))[SESSION_KEY] as { accountId?: string } | undefined;
  return stored?.accountId ?? null;
}

/** Like getActiveAccountId, but throws: vault data must never be touched while signed out. */
export async function requireActiveAccountId(): Promise<string> {
  const id = await getActiveAccountId();
  if (!id) throw new Error("Not signed in");
  return id;
}
