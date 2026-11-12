/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Printer,
  History,
  AlertCircle,
  FileSpreadsheet,
  Check,
  RefreshCw,
  Info,
  Download,
  Trash2,
  CreditCard,
  Layers,
  User,
  Settings,
  DollarSign,
  PlusCircle,
  Calculator,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  Eye,
  X,
} from 'lucide-react';
import { FeeVoucher, StudentRecord, SchoolProfile, ClassFeeConfig, UserRole } from '../types/school.ts';
import { formatPKR, formatDate, formatDateTime, numberToWordsPKR } from '../utils/voucherHelpers.ts';
import { StudentSearchSelector, SelectedEnrollmentInfo } from './StudentSearchSelector.tsx';
import { printElement } from '../utils/printHelper.ts';
import { downloadElementAsPDF } from '../utils/pdfExport.ts';

interface FeeManagementProps {
  vouchers: FeeVoucher[];
  students?: StudentRecord[];
  schoolProfile: SchoolProfile;
  userRole?: UserRole;
  loading: boolean;
  onRefresh: () => void;
  onUpdateStatus: (voucherId: string, newStatus: 'UNPAID' | 'PAID', notes?: string) => Promise<void>;
  onOpenVoucherModal: (voucher: FeeVoucher) => void;
  onOpenAuditModal: (voucher: FeeVoucher) => void;
  onDeleteVoucher?: (voucherId: string) => Promise<void>;
}

