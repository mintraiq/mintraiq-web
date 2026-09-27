#!/usr/bin/env node
// Publish a generated marketing/reels/<slug>/ package to the Facebook Page
// and Instagram Business account. Read-only until a human has approved the
// package (see marketing/calendar.md status column) — this script never
// decides that on its own.
//
// Usage:
//   node scripts/publish-social-package.mjs <package-dir> --row <calendar-row-number> [--dry-run]
//
// Instagram's Content Publishing API only accepts a public image_url, and it
// cannot receive an uploaded file directly. Rather than hosting images on
// mintraiq.com (marketing/ is deliberately kept off the public site — see
// .vercelignore), each image is first uploaded unpublished to the Facebook
// Page, and the Facebook-hosted CDN URL that upload returns is reused as the
// image_url for the Instagram container. Both platforms end up showing the
// same asset; nothing is hosted by us.

process.loadEnvFile();

const GRAPH_VERSION = 'v21.0';
const { META_PAGE_ID, META_IG_BUSINESS_ID, META_PAGE_ACCESS_TOKEN } = process.env;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const rowFlagIndex = args.indexOf('--row');
const calendarRow = rowFlagIndex !== -1 ? args[rowFlagIndex + 1] : null;
const packageDir = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--row');

if (!packageDir) {
  console.error('Usage: node scripts/publish-social-package.mjs <package-dir> --row <N> [--dry-run]');
  process.exit(1);
}
if (!calendarRow && !dryRun) {
  console.error('Missing --row <calendar-row-number> — required so the calendar can be flipped to `posted` after a real post.');
  process.exit(1);
}
for (const [name, value] of Object.entries({ META_PAGE_ID, META_IG_BUSINESS_ID, META_PAGE_ACCESS_TOKEN })) {
  if (!value) {
    console.error(`Missing ${name} in .env`);
    process.exit(1);
  }
}

const fs = await import('node:fs/promises');
const path = await import('node:path');

async function readCaptions(dir) {
  const raw = await fs.readFile(path.join(dir, 'captions.md'), 'utf8');
  const sections = raw.split(/\n(?=##\s)/);
  const find = (label) => {
    const section = sections.find((s) => new RegExp(`^##\\s*${label}\\b`, 'i').test(s.trim()));
    if (!section) return null;
    // The caption itself lives inside a fenced code block; everything else
    // in the section is a note for the human, not text to post.
    const fenced = section.match(/```\n([\s\S]*?)\n```/);
    if (!fenced) throw new Error(`"## ${label}" section has no fenced caption block`);
    return fenced[1].trim();
  };
  const facebook = find('facebook');
  const instagram = find('instagram');
  if (!facebook || !instagram) {
    throw new Error(
      `captions.md must have a "## Facebook" and an "## Instagram" section, each with a fenced caption block — found headings: ${sections.map((s) => s.split('\n')[0]).join(', ')}`
    );
  }
  return { facebook, instagram };
}

async function findImages(dir) {
  // frames-feed/ is the feed-shaped (up to 4:5) render made for a `+ reel`
  // week's static fallback; frames/ (1080x1920, reel/story shaped) would
  // display cropped and oversized in a normal feed post. Prefer the former;
  // a non-reel week only ever has frames/, already feed-shaped, so it still
  // works unchanged.
  for (const candidate of ['frames-feed', 'frames']) {
    const framesDir = path.join(dir, candidate);
    if (!(await fs.stat(framesDir).catch(() => false))) continue;
    const files = (await fs.readdir(framesDir)).filter((f) => f.endsWith('.png')).sort();
    if (files.length > 0) return files.map((f) => path.join(framesDir, f));
  }
  throw new Error(`No rendered PNGs found in ${path.join(dir, 'frames-feed')} or ${path.join(dir, 'frames')}`);
}

async function findVideo(dir) {
  const videoPath = path.join(dir, 'reel.mp4');
  return (await fs.stat(videoPath).catch(() => false)) ? videoPath : null;
}

// Meta rejects unpublished-photo uploads made with a System User token
// directly ("(#200) Unpublished posts must be posted to a page as the page
// itself") — it has to be the Page's own access token, fetched by exchanging
// the System User token for it.
async function getPageAccessToken() {
  const { access_token } = await graph(`${META_PAGE_ID}?fields=access_token&access_token=${META_PAGE_ACCESS_TOKEN}`);
  return access_token;
}

async function graph(endpoint, { method = 'GET', body, isForm = false } = {}) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${endpoint}`;
  const res = await fetch(url, {
    method,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
    headers: isForm ? undefined : { 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Graph API ${method} ${endpoint} failed: ${json.error?.message ?? JSON.stringify(json)}`);
  }
  return json;
}

