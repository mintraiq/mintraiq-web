/**
 * Logto browser SDK — single CDN entry point.
 * Use jsDelivr `+esm` instead of esm.sh to avoid 404 / edge issues on Vercel and other CDNs.
 * @see https://www.jsdelivr.com/package/npm/@logto/browser
 */
import LogtoClient from 'https://cdn.jsdelivr.net/npm/@logto/browser@4.1.7/+esm';

export { LogtoClient };
export default LogtoClient;
