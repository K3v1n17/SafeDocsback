export enum UserRole {
  OWNER = 'owner',        // Propietario de documentos
  ADMIN = 'admin',        // Administrador del sistema
  AUDITOR = 'auditor',    // Solo puede ver logs y auditorías
  RECIPIENT = 'recipient' // Solo puede ver documentos compartidos
}

export interface UserWithRole {
  id: string;
  email: string;
  role: UserRole;
  permissions: string[];
  created_at: string;
  updated_at: string;
}

export const RolePermissions = {
  [UserRole.OWNER]: [
    'document:create',
    'document:read:own',
    'document:update:own',
    'document:delete:own',
    'document:share',
    'document:revoke'
  ],
  [UserRole.ADMIN]: [
    'document:read:all',
    'user:create',
    'user:read:all',
    'user:update:all',
    'user:delete',
    'system:stats',
    'audit:read'
  ],
  [UserRole.AUDITOR]: [
    'document:read:metadata',
    'audit:read',
    'system:stats'
  ],
  [UserRole.RECIPIENT]: [
    'document:read:shared'
  ]
};
