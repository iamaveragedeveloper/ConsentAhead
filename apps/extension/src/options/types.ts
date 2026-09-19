import type { CompanyProfile, DisclosureEvent, VaultProfile } from "@consent-ahead/shared-types";
import type { VaultState } from "../vault/vaultStore";
import type { Summary } from "./lib";

export interface DashData {
  vault: { state: VaultState; profile: VaultProfile | null } | null;
  events: DisclosureEvent[];
  companies: CompanyProfile[];
  summary: Summary;
  reload: () => Promise<void>;
}
