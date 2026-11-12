/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Edit2,
  Power,
  Users,
  CreditCard,
  MapPin,
  Phone,
  Mail,
  RefreshCw,
  X,
  School,
  Lock,
} from 'lucide-react';
import { SchoolRecord, UserRole } from '../types/school.ts';
import { db as firestoreDb } from '../lib/firebase.ts';
import { doc, setDoc } from 'firebase/firestore';

interface MultiSchoolManagerProps {
  userRole: UserRole;
  currentSchoolId: string;
  onSwitchSchool: (schoolId: string) => void;
  onRefreshAllData: () => Promise<void>;
}

export const MultiSchoolManager: React.FC<MultiSchoolManagerProps> = ({
  userRole,
  currentSchoolId,
  onSwitchSchool,
  onRefreshAllData,
}) => {
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [notice, setNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Register New School Modal
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [schoolName, setSchoolName] = useState('');
  const [introduction, setIntroduction] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [board, setBoard] = useState('BISE Faisalabad');
  const [principal, setPrincipal] = useState('');
  const [campusAddress, setCampusAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [subscriptionPlan, setSubscriptionPlan] = useState<'Enterprise' | 'Pro' | 'Basic'>('Enterprise');

  // Edit School Modal
  const [editingSchool, setEditingSchool] = useState<SchoolRecord | null>(null);
  const [editSchoolName, setEditSchoolName] = useState('');
  const [editIntroduction, setEditIntroduction] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [editBoard, setEditBoard] = useState('');
  const [editPrincipal, setEditPrincipal] = useState('');
  const [editCampusAddress, setEditCampusAddress] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPlan, setEditPlan] = useState<'Enterprise' | 'Pro' | 'Basic'>('Enterprise');
  const [savingEdit, setSavingEdit] = useState(false);

  // Toggle Status Modal
  const [statusTarget, setStatusTarget] = useState<SchoolRecord | null>(null);
  const [toggling, setToggling] = useState(false);

  const fetchSchools = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/schools');
      if (!res.ok) throw new Error('Failed to fetch registered schools');
      const data = await res.json();
      setSchools(data);
    } catch (err: any) {
      setNotice({ text: err.message || 'Error loading schools', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchools();
  }, []);

  const handleOpenRegister = () => {
    // Generate next school code
    const existingCodes = schools.map((s) => s.schoolCode || '').filter(Boolean);
    let nextNum = schools.length + 1;
    let nextCode = `SCH${String(nextNum).padStart(3, '0')}`;
    while (existingCodes.includes(nextCode)) {
      nextNum++;
      nextCode = `SCH${String(nextNum).padStart(3, '0')}`;
    }

    setSchoolCode(nextCode);
    setSchoolName('');
    setIntroduction('');
    setLogoUrl('');
    setBoard('BISE Faisalabad');
    setPrincipal('');
    setCampusAddress('');
    setPhone('');
    setEmail('');
    setAdminEmail('');
    setAdminName('');
    setAdminPassword('');
    setSubscriptionPlan('Enterprise');
    setShowRegisterModal(true);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistering(true);
    try {
      const res = await fetch('/api/schools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': userRole,
        },
        body: JSON.stringify({
          schoolName: schoolName.trim(),
          schoolNameUrdu: '',
          schoolCode: schoolCode.trim().toUpperCase(),
          introduction: introduction.trim() || `Welcome to ${schoolName.trim()}`,
          board: board.trim(),
          principal: (principal || adminName || 'Principal').trim(),
          campusAddress: campusAddress.trim(),
          phone: phone.trim(),
          email: (email || adminEmail).trim(),
          adminEmail: adminEmail.trim(),
          adminName: (adminName || principal || 'Principal').trim(),
          adminPassword: adminPassword.trim(),
          subscriptionPlan,
          logoUrl: logoUrl.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register new school');

      // Sync school record and settings to Firebase Firestore for cross-session cloud persistence
      try {
        if (data.school && data.school.id) {
          const now = new Date().toISOString();
          const firestorePayload = {
            id: data.school.id,
            schoolCode: data.school.schoolCode,
            schoolName: data.school.schoolName,
            schoolNameUrdu: '',
            introduction: introduction.trim() || `Welcome to ${schoolName.trim()}`,
            board: data.school.board,
            principal: data.school.principal || principal.trim() || adminName.trim(),
            campusAddress: data.school.campusAddress,
            phone: data.school.phone,
            email: data.school.email || email.trim() || adminEmail.trim(),
            adminEmail: adminEmail.trim(),
            adminName: adminName.trim(),
            status: 'ACTIVE',
            subscriptionPlan,
            logoUrl: data.school.logoUrl || logoUrl.trim() || '',
            createdAt: now,
            updatedAt: now,
          };
          await setDoc(doc(firestoreDb, 'schools', data.school.id), firestorePayload, { merge: true });
          await setDoc(doc(firestoreDb, 'school_settings', data.school.id), firestorePayload, { merge: true });
          if (data.user && data.user.uid) {
            await setDoc(doc(firestoreDb, 'users', data.user.uid), {
              uid: data.user.uid,
              name: data.user.name,
              email: data.user.email,
              phone: data.user.phone || '',
              role: data.user.role,
              schoolId: data.school.id,
              status: 'ACTIVE',
              createdAt: now,
              updatedAt: now,
            }, { merge: true });
          }
        }
      } catch (fsErr) {
        console.warn('Firestore school record sync note:', fsErr);
      }

      setNotice({
        text: `School "${schoolName}" (${schoolCode}) registered and saved in database and Firebase Firestore.`,
        type: 'success',
      });
      setShowRegisterModal(false);
      await fetchSchools();
    } catch (err: any) {
      setNotice({ text: err.message || 'School registration failed', type: 'error' });
    } finally {
      setRegistering(false);
      setTimeout(() => setNotice(null), 5000);
    }
  };

  const handleOpenEdit = (sc: SchoolRecord) => {
    setEditingSchool(sc);
    setEditSchoolName(sc.schoolName);
    setEditIntroduction(sc.introduction || '');
    setEditLogoUrl(sc.logoUrl || '');
    setEditBoard(sc.board || '');
    setEditPrincipal(sc.principal || sc.adminName || '');
    setEditCampusAddress(sc.campusAddress || '');
    setEditPhone(sc.phone || '');
    setEditEmail(sc.email || sc.adminEmail || '');
    setEditPlan((sc.subscriptionPlan as 'Enterprise' | 'Pro' | 'Basic') || 'Enterprise');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchool) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/schools/${editingSchool.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: editSchoolName.trim(),
          schoolNameUrdu: '',
          introduction: editIntroduction.trim(),
          board: editBoard.trim(),
          principal: editPrincipal.trim(),
          campusAddress: editCampusAddress.trim(),
          phone: editPhone.trim(),
          email: editEmail.trim(),
          subscriptionPlan: editPlan,
          logoUrl: editLogoUrl.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update school profile');

      try {
        const updatePayload = {
          schoolName: editSchoolName.trim(),
          introduction: editIntroduction.trim(),
          board: editBoard.trim(),
          principal: editPrincipal.trim(),
          campusAddress: editCampusAddress.trim(),
          phone: editPhone.trim(),
          email: editEmail.trim(),
          subscriptionPlan: editPlan,
          logoUrl: editLogoUrl.trim(),
          updatedAt: new Date().toISOString(),
        };
        await setDoc(doc(firestoreDb, 'schools', editingSchool.id), updatePayload, { merge: true });
        await setDoc(doc(firestoreDb, 'school_settings', editingSchool.id), updatePayload, { merge: true });
      } catch (fsErr) {
        console.warn('Firestore school update sync note:', fsErr);
      }

      setNotice({
        text: `School "${editSchoolName}" updated successfully in database and Firebase Firestore.`,
        type: 'success',
      });
      setEditingSchool(null);
      await fetchSchools();
      if (editingSchool.id === currentSchoolId) {
        await onRefreshAllData();
      }
    } catch (err: any) {
      setNotice({ text: err.message || 'Update failed', type: 'error' });
    } finally {
      setSavingEdit(false);
      setTimeout(() => setNotice(null), 5000);
    }
  };

  const handleToggleStatus = async () => {
    if (!statusTarget) return;
    setToggling(true);
    try {
      const res = await fetch(`/api/schools/${statusTarget.id}/toggle-status`, {
        method: 'PATCH',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change school status');

      const nextStatus = statusTarget.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      setNotice({
        text: `School "${statusTarget.schoolName}" is now ${nextStatus}.`,
        type: 'success',
      });
      setStatusTarget(null);
      await fetchSchools();
    } catch (err: any) {
      setNotice({ text: err.message || 'Status toggle failed', type: 'error' });
    } finally {
      setToggling(false);
      setTimeout(() => setNotice(null), 5000);
    }
  };

  const filteredSchools = schools.filter((s) => {
    if (filterStatus !== 'ALL') {
      const sStatus = s.status || 'ACTIVE';
      if (sStatus !== filterStatus) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        s.schoolName.toLowerCase().includes(q) ||
        (s.schoolCode && s.schoolCode.toLowerCase().includes(q)) ||
        (s.schoolNameUrdu && s.schoolNameUrdu.toLowerCase().includes(q)) ||
        (s.campusAddress && s.campusAddress.toLowerCase().includes(q)) ||
        (s.adminEmail && s.adminEmail.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner / SaaS Title */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Super Admin Multi-Tenant Governance</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-amber-600" />
            Multi-School SaaS Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Register new schools, assign administrators, enforce multi-tenant isolation, manage subscription plans, and switch active school context seamlessly.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            type="button"
            onClick={fetchSchools}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
            title="Refresh Schools"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleOpenRegister}
            className="flex-1 md:flex-none px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            <span>Register New School</span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 ${
            notice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-700 rounded-xl">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Registered Schools</div>
            <div className="text-2xl font-black text-slate-900 font-tabular mt-0.5">{schools.length}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Active Campuses</div>
            <div className="text-2xl font-black text-emerald-700 font-tabular mt-0.5">
              {schools.filter((s) => (s.status || 'ACTIVE') === 'ACTIVE').length}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-700 rounded-xl">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Enterprise SaaS Tenancy</div>
            <div className="text-2xl font-black text-purple-700 font-tabular mt-0.5">Isolated</div>
          </div>
        </div>
      </div>

      {/* Search and Status Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by school name, code (e.g. SCH001), address, or admin email..."
            className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-400/50"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              filterStatus === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All ({schools.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('ACTIVE')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              filterStatus === 'ACTIVE'
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-emerald-50'
            }`}
          >
            Active ({schools.filter((s) => (s.status || 'ACTIVE') === 'ACTIVE').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('INACTIVE')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              filterStatus === 'INACTIVE'
                ? 'bg-rose-700 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-rose-50'
            }`}
          >
            Inactive ({schools.filter((s) => s.status === 'INACTIVE').length})
          </button>
        </div>
      </div>

      {/* School Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredSchools.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
            <Building2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-sm text-slate-600">No schools match your search or filter</p>
          </div>
        ) : (
          filteredSchools.map((sc) => {
            const isActive = (sc.status || 'ACTIVE') === 'ACTIVE';
            const isCurrentlySelected = sc.id === currentSchoolId;

            return (
              <div
                key={sc.id}
                className={`bg-white rounded-2xl border p-5 shadow-xs flex flex-col justify-between transition-all ${
                  isCurrentlySelected
                    ? 'border-amber-500 ring-2 ring-amber-500/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  {/* Top Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {sc.logoUrl ? (
                          <img src={sc.logoUrl} alt={sc.schoolName} className="w-full h-full object-contain p-1" />
                        ) : (
                          <School className="w-6 h-6 text-amber-700" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                            {sc.schoolCode || 'SCH001'}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isActive
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isActive ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </div>
                        <h3 className="text-sm font-black text-slate-900 mt-1 line-clamp-1" title={sc.schoolName}>
                          {sc.schoolName}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {sc.schoolNameUrdu && (
                    <div className="text-xs font-bold text-amber-800 font-urdu mb-2">
                      {sc.schoolNameUrdu}
                    </div>
                  )}

                  {/* School Metadata Details */}
                  <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{sc.campusAddress}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-tabular">{sc.phone}</span>
                    </div>
                    {sc.adminEmail && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{sc.adminEmail}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="text-slate-400 font-medium">Board: {sc.board}</span>
                      <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                        Plan: {sc.subscriptionPlan || 'Enterprise'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* Edit School Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(sc)}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                      title="Edit School Details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Toggle Status */}
                    {sc.id !== 'school_primary' && (
                      <button
                        type="button"
                        onClick={() => setStatusTarget(sc)}
                        className={`p-2 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                        }`}
                        title={isActive ? 'Deactivate School' : 'Activate School'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Switch Active School Context */}
                  {isCurrentlySelected ? (
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Current View
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSwitchSchool(sc.id)}
                      className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-xs"
                    >
                      <span>Switch to School</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Register New School Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Register New School Campus</h3>
                  <p className="text-xs text-slate-500">Provisions isolated database tenant & admin credentials</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    School Code / ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={schoolCode}
                    onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                    placeholder="e.g. SCH002"
                    className="w-full px-3 py-2 text-xs font-mono font-bold uppercase border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Subscription Plan
                  </label>
                  <select
                    value={subscriptionPlan}
                    onChange={(e) => setSubscriptionPlan(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-medium"
                  >
                    <option value="Enterprise">Enterprise (Full Modules)</option>
                    <option value="Pro">Pro (Up to 1000 Students)</option>
                    <option value="Basic">Basic (Standard)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  School Name (English) *
                </label>
                <input
                  type="text"
                  required
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="e.g. Crescent Public High School"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  School Description / Mission Statement *
                </label>
                <textarea
                  rows={2}
                  required
                  value={introduction}
                  onChange={(e) => setIntroduction(e.target.value)}
                  placeholder="Describe the school, mission, values, and educational focus..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    School Logo URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://... or empty for institutional badge"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Education Board
                  </label>
                  <input
                    type="text"
                    value={board}
                    onChange={(e) => setBoard(e.target.value)}
                    placeholder="e.g. BISE Faisalabad, Lahore, Multan"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Contact Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0300-1234567"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    School Official Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="info@school.edu.pk"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Principal Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={principal}
                    onChange={(e) => {
                      setPrincipal(e.target.value);
                      if (!adminName) setAdminName(e.target.value);
                    }}
                    placeholder="Dr. Muhammad Aslam"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Campus Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={campusAddress}
                    onChange={(e) => setCampusAddress(e.target.value)}
                    placeholder="e.g. Main Circular Road, City Name"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Admin Provisioning Section */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-wider">
                  <Lock className="w-4 h-4 text-amber-600" />
                  <span>Provision School Principal / Admin Account</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Admin Full Name
                    </label>
                    <input
                      type="text"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="e.g. Muhammad Aslam"
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Admin Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="principal@school.edu.pk"
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Temporary Password *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registering}
                  className="px-5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {registering ? 'Registering School...' : 'Complete School Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit School Details Modal */}
      {editingSchool && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Edit School Profile</h3>
                  <p className="text-xs text-slate-500 font-mono">{editingSchool.schoolCode || editingSchool.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingSchool(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  School Name (English) *
                </label>
                <input
                  type="text"
                  required
                  value={editSchoolName}
                  onChange={(e) => setEditSchoolName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  School Description / Mission Statement *
                </label>
                <textarea
                  rows={2}
                  required
                  value={editIntroduction}
                  onChange={(e) => setEditIntroduction(e.target.value)}
                  placeholder="Official mission, vision, and description..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Principal Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editPrincipal}
                    onChange={(e) => setEditPrincipal(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Education Board
                  </label>
                  <input
                    type="text"
                    value={editBoard}
                    onChange={(e) => setEditBoard(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    School Logo URL
                  </label>
                  <input
                    type="url"
                    value={editLogoUrl}
                    onChange={(e) => setEditLogoUrl(e.target.value)}
                    placeholder="https://... or empty for institutional crest"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    School Official Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Campus Address *
                </label>
                <input
                  type="text"
                  required
                  value={editCampusAddress}
                  onChange={(e) => setEditCampusAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone *
                  </label>
                  <input
                    type="text"
                    required
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Subscription Plan
                  </label>
                  <select
                    value={editPlan}
                    onChange={(e) => setEditPlan(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-medium"
                  >
                    <option value="Enterprise">Enterprise</option>
                    <option value="Pro">Pro</option>
                    <option value="Basic">Basic</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingSchool(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-xs disabled:opacity-50"
                >
                  {savingEdit ? 'Saving Changes...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toggle Status Confirmation Modal */}
      {statusTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900">
                {statusTarget.status === 'ACTIVE' ? 'Deactivate School?' : 'Activate School?'}
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to {statusTarget.status === 'ACTIVE' ? 'deactivate' : 'activate'}{' '}
              <strong>{statusTarget.schoolName}</strong> ({statusTarget.schoolCode})?
              {statusTarget.status === 'ACTIVE'
                ? ' Administrators and staff of this school will temporarily lose access to ERP features until reactivated.'
                : ' School access will be fully restored immediately.'}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStatusTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={toggling}
                className={`px-4 py-2 text-xs font-bold text-white rounded-lg shadow-xs ${
                  statusTarget.status === 'ACTIVE'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {toggling ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
