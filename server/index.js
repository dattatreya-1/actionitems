import express from 'express'
import fs from 'fs'
import cors from 'cors'
import { BigQuery } from '@google-cloud/bigquery'
import { Storage } from '@google-cloud/storage'
import multer from 'multer'
import path from 'path'
import process from 'process'

const app = express()
app.use(cors())
app.use(express.json())

// Simple request logging to help diagnose runtime errors in Cloud Run
app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const ms = Date.now() - start
    console.log(`${req.method} ${req.path} ${res.statusCode} - ${ms}ms`)
  })
  next()
})

const PORT = process.env.PORT || 5000

// Table reference: project.dataset.table
const TABLE_FULL = process.env.BQ_TABLE || 'gen-lang-client-0815432790.oberoiventures.actionitemstable'

// Resolve dist path once and reuse
const distPath = path.join(process.cwd(), 'dist')

// Serve favicon explicitly regardless of build presence to avoid 500s
app.get('/favicon.ico', (req, res) => {
  try {
    const ico = path.join(distPath, 'favicon.ico')
    if (fs.existsSync(ico)) return res.sendFile(ico)
    return res.status(204).end()
  } catch (err) {
    console.error('Error serving favicon.ico', err && err.stack ? err.stack : err)
    return res.status(204).end()
  }
})

// Initialize BigQuery client.
// Behavior:
// - If the env var GOOGLE_APPLICATION_CREDENTIALS is set (pointing to a JSON key file),
//   the client will use that file via `keyFilename` (useful for local development).
// - If the env var is NOT set, the client will be constructed without explicit credentials
//   and will use Application Default Credentials (ADC). This allows Cloud Run to
//   provide credentials via its runtime service account (no JSON key required).
const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
let bq
if (credsPath) {
  bq = new BigQuery({ keyFilename: credsPath })
} else {
  // No key file provided; rely on ADC (works on Cloud Run when a service account is attached)
  bq = new BigQuery()
}

// Initialize Google Cloud Storage
const storage = new Storage(credsPath ? { keyFilename: credsPath } : {})
const bucketName = 'vendor-attachments'
const bucket = storage.bucket(bucketName)

// Configure multer for file uploads (store in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
})

// Health status object used by /healthz
let health = { ok: false, message: 'starting' }

// Perform a lightweight BigQuery check to validate credentials and table access
async function performStartupCheck() {
  try {
    const [project, dataset, table] = TABLE_FULL.split('.')
    const tableRef = bq.dataset(dataset, { projectId: project }).table(table)
    // Try to fetch metadata as a minimal permission check
    await tableRef.getMetadata()
    health = { ok: true, message: 'ok' }
    console.log('Startup check: BigQuery table accessible')
  } catch (err) {
    // Keep the message short and avoid leaking sensitive info
    const short = err && err.message ? String(err.message).slice(0, 200) : 'unknown error'
    health = { ok: false, message: `BigQuery unavailable: ${short}` }
    console.error('Startup check failed:', err && err.stack ? err.stack : err)
  }
}

// Run initial check and schedule periodic checks
performStartupCheck()
setInterval(performStartupCheck, 5 * 60 * 1000) // every 5 minutes

app.get('/api/action-items', async (req, res) => {
  try {
    const [project, dataset, table] = TABLE_FULL.split('.')

    // Fetch table metadata (schema)
    const tableRef = bq.dataset(dataset, { projectId: project }).table(table)
    const [meta] = await tableRef.getMetadata()
    const fields = meta.schema && meta.schema.fields ? meta.schema.fields : []

    const columns = fields.map(f => ({ key: f.name, label: String(f.name).toUpperCase() }))

    // Query rows (limit to 1000 for safety)
    const query = `SELECT * FROM \`${project}.${dataset}.${table}\` LIMIT 1000`
    const [job] = await bq.createQueryJob({ query })
    const [rows] = await job.getQueryResults()

    res.json({ columns, rows })
  } catch (err) {
    // Log stack for debugging; return generic message to client
    console.error('Error fetching action-items from BigQuery', err && err.stack ? err.stack : err)
    res.status(500).json({ error: 'internal server error' })
  }
})

