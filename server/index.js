import express from 'express'
import fs from 'fs'
import cors from 'cors'
import { BigQuery } from '@google-cloud/bigquery'
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
