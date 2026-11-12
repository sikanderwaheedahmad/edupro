/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  Upload,
  X,
  FileCheck2,
  Printer,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Plus,
  RefreshCw,
  Download,
  FileText,
  ShieldAlert,
  GraduationCap,
} from 'lucide-react';
import { SchoolProfile, FeeVoucher, StudentRecord } from '../types/school.ts';
import { formatPKR, formatDate } from '../utils/voucherHelpers.ts';
import { downloadElementAsPDF } from '../utils/pdfExport.ts';
import { compressImage } from '../utils/imageCompress.ts';
import { printElement } from '../utils/printHelper.ts';
import { getSchoolLogoSrc } from '../utils/schoolBranding.ts';
import { fastUpload } from '../utils/fastUpload.ts';

interface AdmissionFormProps {
  schoolProfile: SchoolProfile;
  onAdmissionSuccess: (student: StudentRecord, voucher: FeeVoucher) => void;
  onOpenVoucherModal: (voucher: FeeVoucher, student?: StudentRecord) => void;
}

export const AdmissionForm: React.FC<AdmissionFormProps> = ({
  schoolProfile,
  onAdmissionSuccess,
  onOpenVoucherModal,
}) => {
  // Basic Info
  const [fullName, setFullName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoProgress, setPhotoProgress] = useState(0);

  // Academic Info
  const [studentClass, setStudentClass] = useState(schoolProfile.availableClasses[0] || 'Class 1');
  const [section, setSection] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [customClasses, setCustomClasses] = useState<string[]>([]);
  const [showAddClassInput, setShowAddClassInput] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [admissionDate, setAdmissionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [session, setSession] = useState(schoolProfile.activeSession || '2026-2027');
  const [previousSchool, setPreviousSchool] = useState('');
  const [previousClass, setPreviousClass] = useState('');
  const [previousRollNumber, setPreviousRollNumber] = useState('');

  // Parent & CNIC Info
  const [fatherCnic, setFatherCnic] = useState('');
  const [motherCnic, setMotherCnic] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [motherMobileNumber, setMotherMobileNumber] = useState('');

  // Emergency Contact
  const [emergencyContactPerson, setEmergencyContactPerson] = useState('');
  const [emergencyContactNumber, setEmergencyContactNumber] = useState('');
  const [relationship, setRelationship] = useState('Parent');

  // Address & Financial
  const [address, setAddress] = useState('');
  const [admissionFee, setAdmissionFee] = useState<string>(''); // Manually entered by administrator

  // UI state
  const [loading, setLoading] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [fetchingNextNum, setFetchingNextNum] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedResult, setSavedResult] = useState<{ student: StudentRecord; voucher: FeeVoucher } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const printableFormRef = useRef<HTMLDivElement | null>(null);
  const blankFormRef = useRef<HTMLDivElement | null>(null);

  const logoSrc = getSchoolLogoSrc(schoolProfile);
  const stampSrc = schoolProfile.stampUrl || '/assets/school_stamp.jpg';

  // Fetch next suggested admission number
  const loadNextAdmissionNumber = async () => {
    try {
      setFetchingNextNum(true);
      const activeSchoolId = localStorage.getItem('edupro_active_school_id') || 'school_primary';
      const res = await fetch('/api/next-numbers', {
        headers: { 'x-school-id': activeSchoolId },
      });
      if (res.ok) {
        const data = await res.json();
        setAdmissionNumber(data.nextAdmissionNumber);
      }
    } catch (err) {
      console.error('Failed to load next numbers:', err);
    } finally {
      setFetchingNextNum(false);
    }
  };

  useEffect(() => {
    loadNextAdmissionNumber();
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, photo: 'Please upload a valid image file (JPG, PNG)' }));
      return;
    }

    setUploadingPhoto(true);
    setPhotoProgress(0);

    try {
      const activeSchoolId = (schoolProfile as any).id || (schoolProfile as any).schoolId || localStorage.getItem('edupro_active_school_id') || 'school_primary';
      const result = await fastUpload({
        file,
        category: 'students',
        schoolId: activeSchoolId,
        onProgress: (pct) => setPhotoProgress(pct),
      });

      if (result.success && result.url) {
        setPhotoPreview(result.url);
        setErrors((prev) => {
          const c = { ...prev };
          delete c.photo;
          return c;
        });
      }
    } catch {
      // Safe fallback to client-side compressed Data URL
      try {
        const compressed = await compressImage(file, 400, 400, 0.8);
        setPhotoPreview(compressed);
        setErrors((prev) => {
          const c = { ...prev };
          delete c.photo;
          return c;
        });
      } catch {
        setErrors((prev) => ({ ...prev, photo: 'Failed to process image' }));
      }
    } finally {
      setUploadingPhoto(false);
      setPhotoProgress(0);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddCustomClass = () => {
    if (!newClassName.trim()) return;
    const trimmed = newClassName.trim();
    if (!schoolProfile.availableClasses.includes(trimmed) && !customClasses.includes(trimmed)) {
      setCustomClasses((prev) => [...prev, trimmed]);
      setStudentClass(trimmed);
    }
    setNewClassName('');
    setShowAddClassInput(false);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!fullName.trim()) newErrors.fullName = 'Student full name is required';
    if (!fatherName.trim()) newErrors.fatherName = "Father's name is required";
    if (!dob) newErrors.dob = 'Date of birth is required';
    if (!mobileNumber.trim()) newErrors.mobileNumber = 'Parent/guardian mobile number is required';
    if (!address.trim()) newErrors.address = 'Home address is required';

    const feeNum = parseFloat(admissionFee);
    if (isNaN(feeNum) || feeNum <= 0) {
      newErrors.admissionFee = 'Please enter a valid positive admission fee amount (PKR)';
    }

    // CNIC format check if entered
    if (fatherCnic.trim() && !/^\d{5}-\d{7}-\d{1}$/.test(fatherCnic.trim())) {
      newErrors.fatherCnic = 'CNIC format should be XXXXX-XXXXXXX-X';
    }
    if (motherCnic.trim() && !/^\d{5}-\d{7}-\d{1}$/.test(motherCnic.trim())) {
      newErrors.motherCnic = 'CNIC format should be XXXXX-XXXXXXX-X';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const payload = {
        fullName: fullName.trim(),
        fatherName: fatherName.trim(),
        motherName: motherName.trim() || undefined,
        photoUrl: photoPreview || '',
        dob,
        gender,
        studentClass,
        section,
        previousSchool: previousSchool.trim() || undefined,
        previousClass: previousClass.trim() || undefined,
        previousRollNumber: previousRollNumber.trim() || undefined,
        fatherCnic: fatherCnic.trim() || undefined,
        motherCnic: motherCnic.trim() || undefined,
        mobileNumber: mobileNumber.trim(),
        motherMobileNumber: motherMobileNumber.trim() || undefined,
        emergencyContactPerson: emergencyContactPerson.trim() || undefined,
        emergencyContactNumber: emergencyContactNumber.trim() || undefined,
        relationship: relationship.trim() || undefined,
        admissionDate,
        admissionNumber: admissionNumber.trim() || undefined,
        address: address.trim(),
        session,
        admissionFee: parseFloat(admissionFee),
      };

      const activeSchoolId = localStorage.getItem('edupro_active_school_id') || 'school_primary';
      const response = await fetch('/api/admissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-school-id': activeSchoolId,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save student admission');
      }

      setSavedResult({ student: data.student, voucher: data.voucher });
      onAdmissionSuccess(data.student, data.voucher);
    } catch (err: any) {
      setErrors({ form: err.message || 'Error creating admission' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCompletedFormPDF = async () => {
    if (!printableFormRef.current) return;
    try {
      setDownloadingPDF(true);
      const studentSlug = (fullName || 'Student').replace(/[^a-zA-Z0-9]/g, '_');
      await downloadElementAsPDF(
        printableFormRef.current,
        `${studentSlug}_Admission_Form_${admissionNumber || 'New'}.pdf`,
        { orientation: 'portrait' }
      );
    } catch (err) {
      console.error('Failed to download admission form PDF:', err);
    } finally {
      setDownloadingPDF(false);
    }
  };

  const handleDownloadBlankFormPDF = async () => {
    if (!blankFormRef.current) return;
    try {
      setDownloadingPDF(true);
      const schoolSlug = (schoolProfile.schoolName || 'School').replace(/[^a-zA-Z0-9]/g, '_');
      await downloadElementAsPDF(
        blankFormRef.current,
        `Blank_Student_Admission_Form_${schoolSlug}.pdf`,
        { orientation: 'portrait' }
      );
    } catch (err) {
      console.error('Failed to download blank template:', err);
    } finally {
      setDownloadingPDF(false);
    }
  };

  const handlePrintBlankForm = () => {
    printElement(blankFormRef.current);
  };

  const handlePrintCompletedForm = () => {
    printElement(printableFormRef.current);
  };

  const handleResetForNew = () => {
    setFullName('');
    setFatherName('');
    setMotherName('');
    setDob('');
    setMobileNumber('');
    setMotherMobileNumber('');
    setFatherCnic('');
    setMotherCnic('');
    setPreviousSchool('');
    setPreviousClass('');
    setPreviousRollNumber('');
    setEmergencyContactPerson('');
    setEmergencyContactNumber('');
    setAddress('');
    setAdmissionFee('');
    setPhotoPreview(null);
    setSavedResult(null);
    setErrors({});
    if (fileInputRef.current) fileInputRef.current.value = '';
    loadNextAdmissionNumber();
  };

  const allClasses = [...schoolProfile.availableClasses, ...customClasses];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Admission Registry</span>
            <span>·</span>
            <span className="text-amber-600 font-bold">{schoolProfile.schoolName}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Student Admission Form
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Complete student profiles, section assignments, Mother CNIC, emergency contacts, and automated fee voucher.
          </p>
        </div>

        {/* Action Buttons: Blank PDF download + Completed PDF / Print */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Blank Form Actions */}
          <div className="flex items-center gap-1 bg-blue-50/70 p-1 rounded-xl border border-blue-200">
            <button
              type="button"
              onClick={handleDownloadBlankFormPDF}
              disabled={downloadingPDF}
              className="inline-flex items-center gap-1.5 hover:bg-blue-100 text-blue-800 font-bold text-xs px-2.5 py-1.5 rounded-lg transition-all"
              title="Download clean printable A4 blank admission form without creating student record"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Blank Form (PDF)</span>
            </button>
            <button
              type="button"
              onClick={handlePrintBlankForm}
              className="inline-flex items-center gap-1.5 hover:bg-blue-100 text-blue-800 font-bold text-xs px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
              title="Print blank admission form template"
            >
              <Printer className="w-3.5 h-3.5 text-blue-600" />
              <span>Print Blank</span>
            </button>
          </div>

          {/* Completed Form Actions */}
          {fullName && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-300">
              <button
                type="button"
                onClick={handleDownloadCompletedFormPDF}
                disabled={downloadingPDF}
                className="inline-flex items-center gap-1.5 hover:bg-slate-200 text-slate-800 font-bold text-xs px-2.5 py-1.5 rounded-lg transition-all"
                title="Download completed admission form PDF"
              >
                <Download className="w-3.5 h-3.5 text-slate-700" />
                <span>Form (PDF)</span>
              </button>
              <button
                type="button"
                onClick={handlePrintCompletedForm}
                className="inline-flex items-center gap-1.5 hover:bg-slate-200 text-slate-800 font-bold text-xs px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                title="Print completed admission form"
              >
                <Printer className="w-3.5 h-3.5 text-slate-700" />
                <span>Print Form</span>
              </button>
            </div>
          )}

          {savedResult && (
            <button
              type="button"
              onClick={() => onOpenVoucherModal(savedResult.voucher, savedResult.student)}
              className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Admission Voucher</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Notification Banner */}
      {savedResult && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-emerald-950">
                Student Admitted Successfully! Voucher {savedResult.voucher.voucherNumber} Generated.
              </p>
              <p className="text-xs text-emerald-800 mt-0.5">
                Admission # <strong className="font-tabular">{savedResult.student.admissionNumber}</strong> · Student:{' '}
                <strong>{savedResult.student.fullName}</strong> · Class: <strong>{savedResult.student.studentClass} ({savedResult.student.section || 'A'})</strong> · Fee:{' '}
                <strong className="font-tabular">{formatPKR(savedResult.voucher.feeAmount)}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onOpenVoucherModal(savedResult.voucher, savedResult.student)}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Voucher</span>
            </button>
            <button
              onClick={handleResetForNew}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg"
            >
              + Next Admission
            </button>
          </div>
        </div>
      )}

      {/* Global Form Error */}
      {errors.form && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 text-red-800 text-sm">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errors.form}</span>
        </div>
      )}

      {/* Main Interactive Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-8">
        {/* Section 1: Student Identification & Photo */}
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider pb-3 border-b border-slate-100 flex items-center gap-2">
            <User className="w-4 h-4 text-amber-600" />
            <span>1. Student Identification & Photograph</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-5">
            {/* Photograph Upload Area */}
            <div className="md:col-span-1 flex flex-col items-center justify-start space-y-2">
              <span className="text-xs font-semibold text-slate-600">Student Photo</span>
              <div className="relative w-32 h-36 border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center group hover:border-amber-400 transition-colors">
                {photoPreview ? (
                  <>
                    <img
                      src={photoPreview}
                      alt="Student Preview"
                      className="w-full h-full object-cover object-top"
                    />
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-xs"
                      title="Remove Photo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center text-center p-3 cursor-pointer"
                  >
                    <Upload className="w-7 h-7 text-slate-400 group-hover:text-amber-500 mb-1 transition-colors" />
                    <span className="text-[11px] font-semibold text-slate-600">
                      {uploadingPhoto ? `Uploading ${photoProgress}%` : 'Upload Image'}
                    </span>
                    <span className="text-[9px] text-slate-400">JPG or PNG</span>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>
              {errors.photo && <p className="text-xs text-red-500">{errors.photo}</p>}
            </div>

            {/* Basic Info Inputs */}
            <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Student Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Muhammad Abdullah"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 ${
                    errors.fullName
                      ? 'border-red-300 bg-red-50/30 focus:ring-red-400'
                      : 'border-slate-300 bg-white focus:ring-amber-500'
                  }`}
                />
                {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
              </div>

              {/* Father Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Father's Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tariq Mehmood"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 ${
                    errors.fatherName
                      ? 'border-red-300 bg-red-50/30 focus:ring-red-400'
                      : 'border-slate-300 bg-white focus:ring-amber-500'
                  }`}
                />
                {errors.fatherName && <p className="text-xs text-red-500 mt-1">{errors.fatherName}</p>}
              </div>

              {/* Mother Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Mother's Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rashida Bibi"
                  value={motherName}
                  onChange={(e) => setMotherName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Date of Birth <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 ${
                    errors.dob
                      ? 'border-red-300 bg-red-50/30 focus:ring-red-400'
                      : 'border-slate-300 bg-white focus:ring-amber-500'
                  }`}
                />
                {errors.dob && <p className="text-xs text-red-500 mt-1">{errors.dob}</p>}
              </div>

              {/* Gender */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Gender <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Male', 'Female'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`py-2.5 text-xs font-bold rounded-xl border transition-all ${
                        gender === g
                          ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Academic Program & Section Details */}
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider pb-3 border-b border-slate-100 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-blue-600" />
            <span>2. Academic Enrolment & Section Assignment</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
            {/* Class */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 uppercase">
                  Class <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddClassInput(!showAddClassInput)}
                  className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>

              {showAddClassInput ? (
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="New Class"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    className="w-full rounded-xl border border-blue-300 text-xs px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomClass}
                    className="bg-blue-600 text-white text-xs px-2.5 py-2 rounded-xl font-bold"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <select
                  value={studentClass}
                  onChange={(e) => setStudentClass(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                >
                  {allClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Section (Module 1 Requirement: Select available section) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Section <span className="text-red-500">*</span>
              </label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value as any)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
              >
                <option value="A">Section A</option>
                <option value="B">Section B</option>
                <option value="C">Section C</option>
                <option value="D">Section D</option>
              </select>
            </div>

            {/* Academic Session */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Academic Session <span className="text-red-500">*</span>
              </label>
              <select
                value={session}
                onChange={(e) => setSession(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              >
                {schoolProfile.academicSessions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Admission Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Admission Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={admissionDate}
                onChange={(e) => setAdmissionDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Unique Admission Number */}
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 uppercase">
                  Admission Number (Unique)
                </label>
                <button
                  type="button"
                  onClick={loadNextAdmissionNumber}
                  disabled={fetchingNextNum}
                  className="text-[11px] text-amber-700 font-semibold hover:underline flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${fetchingNextNum ? 'animate-spin' : ''}`} />
                  Regenerate
                </button>
              </div>
              <input
                type="text"
                placeholder="SPMHS-2026-0001"
                value={admissionNumber}
                onChange={(e) => setAdmissionNumber(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Previous Schooling */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Previous School Attended (If Any)
              </label>
              <input
                type="text"
                placeholder="e.g. Govt Primary School / Beaconhouse"
                value={previousSchool}
                onChange={(e) => setPreviousSchool(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Previous Class & Roll No */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Previous Class
              </label>
              <input
                type="text"
                placeholder="e.g. Prep / Class 1"
                value={previousClass}
                onChange={(e) => setPreviousClass(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Previous Roll Number
              </label>
              <input
                type="text"
                placeholder="e.g. 14"
                value={previousRollNumber}
                onChange={(e) => setPreviousRollNumber(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Parent CNIC & Contact Details */}
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider pb-3 border-b border-slate-100 flex items-center gap-2">
            <Phone className="w-4 h-4 text-emerald-600" />
            <span>3. Parent CNIC & Official Contacts</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5">
            {/* Father CNIC */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Father's CNIC Number
              </label>
              <input
                type="text"
                placeholder="33202-1234567-1"
                value={fatherCnic}
                onChange={(e) => setFatherCnic(e.target.value)}
                className={`w-full rounded-xl border px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 ${
                  errors.fatherCnic ? 'border-red-400 bg-red-50/40' : 'border-slate-300'
                }`}
              />
              {errors.fatherCnic && <p className="text-xs text-red-500 mt-1">{errors.fatherCnic}</p>}
            </div>

            {/* Mother CNIC (Required field from prompt) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Mother's CNIC Number
              </label>
              <input
                type="text"
                placeholder="33202-7654321-2"
                value={motherCnic}
                onChange={(e) => setMotherCnic(e.target.value)}
                className={`w-full rounded-xl border px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 ${
                  errors.motherCnic ? 'border-red-400 bg-red-50/40' : 'border-slate-300'
                }`}
              />
              {errors.motherCnic && <p className="text-xs text-red-500 mt-1">{errors.motherCnic}</p>}
            </div>

            {/* Father Mobile */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Father / Primary Mobile Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                placeholder="0300-1234567"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                className={`w-full rounded-xl border px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 ${
                  errors.mobileNumber ? 'border-red-300 bg-red-50/30' : 'border-slate-300'
                }`}
              />
              {errors.mobileNumber && <p className="text-xs text-red-500 mt-1">{errors.mobileNumber}</p>}
            </div>

            {/* Mother Mobile */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Mother's Contact Number
              </label>
              <input
                type="tel"
                placeholder="0301-7654321"
                value={motherMobileNumber}
                onChange={(e) => setMotherMobileNumber(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Emergency Contact Details */}
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider pb-3 border-b border-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <span>4. Emergency Contact Person & Relation</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Emergency Contact Person
              </label>
              <input
                type="text"
                placeholder="e.g. Uncle / Guardian Name"
                value={emergencyContactPerson}
                onChange={(e) => setEmergencyContactPerson(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Emergency Phone Number
              </label>
              <input
                type="tel"
                placeholder="0302-9876543"
                value={emergencyContactNumber}
                onChange={(e) => setEmergencyContactNumber(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Relationship with Student
              </label>
              <input
                type="text"
                placeholder="e.g. Uncle / Grandfather"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Section 5: Residential Address & Admission Fee */}
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider pb-3 border-b border-slate-100 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <span>5. Residential Address & Admission Fee</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5">
            {/* Address */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Complete Home Address <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="House #, Street #, Mohallah, Town / City (e.g. Mohallah Farooqia, Shorkot City)"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={`w-full rounded-xl border px-3.5 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 ${
                  errors.address
                    ? 'border-red-300 bg-red-50/30 focus:ring-red-400'
                    : 'border-slate-300 bg-white focus:ring-amber-500'
                }`}
              />
              {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
            </div>

            {/* Admission Fee Input */}
            <div className="md:col-span-1 bg-amber-50/60 p-4 rounded-2xl border border-amber-200 flex flex-col justify-between">
              <div>
                <label className="block text-xs font-extrabold text-amber-950 uppercase mb-1">
                  Admission Fee Amount (PKR) <span className="text-red-500">*</span>
                </label>
                <p className="text-[11px] text-amber-800 mb-2 leading-relaxed">
                  Entered manually by administrator. Generates automatic fee voucher.
                </p>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-amber-700">Rs.</span>
                  <input
                    type="number"
                    min="1"
                    placeholder="5000"
                    value={admissionFee}
                    onChange={(e) => setAdmissionFee(e.target.value)}
                    className="w-full rounded-xl border border-amber-300 pl-10 pr-3.5 py-2 text-base font-bold font-tabular text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                {errors.admissionFee && <p className="text-xs text-red-600 mt-1">{errors.admissionFee}</p>}
              </div>

              {admissionFee && !isNaN(parseFloat(admissionFee)) && (
                <div className="mt-3 text-right">
                  <span className="text-[10px] uppercase text-amber-700 font-bold block">Payable Voucher Amount:</span>
                  <span className="text-base font-extrabold font-tabular text-emerald-800">
                    {formatPKR(parseFloat(admissionFee))}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            Clicking <strong className="text-slate-800">Submit Admission</strong> will immediately save the student record, assign roll number, log history, and generate the official fee voucher.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-800 text-white font-extrabold text-sm px-8 py-3.5 rounded-xl shadow-md transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Processing Admission...</span>
              </>
            ) : (
              <>
                <FileCheck2 className="w-4 h-4 text-emerald-400" />
                <span>Submit Admission & Generate Voucher</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* OFF-SCREEN PRINTABLE & BLANK TEMPLATES FOR HIGH-RES A4 PDF GENERATION */}
      <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', width: '800px', pointerEvents: 'none', zIndex: -1 }}>
        {/* Container 1: Completed Admission Form */}
        <div
          ref={printableFormRef}
          id="printable-document"
          className="printable-area p-8 bg-white text-slate-900 max-w-2xl font-sans"
          style={{ width: '800px', backgroundColor: '#ffffff' }}
        >
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-3 mb-4 flex items-center justify-between gap-4">
            <img src={logoSrc} alt="Logo" className="w-20 h-20 object-contain" />
            <div className="text-center flex-1">
              <h1 className="text-xl font-extrabold uppercase text-slate-950">{schoolProfile.schoolName}</h1>
              <p className="text-xs font-semibold text-slate-700">Affiliated with {schoolProfile.board} · Principal: {schoolProfile.principal}</p>
              <p className="text-[10px] text-slate-500">{schoolProfile.campusAddress} · {schoolProfile.phone}</p>
            </div>
            <div className="w-20 h-24 border border-slate-400 rounded flex items-center justify-center p-0.5 overflow-hidden bg-slate-50">
              {photoPreview ? (
                <img src={photoPreview} alt="Student" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] text-slate-400 text-center">Student Photograph</span>
              )}
            </div>
          </div>

          <div className="bg-slate-900 text-white py-1 px-4 rounded mb-4 flex justify-between items-center text-xs font-bold uppercase tracking-wider">
            <span>OFFICIAL STUDENT ADMISSION RECORD</span>
            <span className="text-amber-300">ADMISSION RECORD</span>
          </div>

          {/* Key Identifiers Strip */}
          <div className="grid grid-cols-4 gap-2 bg-slate-100 p-2.5 rounded border border-slate-200 text-xs mb-4 font-mono">
            <div>
              <span className="text-[9px] text-slate-500 block uppercase font-sans">Admission No</span>
              <strong className="text-slate-900">{admissionNumber || 'N/A'}</strong>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block uppercase font-sans">Enrolled Class</span>
              <strong className="text-slate-900">{studentClass} (Sec {section})</strong>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block uppercase font-sans">Academic Session</span>
              <strong className="text-slate-900">{session}</strong>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block uppercase font-sans">Admission Date</span>
              <strong className="text-slate-900">{formatDate(admissionDate)}</strong>
            </div>
          </div>

          {/* Details Table */}
          <table className="w-full border-collapse border border-slate-300 text-xs mb-4">
            <tbody>
              <tr className="border-b border-slate-300">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-300 w-1/4">Student Full Name:</td>
                <td className="p-2 font-bold uppercase">{fullName || '—'}</td>
                <td className="p-2 font-bold bg-slate-50 border-r border-l border-slate-300 w-1/4">Gender / DOB:</td>
                <td className="p-2">{gender} · {dob ? formatDate(dob) : '—'}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">Father's Name:</td>
                <td className="p-2">{fatherName || '—'}</td>
                <td className="p-2 font-bold bg-slate-50 border-r border-l border-slate-300">Mother's Name:</td>
                <td className="p-2">{motherName || '—'}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">Father's CNIC:</td>
                <td className="p-2 font-mono">{fatherCnic || '—'}</td>
                <td className="p-2 font-bold bg-slate-50 border-r border-l border-slate-300">Mother's CNIC:</td>
                <td className="p-2 font-mono">{motherCnic || '—'}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">Primary Mobile:</td>
                <td className="p-2 font-mono">{mobileNumber || '—'}</td>
                <td className="p-2 font-bold bg-slate-50 border-r border-l border-slate-300">Mother's Phone:</td>
                <td className="p-2 font-mono">{motherMobileNumber || '—'}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">Emergency Contact:</td>
                <td className="p-2">{emergencyContactPerson || '—'} ({relationship || 'Parent'})</td>
                <td className="p-2 font-bold bg-slate-50 border-r border-l border-slate-300">Emergency Phone:</td>
                <td className="p-2 font-mono">{emergencyContactNumber || '—'}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">Previous Schooling:</td>
                <td colSpan={3} className="p-2">
                  {previousSchool || 'No previous school recorded'} · Class: {previousClass || 'N/A'} · Roll #{previousRollNumber || 'N/A'}
                </td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">Home Address:</td>
                <td colSpan={3} className="p-2 leading-relaxed">{address || '—'}</td>
              </tr>
              <tr>
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">Admission Fee Paid:</td>
                <td colSpan={3} className="p-2 font-mono font-bold text-emerald-800">
                  {admissionFee ? formatPKR(parseFloat(admissionFee)) : '—'}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Undertaking & Signatures */}
          <div className="bg-slate-50 p-3 rounded border border-slate-300 text-xs space-y-1 mb-6">
            <p className="font-bold uppercase text-[10px]">Parent / Guardian Undertaking:</p>
            <p className="text-[10px] text-slate-700 leading-relaxed">
              I certify that all information submitted is correct. I pledge to adhere to all institutional guidelines, discipline, uniform code, and scheduled fee dues of {schoolProfile.schoolName}.
            </p>
          </div>

          <div className="pt-4 border-t-2 border-slate-900 flex justify-between items-end text-[10px]">
            <div>
              <p>Signature of Parent / Guardian: ____________________</p>
              <p className="text-[8px] text-slate-400 mt-1">Date: {formatDate(new Date().toISOString())}</p>
            </div>
            <div className="w-14 h-14 border border-dashed border-slate-300 rounded p-0.5">
              <img src={stampSrc} alt="Stamp" className="w-full h-full object-contain opacity-85" />
            </div>
            <div className="text-center">
              <p className="font-bold">{schoolProfile.principal}</p>
              <p className="text-[8px] text-slate-500">Principal / Headmaster</p>
            </div>
          </div>
        </div>

        {/* Container 2: Blank Form Template (Module 2 Requirement: Clean Printable PDF) */}
        <div
          ref={blankFormRef}
          id="printable-blank-form"
          className="printable-area p-8 bg-white text-slate-900 max-w-2xl font-sans"
          style={{ width: '800px', backgroundColor: '#ffffff' }}
        >
          <div className="border-b-2 border-slate-900 pb-3 mb-4 flex items-center justify-between gap-4">
            <img src={logoSrc} alt="Logo" className="w-20 h-20 object-contain" />
            <div className="text-center flex-1">
              <h1 className="text-xl font-black uppercase text-slate-950">{schoolProfile.schoolName}</h1>
              <p className="text-[10px] text-slate-600 font-bold">Affiliated with {schoolProfile.board} · Principal: {schoolProfile.principal}</p>
              <p className="text-[9px] text-slate-500">{schoolProfile.campusAddress} · {schoolProfile.phone}</p>
            </div>
            <div className="w-20 h-24 border-2 border-dashed border-slate-400 rounded flex flex-col items-center justify-center p-1 text-center bg-slate-50">
              <span className="text-[9px] text-slate-500 font-bold">Affix Photograph</span>
              <span className="text-[8px] text-slate-400">(Passport Size)</span>
            </div>
          </div>

          <div className="bg-slate-900 text-white py-1.5 px-4 rounded mb-4 flex justify-between items-center text-xs font-bold uppercase tracking-wider">
            <span>OFFICIAL STUDENT ADMISSION FORM (BLANK TEMPLATE)</span>
            <span className="text-amber-300">ADMISSION FORM</span>
          </div>

          <div className="flex justify-between text-xs font-mono border-b pb-2 mb-4">
            <div>Admission No: ______________________</div>
            <div>Academic Session: {schoolProfile.activeSession}</div>
            <div>Date: _____ / _____ / 2026</div>
          </div>

          <table className="w-full border-collapse border border-slate-400 text-xs mb-4">
            <tbody>
              <tr className="border-b border-slate-400">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-400 w-1/3">1. Student Full Name:</td>
                <td className="p-2">____________________________________________________</td>
              </tr>
              <tr className="border-b border-slate-400">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-400">2. Father's Full Name:</td>
                <td className="p-2">____________________________________________________</td>
              </tr>
              <tr className="border-b border-slate-400">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-400">3. Mother's Full Name:</td>
                <td className="p-2">____________________________________________________</td>
              </tr>
              <tr className="border-b border-slate-400">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-400">4. Class & Section Applied:</td>
                <td className="p-2">
                  Class: ________________________ Section: [  ] A  [  ] B  [  ] C  [  ] D
                </td>
              </tr>
              <tr className="border-b border-slate-400">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-400">5. Date of Birth & Gender:</td>
                <td className="p-2">
                  DOB: _____ / _____ / _________ Gender: [  ] Male  [  ] Female
                </td>
              </tr>
              <tr className="border-b border-slate-400">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-400">6. Father's CNIC Number:</td>
                <td className="p-2 font-mono">
                  [   ] [   ] [   ] [   ] [   ] - [   ] [   ] [   ] [   ] [   ] [   ] [   ] - [   ]
                </td>
              </tr>
              <tr className="border-b border-slate-400">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-400">7. Mother's CNIC Number:</td>
                <td className="p-2 font-mono">
                  [   ] [   ] [   ] [   ] [   ] - [   ] [   ] [   ] [   ] [   ] [   ] [   ] - [   ]
                </td>
              </tr>
              <tr className="border-b border-slate-400">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-400">8. Mobile & Contact Numbers:</td>
                <td className="p-2 font-mono">
                  Father: 03____-________________ Mother: 03____-________________
                </td>
              </tr>
              <tr className="border-b border-slate-400">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-400">9. Emergency Contact Person:</td>
                <td className="p-2">
                  Name: __________________________ Phone: __________________ Rel: ____________
                </td>
              </tr>
              <tr className="border-b border-slate-400">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-400">10. Previous School & Class:</td>
                <td className="p-2">
                  School: __________________________________ Prev Class: ________ Roll: ________
                </td>
              </tr>
              <tr className="border-b border-slate-400">
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-400">11. Permanent Address:</td>
                <td className="p-2">
                  ____________________________________________________________________
                </td>
              </tr>
              <tr>
                <td className="p-2 font-bold bg-slate-50 border-r border-slate-400">12. Admission Fee (PKR):</td>
                <td className="p-2">Rs. ______________________ (Rupees in words: ____________________________)</td>
              </tr>
            </tbody>
          </table>

          {/* Undertaking */}
          <div className="bg-slate-50 p-3 rounded border border-slate-400 text-xs space-y-1 mb-6">
            <p className="font-bold uppercase text-[9px]">Parent / Guardian Undertaking:</p>
            <p className="text-[10px] text-slate-800 leading-relaxed">
              I solemnly affirm that the details furnished above are accurate. I accept full responsibility for adhering to the code of conduct, dress code, examination policy, and timely settlement of school fee dues at {schoolProfile.schoolName}.
            </p>
          </div>

          <div className="pt-4 border-t-2 border-slate-900 flex justify-between items-end text-[10px]">
            <div>
              <p>Applicant / Guardian Signature: ____________________</p>
              <p className="text-[8px] text-slate-500 mt-1">Date: _____ / _____ / 2026</p>
            </div>
            <div className="w-16 h-16 border border-dashed border-slate-400 rounded p-1 text-center flex flex-col items-center justify-center">
              <span className="text-[8px] text-slate-400">School Seal</span>
            </div>
            <div className="text-center">
              <p className="font-bold text-slate-950">{schoolProfile.principal}</p>
              <p className="text-[8px] text-slate-500">Principal / Headmaster</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
