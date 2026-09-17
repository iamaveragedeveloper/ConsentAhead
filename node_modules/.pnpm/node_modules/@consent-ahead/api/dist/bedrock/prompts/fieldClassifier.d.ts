export declare const FIELD_CLASSIFIER_SYSTEM_PROMPT: string;
export declare function buildFieldClassifierPrompt(fields: {
    id: string;
    label?: string;
    name?: string;
    placeholder?: string;
    type: string;
    autocomplete?: string;
    required: boolean;
    context?: string;
}[]): string;
export declare function buildFieldClassificationPrompt(fields: {
    id: string;
    label?: string;
    name?: string;
    placeholder?: string;
    type: string;
    autocomplete?: string;
    required: boolean;
    context?: string;
}[]): string;
