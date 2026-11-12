/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Users,
  Search,
  Briefcase,
  Phone,
  Mail,
  Calendar,
  Award,
  Plus,
  Printer,
  Download,
  DollarSign,
  FileText,
  UserCheck,
  Edit2,
  Trash2,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Camera,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { StaffRecord, SchoolProfile, UserRole } from '../types/school.ts';
import { formatPKR, formatDate } from '../utils/voucherHelpers.ts';
import { compressImage } from '../utils/imageCompress.ts';
import { fastUpload } from '../utils/fastUpload.ts';
import { downloadElementAsPDF, printElement } from '../utils/pdfExport.ts';

interface StaffDirectoryProps {
  staff: StaffRecord[];
  schoolProfile: SchoolProfile;
  loading: boolean;
  userRole: UserRole;
  onAddStaff: (newStaff: Omit<StaffRecord, 'id'>) => Promise<void>;
  onUpdateStaff: (staffId: string, updated: Partial<StaffRecord>) => Promise<void>;
  onDeleteStaff: (staffId: string) => Promise<void>;
  onSelectStaffForDoc: (staffId: string, docType: string) => void;
}

export const StaffDirectory: React.FC<StaffDirectoryProps> = ({
  staff,
  schoolProfile,
  loading,
  userRole,
  onAddStaff,
  onUpdateStaff,
  onDeleteStaff,
  onSelectStaffForDoc,
}) => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffRecord | null>(null);
  const [viewingStaff, setViewingStaff] = useState<StaffRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffRecord | null>(null);
  const [printableStaffTarget, setPrintableStaffTarget] = useState<StaffRecord | null>(null);
  const [isBlankFormMode, setIsBlankFormMode] = useState(false);

  // Form fields state
  const [fullName, setFullName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [staffIdNumber, setStaffIdNumber] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('Science');
  const [role, setRole] = useState<'Teaching' | 'Administrative' | 'Support'>('Teaching');
  const [cnic, setCnic] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [qualification, setQualification] = useState('');
  const [joiningDate, setJoiningDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [monthlySalary, setMonthlySalary] = useState('45000');
  const [status, setStatus] = useState<'ACTIVE' | 'ON_LEAVE' | 'RESIGNED'>('ACTIVE');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);
  const [actionNotice, setActionNotice] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const printableFormRef = useRef<HTMLDivElement | null>(null);

  const logoSrc = schoolProfile.logoUrl || '/assets/school_logo.jpg';
  const stampSrc = schoolProfile.stampUrl || '/assets/school_stamp.jpg';

  // Handle image upload with high-speed compression and tenant-isolated storage
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    setPhotoProgress(0);
    try {
      const activeSchoolId = (schoolProfile as any).id || (schoolProfile as any).schoolId || 'school_primary';
      const result = await fastUpload({
        file,
        category: 'staff',
        schoolId: activeSchoolId,
        onProgress: (pct) => setPhotoProgress(pct),
      });
      if (result.success && result.url) {
        setPhotoUrl(result.url);
      } else {
        const compressedBase64 = await compressImage(file, 800, 800, 0.82);
        setPhotoUrl(compressedBase64);
      }
    } catch (err) {
      console.warn('[StaffDirectory] Fast upload error, using fallback:', err);
      try {
        const compressedBase64 = await compressImage(file, 800, 800, 0.82);
        setPhotoUrl(compressedBase64);
      } catch (cErr) {
        console.error('Image compression failed:', cErr);
      }
    } finally {
      setCompressing(false);
      setPhotoProgress(0);
    }
  };

  const openAddModal = () => {
    const currentYear = new Date().getFullYear();
    const nextNum = String(staff.length + 1).padStart(4, '0');
    setFullName('');
    setFatherName('');
    setStaffIdNumber(`STF-${currentYear}-${nextNum}`);
    setDesignation('Senior Science Teacher');
    setDepartment('Science');
    setRole('Teaching');
    setCnic('');
    setMobileNumber('03');
    setEmail('');
    setAddress('Shorkot, Punjab, Pakistan');
    setQualification('M.Sc Physics / B.Ed');
    setJoiningDate(new Date().toISOString().split('T')[0]);
    setMonthlySalary('45000');
    setStatus('ACTIVE');
    setEmergencyContact('03');
    setPhotoUrl('');
    setShowAddModal(true);
  };

  const openEditModal = (st: StaffRecord) => {
    setEditingStaff(st);
    setFullName(st.fullName);
    setFatherName(st.fatherName);
    setStaffIdNumber(st.staffIdNumber || `STF-${st.id.slice(0, 6)}`);
    setDesignation(st.designation);
    setDepartment(st.department || 'Science');
    setRole(st.role);
    setCnic(st.cnic);
    setMobileNumber(st.mobileNumber);
    setEmail(st.email);
    setAddress(st.address);
    setQualification(st.qualification);
    setJoiningDate(st.joiningDate);
    setMonthlySalary(String(st.monthlySalary));
    setStatus(st.status);
    setEmergencyContact(st.emergencyContact || '');
    setPhotoUrl(st.photoUrl || '');
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !designation.trim() || !mobileNumber.trim()) return;

    setSaving(true);
    try {
      if (editingStaff) {
        await onUpdateStaff(editingStaff.id, {
          fullName: fullName.trim(),
          fatherName: fatherName.trim(),
          staffIdNumber: staffIdNumber.trim(),
          designation: designation.trim(),
          department,
          role,
          cnic: cnic.trim(),
          mobileNumber: mobileNumber.trim(),
          email: email.trim(),
          address: address.trim(),
          qualification: qualification.trim(),
          joiningDate,
          monthlySalary: parseFloat(monthlySalary) || 0,
          status,
          emergencyContact: emergencyContact.trim(),
          photoUrl,
        });
        setActionNotice({ text: `Staff record "${fullName}" updated successfully.`, type: 'success' });
        setEditingStaff(null);
      } else {
        await onAddStaff({
          fullName: fullName.trim(),
          fatherName: fatherName.trim(),
          staffIdNumber: staffIdNumber.trim(),
          designation: designation.trim(),
          department,
          role,
          cnic: cnic.trim(),
          mobileNumber: mobileNumber.trim(),
          email: email.trim(),
          address: address.trim(),
          qualification: qualification.trim(),
          joiningDate,
          monthlySalary: parseFloat(monthlySalary) || 0,
          status,
          emergencyContact: emergencyContact.trim(),
          photoUrl,
        });
        setActionNotice({ text: `Staff member "${fullName}" registered successfully.`, type: 'success' });
        setShowAddModal(false);
      }
    } catch (err: any) {
      setActionNotice({ text: err.message || 'Error saving staff member.', type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await onDeleteStaff(deleteTarget.id);
      setActionNotice({
        text: `Staff record "${deleteTarget.fullName}" (${deleteTarget.staffIdNumber || deleteTarget.id}) moved to Recycle Bin.`,
        type: 'success',
      });
      setDeleteTarget(null);
    } catch (err: any) {
      setActionNotice({ text: err.message || 'Failed to delete staff member.', type: 'error' });
    } finally {
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  const handleDownloadStaffFormPDF = async (staffMember: StaffRecord | null, isBlank: boolean) => {
    setPrintableStaffTarget(staffMember);
    setIsBlankFormMode(isBlank);
    setTimeout(async () => {
      if (printableFormRef.current) {
        const filename = isBlank
          ? 'Blank_Staff_Registration_Form_Siqarah_High_School.pdf'
          : `${staffMember?.fullName.replace(/[^a-zA-Z0-9]/g, '_')}_Staff_Information_Form.pdf`;
        await downloadElementAsPDF(printableFormRef.current, filename);
        setActionNotice({ text: `Downloaded ${filename} successfully.`, type: 'success' });
        setTimeout(() => setActionNotice(null), 3000);
      }
    }, 150);
  };

  const handlePrintStaffForm = (staffMember: StaffRecord | null, isBlank: boolean) => {
    setPrintableStaffTarget(staffMember);
    setIsBlankFormMode(isBlank);
    setTimeout(() => {
      if (printableFormRef.current) {
        printElement(printableFormRef.current, isBlank ? 'Blank_Staff_Registration_Form' : `${staffMember?.fullName || 'Staff'}_Record_Form`);
      } else {
        window.print();
      }
    }, 150);
  };

  const filteredStaff = staff.filter((st) => {
    if (roleFilter !== 'ALL' && st.role !== roleFilter) return false;
    if (departmentFilter !== 'ALL' && (st.department || 'Science') !== departmentFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        st.fullName.toLowerCase().includes(q) ||
        st.fatherName.toLowerCase().includes(q) ||
        (st.staffIdNumber && st.staffIdNumber.toLowerCase().includes(q)) ||
        st.designation.toLowerCase().includes(q) ||
        st.mobileNumber.toLowerCase().includes(q) ||
        st.qualification.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 24;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, roleFilter, departmentFilter]);

  const totalPages = Math.ceil(filteredStaff.length / pageSize) || 1;
  const paginatedStaff = filteredStaff.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const departments = Array.from(new Set(staff.map((s) => s.department || 'General'))).filter(Boolean);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Faculty & Administration</span>
            <span>·</span>
            <span>{schoolProfile.schoolName}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Staff & Faculty Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Comprehensive staff registration, printable blank/completed forms, profile management, and delete safeguards.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Download Blank Staff Form button */}
          <button
            onClick={() => handleDownloadStaffFormPDF(null, true)}
            className="inline-flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold px-3 py-2 rounded-lg transition-colors"
            title="Download clean blank printable staff application form"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Download Blank Form</span>
          </button>

          <button
            onClick={() => handlePrintStaffForm(null, true)}
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
            title="Print blank staff application form"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Print Blank Form</span>
          </button>

          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-lg transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Add Staff Member</span>
          </button>
        </div>
      </div>

      {/* Action Notification */}
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

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute inset-y-0 left-3 my-auto text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff by name, ID (STF-XXXX), designation, qualification, phone..."
            className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-400/50"
          />
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium"
          >
            <option value="ALL">All Roles ({staff.length})</option>
            <option value="Teaching">Teaching Faculty</option>
            <option value="Administrative">Administrative Staff</option>
            <option value="Support">Support Staff</option>
          </select>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium"
          >
            <option value="ALL">All Depts</option>
            <option value="Science">Science</option>
            <option value="Mathematics">Mathematics</option>
            <option value="Humanities">Humanities</option>
            <option value="English">English</option>
            <option value="Administration">Administration</option>
            <option value="Accounts">Accounts</option>
          </select>
        </div>
      </div>

      {/* Staff Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {paginatedStaff.map((st) => (
          <div
            key={st.id}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {/* Photo or Avatar */}
                  <div className="w-12 h-14 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                    {st.photoUrl ? (
                      <img src={st.photoUrl} alt={st.fullName} className="w-full h-full object-cover" />
                    ) : (
                      <UserCheck className="w-6 h-6 text-slate-400" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                        {st.staffIdNumber || `STF-${st.id.slice(0, 6)}`}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 px-1.5 py-0.2 rounded">
                        {st.role}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-950 mt-1 truncate">{st.fullName}</h3>
                    <p className="text-xs font-semibold text-slate-600">{st.designation}</p>
                    <p className="text-[10px] text-slate-400">Dept: {st.department || 'Education'}</p>
                  </div>
                </div>

                {/* Status Badge */}
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    st.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : st.status === 'ON_LEAVE'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {st.status}
                </span>
              </div>

              {/* Demographic Information */}
              <div className="mt-3 space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                <div className="flex items-center gap-2">
                  <Award className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{st.qualification}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-tabular font-medium">{st.mobileNumber}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Joined: {formatDate(st.joiningDate)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-tabular font-bold text-slate-900">
                    Salary: {formatPKR(st.monthlySalary)}/mo
                  </span>
                </div>
              </div>
            </div>

            {/* Universal Form Management Actions: View, Edit, Download PDF, Print, Delete */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] text-slate-400 font-tabular font-mono">CNIC: {st.cnic}</span>
                <div className="flex items-center gap-1">
                  {/* View Details */}
                  <button
                    onClick={() => setViewingStaff(st)}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                    title="View Full Staff Profile"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>

                  {/* Edit Staff Record */}
                  <button
                    onClick={() => openEditModal(st)}
                    className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded transition-colors"
                    title="Edit Staff Member"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Download Completed Form PDF */}
                  <button
                    onClick={() => handleDownloadStaffFormPDF(st, false)}
                    className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded transition-colors"
                    title="Download Completed Staff Registration Form (PDF)"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>

                  {/* Print Completed Form */}
                  <button
                    onClick={() => handlePrintStaffForm(st, false)}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                    title="Print Staff Form"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete Staff (Moves to Recycle Bin) */}
                  <button
                    onClick={() => setDeleteTarget(st)}
                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded transition-colors"
                    title="Delete Staff Member (Safe Recycle Bin)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 text-xs text-slate-600 shadow-xs">
          <div>
            Showing <span className="font-bold text-slate-900">{(currentPage - 1) * pageSize + 1}</span> to{' '}
            <span className="font-bold text-slate-900">
              {Math.min(currentPage * pageSize, filteredStaff.length)}
            </span>{' '}
            of <span className="font-bold text-slate-900">{filteredStaff.length}</span> staff members
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

      {/* Add / Edit Staff Modal */}
      {(showAddModal || editingStaff) && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingStaff ? `Edit Staff Member: ${editingStaff.fullName}` : 'Register New Staff Member'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingStaff(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStaff} className="space-y-4 text-xs">
              {/* Photo & Basic ID row */}
              <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="w-16 h-18 rounded-lg bg-white border border-slate-300 overflow-hidden flex items-center justify-center shrink-0">
                  {photoUrl ? (
                    <img src={photoUrl} alt="Staff Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <label className="block font-bold text-slate-700">Staff Photograph (Auto-compressed)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-200 file:text-slate-800 hover:file:bg-slate-300"
                  />
                  {compressing && (
                    <span className="text-[10px] text-emerald-600 font-semibold block">
                      ⚡ Uploading & optimizing {photoProgress > 0 ? `${photoProgress}%` : '...'}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Tariq Mehmood"
                    className="w-full px-3 py-2 border rounded-lg border-slate-300"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Father's Name *</label>
                  <input
                    type="text"
                    value={fatherName}
                    onChange={(e) => setFatherName(e.target.value)}
                    placeholder="e.g. Muhammad Aslam"
                    className="w-full px-3 py-2 border rounded-lg border-slate-300"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Staff ID Number *</label>
                  <input
                    type="text"
                    value={staffIdNumber}
                    onChange={(e) => setStaffIdNumber(e.target.value)}
                    placeholder="STF-2026-0001"
                    className="w-full px-3 py-2 border rounded-lg border-slate-300 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">CNIC Number *</label>
                  <input
                    type="text"
                    value={cnic}
                    onChange={(e) => setCnic(e.target.value)}
                    placeholder="33202-1234567-1"
                    className="w-full px-3 py-2 border rounded-lg border-slate-300 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Phone Number *</label>
                  <input
                    type="text"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    placeholder="0300-1234567"
                    className="w-full px-3 py-2 border rounded-lg border-slate-300 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Designation *</label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Senior Science Teacher"
                    className="w-full px-3 py-2 border rounded-lg border-slate-300"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg border-slate-300 bg-white"
                  >
                    <option value="Science">Science</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Humanities">Humanities</option>
                    <option value="English">English</option>
                    <option value="Administration">Administration</option>
                    <option value="Accounts">Accounts</option>
                    <option value="General">General</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Employment Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg border-slate-300 bg-white"
                  >
                    <option value="Teaching">Teaching Faculty</option>
                    <option value="Administrative">Administrative</option>
                    <option value="Support">Support Staff</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Academic Qualification</label>
                  <input
                    type="text"
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    placeholder="M.Sc Physics / B.Ed"
                    className="w-full px-3 py-2 border rounded-lg border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date of Joining</label>
                  <input
                    type="date"
                    value={joiningDate}
                    onChange={(e) => setJoiningDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Monthly Salary (PKR) *</label>
                  <input
                    type="number"
                    value={monthlySalary}
                    onChange={(e) => setMonthlySalary(e.target.value)}
                    placeholder="45000"
                    className="w-full px-3 py-2 border rounded-lg border-slate-300 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Employment Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-lg border-slate-300 bg-white"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="ON_LEAVE">ON LEAVE</option>
                    <option value="RESIGNED">RESIGNED</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Emergency Contact Number</label>
                  <input
                    type="text"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="0300-7654321"
                    className="w-full px-3 py-2 border rounded-lg border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="staff@siqarah.edu.pk"
                    className="w-full px-3 py-2 border rounded-lg border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Residential Address *</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street / Mohallah, Shorkot City, Punjab"
                  className="w-full px-3 py-2 border rounded-lg border-slate-300"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingStaff(null);
                  }}
                  className="px-4 py-2 border rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || compressing}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow-xs"
                >
                  {saving ? 'Saving...' : editingStaff ? 'Save Changes' : 'Register Staff Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Staff Profile Modal */}
      {viewingStaff && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-14 rounded-lg bg-slate-100 border border-slate-300 overflow-hidden flex items-center justify-center">
                  {viewingStaff.photoUrl ? (
                    <img src={viewingStaff.photoUrl} alt={viewingStaff.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <UserCheck className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-950">{viewingStaff.fullName}</h3>
                  <p className="text-xs text-amber-800 font-semibold">{viewingStaff.designation}</p>
                  <p className="text-[10px] font-mono text-slate-400">{viewingStaff.staffIdNumber || 'STF-Pending'}</p>
                </div>
              </div>
              <button onClick={() => setViewingStaff(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-xs divide-y divide-slate-100">
              <div className="flex justify-between py-1.5"><span className="text-slate-500">Father's Name:</span> <strong className="text-slate-900">{viewingStaff.fatherName}</strong></div>
              <div className="flex justify-between py-1.5"><span className="text-slate-500">CNIC:</span> <strong className="font-mono text-slate-900">{viewingStaff.cnic}</strong></div>
              <div className="flex justify-between py-1.5"><span className="text-slate-500">Mobile Phone:</span> <strong className="font-mono text-slate-900">{viewingStaff.mobileNumber}</strong></div>
              <div className="flex justify-between py-1.5"><span className="text-slate-500">Department:</span> <strong className="text-slate-900">{viewingStaff.department || 'Education'}</strong></div>
              <div className="flex justify-between py-1.5"><span className="text-slate-500">Qualification:</span> <strong className="text-slate-900">{viewingStaff.qualification}</strong></div>
              <div className="flex justify-between py-1.5"><span className="text-slate-500">Joining Date:</span> <strong className="text-slate-900">{formatDate(viewingStaff.joiningDate)}</strong></div>
              <div className="flex justify-between py-1.5"><span className="text-slate-500">Monthly Salary:</span> <strong className="text-slate-900 font-bold">{formatPKR(viewingStaff.monthlySalary)}</strong></div>
              <div className="flex justify-between py-1.5"><span className="text-slate-500">Emergency Contact:</span> <strong className="font-mono text-slate-900">{viewingStaff.emergencyContact || 'N/A'}</strong></div>
              <div className="flex justify-between py-1.5"><span className="text-slate-500">Residential Address:</span> <strong className="text-slate-900 text-right max-w-[250px]">{viewingStaff.address}</strong></div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => {
                  handleDownloadStaffFormPDF(viewingStaff, false);
                  setViewingStaff(null);
                }}
                className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-lg flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Form (PDF)</span>
              </button>
              <button
                onClick={() => setViewingStaff(null)}
                className="px-4 py-1.5 bg-slate-900 text-white font-semibold text-xs rounded-lg hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Staff Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900">Move Staff to Recycle Bin?</h3>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to delete staff member{' '}
              <strong>{deleteTarget.fullName}</strong> ({deleteTarget.staffIdNumber || deleteTarget.id})?
            </p>
            <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              This record will be safely moved to the <strong>Recycle Bin</strong> where it can be restored anytime by an administrator.
            </p>
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

      {/* Off-screen Container for Generating & Printing Blank / Completed Staff Registration Form (A4) */}
      <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', width: '800px', pointerEvents: 'none', zIndex: -1 }}>
        <div
          ref={printableFormRef}
          className="bg-white p-8 sm:p-12 text-slate-900 font-sans min-h-[1050px] flex flex-col justify-between"
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
              <div className="w-20 h-24 border-2 border-dashed border-slate-300 rounded flex flex-col items-center justify-center text-center p-1">
                {printableStaffTarget?.photoUrl && !isBlankFormMode ? (
                  <img src={printableStaffTarget.photoUrl} alt="Staff Photo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[9px] text-slate-400">Passport Photo</span>
                )}
              </div>
            </div>

            <div className="text-center my-4">
              <h2 className="text-sm font-extrabold uppercase tracking-wide bg-slate-900 text-white py-1 px-4 rounded inline-block">
                {isBlankFormMode ? 'STAFF REGISTRATION APPLICATION FORM' : 'OFFICIAL STAFF RECORD & PARTICULARS FORM'}
              </h2>
            </div>

            {/* Form Fields Table */}
            <div className="border border-slate-300 rounded-lg overflow-hidden text-xs divide-y divide-slate-200 mt-4">
              <div className="grid grid-cols-2 divide-x divide-slate-200">
                <div className="p-2.5">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">1. Full Name:</span>
                  <div className="font-bold text-slate-950 pt-1">
                    {isBlankFormMode ? '____________________________________' : printableStaffTarget?.fullName}
                  </div>
                </div>
                <div className="p-2.5">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">2. Father's Name:</span>
                  <div className="font-bold text-slate-950 pt-1">
                    {isBlankFormMode ? '____________________________________' : printableStaffTarget?.fatherName}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 divide-x divide-slate-200">
                <div className="p-2.5">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">3. Staff ID:</span>
                  <div className="font-mono font-bold text-slate-950 pt-1">
                    {isBlankFormMode ? 'STF-____-____' : printableStaffTarget?.staffIdNumber || 'STF-Pending'}
                  </div>
                </div>
                <div className="p-2.5">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">4. CNIC Number:</span>
                  <div className="font-mono font-bold text-slate-950 pt-1">
                    {isBlankFormMode ? '_____-_______-_' : printableStaffTarget?.cnic}
                  </div>
                </div>
                <div className="p-2.5">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">5. Mobile Number:</span>
                  <div className="font-mono font-bold text-slate-950 pt-1">
                    {isBlankFormMode ? '03__-_______' : printableStaffTarget?.mobileNumber}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 divide-x divide-slate-200">
                <div className="p-2.5">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">6. Designation:</span>
                  <div className="font-bold text-slate-950 pt-1">
                    {isBlankFormMode ? '________________________' : printableStaffTarget?.designation}
                  </div>
                </div>
                <div className="p-2.5">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">7. Department:</span>
                  <div className="font-bold text-slate-950 pt-1">
                    {isBlankFormMode ? '________________________' : printableStaffTarget?.department || 'Education'}
                  </div>
                </div>
                <div className="p-2.5">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">8. Role / Category:</span>
                  <div className="font-bold text-slate-950 pt-1">
                    {isBlankFormMode ? '[ ] Teaching  [ ] Admin  [ ] Support' : printableStaffTarget?.role}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 divide-x divide-slate-200">
                <div className="p-2.5">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">9. Qualification:</span>
                  <div className="font-bold text-slate-950 pt-1">
                    {isBlankFormMode ? '________________________' : printableStaffTarget?.qualification}
                  </div>
                </div>
                <div className="p-2.5">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">10. Date of Joining:</span>
                  <div className="font-mono font-bold text-slate-950 pt-1">
                    {isBlankFormMode ? 'DD / MM / YYYY' : formatDate(printableStaffTarget?.joiningDate || '')}
                  </div>
                </div>
                <div className="p-2.5">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">11. Monthly Salary (PKR):</span>
                  <div className="font-mono font-bold text-slate-950 pt-1">
                    {isBlankFormMode ? 'Rs. ____________' : formatPKR(printableStaffTarget?.monthlySalary || 0)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 divide-x divide-slate-200">
                <div className="p-2.5">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">12. Emergency Contact:</span>
                  <div className="font-mono font-bold text-slate-950 pt-1">
                    {isBlankFormMode ? '________________________' : printableStaffTarget?.emergencyContact || 'N/A'}
                  </div>
                </div>
                <div className="p-2.5">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">13. Email Address:</span>
                  <div className="font-bold text-slate-950 pt-1">
                    {isBlankFormMode ? '________________________' : printableStaffTarget?.email || 'N/A'}
                  </div>
                </div>
              </div>

              <div className="p-2.5">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">14. Permanent / Residential Address:</span>
                <div className="font-bold text-slate-950 pt-1">
                  {isBlankFormMode
                    ? '____________________________________________________________________________________'
                    : printableStaffTarget?.address}
                </div>
              </div>
            </div>

            {/* Office Use Only Section */}
            <div className="mt-6 border-2 border-slate-800 rounded-lg p-3 bg-slate-50 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-900 block border-b border-slate-300 pb-1 mb-2">
                For Administration & Accounts Office Use Only
              </span>
              <div className="grid grid-cols-3 gap-3 text-[11px]">
                <div>
                  <span className="text-slate-500 block">Verification Status:</span>
                  <strong className="text-slate-900">Verified & Approved</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Bank Account Attached:</span>
                  <strong className="text-slate-900">National Bank / HBL</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Probation Period:</span>
                  <strong className="text-slate-900">3 Months Confirmed</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Signatures Footer */}
          <div className="pt-8 border-t border-slate-300 grid grid-cols-3 gap-6 text-xs text-center">
            <div>
              <div className="h-10 border-b border-slate-800 mb-1"></div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Staff Signature</span>
            </div>
            <div>
              <div className="w-16 h-16 mx-auto opacity-80">
                <img src={stampSrc} alt="Stamp" className="w-full h-full object-contain" />
              </div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">School Seal</span>
            </div>
            <div>
              <div className="h-10 border-b border-slate-800 mb-1 flex items-end justify-center pb-0.5">
                <span className="font-serif italic text-sm text-slate-800">Dr. Saeed Ahmad</span>
              </div>
              <strong className="text-[11px] text-slate-950 block">Dr. Saeed Ahmad</strong>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Principal</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
