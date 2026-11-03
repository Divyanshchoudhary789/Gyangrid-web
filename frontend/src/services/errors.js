/**
 * Stable, UI-facing error codes. Backend errors ({ success:false, message, errorCode }) are mapped
 * onto these so components never depend on raw backend strings.
 */
export const ERROR_CODES = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  CONSENT_REQUIRED: 'CONSENT_REQUIRED',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION: 'VALIDATION_ERROR',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  NETWORK: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  AI_UNAVAILABLE: 'AI_UNAVAILABLE',
  /** A provider (AI, speech, storage, email) isn't configured or is down on the server. */
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  FOLLOW_UP_LIMIT: 'FOLLOW_UP_LIMIT',
  TEST_LOCKED: 'TEST_LOCKED',
  ALREADY_ATTEMPTED: 'ALREADY_ATTEMPTED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  TWO_FACTOR_REQUIRED: 'TWO_FACTOR_REQUIRED',
  ONBOARDING_REQUIRED: 'ONBOARDING_REQUIRED',
  /** The backend has no endpoint for this feature yet (see docs/PENDING_BACKEND_APIS.md). */
  NOT_AVAILABLE: 'NOT_AVAILABLE',
  SERVER: 'SERVER_ERROR',
};

const FRIENDLY = {
  NETWORK_ERROR: "You're offline or the connection dropped. Please check your internet and try again.",
  TIMEOUT: 'This is taking longer than usual. Please try again.',
  SERVER_ERROR: 'Something went wrong on our side. Please try again.',
  UNAUTHENTICATED: 'Please sign in again to continue.',
  CONSENT_REQUIRED: 'Parental consent is needed before you can use this.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  NOT_AVAILABLE: 'This feature is coming soon.',
  SERVICE_UNAVAILABLE: "This isn't available right now. Please try again a little later.",
  QUOTA_EXCEEDED: "You've used all your doubts for now. Practice, tests and your Mistake Bank are still available.",
  FOLLOW_UP_LIMIT: 'This doubt has reached its limit of 2 follow-ups. Start a new doubt to keep going.',
  TWO_FACTOR_REQUIRED: 'Enter the code from your authenticator app to continue.',
  FORBIDDEN: "You don't have access to this.",
};

export class ApiError extends Error {
  constructor(code, message, { status = 400, details = null } = {}) {
    super(message || FRIENDLY[code] || 'Something went wrong. Please try again.');
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** Backend errorCode → UI code. Unknown codes fall back to the HTTP status. */
const BACKEND_CODES = {
  MISSING_TOKEN: ERROR_CODES.UNAUTHENTICATED,
  INVALID_TOKEN: ERROR_CODES.UNAUTHENTICATED,
  TOKEN_EXPIRED: ERROR_CODES.UNAUTHENTICATED,
  UNAUTHORIZED: ERROR_CODES.UNAUTHENTICATED,
  FORBIDDEN: ERROR_CODES.FORBIDDEN,
  INSUFFICIENT_PERMISSIONS: ERROR_CODES.FORBIDDEN,
  VALIDATION_ERROR: ERROR_CODES.VALIDATION,
  NOT_FOUND: ERROR_CODES.NOT_FOUND,
  CONFLICT: ERROR_CODES.CONFLICT,
  DUPLICATE: ERROR_CODES.CONFLICT,
  RATE_LIMITED: ERROR_CODES.RATE_LIMITED,
  RATE_LIMIT_EXCEEDED: ERROR_CODES.RATE_LIMITED,
  SERVICE_UNAVAILABLE: ERROR_CODES.SERVICE_UNAVAILABLE,
  QUOTA_EXCEEDED: ERROR_CODES.QUOTA_EXCEEDED,
  FOLLOW_UP_LIMIT_EXCEEDED: ERROR_CODES.FOLLOW_UP_LIMIT,
  DUPLICATE_REPORT: ERROR_CODES.CONFLICT,
  TWO_FACTOR_REQUIRED: ERROR_CODES.TWO_FACTOR_REQUIRED,
  ADMIN_2FA_REQUIRED: ERROR_CODES.TWO_FACTOR_REQUIRED,
  MFA_REQUIRED: ERROR_CODES.TWO_FACTOR_REQUIRED,
  TOO_MANY_REQUESTS: ERROR_CODES.RATE_LIMITED,
  CONSENT_REQUIRED: ERROR_CODES.CONSENT_REQUIRED,
  ONBOARDING_REQUIRED: ERROR_CODES.ONBOARDING_REQUIRED,
  ONBOARDING_INCOMPLETE: ERROR_CODES.ONBOARDING_REQUIRED,
  ACCOUNT_SUSPENDED: ERROR_CODES.ACCOUNT_SUSPENDED,
  ACCOUNT_DEACTIVATED: ERROR_CODES.ACCOUNT_SUSPENDED,
};

const BY_STATUS = {
  400: ERROR_CODES.VALIDATION,
  401: ERROR_CODES.UNAUTHENTICATED,
  403: ERROR_CODES.FORBIDDEN,
  404: ERROR_CODES.NOT_FOUND,
  409: ERROR_CODES.CONFLICT,
  422: ERROR_CODES.VALIDATION,
  429: ERROR_CODES.RATE_LIMITED,
  503: ERROR_CODES.SERVICE_UNAVAILABLE,
};

export function mapBackendError(status, json) {
  const backendCode = json?.errorCode || json?.code || null;
  const code = BACKEND_CODES[backendCode] || BY_STATUS[status] || ERROR_CODES.SERVER;
  // 5xx messages are never shown raw — they may leak internals.
  const message = status >= 500 ? undefined : (json?.message || undefined);
  return new ApiError(code, message, { status, details: { backendCode, errors: json?.errors || json?.details || null, data: json?.data ?? null } });
}

export const notAvailable = (feature) => new ApiError(ERROR_CODES.NOT_AVAILABLE, `${feature} is coming soon.`, { status: 501, details: { feature } });

export const errorMessage = (err) => (err instanceof ApiError ? err.message : FRIENDLY.SERVER_ERROR);
