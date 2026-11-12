/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole =
  | 'Super Admin'
  | 'Principal'
  | 'HR'
  | 'Accountant'
  | 'Clerk'
  | 'Teacher';

export type StudentStatus = 'Enrolled' | 'Struck Off' | 'Stuck' | 'SLC' | 'Expired';

export interface StudentRecord {
  id: string;
  admissionNumber: string;
  permanentStudentId?: string; // Permanent ID independent of roll number & class
  fullName: string;
  fatherName: string;
  motherName?: string;
  photoUrl?: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other';
  studentClass: string;
  section?: string; // Section A, B, C, D
  rollNumber?: string; // Class roll number
  previousSchool?: string;
  previousClass?: string;
  previousRollNumber?: string;
  fatherCnic?: string;
  motherCnic?: string;
  mobileNumber: string;
  motherMobileNumber?: string;
  emergencyContactPerson?: string;
  emergencyContactNumber?: string;
  relationship?: string;
  address: string;
  session: string;
  admissionDate: string;
  admissionFee: number;
  status?: StudentStatus; // 'Enrolled' | 'Struck Off' | 'Stuck' | 'SLC' | 'Expired'
  isPassOut?: number; // 1 if Class 10 passed out
  passOutDate?: string | null;
  passOutSession?: string | null;
  schoolId?: string;
  createdAt: string;
  isDeleted?: number;
  deletedAt?: string | null;
  deletedBy?: string | null;
}

export interface FeeVoucher {
  id: string;
  voucherNumber: string;
  studentId: string;
  admissionNumber: string;
  rollNumber?: string;
  studentName: string;
  fatherName: string;
  studentClass: string;
  section?: string;
  session: string;
  billingMonth?: string;
  // Itemized Fee Components
  tuitionFee?: number;
  admissionFeeItem?: number;
  annualCharges?: number;
  examFee?: number;
  otherCharges?: number;
  fine?: number;
  discount?: number;
  subtotal?: number;
  totalPayable?: number;
  amountPaid?: number;
  balanceDue?: number;
  feeAmount: number; // For backward compatibility, matches totalPayable
  status: 'UNPAID' | 'PAID';
  issueDate: string;
  dueDate: string;
  paidAt?: string | null;
  updatedBy?: string | null;
  updatedAt: string;
  notes?: string;
  schoolId?: string;
  isManualStudent?: boolean;
  isDeleted?: number;
  deletedAt?: string | null;
  deletedBy?: string | null;
}

export interface VoucherAuditEntry {
  id: string;
  voucherId: string;
  voucherNumber: string;
  previousStatus: 'UNPAID' | 'PAID';
  newStatus: 'UNPAID' | 'PAID';
  changedBy: string;
  timestamp: string;
  notes?: string;
}

