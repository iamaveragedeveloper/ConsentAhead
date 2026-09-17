import type { PrivacyFinding, DataControlPathway } from "@consent-ahead/shared-types";
export declare function parseBedrockJson<T>(rawText: string): T;
export declare function validatePrivacyFindings(findings: unknown[], policyUrl?: string): PrivacyFinding[];
export declare function validatePathways(pathways: unknown[], domain: string): DataControlPathway[];
