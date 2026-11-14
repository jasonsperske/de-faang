export async function fetchAccounts({ sort, dir, search }) {
  const params = new URLSearchParams({ sort, dir });
  if (search) params.set("q", search);
  const res = await fetch(`/api/accounts?${params}`);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const body = await res.json();
  return body.accounts;
}
