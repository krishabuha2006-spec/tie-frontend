import React from 'react';

export const Table = ({
  columns = [], // [{ header, key, render }]
  data = [],
  loading = false,
  emptyMessage = 'No records found.',
  className = '',
}) => {
  return (
    <div className={`table-responsive ${className}`}>
      <table className="table">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th
                key={idx}
                style={{
                  ...(col.width ? { width: col.width } : {}),
                  ...(col.minWidth ? { minWidth: col.minWidth } : {}),
                  ...(col.align ? { textAlign: col.align } : {}),
                  ...(col.style || {}),
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: '32px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
                  <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  Loading data...
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rIdx) => {
              const rowKey =
                typeof row?._id === 'string' || typeof row?._id === 'number'
                  ? `row-${row._id}`
                  : typeof row?.id === 'string' || typeof row?.id === 'number'
                  ? `row-${row.id}`
                  : row?._id?.$oid
                  ? `row-${row._id.$oid}`
                  : row?.id?.$oid
                  ? `row-${row.id.$oid}`
                  : row?.slug
                  ? `row-${row.slug}-${rIdx}`
                  : row?.code
                  ? `row-${row.code}-${rIdx}`
                  : `row-${rIdx}`;

              return (
                <tr key={rowKey}>
                  {columns.map((col, cIdx) => {
                    const colKey = typeof col.key === 'string' || typeof col.key === 'number'
                      ? `cell-${col.key}-${cIdx}`
                      : `cell-${cIdx}`;
                    return (
                      <td
                        key={colKey}
                        style={{
                          ...(col.width ? { width: col.width } : {}),
                          ...(col.minWidth ? { minWidth: col.minWidth } : {}),
                          ...(col.align ? { textAlign: col.align } : {}),
                          ...(col.style || {}),
                        }}
                      >
                        {(() => {
                          try {
                            return col.render ? col.render(row, rIdx) : (row?.[col.key] ?? '-');
                          } catch (renderErr) {
                            console.warn('Table cell render error:', renderErr);
                            return row?.[col.key] ?? '-';
                          }
                        })()}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
