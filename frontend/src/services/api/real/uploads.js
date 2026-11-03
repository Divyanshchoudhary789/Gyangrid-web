import { ApiError, ERROR_CODES } from '../../errors';

/**
 * PUTs a blob to a backend-issued signed storage URL. The Firebase token is deliberately not sent:
 * the URL itself authorises this one upload. Only https targets are accepted.
 */
export async function putToSignedUrl({ url, headers }, blob) {
  if (!/^https:\/\//i.test(url || '')) throw new ApiError(ERROR_CODES.SERVER, 'The upload link is not valid. Please try again.', { status: 500 });
  let res;
  try {
    res = await fetch(url, { method: 'PUT', headers: headers || { 'Content-Type': blob.type }, body: blob });
  } catch {
    throw new ApiError(ERROR_CODES.NETWORK, undefined, { status: 0 });
  }
  if (!res.ok) throw new ApiError(ERROR_CODES.SERVER, 'The upload failed. Please try again.', { status: res.status });
}
