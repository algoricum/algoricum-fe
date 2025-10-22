-- Update google_form_sheets table to reference integration_connections instead of google_form_connections

-- First, drop the existing foreign key constraint
ALTER TABLE "public"."google_form_sheets" 
DROP CONSTRAINT IF EXISTS "fk_google_form_sheets_connection";

-- Add new foreign key constraint pointing to integration_connections
ALTER TABLE "public"."google_form_sheets" 
ADD CONSTRAINT "fk_google_form_sheets_connection" 
FOREIGN KEY (connection_id) REFERENCES integration_connections(id) ON DELETE CASCADE;