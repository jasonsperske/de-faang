import { useEffect, useState } from "react";
import { fetchAccounts } from "./api.js";
import { AccountsTable } from "./components/AccountsTable.jsx";

export function App() {
  const [sort, setSort] = useState({ key: "net", dir: "desc" });
  const [search, setSearch] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAccounts({ sort: sort.key, dir: sort.dir, search })
      .then((rows) => !cancelled && (setAccounts(rows), setError(null)))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [sort, search]);

  const onSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "name" || key === "plan" ? "asc" : "desc" }));

  return (
    <div className="page">
      <header>
        <h1>Accounts</h1>
        <input type="search" placeholder="Search customers" value={search} onChange={(e) => setSearch(e.target.value)} />
      </header>
      {error && <div className="error">Couldn't load accounts: {error}</div>}
      <AccountsTable accounts={accounts} sort={sort} onSort={onSort} loading={loading} />
    </div>
  );
}