async function uploadUnpublishedPhoto(imagePath, token) {
  const buffer = await fs.readFile(imagePath);
  const form = new FormData();
  form.append('published', 'false');
  form.append('access_token', token);
  form.append('source', new Blob([buffer], { type: 'image/png' }), path.basename(imagePath));
  const { id } = await graph(`${META_PAGE_ID}/photos`, { method: 'POST', body: form, isForm: true });
  const details = await graph(`${id}?fields=images&access_token=${token}`);
  const cdnUrl = details.images?.[0]?.source;
  if (!cdnUrl) throw new Error(`Photo ${id} uploaded but no CDN URL came back`);
  return { photoId: id, cdnUrl };
}

async function publishToFacebook(photoIds, message, token) {
  const attached_media = photoIds.map((media_fbid) => ({ media_fbid }));
  return graph(`${META_PAGE_ID}/feed`, {
    method: 'POST',
    body: {
      message,
      attached_media: JSON.stringify(attached_media),
      access_token: token,
    },
  });
}

async function publishToInstagram(cdnUrls, caption, token) {
  let creationId;
  if (cdnUrls.length === 1) {
    const { id } = await graph(`${META_IG_BUSINESS_ID}/media`, {
      method: 'POST',
      body: { image_url: cdnUrls[0], caption, access_token: token },
    });
    creationId = id;
  } else {
    const children = [];
    for (const url of cdnUrls) {
      const { id } = await graph(`${META_IG_BUSINESS_ID}/media`, {
        method: 'POST',
        body: { image_url: url, is_carousel_item: true, access_token: token },
      });
      children.push(id);
    }
    const { id } = await graph(`${META_IG_BUSINESS_ID}/media`, {
      method: 'POST',
      body: { media_type: 'CAROUSEL', children, caption, access_token: token },
    });
    creationId = id;
  }
  await waitUntilContainerFinished(creationId, token);
  return graph(`${META_IG_BUSINESS_ID}/media_publish`, {
    method: 'POST',
    body: { creation_id: creationId, access_token: token },
  });
}

// Facebook merged Video and Reels in mid-2025 — a plain video upload to a
// Page now publishes as a Reel, no separate endpoint needed.
async function uploadVideoToFacebook(videoPath, message, token) {
  const buffer = await fs.readFile(videoPath);
  const form = new FormData();
  form.append('description', message);
  form.append('access_token', token);
  form.append('source', new Blob([buffer], { type: 'video/mp4' }), path.basename(videoPath));
  const { id } = await graph(`${META_PAGE_ID}/videos`, { method: 'POST', body: form, isForm: true });
  return id;
}

// Video processing takes longer than a photo upload — wait for Facebook to
// finish transcoding before asking for a URL, and before Instagram tries to
// fetch it.
async function waitUntilVideoReady(videoId, token) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const { status } = await graph(`${videoId}?fields=status&access_token=${token}`);
    const videoStatus = status?.video_status;
    if (videoStatus === 'ready') return;
    if (videoStatus === 'error') throw new Error(`Facebook video ${videoId} failed to process: ${JSON.stringify(status)}`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`Facebook video ${videoId} did not finish processing in time`);
}

// Same public-URL constraint as images: Instagram's Reels container needs a
// video_url it can fetch itself. This reuses Facebook's own hosted copy,
// same trick as the photo CDN reuse above — UNVERIFIED against a real post
// as of this writing (no `+ reel` week has gone through this path yet). If
// Instagram can't fetch it, this step is where to look first.
async function getFacebookVideoUrl(videoId, token) {
  const { source } = await graph(`${videoId}?fields=source&access_token=${token}`);
  if (!source) throw new Error(`Facebook video ${videoId} has no fetchable "source" URL`);
  return source;
}

