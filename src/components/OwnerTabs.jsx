import React, { useState, useMemo } from 'react'
import AdminView from './AdminView'
import AddModal from './AddModal'
import { getColumns, createActionItem } from '../services/dataService'

export default function OwnerTabs({ data, owners = [], columns: columnsProp = [], selectedTab = null }) {
  const [active, setActive] = useState(selectedTab || owners[0] || '')
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [showAddModal, setShowAddModal] = useState(false)
  
  // Filter states
  const [deadlineFrom, setDeadlineFrom] = useState('')
  const [deadlineTo, setDeadlineTo] = useState('')
  const [priority, setPriority] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [business, setBusiness] = useState('')
  const [status, setStatus] = useState('')
  
  const columns = columnsProp && columnsProp.length ? columnsProp : getColumns()
  
  // Helper to find column key
  const findColumnKey = (name) => {
    const norm = String(name || '').replace(/[^a-z0-9]/gi, '').toLowerCase()
    const found = columns.find(c => String(c.label || c.key || '').replace(/[^a-z0-9]/gi, '').toLowerCase().includes(norm))
    return found ? found.key : null
  }
  
  const deadlineKey = findColumnKey('deadline')
  const priorityKey = findColumnKey('priority')
  const businessTypeKey = findColumnKey('business type')
  const businessKey = findColumnKey('business')
  const statusKey = findColumnKey('status')
  
  // Get unique values for dropdowns
  const ownerData = data.filter(d => d.owner === active)
  
  const priorities = useMemo(() => {
    return Array.from(new Set(ownerData.map(d => d[priorityKey] || '').filter(Boolean)))
  }, [ownerData, priorityKey])
  
  const businessTypes = useMemo(() => {
    return Array.from(new Set(ownerData.map(d => d[businessTypeKey] || '').filter(Boolean)))
  }, [ownerData, businessTypeKey])
  
  const statuses = useMemo(() => {
    return Array.from(new Set(ownerData.map(d => d[statusKey] || '').filter(Boolean)))
  }, [ownerData, statusKey])
  
  // Apply filters
  const filtered = ownerData.filter(item => {
    if (deadlineKey && deadlineFrom && item[deadlineKey] < deadlineFrom) return false
    if (deadlineKey && deadlineTo && item[deadlineKey] > deadlineTo) return false
    if (priorityKey && priority && item[priorityKey] !== priority) return false
    if (businessTypeKey && businessType && item[businessTypeKey] !== businessType) return false
    if (businessKey && business && !(String(item[businessKey] || '').toLowerCase().includes(business.toLowerCase()))) return false
    if (statusKey && status && item[statusKey] !== status) return false
    return true
  })
  
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
        {!selectedTab && (
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
        )}

        <div className="tab-content" style={{width: selectedTab ? '100%' : 'auto'}}>
          {active === 'Admin' ? (
            <AdminView initialData={data} columns={columns} />
          ) : (
            <>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
                <h2>{active}</h2>
                <button className="add-btn" onClick={() => setShowAddModal(true)}>+ Add Action Item</button>
              </div>
              
              <div className="filters">
                <label>
                  Deadline From:
                  <input type="date" value={deadlineFrom} onChange={e => setDeadlineFrom(e.target.value)} />
                </label>
                <label>
                  Deadline To:
                  <input type="date" value={deadlineTo} onChange={e => setDeadlineTo(e.target.value)} />
                </label>
                <label>
                  Priority:
                  <select value={priority} onChange={e => setPriority(e.target.value)}>
                    <option value="">(any)</option>
                    {priorities.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <label>
                  Business Type:
                  <select value={businessType} onChange={e => setBusinessType(e.target.value)}>
                    <option value="">(any)</option>
                    {businessTypes.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                  </select>
                </label>
                <label>
                  Business:
                  <input value={business} onChange={e => setBusiness(e.target.value)} placeholder="search business" />
                </label>
                <label>
                  Status:
                  <select value={status} onChange={e => setStatus(e.target.value)}>
                    <option value="">(any)</option>
                    {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>
              
              {filtered.length === 0 ? (
                <div>No records matching filters for {active}</div>
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
                  <div className="totals-summary" style={{marginTop: '1rem', padding: '1rem', background: '#f0f9ff', borderRadius: '8px', display: 'flex', gap: '2rem', flexWrap: 'wrap'}}>
                    <div>
                      <strong>Total Deliverables:</strong> {filtered.length}
                    </div>
                    <div>
                      <strong>Total Minutes:</strong> {filtered.reduce((sum, row) => sum + (parseFloat(row[findColumnKey('min')]) || 0), 0).toFixed(0)}
                    </div>
                    <div>
                      <strong>Total Hours:</strong> {(filtered.reduce((sum, row) => sum + (parseFloat(row[findColumnKey('min')]) || 0), 0) / 60).toFixed(2)}
                    </div>
                    <div>
                      <strong>Total Days (÷6):</strong> {(filtered.reduce((sum, row) => sum + (parseFloat(row[findColumnKey('min')]) || 0), 0) / 60 / 6).toFixed(2)}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {showAddModal && (
        <AddModal 
          columns={columns}
          defaultOwner={active !== 'Admin' ? active : ''}
          onClose={() => setShowAddModal(false)}
          onSave={async (formData) => {
            await createActionItem(formData)
            setShowAddModal(false)
            window.location.reload()
          }}
        />
      )}
    </section>
  )
}
