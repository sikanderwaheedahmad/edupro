/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserRole } from '../types/school.ts';
import { AppTab } from '../components/Header.tsx';

export const OWNER_EMAIL = 'ahmadwaheedahmad57@gmail.com';

/**
 * Exact permission mapping according to EDU.pro RBAC specifications.
 */
export const ROLE_PERMISSIONS: Record<UserRole, AppTab[]> = {
  'Super Admin': [
    'welcome',
    'admission',
    'class_sections',
    'promotions',
    'student_history',
    'fees',
    'students',
    'staff',
    'hr_letters',
    'student_certs',
    'forms',
    'exports',
    'settings',
    'user_management',
    'audit_logs',
    'multi_schools',
  ],
  'Principal': [
    'welcome',
    'admission',
    'class_sections',
    'promotions',
    'student_history',
    'fees',
    'students',
    'staff',
    'hr_letters',
    'student_certs',
    'forms',
    'exports',
    'settings',
    'user_management',
  ],
  'HR': [
    'fees',
    'staff',
    'hr_letters',
    'student_certs',
  ],
  'Clerk': [
    'admission',
    'fees',
    'student_certs',
    'promotions',
    'class_sections',
  ],
  'Accountant': [
    'fees',
    'students',
    'student_certs',
  ],
  'Teacher': [],
};

/**
 * Check whether a given role is allowed to access an application tab.
 */
export function hasTabAccess(role: UserRole, tab: AppTab): boolean {
  const allowed = ROLE_PERMISSIONS[role] || [];
  return allowed.includes(tab);
}

/**
 * School Settings access: Principal edits their school, Super Admin can edit any school.
 */
export function canEditSchoolSettings(role: UserRole): boolean {
  return role === 'Principal' || role === 'Super Admin';
}

/**
 * Check if the user has access to User Management.
 * Super Admin manages all schools; Principal manages their own school's staff accounts.
 */
export function canManageUsers(role: UserRole): boolean {
  return role === 'Super Admin' || role === 'Principal';
}

/**
 * Default landing tab when logging into the system.
 */
export function getDefaultTabForRole(role: UserRole): AppTab {
  switch (role) {
    case 'Super Admin':
    case 'Principal':
      return 'welcome';
    case 'HR':
      return 'staff';
    case 'Clerk':
      return 'admission';
    case 'Accountant':
      return 'fees';
    case 'Teacher':
    default:
      return 'welcome';
  }
}
