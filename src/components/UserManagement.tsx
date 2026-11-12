/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  UserPlus,
  KeyRound,
  Trash2,
  Edit2,
  Copy,
  Check,
  AlertTriangle,
  Search,
  Filter,
  Activity,
  Lock,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Send,
  RefreshCw,
  Crown,
  FileText,
  Key,
  Inbox,
  CheckCircle,
  X,
  Building,
} from 'lucide-react';
import {
  AppUser,
  UserInvitation,
  SecurityAuditEntry,
  SystemSecuritySettings,
  PasswordResetRequest,
} from '../types/auth.ts';
import { UserRole } from '../types/school.ts';
import { OWNER_EMAIL } from '../utils/permissions.ts';

interface UserManagementProps {
  currentUser: AppUser;
  currentSchoolId?: string;
}

export const UserManagement: React.FC<UserManagementProps> = ({ currentUser, currentSchoolId }) => {
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'reset_requests' | 'audit' | 'settings'>('users');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [schoolsList, setSchoolsList] = useState<Array<{ id: string; schoolName: string; schoolCode: string }>>([]);
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>(() => {
    if (currentUser.role === 'Super Admin') return currentSchoolId || 'ALL';
    return currentUser.schoolId || currentSchoolId || 'school_primary';
  });
  const [resetRequests, setResetRequests] = useState<PasswordResetRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<SecurityAuditEntry[]>([]);
  const [settings, setSettings] = useState<SystemSecuritySettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Modal: Create User (Method A)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('HR');
  const [newSchoolId, setNewSchoolId] = useState<string>(() => {
    return currentSchoolId || currentUser.schoolId || 'school_primary';
  });
  const [newCustomPassword, setNewCustomPassword] = useState('');
  const [autoGenPassword, setAutoGenPassword] = useState(true);
  const [isTestAccount, setIsTestAccount] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    tempPass: string;
    role: string;
    name: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [createError, setCreateError] = useState('');

  // Modal: Invite User (Method B)
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('Clerk');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<UserInvitation | null>(null);
  const [inviteError, setInviteError] = useState('');

  // Modal: Edit User (Supports editing Name, Email, Phone, Role, Status)
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('HR');
  const [editStatus, setEditStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Modal: Delete confirmation
  const [deletingUser, setDeletingUser] = useState<AppUser | null>(null);
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Modal: Reset Password (Quick temporary password)
  const [resettingUser, setResettingUser] = useState<AppUser | null>(null);
  const [resetResult, setResetResult] = useState<{ tempPass: string } | null>(null);
  const [resetting, setResetting] = useState(false);

  // Modal: Assign / Replace Credentials (Dummy Account Replacement or Custom Password)
  const [assignPassUser, setAssignPassUser] = useState<AppUser | null>(null);
  const [customPassword, setCustomPassword] = useState('');
  const [isTempPasswordAssign, setIsTempPasswordAssign] = useState(true);
  const [assigningPass, setAssigningPass] = useState(false);
  const [assignPassSuccess, setAssignPassSuccess] = useState<{
    email: string;
    pass: string;
    name: string;
  } | null>(null);
  const [assignPassError, setAssignPassError] = useState('');

  // Modal: Resolve Reset Request
  const [approvedResetResult, setApprovedResetResult] = useState<{
    email: string;
    tempPass: string;
  } | null>(null);
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [resolvingRequest, setResolvingRequest] = useState(false);

  // Load data
  const loadSchools = async () => {
    try {
      const res = await fetch('/api/schools');
      if (res.ok) {
        const data = await res.json();
        setSchoolsList(data);
      }
    } catch (err) {
      console.error('Failed to load schools list:', err);
    }
  };

  const loadUsers = async (schoolFilter = selectedSchoolFilter) => {
    try {
      setLoading(true);
      const url =
        schoolFilter && schoolFilter !== 'ALL'
          ? `/api/users?schoolId=${encodeURIComponent(schoolFilter)}`
          : '/api/users';
      const res = await fetch(url);
      if (res.ok) setUsers(await res.json());
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadResetRequests = async () => {
    try {
      const res = await fetch('/api/password-reset-requests');
      if (res.ok) setResetRequests(await res.json());
    } catch (err) {
      console.error('Failed to load reset requests:', err);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const res = await fetch('/api/audit-logs?limit=150');
      if (res.ok) setAuditLogs(await res.json());
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/security-settings');
      if (res.ok) setSettings(await res.json());
    } catch (err) {
      console.error('Failed to load security settings:', err);
    }
  };

  useEffect(() => {
    loadSchools();
    loadUsers();
    loadResetRequests();
    loadAuditLogs();
    loadSettings();
  }, []);

  // Escape key global listener for all modals in UserManagement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCreateModal(false);
        setShowInviteModal(false);
        setEditingUser(null);
        setDeletingUser(null);
        setResettingUser(null);
        setAssignPassUser(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const pendingResetCount = resetRequests.filter((r) => r.status === 'PENDING').length;

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.phone && u.phone.includes(searchQuery));
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Handle Manual Creation
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreatingUser(true);

    const targetSchool =
      currentUser.role === 'Super Admin'
        ? newSchoolId
        : currentUser.schoolId || currentSchoolId || 'school_primary';

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim().toLowerCase(),
          phone: newPhone.trim(),
          role: newRole,
          schoolId: targetSchool,
          temporaryPassword: currentUser.role === 'Super Admin' && !autoGenPassword ? (newCustomPassword.trim() || undefined) : undefined,
          requiresPasswordChange: false,
          isTestAccount,
          actingUid: currentUser.uid,
          actingEmail: currentUser.email,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user account');
      }

      setCreatedCredentials({
        name: data.user.name,
        email: data.user.email,
        tempPass: data.temporaryPassword,
        role: data.user.role,
      });

      loadUsers();
      loadAuditLogs();
    } catch (err: any) {
      setCreateError(err.message || 'Error creating user');
    } finally {
      setCreatingUser(false);
    }
  };

  // Handle Send Invitation
  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    setInviting(true);

    try {
      const res = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          name: inviteName.trim(),
          role: inviteRole,
          actingUid: currentUser.uid,
          actingEmail: currentUser.email,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create invitation');
      }

      setInviteResult(data.invitation);
      loadAuditLogs();
    } catch (err: any) {
      setInviteError(err.message || 'Error sending invitation');
    } finally {
      setInviting(false);
    }
  };

  // Handle Edit User (Name, Email, Phone, Role, Status)
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);
    setEditError('');

    try {
      const res = await fetch(`/api/users/${editingUser.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          email: editEmail,
          phone: editPhone,
          role: editRole,
          status: editStatus,
          actingUid: currentUser.uid,
          actingEmail: currentUser.email,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');

      setEditingUser(null);
      loadUsers();
      loadAuditLogs();
    } catch (err: any) {
      setEditError(err.message || 'Error updating user');
    } finally {
      setSavingEdit(false);
    }
  };

  // Handle Assign / Replace Password (Super Admin Only)
  const handleAssignPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignPassUser || !customPassword) return;
    if (currentUser.role !== 'Super Admin') {
      alert('Forbidden: Only the Software Owner / Super Admin (ahmadwaheedahmad57@gmail.com) has authority to assign or change user passwords.');
      return;
    }
    setAssigningPass(true);
    setAssignPassError('');

    try {
      const res = await fetch(`/api/users/${assignPassUser.uid}/set-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPassword: customPassword,
          isTemporary: isTempPasswordAssign,
          actingUid: currentUser.uid,
          actingEmail: currentUser.email,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign password');

      setAssignPassSuccess({
        name: assignPassUser.name,
        email: assignPassUser.email,
        pass: customPassword,
      });

      loadUsers();
      loadAuditLogs();
    } catch (err: any) {
      setAssignPassError(err.message || 'Error setting password');
    } finally {
      setAssigningPass(false);
    }
  };

  // Handle Delete User
  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/users/${deletingUser.uid}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actingUid: currentUser.uid,
          actingEmail: currentUser.email,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user');

      setDeletingUser(null);
      setConfirmDeleteText('');
      loadUsers();
      loadAuditLogs();
    } catch (err: any) {
      alert(err.message || 'Error deleting user');
    } finally {
      setDeleting(false);
    }
  };

  // Handle Quick Reset Password (Super Admin Only)
  const handleResetPassword = async () => {
    if (!resettingUser) return;
    if (currentUser.role !== 'Super Admin') {
      alert('Forbidden: Only the Software Owner / Super Admin (ahmadwaheedahmad57@gmail.com) has authority to reset user passwords.');
      return;
    }
    setResetting(true);

    try {
      const res = await fetch(`/api/users/${resettingUser.uid}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actingUid: currentUser.uid,
          actingEmail: currentUser.email,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');

      setResetResult({ tempPass: data.temporaryPassword });
      loadAuditLogs();
    } catch (err: any) {
      alert(err.message || 'Error resetting password');
    } finally {
      setResetting(false);
    }
  };

  // Handle Approve / Reject Password Reset Request
  const handleResolveReset = async (requestId: string, action: 'APPROVE' | 'REJECT', reason = '') => {
    setResolvingRequest(true);
    try {
      const res = await fetch(`/api/password-reset-requests/${requestId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          rejectionReason: reason,
          actingUid: currentUser.uid,
          actingEmail: currentUser.email,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resolve request');

      if (action === 'APPROVE' && data.temporaryPassword) {
        setApprovedResetResult({
          email: data.request.email,
          tempPass: data.temporaryPassword,
        });
      }

      setRejectingRequestId(null);
      setRejectionReason('');
      loadResetRequests();
      loadAuditLogs();
      loadUsers();
    } catch (err: any) {
      alert(err.message || 'Error resolving request');
    } finally {
      setResolvingRequest(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Banner: Super Admin Exclusive Control */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white mb-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Crown className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                Software Owner Control Center · Super Admin Panel
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              User Accounts & Security Administration
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Authorized Software Owner: <strong className="text-white">{currentUser.email}</strong> (Ahmad Waheed Ahmad)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setNewName('');
                setNewEmail('');
                setNewPhone('');
                setNewRole('HR');
                setIsTestAccount(false);
                setCreatedCredentials(null);
                setCreateError('');
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs transition-colors shadow-sm cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Add User (Manual)</span>
            </button>
            <button
              onClick={() => {
                setInviteEmail('');
                setInviteName('');
                setInviteRole('Clerk');
                setInviteResult(null);
                setInviteError('');
                setShowInviteModal(true);
              }}
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer"
            >
              <Mail className="w-4 h-4 text-amber-400" />
              <span>Invite via Email</span>
            </button>
            <button
              onClick={() => {
                loadUsers();
                loadResetRequests();
                loadAuditLogs();
              }}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 cursor-pointer"
              title="Refresh Records"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
            <div className="text-xs text-slate-400 font-medium">Total Registered Users</div>
            <div className="text-xl font-bold font-tabular text-white mt-1">{users.length}</div>
          </div>
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
            <div className="text-xs text-slate-400 font-medium">Active Accounts</div>
            <div className="text-xl font-bold font-tabular text-emerald-400 mt-1">
              {users.filter((u) => u.status === 'ACTIVE').length}
            </div>
          </div>
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
            <div className="text-xs text-slate-400 font-medium">Reset Requests Pending</div>
            <div className="text-xl font-bold font-tabular text-amber-400 mt-1">
              {pendingResetCount}
            </div>
          </div>
          <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
            <div className="text-xs text-slate-400 font-medium">Security Audit Events</div>
            <div className="text-xl font-bold font-tabular text-blue-400 mt-1">{auditLogs.length}</div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200 mb-6 gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveSubTab('users')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeSubTab === 'users'
              ? 'border-amber-500 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Accounts & RBAC ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('reset_requests')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeSubTab === 'reset_requests'
              ? 'border-amber-500 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <KeyRound className="w-4 h-4 text-amber-500" />
          <span>Password Reset Requests</span>
          {pendingResetCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
              {pendingResetCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('audit')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeSubTab === 'audit'
              ? 'border-amber-500 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Activity className="w-4 h-4 text-blue-500" />
          <span>Security Audit Logs ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('settings')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
            activeSubTab === 'settings'
              ? 'border-amber-500 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Shield className="w-4 h-4 text-emerald-500" />
          <span>Software Security Config</span>
        </button>
      </div>

      {/* SUBTAB 1: USERS LIST */}
      {activeSubTab === 'users' && (
        <div className="space-y-4">
          {/* Search and filters bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, or phone..."
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {currentUser.role === 'Super Admin' && schoolsList.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-amber-500" />
                    <span>School:</span>
                  </span>
                  <select
                    value={selectedSchoolFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedSchoolFilter(val);
                      loadUsers(val);
                    }}
                    className="text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700 font-medium focus:outline-hidden"
                  >
                    <option value="ALL">All Schools (Global)</option>
                    {schoolsList.map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        {sc.schoolName} ({sc.schoolCode})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Role:</span>
                </span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700 font-medium focus:outline-hidden"
                >
                  <option value="ALL">All Roles</option>
                  <option value="Super Admin">Super Admin (Owner)</option>
                  <option value="Principal">Principal</option>
                  <option value="HR">HR</option>
                  <option value="Clerk">Clerk</option>
                  <option value="Accountant">Accountant</option>
                  <option value="Teacher">Teacher</option>
                </select>
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3.5">User Identity</th>
                    <th className="px-4 py-3.5">School</th>
                    <th className="px-4 py-3.5">Role</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Account Type</th>
                    <th className="px-4 py-3.5">Last Login / Created</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        No users match the search filter.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const isOwner = user.isOwner || user.role === 'Super Admin';
                      const schoolObj = schoolsList.find((s) => s.id === user.schoolId);
                      const schoolDisplayName =
                        user.role === 'Super Admin'
                          ? 'Global (All Schools)'
                          : schoolObj
                          ? `${schoolObj.schoolName} (${schoolObj.schoolCode})`
                          : user.schoolId === 'school_primary'
                          ? 'Siqarah High School (SCH001)'
                          : user.schoolId || 'Primary School';

                      return (
                        <tr
                          key={user.uid}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isOwner ? 'bg-amber-50/40' : ''
                          }`}
                        >
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isOwner
                                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                                    : 'bg-slate-800 text-white'
                                }`}
                              >
                                {isOwner ? '👑' : user.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                  <span>{user.name}</span>
                                  {isOwner && (
                                    <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-400 text-slate-950 font-black tracking-wide border border-amber-500">
                                      Software Owner
                                    </span>
                                  )}
                                </div>
                                <div className="text-slate-500 font-mono text-xs">{user.email}</div>
                                {user.phone && (
                                  <div className="text-slate-400 text-[11px]">{user.phone}</div>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                              <Building className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="max-w-[160px] truncate">{schoolDisplayName}</span>
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold border ${
                                user.role === 'Super Admin'
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : user.role === 'Principal'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : user.role === 'HR'
                                  ? 'bg-blue-50 text-blue-800 border-blue-300'
                                  : user.role === 'Clerk'
                                  ? 'bg-purple-50 text-purple-800 border-purple-300'
                                  : user.role === 'Accountant'
                                  ? 'bg-cyan-50 text-cyan-800 border-cyan-300'
                                  : 'bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                            >
                              {user.role}
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-semibold ${
                                user.status === 'ACTIVE' ? 'text-emerald-600' : 'text-rose-500'
                              }`}
                            >
                              {user.status === 'ACTIVE' ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5" />
                              )}
                              <span>{user.status}</span>
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            {user.isTestAccount ? (
                              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                [TEST / DUMMY]
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-500">Standard</span>
                            )}
                          </td>

                          <td className="px-4 py-3.5 text-xs text-slate-500">
                            {user.lastLoginAt ? (
                              <div>
                                <span className="font-semibold text-slate-700">Last: </span>
                                {new Date(user.lastLoginAt).toLocaleDateString()}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Never logged in</span>
                            )}
                            <div className="text-[10px] text-slate-400">
                              Created: {new Date(user.createdAt).toLocaleDateString()}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Assign / Replace Password - strictly Super Admin Only */}
                              {currentUser.role === 'Super Admin' && (
                                <button
                                  onClick={() => {
                                    setAssignPassUser(user);
                                    setCustomPassword('');
                                    setIsTempPasswordAssign(true);
                                    setAssignPassSuccess(null);
                                    setAssignPassError('');
                                  }}
                                  className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                                  title="Assign New Password / Replace Credentials (Super Admin Only)"
                                >
                                  <Key className="w-4 h-4" />
                                </button>
                              )}

                              {/* Edit Profile & Email */}
                              <button
                                onClick={() => {
                                  setEditingUser(user);
                                  setEditName(user.name);
                                  setEditEmail(user.email);
                                  setEditPhone(user.phone || '');
                                  setEditRole(user.role);
                                  setEditStatus(user.status);
                                  setEditError('');
                                }}
                                className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                                title="Edit Name, Email, Role, Status"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              {/* Delete Account (Protected for Owner) */}
                              {!isOwner ? (
                                <button
                                  onClick={() => {
                                    setDeletingUser(user);
                                    setConfirmDeleteText('');
                                  }}
                                  className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                  title="Delete User"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ) : (
                                <span
                                  className="text-[11px] text-amber-600 font-semibold px-2 py-0.5 bg-amber-50 rounded border border-amber-200"
                                  title="Software Owner account is permanently protected"
                                >
                                  Owner
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: PASSWORD RESET REQUESTS */}
      {activeSubTab === 'reset_requests' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-500" />
                <span>Submitted Password Reset Requests</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Review and approve password reset requests submitted by users via the Login Page.
              </p>
            </div>
            <button
              onClick={loadResetRequests}
              className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Requests</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] tracking-wider font-bold">
                <tr>
                  <th className="px-4 py-3">Applicant Email</th>
                  <th className="px-4 py-3">User Name</th>
                  <th className="px-4 py-3">Assigned Role</th>
                  <th className="px-4 py-3">Requested At</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resetRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No password reset requests submitted yet.
                    </td>
                  </tr>
                ) : (
                  resetRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {req.email}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{req.userName}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold">
                          {req.userRole}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {new Date(req.requestedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            req.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-800'
                              : req.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {req.status === 'PENDING' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleResolveReset(req.id, 'APPROVE')}
                              disabled={resolvingRequest}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            >
                              Approve & Generate Password
                            </button>
                            <button
                              onClick={() => {
                                setRejectingRequestId(req.id);
                                setRejectionReason('');
                              }}
                              disabled={resolvingRequest}
                              className="px-2.5 py-1 bg-slate-200 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        ) : req.status === 'APPROVED' ? (
                          <span className="text-xs text-emerald-600 font-semibold">
                            Approved by {req.resolvedBy}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">
                            Rejected ({req.rejectionReason || 'No reason'})
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3: SECURITY AUDIT LOGS */}
      {activeSubTab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Live Security Audit Log</h3>
              <p className="text-xs text-slate-500">
                Immutable event stream documenting all authentication attempts, user lifecycle, and credential modifications.
              </p>
            </div>
            <button
              onClick={loadAuditLogs}
              className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Log</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Acting Identity</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No security audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap font-bold">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            log.action.includes('LOGIN_SUCCESS')
                              ? 'bg-emerald-100 text-emerald-800'
                              : log.action.includes('FAILED') || log.action.includes('BLOCKED')
                              ? 'bg-rose-100 text-rose-800'
                              : log.action.includes('CREATED') || log.action.includes('INVITATION')
                              ? 'bg-blue-100 text-blue-800'
                              : log.action.includes('DELETED')
                              ? 'bg-red-100 text-red-800 font-black'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            log.status === 'SUCCESS'
                              ? 'text-emerald-600'
                              : log.status === 'FAILED'
                              ? 'text-rose-600'
                              : 'text-amber-600'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-slate-700">
                        {log.actingEmail}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                        {log.targetEmail || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 max-w-md truncate">
                        {log.details}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-slate-400">
                        {log.ipAddress || 'internal'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 4: SYSTEM SECURITY CONFIG (PHASE 8) */}
      {activeSubTab === 'settings' && (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-amber-900 text-xs sm:text-sm">
            <div className="font-bold text-amber-950 flex items-center gap-2 text-sm mb-1">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              <span>Institutional Separation of Concerns</span>
            </div>
            <p className="leading-relaxed">
              Software Owner administers software architecture, database integrity, user provisioning, role assignments, and audit logging.
              School operational identity (School Name, Urdu Title, Principal credentials, Board Affiliation, Logo, Stamp, and Class Fee structures) is managed directly by <strong>Principal Dr. Saeed Ahmad</strong> in <em>School Settings</em>.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">
              Platform & Cloud Database Parameters
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-500">Software Product Name</label>
                  <div className="font-bold text-slate-900 mt-0.5">EduManage Pro School ERP</div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500">Software Owner / Super Admin</label>
                  <div className="font-bold text-slate-900 mt-0.5 font-mono">{currentUser.email}</div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500">Firebase Firestore Cloud Database</label>
                  <div className="font-bold text-emerald-600 mt-0.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>velvety-spot-sthv3 (Connected & Rules Enforced)</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-500">Authentication & Passwords</label>
                  <div className="text-slate-800 mt-0.5">
                    Crypto scrypt salted hash with temporary password one-time-use policy
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500">Access Control Model</label>
                  <div className="text-slate-800 mt-0.5">
                    Multi-Role RBAC (Super Admin, Principal, HR, Clerk, Accountant, Teacher)
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500">Audit Logging</label>
                  <div className="text-slate-800 mt-0.5">
                    Append-only security log for compliance and traceability
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Method A - Create User */}
      {showCreateModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateModal(false);
          }}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 text-slate-900 shadow-2xl border border-slate-200 my-8">
            {!createdCredentials ? (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-amber-500" />
                    <h3 className="text-base font-bold text-slate-900">
                      Add New App User
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {createError && (
                  <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                    {createError}
                  </div>
                )}

                <form onSubmit={handleCreateUser} className="space-y-4">
                  {/* School Assignment */}
                  {currentUser.role === 'Super Admin' ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Assign to School *
                      </label>
                      <select
                        value={newSchoolId}
                        onChange={(e) => setNewSchoolId(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium"
                      >
                        {schoolsList.map((sc) => (
                          <option key={sc.id} value={sc.id}>
                            {sc.schoolName} ({sc.schoolCode})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-700 flex items-center justify-between">
                      <span>Institutional Account:</span>
                      <strong className="text-slate-950">
                        {schoolsList.find((s) => s.id === (currentUser.schoolId || currentSchoolId))?.schoolName || 'Your School'}
                      </strong>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Tariq Mehmood"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Official Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="e.g. tariq@school.edu.pk"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Mobile Number
                      </label>
                      <input
                        type="text"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="+92 300 1234567"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        System Role *
                      </label>
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value as UserRole)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                      >
                        <option value="Principal">Principal</option>
                        <option value="HR">HR</option>
                        <option value="Clerk">Clerk</option>
                        <option value="Accountant">Accountant</option>
                        <option value="Teacher">Teacher</option>
                      </select>
                    </div>
                  </div>

                  {/* Password Controls */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                    <label className="block text-xs font-bold text-slate-700">
                      Login Password Setup
                    </label>
                    {currentUser.role === 'Super Admin' ? (
                      <>
                        <div className="flex flex-col gap-1.5 text-xs">
                          <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                            <input
                              type="radio"
                              name="passSetup"
                              checked={autoGenPassword}
                              onChange={() => setAutoGenPassword(true)}
                              className="text-amber-500"
                            />
                            <span>Auto-generate secure temporary password</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                            <input
                              type="radio"
                              name="passSetup"
                              checked={!autoGenPassword}
                              onChange={() => setAutoGenPassword(false)}
                              className="text-amber-500"
                            />
                            <span>Assign custom password (Super Admin Only)</span>
                          </label>
                        </div>

                        {!autoGenPassword && (
                          <input
                            type="text"
                            required={!autoGenPassword}
                            value={newCustomPassword}
                            onChange={(e) => setNewCustomPassword(e.target.value)}
                            placeholder="Enter custom password (min 6 chars)"
                            minLength={6}
                            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono bg-white"
                          />
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-slate-500">
                        A secure temporary password will be generated automatically. Only the Software Owner / Super Admin can assign or reset user passwords.
                      </p>
                    )}
                  </div>

                  <div className="pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={isTestAccount}
                        onChange={(e) => setIsTestAccount(e.target.checked)}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                      />
                      <span>Mark this account as an isolated Dummy / Test Account</span>
                    </label>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                    >
                      Cancel (Esc)
                    </button>
                    <button
                      type="submit"
                      disabled={creatingUser}
                      className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      {creatingUser ? 'Creating Account...' : 'Create Account'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="text-center py-2">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">
                  User Account Created Successfully!
                </h3>
                <p className="text-xs text-slate-500 mb-5">
                  Copy the credentials below and securely share them with the employee.
                </p>

                <div className="bg-slate-900 text-white rounded-xl p-4 text-left font-mono text-xs space-y-2 mb-5 relative">
                  <div>
                    <span className="text-slate-400">Employee Name: </span>
                    <span className="text-white font-bold">{createdCredentials.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Email Address: </span>
                    <span className="text-amber-300 font-bold">{createdCredentials.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Temporary Password: </span>
                    <span className="text-emerald-300 font-bold text-sm bg-slate-800 px-2 py-0.5 rounded">
                      {createdCredentials.tempPass}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Assigned Role: </span>
                    <span className="text-white">{createdCredentials.role}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const text = `EduManage Pro Credentials:\nName: ${createdCredentials.name}\nEmail: ${createdCredentials.email}\nTemporary Password: ${createdCredentials.tempPass}\nRole: ${createdCredentials.role}\nLink: ${window.location.origin}`;
                      copyToClipboard(text);
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold shadow-sm transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copied to Clipboard!' : 'Copy Credentials'}</span>
                  </button>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="py-2.5 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Method B - Invite User */}
      {showInviteModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowInviteModal(false);
          }}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 text-slate-900 shadow-2xl border border-slate-200">
            {!inviteResult ? (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                  <div className="flex items-center gap-2">
                    <Mail className="w-5 h-5 text-amber-500" />
                    <h3 className="text-base font-bold text-slate-900">
                      Send Employee Invitation (Method B)
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {inviteError && (
                  <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                    {inviteError}
                  </div>
                )}

                <form onSubmit={handleInviteUser} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Invitee Name
                    </label>
                    <input
                      type="text"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="e.g. Muhammad Rizwan"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Invitee Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="e.g. rizwan@school.edu.pk"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Pre-Assigned Role *
                    </label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="Principal">Principal</option>
                      <option value="HR">HR</option>
                      <option value="Clerk">Clerk</option>
                      <option value="Accountant">Accountant</option>
                      <option value="Teacher">Teacher</option>
                    </select>
                  </div>

                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs text-blue-900">
                    An official invitation token with a 7-day expiration will be generated and logged for the user to register with their pre-assigned role.
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowInviteModal(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={inviting}
                      className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      {inviting ? 'Generating...' : 'Send Invitation Token'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="text-center py-2">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">
                  Invitation Generated Successfully
                </h3>
                <p className="text-xs text-slate-500 mb-5">
                  Share this invitation token link with {inviteResult.email}.
                </p>

                <div className="bg-slate-900 text-white rounded-xl p-4 text-left font-mono text-xs space-y-2 mb-5">
                  <div>
                    <span className="text-slate-400">Target Email: </span>
                    <span className="text-amber-300 font-bold">{inviteResult.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Assigned Role: </span>
                    <span className="text-white">{inviteResult.role}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Invite Token: </span>
                    <span className="text-emerald-300 font-bold break-all">
                      {inviteResult.inviteToken}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const text = `EduManage Pro Invitation Token:\nEmail: ${inviteResult.email}\nRole: ${inviteResult.role}\nToken: ${inviteResult.inviteToken}\nLink: ${window.location.origin}`;
                      copyToClipboard(text);
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold shadow-sm transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copied Invitation!' : 'Copy Invitation Link'}</span>
                  </button>
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="py-2.5 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Edit User (Supports editing Email, Name, Phone, Role, Status) */}
      {editingUser && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingUser(null);
          }}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-slate-900 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="text-base font-bold text-slate-900">
                Edit User Account & Email
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Registered Email Address (Replace Dummy Email) *
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="real.email@school.edu.pk"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                >
                  <option value="Principal">Principal</option>
                  <option value="HR">HR</option>
                  <option value="Clerk">Clerk</option>
                  <option value="Accountant">Accountant</option>
                  <option value="Teacher">Teacher</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Account Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                >
                  <option value="ACTIVE">ACTIVE (Authorized to log in)</option>
                  <option value="INACTIVE">INACTIVE (Deactivated / Login Blocked)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {savingEdit ? 'Saving...' : 'Save Updates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Assign / Replace Credentials (Dummy Account Replacement or Custom Password) */}
      {assignPassUser && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setAssignPassUser(null);
          }}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-slate-900 shadow-2xl border border-slate-200">
            {!assignPassSuccess ? (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <Key className="w-5 h-5" />
                    <h3 className="text-base font-bold text-slate-900">
                      Assign Password / Replace Dummy Credentials
                    </h3>
                  </div>
                  <button
                    onClick={() => setAssignPassUser(null)}
                    className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl mb-4 text-xs">
                  <div>
                    <span className="text-slate-500">Target User: </span>
                    <strong className="text-slate-900">{assignPassUser.name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Email: </span>
                    <span className="font-mono text-slate-900">{assignPassUser.email}</span>
                  </div>
                </div>

                {assignPassError && (
                  <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
                    {assignPassError}
                  </div>
                )}

                <form onSubmit={handleAssignPassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      New Password (Minimum 8 chars) *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={customPassword}
                        onChange={(e) => setCustomPassword(e.target.value)}
                        placeholder="Enter real or temporary password"
                        className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
                          let pwd = '';
                          for (let i = 0; i < 12; i++) {
                            pwd += chars.charAt(Math.floor(Math.random() * chars.length));
                          }
                          setCustomPassword(pwd);
                        }}
                        className="px-3 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg whitespace-nowrap cursor-pointer"
                      >
                        Generate
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={isTempPasswordAssign}
                        onChange={(e) => setIsTempPasswordAssign(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Enforce password change upon user's next login</span>
                    </label>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setAssignPassUser(null)}
                      className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={assigningPass}
                      className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                      {assigningPass ? 'Saving...' : 'Assign Password'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="text-center py-2">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">
                  Credentials Updated Successfully!
                </h3>
                <p className="text-xs text-slate-500 mb-5">
                  Share these credentials securely with {assignPassSuccess.name}.
                </p>

                <div className="bg-slate-900 text-white rounded-xl p-4 text-left font-mono text-xs space-y-2 mb-5">
                  <div>
                    <span className="text-slate-400">User Email: </span>
                    <span className="text-amber-300 font-bold">{assignPassSuccess.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">New Password: </span>
                    <span className="text-emerald-300 font-bold bg-slate-800 px-2 py-0.5 rounded">
                      {assignPassSuccess.pass}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const text = `Updated Credentials for ${assignPassSuccess.name}:\nEmail: ${assignPassSuccess.email}\nPassword: ${assignPassSuccess.pass}`;
                      copyToClipboard(text);
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copied!' : 'Copy Credentials'}</span>
                  </button>
                  <button
                    onClick={() => setAssignPassUser(null)}
                    className="py-2 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Approved Reset Request Result Display */}
      {approvedResetResult && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-slate-900 shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Reset Request Approved!
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              A temporary password has been generated for {approvedResetResult.email}.
            </p>

            <div className="bg-slate-900 text-amber-300 font-mono text-base font-bold p-3 rounded-xl mb-5 select-all">
              {approvedResetResult.tempPass}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  const text = `EduManage Pro Temporary Password for ${approvedResetResult.email}:\nPassword: ${approvedResetResult.tempPass}\nLogin: ${window.location.origin}`;
                  copyToClipboard(text);
                }}
                className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied Temporary Password!' : 'Copy Password'}</span>
              </button>
              <button
                onClick={() => setApprovedResetResult(null)}
                className="py-2 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Reject Reset Request */}
      {rejectingRequestId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-slate-900 shadow-2xl border border-rose-200">
            <div className="flex items-center gap-2 text-rose-600 mb-3">
              <XCircle className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900">
                Reject Password Reset Request
              </h3>
            </div>
            <p className="text-xs text-slate-600 mb-4">
              Enter the reason for rejecting this password reset request:
            </p>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Identity could not be verified by administration"
              rows={3}
              className="w-full p-2.5 text-xs rounded-lg border border-slate-300 mb-4 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
            ></textarea>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRejectingRequestId(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleResolveReset(rejectingRequestId, 'REJECT', rejectionReason)}
                disabled={resolvingRequest}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Delete Confirmation */}
      {deletingUser && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeletingUser(null);
          }}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-slate-900 shadow-2xl border border-rose-200">
            <div className="flex items-center gap-2 text-rose-600 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold">Confirm User Account Deletion</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Are you sure you want to permanently delete the account for{' '}
              <strong className="text-slate-900">{deletingUser.name}</strong> (
              <span className="font-mono text-xs">{deletingUser.email}</span>)?
            </p>
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 mb-5">
              Warning: This action will purge login access and cannot be undone. All prior audit log events will be retained.
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel (Esc)
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={deleting}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Delete User Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Quick Password Reset */}
      {resettingUser && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setResettingUser(null);
          }}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-slate-900 shadow-2xl border border-slate-200">
            {!resetResult ? (
              <>
                <div className="flex items-center gap-2 text-amber-600 mb-3">
                  <KeyRound className="w-5 h-5" />
                  <h3 className="text-base font-bold text-slate-900">
                    Generate Temporary Password
                  </h3>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-5">
                  Reset password for <strong className="text-slate-900">{resettingUser.name}</strong> (
                  <span className="font-mono text-xs">{resettingUser.email}</span>)?
                  A new secure temporary password will be generated, and the user will be forced to change it upon next login.
                </p>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setResettingUser(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleResetPassword}
                    disabled={resetting}
                    className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {resetting ? 'Resetting...' : 'Generate New Password'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-2">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">New Temporary Password</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Provide this temporary password to {resettingUser.email}:
                </p>

                <div className="bg-slate-900 text-amber-300 font-mono text-sm font-bold p-3 rounded-lg mb-5 select-all">
                  {resetResult.tempPass}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const text = `Temporary Password for ${resettingUser.email}: ${resetResult.tempPass}`;
                      copyToClipboard(text);
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copied!' : 'Copy Password'}</span>
                  </button>
                  <button
                    onClick={() => setResettingUser(null)}
                    className="py-2 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
