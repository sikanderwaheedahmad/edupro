/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  GraduationCap,
  ArrowRight,
  ArrowRightLeft,
  Archive,
  CheckCircle2,
  AlertCircle,
  Users,
  Search,
  Filter,
  Printer,
  Calendar,
  Award,
  RefreshCw,
  Clock,
  ShieldCheck,
  Download,
} from 'lucide-react';
import { StudentRecord, SchoolProfile, UserRole } from '../types/school.ts';
import { printElement } from '../utils/printHelper.ts';
import { downloadElementAsPDF } from '../utils/pdfExport.ts';
import { StudentSearchSelector } from './StudentSearchSelector.tsx';

interface StudentPromotionManagerProps {
  students: StudentRecord[];
  schoolProfile: SchoolProfile;
  userRole: UserRole;
  onRefreshStudents: () => void;
}

export const StudentPromotionManager: React.FC<StudentPromotionManagerProps> = ({
  students,
  schoolProfile,
  userRole,
  onRefreshStudents,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'promotion' | 'transfer' | 'passout' | 'archive'>('promotion');
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const archivePrintRef = useRef<HTMLDivElement | null>(null);

  // --- SUBTAB 1: PROMOTION STATE ---
  const [promoFromSession, setPromoFromSession] = useState<string>(schoolProfile.activeSession || '2024-2025');
  const [promoFromClass, setPromoFromClass] = useState<string>('Class 1');
  const [promoFromSection, setPromoFromSection] = useState<string>('All');
  const [promoSelectedIds, setPromoSelectedIds] = useState<string[]>([]);

  // Target promotion values
  const [promoToSession, setPromoToSession] = useState<string>('2025-2026');
  const [promoToClass, setPromoToClass] = useState<string>('Class 2');
  const [promoToSection, setPromoToSection] = useState<string>('A');
  const [isPromoting, setIsPromoting] = useState(false);
  const [showConfirmPromoModal, setShowConfirmPromoModal] = useState(false);

  // Auto-suggest next class when promoFromClass changes
  useEffect(() => {
    const classes = schoolProfile.availableClasses || [];
    const currentIndex = classes.indexOf(promoFromClass);
    if (currentIndex >= 0 && currentIndex < classes.length - 1) {
      setPromoToClass(classes[currentIndex + 1]);
    } else {
      setPromoToClass(promoFromClass);
    }
  }, [promoFromClass, schoolProfile.availableClasses]);

  // Students available for promotion
  const eligiblePromoStudents = useMemo(() => {
    return students.filter((s) => {
      if (s.isDeleted || s.isPassOut) return false;
      if (s.session !== promoFromSession) return false;
      if (s.studentClass !== promoFromClass) return false;
      if (promoFromSection !== 'All' && s.section !== promoFromSection) return false;
      return true;
    });
  }, [students, promoFromSession, promoFromClass, promoFromSection]);

  const handleSelectAllPromo = () => {
    if (promoSelectedIds.length === eligiblePromoStudents.length) {
      setPromoSelectedIds([]);
    } else {
      setPromoSelectedIds(eligiblePromoStudents.map((s) => s.id));
    }
  };

  const togglePromoStudent = (id: string) => {
    setPromoSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleExecutePromotion = async () => {
    if (!promoSelectedIds.length) {
      setActionMessage({ text: 'Please select at least one student to promote', type: 'error' });
      return;
    }
    try {
      setIsPromoting(true);
      const res = await fetch('/api/students/promote-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentIds: promoSelectedIds,
          fromSession: promoFromSession,
          toSession: promoToSession,
          toClass: promoToClass,
          toSection: promoToSection,
          adminName: userRole === 'Principal' ? schoolProfile.principal : `${userRole} Admin`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to promote students');

      setActionMessage({
        text: `Successfully promoted ${data.promotedCount} student(s) from ${promoFromClass} to ${promoToClass} (Session ${promoToSession})`,
        type: 'success',
      });
      setPromoSelectedIds([]);
      setShowConfirmPromoModal(false);
      onRefreshStudents();
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Promotion failed', type: 'error' });
    } finally {
      setIsPromoting(false);
    }
  };

  // --- SUBTAB 2: TRANSFER STATE ---
  const [transferStudentId, setTransferStudentId] = useState<string>('');
  const [transferSearch, setTransferSearch] = useState('');
  const [transferToClass, setTransferToClass] = useState<string>('Class 1');
  const [transferToSection, setTransferToSection] = useState<string>('A');
  const [transferToSession, setTransferToSession] = useState<string>(schoolProfile.activeSession || '2024-2025');
  const [transferReason, setTransferReason] = useState<string>('Academic transfer / Section adjustment');
  const [isTransferring, setIsTransferring] = useState(false);

  const filteredTransferCandidates = useMemo(() => {
    if (!transferSearch.trim()) return students.filter((s) => !s.isDeleted && !s.isPassOut).slice(0, 15);
    const q = transferSearch.toLowerCase();
    return students.filter(
      (s) =>
        !s.isDeleted &&
        !s.isPassOut &&
        (s.fullName.toLowerCase().includes(q) ||
          s.admissionNumber.toLowerCase().includes(q) ||
          s.fatherName.toLowerCase().includes(q) ||
          (s.rollNumber && s.rollNumber.toLowerCase().includes(q)))
    );
  }, [students, transferSearch]);

  const selectedTransferStudent = useMemo(() => {
    return students.find((s) => s.id === transferStudentId) || null;
  }, [students, transferStudentId]);

  const handleExecuteTransfer = async () => {
    if (!transferStudentId) {
      setActionMessage({ text: 'Please select a student to transfer', type: 'error' });
      return;
    }
    try {
      setIsTransferring(true);
      const res = await fetch('/api/students/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: transferStudentId,
          toClass: transferToClass,
          toSection: transferToSection,
          toSession: transferToSession,
          reason: transferReason,
          adminName: userRole === 'Principal' ? schoolProfile.principal : `${userRole} Admin`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transfer failed');

      setActionMessage({
        text: `Successfully transferred ${data.student.fullName} to ${transferToClass}-${transferToSection} (${transferToSession})`,
        type: 'success',
      });
      setTransferStudentId('');
      onRefreshStudents();
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Transfer failed', type: 'error' });
    } finally {
      setIsTransferring(false);
    }
  };

  // --- SUBTAB 3: CLASS 10 PASS-OUT STATE ---
  const [class10Students, setClass10Students] = useState<StudentRecord[]>([]);
  const [selectedPassOutIds, setSelectedPassOutIds] = useState<string[]>([]);
  const [passOutSession, setPassOutSession] = useState<string>(schoolProfile.activeSession || '2024-2025');
  const [passOutDate, setPassOutDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [passOutRemarks, setPassOutRemarks] = useState<string>('Matriculation BISE Gujranwala Examination Completed');
  const [isProcessingPassOut, setIsProcessingPassOut] = useState(false);
  const [showPassOutConfirmModal, setShowPassOutConfirmModal] = useState(false);

  // --- SUBTAB 4: PASS-OUT ARCHIVE STATE ---
  const [passOutArchive, setPassOutArchive] = useState<StudentRecord[]>([]);
  const [archiveFilterSession, setArchiveFilterSession] = useState<string>('All');

  const fetchClass10Data = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/students-class10?session=${passOutSession}&includePassedOut=false`);
      if (res.ok) {
        const data = await res.json();
        setClass10Students(data);
      }
      const archRes = await fetch('/api/students-passout-archive');
      if (archRes.ok) {
        const archData = await archRes.json();
        setPassOutArchive(archData);
      }
    } catch (err) {
      console.error('Failed to fetch class 10 data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'passout' || activeSubTab === 'archive') {
      fetchClass10Data();
    }
  }, [activeSubTab, passOutSession]);

  const handleSelectAllPassOut = () => {
    if (selectedPassOutIds.length === class10Students.length) {
      setSelectedPassOutIds([]);
    } else {
      setSelectedPassOutIds(class10Students.map((s) => s.id));
    }
  };

  const togglePassOutStudent = (id: string) => {
    setSelectedPassOutIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleExecutePassOut = async () => {
    if (!selectedPassOutIds.length) {
      setActionMessage({ text: 'Please select at least one Class 10 student for pass-out', type: 'error' });
      return;
    }
    try {
      setIsProcessingPassOut(true);
      const res = await fetch('/api/students/class10-passout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentIds: selectedPassOutIds,
          session: passOutSession,
          passOutDate,
          resultSummary: passOutRemarks,
          adminName: userRole === 'Principal' ? schoolProfile.principal : `${userRole} Admin`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Pass-out processing failed');

      setActionMessage({
        text: `Successfully graduated & archived ${data.passOutCount} Class 10 student(s)`,
        type: 'success',
      });
      setSelectedPassOutIds([]);
      setShowPassOutConfirmModal(false);
      fetchClass10Data();
      onRefreshStudents();
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Pass-out failed', type: 'error' });
    } finally {
      setIsProcessingPassOut(false);
    }
  };

  const filteredArchive = useMemo(() => {
    if (archiveFilterSession === 'All') return passOutArchive;
    return passOutArchive.filter((s) => s.passOutSession === archiveFilterSession);
  }, [passOutArchive, archiveFilterSession]);

  return (
    <div className="space-y-6">
      {/* Module Title Banner */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Student Promotion & Class 10 Pass-Out Management
              </h1>
              <p className="text-xs text-slate-500">
                Bulk promote students across sessions, transfer between classes/sections, and archive graduated Class 10 batches.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onRefreshStudents();
                if (activeSubTab === 'passout' || activeSubTab === 'archive') fetchClass10Data();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Action feedback message */}
        {actionMessage && (
          <div
            className={`mt-4 p-3 rounded-lg text-xs flex items-center justify-between ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {actionMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{actionMessage.text}</span>
            </div>
            <button
              onClick={() => setActionMessage(null)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer font-bold"
            >
              ×
            </button>
          </div>
        )}

        {/* Sub-Tabs Navigation */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-slate-200">
          <button
            onClick={() => setActiveSubTab('promotion')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
              activeSubTab === 'promotion'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ArrowRight className="w-4 h-4" />
            <span>1. Bulk Class Promotion</span>
          </button>
          <button
            onClick={() => setActiveSubTab('transfer')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
              activeSubTab === 'transfer'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>2. Class / Section Transfer</span>
          </button>
          <button
            onClick={() => setActiveSubTab('passout')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
              activeSubTab === 'passout'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>3. Class 10 Pass-Out Batch</span>
          </button>
          <button
            onClick={() => setActiveSubTab('archive')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
              activeSubTab === 'archive'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Archive className="w-4 h-4" />
            <span>4. Pass-Out Alumni Archive ({passOutArchive.length})</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUBTAB 1: BULK CLASS PROMOTION */}
      {/* ========================================================================= */}
      {activeSubTab === 'promotion' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Filter & Students Selection List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5">
              <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Filter className="w-4 h-4 text-amber-500" />
                <span>Step 1: Select Current Class & Enrolled Students</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Current Academic Session
                  </label>
                  <select
                    value={promoFromSession}
                    onChange={(e) => {
                      setPromoFromSession(e.target.value);
                      setPromoSelectedIds([]);
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                  >
                    {(schoolProfile.academicSessions || ['2024-2025', '2025-2026']).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Current Class
                  </label>
                  <select
                    value={promoFromClass}
                    onChange={(e) => {
                      setPromoFromClass(e.target.value);
                      setPromoSelectedIds([]);
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                  >
                    {(schoolProfile.availableClasses || []).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Current Section
                  </label>
                  <select
                    value={promoFromSection}
                    onChange={(e) => {
                      setPromoFromSection(e.target.value);
                      setPromoSelectedIds([]);
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="All">All Sections</option>
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                    <option value="D">Section D</option>
                  </select>
                </div>
              </div>

              {/* Student table header with select all */}
              <div className="flex items-center justify-between py-2 border-b border-slate-200">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      eligiblePromoStudents.length > 0 &&
                      promoSelectedIds.length === eligiblePromoStudents.length
                    }
                    onChange={handleSelectAllPromo}
                    disabled={eligiblePromoStudents.length === 0}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Select All ({eligiblePromoStudents.length} students found)</span>
                </label>
                <span className="text-xs text-slate-500">
                  Selected: <strong className="text-amber-600">{promoSelectedIds.length}</strong>
                </span>
              </div>

              {/* Students List */}
              <div className="mt-3 max-h-96 overflow-y-auto divide-y divide-slate-100">
                {eligiblePromoStudents.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    No active students found in {promoFromClass} ({promoFromSession}).
                  </div>
                ) : (
                  eligiblePromoStudents.map((student) => {
                    const isChecked = promoSelectedIds.includes(student.id);
                    return (
                      <div
                        key={student.id}
                        onClick={() => togglePromoStudent(student.id)}
                        className={`flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition-colors ${
                          isChecked ? 'bg-amber-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                          />
                          <div>
                            <div className="font-semibold text-slate-900">{student.fullName}</div>
                            <div className="text-[11px] text-slate-500">
                              S/O {student.fatherName} · Adm #{student.admissionNumber}
                              {student.permanentStudentId ? ` · ID: ${student.permanentStudentId}` : ''}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                            Roll #{student.rollNumber || '—'}
                          </span>
                          <span className="ml-2 text-slate-500 text-[11px]">Sec {student.section || 'A'}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Col: Target Promotion Destination Form */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5">
              <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-emerald-600" />
                <span>Step 2: Destination Class & Session</span>
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Promote To Session *
                  </label>
                  <select
                    value={promoToSession}
                    onChange={(e) => setPromoToSession(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                  >
                    {(schoolProfile.academicSessions || ['2024-2025', '2025-2026', '2026-2027']).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Promote To Class *
                  </label>
                  <select
                    value={promoToClass}
                    onChange={(e) => setPromoToClass(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500 font-semibold"
                  >
                    {(schoolProfile.availableClasses || []).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Target Section *
                  </label>
                  <select
                    value={promoToSection}
                    onChange={(e) => setPromoToSection(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                    <option value="D">Section D</option>
                  </select>
                </div>

                <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200/60 text-[11px] text-amber-900 space-y-1">
                  <div className="font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    <span>Permanent Records Kept Safe</span>
                  </div>
                  <p>
                    Each student's <strong>Permanent Student ID</strong> and original admission date will stay identical. New class roll numbers will be sequentially assigned. A permanent promotion record is written to the audit log.
                  </p>
                </div>

                <button
                  onClick={() => setShowConfirmPromoModal(true)}
                  disabled={promoSelectedIds.length === 0 || isPromoting}
                  className={`w-full py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                    promoSelectedIds.length === 0 || isPromoting
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                  }`}
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>Promote {promoSelectedIds.length} Selected Student(s)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Promotion */}
      {showConfirmPromoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <GraduationCap className="w-6 h-6" />
              <h3 className="font-bold text-slate-900 text-base">Confirm Student Batch Promotion</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to promote <strong>{promoSelectedIds.length}</strong> student(s) from{' '}
              <strong>{promoFromClass}</strong> ({promoFromSession}) to{' '}
              <strong className="text-emerald-700">{promoToClass} - Section {promoToSection}</strong>{' '}
              for Academic Session <strong>{promoToSession}</strong>?
            </p>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
              New sequential roll numbers will be allocated automatically. All prior history and admission documents remain fully preserved.
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowConfirmPromoModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecutePromotion}
                disabled={isPromoting}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer flex items-center gap-1.5"
              >
                {isPromoting ? 'Processing...' : 'Yes, Confirm Promotion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 2: CLASS / SECTION TRANSFER */}
      {/* ========================================================================= */}
      {activeSubTab === 'transfer' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Find Student */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Search className="w-4 h-4 text-amber-500" />
              <span>Select Student to Transfer</span>
            </h2>

            <StudentSearchSelector
              onSelectStudent={(st) => setTransferStudentId(st.id)}
              selectedStudentId={transferStudentId}
              label="Search by Name, Roll #, Permanent ID, or Phone"
            />

            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {filteredTransferCandidates.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">No matching students found</div>
              ) : (
                filteredTransferCandidates.map((s) => {
                  const isSelected = s.id === transferStudentId;
                  return (
                    <div
                      key={s.id}
                      onClick={() => setTransferStudentId(s.id)}
                      className={`p-3 text-xs cursor-pointer transition-colors ${
                        isSelected ? 'bg-amber-100/70 border-l-4 border-amber-600 font-semibold' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-slate-900">{s.fullName}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                          {s.studentClass} - {s.section || 'A'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        S/O {s.fatherName} · Adm #{s.admissionNumber} · Roll #{s.rollNumber || '—'} · Session {s.session}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Transfer Destination Form */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
              <span>Target Class & Section Details</span>
            </h2>

            {selectedTransferStudent ? (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                <div className="font-bold text-slate-900">{selectedTransferStudent.fullName}</div>
                <div className="text-slate-600">
                  Current: {selectedTransferStudent.studentClass} ({selectedTransferStudent.section || 'A'}) · Session: {selectedTransferStudent.session} · Roll #{selectedTransferStudent.rollNumber || '—'}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800">
                Please select a student on the left panel to begin transfer.
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Destination Class *
                </label>
                <select
                  value={transferToClass}
                  onChange={(e) => setTransferToClass(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                >
                  {(schoolProfile.availableClasses || []).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Destination Section *
                </label>
                <select
                  value={transferToSection}
                  onChange={(e) => setTransferToSection(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                >
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                  <option value="C">Section C</option>
                  <option value="D">Section D</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Session *
                </label>
                <select
                  value={transferToSession}
                  onChange={(e) => setTransferToSession(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                >
                  {(schoolProfile.academicSessions || ['2024-2025', '2025-2026']).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Reason for Transfer / Administrative Remarks *
                </label>
                <input
                  type="text"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="e.g. Guardian request, academic reorganization"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <button
                onClick={handleExecuteTransfer}
                disabled={!selectedTransferStudent || isTransferring}
                className={`w-full py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  !selectedTransferStudent || isTransferring
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-amber-600 text-white hover:bg-amber-700 shadow-xs'
                }`}
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>Confirm Student Transfer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 3: CLASS 10 PASS-OUT BATCH */}
      {/* ========================================================================= */}
      {activeSubTab === 'passout' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-amber-500" />
                    <span>Eligible Class 10 Students for Graduation & Pass-Out</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Graduating Class 10 students will be archived, assigned SLC status, and removed from active roster.
                  </p>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Filter by Session:
                  </label>
                  <select
                    value={passOutSession}
                    onChange={(e) => {
                      setPassOutSession(e.target.value);
                      setSelectedPassOutIds([]);
                    }}
                    className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:bg-white focus:outline-hidden"
                  >
                    {(schoolProfile.academicSessions || ['2024-2025', '2025-2026']).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Select all bar */}
              <div className="flex items-center justify-between py-2 border-b border-slate-200">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      class10Students.length > 0 &&
                      selectedPassOutIds.length === class10Students.length
                    }
                    onChange={handleSelectAllPassOut}
                    disabled={class10Students.length === 0}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Select All ({class10Students.length} Class 10 students)</span>
                </label>
                <span className="text-xs text-slate-500">
                  Selected: <strong className="text-amber-600">{selectedPassOutIds.length}</strong>
                </span>
              </div>

              {/* Class 10 students list */}
              <div className="mt-3 max-h-96 overflow-y-auto divide-y divide-slate-100">
                {class10Students.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    No active Class 10 students found for Session {passOutSession}.
                  </div>
                ) : (
                  class10Students.map((student) => {
                    const isChecked = selectedPassOutIds.includes(student.id);
                    return (
                      <div
                        key={student.id}
                        onClick={() => togglePassOutStudent(student.id)}
                        className={`flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition-colors ${
                          isChecked ? 'bg-amber-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                          />
                          <div>
                            <div className="font-semibold text-slate-900">{student.fullName}</div>
                            <div className="text-[11px] text-slate-500">
                              S/O {student.fatherName} · Adm #{student.admissionNumber} · Perm ID: {student.permanentStudentId || '—'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                            Roll #{student.rollNumber || '—'}
                          </span>
                          <span className="ml-2 text-slate-500 text-[11px]">Sec {student.section || 'A'}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right: Pass-Out Form */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-5 space-y-3">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                <span>Graduation Batch Parameters</span>
              </h2>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Pass-Out Session *
                </label>
                <input
                  type="text"
                  value={passOutSession}
                  disabled
                  className="w-full bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 font-semibold cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Pass-Out / SLC Date *
                </label>
                <input
                  type="date"
                  value={passOutDate}
                  onChange={(e) => setPassOutDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Board & Examination Remarks *
                </label>
                <textarea
                  rows={3}
                  value={passOutRemarks}
                  onChange={(e) => setPassOutRemarks(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-200/70 rounded-lg text-[11px] text-blue-900">
                Students will be moved to the <strong>Pass-Out Archive</strong> and marked as <code>SLC</code>. Their records, certificates, and examination history remain permanently retrievable for future verifications.
              </div>

              <button
                onClick={() => setShowPassOutConfirmModal(true)}
                disabled={selectedPassOutIds.length === 0 || isProcessingPassOut}
                className={`w-full py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  selectedPassOutIds.length === 0 || isProcessingPassOut
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-amber-600 text-white hover:bg-amber-700 shadow-xs'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>Process Pass-Out for ({selectedPassOutIds.length}) Students</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Pass-Out */}
      {showPassOutConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <GraduationCap className="w-6 h-6" />
              <h3 className="font-bold text-slate-900 text-base">Confirm Class 10 Pass-Out Batch</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              You are about to graduate and archive <strong>{selectedPassOutIds.length}</strong> Class 10 student(s) for{' '}
              <strong>Session {passOutSession}</strong> on <strong>{passOutDate}</strong>.
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 text-xs text-amber-900 rounded-lg">
              This will update their official status to <code>SLC</code> and archive them from active class listings.
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowPassOutConfirmModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecutePassOut}
                disabled={isProcessingPassOut}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 cursor-pointer"
              >
                {isProcessingPassOut ? 'Processing...' : 'Yes, Confirm Pass-Out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 4: PASS-OUT ARCHIVE */}
      {/* ========================================================================= */}
      {activeSubTab === 'archive' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Archive className="w-5 h-5 text-amber-500" />
                <span>Class 10 Pass-Out Alumni Register</span>
              </h2>
              <p className="text-xs text-slate-500">
                Permanent historical register of students who completed matriculation at Siqarah Public Model High School Shorkot.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={archiveFilterSession}
                onChange={(e) => setArchiveFilterSession(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800"
              >
                <option value="All">All Pass-Out Sessions</option>
                {(schoolProfile.academicSessions || []).map((s) => (
                  <option key={s} value={s}>
                    Session {s}
                  </option>
                ))}
              </select>
              <button
                onClick={async () => {
                  if (archivePrintRef.current) {
                    await downloadElementAsPDF(
                      archivePrintRef.current,
                      `Alumni_Register_Session_${archiveFilterSession}.pdf`,
                      { orientation: 'landscape' }
                    );
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-xs font-medium text-white cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </button>
              <button
                onClick={() => printElement(archivePrintRef.current, `Alumni_Register_Session_${archiveFilterSession}`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>Print Register</span>
              </button>
            </div>
          </div>

          <div ref={archivePrintRef} id="printable-document" className="printable-area overflow-x-auto bg-white p-2">
            <div className="hidden print:block mb-4 text-center border-b pb-2">
              <h2 className="text-base font-bold uppercase">{schoolProfile.schoolName}</h2>
              <p className="text-xs text-slate-600">Class 10 Matriculation Pass-Out Alumni Register · {archiveFilterSession === 'All' ? 'All Sessions' : `Session ${archiveFilterSession}`}</p>
            </div>
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Sr #</th>
                  <th className="py-2.5 px-3">Permanent ID</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Father's Name</th>
                  <th className="py-2.5 px-3">Adm #</th>
                  <th className="py-2.5 px-3">Pass-Out Session</th>
                  <th className="py-2.5 px-3">Pass-Out Date</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredArchive.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400">
                      No archived pass-out records found for selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredArchive.map((student, idx) => (
                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 text-slate-500 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-700">
                        {student.permanentStudentId || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{student.fullName}</td>
                      <td className="py-2.5 px-3 text-slate-600">{student.fatherName}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">{student.admissionNumber}</td>
                      <td className="py-2.5 px-3 text-slate-700 font-medium">{student.passOutSession || student.session}</td>
                      <td className="py-2.5 px-3 text-slate-500">{student.passOutDate || '—'}</td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                          {student.status || 'SLC'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
