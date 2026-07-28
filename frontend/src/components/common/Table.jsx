import '../../styles/common/primitives.css';

export function Table({ columns = [], data = [], className = '' }) {
  return (
    <div className={`common-table-container ${className}`}>
      <table className="common-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} style={col.width ? { width: col.width } : undefined}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                No records found.
              </td>
            </tr>
          ) : (
            data.map((row, rowIdx) => (
              <tr key={row.id || rowIdx}>
                {columns.map(col => (
                  <td key={col.key}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ current, total, pageSize, onChange, className = '' }) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const start = (current - 1) * pageSize + 1;
  const end = Math.min(current * pageSize, total);

  return (
    <div className={`common-pagination ${className}`}>
      <span className="common-pagination__info">
        Showing {start} to {end} of {total} results
      </span>
      <div className="common-pagination__nav">
        <button
          className="common-button common-button--secondary common-button--sm"
          disabled={current === 1}
          onClick={() => onChange?.(current - 1)}
        >
          Previous
        </button>
        <button
          className="common-button common-button--secondary common-button--sm"
          disabled={current === totalPages}
          onClick={() => onChange?.(current + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
