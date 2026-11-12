/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  User,
  Mail,
  Lock,
  KeyRound,
  Shield,
  CheckCircle2,
  AlertCircle,
  X,
  Crown,
  Save,
  ShieldCheck,
  Eye,
  EyeOff,
  LogOut,
} from 'lucide-react';
import { AppUser } from '../types/auth.ts';

interface UserProfileModalProps {
  currentUser: AppUser;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: (updatedUser: AppUser) => void;
  onLogout?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onUserUpdated,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'email' | 'password' | 'recovery'>('details');

  // Change Email State
  const [newEmail, setNewEmail] = useState('');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [emailSuccessMsg, setEmailSuccessMsg] = useState('');
  const [emailErrorMsg, setEmailErrorMsg] = useState('');

  // Change Password State
  const [passCurrentPassword, setPassCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPassOld, setShowPassOld] = useState(false);
  const [showPassNew, setShowPassNew] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passSuccessMsg, setPassSuccessMsg] = useState('');
  const [passErrorMsg, setPassErrorMsg] = useState('');

  if (!isOpen) return null;

  const isOwner = currentUser.isOwner || currentUser.role === 'Super Admin';

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !emailCurrentPassword) {
      setEmailErrorMsg('Please provide both new email address and current password.');
      return;
    }

    setChangingEmail(true);
    setEmailSuccessMsg('');
    setEmailErrorMsg('');

    try {
      const res = await fetch('/api/users/profile/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: currentUser.uid,
          currentPassword: emailCurrentPassword,
          newEmail: newEmail.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update email address.');
      }

      setEmailSuccessMsg('Your registered email address has been updated successfully!');
      setEmailCurrentPassword('');
      setNewEmail('');
      onUserUpdated(data.user);
    } catch (err: any) {
      setEmailErrorMsg(err.message || 'Error updating email address.');
    } finally {
      setChangingEmail(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passCurrentPassword || !newPassword) {
      setPassErrorMsg('Please fill in all password fields.');
      return;
    }
    if (newPassword.length < 8) {
      setPassErrorMsg('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPassErrorMsg('New passwords do not match.');
      return;
    }

    setChangingPassword(true);
    setPassSuccessMsg('');
    setPassErrorMsg('');

    try {
      const res = await fetch('/api/users/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: currentUser.uid,
          currentPassword: passCurrentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to change password.');
      }

      setPassSuccessMsg('Your password has been changed successfully!');
      setPassCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      onUserUpdated(data.user);
    } catch (err: any) {
      setPassErrorMsg(err.message || 'Error updating password.');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 text-slate-900 shadow-2xl border border-slate-200 overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
              {isOwner ? '👑' : currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <span>User Profile & Security Settings</span>
                {isOwner && (
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-400 text-slate-950 font-black">
                    Software Owner
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500">{currentUser.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 mt-4 gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('details')}
            className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'details'
                ? 'border-amber-500 text-slate-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Account Details</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('email');
              setEmailSuccessMsg('');
              setEmailErrorMsg('');
            }}
            className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'email'
                ? 'border-amber-500 text-slate-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Change Email</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('password');
              setPassSuccessMsg('');
              setPassErrorMsg('');
            }}
            className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'password'
                ? 'border-amber-500 text-slate-900 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Change Password</span>
          </button>

          {isOwner && (
            <button
              onClick={() => setActiveTab('recovery')}
              className={`pb-2.5 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'recovery'
                  ? 'border-amber-500 text-slate-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
              <span>Owner Recovery</span>
            </button>
          )}
        </div>

        {/* Tab 1: Account Details */}
        {activeTab === 'details' && (
          <div className="py-5 space-y-4 text-xs sm:text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 font-medium block">Full Name</span>
                <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                  {currentUser.name}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 font-medium block">Assigned Role</span>
                <span className="font-bold text-amber-600 text-sm mt-0.5 block">
                  {currentUser.role}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 font-medium block">Registered Email</span>
                <span className="font-mono text-slate-900 text-xs mt-0.5 block truncate">
                  {currentUser.email}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 font-medium block">Account Status</span>
                <span className="font-bold text-emerald-600 text-xs mt-0.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{currentUser.status}</span>
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-amber-400">
                <Shield className="w-4 h-4" />
                <span>Security & Authorization Notice</span>
              </div>
              <p className="text-slate-300 leading-relaxed">
                Your role and operational permissions are managed through EDU.pro Role-Based Access Control (RBAC). For modifications to permissions or official credentials, contact the Software Owner.
              </p>
            </div>

            {onLogout && (
              <div className="pt-2 flex justify-between items-center border-t border-slate-200">
                <span className="text-xs text-slate-500">Finished working?</span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onLogout();
                  }}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-600" />
                  <span>Sign Out of Account</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Change Email */}
        {activeTab === 'email' && (
          <div className="py-5">
            <p className="text-xs text-slate-500 mb-4">
              Enter your new email address and confirm with your current password to update your login credentials.
            </p>

            {emailSuccessMsg && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{emailSuccessMsg}</span>
              </div>
            )}

            {emailErrorMsg && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{emailErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleChangeEmail} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Current Email Address
                </label>
                <input
                  type="text"
                  disabled
                  value={currentUser.email}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Official Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="new.email@school.edu.pk"
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Current Password (Required for Security Verification) *
                </label>
                <div className="relative">
                  <input
                    type={showEmailPassword ? 'text' : 'password'}
                    required
                    value={emailCurrentPassword}
                    onChange={(e) => setEmailCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-3 pr-10 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmailPassword(!showEmailPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showEmailPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={changingEmail}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{changingEmail ? 'Updating Email...' : 'Save New Email'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 3: Change Password */}
        {activeTab === 'password' && (
          <div className="py-5">
            <p className="text-xs text-slate-500 mb-4">
              Update your account password. Passwords must be at least 8 characters long.
            </p>

            {passSuccessMsg && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{passSuccessMsg}</span>
              </div>
            )}

            {passErrorMsg && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{passErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Current Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassOld ? 'text' : 'password'}
                    required
                    value={passCurrentPassword}
                    onChange={(e) => setPassCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-3 pr-10 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassOld(!showPassOld)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Password (Minimum 8 characters) *
                </label>
                <div className="relative">
                  <input
                    type={showPassNew ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3 pr-10 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassNew(!showPassNew)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{changingPassword ? 'Updating Password...' : 'Save New Password'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 4: Super Admin Recovery (Phase 2 & 8 requirement: Super Admin must never be locked out) */}
        {isOwner && activeTab === 'recovery' && (
          <div className="py-5 space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-sm">
                <Crown className="w-4 h-4 text-amber-600" />
                <span>Super Admin Lockout Prevention Guarantee</span>
              </div>
              <p className="leading-relaxed">
                As Software Owner (Ahmad Waheed Ahmad), your account holds the persistent <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">isOwner = 1</code> cryptographic credential in the database. Even if you update your email address or password, your administrative privileges remain permanently intact.
              </p>
            </div>

            <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3 text-xs font-mono">
              <div className="text-amber-400 font-bold">EMERGENCY OWNER CREDENTIALS</div>
              <div>
                <span className="text-slate-400">Software Product: </span>
                <span>EDU.pro School ERP</span>
              </div>
              <div>
                <span className="text-slate-400">Master Owner Account: </span>
                <span className="text-amber-300">{currentUser.email}</span>
              </div>
              <div>
                <span className="text-slate-400">Institutional School ID: </span>
                <span className="text-emerald-300">school_primary</span>
              </div>
              <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                Backup emergency contacts: +92 300 7589214
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
