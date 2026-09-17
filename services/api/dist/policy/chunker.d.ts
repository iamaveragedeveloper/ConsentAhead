export interface PolicyChunk {
    index: number;
    header: string;
    text: string;
    charCount: number;
}
export declare function chunkPolicyText(policyText: string, maxChunkSize?: number): PolicyChunk[];
