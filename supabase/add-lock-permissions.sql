-- SEED: Create separate permissions for 'قفل' (independent of 'مسح')
-- Run this in Supabase SQL editor to initialize the 'قفل' permissions
-- by copying everyone who currently has 'مسح' permission.

INSERT INTO command_permissions (command_name, type, value)
SELECT 'قفل', type, value
FROM command_permissions
WHERE command_name = 'مسح'
ON CONFLICT (command_name, type, value) DO NOTHING;

-- To confirm:
-- SELECT * FROM command_permissions WHERE command_name = 'قفل';
