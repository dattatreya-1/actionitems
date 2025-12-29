import React, { useState, useEffect } from 'react'

export default function RepublicServicesTable() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingRow, setEditingRow] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/republicservices')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const result = await response.json()
      console.log('Republic Services data received:', result)
      
      // Normalize BigQuery data - extract values from objects
      const normalizedData = (result.rows || []).map(row => ({
        ...row,
        s_no: row.s_no?.value !== undefined ? row.s_no.value : row.s_no,
        work_date: row.work_date?.value !== undefined ? row.work_date.value : row.work_date,
        description: row.description?.value !== undefined ? row.description.value : row.description,
        photo_attachments: Array.isArray(row.photo_attachments) ? row.photo_attachments : [],
        file_attachments: Array.isArray(row.file_attachments) ? row.file_attachments : []
      }))
      
      setData(normalizedData)
      setLoading(false)
    } catch (err) {
      console.error('Failed to fetch Republic Services data:', err)
      setData([])
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this record? Note: Recently added records cannot be deleted from BigQuery for up to 90 minutes due to streaming buffer restrictions. This will remove it from the UI.')) return
    try {
      const response = await fetch(`http://localhost:5000/api/republicservices/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        // If BigQuery streaming buffer error, just remove from UI
        console.warn('BigQuery delete failed (likely streaming buffer), removing from UI only')
        setData(prevData => prevData.filter(row => row.id !== id))
        return
      }
      fetchData()
    } catch (err) {
      console.error('Delete error:', err)
      // Remove from UI anyway
      setData(prevData => prevData.filter(row => row.id !== id))
    }
  }

  const handleSave = async (formData) => {
    try {
      const method = formData.id ? 'PUT' : 'POST'
      const url = formData.id 
        ? `http://localhost:5000/api/republicservices/${formData.id}`
        : 'http://localhost:5000/api/republicservices'
      
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      setShowAddModal(false)
      setEditingRow(null)
      fetchData()
    } catch (err) {
      alert('Save failed: ' + err.message)
    }
  }

  if (loading) return <div>Loading...</div>

  return (
    <div className="hvac-table">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3>Republic Services Work Records</h3>
        <button className="add-btn" onClick={() => setShowAddModal(true)}>
          + Add Record
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>S.NO</th>
              <th>DATE</th>
              <th>DESCRIPTION</th>
              <th>PHOTOS</th>
              <th>FILES</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={row.id}>
                <td>{row.s_no || index + 1}</td>
                <td>{row.work_date}</td>
                <td>{row.description}</td>
                <td>
                  {row.photo_attachments && row.photo_attachments.length > 0 ? (
                    <div>
                      {row.photo_attachments.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                          Photo {i + 1}
                        </a>
                      ))}
                    </div>
                  ) : '-'}
                </td>
                <td>
                  {row.file_attachments && row.file_attachments.length > 0 ? (
                    <div>
                      {row.file_attachments.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                          File {i + 1}
                        </a>
                      ))}
                    </div>
                  ) : '-'}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="action-btn" onClick={() => setEditingRow(row)}>
                      Edit
                    </button>
                    <button className="action-btn delete" onClick={() => handleDelete(row.id)}>
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(showAddModal || editingRow) && (
        <RepublicServicesFormModal
          data={editingRow}
          onClose={() => {
            setShowAddModal(false)
            setEditingRow(null)
          }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

function RepublicServicesFormModal({ data, onClose, onSave }) {
  const [formData, setFormData] = useState({
    s_no: data?.s_no || '',
    work_date: data?.work_date || '',
    description: data?.description || '',
    photo_attachments: data?.photo_attachments || [],
    file_attachments: data?.file_attachments || []
  })
  const [uploading, setUploading] = useState(false)

  const handleFileUpload = async (files, fieldName) => {
    if (!files || files.length === 0) return
    
    setUploading(true)
    try {
      const formData = new FormData()
      Array.from(files).forEach(file => {
        formData.append('files', file)
      })

      const response = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) throw new Error('Upload failed')
      
      const result = await response.json()
      
      // Add new URLs to existing ones
      setFormData(prev => ({
        ...prev,
        [fieldName]: [...prev[fieldName], ...result.urls]
      }))
    } catch (err) {
      alert('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  const removeAttachment = (fieldName, index) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: prev[fieldName].filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = {
      ...formData,
      photo_attachments: formData.photo_attachments,
      file_attachments: formData.file_attachments
    }
    if (data?.id) payload.id = data.id
    onSave(payload)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{data ? 'Edit' : 'Add'} Republic Services Record</h2>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>S.No</label>
              <input
                type="number"
                value={formData.s_no}
                onChange={e => setFormData({ ...formData, s_no: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={formData.work_date}
                onChange={e => setFormData({ ...formData, work_date: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Description of Work Done</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                rows="4"
                required
              />
            </div>
            <div className="form-group">
              <label>Photo Attachments</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFileUpload(e.target.files, 'photo_attachments')}
                  disabled={uploading}
                  id="photo-upload"
                  style={{ display: 'none' }}
                />
                <label htmlFor="photo-upload" className="upload-btn" style={{ 
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  opacity: uploading ? 0.6 : 1,
                  padding: '8px 16px',
                  background: '#007bff',
                  color: 'white',
                  borderRadius: '4px',
                  border: 'none'
                }}>
                  {uploading ? 'Uploading...' : '📁 Upload Photos'}
                </label>
              </div>
              {formData.photo_attachments.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  {formData.photo_attachments.map((url, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Photo {i + 1}
                      </a>
                      <button 
                        type="button" 
                        onClick={() => removeAttachment('photo_attachments', i)}
                        style={{ padding: '2px 8px', fontSize: '12px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="form-group">
              <label>File Attachments</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="file"
                  multiple
                  onChange={(e) => handleFileUpload(e.target.files, 'file_attachments')}
                  disabled={uploading}
                  id="file-upload"
                  style={{ display: 'none' }}
                />
                <label htmlFor="file-upload" className="upload-btn" style={{ 
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  opacity: uploading ? 0.6 : 1,
                  padding: '8px 16px',
                  background: '#007bff',
                  color: 'white',
                  borderRadius: '4px',
                  border: 'none'
                }}>
                  {uploading ? 'Uploading...' : '📎 Upload Files'}
                </label>
              </div>
              {formData.file_attachments.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  {formData.file_attachments.map((url, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        File {i + 1}
                      </a>
                      <button 
                        type="button" 
                        onClick={() => removeAttachment('file_attachments', i)}
                        style={{ padding: '2px 8px', fontSize: '12px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit">Save</button>
          </div>
        </form>
      </div>
    </div>
  )
}