async function waitUntilContainerFinished(containerId, token, maxAttempts = 10) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { status_code } = await graph(`${containerId}?fields=status_code&access_token=${token}`);
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR') throw new Error(`Instagram container ${containerId} failed to process`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`Instagram container ${containerId} did not finish processing in time`);
}

async function publishReelToInstagram(videoUrl, caption, token) {
  const { id: creationId } = await graph(`${META_IG_BUSINESS_ID}/media`, {
    method: 'POST',
    body: { media_type: 'REELS', video_url: videoUrl, caption, share_to_feed: true, access_token: token },
  });
  // Video containers can take minutes, not seconds — more, longer-spaced
  // attempts than the image path's waitUntilFinished.
  await waitUntilContainerFinished(creationId, token, 40);
  return graph(`${META_IG_BUSINESS_ID}/media_publish`, {
    method: 'POST',
    body: { creation_id: creationId, access_token: token },
  });
}

async function updateCalendarStatus(row) {
  const calendarPath = path.join(process.cwd(), 'marketing/calendar.md');
  const raw = await fs.readFile(calendarPath, 'utf8');
  const lines = raw.split('\n');
  const idx = lines.findIndex((l) => l.trim().startsWith(`| ${row} |`));
  if (idx === -1) throw new Error(`Calendar row ${row} not found in marketing/calendar.md`);
  const cells = lines[idx].split('|');
  cells[cells.length - 2] = ' posted ';
  lines[idx] = cells.join('|');
  await fs.writeFile(calendarPath, lines.join('\n'));
}

const { facebook: fbCaption, instagram: igCaption } = await readCaptions(packageDir);
const video = await findVideo(packageDir);
const images = video ? null : await findImages(packageDir);

console.log(`Package: ${packageDir}`);
if (video) {
  console.log(`Video: ${path.basename(video)}`);
} else {
  console.log(`Images: ${images.map((i) => path.basename(i)).join(', ')}`);
}
console.log(`Facebook caption:\n${fbCaption}\n`);
console.log(`Instagram caption:\n${igCaption}\n`);

if (dryRun) {
  const action = video ? 'upload the video, publish it as a Facebook Reel, then post it as an Instagram Reel' : 'upload the above images, post to the Facebook Page, then the Instagram account';
  console.log(`[dry-run] No network calls made. Would ${action}.`);
  process.exit(0);
}

const pageToken = await getPageAccessToken();

if (video) {
  console.log('Uploading video to Facebook (publishes as a Reel)...');
  const fbVideoId = await uploadVideoToFacebook(video, fbCaption, pageToken);
  console.log('Waiting for Facebook to finish processing the video...');
  await waitUntilVideoReady(fbVideoId, pageToken);
  console.log('Facebook Reel published:', fbVideoId);

  console.log('Fetching the Facebook-hosted video URL for Instagram to reuse...');
  const videoUrl = await getFacebookVideoUrl(fbVideoId, pageToken);

  console.log('Publishing Instagram Reel (this can take a few minutes)...');
  const igPost = await publishReelToInstagram(videoUrl, igCaption, pageToken);
  console.log('Instagram Reel published:', igPost.id);
} else {
  console.log('Uploading images to Facebook (unpublished)...');
  const uploads = [];
  for (const image of images) {
    uploads.push(await uploadUnpublishedPhoto(image, pageToken));
  }

  console.log('Publishing Facebook Page post...');
  const fbPost = await publishToFacebook(uploads.map((u) => u.photoId), fbCaption, pageToken);
  console.log('Facebook post published:', fbPost.id);

  console.log('Publishing Instagram post...');
  const igPost = await publishToInstagram(uploads.map((u) => u.cdnUrl), igCaption, pageToken);
  console.log('Instagram post published:', igPost.id);
}

await updateCalendarStatus(calendarRow);
console.log(`Calendar row ${calendarRow} marked posted.`);
