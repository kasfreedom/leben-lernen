const JSON_FETCH_OPTIONS: RequestInit = { cache: "no-cache" };

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, JSON_FETCH_OPTIONS);
  if (!response.ok) {
    throw new Error(`Could not load ${url}: ${response.status}`);
  }
  return response.json() as Promise<T>;
}