// Create a new action item
app.post('/api/action-items', async (req, res) => {
  try {
    const data = req.body || {}
    console.log('Received POST data:', JSON.stringify(data, null, 2))
    
    const keys = Object.keys(data)
    if (keys.length === 0) return res.status(400).json({ error: 'no fields provided' })

    const [project, dataset, table] = TABLE_FULL.split('.')
    
    // Get table schema to see what columns exist
    const tableRef = bq.dataset(dataset, { projectId: project }).table(table)
    const [metadata] = await tableRef.getMetadata()
    const fields = metadata.schema?.fields || []
    const validColumns = fields.map(f => f.name)
    
    // Create a map of column name to type
    const columnTypes = {}
    fields.forEach(f => {
      columnTypes[f.name] = f.type
    })
    
    console.log('Available table columns:', validColumns)
    console.log('Column types:', columnTypes)
    
    // Only include fields that exist in the table schema and convert types
    const filteredData = {}
    Object.keys(data).forEach(key => {
      if (validColumns.includes(key)) {
        let value = data[key]
        const columnType = columnTypes[key]
        
        // Convert empty strings to null
        if (value === '' || value === undefined) {
          value = null
        }
        // Convert to integer for INT64 columns
        else if (columnType === 'INT64' || columnType === 'INTEGER') {
          value = value !== null ? parseInt(value, 10) : null
          if (isNaN(value)) value = null
        }
        // Convert to float for FLOAT64 columns
        else if (columnType === 'FLOAT64' || columnType === 'FLOAT') {
          value = value !== null ? parseFloat(value) : null
          if (isNaN(value)) value = null
        }
        
        filteredData[key] = value
      } else {
        console.log(`Skipping field "${key}" - not in table schema`)
      }
    })
    
    // Generate ID only if the table has an id column
    let generatedId = null
    if (validColumns.includes('id')) {
      generatedId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      filteredData.id = generatedId
    }
    
    const allKeys = Object.keys(filteredData)
    if (allKeys.length === 0) {
      return res.status(400).json({ error: 'No valid fields to insert' })
    }
    
    // Build INSERT query
    const columns = allKeys.map(k => `\`${k}\``).join(', ')
    const paramNames = allKeys.map((k, i) => `@p${i}`).join(', ')
    const params = {}
    allKeys.forEach((k, i) => { params[`p${i}`] = filteredData[k] })

    const query = `INSERT INTO \`${project}.${dataset}.${table}\` (${columns}) VALUES (${paramNames})`
    console.log('Query:', query)
    console.log('Params:', JSON.stringify(params, null, 2))
    
    const [job] = await bq.createQueryJob({ query, params })
    const [result] = await job.getQueryResults()
    console.log('Insert successful')
    res.json({ success: true, id: generatedId })
  } catch (err) {
    console.error('Error creating action-item:')
    console.error('Message:', err.message)
    console.error('Stack:', err.stack)
    if (err.errors) {
      console.error('BigQuery errors:', JSON.stringify(err.errors, null, 2))
    }
    res.status(500).json({ 
      error: 'Create failed',
      details: err.message,
      bigQueryErrors: err.errors 
    })
  }
})

// Delete an item by id (expects id to uniquely identify row)
app.delete('/api/action-items/:id', async (req, res) => {
  try {
    const id = req.params.id
    const [project, dataset, table] = TABLE_FULL.split('.')
    const query = `DELETE FROM \`${project}.${dataset}.${table}\` WHERE id = @id`
    const [job] = await bq.createQueryJob({ query, params: { id } })
    await job.getQueryResults()
    res.json({ success: true })
  } catch (err) {
    console.error('Error deleting action-item', err && err.stack ? err.stack : err)
    res.status(500).json({ error: 'internal server error' })
  }
})

