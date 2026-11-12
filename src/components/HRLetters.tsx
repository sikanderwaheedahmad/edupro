/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Download,
  Printer,
  Plus,
  Trash2,
  CheckCircle2,
  Search,
  Filter,
  User,
  Calendar,
  Building,
  Briefcase,
  AlertTriangle,
  RotateCcw,
  Edit3,
  Eye,
  FileCheck,
  UserCheck,
  HelpCircle,
} from 'lucide-react';
import {
  StaffRecord,
  SchoolProfile,
  StaffEmploymentLetter,
  UserRole,
  HRDocumentType,
} from '../types/school.ts';
import { downloadElementAsPDF, printElement } from '../utils/pdfExport.ts';
import { formatDate } from '../utils/voucherHelpers.ts';

interface HRLettersProps {
  staff: StaffRecord[];
  schoolProfile: SchoolProfile;
  userRole: UserRole;
  onRefreshStaff: () => void;
}

interface DocumentTypeConfig {
  type: HRDocumentType;
  title: string;
  prefix: string;
  badgeColor: string;
  description: string;
}

const DOCUMENT_TYPES: DocumentTypeConfig[] = [
  {
    type: 'APPOINTMENT',
    title: 'Appointment Letter',
    prefix: 'APP',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    description: 'Formal employment offer, designation, terms, and reporting directives',
  },
  {
    type: 'OFFICIAL_ORDER',
    title: 'Official Order / Hukamnama',
    prefix: 'ORD',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    description: 'Executive administrative directives, duties assignment, and committee orders',
  },
  {
    type: 'TRANSFER_ORDER',
    title: 'Transfer / Posting Order',
    prefix: 'TRF',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    description: 'Relocation of staff between campuses, shifts, or academic departments',
  },
  {
    type: 'RESIGNATION',
    title: 'Resignation Letter',
    prefix: 'RES',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    description: 'Formal acceptance of resignation, last working day, and dues clearance',
  },
  {
    type: 'DISCIPLINARY',
    title: 'Disciplinary Notice / Penalty Order',
    prefix: 'DIS',
    badgeColor: 'bg-red-100 text-red-800 border-red-200',
    description: 'Formal disciplinary action, inquiry findings, reprimand, or penalty orders',
  },
  {
    type: 'LEAVE_APPLICATION',
    title: 'Leave Application & Approval',
    prefix: 'LEV',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    description: 'Staff leave record, substitution arrangements, and executive sanction',
  },
  {
    type: 'EXPERIENCE',
    title: 'Staff Experience Certificate',
    prefix: 'EXP',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
    description: 'Official service tenure, pedagogy performance, and conduct certification',
  },
  {
    type: 'SHOW_CAUSE',
    title: 'Staff Explanation / Show-Cause Notice',
    prefix: 'SCN',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    description: 'Formal call for written explanation regarding misconduct or duty negligence',
  },
  {
    type: 'ABSENCE_WARNING',
    title: 'Staff Absence / Warning Letter',
    prefix: 'ABW',
    badgeColor: 'bg-orange-100 text-orange-800 border-orange-200',
    description: 'Warning notice for unauthorized absence, tardiness, or job abandonment',
  },
  {
    type: 'CLEARANCE_FORM',
    title: 'Staff Clearance / Handover Form',
    prefix: 'CLR',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
    description: 'Comprehensive clearance and asset handover checklist across all departments',
  },
];

