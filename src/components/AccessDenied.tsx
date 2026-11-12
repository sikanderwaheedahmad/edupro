/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldAlert, LogOut, School, CheckCircle2 } from 'lucide-react';
import { AppUser } from '../types/auth.ts';
import { SchoolProfile } from '../types/school.ts';
import { getSchoolLogoSrc } from '../utils/schoolBranding.ts';

interface AccessDeniedProps {
  user: AppUser;
  schoolProfile: SchoolProfile;
  onLogout: () => void;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({
  user,
  schoolProfile,
  onLogout,
}) => {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-md w-full bg-slate-850 rounded-2xl border border-slate-800 shadow-2xl p-8 text-center text-white relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-amber-500 shadow-[0_0_20px_#f59e0b]"></div>

        {/* School Logo */}
        <div className="mx-auto w-20 h-20 rounded-full border-2 border-amber-400/60 p-1 bg-white flex items-center justify-center mb-6 shadow-md overflow-hidden">
          <img
            src={getSchoolLogoSrc(schoolProfile)}
            alt="School Logo"
            className="w-full h-full object-contain rounded-full"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 text-xs font-semibold mb-3">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Access Restricted</span>
        </div>

        <h1 className="text-xl font-bold text-white tracking-tight mb-2">
          Administrative Privileges Required
        </h1>
        <p className="text-xs text-amber-300 font-medium mb-4">
          Your account does not currently have administrative management permissions.
        </p>

        <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/80 mb-6 text-left">
          <div className="text-xs text-slate-400 mb-1">Logged In Account:</div>
          <div className="text-sm font-bold text-white flex items-center justify-between">
            <span>{user.name}</span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
              Role: {user.role}
            </span>
          </div>
          <div className="text-xs text-slate-400 font-mono mt-0.5">{user.email}</div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed mb-6">
          According to EduManage Pro security policies, members registered with the{' '}
          <strong className="text-white">"{user.role}"</strong> role do not have administrative or record modification permissions. If you require access to attendance, exam rosters, or student records, please contact your school Principal or System Administrator.
        </p>

        <button
          onClick={onLogout}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-sm font-semibold transition-colors shadow-sm cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-rose-400" />
          <span>Sign Out</span>
        </button>
      </div>

      <div className="mt-8 text-center text-xs text-slate-500">
        <p>{schoolProfile.schoolName}</p>
        <p className="text-[11px] text-slate-600 mt-0.5">EduManage Pro · Final Secure Multi-User ERP</p>
      </div>
    </div>
  );
};
