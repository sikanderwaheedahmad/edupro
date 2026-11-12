/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header, AppTab } from './components/Header.tsx';
import { WelcomeScreen } from './components/WelcomeScreen.tsx';
import { AdmissionForm } from './components/AdmissionForm.tsx';
import { ClassSectionManager } from './components/ClassSectionManager.tsx';
import { StudentPromotionManager } from './components/StudentPromotionManager.tsx';
import { StudentHistoryManager } from './components/StudentHistoryManager.tsx';
import { FeeManagement } from './components/FeeManagement.tsx';
import { StudentDirectory } from './components/StudentDirectory.tsx';
import { StaffDirectory } from './components/StaffDirectory.tsx';
import { HRLetters } from './components/HRLetters.tsx';
import { StudentCertificates } from './components/StudentCertificates.tsx';
import { FormsAndCertificates } from './components/FormsAndCertificates.tsx';
import { ExportRecords } from './components/ExportRecords.tsx';
import { SchoolSettings } from './components/SchoolSettings.tsx';
import { LoginPage } from './components/LoginPage.tsx';
import { AccessDenied } from './components/AccessDenied.tsx';
import { UserManagement } from './components/UserManagement.tsx';
import { MultiSchoolManager } from './components/MultiSchoolManager.tsx';
import { AppUser } from './types/auth.ts';
import { hasTabAccess, getDefaultTabForRole, OWNER_EMAIL } from './utils/permissions.ts';
import { UserProfileModal } from './components/UserProfileModal.tsx';
import { auth, signOut, onAuthStateChanged } from './lib/firebase.ts';
import { LogOut } from 'lucide-react';
import { VoucherModal } from './components/VoucherModal.tsx';
import { VoucherAuditModal } from './components/VoucherAuditModal.tsx';
import { RecycleBinModal } from './components/RecycleBinModal.tsx';
import {
  SchoolProfile,
  StudentRecord,
  FeeVoucher,
  DashboardStats,
  StaffRecord,
  CertificateRecord,
  ExamResultRecord,
  UserRole,
} from './types/school.ts';
import { getSchoolLogoSrc } from './utils/schoolBranding.ts';

const FALLBACK_SCHOOL_PROFILE: SchoolProfile = {
  schoolName: 'Siqarah Public Model High School Shorkot',
  schoolNameUrdu: '',
  board: 'BISE Gujranwala',
  principal: 'Dr. Saeed Ahmad',
  introduction:
    'Siqarah Public Model High School Shorkot is committed to providing quality education, developing strong moral values, maintaining discipline, and nurturing students’ academic and practical abilities. Our mission is to prepare students for a successful future through knowledge, confidence, responsibility, and continuous learning.',
  campusAddress: 'Main Circular Road, Model Town, Shorkot, Punjab, Pakistan',
  phone: '+92 47 5310921 / +92 300 7589214',
  email: 'admissions@siqarah-shorkot.edu.pk',
  availableClasses: [
    'Play Group',
    'Nursery',
    'Prep',
    'Class 1',
    'Class 2',
    'Class 3',
    'Class 4',
    'Class 5',
    'Class 6',
    'Class 7',
    'Class 8',
    'Class 9',
    'Class 10',
  ],
  academicSessions: ['2026-2027', '2025-2026', '2024-2025'],
  activeSession: '2026-2027',
  logoUrl: '/assets/school_logo.jpg',
  campusPicUrl: '/assets/school_building.jpg',
  stampUrl: '/assets/school_stamp.jpg',
};

