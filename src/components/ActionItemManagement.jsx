import React, { useEffect, useState } from 'react'
import OwnerTabs from './OwnerTabs'
import HomePage from './HomePage'
import EditModal from './EditModal'
import { fetchActionItems } from '../services/dataService'

export default function ActionItemManagement() {
  const [data, setData] = useState([])
  const [columns, setColumns] = useState([])
  const [editingRow, setEditingRow] = useState(null)
  const [selectedTab, setSelectedTab] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    function onOpenEdit(e) {
      const { row, columns } = e.detail || {}
      setEditingRow({ row, columns })
    }
    window.addEventListener('open-edit', onOpenEdit)
    return () => window.removeEventListener('open-edit', onOpenEdit)
  }, [])

  useEffect(() => {
    let mounted = true
    const fetchData = async () => {
      try {
        const result = await fetchActionItems()
        if (!mounted) return
        if (result && result.rows) {
          setData(result.rows)
          setColumns(result.columns || [])
        } else if (Array.isArray(result)) {
          setData(result)
          setColumns([])
        }
      } catch (err) {
        console.error('Failed to fetch action items:', err)
        if (mounted) {
          alert('Failed to load data from server. Please check that the backend is running.')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }
    fetchData()
    return () => { mounted = false }
  }, [])

  return (
    <div className="action-item-management">
      {!selectedTab ? (
        <HomePage onSelectTab={setSelectedTab} />
      ) : (
        <>
          <header>
            <h1>Action Tracker Pro</h1>
            <button className="back-home-btn" onClick={() => setSelectedTab(null)}>
              ← Back to Home
            </button>
          </header>
          <main>
            {loading ? (
              <div>Loading...</div>
            ) : (
              <>
                <OwnerTabs 
                  data={data} 
                  columns={columns} 
                  owners={["Florence","Dan","Kams","Sunny","Admin"]}
                  selectedTab={selectedTab}
                />
              </>
            )}
          </main>
        </>
      )}
      {editingRow && (
        <EditModal row={editingRow.row} columns={editingRow.columns || columns} onClose={() => setEditingRow(null)} onSave={async (updated) => {
          try {
            const uniqueId = editingRow.row.id
            console.log('Updating row with id:', uniqueId)
            console.log('Update data:', updated)
            await (await import('../services/dataService')).updateActionItem(uniqueId, updated)
            setEditingRow(null)
            // refresh data
            const result = await fetchActionItems()
            if (result && result.rows) { setData(result.rows); setColumns(result.columns || []) }
          } catch (err) { 
            console.error('Update error:', err)
            alert('Update failed: ' + err.message) 
          }
        }} />
      )}
    </div>
  )
}
