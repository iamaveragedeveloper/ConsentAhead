// Zod validation schemas for all API request endpoints
import { z } from "zod";

export const FormFieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  label: z.string(),
  placeholder: z.string().optional(),
  autocomplete: z.string().optional(),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  ariaLabel: z.string().optional(),
  path: z.string(),
});

export const FormAnalyzeRequestSchema = z.object({
  domain: z.string().min(1),
  url: z.string().url(),
  fields: z.array(FormFieldSchema).min(1),
});

export const PolicyDiscoverRequestSchema = z.object({
  domain: z.string().min(1),
  pageUrl: z.string().url(),
  pageHtml: z.string().optional(),
});

export const PolicyAnalyzeRequestSchema = z.object({
  domain: z.string().min(1),
  policyUrl: z.string().url(),
  policyText: z.string().optional(),
  targetCategories: z.array(z.string()).optional(),
});

export const CompanyPathwaysRequestSchema = z.object({
  domain: z.string().min(1),
  policyUrl: z.string().optional(),
});
