/** Customer-facing wording only. Raw quotes and their provenance stay unchanged. */
export function checkoutCopy(value: string): string {
  if (/^(?:simulated purchase only|demonstration only|all offer prices|all prices, stock, tax|tax is explicitly zero|all current catalog records)/i.test(value)) return "";
  if (/known negative source availability/i.test(value)) return "Availability must be checked before purchase.";
  if (/required demo setup hardware/i.test(value)) return "Required setup hardware is included in the fees shown.";
  if (/synthetic offer; real seller stock/i.test(value)) return "Seller stock, delivery service, fees and fulfillment still need verification.";
  if (/^Host paths are bounded simulation fixtures;/i.test(value)) return "Compatibility with your device still needs checking.";
  if (/^Unknown [—–-] see separately labelled simulated setup/i.test(value)) return "Setup requirements still need checking.";
  return value
    .replace(/DEMO-VALUE|Demo Value Seller\s*[—-]?\s*fictional/gi, "Value option")
    .replace(/DEMO-EXPRESS|Demo Express Seller\s*[—-]?\s*fictional/gi, "Express option")
    .replace(/DEMO-DESTINATION[^\s]*(?:\s*\([^)]*\))?/gi, "Selected delivery destination")
    .replace(/^Demo destination.*$/i, "Selected delivery destination")
    .replace(/No additional setup hardware is required by this declared fixture\./gi, "No additional setup hardware is listed.")
    .replace(/Synthetic window/gi, "Estimated window")
    .replace(/Proxy estimate:/gi, "Estimated window:")
    .replace(/;?\s*no real fulfillment\.?/gi, "")
    .replace(/\s*No (?:real )?shipment\.?/gi, "")
    .replace(/^DEMO:\s*/i, "")
    .replace(/\b(?:synthetic|simulated|hypothetical|demo|proxy|fictional)\b\s*/gi, "")
    .replace(/\b(?:declared|prepared|authored) fixture\b/gi, "listed information")
    .replace(/\bfixture\b/gi, "listed information")
    .replace(/\s+/g, " ")
    .trim();
}
