/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  GraduationCap,
  Users,
  Receipt,
  CheckCircle2,
  Clock,
  ArrowRight,
  Printer,
  ShieldCheck,
  FileText,
  Download,
  Building,
  Briefcase,
  FileSpreadsheet,
} from 'lucide-react';
import { SchoolProfile, DashboardStats, StudentRecord } from '../types/school.ts';
import { formatPKR, formatDate } from '../utils/voucherHelpers.ts';

interface WelcomeScreenProps {
  schoolProfile: SchoolProfile;
  stats: DashboardStats | null;
  onNavigate: (tab: 'admission' | 'fees' | 'students' | 'staff' | 'forms' | 'exports' | 'settings') => void;
  onOpenVoucher: (studentId: string) => void;
  onOpenAdmissionFormModal?: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  schoolProfile,
  stats,
  onNavigate,
  onOpenVoucher,
}) => {
  const logoSrc = schoolProfile.logoUrl || '/assets/school_logo.jpg';
  const buildingSrc = schoolProfile.campusPicUrl || '/assets/school_building.jpg';

  return (
    <div className="space-y-8 pb-12">
      {/* Hero / Prominent School Information Section */}
      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="relative">
          <div className="h-56 sm:h-72 w-full overflow-hidden bg-slate-900 relative">
            {/* Real School Campus Building Photo provided by user */}
            <img
              src={buildingSrc}
              alt="Siqarah Public Model High School Building Shorkot"
              className="w-full h-full object-cover object-center opacity-90"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-900/60 to-transparent" />
            <div className="absolute bottom-4 left-4 sm:left-6 right-4 flex items-end justify-between">
              <div className="flex items-center gap-4">
                {/* Official School Logo */}
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white p-1 border-2 border-amber-400 shadow-lg shrink-0 flex items-center justify-center">
                  <img
                    src={logoSrc}
                    alt="School Logo"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-amber-400 tracking-wide uppercase">
                    <span>Affiliated with {schoolProfile.board}</span>
                    <span className="text-slate-400">·</span>
                    <span>Session {schoolProfile.activeSession}</span>
                  </div>
                  <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
                    {schoolProfile.schoolName}
                  </h1>
                  <p className="text-xs font-medium text-slate-300 mt-0.5">
                    {schoolProfile.campusAddress}
                  </p>
                </div>
              </div>
              <div className="hidden md:flex flex-col items-end text-right bg-slate-900/85 backdrop-blur px-3 py-2 rounded-lg border border-slate-700">
                <span className="text-xs text-slate-400">Principal</span>
                <span className="text-sm font-bold text-amber-300">{schoolProfile.principal}</span>
              </div>
            </div>
          </div>
        </div>

        {/* School Introduction & Mission Box */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Institutional Profile & Academic Vision</span>
              </div>
              <blockquote className="text-base sm:text-lg text-slate-700 leading-relaxed font-medium italic border-l-4 border-amber-500 pl-4 bg-amber-50/40 py-2 rounded-r-lg">
                “{schoolProfile.introduction}”
              </blockquote>
            </div>

            {/* Quick School Metadata Card */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs sm:text-sm space-y-2.5">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">Board Affiliation:</span>
                <span className="font-bold text-slate-900">{schoolProfile.board}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">Head of Institution:</span>
                <span className="font-bold text-slate-900">{schoolProfile.principal}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">Active Academic Session:</span>
                <span className="font-semibold text-emerald-700">{schoolProfile.activeSession}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Class Range:</span>
                <span className="font-semibold text-slate-800">Play Group to Class 10</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* KPI Stats Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Admitted Students</p>
            <p className="text-2xl font-extrabold text-slate-900 font-tabular mt-1">
              {stats ? stats.totalStudents : '...'}
            </p>
            <p className="text-xs text-slate-500 mt-1">Session {schoolProfile.activeSession}</p>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pending Fee Vouchers</p>
            <p className="text-2xl font-extrabold text-amber-600 font-tabular mt-1">
              {stats ? stats.unpaidVouchersCount : '...'}
            </p>
            <p className="text-xs text-amber-700 mt-1 font-tabular">
              {stats ? formatPKR(stats.pendingFeeAmount) : '...'}
            </p>
          </div>
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Paid / Verified Fees</p>
            <p className="text-2xl font-extrabold text-emerald-600 font-tabular mt-1">
              {stats ? stats.paidVouchersCount : '...'}
            </p>
            <p className="text-xs text-emerald-700 mt-1 font-tabular">
              {stats ? formatPKR(stats.collectedFeeAmount) : '...'}
            </p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Admission Dues</p>
            <p className="text-2xl font-extrabold text-slate-900 font-tabular mt-1">
              {stats ? formatPKR(stats.totalFeeAmount) : '...'}
            </p>
            <p className="text-xs text-slate-500 mt-1">Sum of generated vouchers</p>
          </div>
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
            <Receipt className="w-6 h-6" />
          </div>
        </div>
      </section>

      {/* Quick Operations Module Hub */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Module 1: Student Admission Action */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl border border-slate-700 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-10 h-10 bg-amber-500/20 text-amber-400 rounded-lg flex items-center justify-center border border-amber-500/30">
              <GraduationCap className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold tracking-tight text-white">Student Admission Form</h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              Enroll new students, upload photo, assign classes, and automatically issue an authentic fee voucher. Download filled or blank PDF admission forms.
            </p>
          </div>
          <div className="pt-6">
            <button
              onClick={() => onNavigate('admission')}
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-lg text-xs sm:text-sm transition-all shadow-sm"
            >
              <span>Open Admission Form</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Module 2: Forms & Certificates Hub */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-10 h-10 bg-blue-50 text-blue-700 rounded-lg flex items-center justify-center border border-blue-200">
              <FileText className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Downloadable Forms Hub</h2>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              Print or download A4 PDFs for Character Certificates, School Leaving Certificates (SLC), Transfer Forms, Staff Resignations, Salary slips, and Blank Templates.
            </p>
          </div>
          <div className="pt-6">
            <button
              onClick={() => onNavigate('forms')}
              className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold px-4 py-2.5 rounded-lg text-xs sm:text-sm transition-all shadow-sm"
            >
              <span>Explore All Forms</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Module 3: Export Records (PDF, Excel, CSV) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-700 rounded-lg flex items-center justify-center border border-emerald-200">
              <Download className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Export Lists & Reports</h2>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              Export complete student registers by class, staff directory, fee accounts register, and exam reports to PDF, Microsoft Excel (.xls), and CSV.
            </p>
          </div>
          <div className="pt-6">
            <button
              onClick={() => onNavigate('exports')}
              className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-4 py-2.5 rounded-lg text-xs sm:text-sm transition-all shadow-sm"
            >
              <span>Export Records</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Recent Admissions & Quick Voucher Reprint Strip */}
      {stats && stats.recentAdmissions && stats.recentAdmissions.length > 0 && (
        <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Recent Student Admissions</h3>
              <p className="text-xs text-slate-500">Latest enrolled students with immediate fee voucher access</p>
            </div>
            <button
              onClick={() => onNavigate('students')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <span>View All Directory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100">
                  <th className="py-2.5 font-medium">Admission #</th>
                  <th className="py-2.5 font-medium">Student Name</th>
                  <th className="py-2.5 font-medium">Father Name</th>
                  <th className="py-2.5 font-medium">Class</th>
                  <th className="py-2.5 font-medium">Date</th>
                  <th className="py-2.5 font-medium text-right">Fee</th>
                  <th className="py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.recentAdmissions.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 font-tabular font-semibold text-slate-700">{st.admissionNumber}</td>
                    <td className="py-2.5 font-bold text-slate-900">{st.fullName}</td>
                    <td className="py-2.5 text-slate-600">{st.fatherName}</td>
                    <td className="py-2.5">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-medium">
                        {st.studentClass}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-500">{formatDate(st.admissionDate)}</td>
                    <td className="py-2.5 font-tabular font-semibold text-slate-900 text-right">
                      {formatPKR(st.admissionFee)}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => onOpenVoucher(st.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold bg-slate-100 hover:bg-amber-100 hover:text-amber-900 text-slate-700 px-2.5 py-1 rounded transition-colors"
                      >
                        <Printer className="w-3 h-3" />
                        <span>Print Voucher</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