// Update an item by id. Body should contain key/value pairs to update.
app.put('/api/action-items/:id', async (req, res) => {
  try {
    const id = req.params.id
    const updates = req.body || {}
    // Remove id if present
    delete updates.id

    const keys = Object.keys(updates)
    if (keys.length === 0) return res.status(400).json({ error: 'no fields to update' })

    const [project, dataset, table] = TABLE_FULL.split('.')
    const setClauses = keys.map((k, i) => `\`${k}\` = @p${i}`).join(', ')
    const params = {}
    keys.forEach((k, i) => { params[`p${i}`] = updates[k] })
    params.idParam = id

    const query = `UPDATE \`${project}.${dataset}.${table}\` SET ${setClauses} WHERE id = @idParam`
    const [job] = await bq.createQueryJob({ query, params })
    await job.getQueryResults()
    res.json({ success: true })
  } catch (err) {
    console.error('Error updating action-item', err && err.stack ? err.stack : err)
    res.status(500).json({ error: 'internal server error' })
  }
})

// HVAC Table Endpoints
const HVAC_TABLE = 'gen-lang-client-0815432790.oberoiventures.hvac'
const REPUBLIC_SERVICES_TABLE = 'gen-lang-client-0815432790.oberoiventures.republicservices'
const CERTASITE_TABLE = 'gen-lang-client-0815432790.oberoiventures.certasite'

// File upload endpoint for vendor attachments
app.post('/api/upload', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' })
    }

    const uploadPromises = req.files.map(async (file) => {
      // Generate unique filename with timestamp
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(2, 8)
      const ext = path.extname(file.originalname)
      const filename = `${timestamp}_${randomStr}${ext}`
      
      const blob = bucket.file(filename)
      const blobStream = blob.createWriteStream({
        resumable: false,
        metadata: {
          contentType: file.mimetype,
          metadata: {
            originalName: file.originalname,
          },
        },
      })

      return new Promise((resolve, reject) => {
        blobStream.on('error', (err) => {
          console.error('Upload error:', err)
          reject(err)
        })

        blobStream.on('finish', () => {
          // File uploaded successfully - return public URL
          // Note: Bucket must have allUsers permission or uniform bucket-level access configured
          const publicUrl = `https://storage.googleapis.com/${bucketName}/${filename}`
          resolve(publicUrl)
        })

        blobStream.end(file.buffer)
      })
    })

    const urls = await Promise.all(uploadPromises)
    res.json({ urls })
  } catch (err) {
    console.error('Error uploading files:', err && err.stack ? err.stack : err)
    res.status(500).json({ error: 'File upload failed' })
  }
})

// Get all HVAC records
app.get('/api/hvac', async (req, res) => {
  try {
    const [project, dataset, table] = HVAC_TABLE.split('.')
    const query = `SELECT * FROM \`${project}.${dataset}.${table}\` ORDER BY work_date DESC`
    const [job] = await bq.createQueryJob({ query })
    const [rows] = await job.getQueryResults()
    res.json({ rows })
  } catch (err) {
    console.error('Error fetching HVAC records:', err)
    res.status(500).json({ error: 'Failed to fetch HVAC records', details: err.message })
  }
})