export interface SchoolProfile {
  schoolName: string;
  schoolNameUrdu: string;
  board: string;
  principal: string;
  introduction: string;
  campusAddress: string;
  phone: string;
  email: string;
  availableClasses: string[];
  academicSessions: string[];
  activeSession: string;
  logoUrl?: string;
  campusPicUrl?: string;
  stampUrl?: string;
  principalPhotoUrl?: string;
  website?: string;
  schoolCode?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface SchoolRecord extends SchoolProfile {
  id: string;
  schoolCode: string;
  status: 'ACTIVE' | 'INACTIVE';
  adminEmail?: string;
  adminName?: string;
  subscriptionPlan?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StaffRecord {
  id: string;
  staffIdNumber?: string; // e.g. STF-2026-0001
  fullName: string;
  fatherName: string;
  designation: string;
  department?: string; // Science, Mathematics, Humanities, Administration, Accounts, General
  role: 'Teaching' | 'Administrative' | 'Support';
  cnic: string;
  mobileNumber: string;
  email: string;
  joiningDate: string;
  qualification: string;
  monthlySalary: number;
  status: 'ACTIVE' | 'ON_LEAVE' | 'RESIGNED';
  address: string;
  emergencyContact?: string;
  photoUrl?: string;
  schoolId?: string;
  isDeleted?: number;
  deletedAt?: string | null;
  deletedBy?: string | null;
}

export interface CertificateRecord {
  id: string;
  certificateNumber: string;
  recipientType: 'student' | 'staff';
  recipientId: string;
  recipientName: string;
  fatherName: string;
  referenceNumber: string; // Admission Number or Staff ID
  className?: string;
  certificateType:
    | 'CHARACTER_CERTIFICATE'
    | 'SCHOOL_LEAVING_CERTIFICATE'
    | 'TRANSFER_CERTIFICATE'
    | 'BONAFIDE_CERTIFICATE'
    | 'STUDY_CERTIFICATE'
    | 'MIGRATION_CERTIFICATE'
    | 'MERIT_CERTIFICATE';
  issueDate: string;
  session: string;
  remarks: string;
  conduct?: string;
  reasonForLeaving?: string;
  schoolId?: string;
  isDeleted?: number;
  deletedAt?: string | null;
  deletedBy?: string | null;
}

export type HRDocumentType =
  | 'APPOINTMENT'
  | 'OFFICIAL_ORDER'
  | 'TRANSFER_ORDER'
  | 'RESIGNATION'
  | 'DISCIPLINARY'
  | 'LEAVE_APPLICATION'
  | 'EXPERIENCE'
  | 'SHOW_CAUSE'
  | 'ABSENCE_WARNING'
  | 'CLEARANCE_FORM';

export interface StaffEmploymentLetter {
  id: string;
  letterType: HRDocumentType | string;
  letterNumber: string;
  staffId: string;
  staffName: string;
  fatherName: string;
  staffIdNumber: string;
  designation: string;
  department: string;
  joiningDate: string;
  effectiveDate: string;
  lastWorkingDay?: string;
  reason?: string;
  contentBody: string;
  issueDate: string;
  authorizedSignatory: string;
  isManualStaff?: boolean;
  cnic?: string;
  subjectTitle?: string;
  schoolId?: string;
  isDeleted?: number;
  deletedAt?: string | null;
  deletedBy?: string | null;
}

export interface ExamResultRecord {
  id: string;
  studentId: string;
  studentName: string;
  fatherName: string;
  admissionNumber: string;
  studentClass: string;
  session: string;
  examTerm: 'First Term' | 'Mid Term' | 'Final Examination';
  totalMarks: number;
  obtainedMarks: number;
  percentage: number;
  grade: string;
  remarks: string;
  subjects: {
    subject: string;
    total: number;
    obtained: number;
    grade: string;
  }[];
  schoolId?: string;
  isDeleted?: number;
  deletedAt?: string | null;
  deletedBy?: string | null;
}

export interface RecycleBinItem {
  id: string;
  recordType: 'student' | 'staff' | 'voucher' | 'certificate' | 'exam_result' | 'staff_letter';
  title: string;
  referenceNumber: string;
  deletedAt: string;
  deletedBy: string;
  dataSummary: string;
}

export interface AdmissionFormData {
  fullName: string;
  fatherName: string;
  motherName?: string;
  photoUrl?: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other';
  studentClass: string;
  section?: string;
  previousSchool?: string;
  previousClass?: string;
  previousRollNumber?: string;
  fatherCnic?: string;
  motherCnic?: string;
  mobileNumber: string;
  motherMobileNumber?: string;
  emergencyContactPerson?: string;
  emergencyContactNumber?: string;
  relationship?: string;
  admissionDate: string;
  admissionNumber?: string;
  address: string;
  session: string;
  admissionFee: number | string;
}

export interface VoucherFilterOptions {
  search?: string;
  status?: 'ALL' | 'UNPAID' | 'PAID';
  studentClass?: string;
  session?: string;
  billingMonth?: string;
  section?: string;
}

export interface DashboardStats {
  totalStudents: number;
  unpaidVouchersCount: number;
  paidVouchersCount: number;
  totalFeeAmount: number;
  collectedFeeAmount: number;
  pendingFeeAmount: number;
  recentAdmissions: StudentRecord[];
  recycleBinCount?: number;
}

// Module 1: Class and Section Management
export interface SectionSetting {
  section: 'A' | 'B' | 'C' | 'D' | string;
  enabled: boolean;
  maxStudents?: number;
}

export interface ClassSectionInfo {
  className: string;
  sections: SectionSetting[];
  schoolId?: string;
}

// Module 5: Student History and Status Tracking
export interface StudentHistoryItem {
  id: string;
  studentId: string;
  eventType:
    | 'ADMISSION'
    | 'PROMOTION'
    | 'TRANSFER'
    | 'STATUS_CHANGE'
    | 'PASS_OUT'
    | 'SLC'
    | 'EXAM'
    | 'FEE'
    | 'NOTE';
  title: string;
  description: string;
  details?: Record<string, any>;
  fromSession?: string;
  toSession?: string;
  fromClass?: string;
  toClass?: string;
  fromSection?: string;
  toSection?: string;
  fromRollNumber?: string;
  toRollNumber?: string;
  fromStatus?: string;
  toStatus?: string;
  performedBy: string;
  timestamp: string;
  reason?: string;
  schoolId?: string;
}

// Module 6: Class-Wise Fee Configuration
export interface ClassFeeConfig {
  id: string;
  className: string;
  session: string;
  tuitionFee: number;
  admissionFee: number;
  annualCharges: number;
  examFee: number;
  otherCharges: number;
  defaultFine: number;
  defaultDiscount: number;
  schoolId?: string;
}
