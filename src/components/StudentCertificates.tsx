/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Award,
  Download,
  Printer,
  FileText,
  Search,
  CheckCircle2,
  Trash2,
  Eye,
  Edit3,
  AlertTriangle,
  GraduationCap,
} from 'lucide-react';
import { StudentRecord, SchoolProfile, CertificateRecord, UserRole } from '../types/school.ts';
import { downloadElementAsPDF } from '../utils/pdfExport.ts';
import { formatDate } from '../utils/voucherHelpers.ts';
import { printElement } from '../utils/printHelper.ts';
import { getSchoolLogoSrc } from '../utils/schoolBranding.ts';
import { StudentSearchSelector, SelectedEnrollmentInfo } from './StudentSearchSelector.tsx';

interface StudentCertificatesProps {
  students: StudentRecord[];
  schoolProfile: SchoolProfile;
  userRole: UserRole;
  onRefresh: () => void;
}

type CertType =
  | 'CHARACTER_CERTIFICATE'
  | 'SCHOOL_LEAVING_CERTIFICATE'
  | 'TRANSFER_CERTIFICATE'
  | 'BONAFIDE_CERTIFICATE'
  | 'STUDY_CERTIFICATE'
  | 'MIGRATION_CERTIFICATE'
  | 'MERIT_CERTIFICATE';

