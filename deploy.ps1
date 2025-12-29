# Cloud Run Deployment Script for Action Tracker Pro
# This script builds and deploys the application to Google Cloud Run

# Configuration
$PROJECT_ID = "gen-lang-client-0815432790"
$SERVICE_NAME = "actionitems"
$REGION = "europe-west1"
$SERVICE_ACCOUNT = "oberoiventuresactioitems@gen-lang-client-0815432790.iam.gserviceaccount.com"

Write-Host "🚀 Starting Cloud Run deployment..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Set the active project
Write-Host "📋 Setting active project to $PROJECT_ID..." -ForegroundColor Yellow
gcloud config set project $PROJECT_ID
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to set project. Make sure you're authenticated with 'gcloud auth login'" -ForegroundColor Red
    exit 1
}

# Step 2: Enable required APIs (if not already enabled)
Write-Host "🔧 Enabling required Google Cloud APIs..." -ForegroundColor Yellow
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com
Write-Host ""

# Step 3: Build and deploy using Cloud Build
Write-Host "🏗️  Building and deploying with Cloud Build..." -ForegroundColor Yellow
Write-Host "   This will:" -ForegroundColor Gray
Write-Host "   - Build the React frontend" -ForegroundColor Gray
Write-Host "   - Create a Docker container image" -ForegroundColor Gray
Write-Host "   - Push to Google Container Registry" -ForegroundColor Gray
Write-Host "   - Deploy to Cloud Run" -ForegroundColor Gray
Write-Host ""

gcloud builds submit --config=cloudbuild.yaml .

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📍 Getting service URL..." -ForegroundColor Yellow
    $SERVICE_URL = gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)"
    Write-Host ""
    Write-Host "🌐 Your application is live at:" -ForegroundColor Cyan
    Write-Host "   $SERVICE_URL" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 Tips:" -ForegroundColor Yellow
    Write-Host "   - View logs: gcloud run logs read $SERVICE_NAME --region=$REGION" -ForegroundColor Gray
    Write-Host "   - Update service: Re-run this script" -ForegroundColor Gray
    Write-Host "   - Check status: gcloud run services describe $SERVICE_NAME --region=$REGION" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "❌ Deployment failed. Check the error messages above." -ForegroundColor Red
    Write-Host "   Common issues:" -ForegroundColor Yellow
    Write-Host "   - Not authenticated: Run 'gcloud auth login'" -ForegroundColor Gray
    Write-Host "   - Missing permissions: Ensure you have Editor/Owner role" -ForegroundColor Gray
    Write-Host "   - Build errors: Check Dockerfile and build logs" -ForegroundColor Gray
    exit 1
}
