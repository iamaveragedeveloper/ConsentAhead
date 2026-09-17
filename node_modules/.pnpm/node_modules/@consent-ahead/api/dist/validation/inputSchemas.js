"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyPathwaysRequestSchema = exports.PolicyAnalyzeRequestSchema = exports.PolicyDiscoverRequestSchema = exports.FormAnalyzeRequestSchema = exports.FormFieldSchema = void 0;
// Zod validation schemas for all API request endpoints
const zod_1 = require("zod");
exports.FormFieldSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    type: zod_1.z.string(),
    label: zod_1.z.string(),
    placeholder: zod_1.z.string().optional(),
    autocomplete: zod_1.z.string().optional(),
    required: zod_1.z.boolean(),
    options: zod_1.z.array(zod_1.z.string()).optional(),
    ariaLabel: zod_1.z.string().optional(),
    path: zod_1.z.string(),
});
exports.FormAnalyzeRequestSchema = zod_1.z.object({
    domain: zod_1.z.string().min(1),
    url: zod_1.z.string().url(),
    fields: zod_1.z.array(exports.FormFieldSchema).min(1),
});
exports.PolicyDiscoverRequestSchema = zod_1.z.object({
    domain: zod_1.z.string().min(1),
    pageUrl: zod_1.z.string().url(),
    pageHtml: zod_1.z.string().optional(),
});
exports.PolicyAnalyzeRequestSchema = zod_1.z.object({
    domain: zod_1.z.string().min(1),
    policyUrl: zod_1.z.string().url(),
    policyText: zod_1.z.string().optional(),
    targetCategories: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.CompanyPathwaysRequestSchema = zod_1.z.object({
    domain: zod_1.z.string().min(1),
    policyUrl: zod_1.z.string().optional(),
});
//# sourceMappingURL=inputSchemas.js.map