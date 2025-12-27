import React, { useMemo, useState, useEffect } from 'react'
import { getColumns, createActionItem } from '../services/dataService'
import EditModal from './EditModal'
import AddModal from './AddModal'
import ReportsView from './ReportsView'

export default function AdminView({ initialData = [], columns = [] }) {
  const [activeTab, setActiveTab] = useState('data')
  const [owner, setOwner] = useState('')
  const [business, setBusiness] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)

  // Use columns provided by parent (from API) if present, otherwise fall back to defaults
  const cols = (columns && columns.length) ? columns : getColumns()

  // Helper to find the column key for a human label (robust against snake_case or spacing)
  const findColumnKey = (name) => {
    const norm = String(name || '').replace(/[^a-z0-9]/gi, '').toLowerCase()
    const found = cols.find(c => String(c.label || c.key || '').replace(/[^a-z0-9]/gi, '').toLowerCase().includes(norm))
    return found ? found.key : null
  }

  const ownerKey = findColumnKey('owner')
  const businessTypeKey = findColumnKey('business type')
  const statusKey = findColumnKey('status')
  const deadlineKey = findColumnKey('deadline')
  const businessKey = findColumnKey('business')
  const minKey = findColumnKey('min')

  const owners = useMemo(() => {
    const set = new Set(initialData.map(d => d[ownerKey]).filter(Boolean))
    return Array.from(set)
  }, [initialData, ownerKey])

  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [editingRow, setEditingRow] = useState(null)
  const [columnsProp, setColumnsProp] = useState(cols)

  const [businessType, setBusinessType] = useState('')
  const [status, setStatus] = useState('')

  const businessTypes = useMemo(() => {
    return Array.from(new Set(initialData.map(d => d[businessTypeKey] || '').filter(Boolean)))
  }, [initialData, businessTypeKey])

  const statuses = useMemo(() => {
    return Array.from(new Set(initialData.map(d => d[statusKey] || '').filter(Boolean)))
  }, [initialData, statusKey])

  const filtered = initialData.filter(item => {
    if (ownerKey && owner && item[ownerKey] !== owner) return false
    if (businessKey && business && !(String(item[businessKey] || '').toLowerCase().includes(business.toLowerCase()))) return false
    if (businessTypeKey && businessType && item[businessTypeKey] !== businessType) return false
    if (statusKey && status && item[statusKey] !== status) return false
    if (deadlineKey && from && item[deadlineKey] < from) return false
    if (deadlineKey && to && item[deadlineKey] > to) return false
    return true
  })

  const sorted = [...filtered]
  if (sortKey) sorted.sort((a,b) => {
    const va = String(a[sortKey] ?? '')
    const vb = String(b[sortKey] ?? '')
    if (va === vb) return 0
    if (sortDir === 'asc') return va > vb ? 1 : -1
    return va > vb ? -1 : 1
  })

  return (
    <section className="admin">
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
        <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
          <h2>Admin</h2>
          <div style={{display: 'flex', gap: '0.5rem'}}>
            <button 
              className={activeTab === 'data' ? 'tab-active' : 'tab-inactive'}
              onClick={() => setActiveTab('data')}
              style={{padding: '6px 16px', borderRadius: '6px', border: '1px solid #ddd', cursor: 'pointer', background: activeTab === 'data' ? '#2b6cb0' : 'white', color: activeTab === 'data' ? 'white' : '#333'}}
            >
              Data
            </button>
            <button 
              className={activeTab === 'reports' ? 'tab-active' : 'tab-inactive'}
              onClick={() => setActiveTab('reports')}
              style={{padding: '6px 16px', borderRadius: '6px', border: '1px solid #ddd', cursor: 'pointer', background: activeTab === 'reports' ? '#2b6cb0' : 'white', color: activeTab === 'reports' ? 'white' : '#333'}}
            >
              Reports
            </button>
          </div>
        </div>
        {activeTab === 'data' && (
          <button className="add-btn" onClick={() => setShowAddModal(true)}>+ Add Action Item</button>
        )}
      </div>

      {activeTab === 'reports' ? (
        <ReportsView data={initialData} columns={cols} />
      ) : (
        <>
          <div className="filters">
        <label>
          Owner:
          <select value={owner} onChange={e => setOwner(e.target.value)}>
            <option value="">(any)</option>
            {owners.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>

        <label>
          Business Type:
          <select value={businessType} onChange={e => setBusinessType(e.target.value)}>
            <option value="">(any)</option>
            {businessTypes.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>

        <label>
          Status:
          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">(any)</option>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>

        <label>
          Business:
          <input value={business} onChange={e => setBusiness(e.target.value)} placeholder="search business" />
        </label>

        <label>
          From (deadline):
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </label>

        <label>
          To (deadline):
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </label>
      </div>

      <div className="admin-table table-wrap">
        <table>
          <thead>
            <tr>
              {cols.map(c => (
                <th key={c.key} onClick={() => {
                  if (sortKey === c.key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
                  else { setSortKey(c.key); setSortDir('asc') }
                }}>{c.label} {sortKey === c.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(sortKey ? sorted : filtered).map(r => (
              <tr key={r.id}>
                {cols.map(c => (
                  <td key={c.key}>
                    {c.key === 'actions' ? (
                      <div style={{display:'flex',gap:8}}>
                        <button title="Delete" className="action-btn delete" onClick={async () => {
                          if (!confirm(`Delete ${r.id}?`)) return
                          try {
                            await (await import('../services/dataService')).deleteActionItem(r.id)
                            window.location.reload()
                          } catch (err) { alert('Delete failed: '+err) }
                        }}>🗑</button>
                        <button title="Edit" className="action-btn" onClick={() => setEditingRow(r)}>Edit</button>
                      </div>
                    ) : (
                      (function formatCell(v) {
                        if (v === null || v === undefined) return ''
                        if (typeof v === 'object') return v.value ?? JSON.stringify(v)
                        return v
                      })(r[c.key])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="admin-count">Showing {filtered.length} of {initialData.length}</div>
        <div className="totals-summary" style={{marginTop: '1rem', padding: '1rem', background: '#f0f9ff', borderRadius: '8px', display: 'flex', gap: '2rem', flexWrap: 'wrap'}}>
          <div>
            <strong>Total Deliverables:</strong> {filtered.length}
          </div>
          <div>
            <strong>Total Minutes:</strong> {filtered.reduce((sum, row) => sum + (parseFloat(row[minKey]) || 0), 0).toFixed(0)}
          </div>
          <div>
            <strong>Total Hours:</strong> {(filtered.reduce((sum, row) => sum + (parseFloat(row[minKey]) || 0), 0) / 60).toFixed(2)}
          </div>
          <div>
            <strong>Total Days (÷6):</strong> {(filtered.reduce((sum, row) => sum + (parseFloat(row[minKey]) || 0), 0) / 60 / 6).toFixed(2)}
          </div>
        </div>
      </div>
        </>
      )}
      
      {editingRow && (
        <EditModal row={editingRow} columns={cols} onClose={() => setEditingRow(null)} onSave={async (updated) => {
          try {
            await (await import('../services/dataService')).updateActionItem(editingRow.id, updated)
            setEditingRow(null)
            window.location.reload()
          } catch (err) { alert('Update failed: '+err) }
        }} />
      )}
      {showAddModal && (
        <AddModal 
          columns={cols}
          defaultOwner=""
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
