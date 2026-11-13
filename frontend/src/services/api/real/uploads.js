import { ApiError, ERROR_CODES } from '../../errors';

/** Uploads media to a one-use signed storage URL without forwarding the Firebase token. */
export async function uploadToSignedUrl({ url, method = 'PUT', headers, fields }, blob) {
  if (!/^https:\/\//i.test(url || '')) throw new ApiError(ERROR_CODES.SERVER, 'The upload link is not valid. Please try again.', { status: 500 });
  let body = blob;
  let requestHeaders = headers || { 'Content-Type': blob.type };
  if (method === 'POST' && fields && typeof fields === 'object') {
    body = new FormData();
    Object.entries(fields).forEach(([name, value]) => body.append(name, String(value)));
    body.append('file', blob);
    requestHeaders = undefined;
  } else if (method !== 'PUT') {
    throw new ApiError(ERROR_CODES.SERVER, 'The upload link is not valid. Please try again.', { status: 500 });
  }
  let res;
  try {
    res = await fetch(url, { method, ...(requestHeaders ? { headers: requestHeaders } : {}), body });
  } catch {
    throw new ApiError(ERROR_CODES.NETWORK, undefined, { status: 0 });
  }
  if (!res.ok) throw new ApiError(ERROR_CODES.SERVER, 'The upload failed. Please try again.', { status: res.status });
}
