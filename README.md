# Action Tracker Pro

Simple React app to display action items from `gen-lang-client-0815432790.oberoiventures.actionitemstable`.

Getting started

1. Install deps: npm install
2. Run: npm run dev

Notes
- The data service will attempt to fetch from the env var `VITE_API_URL`. If not set or the request fails, it will use local mock data.
- The UI provides tabs for owners (Florence, Dan, Kams, Sunny) and an **Admin** tab. Click an owner tab to see only that owner's records; click **Admin** to view all data and use filters (Owner, Business Type, Status, Deadlines, Business).

- The table displays columns: ACTIONS, CREATE DATE, BUSINESS TYPE, BUSINESS, PROCESS, SUB-TYPE, DELIVERABLE, OWNER, DEADLINE, MIN, PRIORITY, STATUS.

To point to a real API endpoint, set VITE_API_URL when running the dev server:

Windows PowerShell example:

  $env:VITE_API_URL = "https://your-api.example.com/action_items"; npm run dev

  Deploying to Google Cloud Run 🚀

  Prerequisites:
  - Install and initialize the Google Cloud SDK: https://cloud.google.com/sdk/docs
  - Enable Cloud Run & Container Registry / Artifact Registry APIs.
  - Ensure you have a service account with BigQuery access for the Cloud Run service (preferred). Avoid embedding service account JSON in the repository.

  How to build and deploy (using Artifact Registry or Container Registry):

  1) Build the container image locally:

    docker build -t gcr.io/PROJECT-ID/actionitems:latest .

  2) Push the image to Container Registry (replace PROJECT-ID):

    docker push gcr.io/PROJECT-ID/actionitems:latest

  3) Deploy to Cloud Run:

    gcloud run deploy actionitems \
      --image gcr.io/PROJECT-ID/actionitems:latest \
      --region us-central1 \
      --platform managed \
      --allow-unauthenticated \
      --set-env-vars BQ_TABLE="gen-lang-client-0815432790.oberoiventures.actionitemstable"

  Troubleshooting on Cloud Run:
  - Check health: curl -i https://YOUR-SERVICE-URL/healthz
  - Check API: curl -i https://YOUR-SERVICE-URL/api/action-items
  - If you see 401/"unauthorized" in API responses, ensure your Cloud Run service account has BigQuery roles: jobUser and dataViewer (dataEditor if you use updates/deletes).
  - If you see 503 Service Unavailable, check revision readiness and logs:
    gcloud run revisions list --service actionitems --region europe-west1 --format="table(NAME, READY, STATUS, TRAFFIC_PERCENTAGE)"
    gcloud run services logs read actionitems --region europe-west1 --limit 200
  - Favicon route is handled explicitly; if favicon is missing, server returns 204 to avoid 500.

  Notes on credentials:
  - Preferred: grant the Cloud Run service a service account with BigQuery Data Viewer / Data Editor permissions. Use `--service-account` in the deploy command to run as that service account.
  - If you must use a service account key file, store it in Secret Manager and reference it as an environment variable or mount it at runtime. Do NOT commit the key into your repo.
  - Behavior in this project: if `GOOGLE_APPLICATION_CREDENTIALS` is set (pointing to a JSON key file), the server will use that key (useful for local development). If it is NOT set, the server will rely on Application Default Credentials (ADC) — this is how Cloud Run should be configured: attach a service account with the required BigQuery permissions and don't set a JSON key in the environment.
  - Tip for local development: instead of a JSON key file you can run `gcloud auth application-default login` which will configure ADC for your user credentials and allow the server to authenticate without setting `GOOGLE_APPLICATION_CREDENTIALS`.

  Local prod test:
  - Run `npm run build` then `node server/index.js` and open http://localhost:8080 (set PORT env var if needed).

