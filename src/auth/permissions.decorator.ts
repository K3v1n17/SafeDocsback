import { SetMetadata } from '@nestjs/common';

export const Permissions = (...permissions: string[]) => SetMetadata('permissions', permissions);

// Decoradores específicos para facilitar el uso
export const RequireOwnerPermission = () => Permissions('document:read:own', 'document:update:own');
export const RequireAdminPermission = () => Permissions('user:read:all');
export const RequireAuditorPermission = () => Permissions('audit:read');
export const RequireSharePermission = () => Permissions('document:share');
