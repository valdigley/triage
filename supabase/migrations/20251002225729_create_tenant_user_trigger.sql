/*
  # Create trigger to automatically create tenant_user
  
  Cria um trigger que automaticamente cria o registro tenant_user
  quando um novo tenant é criado.
*/

-- Create function to auto-create tenant_user
CREATE OR REPLACE FUNCTION create_tenant_user_for_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert tenant_user for the owner
  INSERT INTO triagem_tenant_users (tenant_id, user_id, role)
  VALUES (NEW.id, NEW.owner_user_id, 'owner');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_tenant_created ON triagem_tenants;

-- Create trigger
CREATE TRIGGER on_tenant_created
  AFTER INSERT ON triagem_tenants
  FOR EACH ROW
  EXECUTE FUNCTION create_tenant_user_for_owner();