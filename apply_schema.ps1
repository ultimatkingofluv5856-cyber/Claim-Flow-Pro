# PowerShell script to help apply schema to new Supabase instance

$newProjectUrl = "https://jluzssnjbwykkhomxomy.supabase.co"
$projectId = "jluzssnjbwykkhomxomy"
$publishableKey = "sb_publishable_4asrkSm-8ZTQpqApszfynA_WoHOPQsB"

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "   Supabase Migration Setup for ClaimFlow Pro" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "UPDATED: New Supabase Credentials" -ForegroundColor Green
Write-Host "  Project ID: $projectId"
Write-Host "  URL: $newProjectUrl"
Write-Host ""

Write-Host "IMPORTANT: Manual Steps Required" -ForegroundColor Yellow
Write-Host ""
Write-Host "To apply the database schema, follow these steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Open your browser and go to: https://app.supabase.com"
Write-Host "2. Login with your Supabase account"
Write-Host "3. Select the project: jluzssnjbwykkhomxomy"
Write-Host "4. Navigate to the 'SQL Editor' section"
Write-Host "5. Click 'New query'"
Write-Host "6. Copy all the SQL from: supabase\migrations\complete_schema.sql"
Write-Host "7. Paste the SQL into the editor"
Write-Host "8. Click 'Run' to execute the schema"
Write-Host ""

Write-Host "Files Updated:" -ForegroundColor Green
Write-Host "  - .env"
Write-Host "  - supabase\config.toml"
Write-Host "  - supabase\migrations\complete_schema.sql (created)"
Write-Host ""

Write-Host "After applying the schema:" -ForegroundColor Cyan
Write-Host "  1. Run: npm install"
Write-Host "  2. Run: npm run dev"
Write-Host ""

Write-Host "Default Admin Account:" -ForegroundColor Cyan
Write-Host "  Email: admin@example.com"
Write-Host "  Password: admin123"
Write-Host ""

Write-Host "See SUPABASE_MIGRATION_GUIDE.md for more details." -ForegroundColor Yellow