const TEST_USERS_MAP: Record<UserRole, AppUser> = {
  'Super Admin': {
    uid: 'usr_owner_001',
    email: OWNER_EMAIL,
    name: 'Ahmad Waheed Ahmad (Software Owner)',
    phone: '+92 300 7589214',
    role: 'Super Admin',
    schoolId: 'school_primary',
    status: 'ACTIVE',
    isTemporaryPassword: false,
    requiresPasswordChange: false,
    isTestAccount: false,
    isOwner: true,
    createdBy: 'System Bootstrap',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  'Principal': {
    uid: 'usr_test_principal',
    email: 'test.principal@siqarah-shorkot.edu.pk',
    name: '[TEST] Dr. Saeed Ahmad (Principal)',
    phone: '+92 300 7589215',
    role: 'Principal',
    schoolId: 'school_primary',
    status: 'ACTIVE',
    isTemporaryPassword: false,
    requiresPasswordChange: false,
    isTestAccount: true,
    isOwner: false,
    createdBy: 'System Bootstrap',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  'HR': {
    uid: 'usr_test_hr',
    email: 'test.hr@siqarah-shorkot.edu.pk',
    name: '[TEST] Muhammad Rizwan (HR Officer)',
    phone: '+92 300 7589216',
    role: 'HR',
    schoolId: 'school_primary',
    status: 'ACTIVE',
    isTemporaryPassword: false,
    requiresPasswordChange: false,
    isTestAccount: true,
    isOwner: false,
    createdBy: 'System Bootstrap',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  'Clerk': {
    uid: 'usr_test_clerk',
    email: 'test.clerk@siqarah-shorkot.edu.pk',
    name: '[TEST] Tariq Mehmood (Admission Clerk)',
    phone: '+92 300 7589217',
    role: 'Clerk',
    schoolId: 'school_primary',
    status: 'ACTIVE',
    isTemporaryPassword: false,
    requiresPasswordChange: false,
    isTestAccount: true,
    isOwner: false,
    createdBy: 'System Bootstrap',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  'Accountant': {
    uid: 'usr_test_accountant',
    email: 'test.accountant@siqarah-shorkot.edu.pk',
    name: '[TEST] Farooq Azam (Accounts Officer)',
    phone: '+92 300 7589218',
    role: 'Accountant',
    schoolId: 'school_primary',
    status: 'ACTIVE',
    isTemporaryPassword: false,
    requiresPasswordChange: false,
    isTestAccount: true,
    isOwner: false,
    createdBy: 'System Bootstrap',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  'Teacher': {
    uid: 'usr_test_teacher',
    email: 'test.teacher@siqarah-shorkot.edu.pk',
    name: '[TEST] Usman Tariq (Senior Teacher)',
    phone: '+92 300 7589219',
    role: 'Teacher',
    schoolId: 'school_primary',
    status: 'ACTIVE',
    isTemporaryPassword: false,
    requiresPasswordChange: false,
    isTestAccount: true,
    isOwner: false,
    createdBy: 'System Bootstrap',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      const saved = localStorage.getItem('edupro_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [authChecking, setAuthChecking] = useState<boolean>(() => {
    const token = localStorage.getItem('edupro_session_token');
    const stored = localStorage.getItem('edupro_current_user');
    return Boolean(token && stored);
  });

  const [userRole, setUserRole] = useState<UserRole>(currentUser ? currentUser.role : 'Super Admin');

  const [currentTab, setCurrentTab] = useState<AppTab>(() => {
    const savedTab = localStorage.getItem('edupro_active_tab') as AppTab | null;
    if (savedTab) return savedTab;
    return currentUser ? getDefaultTabForRole(currentUser.role) : 'welcome';
  });

  const handleSelectTab = useCallback((tab: AppTab) => {
    setCurrentTab(tab);
    localStorage.setItem('edupro_active_tab', tab);
  }, []);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  // Browser Back button guard & session verification on startup
  useEffect(() => {
    const handlePopState = () => {
      const stored = localStorage.getItem('edupro_current_user');
      if (!stored) {
        setCurrentUser(null);
        window.history.replaceState(null, '', '/login');
      }
    };
    window.addEventListener('popstate', handlePopState);

    // Firebase Auth State Listener
    const unsubscribeFb = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        console.log('Firebase Auth session active:', fbUser.email);
      }
    });

    // Verify session token on initial mount
    const token = localStorage.getItem('edupro_session_token');
    const stored = localStorage.getItem('edupro_current_user');
    if (stored && token) {
      fetch('/api/auth/session', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(async (r) => {
          if (r.ok) {
            const data = await r.json();
            if (data && data.success && data.user) {
              setCurrentUser(data.user);
              setUserRole(data.user.role);
              localStorage.setItem('edupro_current_user', JSON.stringify(data.user));
              if (data.user.role !== 'Super Admin' && data.user.schoolId) {
                setCurrentSchoolId(data.user.schoolId);
                localStorage.setItem('edupro_active_school_id', data.user.schoolId);
              }
            }
          } else if (r.status === 401) {
            const errData = await r.json().catch(() => ({}));
            // Only force logout if the account is explicitly deactivated
            if (errData && errData.error && errData.error.toLowerCase().includes('deactivated')) {
              localStorage.removeItem('edupro_current_user');
              localStorage.removeItem('edupro_session_token');
              localStorage.removeItem('edupro_active_tab');
              sessionStorage.clear();
              setCurrentUser(null);
            } else {
              // Maintain local session during temporary server restart or network hiccup
              console.warn('Session verification fallback, maintaining local session.');
            }
          }
        })
        .catch((err) => {
          // Network interruption or server restart - keep user logged in with stored credentials!
          console.warn('Network interruption during session verification, keeping current user logged in.', err);
        })
        .finally(() => {
          setAuthChecking(false);
        });
    } else if (!stored) {
      setCurrentUser(null);
      setAuthChecking(false);
    } else {
      setAuthChecking(false);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
      unsubscribeFb();
    };
  }, []);

  // Rolling session keep-alive: silent background ping every 10 minutes to refresh rolling HMAC session
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      const token = localStorage.getItem('edupro_session_token');
      if (!token) return;
      fetch('/api/auth/session', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data && data.success && data.user) {
            localStorage.setItem('edupro_current_user', JSON.stringify(data.user));
          }
        })
        .catch(() => {
          // Swallow transient network dips
        });
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [currentUser]);

  const [currentSchoolId, setCurrentSchoolId] = useState<string>(() => {
    const storedUser = localStorage.getItem('edupro_current_user');
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        if (u && u.role !== 'Super Admin' && u.schoolId) {
          return u.schoolId;
        }
      } catch {}
    }
    return localStorage.getItem('edupro_active_school_id') || 'school_primary';
  });

  const [schoolProfile, setSchoolProfile] = useState<SchoolProfile>(FALLBACK_SCHOOL_PROFILE);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [vouchers, setVouchers] = useState<FeeVoucher[]>([]);
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [examResults, setExamResults] = useState<ExamResultRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Voucher Modal State
  const [activeVoucher, setActiveVoucher] = useState<FeeVoucher | null>(null);
  const [activeStudent, setActiveStudent] = useState<StudentRecord | null>(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);

  // Audit Modal State
  const [auditVoucher, setAuditVoucher] = useState<FeeVoucher | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Helper for multi-tenant and authenticated request headers
  const getApiHeaders = useCallback(
    (extra: Record<string, string> = {}) => {
      const headers: Record<string, string> = {
        'x-school-id': currentSchoolId,
        ...extra,
      };
      const token = localStorage.getItem('edupro_session_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (currentUser?.role) headers['x-user-role'] = currentUser.role;
      if (currentUser?.schoolId) headers['x-user-school-id'] = currentUser.schoolId;
      return headers;
    },
    [currentSchoolId, currentUser]
  );

  // Switch Active School Context (for Super Admin)
  const handleSwitchSchool = (newSchoolId: string) => {
    setCurrentSchoolId(newSchoolId);
    localStorage.setItem('edupro_active_school_id', newSchoolId);
  };

  // Fetch all initial data from server for current active school
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const headers = getApiHeaders();

      // If user is unauthenticated, only load public school profile for login branding
      if (!currentUser) {
        try {
          const profileRes = await fetch('/api/school-info', { headers });
          if (profileRes.ok) setSchoolProfile(await profileRes.json());
        } catch {}
        return;
      }

      const [
        profileRes,
        statsRes,
        studentsRes,
        vouchersRes,
        staffRes,
        certRes,
        examRes,
      ] = await Promise.all([
        fetch('/api/school-info', { headers }),
        fetch('/api/dashboard-stats', { headers }),
        fetch('/api/students', { headers }),
        fetch('/api/vouchers', { headers }),
        fetch('/api/staff', { headers }),
        fetch('/api/certificates', { headers }),
        fetch('/api/exam-results', { headers }),
      ]);

      if (profileRes.ok) setSchoolProfile(await profileRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (studentsRes.ok) setStudents(await studentsRes.json());
      if (vouchersRes.ok) setVouchers(await vouchersRes.json());
      if (staffRes.ok) setStaff(await staffRes.json());
      if (certRes.ok) setCertificates(await certRes.json());
      if (examRes.ok) setExamResults(await examRes.json());
    } catch (err) {
      console.error('Error fetching data from API:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser, getApiHeaders]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle successful admission creation
  const handleAdmissionSuccess = (newStudent: StudentRecord, newVoucher: FeeVoucher) => {
    setStudents((prev) => [newStudent, ...prev]);
    setVouchers((prev) => [newVoucher, ...prev]);
    fetch('/api/dashboard-stats')
      .then((res) => (res.ok ? res.json() : null))
      .then((s) => s && setStats(s))
      .catch((e) => console.error(e));
  };

  // Open voucher modal directly with voucher object
  const handleOpenVoucherModal = (voucher: FeeVoucher, student?: StudentRecord) => {
    const matchedStudent =
      student || students.find((s) => s.id === voucher.studentId) || null;
    setActiveVoucher(voucher);
    setActiveStudent(matchedStudent);
    setIsVoucherModalOpen(true);
  };

  // Open voucher by student ID
  const handleOpenVoucherByStudentId = (studentId: string) => {
    const matchedVoucher = vouchers.find((v) => v.studentId === studentId);
    const matchedStudent = students.find((s) => s.id === studentId) || null;
    if (matchedVoucher) {
      setActiveVoucher(matchedVoucher);
      setActiveStudent(matchedStudent);
      setIsVoucherModalOpen(true);
    }
  };

  // Update voucher status (UNPAID -> PAID or vice versa)
  const handleUpdateStatus = async (
    voucherId: string,
    newStatus: 'UNPAID' | 'PAID',
    notes?: string
  ) => {
    const res = await fetch(`/api/vouchers/${voucherId}/status`, {
      method: 'PATCH',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        status: newStatus,
        adminName: currentUser?.name || schoolProfile.principal || 'Administrator',
        notes,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update payment status');
    }

    setVouchers((prev) =>
      prev.map((v) => (v.id === voucherId ? data.voucher : v))
    );

    if (activeVoucher && activeVoucher.id === voucherId) {
      setActiveVoucher(data.voucher);
    }

    fetch('/api/dashboard-stats', { headers: getApiHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => s && setStats(s))
      .catch((e) => console.error(e));
  };

  // Delete Voucher (Soft Delete to Recycle Bin)
  const handleDeleteVoucher = async (voucherId: string) => {
    const res = await fetch(`/api/vouchers/${voucherId}`, {
      method: 'DELETE',
      headers: getApiHeaders({ 'x-admin-name': currentUser?.name || schoolProfile.principal || 'Administrator' }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete voucher');
    }
    loadData();
  };

  // Update Student
  const handleUpdateStudent = async (studentId: string, updated: Partial<StudentRecord>) => {
    const res = await fetch(`/api/students/${studentId}`, {
      method: 'PUT',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(updated),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update student');
    }
    loadData();
  };

  // Delete Student (Soft Delete to Recycle Bin)
  const handleDeleteStudent = async (studentId: string) => {
    const res = await fetch(`/api/students/${studentId}`, {
      method: 'DELETE',
      headers: getApiHeaders({ 'x-admin-name': currentUser?.name || schoolProfile.principal || 'Administrator' }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete student');
    }
    loadData();
  };

  // Update School Profile Settings
  const handleUpdateSchoolProfile = async (updates: Partial<SchoolProfile>) => {
    const res = await fetch('/api/school-info', {
      method: 'PATCH',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update school profile');
    }
    setSchoolProfile(data.profile);
    loadData();
  };

  // Add Staff Member
  const handleAddStaff = async (newStaffData: Omit<StaffRecord, 'id'>) => {
    const res = await fetch('/api/staff', {
      method: 'POST',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(newStaffData),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to add staff');
    }
    setStaff((prev) => [...prev, data]);
    loadData();
  };

  // Update Staff Member
  const handleUpdateStaff = async (staffId: string, updated: Partial<StaffRecord>) => {
    const res = await fetch(`/api/staff/${staffId}`, {
      method: 'PUT',
      headers: getApiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(updated),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update staff member');
    }
    loadData();
  };

  // Delete Staff Member (Soft Delete to Recycle Bin)
  const handleDeleteStaff = async (staffId: string) => {
    const res = await fetch(`/api/staff/${staffId}`, {
      method: 'DELETE',
      headers: getApiHeaders({ 'x-admin-name': currentUser?.name || schoolProfile.principal || 'Administrator' }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete staff member');
    }
    loadData();
  };

  const handleSelectStaffForDoc = (staffId: string, _docType: string) => {
    setCurrentTab('hr_letters');
  };

  const handleOpenAuditModal = (voucher: FeeVoucher) => {
    setAuditVoucher(voucher);
    setIsAuditModalOpen(true);
  };

  const unpaidCount = vouchers.filter((v) => v.status === 'UNPAID').length;
  const recycleBinCount = stats?.recycleBinCount || 0;
  const logoSrc = getSchoolLogoSrc(schoolProfile);

  const handleLoginSuccess = (user: AppUser, sessionToken?: string) => {
    setCurrentUser(user);
    setUserRole(user.role);
    localStorage.setItem('edupro_current_user', JSON.stringify(user));
    if (sessionToken) {
      localStorage.setItem('edupro_session_token', sessionToken);
    }
    if (user.role !== 'Super Admin' && user.schoolId) {
      setCurrentSchoolId(user.schoolId);
      localStorage.setItem('edupro_active_school_id', user.schoolId);
    }
    const defaultTab = getDefaultTabForRole(user.role);
    setCurrentTab(defaultTab);
    localStorage.setItem('edupro_active_tab', defaultTab);
  };

  const handleRequestLogout = () => {
    setIsLogoutModalOpen(true);
  };

  const handleConfirmedLogout = async () => {
    try {
      const token = localStorage.getItem('edupro_session_token');
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionToken: token }),
        }).catch(() => null);
      }
      await signOut(auth).catch(() => null);
    } catch (err) {
      console.warn('Sign out error:', err);
    } finally {
      localStorage.removeItem('edupro_current_user');
      localStorage.removeItem('edupro_session_token');
      localStorage.removeItem('edupro_active_tab');
      sessionStorage.clear();
      setCurrentUser(null);
      setIsLogoutModalOpen(false);
      window.history.replaceState(null, '', '/login');
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="flex flex-col items-center gap-4 text-center animate-in fade-in duration-200">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
            <div className="w-7 h-7 border-3 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-white">EduManage Pro ERP</h2>
            <p className="text-xs text-slate-400 mt-1">Verifying secure persistent session...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage schoolProfile={schoolProfile} onLoginSuccess={handleLoginSuccess} />;
  }

  if (currentUser.role === 'Teacher') {
    return <AccessDenied user={currentUser} schoolProfile={schoolProfile} onLogout={handleRequestLogout} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      {/* Top Bar Navigation */}
      <Header
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        unpaidCount={unpaidCount}
        recycleBinCount={recycleBinCount}
        schoolProfile={schoolProfile}
        currentUser={currentUser}
        onLogout={handleRequestLogout}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
        onOpenRecycleBin={() => setIsRecycleBinOpen(true)}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {currentTab === 'welcome' && (
          <WelcomeScreen
            schoolProfile={schoolProfile}
            stats={stats}
            onNavigate={handleSelectTab}
            onOpenVoucher={handleOpenVoucherByStudentId}
          />
        )}

        {currentTab === 'admission' && (
          <AdmissionForm
            schoolProfile={schoolProfile}
            onAdmissionSuccess={handleAdmissionSuccess}
            onOpenVoucherModal={handleOpenVoucherModal}
          />
        )}

        {currentTab === 'class_sections' && (
          <ClassSectionManager
            students={students}
            schoolProfile={schoolProfile}
            onRefreshStudents={loadData}
          />
        )}

        {currentTab === 'promotions' && (
          <StudentPromotionManager
            students={students}
            schoolProfile={schoolProfile}
            userRole={userRole}
            onRefreshStudents={loadData}
          />
        )}

        {currentTab === 'student_history' && (
          <StudentHistoryManager
            students={students}
            schoolProfile={schoolProfile}
            userRole={userRole}
            onRefreshStudents={loadData}
          />
        )}

        {currentTab === 'fees' && (
          <FeeManagement
            vouchers={vouchers}
            students={students}
            schoolProfile={schoolProfile}
            userRole={userRole}
            loading={loading}
            onRefresh={loadData}
            onUpdateStatus={handleUpdateStatus}
            onOpenVoucherModal={handleOpenVoucherModal}
            onOpenAuditModal={handleOpenAuditModal}
            onDeleteVoucher={handleDeleteVoucher}
          />
        )}

        {currentTab === 'students' && (
          <StudentDirectory
            students={students}
            vouchers={vouchers}
            schoolProfile={schoolProfile}
            userRole={userRole}
            loading={loading}
            onOpenVoucher={handleOpenVoucherByStudentId}
            onUpdateStudent={handleUpdateStudent}
            onDeleteStudent={handleDeleteStudent}
          />
        )}

        {currentTab === 'staff' && (
          <StaffDirectory
            staff={staff}
            schoolProfile={schoolProfile}
            loading={loading}
            userRole={userRole}
            onAddStaff={handleAddStaff}
            onUpdateStaff={handleUpdateStaff}
            onDeleteStaff={handleDeleteStaff}
            onSelectStaffForDoc={handleSelectStaffForDoc}
          />
        )}

        {currentTab === 'hr_letters' && (
          <HRLetters
            staff={staff}
            schoolProfile={schoolProfile}
            userRole={userRole}
            onRefreshStaff={loadData}
          />
        )}

        {currentTab === 'student_certs' && (
          <StudentCertificates
            students={students}
            schoolProfile={schoolProfile}
            userRole={userRole}
            onRefresh={loadData}
          />
        )}

        {currentTab === 'forms' && (
          <FormsAndCertificates
            schoolProfile={schoolProfile}
            students={students}
            staff={staff}
            examResults={examResults}
          />
        )}

        {currentTab === 'exports' && (
          <ExportRecords
            schoolProfile={schoolProfile}
            students={students}
            staff={staff}
            vouchers={vouchers}
            certificates={certificates}
            examResults={examResults}
          />
        )}

        {currentTab === 'multi_schools' && currentUser.role === 'Super Admin' && (
          <MultiSchoolManager
            userRole={userRole}
            currentSchoolId={currentSchoolId}
            onSwitchSchool={handleSwitchSchool}
            onRefreshAllData={loadData}
          />
        )}

        {currentTab === 'user_management' && (currentUser.role === 'Super Admin' || currentUser.role === 'Principal') && (
          <UserManagement currentUser={currentUser} currentSchoolId={currentSchoolId} />
        )}

        {currentTab === 'settings' && (
          <SchoolSettings
            schoolProfile={schoolProfile}
            onUpdateSchoolProfile={handleUpdateSchoolProfile}
            currentUserRole={currentUser.role}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="no-print bg-slate-900 border-t border-slate-800 text-slate-400 py-6 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <img
              src={logoSrc}
              alt="School Logo"
              className="w-8 h-8 rounded-full border border-amber-400/40 object-contain bg-white p-0.5"
              referrerPolicy="no-referrer"
            />
            <div>
              <p className="font-bold text-white">
                {schoolProfile.schoolName}
              </p>
              <p className="text-[11px] text-slate-400">
                Affiliated with {schoolProfile.board} · Principal: {schoolProfile.principal}
              </p>
            </div>
          </div>
          <div className="text-center sm:text-right text-[11px] text-slate-400 flex items-center gap-3">
            <span>Current Role: <strong className="text-amber-400">{userRole}</strong></span>
            <span>·</span>
            <span>Edupro School ERP System · Session {schoolProfile.activeSession}</span>
          </div>
        </div>
      </footer>

      {/* Official Printable Admission Fee Voucher Modal */}
      <VoucherModal
        voucher={activeVoucher}
        student={activeStudent}
        schoolProfile={schoolProfile}
        isOpen={isVoucherModalOpen}
        onClose={() => setIsVoucherModalOpen(false)}
        onToggleStatus={handleUpdateStatus}
      />

      {/* Payment Status Change Audit Log Modal */}
      <VoucherAuditModal
        voucher={auditVoucher}
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
      />

      {/* Recycle Bin & Recoverable Items Modal */}
      <RecycleBinModal
        isOpen={isRecycleBinOpen}
        onClose={() => setIsRecycleBinOpen(false)}
        userRole={userRole}
        onItemRestored={loadData}
      />

      {/* User Profile & Security Settings Modal */}
      {currentUser && (
        <UserProfileModal
          currentUser={currentUser}
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          onLogout={handleRequestLogout}
          onUserUpdated={(updatedUser) => {
            setCurrentUser(updatedUser);
            setUserRole(updatedUser.role);
            localStorage.setItem('edupro_current_user', JSON.stringify(updatedUser));
          }}
        />
      )}

      {/* Logout Confirmation Dialog Modal */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-slate-900 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="p-3 bg-rose-100 rounded-xl">
                <LogOut className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Confirm Sign Out</h3>
                <p className="text-xs text-slate-500">Sign out of active session</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-4 text-xs">
              <div className="text-slate-500">Active User:</div>
              <div className="font-bold text-slate-900">{currentUser?.name}</div>
              <div className="text-slate-600 font-mono text-[11px]">{currentUser?.email} · <span className="text-amber-700 font-sans font-bold">{currentUser?.role}</span></div>
            </div>

            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Are you sure you want to sign out of <strong>EduManage Pro</strong>? Your active session will be terminated and you will be returned to the Login Page.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsLogoutModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmedLogout}
                className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Yes, Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
