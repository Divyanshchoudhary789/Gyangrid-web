export const isEmail = (v = '') => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
export const isIndianMobile = (v = '') => /^(\+?91[\s-]?)?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, ''));

/** F1-02: minimum 8 characters with at least one letter and one number. */
export function passwordIssues(pw = '') {
  const issues = [];
  if (pw.length < 8) issues.push('At least 8 characters');
  if (!/[A-Za-z]/.test(pw)) issues.push('At least one letter');
  if (!/\d/.test(pw)) issues.push('At least one number');
  return issues;
}

export function passwordStrength(pw = '') {
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score += 1;
  return score;
}

export const isValidName = (v = '') => /^\p{L}[\p{L} .'-]{1,49}$/u.test(v.trim());

/** Strip control characters before any text leaves the client; maths symbols are kept. */
// eslint-disable-next-line no-control-regex
export const sanitizeText = (v = '') => v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
