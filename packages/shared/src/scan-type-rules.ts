import { SCAN_TYPE_REQUIREMENTS } from "./constants";
import type { ScanType, TargetType } from "./types";

export interface ScanTypeValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * The single source of truth for "is this combination of targets +
 * credential valid for this scan type" — spec §11's validation rules.
 * Called from the API (authoritative) and can be reused by the web form
 * to disable the submit button early, but the API check is what matters.
 */
export function validateScanTypeTargets(
  scanType: ScanType,
  targetTypes: TargetType[],
  hasCredential: boolean
): ScanTypeValidationResult {
  const rules = SCAN_TYPE_REQUIREMENTS[scanType];
  const hasSource = targetTypes.includes("SOURCE");
  const hasWebOrApi = targetTypes.some((t) => t === "WEB" || t === "API");

  if (rules.needsSource && !hasSource) {
    return { valid: false, error: `${scanType} requires at least one SOURCE target` };
  }
  if (rules.needsWebOrApi && !hasWebOrApi) {
    return { valid: false, error: `${scanType} requires at least one WEB or API target` };
  }
  if (rules.credential === "required" && !hasCredential) {
    return { valid: false, error: `${scanType} requires a credentialSecretArn` };
  }

  // Keep each scan's target set unambiguous. In particular, a Source Review
  // must never accidentally inherit a WEB/API selection from a previously
  // selected scan type in the UI.
  if (scanType === "SOURCE_REVIEW" && hasWebOrApi) {
    return { valid: false, error: "SOURCE_REVIEW only accepts SOURCE targets" };
  }
  if ((scanType === "BLACK_BOX" || scanType === "AUTHENTICATED") && hasSource) {
    return { valid: false, error: `${scanType} only accepts WEB or API targets` };
  }

  return { valid: true };
}
