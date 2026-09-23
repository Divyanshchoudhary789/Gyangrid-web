import { env } from '@/config/env';

/**
 * First-party, event-based analytics (SEC-09, section 24.4).
 * No third-party or advertising SDK. Replace `transport` with the real collector endpoint.
 */
const buffer = [];

function transport(evt) {
  if (env.isDev) console.debug('[analytics]', evt.name, evt.props);
}

export function track(name, props = {}) {
  const evt = { name, props, at: new Date().toISOString() };
  buffer.push(evt);
  if (buffer.length > 200) buffer.shift();
  transport(evt);
}
