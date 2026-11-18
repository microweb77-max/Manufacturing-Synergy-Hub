/**
 * Serializes a value the same way `res.json` would, converting Date objects to
 * ISO strings. Use this before validating with generated Zod response schemas,
 * which expect date-time strings rather than Date instances.
 */
export function toJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