export const FeeManagement: React.FC<FeeManagementProps> = ({
  vouchers,
  students = [],
  schoolProfile,
  userRole = 'Accountant',
  loading,
  onRefresh,
  onUpdateStatus,
  onOpenVoucherModal,
  onOpenAuditModal,
  onDeleteVoucher,
}) => {
  const [activeMainTab, setActiveMainTab] = useState<'register' | 'bulk_class' | 'individual' | 'config'>('register');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPAID' | 'PAID'>('ALL');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Status correction confirmation modal state
  const [confirmDialog, setConfirmDialog] = useState<{
    voucher: FeeVoucher;
    targetStatus: 'UNPAID' | 'PAID';
    reason: string;
  } | null>(null);

  // Record Payment Modal State
  const [paymentModalVoucher, setPaymentModalVoucher] = useState<FeeVoucher | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('Cash received at school accounts counter');
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);

  // Delete voucher target
  const [deleteVoucherTarget, setDeleteVoucherTarget] = useState<FeeVoucher | null>(null);

  // --- MODULE 6: BULK CLASS VOUCHER GENERATION STATE ---
  const [bulkSession, setBulkSession] = useState<string>(schoolProfile.activeSession || '2024-2025');
  const [bulkClass, setBulkClass] = useState<string>('Class 1');
  const [bulkSection, setBulkSection] = useState<string>('All');
  const [bulkMonth, setBulkMonth] = useState<string>('November 2026');
  const [bulkDueDate, setBulkDueDate] = useState<string>(
    new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [bulkSelectedStudentIds, setBulkSelectedStudentIds] = useState<string[]>([]);
  const [bulkAllowDuplicates, setBulkAllowDuplicates] = useState<boolean>(false);
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);
  const [bulkGenerationResult, setBulkGenerationResult] = useState<{
    generated: FeeVoucher[];
    skipped: string[];
  } | null>(null);

  // Fee Head Inputs for Bulk Class
  const [bulkTuition, setBulkTuition] = useState<number>(1500);
  const [bulkAdmission, setBulkAdmission] = useState<number>(0);
  const [bulkAnnual, setBulkAnnual] = useState<number>(0);
  const [bulkExam, setBulkExam] = useState<number>(0);
  const [bulkOther, setBulkOther] = useState<number>(0);
  const [bulkFine, setBulkFine] = useState<number>(0);
  const [bulkDiscount, setBulkDiscount] = useState<number>(0);

  // --- MODULE 6: INDIVIDUAL STUDENT VOUCHER STATE ---
  const [selectedStudentObj, setSelectedStudentObj] = useState<StudentRecord | null>(null);
  const [indStudentId, setIndStudentId] = useState<string>('');
  const [indManualName, setIndManualName] = useState<string>('');
  const [indManualFather, setIndManualFather] = useState<string>('');
  const [indManualClass, setIndManualClass] = useState<string>('Class 1');
  const [indManualSection, setIndManualSection] = useState<string>('A');
  const [indManualAdmNo, setIndManualAdmNo] = useState<string>('');
  const [indSession, setIndSession] = useState<string>(schoolProfile.activeSession || '2024-2025');
  const [indMonth, setIndMonth] = useState<string>('November 2026');
  const [indIssueDate, setIndIssueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [indDueDate, setIndDueDate] = useState<string>(
    new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [indTuition, setIndTuition] = useState<number>(1500);
  const [indAdmission, setIndAdmission] = useState<number>(0);
  const [indAnnual, setIndAnnual] = useState<number>(0);
  const [indExam, setIndExam] = useState<number>(0);
  const [indOther, setIndOther] = useState<number>(0);
  const [indFine, setIndFine] = useState<number>(0);
  const [indDiscount, setIndDiscount] = useState<number>(0);
  const [indPaidAmount, setIndPaidAmount] = useState<number>(0);
  const [indRemarks, setIndRemarks] = useState<string>('');
  const [indAllowDuplicate, setIndAllowDuplicate] = useState<boolean>(false);
  const [isCreatingIndividual, setIsCreatingIndividual] = useState(false);
  const [createdIndividualVoucher, setCreatedIndividualVoucher] = useState<FeeVoucher | null>(null);

  // --- MODULE 6: CLASS FEE CONFIGURATIONS STATE ---
  const [feeConfigs, setFeeConfigs] = useState<ClassFeeConfig[]>([]);
  const [selectedConfigClass, setSelectedConfigClass] = useState<string>('Class 1');
  const [configTuition, setConfigTuition] = useState<number>(1500);
  const [configAdmission, setConfigAdmission] = useState<number>(2000);
  const [configAnnual, setConfigAnnual] = useState<number>(1000);
  const [configExam, setConfigExam] = useState<number>(500);
  const [configOther, setConfigOther] = useState<number>(200);
  const [configFine, setConfigFine] = useState<number>(100);
  const [configDiscount, setConfigDiscount] = useState<number>(0);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Bulk Print & Preview Refs
  const indPreviewRef = useRef<HTMLDivElement | null>(null);
  const bulkPrintContainerRef = useRef<HTMLDivElement | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const logoSrc = schoolProfile.logoUrl || '/assets/school_logo.jpg';
  const stampSrc = schoolProfile.stampUrl || '/assets/school_stamp.jpg';

  // Fetch Fee Configurations
  const fetchFeeConfigs = async () => {
    try {
      const res = await fetch('/api/fee-configs');
      if (res.ok) {
        const data = await res.json();
        setFeeConfigs(data);
      }
    } catch (err) {
      console.error('Failed to fetch fee configurations:', err);
    }
  };

  useEffect(() => {
    fetchFeeConfigs();
  }, []);

  // Sync selectedConfigClass form
  useEffect(() => {
    const found = feeConfigs.find((c) => c.className === selectedConfigClass);
    if (found) {
      setConfigTuition(found.tuitionFee || 0);
      setConfigAdmission(found.admissionFee || 0);
      setConfigAnnual(found.annualCharges || 0);
      setConfigExam(found.examFee || 0);
      setConfigOther(found.otherCharges || 0);
      setConfigFine(found.defaultFine || 0);
      setConfigDiscount(found.defaultDiscount || 0);
    } else {
      setConfigTuition(1500);
      setConfigAdmission(2000);
      setConfigAnnual(1000);
      setConfigExam(500);
      setConfigOther(200);
      setConfigFine(100);
      setConfigDiscount(0);
    }
  }, [selectedConfigClass, feeConfigs]);

  // Sync Bulk Class fee form when bulkClass changes
  useEffect(() => {
    const found = feeConfigs.find((c) => c.className === bulkClass);
    if (found) {
      setBulkTuition(found.tuitionFee || 1500);
      setBulkAdmission(found.admissionFee || 0);
      setBulkAnnual(found.annualCharges || 0);
      setBulkExam(found.examFee || 0);
      setBulkOther(found.otherCharges || 0);
      setBulkFine(found.defaultFine || 0);
      setBulkDiscount(found.defaultDiscount || 0);
    }
  }, [bulkClass, feeConfigs]);

  // Handle student selection in Individual Voucher
  const handleSelectStudentForIndividual = (student: StudentRecord, enrollment?: SelectedEnrollmentInfo) => {
    setSelectedStudentObj(student);
    setIndStudentId(student.id);
    setIndManualName(student.fullName);
    setIndManualFather(student.fatherName);
    setIndManualClass(enrollment?.studentClass || student.studentClass);
    setIndManualSection(enrollment?.section || student.section || 'A');
    setIndManualAdmNo(student.admissionNumber);
    setIndSession(enrollment?.session || student.session || schoolProfile.activeSession);

    // Auto-load class fee configuration
    const targetClass = enrollment?.studentClass || student.studentClass;
    const found = feeConfigs.find((c) => c.className === targetClass);
    if (found) {
      setIndTuition(found.tuitionFee || 1500);
      setIndAdmission(found.admissionFee || 0);
      setIndAnnual(found.annualCharges || 0);
      setIndExam(found.examFee || 0);
      setIndOther(found.otherCharges || 0);
      setIndFine(found.defaultFine || 0);
      setIndDiscount(found.defaultDiscount || 0);
    } else {
      setIndTuition(1500);
      setIndAdmission(0);
      setIndAnnual(0);
      setIndExam(0);
      setIndOther(0);
      setIndFine(0);
      setIndDiscount(0);
    }
  };

  // Check if a voucher already exists for the selected student and billing month
  const duplicateVoucherWarning = useMemo(() => {
    if (!indStudentId || !indMonth.trim() || !indSession.trim()) return null;
    return vouchers.find(
      (v) =>
        v.studentId === indStudentId &&
        v.billingMonth?.toLowerCase() === indMonth.trim().toLowerCase() &&
        v.session === indSession &&
        !v.isDeleted
    );
  }, [indStudentId, indMonth, indSession, vouchers]);

  // Students eligible for bulk class voucher
  const eligibleBulkStudents = useMemo(() => {
    return students.filter((s) => {
      if (s.isDeleted || s.isPassOut) return false;
      if (s.session !== bulkSession) return false;
      if (s.studentClass !== bulkClass) return false;
      if (bulkSection !== 'All' && s.section !== bulkSection) return false;
      return true;
    });
  }, [students, bulkSession, bulkClass, bulkSection]);

  // Auto select all eligible bulk students
  useEffect(() => {
    setBulkSelectedStudentIds(eligibleBulkStudents.map((s) => s.id));
  }, [eligibleBulkStudents]);

  // Calculations for Bulk
  const bulkSubtotal = bulkTuition + bulkAdmission + bulkAnnual + bulkExam + bulkOther;
  const bulkTotalPayable = Math.max(0, bulkSubtotal + bulkFine - bulkDiscount);

  // Calculations for Individual
  const indSubtotal = indTuition + indAdmission + indAnnual + indExam + indOther;
  const indTotalPayable = Math.max(0, indSubtotal + indFine - indDiscount);
  const indBalanceDue = Math.max(0, indTotalPayable - indPaidAmount);

  // Filter vouchers in Register
  const filteredVouchers = vouchers.filter((v) => {
    if (statusFilter !== 'ALL' && v.status !== statusFilter) return false;
    if (classFilter !== 'ALL' && v.studentClass !== classFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const match =
        v.voucherNumber.toLowerCase().includes(q) ||
        v.studentName.toLowerCase().includes(q) ||
        v.fatherName.toLowerCase().includes(q) ||
        v.admissionNumber.toLowerCase().includes(q) ||
        v.studentClass.toLowerCase().includes(q) ||
        (v.billingMonth && v.billingMonth.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const [voucherCurrentPage, setVoucherCurrentPage] = useState(1);
  const voucherPageSize = 25;

  useEffect(() => {
    setVoucherCurrentPage(1);
  }, [searchTerm, statusFilter, classFilter]);

  const voucherTotalPages = Math.ceil(filteredVouchers.length / voucherPageSize) || 1;
  const paginatedVouchers = filteredVouchers.slice(
    (voucherCurrentPage - 1) * voucherPageSize,
    voucherCurrentPage * voucherPageSize
  );

  const unpaidCount = vouchers.filter((v) => v.status === 'UNPAID').length;
  const paidCount = vouchers.filter((v) => v.status === 'PAID').length;
  const unpaidTotal = vouchers
    .filter((v) => v.status === 'UNPAID')
    .reduce((sum, v) => sum + (v.balanceDue !== undefined ? v.balanceDue : v.feeAmount), 0);
  const paidTotal = vouchers
    .filter((v) => v.status === 'PAID')
    .reduce((sum, v) => sum + v.feeAmount, 0);

  const handleCheckboxClick = (v: FeeVoucher) => {
    if (v.status === 'PAID') {
      setConfirmDialog({
        voucher: v,
        targetStatus: 'UNPAID',
        reason: 'Payment record corrected by administrator',
      });
      return;
    }
    executeStatusChange(v.id, 'PAID', 'Full payment verified and recorded');
  };

  const executeStatusChange = async (voucherId: string, newStatus: 'UNPAID' | 'PAID', reason?: string) => {
    setUpdatingId(voucherId);
    setStatusMessage(null);
    try {
      await onUpdateStatus(voucherId, newStatus, reason);
      setStatusMessage({
        text: `Voucher status successfully marked as ${newStatus}`,
        type: 'success',
      });
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err: any) {
      setStatusMessage({
        text: err.message || 'Failed to update payment status',
        type: 'error',
      });
    } finally {
      setUpdatingId(null);
      setConfirmDialog(null);
    }
  };

  // Open Record Payment Modal
  const handleOpenPaymentModal = (v: FeeVoucher) => {
    setPaymentModalVoucher(v);
    const balance = v.balanceDue !== undefined ? v.balanceDue : (v.status === 'PAID' ? 0 : v.feeAmount);
    setPaymentAmount(balance > 0 ? balance.toString() : v.feeAmount.toString());
    setPaymentNotes('Cash received at school accounts counter');
  };

  const handleConfirmPaymentRecord = async () => {
    if (!paymentModalVoucher) return;
    const amountNum = Number(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setStatusMessage({ text: 'Please enter a valid positive payment amount', type: 'error' });
      return;
    }
    try {
      setIsRecordingPayment(true);
      const res = await fetch(`/api/vouchers/${paymentModalVoucher.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNum,
          notes: paymentNotes,
          adminName: userRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record payment');

      setStatusMessage({
        text: `Payment of Rs. ${amountNum.toLocaleString()} successfully recorded for Voucher #${paymentModalVoucher.voucherNumber}`,
        type: 'success',
      });
      setPaymentModalVoucher(null);
      onRefresh();
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Failed to record payment', type: 'error' });
    } finally {
      setIsRecordingPayment(false);
    }
  };

  // Handle Bulk Generation
  const handleGenerateBulk = async () => {
    if (!bulkSelectedStudentIds.length) {
      setStatusMessage({ text: 'Please select at least one student for bulk generation', type: 'error' });
      return;
    }
    try {
      setIsGeneratingBulk(true);
      const res = await fetch('/api/vouchers/generate-class-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: bulkSession,
          className: bulkClass,
          section: bulkSection === 'All' ? undefined : bulkSection,
          billingMonth: bulkMonth,
          studentIds: bulkSelectedStudentIds,
          dueDate: bulkDueDate,
          tuitionFee: bulkTuition,
          admissionFeeItem: bulkAdmission,
          annualCharges: bulkAnnual,
          examFee: bulkExam,
          otherCharges: bulkOther,
          fine: bulkFine,
          discount: bulkDiscount,
          allowDuplicates: bulkAllowDuplicates,
          remarks: `Bulk fee generated for ${bulkClass} (${bulkMonth})`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate bulk vouchers');

      setBulkGenerationResult({
        generated: data.generated || [],
        skipped: data.skipped || [],
      });

      setStatusMessage({
        text: `Successfully generated ${data.generatedCount} fee voucher(s) for ${bulkClass}! (Skipped ${data.skippedCount || 0} duplicates)`,
        type: 'success',
      });
      onRefresh();
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Bulk generation failed', type: 'error' });
    } finally {
      setIsGeneratingBulk(false);
    }
  };

  // Handle Individual Voucher Generation
  const handleGenerateIndividual = async () => {
    try {
      setIsCreatingIndividual(true);
      setStatusMessage(null);

      const studentName = indManualName.trim() || selectedStudentObj?.fullName || '';
      const fatherName = indManualFather.trim() || selectedStudentObj?.fatherName || '';

      if (!studentName) {
        setStatusMessage({ text: 'Please select an existing student or enter student full name', type: 'error' });
        setIsCreatingIndividual(false);
        return;
      }

      const payload = {
        studentId: indStudentId || undefined,
        studentName,
        fatherName: fatherName || 'Guardian',
        studentClass: indManualClass,
        section: indManualSection,
        admissionNumber: indManualAdmNo || selectedStudentObj?.admissionNumber || `MAN-${Date.now().toString().slice(-4)}`,
        rollNumber: selectedStudentObj?.rollNumber || '',
        session: indSession,
        billingMonth: indMonth,
        dueDate: indDueDate,
        tuitionFee: indTuition,
        admissionFeeItem: indAdmission,
        annualCharges: indAnnual,
        examFee: indExam,
        otherCharges: indOther,
        fine: indFine,
        discount: indDiscount,
        notes: indRemarks,
        allowDuplicate: indAllowDuplicate,
        isManualStudent: !indStudentId,
      };

      const res = await fetch('/api/vouchers/individual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create individual voucher');

      setCreatedIndividualVoucher(data.voucher);
      setStatusMessage({
        text: `Individual Fee Voucher #${data.voucher.voucherNumber} created successfully! You can now print or download the official PDF.`,
        type: 'success',
      });
      onRefresh();
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Voucher creation failed', type: 'error' });
    } finally {
      setIsCreatingIndividual(false);
    }
  };

  // Save Class Fee Config
  const handleSaveFeeConfig = async () => {
    try {
      setIsSavingConfig(true);
      const res = await fetch('/api/fee-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          className: selectedConfigClass,
          session: schoolProfile.activeSession,
          tuitionFee: configTuition,
          admissionFee: configAdmission,
          annualCharges: configAnnual,
          examFee: configExam,
          otherCharges: configOther,
          defaultFine: configFine,
          defaultDiscount: configDiscount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save configuration');

      setStatusMessage({
        text: `Fee structure for ${selectedConfigClass} saved successfully!`,
        type: 'success',
      });
      fetchFeeConfigs();
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Failed to save config', type: 'error' });
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Helper to render an individual 3-slip voucher
  const render3CopyVoucher = (
    voucherData: {
      voucherNumber: string;
      studentName: string;
      fatherName: string;
      studentClass: string;
      section: string;
      admissionNumber: string;
      rollNumber?: string;
      session: string;
      billingMonth: string;
      issueDate: string;
      dueDate: string;
      tuition: number;
      admission: number;
      annual: number;
      exam: number;
      other: number;
      fine: number;
      discount: number;
      totalPayable: number;
      balanceDue: number;
      status: string;
    },
    containerRef?: React.RefObject<HTMLDivElement | null>
  ) => {
    const slips = [
      { title: 'Bank / Cash Counter Copy', note: 'To be retained by bank or school cash accounts counter' },
      { title: 'School Office Copy', note: 'To be retained by school office admission & record section' },
      { title: 'Student / Parent Copy', note: 'To be kept safely by parent/student as proof of fee deposit' },
    ];

    return (
      <div
        ref={containerRef as any}
        id="printable-voucher"
        className="printable-area bg-white p-4 sm:p-6 rounded-xl border border-slate-300 shadow-md space-y-4 max-w-4xl mx-auto text-slate-900"
      >
        {slips.map((slip, idx) => (
          <div
            key={idx}
            className={`p-3.5 bg-white border border-slate-300 rounded-lg text-xs leading-normal ${
              idx < slips.length - 1 ? 'border-b-2 border-dashed border-b-slate-400 pb-4 mb-4' : ''
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-2 border-slate-200">
              <div className="flex items-center gap-2.5">
                <img
                  src={logoSrc}
                  alt="School Logo"
                  className="w-10 h-10 object-contain shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-xs sm:text-sm font-black uppercase text-slate-950">
                      {schoolProfile.schoolName}
                    </h2>
                  </div>
                  <p className="text-[9px] text-slate-600 font-medium">
                    Affiliated: {schoolProfile.board} · Principal: <strong>{schoolProfile.principal}</strong>
                  </p>
                  <p className="text-[8px] text-slate-500">{schoolProfile.campusAddress}</p>
                </div>
              </div>

              <div className="text-right flex flex-col items-end">
                <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-900 text-white px-2 py-0.5 rounded">
                  {slip.title}
                </span>
                <span className="text-[10px] font-bold text-amber-700 mt-0.5 uppercase">
                  {voucherData.billingMonth} Fee Voucher
                </span>
                <span className="text-[11px] font-mono font-bold text-slate-900">
                  {voucherData.voucherNumber}
                </span>
              </div>
            </div>

            {/* Student & Billing Meta Grid */}
            <div className="grid grid-cols-4 gap-2 py-1.5 px-2 bg-slate-50 border-y border-slate-200 text-[10px] my-2">
              <div>
                <span className="text-slate-500 block">Student:</span>
                <strong className="text-slate-900 text-[11px]">{voucherData.studentName}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Father's Name:</span>
                <strong className="text-slate-900">{voucherData.fatherName}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Class & Sec:</span>
                <strong className="text-slate-900">
                  {voucherData.studentClass} ({voucherData.section}) · Roll #{voucherData.rollNumber || '—'}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Admission #:</span>
                <strong className="font-mono text-slate-900">{voucherData.admissionNumber}</strong>
              </div>

              <div>
                <span className="text-slate-500 block">Session:</span>
                <strong className="text-slate-900">{voucherData.session}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Issue Date:</span>
                <strong className="text-slate-900 font-mono">{voucherData.issueDate}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Due Date:</span>
                <strong className="text-amber-700 font-mono font-bold">{voucherData.dueDate}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Status:</span>
                <span
                  className={`px-1.5 py-0.2 rounded font-bold text-[9px] uppercase ${
                    voucherData.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {voucherData.status}
                </span>
              </div>
            </div>

            {/* Fee Items Table */}
            <div className="border border-slate-200 rounded overflow-hidden mb-2">
              <table className="w-full text-left text-[10px]">
                <thead className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700 uppercase">
                  <tr>
                    <th className="py-1 px-2">Sr #</th>
                    <th className="py-1 px-2">Fee Head / Description</th>
                    <th className="py-1 px-2 text-right">Amount (PKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-1 px-2 text-slate-500 font-mono">1</td>
                    <td className="py-1 px-2 font-medium">Monthly Tuition Fee ({voucherData.billingMonth})</td>
                    <td className="py-1 px-2 text-right font-mono">Rs. {voucherData.tuition.toLocaleString()}</td>
                  </tr>
                  {voucherData.admission > 0 && (
                    <tr>
                      <td className="py-1 px-2 text-slate-500 font-mono">2</td>
                      <td className="py-1 px-2">Admission & Registration Charges</td>
                      <td className="py-1 px-2 text-right font-mono">Rs. {voucherData.admission.toLocaleString()}</td>
                    </tr>
                  )}
                  {voucherData.annual > 0 && (
                    <tr>
                      <td className="py-1 px-2 text-slate-500 font-mono">3</td>
                      <td className="py-1 px-2">Annual Fund & Laboratory Maintenance</td>
                      <td className="py-1 px-2 text-right font-mono">Rs. {voucherData.annual.toLocaleString()}</td>
                    </tr>
                  )}
                  {voucherData.exam > 0 && (
                    <tr>
                      <td className="py-1 px-2 text-slate-500 font-mono">4</td>
                      <td className="py-1 px-2">Examination & Stationery Assessment Fee</td>
                      <td className="py-1 px-2 text-right font-mono">Rs. {voucherData.exam.toLocaleString()}</td>
                    </tr>
                  )}
                  {voucherData.other > 0 && (
                    <tr>
                      <td className="py-1 px-2 text-slate-500 font-mono">5</td>
                      <td className="py-1 px-2">Other Miscellaneous / Co-curricular Charges</td>
                      <td className="py-1 px-2 text-right font-mono">Rs. {voucherData.other.toLocaleString()}</td>
                    </tr>
                  )}
                  {voucherData.fine > 0 && (
                    <tr className="text-amber-800">
                      <td className="py-1 px-2 font-mono">6</td>
                      <td className="py-1 px-2">Late Fee Fine / Penalty</td>
                      <td className="py-1 px-2 text-right font-mono">+ Rs. {voucherData.fine.toLocaleString()}</td>
                    </tr>
                  )}
                  {voucherData.discount > 0 && (
                    <tr className="text-emerald-700">
                      <td className="py-1 px-2 font-mono">7</td>
                      <td className="py-1 px-2">Fee Concession / Sibling Discount</td>
                      <td className="py-1 px-2 text-right font-mono">- Rs. {voucherData.discount.toLocaleString()}</td>
                    </tr>
                  )}
                  <tr className="bg-slate-50 font-bold border-t border-slate-300">
                    <td colSpan={2} className="py-1.5 px-2 text-slate-900 uppercase">
                      Total Payable Within Due Date:
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-emerald-800 text-[11px]">
                      Rs. {voucherData.totalPayable.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Amount in words & Footer */}
            <div className="flex items-center justify-between text-[9px] text-slate-600 mb-2">
              <div>
                Amount in Words: <strong>{numberToWordsPKR(voucherData.totalPayable)}</strong>
              </div>
              <div className="font-mono">
                Balance Due: <strong className="text-slate-900">Rs. {voucherData.balanceDue.toLocaleString()}</strong>
              </div>
            </div>

            {/* Signatures & Seal */}
            <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-200 text-center text-[8px] text-slate-500">
              <div>
                <p className="border-b border-slate-400 pb-3 mb-0.5"></p>
                <p>Authorized Cashier / Bank Officer</p>
              </div>
              <div className="flex flex-col items-center justify-end">
                <span className="text-[7px] text-slate-400">School Stamp / Seal</span>
              </div>
              <div>
                <p className="border-b border-slate-400 pb-3 mb-0.5"></p>
                <p>Principal: <strong>{schoolProfile.principal}</strong></p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header and Summary Strip */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Accounts & Fee Desk</span>
            <span>·</span>
            <span>{schoolProfile.schoolName}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Fee Vouchers & Accounts Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Class-wise bulk generation, individual student vouchers, auto-calculation, partial payments, and PDF/Print.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Refresh database records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Module Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <button
          onClick={() => setActiveMainTab('register')}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeMainTab === 'register'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>1. Fee Register & Payment Desk ({vouchers.length})</span>
        </button>

        <button
          onClick={() => setActiveMainTab('bulk_class')}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeMainTab === 'bulk_class'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>2. Generate Class Fee Vouchers (Bulk)</span>
        </button>

        <button
          onClick={() => setActiveMainTab('individual')}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeMainTab === 'individual'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <User className="w-4 h-4" />
          <span>3. Individual Student Fee Voucher</span>
        </button>

        <button
          onClick={() => setActiveMainTab('config')}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeMainTab === 'config'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>4. Class Fee Structure Configuration</span>
        </button>
      </div>

      {/* Notification Toast */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs sm:text-sm font-medium ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer text-base font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: FEE REGISTER & PAYMENT COLLECTION */}
      {/* ========================================================================= */}
      {activeMainTab === 'register' && (
        <div className="space-y-6">
          {/* Financial Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">All Fee Vouchers</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-extrabold text-slate-900 font-tabular">{vouchers.length}</span>
                <span className="text-xs font-bold text-slate-600 font-tabular">
                  {formatPKR(unpaidTotal + paidTotal)}
                </span>
              </div>
            </div>

            <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Unpaid / Balance Due</span>
                <span className="text-xs font-bold bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-tabular">
                  {unpaidCount}
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-extrabold text-amber-900 font-tabular">{formatPKR(unpaidTotal)}</span>
                <span className="text-xs text-amber-700">Awaiting collection</span>
              </div>
            </div>

            <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Paid / Verified Fees</span>
                <span className="text-xs font-bold bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded font-tabular">
                  {paidCount}
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-extrabold text-emerald-900 font-tabular">{formatPKR(paidTotal)}</span>
                <span className="text-xs text-emerald-700">Collected in accounts</span>
              </div>
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by student name, father name, voucher #, adm # or billing month..."
                  className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-400/50"
                />
              </div>

              {/* Status Tabs */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({vouchers.length})
                </button>
                <button
                  onClick={() => setStatusFilter('UNPAID')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    statusFilter === 'UNPAID'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-amber-700 hover:text-amber-900'
                  }`}
                >
                  Unpaid ({unpaidCount})
                </button>
                <button
                  onClick={() => setStatusFilter('PAID')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    statusFilter === 'PAID'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-emerald-700 hover:text-emerald-900'
                  }`}
                >
                  Paid ({paidCount})
                </button>
              </div>

              {/* Class Filter */}
              <div className="shrink-0">
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 text-xs sm:text-sm rounded-lg border border-slate-300 bg-white text-slate-700 font-medium cursor-pointer"
                >
                  <option value="ALL">All Classes</option>
                  {(schoolProfile.availableClasses || []).map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Vouchers Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-semibold tracking-wider">
                  <tr>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Voucher #</th>
                    <th className="py-3 px-4">Student & Parent</th>
                    <th className="py-3 px-4">Class & Month</th>
                    <th className="py-3 px-4 text-right">Total Payable</th>
                    <th className="py-3 px-4 text-right">Balance Due</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredVouchers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                        No fee vouchers found matching the active criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedVouchers.map((v) => {
                      const isPaid = v.status === 'PAID';
                      const balance = v.balanceDue !== undefined ? v.balanceDue : (isPaid ? 0 : v.feeAmount);
                      return (
                        <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleCheckboxClick(v)}
                              disabled={updatingId === v.id}
                              className={`p-1 rounded cursor-pointer transition-colors ${
                                isPaid
                                  ? 'text-emerald-600 hover:text-emerald-700'
                                  : 'text-amber-500 hover:text-amber-600'
                              }`}
                              title={isPaid ? 'Click to correct / mark UNPAID' : 'Click to quick-mark PAID'}
                            >
                              {isPaid ? (
                                <CheckCircle2 className="w-5 h-5 fill-emerald-100" />
                              ) : (
                                <Clock className="w-5 h-5 text-amber-500" />
                              )}
                            </button>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 text-xs">
                            {v.voucherNumber}
                            {v.isManualStudent && (
                              <span className="block text-[9px] text-amber-600 font-sans font-normal">Manual</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">{v.studentName}</div>
                            <div className="text-[11px] text-slate-500">
                              S/O {v.fatherName} · Adm #{v.admissionNumber}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-800">
                              {v.studentClass} {v.section ? `(${v.section})` : ''}
                            </div>
                            <div className="text-[11px] text-slate-500 font-sans">
                              {v.billingMonth || 'Admission Fee'} · {v.session}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                            Rs. {(v.totalPayable || v.feeAmount).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold">
                            {balance <= 0 ? (
                              <span className="text-emerald-600">Cleared</span>
                            ) : (
                              <span className="text-amber-700">Rs. {balance.toLocaleString()}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600 text-xs font-mono">
                            {v.dueDate || formatDate(v.issueDate)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {balance > 0 && (
                                <button
                                  onClick={() => handleOpenPaymentModal(v)}
                                  className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-bold border border-emerald-200 cursor-pointer"
                                  title="Record Payment"
                                >
                                  Pay
                                </button>
                              )}

                              <button
                                onClick={() => onOpenVoucherModal(v)}
                                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                title="Print / Download Official Voucher"
                              >
                                <Printer className="w-4 h-4 text-slate-500" />
                              </button>

                              <button
                                onClick={() => onOpenAuditModal(v)}
                                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                title="Audit Timeline"
                              >
                                <History className="w-4 h-4 text-slate-500" />
                              </button>

                              {onDeleteVoucher && (
                                <button
                                  onClick={() => setDeleteVoucherTarget(v)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                  title="Delete Voucher"
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

            {/* Pagination Controls */}
            {voucherTotalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-slate-200 text-xs text-slate-600 bg-slate-50/50">
                <div>
                  Showing <span className="font-bold text-slate-900">{(voucherCurrentPage - 1) * voucherPageSize + 1}</span> to{' '}
                  <span className="font-bold text-slate-900">
                    {Math.min(voucherCurrentPage * voucherPageSize, filteredVouchers.length)}
                  </span>{' '}
                  of <span className="font-bold text-slate-900">{filteredVouchers.length}</span> fee vouchers
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={voucherCurrentPage <= 1}
                    onClick={() => setVoucherCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white font-medium transition-colors"
                  >
                    Previous
                  </button>
                  <span className="font-semibold text-slate-800 px-2 font-mono">
                    Page {voucherCurrentPage} of {voucherTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={voucherCurrentPage >= voucherTotalPages}
                    onClick={() => setVoucherCurrentPage((p) => Math.min(voucherTotalPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white font-medium transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: GENERATE CLASS FEE VOUCHERS (BULK) */}
      {/* ========================================================================= */}
      {activeMainTab === 'bulk_class' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-500" />
                  <span>Class Selection & Eligible Students List</span>
                </h2>
                <span className="text-xs text-slate-500">
                  {eligibleBulkStudents.length} student(s) enrolled in this class
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Session</label>
                  <select
                    value={bulkSession}
                    onChange={(e) => setBulkSession(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                  >
                    {(schoolProfile.academicSessions || ['2024-2025', '2025-2026', '2026-2027']).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Class</label>
                  <select
                    value={bulkClass}
                    onChange={(e) => setBulkClass(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold"
                  >
                    {(schoolProfile.availableClasses || []).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Section</label>
                  <select
                    value={bulkSection}
                    onChange={(e) => setBulkSection(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                  >
                    <option value="All">All Sections</option>
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                    <option value="D">Section D</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Billing Month</label>
                  <input
                    type="text"
                    value={bulkMonth}
                    onChange={(e) => setBulkMonth(e.target.value)}
                    placeholder="e.g. November 2026"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                  />
                </div>
              </div>

              {/* Student Checkbox selection */}
              <div className="flex items-center justify-between py-2 border-b border-slate-200">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={
                      eligibleBulkStudents.length > 0 &&
                      bulkSelectedStudentIds.length === eligibleBulkStudents.length
                    }
                    onChange={() => {
                      if (bulkSelectedStudentIds.length === eligibleBulkStudents.length) {
                        setBulkSelectedStudentIds([]);
                      } else {
                        setBulkSelectedStudentIds(eligibleBulkStudents.map((s) => s.id));
                      }
                    }}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <span>Select All Students ({eligibleBulkStudents.length} enrolled)</span>
                </label>
                <span className="text-xs text-slate-500">
                  Selected: <strong className="text-amber-600 font-bold">{bulkSelectedStudentIds.length}</strong>
                </span>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {eligibleBulkStudents.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No active students found in {bulkClass} ({bulkSession}).
                  </div>
                ) : (
                  eligibleBulkStudents.map((s) => {
                    const isChecked = bulkSelectedStudentIds.includes(s.id);
                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          setBulkSelectedStudentIds((prev) =>
                            prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                          );
                        }}
                        className={`flex items-center justify-between p-2.5 text-xs cursor-pointer ${
                          isChecked ? 'bg-amber-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                          />
                          <div>
                            <span className="font-semibold text-slate-900">{s.fullName}</span>
                            <span className="text-[11px] text-slate-500 block">
                              S/O {s.fatherName} · Adm #{s.admissionNumber} {s.permanentStudentId ? `· ID: ${s.permanentStudentId}` : ''}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            Roll #{s.rollNumber || '—'}
                          </span>
                          <span className="ml-2 text-slate-500 text-[11px]">Sec {s.section || 'A'}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bulk Generation Result Display */}
              {bulkGenerationResult && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900">
                      Batch Processing Report: {bulkGenerationResult.generated.length} Created · {bulkGenerationResult.skipped.length} Skipped
                    </span>
                    <button
                      onClick={() => setBulkGenerationResult(null)}
                      className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>

                  {bulkGenerationResult.skipped.length > 0 && (
                    <div className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded border border-amber-200 space-y-1">
                      <p className="font-bold">Skipped Students (Duplicates prevented):</p>
                      <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                        {bulkGenerationResult.skipped.map((msg, i) => (
                          <li key={i}>{msg}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {bulkGenerationResult.generated.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <button
                        onClick={async () => {
                          if (bulkPrintContainerRef.current) {
                            await downloadElementAsPDF(
                              bulkPrintContainerRef.current,
                              `Bulk_Fee_Vouchers_${bulkClass}_${bulkMonth.replace(/\s+/g, '_')}.pdf`,
                              { orientation: 'portrait' }
                            );
                          }
                        }}
                        className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download All ({bulkGenerationResult.generated.length}) PDF</span>
                      </button>
                      <button
                        onClick={() => {
                          if (bulkPrintContainerRef.current) {
                            printElement(bulkPrintContainerRef.current, `Bulk_Vouchers_${bulkClass}`);
                          }
                        }}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Printer className="w-3.5 h-3.5 text-amber-400" />
                        <span>Print All ({bulkGenerationResult.generated.length}) Vouchers</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Fee Structure & Calculations */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-600" />
                <span>Fee Breakdown & Automatic Calculator</span>
              </h2>

              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                    Monthly Tuition Fee (Rs.)
                  </label>
                  <input
                    type="number"
                    value={bulkTuition}
                    onChange={(e) => setBulkTuition(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                    Admission Fee / Registration (Rs.)
                  </label>
                  <input
                    type="number"
                    value={bulkAdmission}
                    onChange={(e) => setBulkAdmission(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                    Annual Charges / Fund (Rs.)
                  </label>
                  <input
                    type="number"
                    value={bulkAnnual}
                    onChange={(e) => setBulkAnnual(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                    Examination Fee (Rs.)
                  </label>
                  <input
                    type="number"
                    value={bulkExam}
                    onChange={(e) => setBulkExam(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                    Other / Misc Charges (Rs.)
                  </label>
                  <input
                    type="number"
                    value={bulkOther}
                    onChange={(e) => setBulkOther(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      Late Fine (Rs.)
                    </label>
                    <input
                      type="number"
                      value={bulkFine}
                      onChange={(e) => setBulkFine(Number(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      Discount / Concession (Rs.)
                    </label>
                    <input
                      type="number"
                      value={bulkDiscount}
                      onChange={(e) => setBulkDiscount(Number(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    value={bulkDueDate}
                    onChange={(e) => setBulkDueDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 font-mono"
                  />
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bulkAllowDuplicates}
                      onChange={(e) => setBulkAllowDuplicates(e.target.checked)}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span>Allow duplicate generation if voucher already exists</span>
                  </label>
                </div>
              </div>

              {/* Live Calculations Summary Box */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal (Base Items):</span>
                  <span className="font-mono font-semibold">Rs. {bulkSubtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Fine (+) / Concession (-):</span>
                  <span className="font-mono">Rs. {(bulkFine - bulkDiscount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-1">
                  <span>Total Payable Per Student:</span>
                  <span className="font-mono text-emerald-700">Rs. {bulkTotalPayable.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                  <span>Batch Aggregate ({bulkSelectedStudentIds.length} students):</span>
                  <span className="font-mono font-bold text-slate-800">
                    Rs. {(bulkTotalPayable * bulkSelectedStudentIds.length).toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                onClick={handleGenerateBulk}
                disabled={bulkSelectedStudentIds.length === 0 || isGeneratingBulk}
                className={`w-full py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  bulkSelectedStudentIds.length === 0 || isGeneratingBulk
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-amber-600 text-white hover:bg-amber-700 shadow-xs'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>
                  {isGeneratingBulk
                    ? 'Processing...'
                    : `Generate (${bulkSelectedStudentIds.length}) Class Vouchers`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Container for Bulk Printing */}
      {bulkGenerationResult && bulkGenerationResult.generated.length > 0 && (
        <div style={{ position: 'fixed', left: '-9999px', top: '-9999px' }}>
          <div ref={bulkPrintContainerRef} className="space-y-8 p-4 bg-white">
            {bulkGenerationResult.generated.map((voucher) => (
              <div key={voucher.id} className="page-break-after">
                {render3CopyVoucher({
                  voucherNumber: voucher.voucherNumber,
                  studentName: voucher.studentName,
                  fatherName: voucher.fatherName,
                  studentClass: voucher.studentClass,
                  section: voucher.section || 'A',
                  admissionNumber: voucher.admissionNumber,
                  rollNumber: voucher.rollNumber,
                  session: voucher.session,
                  billingMonth: voucher.billingMonth || bulkMonth,
                  issueDate: voucher.issueDate,
                  dueDate: voucher.dueDate,
                  tuition: voucher.tuitionFee || 0,
                  admission: voucher.admissionFeeItem || 0,
                  annual: voucher.annualCharges || 0,
                  exam: voucher.examFee || 0,
                  other: voucher.otherCharges || 0,
                  fine: voucher.fine || 0,
                  discount: voucher.discount || 0,
                  totalPayable: voucher.totalPayable || voucher.feeAmount,
                  balanceDue: voucher.balanceDue !== undefined ? voucher.balanceDue : voucher.feeAmount,
                  status: voucher.status,
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: INDIVIDUAL STUDENT FEE VOUCHER */}
      {/* ========================================================================= */}
      {activeMainTab === 'individual' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Global Student Search & Basic Information */}
            <div className="lg:col-span-6 bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Search className="w-4 h-4 text-amber-500" />
                <span>Step 1: Global Student Search & Details</span>
              </h2>

              {/* Reusable Global Student Search Selector */}
              <StudentSearchSelector
                label="Search Student from Database"
                placeholder="Search by full name, Permanent ID (SPHS-...), Roll #, Father Name, Mobile..."
                selectedStudent={selectedStudentObj}
                includeHistorySelection={true}
                onSelectStudent={handleSelectStudentForIndividual}
                onClear={() => {
                  setSelectedStudentObj(null);
                  setIndStudentId('');
                  setIndManualName('');
                  setIndManualFather('');
                  setIndManualAdmNo('');
                }}
              />

              {/* Duplicate Voucher Warning Alert */}
              {duplicateVoucherWarning && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Existing Voucher Found</span>
                  </div>
                  <p>
                    Voucher <strong>#{duplicateVoucherWarning.voucherNumber}</strong> for <strong>{indMonth}</strong> (Rs.{' '}
                    {duplicateVoucherWarning.totalPayable || duplicateVoucherWarning.feeAmount}) already exists for this student.
                  </p>
                  <label className="flex items-center gap-1.5 pt-1 text-slate-800 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={indAllowDuplicate}
                      onChange={(e) => setIndAllowDuplicate(e.target.checked)}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span>Allow duplicate / additional voucher for this month</span>
                  </label>
                </div>
              )}

              {/* Manual Entry Fallback for Non-registered or Custom students */}
              <div className="pt-2 border-t border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-800 block">
                  Verify or Edit Student Details:
                </span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Student Full Name *</label>
                    <input
                      type="text"
                      value={indManualName}
                      onChange={(e) => setIndManualName(e.target.value)}
                      placeholder="Student full name"
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Father's Full Name *</label>
                    <input
                      type="text"
                      value={indManualFather}
                      onChange={(e) => setIndManualFather(e.target.value)}
                      placeholder="Father's name"
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Class *</label>
                    <select
                      value={indManualClass}
                      onChange={(e) => {
                        setIndManualClass(e.target.value);
                        const found = feeConfigs.find((c) => c.className === e.target.value);
                        if (found) {
                          setIndTuition(found.tuitionFee || 1500);
                          setIndAnnual(found.annualCharges || 0);
                          setIndExam(found.examFee || 0);
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5"
                    >
                      {(schoolProfile.availableClasses || []).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Section</label>
                    <select
                      value={indManualSection}
                      onChange={(e) => setIndManualSection(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5"
                    >
                      <option value="A">Section A</option>
                      <option value="B">Section B</option>
                      <option value="C">Section C</option>
                      <option value="D">Section D</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Admission #</label>
                    <input
                      type="text"
                      value={indManualAdmNo}
                      onChange={(e) => setIndManualAdmNo(e.target.value)}
                      placeholder="e.g. SPHS-2026-0001"
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Academic Session</label>
                    <select
                      value={indSession}
                      onChange={(e) => setIndSession(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5"
                    >
                      {(schoolProfile.academicSessions || ['2024-2025', '2025-2026', '2026-2027']).map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Fee Heads, Live Calculator & Actions */}
            <div className="lg:col-span-6 bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-600" />
                <span>Step 2: Fee Heads & Calculations</span>
              </h2>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Billing Month *</label>
                  <input
                    type="text"
                    value={indMonth}
                    onChange={(e) => setIndMonth(e.target.value)}
                    placeholder="e.g. November 2026"
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Due Date *</label>
                  <input
                    type="date"
                    value={indDueDate}
                    onChange={(e) => setIndDueDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Tuition Fee (Rs.)</label>
                  <input
                    type="number"
                    value={indTuition}
                    onChange={(e) => setIndTuition(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Admission Fee (Rs.)</label>
                  <input
                    type="number"
                    value={indAdmission}
                    onChange={(e) => setIndAdmission(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Annual Fund (Rs.)</label>
                  <input
                    type="number"
                    value={indAnnual}
                    onChange={(e) => setIndAnnual(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Exam Fee (Rs.)</label>
                  <input
                    type="number"
                    value={indExam}
                    onChange={(e) => setIndExam(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Other / Misc Charges (Rs.)</label>
                  <input
                    type="number"
                    value={indOther}
                    onChange={(e) => setIndOther(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Late Fine (Rs.)</label>
                  <input
                    type="number"
                    value={indFine}
                    onChange={(e) => setIndFine(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Discount / Concession (Rs.)</label>
                  <input
                    type="number"
                    value={indDiscount}
                    onChange={(e) => setIndDiscount(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                  />
                </div>
              </div>

              {/* Live Calculations Summary Box */}
              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal (Base Items):</span>
                  <span className="font-mono font-semibold">Rs. {indSubtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Fine (+) / Discount (-):</span>
                  <span className="font-mono">Rs. {(indFine - indDiscount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-1">
                  <span>Total Payable:</span>
                  <span className="font-mono text-emerald-700">Rs. {indTotalPayable.toLocaleString()}</span>
                </div>
                <div className="text-[11px] text-slate-500 pt-0.5">
                  Amount in words: <em>{numberToWordsPKR(indTotalPayable)}</em>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleGenerateIndividual}
                  disabled={isCreatingIndividual || (!indManualName.trim() && !selectedStudentObj)}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs ${
                    isCreatingIndividual || (!indManualName.trim() && !selectedStudentObj)
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{isCreatingIndividual ? 'Generating...' : 'Save & Issue Individual Voucher'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Live Voucher Preview & Actions Container */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-500" />
                  <span>
                    {createdIndividualVoucher
                      ? `Generated Voucher: #${createdIndividualVoucher.voucherNumber}`
                      : 'Live Voucher Preview (3 Official Slips: Bank, School, Student)'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Standard 3-copy layout matching official school vouchers for Siqarah Public Model High School Shorkot.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!indPreviewRef.current) return;
                    try {
                      setIsExportingPdf(true);
                      const slug = (indManualName || 'Student').replace(/[^a-zA-Z0-9]/g, '_');
                      await downloadElementAsPDF(
                        indPreviewRef.current,
                        `Fee_Voucher_${slug}_${indMonth.replace(/\s+/g, '_')}.pdf`,
                        { orientation: 'portrait' }
                      );
                    } catch (err) {
                      console.error('Failed to export PDF:', err);
                    } finally {
                      setIsExportingPdf(false);
                    }
                  }}
                  disabled={isExportingPdf}
                  className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExportingPdf ? 'Exporting...' : 'Download PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (indPreviewRef.current) {
                      printElement(indPreviewRef.current);
                    }
                  }}
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                  <span>Print Voucher</span>
                </button>
              </div>
            </div>

            {/* 3-Copy Live Slip Preview */}
            <div className="bg-slate-100/60 p-4 rounded-xl">
              {render3CopyVoucher(
                {
                  voucherNumber: createdIndividualVoucher?.voucherNumber || 'PREVIEW-VCH',
                  studentName: indManualName || selectedStudentObj?.fullName || 'Student Name',
                  fatherName: indManualFather || selectedStudentObj?.fatherName || "Father's Name",
                  studentClass: indManualClass,
                  section: indManualSection,
                  admissionNumber: indManualAdmNo || selectedStudentObj?.admissionNumber || 'ADM-0000',
                  rollNumber: selectedStudentObj?.rollNumber,
                  session: indSession,
                  billingMonth: indMonth,
                  issueDate: indIssueDate,
                  dueDate: indDueDate,
                  tuition: indTuition,
                  admission: indAdmission,
                  annual: indAnnual,
                  exam: indExam,
                  other: indOther,
                  fine: indFine,
                  discount: indDiscount,
                  totalPayable: indTotalPayable,
                  balanceDue: indBalanceDue,
                  status: createdIndividualVoucher ? createdIndividualVoucher.status : 'UNPAID',
                },
                indPreviewRef
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: CLASS FEE STRUCTURE CONFIGURATION */}
      {/* ========================================================================= */}
      {activeMainTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Settings className="w-4 h-4 text-amber-500" />
                <span>Select Class to Configure</span>
              </h2>
              <div className="space-y-1">
                {(schoolProfile.availableClasses || []).map((cls) => {
                  const isSelected = cls === selectedConfigClass;
                  return (
                    <button
                      key={cls}
                      onClick={() => setSelectedConfigClass(cls)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {cls}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <span>Standard Fee Heads Configuration for {selectedConfigClass}</span>
              </h2>
              <p className="text-xs text-slate-500">
                These default amounts automatically pre-populate whenever bulk or individual vouchers are generated for this class.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Monthly Tuition Fee (Rs.) *
                  </label>
                  <input
                    type="number"
                    value={configTuition}
                    onChange={(e) => setConfigTuition(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Admission Fee (Rs.) *
                  </label>
                  <input
                    type="number"
                    value={configAdmission}
                    onChange={(e) => setConfigAdmission(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Annual Charges / Fund (Rs.) *
                  </label>
                  <input
                    type="number"
                    value={configAnnual}
                    onChange={(e) => setConfigAnnual(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Examination Fee (Rs.) *
                  </label>
                  <input
                    type="number"
                    value={configExam}
                    onChange={(e) => setConfigExam(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Other / Misc Fee (Rs.)
                  </label>
                  <input
                    type="number"
                    value={configOther}
                    onChange={(e) => setConfigOther(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Default Late Fine (Rs.)
                  </label>
                  <input
                    type="number"
                    value={configFine}
                    onChange={(e) => setConfigFine(Number(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-900"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleSaveFeeConfig}
                  disabled={isSavingConfig}
                  className="px-6 py-2.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingConfig ? 'Saving...' : `Save Fee Structure for ${selectedConfigClass}`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentModalVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-emerald-600">
              <CreditCard className="w-6 h-6" />
              <h3 className="font-bold text-slate-900 text-base">Record Fee Payment</h3>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
              <div>Voucher #: <strong>{paymentModalVoucher.voucherNumber}</strong></div>
              <div>Student: <strong>{paymentModalVoucher.studentName}</strong> (S/O {paymentModalVoucher.fatherName})</div>
              <div>Class: {paymentModalVoucher.studentClass} · {paymentModalVoucher.billingMonth || 'Admission Fee'}</div>
              <div>Total Payable: Rs. {(paymentModalVoucher.totalPayable || paymentModalVoucher.feeAmount).toLocaleString()}</div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Payment Amount (Rs.) *
              </label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Supports partial or full payment. Remaining balance will be tracked automatically.
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Payment Method & Notes
              </label>
              <input
                type="text"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setPaymentModalVoucher(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPaymentRecord}
                disabled={isRecordingPayment}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
              >
                {isRecordingPayment ? 'Recording...' : 'Confirm Receipt & Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Status Reversal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-bold text-slate-900 text-base">Confirm Status Reversal</h3>
            </div>
            <p className="text-xs text-slate-600">
              Reversing Voucher <strong>#{confirmDialog.voucher.voucherNumber}</strong> for{' '}
              <strong>{confirmDialog.voucher.studentName}</strong> back to <strong>UNPAID</strong>.
            </p>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Reason for Reversal *
              </label>
              <input
                type="text"
                value={confirmDialog.reason}
                onChange={(e) => setConfirmDialog({ ...confirmDialog, reason: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  executeStatusChange(confirmDialog.voucher.id, confirmDialog.targetStatus, confirmDialog.reason)
                }
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 cursor-pointer"
              >
                Confirm Reversal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Voucher Dialog */}
      {deleteVoucherTarget && onDeleteVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <Trash2 className="w-6 h-6" />
              <h3 className="font-bold text-slate-900 text-base">Delete Fee Voucher</h3>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to delete Fee Voucher <strong>#{deleteVoucherTarget.voucherNumber}</strong> for{' '}
              <strong>{deleteVoucherTarget.studentName}</strong> (Rs. {(deleteVoucherTarget.totalPayable || deleteVoucherTarget.feeAmount).toLocaleString()})?
            </p>
            <div className="p-3 bg-rose-50 text-rose-800 rounded-lg text-xs">
              Deleted vouchers are safely archived in the Recycle Bin and can be restored if needed.
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteVoucherTarget(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const target = deleteVoucherTarget;
                  setDeleteVoucherTarget(null);
                  await onDeleteVoucher(target.id);
                }}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 cursor-pointer"
              >
                Delete Voucher
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
