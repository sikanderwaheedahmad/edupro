/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  ArrowRight,
  Crown,
  ShieldCheck,
  Phone,
} from 'lucide-react';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase.ts';
import { AppUser } from '../types/auth.ts';
import { SchoolProfile } from '../types/school.ts';
import { getSchoolLogoSrc } from '../utils/schoolBranding.ts';

interface LoginPageProps {
  schoolProfile: SchoolProfile;
  onLoginSuccess: (user: AppUser, sessionToken?: string) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ schoolProfile, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Forgot Password & Super Admin Recovery Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotTab, setForgotTab] = useState<'reset' | 'owner_recovery'>('reset');
  const [forgotEmail, setForgotEmail] = useState('');
  const [submittingForgot, setSubmittingForgot] = useState(false);
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState('');
  const [forgotErrorMsg, setForgotErrorMsg] = useState('');

  // Owner Recovery Specific Fields
  const [recoveryPhone, setRecoveryPhone] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoveringOwner, setRecoveringOwner] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState('');
  const [recoveryError, setRecoveryError] = useState('');

  // Forced password change modal state (First-time login with temporary password)
  const [tempUser, setTempUser] = useState<AppUser | null>(null);
  const [tempSessionToken, setTempSessionToken] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePassError, setChangePassError] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email address and password.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid credentials or inactive account.');
      }

      const user: AppUser = data.user;
      const sessionToken: string = data.sessionToken || '';

      // Parallel sync to Firebase Auth client instance
      try {
        if (user.email) {
          await signInWithEmailAndPassword(auth, user.email, password).catch((fbErr) => {
            console.log('[LoginPage] Firebase client auth synchronized or fallback to HMAC session:', fbErr?.code || fbErr?.message);
          });
        }
      } catch {
        // Safe fallback
      }

      // Check if user requires password change
      if (user.requiresPasswordChange) {
        setTempUser(user);
        setTempSessionToken(sessionToken);
      } else {
        onLoginSuccess(user, sessionToken);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempUser) return;
    if (newPassword.length < 8) {
      setChangePassError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangePassError('Passwords do not match.');
      return;
    }

    setChangingPass(true);
    setChangePassError('');

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: tempUser.uid, newPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update password.');
      }

      // Password changed successfully; log in user with active session
      const updatedUser: AppUser = {
        ...tempUser,
        requiresPasswordChange: false,
        isTemporaryPassword: false,
      };
      setTempUser(null);
      onLoginSuccess(updatedUser, tempSessionToken);
    } catch (err: any) {
      setChangePassError(err.message || 'Error updating password.');
    } finally {
      setChangingPass(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotErrorMsg('Please enter your registered email address.');
      return;
    }

    setSubmittingForgot(true);
    setForgotSuccessMsg('');
    setForgotErrorMsg('');

    try {
      // 1. Trigger Firebase Authentication Password Reset Email
      try {
        await sendPasswordResetEmail(auth, forgotEmail.trim());
      } catch (fbErr: any) {
        console.warn('Firebase sendPasswordResetEmail notice:', fbErr);
      }

      // 2. Submit to ERP reset queue for multi-layer support
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });

      const data = await res.json();
      setForgotSuccessMsg(
        `A password reset link has been dispatched to ${forgotEmail.trim()} via Firebase Authentication. If you are the Software Owner (Super Admin), you can also use the Owner Recovery tab above to set a new password immediately.`
      );
    } catch (err: any) {
      setForgotErrorMsg(err.message || 'Unable to submit request. Please try again.');
    } finally {
      setSubmittingForgot(false);
    }
  };

  const handleOwnerRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim() || !recoveryPhone.trim() || !recoveryNewPassword) {
      setRecoveryError('Please fill in all recovery fields: Registered Email, Phone, and New Password.');
      return;
    }
    if (recoveryNewPassword.length < 8) {
      setRecoveryError('New password must be at least 8 characters long.');
      return;
    }

    setRecoveringOwner(true);
    setRecoveryError('');
    setRecoverySuccess('');

    try {
      const res = await fetch('/api/auth/owner-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          phone: recoveryPhone.trim(),
          newPassword: recoveryNewPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Owner recovery failed.');
      }

      setRecoverySuccess(
        data.message || 'Super Admin password updated successfully! You can now log in.'
      );
      setEmail(forgotEmail.trim());
      setPassword(recoveryNewPassword);
    } catch (err: any) {
      setRecoveryError(err.message || 'Recovery failed. Please verify your registered details.');
    } finally {
      setRecoveringOwner(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-amber-500 selection:text-slate-950">
      {/* Background radial gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Central Multi-School SaaS Platform Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-semibold mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>EDU.pro Multi-School SaaS Cloud</span>
          </div>

          <div className="inline-flex p-1.5 bg-white rounded-2xl shadow-xl border-2 border-amber-400 mb-2">
            <img
              src={getSchoolLogoSrc(schoolProfile)}
              alt="Platform Logo"
              className="w-14 h-14 rounded-xl object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            EDU.pro ERP
          </h2>
          <p className="text-xs font-medium text-slate-300 mt-0.5">
            Centralized Multi-School Management System
          </p>
          <div className="flex items-center justify-center gap-2 mt-2 text-[11px] text-amber-300/90 font-medium">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Single Central Login • Auto-routes to your School Dashboard</span>
          </div>
        </div>

        {/* Clean Login Card */}
        <div className="bg-slate-900/90 backdrop-blur-md py-8 px-6 sm:px-10 shadow-2xl rounded-2xl border border-slate-800 relative">
          <div className="mb-6 pb-4 border-b border-slate-800">
            <h3 className="text-base font-bold text-white">Sign In to Workspace</h3>
            <p className="text-xs text-slate-400 mt-0.5">Enter your school credentials to access your ERP dashboard</p>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Email, Username or Phone
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. principal.alhuda@edupro.pk"
                  autoComplete="username"
                  className="block w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotSuccessMsg('');
                    setForgotErrorMsg('');
                    setShowForgotModal(true);
                  }}
                  className="text-[11px] text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-9 pr-10 py-2.5 text-xs sm:text-sm bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 focus:outline-hidden cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold text-sm shadow-md transition-colors disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Login</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer: Strictly "Designed by EDU.pro" */}
        <div className="mt-8 text-center text-xs text-slate-500 font-medium tracking-wide">
          Designed by EDU.pro
        </div>
      </div>

      {/* Forgot Password & Super Admin Recovery Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Account & Password Recovery</h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">EDU.pro Auth</span>
            </div>

            {/* Sub-Tabs: Standard Email Reset vs Super Admin Owner Recovery */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl mb-4 border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setForgotTab('reset')}
                className={`py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  forgotTab === 'reset'
                    ? 'bg-slate-800 text-white font-bold shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Send Reset Link</span>
              </button>
              <button
                type="button"
                onClick={() => setForgotTab('owner_recovery')}
                className={`py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  forgotTab === 'owner_recovery'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                    : 'text-amber-400/80 hover:text-amber-300'
                }`}
              >
                <Crown className="w-3.5 h-3.5" />
                <span>Super Admin Recovery</span>
              </button>
            </div>

            {/* TAB 1: Send Firebase Password Reset Link */}
            {forgotTab === 'reset' && (
              <div>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  Enter your registered email address. Firebase Authentication will send a secure password reset link to your email inbox.
                </p>

                {forgotSuccessMsg && (
                  <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-2.5 text-xs text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{forgotSuccessMsg}</span>
                  </div>
                )}

                {forgotErrorMsg && (
                  <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-xs text-rose-300">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{forgotErrorMsg}</span>
                  </div>
                )}

                {!forgotSuccessMsg ? (
                  <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Registered Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="name@gmail.com / name@siqarah-shorkot.edu.pk"
                        className="block w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowForgotModal(false)}
                        className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-750 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingForgot}
                        className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm disabled:opacity-50 transition-colors"
                      >
                        {submittingForgot ? 'Sending Link...' : 'Send Reset Link'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="px-5 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-750 rounded-lg transition-colors"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Super Admin Owner Verified Recovery */}
            {forgotTab === 'owner_recovery' && (
              <div>
                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1.5 text-xs text-amber-200">
                  <div className="font-bold flex items-center gap-1.5 text-amber-300">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span>Original Super Admin Account Info</span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-300 space-y-0.5">
                    <div>Software Owner: <strong className="text-white">Ahmad Waheed Ahmad</strong></div>
                    <div>Account UID: <code className="text-amber-300 font-bold">usr_owner_001</code></div>
                    <div>Registered Email: <code className="text-amber-300 font-bold">ahmadwaheedahmad57@gmail.com</code></div>
                    <div>Registered Phone: <code className="text-slate-300">+92 300 7589214</code></div>
                  </div>
                  <p className="text-[11px] text-slate-400 pt-1 leading-normal">
                    Verify your registered phone number below to set a fresh permanent password directly on your original account.
                  </p>
                </div>

                {recoverySuccess && (
                  <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-2.5 text-xs text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">Password Reset Successful!</div>
                      <div>{recoverySuccess}</div>
                    </div>
                  </div>
                )}

                {recoveryError && (
                  <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-xs text-rose-300">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{recoveryError}</span>
                  </div>
                )}

                {!recoverySuccess ? (
                  <form onSubmit={handleOwnerRecoverySubmit} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Original Registered Email
                      </label>
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="ahmadwaheedahmad57@gmail.com"
                        className="block w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Registered Phone Number (Verification)
                      </label>
                      <input
                        type="text"
                        required
                        value={recoveryPhone}
                        onChange={(e) => setRecoveryPhone(e.target.value)}
                        placeholder="+92 300 7589214"
                        className="block w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        New Confidential Password (Min. 8 chars)
                      </label>
                      <input
                        type="password"
                        required
                        value={recoveryNewPassword}
                        onChange={(e) => setRecoveryNewPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="block w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowForgotModal(false)}
                        className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-750 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={recoveringOwner}
                        className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm disabled:opacity-50 transition-colors"
                      >
                        {recoveringOwner ? 'Verifying & Updating...' : 'Set New Password'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors font-bold"
                    >
                      Proceed to Login
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Forced First-Time Password Change Modal */}
      {tempUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-md w-full p-6 text-white shadow-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-semibold mb-3">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Mandatory Password Setup</span>
            </div>
            <h3 className="text-base font-bold text-white mb-1">
              Welcome, {tempUser.name}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              You are logging in with a temporary password. You must set a permanent, confidential password to secure your account before proceeding.
            </p>

            {changePassError && (
              <div className="mb-4 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                {changePassError}
              </div>
            )}

            <form onSubmit={handlePasswordChangeSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  New Password (Minimum 8 chars)
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setTempUser(null)}
                  className="w-1/3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changingPass}
                  className="w-2/3 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {changingPass ? 'Saving Password...' : 'Save & Enter ERP'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
