export declare const POLICY_ANALYZER_SYSTEM_PROMPT: string;
export declare function buildPolicyAnalyzerPrompt(domain: string, policyText: string, targetCategories?: string[]): string;
export declare function buildPolicyAnalysisPrompt(requestedFields: {
    id: string;
    category: string;
    sensitivity: string;
}[], policyChunks: {
    id: string;
    heading?: string;
    text: string;
}[], domain: string): string;
