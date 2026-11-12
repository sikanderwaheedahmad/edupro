/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  Download,
  FileSpreadsheet,
  Printer,
  FileText,
  Filter,
  CheckCircle2,
  Users,
  Briefcase,
  Receipt,
  GraduationCap,
  Award,
  ShieldAlert,
} from 'lucide-react';
import { SchoolProfile, StudentRecord, StaffRecord, FeeVoucher, CertificateRecord, ExamResultRecord } from '../types/school.ts';
import { exportToCSV, exportToExcel, exportTableToPDF, downloadElementAsPDF, printElement } from '../utils/pdfExport.ts';
import { formatDate, formatPKR } from '../utils/voucherHelpers.ts';

interface ExportRecordsProps {
  schoolProfile: SchoolProfile;
  students: StudentRecord[];
  staff: StaffRecord[];
  vouchers: FeeVoucher[];
  certificates: CertificateRecord[];
  examResults: ExamResultRecord[];
}

type DatasetKey = 'students' | 'staff' | 'fees' | 'admissions' | 'results' | 'certificates';

export const ExportRecords: React.FC<ExportRecordsProps> = ({
  schoolProfile,
  students,
  staff,
  vouchers,
  certificates,
  examResults,
}) => {
  const [selectedDataset, setSelectedDataset] = useState<DatasetKey>('students');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [feeStatusFilter, setFeeStatusFilter] = useState<'ALL' | 'UNPAID' | 'PAID'>('ALL');
  const [downloading, setDownloading] = useState<boolean>(false);

  const previewTableRef = useRef<HTMLDivElement | null>(null);

  const logoSrc = schoolProfile.logoUrl || '/assets/school_logo.jpg';

  // Filter students
  const filteredStudents = students.filter((s) => {
    if (selectedClass !== 'ALL' && s.studentClass !== selectedClass) return false;
    return true;
  });

  // Filter vouchers
  const filteredVouchers = vouchers.filter((v) => {
    if (feeStatusFilter !== 'ALL' && v.status !== feeStatusFilter) return false;
    if (selectedClass !== 'ALL' && v.studentClass !== selectedClass) return false;
    return true;
  });

  // Unified dataset extractor that includes 100% of required dynamic records and fields
  const getDatasetExportData = () => {
    const session = schoolProfile.activeSession;
    switch (selectedDataset) {
      case 'students':
      case 'admissions': {
        const headers = [
          'Admission #',
          'Permanent ID',
          'Student Name',
          "Father's Name",
          'Class',
          'Section',
          'Roll Number',
          'Date of Birth',
          'Gender',
          'Contact Number',
          'Address',
          'Admission Date',
          'Academic Session',
          'Status',
          'Admission Fee (PKR)',
        ];
        const rows = filteredStudents.map((s) => [
          s.admissionNumber || '-',
          s.permanentStudentId || '-',
          s.fullName || '-',
          s.fatherName || '-',
          s.studentClass || '-',
          s.section || 'A',
          s.rollNumber || '-',
          formatDate(s.dob || ''),
          s.gender || '-',
          s.mobileNumber || '-',
          s.address || '-',
          formatDate(s.admissionDate || ''),
          s.session || session,
          s.status || 'Enrolled',
          s.admissionFee || 0,
        ]);
        return {
          title: selectedClass === 'ALL' ? 'Complete Student Admission Register' : `Student Register - ${selectedClass}`,
          headers,
          rows,
          sheetName: 'Students',
        };
      }
      case 'staff': {
        const headers = [
          'Staff ID',
          'Full Name',
          "Father's Name",
          'Designation',
          'Role',
          'CNIC',
          'Contact Number',
          'Email',
          'Joining Date',
          'Qualification',
          'Monthly Salary (PKR)',
          'Status',
        ];
        const rows = staff.map((st) => [
          st.id,
          st.fullName,
          st.fatherName,
          st.designation,
          st.role,
          st.cnic,
          st.mobileNumber,
          st.email || '-',
          formatDate(st.joiningDate),
          st.qualification,
          st.monthlySalary,
          st.status,
        ]);
        return {
          title: 'Staff & Faculty Directory',
          headers,
          rows,
          sheetName: 'Staff',
        };
      }
      case 'fees': {
        const headers = [
          'Voucher #',
          'Admission #',
          'Student Name',
          "Father's Name",
          'Class',
          'Session',
          'Fee Amount (PKR)',
          'Status',
          'Issue Date',
          'Due Date',
          'Paid Date',
          'Verified By',
        ];
        const rows = filteredVouchers.map((v) => [
          v.voucherNumber,
          v.admissionNumber,
          v.studentName,
          v.fatherName,
          v.studentClass,
          v.session,
          v.feeAmount,
          v.status,
          formatDate(v.issueDate),
          formatDate(v.dueDate),
          v.paidAt ? formatDate(v.paidAt) : '-',
          v.updatedBy || '-',
        ]);
        return {
          title: `Fee Vouchers Ledger (${feeStatusFilter})`,
          headers,
          rows,
          sheetName: 'Fees',
        };
      }
      case 'results': {
        const headers = [
          'Admission #',
          'Student Name',
          "Father's Name",
          'Class',
          'Term',
          'Total Marks',
          'Obtained Marks',
          'Percentage',
          'Grade',
          'Remarks',
        ];
        const rows = examResults.map((r) => [
          r.admissionNumber,
          r.studentName,
          r.fatherName,
          r.studentClass,
          r.examTerm,
          r.totalMarks,
          r.obtainedMarks,
          `${r.percentage}%`,
          r.grade,
          r.remarks,
        ]);
        return {
          title: 'Academic Examination Results Ledger',
          headers,
          rows,
          sheetName: 'Results',
        };
      }
      case 'certificates': {
        const headers = [
          'Certificate #',
          'Type',
          'Recipient Name',
          "Father's Name",
          'Admission #',
          'Class',
          'Issue Date',
          'Session',
          'Remarks',
        ];
        const rows = certificates.map((c) => [
          c.certificateNumber,
          c.certificateType,
          c.recipientName,
          c.fatherName,
          c.referenceNumber,
          c.className || '-',
          formatDate(c.issueDate),
          c.session,
          c.remarks,
        ]);
        return {
          title: 'Official Issued Certificates Register',
          headers,
          rows,
          sheetName: 'Certificates',
        };
      }
    }
  };

  // 1. Export CSV
  const handleExportCSV = () => {
    const data = getDatasetExportData();
    const schoolSlug = schoolProfile.schoolName.replace(/[^a-zA-Z0-9]/g, '_');
    const classSlug = selectedClass !== 'ALL' ? `_${selectedClass.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
    const filename = `${schoolSlug}_${selectedDataset}${classSlug}_Report_${schoolProfile.activeSession}.csv`;
    exportToCSV(filename, data.headers, data.rows);
  };

  // 2. Export Excel (.xls)
  const handleExportExcel = () => {
    const data = getDatasetExportData();
    const schoolSlug = schoolProfile.schoolName.replace(/[^a-zA-Z0-9]/g, '_');
    const classSlug = selectedClass !== 'ALL' ? `_${selectedClass.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
    const filename = `${schoolSlug}_${selectedDataset}${classSlug}_Report_${schoolProfile.activeSession}.xls`;
    exportToExcel(filename, data.sheetName, data.headers, data.rows);
  };

  // 3. Export PDF
  const handleExportPDF = async () => {
    try {
      setDownloading(true);
      const data = getDatasetExportData();
      const schoolSlug = schoolProfile.schoolName.replace(/[^a-zA-Z0-9]/g, '_');
      const classSlug = selectedClass !== 'ALL' ? `_${selectedClass.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
      const filename = `${schoolSlug}_${selectedDataset}${classSlug}_Report_${schoolProfile.activeSession}.pdf`;

      // Generates razor-sharp vector PDF with 100% of dynamic records, table lines, headers, and page numbers
      exportTableToPDF(
        filename,
        data.title,
        schoolProfile.schoolName,
        schoolProfile.activeSession,
        data.headers,
        data.rows,
        { orientation: 'landscape' }
      );
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    const schoolSlug = schoolProfile.schoolName.replace(/[^a-zA-Z0-9]/g, '_');
    if (previewTableRef.current) {
      printElement(previewTableRef.current, `${schoolSlug}_${selectedDataset}_Report`);
    } else {
      window.print();
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Administrative Ledger & Reporting</span>
            <span>·</span>
            <span>{schoolProfile.schoolName}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Export Records & Reports
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Export complete datasets in PDF, Microsoft Excel (.xls), and CSV format with role-based integrity.
          </p>
        </div>

        {/* Global Export Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportPDF}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs sm:text-sm px-3.5 py-2 rounded-lg transition-colors shadow-xs"
          >
            <Download className={`w-4 h-4 ${downloading ? 'animate-bounce' : ''}`} />
            <span>{downloading ? 'Exporting...' : 'Export PDF'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm px-3.5 py-2 rounded-lg transition-colors shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm px-3 py-2 rounded-lg transition-colors shadow-xs"
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm px-3 py-2 rounded-lg transition-colors shadow-xs"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Dataset Category Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          onClick={() => setSelectedDataset('students')}
          className={`p-3 rounded-xl border text-left transition-all ${
            selectedDataset === 'students'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Users className={`w-5 h-5 mb-1 ${selectedDataset === 'students' ? 'text-amber-400' : 'text-slate-500'}`} />
          <p className="text-xs font-bold">Student Register</p>
          <p className="text-[10px] opacity-75">{students.length} enrolled</p>
        </button>

        <button
          onClick={() => setSelectedDataset('fees')}
          className={`p-3 rounded-xl border text-left transition-all ${
            selectedDataset === 'fees'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Receipt className={`w-5 h-5 mb-1 ${selectedDataset === 'fees' ? 'text-amber-400' : 'text-slate-500'}`} />
          <p className="text-xs font-bold">Fee Records</p>
          <p className="text-[10px] opacity-75">{vouchers.length} vouchers</p>
        </button>

        <button
          onClick={() => setSelectedDataset('staff')}
          className={`p-3 rounded-xl border text-left transition-all ${
            selectedDataset === 'staff'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Briefcase className={`w-5 h-5 mb-1 ${selectedDataset === 'staff' ? 'text-amber-400' : 'text-slate-500'}`} />
          <p className="text-xs font-bold">Staff Directory</p>
          <p className="text-[10px] opacity-75">{staff.length} staff</p>
        </button>

        <button
          onClick={() => setSelectedDataset('admissions')}
          className={`p-3 rounded-xl border text-left transition-all ${
            selectedDataset === 'admissions'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <GraduationCap className={`w-5 h-5 mb-1 ${selectedDataset === 'admissions' ? 'text-amber-400' : 'text-slate-500'}`} />
          <p className="text-xs font-bold">Admissions Log</p>
          <p className="text-[10px] opacity-75">Session {schoolProfile.activeSession}</p>
        </button>

        <button
          onClick={() => setSelectedDataset('results')}
          className={`p-3 rounded-xl border text-left transition-all ${
            selectedDataset === 'results'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Award className={`w-5 h-5 mb-1 ${selectedDataset === 'results' ? 'text-amber-400' : 'text-slate-500'}`} />
          <p className="text-xs font-bold">Exam Results</p>
          <p className="text-[10px] opacity-75">{examResults.length} records</p>
        </button>

        <button
          onClick={() => setSelectedDataset('certificates')}
          className={`p-3 rounded-xl border text-left transition-all ${
            selectedDataset === 'certificates'
              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
              : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <FileText className={`w-5 h-5 mb-1 ${selectedDataset === 'certificates' ? 'text-amber-400' : 'text-slate-500'}`} />
          <p className="text-xs font-bold">Certificates</p>
          <p className="text-[10px] opacity-75">{certificates.length} issued</p>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-700">Filter By Class:</span>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white"
          >
            <option value="ALL">All Classes</option>
            {schoolProfile.availableClasses.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>

          {selectedDataset === 'fees' && (
            <>
              <span className="text-xs font-bold text-slate-700 ml-2">Fee Status:</span>
              <select
                value={feeStatusFilter}
                onChange={(e) => setFeeStatusFilter(e.target.value as any)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white"
              >
                <option value="ALL">All Vouchers</option>
                <option value="UNPAID">Unpaid Only</option>
                <option value="PAID">Paid Only</option>
              </select>
            </>
          )}
        </div>

        <div className="text-xs text-slate-500">
          Showing{' '}
          <strong>
            {selectedDataset === 'fees' ? filteredVouchers.length : filteredStudents.length}
          </strong>{' '}
          records · Academic Session <strong>{schoolProfile.activeSession}</strong>
        </div>
      </div>

      {/* Printable / Exportable Table Container */}
      <div
        ref={previewTableRef}
        id="printable-document"
        className="printable-area bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
      >
        {/* Table Print Header with School Logo */}
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <img
              src={logoSrc}
              alt="School Logo"
              className="w-14 h-14 object-contain"
              referrerPolicy="no-referrer"
            />
            <div>
              <h2 className="text-base sm:text-lg font-extrabold uppercase text-slate-950">
                {schoolProfile.schoolName}
              </h2>
              <p className="text-[10px] text-slate-600 mt-0.5">
                Affiliated with {schoolProfile.board} · Head of Institution: <strong>{schoolProfile.principal}</strong>
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold uppercase bg-slate-900 text-white px-3 py-1 rounded">
              {selectedDataset.toUpperCase()} REGISTER
            </span>
            <p className="text-[10px] text-slate-500 mt-1 font-tabular">
              Generated: {formatDate(new Date().toISOString())}
            </p>
          </div>
        </div>

        {/* Dataset Table */}
        <div className="overflow-x-auto">
          {selectedDataset === 'students' || selectedDataset === 'admissions' ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                <tr>
                  <th className="py-2.5 px-3">Adm #</th>
                  <th className="py-2.5 px-3">Student Full Name</th>
                  <th className="py-2.5 px-3">Father's Name</th>
                  <th className="py-2.5 px-3">Class</th>
                  <th className="py-2.5 px-3">Date of Birth</th>
                  <th className="py-2.5 px-3">Parent Mobile</th>
                  <th className="py-2.5 px-3">Address</th>
                  <th className="py-2.5 px-3 text-right">Fee (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-tabular font-bold text-slate-900">{s.admissionNumber}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-950">{s.fullName}</td>
                    <td className="py-2.5 px-3 text-slate-600">{s.fatherName}</td>
                    <td className="py-2.5 px-3 font-semibold">{s.studentClass}</td>
                    <td className="py-2.5 px-3 font-tabular">{formatDate(s.dob)}</td>
                    <td className="py-2.5 px-3 font-tabular">{s.mobileNumber}</td>
                    <td className="py-2.5 px-3 truncate max-w-xs">{s.address}</td>
                    <td className="py-2.5 px-3 font-tabular font-bold text-right">{formatPKR(s.admissionFee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : selectedDataset === 'fees' ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                <tr>
                  <th className="py-2.5 px-3">Voucher #</th>
                  <th className="py-2.5 px-3">Adm #</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Class</th>
                  <th className="py-2.5 px-3">Issue Date</th>
                  <th className="py-2.5 px-3">Due Date</th>
                  <th className="py-2.5 px-3 text-right">Amount (PKR)</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3">Verified By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredVouchers.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-tabular font-bold">{v.voucherNumber}</td>
                    <td className="py-2.5 px-3 font-tabular">{v.admissionNumber}</td>
                    <td className="py-2.5 px-3 font-bold">{v.studentName}</td>
                    <td className="py-2.5 px-3">{v.studentClass}</td>
                    <td className="py-2.5 px-3 font-tabular">{formatDate(v.issueDate)}</td>
                    <td className="py-2.5 px-3 font-tabular">{formatDate(v.dueDate)}</td>
                    <td className="py-2.5 px-3 font-tabular font-bold text-right">{formatPKR(v.feeAmount)}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          v.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {v.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 text-[11px]">{v.updatedBy || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : selectedDataset === 'staff' ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                <tr>
                  <th className="py-2.5 px-3">Staff Member</th>
                  <th className="py-2.5 px-3">Designation</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">CNIC</th>
                  <th className="py-2.5 px-3">Mobile</th>
                  <th className="py-2.5 px-3">Qualification</th>
                  <th className="py-2.5 px-3 text-right">Salary (PKR)</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {staff.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-slate-950">{st.fullName}</td>
                    <td className="py-2.5 px-3 font-medium text-amber-900">{st.designation}</td>
                    <td className="py-2.5 px-3">{st.role}</td>
                    <td className="py-2.5 px-3 font-tabular">{st.cnic}</td>
                    <td className="py-2.5 px-3 font-tabular">{st.mobileNumber}</td>
                    <td className="py-2.5 px-3">{st.qualification}</td>
                    <td className="py-2.5 px-3 font-tabular font-bold text-right">{formatPKR(st.monthlySalary)}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
                        {st.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-12 text-center text-slate-400">
              Select dataset and click Export to download records.
            </div>
          )}
        </div>

        {/* Table Print Footer */}
        <div className="mt-6 pt-3 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-500">
          <span>Siqarah Public Model High School Shorkot · Affiliated with BISE Gujranwala</span>
          <span>Verified by: <strong>{schoolProfile.principal} (Principal)</strong></span>
        </div>
      </div>
    </div>
  );
};