export const HRLetters: React.FC<HRLettersProps> = ({
  staff,
  schoolProfile,
  userRole,
}) => {
  const [letters, setLetters] = useState<StaffEmploymentLetter[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<HRDocumentType>('APPOINTMENT');
  const [viewMode, setViewMode] = useState<'create' | 'list'>('create');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [downloading, setDownloading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string>(staff[0]?.id || '');
  
  // Manual staff fields
  const [manualName, setManualName] = useState('');
  const [manualFatherName, setManualFatherName] = useState('');
  const [manualIdNumber, setManualIdNumber] = useState('');
  const [manualDesignation, setManualDesignation] = useState('');
  const [manualDepartment, setManualDepartment] = useState('Education');
  const [manualCnic, setManualCnic] = useState('');
  const [manualJoiningDate, setManualJoiningDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Document Fields
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [lastWorkingDay, setLastWorkingDay] = useState('');
  const [reason, setReason] = useState('');
  const [subjectTitle, setSubjectTitle] = useState('');
  const [authorizedSignatory, setAuthorizedSignatory] = useState('Dr. Saeed Ahmad (Principal)');
  const [customBody, setCustomBody] = useState('');
  const [isEditingBody, setIsEditingBody] = useState(false);

  // View / Print Modal
  const [viewingLetter, setViewingLetter] = useState<StaffEmploymentLetter | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<StaffEmploymentLetter | null>(null);

  const documentRef = useRef<HTMLDivElement | null>(null);
  const blankDocRef = useRef<HTMLDivElement | null>(null);

  const currentStaff = !isManualEntry
    ? staff.find((s) => s.id === selectedStaffId) || staff[0] || null
    : null;

  const activeStaffName = isManualEntry ? manualName : (currentStaff?.fullName || 'Staff Member');
  const activeFatherName = isManualEntry ? manualFatherName : (currentStaff?.fatherName || 'Father Name');
  const activeStaffIdNumber = isManualEntry
    ? (manualIdNumber || 'MANUAL-ENTRY')
    : (currentStaff?.staffIdNumber || `STF-${currentStaff?.id?.slice(0, 6)?.toUpperCase() || '0001'}`);
  const activeDesignation = isManualEntry ? (manualDesignation || 'Teacher') : (currentStaff?.designation || 'Teacher');
  const activeDepartment = isManualEntry ? (manualDepartment || 'General') : (currentStaff?.department || 'General');
  const activeCnic = isManualEntry ? (manualCnic || 'N/A') : (currentStaff?.cnic || 'N/A');
  const activeJoiningDate = isManualEntry
    ? manualJoiningDate
    : (currentStaff?.joiningDate || '2020-01-01');

  const logoSrc = schoolProfile.logoUrl || '/assets/school_logo.jpg';
  const stampSrc = schoolProfile.stampUrl || '/assets/school_stamp.jpg';

  // Fetch issued letters from backend
  const fetchLetters = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/staff-letters');
      if (res.ok) {
        const data = await res.json();
        setLetters(data);
      }
    } catch (err) {
      console.error('Failed to fetch HR documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLetters();
  }, []);

  // Generate Default Template Content
  const generateDefaultTemplate = (
    docType: HRDocumentType,
    stfName: string,
    fName: string,
    idNo: string,
    desig: string,
    dept: string,
    cnicVal: string,
    joinDate: string,
    effDate: string,
    lastDay: string,
    rsn: string
  ): { subject: string; body: string } => {
    switch (docType) {
      case 'APPOINTMENT':
        return {
          subject: `OFFER OF EMPLOYMENT & APPOINTMENT LETTER`,
          body: `On behalf of the Management of Siqarah Public Model High School Shorkot, we are pleased to offer you the position of "${desig}" in the Department of ${dept || 'Education'}, with effect from ${formatDate(effDate)}.\n\nTerms and Conditions of Employment:\n1. Compensation: You shall receive a monthly consolidated salary as mutually agreed and recorded in the school payroll registry.\n2. Probation Period: You shall serve on probation for a period of three (3) months, during which your pedagogical performance, punctuality, and conduct will be reviewed.\n3. Institutional Discipline: You agree to strictly abide by the rules, code of ethics, curriculum policies, and disciplinary regulations of Siqarah Public Model High School Shorkot and the Board of Intermediate and Secondary Education (BISE) Gujranwala.\n4. Reporting: Please report to Principal Dr. Saeed Ahmad on ${formatDate(effDate)} at 07:45 AM for institutional orientation.\n\nWe welcome you to our teaching and administrative community and wish you a fruitful association with our institution.`,
        };
      case 'OFFICIAL_ORDER':
        return {
          subject: `OFFICIAL ADMINISTRATIVE ORDER / HUKAMNAMA`,
          body: `By the order and directive of Principal Dr. Saeed Ahmad, the following official institutional order is promulgated for strict adherence and compliance:\n\n1. In the interest of institutional academic excellence, examination discipline, and student welfare, ${stfName} (${desig}) is hereby assigned administrative oversight and execution of institutional duties pertaining to ${rsn || 'school academic and administrative supervision'}.\n2. All concerned faculty members, section in-charges, and administrative staff members are instructed to provide full institutional cooperation and compliance.\n3. This order takes immediate effect from ${formatDate(effDate)} and shall remain operational until amended or rescinded by the competent authority.\n\nNon-compliance or disregard of this directive shall attract disciplinary proceedings in accordance with school service regulations.`,
        };
      case 'TRANSFER_ORDER':
        return {
          subject: `STAFF TRANSFER & POSTING ORDER`,
          body: `In the interest of school administrative re-organization and educational optimization, ${stfName}, holding Staff ID ${idNo} and currently serving as "${desig}" in the ${dept || 'Education'} Department, is hereby transferred and posted to ${rsn || 'Designated Campus Wing / Branch Department'} with effect from ${formatDate(effDate)}.\n\nYou are directed to complete charge handover, surrender relevant classroom logbooks and examination grading sheets to the Academic Coordinator, and report for duty at your new posting assignment without delay.\n\nNo joining extension shall be admissible without the written prior approval of Principal Dr. Saeed Ahmad.`,
        };
      case 'RESIGNATION':
        return {
          subject: `ACCEPTANCE OF RESIGNATION & RELEASE ORDER`,
          body: `With reference to the resignation tendered by ${stfName}, holding Staff ID ${idNo}, who has been serving as "${desig}" in the ${dept || 'Education'} Department at Siqarah Public Model High School Shorkot.\n\nThe Competent Authority has accepted your resignation effective from ${formatDate(effDate)}, with your last working day recorded as ${formatDate(lastDay || effDate)}.\n\nAll institutional clearances, academic logbooks, classroom inventories, and financial accounts have been verified as satisfactorily settled. We acknowledge your contributions during your tenure of service and wish you success in your future professional endeavors.`,
        };
      case 'DISCIPLINARY':
        return {
          subject: `FORMAL DISCIPLINARY NOTICE & PENALTY ORDER`,
          body: `Whereas formal administrative inquiry and inspection have substantiated breach of institutional discipline, teaching code of conduct, and faculty ethics on the part of ${stfName} (${desig}), Staff ID ${idNo}, regarding:\n\n${rsn || 'Violation of institutional decorum, unexcused absence, or non-compliance with school regulations'}.\n\nIn exercise of executive powers vested under the Service Regulations of Siqarah Public Model High School Shorkot, Principal Dr. Saeed Ahmad hereby orders the imposition of the following administrative penalty:\n1. Formal written reprimand placed on permanent personnel file.\n2. Injunction to maintain strict compliance with institutional guidelines and educational dignity.\n\nAny repetition or future recurrence of similar misconduct shall result in summary termination of employment without further inquiry. You have the right to submit a representation to the Board of Management within seven (7) days.`,
        };
      case 'LEAVE_APPLICATION':
        return {
          subject: `STAFF LEAVE APPLICATION & EXECUTIVE APPROVAL`,
          body: `Respectfully Sheweth,\nI, ${stfName}, serving as "${desig}" (Staff ID: ${idNo}) in the Department of ${dept || 'Education'}, humbly request sanction of leave with effect from ${formatDate(effDate)} to ${formatDate(lastDay || effDate)} on the grounds of ${rsn || 'personal and domestic exigency'}.\n\nI have arranged classroom substitution and syllabus coverage with the designated colleague to ensure student learning remains uninterrupted.\n\n-------------------------------------------------------------\nEXECUTIVE ADMINISTRATIVE ORDER:\nSanction is hereby accorded for the requested leave by order of Principal Dr. Saeed Ahmad. The period of absence is recorded in the official faculty attendance registry.`,
        };
      case 'EXPERIENCE':
        return {
          subject: `EXPERIENCE & SERVICE CERTIFICATE`,
          body: `This is to certify that ${stfName}, S/D of ${fName}, holding Staff ID ${idNo} and CNIC ${cnicVal}, was employed as a full-time "${desig}" in the Department of ${dept || 'Education'} at Siqarah Public Model High School Shorkot from ${formatDate(joinDate)} to ${formatDate(effDate)}.\n\nDuring their tenure of service, ${stfName} demonstrated exemplary teaching capabilities, professional integrity, strong classroom discipline, and active participation in school co-curricular activities.\n\nTo the best of our knowledge, their conduct and moral character were found to be very good throughout their service. We wish them all the best and continued success in their future professional pursuits.`,
        };
      case 'SHOW_CAUSE':
        return {
          subject: `SHOW-CAUSE NOTICE & CALL FOR WRITTEN EXPLANATION`,
          body: `You are hereby directed to show cause in writing within three (3) working days from the date of receipt of this notice, explaining why disciplinary action should not be initiated against you under institutional service regulations, in respect of the following matter:\n\n${rsn || 'Gross negligence of assigned instructional duty, unapproved absence, or breach of institutional decorum'}.\n\nYour written explanation must reach the Office of the Principal, Dr. Saeed Ahmad, on or before ${formatDate(effDate)}.\n\nFailure to submit your explanation within the stipulated deadline shall be construed as admission of the allegations, and ex-parte disciplinary proceedings shall follow without further notice.`,
        };
      case 'ABSENCE_WARNING':
        return {
          subject: `WARNING NOTICE FOR UNAUTHORIZED ABSENCE & DERELICTION OF DUTY`,
          body: `It has been observed with serious administrative concern that you, ${stfName} (${desig}, Staff ID: ${idNo}), have remained absent from duty without prior sanction or written intimation from ${formatDate(effDate)}.\n\nUnauthorized absence disrupts scheduled classroom lectures, compromises student academic schedules, and violates fundamental school discipline. You are hereby issued a Severe Warning to report for duty immediately with satisfactory written justification.\n\nPlease note that if you fail to resume duty within forty-eight (48) hours, you shall be deemed to have abandoned your employment, and disciplinary proceedings will be initiated in accordance with institutional rules.`,
        };
      case 'CLEARANCE_FORM':
        return {
          subject: `COMPREHENSIVE STAFF CLEARANCE & ASSET HANDOVER CERTIFICATE`,
          body: `This is to certify that ${stfName}, holding Staff ID ${idNo} and designated as "${desig}" in the Department of ${dept || 'Education'}, has completed all institutional clearance and asset handover requirements upon relinquishing charge effective ${formatDate(effDate)}.\n\nDepartmental Clearances Verified:\n[OK] 1. School Library: Books and reading materials returned.\n[OK] 2. Science Laboratories: Apparatus and chemicals accounted for.\n[OK] 3. Examination Branch: Question papers, answer scripts, and award lists submitted.\n[OK] 4. Administrative Office: Teacher attendance register, keys, and identity badge surrendered.\n[OK] 5. Accounts & Finance Department: All salary advances, provident fund balances, and departmental dues fully settled.\n\nNo institutional liability or dues remain outstanding against the official.`,
        };
      default:
        return {
          subject: `OFFICIAL SCHOOL DOCUMENT`,
          body: `This document certifies that ${stfName} is associated with Siqarah Public Model High School Shorkot as ${desig}.`,
        };
    }
  };

  // Synchronize custom body when parameters change (unless user is currently editing)
  useEffect(() => {
    if (!isEditingBody) {
      const template = generateDefaultTemplate(
        activeTab,
        activeStaffName,
        activeFatherName,
        activeStaffIdNumber,
        activeDesignation,
        activeDepartment,
        activeCnic,
        activeJoiningDate,
        effectiveDate,
        lastWorkingDay,
        reason
      );
      setSubjectTitle(template.subject);
      setCustomBody(template.body);
    }
  }, [
    activeTab,
    activeStaffName,
    activeFatherName,
    activeStaffIdNumber,
    activeDesignation,
    activeDepartment,
    activeCnic,
    activeJoiningDate,
    effectiveDate,
    lastWorkingDay,
    reason,
    isEditingBody,
  ]);

  const handleResetToDefaultTemplate = () => {
    setIsEditingBody(false);
    const template = generateDefaultTemplate(
      activeTab,
      activeStaffName,
      activeFatherName,
      activeStaffIdNumber,
      activeDesignation,
      activeDepartment,
      activeCnic,
      activeJoiningDate,
      effectiveDate,
      lastWorkingDay,
      reason
    );
    setSubjectTitle(template.subject);
    setCustomBody(template.body);
  };

  const handleSaveDocument = async () => {
    if (!activeStaffName.trim()) {
      setActionMessage({ text: 'Staff full name is required.', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      const payload = {
        letterType: activeTab,
        staffId: isManualEntry ? 'MANUAL' : (currentStaff?.id || 'MANUAL'),
        staffName: activeStaffName.trim(),
        fatherName: activeFatherName.trim(),
        staffIdNumber: activeStaffIdNumber,
        designation: activeDesignation,
        department: activeDepartment,
        joiningDate: activeJoiningDate,
        effectiveDate,
        lastWorkingDay: lastWorkingDay || effectiveDate,
        reason: reason.trim() || undefined,
        contentBody: customBody,
        issueDate,
        authorizedSignatory,
        isManualStaff: isManualEntry,
        cnic: activeCnic,
        subjectTitle,
      };

      const res = await fetch('/api/staff-letters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const saved = await res.json();
        setActionMessage({
          text: `Document ${saved.letterNumber} successfully issued and recorded in ERP!`,
          type: 'success',
        });
        fetchLetters();
      } else {
        const err = await res.json();
        setActionMessage({ text: err.error || 'Failed to save document.', type: 'error' });
      }
    } catch {
      setActionMessage({ text: 'Error connecting to server.', type: 'error' });
    } finally {
      setLoading(false);
      setTimeout(() => setActionMessage(null), 5000);
    }
  };

  const handleDownloadPDF = async () => {
    if (!documentRef.current) return;
    try {
      setDownloading(true);
      const slug = activeStaffName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${slug}_${activeTab}_Siqarah_High_School.pdf`;
      await downloadElementAsPDF(documentRef.current, filename);
    } catch (err) {
      console.error('PDF download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadBlankTemplatePDF = async () => {
    if (!blankDocRef.current) return;
    try {
      setDownloading(true);
      const filename = `Blank_${activeTab}_Form_Siqarah_High_School.pdf`;
      await downloadElementAsPDF(blankDocRef.current, filename);
    } catch (err) {
      console.error('Blank template download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    if (documentRef.current) {
      printElement(documentRef.current, `${activeStaffName}_${activeTab}`);
    } else {
      window.print();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/staff-letters/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-name': userRole === 'Super Admin' ? 'Super Admin' : 'Dr. Saeed Ahmad',
        },
      });
      if (res.ok) {
        setLetters((prev) => prev.filter((l) => l.id !== deleteTarget.id));
        setDeleteTarget(null);
        setActionMessage({
          text: `Document ${deleteTarget.letterNumber} moved to Recycle Bin safely.`,
          type: 'success',
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const canDelete = ['Super Admin', 'Principal', 'HR'].includes(userRole);

  const filteredLetters = letters.filter((l) => {
    const matchType = typeFilter === 'ALL' || l.letterType === typeFilter;
    const matchSearch =
      l.staffName.toLowerCase().includes(search.toLowerCase()) ||
      l.letterNumber.toLowerCase().includes(search.toLowerCase()) ||
      l.designation.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const activeConfig = DOCUMENT_TYPES.find((d) => d.type === activeTab) || DOCUMENT_TYPES[0];

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
            <FileText className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">HR & Staff Official Documents</h1>
            <p className="text-sm text-slate-500">
              10 Ready-Made English School ERP Templates · Real-Time Preview · Printable & PDF Downloads
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('create')}
            className={`px-4 py-2 text-sm font-semibold rounded-xl flex items-center gap-2 transition-all ${
              viewMode === 'create'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Plus className="w-4 h-4" /> Issue Document
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 text-sm font-semibold rounded-xl flex items-center gap-2 transition-all ${
              viewMode === 'list'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FileCheck className="w-4 h-4" /> Issued Documents ({letters.length})
          </button>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* CREATE MODE */}
      {viewMode === 'create' && (
        <div className="space-y-6">
          {/* Document Type Selector Pills */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Select Official Document Type (10 Ready-Made English Templates)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {DOCUMENT_TYPES.map((doc) => {
                const isActive = activeTab === doc.type;
                return (
                  <button
                    key={doc.type}
                    onClick={() => {
                      setActiveTab(doc.type);
                      setIsEditingBody(false);
                    }}
                    className={`p-3 rounded-xl text-left border transition-all flex flex-col justify-between ${
                      isActive
                        ? 'border-amber-500 bg-amber-50/50 shadow-sm ring-2 ring-amber-500/20'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono font-bold text-slate-400">
                          {doc.prefix}
                        </span>
                        {isActive && (
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        )}
                      </div>
                      <div className={`text-xs font-bold line-clamp-2 ${isActive ? 'text-amber-900' : 'text-slate-800'}`}>
                        {doc.title}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-3 italic flex items-center gap-1.5">
              <span className="font-semibold text-slate-700">{activeConfig.title}:</span> {activeConfig.description}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Controls & Parameters (5 Columns) */}
            <div className="lg:col-span-5 space-y-5">
              {/* Staff Selection Card */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-amber-600" /> Staff Member Information
                  </h3>
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isManualEntry}
                      onChange={(e) => {
                        setIsManualEntry(e.target.checked);
                        setIsEditingBody(false);
                      }}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    Enter Manually
                  </label>
                </div>

                {!isManualEntry ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Select Registered Staff Member
                      </label>
                      <select
                        value={selectedStaffId}
                        onChange={(e) => {
                          setSelectedStaffId(e.target.value);
                          setIsEditingBody(false);
                        }}
                        className="w-full text-sm rounded-xl border border-slate-300 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      >
                        {staff.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.fullName} ({s.designation}) · {s.staffIdNumber || s.id}
                          </option>
                        ))}
                      </select>
                    </div>

                    {currentStaff && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Father Name:</span>
                          <span className="font-semibold text-slate-800">{currentStaff.fatherName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Staff ID Number:</span>
                          <span className="font-semibold text-slate-800">{activeStaffIdNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Department:</span>
                          <span className="font-semibold text-slate-800">{currentStaff.department || 'General'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">CNIC Number:</span>
                          <span className="font-semibold text-slate-800">{currentStaff.cnic}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Joining Date:</span>
                          <span className="font-semibold text-slate-800">{formatDate(currentStaff.joiningDate)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 p-3 bg-amber-50/50 rounded-xl border border-amber-200">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Staff Full Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Muhammad Ahmad"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Father's Name
                        </label>
                        <input
                          type="text"
                          placeholder="Father's name"
                          value={manualFatherName}
                          onChange={(e) => setManualFatherName(e.target.value)}
                          className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Designation
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Senior Science Teacher"
                          value={manualDesignation}
                          onChange={(e) => setManualDesignation(e.target.value)}
                          className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Staff ID / Ref
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. STF-2026-0005"
                          value={manualIdNumber}
                          onChange={(e) => setManualIdNumber(e.target.value)}
                          className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Department
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Science / Math"
                          value={manualDepartment}
                          onChange={(e) => setManualDepartment(e.target.value)}
                          className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          CNIC Number
                        </label>
                        <input
                          type="text"
                          placeholder="33202-xxxxxxx-x"
                          value={manualCnic}
                          onChange={(e) => setManualCnic(e.target.value)}
                          className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Joining Date
                        </label>
                        <input
                          type="date"
                          value={manualJoiningDate}
                          onChange={(e) => setManualJoiningDate(e.target.value)}
                          className="w-full text-sm rounded-lg border border-slate-300 px-3 py-2 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Document Parameters Card */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-600" /> Document Dates & Specifics
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Issue Date
                    </label>
                    <input
                      type="date"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className="w-full text-sm rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Effective Date
                    </label>
                    <input
                      type="date"
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                      className="w-full text-sm rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </div>
                </div>

                {['RESIGNATION', 'LEAVE_APPLICATION'].includes(activeTab) && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      {activeTab === 'RESIGNATION' ? 'Last Working Day' : 'Leave End Date'}
                    </label>
                    <input
                      type="date"
                      value={lastWorkingDay}
                      onChange={(e) => setLastWorkingDay(e.target.value)}
                      className="w-full text-sm rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Specific Details / Reason / Destination / Findings
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter specific reasons, transfer branch, leave reason, or administrative findings..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full text-sm rounded-xl border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Authorized Signatory
                  </label>
                  <input
                    type="text"
                    value={authorizedSignatory}
                    onChange={(e) => setAuthorizedSignatory(e.target.value)}
                    className="w-full text-sm rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>

                {/* Inline Body Editor */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-slate-500" /> Official Letter Text (Editable)
                    </label>
                    <button
                      type="button"
                      onClick={handleResetToDefaultTemplate}
                      className="text-xs text-amber-700 hover:text-amber-800 font-semibold flex items-center gap-1 hover:underline"
                    >
                      <RotateCcw className="w-3 h-3" /> Reset Template
                    </button>
                  </div>
                  <textarea
                    rows={8}
                    value={customBody}
                    onChange={(e) => {
                      setCustomBody(e.target.value);
                      setIsEditingBody(true);
                    }}
                    className="w-full text-xs font-sans rounded-xl border border-slate-300 p-3 leading-relaxed focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                {/* Primary Action Buttons */}
                <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                  <button
                    onClick={handleSaveDocument}
                    disabled={loading}
                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Save & Record in School ERP
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleDownloadPDF}
                      disabled={downloading}
                      className="py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Download className="w-4 h-4" /> Download PDF
                    </button>
                    <button
                      onClick={handlePrint}
                      className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5 border border-slate-200"
                    >
                      <Printer className="w-4 h-4" /> Print Document
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={handleDownloadBlankTemplatePDF}
                      disabled={downloading}
                      className="py-2 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl font-medium text-xs transition-all flex items-center justify-center gap-1 border border-dashed border-slate-300"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" /> Blank Template PDF
                    </button>
                    <button
                      onClick={() => {
                        if (blankDocRef.current) {
                          printElement(blankDocRef.current, `Blank_${activeTab}`);
                        } else {
                          window.print();
                        }
                      }}
                      className="py-2 px-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl font-medium text-xs transition-all flex items-center justify-center gap-1 border border-dashed border-slate-300"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500" /> Print Blank
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Live A4 Document Preview (7 Columns) */}
            <div className="lg:col-span-7">
              <div className="sticky top-6">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-amber-600" /> Live A4 Document Preview
                  </span>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                    Ref: {activeConfig.prefix}-{new Date().getFullYear()}-XXXX
                  </span>
                </div>

                {/* Printable A4 Container */}
                <div
                  ref={documentRef}
                  id="printable-document"
                  className="bg-white border border-slate-300 rounded-2xl p-8 sm:p-10 shadow-lg text-slate-900 mx-auto max-w-2xl min-h-[750px] flex flex-col justify-between"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  <div>
                    {/* Official Letterhead Header */}
                    <div className="border-b-2 border-slate-900 pb-4 mb-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="w-16 h-16 rounded-xl border border-slate-300 p-1 bg-white shrink-0 overflow-hidden shadow-sm">
                          <img
                            src={logoSrc}
                            alt="School Logo"
                            className="w-full h-full object-cover rounded-lg"
                          />
                        </div>
                        <div className="text-center flex-1">
                          <h2 className="text-xl sm:text-2xl font-black text-slate-950 uppercase tracking-tight">
                            {schoolProfile.schoolName}
                          </h2>
                          <p className="text-xs font-bold text-slate-600 mt-1">
                            Affiliated with {schoolProfile.board} · {schoolProfile.campusAddress}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                            Ph: {schoolProfile.phone} · Email: {schoolProfile.email}
                          </p>
                        </div>
                        <div className="w-16 h-16 rounded-xl border border-slate-300 p-1 bg-white shrink-0 overflow-hidden shadow-sm">
                          <img
                            src={stampSrc}
                            alt="School Seal"
                            className="w-full h-full object-cover rounded-lg"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Metadata Header Row */}
                    <div className="flex items-center justify-between text-xs font-mono border-b border-slate-200 pb-3 mb-6 text-slate-600">
                      <div>
                        <span className="font-bold text-slate-900">REF NO:</span>{' '}
                        {activeConfig.prefix}-{new Date().getFullYear()}-
                        {String(letters.length + 1).padStart(4, '0')}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900">DATE:</span>{' '}
                        {formatDate(issueDate)}
                      </div>
                    </div>

                    {/* Document Title Banner */}
                    <div className="text-center mb-6">
                      <div className="inline-block px-6 py-2 rounded-xl bg-slate-900 text-white font-black text-sm tracking-wide uppercase shadow-sm">
                        {activeConfig.title}
                      </div>
                      <div className="text-xs font-bold text-slate-700 mt-2 uppercase tracking-wider underline">
                        SUBJECT: {subjectTitle}
                      </div>
                    </div>

                    {/* Employee Profile Strip */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-6 text-xs grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">Employee Name</span>
                        <span className="font-bold text-slate-900">{activeStaffName}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">Father's Name</span>
                        <span className="font-bold text-slate-900">{activeFatherName}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">Staff ID Number</span>
                        <span className="font-bold font-mono text-slate-900">{activeStaffIdNumber}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">Designation</span>
                        <span className="font-bold text-slate-900">{activeDesignation}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">Department</span>
                        <span className="font-bold text-slate-900">{activeDepartment}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">CNIC Number</span>
                        <span className="font-bold font-mono text-slate-900">{activeCnic}</span>
                      </div>
                    </div>

                    {/* Body Text */}
                    <div className="text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line text-justify px-1">
                      {customBody}
                    </div>
                  </div>

                  {/* Signatures & Stamp Footer */}
                  <div className="mt-12 pt-8 border-t border-slate-200">
                    <div className="grid grid-cols-3 items-end text-center">
                      <div className="space-y-1">
                        <div className="w-32 border-b border-slate-400 mx-auto mb-1"></div>
                        <p className="text-[11px] font-bold text-slate-700">Official Stamp</p>
                        <p className="text-[10px] text-slate-400">Siqarah High School</p>
                      </div>

                      <div className="space-y-1">
                        <div className="w-32 border-b border-slate-400 mx-auto mb-1"></div>
                        <p className="text-[11px] font-bold text-slate-700">Employee Signature</p>
                        <p className="text-[10px] text-slate-400">{activeStaffName}</p>
                      </div>

                      <div className="space-y-1">
                        <div className="w-32 border-b border-slate-900 mx-auto mb-1"></div>
                        <p className="text-[11px] font-bold text-slate-900">{authorizedSignatory}</p>
                        <p className="text-[10px] text-slate-500">Principal & Director</p>
                      </div>
                    </div>
                    <div className="text-center text-[10px] text-slate-400 mt-6 font-mono">
                      Official Document issued under seal of Siqarah Public Model High School Shorkot.
                    </div>
                  </div>
                </div>

                {/* OFF-SCREEN BLANK TEMPLATE CONTAINER FOR PRINT / PDF */}
                <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', width: '800px', pointerEvents: 'none', zIndex: -1 }}>
                  <div
                    ref={blankDocRef}
                    className="bg-white p-10 text-slate-900 min-h-[950px] flex flex-col justify-between"
                  >
                    <div>
                      <div className="border-b-2 border-slate-900 pb-4 mb-6">
                        <div className="flex items-start justify-between">
                          <img src={logoSrc} alt="" className="w-16 h-16 object-cover" />
                          <div className="text-center flex-1">
                            <h2 className="text-2xl font-black uppercase">{schoolProfile.schoolName}</h2>
                            <p className="text-xs font-bold text-slate-600 mt-1">{schoolProfile.board} · {schoolProfile.campusAddress}</p>
                          </div>
                          <img src={stampSrc} alt="" className="w-16 h-16 object-cover" />
                        </div>
                      </div>

                      <div className="flex justify-between text-xs font-mono border-b pb-2 mb-6">
                        <div>REF NO: {activeConfig.prefix}-____-______</div>
                        <div>DATE: ____ / ____ / 2026</div>
                      </div>

                      <div className="text-center mb-6">
                        <div className="inline-block px-6 py-2 bg-slate-900 text-white font-bold uppercase text-sm">
                          BLANK {activeConfig.title} TEMPLATE
                        </div>
                      </div>

                      <div className="border p-4 rounded mb-6 text-xs space-y-3">
                        <div className="flex gap-4">
                          <span className="font-bold">Staff Name:</span> __________________________________________________
                        </div>
                        <div className="flex gap-4">
                          <span className="font-bold">Father's Name:</span> __________________________________________________
                        </div>
                        <div className="flex gap-4">
                          <span className="font-bold">Designation:</span> __________________________ <span className="font-bold">Dept:</span> ____________________
                        </div>
                        <div className="flex gap-4">
                          <span className="font-bold">Staff ID:</span> __________________________ <span className="font-bold">CNIC:</span> ____________________
                        </div>
                      </div>

                      <div className="space-y-4 text-xs">
                        <p className="font-bold">STATEMENT / ORDER DETAILS:</p>
                        <div className="border-b border-dashed border-slate-400 h-6"></div>
                        <div className="border-b border-dashed border-slate-400 h-6"></div>
                        <div className="border-b border-dashed border-slate-400 h-6"></div>
                        <div className="border-b border-dashed border-slate-400 h-6"></div>
                        <div className="border-b border-dashed border-slate-400 h-6"></div>
                        <div className="border-b border-dashed border-slate-400 h-6"></div>
                        <div className="border-b border-dashed border-slate-400 h-6"></div>
                      </div>
                    </div>

                    <div className="border-t pt-8 grid grid-cols-3 text-center text-xs">
                      <div>________________________<br />School Stamp</div>
                      <div>________________________<br />Employee Signature</div>
                      <div>________________________<br />Dr. Saeed Ahmad (Principal)</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIST MODE (ISSUED DOCUMENTS REPOSITORY) */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search staff name or ref..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 pl-9 pr-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-xs rounded-xl border border-slate-300 px-3 py-2.5 focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white font-medium"
              >
                <option value="ALL">All Document Types</option>
                {DOCUMENT_TYPES.map((d) => (
                  <option key={d.type} value={d.type}>
                    {d.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4">Ref Number</th>
                    <th className="py-3.5 px-4">Document Type</th>
                    <th className="py-3.5 px-4">Staff Member</th>
                    <th className="py-3.5 px-4">Designation</th>
                    <th className="py-3.5 px-4">Issue Date</th>
                    <th className="py-3.5 px-4">Signatory</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLetters.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-400">
                        No issued HR documents found.
                      </td>
                    </tr>
                  ) : (
                    filteredLetters.map((l) => {
                      const cfg = DOCUMENT_TYPES.find((d) => d.type === l.letterType);
                      return (
                        <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            {l.letterNumber}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                cfg?.badgeColor || 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {cfg?.title || l.letterType}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{l.staffName}</div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {l.staffIdNumber}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-700">
                            {l.designation}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 font-mono">
                            {formatDate(l.issueDate)}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {l.authorizedSignatory}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setViewingLetter(l)}
                                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
                                title="View Document"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {canDelete && (
                                <button
                                  onClick={() => setDeleteTarget(l)}
                                  className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-all"
                                  title="Delete Document"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODAL */}
      {viewingLetter && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {viewingLetter.letterType} · {viewingLetter.letterNumber}
                </h3>
                <p className="text-xs text-slate-500">{viewingLetter.staffName} ({viewingLetter.designation})</p>
              </div>
              <button
                onClick={() => setViewingLetter(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-xl px-2"
              >
                ×
              </button>
            </div>

            <div className="bg-slate-50 border rounded-xl p-4 text-xs font-sans leading-relaxed whitespace-pre-line max-h-96 overflow-y-auto">
              {viewingLetter.contentBody}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setViewingLetter(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Delete HR Document?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to move Document <span className="font-bold text-slate-800">{deleteTarget.letterNumber}</span> for <span className="font-bold text-slate-800">{deleteTarget.staffName}</span> to the Recycle Bin?
              </p>
              <p className="text-[11px] text-amber-600 mt-2 bg-amber-50 p-2 rounded-lg border border-amber-200">
                Safe Recovery: This document can be restored at any time from the Recycle Bin.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700 shadow-sm"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
