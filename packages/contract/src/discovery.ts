import { z } from "zod";

const httpsUrl = z.string().max(2048).refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !/[\u0000-\u001f\u007f]/u.test(value);
  } catch { return false; }
}, "Use an HTTPS source URL without credentials.");
const label = z.string().trim().min(1).max(500);
const localDemoSource = (value: string): boolean => {
  try {
    const url = new URL(value);
    return !/[\u0000-\u001f\u007f]/u.test(value) && url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
      url.pathname === "/extension-demo" && !url.username && !url.password && !url.hash && !url.search;
  } catch { return false; }
};

/** Untrusted discovery evidence, never a shopper instruction or a payable offer. */
export const DiscoveryReferenceSchema = z.object({
  handoffId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  source: z.object({ url: z.string().max(2048).refine(value => httpsUrl.safeParse(value).success || localDemoSource(value)), title: label }).strict(),
  candidate: z.object({
    id: z.string().min(1).max(150),
    title: label,
    url: httpsUrl,
    imageUrl: z.string().max(2048).refine(value => /^\/catalog\/images\/(?:products\/)?[A-Za-z0-9_-]+\.(?:svg|png|jpe?g|webp)$/.test(value) || httpsUrl.safeParse(value).success).optional(),
    price: z.object({ amount: z.number().finite().nonnegative().max(1e12), currency: z.string().regex(/^[A-Z]{3}$/) }).strict().nullable(),
    match: z.enum(["similar", "exact"]),
    reasons: z.array(label).max(12),
    unknowns: z.array(label).max(20),
    catalogProductId: z.string().regex(/^(?:MIC|BAG|BED)-\d{3}$/).optional(),
    linkKind: z.enum(["listing", "search"]),
  }).strict(),
  mode: z.enum(["demo", "live"]),
}).strict().superRefine((reference, context) => {
  if (reference.mode === "live" && localDemoSource(reference.source.url))
    context.addIssue({ code: z.ZodIssueCode.custom, message: "The loopback demo page is only supported in demo mode.", path: ["source", "url"] });
  if (reference.mode === "live" && reference.candidate.catalogProductId)
    context.addIssue({ code: z.ZodIssueCode.custom, message: "A live listing cannot assert a demo catalog identity.", path: ["candidate", "catalogProductId"] });
});
export type DiscoveryReference = z.infer<typeof DiscoveryReferenceSchema>;
export type DiscoveryImportIdentity = { epoch: number; baseRevision: number };

/** Read-only evaluation of a reference against accepted shopper requirements. */
export const DiscoveryAssessmentSchema = z.object({
  requirements: z.array(z.string()),
  checks: z.array(z.object({
    key: z.string(), label: z.string(),
    status: z.enum(["match", "conflict", "unknown"]),
    detail: z.string(), source: z.enum(["catalog", "listing", "unknown"]),
  }).strict()),
  nextQuestion: z.string(),
  alternatives: z.array(z.object({
    productId: z.string(), title: z.string(), offerId: z.string(),
    total: z.object({ amount: z.number().finite().nonnegative(), currency: z.string() }).strict(),
    reason: z.string(), compromises: z.array(z.string()),
  }).strict()).max(3),
  alternativesNotice: z.string(),
}).strict();
export type DiscoveryAssessment = z.infer<typeof DiscoveryAssessmentSchema>;
