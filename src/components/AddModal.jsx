import React, { useState } from 'react'
import { createActionItem } from '../services/dataService'

export default function AddModal({ columns, defaultOwner, onClose, onSave }) {
  const [formData, setFormData] = useState({
    owner: defaultOwner || ''
  })
  const [loading, setLoading] = useState(false)

  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const result = await onSave(formData)
      console.log('Create result:', result)
    } catch (err) {
      console.error('Create error:', err)
      const errorMsg = err.message || 'Unknown error'
      alert('Failed to create action item: ' + errorMsg)
      setLoading(false)
    }
  }

  // Skip rendering fields for 'id' and 'actions'
  const editableColumns = columns.filter(col => 
    col.key !== 'id' && col.key !== 'actions'
  )

  // Helper to check if a field should be a date input
  const isDateField = (col) => {
    const keyLower = (col.key || '').toLowerCase()
    const labelLower = (col.label || '').toLowerCase()
    return keyLower.includes('date') || keyLower.includes('deadline') || 
           labelLower.includes('date') || labelLower.includes('deadline')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Action Item</h2>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {editableColumns.map(col => (
              <div key={col.key} className="form-group">
                <label>{col.label}</label>
                {col.key === 'owner' ? (
                  <select
                    value={formData[col.key] || ''}
                    onChange={e => handleChange(col.key, e.target.value)}
                    required
                  >
                    <option value="">Select Owner</option>
                    <option value="Florence">Florence</option>
                    <option value="Dan">Dan</option>
                    <option value="Kams">Kams</option>
                    <option value="Sunny">Sunny</option>
                  </select>
                ) : isDateField(col) ? (
                  <input
                    type="date"
                    value={formData[col.key] || ''}
                    onChange={e => handleChange(col.key, e.target.value)}
                  />
                ) : col.key === 'status' ? (
                  <select
                    value={formData[col.key] || ''}
                    onChange={e => handleChange(col.key, e.target.value)}
                  >
                    <option value="">Select Status</option>
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                ) : col.key === 'priority' ? (
                  <select
                    value={formData[col.key] || ''}
                    onChange={e => handleChange(col.key, e.target.value)}
                  >
                    <option value="">Select Priority</option>
                    <option value="V High">V High</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                ) : col.key === 'comments' ? (
                  <textarea
                    value={formData[col.key] || ''}
                    onChange={e => handleChange(col.key, e.target.value)}
                    placeholder={`Enter ${col.label.toLowerCase()}`}
                    rows="3"
                  />
                ) : (
                  <input
                    type="text"
                    value={formData[col.key] || ''}
                    onChange={e => handleChange(col.key, e.target.value)}
                    placeholder={`Enter ${col.label.toLowerCase()}`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
