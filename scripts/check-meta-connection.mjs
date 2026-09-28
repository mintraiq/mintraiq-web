#!/usr/bin/env node
// Read-only check that the Meta System User token can reach the configured
// Page and Instagram Business Account. Never logs the token itself.

process.loadEnvFile();

const { META_PAGE_ID, META_IG_BUSINESS_ID, META_PAGE_ACCESS_TOKEN } = process.env;

for (const [name, value] of Object.entries({ META_PAGE_ID, META_IG_BUSINESS_ID, META_PAGE_ACCESS_TOKEN })) {
  if (!value) {
    console.error(`Missing ${name} in .env`);
    process.exit(1);
  }
}

const GRAPH_VERSION = 'v21.0';

async function check(label, id, fields) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${id}?fields=${fields}&access_token=${META_PAGE_ACCESS_TOKEN}`;
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) {
    console.error(`${label}: FAILED (${res.status})`, body.error?.message ?? body);
    return false;
  }
  console.log(`${label}: OK —`, body);
  return true;
}

const pageOk = await check('Facebook Page', META_PAGE_ID, 'name,id');
const igOk = await check('Instagram Business Account', META_IG_BUSINESS_ID, 'username,id');

process.exit(pageOk && igOk ? 0 : 1);
