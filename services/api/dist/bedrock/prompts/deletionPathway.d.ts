export declare const DELETION_PATHWAY_SYSTEM_PROMPT: string;
export declare function buildDeletionPathwayPrompt(domain: string, input: string | {
    id: string;
    heading?: string;
    text: string;
    sourceUrl: string;
}[]): string;
