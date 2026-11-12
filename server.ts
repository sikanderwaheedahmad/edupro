/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'node:fs';
import { fileURLToPath } from 'url';
import { syncUploadedFileToFirestore } from './src/server/firestoreSync.ts';
import {
  getSchoolProfile,
  updateSchoolProfile,
  getAllSchools,
  getSchoolRecord,
  createSchool,
  updateSchool,
  toggleSchoolStatus,
  getAllStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  restoreStudent,
  getNextAdmissionNumber,
  getNextVoucherNumber,
  createAdmission,
  getAllVouchers,
  getVoucherById,
  updateVoucherStatus,
  getVoucherAuditLog,
  deleteVoucher,
  restoreVoucher,
  getDashboardStats,
  getAllStaff,
  getStaffById,
  createStaff,
  updateStaff,
  deleteStaff,
  restoreStaff,
  getAllStaffLetters,
  createStaffLetter,
  deleteStaffLetter,
  restoreStaffLetter,
  getAllCertificates,
  createCertificate,
  deleteCertificate,
  restoreCertificate,
  getAllExamResults,
  deleteExamResult,
  restoreExamResult,
  getRecycleBinItems,
  restoreRecycleBinItem,
  permanentlyDeleteRecycleBinItem,
  getAllClassSections,
  saveClassSection,
  bulkTransferSection,
  getStudentHistory,
  addStudentHistory,
  promoteStudentsBulk,
  transferStudent,
  transferStudentsBulk,
  getClass10Students,
  processClass10PassOut,
  getPassOutArchive,
  updateStudentStatus,
  searchStudentHistory,
  getAllClassFeeConfigs,
  saveClassFeeConfig,
  generateClassVouchersBulk,
  createIndividualVoucher,
  recordVoucherPayment,
  getAllAppUsers,
  getAppUserByUid,
  createAppUser,
  updateAppUser,
  deleteAppUser,
  resetAppUserPassword,
  changeUserPassword,
  createUserInvitation,
  getAllUserInvitations,
  authenticateUser,
  getSecurityAuditLogs,
  getSystemSecuritySettings,
  updateSystemSecuritySettings,
  adminSetUserPassword,
  changeUserEmail,
  changeUserPasswordWithCurrent,
  createPasswordResetRequest,
  getAllPasswordResetRequests,
  resolvePasswordResetRequest,
  recoverSuperAdminPassword,
  createSession,
  validateSession,
  invalidateSession,
  invalidateAllUserSessions,
  logSecurityAudit,
  generateSecureTemporaryPassword,
} from './src/server/db.ts';
import { AppUser } from './src/types/auth.ts';
import { OWNER_EMAIL } from './src/utils/permissions.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  // Body parser with support for base64 images
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Security & Cache-Control: Prevent browser caching of authenticated ERP records
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // CORS & Iframe Support (Permanently enables AI Studio Preview sandboxing & cross-origin iframe requests)
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token, x-school-id, x-user-role, x-user-school-id, x-admin-name');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Static route for uploaded tenant assets and documents
  const uploadsDir = path.join(__dirname, 'data', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir, {
    maxAge: '30d',
    immutable: true,
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
  }));

  // Session Authentication Middleware
  const requireAuth = (req: Request, res: Response, next: any) => {
    const authHeader = (req.headers['x-session-token'] as string) || (req.headers['authorization'] as string);
    let token = authHeader;
    if (token && token.startsWith('Bearer ')) {
      token = token.slice(7).trim();
    }
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }
    const validated = validateSession(token);
    if (!validated) {
      return res.status(401).json({ error: 'Unauthorized: Session invalid or expired. Please log in.' });
    }
    (req as any).user = validated.user;
    next();
  };

  // Super Admin Authorization Middleware: Strictly restricted to Software Owner / Super Admin
  const requireSuperAdmin = (req: Request, res: Response, next: any) => {
    const authHeader = (req.headers['x-session-token'] as string) || (req.headers['authorization'] as string);
    let token = authHeader;
    if (token && token.startsWith('Bearer ')) {
      token = token.slice(7).trim();
    }
    let user: AppUser | null = (req as any).user || null;
    if (!user && token) {
      const validated = validateSession(token);
      if (validated) user = validated.user;
    }
    const role = user?.role || (req.headers['x-user-role'] as string);
    const email = user?.email || (req.headers['x-user-email'] as string) || (req.body?.actingEmail as string);

    const isSuperAdmin =
      (user && (user.isOwner || user.email.toLowerCase() === OWNER_EMAIL.toLowerCase())) ||
      (role === 'Super Admin' && (email?.toLowerCase() === OWNER_EMAIL.toLowerCase() || !email));

    if (!isSuperAdmin && role !== 'Super Admin') {
      logSecurityAudit({
        actingUid: user?.uid || (req.headers['x-user-id'] as string) || 'unauthorized',
        actingEmail: email || 'unknown',
        action: 'PASSWORD_MANAGEMENT_DENIED',
        details: 'Attempted to perform password management action without Super Admin authority',
        status: 'FAILED',
        ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '',
      });
      return res.status(403).json({
        error: 'Forbidden: Only the Software Owner / Super Admin (ahmadwaheedahmad57@gmail.com) has authority to create, assign, reset, or change user passwords.',
      });
    }

    (req as any).user = user || {
      email: OWNER_EMAIL,
      role: 'Super Admin',
      uid: 'usr_owner_001',
      name: 'Ahmad Waheed Ahmad (Software Owner)',
    };
    next();
  };

  // School Context Resolution Helper:
  // Super Admin can switch between schools via x-school-id header or query.
  // Other roles (Principal, Teacher, etc.) are strictly isolated to their assigned schoolId.
  const getEffectiveSchoolId = (req: Request): string => {
    const userRole = (req as any).user?.role || (req.headers['x-user-role'] as string);
    const requestedSchool = (req.headers['x-school-id'] as string) || (req.query.schoolId as string);
    const userSchool = (req as any).user?.schoolId || (req.headers['x-user-school-id'] as string);

    // If non-Super Admin role is active, strictly lock to assigned schoolId
    if (userRole && userRole !== 'Super Admin' && userSchool) {
      return userSchool;
    }
    // Super Admin or client requests default to requestedSchool, then userSchool, then primary
    return requestedSchool || userSchool || 'school_primary';
  };

  // --- API Routes ---

  // Auth: Login
  app.post('/api/auth/login', (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required.' });
      }
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
      const userAgent = (req.headers['user-agent'] as string) || '';
      const result = authenticateUser(email, password, clientIp);
      if (!result.success || !result.user) {
        return res.status(401).json(result);
      }
      const session = createSession(result.user, clientIp, userAgent);
      res.json({
        success: true,
        user: result.user,
        sessionToken: session.token,
        expiresAt: session.expiresAt,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Authentication error' });
    }
  });

  // Auth: Validate Active Session
  app.get('/api/auth/session', (req: Request, res: Response) => {
    try {
      const authHeader = (req.headers['x-session-token'] as string) || (req.headers['authorization'] as string);
      let token = authHeader;
      if (token && token.startsWith('Bearer ')) {
        token = token.slice(7).trim();
      }
      if (!token) {
        return res.status(401).json({ success: false, error: 'No session token provided.' });
      }
      const validated = validateSession(token);
      if (!validated) {
        return res.status(401).json({ success: false, error: 'Session expired or invalid.' });
      }
      res.json({ success: true, user: validated.user });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Session validation error' });
    }
  });

  // Auth: Logout (Terminate active session)
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    try {
      const authHeader = (req.headers['x-session-token'] as string) || (req.headers['authorization'] as string);
      let token = req.body?.sessionToken || authHeader;
      if (token && token.startsWith('Bearer ')) {
        token = token.slice(7).trim();
      }
      if (token) {
        invalidateSession(token);
      }
      res.json({ success: true, message: 'Logged out successfully.' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Logout error' });
    }
  });


  // Auth: Change Password (First-time temporary password change or Super Admin authority)
  app.post('/api/auth/change-password', (req: Request, res: Response) => {
    try {
      const { uid, newPassword } = req.body;
      if (!uid || !newPassword) {
        return res.status(400).json({ error: 'User ID and new password are required.' });
      }
      const target = getAppUserByUid(uid);
      if (!target) return res.status(404).json({ error: 'User not found.' });

      // If the target user is not marked for first-time password change, caller MUST be Super Admin
      if (!target.requiresPasswordChange) {
        const authHeader = (req.headers['x-session-token'] as string) || (req.headers['authorization'] as string);
        let token = authHeader;
        if (token && token.startsWith('Bearer ')) token = token.slice(7).trim();
        const caller = token ? validateSession(token)?.user : null;
        const callerRole = caller?.role || (req.headers['x-user-role'] as string);
        const callerEmail = caller?.email || (req.headers['x-user-email'] as string);
        const isSuperAdmin = callerRole === 'Super Admin' || callerEmail?.toLowerCase() === OWNER_EMAIL.toLowerCase();

        if (!isSuperAdmin) {
          return res.status(403).json({
            error: 'Forbidden: Only the Software Owner / Super Admin (ahmadwaheedahmad57@gmail.com) has authority to change user passwords.',
          });
        }
      }

      changeUserPassword(uid, newPassword);
      res.json({ success: true, message: 'Password successfully changed.' });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to change password.' });
    }
  });

  // Auth: Forgot Password Request (User submits email)
  app.post('/api/auth/forgot-password', (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, error: 'Email address is required.' });
      }
      const result = createPasswordResetRequest(email);
      if (!result.success) {
        return res.status(404).json(result);
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to submit reset request.' });
    }
  });

  // Auth: Super Admin Owner Direct Recovery (Verified with owner email & phone)
  app.post('/api/auth/owner-recovery', (req: Request, res: Response) => {
    try {
      const { email, phone, newPassword } = req.body;
      if (!email || !phone || !newPassword) {
        return res.status(400).json({ success: false, error: 'Email, registered phone number, and new password are required.' });
      }
      const result = recoverSuperAdminPassword(email, phone, newPassword);
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Owner recovery error.' });
    }
  });

  // Password Reset Requests (Super Admin List)
  app.get('/api/password-reset-requests', requireSuperAdmin, (_req: Request, res: Response) => {
    try {
      const requests = getAllPasswordResetRequests();
      res.json(requests);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch reset requests.' });
    }
  });

  // Password Reset Requests (Super Admin Approve or Reject)
  app.post('/api/password-reset-requests/:id/resolve', requireSuperAdmin, (req: Request, res: Response) => {
    try {
      const { action, actingUid, actingEmail, rejectionReason } = req.body;
      if (!action || !['APPROVE', 'REJECT'].includes(action)) {
        return res.status(400).json({ error: 'Action must be APPROVE or REJECT.' });
      }
      const superAdminUser = (req as any).user;
      const result = resolvePasswordResetRequest(
        req.params.id,
        action,
        superAdminUser?.uid || actingUid || 'usr_owner_001',
        superAdminUser?.email || actingEmail || OWNER_EMAIL,
        rejectionReason
      );
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to resolve reset request.' });
    }
  });

  // User Profile: Change own email (requires current password)
  app.post('/api/users/profile/email', requireAuth, (req: Request, res: Response) => {
    try {
      const { uid, currentPassword, newEmail } = req.body;
      if (!uid || !currentPassword || !newEmail) {
        return res.status(400).json({ error: 'User ID, current password, and new email are required.' });
      }
      const callingUser = (req as any).user;
      if (callingUser.uid !== uid && callingUser.role !== 'Super Admin') {
        return res.status(403).json({ error: 'Forbidden: You cannot change another user’s email address.' });
      }
      const updatedUser = changeUserEmail(uid, currentPassword, newEmail);
      res.json({ success: true, user: updatedUser, message: 'Email address successfully updated.' });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to change email address.' });
    }
  });

  // User Profile: Change own password (requires current password)
  app.post('/api/users/profile/password', requireAuth, (req: Request, res: Response) => {
    try {
      const { uid, currentPassword, newPassword } = req.body;
      if (!uid || !currentPassword || !newPassword) {
        return res.status(400).json({ error: 'User ID, current password, and new password are required.' });
      }
      const callingUser = (req as any).user;
      if (callingUser.uid !== uid && callingUser.role !== 'Super Admin') {
        return res.status(403).json({ error: 'Forbidden: You cannot change another user’s password.' });
      }
      const updatedUser = changeUserPasswordWithCurrent(uid, currentPassword, newPassword);
      res.json({ success: true, user: updatedUser, message: 'Password successfully changed.' });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to update password.' });
    }
  });

  // Super Admin: Set User Password (replace dummy credentials or assign custom password)
  app.post('/api/users/:uid/set-password', requireSuperAdmin, (req: Request, res: Response) => {
    try {
      const { newPassword, isTemporary, actingUid, actingEmail } = req.body;
      if (!newPassword) {
        return res.status(400).json({ error: 'New password is required.' });
      }
      const superAdminUser = (req as any).user;
      const result = adminSetUserPassword(
        req.params.uid,
        newPassword,
        Boolean(isTemporary),
        superAdminUser?.uid || actingUid || 'usr_owner_001',
        superAdminUser?.email || actingEmail || OWNER_EMAIL
      );
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to set password.' });
    }
  });

  // Users: List users (isolated by schoolId if specified)
  app.get('/api/users', (req: Request, res: Response) => {
    try {
      const schoolId = req.query.schoolId as string | undefined;
      const users = getAllAppUsers(schoolId);
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch users.' });
    }
  });

  // Users: Create User (Method A: Manual with Temporary Password)
  app.post('/api/users', (req: Request, res: Response) => {
    try {
      const {
        name,
        email,
        phone,
        role,
        schoolId,
        temporaryPassword,
        requiresPasswordChange,
        isTestAccount,
        actingUid,
        actingEmail,
      } = req.body;

      if (!name || !email || !role) {
        return res.status(400).json({ error: 'Name, email, and role are required.' });
      }

      // Only Super Admin can assign passwords when creating accounts
      const callerRole = (req.headers['x-user-role'] as string) || (req as any).user?.role;
      const callerEmail = (req.headers['x-user-email'] as string) || (req as any).user?.email || actingEmail;
      const isSuperAdmin = callerRole === 'Super Admin' || callerEmail?.toLowerCase() === OWNER_EMAIL.toLowerCase();

      if (temporaryPassword && !isSuperAdmin) {
        return res.status(403).json({
          error: 'Forbidden: Only the Software Owner / Super Admin (ahmadwaheedahmad57@gmail.com) has authority to assign passwords when creating accounts.',
        });
      }

      const result = createAppUser({
        name,
        email,
        phone,
        role,
        schoolId,
        temporaryPassword: isSuperAdmin ? temporaryPassword : generateSecureTemporaryPassword(),
        requiresPasswordChange: requiresPasswordChange !== undefined ? Boolean(requiresPasswordChange) : false,
        isTestAccount: Boolean(isTestAccount),
        actingUid: actingUid || 'usr_owner_001',
        actingEmail: actingEmail || OWNER_EMAIL,
      });
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to create user.' });
    }
  });

  // Users: Send Invitation (Method B)
  app.post('/api/users/invite', (req: Request, res: Response) => {
    try {
      const { email, name, role, actingUid, actingEmail } = req.body;
      if (!email || !role) {
        return res.status(400).json({ error: 'Email and role are required.' });
      }
      const invitation = createUserInvitation({
        email,
        name,
        role,
        actingUid: actingUid || 'usr_owner_001',
        actingEmail: actingEmail || 'ahmadwaheedahmad57@gmail.com',
      });
      res.status(201).json({ success: true, invitation });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to create invitation.' });
    }
  });

  // Users: List Invitations
  app.get('/api/users/invitations', (_req: Request, res: Response) => {
    try {
      const invitations = getAllUserInvitations();
      res.json(invitations);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch invitations.' });
    }
  });

  // Users: Update User Role/Status
  app.put('/api/users/:uid', (req: Request, res: Response) => {
    try {
      const { name, phone, role, status, actingUid, actingEmail } = req.body;
      const updated = updateAppUser(
        req.params.uid,
        { name, phone, role, status },
        actingUid || 'usr_owner_001',
        actingEmail || 'ahmadwaheedahmad57@gmail.com'
      );
      res.json({ success: true, user: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to update user.' });
    }
  });

  // Users: Delete User
  app.delete('/api/users/:uid', (req: Request, res: Response) => {
    try {
      const actingUid = (req.query.actingUid as string) || req.body.actingUid || 'usr_owner_001';
      const actingEmail = (req.query.actingEmail as string) || req.body.actingEmail || 'ahmadwaheedahmad57@gmail.com';
      deleteAppUser(req.params.uid, actingUid, actingEmail);
      res.json({ success: true, message: 'User deleted successfully.' });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to delete user.' });
    }
  });

  // Users: Reset Password (Strictly Super Admin Only)
  app.post('/api/users/:uid/reset-password', requireSuperAdmin, (req: Request, res: Response) => {
    try {
      const { actingUid, actingEmail } = req.body;
      const superAdminUser = (req as any).user;
      const result = resetAppUserPassword(
        req.params.uid,
        superAdminUser?.uid || actingUid || 'usr_owner_001',
        superAdminUser?.email || actingEmail || OWNER_EMAIL
      );
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to reset password.' });
    }
  });

  // Security: Audit Logs
  app.get('/api/audit-logs', (req: Request, res: Response) => {
    try {
      const limit = parseInt((req.query.limit as string) || '100', 10);
      const logs = getSecurityAuditLogs(limit);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch audit logs.' });
    }
  });

  // Security: System Settings
  app.get('/api/security-settings', (_req: Request, res: Response) => {
    try {
      const settings = getSystemSecuritySettings();
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch security settings.' });
    }
  });

  app.patch('/api/security-settings', (req: Request, res: Response) => {
    try {
      const { updates, actingUid, actingEmail } = req.body;
      const updated = updateSystemSecuritySettings(
        updates,
        actingUid || 'usr_owner_001',
        actingEmail || 'ahmadwaheedahmad57@gmail.com'
      );
      res.json({ success: true, settings: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to update security settings.' });
    }
  });

  // --- MULTI-SCHOOL SAAS ROUTES ---
  app.get('/api/schools', (_req: Request, res: Response) => {
    try {
      const schools = getAllSchools();
      res.json(schools);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch schools' });
    }
  });

  app.get('/api/schools/:id', (req: Request, res: Response) => {
    try {
      const school = getSchoolRecord(req.params.id);
      if (!school) return res.status(404).json({ error: 'School not found' });
      res.json(school);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch school' });
    }
  });

  app.post('/api/schools', (req: Request, res: Response) => {
    try {
      const actingRole = (req.headers['x-user-role'] as string) || (req as any).user?.role;
      if (actingRole && actingRole !== 'Super Admin') {
        return res.status(403).json({ error: 'Access denied: Only Super Admin can register new schools in Multi-School SaaS.' });
      }
      const result = createSchool(req.body);
      res.status(201).json({ success: true, ...result });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to create school' });
    }
  });

  app.put('/api/schools/:id', (req: Request, res: Response) => {
    try {
      const updated = updateSchool(req.params.id, req.body);
      res.json({ success: true, school: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to update school' });
    }
  });

  app.patch('/api/schools/:id/toggle-status', (req: Request, res: Response) => {
    try {
      const updated = toggleSchoolStatus(req.params.id);
      res.json({ success: true, school: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to toggle school status' });
    }
  });

  // Fast Upload Endpoint for all schools (logos, photos, documents, attachments)
  app.post('/api/upload', (req: Request, res: Response) => {
    try {
      const {
        dataBase64,
        fileName,
        category = 'general',
        schoolId: requestedSchoolId,
        contentType = 'image/jpeg',
      } = req.body;

      if (!dataBase64) {
        return res.status(400).json({ error: 'Missing file payload (dataBase64 is required).' });
      }

      const effectiveSchoolId = getEffectiveSchoolId(req);
      const schoolId = requestedSchoolId && (req as any).user?.role === 'Super Admin'
        ? requestedSchoolId
        : (effectiveSchoolId || 'school_primary');

      // Sanitize category & filename
      const safeCategory = (category || 'general').replace(/[^a-zA-Z0-9_\-]/g, '');
      const rawName = (fileName || `file_${Date.now()}`).replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const timestamp = Date.now();
      const finalFileName = `${timestamp}_${rawName}`;

      const targetDir = path.join(__dirname, 'data', 'uploads', 'schools', schoolId, safeCategory);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const targetPath = path.join(targetDir, finalFileName);

      // Strip base64 prefix if present (e.g. data:image/jpeg;base64,...)
      const base64Data = dataBase64.includes(',') ? dataBase64.split(',')[1] : dataBase64;
      const buffer = Buffer.from(base64Data, 'base64');

      fs.writeFileSync(targetPath, buffer);

      const publicUrl = `/uploads/schools/${schoolId}/${safeCategory}/${finalFileName}`;
      const fileSize = buffer.length;

      // Save upload record in Firestore asynchronously for cross-session cloud persistence
      syncUploadedFileToFirestore(schoolId, {
        id: `file_${timestamp}`,
        fileName: rawName,
        category: safeCategory,
        url: publicUrl,
        size: fileSize,
        mimeType: contentType,
        schoolId,
        createdAt: new Date().toISOString(),
      }).catch((fsErr) => console.warn('[FastUpload] Firestore sync notice:', fsErr));

      return res.status(201).json({
        success: true,
        url: publicUrl,
        size: fileSize,
        mimeType: contentType,
        fileName: finalFileName,
        schoolId,
        timestamp,
      });
    } catch (err: any) {
      console.error('[FastUpload] Error processing upload:', err);
      return res.status(500).json({ error: err.message || 'File upload failed on server.' });
    }
  });

  // School profile
  app.get('/api/school-info', (req: Request, res: Response) => {
    try {
      const schoolId = getEffectiveSchoolId(req);
      const profile = getSchoolProfile(schoolId);
      res.json(profile);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch school profile' });
    }
  });

  // Update School profile (Principal and Super Admin operational control)
  const handleSchoolInfoUpdate = (req: Request, res: Response) => {
    try {
      const callerRole = (req.headers['x-user-role'] as string) || req.body.actingRole;
      if (callerRole && callerRole !== 'Principal' && callerRole !== 'Super Admin') {
        return res.status(403).json({
          error:
            'Access Denied: School operational settings (School Name, Urdu Name, Principal, Logo, Stamp, Board) are exclusively managed by Principal or Super Admin.',
        });
      }
      const schoolId = getEffectiveSchoolId(req);
      const updated = updateSchoolProfile(req.body, schoolId);
      res.json({ success: true, profile: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to update school profile' });
    }
  };

  app.patch('/api/school-info', handleSchoolInfoUpdate);
  app.put('/api/school-info', handleSchoolInfoUpdate);

  // Staff endpoints
  app.get('/api/staff', (req: Request, res: Response) => {
    try {
      const schoolId = getEffectiveSchoolId(req);
      const staff = getAllStaff(schoolId);
      res.json(staff);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch staff' });
    }
  });

  app.post('/api/staff', (req: Request, res: Response) => {
    try {
      const schoolId = getEffectiveSchoolId(req);
      const created = createStaff(req.body, schoolId);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to create staff' });
    }
  });

  app.put('/api/staff/:id', (req: Request, res: Response) => {
    try {
      const updated = updateStaff(req.params.id, req.body);
      res.json({ success: true, staff: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to update staff' });
    }
  });

  app.delete('/api/staff/:id', (req: Request, res: Response) => {
    try {
      const isPermanent = req.query.permanent === 'true';
      const adminName = (req.headers['x-admin-name'] as string) || req.body?.adminName || 'Dr. Saeed Ahmad (Principal)';
      const success = deleteStaff(req.params.id, adminName, isPermanent);
      if (!success) {
        return res.status(404).json({ error: 'Staff member not found' });
      }
      res.json({
        success: true,
        message: isPermanent ? 'Staff record permanently removed' : 'Staff moved to Recycle Bin',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete staff' });
    }
  });

  app.patch('/api/staff/:id/restore', (req: Request, res: Response) => {
    try {
      const success = restoreStaff(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Staff member not found' });
      }
      res.json({ success: true, message: 'Staff restored successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to restore staff' });
    }
  });

  // HR Staff Documents (10 Official School ERP Document Types)
  app.get('/api/staff-letters', (req: Request, res: Response) => {
    try {
      const letterType = req.query.letterType as string | undefined;
      const schoolId = getEffectiveSchoolId(req);
      const letters = getAllStaffLetters(letterType, schoolId);
      res.json(letters);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch staff letters' });
    }
  });

  app.post('/api/staff-letters', (req: Request, res: Response) => {
    try {
      const schoolId = getEffectiveSchoolId(req);
      const created = createStaffLetter(req.body, schoolId);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to issue staff letter' });
    }
  });

  app.delete('/api/staff-letters/:id', (req: Request, res: Response) => {
    try {
      const isPermanent = req.query.permanent === 'true';
      const adminName = (req.headers['x-admin-name'] as string) || req.body?.adminName || 'Dr. Saeed Ahmad';
      const success = deleteStaffLetter(req.params.id, adminName, isPermanent);
      if (!success) return res.status(404).json({ error: 'Staff letter not found' });
      res.json({
        success: true,
        message: isPermanent ? 'Staff letter permanently deleted' : 'Staff letter moved to Recycle Bin',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete staff letter' });
    }
  });

  app.patch('/api/staff-letters/:id/restore', (req: Request, res: Response) => {
    try {
      const success = restoreStaffLetter(req.params.id);
      if (!success) return res.status(404).json({ error: 'Staff letter not found' });
      res.json({ success: true, message: 'Staff letter restored successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to restore staff letter' });
    }
  });

  // Certificates endpoints
  app.get('/api/certificates', (req: Request, res: Response) => {
    try {
      const schoolId = getEffectiveSchoolId(req);
      const certs = getAllCertificates(schoolId);
      res.json(certs);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch certificates' });
    }
  });

  app.post('/api/certificates', (req: Request, res: Response) => {
    try {
      const schoolId = getEffectiveSchoolId(req);
      const created = createCertificate(req.body, schoolId);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to issue certificate' });
    }
  });

  // Exam Results endpoints
  app.get('/api/exam-results', (req: Request, res: Response) => {
    try {
      const schoolId = getEffectiveSchoolId(req);
      const results = getAllExamResults(schoolId);
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch exam results' });
    }
  });

  // Dashboard metrics
  app.get('/api/dashboard-stats', (req: Request, res: Response) => {
    try {
      const schoolId = getEffectiveSchoolId(req);
      const stats = getDashboardStats(schoolId);
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch dashboard stats' });
    }
  });

  // Next suggested numbers
  app.get('/api/next-numbers', (req: Request, res: Response) => {
    try {
      const schoolId = getEffectiveSchoolId(req);
      res.json({
        nextAdmissionNumber: getNextAdmissionNumber(schoolId),
        nextVoucherNumber: getNextVoucherNumber(schoolId),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to get next numbers' });
    }
  });

  // Students list with optional filters
  app.get('/api/students', (req: Request, res: Response) => {
    try {
      const schoolId = getEffectiveSchoolId(req);
      const students = getAllStudents({
        schoolId,
        includePassOut: req.query.includePassOut === 'true',
        session: (req.query.session as string) || undefined,
        studentClass: (req.query.studentClass as string) || undefined,
        section: (req.query.section as string) || undefined,
        status: (req.query.status as string) || undefined,
      });
      res.json(students);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch students' });
    }
  });

  // Reusable search endpoint alias for Global Student Search selector (must be before :id)
  app.get('/api/students/search', (req: Request, res: Response) => {
    try {
      const query = (req.query.q as string) || '';
      const results = searchStudentHistory(query);
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Student search failed' });
    }
  });

  // Single student by ID
  app.get('/api/students/:id', (req: Request, res: Response) => {
    try {
      const student = getStudentById(req.params.id);
      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }
      res.json(student);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch student' });
    }
  });

  // Create new admission + auto-generate fee voucher
  app.post('/api/admissions', (req: Request, res: Response) => {
    try {
      const {
        fullName,
        fatherName,
        motherName,
        photoUrl,
        dob,
        gender,
        studentClass,
        section,
        rollNumber,
        previousSchool,
        previousClass,
        previousRollNumber,
        fatherCnic,
        motherCnic,
        mobileNumber,
        motherMobileNumber,
        emergencyContactPerson,
        emergencyContactNumber,
        relationship,
        admissionDate,
        admissionNumber,
        address,
        session,
        admissionFee,
      } = req.body;

      // Validation
      if (!fullName || !fullName.trim()) {
        return res.status(400).json({ error: 'Student full name is required' });
      }
      if (!fatherName || !fatherName.trim()) {
        return res.status(400).json({ error: "Father's name is required" });
      }
      if (!dob) {
        return res.status(400).json({ error: 'Date of birth is required' });
      }
      if (!gender) {
        return res.status(400).json({ error: 'Gender is required' });
      }
      if (!studentClass) {
        return res.status(400).json({ error: 'Class is required' });
      }
      if (!mobileNumber || !mobileNumber.trim()) {
        return res.status(400).json({ error: 'Parent/guardian mobile number is required' });
      }
      if (!address || !address.trim()) {
        return res.status(400).json({ error: 'Home address is required' });
      }
      if (!session) {
        return res.status(400).json({ error: 'Academic session is required' });
      }
      if (admissionFee === undefined || admissionFee === null || Number(admissionFee) <= 0) {
        return res.status(400).json({
          error: 'Admission fee amount must be entered manually as a positive number by administrator',
        });
      }

      const schoolId = getEffectiveSchoolId(req);
      const result = createAdmission({
        fullName,
        fatherName,
        motherName,
        photoUrl,
        dob,
        gender,
        studentClass,
        section,
        rollNumber,
        previousSchool,
        previousClass,
        previousRollNumber,
        fatherCnic,
        motherCnic,
        mobileNumber,
        motherMobileNumber,
        emergencyContactPerson,
        emergencyContactNumber,
        relationship,
        admissionDate,
        admissionNumber,
        address,
        session,
        admissionFee: Number(admissionFee),
        schoolId,
      });

      res.status(201).json({
        success: true,
        message: 'Student admitted and admission fee voucher generated successfully',
        student: result.student,
        voucher: result.voucher,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to create student admission' });
    }
  });

  // --- MODULE 1: Class and Section Management Routes ---
  app.get('/api/classes-sections', (_req: Request, res: Response) => {
    try {
      const classSections = getAllClassSections();
      res.json(classSections);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch class sections' });
    }
  });

  app.post('/api/classes-sections', (req: Request, res: Response) => {
    try {
      const { className, sections } = req.body;
      if (!className) return res.status(400).json({ error: 'Class name is required' });
      const saved = saveClassSection(className, sections);
      res.json({ success: true, classSection: saved });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to save class sections' });
    }
  });

  app.post('/api/sections/transfer-bulk', (req: Request, res: Response) => {
    try {
      const { studentIds, newSection, reason, adminName } = req.body;
      if (!studentIds || !studentIds.length || !newSection) {
        return res.status(400).json({ error: 'Student IDs and new section are required' });
      }
      const result = bulkTransferSection(studentIds, newSection, reason, adminName);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to transfer section' });
    }
  });

  // --- MODULE 3 & 4: Student Promotion, Class Transfer & Class 10 Pass-Out ---
  app.post('/api/students/promote-bulk', (req: Request, res: Response) => {
    try {
      const { studentIds, fromSession, toSession, toClass, toSection, adminName } = req.body;
      if (!studentIds || !studentIds.length || !fromSession || !toSession || !toClass || !toSection) {
        return res.status(400).json({ error: 'All promotion parameters are required' });
      }
      const result = promoteStudentsBulk({
        studentIds,
        fromSession,
        toSession,
        toClass,
        toSection,
        adminName,
      });
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Promotion failed' });
    }
  });

  app.post('/api/students/transfer', (req: Request, res: Response) => {
    try {
      const { studentId, toClass, toSection, toSession, reason, adminName } = req.body;
      if (!studentId || !toClass || !toSection || !toSession) {
        return res.status(400).json({ error: 'All transfer parameters are required' });
      }
      const updated = transferStudent({
        studentId,
        toClass,
        toSection,
        toSession,
        reason,
        adminName,
      });
      res.json({ success: true, student: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Transfer failed' });
    }
  });

  app.post('/api/students/transfer-bulk', (req: Request, res: Response) => {
    try {
      const { studentIds, toClass, toSection, toSession, reason, adminName } = req.body;
      if (!studentIds || !studentIds.length || !toClass || !toSection || !toSession) {
        return res.status(400).json({ error: 'All bulk transfer parameters are required' });
      }
      const result = transferStudentsBulk({
        studentIds,
        toClass,
        toSection,
        toSession,
        reason,
        adminName,
      });
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Bulk transfer failed' });
    }
  });

  app.get('/api/students-class10', (req: Request, res: Response) => {
    try {
      const session = (req.query.session as string) || '';
      const includePassedOut = req.query.includePassedOut === 'true';
      const students = getClass10Students(session, includePassedOut);
      res.json(students);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch Class 10 students' });
    }
  });

  app.post('/api/students/class10-passout', (req: Request, res: Response) => {
    try {
      const { studentIds, session, passOutDate, resultSummary, adminName } = req.body;
      if (!studentIds || !studentIds.length || !session || !passOutDate) {
        return res.status(400).json({ error: 'Student IDs, session, and pass-out date are required' });
      }
      const result = processClass10PassOut({
        studentIds,
        session,
        passOutDate,
        resultSummary,
        adminName,
      });
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Pass-out processing failed' });
    }
  });

  app.get('/api/students-passout-archive', (_req: Request, res: Response) => {
    try {
      const archive = getPassOutArchive();
      res.json(archive);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch pass-out archive' });
    }
  });

  // --- MODULE 5: Student History & Status Tracking ---
  app.get('/api/students/:id/history', (req: Request, res: Response) => {
    try {
      const history = getStudentHistory(req.params.id);
      res.json(history);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch student history' });
    }
  });

  app.patch('/api/students/:id/status', (req: Request, res: Response) => {
    try {
      const { status, reason, adminName, statusDate } = req.body;
      if (!status) return res.status(400).json({ error: 'Status is required' });
      const updated = updateStudentStatus(req.params.id, status, reason, adminName, statusDate);
      res.json({ success: true, student: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to update student status' });
    }
  });

  app.get('/api/students-search-history', (req: Request, res: Response) => {
    try {
      const query = (req.query.q as string) || '';
      const results = searchStudentHistory(query);
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Search failed' });
    }
  });

  // Reusable search endpoint alias for Global Student Search selector
  app.get('/api/students/search', (req: Request, res: Response) => {
    try {
      const query = (req.query.q as string) || '';
      const results = searchStudentHistory(query);
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Student search failed' });
    }
  });

  // --- MODULE 6: Class-Wise Fee Configuration & Vouchers ---
  app.get('/api/fee-configs', (req: Request, res: Response) => {
    try {
      const session = (req.query.session as string) || undefined;
      const configs = getAllClassFeeConfigs(session);
      res.json(configs);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch fee configs' });
    }
  });

  app.post('/api/fee-configs', (req: Request, res: Response) => {
    try {
      const saved = saveClassFeeConfig(req.body);
      res.json({ success: true, feeConfig: saved });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to save fee config' });
    }
  });

  app.post('/api/vouchers/generate-class-bulk', (req: Request, res: Response) => {
    try {
      const {
        session,
        className,
        section,
        billingMonth,
        studentIds,
        dueDate,
        tuitionFee,
        admissionFeeItem,
        annualCharges,
        examFee,
        otherCharges,
        fine,
        discount,
        remarks,
        allowDuplicates,
      } = req.body;

      if (!session || !className || !billingMonth || !studentIds || !studentIds.length || !dueDate) {
        return res.status(400).json({ error: 'Missing required parameters for bulk fee generation' });
      }

      const result = generateClassVouchersBulk({
        session,
        className,
        section,
        billingMonth,
        studentIds,
        dueDate,
        tuitionFee,
        admissionFeeItem,
        annualCharges,
        examFee,
        otherCharges,
        fine,
        discount,
        remarks,
        allowDuplicates,
      });

      res.json({
        success: true,
        generatedCount: result.generated.length,
        skippedCount: result.skipped.length,
        generated: result.generated,
        skipped: result.skipped,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to generate class vouchers' });
    }
  });

  app.post('/api/vouchers/individual', (req: Request, res: Response) => {
    try {
      const voucher = createIndividualVoucher(req.body);
      res.status(201).json({ success: true, voucher });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to create individual voucher' });
    }
  });

  app.post('/api/vouchers/:id/payment', (req: Request, res: Response) => {
    try {
      const { amount, notes, adminName } = req.body;
      if (amount === undefined || Number(amount) <= 0) {
        return res.status(400).json({ error: 'Valid payment amount is required' });
      }
      const updated = recordVoucherPayment(req.params.id, Number(amount), notes, adminName);
      res.json({ success: true, voucher: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to record payment' });
    }
  });

  // Vouchers list with filter & search
  app.get('/api/vouchers', (req: Request, res: Response) => {
    try {
      const search = (req.query.search as string) || '';
      const status = (req.query.status as string) || 'ALL';
      const studentClass = (req.query.studentClass as string) || 'ALL';
      const session = (req.query.session as string) || 'ALL';
      const schoolId = getEffectiveSchoolId(req);

      const vouchers = getAllVouchers({ schoolId, search, status, studentClass, session });
      res.json(vouchers);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch vouchers' });
    }
  });

  // Single voucher by ID or VoucherNumber
  app.get('/api/vouchers/:id', (req: Request, res: Response) => {
    try {
      const voucher = getVoucherById(req.params.id);
      if (!voucher) {
        return res.status(404).json({ error: 'Voucher not found' });
      }
      // Get student for photo if available
      const student = getStudentById(voucher.studentId);
      res.json({ ...voucher, student });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch voucher' });
    }
  });

  // Update voucher payment status (PAID / UNPAID)
  app.patch('/api/vouchers/:id/status', (req: Request, res: Response) => {
    try {
      const { status, adminName, notes } = req.body;
      if (!status || (status !== 'PAID' && status !== 'UNPAID')) {
        return res.status(400).json({ error: "Status must be either 'PAID' or 'UNPAID'" });
      }

      const updated = updateVoucherStatus(
        req.params.id,
        status,
        adminName || 'Dr. Saeed Ahmad (Principal)',
        notes
      );

      res.json({
        success: true,
        message: `Voucher status successfully updated to ${status}`,
        voucher: updated,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to update voucher status' });
    }
  });

  // Audit history for voucher
  app.get('/api/vouchers/:id/audit', (req: Request, res: Response) => {
    try {
      const audit = getVoucherAuditLog(req.params.id);
      res.json(audit);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch audit log' });
    }
  });

  // Student update, soft-delete, and restore
  app.put('/api/students/:id', (req: Request, res: Response) => {
    try {
      const updated = updateStudent(req.params.id, req.body);
      res.json({ success: true, student: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to update student' });
    }
  });

  app.delete('/api/students/:id', (req: Request, res: Response) => {
    try {
      const isPermanent = req.query.permanent === 'true';
      const adminName = (req.headers['x-admin-name'] as string) || req.body?.adminName || 'Dr. Saeed Ahmad (Principal)';
      const success = deleteStudent(req.params.id, adminName, isPermanent);
      if (!success) {
        return res.status(404).json({ error: 'Student record not found' });
      }
      res.json({
        success: true,
        message: isPermanent ? 'Student record permanently removed' : 'Student moved to Recycle Bin',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete student' });
    }
  });

  app.patch('/api/students/:id/restore', (req: Request, res: Response) => {
    try {
      const success = restoreStudent(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Student record not found' });
      }
      res.json({ success: true, message: 'Student restored successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to restore student' });
    }
  });

  // Voucher delete & restore
  app.delete('/api/vouchers/:id', (req: Request, res: Response) => {
    try {
      const isPermanent = req.query.permanent === 'true';
      const adminName = (req.headers['x-admin-name'] as string) || req.body?.adminName || 'Dr. Saeed Ahmad';
      const success = deleteVoucher(req.params.id, adminName, isPermanent);
      if (!success) return res.status(404).json({ error: 'Voucher not found' });
      res.json({
        success: true,
        message: isPermanent ? 'Voucher permanently deleted' : 'Voucher moved to Recycle Bin',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete voucher' });
    }
  });

  app.patch('/api/vouchers/:id/restore', (req: Request, res: Response) => {
    try {
      const success = restoreVoucher(req.params.id);
      if (!success) return res.status(404).json({ error: 'Voucher not found' });
      res.json({ success: true, message: 'Voucher restored successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to restore voucher' });
    }
  });

  // Certificate delete & restore
  app.delete('/api/certificates/:id', (req: Request, res: Response) => {
    try {
      const isPermanent = req.query.permanent === 'true';
      const adminName = (req.headers['x-admin-name'] as string) || req.body?.adminName || 'Dr. Saeed Ahmad';
      const success = deleteCertificate(req.params.id, adminName, isPermanent);
      if (!success) return res.status(404).json({ error: 'Certificate not found' });
      res.json({
        success: true,
        message: isPermanent ? 'Certificate permanently deleted' : 'Certificate moved to Recycle Bin',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete certificate' });
    }
  });

  app.patch('/api/certificates/:id/restore', (req: Request, res: Response) => {
    try {
      const success = restoreCertificate(req.params.id);
      if (!success) return res.status(404).json({ error: 'Certificate not found' });
      res.json({ success: true, message: 'Certificate restored successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to restore certificate' });
    }
  });

  // Exam result delete & restore
  app.delete('/api/exam-results/:id', (req: Request, res: Response) => {
    try {
      const isPermanent = req.query.permanent === 'true';
      const adminName = (req.headers['x-admin-name'] as string) || req.body?.adminName || 'Dr. Saeed Ahmad';
      const success = deleteExamResult(req.params.id, adminName, isPermanent);
      if (!success) return res.status(404).json({ error: 'Exam result not found' });
      res.json({
        success: true,
        message: isPermanent ? 'Exam result permanently deleted' : 'Exam result moved to Recycle Bin',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete exam result' });
    }
  });

  app.patch('/api/exam-results/:id/restore', (req: Request, res: Response) => {
    try {
      const success = restoreExamResult(req.params.id);
      if (!success) return res.status(404).json({ error: 'Exam result not found' });
      res.json({ success: true, message: 'Exam result restored successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to restore exam result' });
    }
  });

  // --- Recycle Bin Endpoints ---
  app.get('/api/recycle-bin', (_req: Request, res: Response) => {
    try {
      const items = getRecycleBinItems();
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch recycle bin items' });
    }
  });

  app.post('/api/recycle-bin/restore', (req: Request, res: Response) => {
    try {
      const { recordType, id } = req.body;
      if (!recordType || !id) {
        return res.status(400).json({ error: 'recordType and id are required' });
      }
      const success = restoreRecycleBinItem(recordType, id);
      if (!success) {
        return res.status(404).json({ error: 'Item not found or could not be restored' });
      }
      res.json({ success: true, message: `${recordType} restored successfully` });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to restore item' });
    }
  });

  app.delete('/api/recycle-bin/permanent', (req: Request, res: Response) => {
    try {
      const { recordType, id, adminName } = req.body;
      if (!recordType || !id) {
        return res.status(400).json({ error: 'recordType and id are required' });
      }
      const success = permanentlyDeleteRecycleBinItem(
        recordType,
        id,
        adminName || 'Dr. Saeed Ahmad (Super Admin)'
      );
      if (!success) {
        return res.status(404).json({ error: 'Item not found or could not be purged' });
      }
      res.json({ success: true, message: `${recordType} record permanently deleted` });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to permanently delete item' });
    }
  });

  // --- Frontend Integration ---
  if (!isProduction) {
    // Mount Vite dev middleware with HMR disabled to prevent WebSocket port 24678 collisions
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Edupro School ERP server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Edupro server:', err);
  process.exit(1);
});