// Create HVAC record
app.post('/api/hvac', async (req, res) => {
  try {
    const data = req.body || {}
    const [project, dataset, table] = HVAC_TABLE.split('.')
    
    // Generate unique ID
    const id = `hvac_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Prepare row for streaming insert
    const row = {
      id: id,
      s_no: data.s_no ? parseInt(data.s_no, 10) : null,
      work_date: data.work_date || null,
      description: data.description || null,
      photo_attachments: Array.isArray(data.photo_attachments) ? data.photo_attachments : [],
      file_attachments: Array.isArray(data.file_attachments) ? data.file_attachments : [],
      created_by: data.created_by || null,
      created_at: new Date().toISOString(),
      updated_at: null
    }
    
    // Use streaming insert (no parameter type issues)
    const tableRef = bq.dataset(dataset, { projectId: project }).table(table)
    await tableRef.insert([row])
    
    res.json({ success: true, id })
  } catch (err) {
    console.error('Error creating HVAC record:', err)
    res.status(500).json({ error: 'Failed to create HVAC record', details: err.message })
  }
})

// Update HVAC record
app.put('/api/hvac/:id', async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body || {}
    delete updates.id
    
    const keys = Object.keys(updates)
    if (keys.length === 0) return res.status(400).json({ error: 'no fields to update' })

    const [project, dataset, table] = HVAC_TABLE.split('.')
    updates.updated_at = new Date().toISOString()
    
    const updatedKeys = Object.keys(updates)
    const setClauses = updatedKeys.map((k, i) => `\`${k}\` = @p${i}`).join(', ')
    const params = {}
    updatedKeys.forEach((k, i) => { params[`p${i}`] = updates[k] })
    params.idParam = id

    const query = `UPDATE \`${project}.${dataset}.${table}\` SET ${setClauses} WHERE id = @idParam`
    const [job] = await bq.createQueryJob({ query, params })
    await job.getQueryResults()
    
    res.json({ success: true })
  } catch (err) {
    console.error('Error updating HVAC record:', err)
    res.status(500).json({ error: 'Failed to update HVAC record', details: err.message })
  }
})

// Delete HVAC record
app.delete('/api/hvac/:id', async (req, res) => {
  try {
    const { id } = req.params
    const [project, dataset, table] = HVAC_TABLE.split('.')
    const query = `DELETE FROM \`${project}.${dataset}.${table}\` WHERE id = '${id}'`
    const [job] = await bq.createQueryJob({ query })
    await job.getQueryResults()
    console.log(`Deleted HVAC record: ${id}`)
    res.json({ success: true })
  } catch (err) {
    console.error('Error deleting HVAC record:', err)
    res.status(500).json({ error: 'Failed to delete HVAC record', details: err.message })
  }
})

// ============================================
// REPUBLIC SERVICES ENDPOINTS
// ============================================

// Get all Republic Services records
app.get('/api/republicservices', async (req, res) => {
  try {
    const [project, dataset, table] = REPUBLIC_SERVICES_TABLE.split('.')
    const query = `SELECT * FROM \`${project}.${dataset}.${table}\` ORDER BY work_date DESC`
    const [job] = await bq.createQueryJob({ query })
    const [rows] = await job.getQueryResults()
    res.json({ rows })
  } catch (err) {
    console.error('Error fetching Republic Services records:', err)
    res.status(500).json({ error: 'Failed to fetch Republic Services records', details: err.message })
  }
})

// Create Republic Services record
app.post('/api/republicservices', async (req, res) => {
  try {
    const data = req.body || {}
    const [project, dataset, table] = REPUBLIC_SERVICES_TABLE.split('.')
    
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    
    const row = {
      id: `rs_${timestamp}_${random}`,
      s_no: parseInt(data.s_no, 10) || null,
      work_date: data.work_date || null,
      description: data.description || null,
      photo_attachments: Array.isArray(data.photo_attachments) ? data.photo_attachments : [],
      file_attachments: Array.isArray(data.file_attachments) ? data.file_attachments : [],
      created_by: data.created_by || null,
      created_at: new Date().toISOString(),
      updated_at: null
    }

    const tableRef = bq.dataset(dataset).table(table)
    await tableRef.insert([row])
    
    console.log('Republic Services record saved:', row.id)
    res.json({ success: true, id: row.id })
  } catch (err) {
    console.error('Error saving Republic Services record:', err)
    res.status(500).json({ error: 'Failed to save Republic Services record', details: err.message })
  }
})