export const StudentCertificates: React.FC<StudentCertificatesProps> = ({
  students,
  schoolProfile,
  userRole,
  onRefresh,
}) => {
  const [certs, setCerts] = useState<CertificateRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<CertType>('CHARACTER_CERTIFICATE');
  const [viewMode, setViewMode] = useState<'create' | 'list'>('create');
  const [search, setSearch] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || '');
  const [selectedEnrollment, setSelectedEnrollment] = useState<SelectedEnrollmentInfo | null>(null);
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [conduct, setConduct] = useState('Satisfactory & Exemplary');
  const [reasonForLeaving, setReasonForLeaving] = useState('Completed primary studies / Relocation');
  const [remarks, setRemarks] = useState(
    'Demonstrated keen academic interest, moral discipline, and consistent attendance.'
  );
  const [deleteTarget, setDeleteTarget] = useState<CertificateRecord | null>(null);

  const fallbackStudent: StudentRecord = {
    id: 'st_fallback_cert',
    admissionNumber: 'ADM-1001',
    fullName: 'Muhammad Abdullah',
    fatherName: 'Muhammad Tariq',
    gender: 'Male',
    dob: '2012-04-15',
    studentClass: 'Class 9',
    section: 'A',
    rollNumber: '01',
    mobileNumber: '03001234567',
    address: 'Main Campus Road, City',
    session: schoolProfile.activeSession || '2026-2027',
    admissionDate: '2022-04-01',
    admissionFee: 5000,
    createdAt: new Date().toISOString(),
  };

  const documentRef = useRef<HTMLDivElement | null>(null);
  const currentStudent = students.find((s) => s.id === selectedStudentId) || students[0] || fallbackStudent;

  const activeClassName = selectedEnrollment ? selectedEnrollment.studentClass : (currentStudent.studentClass || 'Class 9');
  const activeSessionName = selectedEnrollment ? selectedEnrollment.session : (currentStudent.session || schoolProfile.activeSession);
  const activeRollNumber = selectedEnrollment ? selectedEnrollment.rollNumber : (currentStudent.rollNumber || '01');

  const logoSrc = getSchoolLogoSrc(schoolProfile);
  const stampSrc = schoolProfile.stampUrl || '/assets/school_stamp.jpg';

  const effectiveSchoolId =
    (schoolProfile as any).id ||
    (schoolProfile as any).schoolCode ||
    localStorage.getItem('edupro_active_school_id') ||
    'school_primary';

  const fetchCertificates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/certificates', {
        headers: {
          'x-school-id': effectiveSchoolId,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setCerts(data.filter((c: CertificateRecord) => c.recipientType === 'student'));
      }
    } catch (err) {
      console.error('Failed to fetch certificates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertificates();
  }, [effectiveSchoolId]);

  const getCleanCertificateTitle = (type: string): string => {
    switch (type) {
      case 'CHARACTER_CERTIFICATE':
        return 'Character_Certificate';
      case 'SCHOOL_LEAVING_CERTIFICATE':
        return 'School_Leaving_Certificate';
      case 'TRANSFER_CERTIFICATE':
        return 'Transfer_Certificate';
      case 'BONAFIDE_CERTIFICATE':
        return 'Bonafide_Certificate';
      case 'STUDY_CERTIFICATE':
        return 'Study_Certificate';
      case 'MIGRATION_CERTIFICATE':
        return 'Migration_Certificate';
      case 'MERIT_CERTIFICATE':
        return 'Merit_Certificate';
      default:
        return 'Certificate';
    }
  };

  const handleSaveCertificate = async () => {
    setLoading(true);
    try {
      // Check for accidental duplicate record
      const duplicate = certs.find(
        (c) =>
          c.recipientId === currentStudent.id &&
          c.certificateType === selectedType &&
          c.session === activeSessionName
      );
      if (duplicate) {
        const confirmReissue = window.confirm(
          `Notice: Certificate #${duplicate.certificateNumber} has already been issued to ${currentStudent.fullName} for ${selectedType.replace(/_/g, ' ')} (${activeSessionName}).\n\nDo you want to proceed and issue a new revised certificate?`
        );
        if (!confirmReissue) {
          setLoading(false);
          return;
        }
      }

      const certCount = certs.length + 1;
      const certNum = `CERT-${new Date().getFullYear()}-${String(certCount).padStart(4, '0')}`;

      const payload = {
        certificateNumber: certNum,
        recipientType: 'student',
        recipientId: currentStudent.id,
        recipientName: currentStudent.fullName,
        fatherName: currentStudent.fatherName,
        referenceNumber: currentStudent.admissionNumber,
        className: activeClassName,
        certificateType: selectedType,
        issueDate,
        session: activeSessionName,
        remarks,
        conduct,
        reasonForLeaving:
          selectedType === 'SCHOOL_LEAVING_CERTIFICATE' ||
          selectedType === 'TRANSFER_CERTIFICATE' ||
          selectedType === 'MIGRATION_CERTIFICATE'
            ? reasonForLeaving
            : undefined,
      };

      const res = await fetch('/api/certificates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-school-id': effectiveSchoolId,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        // Also persist to Firestore schools/{schoolId}/certificates
        try {
          const { doc, setDoc } = await import('firebase/firestore');
          const { db } = await import('../lib/firebase.ts');
          await setDoc(
            doc(db, 'schools', effectiveSchoolId, 'certificates', certNum),
            {
              ...payload,
              id: certNum,
              schoolId: effectiveSchoolId,
              createdAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (fsErr) {
          console.warn('Firestore certificate sync note:', fsErr);
        }

        setActionMessage({
          text: `Official certificate #${certNum} issued and saved permanently.`,
          type: 'success',
        });
        fetchCertificates();
      } else {
        const err = await res.json();
        setActionMessage({ text: err.error || 'Failed to save certificate', type: 'error' });
      }
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Network error', type: 'error' });
    } finally {
      setLoading(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handleDownloadPDF = async () => {
    if (!documentRef.current) return;
    setDownloading(true);
    try {
      const studentSlug = (currentStudent.fullName || 'Student').trim().replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${getCleanCertificateTitle(selectedType)}_${studentSlug}.pdf`;
      await downloadElementAsPDF(documentRef.current, filename);
      setActionMessage({ text: `Downloaded ${filename} successfully to your device.`, type: 'success' });
    } catch (err: any) {
      console.error('PDF error:', err);
      setActionMessage({ text: err.message || 'Download failed', type: 'error' });
    } finally {
      setDownloading(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handleDeleteCertificate = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/certificates/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { 'x-admin-name': schoolProfile.principal || 'Principal' },
      });
      if (res.ok) {
        setActionMessage({
          text: `Certificate ${deleteTarget.certificateNumber} moved to Recycle Bin.`,
          type: 'success',
        });
        setDeleteTarget(null);
        fetchCertificates();
      }
    } catch (err) {
      console.error('Failed to delete cert:', err);
    }
  };

  const handleLoadCertificate = (cert: CertificateRecord) => {
    const match = students.find(
      (s) =>
        s.admissionNumber === cert.referenceNumber ||
        s.fullName.toLowerCase() === cert.recipientName.toLowerCase()
    );
    if (match) {
      setSelectedStudentId(match.id);
    }
    setSelectedType(cert.certificateType as CertType);
    if (cert.issueDate) {
      setIssueDate(cert.issueDate.split('T')[0]);
    }
    if (cert.conduct) setConduct(cert.conduct);
    if (cert.remarks) setRemarks(cert.remarks);
    if (cert.reasonForLeaving) setReasonForLeaving(cert.reasonForLeaving);
    setViewMode('create');
    setActionMessage({
      text: `Loaded Certificate #${cert.certificateNumber} for ${cert.recipientName} into document preview.`,
      type: 'success',
    });
  };

  const handleDownloadSingleCert = async (cert: CertificateRecord) => {
    handleLoadCertificate(cert);
    // Allow state to propagate to DOM before triggering download
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (documentRef.current) {
      const studentSlug = (cert.recipientName || 'Student').trim().replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${getCleanCertificateTitle(cert.certificateType)}_${studentSlug}_${cert.certificateNumber}.pdf`;
      try {
        await downloadElementAsPDF(documentRef.current, filename);
      } catch (err) {
        console.error('Download single cert failed:', err);
      }
    }
  };

  const handlePrintSingleCert = async (cert: CertificateRecord) => {
    handleLoadCertificate(cert);
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (documentRef.current) {
      printElement(
        documentRef.current,
        `${getCleanCertificateTitle(cert.certificateType).replace(/_/g, ' ')} - ${cert.recipientName}`
      );
    }
  };

  const filteredCerts = certs.filter((c) => {
    if (selectedType && c.certificateType !== selectedType) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        c.recipientName.toLowerCase().includes(q) ||
        c.certificateNumber.toLowerCase().includes(q) ||
        c.referenceNumber.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Student Official Documents & Records</span>
            <span>·</span>
            <span>{schoolProfile.schoolName}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Student Certificates Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Issue, print, and download official Character Certificates, School Leaving Certificates (SLC), Transfer Certificates, and Merit Certificates.
          </p>
        </div>

        <button
          onClick={() => setViewMode(viewMode === 'create' ? 'list' : 'create')}
          className="px-3.5 py-2 text-xs font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 transition-colors"
        >
          {viewMode === 'create' ? `Issued Certificates (${certs.length})` : '+ Issue New Certificate'}
        </button>
      </div>

      {actionMessage && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Certificate Type Selector */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setSelectedType('CHARACTER_CERTIFICATE')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            selectedType === 'CHARACTER_CERTIFICATE'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Award className="w-4 h-4 text-amber-400" />
          <span>Character Certificate</span>
        </button>
        <button
          onClick={() => setSelectedType('SCHOOL_LEAVING_CERTIFICATE')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            selectedType === 'SCHOOL_LEAVING_CERTIFICATE'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <GraduationCap className="w-4 h-4 text-blue-400" />
          <span>School Leaving (SLC)</span>
        </button>
        <button
          onClick={() => setSelectedType('TRANSFER_CERTIFICATE')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            selectedType === 'TRANSFER_CERTIFICATE'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4 text-emerald-400" />
          <span>Transfer Certificate</span>
        </button>
        <button
          onClick={() => setSelectedType('BONAFIDE_CERTIFICATE')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            selectedType === 'BONAFIDE_CERTIFICATE'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Award className="w-4 h-4 text-teal-400" />
          <span>Bonafide Certificate</span>
        </button>
        <button
          onClick={() => setSelectedType('STUDY_CERTIFICATE')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            selectedType === 'STUDY_CERTIFICATE'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4 text-indigo-400" />
          <span>Study Certificate</span>
        </button>
        <button
          onClick={() => setSelectedType('MIGRATION_CERTIFICATE')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            selectedType === 'MIGRATION_CERTIFICATE'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <GraduationCap className="w-4 h-4 text-rose-400" />
          <span>Migration Certificate</span>
        </button>
        <button
          onClick={() => setSelectedType('MERIT_CERTIFICATE')}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            selectedType === 'MERIT_CERTIFICATE'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Award className="w-4 h-4 text-purple-400" />
          <span>Merit Certificate</span>
        </button>
      </div>

      {viewMode === 'create' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Controls Column (5 cols) */}
          <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
            <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
              Certificate Details
            </h2>

            <div className="space-y-3">
              <StudentSearchSelector
                onSelectStudent={(st, historicalEnrollment) => {
                  setSelectedStudentId(st.id);
                  setSelectedEnrollment(historicalEnrollment || null);
                }}
                selectedStudentId={selectedStudentId}
                includeHistorySelection={true}
                label="Search & Select Student (Current or Historical Enrollment) *"
              />

              {currentStudent && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 text-[11px] text-slate-600">
                  <div className="flex justify-between items-center pb-1 border-b border-slate-200">
                    <span className="font-bold text-slate-900">{currentStudent.fullName}</span>
                    <span className="font-mono text-amber-700 font-bold">{currentStudent.admissionNumber}</span>
                  </div>
                  <div>Father's Name: <strong className="text-slate-900">{currentStudent.fatherName}</strong></div>
                  <div>
                    Certificate Class: <strong className="text-blue-700">{activeClassName}</strong>
                    {selectedEnrollment && <span className="ml-1 text-[10px] text-emerald-700 font-semibold">(Historical)</span>}
                  </div>
                  <div>
                    Academic Session: <strong className="text-blue-700">{activeSessionName}</strong>
                    {activeRollNumber && <span> · Roll #: <strong>{activeRollNumber}</strong></span>}
                  </div>
                  <div>Date of Birth: <strong className="text-slate-900">{formatDate(currentStudent.dob)}</strong></div>
                  <div>Admission Date: <strong className="text-slate-900">{formatDate(currentStudent.admissionDate)}</strong></div>
                </div>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Issue Date</label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-2.5 py-1.5 border rounded-lg border-slate-300"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">General Conduct & Discipline</label>
              <input
                type="text"
                value={conduct}
                onChange={(e) => setConduct(e.target.value)}
                className="w-full px-2.5 py-1.5 border rounded-lg border-slate-300"
              />
            </div>

            {(selectedType === 'SCHOOL_LEAVING_CERTIFICATE' ||
              selectedType === 'TRANSFER_CERTIFICATE' ||
              selectedType === 'MIGRATION_CERTIFICATE') && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Reason for Leaving / Transfer / Migration
                </label>
                <input
                  type="text"
                  value={reasonForLeaving}
                  onChange={(e) => setReasonForLeaving(e.target.value)}
                  className="w-full px-2.5 py-1.5 border rounded-lg border-slate-300"
                />
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">Official Remarks</label>
              <textarea
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full p-2 border rounded-lg border-slate-300"
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleSaveCertificate}
                disabled={loading}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                <span>Save & Issue Certificate</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  disabled={downloading}
                  className="py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold border border-blue-200 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>{downloading ? 'Exporting...' : 'Download PDF'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => printElement(documentRef.current)}
                  className="py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold border border-slate-300 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-700" />
                  <span>Print Certificate</span>
                </button>
              </div>
            </div>
          </div>

          {/* Certificate Document Preview (7 cols) */}
          <div className="lg:col-span-7 flex flex-col items-center">
            <div
              ref={documentRef}
              id="printable-document"
              className="printable-area w-full bg-white border-4 border-slate-950 rounded-xl p-2 text-slate-950 font-serif min-h-[700px] flex flex-col justify-between shadow-lg"
              style={{ maxWidth: '800px' }}
            >
              <div className="border border-slate-900 rounded-lg p-6 sm:p-10 flex flex-col justify-between h-full min-h-[680px]">
                <div>
                  {/* Header */}
                  <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-6">
                    <div className="w-16 h-16 rounded-full border-2 border-slate-900 overflow-hidden shrink-0 flex items-center justify-center bg-white">
                      <img src={logoSrc} alt="School Logo" className="w-full h-full object-contain" />
                    </div>

                    <div className="text-center flex-1 px-4">
                      <h1 className="text-base sm:text-xl font-black tracking-wider text-slate-950 uppercase font-sans">
                        {schoolProfile.schoolName}
                      </h1>
                      <p className="text-[10px] sm:text-xs text-slate-700 font-sans mt-0.5 font-medium">
                        Affiliated with Board of Intermediate & Secondary Education ({schoolProfile.board})
                      </p>
                      <p className="text-[9px] text-slate-600 font-sans">
                        {schoolProfile.campusAddress} · Principal: {schoolProfile.principal}
                      </p>
                    </div>

                    <div className="w-16 shrink-0 text-right">
                      <span className="text-[10px] font-mono font-bold text-slate-800 border border-slate-800 px-1.5 py-0.5 rounded">CERT</span>
                    </div>
                  </div>

                  <div className="text-center my-6">
                    <span className="text-xs uppercase font-sans tracking-widest text-slate-600 block mb-1 font-semibold">
                      Official Institutional Certificate
                    </span>
                    <h2 className="text-lg sm:text-2xl font-black text-slate-950 uppercase tracking-wide underline underline-offset-8">
                      {selectedType.replace(/_/g, ' ')}
                    </h2>
                  </div>

                  {/* Certificate Text Body */}
                  <div className="space-y-4 text-xs sm:text-sm text-justify leading-loose pt-2 text-slate-950">
                    {selectedType === 'CHARACTER_CERTIFICATE' && (
                      <>
                        <p>
                          This is to solemnly certify that <strong className="text-slate-950 text-base font-bold underline decoration-slate-400 underline-offset-4">{currentStudent.fullName}</strong>,
                          Son/Daughter of <strong className="text-slate-950 font-bold">{currentStudent.fatherName}</strong>,
                          bearing Admission Number <strong className="font-mono text-slate-950 font-bold">{currentStudent.admissionNumber}</strong>
                          {currentStudent.permanentStudentId ? ` (Permanent Student ID: ${currentStudent.permanentStudentId})` : ''},
                          has been a bonafide student of Class <strong className="text-slate-950 font-bold">{activeClassName}</strong>
                          {activeRollNumber ? ` (Roll #: ${activeRollNumber})` : ''} during
                          academic session <strong className="text-slate-950 font-bold">{activeSessionName}</strong> at {schoolProfile.schoolName}.
                        </p>
                        <p>
                          Date of Birth recorded in official school register is <strong className="font-mono text-slate-950 font-bold">{formatDate(currentStudent.dob || '')}</strong>.
                          His/Her general conduct, discipline, moral behavior, and adherence to institutional ethics was found to be{' '}
                          <strong className="text-slate-950 font-bold underline decoration-slate-800">{conduct}</strong>.
                        </p>
                        <p>
                          During their academic tenure at this institution, he/she participated constructively in scholastic and co-curricular programs. There is no disciplinary action or misconduct recorded against him/her.
                        </p>
                        <p className="italic text-slate-800 font-medium">
                          "{remarks}"
                        </p>
                      </>
                    )}

                    {selectedType === 'SCHOOL_LEAVING_CERTIFICATE' && (
                      <>
                        <p>
                          This is to officially certify that <strong className="text-slate-950 text-base font-bold underline decoration-slate-400 underline-offset-4">{currentStudent.fullName}</strong>,
                          Son/Daughter of <strong className="text-slate-950 font-bold">{currentStudent.fatherName}</strong>,
                          Admission Number <strong className="font-mono text-slate-950 font-bold">{currentStudent.admissionNumber}</strong>,
                          has completed studies in Class <strong className="text-slate-950 font-bold">{activeClassName}</strong>
                          {activeRollNumber ? ` (Roll #: ${activeRollNumber})` : ''} in academic session <strong className="text-slate-950 font-bold">{activeSessionName}</strong>.
                        </p>
                        <div className="border border-slate-900 rounded p-3 bg-slate-50 text-xs space-y-1 font-sans">
                          <div className="flex justify-between"><span>Date of Admission:</span> <strong className="font-mono">{formatDate(currentStudent.admissionDate || '')}</strong></div>
                          <div className="flex justify-between"><span>Date of Birth (in School Register):</span> <strong className="font-mono">{formatDate(currentStudent.dob || '')}</strong></div>
                          <div className="flex justify-between"><span>Institutional Dues & Tuition:</span> <strong className="text-emerald-800 font-bold">ALL DUES FULLY CLEARED UP TO DATE</strong></div>
                          <div className="flex justify-between"><span>Reason for Leaving:</span> <strong>{reasonForLeaving}</strong></div>
                          <div className="flex justify-between"><span>General Conduct & Discipline:</span> <strong>{conduct}</strong></div>
                        </div>
                        <p className="italic text-slate-800 font-medium">
                          "{remarks}"
                        </p>
                      </>
                    )}

                    {selectedType === 'TRANSFER_CERTIFICATE' && (
                      <>
                        <p>
                          This is to certify that <strong className="text-slate-950 text-base font-bold underline decoration-slate-400 underline-offset-4">{currentStudent.fullName}</strong>,
                          Son/Daughter of <strong className="text-slate-950 font-bold">{currentStudent.fatherName}</strong>,
                          Admission Number <strong className="font-mono text-slate-950 font-bold">{currentStudent.admissionNumber}</strong>,
                          has been granted formal permission to transfer from {schoolProfile.schoolName}.
                        </p>
                        <div className="border border-slate-900 rounded p-3 bg-slate-50 text-xs space-y-1 font-sans">
                          <div className="flex justify-between"><span>Last Class Enrolled:</span> <strong className="font-bold">{activeClassName} ({activeSessionName})</strong></div>
                          <div className="flex justify-between"><span>Financial Clearance:</span> <strong className="text-emerald-800 font-bold">FEES & LEDGER FULLY SETTLED</strong></div>
                          <div className="flex justify-between"><span>Reason for Migration/Transfer:</span> <strong>{reasonForLeaving}</strong></div>
                          <div className="flex justify-between"><span>Disciplinary Standing:</span> <strong>{conduct}</strong></div>
                        </div>
                        <p>
                          This certificate is issued on parental request without prejudice to facilitate admission into another recognized educational institution.
                        </p>
                        <p className="italic text-slate-800 font-medium">
                          "{remarks}"
                        </p>
                      </>
                    )}

                    {selectedType === 'BONAFIDE_CERTIFICATE' && (
                      <>
                        <p>
                          This is to solemnly certify that <strong className="text-slate-950 text-base font-bold underline decoration-slate-400 underline-offset-4">{currentStudent.fullName}</strong>,
                          Son/Daughter of <strong className="text-slate-950 font-bold">{currentStudent.fatherName}</strong>,
                          bearing Admission Number <strong className="font-mono text-slate-950 font-bold">{currentStudent.admissionNumber}</strong>
                          {currentStudent.permanentStudentId ? ` (Permanent Student ID: ${currentStudent.permanentStudentId})` : ''},
                          is an active and bonafide student of Class <strong className="text-slate-950 font-bold">{activeClassName}</strong>
                          {activeRollNumber ? ` (Roll #: ${activeRollNumber})` : ''} at {schoolProfile.schoolName} during
                          the ongoing academic session <strong className="text-slate-950 font-bold">{activeSessionName}</strong>.
                        </p>
                        <div className="border border-slate-900 rounded p-3 bg-slate-50 text-xs space-y-1 font-sans">
                          <div className="flex justify-between"><span>Date of Admission:</span> <strong className="font-mono">{formatDate(currentStudent.admissionDate || '')}</strong></div>
                          <div className="flex justify-between"><span>Date of Birth (in School Register):</span> <strong className="font-mono">{formatDate(currentStudent.dob || '')}</strong></div>
                          <div className="flex justify-between"><span>Enrollment Status:</span> <strong className="text-emerald-800 font-bold">REGULAR & ACTIVE ENROLLMENT</strong></div>
                          <div className="flex justify-between"><span>General Conduct & Standing:</span> <strong>{conduct}</strong></div>
                        </div>
                        <p>
                          To the best of our knowledge and institutional records, he/she bears a commendable moral character, exemplary discipline, and high civic responsibility.
                        </p>
                        <p className="italic text-slate-800 font-medium">
                          "{remarks}"
                        </p>
                      </>
                    )}

                    {selectedType === 'STUDY_CERTIFICATE' && (
                      <>
                        <p>
                          This is to certify that <strong className="text-slate-950 text-base font-bold underline decoration-slate-400 underline-offset-4">{currentStudent.fullName}</strong>,
                          Son/Daughter of <strong className="text-slate-950 font-bold">{currentStudent.fatherName}</strong>,
                          bearing Admission Number <strong className="font-mono text-slate-950 font-bold">{currentStudent.admissionNumber}</strong>,
                          has been pursuing regular education at {schoolProfile.schoolName} from <strong className="font-mono">{formatDate(currentStudent.admissionDate || '')}</strong> up to the present academic session.
                        </p>
                        <div className="border border-slate-900 rounded p-3 bg-slate-50 text-xs space-y-1 font-sans">
                          <div className="flex justify-between"><span>Current Class:</span> <strong className="font-bold">{activeClassName}</strong></div>
                          <div className="flex justify-between"><span>Academic Session:</span> <strong className="font-bold">{activeSessionName}</strong></div>
                          <div className="flex justify-between"><span>Medium of Instruction:</span> <strong className="font-bold">English / Urdu</strong></div>
                          <div className="flex justify-between"><span>Affiliated Examination Board:</span> <strong className="font-bold">{schoolProfile.board}</strong></div>
                          <div className="flex justify-between"><span>General Conduct:</span> <strong>{conduct}</strong></div>
                        </div>
                        <p>
                          This study certificate is issued upon the request of the student/parent for official verification, admission, passport, visa, or scholarship documentation without any institutional liability.
                        </p>
                        <p className="italic text-slate-800 font-medium">
                          "{remarks}"
                        </p>
                      </>
                    )}

                    {selectedType === 'MIGRATION_CERTIFICATE' && (
                      <>
                        <p>
                          This is to certify that this institution has <strong className="text-slate-950 font-bold uppercase">No Objection</strong> to the migration of{' '}
                          <strong className="text-slate-950 text-base font-bold underline decoration-slate-400 underline-offset-4">{currentStudent.fullName}</strong>,
                          Son/Daughter of <strong className="text-slate-950 font-bold">{currentStudent.fatherName}</strong>,
                          bearing Admission Number <strong className="font-mono text-slate-950 font-bold">{currentStudent.admissionNumber}</strong>,
                          Class <strong className="text-slate-950 font-bold">{activeClassName}</strong> ({activeSessionName}),
                          from {schoolProfile.schoolName} to any other recognized Board or educational institution.
                        </p>
                        <div className="border border-slate-900 rounded p-3 bg-slate-50 text-xs space-y-1 font-sans">
                          <div className="flex justify-between"><span>Admission Number:</span> <strong className="font-mono">{currentStudent.admissionNumber}</strong></div>
                          <div className="flex justify-between"><span>Registered Date of Birth:</span> <strong className="font-mono">{formatDate(currentStudent.dob || '')}</strong></div>
                          <div className="flex justify-between"><span>School Dues Clearance:</span> <strong className="text-emerald-800 font-bold">ALL ACCOUNTS FULLY SETTLED</strong></div>
                          <div className="flex justify-between"><span>Reason for Migration:</span> <strong>{reasonForLeaving}</strong></div>
                          <div className="flex justify-between"><span>Conduct Standing:</span> <strong>{conduct}</strong></div>
                        </div>
                        <p>
                          All official dues and school property in his/her possession have been fully accounted for. There is no institutional objection to the student's migration.
                        </p>
                        <p className="italic text-slate-800 font-medium">
                          "{remarks}"
                        </p>
                      </>
                    )}

                    {selectedType === 'MERIT_CERTIFICATE' && (
                      <>
                        <p className="text-center font-sans text-xs uppercase tracking-widest text-slate-600 font-bold">
                          Scholastic Distinction & Honor Roll
                        </p>
                        <p className="text-center text-sm sm:text-base leading-relaxed">
                          This Certificate of Academic Distinction is conferred upon{' '}
                          <strong className="text-slate-950 text-lg font-black underline decoration-slate-900 underline-offset-4 block my-1">
                            {currentStudent.fullName}
                          </strong>
                          Son/Daughter of <strong className="font-bold">{currentStudent.fatherName}</strong>, 
                          bearing Admission Number <strong className="font-mono font-bold">{currentStudent.admissionNumber}</strong>, 
                          Class <strong className="font-bold">{activeClassName}</strong>, for exhibiting superior academic prowess, 
                          intellectual discipline, and high achievement in session <strong className="font-bold">{activeSessionName}</strong>.
                        </p>
                        <div className="p-3 border-2 border-slate-950 rounded bg-slate-50 text-center font-sans">
                          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 block">Commendation & Standing</span>
                          <strong className="text-sm font-black text-slate-950">1ST POSITION · EXCELLENCE IN ACADEMICS</strong>
                        </div>
                        <p className="italic text-slate-800 font-medium text-center">
                          "{remarks}"
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-8 border-t-2 border-slate-900 flex items-end justify-between font-sans text-xs mt-8">
                  <div>
                    <span className="text-slate-600 block text-[10px] uppercase font-bold tracking-wider">Date of Issue:</span>
                    <strong className="font-mono text-slate-950">{formatDate(issueDate)}</strong>
                    <div className="w-16 h-16 mt-2 opacity-90">
                      <img src={stampSrc} alt="School Stamp" className="w-full h-full object-contain" />
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="h-10 border-b border-slate-900 w-36 mb-1"></div>
                    <span className="text-[10px] text-slate-700 uppercase tracking-wider block font-semibold">Class Incharge</span>
                  </div>

                  <div className="text-right">
                    <div className="h-10 border-b border-slate-900 w-48 ml-auto flex items-end justify-end pb-1">
                      <span className="font-serif italic text-sm text-slate-950 font-semibold">{schoolProfile.principal}</span>
                    </div>
                    <strong className="block text-slate-950 text-xs">{schoolProfile.principal}</strong>
                    <span className="text-[10px] text-slate-600 block">Principal / Head of Institution</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* List of Issued Certificates */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search issued certificates..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300"
              />
            </div>
            <div className="text-xs text-slate-500">
              Showing <strong>{filteredCerts.length}</strong> issued certificates
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-bold">Cert #</th>
                  <th className="py-2.5 px-3 font-bold">Type</th>
                  <th className="py-2.5 px-3 font-bold">Student Name</th>
                  <th className="py-2.5 px-3 font-bold">Admission #</th>
                  <th className="py-2.5 px-3 font-bold">Class</th>
                  <th className="py-2.5 px-3 font-bold">Issue Date</th>
                  <th className="py-2.5 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCerts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No issued certificates found in this category.
                    </td>
                  </tr>
                ) : (
                  filteredCerts.map((cert) => (
                    <tr key={cert.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{cert.certificateNumber}</td>
                      <td className="py-3 px-3">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                          {cert.certificateType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-950">{cert.recipientName}</td>
                      <td className="py-3 px-3 font-mono text-amber-700">{cert.referenceNumber}</td>
                      <td className="py-3 px-3 text-slate-600">{cert.className}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{formatDate(cert.issueDate)}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleLoadCertificate(cert)}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded transition-colors flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                            title="View & Edit in Document Preview"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">View</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadSingleCert(cert)}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded transition-colors flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                            title="Download Official PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">PDF</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintSingleCert(cert)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                            title="Print Certificate"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Print</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(cert)}
                            className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded transition-colors cursor-pointer"
                            title="Move to Recycle Bin"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900">Move Certificate to Recycle Bin?</h3>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to move Certificate{' '}
              <strong className="font-mono">{deleteTarget.certificateNumber}</strong> issued for student{' '}
              <strong>{deleteTarget.recipientName}</strong> to the Recycle Bin?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel (Esc)
              </button>
              <button
                type="button"
                onClick={handleDeleteCertificate}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs cursor-pointer"
              >
                Confirm Move
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
