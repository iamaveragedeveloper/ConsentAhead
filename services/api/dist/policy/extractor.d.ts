export interface ExtractedPolicy {
    text: string;
    headings: string[];
    charCount: number;
}
export declare function extractTextFromHtml(html: string): ExtractedPolicy;
