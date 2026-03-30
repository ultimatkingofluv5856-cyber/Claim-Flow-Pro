#!/bin/bash
# Script to apply database schema to new Supabase instance using SQL API

# New Supabase credentials
PROJECT_URL="https://jluzssnjbwykkhomxomy.supabase.co"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsdXpzc25qYnd5a2tob214b215Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQwNzk1OCwiZXhwIjoyMDg4OTYzOTU4fQ.qGfvDh5vGqV7H1EF2mKzQxWpL8YjN9PqRsTzB3zC1mE"

# Read the SQL file
SQL_FILE="supabase/migrations/complete_schema.sql"

if [ ! -f "$SQL_FILE" ]; then
    echo "Error: $SQL_FILE not found"
    exit 1
fi

# Execute the SQL
echo "Applying schema to new Supabase instance..."
echo "URL: $PROJECT_URL"

curl -X POST \
    "$PROJECT_URL/rest/v1/rpc/exec_sql" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d @<(jq -Rs --arg sql "$(cat $SQL_FILE)" '{query: $sql}' > /dev/null; cat $SQL_FILE | jq -Rs '{sql: .}')

echo ""
echo "Schema application complete!"
echo ""
echo "Next steps:"
echo "1. Verify the schema in the Supabase Dashboard"
echo "2. Run 'npm install' to ensure dependencies are installed"
echo "3. Run 'npm run dev' to start the application"