// Update Republic Services record
app.put('/api/republicservices/:id', async (req, res) => {
  try {
    const { id } = req.params
    const data = req.body || {}
    const [project, dataset, table] = REPUBLIC_SERVICES_TABLE.split('.')
    
    const query = `
      UPDATE \`${project}.${dataset}.${table}\`
      SET 
        s_no = @sNo,
        work_date = @workDate,
        description = @description,
        photo_attachments = @photoAttachments,
        file_attachments = @fileAttachments,
        updated_at = @updatedAt
      WHERE id = @idParam
    `
    
    const params = {
      idParam: id,
      sNo: data.s_no ? parseInt(data.s_no, 10) : null,
      workDate: data.work_date || null,
      description: data.description || null,
      photoAttachments: Array.isArray(data.photo_attachments) ? data.photo_attachments : [],
      fileAttachments: Array.isArray(data.file_attachments) ? data.file_attachments : [],
      updatedAt: new Date().toISOString()
    }
    
    const [job] = await bq.createQueryJob({ query, params })
    await job.getQueryResults()
    res.json({ success: true })
  } catch (err) {
    console.error('Error updating Republic Services record:', err)
    res.status(500).json({ error: 'Failed to update Republic Services record', details: err.message })
  }
})

// Delete Republic Services record
app.delete('/api/republicservices/:id', async (req, res) => {
  try {
    const { id } = req.params
    const [project, dataset, table] = REPUBLIC_SERVICES_TABLE.split('.')
    const query = `DELETE FROM \`${project}.${dataset}.${table}\` WHERE id = '${id}'`
    const [job] = await bq.createQueryJob({ query })
    await job.getQueryResults()
    console.log(`Deleted Republic Services record: ${id}`)
    res.json({ success: true })
  } catch (err) {
    console.error('Error deleting Republic Services record:', err)
    res.status(500).json({ error: 'Failed to delete Republic Services record', details: err.message })
  }
})

// ============================================
// CERTASITE ENDPOINTS
// ============================================

// Get all Certasite records
app.get('/api/certasite', async (req, res) => {
  try {
    const [project, dataset, table] = CERTASITE_TABLE.split('.')
    const query = `SELECT * FROM \`${project}.${dataset}.${table}\` ORDER BY work_date DESC`
    const [job] = await bq.createQueryJob({ query })
    const [rows] = await job.getQueryResults()
    res.json({ rows })
  } catch (err) {
    console.error('Error fetching Certasite records:', err)
    res.status(500).json({ error: 'Failed to fetch Certasite records', details: err.message })
  }
})

// Create Certasite record
app.post('/api/certasite', async (req, res) => {
  try {
    const data = req.body || {}
    const [project, dataset, table] = CERTASITE_TABLE.split('.')
    
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    
    const row = {
      id: `cs_${timestamp}_${random}`,
      s_no: parseInt(data.s_no, 10) || null,
      work_date: data.work_date || null,
      description: data.description || null,
      photo_attachments: Array.isArray(data.photo_attachments) ? data.photo_attachments : [],
      file_attachments: Array.isArray(data.file_attachments) ? data.file_attachments : [],
      created_by: data.created_by || null,
      created_at: new Date().toISOString(),
      updated_at: null
    }

    const tableRef = bq.dataset(dataset).table(table)
    await tableRef.insert([row])
    
    console.log('Certasite record saved:', row.id)
    res.json({ success: true, id: row.id })
  } catch (err) {
    console.error('Error saving Certasite record:', err)
    res.status(500).json({ error: 'Failed to save Certasite record', details: err.message })
  }
})

