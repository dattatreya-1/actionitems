// Data service: tries to fetch from VITE_API_URL; falls back to bundled mock data
const MOCK = [
  {
    id: '1',
    actions: 'View',
    createDate: '2025-06-01',
    businessType: 'External',
    business: 'Acme Inc',
    process: 'Onboarding',
    subType: 'Contract',
    deliverable: 'Signed Agreement',
    owner: 'Dan',
    deadline: '2025-12-31',
    min: '30',
    priority: 'High',
    status: 'Open'
  },
  {
    id: '2',
    actions: 'View',
    createDate: '2025-05-15',
    businessType: 'Internal',
    business: 'Beta LLC',
    process: 'Billing',
    subType: 'Invoice',
    deliverable: 'Invoice Sent',
    owner: 'Florence',
    deadline: '2025-11-20',
    min: '15',
    priority: 'Medium',
    status: 'In Progress'
  },
  {
    id: '3',
    actions: 'View',
    createDate: '2025-07-10',
    businessType: 'External',
    business: 'Gamma Co',
    process: 'Launch',
    subType: 'Plan',
    deliverable: 'Go-to-market',
    owner: 'Kams',
    deadline: '2026-01-15',
    min: '60',
    priority: 'High',
    status: 'Open'
  },
  {
    id: '4',
    actions: 'View',
    createDate: '2025-03-20',
    businessType: 'Internal',
    business: 'Delta Ltd',
    process: 'Audit',
    subType: 'Site',
    deliverable: 'Audit Report',
    owner: 'Sunny',
    deadline: '2025-10-05',
    min: '45',
    priority: 'Low',
    status: 'Completed'
  },
  {
    id: '5',
    actions: 'View',
    createDate: '2025-08-01',
    businessType: 'External',
    business: 'Acme Inc',
    process: 'Customer Success',
    subType: 'Check-in',
    deliverable: 'Call Notes',
    owner: 'Dan',
    deadline: '2025-09-30',
    min: '20',
    priority: 'Medium',
    status: 'Open'
  }
]

const COLUMNS = [
  { key: 'actions', label: 'ACTIONS' },
  { key: 'createDate', label: 'CREATE DATE' },
  { key: 'businessType', label: 'BUSINESS TYPE' },
  { key: 'business', label: 'BUSINESS' },
  { key: 'process', label: 'PROCESS' },
  { key: 'subType', label: 'SUB-TYPE' },
  { key: 'deliverable', label: 'DELIVERABLE' },
  { key: 'owner', label: 'OWNER' },
  { key: 'deadline', label: 'DEADLINE' },
  { key: 'min', label: 'MIN' },
  { key: 'priority', label: 'PRIORITY' },
  { key: 'status', label: 'STATUS' }
]

export function getColumns() {
  return COLUMNS
}

export async function fetchActionItems() {
  const api = import.meta.env.VITE_API_URL || '/api/action-items'
  if (!api) {
    // no API configured; return mock
    return new Promise(resolve => setTimeout(() => resolve(MOCK), 200))
  }

  try {
    const res = await fetch(api)
    if (!res.ok) {
      // Try to capture error body for debugging
      let txt = ''
      try { txt = await res.text() } catch (e) { /* ignore */ }
      console.error('fetchActionItems: non-OK response', res.status, txt)
      throw new Error('Network response was not ok')
    }

    // Parse JSON defensively — handle cases where the server returns plain text (e.g., 'unauthorized')
    let json
    try {
      json = await res.json()
    } catch (err) {
      const text = await res.text().catch(() => '')
      console.error('fetchActionItems: invalid JSON response from API', text)
      throw new Error('Invalid JSON from API: ' + (text ? text.slice(0,200) : 'empty'))
    }
    // If the backend returns {columns, rows}
    function unwrapValue(v) {
      if (v && typeof v === 'object') {
        // BigQuery row values may be {value: ...}
        if ('value' in v) return v.value
        // handle arrays
        if (Array.isArray(v)) return v.map(unwrapValue)
        // fallback to JSON string
        try { return JSON.stringify(v) } catch (e) { return String(v) }
      }
      return v
    }

    function normalizeRow(r) {
      const out = {}
      for (const k in r) {
        out[k] = unwrapValue(r[k])
      }
      return out
    }

    if (json && json.rows && Array.isArray(json.rows)) {
      const rows = json.rows.map(normalizeRow)
      return { rows, columns: json.columns }
    }
    // If it's an array of items
    if (Array.isArray(json)) return { rows: json.map(normalizeRow), columns: COLUMNS }
    return { rows: MOCK, columns: COLUMNS }
  } catch (err) {
    console.warn('fetchActionItems failed, falling back to mock', err)
    return { rows: MOCK, columns: COLUMNS }
  }
}

export async function deleteActionItem(id) {
  const api = import.meta.env.VITE_API_URL || 'http://localhost:5000'
  const res = await fetch(`${api}/api/action-items/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Delete failed')
  return res.json()
}

export async function updateActionItem(id, data) {
  const api = import.meta.env.VITE_API_URL || 'http://localhost:5000'
  const res = await fetch(`${api}/api/action-items/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Update failed')
  return res.json()
}

export async function createActionItem(data) {
  const api = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/action-items'
  const res = await fetch(api, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  
  const responseData = await res.json()
  
  if (!res.ok) {
    const errorMsg = responseData.details || responseData.error || 'Create failed'
    console.error('Create failed:', responseData)
    throw new Error(errorMsg)
  }
  
  return responseData
}
