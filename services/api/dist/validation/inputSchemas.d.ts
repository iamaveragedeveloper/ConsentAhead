import { z } from "zod";
export declare const FormFieldSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    type: z.ZodString;
    label: z.ZodString;
    placeholder: z.ZodOptional<z.ZodString>;
    autocomplete: z.ZodOptional<z.ZodString>;
    required: z.ZodBoolean;
    options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    ariaLabel: z.ZodOptional<z.ZodString>;
    path: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    type: string;
    label: string;
    required: boolean;
    path: string;
    placeholder?: string | undefined;
    autocomplete?: string | undefined;
    options?: string[] | undefined;
    ariaLabel?: string | undefined;
}, {
    id: string;
    name: string;
    type: string;
    label: string;
    required: boolean;
    path: string;
    placeholder?: string | undefined;
    autocomplete?: string | undefined;
    options?: string[] | undefined;
    ariaLabel?: string | undefined;
}>;
export declare const FormAnalyzeRequestSchema: z.ZodObject<{
    domain: z.ZodString;
    url: z.ZodString;
    fields: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        type: z.ZodString;
        label: z.ZodString;
        placeholder: z.ZodOptional<z.ZodString>;
        autocomplete: z.ZodOptional<z.ZodString>;
        required: z.ZodBoolean;
        options: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        ariaLabel: z.ZodOptional<z.ZodString>;
        path: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        type: string;
        label: string;
        required: boolean;
        path: string;
        placeholder?: string | undefined;
        autocomplete?: string | undefined;
        options?: string[] | undefined;
        ariaLabel?: string | undefined;
    }, {
        id: string;
        name: string;
        type: string;
        label: string;
        required: boolean;
        path: string;
        placeholder?: string | undefined;
        autocomplete?: string | undefined;
        options?: string[] | undefined;
        ariaLabel?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    domain: string;
    url: string;
    fields: {
        id: string;
        name: string;
        type: string;
        label: string;
        required: boolean;
        path: string;
        placeholder?: string | undefined;
        autocomplete?: string | undefined;
        options?: string[] | undefined;
        ariaLabel?: string | undefined;
    }[];
}, {
    domain: string;
    url: string;
    fields: {
        id: string;
        name: string;
        type: string;
        label: string;
        required: boolean;
        path: string;
        placeholder?: string | undefined;
        autocomplete?: string | undefined;
        options?: string[] | undefined;
        ariaLabel?: string | undefined;
    }[];
}>;
export declare const PolicyDiscoverRequestSchema: z.ZodObject<{
    domain: z.ZodString;
    pageUrl: z.ZodString;
    pageHtml: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    domain: string;
    pageUrl: string;
    pageHtml?: string | undefined;
}, {
    domain: string;
    pageUrl: string;
    pageHtml?: string | undefined;
}>;
export declare const PolicyAnalyzeRequestSchema: z.ZodObject<{
    domain: z.ZodString;
    policyUrl: z.ZodString;
    policyText: z.ZodOptional<z.ZodString>;
    targetCategories: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    domain: string;
    policyUrl: string;
    policyText?: string | undefined;
    targetCategories?: string[] | undefined;
}, {
    domain: string;
    policyUrl: string;
    policyText?: string | undefined;
    targetCategories?: string[] | undefined;
}>;
export declare const CompanyPathwaysRequestSchema: z.ZodObject<{
    domain: z.ZodString;
    policyUrl: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    domain: string;
    policyUrl?: string | undefined;
}, {
    domain: string;
    policyUrl?: string | undefined;
}>;