// Update Certasite record
app.put('/api/certasite/:id', async (req, res) => {
  try {
    const { id } = req.params
    const data = req.body || {}
    const [project, dataset, table] = CERTASITE_TABLE.split('.')
    
    const query = `
      UPDATE \`${project}.${dataset}.${table}\`
      SET 
        s_no = @sNo,
        work_date = @workDate,
        description = @description,
        photo_attachments = @photoAttachments,
        file_attachments = @fileAttachments,
        updated_at = @updatedAt
      WHERE id = @idParam
    `
    
    const params = {
      idParam: id,
      sNo: data.s_no ? parseInt(data.s_no, 10) : null,
      workDate: data.work_date || null,
      description: data.description || null,
      photoAttachments: Array.isArray(data.photo_attachments) ? data.photo_attachments : [],
      fileAttachments: Array.isArray(data.file_attachments) ? data.file_attachments : [],
      updatedAt: new Date().toISOString()
    }
    
    const [job] = await bq.createQueryJob({ query, params })
    await job.getQueryResults()
    res.json({ success: true })
  } catch (err) {
    console.error('Error updating Certasite record:', err)
    res.status(500).json({ error: 'Failed to update Certasite record', details: err.message })
  }
})

// Delete Certasite record
app.delete('/api/certasite/:id', async (req, res) => {
  try {
    const { id } = req.params
    const [project, dataset, table] = CERTASITE_TABLE.split('.')
    const query = `DELETE FROM \`${project}.${dataset}.${table}\` WHERE id = '${id}'`
    const [job] = await bq.createQueryJob({ query })
    await job.getQueryResults()
    console.log(`Deleted Certasite record: ${id}`)
    res.json({ success: true })
  } catch (err) {
    console.error('Error deleting Certasite record:', err)
    res.status(500).json({ error: 'Failed to delete Certasite record', details: err.message })
  }
})

// Health endpoint used by Cloud Run or load balancers
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok' })
})


app.listen(PORT, () => {
  console.log(`Action Tracker API listening on http://localhost:${PORT}`)
  console.log(`Using table: ${TABLE_FULL}`)
  if (credsPath) {
    // Do not print the full path or contents of the credentials file to avoid exposing
    // sensitive information in logs. Only indicate that the env var is set.
    console.log('GOOGLE_APPLICATION_CREDENTIALS is set (key file detected)')
  } else if (process.env.K_SERVICE) {
    console.log('No GOOGLE_APPLICATION_CREDENTIALS found. Running on Cloud Run (K_SERVICE detected) and using ADC via the Cloud Run service account.')
  } else {
    console.log('No GOOGLE_APPLICATION_CREDENTIALS found. Using Application Default Credentials (ADC).')
  }
})

// Log which files are present in dist (if any) to help diagnose missing build assets
try {
  const distFiles = fs.existsSync(distPath) ? fs.readdirSync(distPath) : []
  console.log('Dist files:', distFiles.slice(0, 50))
} catch (e) {
  console.error('Error reading dist folder', e && e.stack ? e.stack : e)
}

// Global process-level handlers to capture crashes and promise rejections
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason && reason.stack ? reason.stack : reason)
})

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err && err.stack ? err.stack : err)
 
})

// Serve frontend static files (if built)
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  // Serve favicon explicitly to avoid 500s when file is missing
  app.get('/favicon.ico', (req, res) => {
    try {
      const ico = path.join(distPath, 'favicon.ico')
      if (fs.existsSync(ico)) return res.sendFile(ico)
      return res.status(204).end()
    } catch (err) {
      console.error('Error serving favicon.ico', err && err.stack ? err.stack : err)
      return res.status(204).end()
    }
  })

  app.get('/', (req, res) => {
  res.status(200).send('Action Tracker API is running');
});

  // serve index.html for any non-API routes (SPA)
  // Use '/*' instead of '*' to avoid path-to-regexp errors on some versions
  app.get('/*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    try {
      const index = path.join(distPath, 'index.html')
      if (!fs.existsSync(index)) {
        console.error('index.html missing in dist')
        return res.status(400).send('Frontend not built')
      }
      return res.sendFile(index)
    } catch (err) {
      console.error('Error serving index.html', err && err.stack ? err.stack : err)
      return res.status(500).send('server error')
    }
  })
}

// Global error handler to catch unexpected errors and log them
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err && err.stack ? err.stack : err)
  try { res.status(500).json({ error: 'internal server error' }) } catch (e) { /* ignore */ }
})
