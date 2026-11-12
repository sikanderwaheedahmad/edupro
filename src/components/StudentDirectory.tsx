/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  User,
  Phone,
  MapPin,
  Calendar,
  Printer,
  Trash2,
  Filter,
  Download,
  Edit2,
  Eye,
  AlertTriangle,
  CheckCircle2,
  X,
  Camera,
  UserCheck,
  FileCheck,
  UserX,
  ArrowRightLeft,
  Clock,
  ShieldAlert,
  FileSpreadsheet,
} from 'lucide-react';
import { StudentRecord, FeeVoucher, SchoolProfile, UserRole, StudentStatus } from '../types/school.ts';
import { formatPKR, formatDate } from '../utils/voucherHelpers.ts';
import { compressImage } from '../utils/imageCompress.ts';
import { downloadElementAsPDF, exportTableToPDF, exportToExcel } from '../utils/pdfExport.ts';
import { printElement } from '../utils/printHelper.ts';
import { getSchoolLogoSrc } from '../utils/schoolBranding.ts';
import { fastUpload } from '../utils/fastUpload.ts';

interface StudentDirectoryProps {
  students: StudentRecord[];
  vouchers: FeeVoucher[];
  schoolProfile: SchoolProfile;
  userRole: UserRole;
  loading: boolean;
  onOpenVoucher: (studentId: string) => void;
  onUpdateStudent: (studentId: string, updated: Partial<StudentRecord>) => Promise<void>;
  onDeleteStudent: (studentId: string) => Promise<void>;
}

