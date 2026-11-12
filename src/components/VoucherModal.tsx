/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { X, Printer, CheckCircle, Clock, Download, RefreshCw } from 'lucide-react';
import { FeeVoucher, StudentRecord, SchoolProfile } from '../types/school.ts';
import { formatPKR, formatDate, numberToWordsPKR } from '../utils/voucherHelpers.ts';
import { downloadElementAsPDF, printElement } from '../utils/pdfExport.ts';
import { getSchoolLogoSrc } from '../utils/schoolBranding.ts';

interface VoucherModalProps {
  voucher: FeeVoucher | null;
  student?: StudentRecord | null;
  schoolProfile: SchoolProfile;
  isOpen: boolean;
  onClose: () => void;
  onToggleStatus?: (voucherId: string, currentStatus: 'UNPAID' | 'PAID') => void;
}

export const VoucherModal: React.FC<VoucherModalProps> = ({
  voucher,
  student,
  schoolProfile,
  isOpen,
  onClose,
  onToggleStatus,
}) => {
  const [downloading, setDownloading] = useState(false);
  const printContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !voucher) return null;

  const handlePrint = () => {
    if (printContainerRef.current) {
      printElement(printContainerRef.current, `Fee_Voucher_${voucher.voucherNumber}`);
    } else {
      window.print();
    }
  };

  const handleDownloadPDF = async () => {
    if (!printContainerRef.current) return;
    try {
      setDownloading(true);
      const studentSlug = (studentName || 'Student').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${studentSlug}_Fee_Voucher_${voucher.voucherNumber}.pdf`;
      await downloadElementAsPDF(printContainerRef.current, filename, {
        orientation: 'portrait',
      });
    } catch (err) {
      console.error('Failed to download PDF:', err);
    } finally {
      setDownloading(false);
    }
  };

  const studentName = voucher.studentName || student?.fullName || '';
  const fatherName = voucher.fatherName || student?.fatherName || '';
  const admissionNumber = voucher.admissionNumber || student?.admissionNumber || '';
  const studentClass = voucher.studentClass || student?.studentClass || '';
  const session = voucher.session || student?.session || schoolProfile.activeSession;
  const feeAmount = voucher.feeAmount;

  const logoSrc = getSchoolLogoSrc(schoolProfile);
  const stampSrc = schoolProfile.stampUrl || '/assets/school_stamp.jpg';

  // Single slip component for multi-copy printing (Bank Copy, School Copy, Student Copy)
  const renderVoucherSlip = (copyTitle: string, isLast: boolean) => (
    <div className={`p-4 bg-white border border-slate-300 rounded-lg text-slate-900 ${!isLast ? 'mb-4 border-b-2 border-dashed border-b-slate-400' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-2 border-slate-200">
        <div className="flex items-center gap-3">
          <img
            src={logoSrc}
            alt="School Logo"
            className="w-12 h-12 object-contain"
            referrerPolicy="no-referrer"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-extrabold uppercase tracking-tight text-slate-950">
                {schoolProfile.schoolName}
              </h2>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-600 font-medium">
              <span>Affiliated: {schoolProfile.board}</span>
              <span>·</span>
              <span>Principal: <strong>{schoolProfile.principal}</strong></span>
            </div>
            <p className="text-[9px] text-slate-500">{schoolProfile.campusAddress}</p>
          </div>
        </div>

        <div className="text-right flex flex-col items-end">
          <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-900 text-white px-2 py-0.5 rounded">
            {copyTitle}
          </span>
          <span className="text-[10px] font-bold text-amber-700 mt-1 uppercase">
            Admission Fee Voucher
          </span>
          <span className="text-[11px] font-tabular font-bold text-slate-900">
            {voucher.voucherNumber}
          </span>
        </div>
      </div>

      {/* Meta Bar */}
      <div className="grid grid-cols-4 gap-2 py-1.5 px-2 bg-slate-50 border-y border-slate-200 text-[10px] my-2">
        <div>
          <span className="text-slate-500 block">Issue Date:</span>
          <span className="font-bold text-slate-800 font-tabular">{formatDate(voucher.issueDate)}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Due Date:</span>
          <span className="font-bold text-slate-800 font-tabular">{formatDate(voucher.dueDate)}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Session:</span>
          <span className="font-bold text-slate-800">{session}</span>
        </div>
        <div>
          <span className="text-slate-500 block">Payment Mode:</span>
          <span className="font-bold text-slate-800">Cash / Bank Desk</span>
        </div>
      </div>

      {/* Student Details Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs py-1">
        <div className="col-span-1 sm:col-span-2">
          <span className="text-[10px] text-slate-500 block">Student Full Name:</span>
          <span className="font-bold text-slate-950 text-sm">{studentName}</span>
        </div>
        <div className="col-span-1 sm:col-span-2">
          <span className="text-[10px] text-slate-500 block">Father's Name:</span>
          <span className="font-semibold text-slate-900">{fatherName}</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 block">Admission Number:</span>
          <span className="font-tabular font-bold text-slate-900">{admissionNumber}</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 block">Admission Class:</span>
          <span className="font-bold text-slate-900">{studentClass}</span>
        </div>
        <div className="col-span-2">
          <span className="text-[10px] text-slate-500 block">Fee Particulars:</span>
          <span className="font-medium text-slate-700">Official New Student Admission Registration Fee</span>
        </div>
      </div>

      {/* Fee Table */}
      <div className="mt-2 border border-slate-200 rounded overflow-hidden">
        <div className="flex justify-between items-center bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-700 border-b border-slate-200">
          <span>Fee Description</span>
          <span>Amount (PKR)</span>
        </div>
        <div className="flex justify-between items-center px-3 py-1.5 text-xs text-slate-800">
          <span>1. Student Admission & Registration Fee</span>
          <span className="font-tabular font-bold">{formatPKR(feeAmount)}</span>
        </div>
        <div className="flex justify-between items-center px-3 py-1 text-xs font-extrabold bg-slate-50 border-t border-slate-200">
          <span>TOTAL PAYABLE AMOUNT:</span>
          <span className="font-tabular text-sm text-slate-950">{formatPKR(feeAmount)}</span>
        </div>
      </div>

      <div className="text-[10px] text-slate-600 mt-1 italic">
        <strong>Amount in words:</strong> {numberToWordsPKR(feeAmount)}
      </div>

      {/* Status & Signature Strip */}
      <div className="mt-3 pt-2 border-t border-slate-200 flex items-end justify-between gap-4">
        {/* Payment Status Badge */}
        <div className="flex items-center gap-3">
          <div
            className={`px-3 py-1 rounded border text-center font-extrabold text-xs tracking-wider uppercase ${
              voucher.status === 'PAID'
                ? 'bg-emerald-50 border-emerald-600 text-emerald-800'
                : 'bg-red-50 border-red-500 text-red-800'
            }`}
          >
            STATUS: {voucher.status}
          </div>

          {voucher.status === 'PAID' && (
            <div className="text-[9px] text-slate-500">
              <span>Verified Paid</span>
              {voucher.paidAt && <span className="block font-tabular">{formatDate(voucher.paidAt)}</span>}
            </div>
          )}
        </div>

        {/* Space for School Stamp */}
        <div className="flex items-center gap-2">
          <div className="w-14 h-14 relative flex items-center justify-center border border-dashed border-slate-300 rounded p-0.5">
            <img
              src={stampSrc}
              alt="School Stamp"
              className="w-full h-full object-contain opacity-85"
              referrerPolicy="no-referrer"
            />
            <span className="absolute bottom-0 text-[7px] text-slate-400 bg-white/80 px-0.5">Official Stamp</span>
          </div>
        </div>

        {/* Signatures */}
        <div className="flex items-end gap-6 text-[10px] text-center">
          <div className="border-t border-slate-400 pt-1 w-24">
            <span className="text-slate-600 block">Accounts Officer</span>
            <span className="text-[8px] text-slate-400">(Cash Counter)</span>
          </div>
          <div className="border-t border-slate-400 pt-1 w-28">
            <span className="font-bold text-slate-900 block">{schoolProfile.principal}</span>
            <span className="text-[8px] text-slate-500 font-semibold">(Principal)</span>
          </div>
        </div>
      </div>

      {/* Tear cut notice if not last */}
      {!isLast && (
        <div className="text-center text-[8px] font-mono text-slate-400 mt-2 uppercase tracking-widest no-print">
          - - - - - - - - - - - - - ✂ Tear Here (Bank / Office / Student Split) ✂ - - - - - - - - - - - - -
        </div>
      )}
    </div>
  );

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
    >
      <div className="relative bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Controls Top Bar (Hidden during print via .no-print) */}
        <div className="no-print bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Official Admission Fee Voucher · {voucher.voucherNumber}
              </h3>
              <p className="text-xs text-slate-400">
                Download PDF or print on standard A4 page for parent and office records.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onToggleStatus && (
              <button
                type="button"
                onClick={() => onToggleStatus(voucher.id, voucher.status)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
                  voucher.status === 'PAID'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700 hover:bg-emerald-900'
                    : 'bg-amber-950 text-amber-300 border-amber-700 hover:bg-amber-900'
                }`}
                title="Toggle manual payment status"
              >
                {voucher.status === 'PAID' ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                <span>Status: {voucher.status}</span>
              </button>
            )}

            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Download className={`w-4 h-4 ${downloading ? 'animate-bounce' : ''}`} />
              <span>{downloading ? 'Generating...' : 'Download PDF'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs sm:text-sm px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>Print Voucher</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Close Voucher"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Voucher Area: Exactly what prints on A4 and downloads as PDF! */}
        <div className="overflow-y-auto p-4 sm:p-6 bg-slate-100/60">
          <div
            ref={printContainerRef}
            id="printable-voucher"
            className="space-y-4 max-w-3xl mx-auto bg-white p-4 shadow-sm rounded-xl"
          >
            {/* Slip 1: Bank / Cash Counter Copy */}
            {renderVoucherSlip('Bank / Cash Counter Copy', false)}

            {/* Slip 2: School / Accounts Office Copy */}
            {renderVoucherSlip('School Office Copy', false)}

            {/* Slip 3: Student / Parent Copy */}
            {renderVoucherSlip('Student / Parent Copy', true)}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="no-print bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 shrink-0">
          <span>
            Verified by: <strong>{schoolProfile.principal}</strong> (Principal, Siqarah Public Model High School)
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={handlePrint}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>Print A4 Voucher</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
