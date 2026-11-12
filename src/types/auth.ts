/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserRole } from './school.ts';

export type AccountStatus = 'ACTIVE' | 'INACTIVE';

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  schoolId: string;
  status: AccountStatus;
  requiresPasswordChange?: boolean;
  isTemporaryPassword?: boolean;
  tempPasswordPlain?: string; // Only displayed once to Super Admin upon creation
  isTestAccount?: boolean;
  isOwner?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface UserInvitation {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  schoolId: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED';
  inviteToken: string;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
}

export interface SecurityAuditEntry {
  id: string;
  actingUid: string;
  actingEmail: string;
  action: string;
  targetUid?: string;
  targetEmail?: string;
  role?: string;
  timestamp: string;
  details?: string;
  status: 'SUCCESS' | 'FAILED' | 'WARNING';
  ipAddress?: string;
}

export interface SystemSecuritySettings {
  softwareName: string;
  ownerEmail: string;
  ownerUid?: string;
  allowPublicRegistrations: boolean;
  sessionTimeoutMinutes: number;
  enforceTemporaryPasswordChange: boolean;
  maxFailedLoginsBeforeLock: number;
  updatedAt: string;
  updatedBy: string;
}

export interface PasswordResetRequest {
  id: string;
  uid?: string;
  email: string;
  userName: string;
  userRole: UserRole;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  temporaryPassword?: string;
  requestedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  rejectionReason?: string;
}

export interface AuthSession {
  token: string;
  uid: string;
  email: string;
  role: UserRole;
  createdAt: string;
  expiresAt: string;
}


