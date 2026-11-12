/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  FileText,
  Download,
  Printer,
  Award,
  GraduationCap,
  Briefcase,
  UserCheck,
  CheckCircle2,
  Calendar,
  Building,
  DollarSign,
  ClipboardList,
  ChevronRight,
  Filter,
  FileSpreadsheet,
} from 'lucide-react';
import { SchoolProfile, StudentRecord, StaffRecord, CertificateRecord, ExamResultRecord } from '../types/school.ts';
import { downloadElementAsPDF } from '../utils/pdfExport.ts';
import { formatDate, formatPKR, numberToWordsPKR } from '../utils/voucherHelpers.ts';
import { printElement } from '../utils/printHelper.ts';
import { getSchoolLogoSrc } from '../utils/schoolBranding.ts';
import { StudentSearchSelector } from './StudentSearchSelector.tsx';

interface FormsAndCertificatesProps {
  schoolProfile: SchoolProfile;
  students: StudentRecord[];
  staff: StaffRecord[];
  examResults: ExamResultRecord[];
}

type FormCategory = 'student_forms' | 'student_certificates' | 'staff_forms' | 'staff_certificates' | 'academic_forms';

export const FormsAndCertificates: React.FC<FormsAndCertificatesProps> = ({
  schoolProfile,
  students,
  staff,
  examResults,
}) => {
  const [activeCategory, setActiveCategory] = useState<FormCategory>('student_forms');
  const [selectedFormKey, setSelectedFormKey] = useState<string>('admission_form');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || '');
  const [selectedStaffId, setSelectedStaffId] = useState<string>(staff[0]?.id || '');
  const [isTemplateMode, setIsTemplateMode] = useState<boolean>(false);
  const [downloading, setDownloading] = useState<boolean>(false);

  const documentRef = useRef<HTMLDivElement | null>(null);

  const currentStudent = students.find((s) => s.id === selectedStudentId) || students[0] || null;
  const currentStaff = staff.find((s) => s.id === selectedStaffId) || staff[0] || null;

  const logoSrc = getSchoolLogoSrc(schoolProfile);
  const stampSrc = schoolProfile.stampUrl || '/assets/school_stamp.jpg';

  const handlePrint = () => {
    printElement(documentRef.current);
  };

  const handleDownloadPDF = async () => {
    if (!documentRef.current) return;
    try {
      setDownloading(true);
      const studentNameSlug = currentStudent?.fullName.replace(/[^a-zA-Z0-9]/g, '_') || 'Student';
      const staffNameSlug = currentStaff?.fullName.replace(/[^a-zA-Z0-9]/g, '_') || 'Staff';

      let filename = 'Document.pdf';
      const schoolSlug = (schoolProfile.schoolName || 'School').replace(/[^a-zA-Z0-9]/g, '_');
      if (isTemplateMode) {
        filename = `Blank_Template_${selectedFormKey}_${schoolSlug}.pdf`;
      } else {
        switch (selectedFormKey) {
          case 'admission_form':
            filename = `${studentNameSlug}_Admission_Form.pdf`;
            break;
          case 'student_registration':
            filename = `${studentNameSlug}_Registration_Form.pdf`;
            break;
          case 'online_admission_app':
            filename = `${studentNameSlug}_Online_Admission_Application.pdf`;
            break;
          case 'student_biodata':
            filename = `${studentNameSlug}_Information_Form.pdf`;
            break;
          case 'character_certificate':
            filename = `${studentNameSlug}_Character_Certificate.pdf`;
            break;
          case 'school_leaving_certificate':
            filename = `${studentNameSlug}_School_Leaving_Certificate.pdf`;
            break;
          case 'transfer_certificate':
            filename = `${studentNameSlug}_Transfer_Certificate.pdf`;
            break;
          case 'merit_certificate':
            filename = `${studentNameSlug}_Merit_Certificate.pdf`;
            break;
          case 'student_withdrawal':
            filename = `${studentNameSlug}_Withdrawal_Form.pdf`;
            break;
          case 'staff_appointment':
            filename = `${staffNameSlug}_Appointment_Letter.pdf`;
            break;
          case 'staff_experience':
            filename = `${staffNameSlug}_Experience_Certificate.pdf`;
            break;
          case 'staff_salary_certificate':
            filename = `${staffNameSlug}_Salary_Certificate.pdf`;
            break;
          case 'staff_resignation':
            filename = `${staffNameSlug}_Resignation_Letter.pdf`;
            break;
          case 'leave_application':
            filename = `${staffNameSlug}_Leave_Application.pdf`;
            break;
          case 'exam_result_card':
            filename = `${studentNameSlug}_Examination_Report_Card.pdf`;
            break;
          default:
            filename = `${studentNameSlug}_${selectedFormKey}.pdf`;
        }
      }

      await downloadElementAsPDF(documentRef.current, filename, {
        orientation: 'portrait',
      });
    } catch (err) {
      console.error('PDF download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  const formList = [
    // Student Forms
    {
      key: 'admission_form',
      category: 'student_forms',
      title: 'Student Admission Form',
      desc: 'Official admission form with photograph, parents details, and undertakings.',
    },
    {
      key: 'student_registration',
      category: 'student_forms',
      title: 'Student Registration / Enrolment Form',
      desc: 'Annual BISE board registration & permanent enrollment ledger form.',
    },
    {
      key: 'online_admission_app',
      category: 'student_forms',
      title: 'Online Admission Application',
      desc: 'Formal online application sheet with applicant profile & verification.',
    },
    {
      key: 'student_biodata',
      category: 'student_forms',
      title: 'Student Information & Biodata Form',
      desc: 'Comprehensive personal, guardian, emergency contact, and medical record form.',
    },
    {
      key: 'student_withdrawal',
      category: 'student_forms',
      title: 'Student Withdrawal & Clearance Form',
      desc: 'Fee dues, library books, and sports clearance signoff form for withdrawal.',
    },

    // Student Certificates
    {
      key: 'character_certificate',
      category: 'student_certificates',
      title: 'Character Certificate',
      desc: 'Formal certificate of student moral conduct, discipline, and academic standing.',
    },
    {
      key: 'school_leaving_certificate',
      category: 'student_certificates',
      title: 'School Leaving Certificate (SLC)',
      desc: 'Official certificate for school migration and class completion.',
    },
    {
      key: 'transfer_certificate',
      category: 'student_certificates',
      title: 'Student Transfer Certificate (TC)',
      desc: 'Inter-school transfer credential for relocation or board registration.',
    },
    {
      key: 'merit_certificate',
      category: 'student_certificates',
      title: 'Academic Merit & Achievement Certificate',
      desc: 'Certificate recognizing academic distinction, top position, or co-curricular excellence.',
    },

    // Staff Forms
    {
      key: 'staff_registration',
      category: 'staff_forms',
      title: 'Staff Registration & Profile Form',
      desc: 'Employee personnel profile, qualification, CNIC, and service ledger.',
    },
    {
      key: 'staff_appointment',
      category: 'staff_forms',
      title: 'Staff Appointment Letter & Agreement',
      desc: 'Formal letter of appointment signed by the Principal.',
    },
    {
      key: 'staff_resignation',
      category: 'staff_forms',
      title: 'Staff Resignation Form & Relieving Letter',
      desc: 'Resignation submission, clearance, and formal acceptance acknowledgment.',
    },
    {
      key: 'leave_application',
      category: 'staff_forms',
      title: 'Leave Application & Approval Form',
      desc: 'Casual, medical, or earned leave request with administrator sanction.',
    },

    // Staff Certificates
    {
      key: 'staff_experience',
      category: 'staff_certificates',
      title: 'Staff Experience Certificate',
      desc: 'Official teaching service tenure verification signed by the Principal.',
    },
    {
      key: 'staff_salary_certificate',
      category: 'staff_certificates',
      title: 'Staff Salary Certificate & Pay Slip',
      desc: 'Monthly emoluments verification for bank loan, visa, or official purposes.',
    },

    // Academic Forms
    {
      key: 'exam_result_card',
      category: 'academic_forms',
      title: 'Examination Result Card / Report Card',
      desc: 'Comprehensive subject-wise grade report, attendance, and teacher remarks.',
    },
  ];

  const filteredForms = formList.filter((f) => f.category === activeCategory);

  // Common Official Document Header
  const renderDocumentHeader = (titleEnglish: string, docSubtype?: string) => (
    <div className="border-b-2 border-slate-900 pb-3 mb-4">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Official School Logo */}
        <div className="w-20 h-20 shrink-0 flex items-center justify-center p-0.5 border border-slate-200 rounded-lg">
          <img
            src={logoSrc}
            alt="School Logo"
            className="w-full h-full object-contain"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Center: School Heading */}
        <div className="text-center flex-1">
          <h1 className="text-lg sm:text-xl font-extrabold uppercase tracking-tight text-slate-950">
            {schoolProfile.schoolName}
          </h1>
          <div className="flex items-center justify-center gap-2 text-[10px] sm:text-xs font-semibold text-slate-600 mt-1">
            <span>Affiliated with {schoolProfile.board}</span>
            <span>·</span>
            <span>Head of Institution: <strong>{schoolProfile.principal}</strong></span>
          </div>
          <p className="text-[9px] text-slate-500 mt-0.5">{schoolProfile.campusAddress}</p>
        </div>

        {/* Right: Space for Photo or Document Ref */}
        <div className="w-20 h-24 border border-dashed border-slate-400 rounded flex flex-col items-center justify-center p-1 text-center bg-slate-50 shrink-0">
          {!isTemplateMode && currentStudent?.photoUrl && activeCategory.startsWith('student') ? (
            <img
              src={currentStudent.photoUrl}
              alt="Student"
              className="w-full h-full object-cover object-top rounded"
            />
          ) : (
            <>
              <span className="text-[8px] font-semibold text-slate-500">Affix Recent</span>
              <span className="text-[8px] font-semibold text-slate-500">Photograph</span>
              <span className="text-[7px] text-slate-400 mt-1">(Passport Size)</span>
            </>
          )}
        </div>
      </div>

      {/* Document Title Banner */}
      <div className="mt-3 bg-slate-900 text-white py-1.5 px-4 rounded flex items-center justify-between">
        <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider">
          {titleEnglish}
        </span>
        <span className="text-[10px] font-mono tracking-wider text-amber-300 font-bold uppercase">
          {docSubtype || 'Official Institutional Record'}
        </span>
      </div>
    </div>
  );

  // Common Official Document Footer (Signatures & Stamp)
  const renderDocumentFooter = (includeStamp = true) => (
    <div className="mt-6 pt-4 border-t-2 border-slate-900 flex items-end justify-between gap-4 text-xs">
      {/* Date & Ref */}
      <div className="space-y-1">
        <p className="text-[10px] text-slate-600">
          Date of Issue:{' '}
          <strong className="font-tabular">
            {isTemplateMode ? '____ / ____ / 2026' : formatDate(new Date().toISOString())}
          </strong>
        </p>
        <p className="text-[10px] text-slate-600">
          Ref No:{' '}
          <strong className="font-tabular">
            {isTemplateMode ? 'SPMHS/____/2026' : `SPMHS/${currentStudent?.admissionNumber || 'ADM'}/2026`}
          </strong>
        </p>
        <p className="text-[9px] text-slate-400">Computer Generated Official Document · Edupro ERP</p>
      </div>

      {/* Stamp */}
      {includeStamp && (
        <div className="w-16 h-16 relative flex items-center justify-center border border-dashed border-slate-300 rounded p-1">
          <img
            src={stampSrc}
            alt="School Stamp"
            className="w-full h-full object-contain opacity-85"
            referrerPolicy="no-referrer"
          />
        </div>
      )}

      {/* Signatures */}
      <div className="flex items-end gap-6 text-[10px] text-center">
        <div className="border-t border-slate-700 pt-1 w-24">
          <span className="text-slate-700 block font-semibold">Dealing Clerk</span>
          <span className="text-[8px] text-slate-500 block">Signature</span>
        </div>
        <div className="border-t border-slate-700 pt-1 w-32">
          <span className="font-bold text-slate-950 block">{schoolProfile.principal}</span>
          <span className="text-[9px] text-slate-600 font-semibold block">Principal / Headmaster</span>
          <span className="text-[8px] text-slate-500 block">Authorized Signature</span>
        </div>
      </div>
    </div>
  );

  // Render content based on selectedFormKey
  const renderDocumentContent = () => {
    // Robust fallbacks so document preview & PDF generation never render empty content in brand new schools
    const fallbackStudent: StudentRecord = {
      id: 'st_default',
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

    const fallbackStaff: StaffRecord = {
      id: 'stf_default',
      staffIdNumber: 'STF-001',
      fullName: 'Prof. Muhammad Rizwan',
      fatherName: 'Abdul Rehman',
      designation: 'Senior Teacher (Mathematics)',
      department: 'Science',
      role: 'Teaching',
      cnic: '33202-1234567-1',
      mobileNumber: '03009876543',
      email: 'teacher@school.edu.pk',
      joiningDate: '2021-08-15',
      qualification: 'M.Sc Mathematics / B.Ed',
      monthlySalary: 45000,
      status: 'ACTIVE',
      address: 'Civil Lines, Main City',
    };

    const s = currentStudent || fallbackStudent;
    const stf = currentStaff || fallbackStaff;

    switch (selectedFormKey) {
      // 1. Student Admission Form / Registration / Online App
      case 'admission_form':
      case 'student_registration':
      case 'online_admission_app':
        return (
          <div className="space-y-4 text-xs text-slate-800">
            <table className="w-full border-collapse border border-slate-300 text-left text-xs">
              <tbody>
                <tr className="bg-slate-50 border-b border-slate-300">
                  <td className="p-2 font-bold w-1/4 border-r border-slate-300">Admission / Reg. No:</td>
                  <td className="p-2 font-tabular font-bold w-1/4 border-r border-slate-300">
                    {isTemplateMode ? '________________________' : s.admissionNumber}
                  </td>
                  <td className="p-2 font-bold w-1/4 border-r border-slate-300">Admission Date:</td>
                  <td className="p-2 font-tabular w-1/4">
                    {isTemplateMode ? '____/____/2026' : formatDate(s.admissionDate || '')}
                  </td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold border-r border-slate-300">Student Full Name:</td>
                  <td className="p-2 font-bold text-slate-950 border-r border-slate-300">
                    {isTemplateMode ? '________________________' : s.fullName}
                  </td>
                  <td className="p-2 font-bold border-r border-slate-300">Permanent ID / Roll:</td>
                  <td className="p-2 font-mono font-bold text-slate-900">
                    {isTemplateMode ? '________________________' : s.rollNumber || s.permanentStudentId || s.admissionNumber}
                  </td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold border-r border-slate-300">Father's Name:</td>
                  <td className="p-2 font-semibold border-r border-slate-300">
                    {isTemplateMode ? '________________________' : s.fatherName}
                  </td>
                  <td className="p-2 font-bold border-r border-slate-300">Father's CNIC:</td>
                  <td className="p-2 font-mono text-slate-900">
                    {isTemplateMode ? '________________________' : s.fatherCnic || '—'}
                  </td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold border-r border-slate-300">Class Admitted To:</td>
                  <td className="p-2 font-bold text-amber-900 border-r border-slate-300">
                    {isTemplateMode ? '________________________' : s.studentClass}
                  </td>
                  <td className="p-2 font-bold border-r border-slate-300">Academic Session:</td>
                  <td className="p-2 font-bold">
                    {isTemplateMode ? '2026-2027' : s.session || schoolProfile.activeSession}
                  </td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold border-r border-slate-300">Date of Birth:</td>
                  <td className="p-2 font-tabular border-r border-slate-300">
                    {isTemplateMode ? '____ / ____ / ________' : formatDate(s.dob || '')}
                  </td>
                  <td className="p-2 font-bold border-r border-slate-300">Gender:</td>
                  <td className="p-2">{isTemplateMode ? '[  ] Male   [  ] Female' : s.gender}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold border-r border-slate-300">Parent Mobile:</td>
                  <td className="p-2 font-tabular border-r border-slate-300">
                    {isTemplateMode ? '03____-_______' : s.mobileNumber}
                  </td>
                  <td className="p-2 font-bold border-r border-slate-300">Admission Fee:</td>
                  <td className="p-2 font-tabular font-bold text-slate-950">
                    {isTemplateMode ? 'Rs. _______________' : formatPKR(s.admissionFee || 0)}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 font-bold border-r border-slate-300">Permanent Address:</td>
                  <td colSpan={3} className="p-2">
                    {isTemplateMode ? '__________________________________________________________________' : s.address}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Parent Undertaking & Declaration */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-300 space-y-2 mt-4">
              <h4 className="font-extrabold uppercase text-[11px] text-slate-900 border-b border-slate-200 pb-1">
                Parent / Guardian Undertaking
              </h4>
              <p className="text-[10px] leading-relaxed text-slate-700">
                I hereby declare that all particulars entered above are correct to the best of my knowledge. I promise to abide by all school rules, discipline, uniform policy, and regular fee payment schedule of {schoolProfile.schoolName}.
              </p>
              <div className="flex justify-between items-end pt-3 text-[10px]">
                <span>Signature of Student: _______________________</span>
                <span>Signature of Father / Guardian: _______________________</span>
              </div>
            </div>
          </div>
        );

      // 2. Student Biodata / Comprehensive Information Form
      case 'student_biodata':
        return (
          <div className="space-y-4 text-xs text-slate-800">
            <div className="text-center pb-2">
              <span className="text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-800 px-3 py-1 rounded">
                Comprehensive Student Personnel & Emergency Ledger
              </span>
            </div>

            <table className="w-full border-collapse border border-slate-300 text-xs">
              <tbody>
                <tr className="bg-slate-50 border-b border-slate-300">
                  <td className="p-2 font-bold w-1/3 border-r border-slate-300">Full Name of Student:</td>
                  <td className="p-2 font-bold text-slate-950">{isTemplateMode ? '________________________' : s.fullName}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">Father / Guardian Name:</td>
                  <td className="p-2 font-semibold">{isTemplateMode ? '________________________' : s.fatherName}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">Admission / Permanent ID:</td>
                  <td className="p-2 font-mono font-bold">{isTemplateMode ? '________________________' : `${s.admissionNumber} (${s.permanentStudentId || 'ID-001'})`}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">Class & Section:</td>
                  <td className="p-2 font-bold text-amber-900">{isTemplateMode ? '________________________' : `${s.studentClass} - Section ${s.section || 'A'}`}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">Date of Birth & Gender:</td>
                  <td className="p-2">{isTemplateMode ? '____ / ____ / ________' : `${formatDate(s.dob || '')} (${s.gender})`}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">Primary Contact Number:</td>
                  <td className="p-2 font-mono">{isTemplateMode ? '03____-_______' : s.mobileNumber}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">Emergency Contact Person:</td>
                  <td className="p-2">{isTemplateMode ? 'Name: ____________________  Phone: ____________________' : `${s.emergencyContactPerson || s.fatherName} (${s.emergencyContactNumber || s.mobileNumber})`}</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">Permanent Residential Address:</td>
                  <td className="p-2">{isTemplateMode ? '________________________________________________________________' : s.address}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );

      // 3. Student Withdrawal & Clearance Form
      case 'student_withdrawal':
        return (
          <div className="space-y-4 text-xs text-slate-800">
            <div className="text-center pb-2">
              <span className="text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-800 px-3 py-1 rounded">
                Institutional Departure & Departmental Clearance
              </span>
            </div>

            <div className="bg-slate-50 p-3 rounded border border-slate-300">
              <p className="leading-relaxed">
                Student <strong className="text-slate-950 font-bold">{isTemplateMode ? '____________________' : s.fullName}</strong>, 
                Admission No. <strong className="font-mono font-bold">{isTemplateMode ? '__________' : s.admissionNumber}</strong>, 
                Class <strong className="font-bold">{isTemplateMode ? '__________' : s.studentClass}</strong>, has requested formal withdrawal from {schoolProfile.schoolName}.
              </p>
            </div>

            <table className="w-full border-collapse border border-slate-300 text-xs">
              <thead className="bg-slate-100 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2 border-r border-slate-300 text-left">Department / Ledger</th>
                  <th className="p-2 border-r border-slate-300 text-center">Clearance Status</th>
                  <th className="p-2 text-right">In-charge Officer Signature</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-300">
                  <td className="p-2 border-r border-slate-300 font-medium">1. School Library (Books & Fines)</td>
                  <td className="p-2 border-r border-slate-300 text-center text-emerald-700 font-bold">NIL DUE / CLEARED</td>
                  <td className="p-2 text-right text-slate-400">___________________</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 border-r border-slate-300 font-medium">2. Computer / Science Laboratory</td>
                  <td className="p-2 border-r border-slate-300 text-center text-emerald-700 font-bold">NO BREAKAGE / CLEARED</td>
                  <td className="p-2 text-right text-slate-400">___________________</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 border-r border-slate-300 font-medium">3. Accounts & Tuition Fee Ledger</td>
                  <td className="p-2 border-r border-slate-300 text-center text-emerald-700 font-bold">PAID UP TO DATE</td>
                  <td className="p-2 text-right text-slate-400">___________________</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 border-r border-slate-300 font-medium">4. Sports & Co-Curricular Equipment</td>
                  <td className="p-2 border-r border-slate-300 text-center text-emerald-700 font-bold">RETURNED / CLEARED</td>
                  <td className="p-2 text-right text-slate-400">___________________</td>
                </tr>
                <tr>
                  <td className="p-2 border-r border-slate-300 font-medium">5. Class In-charge & Attendance Register</td>
                  <td className="p-2 border-r border-slate-300 text-center text-emerald-700 font-bold">STRIKE OFF RECORDED</td>
                  <td className="p-2 text-right text-slate-400">___________________</td>
                </tr>
              </tbody>
            </table>
          </div>
        );

      // 4. Character Certificate
      case 'character_certificate':
        return (
          <div className="py-6 px-4 space-y-6 text-center">
            <div className="inline-block border-b-2 border-slate-900 pb-1">
              <h3 className="text-base font-extrabold text-slate-950 uppercase tracking-widest">
                Certificate of Good Moral Character
              </h3>
            </div>

            <p className="text-sm sm:text-base leading-loose text-slate-800 text-justify max-w-2xl mx-auto">
              This is to solemnly certify that{' '}
              <strong className="border-b border-slate-800 px-2 font-bold text-slate-950">
                {isTemplateMode ? '________________________________' : s.fullName}
              </strong>
              , Son/Daughter of{' '}
              <strong className="border-b border-slate-800 px-2 font-bold text-slate-950">
                {isTemplateMode ? '________________________________' : s.fatherName}
              </strong>
              , bearing Admission Number{' '}
              <strong className="border-b border-slate-800 px-2 font-tabular font-bold">
                {isTemplateMode ? '________________' : s.admissionNumber}
              </strong>
              , has been a bonafide student of this institution in{' '}
              <strong className="border-b border-slate-800 px-2 font-bold">
                {isTemplateMode ? '________________' : s.studentClass}
              </strong>{' '}
              during academic session{' '}
              <strong className="border-b border-slate-800 px-2 font-bold">
                {isTemplateMode ? '2026-2027' : s.session || schoolProfile.activeSession}
              </strong>{' '}
              at {schoolProfile.schoolName}.
            </p>

            <p className="text-sm leading-relaxed text-slate-800 max-w-2xl mx-auto text-justify">
              To the best of our institutional record and knowledge, he/she bears an{' '}
              <strong>EXEMPLARY MORAL CHARACTER</strong>, displays commendable discipline, and took an active interest in curricular as well as co-curricular activities. He/she holds no disciplinary issues against him/her.
            </p>

            <p className="text-xs font-semibold text-slate-700 pt-2">
              We wish him/her resounding success in all future academic pursuits.
            </p>
          </div>
        );

      // 5. School Leaving Certificate (SLC) & Transfer Certificate (TC)
      case 'school_leaving_certificate':
      case 'transfer_certificate':
        return (
          <div className="space-y-4 text-xs text-slate-800">
            <div className="text-center pb-2">
              <span className="text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-800 px-3 py-1 rounded">
                Official School Leaving & Migration Certificate
              </span>
            </div>

            <table className="w-full border-collapse border border-slate-300 text-xs">
              <tbody>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold w-1/3 bg-slate-50 border-r border-slate-300">1. Student Name:</td>
                  <td className="p-2 font-bold text-slate-950">
                    {isTemplateMode ? '________________________________' : s.fullName}
                  </td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">2. Father's Name:</td>
                  <td className="p-2 font-semibold">
                    {isTemplateMode ? '________________________________' : s.fatherName}
                  </td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">3. Admission Number:</td>
                  <td className="p-2 font-tabular font-bold">
                    {isTemplateMode ? '____________________' : s.admissionNumber}
                  </td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">4. Date of Admission:</td>
                  <td className="p-2 font-tabular">
                    {isTemplateMode ? '____ / ____ / ________' : formatDate(s.admissionDate || '')}
                  </td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">5. Date of Birth:</td>
                  <td className="p-2 font-tabular">
                    {isTemplateMode ? '____ / ____ / ________' : formatDate(s.dob || '')}
                  </td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">6. Class in which student last studied:</td>
                  <td className="p-2 font-bold text-amber-900">
                    {isTemplateMode ? '____________________' : s.studentClass}
                  </td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">7. Clearance of School Dues:</td>
                  <td className="p-2 font-semibold text-emerald-800">
                    {isTemplateMode ? 'Cleared up to: ____________________' : 'Fully Paid & Cleared up to Current Month'}
                  </td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">8. General Conduct:</td>
                  <td className="p-2 font-semibold">Good / Exemplary</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">9. Reason for Leaving:</td>
                  <td className="p-2">
                    {isTemplateMode ? '________________________________________________' : 'On parent request for admission in next educational level'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        );

      // 6. Academic Merit & Distinction Certificate
      case 'merit_certificate':
        return (
          <div className="py-6 px-4 space-y-6 text-center">
            <div className="inline-block border-b-2 border-slate-900 pb-1">
              <h3 className="text-base font-extrabold text-slate-950 uppercase tracking-widest">
                Certificate of Academic Merit & Distinction
              </h3>
            </div>

            <p className="text-sm sm:text-base leading-loose text-slate-800 text-justify max-w-2xl mx-auto">
              This prestigious certificate of merit is proudly awarded to{' '}
              <strong className="border-b border-slate-800 px-2 font-bold text-slate-950">
                {isTemplateMode ? '________________________________' : s.fullName}
              </strong>
              , Son/Daughter of{' '}
              <strong className="border-b border-slate-800 px-2 font-bold text-slate-950">
                {isTemplateMode ? '________________________________' : s.fatherName}
              </strong>
              , bearing Admission Number <strong className="font-mono font-bold">{isTemplateMode ? '__________' : s.admissionNumber}</strong>, 
              Class <strong className="font-bold">{isTemplateMode ? '__________' : s.studentClass}</strong>, in recognition of outstanding academic brilliance, 
              disciplined dedication, and distinction in academic session <strong className="font-bold">{isTemplateMode ? '2026-2027' : s.session || schoolProfile.activeSession}</strong>.
            </p>

            <div className="my-4 p-4 border border-slate-400 bg-slate-50 rounded-lg max-w-md mx-auto">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-600 block mb-1">Honors Conferred</span>
              <p className="text-base font-black text-slate-950">1ST POSITION · OUTSTANDING DISTINCTION</p>
            </div>

            <p className="text-xs font-semibold text-slate-700">
              The faculty and administration of {schoolProfile.schoolName} commend this scholarly accomplishment.
            </p>
          </div>
        );

      // 7. Staff Registration & Profile Ledger
      case 'staff_registration':
        return (
          <div className="space-y-4 text-xs text-slate-800">
            <div className="text-center pb-2">
              <span className="text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-800 px-3 py-1 rounded">
                Employee Personnel Record & Service Ledger
              </span>
            </div>

            <table className="w-full border-collapse border border-slate-300 text-xs">
              <tbody>
                <tr className="bg-slate-50 border-b border-slate-300">
                  <td className="p-2 font-bold w-1/3 border-r border-slate-300">Staff Employee ID:</td>
                  <td className="p-2 font-mono font-bold">{isTemplateMode ? 'STF-____' : stf.staffIdNumber || 'STF-001'}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">Employee Full Name:</td>
                  <td className="p-2 font-bold text-slate-950">{isTemplateMode ? '________________________' : stf.fullName}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">Father's Name:</td>
                  <td className="p-2 font-semibold">{isTemplateMode ? '________________________' : stf.fatherName}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">Official Designation & Department:</td>
                  <td className="p-2 font-bold text-amber-900">{isTemplateMode ? '________________________' : `${stf.designation} (${stf.department || 'General'})`}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">CNIC Number:</td>
                  <td className="p-2 font-mono">{isTemplateMode ? '_____-_______-_' : stf.cnic}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">Academic Qualification:</td>
                  <td className="p-2">{isTemplateMode ? '________________________' : stf.qualification}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">Date of Joining:</td>
                  <td className="p-2 font-tabular">{isTemplateMode ? '____ / ____ / ________' : formatDate(stf.joiningDate || '')}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">Monthly Remuneration:</td>
                  <td className="p-2 font-tabular font-bold text-slate-950">{isTemplateMode ? 'Rs. _________' : formatPKR(stf.monthlySalary || 0)}</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">Residential Address:</td>
                  <td className="p-2">{isTemplateMode ? '________________________________________________________________' : stf.address}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );

      // 8. Staff Appointment Letter & Agreement
      case 'staff_appointment':
        return (
          <div className="space-y-4 text-xs text-slate-800">
            <div className="text-center pb-2">
              <span className="text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-800 px-3 py-1 rounded">
                Official Letter of Appointment & Service Contract
              </span>
            </div>

            <p className="leading-relaxed">
              To: <strong className="text-slate-950 font-bold">{isTemplateMode ? '________________________' : stf.fullName}</strong>, 
              Father's Name: <strong className="font-semibold">{isTemplateMode ? '________________________' : stf.fatherName}</strong>, 
              CNIC: <strong className="font-mono">{isTemplateMode ? '_____-_______-_' : stf.cnic}</strong>.
            </p>

            <p className="leading-relaxed text-justify">
              We are pleased to formally offer you appointment as <strong className="text-slate-950 font-bold">{isTemplateMode ? '____________________' : stf.designation}</strong> in 
              the Department of <strong className="font-bold">{isTemplateMode ? '__________' : stf.department || 'General Education'}</strong> at {schoolProfile.schoolName}. 
              Your employment shall be governed by the standard service policies, educational regulations, and institutional codes of conduct.
            </p>

            <table className="w-full border-collapse border border-slate-300 text-xs">
              <tbody>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300 w-1/3">1. Monthly Consolidated Salary:</td>
                  <td className="p-2 font-bold text-slate-950">{isTemplateMode ? 'Rs. _______________' : formatPKR(stf.monthlySalary || 0)}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">2. Effective Commencement Date:</td>
                  <td className="p-2 font-tabular">{isTemplateMode ? '____ / ____ / 2026' : formatDate(stf.joiningDate || '')}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">3. Working Hours & Duties:</td>
                  <td className="p-2">Full-time standard academic schedule, class lectures, examination duty, and student evaluation.</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">4. Probationary Period:</td>
                  <td className="p-2">Three (3) months from the commencement date, subject to performance appraisal.</td>
                </tr>
              </tbody>
            </table>
          </div>
        );

      // 9. Staff Experience Certificate
      case 'staff_experience':
        return (
          <div className="py-6 px-4 space-y-6 text-center">
            <div className="inline-block border-b-2 border-slate-900 pb-1">
              <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-widest">
                Certificate of Professional Service & Teaching Experience
              </h3>
            </div>

            <p className="text-sm sm:text-base leading-loose text-slate-800 text-justify max-w-2xl mx-auto">
              This is to certify that{' '}
              <strong className="border-b border-slate-800 px-2 font-bold text-slate-950">
                {isTemplateMode ? '________________________________' : stf.fullName}
              </strong>
              , Son/Daughter of{' '}
              <strong className="border-b border-slate-800 px-2 font-bold text-slate-950">
                {isTemplateMode ? '________________________________' : stf.fatherName}
              </strong>
              , holding CNIC{' '}
              <strong className="border-b border-slate-800 px-2 font-tabular">
                {isTemplateMode ? '_____-_______-_' : stf.cnic}
              </strong>
              , has served at {schoolProfile.schoolName} as{' '}
              <strong className="border-b border-slate-800 px-2 font-bold text-amber-900">
                {isTemplateMode ? '________________________________' : stf.designation}
              </strong>{' '}
              from{' '}
              <strong className="border-b border-slate-800 px-2 font-tabular">
                {isTemplateMode ? '____ / ____ / ________' : formatDate(stf.joiningDate || '')}
              </strong>{' '}
              to date.
            </p>

            <p className="text-sm leading-relaxed text-slate-800 max-w-2xl mx-auto text-justify">
              During his/her tenure, he/she demonstrated exceptional pedagogical dedication, profound command of the subject, integrity, and student mentorship. His/her moral conduct and work habits have been outstanding.
            </p>

            <p className="text-xs font-semibold text-slate-700 pt-2">
              We wish him/her the very best in all future career undertakings.
            </p>
          </div>
        );

      // 10. Staff Salary Certificate
      case 'staff_salary_certificate':
        return (
          <div className="space-y-4 text-xs text-slate-800">
            <div className="text-center pb-2">
              <span className="text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-800 px-3 py-1 rounded">
                Official Emoluments & Salary Verification
              </span>
            </div>

            <p className="leading-relaxed">
              This is to certify that <strong>{isTemplateMode ? '____________________' : stf.fullName}</strong> is a permanent member of staff serving as <strong>{isTemplateMode ? '____________________' : stf.designation}</strong> at {schoolProfile.schoolName}. His/her monthly salary breakdown is as follows:
            </p>

            <table className="w-full border-collapse border border-slate-300 text-xs">
              <thead className="bg-slate-100 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2 border-r border-slate-300 text-left">Salary Head</th>
                  <th className="p-2 text-right">Amount (PKR)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-300">
                  <td className="p-2 border-r border-slate-300">Basic Pay</td>
                  <td className="p-2 font-tabular text-right">
                    {isTemplateMode ? 'Rs. _________' : formatPKR((stf.monthlySalary || 0) * 0.7)}
                  </td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 border-r border-slate-300">House Rent & Medical Allowance</td>
                  <td className="p-2 font-tabular text-right">
                    {isTemplateMode ? 'Rs. _________' : formatPKR((stf.monthlySalary || 0) * 0.2)}
                  </td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 border-r border-slate-300">Special Academic Allowance</td>
                  <td className="p-2 font-tabular text-right">
                    {isTemplateMode ? 'Rs. _________' : formatPKR((stf.monthlySalary || 0) * 0.1)}
                  </td>
                </tr>
                <tr className="bg-slate-50 font-extrabold border-t border-slate-300">
                  <td className="p-2 border-r border-slate-300">GROSS MONTHLY EMOLUMENTS:</td>
                  <td className="p-2 font-tabular text-right text-slate-950 text-sm">
                    {isTemplateMode ? 'Rs. _________' : formatPKR(stf.monthlySalary || 0)}
                  </td>
                </tr>
              </tbody>
            </table>

            <p className="text-[11px] text-slate-600 italic">
              <strong>Amount in words:</strong>{' '}
              {isTemplateMode ? '_______________________________________________' : numberToWordsPKR(stf.monthlySalary || 0)}
            </p>
          </div>
        );

      // 11. Staff Resignation Form & Relieving Letter
      case 'staff_resignation':
        return (
          <div className="space-y-4 text-xs text-slate-800">
            <div className="text-center pb-2">
              <span className="text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-800 px-3 py-1 rounded">
                Official Relieving & Clearance Letter
              </span>
            </div>

            <p className="leading-relaxed">
              This is to formally confirm that <strong className="text-slate-950 font-bold">{isTemplateMode ? '____________________' : stf.fullName}</strong>, 
              serving as <strong className="font-semibold">{isTemplateMode ? '____________________' : stf.designation}</strong>, has tendered resignation from 
              service at {schoolProfile.schoolName}.
            </p>

            <table className="w-full border-collapse border border-slate-300 text-xs">
              <tbody>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300 w-1/3">1. Effective Relieving Date:</td>
                  <td className="p-2 font-tabular font-bold">{isTemplateMode ? '____ / ____ / 2026' : formatDate(new Date().toISOString())}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">2. Departmental Dues & Clearance:</td>
                  <td className="p-2 font-semibold text-emerald-800">All financial accounts, keys, and materials returned and cleared.</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">3. Service Conduct Record:</td>
                  <td className="p-2">Satisfactory, cooperative, and professionally dedicated during tenure.</td>
                </tr>
              </tbody>
            </table>
          </div>
        );

      // 12. Leave Application & Approval Form
      case 'leave_application':
        return (
          <div className="space-y-4 text-xs text-slate-800">
            <div className="text-center pb-2">
              <span className="text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-800 px-3 py-1 rounded">
                Staff Formal Leave Requisition & Approval
              </span>
            </div>

            <table className="w-full border-collapse border border-slate-300 text-xs">
              <tbody>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300 w-1/3">Applicant Employee:</td>
                  <td className="p-2 font-bold text-slate-950">{isTemplateMode ? '________________________' : stf.fullName}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">Designation & Dept:</td>
                  <td className="p-2 font-semibold">{isTemplateMode ? '________________________' : `${stf.designation} (${stf.department || 'General'})`}</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">Type of Leave Requested:</td>
                  <td className="p-2">[  ] Casual Leave   [  ] Medical Leave   [  ] Urgent Duty Leave</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">Leave Duration:</td>
                  <td className="p-2">From: <strong>____ / ____ / 2026</strong>  To: <strong>____ / ____ / 2026</strong> (Total: _____ Days)</td>
                </tr>
                <tr className="border-b border-slate-300">
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">Reason for Absence:</td>
                  <td className="p-2">Urgent domestic requirement / medical appointment.</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold bg-slate-50 border-r border-slate-300">Administrative Sanction:</td>
                  <td className="p-2 font-bold text-emerald-800">[ X ] SANCTIONED & APPROVED BY PRINCIPAL</td>
                </tr>
              </tbody>
            </table>
          </div>
        );

      // 13. Examination Result Card / Report Card
      case 'exam_result_card':
        const res = examResults[0];
        return (
          <div className="space-y-4 text-xs text-slate-800">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2 bg-slate-50 border border-slate-200 rounded text-xs">
              <div>
                <span className="text-slate-500 block">Student:</span>
                <strong className="text-slate-950">{isTemplateMode ? '________________' : s.fullName}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Father:</span>
                <strong>{isTemplateMode ? '________________' : s.fatherName}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Class / Roll No:</span>
                <strong className="font-tabular">{isTemplateMode ? '________' : `${s.studentClass} / ${s.admissionNumber}`}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Exam Term:</span>
                <strong>{res?.examTerm || 'Mid Term Examination'}</strong>
              </div>
            </div>

            <table className="w-full border-collapse border border-slate-300 text-xs">
              <thead className="bg-slate-100 font-bold border-b border-slate-300 text-center">
                <tr>
                  <th className="p-2 border-r border-slate-300 text-left">Subject</th>
                  <th className="p-2 border-r border-slate-300">Total Marks</th>
                  <th className="p-2 border-r border-slate-300">Obtained</th>
                  <th className="p-2">Grade</th>
                </tr>
              </thead>
              <tbody className="text-center">
                {(res?.subjects || [
                  { subject: 'English', total: 75, obtained: 68, grade: 'A+' },
                  { subject: 'Urdu', total: 75, obtained: 70, grade: 'A+' },
                  { subject: 'Mathematics', total: 75, obtained: 72, grade: 'A+' },
                  { subject: 'Physics', total: 75, obtained: 66, grade: 'A' },
                  { subject: 'Chemistry', total: 75, obtained: 67, grade: 'A' },
                  { subject: 'Biology / CS', total: 75, obtained: 71, grade: 'A+' },
                  { subject: 'Islamiat', total: 50, obtained: 46, grade: 'A+' },
                  { subject: 'Tarjuma-tul-Quran', total: 50, obtained: 38, grade: 'A' },
                ]).map((sub, idx) => (
                  <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="p-2 border-r border-slate-300 text-left font-medium">{sub.subject}</td>
                    <td className="p-2 border-r border-slate-300 font-tabular">{sub.total}</td>
                    <td className="p-2 border-r border-slate-300 font-tabular font-bold">
                      {isTemplateMode ? '____' : sub.obtained}
                    </td>
                    <td className="p-2 font-bold">{isTemplateMode ? '__' : sub.grade}</td>
                  </tr>
                ))}
                <tr className="bg-slate-100 font-extrabold border-t-2 border-slate-300">
                  <td className="p-2 border-r border-slate-300 text-left">AGGREGATE TOTAL:</td>
                  <td className="p-2 border-r border-slate-300 font-tabular">{res?.totalMarks || 550}</td>
                  <td className="p-2 border-r border-slate-300 font-tabular text-sm text-slate-950">
                    {isTemplateMode ? '______' : res?.obtainedMarks || 498}
                  </td>
                  <td className="p-2 text-emerald-800 text-sm">{isTemplateMode ? '__' : res?.grade || 'A+'}</td>
                </tr>
              </tbody>
            </table>

            <div className="flex justify-between items-center p-2.5 bg-slate-50 border border-slate-200 rounded text-xs font-semibold">
              <span>Percentage: <strong className="font-tabular">{isTemplateMode ? '____%' : `${res?.percentage || 90.5}%`}</strong></span>
              <span>Position in Class: <strong>{isTemplateMode ? '____' : '1st Position'}</strong></span>
              <span>Status: <strong className="text-emerald-700">{isTemplateMode ? 'PASS / FAIL' : 'PASSED (Distinction)'}</strong></span>
            </div>
          </div>
        );

      default:
        return (
          <div className="py-8 text-center text-slate-500">
            Select a document template to preview and download.
          </div>
        );
    }
  };

  const currentFormObj = formList.find((f) => f.key === selectedFormKey) || formList[0];

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Official Document Center</span>
            <span>·</span>
            <span>{schoolProfile.schoolName}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Downloadable Forms & Certificates Hub
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Download high-resolution A4 PDFs or print completed forms and blank templates for all school requirements.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsTemplateMode(!isTemplateMode)}
            className={`px-3 py-2 text-xs font-bold rounded-lg border transition-colors flex items-center gap-1.5 ${
              isTemplateMode
                ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs'
                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>{isTemplateMode ? 'Mode: Blank Template' : 'Mode: Completed Form'}</span>
          </button>

          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-lg transition-colors shadow-xs"
          >
            <Download className={`w-4 h-4 ${downloading ? 'animate-bounce' : ''}`} />
            <span>{downloading ? 'Generating PDF...' : 'Download PDF'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-lg transition-colors shadow-xs"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>Print Form</span>
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 text-xs sm:text-sm">
        <button
          onClick={() => setActiveCategory('student_forms')}
          className={`px-4 py-2 font-bold whitespace-nowrap transition-colors rounded-t-lg ${
            activeCategory === 'student_forms'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Student Admission & Registration Forms
        </button>
        <button
          onClick={() => setActiveCategory('student_certificates')}
          className={`px-4 py-2 font-bold whitespace-nowrap transition-colors rounded-t-lg ${
            activeCategory === 'student_certificates'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Character, SLC & Transfer Certificates
        </button>
        <button
          onClick={() => setActiveCategory('staff_forms')}
          className={`px-4 py-2 font-bold whitespace-nowrap transition-colors rounded-t-lg ${
            activeCategory === 'staff_forms'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Staff & HR Forms
        </button>
        <button
          onClick={() => setActiveCategory('staff_certificates')}
          className={`px-4 py-2 font-bold whitespace-nowrap transition-colors rounded-t-lg ${
            activeCategory === 'staff_certificates'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Staff Experience & Salary Certificates
        </button>
        <button
          onClick={() => setActiveCategory('academic_forms')}
          className={`px-4 py-2 font-bold whitespace-nowrap transition-colors rounded-t-lg ${
            activeCategory === 'academic_forms'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Examination & Result Cards
        </button>
      </div>

      {/* Main Grid: Selector Sidebar + A4 Live Document Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Selector & Record Chooser */}
        <div className="lg:col-span-4 space-y-4">
          {/* Select Specific Student or Staff when not in template mode */}
          {!isTemplateMode && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                {activeCategory.startsWith('staff')
                  ? 'Populate with Staff Member:'
                  : 'Populate with Student Record:'}
              </label>

              {activeCategory.startsWith('staff') ? (
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white"
                >
                  {staff.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.fullName} ({st.designation})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="space-y-2">
                  <StudentSearchSelector
                    onSelectStudent={(st) => setSelectedStudentId(st.id)}
                    selectedStudentId={selectedStudentId}
                    includeHistorySelection={true}
                    label="Search by Name, Roll #, Permanent ID, or Phone"
                  />
                  {currentStudent && (
                    <div className="text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-200 text-slate-600 flex justify-between">
                      <span>Current: <strong>{currentStudent.fullName}</strong></span>
                      <span className="font-mono text-amber-700">{currentStudent.admissionNumber}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Form List in Category */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-3 space-y-1.5">
            <span className="text-xs font-bold text-slate-500 uppercase px-2 pb-1 block">
              Available Documents:
            </span>
            {filteredForms.map((item) => (
              <button
                key={item.key}
                onClick={() => setSelectedFormKey(item.key)}
                className={`w-full text-left p-3 rounded-lg transition-all flex items-center justify-between gap-2 ${
                  selectedFormKey === item.key
                    ? 'bg-slate-900 text-white shadow-xs font-bold'
                    : 'text-slate-700 hover:bg-slate-100 font-medium'
                }`}
              >
                <div className="flex-1 pr-2">
                  <p className="text-xs">{item.title}</p>
                  <p className={`text-[10px] line-clamp-1 mt-0.5 ${selectedFormKey === item.key ? 'text-amber-200' : 'text-slate-400'}`}>
                    {item.desc}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Live Official A4 Document Container */}
        <div className="lg:col-span-8 bg-slate-100/70 p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-inner">
          <div className="flex items-center justify-between pb-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">{currentFormObj.title}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadPDF}
                disabled={downloading}
                className="text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
              <span>·</span>
              <button
                onClick={handlePrint}
                className="text-slate-700 hover:text-slate-900 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* The Actual Printable/Downloadable A4 Sheet */}
          <div
            ref={documentRef}
            id="printable-document"
            className="printable-area bg-white p-8 sm:p-10 shadow-lg rounded-xl max-w-2xl mx-auto border border-slate-200 text-slate-900"
            style={{ minHeight: '800px' }}
          >
            {renderDocumentHeader(currentFormObj.title)}
            {renderDocumentContent()}
            {renderDocumentFooter()}
          </div>
        </div>
      </div>
    </div>
  );
};
