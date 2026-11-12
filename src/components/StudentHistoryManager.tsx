/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  History,
  Search,
  User,
  Phone,
  MapPin,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  Download,
  Filter,
  GraduationCap,
  ArrowRightLeft,
  FileText,
  BadgeAlert,
  Edit,
  Tag,
} from 'lucide-react';
import { StudentRecord, StudentHistoryItem, StudentStatus, SchoolProfile, UserRole } from '../types/school.ts';
import { downloadElementAsPDF, printElement } from '../utils/pdfExport.ts';

interface StudentHistoryManagerProps {
  students: StudentRecord[];
  schoolProfile: SchoolProfile;
  userRole: UserRole;
  onRefreshStudents: () => void;
}

export const StudentHistoryManager: React.FC<StudentHistoryManagerProps> = ({
  students,
  schoolProfile,
  userRole,
  onRefreshStudents,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [historyItems, setHistoryItems] = useState<StudentHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Status Change Modal State
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [targetStatus, setTargetStatus] = useState<StudentStatus>('Enrolled');
  const [statusReason, setStatusReason] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Filter students based on search query
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) {
      return students.filter((s) => !s.isDeleted).slice(0, 20);
    }
    const q = searchQuery.toLowerCase().trim();
    return students.filter((s) => {
      if (s.isDeleted) return false;
      return (
        s.fullName.toLowerCase().includes(q) ||
        s.admissionNumber.toLowerCase().includes(q) ||
        (s.permanentStudentId && s.permanentStudentId.toLowerCase().includes(q)) ||
        s.fatherName.toLowerCase().includes(q) ||
        (s.rollNumber && s.rollNumber.toLowerCase().includes(q)) ||
        (s.previousRollNumber && s.previousRollNumber.toLowerCase().includes(q)) ||
        s.mobileNumber.toLowerCase().includes(q)
      );
    });
  }, [students, searchQuery]);

  // Set default selected student
  useEffect(() => {
    if (!selectedStudentId && filteredStudents.length > 0) {
      setSelectedStudentId(filteredStudents[0].id);
    }
  }, [filteredStudents, selectedStudentId]);

  const selectedStudent = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId) || null;
  }, [students, selectedStudentId]);

  // Fetch history for selected student
  useEffect(() => {
    if (!selectedStudentId) {
      setHistoryItems([]);
      return;
    }
    let isMounted = true;
    const fetchHistory = async () => {
      try {
        setLoadingHistory(true);
        const res = await fetch(`/api/students/${selectedStudentId}/history`);
        if (res.ok && isMounted) {
          const data = await res.json();
          setHistoryItems(data);
        }
      } catch (err) {
        console.error('Error fetching student history:', err);
      } finally {
        if (isMounted) setLoadingHistory(false);
      }
    };
    fetchHistory();
    return () => {
      isMounted = false;
    };
  }, [selectedStudentId]);

  const handleOpenStatusModal = () => {
    if (!selectedStudent) return;
    setTargetStatus(selectedStudent.status || 'Enrolled');
    setStatusReason('');
    setShowStatusModal(true);
  };

  const handleSaveStatus = async () => {
    if (!selectedStudent) return;
    try {
      setIsUpdatingStatus(true);
      const res = await fetch(`/api/students/${selectedStudent.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: targetStatus,
          reason: statusReason || `Status updated to ${targetStatus}`,
          adminName: userRole === 'Principal' ? schoolProfile.principal : `${userRole} Administrator`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');

      setActionMessage({
        text: `Successfully changed status of ${selectedStudent.fullName} to ${targetStatus}`,
        type: 'success',
      });
      setShowStatusModal(false);
      onRefreshStudents();
      // Re-fetch history
      const historyRes = await fetch(`/api/students/${selectedStudent.id}/history`);
      if (historyRes.ok) {
        setHistoryItems(await historyRes.json());
      }
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Status update failed', type: 'error' });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!printRef.current || !selectedStudent) return;
    try {
      setIsExportingPdf(true);
      await downloadElementAsPDF(
        printRef.current,
        `Student_Dossier_${selectedStudent.admissionNumber}_${selectedStudent.fullName.replace(/\s+/g, '_')}.pdf`,
        {
          format: 'a4',
          orientation: 'portrait',
        }
      );
    } catch (err) {
      console.error('PDF export failed:', err);
      window.print();
    } finally {
      setIsExportingPdf(false);
    }
  };

  const getStatusBadge = (status?: StudentStatus) => {
    const s = status || 'Enrolled';
    switch (s) {
      case 'Enrolled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Enrolled
          </span>
        );
      case 'Stuck':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Stuck (Hold)
          </span>
        );
      case 'Expired':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Expired / Struck Off
          </span>
        );
      case 'SLC':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            SLC (School Leaving Certificate)
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Banner */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Student History & Status Tracking
              </h1>
              <p className="text-xs text-slate-500">
                Universal student lookup, chronological audit timeline, and official lifecycle status (Enrolled, Stuck, Expired, SLC).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onRefreshStudents()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 cursor-pointer"
            >
              <History className="w-3.5 h-3.5" />
              <span>Refresh Records</span>
            </button>
          </div>
        </div>

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
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (4 cols): Search & Selection List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 space-y-3">
            <label className="block text-xs font-bold text-slate-800">
              Search Student Directory
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Name, Perm ID, Adm #, Roll #, Mobile..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Showing {filteredStudents.length} student records
            </p>

            <div className="max-h-[550px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {filteredStudents.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No matching students found.
                </div>
              ) : (
                filteredStudents.map((s) => {
                  const isSelected = s.id === selectedStudentId;
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedStudentId(s.id)}
                      className={`p-3 text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-amber-50 border-l-4 border-amber-600 font-semibold'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-slate-900 font-bold">{s.fullName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          {s.studentClass} - {s.section || 'A'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Adm #{s.admissionNumber} · Roll #{s.rollNumber || '—'}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center justify-between mt-1">
                        <span>S/O {s.fatherName}</span>
                        <span className="text-[10px] font-mono text-amber-700">
                          {s.permanentStudentId || ''}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column (8 cols): Selected Student Details & Timeline */}
        <div className="lg:col-span-8 space-y-6">
          {selectedStudent ? (
            <>
              {/* Profile Card Header */}
              <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-200">
                  <div className="flex items-start gap-4">
                    {selectedStudent.photoUrl ? (
                      <img
                        src={selectedStudent.photoUrl}
                        alt={selectedStudent.fullName}
                        className="w-16 h-16 rounded-xl object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 font-bold text-xl">
                        {selectedStudent.fullName.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-900">
                          {selectedStudent.fullName}
                        </h2>
                        {getStatusBadge(selectedStudent.status)}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        S/O <strong>{selectedStudent.fatherName}</strong>
                        {selectedStudent.motherName ? ` · Mother: ${selectedStudent.motherName}` : ''}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-600 font-mono">
                        <span className="bg-slate-100 px-2 py-0.5 rounded">
                          Adm #{selectedStudent.admissionNumber}
                        </span>
                        <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded">
                          Perm ID: {selectedStudent.permanentStudentId || 'N/A'}
                        </span>
                        <span className="bg-slate-100 px-2 py-0.5 rounded">
                          Class: {selectedStudent.studentClass} ({selectedStudent.section || 'A'})
                        </span>
                        <span className="bg-slate-100 px-2 py-0.5 rounded">
                          Roll #{selectedStudent.rollNumber || '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions: Change Status & Print Dossier */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={handleOpenStatusModal}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors cursor-pointer shadow-xs"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Change Status</span>
                    </button>
                    <button
                      onClick={handleDownloadPdf}
                      disabled={isExportingPdf}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-medium cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      <span>{isExportingPdf ? 'Exporting...' : 'PDF Dossier'}</span>
                    </button>
                    <button
                      onClick={() => printElement(printRef.current, `Student_Dossier_${selectedStudent?.fullName || 'Student'}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-medium cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500" />
                      <span>Print</span>
                    </button>
                  </div>
                </div>

                {/* Additional Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Gender & DOB</span>
                    <span className="text-slate-800 font-medium">
                      {selectedStudent.gender} · {selectedStudent.dob}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Current Session</span>
                    <span className="text-slate-800 font-medium">{selectedStudent.session}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Admission Date</span>
                    <span className="text-slate-800 font-medium">{selectedStudent.admissionDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Contact Number</span>
                    <span className="text-slate-800 font-medium">{selectedStudent.mobileNumber}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Father CNIC</span>
                    <span className="text-slate-800 font-medium">{selectedStudent.fatherCnic || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Emergency Contact</span>
                    <span className="text-slate-800 font-medium">
                      {selectedStudent.emergencyContactPerson || '—'} ({selectedStudent.emergencyContactNumber || '—'})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Previous School</span>
                    <span className="text-slate-800 font-medium">{selectedStudent.previousSchool || 'None / Direct'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Admission Fee</span>
                    <span className="text-emerald-700 font-bold font-mono">
                      Rs. {selectedStudent.admissionFee.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Chronological Lifecycle Timeline */}
              <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span>Chronological Student History & Activity Log</span>
                  </h3>
                  <span className="text-xs text-slate-500">
                    {historyItems.length} recorded lifecycle event(s)
                  </span>
                </div>

                {loadingHistory ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    Loading student history...
                  </div>
                ) : historyItems.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    No timeline events recorded yet for this student.
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {historyItems.map((item) => (
                      <div key={item.id} className="relative group">
                        {/* Timeline Bullet */}
                        <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-white border-2 border-amber-500 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        </div>

                        <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 hover:border-slate-300 transition-colors space-y-1.5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <span className="font-bold text-xs text-slate-900">
                              {item.title}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {new Date(item.timestamp).toLocaleString()}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600">{item.description}</p>

                          {/* Event specifics */}
                          {(item.fromClass || item.toClass || item.fromSection || item.toSection) && (
                            <div className="text-[11px] text-slate-500 bg-white p-2 rounded border border-slate-200 font-mono flex flex-wrap items-center gap-2">
                              {item.fromClass && <span>From: {item.fromClass} (Sec {item.fromSection || 'A'})</span>}
                              {item.toClass && <span className="text-emerald-700 font-bold">➔ To: {item.toClass} (Sec {item.toSection || 'A'})</span>}
                              {item.toRollNumber && <span>· New Roll #{item.toRollNumber}</span>}
                              {item.toSession && <span>· Session: {item.toSession}</span>}
                            </div>
                          )}

                          {item.reason && (
                            <div className="text-[11px] text-slate-500 italic">
                              Reason: {item.reason}
                            </div>
                          )}

                          <div className="text-[10px] text-slate-400 text-right">
                            Authorized By: <strong>{item.performedBy}</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-12 text-center text-slate-400 text-xs">
              Select a student from the list on the left to inspect their dossier and timeline history.
            </div>
          )}
        </div>
      </div>

      {/* Change Status Modal */}
      {showStatusModal && selectedStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <BadgeAlert className="w-6 h-6" />
              <h3 className="font-bold text-slate-900 text-base">Change Student Official Status</h3>
            </div>
            <p className="text-xs text-slate-600">
              Updating status for <strong>{selectedStudent.fullName}</strong> (Adm #{selectedStudent.admissionNumber}).
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Select New Status *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Enrolled', 'Stuck', 'Expired', 'SLC'] as StudentStatus[]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setTargetStatus(status)}
                      className={`p-2.5 rounded-lg text-xs font-bold border text-left cursor-pointer transition-all ${
                        targetStatus === status
                          ? 'border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-500/20'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{status}</span>
                        {targetStatus === status && <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />}
                      </div>
                      <span className="block text-[10px] font-normal text-slate-500 mt-0.5">
                        {status === 'Enrolled' && 'Active studying student'}
                        {status === 'Stuck' && 'Fee default / Attendance hold'}
                        {status === 'Expired' && 'Long absent / Struck off'}
                        {status === 'SLC' && 'Left school with certificate'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Administrative Reason / Remarks *
                </label>
                <textarea
                  rows={3}
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="e.g. Cleared pending dues; issued character certificate; long medical absence"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveStatus}
                disabled={isUpdatingStatus}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 cursor-pointer"
              >
                {isUpdatingStatus ? 'Saving...' : 'Confirm Status Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Printable A4 Dossier Document */}
      {selectedStudent && (
        <div style={{ position: 'fixed', left: '-9999px', top: '-9999px' }}>
          <div
            ref={printRef}
            className="w-[210mm] min-h-[297mm] p-[15mm] bg-white text-slate-900 font-serif leading-normal"
          >
            {/* School Header */}
            <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
              <h1 className="text-xl font-bold uppercase tracking-wider text-slate-900">
                {schoolProfile.schoolName}
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                Affiliated with {schoolProfile.board}
              </p>
              <p className="text-[11px] text-slate-500">
                Principal: {schoolProfile.principal} · {schoolProfile.campusAddress} · {schoolProfile.phone}
              </p>
              <h2 className="text-sm font-bold uppercase tracking-widest mt-3 bg-slate-100 py-1 border border-slate-300">
                Official Student Record Dossier & Lifecycle History
              </h2>
            </div>

            {/* Profile Overview */}
            <div className="grid grid-cols-4 gap-3 text-xs mb-6 border border-slate-300 p-4 rounded bg-slate-50/50">
              <div>
                <span className="font-bold block text-slate-600">Student Name:</span>
                <span className="font-bold text-sm text-slate-900">{selectedStudent.fullName}</span>
              </div>
              <div>
                <span className="font-bold block text-slate-600">Father's Name:</span>
                <span>{selectedStudent.fatherName}</span>
              </div>
              <div>
                <span className="font-bold block text-slate-600">Admission #:</span>
                <span className="font-mono font-bold">{selectedStudent.admissionNumber}</span>
              </div>
              <div>
                <span className="font-bold block text-slate-600">Permanent ID:</span>
                <span className="font-mono font-bold text-amber-800">{selectedStudent.permanentStudentId || '—'}</span>
              </div>

              <div>
                <span className="font-bold block text-slate-600">Class & Section:</span>
                <span>{selectedStudent.studentClass} - Section {selectedStudent.section || 'A'}</span>
              </div>
              <div>
                <span className="font-bold block text-slate-600">Class Roll #:</span>
                <span>{selectedStudent.rollNumber || '—'}</span>
              </div>
              <div>
                <span className="font-bold block text-slate-600">Academic Session:</span>
                <span>{selectedStudent.session}</span>
              </div>
              <div>
                <span className="font-bold block text-slate-600">Current Status:</span>
                <span className="font-bold uppercase text-emerald-800">{selectedStudent.status || 'Enrolled'}</span>
              </div>

              <div>
                <span className="font-bold block text-slate-600">DOB & Gender:</span>
                <span>{selectedStudent.dob} ({selectedStudent.gender})</span>
              </div>
              <div>
                <span className="font-bold block text-slate-600">Father CNIC:</span>
                <span>{selectedStudent.fatherCnic || '—'}</span>
              </div>
              <div>
                <span className="font-bold block text-slate-600">Contact Number:</span>
                <span>{selectedStudent.mobileNumber}</span>
              </div>
              <div>
                <span className="font-bold block text-slate-600">Admission Date:</span>
                <span>{selectedStudent.admissionDate}</span>
              </div>

              <div className="col-span-4">
                <span className="font-bold block text-slate-600">Residential Address:</span>
                <span>{selectedStudent.address}</span>
              </div>
            </div>

            {/* Timeline Table */}
            <h3 className="text-xs font-bold uppercase tracking-wider mb-2 text-slate-800 border-b border-slate-400 pb-1">
              Historical Timeline & Record of Actions
            </h3>
            <table className="w-full text-[11px] text-left border-collapse border border-slate-300 mb-8">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                  <th className="p-2 border-r border-slate-300">Date</th>
                  <th className="p-2 border-r border-slate-300">Event</th>
                  <th className="p-2 border-r border-slate-300">Details / Description</th>
                  <th className="p-2 border-r border-slate-300">Class & Session</th>
                  <th className="p-2">Authorized By</th>
                </tr>
              </thead>
              <tbody>
                {historyItems.map((item, i) => (
                  <tr key={i} className="border-b border-slate-200">
                    <td className="p-2 border-r border-slate-200 font-mono">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </td>
                    <td className="p-2 border-r border-slate-200 font-semibold">{item.title}</td>
                    <td className="p-2 border-r border-slate-200">{item.description}</td>
                    <td className="p-2 border-r border-slate-200">
                      {item.toClass ? `${item.toClass} (${item.toSession || ''})` : '—'}
                    </td>
                    <td className="p-2">{item.performedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Signatures */}
            <div className="grid grid-cols-3 gap-6 pt-12 text-center text-xs">
              <div className="border-t border-slate-800 pt-2">
                <p className="font-bold">Prepared By (Clerk)</p>
                <p className="text-[10px] text-slate-500">Record Keeper</p>
              </div>
              <div className="border-t border-slate-800 pt-2">
                <p className="font-bold">Checked By</p>
                <p className="text-[10px] text-slate-500">Incharge Examination / Accounts</p>
              </div>
              <div className="border-t border-slate-800 pt-2">
                <p className="font-bold">{schoolProfile.principal}</p>
                <p className="text-[10px] text-slate-500">Principal & Authorized Stamp</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
