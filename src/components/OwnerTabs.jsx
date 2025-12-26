import React, { useState } from 'react'
import AdminView from './AdminView'
import { getColumns } from '../services/dataService'

export default function OwnerTabs({ data, owners = [], columns: columnsProp = [] }) {
  const [active, setActive] = useState(owners[0] || '')
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const columns = columnsProp && columnsProp.length ? columnsProp : getColumns()
  const filtered = data.filter(d => d.owner === active)
  const sorted = [...filtered]
  if (sortKey) sorted.sort((a, b) => {
    const va = String(a[sortKey] ?? '')
    const vb = String(b[sortKey] ?? '')
    if (va === vb) return 0
    if (sortDir === 'asc') return va > vb ? 1 : -1
    return va > vb ? -1 : 1
  })

  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')

  return (
    <section className="owner-tabs">
      <div className="owner-layout">
        <aside className="tabs vertical">
          {owners.map(o => (
            <button
              key={o}
              className={`tab-btn ${slug(o)} ${o === active ? 'active' : ''}`}
              onClick={() => setActive(o)}
            >
              {o}
            </button>
          ))}
        </aside>

        <div className="tab-content">
          {active === 'Admin' ? (
            <AdminView initialData={data} columns={columns} />
          ) : (
            <>
              <h2>{active}</h2>
              {filtered.length === 0 ? (
                <div>No records for {active}</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {columns.map(c => (
                          <th key={c.key} onClick={() => {
                            if (sortKey === c.key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
                            else { setSortKey(c.key); setSortDir('asc') }
                          }}>
                            {c.label} {sortKey === c.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(sortKey ? sorted : filtered).map(row => (
                        <tr key={row.id}>
                          {columns.map(col => (
                            <td key={col.key}>
                              {col.key === 'actions' ? (
                                <div style={{display:'flex',gap:8}}>
                                  <button title="Delete" className="action-btn delete" onClick={async () => {
                                    if (!confirm(`Delete ${row.id}?`)) return
                                    try {
                                      await (await import('../services/dataService')).deleteActionItem(row.id)
                                      window.location.reload()
                                    } catch (err) { alert('Delete failed: '+err) }
                                  }}>🗑</button>
                                  <button title="Edit" className="action-btn" onClick={() => {
                                    window.dispatchEvent(new CustomEvent('open-edit', { detail: { row, columns } }))
                                  }}>Edit</button>
                                </div>
                              ) : (
                                (function formatCell(v) {
                                  if (v === null || v === undefined) return ''
                                  if (typeof v === 'object') return v.value ?? JSON.stringify(v)
                                  return v
                                })(row[col.key])
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
