/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  School,
  FileText,
  Download,
  ShieldCheck,
  Users,
  Settings,
  Trash2,
  Briefcase,
  Award,
  ChevronDown,
  Layers,
  GraduationCap,
  History,
  LogOut,
  ShieldAlert,
  Crown,
  KeyRound,
  Activity,
  Building2,
} from 'lucide-react';
import { SchoolProfile, UserRole } from '../types/school.ts';
import { AppUser } from '../types/auth.ts';
import { hasTabAccess, OWNER_EMAIL } from '../utils/permissions.ts';
import { getSchoolLogoSrc } from '../utils/schoolBranding.ts';

export type AppTab =
  | 'welcome'
  | 'admission'
  | 'class_sections'
  | 'promotions'
  | 'student_history'
  | 'fees'
  | 'students'
  | 'staff'
  | 'hr_letters'
  | 'student_certs'
  | 'forms'
  | 'exports'
  | 'settings'
  | 'user_management'
  | 'audit_logs'
  | 'multi_schools';

interface HeaderProps {
  currentTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  unpaidCount?: number;
  recycleBinCount?: number;
  schoolProfile: SchoolProfile;
  currentUser: AppUser;
  onLogout: () => void;
  onOpenProfileModal: () => void;
  onOpenRecycleBin: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  unpaidCount = 0,
  recycleBinCount = 0,
  schoolProfile,
  currentUser,
  onLogout,
  onOpenProfileModal,
  onOpenRecycleBin,
}) => {
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const logoSrc = getSchoolLogoSrc(schoolProfile);
  const role = currentUser.role;
  const isOwner = currentUser.isOwner || currentUser.email.toLowerCase() === OWNER_EMAIL.toLowerCase();

  const roles: UserRole[] = [
    'Super Admin',
    'Principal',
    'HR',
    'Clerk',
    'Accountant',
    'Teacher',
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 text-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Wordmark with official school logo */}
          <div
            onClick={() => onSelectTab(hasTabAccess(role, 'welcome') ? 'welcome' : ('fees' as AppTab))}
            className="flex items-center gap-2.5 cursor-pointer shrink-0"
          >
            <img
              src={logoSrc}
              alt="Siqarah Public Model High School Logo"
              className="w-10 h-10 rounded-full border border-amber-400/50 object-contain bg-white p-0.5"
              referrerPolicy="no-referrer"
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-sm sm:text-base font-bold tracking-tight text-white whitespace-nowrap">
                  {schoolProfile.schoolName || 'Siqarah Public High School'}
                </span>
                {schoolProfile.schoolCode && (
                  <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/40">
                    {schoolProfile.schoolCode}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-400 hidden sm:inline whitespace-nowrap">
                {schoolProfile.board ? `BISE ${schoolProfile.board} · ${schoolProfile.campusAddress}` : 'BISE Gujranwala · Shorkot'}
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links — strictly filtered by role permissions */}
          <nav className="hidden xl:flex items-center gap-3 text-xs xl:text-[13px] font-medium">
            {hasTabAccess(role, 'welcome') && (
              <button
                onClick={() => onSelectTab('welcome')}
                className={`whitespace-nowrap transition-colors py-1 ${
                  currentTab === 'welcome'
                    ? 'text-amber-400 font-bold border-b-2 border-amber-400'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Overview
              </button>
            )}

            {hasTabAccess(role, 'admission') && (
              <button
                onClick={() => onSelectTab('admission')}
                className={`whitespace-nowrap transition-colors py-1 ${
                  currentTab === 'admission'
                    ? 'text-amber-400 font-bold border-b-2 border-amber-400'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Admission
              </button>
            )}

            {hasTabAccess(role, 'class_sections') && (
              <button
                onClick={() => onSelectTab('class_sections')}
                className={`whitespace-nowrap transition-colors py-1 flex items-center gap-1 ${
                  currentTab === 'class_sections'
                    ? 'text-amber-400 font-bold border-b-2 border-amber-400'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>Classes</span>
              </button>
            )}

            {hasTabAccess(role, 'promotions') && (
              <button
                onClick={() => onSelectTab('promotions')}
                className={`whitespace-nowrap transition-colors py-1 flex items-center gap-1 ${
                  currentTab === 'promotions'
                    ? 'text-amber-400 font-bold border-b-2 border-amber-400'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
                <span>Promotions</span>
              </button>
            )}

            {hasTabAccess(role, 'student_history') && (
              <button
                onClick={() => onSelectTab('student_history')}
                className={`whitespace-nowrap transition-colors py-1 flex items-center gap-1 ${
                  currentTab === 'student_history'
                    ? 'text-amber-400 font-bold border-b-2 border-amber-400'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5 text-blue-400" />
                <span>History</span>
              </button>
            )}

            {hasTabAccess(role, 'fees') && (
              <button
                onClick={() => onSelectTab('fees')}
                className={`whitespace-nowrap transition-colors py-1 flex items-center gap-1.5 ${
                  currentTab === 'fees'
                    ? 'text-amber-400 font-bold border-b-2 border-amber-400'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <span>Fee Desk</span>
                {unpaidCount > 0 && (
                  <span className="text-[10px] font-tabular bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/30">
                    {unpaidCount}
                  </span>
                )}
              </button>
            )}

            {hasTabAccess(role, 'students') && (
              <button
                onClick={() => onSelectTab('students')}
                className={`whitespace-nowrap transition-colors py-1 ${
                  currentTab === 'students'
                    ? 'text-amber-400 font-bold border-b-2 border-amber-400'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Students
              </button>
            )}

            {hasTabAccess(role, 'staff') && (
              <button
                onClick={() => onSelectTab('staff')}
                className={`whitespace-nowrap transition-colors py-1 ${
                  currentTab === 'staff'
                    ? 'text-amber-400 font-bold border-b-2 border-amber-400'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Staff
              </button>
            )}

            {hasTabAccess(role, 'hr_letters') && (
              <button
                onClick={() => onSelectTab('hr_letters')}
                className={`whitespace-nowrap transition-colors py-1 flex items-center gap-1 ${
                  currentTab === 'hr_letters'
                    ? 'text-amber-400 font-bold border-b-2 border-amber-400'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                <span>HR Letters</span>
              </button>
            )}

            {hasTabAccess(role, 'student_certs') && (
              <button
                onClick={() => onSelectTab('student_certs')}
                className={`whitespace-nowrap transition-colors py-1 flex items-center gap-1 ${
                  currentTab === 'student_certs'
                    ? 'text-amber-400 font-bold border-b-2 border-amber-400'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Award className="w-3.5 h-3.5 text-blue-400" />
                <span>Certificates</span>
              </button>
            )}

            {hasTabAccess(role, 'forms') && (
              <button
                onClick={() => onSelectTab('forms')}
                className={`whitespace-nowrap transition-colors py-1 flex items-center gap-1 ${
                  currentTab === 'forms'
                    ? 'text-amber-400 font-bold border-b-2 border-amber-400'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Templates</span>
              </button>
            )}

            {hasTabAccess(role, 'exports') && (
              <button
                onClick={() => onSelectTab('exports')}
                className={`whitespace-nowrap transition-colors py-1 flex items-center gap-1 ${
                  currentTab === 'exports'
                    ? 'text-amber-400 font-bold border-b-2 border-amber-400'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export</span>
              </button>
            )}

            {/* Super Admin Exclusive: Multi-School SaaS */}
            {role === 'Super Admin' && (
              <button
                onClick={() => onSelectTab('multi_schools')}
                className={`whitespace-nowrap transition-colors py-1 flex items-center gap-1.5 ${
                  currentTab === 'multi_schools'
                    ? 'text-amber-400 font-bold border-b-2 border-amber-400'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Multi-School SaaS</span>
              </button>
            )}

            {/* School User Management (Super Admin & Principal) */}
            {hasTabAccess(role, 'user_management') && (
              <button
                onClick={() => onSelectTab('user_management')}
                className={`whitespace-nowrap transition-colors py-1 flex items-center gap-1.5 ${
                  currentTab === 'user_management'
                    ? 'text-amber-400 font-bold border-b-2 border-amber-400'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span>Users & Roles</span>
              </button>
            )}

            {hasTabAccess(role, 'settings') && (
              <button
                onClick={() => onSelectTab('settings')}
                className={`whitespace-nowrap transition-colors py-1 flex items-center gap-1 ${
                  currentTab === 'settings'
                    ? 'text-amber-400 font-bold border-b-2 border-amber-400'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                <span>Settings</span>
              </button>
            )}
          </nav>

          {/* User profile & Action controls */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* User Profile & Account Settings Button */}
            <button
              onClick={onOpenProfileModal}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 transition-colors cursor-pointer"
              title="Open Profile & Account Settings"
            >
              <div className="w-5 h-5 rounded-full bg-slate-900 text-amber-400 font-bold flex items-center justify-center text-[10px] border border-amber-500/30">
                {isOwner ? '👑' : currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="font-bold text-white text-[11px] leading-tight truncate max-w-[120px]">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-amber-400 font-medium leading-tight">
                  {role}
                </span>
              </div>
            </button>

            {/* Recycle Bin (Permitted for Principal and Super Admin) */}
            {(role === 'Super Admin' || role === 'Principal') && (
              <button
                onClick={onOpenRecycleBin}
                className="relative p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-400 border border-slate-700 rounded-lg transition-colors"
                title="Recycle Bin & Safe Restore"
              >
                <Trash2 className="w-4 h-4" />
                {recycleBinCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center font-mono">
                    {recycleBinCount}
                  </span>
                )}
              </button>
            )}

            {/* Clearly Visible Logout Button */}
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 hover:border-rose-600 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
              title="Sign Out of EduManage Pro (Requires Confirmation)"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
              <span className="sm:hidden">Exit</span>
            </button>
          </div>
        </div>

        {/* Mobile / Compact Secondary Navigation */}
        <div className="flex xl:hidden items-center overflow-x-auto py-2 border-t border-slate-800 text-xs gap-1.5 no-scrollbar">
          {hasTabAccess(role, 'welcome') && (
            <button
              onClick={() => onSelectTab('welcome')}
              className={`whitespace-nowrap py-1 px-2.5 rounded-md ${
                currentTab === 'welcome' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300'
              }`}
            >
              Overview
            </button>
          )}
          {hasTabAccess(role, 'admission') && (
            <button
              onClick={() => onSelectTab('admission')}
              className={`whitespace-nowrap py-1 px-2.5 rounded-md ${
                currentTab === 'admission' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300'
              }`}
            >
              Admission
            </button>
          )}
          {hasTabAccess(role, 'class_sections') && (
            <button
              onClick={() => onSelectTab('class_sections')}
              className={`whitespace-nowrap py-1 px-2.5 rounded-md ${
                currentTab === 'class_sections' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300'
              }`}
            >
              Classes
            </button>
          )}
          {hasTabAccess(role, 'promotions') && (
            <button
              onClick={() => onSelectTab('promotions')}
              className={`whitespace-nowrap py-1 px-2.5 rounded-md ${
                currentTab === 'promotions' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300'
              }`}
            >
              Promotions
            </button>
          )}
          {hasTabAccess(role, 'fees') && (
            <button
              onClick={() => onSelectTab('fees')}
              className={`whitespace-nowrap py-1 px-2.5 rounded-md ${
                currentTab === 'fees' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300'
              }`}
            >
              Fees ({unpaidCount})
            </button>
          )}
          {hasTabAccess(role, 'students') && (
            <button
              onClick={() => onSelectTab('students')}
              className={`whitespace-nowrap py-1 px-2.5 rounded-md ${
                currentTab === 'students' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300'
              }`}
            >
              Students
            </button>
          )}
          {hasTabAccess(role, 'staff') && (
            <button
              onClick={() => onSelectTab('staff')}
              className={`whitespace-nowrap py-1 px-2.5 rounded-md ${
                currentTab === 'staff' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300'
              }`}
            >
              Staff
            </button>
          )}
          {hasTabAccess(role, 'hr_letters') && (
            <button
              onClick={() => onSelectTab('hr_letters')}
              className={`whitespace-nowrap py-1 px-2.5 rounded-md ${
                currentTab === 'hr_letters' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300'
              }`}
            >
              HR Letters
            </button>
          )}
          {hasTabAccess(role, 'student_certs') && (
            <button
              onClick={() => onSelectTab('student_certs')}
              className={`whitespace-nowrap py-1 px-2.5 rounded-md ${
                currentTab === 'student_certs' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300'
              }`}
            >
              Certificates
            </button>
          )}
          {role === 'Super Admin' && (
            <>
              <button
                onClick={() => onSelectTab('multi_schools')}
                className={`whitespace-nowrap py-1 px-2.5 rounded-md ${
                  currentTab === 'multi_schools' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300'
                }`}
              >
                Multi-School SaaS
              </button>
              <button
                onClick={() => onSelectTab('user_management')}
                className={`whitespace-nowrap py-1 px-2.5 rounded-md ${
                  currentTab === 'user_management' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300'
                }`}
              >
                Users & Roles
              </button>
            </>
          )}
          {hasTabAccess(role, 'settings') && (
            <button
              onClick={() => onSelectTab('settings')}
              className={`whitespace-nowrap py-1 px-2.5 rounded-md ${
                currentTab === 'settings' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300'
              }`}
            >
              Settings
            </button>
          )}

          <button
            onClick={onLogout}
            className="whitespace-nowrap py-1 px-2.5 rounded-md bg-rose-600/20 text-rose-300 font-bold flex items-center gap-1 border border-rose-500/30 ml-auto shrink-0"
          >
            <LogOut className="w-3 h-3" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
