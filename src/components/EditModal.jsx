import React, { useState } from 'react'

export default function EditModal({ row, columns = [], onClose, onSave }) {
  const [form, setForm] = useState({ ...row })

  const editableCols = columns.filter(c => c.key !== 'actions')

  // Helper to check if a field should be a date input
  const isDateField = (col) => {
    const keyLower = (col.key || '').toLowerCase()
    const labelLower = (col.label || '').toLowerCase()
    return keyLower.includes('date') || keyLower.includes('deadline') || 
           labelLower.includes('date') || labelLower.includes('deadline')
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Edit {row.id}</h3>
        <div className="modal-body">
          {editableCols.map(col => {
            const raw = form[col.key]
            const value = (raw === null || raw === undefined) ? '' : (typeof raw === 'object' ? (raw.value ?? JSON.stringify(raw)) : raw)
            return (
              <label key={col.key}>
                <div className="label">{col.label}</div>
                {isDateField(col) ? (
                  <input type="date" value={value} onChange={e => setForm({ ...form, [col.key]: e.target.value })} />
                ) : col.key === 'min' || col.key === 'minutes' ? (
                  <input type="number" value={value} onChange={e => setForm({ ...form, [col.key]: e.target.value })} />
                ) : col.key === 'owner' ? (
                  <select value={value} onChange={e => setForm({ ...form, [col.key]: e.target.value })}>
                    <option value="">Select Owner</option>
                    <option value="Florence">Florence</option>
                    <option value="Dan">Dan</option>
                    <option value="Kams">Kams</option>
                    <option value="Sunny">Sunny</option>
                  </select>
                ) : col.key === 'priority' ? (
                  <select value={value} onChange={e => setForm({ ...form, [col.key]: e.target.value })}>
                    <option value="">Select Priority</option>
                    <option value="V High">V High</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                ) : col.key === 'status' ? (
                  <select value={value} onChange={e => setForm({ ...form, [col.key]: e.target.value })}>
                    <option value="">Select Status</option>
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                ) : col.key === 'comments' ? (
                  <textarea value={value} onChange={e => setForm({ ...form, [col.key]: e.target.value })} rows="3" />
                ) : (
                  <input value={value} onChange={e => setForm({ ...form, [col.key]: e.target.value })} />
                )}
              </label>
            )
          })}
        </div>
        <div className="modal-actions">
          <button onClick={() => onSave(form)} className="action-btn">Save</button>
          <button onClick={onClose} className="action-btn">Cancel</button>
        </div>
      </div>
    </div>
  )
}
