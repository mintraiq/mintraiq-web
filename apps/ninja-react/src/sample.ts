/** Resolve docs/samples relative to the host page (see meta mintraiq-samples-base on each shell page). */
export async function fetchSampleJson(file: string): Promise<unknown> {
    const meta = document.querySelector('meta[name="mintraiq-samples-base"]') as HTMLMetaElement | null;
    const base = (meta?.content || '../docs/samples').replace(/\/$/, '');
    const name = file.endsWith('.json') ? file : `${file}.json`;
    const url = `${base}/${name}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
    return res.json();
}
