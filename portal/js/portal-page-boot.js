import { guardSession } from './guard-session.js';
import { claimPageScript } from './page-script-guard.js';

if (claimPageScript('portal-page-boot')) {
    await guardSession();
}
