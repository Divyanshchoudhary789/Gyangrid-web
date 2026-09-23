/** Stable error codes shared by the real API and the mock (section 20: { ok, data, error: { code, message } }). */
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
  TEST_LOCKED: 'TEST_LOCKED',
  ALREADY_ATTEMPTED: 'ALREADY_ATTEMPTED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  TWO_FACTOR_REQUIRED: 'TWO_FACTOR_REQUIRED',
  SERVER: 'SERVER_ERROR',
};

const FRIENDLY = {
  NETWORK_ERROR: "You're offline or the connection dropped. We'll keep what you've done so far.",
  TIMEOUT: 'This is taking longer than usual. Please try again.',
  SERVER_ERROR: 'Something went wrong. Please try again.',
  UNAUTHENTICATED: 'Please sign in again to continue.',
  CONSENT_REQUIRED: 'Parental consent is needed before you can use this.',
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

export const errorMessage = (err) => (err instanceof ApiError ? err.message : FRIENDLY.SERVER_ERROR);
