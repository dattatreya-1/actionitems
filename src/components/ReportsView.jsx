import React, { useState, useMemo } from 'react'

export default function ReportsView({ data, columns }) {
  const [rowDimension, setRowDimension] = useState('owner')
  const [colDimension, setColDimension] = useState('business_type')
  const [selectedOwner, setSelectedOwner] = useState('')
  const [deadlineFrom, setDeadlineFrom] = useState('')
  const [deadlineTo, setDeadlineTo] = useState('')
  const [metric, setMetric] = useState('minutes') // 'minutes' or 'count'
  
  // Helper to find column key
  const findColumnKey = (name) => {
    const norm = String(name || '').replace(/[^a-z0-9]/gi, '').toLowerCase()
    const found = columns.find(c => String(c.label || c.key || '').replace(/[^a-z0-9]/gi, '').toLowerCase().includes(norm))
    return found ? found.key : null
  }
  
  const deadlineKey = findColumnKey('deadline')
  const minKey = findColumnKey('min')
  const ownerKey = findColumnKey('owner')
  
  // Get unique owners for filter dropdown
  const availableOwners = useMemo(() => {
    return Array.from(new Set(data.map(d => d[ownerKey]).filter(Boolean))).sort()
  }, [data, ownerKey])
  
  // Filter for date range and owner
  const dateFilteredData = useMemo(() => {
    const from = deadlineFrom ? new Date(deadlineFrom) : null
    const to = deadlineTo ? new Date(deadlineTo) : null
    
    return data.filter(item => {
      // Owner filter
      if (selectedOwner && item[ownerKey] !== selectedOwner) return false
      
      // Deadline filter
      if (!deadlineKey || !item[deadlineKey]) return false
      const deadline = new Date(item[deadlineKey])
      if (from && deadline < from) return false
      if (to && deadline > to) return false
      
      return true
    })
  }, [data, selectedOwner, deadlineFrom, deadlineTo, ownerKey, deadlineKey])
  
  // Default to next 7 days if no custom range
  const shouldUseDefault = !deadlineFrom && !deadlineTo
  
  // Filter for next 7 days (default behavior)
  const today = new Date()
  const next7Days = new Date(today)
  next7Days.setDate(today.getDate() + 7)
  
  const filteredData = useMemo(() => {
    if (shouldUseDefault) {
      return dateFilteredData.filter(item => {
        if (!deadlineKey || !item[deadlineKey]) return false
        const deadline = new Date(item[deadlineKey])
        return deadline >= today && deadline <= next7Days
      })
    }
    return dateFilteredData
  }, [dateFilteredData, shouldUseDefault, deadlineKey])
  
  // Get available dimensions (exclude id, actions, min, deadline)
  const availableDimensions = useMemo(() => {
    return columns
      .filter(c => !['id', 'actions', minKey, deadlineKey].includes(c.key))
      .map(c => ({ key: c.key, label: c.label }))
  }, [columns, minKey, deadlineKey])
  
  // Build pivot table
  const pivotData = useMemo(() => {
    const pivot = {}
    const colValues = new Set()
    
    filteredData.forEach(item => {
      const rowValue = item[rowDimension] || '(blank)'
      const colValue = item[colDimension] || '(blank)'
      const minutes = parseFloat(item[minKey]) || 0
      
      colValues.add(colValue)
      
      if (!pivot[rowValue]) {
        pivot[rowValue] = {}
      }
      if (!pivot[rowValue][colValue]) {
        pivot[rowValue][colValue] = { minutes: 0, count: 0 }
      }
      pivot[rowValue][colValue].minutes += minutes
      pivot[rowValue][colValue].count += 1
    })
    
    return {
      pivot,
      rowKeys: Object.keys(pivot).sort(),
      colKeys: Array.from(colValues).sort()
    }
  }, [filteredData, rowDimension, colDimension, minKey])
  
  // Calculate totals
  const calculateTotals = (rowKey) => {
    const totalMinutes = pivotData.colKeys.reduce((sum, colKey) => {
      return sum + (pivotData.pivot[rowKey]?.[colKey]?.minutes || 0)
    }, 0)
    const totalCount = pivotData.colKeys.reduce((sum, colKey) => {
      return sum + (pivotData.pivot[rowKey]?.[colKey]?.count || 0)
    }, 0)
    const totalHours = totalMinutes / 60
    const totalDays = totalHours / 6
    
    return { totalMinutes, totalCount, totalHours, totalDays }
  }
  
  const grandTotals = useMemo(() => {
    const totalMinutes = pivotData.rowKeys.reduce((sum, rowKey) => {
      return sum + calculateTotals(rowKey).totalMinutes
    }, 0)
    const totalCount = pivotData.rowKeys.reduce((sum, rowKey) => {
      return sum + calculateTotals(rowKey).totalCount
    }, 0)
    const totalHours = totalMinutes / 60
    const totalDays = totalHours / 6
    
    return { totalMinutes, totalCount, totalHours, totalDays }
  }, [pivotData])
  
  return (
    <div className="reports-view">
      <h2>Reports - Workload Analysis</h2>
      <p style={{color: '#6b7280', marginBottom: '1rem'}}>
        {shouldUseDefault 
          ? `Showing action items with deadlines from ${today.toLocaleDateString()} to ${next7Days.toLocaleDateString()} (next 7 days)`
          : `Showing action items based on selected filters`
        }
      </p>
      
      <div className="filters" style={{marginBottom: '1rem'}}>
        <label>
          Team Member:
          <select value={selectedOwner} onChange={e => setSelectedOwner(e.target.value)}>
            <option value="">(all)</option>
            {availableOwners.map(owner => (
              <option key={owner} value={owner}>{owner}</option>
            ))}
          </select>
        </label>
        
        <label>
          Deadline From:
          <input 
            type="date" 
            value={deadlineFrom} 
            onChange={e => setDeadlineFrom(e.target.value)}
            placeholder="Start date"
          />
        </label>
        
        <label>
          Deadline To:
          <input 
            type="date" 
            value={deadlineTo} 
            onChange={e => setDeadlineTo(e.target.value)}
            placeholder="End date"
          />
        </label>
      </div>
      
      <div className="pivot-controls" style={{display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center'}}>
        <label>
          <strong>Metric:</strong>
          <select value={metric} onChange={e => setMetric(e.target.value)} style={{marginLeft: '0.5rem'}}>
            <option value="minutes">Minutes</option>
            <option value="count">Number of Deliverables</option>
          </select>
        </label>
        
        <label>
          <strong>Rows:</strong>
          <select value={rowDimension} onChange={e => setRowDimension(e.target.value)} style={{marginLeft: '0.5rem'}}>
            {availableDimensions.map(dim => (
              <option key={dim.key} value={dim.key}>{dim.label}</option>
            ))}
          </select>
        </label>
        
        <label>
          <strong>Columns:</strong>
          <select value={colDimension} onChange={e => setColDimension(e.target.value)} style={{marginLeft: '0.5rem'}}>
            {availableDimensions.map(dim => (
              <option key={dim.key} value={dim.key}>{dim.label}</option>
            ))}
          </select>
        </label>
      </div>
      
      {filteredData.length === 0 ? (
        <div style={{padding: '2rem', textAlign: 'center', color: '#6b7280'}}>
          No action items with deadlines in the next 7 days
        </div>
      ) : (
        <div className="table-wrap" style={{overflowX: 'auto'}}>
          <table className="pivot-table">
            <thead>
              <tr>
                <th style={{position: 'sticky', left: 0, background: '#fafafa', zIndex: 3}}>
                  {availableDimensions.find(d => d.key === rowDimension)?.label || rowDimension}
                </th>
                {pivotData.colKeys.map(colKey => (
                  <th key={colKey} style={{minWidth: '100px'}}>{colKey}</th>
                ))}
                <th style={{background: '#f0f9ff', fontWeight: 'bold'}}>
                  {metric === 'minutes' ? 'Total Minutes' : 'Total Deliverables'}
                </th>
                {metric === 'minutes' && (
                  <>
                    <th style={{background: '#f0f9ff', fontWeight: 'bold'}}>Total Hours</th>
                    <th style={{background: '#f0f9ff', fontWeight: 'bold'}}>Total Days (÷6)</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {pivotData.rowKeys.map(rowKey => {
                const totals = calculateTotals(rowKey)
                return (
                  <tr key={rowKey}>
                    <td style={{position: 'sticky', left: 0, background: 'white', fontWeight: '600', zIndex: 2}}>
                      {rowKey}
                    </td>
                    {pivotData.colKeys.map(colKey => {
                      const cellData = pivotData.pivot[rowKey]?.[colKey]
                      const value = metric === 'minutes' ? cellData?.minutes : cellData?.count
                      return (
                        <td key={colKey} style={{textAlign: 'right'}}>
                          {value ? (metric === 'minutes' ? value.toFixed(0) : value) : '-'}
                        </td>
                      )
                    })}
                    <td style={{textAlign: 'right', background: '#f0f9ff', fontWeight: 'bold'}}>
                      {metric === 'minutes' ? totals.totalMinutes.toFixed(0) : totals.totalCount}
                    </td>
                    {metric === 'minutes' && (
                      <>
                        <td style={{textAlign: 'right', background: '#f0f9ff', fontWeight: 'bold'}}>
                          {totals.totalHours.toFixed(2)}
                        </td>
                        <td style={{textAlign: 'right', background: '#f0f9ff', fontWeight: 'bold'}}>
                          {totals.totalDays.toFixed(2)}
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
              <tr style={{background: '#dbeafe', fontWeight: 'bold'}}>
                <td style={{position: 'sticky', left: 0, background: '#dbeafe', zIndex: 2}}>GRAND TOTAL</td>
                {pivotData.colKeys.map(colKey => {
                  const colTotal = pivotData.rowKeys.reduce((sum, rowKey) => {
                    const cellData = pivotData.pivot[rowKey]?.[colKey]
                    return sum + (metric === 'minutes' ? (cellData?.minutes || 0) : (cellData?.count || 0))
                  }, 0)
                  return (
                    <td key={colKey} style={{textAlign: 'right'}}>
                      {colTotal > 0 ? (metric === 'minutes' ? colTotal.toFixed(0) : colTotal) : '-'}
                    </td>
                  )
                })}
                <td style={{textAlign: 'right', background: '#3b82f6', color: 'white'}}>
                  {metric === 'minutes' ? grandTotals.totalMinutes.toFixed(0) : grandTotals.totalCount}
                </td>
                {metric === 'minutes' && (
                  <>
                    <td style={{textAlign: 'right', background: '#3b82f6', color: 'white'}}>
                      {grandTotals.totalHours.toFixed(2)}
                    </td>
                    <td style={{textAlign: 'right', background: '#3b82f6', color: 'white'}}>
                      {grandTotals.totalDays.toFixed(2)}
                    </td>
                  </>
                )}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
