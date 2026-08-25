import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions, ROUTE_PERMISSION_MAP } from '../../hooks/usePermissions';
import { useAuthStore } from '../../store/useAuthStore';
import { AccessDeniedView } from '../common/AccessDeniedView';

interface PermissionRouteGuardProps {
  permission?: string;
  moduleTitle?: string;
  routePath?: string;
  children: React.ReactNode;
}

export const PermissionRouteGuard: React.FC<PermissionRouteGuardProps> = ({
  permission,
  moduleTitle,
  routePath,
  children,
}) => {
  const { token, user } = useAuthStore();
  const { hasPermission, isWildcard } = usePermissions();
  const location = useLocation();

  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isWildcard) {
    return <>{children}</>;
  }

  // Derive required permission code and title
  let requiredCode = permission;
  let title = moduleTitle;

  if (routePath && (!requiredCode || !title)) {
    const match = ROUTE_PERMISSION_MAP[routePath];
    if (match) {
      requiredCode = requiredCode || match.code;
      title = title || match.title;
    }
  }

  if (requiredCode && !hasPermission(requiredCode)) {
    return <AccessDeniedView permissionCode={requiredCode} moduleTitle={title} />;
  }

  return <>{children}</>;
};

export default PermissionRouteGuard;