export const StudentDirectory: React.FC<StudentDirectoryProps> = ({
  students,
  vouchers,
  schoolProfile,
  userRole,
  loading,
  onOpenVoucher,
  onUpdateStudent,
  onDeleteStudent,
}) => {
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Enrolled' | 'SLC' | 'Struck Off'>('ALL');

  // Modals
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [viewingStudent, setViewingStudent] = useState<StudentRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudentRecord | null>(null);
  const [actionNotice, setActionNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Status Change Modal State
  const [statusModalStudent, setStatusModalStudent] = useState<StudentRecord | null>(null);
  const [newStatus, setNewStatus] = useState<StudentStatus>('Enrolled');
  const [statusDate, setStatusDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusReason, setStatusReason] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Edit fields
  const [editName, setEditName] = useState('');
  const [editFatherName, setEditFatherName] = useState('');
  const [editClass, setEditClass] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editGender, setEditGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [editSession, setEditSession] = useState('');
  const [editAdmissionFee, setEditAdmissionFee] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [compressing, setCompressing] = useState(false);

  const printableAdmissionFormRef = useRef<HTMLDivElement | null>(null);
  const [printableTarget, setPrintableTarget] = useState<StudentRecord | null>(null);

  const logoSrc = getSchoolLogoSrc(schoolProfile);
  const stampSrc = schoolProfile.stampUrl || '/assets/school_stamp.jpg';

  // Map studentId to voucher
  const voucherMap = new Map<string, FeeVoucher>();
  vouchers.forEach((v) => voucherMap.set(v.studentId, v));

  // Counts for the 3 distinct dashboard sections/tabs
  const enrolledCount = students.filter((s) => !s.status || s.status === 'Enrolled').length;
  const slcCount = students.filter((s) => s.status === 'SLC' || s.isPassOut === 1).length;
  const struckOffCount = students.filter((s) => s.status === 'Struck Off' || s.status === 'Stuck').length;

  const filteredStudents = students.filter((s) => {
    // 3 Status Tabs Filter
    if (statusFilter === 'Enrolled') {
      if (s.status && s.status !== 'Enrolled') return false;
    } else if (statusFilter === 'SLC') {
      if (s.status !== 'SLC' && s.isPassOut !== 1) return false;
    } else if (statusFilter === 'Struck Off') {
      if (s.status !== 'Struck Off' && s.status !== 'Stuck') return false;
    }

    if (classFilter !== 'ALL' && s.studentClass !== classFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        s.fullName.toLowerCase().includes(q) ||
        s.fatherName.toLowerCase().includes(q) ||
        s.admissionNumber.toLowerCase().includes(q) ||
        s.mobileNumber.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 24;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, classFilter, statusFilter]);

  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1;
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const classes = Array.from(new Set(students.map((s) => s.studentClass))).sort();

  const openStatusModal = (st: StudentRecord) => {
    setStatusModalStudent(st);
    const curr = st.status === 'Stuck' ? 'Struck Off' : (st.status || 'Enrolled');
    setNewStatus(curr);
    setStatusDate(new Date().toISOString().split('T')[0]);
    setStatusReason('');
  };

  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusModalStudent) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/students/${statusModalStudent.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          reason: statusReason.trim() || `Status updated to ${newStatus}`,
          statusDate,
          adminName: `Administrator (${userRole})`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update student status');
      await onUpdateStudent(statusModalStudent.id, { status: newStatus });
      setActionNotice({
        text: `Student "${statusModalStudent.fullName}" (${statusModalStudent.admissionNumber}) status updated to "${newStatus}". Historical data preserved.`,
        type: 'success',
      });
      setStatusModalStudent(null);
    } catch (err: any) {
      setActionNotice({ text: err.message || 'Status update failed', type: 'error' });
    } finally {
      setUpdatingStatus(false);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  const openEditModal = (st: StudentRecord) => {
    setEditingStudent(st);
    setEditName(st.fullName);
    setEditFatherName(st.fatherName);
    setEditClass(st.studentClass);
    setEditMobile(st.mobileNumber);
    setEditAddress(st.address);
    setEditDob(st.dob);
    setEditGender(st.gender);
    setEditSession(st.session);
    setEditAdmissionFee(String(st.admissionFee));
    setEditPhotoUrl(st.photoUrl || '');
  };

  const [photoProgress, setPhotoProgress] = useState(0);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    setPhotoProgress(0);
    try {
      const activeSchoolId = editingStudent?.schoolId || (schoolProfile as any).id || (schoolProfile as any).schoolId || 'school_primary';
      const result = await fastUpload({
        file,
        category: 'students',
        schoolId: activeSchoolId,
        onProgress: (pct) => setPhotoProgress(pct),
      });
      if (result.success && result.url) {
        setEditPhotoUrl(result.url);
      }
    } catch (err) {
      console.warn('[StudentDirectory] Fast upload notice, using compressed fallback:', err);
      try {
        const compressed = await compressImage(file, 800, 800, 0.82);
        setEditPhotoUrl(compressed);
      } catch (cErr) {
        console.error('Failed to compress image:', cErr);
      }
    } finally {
      setCompressing(false);
      setPhotoProgress(0);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setSaving(true);
    try {
      await onUpdateStudent(editingStudent.id, {
        fullName: editName.trim(),
        fatherName: editFatherName.trim(),
        studentClass: editClass,
        mobileNumber: editMobile.trim(),
        address: editAddress.trim(),
        dob: editDob,
        gender: editGender,
        session: editSession,
        admissionFee: parseFloat(editAdmissionFee) || editingStudent.admissionFee,
        photoUrl: editPhotoUrl,
      });
      setActionNotice({
        text: `Student "${editName}" (${editingStudent.admissionNumber}) updated successfully.`,
        type: 'success',
      });
      setEditingStudent(null);
    } catch (err: any) {
      setActionNotice({ text: err.message || 'Failed to update student.', type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await onDeleteStudent(deleteTarget.id);
      setActionNotice({
        text: `Student "${deleteTarget.fullName}" (${deleteTarget.admissionNumber}) and linked fee voucher moved to Recycle Bin.`,
        type: 'success',
      });
      setDeleteTarget(null);
    } catch (err: any) {
      setActionNotice({ text: err.message || 'Failed to delete student.', type: 'error' });
    } finally {
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  const handleDownloadAdmissionFormPDF = async (st: StudentRecord) => {
    setPrintableTarget(st);
    setTimeout(async () => {
      if (printableAdmissionFormRef.current) {
        const schoolSlug = (schoolProfile.schoolName || 'School').replace(/[^a-zA-Z0-9]/g, '_');
        const slug = st.fullName.replace(/[^a-zA-Z0-9]/g, '_');
        const filename = `${slug}_Admission_Form_${schoolSlug}.pdf`;
        await downloadElementAsPDF(printableAdmissionFormRef.current, filename);
        setActionNotice({ text: `Downloaded ${filename} successfully.`, type: 'success' });
        setTimeout(() => setActionNotice(null), 3000);
      }
    }, 150);
  };

  const handlePrintAdmissionForm = (st: StudentRecord) => {
    setPrintableTarget(st);
    setTimeout(() => {
      printElement(printableAdmissionFormRef.current);
    }, 150);
  };

  const handleExportFilteredPDF = () => {
    const schoolSlug = (schoolProfile.schoolName || 'School').replace(/[^a-zA-Z0-9]/g, '_');
    const classLabel = classFilter === 'ALL' ? 'All_Classes' : classFilter.replace(/\s+/g, '_');
    const filename = `${schoolSlug}_Students_${classLabel}_${statusFilter}.pdf`;
    const title = `Student Records Register (${classFilter === 'ALL' ? 'All Classes' : classFilter} · ${statusFilter})`;

    const headers = [
      'Sr #',
      'Adm #',
      'Roll #',
      'Student Name',
      "Father's Name",
      'Class',
      'Sec',
      'Gender',
      'Contact',
      'DOB',
      'Status',
    ];

    const rows: (string | number)[][] = filteredStudents.map((st, i) => [
      i + 1,
      st.admissionNumber,
      st.rollNumber || 'N/A',
      st.fullName,
      st.fatherName,
      st.studentClass,
      st.section || 'A',
      st.gender,
      st.mobileNumber || '',
      st.dob || '',
      st.status || 'Enrolled',
    ]);

    exportTableToPDF(
      filename,
      title,
      schoolProfile.schoolName,
      schoolProfile.activeSession,
      headers,
      rows,
      { orientation: 'landscape' }
    );
  };

  const handleExportFilteredExcel = () => {
    const schoolSlug = (schoolProfile.schoolName || 'School').replace(/[^a-zA-Z0-9]/g, '_');
    const classLabel = classFilter === 'ALL' ? 'All_Classes' : classFilter.replace(/\s+/g, '_');
    const filename = `${schoolSlug}_Students_${classLabel}_${statusFilter}.xls`;

    const headers = [
      'Sr #',
      'Admission Number',
      'Permanent ID',
      'Roll Number',
      'Student Name',
      "Father's Name",
      'Class',
      'Section',
      'Gender',
      'Date of Birth',
      'Contact Number',
      'Residential Address',
      'Admission Date',
      'Academic Session',
      'Enrollment Status',
      'Admission Fee (PKR)',
    ];

    const rows: (string | number)[][] = filteredStudents.map((st, i) => [
      i + 1,
      st.admissionNumber,
      st.permanentStudentId || st.admissionNumber,
      st.rollNumber || 'N/A',
      st.fullName,
      st.fatherName,
      st.studentClass,
      st.section || 'A',
      st.gender,
      st.dob || '',
      st.mobileNumber || '',
      st.address || '',
      st.admissionDate || '',
      st.session,
      st.status || 'Enrolled',
      st.admissionFee || 0,
    ]);

    exportToExcel(filename, 'Students', headers, rows);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Student Admission Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Complete register of admitted students, class placements, parent contacts, voucher records, and full management controls.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs font-semibold bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg">
            Total: <strong className="font-tabular">{students.length}</strong>
            {filteredStudents.length !== students.length && (
              <span className="ml-1 text-slate-500 font-normal">({filteredStudents.length} filtered)</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleExportFilteredPDF}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Download vector PDF of currently filtered student records"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
          <button
            type="button"
            onClick={handleExportFilteredExcel}
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Download Excel spreadsheet of currently filtered student records"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
            actionNotice.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionNotice.text}</span>
        </div>
      )}

      {/* 3 Distinct Student Status Tabs / Sections */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={`flex items-center justify-between p-3.5 rounded-xl border transition-all text-left ${
            statusFilter === 'ALL'
              ? 'bg-slate-900 border-slate-900 text-white shadow-md'
              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${statusFilter === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
              <User className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider font-bold">All Records</div>
              <div className="text-xs opacity-75">Entire Directory</div>
            </div>
          </div>
          <span className={`text-base font-black font-tabular px-2 py-0.5 rounded-md ${
            statusFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-900'
          }`}>
            {students.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('Enrolled')}
          className={`flex items-center justify-between p-3.5 rounded-xl border transition-all text-left ${
            statusFilter === 'Enrolled'
              ? 'bg-emerald-700 border-emerald-700 text-white shadow-md'
              : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/40'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${statusFilter === 'Enrolled' ? 'bg-emerald-800 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider font-bold">Enrolled Students</div>
              <div className="text-xs opacity-75">Active Regular</div>
            </div>
          </div>
          <span className={`text-base font-black font-tabular px-2 py-0.5 rounded-md ${
            statusFilter === 'Enrolled' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700 font-bold'
          }`}>
            {enrolledCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('SLC')}
          className={`flex items-center justify-between p-3.5 rounded-xl border transition-all text-left ${
            statusFilter === 'SLC'
              ? 'bg-blue-700 border-blue-700 text-white shadow-md'
              : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/40'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${statusFilter === 'SLC' ? 'bg-blue-800 text-white' : 'bg-blue-50 text-blue-600'}`}>
              <FileCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider font-bold">SLC Students</div>
              <div className="text-xs opacity-75">Certificate Issued</div>
            </div>
          </div>
          <span className={`text-base font-black font-tabular px-2 py-0.5 rounded-md ${
            statusFilter === 'SLC' ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700 font-bold'
          }`}>
            {slcCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('Struck Off')}
          className={`flex items-center justify-between p-3.5 rounded-xl border transition-all text-left ${
            statusFilter === 'Struck Off'
              ? 'bg-rose-700 border-rose-700 text-white shadow-md'
              : 'bg-white border-slate-200 text-slate-700 hover:border-rose-300 hover:bg-rose-50/40'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${statusFilter === 'Struck Off' ? 'bg-rose-800 text-white' : 'bg-rose-50 text-rose-600'}`}>
              <UserX className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider font-bold">Struck Off</div>
              <div className="text-xs opacity-75">Discontinued / Left</div>
            </div>
          </div>
          <span className={`text-base font-black font-tabular px-2 py-0.5 rounded-md ${
            statusFilter === 'Struck Off' ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-700 font-bold'
          }`}>
            {struckOffCount}
          </span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student name, father name, admission #, phone..."
            className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-400/50"
          />
        </div>

        <div className="shrink-0">
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 bg-white font-medium"
          >
            <option value="ALL">All Classes ({students.length})</option>
            {classes.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Student Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStudents.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
            <User className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-medium text-sm text-slate-600">No student records found</p>
          </div>
        ) : (
          paginatedStudents.map((st) => {
            const v = voucherMap.get(st.id);
            const isPaid = v?.status === 'PAID';

            return (
              <div
                key={st.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start gap-3.5">
                  {/* Photo or placeholder */}
                  <div className="w-14 h-16 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                    {st.photoUrl ? (
                      <img
                        src={st.photoUrl}
                        alt={st.fullName}
                        className="w-full h-full object-cover object-top"
                      />
                    ) : (
                      <User className="w-6 h-6 text-slate-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-tabular font-bold text-amber-700 font-mono">
                        {st.admissionNumber}
                      </span>
                      <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                        {st.studentClass}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 truncate mt-0.5">
                      {st.fullName}
                    </h3>
                    <p className="text-xs text-slate-500 truncate">
                      S/D of {st.fatherName}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {/* Student Status Badge */}
                      {st.status === 'SLC' || st.isPassOut === 1 ? (
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <FileCheck className="w-3 h-3" /> SLC
                        </span>
                      ) : st.status === 'Struck Off' || st.status === 'Stuck' ? (
                        <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <UserX className="w-3 h-3" /> Struck Off
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <UserCheck className="w-3 h-3" /> Enrolled
                        </span>
                      )}

                      {isPaid ? (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                          Fee PAID
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                          Fee UNPAID ({formatPKR(st.admissionFee)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Details list */}
                <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-tabular">{st.mobileNumber}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{st.address}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Admitted: {formatDate(st.admissionDate)}</span>
                  </div>
                </div>

                {/* Universal Management Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-500 font-tabular font-bold">
                    Fee: {formatPKR(st.admissionFee)}
                  </span>

                  <div className="flex items-center gap-1">
                    {/* Status Change Modal */}
                    <button
                      onClick={() => openStatusModal(st)}
                      className="p-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded transition-colors"
                      title="Change Student Status (Enrolled / SLC / Struck Off)"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                    </button>

                    {/* View Profile */}
                    <button
                      onClick={() => setViewingStudent(st)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                      title="View Student Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    {/* Edit Student Record */}
                    <button
                      onClick={() => openEditModal(st)}
                      className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded transition-colors"
                      title="Edit Student Information"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Download Admission Form (PDF) */}
                    <button
                      onClick={() => handleDownloadAdmissionFormPDF(st)}
                      className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded transition-colors"
                      title="Download Student Admission Form (PDF)"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    {/* Print Admission Form */}
                    <button
                      onClick={() => handlePrintAdmissionForm(st)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                      title="Print Student Admission Form"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>

                    {/* View/Print Fee Voucher */}
                    <button
                      onClick={() => onOpenVoucher(st.id)}
                      className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-bold transition-colors"
                      title="Open Fee Voucher"
                    >
                      Voucher
                    </button>

                    {/* Delete Student (Soft Delete with Confirmation) */}
                    <button
                      onClick={() => setDeleteTarget(st)}
                      className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded transition-colors"
                      title="Delete Student Record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 text-xs text-slate-600 shadow-xs">
          <div>
            Showing <span className="font-bold text-slate-900">{(currentPage - 1) * pageSize + 1}</span> to{' '}
            <span className="font-bold text-slate-900">
              {Math.min(currentPage * pageSize, filteredStudents.length)}
            </span>{' '}
            of <span className="font-bold text-slate-900">{filteredStudents.length}</span> students
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white font-medium transition-colors"
            >
              Previous
            </button>
            <span className="font-semibold text-slate-800 px-2 font-mono">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white font-medium transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Edit Student: {editingStudent.fullName}
                </h3>
                <span className="text-[11px] font-mono text-amber-700 font-bold">
                  {editingStudent.admissionNumber}
                </span>
              </div>
              <button onClick={() => setEditingStudent(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              {/* Photo preview and replace */}
              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="w-14 h-16 rounded-lg bg-white border border-slate-300 overflow-hidden flex items-center justify-center shrink-0">
                  {editPhotoUrl ? (
                    <img src={editPhotoUrl} alt="Student" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <label className="block font-bold text-slate-700">Student Photograph</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-200 file:text-slate-800"
                  />
                  {compressing && (
                    <span className="text-[10px] text-emerald-600 font-semibold block">
                      ⚡ Uploading & optimizing {photoProgress > 0 ? `${photoProgress}%` : '...'}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Student Full Name *</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-lg border-slate-300"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Father's Name *</label>
                  <input
                    type="text"
                    value={editFatherName}
                    onChange={(e) => setEditFatherName(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-lg border-slate-300"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Class *</label>
                  <select
                    value={editClass}
                    onChange={(e) => setEditClass(e.target.value)}
                    className="w-full px-2.5 py-1.5 border rounded-lg border-slate-300 bg-white"
                  >
                    {schoolProfile.availableClasses.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Gender</label>
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 border rounded-lg border-slate-300 bg-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={editDob}
                    onChange={(e) => setEditDob(e.target.value)}
                    className="w-full px-2 py-1.5 border rounded-lg border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mobile Phone *</label>
                  <input
                    type="text"
                    value={editMobile}
                    onChange={(e) => setEditMobile(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-lg border-slate-300 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Admission Fee (PKR) *</label>
                  <input
                    type="number"
                    value={editAdmissionFee}
                    onChange={(e) => setEditAdmissionFee(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-lg border-slate-300 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Home Address *</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded-lg border-slate-300"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 border rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || compressing}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow-xs"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Student Profile Modal */}
      {viewingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-14 h-16 rounded-lg bg-slate-100 border border-slate-300 overflow-hidden flex items-center justify-center">
                  {viewingStudent.photoUrl ? (
                    <img src={viewingStudent.photoUrl} alt="Photo" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-7 h-7 text-slate-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-950">{viewingStudent.fullName}</h3>
                  <p className="text-xs text-amber-800 font-mono font-bold">{viewingStudent.admissionNumber}</p>
                  <p className="text-[11px] text-slate-500">Class: {viewingStudent.studentClass} ({viewingStudent.session})</p>
                </div>
              </div>
              <button onClick={() => setViewingStudent(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs divide-y divide-slate-100">
              <div className="flex justify-between py-1.5"><span className="text-slate-500">Father's Name:</span> <strong className="text-slate-900">{viewingStudent.fatherName}</strong></div>
              <div className="flex justify-between py-1.5"><span className="text-slate-500">Date of Birth:</span> <strong className="text-slate-900">{formatDate(viewingStudent.dob)}</strong></div>
              <div className="flex justify-between py-1.5"><span className="text-slate-500">Gender:</span> <strong className="text-slate-900">{viewingStudent.gender}</strong></div>
              <div className="flex justify-between py-1.5"><span className="text-slate-500">Admission Date:</span> <strong className="text-slate-900">{formatDate(viewingStudent.admissionDate)}</strong></div>
              <div className="flex justify-between py-1.5"><span className="text-slate-500">Parent Mobile:</span> <strong className="font-mono text-slate-900">{viewingStudent.mobileNumber}</strong></div>
              <div className="flex justify-between py-1.5"><span className="text-slate-500">Admission Fee:</span> <strong className="text-slate-900 font-bold">{formatPKR(viewingStudent.admissionFee)}</strong></div>
              <div className="flex justify-between py-1.5"><span className="text-slate-500">Home Address:</span> <strong className="text-slate-900 text-right max-w-[220px]">{viewingStudent.address}</strong></div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => {
                  handleDownloadAdmissionFormPDF(viewingStudent);
                  setViewingStudent(null);
                }}
                className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-lg flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Admission Form (PDF)</span>
              </button>
              <button
                onClick={() => setViewingStudent(null)}
                className="px-4 py-1.5 bg-slate-900 text-white font-semibold text-xs rounded-lg hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Status Change Modal */}
      {statusModalStudent && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-purple-50 text-purple-700">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Change Student Status</h3>
                  <p className="text-xs text-slate-500">
                    {statusModalStudent.fullName} · {statusModalStudent.admissionNumber} ({statusModalStudent.studentClass})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStatusModalStudent(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStatus} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Select Target Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewStatus('Enrolled')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      newStatus === 'Enrolled'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <UserCheck className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                    <span className="text-xs block">Enrolled</span>
                    <span className="text-[10px] text-slate-500 block">Active Student</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewStatus('SLC')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      newStatus === 'SLC'
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <FileCheck className="w-5 h-5 mx-auto mb-1 text-blue-600" />
                    <span className="text-xs block">SLC</span>
                    <span className="text-[10px] text-slate-500 block">Passed / Left</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewStatus('Struck Off')}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      newStatus === 'Struck Off'
                        ? 'border-rose-600 bg-rose-50 text-rose-900 font-bold ring-2 ring-rose-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <UserX className="w-5 h-5 mx-auto mb-1 text-rose-600" />
                    <span className="text-xs block">Struck Off</span>
                    <span className="text-[10px] text-slate-500 block">Discontinued</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Effective Status Date
                  </label>
                  <input
                    type="date"
                    required
                    value={statusDate}
                    onChange={(e) => setStatusDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-purple-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Authorized By
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`${userRole} (Official Audit Log)`}
                    className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 text-slate-600 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason / Remarks for Status Change
                </label>
                <textarea
                  rows={2}
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="e.g., Parent requested school leaving certificate due to family relocation, or re-admitted..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-purple-400"
                />
              </div>

              <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-xs text-purple-900 flex items-start gap-2">
                <Clock className="w-4 h-4 shrink-0 mt-0.5 text-purple-700" />
                <div className="space-y-0.5">
                  <p className="font-bold">Permanent Audit Trail & Data Preservation:</p>
                  <p className="text-[11px] text-purple-800">
                    Changing status immediately reflects in Enrolled, SLC, and Struck Off tabs. Historical records, fee vouchers, and certificates remain intact.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStatusModalStudent(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingStatus}
                  className="px-4 py-2 text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white rounded-lg shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {updatingStatus ? (
                    <span>Updating...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Save Status Change</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Student Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900">Move Student to Recycle Bin?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete student{' '}
              <strong>{deleteTarget.fullName}</strong> ({deleteTarget.admissionNumber}) from Class{' '}
              <strong>{deleteTarget.studentClass}</strong>?
            </p>
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-900 space-y-1">
              <p className="font-bold">Referential Integrity Protection:</p>
              <p className="text-[11px] text-amber-800">
                The linked Fee Voucher ({deleteTarget.admissionNumber}) will also be moved to the Recycle Bin. You can restore both anytime from the Recycle Bin.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs"
              >
                Confirm Move to Recycle Bin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Off-screen Container for Generating & Printing Completed Student Admission Form (A4) */}
      <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', width: '800px', pointerEvents: 'none', zIndex: -1 }}>
        <div
          ref={printableAdmissionFormRef}
          id="printable-document"
          className="printable-area bg-white p-8 sm:p-12 text-slate-900 font-sans min-h-[1050px] flex flex-col justify-between"
          style={{ width: '800px', margin: '0 auto' }}
        >
          <div>
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-4">
              <div className="w-16 h-16 rounded-full border border-amber-500 overflow-hidden flex items-center justify-center">
                <img src={logoSrc} alt="School Logo" className="w-full h-full object-contain" />
              </div>
              <div className="text-center flex-1 px-4">
                <h1 className="text-lg font-black uppercase text-slate-950 tracking-wider">
                  {schoolProfile.schoolName}
                </h1>
                <p className="text-[10px] text-slate-600 mt-0.5">
                  Affiliated with Board of Intermediate & Secondary Education ({schoolProfile.board})
                </p>
                <p className="text-[9px] text-slate-500">
                  {schoolProfile.campusAddress} · Principal: {schoolProfile.principal || 'Principal'}
                </p>
              </div>
              <div className="w-20 h-24 border-2 border-slate-300 rounded overflow-hidden flex flex-col items-center justify-center text-center p-1">
                {printableTarget?.photoUrl ? (
                  <img src={printableTarget.photoUrl} alt="Photo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[9px] text-slate-400">Student Photo</span>
                )}
              </div>
            </div>

            <div className="text-center my-4">
              <h2 className="text-sm font-extrabold uppercase tracking-wide bg-slate-900 text-white py-1 px-4 rounded inline-block">
                OFFICIAL STUDENT ADMISSION RECORD & FORM
              </h2>
            </div>

            {/* Admission Form Table */}
            <div className="border border-slate-300 rounded-lg overflow-hidden text-xs divide-y divide-slate-200 mt-4">
              <div className="grid grid-cols-2 divide-x divide-slate-200">
                <div className="p-2.5">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">1. Admission Number:</span>
                  <div className="font-mono font-bold text-amber-800 pt-1">{printableTarget?.admissionNumber}</div>
                </div>
                <div className="p-2.5">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">2. Date of Admission:</span>
                  <div className="font-mono font-bold text-slate-950 pt-1">{formatDate(printableTarget?.admissionDate || '')}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 divide-x divide-slate-200">
                <div className="p-2.5">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">3. Student Full Name:</span>
                  <div className="font-bold text-slate-950 pt-1">{printableTarget?.fullName}</div>
                </div>
                <div className="p-2.5">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">4. Father's Name:</span>
                  <div className="font-bold text-slate-950 pt-1">{printableTarget?.fatherName}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 divide-x divide-slate-200">
                <div className="p-2.5">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">5. Admitted Class:</span>
                  <div className="font-bold text-slate-950 pt-1">{printableTarget?.studentClass}</div>
                </div>
                <div className="p-2.5">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">6. Academic Session:</span>
                  <div className="font-bold text-slate-950 pt-1">{printableTarget?.session}</div>
                </div>
                <div className="p-2.5">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">7. Gender:</span>
                  <div className="font-bold text-slate-950 pt-1">{printableTarget?.gender}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 divide-x divide-slate-200">
                <div className="p-2.5">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">8. Date of Birth:</span>
                  <div className="font-mono font-bold text-slate-950 pt-1">{formatDate(printableTarget?.dob || '')}</div>
                </div>
                <div className="p-2.5">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">9. Parent / Guardian Phone:</span>
                  <div className="font-mono font-bold text-slate-950 pt-1">{printableTarget?.mobileNumber}</div>
                </div>
              </div>

              <div className="p-2.5">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">10. Residential Address:</span>
                <div className="font-bold text-slate-950 pt-1">{printableTarget?.address}</div>
              </div>

              <div className="p-2.5 bg-slate-50">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">11. Admission Fee Amount:</span>
                <div className="font-bold font-mono text-emerald-800 text-sm pt-1">
                  {formatPKR(printableTarget?.admissionFee || 0)}
                </div>
              </div>
            </div>

            {/* Declaration */}
            <div className="mt-6 border border-slate-200 rounded-lg p-3 bg-slate-50 text-[11px] text-slate-600 leading-relaxed">
              <span className="font-bold text-slate-900 block mb-1">Parent / Guardian Undertaking:</span>
              I hereby declare that all particulars entered above are correct to the best of my knowledge. I promise to abide by all the rules, discipline guidelines, and examination policies of {schoolProfile.schoolName}.
            </div>
          </div>

          {/* Signatures */}
          <div className="pt-8 border-t border-slate-300 grid grid-cols-3 gap-6 text-xs text-center">
            <div>
              <div className="h-10 border-b border-slate-800 mb-1"></div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Parent Signature</span>
            </div>
            <div>
              <div className="w-16 h-16 mx-auto opacity-80">
                <img src={stampSrc} alt="Stamp" className="w-full h-full object-contain" />
              </div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">School Stamp</span>
            </div>
            <div>
              <div className="h-10 border-b border-slate-800 mb-1 flex items-end justify-center pb-0.5">
                <span className="font-serif italic text-sm text-slate-800">{schoolProfile.principal || 'Principal'}</span>
              </div>
              <strong className="text-[11px] text-slate-950 block">{schoolProfile.principal || 'Principal'}</strong>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Principal</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
