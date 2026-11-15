import { formatDate, formatMoney } from "../format.js";

const COLUMNS = [
  { key: "name", label: "Customer" },
  { key: "plan", label: "Plan" },
  { key: "orders", label: "Orders", numeric: true },
  { key: "gross", label: "Gross revenue", numeric: true, money: true },
  { key: "refunded", label: "Refunded", numeric: true, money: true },
  { key: "net", label: "Net revenue", numeric: true, money: true },
  { key: "lastOrderAt", label: "Last order" },
];

export function AccountsTable({ accounts, sort, onSort, loading }) {
  const totalNet = accounts.reduce((sum, a) => sum + (a.net ?? 0), 0);
  return (
    <table className={`accounts ${loading ? "loading" : ""}`}>
      <thead>
        <tr>
          {COLUMNS.map((col) => (
            <th key={col.key} className={col.numeric ? "num" : ""} onClick={() => onSort(col.key)}>
              {col.label}
              {sort.key === col.key ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {accounts.map((a) => (
          <tr key={a.id}>
            <td>{a.name}</td>
            <td>
              <span className={`plan ${a.plan}`}>{a.plan}</span>
            </td>
            <td className="num">{a.orders}</td>
            <td className="num">{formatMoney(a.gross)}</td>
            <td className="num">{formatMoney(a.refunded)}</td>
            <td className="num">{formatMoney(a.net)}</td>
            <td>{formatDate(a.lastOrderAt)}</td>
          </tr>
        ))}
        {!loading && accounts.length === 0 && (
          <tr>
            <td colSpan={COLUMNS.length} className="empty">
              No customers match.
            </td>
          </tr>
        )}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={5}>{accounts.length} customers</td>
          <td className="num">{formatMoney(totalNet)}</td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}
