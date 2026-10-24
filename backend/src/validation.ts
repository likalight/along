export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown;
  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
export function requireThat(
  value: unknown,
  code: string,
  message: string,
  status = 422,
  details?: unknown,
): asserts value {
  if (!value) throw new ApiError(status, code, message, details);
}
export function object(x: unknown): asserts x is Record<string, unknown> {
  requireThat(
    x !== null && typeof x === "object" && !Array.isArray(x),
    "INVALID_BODY",
    "Expected a JSON object.",
  );
}
export function keys(x: Record<string, unknown>, allowed: string[]) {
  requireThat(
    Object.keys(x).every((k) => allowed.includes(k)),
    "UNKNOWN_FIELD",
    "Request contains unsupported fields.",
  );
}
export function integer(x: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) {
  return (
    typeof x === "number" && Number.isSafeInteger(x) && x >= min && x <= max
  );
}
export function strings(x: unknown, max = 20): x is string[] {
  return (
    Array.isArray(x) &&
    x.length <= max &&
    x.every((v) => typeof v === "string" && v.length > 0 && v.length <= 1000) &&
    new Set(x).size === x.length
  );
}
export function validateConstraints(x: unknown) {
  object(x);
  keys(x, [
    "currency",
    "budgetMinor",
    "deliveryWithinDays",
    "category",
    "requiredSpecifications",
    "compatibility",
  ]);
  if (x.compatibility !== undefined) {
    object(x.compatibility);
    keys(x.compatibility, [
      "hostConnection",
      "laptopInches",
      "bedWidthInches",
      "bedLengthInches",
      "mattressDepthInches",
    ]);
    for (const [k, v] of Object.entries(x.compatibility))
      requireThat(
        k === "hostConnection"
          ? typeof v === "string" && v.length <= 50
          : typeof v === "number" && Number.isFinite(v) && v > 0 && v < 1000,
        "INVALID_COMPATIBILITY",
        "Use a bounded connector name or positive dimensions in inches.",
      );
  }
  if (x.currency !== undefined)
    requireThat(
      ["SGD", "USD"].includes(x.currency as string),
      "INVALID_CURRENCY",
      "Supported currencies: SGD, USD.",
    );
  if (x.budgetMinor !== undefined)
    requireThat(
      integer(x.budgetMinor, 0, 100000000),
      "INVALID_CONSTRAINT",
      "Budget must be nonnegative integer cents.",
    );
  if (x.deliveryWithinDays !== undefined)
    requireThat(
      integer(x.deliveryWithinDays, 0, 365),
      "INVALID_CONSTRAINT",
      "Delivery deadline must be 0–365 days.",
    );
  if (x.category !== undefined)
    requireThat(
      typeof x.category === "string" && x.category.length < 100,
      "INVALID_CONSTRAINT",
      "Category must be a string.",
    );
  if (x.requiredSpecifications !== undefined) {
    object(x.requiredSpecifications);
    requireThat(
      Object.keys(x.requiredSpecifications).length <= 20 &&
        Object.values(x.requiredSpecifications).every(
          (v) =>
            typeof v === "boolean" ||
            (typeof v === "number" && Number.isFinite(v)) ||
            (typeof v === "string" && v.length <= 200),
        ),
      "INVALID_CONSTRAINT",
      "Specification constraints must be primitive values.",
    );
  }
}
