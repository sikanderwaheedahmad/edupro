/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {
  StudentRecord,
  FeeVoucher,
  VoucherAuditEntry,
  SchoolProfile,
  SchoolRecord,
  DashboardStats,
  StaffRecord,
  CertificateRecord,
  ExamResultRecord,
  StaffEmploymentLetter,
  RecycleBinItem,
  ClassSectionInfo,
  StudentHistoryItem,
  ClassFeeConfig,
  HRDocumentType,
  StudentStatus,
  SectionSetting,
  UserRole,
} from '../types/school.ts';
import crypto from 'node:crypto';
import {
  AppUser,
  UserInvitation,
  SecurityAuditEntry,
  SystemSecuritySettings,
  PasswordResetRequest,
  AuthSession,
} from '../types/auth.ts';
import { OWNER_EMAIL } from '../utils/permissions.ts';
import {
  syncSchoolToFirestore,
  syncSchoolProfileToFirestore,
  syncUserToFirestore,
} from './firestoreSync.ts';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'school.db');
const JSON_BACKUP_PATH = path.join(DATA_DIR, 'school_store.json');
const AUTH_SECRET_PATH = path.join(DATA_DIR, 'auth_secret.key');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let AUTH_SECRET = 'edupro_session_master_signing_key_2026_k8x7_auth';
try {
  if (fs.existsSync(AUTH_SECRET_PATH)) {
    const existingKey = fs.readFileSync(AUTH_SECRET_PATH, 'utf-8').trim();
    if (existingKey) AUTH_SECRET = existingKey;
  } else {
    AUTH_SECRET = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(AUTH_SECRET_PATH, AUTH_SECRET, 'utf-8');
  }
} catch {
  // Use robust static fallback if filesystem write is blocked
}

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA cache_size = -64000;');
db.exec('PRAGMA temp_store = MEMORY;');

// Core Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS school_info (
    id TEXT PRIMARY KEY,
    schoolName TEXT NOT NULL,
    schoolNameUrdu TEXT,
    board TEXT NOT NULL,
    principal TEXT NOT NULL,
    introduction TEXT NOT NULL,
    campusAddress TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    availableClasses TEXT NOT NULL,
    academicSessions TEXT NOT NULL,
    activeSession TEXT NOT NULL,
    logoUrl TEXT,
    campusPicUrl TEXT,
    stampUrl TEXT
  );

  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    admissionNumber TEXT UNIQUE NOT NULL,
    fullName TEXT NOT NULL,
    fatherName TEXT NOT NULL,
    photoUrl TEXT,
    dob TEXT NOT NULL,
    gender TEXT NOT NULL,
    studentClass TEXT NOT NULL,
    admissionDate TEXT NOT NULL,
    mobileNumber TEXT NOT NULL,
    address TEXT NOT NULL,
    session TEXT NOT NULL,
    admissionFee REAL NOT NULL,
    createdAt TEXT NOT NULL,
    isDeleted INTEGER DEFAULT 0,
    deletedAt TEXT,
    deletedBy TEXT
  );

  CREATE TABLE IF NOT EXISTS vouchers (
    id TEXT PRIMARY KEY,
    voucherNumber TEXT UNIQUE NOT NULL,
    studentId TEXT NOT NULL,
    admissionNumber TEXT NOT NULL,
    studentName TEXT NOT NULL,
    fatherName TEXT NOT NULL,
    studentClass TEXT NOT NULL,
    session TEXT NOT NULL,
    feeAmount REAL NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('UNPAID', 'PAID')),
    issueDate TEXT NOT NULL,
    dueDate TEXT NOT NULL,
    paidAt TEXT,
    updatedBy TEXT,
    updatedAt TEXT NOT NULL,
    notes TEXT,
    isDeleted INTEGER DEFAULT 0,
    deletedAt TEXT,
    deletedBy TEXT
  );

  CREATE TABLE IF NOT EXISTS voucher_audit_log (
    id TEXT PRIMARY KEY,
    voucherId TEXT NOT NULL,
    voucherNumber TEXT NOT NULL,
    previousStatus TEXT NOT NULL,
    newStatus TEXT NOT NULL,
    changedBy TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS staff (
    id TEXT PRIMARY KEY,
    staffIdNumber TEXT,
    fullName TEXT NOT NULL,
    fatherName TEXT NOT NULL,
    designation TEXT NOT NULL,
    department TEXT DEFAULT 'General',
    role TEXT NOT NULL,
    cnic TEXT NOT NULL,
    mobileNumber TEXT NOT NULL,
    email TEXT NOT NULL,
    joiningDate TEXT NOT NULL,
    qualification TEXT NOT NULL,
    monthlySalary REAL NOT NULL,
    status TEXT NOT NULL,
    address TEXT NOT NULL,
    emergencyContact TEXT,
    photoUrl TEXT,
    isDeleted INTEGER DEFAULT 0,
    deletedAt TEXT,
    deletedBy TEXT
  );

  CREATE TABLE IF NOT EXISTS certificates (
    id TEXT PRIMARY KEY,
    certificateNumber TEXT UNIQUE NOT NULL,
    recipientType TEXT NOT NULL,
    recipientId TEXT NOT NULL,
    recipientName TEXT NOT NULL,
    fatherName TEXT NOT NULL,
    referenceNumber TEXT NOT NULL,
    className TEXT,
    certificateType TEXT NOT NULL,
    issueDate TEXT NOT NULL,
    session TEXT NOT NULL,
    remarks TEXT,
    conduct TEXT,
    reasonForLeaving TEXT,
    isDeleted INTEGER DEFAULT 0,
    deletedAt TEXT,
    deletedBy TEXT
  );

  CREATE TABLE IF NOT EXISTS exam_results (
    id TEXT PRIMARY KEY,
    studentId TEXT NOT NULL,
    studentName TEXT NOT NULL,
    fatherName TEXT NOT NULL,
    admissionNumber TEXT NOT NULL,
    studentClass TEXT NOT NULL,
    session TEXT NOT NULL,
    examTerm TEXT NOT NULL,
    totalMarks REAL NOT NULL,
    obtainedMarks REAL NOT NULL,
    percentage REAL NOT NULL,
    grade TEXT NOT NULL,
    remarks TEXT,
    subjects TEXT NOT NULL,
    isDeleted INTEGER DEFAULT 0,
    deletedAt TEXT,
    deletedBy TEXT
  );

  CREATE TABLE IF NOT EXISTS staff_letters (
    id TEXT PRIMARY KEY,
    letterType TEXT NOT NULL,
    letterNumber TEXT UNIQUE NOT NULL,
    staffId TEXT NOT NULL,
    staffName TEXT NOT NULL,
    fatherName TEXT NOT NULL,
    staffIdNumber TEXT NOT NULL,
    designation TEXT NOT NULL,
    department TEXT NOT NULL,
    joiningDate TEXT NOT NULL,
    effectiveDate TEXT NOT NULL,
    lastWorkingDay TEXT,
    reason TEXT,
    contentBody TEXT NOT NULL,
    issueDate TEXT NOT NULL,
    authorizedSignatory TEXT NOT NULL,
    isDeleted INTEGER DEFAULT 0,
    deletedAt TEXT,
    deletedBy TEXT
  );

  CREATE TABLE IF NOT EXISTS general_audit_log (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    entityType TEXT NOT NULL,
    entityId TEXT NOT NULL,
    referenceNumber TEXT NOT NULL,
    performedBy TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    details TEXT
  );
`);

// Schema Migrations (safely add columns if older database version exists)
const safeAddCol = (table: string, col: string, def: string) => {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def};`);
  } catch {}
};

safeAddCol('school_info', 'schoolNameUrdu', 'TEXT');
safeAddCol('school_info', 'logoUrl', 'TEXT');
safeAddCol('school_info', 'campusPicUrl', 'TEXT');
safeAddCol('school_info', 'stampUrl', 'TEXT');
safeAddCol('school_info', 'schoolCode', "TEXT DEFAULT 'SCH001'");
safeAddCol('school_info', 'status', "TEXT DEFAULT 'ACTIVE'");
safeAddCol('school_info', 'adminEmail', 'TEXT');
safeAddCol('school_info', 'adminName', 'TEXT');
safeAddCol('school_info', 'website', 'TEXT');
safeAddCol('school_info', 'principalPhotoUrl', 'TEXT');
safeAddCol('school_info', 'createdAt', 'TEXT');
safeAddCol('school_info', 'updatedAt', 'TEXT');

safeAddCol('students', 'schoolId', "TEXT NOT NULL DEFAULT 'school_primary'");
safeAddCol('vouchers', 'schoolId', "TEXT NOT NULL DEFAULT 'school_primary'");
safeAddCol('staff', 'schoolId', "TEXT NOT NULL DEFAULT 'school_primary'");
safeAddCol('certificates', 'schoolId', "TEXT NOT NULL DEFAULT 'school_primary'");
safeAddCol('exam_results', 'schoolId', "TEXT NOT NULL DEFAULT 'school_primary'");
safeAddCol('staff_letters', 'schoolId', "TEXT NOT NULL DEFAULT 'school_primary'");
safeAddCol('class_sections', 'schoolId', "TEXT NOT NULL DEFAULT 'school_primary'");
safeAddCol('student_history', 'schoolId', "TEXT NOT NULL DEFAULT 'school_primary'");
safeAddCol('class_fee_configs', 'schoolId', "TEXT NOT NULL DEFAULT 'school_primary'");

safeAddCol('students', 'isDeleted', 'INTEGER DEFAULT 0');
safeAddCol('students', 'deletedAt', 'TEXT');
safeAddCol('students', 'deletedBy', 'TEXT');

safeAddCol('vouchers', 'isDeleted', 'INTEGER DEFAULT 0');
safeAddCol('vouchers', 'deletedAt', 'TEXT');
safeAddCol('vouchers', 'deletedBy', 'TEXT');

safeAddCol('staff', 'staffIdNumber', 'TEXT');
safeAddCol('staff', 'department', "TEXT DEFAULT 'General'");
safeAddCol('staff', 'emergencyContact', 'TEXT');
safeAddCol('staff', 'isDeleted', 'INTEGER DEFAULT 0');
safeAddCol('staff', 'deletedAt', 'TEXT');
safeAddCol('staff', 'deletedBy', 'TEXT');

safeAddCol('certificates', 'isDeleted', 'INTEGER DEFAULT 0');
safeAddCol('certificates', 'deletedAt', 'TEXT');
safeAddCol('certificates', 'deletedBy', 'TEXT');

safeAddCol('exam_results', 'isDeleted', 'INTEGER DEFAULT 0');
safeAddCol('exam_results', 'deletedAt', 'TEXT');
safeAddCol('exam_results', 'deletedBy', 'TEXT');

// Student extended columns (Module 1, 2, 3, 4, 5)
safeAddCol('students', 'motherName', 'TEXT');
safeAddCol('students', 'previousSchool', 'TEXT');
safeAddCol('students', 'section', "TEXT DEFAULT 'A'");
safeAddCol('students', 'previousClass', 'TEXT');
safeAddCol('students', 'previousRollNumber', 'TEXT');
safeAddCol('students', 'rollNumber', 'TEXT');
safeAddCol('students', 'fatherCnic', 'TEXT');
safeAddCol('students', 'motherCnic', 'TEXT');
safeAddCol('students', 'motherMobileNumber', 'TEXT');
safeAddCol('students', 'emergencyContactPerson', 'TEXT');
safeAddCol('students', 'emergencyContactNumber', 'TEXT');
safeAddCol('students', 'relationship', 'TEXT');
safeAddCol('students', 'status', "TEXT DEFAULT 'Enrolled'");
safeAddCol('students', 'isPassOut', 'INTEGER DEFAULT 0');
safeAddCol('students', 'passOutDate', 'TEXT');
safeAddCol('students', 'passOutSession', 'TEXT');
safeAddCol('students', 'permanentStudentId', 'TEXT');

// Voucher itemized fee columns (Module 6)
safeAddCol('vouchers', 'tuitionFee', 'REAL DEFAULT 0');
safeAddCol('vouchers', 'admissionFeeItem', 'REAL DEFAULT 0');
safeAddCol('vouchers', 'annualCharges', 'REAL DEFAULT 0');
safeAddCol('vouchers', 'examFee', 'REAL DEFAULT 0');
safeAddCol('vouchers', 'otherCharges', 'REAL DEFAULT 0');
safeAddCol('vouchers', 'fine', 'REAL DEFAULT 0');
safeAddCol('vouchers', 'discount', 'REAL DEFAULT 0');
safeAddCol('vouchers', 'subtotal', 'REAL DEFAULT 0');
safeAddCol('vouchers', 'totalPayable', 'REAL DEFAULT 0');
safeAddCol('vouchers', 'amountPaid', 'REAL DEFAULT 0');
safeAddCol('vouchers', 'balanceDue', 'REAL DEFAULT 0');
safeAddCol('vouchers', 'billingMonth', 'TEXT');
safeAddCol('vouchers', 'rollNumber', 'TEXT');
safeAddCol('vouchers', 'section', "TEXT DEFAULT 'A'");
safeAddCol('vouchers', 'isManualStudent', 'INTEGER DEFAULT 0');

// Staff letter manual fields
safeAddCol('staff_letters', 'isManualStaff', 'INTEGER DEFAULT 0');
safeAddCol('staff_letters', 'cnic', 'TEXT');
safeAddCol('staff_letters', 'subjectTitle', 'TEXT');

// Tables for Sections, History, Fee Configs
db.exec(`
  CREATE TABLE IF NOT EXISTS class_sections (
    className TEXT PRIMARY KEY,
    sectionsJson TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS student_history (
    id TEXT PRIMARY KEY,
    studentId TEXT NOT NULL,
    eventType TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    detailsJson TEXT,
    fromSession TEXT,
    toSession TEXT,
    fromClass TEXT,
    toClass TEXT,
    fromSection TEXT,
    toSection TEXT,
    fromRollNumber TEXT,
    toRollNumber TEXT,
    fromStatus TEXT,
    toStatus TEXT,
    performedBy TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    reason TEXT
  );

  CREATE TABLE IF NOT EXISTS class_fee_configs (
    id TEXT PRIMARY KEY,
    className TEXT NOT NULL,
    session TEXT NOT NULL,
    tuitionFee REAL DEFAULT 0,
    admissionFee REAL DEFAULT 0,
    annualCharges REAL DEFAULT 0,
    examFee REAL DEFAULT 0,
    otherCharges REAL DEFAULT 0,
    defaultFine REAL DEFAULT 0,
    defaultDiscount REAL DEFAULT 0,
    UNIQUE(className, session)
  );

  CREATE TABLE IF NOT EXISTS app_users (
    uid TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL,
    schoolId TEXT NOT NULL DEFAULT 'school_primary',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    passwordHash TEXT NOT NULL,
    isTemporaryPassword INTEGER DEFAULT 0,
    requiresPasswordChange INTEGER DEFAULT 0,
    tempPasswordPlain TEXT,
    isTestAccount INTEGER DEFAULT 0,
    isOwner INTEGER DEFAULT 0,
    createdBy TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    lastLoginAt TEXT
  );

  CREATE TABLE IF NOT EXISTS user_invitations (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT,
    role TEXT NOT NULL,
    schoolId TEXT NOT NULL DEFAULT 'school_primary',
    status TEXT NOT NULL DEFAULT 'PENDING',
    inviteToken TEXT NOT NULL,
    invitedBy TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    expiresAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS security_audit_logs (
    id TEXT PRIMARY KEY,
    actingUid TEXT NOT NULL,
    actingEmail TEXT NOT NULL,
    action TEXT NOT NULL,
    targetUid TEXT,
    targetEmail TEXT,
    role TEXT,
    timestamp TEXT NOT NULL,
    details TEXT,
    status TEXT NOT NULL DEFAULT 'SUCCESS',
    ipAddress TEXT
  );

  CREATE TABLE IF NOT EXISTS system_security_settings (
    id TEXT PRIMARY KEY,
    softwareName TEXT NOT NULL,
    ownerEmail TEXT NOT NULL,
    allowPublicRegistrations INTEGER DEFAULT 0,
    sessionTimeoutMinutes INTEGER DEFAULT 60,
    enforceTemporaryPasswordChange INTEGER DEFAULT 1,
    maxFailedLoginsBeforeLock INTEGER DEFAULT 5,
    updatedAt TEXT NOT NULL,
    updatedBy TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS password_reset_requests (
    id TEXT PRIMARY KEY,
    uid TEXT,
    email TEXT NOT NULL,
    userName TEXT NOT NULL,
    userRole TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    temporaryPassword TEXT,
    requestedAt TEXT NOT NULL,
    resolvedAt TEXT,
    resolvedBy TEXT,
    rejectionReason TEXT
  );

  CREATE TABLE IF NOT EXISTS active_sessions (
    token TEXT PRIMARY KEY,
    uid TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    lastActiveAt TEXT NOT NULL,
    ipAddress TEXT,
    userAgent TEXT
  );

  CREATE TABLE IF NOT EXISTS revoked_sessions (
    token TEXT PRIMARY KEY,
    revokedAt TEXT NOT NULL,
    reason TEXT
  );
`);


// Backfill existing student and multi-school data with defaults
try {
  db.exec(`
    UPDATE school_info SET schoolCode = 'SCH001' WHERE (schoolCode IS NULL OR schoolCode = '') AND id = 'school_primary';
    UPDATE school_info SET status = 'ACTIVE' WHERE status IS NULL OR status = '';
    UPDATE school_info SET subscriptionPlan = 'Enterprise' WHERE subscriptionPlan IS NULL OR subscriptionPlan = '';
    UPDATE school_info SET adminEmail = 'ahmadwaheedahmad57@gmail.com' WHERE (adminEmail IS NULL OR adminEmail = '') AND id = 'school_primary';
    UPDATE school_info SET adminName = 'Ahmad Waheed Ahmad (Super Admin)' WHERE (adminName IS NULL OR adminName = '') AND id = 'school_primary';
    UPDATE school_info SET createdAt = '2026-01-01T00:00:00.000Z' WHERE createdAt IS NULL OR createdAt = '';
    UPDATE school_info SET updatedAt = datetime('now') WHERE updatedAt IS NULL OR updatedAt = '';
    UPDATE students SET permanentStudentId = admissionNumber WHERE permanentStudentId IS NULL OR permanentStudentId = '';
    UPDATE students SET section = 'A' WHERE section IS NULL OR section = '';
    UPDATE students SET status = 'Enrolled' WHERE status IS NULL OR status = '';
    UPDATE students SET isPassOut = 0 WHERE isPassOut IS NULL;
    UPDATE students SET schoolId = 'school_primary' WHERE schoolId IS NULL OR schoolId = '';
    UPDATE vouchers SET subtotal = feeAmount WHERE subtotal IS NULL OR subtotal = 0;
    UPDATE vouchers SET totalPayable = feeAmount WHERE totalPayable IS NULL OR totalPayable = 0;
    UPDATE vouchers SET balanceDue = CASE WHEN status = 'PAID' THEN 0 ELSE feeAmount END WHERE balanceDue IS NULL;
    UPDATE vouchers SET amountPaid = CASE WHEN status = 'PAID' THEN feeAmount ELSE 0 END WHERE amountPaid IS NULL;
    UPDATE vouchers SET section = 'A' WHERE section IS NULL OR section = '';
    UPDATE vouchers SET schoolId = 'school_primary' WHERE schoolId IS NULL OR schoolId = '';
    UPDATE staff SET schoolId = 'school_primary' WHERE schoolId IS NULL OR schoolId = '';
    UPDATE certificates SET schoolId = 'school_primary' WHERE schoolId IS NULL OR schoolId = '';
    UPDATE exam_results SET schoolId = 'school_primary' WHERE schoolId IS NULL OR schoolId = '';
    UPDATE staff_letters SET schoolId = 'school_primary' WHERE schoolId IS NULL OR schoolId = '';
    UPDATE student_history SET schoolId = 'school_primary' WHERE schoolId IS NULL OR schoolId = '';
    UPDATE class_fee_configs SET schoolId = 'school_primary' WHERE schoolId IS NULL OR schoolId = '';
  `);
} catch {}

// Performance & Multi-Tenant Indexes for fast lookup
try {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_email ON app_users(email);
    CREATE INDEX IF NOT EXISTS idx_users_phone ON app_users(phone);
    CREATE INDEX IF NOT EXISTS idx_users_school ON app_users(schoolId);
    CREATE INDEX IF NOT EXISTS idx_users_status ON app_users(status);

    CREATE INDEX IF NOT EXISTS idx_sessions_token ON active_sessions(token);
    CREATE INDEX IF NOT EXISTS idx_sessions_uid ON active_sessions(uid);
    CREATE INDEX IF NOT EXISTS idx_sessions_exp ON active_sessions(expiresAt);

    CREATE INDEX IF NOT EXISTS idx_students_school_del ON students(schoolId, isDeleted);
    CREATE INDEX IF NOT EXISTS idx_students_class_school ON students(studentClass, schoolId);
    CREATE INDEX IF NOT EXISTS idx_students_adm ON students(admissionNumber);
    CREATE INDEX IF NOT EXISTS idx_students_del ON students(isDeleted);
    CREATE INDEX IF NOT EXISTS idx_student_status ON students(status);
    CREATE INDEX IF NOT EXISTS idx_student_passout ON students(isPassOut);
    CREATE INDEX IF NOT EXISTS idx_student_history ON student_history(studentId);

    CREATE INDEX IF NOT EXISTS idx_vouchers_school_del ON vouchers(schoolId, isDeleted);
    CREATE INDEX IF NOT EXISTS idx_vouchers_status_school ON vouchers(status, schoolId);
    CREATE INDEX IF NOT EXISTS idx_vouchers_student ON vouchers(studentId);
    CREATE INDEX IF NOT EXISTS idx_vouchers_num ON vouchers(voucherNumber);
    CREATE INDEX IF NOT EXISTS idx_vouchers_del ON vouchers(isDeleted);

    CREATE INDEX IF NOT EXISTS idx_staff_school_del ON staff(schoolId, isDeleted);
    CREATE INDEX IF NOT EXISTS idx_staff_del ON staff(isDeleted);

    CREATE INDEX IF NOT EXISTS idx_certs_school_del ON certificates(schoolId, isDeleted);
    CREATE INDEX IF NOT EXISTS idx_certs_del ON certificates(isDeleted);

    CREATE INDEX IF NOT EXISTS idx_exams_school_del ON exam_results(schoolId, isDeleted);
    CREATE INDEX IF NOT EXISTS idx_exams_del ON exam_results(isDeleted);

    CREATE INDEX IF NOT EXISTS idx_staff_letters_del ON staff_letters(isDeleted);
    CREATE INDEX IF NOT EXISTS idx_school_code ON school_info(schoolCode);
  `);
} catch {}

export const DEFAULT_SCHOOL_PROFILE: SchoolProfile = {
  schoolName: 'Siqarah Public Model High School Shorkot',
  schoolNameUrdu: '',
  board: 'BISE Gujranwala',
  principal: 'Dr. Saeed Ahmad',
  introduction:
    'Siqarah Public Model High School Shorkot is committed to providing quality education, developing strong moral values, maintaining discipline, and nurturing students’ academic and practical abilities. Our mission is to prepare students for a successful future through knowledge, confidence, responsibility, and continuous learning.',
  campusAddress: 'Main Circular Road, Model Town, Shorkot, Punjab, Pakistan',
  phone: '+92 47 5310921 / +92 300 7589214',
  email: 'admissions@siqarah-shorkot.edu.pk',
  availableClasses: [
    'Play Group',
    'Nursery',
    'Prep',
    'Class 1',
    'Class 2',
    'Class 3',
    'Class 4',
    'Class 5',
    'Class 6',
    'Class 7',
    'Class 8',
    'Class 9',
    'Class 10',
  ],
  academicSessions: ['2026-2027', '2025-2026', '2024-2025'],
  activeSession: '2026-2027',
  logoUrl: '/assets/school_logo.jpg',
  campusPicUrl: '/assets/school_building.jpg',
  stampUrl: '/assets/school_stamp.jpg',
};

// Seed or update school profile
const existingSchool = db.prepare('SELECT * FROM school_info LIMIT 1').get() as any;
if (!existingSchool) {
  const insertSchoolStmt = db.prepare(`
    INSERT INTO school_info (
      id, schoolName, schoolNameUrdu, board, principal, introduction, campusAddress,
      phone, email, availableClasses, academicSessions, activeSession, logoUrl, campusPicUrl, stampUrl
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  (insertSchoolStmt as any).run(
    'school_primary',
    DEFAULT_SCHOOL_PROFILE.schoolName,
    DEFAULT_SCHOOL_PROFILE.schoolNameUrdu,
    DEFAULT_SCHOOL_PROFILE.board,
    DEFAULT_SCHOOL_PROFILE.principal,
    DEFAULT_SCHOOL_PROFILE.introduction,
    DEFAULT_SCHOOL_PROFILE.campusAddress,
    DEFAULT_SCHOOL_PROFILE.phone,
    DEFAULT_SCHOOL_PROFILE.email,
    JSON.stringify(DEFAULT_SCHOOL_PROFILE.availableClasses),
    JSON.stringify(DEFAULT_SCHOOL_PROFILE.academicSessions),
    DEFAULT_SCHOOL_PROFILE.activeSession,
    DEFAULT_SCHOOL_PROFILE.logoUrl || '',
    DEFAULT_SCHOOL_PROFILE.campusPicUrl || '',
    DEFAULT_SCHOOL_PROFILE.stampUrl || ''
  );
}

// Seed Staff if empty
const staffCountRow = db.prepare('SELECT COUNT(*) as count FROM staff WHERE isDeleted = 0').get() as { count: number };
if (staffCountRow.count === 0) {
  const seedStaff = [
    {
      id: 'stf_001',
      staffIdNumber: 'STF-2026-0001',
      fullName: 'Dr. Saeed Ahmad',
      fatherName: 'Haji Ahmad Din',
      designation: 'Principal & Academic Director',
      department: 'Administration',
      role: 'Administrative' as const,
      cnic: '33202-1489201-1',
      mobileNumber: '0300-7589214',
      email: 'principal@siqarah-shorkot.edu.pk',
      joiningDate: '2015-08-01',
      qualification: 'Ph.D. Education, M.Sc. Physics (Punjab University)',
      monthlySalary: 125000,
      status: 'ACTIVE' as const,
      address: 'Model Town, Shorkot City',
      emergencyContact: '0300-7589215',
      photoUrl: '',
    },
    {
      id: 'stf_002',
      staffIdNumber: 'STF-2026-0002',
      fullName: 'Muhammad Usman Tariq',
      fatherName: 'Tariq Hussain',
      designation: 'Senior Science Teacher (Physics & Math)',
      department: 'Science',
      role: 'Teaching' as const,
      cnic: '33202-8921405-3',
      mobileNumber: '0301-4829103',
      email: 'usman.tariq@siqarah-shorkot.edu.pk',
      joiningDate: '2018-03-15',
      qualification: 'M.Sc. Physics, B.Ed. (BISE Gujranwala / PU)',
      monthlySalary: 65000,
      status: 'ACTIVE' as const,
      address: 'Officers Colony, Shorkot',
      emergencyContact: '0301-4829104',
      photoUrl: '',
    },
    {
      id: 'stf_003',
      staffIdNumber: 'STF-2026-0003',
      fullName: 'Hafiz Abdul Ghafoor',
      fatherName: 'Noor Muhammad',
      designation: 'Senior Islamic Studies & Urdu Lecturer',
      department: 'Humanities',
      role: 'Teaching' as const,
      cnic: '33202-3910248-7',
      mobileNumber: '0303-9182374',
      email: 'ghafoor@siqarah-shorkot.edu.pk',
      joiningDate: '2019-09-01',
      qualification: 'M.A. Islamic Studies, M.A. Urdu, Shahadat-ul-Almiya',
      monthlySalary: 58000,
      status: 'ACTIVE' as const,
      address: 'Railway Road, Shorkot Cantt',
      emergencyContact: '0303-9182375',
      photoUrl: '',
    },
    {
      id: 'stf_004',
      staffIdNumber: 'STF-2026-0004',
      fullName: 'Muhammad Rizwan',
      fatherName: 'Muhammad Akram',
      designation: 'Head Accounts Officer & Registrar',
      department: 'Accounts',
      role: 'Administrative' as const,
      cnic: '33202-7102934-5',
      mobileNumber: '0345-7182901',
      email: 'accounts@siqarah-shorkot.edu.pk',
      joiningDate: '2020-01-10',
      qualification: 'M.Com, MBA Finance',
      monthlySalary: 52000,
      status: 'ACTIVE' as const,
      address: 'Mohallah Farooqia, Shorkot',
      emergencyContact: '0345-7182902',
      photoUrl: '',
    },
  ];

  const insertStaff = db.prepare(`
    INSERT INTO staff (
      id, staffIdNumber, fullName, fatherName, designation, department, role, cnic, mobileNumber,
      email, joiningDate, qualification, monthlySalary, status, address, emergencyContact, photoUrl, isDeleted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  seedStaff.forEach((st) => {
    (insertStaff as any).run(
      st.id,
      st.staffIdNumber,
      st.fullName,
      st.fatherName,
      st.designation,
      st.department,
      st.role,
      st.cnic,
      st.mobileNumber,
      st.email,
      st.joiningDate,
      st.qualification,
      st.monthlySalary,
      st.status,
      st.address,
      st.emergencyContact,
      st.photoUrl || ''
    );
  });
}

// Seed the 3 HR Letters if empty
const letterCountRow = db.prepare('SELECT COUNT(*) as count FROM staff_letters WHERE isDeleted = 0').get() as { count: number };
if (letterCountRow.count === 0) {
  const insertLetter = db.prepare(`
    INSERT INTO staff_letters (
      id, letterType, letterNumber, staffId, staffName, fatherName, staffIdNumber,
      designation, department, joiningDate, effectiveDate, lastWorkingDay, reason,
      contentBody, issueDate, authorizedSignatory, isDeleted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  (insertLetter as any).run(
    'ltr_seed_001',
    'EXPERIENCE',
    'EXP-2026-0001',
    'stf_002',
    'Muhammad Usman Tariq',
    'Tariq Hussain',
    'STF-2026-0002',
    'Senior Science Teacher (Physics & Math)',
    'Science',
    '2018-03-15',
    '2026-03-25',
    '',
    '',
    'This is to certify that Muhammad Usman Tariq has served at Siqarah Public Model High School Shorkot with profound pedagogical dedication and exemplary classroom discipline.',
    '2026-03-25',
    'Dr. Saeed Ahmad (Principal)'
  );

  (insertLetter as any).run(
    'ltr_seed_002',
    'DESIGNATION',
    'DES-2026-0001',
    'stf_004',
    'Muhammad Rizwan',
    'Muhammad Akram',
    'STF-2026-0004',
    'Head Accounts Officer & Registrar',
    'Accounts',
    '2020-01-10',
    '2026-01-15',
    '',
    'Annual administrative promotion and designation elevation',
    'Management is pleased to confirm your appointment and designation as Head Accounts Officer & Registrar with effect from January 15, 2026.',
    '2026-01-15',
    'Dr. Saeed Ahmad (Principal)'
  );
}

// Seed initial student records, fee vouchers, and academic history if empty
const studentCountRow = db.prepare('SELECT COUNT(*) as count FROM students WHERE isDeleted = 0').get() as { count: number };
if (studentCountRow.count === 0) {
  const seedStudents = [
    {
      id: 'std_001',
      admissionNumber: 'SPMHS-2026-0001',
      permanentStudentId: 'SPHS-2026-0001',
      fullName: 'Muhammad Ali Raza',
      fatherName: 'Muhammad Aslam',
      photoUrl: '',
      dob: '2010-04-12',
      gender: 'Male',
      studentClass: 'Class 10',
      section: 'A',
      rollNumber: '101',
      previousRollNumber: '901',
      admissionDate: '2024-03-10',
      mobileNumber: '0301-4567890',
      motherMobileNumber: '0301-4567891',
      fatherCnic: '33202-7654321-1',
      motherCnic: '33202-7654321-2',
      emergencyContactPerson: 'Muhammad Aslam',
      emergencyContactNumber: '0301-4567890',
      relationship: 'Father',
      address: 'Mohallah Farooqabad, Shorkot City',
      session: '2026-2027',
      admissionFee: 5000,
      status: 'Enrolled' as const,
      isPassOut: 0,
      createdAt: '2026-03-01T10:00:00.000Z',
    },
    {
      id: 'std_002',
      admissionNumber: 'SPMHS-2026-0002',
      permanentStudentId: 'SPHS-2026-0002',
      fullName: 'Fatima Noor',
      fatherName: 'Tariq Mehmood',
      photoUrl: '',
      dob: '2011-08-20',
      gender: 'Female',
      studentClass: 'Class 9',
      section: 'A',
      rollNumber: '102',
      previousRollNumber: '802',
      admissionDate: '2024-03-12',
      mobileNumber: '0302-9876543',
      motherMobileNumber: '0302-9876544',
      fatherCnic: '33202-1234567-3',
      motherCnic: '33202-1234567-4',
      emergencyContactPerson: 'Tariq Mehmood',
      emergencyContactNumber: '0302-9876543',
      relationship: 'Father',
      address: 'Officers Colony, Shorkot Cantt',
      session: '2026-2027',
      admissionFee: 5000,
      status: 'Enrolled' as const,
      isPassOut: 0,
      createdAt: '2026-03-02T11:00:00.000Z',
    },
    {
      id: 'std_003',
      admissionNumber: 'SPMHS-2026-0003',
      permanentStudentId: 'SPHS-2026-0003',
      fullName: 'Zeeshan Ahmad',
      fatherName: 'Bashir Ahmad',
      photoUrl: '',
      dob: '2015-02-14',
      gender: 'Male',
      studentClass: 'Class 5',
      section: 'B',
      rollNumber: '103',
      previousRollNumber: '',
      admissionDate: '2025-03-01',
      mobileNumber: '0300-1122334',
      motherMobileNumber: '',
      fatherCnic: '33202-9988776-5',
      motherCnic: '',
      emergencyContactPerson: 'Bashir Ahmad',
      emergencyContactNumber: '0300-1122334',
      relationship: 'Father',
      address: 'Circular Road Near Post Office, Shorkot',
      session: '2026-2027',
      admissionFee: 4500,
      status: 'Enrolled' as const,
      isPassOut: 0,
      createdAt: '2026-03-03T09:30:00.000Z',
    },
    {
      id: 'std_004',
      admissionNumber: 'SPMHS-2026-0004',
      permanentStudentId: 'SPHS-2026-0004',
      fullName: 'Ayesha Bibi',
      fatherName: 'Muhammad Rafiq',
      photoUrl: '',
      dob: '2019-06-18',
      gender: 'Female',
      studentClass: 'Class 1',
      section: 'A',
      rollNumber: '104',
      previousRollNumber: '',
      admissionDate: '2026-03-15',
      mobileNumber: '0303-5566778',
      motherMobileNumber: '',
      fatherCnic: '33202-3344556-7',
      motherCnic: '',
      emergencyContactPerson: 'Muhammad Rafiq',
      emergencyContactNumber: '0303-5566778',
      relationship: 'Father',
      address: 'Gulshan-e-Iqbal, Shorkot',
      session: '2026-2027',
      admissionFee: 4000,
      status: 'Enrolled' as const,
      isPassOut: 0,
      createdAt: '2026-03-04T12:00:00.000Z',
    },
    {
      id: 'std_005',
      admissionNumber: 'SPMHS-2026-0005',
      permanentStudentId: 'SPHS-2026-0005',
      fullName: 'Hamza Bilal',
      fatherName: 'Bilal Akhtar',
      photoUrl: '',
      dob: '2010-11-05',
      gender: 'Male',
      studentClass: 'Class 10',
      section: 'B',
      rollNumber: '105',
      previousRollNumber: '',
      admissionDate: '2024-04-01',
      mobileNumber: '0304-9988776',
      motherMobileNumber: '',
      fatherCnic: '33202-5566778-9',
      motherCnic: '',
      emergencyContactPerson: 'Bilal Akhtar',
      emergencyContactNumber: '0304-9988776',
      relationship: 'Father',
      address: 'Rail Bazar, Shorkot',
      session: '2026-2027',
      admissionFee: 5000,
      status: 'Enrolled' as const,
      isPassOut: 0,
      createdAt: '2026-03-05T14:00:00.000Z',
    },
    {
      id: 'std_006',
      admissionNumber: 'SPMHS-2025-0099',
      permanentStudentId: 'SPHS-2025-0099',
      fullName: 'Usman Khalid',
      fatherName: 'Khalid Mehmood',
      photoUrl: '',
      dob: '2008-09-15',
      gender: 'Male',
      studentClass: 'Class 10',
      section: 'A',
      rollNumber: '199',
      previousRollNumber: '',
      admissionDate: '2023-03-20',
      mobileNumber: '0305-1234567',
      motherMobileNumber: '',
      fatherCnic: '33202-8877665-1',
      motherCnic: '',
      emergencyContactPerson: 'Khalid Mehmood',
      emergencyContactNumber: '0305-1234567',
      relationship: 'Father',
      address: 'Civil Lines, Shorkot',
      session: '2024-2025',
      admissionFee: 4500,
      status: 'SLC' as const,
      isPassOut: 1,
      passOutDate: '2025-05-20',
      passOutSession: '2024-2025',
      createdAt: '2025-03-01T10:00:00.000Z',
    },
  ];

  const insertStudent = db.prepare(`
    INSERT INTO students (
      id, admissionNumber, permanentStudentId, fullName, fatherName, photoUrl, dob, gender,
      studentClass, section, rollNumber, previousRollNumber, admissionDate, mobileNumber,
      motherMobileNumber, fatherCnic, motherCnic, emergencyContactPerson, emergencyContactNumber,
      relationship, address, session, admissionFee, status, isPassOut, passOutDate, passOutSession,
      createdAt, isDeleted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  const insertVoucher = db.prepare(`
    INSERT INTO vouchers (
      id, voucherNumber, studentId, admissionNumber, studentName, fatherName, studentClass,
      session, feeAmount, status, issueDate, dueDate, paidAt, updatedAt, notes,
      tuitionFee, admissionFeeItem, annualCharges, examFee, otherCharges, fine, discount,
      subtotal, totalPayable, amountPaid, balanceDue, billingMonth, rollNumber, section, isDeleted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `);

  const insertHistory = db.prepare(`
    INSERT INTO student_history (
      id, studentId, eventType, title, description, fromSession, toSession,
      fromClass, toClass, fromSection, toSection, fromRollNumber, toRollNumber,
      fromStatus, toStatus, performedBy, timestamp, reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  seedStudents.forEach((st, idx) => {
    (insertStudent as any).run(
      st.id,
      st.admissionNumber,
      st.permanentStudentId,
      st.fullName,
      st.fatherName,
      st.photoUrl,
      st.dob,
      st.gender,
      st.studentClass,
      st.section,
      st.rollNumber,
      st.previousRollNumber || '',
      st.admissionDate,
      st.mobileNumber,
      st.motherMobileNumber || '',
      st.fatherCnic || '',
      st.motherCnic || '',
      st.emergencyContactPerson || '',
      st.emergencyContactNumber || '',
      st.relationship || '',
      st.address,
      st.session,
      st.admissionFee,
      st.status,
      st.isPassOut,
      st.passOutDate || '',
      st.passOutSession || '',
      st.createdAt
    );

    // Initial voucher
    const vchId = `vch_seed_${String(idx + 1).padStart(3, '0')}`;
    const vchNum = `VCH-2026-${String(idx + 1).padStart(4, '0')}`;
    const isPaid = idx % 2 === 0;
    (insertVoucher as any).run(
      vchId,
      vchNum,
      st.id,
      st.admissionNumber,
      st.fullName,
      st.fatherName,
      st.studentClass,
      st.session,
      st.admissionFee,
      isPaid ? 'PAID' : 'UNPAID',
      '2026-03-01',
      '2026-03-15',
      isPaid ? '2026-03-05T12:00:00.000Z' : null,
      '2026-03-01T10:00:00.000Z',
      'Official Admission Fee Voucher',
      0,
      st.admissionFee,
      0,
      0,
      0,
      0,
      0,
      st.admissionFee,
      st.admissionFee,
      isPaid ? st.admissionFee : 0,
      isPaid ? 0 : st.admissionFee,
      'March 2026',
      st.rollNumber,
      st.section
    );

    // Add initial admission history
    (insertHistory as any).run(
      `hist_seed_adm_${st.id}`,
      st.id,
      'ADMISSION',
      'Initial School Admission',
      `Admitted into ${st.studentClass} Section ${st.section} for Academic Session ${st.session}`,
      st.session,
      st.session,
      st.studentClass,
      st.studentClass,
      st.section,
      st.section,
      st.rollNumber,
      st.rollNumber,
      'Enrolled',
      st.status,
      'Dr. Saeed Ahmad (Principal)',
      st.createdAt,
      'Admission granted upon merit and documentation verification'
    );
  });

  // Add historical progression for Muhammad Ali Raza (std_001) in Class 9 (Session 2025-2026)
  (insertHistory as any).run(
    'hist_seed_promo_std_001',
    'std_001',
    'PROMOTION',
    'Promoted to Class 10',
    'Annual academic promotion from Class 9 to Class 10 based on annual examination result',
    '2025-2026',
    '2026-2027',
    'Class 9',
    'Class 10',
    'A',
    'A',
    '901',
    '101',
    'Enrolled',
    'Enrolled',
    'Dr. Saeed Ahmad (Principal)',
    '2026-02-28T09:00:00.000Z',
    'Passed Class 9 with Grade A'
  );
}

// Audit logger helper
export function logGeneralAudit(
  action: string,
  entityType: string,
  entityId: string,
  referenceNumber: string,
  performedBy: string,
  details?: string
): void {
  try {
    const id = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO general_audit_log (id, action, entityType, entityId, referenceNumber, performedBy, timestamp, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, action, entityType, entityId, referenceNumber, performedBy, now, details || '');
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

// Function to save JSON backup
export function syncJsonBackup(): void {
  try {
    const students = db.prepare('SELECT * FROM students WHERE isDeleted = 0 ORDER BY createdAt DESC').all();
    const vouchers = db.prepare('SELECT * FROM vouchers WHERE isDeleted = 0 ORDER BY updatedAt DESC').all();
    const audits = db.prepare('SELECT * FROM voucher_audit_log ORDER BY timestamp DESC').all();
    const staff = db.prepare('SELECT * FROM staff WHERE isDeleted = 0 ORDER BY fullName ASC').all();
    const certificates = db.prepare('SELECT * FROM certificates WHERE isDeleted = 0 ORDER BY issueDate DESC').all();
    const examResults = db.prepare('SELECT * FROM exam_results WHERE isDeleted = 0').all();
    const staffLetters = db.prepare('SELECT * FROM staff_letters WHERE isDeleted = 0').all();
    const schools = db.prepare('SELECT * FROM school_info ORDER BY schoolCode ASC').all();
    let users = db.prepare('SELECT uid, email, name, phone, role, schoolId, status, passwordHash, isTemporaryPassword, requiresPasswordChange, tempPasswordPlain, isTestAccount, isOwner, createdBy, createdAt, updatedAt, lastLoginAt FROM app_users').all();
    const sessions = db.prepare('SELECT * FROM active_sessions').all();
    const school = getSchoolProfile();

    // Guard: Never overwrite existing saved users in backup if SQLite users were momentarily empty during startup
    if (users.length === 0 && fs.existsSync(JSON_BACKUP_PATH)) {
      try {
        const rawExisting = fs.readFileSync(JSON_BACKUP_PATH, 'utf-8');
        if (rawExisting.trim()) {
          const parsed = JSON.parse(rawExisting);
          if (Array.isArray(parsed.users) && parsed.users.length > 0) {
            users = parsed.users;
          }
        }
      } catch {}
    }

    const data = {
      school,
      schools,
      users,
      students,
      vouchers,
      audits,
      staff,
      certificates,
      examResults,
      staffLetters,
      sessions,
      lastSyncedAt: new Date().toISOString(),
    };

    // Atomic write via temporary file + atomic rename to prevent corruption on crash
    const tempBackupPath = `${JSON_BACKUP_PATH}.tmp`;
    fs.writeFileSync(tempBackupPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempBackupPath, JSON_BACKUP_PATH);
  } catch (err) {
    console.error('Failed to sync JSON backup:', err);
  }
}

// School Profile & Multi-School Management
export function getSchoolProfile(schoolId?: string): SchoolProfile {
  const targetId = schoolId || 'school_primary';
  const row = (db.prepare('SELECT * FROM school_info WHERE id = ? OR schoolCode = ?').get(targetId, targetId) ||
    db.prepare('SELECT * FROM school_info WHERE id = ?').get('school_primary')) as any;
  if (!row) return DEFAULT_SCHOOL_PROFILE;

  return {
    schoolName: row.schoolName,
    schoolNameUrdu: row.schoolNameUrdu || DEFAULT_SCHOOL_PROFILE.schoolNameUrdu,
    board: row.board,
    principal: row.principal,
    introduction: row.introduction,
    campusAddress: row.campusAddress,
    phone: row.phone,
    email: row.email,
    availableClasses: JSON.parse(row.availableClasses || '[]'),
    academicSessions: JSON.parse(row.academicSessions || '[]'),
    activeSession: row.activeSession,
    logoUrl: row.logoUrl || DEFAULT_SCHOOL_PROFILE.logoUrl,
    campusPicUrl: row.campusPicUrl || DEFAULT_SCHOOL_PROFILE.campusPicUrl,
    stampUrl: row.stampUrl || DEFAULT_SCHOOL_PROFILE.stampUrl,
    website: row.website || '',
    principalPhotoUrl: row.principalPhotoUrl || '',
    schoolCode: row.schoolCode || 'SCH001',
    status: row.status || 'ACTIVE',
  };
}

export function getSchoolRecord(schoolId: string): SchoolRecord | null {
  const row = db.prepare('SELECT * FROM school_info WHERE id = ? OR schoolCode = ?').get(schoolId, schoolId) as any;
  if (!row) return null;

  return {
    id: row.id,
    schoolCode: row.schoolCode || 'SCH001',
    status: (row.status as 'ACTIVE' | 'INACTIVE') || 'ACTIVE',
    schoolName: row.schoolName,
    schoolNameUrdu: row.schoolNameUrdu || '',
    board: row.board,
    principal: row.principal,
    introduction: row.introduction,
    campusAddress: row.campusAddress,
    phone: row.phone,
    email: row.email,
    availableClasses: JSON.parse(row.availableClasses || '[]'),
    academicSessions: JSON.parse(row.academicSessions || '[]'),
    activeSession: row.activeSession,
    logoUrl: row.logoUrl || '',
    campusPicUrl: row.campusPicUrl || '',
    stampUrl: row.stampUrl || '',
    website: row.website || '',
    principalPhotoUrl: row.principalPhotoUrl || '',
    adminEmail: row.adminEmail || '',
    adminName: row.adminName || '',
    subscriptionPlan: row.subscriptionPlan || 'Enterprise',
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || '',
  };
}

export function getAllSchools(): SchoolRecord[] {
  const rows = db.prepare('SELECT * FROM school_info ORDER BY schoolCode ASC, createdAt ASC').all() as any[];
  return rows.map((row) => ({
    id: row.id,
    schoolCode: row.schoolCode || 'SCH001',
    status: (row.status as 'ACTIVE' | 'INACTIVE') || 'ACTIVE',
    schoolName: row.schoolName,
    schoolNameUrdu: row.schoolNameUrdu || '',
    board: row.board,
    principal: row.principal,
    introduction: row.introduction,
    campusAddress: row.campusAddress,
    phone: row.phone,
    email: row.email,
    availableClasses: JSON.parse(row.availableClasses || '[]'),
    academicSessions: JSON.parse(row.academicSessions || '[]'),
    activeSession: row.activeSession,
    logoUrl: row.logoUrl || '',
    campusPicUrl: row.campusPicUrl || '',
    stampUrl: row.stampUrl || '',
    website: row.website || '',
    principalPhotoUrl: row.principalPhotoUrl || '',
    adminEmail: row.adminEmail || '',
    adminName: row.adminName || '',
    subscriptionPlan: row.subscriptionPlan || 'Enterprise',
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || '',
  }));
}

export function createSchool(data: {
  schoolName: string;
  schoolNameUrdu?: string;
  schoolCode?: string;
  board?: string;
  principal: string;
  introduction?: string;
  campusAddress: string;
  phone: string;
  email: string;
  adminName: string;
  adminEmail: string;
  temporaryPassword?: string;
  subscriptionPlan?: string;
  logoUrl?: string;
  campusPicUrl?: string;
  stampUrl?: string;
  website?: string;
  principalPhotoUrl?: string;
  actingUid?: string;
  actingEmail?: string;
}): { school: SchoolRecord; user: AppUser; tempPasswordPlain: string } {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM school_info').get() as { count: number };
  const nextNum = (countRow?.count || 0) + 1;
  const schoolCode = data.schoolCode?.trim().toUpperCase() || `SCH${String(nextNum).padStart(3, '0')}`;
  const schoolId = `sch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const availableClasses = DEFAULT_SCHOOL_PROFILE.availableClasses;
  const academicSessions = DEFAULT_SCHOOL_PROFILE.academicSessions;
  const activeSession = DEFAULT_SCHOOL_PROFILE.activeSession;

  const principalName = (data.principal || data.adminName || 'Dr. Principal').trim();
  const schoolEmail = (data.email || data.adminEmail || 'admin@school.edu.pk').trim();
  const adminName = (data.adminName || data.principal || 'School Administrator').trim();
  const adminEmail = (data.adminEmail || data.email || 'admin@school.edu.pk').trim().toLowerCase();
  const adminPhone = (data.phone || '').trim();
  const tempPassword = data.temporaryPassword || (data as any).adminPassword || 'SchoolAdmin@2026';

  db.prepare(`
    INSERT INTO school_info (
      id, schoolCode, status, schoolName, schoolNameUrdu, board, principal,
      introduction, campusAddress, phone, email, availableClasses, academicSessions,
      activeSession, logoUrl, campusPicUrl, stampUrl, adminEmail, adminName,
      subscriptionPlan, website, principalPhotoUrl, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    schoolId,
    schoolCode,
    'ACTIVE',
    data.schoolName.trim(),
    data.schoolNameUrdu?.trim() || '',
    data.board?.trim() || 'BISE Faisalabad',
    principalName,
    data.introduction?.trim() || `Welcome to ${data.schoolName.trim()}`,
    data.campusAddress?.trim() || 'Main Campus',
    adminPhone,
    schoolEmail,
    JSON.stringify(availableClasses),
    JSON.stringify(academicSessions),
    activeSession,
    data.logoUrl?.trim() || '',
    data.campusPicUrl || '',
    data.stampUrl || '',
    adminEmail,
    adminName,
    data.subscriptionPlan?.trim() || 'Enterprise',
    data.website?.trim() || '',
    data.principalPhotoUrl?.trim() || '',
    now,
    now
  );

  // Automatically provision the school Administrator in app_users with Principal role
  const userResult = createAppUser({
    name: adminName,
    email: adminEmail,
    phone: adminPhone,
    role: 'Principal',
    temporaryPassword: tempPassword,
    requiresPasswordChange: false,
    schoolId: schoolId,
    actingUid: data.actingUid || 'usr_owner_001',
    actingEmail: data.actingEmail || OWNER_EMAIL,
  });

  logGeneralAudit('CREATE_SCHOOL', 'school', schoolId, schoolCode, data.actingEmail || OWNER_EMAIL, `Provisioned new multi-tenant school "${data.schoolName}" (${schoolCode}) with Principal ${data.adminEmail}`);
  syncJsonBackup();

  const school = getSchoolRecord(schoolId)!;
  syncSchoolToFirestore(school, userResult.user).catch((err) =>
    console.warn('[FirestoreSync] Error syncing new school to Firestore:', err)
  );

  return {
    school,
    user: userResult.user,
    tempPasswordPlain: userResult.temporaryPassword,
  };
}

export function updateSchool(schoolId: string, updates: Partial<SchoolRecord>): SchoolRecord {
  const current = getSchoolRecord(schoolId);
  if (!current) throw new Error('School not found');

  const now = new Date().toISOString();
  const merged: SchoolRecord = {
    ...current,
    ...updates,
    updatedAt: now,
  };

  db.prepare(`
    UPDATE school_info
    SET schoolName = ?,
        schoolNameUrdu = ?,
        board = ?,
        principal = ?,
        introduction = ?,
        campusAddress = ?,
        phone = ?,
        email = ?,
        logoUrl = ?,
        campusPicUrl = ?,
        stampUrl = ?,
        status = ?,
        adminEmail = ?,
        adminName = ?,
        subscriptionPlan = ?,
        updatedAt = ?
    WHERE id = ? OR schoolCode = ?
  `).run(
    merged.schoolName,
    merged.schoolNameUrdu || '',
    merged.board,
    merged.principal,
    merged.introduction,
    merged.campusAddress,
    merged.phone,
    merged.email,
    merged.logoUrl || '',
    merged.campusPicUrl || '',
    merged.stampUrl || '',
    merged.status || 'ACTIVE',
    merged.adminEmail || '',
    merged.adminName || '',
    merged.subscriptionPlan || 'Enterprise',
    now,
    schoolId,
    schoolId
  );

  logGeneralAudit('UPDATE_SCHOOL', 'school', current.id, current.schoolCode, 'Super Admin', `Updated school details for "${merged.schoolName}"`);
  syncJsonBackup();
  const updatedRecord = getSchoolRecord(current.id)!;
  syncSchoolToFirestore(updatedRecord).catch((err) =>
    console.warn('[FirestoreSync] Error syncing updated school to Firestore:', err)
  );
  return updatedRecord;
}

export function toggleSchoolStatus(schoolId: string): SchoolRecord {
  const current = getSchoolRecord(schoolId);
  if (!current) throw new Error('School not found');
  const newStatus = current.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  return updateSchool(schoolId, { status: newStatus });
}

export function updateSchoolProfile(updates: Partial<SchoolProfile>, schoolId?: string): SchoolProfile {
  const targetId = schoolId || 'school_primary';
  const current = getSchoolProfile(targetId);
  const merged: SchoolProfile = {
    ...current,
    ...updates,
  };

  db.prepare(`
    UPDATE school_info
    SET schoolName = ?,
        schoolNameUrdu = ?,
        board = ?,
        principal = ?,
        introduction = ?,
        campusAddress = ?,
        phone = ?,
        email = ?,
        availableClasses = ?,
        academicSessions = ?,
        activeSession = ?,
        logoUrl = ?,
        campusPicUrl = ?,
        stampUrl = ?,
        website = ?,
        principalPhotoUrl = ?,
        updatedAt = datetime('now')
    WHERE id = ? OR schoolCode = ?
  `).run(
    merged.schoolName,
    merged.schoolNameUrdu,
    merged.board,
    merged.principal,
    merged.introduction,
    merged.campusAddress,
    merged.phone,
    merged.email,
    JSON.stringify(merged.availableClasses),
    JSON.stringify(merged.academicSessions),
    merged.activeSession,
    merged.logoUrl || DEFAULT_SCHOOL_PROFILE.logoUrl || '',
    merged.campusPicUrl || DEFAULT_SCHOOL_PROFILE.campusPicUrl || '',
    merged.stampUrl || DEFAULT_SCHOOL_PROFILE.stampUrl || '',
    merged.website || '',
    merged.principalPhotoUrl || '',
    targetId,
    targetId
  );

  syncJsonBackup();
  const resProfile = getSchoolProfile(targetId);
  syncSchoolProfileToFirestore(targetId, resProfile).catch((err) =>
    console.warn('[FirestoreSync] Error syncing updated school profile to Firestore:', err)
  );
  return resProfile;
}

// Students Management
export function getAllStudents(options?: {
  schoolId?: string;
  includePassOut?: boolean;
  session?: string;
  studentClass?: string;
  section?: string;
  status?: string;
}): StudentRecord[] {
  let query = 'SELECT * FROM students WHERE isDeleted = 0';
  const params: any[] = [];

  if (options?.schoolId) {
    query += ' AND schoolId = ?';
    params.push(options.schoolId);
  }
  if (!options?.includePassOut) {
    query += ' AND (isPassOut = 0 OR isPassOut IS NULL)';
  }
  if (options?.session) {
    query += ' AND session = ?';
    params.push(options.session);
  }
  if (options?.studentClass) {
    query += ' AND studentClass = ?';
    params.push(options.studentClass);
  }
  if (options?.section) {
    query += ' AND section = ?';
    params.push(options.section);
  }
  if (options?.status && options.status !== 'ALL') {
    if (options.status === 'Struck Off' || options.status === 'Stuck') {
      query += " AND (status = 'Struck Off' OR status = 'Stuck')";
    } else {
      query += ' AND status = ?';
      params.push(options.status);
    }
  }

  query += ' ORDER BY createdAt DESC';
  return db.prepare(query).all(...params) as unknown as StudentRecord[];
}

export function getStudentById(id: string): StudentRecord | null {
  const row = db.prepare('SELECT * FROM students WHERE id = ?').get(id);
  return (row as unknown as StudentRecord) || null;
}

export function updateStudent(id: string, data: Partial<StudentRecord>): StudentRecord {
  const current = getStudentById(id);
  if (!current) throw new Error('Student not found');

  const fullName = data.fullName !== undefined ? data.fullName.trim() : current.fullName;
  const fatherName = data.fatherName !== undefined ? data.fatherName.trim() : current.fatherName;
  const motherName = data.motherName !== undefined ? data.motherName.trim() : (current.motherName || '');
  const studentClass = data.studentClass !== undefined ? data.studentClass : current.studentClass;
  const section = data.section !== undefined ? data.section.toUpperCase() : (current.section || 'A');
  const rollNumber = data.rollNumber !== undefined ? data.rollNumber : (current.rollNumber || '');
  const mobileNumber = data.mobileNumber !== undefined ? data.mobileNumber.trim() : current.mobileNumber;
  const motherMobileNumber = data.motherMobileNumber !== undefined ? data.motherMobileNumber.trim() : (current.motherMobileNumber || '');
  const address = data.address !== undefined ? data.address.trim() : current.address;
  const dob = data.dob !== undefined ? data.dob : current.dob;
  const gender = data.gender !== undefined ? data.gender : current.gender;
  const session = data.session !== undefined ? data.session : current.session;
  const admissionFee = data.admissionFee !== undefined ? Number(data.admissionFee) : current.admissionFee;
  const photoUrl = data.photoUrl !== undefined ? data.photoUrl : current.photoUrl;
  const previousSchool = data.previousSchool !== undefined ? data.previousSchool : (current.previousSchool || '');
  const previousClass = data.previousClass !== undefined ? data.previousClass : (current.previousClass || '');
  const previousRollNumber = data.previousRollNumber !== undefined ? data.previousRollNumber : (current.previousRollNumber || '');
  const fatherCnic = data.fatherCnic !== undefined ? data.fatherCnic : (current.fatherCnic || '');
  const motherCnic = data.motherCnic !== undefined ? data.motherCnic : (current.motherCnic || '');
  const emergencyContactPerson = data.emergencyContactPerson !== undefined ? data.emergencyContactPerson : (current.emergencyContactPerson || '');
  const emergencyContactNumber = data.emergencyContactNumber !== undefined ? data.emergencyContactNumber : (current.emergencyContactNumber || '');
  const relationship = data.relationship !== undefined ? data.relationship : (current.relationship || '');
  const status = data.status !== undefined ? data.status : (current.status || 'Enrolled');

  db.prepare(`
    UPDATE students
    SET fullName = ?, fatherName = ?, motherName = ?, studentClass = ?, section = ?, rollNumber = ?,
        mobileNumber = ?, motherMobileNumber = ?, address = ?, dob = ?, gender = ?, session = ?,
        admissionFee = ?, photoUrl = ?, previousSchool = ?, previousClass = ?, previousRollNumber = ?,
        fatherCnic = ?, motherCnic = ?, emergencyContactPerson = ?, emergencyContactNumber = ?, relationship = ?, status = ?
    WHERE id = ?
  `).run(
    fullName, fatherName, motherName, studentClass, section, rollNumber,
    mobileNumber, motherMobileNumber, address, dob, gender, session,
    admissionFee, photoUrl || '', previousSchool, previousClass, previousRollNumber,
    fatherCnic, motherCnic, emergencyContactPerson, emergencyContactNumber, relationship, status,
    id
  );

  // Update studentName, fatherName, class, section on linked vouchers
  db.prepare(`
    UPDATE vouchers
    SET studentName = ?, fatherName = ?, studentClass = ?, section = ?, rollNumber = ?
    WHERE studentId = ?
  `).run(fullName, fatherName, studentClass, section, rollNumber, id);

  logGeneralAudit('UPDATE', 'student', id, current.admissionNumber, 'Administrator', 'Updated student demographic and academic data');
  syncJsonBackup();
  return getStudentById(id)!;
}

export function deleteStudent(id: string, adminName: string = 'Dr. Saeed Ahmad', isPermanent = false): boolean {
  const student = getStudentById(id);
  if (!student) return false;

  if (isPermanent) {
    db.prepare('DELETE FROM vouchers WHERE studentId = ?').run(id);
    db.prepare('DELETE FROM students WHERE id = ?').run(id);
    logGeneralAudit('PERMANENT_DELETE', 'student', id, student.admissionNumber, adminName, 'Permanently purged student and vouchers');
  } else {
    const now = new Date().toISOString();
    db.prepare('UPDATE students SET isDeleted = 1, deletedAt = ?, deletedBy = ? WHERE id = ?').run(now, adminName, id);
    db.prepare('UPDATE vouchers SET isDeleted = 1, deletedAt = ?, deletedBy = ? WHERE studentId = ?').run(now, adminName, id);
    logGeneralAudit('SOFT_DELETE', 'student', id, student.admissionNumber, adminName, 'Moved student and linked voucher to Recycle Bin');
  }

  syncJsonBackup();
  return true;
}

export function restoreStudent(id: string): boolean {
  const student = getStudentById(id);
  if (!student) return false;

  db.prepare('UPDATE students SET isDeleted = 0, deletedAt = NULL, deletedBy = NULL WHERE id = ?').run(id);
  db.prepare('UPDATE vouchers SET isDeleted = 0, deletedAt = NULL, deletedBy = NULL WHERE studentId = ?').run(id);
  logGeneralAudit('RESTORE', 'student', id, student.admissionNumber, 'Administrator', 'Restored student from Recycle Bin');
  syncJsonBackup();
  return true;
}

export function getNextAdmissionNumber(schoolId?: string): string {
  const sid = schoolId || 'school_primary';
  const schoolRec = getSchoolRecord(sid);
  const prefix = schoolRec?.schoolCode === 'SCH001' ? 'SPMHS' : (schoolRec?.schoolCode || 'SCH');
  const countRow = db.prepare('SELECT COUNT(*) as count FROM students WHERE schoolId = ?').get(sid) as { count: number };
  const nextNum = (countRow?.count || 0) + 1;
  const currentYear = new Date().getFullYear();
  return `${prefix}-${currentYear}-${String(nextNum).padStart(4, '0')}`;
}

export function getNextVoucherNumber(schoolId?: string): string {
  const sid = schoolId || 'school_primary';
  const countRow = db.prepare('SELECT COUNT(*) as count FROM vouchers WHERE schoolId = ?').get(sid) as { count: number };
  const nextNum = (countRow?.count || 0) + 1;
  const currentYear = new Date().getFullYear();
  return `VCH-${currentYear}-${String(nextNum).padStart(4, '0')}`;
}

export function createAdmission(data: {
  fullName: string;
  fatherName: string;
  motherName?: string;
  photoUrl?: string;
  dob: string;
  gender: 'Male' | 'Female' | 'Other';
  studentClass: string;
  section?: string;
  rollNumber?: string;
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
  admissionFee: number;
  schoolId?: string;
}): { student: StudentRecord; voucher: FeeVoucher } {
  if (!data.fullName || !data.fullName.trim()) throw new Error('Student full name is required');
  if (!data.fatherName || !data.fatherName.trim()) throw new Error("Father's name is required");
  if (!data.dob) throw new Error('Date of birth is required');
  if (!data.gender) throw new Error('Gender is required');
  if (!data.studentClass) throw new Error('Class is required');
  if (!data.mobileNumber || !data.mobileNumber.trim()) throw new Error('Mobile number is required');
  if (!data.address || !data.address.trim()) throw new Error('Home address is required');
  if (!data.session) throw new Error('Academic session is required');
  if (data.admissionFee === undefined || data.admissionFee === null || Number(data.admissionFee) <= 0) {
    throw new Error('Valid admission fee amount must be entered manually by the administrator');
  }

  const effectiveSchoolId = data.schoolId || 'school_primary';

  let admissionNumber = (data.admissionNumber || '').trim();
  if (!admissionNumber) {
    admissionNumber = getNextAdmissionNumber(effectiveSchoolId);
  }

  const existingWithAdm = db.prepare('SELECT id FROM students WHERE admissionNumber = ?').get(admissionNumber);
  if (existingWithAdm) {
    throw new Error(`Admission number '${admissionNumber}' is already registered to another student`);
  }

  const studentId = `std_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const admissionDate = data.admissionDate || now.split('T')[0];
  const feeAmount = Number(data.admissionFee);
  const section = (data.section || 'A').toUpperCase();

  // Auto-assign roll number if not specified
  let rollNumber = (data.rollNumber || '').trim();
  if (!rollNumber) {
    const existingInClass = db.prepare('SELECT COUNT(*) as count FROM students WHERE studentClass = ? AND section = ? AND session = ? AND isDeleted = 0 AND schoolId = ?').get(data.studentClass, section, data.session, effectiveSchoolId) as { count: number };
    rollNumber = String((existingInClass?.count || 0) + 1).padStart(2, '0');
  }

  const permanentStudentId = admissionNumber;

  db.prepare(`
    INSERT INTO students (
      id, admissionNumber, permanentStudentId, fullName, fatherName, motherName, photoUrl, dob, gender,
      studentClass, section, rollNumber, previousSchool, previousClass, previousRollNumber,
      fatherCnic, motherCnic, mobileNumber, motherMobileNumber, emergencyContactPerson, emergencyContactNumber, relationship,
      admissionDate, address, session, admissionFee, status, isPassOut, schoolId, createdAt, isDeleted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Enrolled', 0, ?, ?, 0)
  `).run(
    studentId,
    admissionNumber,
    permanentStudentId,
    data.fullName.trim(),
    data.fatherName.trim(),
    data.motherName ? data.motherName.trim() : '',
    data.photoUrl || '',
    data.dob,
    data.gender,
    data.studentClass,
    section,
    rollNumber,
    data.previousSchool ? data.previousSchool.trim() : '',
    data.previousClass ? data.previousClass.trim() : '',
    data.previousRollNumber ? data.previousRollNumber.trim() : '',
    data.fatherCnic ? data.fatherCnic.trim() : '',
    data.motherCnic ? data.motherCnic.trim() : '',
    data.mobileNumber.trim(),
    data.motherMobileNumber ? data.motherMobileNumber.trim() : '',
    data.emergencyContactPerson ? data.emergencyContactPerson.trim() : '',
    data.emergencyContactNumber ? data.emergencyContactNumber.trim() : '',
    data.relationship ? data.relationship.trim() : '',
    admissionDate,
    data.address.trim(),
    data.session,
    feeAmount,
    effectiveSchoolId,
    now
  );

  // Initial student history log
  addStudentHistory({
    studentId,
    eventType: 'ADMISSION',
    title: 'Student Admission',
    description: `Admitted to ${data.studentClass} (Section ${section}, Roll No: ${rollNumber}) for Academic Session ${data.session}`,
    details: {
      admissionNumber,
      permanentStudentId,
      admissionFee: feeAmount,
      class: data.studentClass,
      section,
      rollNumber,
      schoolId: effectiveSchoolId,
    },
    toSession: data.session,
    toClass: data.studentClass,
    toSection: section,
    toRollNumber: rollNumber,
    toStatus: 'Enrolled',
    performedBy: 'Dr. Saeed Ahmad (Principal)',
    reason: 'Initial admission completed',
    schoolId: effectiveSchoolId,
  });

  const voucherId = `vch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  let voucherNumber = getNextVoucherNumber(effectiveSchoolId);

  let collisionCheck = db.prepare('SELECT id FROM vouchers WHERE voucherNumber = ?').get(voucherNumber);
  while (collisionCheck) {
    voucherNumber = `VCH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    collisionCheck = db.prepare('SELECT id FROM vouchers WHERE voucherNumber = ?').get(voucherNumber);
  }

  const issueDateObj = new Date(admissionDate);
  const dueDateObj = new Date(issueDateObj.getTime() + 15 * 24 * 60 * 60 * 1000);
  const dueDate = dueDateObj.toISOString().split('T')[0];

  db.prepare(`
    INSERT INTO vouchers (
      id, voucherNumber, studentId, admissionNumber, rollNumber, studentName, fatherName,
      studentClass, section, session, billingMonth, tuitionFee, admissionFeeItem, annualCharges, examFee, otherCharges,
      fine, discount, subtotal, totalPayable, amountPaid, balanceDue, feeAmount, status, issueDate, dueDate, paidAt, updatedBy, updatedAt, notes, schoolId, isDeleted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    voucherId,
    voucherNumber,
    studentId,
    admissionNumber,
    rollNumber,
    data.fullName.trim(),
    data.fatherName.trim(),
    data.studentClass,
    section,
    data.session,
    'Admission',
    0,
    feeAmount,
    0,
    0,
    0,
    0,
    0,
    feeAmount,
    feeAmount,
    0,
    feeAmount,
    feeAmount,
    'UNPAID',
    admissionDate,
    dueDate,
    null,
    null,
    now,
    'Generated automatically upon student admission',
    effectiveSchoolId
  );

  db.prepare(`
    INSERT INTO voucher_audit_log (
      id, voucherId, voucherNumber, previousStatus, newStatus, changedBy, timestamp, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    voucherId,
    voucherNumber,
    'NONE',
    'UNPAID',
    'System / Dr. Saeed Ahmad (Principal)',
    now,
    'Automatic voucher issuance upon admission'
  );

  syncJsonBackup();
  return { student: getStudentById(studentId)!, voucher: getVoucherById(voucherId)! };
}

// Vouchers Management
export function getAllVouchers(options?: {
  schoolId?: string;
  search?: string;
  status?: string;
  studentClass?: string;
  session?: string;
}): FeeVoucher[] {
  let query = 'SELECT * FROM vouchers WHERE isDeleted = 0';
  const params: any[] = [];

  if (options?.schoolId) {
    query += ' AND schoolId = ?';
    params.push(options.schoolId);
  }

  if (options?.status && options.status !== 'ALL') {
    query += ' AND status = ?';
    params.push(options.status);
  }

  if (options?.studentClass && options.studentClass !== 'ALL') {
    query += ' AND studentClass = ?';
    params.push(options.studentClass);
  }

  if (options?.session && options.session !== 'ALL') {
    query += ' AND session = ?';
    params.push(options.session);
  }

  query += ' ORDER BY updatedAt DESC';

  let vouchers = db.prepare(query).all(...params) as unknown as FeeVoucher[];

  if (options?.search && options.search.trim()) {
    const s = options.search.trim().toLowerCase();
    vouchers = vouchers.filter((v) => {
      return (
        v.voucherNumber.toLowerCase().includes(s) ||
        v.studentName.toLowerCase().includes(s) ||
        v.fatherName.toLowerCase().includes(s) ||
        v.admissionNumber.toLowerCase().includes(s) ||
        v.studentClass.toLowerCase().includes(s)
      );
    });
  }

  return vouchers;
}

export function getVoucherById(id: string): FeeVoucher | null {
  const row = db.prepare('SELECT * FROM vouchers WHERE id = ? OR voucherNumber = ?').get(id, id);
  return (row as unknown as FeeVoucher) || null;
}

export function updateVoucherStatus(
  voucherId: string,
  newStatus: 'UNPAID' | 'PAID',
  adminName: string = 'Dr. Saeed Ahmad (Principal)',
  notes?: string
): FeeVoucher {
  const current = getVoucherById(voucherId);
  if (!current) throw new Error(`Voucher with ID ${voucherId} not found`);

  const prevStatus = current.status;
  const now = new Date().toISOString();
  const paidAt = newStatus === 'PAID' ? now : null;

  db.prepare(`
    UPDATE vouchers
    SET status = ?, paidAt = ?, updatedBy = ?, updatedAt = ?, notes = ?
    WHERE id = ?
  `).run(
    newStatus,
    paidAt,
    adminName,
    now,
    notes || (newStatus === 'PAID' ? 'Fee payment verified and marked as PAID' : 'Payment status manually updated to UNPAID'),
    current.id
  );

  db.prepare(`
    INSERT INTO voucher_audit_log (
      id, voucherId, voucherNumber, previousStatus, newStatus, changedBy, timestamp, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    current.id,
    current.voucherNumber,
    prevStatus,
    newStatus,
    adminName,
    now,
    notes || `Status manually changed from ${prevStatus} to ${newStatus}`
  );

  syncJsonBackup();
  return getVoucherById(current.id)!;
}

export function deleteVoucher(voucherId: string, adminName = 'Dr. Saeed Ahmad', isPermanent = false): boolean {
  const current = getVoucherById(voucherId);
  if (!current) return false;

  if (isPermanent) {
    db.prepare('DELETE FROM vouchers WHERE id = ?').run(voucherId);
    logGeneralAudit('PERMANENT_DELETE', 'voucher', voucherId, current.voucherNumber, adminName, 'Purged fee voucher permanently');
  } else {
    const now = new Date().toISOString();
    db.prepare('UPDATE vouchers SET isDeleted = 1, deletedAt = ?, deletedBy = ? WHERE id = ?').run(now, adminName, voucherId);
    logGeneralAudit('SOFT_DELETE', 'voucher', voucherId, current.voucherNumber, adminName, 'Archived fee voucher to Recycle Bin');
  }

  syncJsonBackup();
  return true;
}

export function restoreVoucher(voucherId: string): boolean {
  const current = getVoucherById(voucherId);
  if (!current) return false;

  db.prepare('UPDATE vouchers SET isDeleted = 0, deletedAt = NULL, deletedBy = NULL WHERE id = ?').run(voucherId);
  logGeneralAudit('RESTORE', 'voucher', voucherId, current.voucherNumber, 'Administrator', 'Restored fee voucher');
  syncJsonBackup();
  return true;
}

export function getVoucherAuditLog(voucherId: string): VoucherAuditEntry[] {
  return db.prepare('SELECT * FROM voucher_audit_log WHERE voucherId = ? ORDER BY timestamp DESC').all(voucherId) as unknown as VoucherAuditEntry[];
}

// Staff Management
export function getAllStaff(schoolId?: string): StaffRecord[] {
  if (schoolId) {
    return db.prepare('SELECT * FROM staff WHERE isDeleted = 0 AND schoolId = ? ORDER BY fullName ASC').all(schoolId) as unknown as StaffRecord[];
  }
  return db.prepare('SELECT * FROM staff WHERE isDeleted = 0 ORDER BY fullName ASC').all() as unknown as StaffRecord[];
}

export function getStaffById(id: string): StaffRecord | null {
  const row = db.prepare('SELECT * FROM staff WHERE id = ?').get(id);
  return (row as unknown as StaffRecord) || null;
}

export function getNextStaffIdNumber(schoolId?: string): string {
  const sid = schoolId || 'school_primary';
  const countRow = db.prepare('SELECT COUNT(*) as count FROM staff WHERE schoolId = ?').get(sid) as { count: number };
  const nextNum = (countRow?.count || 0) + 1;
  const currentYear = new Date().getFullYear();
  return `STF-${currentYear}-${String(nextNum).padStart(4, '0')}`;
}

export function createStaff(data: Omit<StaffRecord, 'id'>, schoolId?: string): StaffRecord {
  const id = `stf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const effectiveSchoolId = schoolId || data.schoolId || 'school_primary';
  const staffIdNumber = data.staffIdNumber || getNextStaffIdNumber(effectiveSchoolId);

  db.prepare(`
    INSERT INTO staff (
      id, staffIdNumber, fullName, fatherName, designation, department, role, cnic, mobileNumber,
      email, joiningDate, qualification, monthlySalary, status, address, emergencyContact, photoUrl, schoolId, isDeleted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    id,
    staffIdNumber,
    data.fullName.trim(),
    data.fatherName.trim(),
    data.designation.trim(),
    data.department || 'General',
    data.role,
    data.cnic.trim(),
    data.mobileNumber.trim(),
    data.email.trim(),
    data.joiningDate,
    data.qualification.trim(),
    data.monthlySalary || 0,
    data.status,
    data.address.trim(),
    data.emergencyContact || '',
    data.photoUrl || '',
    effectiveSchoolId
  );

  logGeneralAudit('CREATE', 'staff', id, staffIdNumber, 'Administrator', `Registered new staff member ${data.fullName}`);
  syncJsonBackup();
  return getStaffById(id)!;
}

export function updateStaff(id: string, data: Partial<StaffRecord>): StaffRecord {
  const current = getStaffById(id);
  if (!current) throw new Error('Staff member not found');

  const fullName = data.fullName !== undefined ? data.fullName.trim() : current.fullName;
  const fatherName = data.fatherName !== undefined ? data.fatherName.trim() : current.fatherName;
  const designation = data.designation !== undefined ? data.designation.trim() : current.designation;
  const department = data.department !== undefined ? data.department : current.department;
  const role = data.role !== undefined ? data.role : current.role;
  const cnic = data.cnic !== undefined ? data.cnic.trim() : current.cnic;
  const mobileNumber = data.mobileNumber !== undefined ? data.mobileNumber.trim() : current.mobileNumber;
  const email = data.email !== undefined ? data.email.trim() : current.email;
  const qualification = data.qualification !== undefined ? data.qualification.trim() : current.qualification;
  const monthlySalary = data.monthlySalary !== undefined ? Number(data.monthlySalary) : current.monthlySalary;
  const status = data.status !== undefined ? data.status : current.status;
  const address = data.address !== undefined ? data.address.trim() : current.address;
  const emergencyContact = data.emergencyContact !== undefined ? data.emergencyContact.trim() : current.emergencyContact;
  const photoUrl = data.photoUrl !== undefined ? data.photoUrl : current.photoUrl;

  (db.prepare(`
    UPDATE staff
    SET fullName = ?, fatherName = ?, designation = ?, department = ?, role = ?,
        cnic = ?, mobileNumber = ?, email = ?, qualification = ?, monthlySalary = ?,
        status = ?, address = ?, emergencyContact = ?, photoUrl = ?
    WHERE id = ?
  `) as any).run(
    fullName, fatherName, designation, department, role, cnic, mobileNumber,
    email, qualification, monthlySalary, status, address, emergencyContact || '', photoUrl || '', id
  );

  logGeneralAudit('UPDATE', 'staff', id, current.staffIdNumber || id, 'Administrator', `Updated staff record for ${fullName}`);
  syncJsonBackup();
  return getStaffById(id)!;
}

export function deleteStaff(id: string, adminName = 'Dr. Saeed Ahmad', isPermanent = false): boolean {
  const current = getStaffById(id);
  if (!current) return false;

  if (isPermanent) {
    db.prepare('DELETE FROM staff WHERE id = ?').run(id);
    logGeneralAudit('PERMANENT_DELETE', 'staff', id, current.staffIdNumber || id, adminName, 'Purged staff record permanently');
  } else {
    const now = new Date().toISOString();
    db.prepare('UPDATE staff SET isDeleted = 1, deletedAt = ?, deletedBy = ? WHERE id = ?').run(now, adminName, id);
    logGeneralAudit('SOFT_DELETE', 'staff', id, current.staffIdNumber || id, adminName, 'Moved staff record to Recycle Bin');
  }

  syncJsonBackup();
  return true;
}

export function restoreStaff(id: string): boolean {
  const current = getStaffById(id);
  if (!current) return false;

  db.prepare('UPDATE staff SET isDeleted = 0, deletedAt = NULL, deletedBy = NULL WHERE id = ?').run(id);
  logGeneralAudit('RESTORE', 'staff', id, current.staffIdNumber || id, 'Administrator', 'Restored staff record');
  syncJsonBackup();
  return true;
}

// HR & Staff Official Documents (10 Core School ERP Document Types)
export function getAllStaffLetters(letterType?: string, schoolId?: string): StaffEmploymentLetter[] {
  let query = 'SELECT * FROM staff_letters WHERE isDeleted = 0';
  const params: any[] = [];
  if (schoolId) {
    query += ' AND schoolId = ?';
    params.push(schoolId);
  }
  if (letterType && letterType !== 'ALL') {
    query += ' AND letterType = ?';
    params.push(letterType);
  }
  query += ' ORDER BY issueDate DESC';
  return db.prepare(query).all(...params) as unknown as StaffEmploymentLetter[];
}

export function getStaffLetterById(id: string): StaffEmploymentLetter | null {
  const row = db.prepare('SELECT * FROM staff_letters WHERE id = ?').get(id);
  return (row as unknown as StaffEmploymentLetter) || null;
}

export function createStaffLetter(data: Omit<StaffEmploymentLetter, 'id' | 'letterNumber'> & { letterNumber?: string }, schoolId?: string): StaffEmploymentLetter {
  const id = `ltr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const effectiveSchoolId = schoolId || data.schoolId || 'school_primary';
  const countRow = db.prepare('SELECT COUNT(*) as count FROM staff_letters WHERE schoolId = ?').get(effectiveSchoolId) as { count: number };
  
  let prefix = 'DOC';
  switch (data.letterType) {
    case 'APPOINTMENT': prefix = 'APP'; break;
    case 'OFFICIAL_ORDER': prefix = 'ORD'; break;
    case 'TRANSFER_ORDER': prefix = 'TRF'; break;
    case 'RESIGNATION': prefix = 'RES'; break;
    case 'DISCIPLINARY': prefix = 'DIS'; break;
    case 'LEAVE_APPLICATION': prefix = 'LEV'; break;
    case 'EXPERIENCE': prefix = 'EXP'; break;
    case 'SHOW_CAUSE': prefix = 'SCN'; break;
    case 'ABSENCE_WARNING': prefix = 'ABW'; break;
    case 'CLEARANCE_FORM': prefix = 'CLR'; break;
    case 'DESIGNATION': prefix = 'DES'; break;
    default: prefix = 'LTR';
  }
  const letterNumber = data.letterNumber || `${prefix}-${new Date().getFullYear()}-${String((countRow?.count || 0) + 1).padStart(4, '0')}`;

  db.prepare(`
    INSERT INTO staff_letters (
      id, letterType, letterNumber, staffId, staffName, fatherName, staffIdNumber,
      designation, department, joiningDate, effectiveDate, lastWorkingDay, reason,
      contentBody, issueDate, authorizedSignatory, isManualStaff, cnic, subjectTitle, schoolId, isDeleted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    id,
    data.letterType,
    letterNumber,
    data.staffId || 'MANUAL',
    data.staffName.trim(),
    data.fatherName.trim(),
    data.staffIdNumber || 'MANUAL-ENTRY',
    data.designation.trim(),
    data.department || 'General',
    data.joiningDate || new Date().toISOString().split('T')[0],
    data.effectiveDate || new Date().toISOString().split('T')[0],
    data.lastWorkingDay || '',
    data.reason || '',
    data.contentBody,
    data.issueDate,
    data.authorizedSignatory,
    data.isManualStaff ? 1 : 0,
    data.cnic || '',
    data.subjectTitle || '',
    effectiveSchoolId
  );

  logGeneralAudit('ISSUE_LETTER', 'staff_letter', id, letterNumber, data.authorizedSignatory, `Issued ${data.letterType} document for ${data.staffName}`);
  syncJsonBackup();
  return getStaffLetterById(id)!;
}

export function deleteStaffLetter(id: string, adminName = 'Dr. Saeed Ahmad', isPermanent = false): boolean {
  const letter = getStaffLetterById(id);
  if (!letter) return false;

  if (isPermanent) {
    db.prepare('DELETE FROM staff_letters WHERE id = ?').run(id);
    logGeneralAudit('PERMANENT_DELETE', 'staff_letter', id, letter.letterNumber, adminName, 'Purged employment letter permanently');
  } else {
    const now = new Date().toISOString();
    db.prepare('UPDATE staff_letters SET isDeleted = 1, deletedAt = ?, deletedBy = ? WHERE id = ?').run(now, adminName, id);
    logGeneralAudit('SOFT_DELETE', 'staff_letter', id, letter.letterNumber, adminName, 'Moved employment letter to Recycle Bin');
  }

  syncJsonBackup();
  return true;
}

export function restoreStaffLetter(id: string): boolean {
  const letter = getStaffLetterById(id);
  if (!letter) return false;

  db.prepare('UPDATE staff_letters SET isDeleted = 0, deletedAt = NULL, deletedBy = NULL WHERE id = ?').run(id);
  logGeneralAudit('RESTORE', 'staff_letter', id, letter.letterNumber, 'Administrator', 'Restored employment letter');
  syncJsonBackup();
  return true;
}

// Student Certificates (Character, SLC, TC, Merit)
export function getAllCertificates(schoolId?: string): CertificateRecord[] {
  if (schoolId) {
    return db.prepare('SELECT * FROM certificates WHERE isDeleted = 0 AND schoolId = ? ORDER BY issueDate DESC').all(schoolId) as unknown as CertificateRecord[];
  }
  return db.prepare('SELECT * FROM certificates WHERE isDeleted = 0 ORDER BY issueDate DESC').all() as unknown as CertificateRecord[];
}

export function getCertificateById(id: string): CertificateRecord | null {
  const row = db.prepare('SELECT * FROM certificates WHERE id = ?').get(id);
  return (row as unknown as CertificateRecord) || null;
}

export function createCertificate(data: Omit<CertificateRecord, 'id' | 'certificateNumber'> & { certificateNumber?: string }, schoolId?: string): CertificateRecord {
  const id = `crt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const effectiveSchoolId = schoolId || data.schoolId || 'school_primary';
  let prefix = 'CRT';
  if (data.certificateType === 'CHARACTER_CERTIFICATE') prefix = 'CC';
  else if (data.certificateType === 'SCHOOL_LEAVING_CERTIFICATE') prefix = 'SLC';
  else if (data.certificateType === 'TRANSFER_CERTIFICATE') prefix = 'TC';
  else if (data.certificateType === 'BONAFIDE_CERTIFICATE') prefix = 'BFC';
  else if (data.certificateType === 'STUDY_CERTIFICATE') prefix = 'SC';
  else if (data.certificateType === 'MIGRATION_CERTIFICATE') prefix = 'MIG';
  else if (data.certificateType === 'MERIT_CERTIFICATE') prefix = 'MC';

  const countRow = db.prepare('SELECT COUNT(*) as count FROM certificates WHERE schoolId = ?').get(effectiveSchoolId) as { count: number };
  const certNum = data.certificateNumber || `${prefix}-${new Date().getFullYear()}-${String((countRow?.count || 0) + 1).padStart(4, '0')}`;

  db.prepare(`
    INSERT INTO certificates (
      id, certificateNumber, recipientType, recipientId, recipientName, fatherName,
      referenceNumber, className, certificateType, issueDate, session, remarks, conduct, reasonForLeaving, schoolId, isDeleted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    id,
    certNum,
    data.recipientType,
    data.recipientId,
    data.recipientName,
    data.fatherName,
    data.referenceNumber,
    data.className || '',
    data.certificateType,
    data.issueDate,
    data.session,
    data.remarks || '',
    data.conduct || 'Good',
    data.reasonForLeaving || '',
    effectiveSchoolId
  );

  logGeneralAudit('ISSUE_CERTIFICATE', 'certificate', id, certNum, 'Administrator', `Issued ${data.certificateType} for ${data.recipientName}`);
  syncJsonBackup();
  return getCertificateById(id)!;
}

export function deleteCertificate(id: string, adminName = 'Dr. Saeed Ahmad', isPermanent = false): boolean {
  const cert = getCertificateById(id);
  if (!cert) return false;

  if (isPermanent) {
    db.prepare('DELETE FROM certificates WHERE id = ?').run(id);
    logGeneralAudit('PERMANENT_DELETE', 'certificate', id, cert.certificateNumber, adminName, 'Purged certificate permanently');
  } else {
    const now = new Date().toISOString();
    db.prepare('UPDATE certificates SET isDeleted = 1, deletedAt = ?, deletedBy = ? WHERE id = ?').run(now, adminName, id);
    logGeneralAudit('SOFT_DELETE', 'certificate', id, cert.certificateNumber, adminName, 'Moved certificate to Recycle Bin');
  }

  syncJsonBackup();
  return true;
}

export function restoreCertificate(id: string): boolean {
  const cert = getCertificateById(id);
  if (!cert) return false;

  db.prepare('UPDATE certificates SET isDeleted = 0, deletedAt = NULL, deletedBy = NULL WHERE id = ?').run(id);
  logGeneralAudit('RESTORE', 'certificate', id, cert.certificateNumber, 'Administrator', 'Restored certificate');
  syncJsonBackup();
  return true;
}

// Examination Results
export function getAllExamResults(schoolId?: string): ExamResultRecord[] {
  let query = 'SELECT * FROM exam_results WHERE isDeleted = 0';
  const params: any[] = [];
  if (schoolId) {
    query += ' AND schoolId = ?';
    params.push(schoolId);
  }
  query += ' ORDER BY percentage DESC';
  const rows = db.prepare(query).all(...params) as any[];
  return rows.map((r) => ({
    ...r,
    subjects: JSON.parse(r.subjects || '[]'),
  }));
}

export function getExamResultById(id: string): ExamResultRecord | null {
  const row = db.prepare('SELECT * FROM exam_results WHERE id = ?').get(id) as any;
  if (!row) return null;
  return {
    ...row,
    subjects: JSON.parse(row.subjects || '[]'),
  };
}

export function deleteExamResult(id: string, adminName = 'Dr. Saeed Ahmad', isPermanent = false): boolean {
  const result = getExamResultById(id);
  if (!result) return false;

  if (isPermanent) {
    db.prepare('DELETE FROM exam_results WHERE id = ?').run(id);
    logGeneralAudit('PERMANENT_DELETE', 'exam_result', id, result.admissionNumber, adminName, 'Purged exam result record');
  } else {
    const now = new Date().toISOString();
    db.prepare('UPDATE exam_results SET isDeleted = 1, deletedAt = ?, deletedBy = ? WHERE id = ?').run(now, adminName, id);
    logGeneralAudit('SOFT_DELETE', 'exam_result', id, result.admissionNumber, adminName, 'Archived exam result to Recycle Bin');
  }

  syncJsonBackup();
  return true;
}

export function restoreExamResult(id: string): boolean {
  const result = getExamResultById(id);
  if (!result) return false;

  db.prepare('UPDATE exam_results SET isDeleted = 0, deletedAt = NULL, deletedBy = NULL WHERE id = ?').run(id);
  logGeneralAudit('RESTORE', 'exam_result', id, result.admissionNumber, 'Administrator', 'Restored exam result');
  syncJsonBackup();
  return true;
}

// Recycle Bin - Comprehensive Retrieval & Actions
export function getRecycleBinItems(): RecycleBinItem[] {
  const items: RecycleBinItem[] = [];

  // Deleted students
  const delStudents = db.prepare('SELECT * FROM students WHERE isDeleted = 1').all() as any[];
  delStudents.forEach((s) => {
    items.push({
      id: s.id,
      recordType: 'student',
      title: `${s.fullName} (${s.studentClass})`,
      referenceNumber: s.admissionNumber,
      deletedAt: s.deletedAt || s.createdAt,
      deletedBy: s.deletedBy || 'Administrator',
      dataSummary: `Admitted: ${s.admissionDate} · Mobile: ${s.mobileNumber}`,
    });
  });

  // Deleted staff
  const delStaff = db.prepare('SELECT * FROM staff WHERE isDeleted = 1').all() as any[];
  delStaff.forEach((st) => {
    items.push({
      id: st.id,
      recordType: 'staff',
      title: `${st.fullName} (${st.designation})`,
      referenceNumber: st.staffIdNumber || st.id,
      deletedAt: st.deletedAt || st.joiningDate,
      deletedBy: st.deletedBy || 'Administrator',
      dataSummary: `Department: ${st.department} · Role: ${st.role}`,
    });
  });

  // Deleted vouchers
  const delVouchers = db.prepare('SELECT * FROM vouchers WHERE isDeleted = 1').all() as any[];
  delVouchers.forEach((v) => {
    items.push({
      id: v.id,
      recordType: 'voucher',
      title: `Fee Voucher: ${v.studentName}`,
      referenceNumber: v.voucherNumber,
      deletedAt: v.deletedAt || v.updatedAt,
      deletedBy: v.deletedBy || 'Administrator',
      dataSummary: `Amount: Rs. ${v.feeAmount} · Status: ${v.status}`,
    });
  });

  // Deleted certificates
  const delCerts = db.prepare('SELECT * FROM certificates WHERE isDeleted = 1').all() as any[];
  delCerts.forEach((c) => {
    items.push({
      id: c.id,
      recordType: 'certificate',
      title: `${c.certificateType.replace(/_/g, ' ')}: ${c.recipientName}`,
      referenceNumber: c.certificateNumber,
      deletedAt: c.deletedAt || c.issueDate,
      deletedBy: c.deletedBy || 'Administrator',
      dataSummary: `Issued: ${c.issueDate} · Session: ${c.session}`,
    });
  });

  // Deleted staff letters
  const delLetters = db.prepare('SELECT * FROM staff_letters WHERE isDeleted = 1').all() as any[];
  delLetters.forEach((l) => {
    items.push({
      id: l.id,
      recordType: 'staff_letter',
      title: `${l.letterType} Letter: ${l.staffName}`,
      referenceNumber: l.letterNumber,
      deletedAt: l.deletedAt || l.issueDate,
      deletedBy: l.deletedBy || 'Administrator',
      dataSummary: `Designation: ${l.designation} · Dept: ${l.department}`,
    });
  });

  // Deleted exam results
  const delExams = db.prepare('SELECT * FROM exam_results WHERE isDeleted = 1').all() as any[];
  delExams.forEach((e) => {
    items.push({
      id: e.id,
      recordType: 'exam_result',
      title: `${e.examTerm} Card: ${e.studentName}`,
      referenceNumber: e.admissionNumber,
      deletedAt: e.deletedAt || new Date().toISOString(),
      deletedBy: e.deletedBy || 'Administrator',
      dataSummary: `Grade: ${e.grade} (${e.percentage}%) · Class: ${e.studentClass}`,
    });
  });

  return items.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
}

export function restoreRecycleBinItem(recordType: string, id: string): boolean {
  if (recordType === 'student') return restoreStudent(id);
  if (recordType === 'staff') return restoreStaff(id);
  if (recordType === 'voucher') return restoreVoucher(id);
  if (recordType === 'certificate') return restoreCertificate(id);
  if (recordType === 'staff_letter') return restoreStaffLetter(id);
  if (recordType === 'exam_result') return restoreExamResult(id);
  return false;
}

export function permanentlyDeleteRecycleBinItem(recordType: string, id: string, adminName = 'Dr. Saeed Ahmad'): boolean {
  if (recordType === 'student') return deleteStudent(id, adminName, true);
  if (recordType === 'staff') return deleteStaff(id, adminName, true);
  if (recordType === 'voucher') return deleteVoucher(id, adminName, true);
  if (recordType === 'certificate') return deleteCertificate(id, adminName, true);
  if (recordType === 'staff_letter') return deleteStaffLetter(id, adminName, true);
  if (recordType === 'exam_result') return deleteExamResult(id, adminName, true);
  return false;
}

export function getDashboardStats(schoolId?: string): DashboardStats {
  const sid = schoolId || 'school_primary';
  const totalStudentsRow = db.prepare('SELECT COUNT(*) as count FROM students WHERE isDeleted = 0 AND schoolId = ?').get(sid) as { count: number };
  const unpaidRow = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(feeAmount), 0) as total FROM vouchers WHERE status = 'UNPAID' AND isDeleted = 0 AND schoolId = ?").get(sid) as { count: number; total: number };
  const paidRow = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(feeAmount), 0) as total FROM vouchers WHERE status = 'PAID' AND isDeleted = 0 AND schoolId = ?").get(sid) as { count: number; total: number };
  const totalFeeRow = db.prepare('SELECT COALESCE(SUM(feeAmount), 0) as total FROM vouchers WHERE isDeleted = 0 AND schoolId = ?').get(sid) as { total: number };

  const recent = db.prepare('SELECT * FROM students WHERE isDeleted = 0 AND schoolId = ? ORDER BY createdAt DESC LIMIT 5').all(sid) as unknown as StudentRecord[];

  const recycleBinCountRow = db.prepare(`
    SELECT (
      (SELECT COUNT(*) FROM students WHERE isDeleted = 1 AND schoolId = ?) +
      (SELECT COUNT(*) FROM staff WHERE isDeleted = 1 AND schoolId = ?) +
      (SELECT COUNT(*) FROM vouchers WHERE isDeleted = 1 AND schoolId = ?) +
      (SELECT COUNT(*) FROM certificates WHERE isDeleted = 1 AND schoolId = ?) +
      (SELECT COUNT(*) FROM staff_letters WHERE isDeleted = 1 AND schoolId = ?) +
      (SELECT COUNT(*) FROM exam_results WHERE isDeleted = 1 AND schoolId = ?)
    ) as total
  `).get(sid, sid, sid, sid, sid, sid) as { total: number };

  return {
    totalStudents: totalStudentsRow?.count || 0,
    unpaidVouchersCount: unpaidRow?.count || 0,
    paidVouchersCount: paidRow?.count || 0,
    totalFeeAmount: totalFeeRow?.total || 0,
    collectedFeeAmount: paidRow?.total || 0,
    pendingFeeAmount: unpaidRow?.total || 0,
    recentAdmissions: recent || [],
    recycleBinCount: recycleBinCountRow?.total || 0,
  };
}

// =========================================================================
// MODULE 1: CLASS AND SECTION MANAGEMENT
// =========================================================================

export function getAllClassSections(): ClassSectionInfo[] {
  const profile = getSchoolProfile();
  const available = profile.availableClasses;

  // Check if class_sections has records
  const rows = db.prepare('SELECT * FROM class_sections').all() as { className: string; sectionsJson: string }[];
  const existingMap = new Map<string, SectionSetting[]>();
  rows.forEach((r) => {
    try {
      existingMap.set(r.className, JSON.parse(r.sectionsJson));
    } catch {}
  });

  const result: ClassSectionInfo[] = [];

  for (const className of available) {
    if (existingMap.has(className)) {
      result.push({
        className,
        sections: existingMap.get(className)!,
      });
    } else {
      // Default: A and B enabled, C and D disabled
      const defaultSections: SectionSetting[] = [
        { section: 'A', enabled: true, maxStudents: 40 },
        { section: 'B', enabled: true, maxStudents: 40 },
        { section: 'C', enabled: false, maxStudents: 40 },
        { section: 'D', enabled: false, maxStudents: 40 },
      ];
      db.prepare(`
        INSERT OR REPLACE INTO class_sections (className, sectionsJson) VALUES (?, ?)
      `).run(className, JSON.stringify(defaultSections));

      result.push({
        className,
        sections: defaultSections,
      });
    }
  }

  return result;
}

export function saveClassSection(className: string, sections: SectionSetting[]): ClassSectionInfo {
  db.prepare(`
    INSERT OR REPLACE INTO class_sections (className, sectionsJson) VALUES (?, ?)
  `).run(className, JSON.stringify(sections));

  logGeneralAudit('CONFIG', 'class_section', className, className, 'Administrator', `Updated section settings for ${className}`);
  syncJsonBackup();
  return { className, sections };
}

export function bulkTransferSection(
  studentIds: string[],
  newSection: string,
  reason: string,
  adminName: string = 'Dr. Saeed Ahmad'
): { transferredCount: number } {
  if (!studentIds || studentIds.length === 0) return { transferredCount: 0 };
  const targetSec = newSection.toUpperCase();
  let count = 0;

  for (const id of studentIds) {
    const student = getStudentById(id);
    if (!student) continue;
    const oldSec = student.section || 'A';
    if (oldSec === targetSec) continue;

    db.prepare('UPDATE students SET section = ? WHERE id = ?').run(targetSec, id);
    db.prepare('UPDATE vouchers SET section = ? WHERE studentId = ?').run(targetSec, id);

    addStudentHistory({
      studentId: id,
      eventType: 'TRANSFER',
      title: 'Section Transfer',
      description: `Transferred from Section ${oldSec} to Section ${targetSec} in ${student.studentClass}`,
      fromClass: student.studentClass,
      toClass: student.studentClass,
      fromSection: oldSec,
      toSection: targetSec,
      fromSession: student.session,
      toSession: student.session,
      performedBy: adminName,
      reason: reason || 'Administrative section re-balancing',
    });
    count++;
  }

  syncJsonBackup();
  return { transferredCount: count };
}

// =========================================================================
// MODULE 5: STUDENT HISTORY AND STATUS TRACKING
// =========================================================================

export function getStudentHistory(studentId: string): StudentHistoryItem[] {
  const rows = db.prepare('SELECT * FROM student_history WHERE studentId = ? ORDER BY timestamp DESC').all(studentId) as any[];
  return rows.map((r) => ({
    id: r.id,
    studentId: r.studentId,
    eventType: r.eventType,
    title: r.title,
    description: r.description,
    details: r.detailsJson ? JSON.parse(r.detailsJson) : undefined,
    fromSession: r.fromSession,
    toSession: r.toSession,
    fromClass: r.fromClass,
    toClass: r.toClass,
    fromSection: r.fromSection,
    toSection: r.toSection,
    fromRollNumber: r.fromRollNumber,
    toRollNumber: r.toRollNumber,
    fromStatus: r.fromStatus,
    toStatus: r.toStatus,
    performedBy: r.performedBy,
    timestamp: r.timestamp,
    reason: r.reason,
  }));
}

export function addStudentHistory(item: Omit<StudentHistoryItem, 'id' | 'timestamp'>): StudentHistoryItem {
  const id = `his_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const timestamp = new Date().toISOString();

  db.prepare(`
    INSERT INTO student_history (
      id, studentId, eventType, title, description, detailsJson,
      fromSession, toSession, fromClass, toClass, fromSection, toSection,
      fromRollNumber, toRollNumber, fromStatus, toStatus, performedBy, timestamp, reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    item.studentId,
    item.eventType,
    item.title,
    item.description,
    item.details ? JSON.stringify(item.details) : '',
    item.fromSession || '',
    item.toSession || '',
    item.fromClass || '',
    item.toClass || '',
    item.fromSection || '',
    item.toSection || '',
    item.fromRollNumber || '',
    item.toRollNumber || '',
    item.fromStatus || '',
    item.toStatus || '',
    item.performedBy,
    timestamp,
    item.reason || ''
  );

  return {
    ...item,
    id,
    timestamp,
  };
}

export function updateStudentStatus(
  studentId: string,
  newStatus: StudentStatus,
  reason: string,
  adminName: string = 'Dr. Saeed Ahmad',
  statusDate?: string
): StudentRecord {
  const student = getStudentById(studentId);
  if (!student) throw new Error('Student not found');
  const oldStatus = student.status || 'Enrolled';

  const validStatuses = ['Enrolled', 'Struck Off', 'Stuck', 'Expired', 'SLC'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}. Must be Enrolled, Struck Off, Expired, or SLC.`);
  }

  const normalizedStatus = newStatus === 'Stuck' ? 'Struck Off' : newStatus;

  db.prepare('UPDATE students SET status = ? WHERE id = ?').run(normalizedStatus, studentId);

  const timestamp = statusDate ? new Date(statusDate).toISOString() : new Date().toISOString();

  addStudentHistory({
    studentId,
    eventType: normalizedStatus === 'SLC' ? 'SLC' : 'STATUS_CHANGE',
    title: `Status Changed to ${normalizedStatus}`,
    description: `Academic enrollment status updated from "${oldStatus}" to "${normalizedStatus}"`,
    fromStatus: oldStatus,
    toStatus: normalizedStatus,
    performedBy: adminName,
    reason: reason || 'Administrative status update',
    schoolId: student.schoolId || 'school_primary',
  });

  logGeneralAudit('STATUS_CHANGE', 'student', studentId, student.admissionNumber, adminName, `Changed status from ${oldStatus} to ${normalizedStatus}: ${reason || 'N/A'}`);
  syncJsonBackup();
  return getStudentById(studentId)!;
}

export function searchStudentHistory(query: string): StudentRecord[] {
  if (!query || !query.trim()) return getAllStudents({ includePassOut: true });
  const q = `%${query.trim().toLowerCase()}%`;

  const rows = db.prepare(`
    SELECT * FROM students
    WHERE isDeleted = 0 AND (
      LOWER(fullName) LIKE ? OR
      LOWER(fatherName) LIKE ? OR
      LOWER(admissionNumber) LIKE ? OR
      LOWER(COALESCE(permanentStudentId, '')) LIKE ? OR
      LOWER(COALESCE(rollNumber, '')) LIKE ? OR
      LOWER(COALESCE(previousRollNumber, '')) LIKE ? OR
      LOWER(mobileNumber) LIKE ? OR
      LOWER(COALESCE(fatherCnic, '')) LIKE ? OR
      LOWER(COALESCE(motherCnic, '')) LIKE ?
    )
    ORDER BY createdAt DESC
  `).all(q, q, q, q, q, q, q, q, q) as unknown as StudentRecord[];

  return rows;
}

// =========================================================================
// MODULE 3: STUDENT PROMOTION & TRANSFER
// =========================================================================

export function promoteStudentsBulk(params: {
  studentIds: string[];
  fromSession: string;
  toSession: string;
  toClass: string;
  toSection: string;
  adminName?: string;
}): { promoted: string[]; errors: string[] } {
  const { studentIds, fromSession, toSession, toClass, toSection, adminName = 'Dr. Saeed Ahmad' } = params;
  const promoted: string[] = [];
  const errors: string[] = [];

  for (const id of studentIds) {
    const student = getStudentById(id);
    if (!student) {
      errors.push(`Student with ID ${id} not found.`);
      continue;
    }

    if (student.session === toSession && student.studentClass === toClass) {
      errors.push(`${student.fullName} (${student.admissionNumber}) is already in ${toClass} for session ${toSession}.`);
      continue;
    }

    const oldClass = student.studentClass;
    const oldSection = student.section || 'A';
    const oldRoll = student.rollNumber || '';

    // Calculate next roll number in target class/section/session
    const rollCount = db.prepare(`
      SELECT COUNT(*) as count FROM students
      WHERE studentClass = ? AND section = ? AND session = ? AND isDeleted = 0
    `).get(toClass, toSection, toSession) as { count: number };
    const newRoll = String((rollCount?.count || 0) + 1).padStart(2, '0');

    // Update student preserving permanent ID
    db.prepare(`
      UPDATE students
      SET studentClass = ?, section = ?, rollNumber = ?, session = ?,
          previousClass = ?, previousRollNumber = ?, status = 'Enrolled'
      WHERE id = ?
    `).run(toClass, toSection, newRoll, toSession, oldClass, oldRoll, id);

    addStudentHistory({
      studentId: id,
      eventType: 'PROMOTION',
      title: `Promoted to ${toClass}`,
      description: `Promoted from ${oldClass} (Sec ${oldSection}, Roll ${oldRoll || 'N/A'}) [${fromSession}] to ${toClass} (Sec ${toSection}, Roll ${newRoll}) [${toSession}]`,
      fromSession,
      toSession,
      fromClass: oldClass,
      toClass,
      fromSection: oldSection,
      toSection,
      fromRollNumber: oldRoll,
      toRollNumber: newRoll,
      performedBy: adminName,
      reason: `Annual academic promotion to Session ${toSession}`,
    });

    promoted.push(student.fullName);
  }

  logGeneralAudit('PROMOTION_BULK', 'student', `${promoted.length} students`, toSession, adminName, `Promoted ${promoted.length} students to ${toClass} (${toSection})`);
  syncJsonBackup();
  return { promoted, errors };
}

export function transferStudent(params: {
  studentId: string;
  toClass: string;
  toSection: string;
  toSession: string;
  reason: string;
  adminName?: string;
}): StudentRecord {
  const { studentId, toClass, toSection, toSession, reason, adminName = 'Dr. Saeed Ahmad' } = params;
  const student = getStudentById(studentId);
  if (!student) throw new Error('Student not found');

  const oldClass = student.studentClass;
  const oldSection = student.section || 'A';
  const oldRoll = student.rollNumber || '';
  const oldSession = student.session;

  // Calculate next roll number
  const rollCount = db.prepare(`
    SELECT COUNT(*) as count FROM students
    WHERE studentClass = ? AND section = ? AND session = ? AND isDeleted = 0
  `).get(toClass, toSection, toSession) as { count: number };
  const newRoll = String((rollCount?.count || 0) + 1).padStart(2, '0');

  db.prepare(`
    UPDATE students
    SET studentClass = ?, section = ?, rollNumber = ?, session = ?
    WHERE id = ?
  `).run(toClass, toSection, newRoll, toSession, studentId);

  // Update vouchers linked to student
  db.prepare(`
    UPDATE vouchers
    SET studentClass = ?, section = ?, rollNumber = ?
    WHERE studentId = ?
  `).run(toClass, toSection, newRoll, studentId);

  addStudentHistory({
    studentId,
    eventType: 'TRANSFER',
    title: 'Class/Section Transfer',
    description: `Transferred from ${oldClass} (Sec ${oldSection}) [${oldSession}] to ${toClass} (Sec ${toSection}, Roll ${newRoll}) [${toSession}]`,
    fromSession: oldSession,
    toSession,
    fromClass: oldClass,
    toClass,
    fromSection: oldSection,
    toSection,
    fromRollNumber: oldRoll,
    toRollNumber: newRoll,
    performedBy: adminName,
    reason: reason || 'Administrative transfer',
  });

  logGeneralAudit('TRANSFER', 'student', studentId, student.admissionNumber, adminName, `Transferred to ${toClass} (${toSection}): ${reason}`);
  syncJsonBackup();
  return getStudentById(studentId)!;
}

export function transferStudentsBulk(params: {
  studentIds: string[];
  toClass: string;
  toSection: string;
  toSession: string;
  reason: string;
  adminName?: string;
}): { transferredCount: number } {
  let count = 0;
  for (const id of params.studentIds) {
    try {
      transferStudent({
        studentId: id,
        toClass: params.toClass,
        toSection: params.toSection,
        toSession: params.toSession,
        reason: params.reason,
        adminName: params.adminName,
      });
      count++;
    } catch {}
  }
  return { transferredCount: count };
}

// =========================================================================
// MODULE 4: CLASS 10 PASS-OUT SYSTEM
// =========================================================================

export function getClass10Students(session: string, includePassedOut = false): StudentRecord[] {
  let query = "SELECT * FROM students WHERE isDeleted = 0 AND studentClass = 'Class 10'";
  const params: any[] = [];
  if (session) {
    query += ' AND session = ?';
    params.push(session);
  }
  if (!includePassedOut) {
    query += ' AND (isPassOut = 0 OR isPassOut IS NULL)';
  }
  query += ' ORDER BY section ASC, rollNumber ASC, fullName ASC';
  return db.prepare(query).all(...params) as unknown as StudentRecord[];
}

export function processClass10PassOut(params: {
  studentIds: string[];
  session: string;
  passOutDate: string;
  resultSummary?: string;
  adminName?: string;
}): { processedCount: number } {
  const { studentIds, session, passOutDate, resultSummary = 'Matriculation Final Pass-Out', adminName = 'Dr. Saeed Ahmad' } = params;
  let count = 0;

  for (const id of studentIds) {
    const student = getStudentById(id);
    if (!student) continue;

    db.prepare(`
      UPDATE students
      SET isPassOut = 1, passOutDate = ?, passOutSession = ?, status = 'SLC'
      WHERE id = ?
    `).run(passOutDate, session, id);

    addStudentHistory({
      studentId: id,
      eventType: 'PASS_OUT',
      title: 'Class 10 Matriculation Pass-Out',
      description: `Successfully completed secondary school education (Class 10 Matriculation) under BISE Gujranwala for Academic Session ${session}. Marked as School Alumni.`,
      fromClass: 'Class 10',
      toClass: 'Class 10 (Passed Out)',
      fromSession: session,
      toSession: session,
      fromStatus: student.status || 'Enrolled',
      toStatus: 'SLC',
      performedBy: adminName,
      reason: resultSummary,
    });

    count++;
  }

  logGeneralAudit('PASS_OUT_BATCH', 'student', `${count} students`, session, adminName, `Processed Class 10 pass-out batch for Session ${session}`);
  syncJsonBackup();
  return { processedCount: count };
}

export function getPassOutArchive(): StudentRecord[] {
  return db.prepare(`
    SELECT * FROM students
    WHERE isDeleted = 0 AND isPassOut = 1
    ORDER BY passOutDate DESC, fullName ASC
  `).all() as unknown as StudentRecord[];
}

// =========================================================================
// MODULE 6: CLASS-WISE AND STUDENT-WISE FEE VOUCHERS
// =========================================================================

export function getAllClassFeeConfigs(session?: string): ClassFeeConfig[] {
  const profile = getSchoolProfile();
  const currentSession = session || profile.activeSession;
  const classes = profile.availableClasses;

  const rows = db.prepare('SELECT * FROM class_fee_configs WHERE session = ?').all(currentSession) as unknown as ClassFeeConfig[];
  const existingMap = new Map<string, ClassFeeConfig>();
  rows.forEach((r) => existingMap.set(r.className, r));

  const result: ClassFeeConfig[] = [];

  for (const className of classes) {
    if (existingMap.has(className)) {
      result.push(existingMap.get(className)!);
    } else {
      // Create sensible default for school tier
      let tuition = 3500;
      if (className === 'Play Group') tuition = 2500;
      else if (className === 'Nursery') tuition = 2800;
      else if (className === 'Prep') tuition = 3000;
      else if (['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'].includes(className)) tuition = 3500;
      else if (['Class 6', 'Class 7', 'Class 8'].includes(className)) tuition = 4200;
      else if (['Class 9', 'Class 10'].includes(className)) tuition = 5000;

      const defaultConfig: ClassFeeConfig = {
        id: `cfg_${className.replace(/\s+/g, '_')}_${currentSession.replace(/\s+/g, '_')}`,
        className,
        session: currentSession,
        tuitionFee: tuition,
        admissionFee: 5000,
        annualCharges: 2000,
        examFee: 1500,
        otherCharges: 500,
        defaultFine: 200,
        defaultDiscount: 0,
      };

      try {
        db.prepare(`
          INSERT OR REPLACE INTO class_fee_configs (
            id, className, session, tuitionFee, admissionFee, annualCharges, examFee, otherCharges, defaultFine, defaultDiscount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          defaultConfig.id,
          defaultConfig.className,
          defaultConfig.session,
          defaultConfig.tuitionFee,
          defaultConfig.admissionFee,
          defaultConfig.annualCharges,
          defaultConfig.examFee,
          defaultConfig.otherCharges,
          defaultConfig.defaultFine,
          defaultConfig.defaultDiscount
        );
      } catch {}

      result.push(defaultConfig);
    }
  }

  return result;
}

export function saveClassFeeConfig(config: ClassFeeConfig): ClassFeeConfig {
  const id = config.id || `cfg_${config.className.replace(/\s+/g, '_')}_${config.session.replace(/\s+/g, '_')}`;
  db.prepare(`
    INSERT OR REPLACE INTO class_fee_configs (
      id, className, session, tuitionFee, admissionFee, annualCharges, examFee, otherCharges, defaultFine, defaultDiscount
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    config.className,
    config.session,
    Number(config.tuitionFee) || 0,
    Number(config.admissionFee) || 0,
    Number(config.annualCharges) || 0,
    Number(config.examFee) || 0,
    Number(config.otherCharges) || 0,
    Number(config.defaultFine) || 0,
    Number(config.defaultDiscount) || 0
  );

  logGeneralAudit('CONFIG', 'fee_config', id, `${config.className} - ${config.session}`, 'Administrator', 'Saved class fee configuration');
  syncJsonBackup();
  return { ...config, id };
}

export function generateClassVouchersBulk(params: {
  session: string;
  className: string;
  section?: string;
  billingMonth: string;
  studentIds: string[];
  dueDate: string;
  tuitionFee?: number;
  admissionFeeItem?: number;
  annualCharges?: number;
  examFee?: number;
  otherCharges?: number;
  fine?: number;
  discount?: number;
  remarks?: string;
  allowDuplicates?: boolean;
}): { generated: FeeVoucher[]; skipped: string[] } {
  const { session, className, section, billingMonth, studentIds, dueDate, remarks, allowDuplicates = false } = params;

  // Retrieve fee config for this class and session
  const configs = getAllClassFeeConfigs(session);
  const config = configs.find((c) => c.className === className);

  // Use explicit parameters if provided by administrator, otherwise fallback to class fee configuration
  const tuitionFee = params.tuitionFee !== undefined ? Number(params.tuitionFee) : (config?.tuitionFee ?? 1500);
  const admissionFeeItem = params.admissionFeeItem !== undefined ? Number(params.admissionFeeItem) : (config?.admissionFee ?? 0);
  const annualCharges = params.annualCharges !== undefined ? Number(params.annualCharges) : (config?.annualCharges ?? 0);
  const examFee = params.examFee !== undefined ? Number(params.examFee) : (config?.examFee ?? 0);
  const otherCharges = params.otherCharges !== undefined ? Number(params.otherCharges) : (config?.otherCharges ?? 0);
  const fine = params.fine !== undefined ? Number(params.fine) : (config?.defaultFine ?? 0);
  const discount = params.discount !== undefined ? Number(params.discount) : (config?.defaultDiscount ?? 0);

  const subtotal = tuitionFee + admissionFeeItem + annualCharges + examFee + otherCharges;
  const totalPayable = Math.max(0, subtotal + fine - discount);
  const balanceDue = totalPayable;

  const generated: FeeVoucher[] = [];
  const skipped: string[] = [];
  const now = new Date().toISOString();
  const issueDate = now.split('T')[0];

  for (const id of studentIds) {
    const student = getStudentById(id);
    if (!student) {
      skipped.push(`Student ID "${id}" not found in database`);
      continue;
    }

    // Duplicate check: voucher for same student + billingMonth + session
    if (!allowDuplicates) {
      const existing = db.prepare(`
        SELECT id, voucherNumber FROM vouchers
        WHERE studentId = ? AND billingMonth = ? AND session = ? AND isDeleted = 0
      `).get(id, billingMonth, session) as { id: string; voucherNumber: string } | undefined;

      if (existing) {
        skipped.push(`${student.fullName} (Adm #${student.admissionNumber}) - Already has Voucher #${existing.voucherNumber} for ${billingMonth}`);
        continue;
      }
    }

    const voucherId = `vch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let voucherNumber = getNextVoucherNumber();

    let collisionCheck = db.prepare('SELECT id FROM vouchers WHERE voucherNumber = ?').get(voucherNumber);
    while (collisionCheck) {
      voucherNumber = `VCH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      collisionCheck = db.prepare('SELECT id FROM vouchers WHERE voucherNumber = ?').get(voucherNumber);
    }

    db.prepare(`
      INSERT INTO vouchers (
        id, voucherNumber, studentId, admissionNumber, rollNumber, studentName, fatherName,
        studentClass, section, session, billingMonth, tuitionFee, admissionFeeItem, annualCharges, examFee, otherCharges,
        fine, discount, subtotal, totalPayable, amountPaid, balanceDue, feeAmount, status,
        issueDate, dueDate, paidAt, updatedBy, updatedAt, notes, isDeleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'UNPAID', ?, ?, null, null, ?, ?, 0)
    `).run(
      voucherId,
      voucherNumber,
      id,
      student.admissionNumber,
      student.rollNumber || '',
      student.fullName,
      student.fatherName,
      student.studentClass,
      student.section || section || 'A',
      session,
      billingMonth,
      tuitionFee,
      admissionFeeItem,
      annualCharges,
      examFee,
      otherCharges,
      fine,
      discount,
      subtotal,
      totalPayable,
      balanceDue,
      totalPayable,
      issueDate,
      dueDate,
      now,
      remarks || `Monthly fee voucher for ${billingMonth}`
    );

    db.prepare(`
      INSERT INTO voucher_audit_log (
        id, voucherId, voucherNumber, previousStatus, newStatus, changedBy, timestamp, notes
      ) VALUES (?, ?, ?, 'NONE', 'UNPAID', 'Dr. Saeed Ahmad (Principal)', ?, ?)
    `).run(`aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, voucherId, voucherNumber, now, `Class batch issuance for ${billingMonth}`);

    addStudentHistory({
      studentId: id,
      eventType: 'FEE',
      title: `Fee Voucher Issued: ${billingMonth}`,
      description: `Issued Voucher #${voucherNumber} for Rs. ${totalPayable} (Due: ${dueDate})`,
      performedBy: 'Accountant / Principal',
      reason: `Monthly billing for ${billingMonth}`,
    });

    const created = getVoucherById(voucherId);
    if (created) {
      generated.push(created);
    }
  }

  logGeneralAudit('FEE_BATCH', 'voucher', `${generated.length} vouchers`, `${className} - ${billingMonth}`, 'Administrator', `Generated ${generated.length} fee vouchers for ${className} (${skipped.length} skipped)`);
  syncJsonBackup();
  return { generated, skipped };
}

export function createIndividualVoucher(data: {
  studentId?: string;
  admissionNumber?: string;
  rollNumber?: string;
  studentName?: string;
  fatherName?: string;
  studentClass?: string;
  section?: string;
  session: string;
  billingMonth: string;
  tuitionFee?: number;
  admissionFeeItem?: number;
  annualCharges?: number;
  examFee?: number;
  otherCharges?: number;
  fine?: number;
  discount?: number;
  dueDate: string;
  notes?: string;
  isManualStudent?: boolean;
  allowDuplicate?: boolean;
}): FeeVoucher {
  let student: StudentRecord | undefined;
  if (data.studentId && !data.isManualStudent) {
    student = getStudentById(data.studentId) || undefined;
  }

  const studentName = (data.studentName || student?.fullName || '').trim();
  const fatherName = (data.fatherName || student?.fatherName || '').trim();
  const studentClass = data.studentClass || student?.studentClass || 'Class 1';
  const section = data.section || student?.section || 'A';
  const admissionNumber = data.admissionNumber || student?.admissionNumber || (data.isManualStudent ? 'MANUAL' : '');
  const rollNumber = data.rollNumber || student?.rollNumber || '';
  const session = data.session || student?.session || '2026-2027';
  const billingMonth = data.billingMonth || 'Current Month';

  if (!studentName) {
    throw new Error('Student full name is required to generate a fee voucher');
  }

  // Duplicate check: prevent duplicate voucher for same student + billingMonth + session
  if (data.studentId && !data.isManualStudent && !data.allowDuplicate) {
    const existing = db.prepare(`
      SELECT id, voucherNumber FROM vouchers
      WHERE studentId = ? AND billingMonth = ? AND session = ? AND isDeleted = 0
    `).get(data.studentId, billingMonth, session) as { id: string; voucherNumber: string } | undefined;

    if (existing) {
      throw new Error(`A fee voucher for ${studentName} for ${billingMonth} (${session}) already exists: Voucher #${existing.voucherNumber}. Check the Fee Register or select "Allow Duplicate Voucher".`);
    }
  }

  const tuition = Number(data.tuitionFee) || 0;
  const admFee = Number(data.admissionFeeItem) || 0;
  const annual = Number(data.annualCharges) || 0;
  const exam = Number(data.examFee) || 0;
  const other = Number(data.otherCharges) || 0;
  const fine = Number(data.fine) || 0;
  const discount = Number(data.discount) || 0;

  const subtotal = tuition + admFee + annual + exam + other;
  const totalPayable = Math.max(0, subtotal + fine - discount);
  const balanceDue = totalPayable;

  const voucherId = `vch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  let voucherNumber = getNextVoucherNumber();

  let collisionCheck = db.prepare('SELECT id FROM vouchers WHERE voucherNumber = ?').get(voucherNumber);
  while (collisionCheck) {
    voucherNumber = `VCH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    collisionCheck = db.prepare('SELECT id FROM vouchers WHERE voucherNumber = ?').get(voucherNumber);
  }

  const now = new Date().toISOString();
  const issueDate = now.split('T')[0];
  const studentId = data.studentId || (data.isManualStudent ? `manual_${Date.now()}` : '');

  db.prepare(`
    INSERT INTO vouchers (
      id, voucherNumber, studentId, admissionNumber, rollNumber, studentName, fatherName,
      studentClass, section, session, billingMonth, tuitionFee, admissionFeeItem, annualCharges, examFee, otherCharges,
      fine, discount, subtotal, totalPayable, amountPaid, balanceDue, feeAmount, status,
      issueDate, dueDate, paidAt, updatedBy, updatedAt, notes, isManualStudent, isDeleted
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'UNPAID', ?, ?, null, null, ?, ?, ?, 0)
  `).run(
    voucherId,
    voucherNumber,
    studentId,
    admissionNumber,
    rollNumber,
    studentName,
    fatherName,
    studentClass,
    section,
    session,
    billingMonth,
    tuition,
    admFee,
    annual,
    exam,
    other,
    fine,
    discount,
    subtotal,
    totalPayable,
    balanceDue,
    totalPayable,
    issueDate,
    data.dueDate || issueDate,
    now,
    data.notes || '',
    data.isManualStudent ? 1 : 0
  );

  db.prepare(`
    INSERT INTO voucher_audit_log (
      id, voucherId, voucherNumber, previousStatus, newStatus, changedBy, timestamp, notes
    ) VALUES (?, ?, ?, 'NONE', 'UNPAID', 'Accountant / Principal', ?, ?)
  `).run(`aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, voucherId, voucherNumber, now, 'Individual voucher issuance');

  if (studentId && !data.isManualStudent) {
    addStudentHistory({
      studentId,
      eventType: 'FEE',
      title: `Individual Voucher: ${billingMonth}`,
      description: `Issued Voucher #${voucherNumber} for Rs. ${totalPayable} (Due: ${data.dueDate || issueDate})`,
      performedBy: 'Accountant / Principal',
      reason: data.notes || 'Individual fee voucher issuance',
    });
  }

  logGeneralAudit('FEE_INDIVIDUAL', 'voucher', voucherId, voucherNumber, 'Administrator', `Created individual voucher for ${studentName}`);
  syncJsonBackup();
  return getVoucherById(voucherId)!;
}

export function recordVoucherPayment(
  voucherId: string,
  amountPaid: number,
  notes: string,
  adminName = 'Accountant / Principal'
): FeeVoucher {
  const voucher = getVoucherById(voucherId);
  if (!voucher) throw new Error('Voucher not found');

  const prevStatus = voucher.status;
  const currentPaid = Number(voucher.amountPaid) || 0;
  const newTotalPaid = currentPaid + Number(amountPaid);
  const totalPayable = Number(voucher.totalPayable) || Number(voucher.feeAmount);
  const newBalance = Math.max(0, totalPayable - newTotalPaid);
  const newStatus = newBalance <= 0 ? 'PAID' : 'UNPAID';
  const now = new Date().toISOString();

  (db.prepare(`
    UPDATE vouchers
    SET amountPaid = ?, balanceDue = ?, status = ?, paidAt = ?, updatedBy = ?, updatedAt = ?, notes = ?
    WHERE id = ?
  `) as any).run(
    newTotalPaid,
    newBalance,
    newStatus,
    newStatus === 'PAID' ? now : voucher.paidAt || null,
    adminName,
    now,
    notes ? `${voucher.notes || ''} [Payment: Rs. ${amountPaid} - ${notes}]`.trim() : voucher.notes,
    voucherId
  );

  db.prepare(`
    INSERT INTO voucher_audit_log (
      id, voucherId, voucherNumber, previousStatus, newStatus, changedBy, timestamp, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    voucherId,
    voucher.voucherNumber,
    prevStatus,
    newStatus,
    adminName,
    now,
    `Payment received: Rs. ${amountPaid}. Remaining balance: Rs. ${newBalance}. ${notes || ''}`
  );

  if (voucher.studentId && !voucher.isManualStudent) {
    addStudentHistory({
      studentId: voucher.studentId,
      eventType: 'FEE',
      title: newStatus === 'PAID' ? 'Fee Fully Paid' : 'Partial Fee Payment',
      description: `Payment of Rs. ${amountPaid} received for Voucher #${voucher.voucherNumber}. Remaining balance: Rs. ${newBalance}`,
      performedBy: adminName,
      reason: notes || 'Fee counter payment recorded',
    });
  }

  logGeneralAudit('PAYMENT', 'voucher', voucherId, voucher.voucherNumber, adminName, `Recorded payment of Rs. ${amountPaid}`);
  syncJsonBackup();
  return getVoucherById(voucherId)!;
}

// =========================================================================
// PHASE 2-10: USER MANAGEMENT, AUTHENTICATION, RBAC & SECURITY AUDIT
// =========================================================================

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) return false;
  try {
    if (storedHash.includes(':')) {
      const [salt, key] = storedHash.split(':');
      if (salt && key) {
        const testKey = crypto.scryptSync(password, salt, 64).toString('hex');
        if (crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(testKey, 'hex'))) {
          return true;
        }
        // Also test trimmed password in case of accidental mobile whitespace
        if (password.trim() !== password) {
          const testKeyTrim = crypto.scryptSync(password.trim(), salt, 64).toString('hex');
          if (crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(testKeyTrim, 'hex'))) {
            return true;
          }
        }
      }
    }
    // Direct plaintext fallback (e.g. if legacy account or unhashed password was stored)
    if (storedHash === password || storedHash === password.trim()) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function generateSecureTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
  let pwd = '';
  for (let i = 0; i < 12; i++) {
    pwd += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return pwd;
}

// Security Audit Logger
export function logSecurityAudit(entry: Omit<SecurityAuditEntry, 'id' | 'timestamp'>): SecurityAuditEntry {
  const id = `sec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = new Date().toISOString();
  try {
    db.prepare(`
      INSERT INTO security_audit_logs (
        id, actingUid, actingEmail, action, targetUid, targetEmail, role, timestamp, details, status, ipAddress
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      entry.actingUid,
      entry.actingEmail,
      entry.action,
      entry.targetUid || '',
      entry.targetEmail || '',
      entry.role || '',
      timestamp,
      entry.details || '',
      entry.status || 'SUCCESS',
      entry.ipAddress || ''
    );
  } catch (err) {
    console.error('Failed to write security audit log:', err);
  }
  return { ...entry, id, timestamp };
}

export function getSecurityAuditLogs(limit = 100): SecurityAuditEntry[] {
  return db.prepare(`
    SELECT * FROM security_audit_logs
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(limit) as unknown as SecurityAuditEntry[];
}

// System Security Settings
export function getSystemSecuritySettings(): SystemSecuritySettings {
  const row = db.prepare('SELECT * FROM system_security_settings WHERE id = ?').get('sec_settings_primary') as any;
  if (row) {
    return {
      softwareName: row.softwareName,
      ownerEmail: row.ownerEmail,
      allowPublicRegistrations: Boolean(row.allowPublicRegistrations),
      sessionTimeoutMinutes: row.sessionTimeoutMinutes || 60,
      enforceTemporaryPasswordChange: Boolean(row.enforceTemporaryPasswordChange),
      maxFailedLoginsBeforeLock: row.maxFailedLoginsBeforeLock || 5,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    };
  }
  const defaultSettings: SystemSecuritySettings = {
    softwareName: 'EDU.pro — Siqarah Public Model High School Shorkot',
    ownerEmail: OWNER_EMAIL,
    allowPublicRegistrations: false,
    sessionTimeoutMinutes: 60,
    enforceTemporaryPasswordChange: true,
    maxFailedLoginsBeforeLock: 5,
    updatedAt: new Date().toISOString(),
    updatedBy: 'System Initialization',
  };

  db.prepare(`
    INSERT OR REPLACE INTO system_security_settings (
      id, softwareName, ownerEmail, allowPublicRegistrations, sessionTimeoutMinutes,
      enforceTemporaryPasswordChange, maxFailedLoginsBeforeLock, updatedAt, updatedBy
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'sec_settings_primary',
    defaultSettings.softwareName,
    defaultSettings.ownerEmail,
    defaultSettings.allowPublicRegistrations ? 1 : 0,
    defaultSettings.sessionTimeoutMinutes,
    defaultSettings.enforceTemporaryPasswordChange ? 1 : 0,
    defaultSettings.maxFailedLoginsBeforeLock,
    defaultSettings.updatedAt,
    defaultSettings.updatedBy
  );

  return defaultSettings;
}

export function updateSystemSecuritySettings(
  settings: Partial<SystemSecuritySettings>,
  actingUid: string,
  actingEmail: string
): SystemSecuritySettings {
  // CRITICAL OWNER RESTRICTION: Only Super Admin can modify system security settings
  const actingUser = getAppUserByUid(actingUid);
  if (!actingUser || actingUser.role !== 'Super Admin') {
    throw new Error('Forbidden: Only Software Owner (Super Admin) can modify software security settings.');
  }

  const current = getSystemSecuritySettings();
  const updated: SystemSecuritySettings = {
    ...current,
    ...settings,
    ownerEmail: OWNER_EMAIL, // Cannot be overridden
    updatedAt: new Date().toISOString(),
    updatedBy: `${actingUser.name} (${actingEmail})`,
  };

  db.prepare(`
    UPDATE system_security_settings
    SET softwareName = ?, allowPublicRegistrations = ?, sessionTimeoutMinutes = ?,
        enforceTemporaryPasswordChange = ?, maxFailedLoginsBeforeLock = ?, updatedAt = ?, updatedBy = ?
    WHERE id = ?
  `).run(
    updated.softwareName,
    updated.allowPublicRegistrations ? 1 : 0,
    updated.sessionTimeoutMinutes,
    updated.enforceTemporaryPasswordChange ? 1 : 0,
    updated.maxFailedLoginsBeforeLock,
    updated.updatedAt,
    updated.updatedBy,
    'sec_settings_primary'
  );

  logSecurityAudit({
    actingUid,
    actingEmail,
    action: 'SECURITY_SETTINGS_UPDATE',
    details: 'Software Owner updated system security settings',
    status: 'SUCCESS',
  });

  return updated;
}

// User Management Queries
export function getAllAppUsers(schoolId?: string): AppUser[] {
  let rows: any[];
  if (schoolId) {
    rows = db.prepare(`
      SELECT uid, email, name, phone, role, schoolId, status, isTemporaryPassword,
             requiresPasswordChange, isTestAccount, isOwner, createdBy, createdAt, updatedAt, lastLoginAt
      FROM app_users
      WHERE schoolId = ? OR role = 'Super Admin'
      ORDER BY isOwner DESC, role ASC, name ASC
    `).all(schoolId) as any[];
  } else {
    rows = db.prepare(`
      SELECT uid, email, name, phone, role, schoolId, status, isTemporaryPassword,
             requiresPasswordChange, isTestAccount, isOwner, createdBy, createdAt, updatedAt, lastLoginAt
      FROM app_users
      ORDER BY isOwner DESC, role ASC, name ASC
    `).all() as any[];
  }

  return rows.map((r) => ({
    uid: r.uid,
    email: r.email,
    name: r.name,
    phone: r.phone || '',
    role: r.role as UserRole,
    schoolId: r.schoolId,
    status: r.status as 'ACTIVE' | 'INACTIVE',
    isTemporaryPassword: Boolean(r.isTemporaryPassword),
    requiresPasswordChange: Boolean(r.requiresPasswordChange),
    isTestAccount: Boolean(r.isTestAccount),
    isOwner: Boolean(r.isOwner),
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    lastLoginAt: r.lastLoginAt || undefined,
  }));
}

export function getAppUserByUid(uid: string): AppUser | null {
  let r = db.prepare(`
    SELECT uid, email, name, phone, role, schoolId, status, isTemporaryPassword,
           requiresPasswordChange, isTestAccount, isOwner, createdBy, createdAt, updatedAt, lastLoginAt
    FROM app_users
    WHERE uid = ?
  `).get(uid) as any;

  if (!r) {
    // Check if user exists in school_store.json backup and auto-restore
    try {
      if (fs.existsSync(JSON_BACKUP_PATH)) {
        const raw = fs.readFileSync(JSON_BACKUP_PATH, 'utf-8');
        if (raw.trim()) {
          const backup = JSON.parse(raw);
          if (Array.isArray(backup.users)) {
            const matched = backup.users.find((u: any) => u.uid === uid);
            if (matched && matched.passwordHash) {
              db.prepare(`
                INSERT OR REPLACE INTO app_users (
                  uid, email, name, phone, role, schoolId, status, passwordHash,
                  isTemporaryPassword, requiresPasswordChange, tempPasswordPlain, isTestAccount, isOwner,
                  createdBy, createdAt, updatedAt, lastLoginAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                matched.uid || uid,
                matched.email.toLowerCase().trim(),
                matched.name || 'User',
                matched.phone || '',
                matched.role || 'Staff',
                matched.schoolId || 'school_primary',
                matched.status || 'ACTIVE',
                matched.passwordHash,
                matched.isTemporaryPassword ? 1 : 0,
                matched.requiresPasswordChange ? 1 : 0,
                matched.tempPasswordPlain || '',
                matched.isTestAccount ? 1 : 0,
                matched.isOwner ? 1 : 0,
                matched.createdBy || 'Auto Restore',
                matched.createdAt || new Date().toISOString(),
                matched.updatedAt || new Date().toISOString(),
                matched.lastLoginAt || null
              );
              r = db.prepare('SELECT * FROM app_users WHERE uid = ?').get(uid) as any;
            }
          }
        }
      }
    } catch (e) {
      console.warn('[getAppUserByUid] Auto-restore from backup failed:', e);
    }
  }

  if (!r) return null;
  return {
    uid: r.uid,
    email: r.email,
    name: r.name,
    phone: r.phone || '',
    role: r.role as UserRole,
    schoolId: r.schoolId,
    status: r.status as 'ACTIVE' | 'INACTIVE',
    isTemporaryPassword: Boolean(r.isTemporaryPassword),
    requiresPasswordChange: Boolean(r.requiresPasswordChange),
    isTestAccount: Boolean(r.isTestAccount),
    isOwner: Boolean(r.isOwner),
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    lastLoginAt: r.lastLoginAt || undefined,
  };
}

export function getAppUserByEmail(email: string): (AppUser & { passwordHash: string }) | null {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return null;
  let r = db.prepare(`
    SELECT * FROM app_users 
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))
       OR (phone != '' AND phone = ?)
       OR LOWER(TRIM(email)) = LOWER(TRIM(? || '@edupro.pk'))
       OR LOWER(TRIM(email)) = LOWER(TRIM(? || '@gmail.com'))
  `).get(normalized, normalized, normalized, normalized) as any;
  if (!r) {
    // Check if user exists in school_store.json backup and auto-restore
    try {
      if (fs.existsSync(JSON_BACKUP_PATH)) {
        const raw = fs.readFileSync(JSON_BACKUP_PATH, 'utf-8');
        if (raw.trim()) {
          const backup = JSON.parse(raw);
          if (Array.isArray(backup.users)) {
            const matched = backup.users.find((u: any) => {
              if (!u) return false;
              const uEmail = (u.email || '').trim().toLowerCase();
              const uPhone = (u.phone || '').trim();
              return (
                uEmail === normalized ||
                (uPhone && uPhone === normalized) ||
                uEmail === `${normalized}@edupro.pk` ||
                uEmail === `${normalized}@gmail.com`
              );
            });
            if (matched && matched.passwordHash) {
              db.prepare(`
                INSERT OR REPLACE INTO app_users (
                  uid, email, name, phone, role, schoolId, status, passwordHash,
                  isTemporaryPassword, requiresPasswordChange, tempPasswordPlain, isTestAccount, isOwner,
                  createdBy, createdAt, updatedAt, lastLoginAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                matched.uid || `usr_${Date.now()}`,
                matched.email.toLowerCase().trim(),
                matched.name || 'User',
                matched.phone || '',
                matched.role || 'Staff',
                matched.schoolId || 'school_primary',
                matched.status || 'ACTIVE',
                matched.passwordHash,
                matched.isTemporaryPassword ? 1 : 0,
                matched.requiresPasswordChange ? 1 : 0,
                matched.tempPasswordPlain || '',
                matched.isTestAccount ? 1 : 0,
                matched.isOwner ? 1 : 0,
                matched.createdBy || 'Auto Restore',
                matched.createdAt || new Date().toISOString(),
                matched.updatedAt || new Date().toISOString(),
                matched.lastLoginAt || null
              );
              r = db.prepare('SELECT * FROM app_users WHERE uid = ?').get(matched.uid) as any;
            }
          }
        }
      }
    } catch (e) {
      console.warn('[getAppUserByEmail] Auto-restore from backup failed:', e);
    }
  }

  if (!r) return null;
  return {
    uid: r.uid,
    email: r.email,
    name: r.name,
    phone: r.phone || '',
    role: r.role as UserRole,
    schoolId: r.schoolId,
    status: r.status as 'ACTIVE' | 'INACTIVE',
    isTemporaryPassword: Boolean(r.isTemporaryPassword),
    requiresPasswordChange: Boolean(r.requiresPasswordChange),
    isTestAccount: Boolean(r.isTestAccount),
    isOwner: Boolean(r.isOwner),
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    lastLoginAt: r.lastLoginAt || undefined,
    passwordHash: r.passwordHash,
  };
}

export function createAppUser(params: {
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  schoolId?: string;
  temporaryPassword?: string;
  requiresPasswordChange?: boolean;
  isTemporaryPassword?: boolean;
  isTestAccount?: boolean;
  actingUid: string;
  actingEmail: string;
}): { user: AppUser; temporaryPassword: string } {
  const actingUser = getAppUserByUid(params.actingUid);
  const isSuperAdmin = actingUser?.role === 'Super Admin' || params.actingEmail === OWNER_EMAIL;
  const isSchoolAdmin =
    actingUser?.role === 'Principal' &&
    (!actingUser.schoolId || actingUser.schoolId === (params.schoolId || 'school_primary'));

  if (!isSuperAdmin && !isSchoolAdmin) {
    throw new Error('Forbidden: Only Super Admin or School Principal can create employee accounts.');
  }

  // Prevent non-super-admin from creating a Super Admin
  if (params.role === 'Super Admin' && !isSuperAdmin) {
    throw new Error('Forbidden: Super Admin accounts can only be created by the Software Owner.');
  }

  // Prevent creating duplicate email
  const existing = getAppUserByEmail(params.email);
  if (existing) {
    throw new Error(`An account with email "${params.email}" already exists.`);
  }

  const temporaryPassword = params.temporaryPassword || generateSecureTemporaryPassword();
  const passwordHash = hashPassword(temporaryPassword);
  const uid = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const isOwner = params.email.toLowerCase() === OWNER_EMAIL.toLowerCase() ? 1 : 0;
  const reqPwdChange = params.requiresPasswordChange ? 1 : 0;
  const isTemp = params.isTemporaryPassword !== undefined ? (params.isTemporaryPassword ? 1 : 0) : (params.temporaryPassword ? 0 : 0);

  db.prepare(`
    INSERT INTO app_users (
      uid, email, name, phone, role, schoolId, status, passwordHash,
      isTemporaryPassword, requiresPasswordChange, tempPasswordPlain, isTestAccount, isOwner,
      createdBy, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uid,
    params.email.toLowerCase().trim(),
    params.name.trim(),
    params.phone?.trim() || '',
    params.role,
    params.schoolId || 'school_primary',
    passwordHash,
    isTemp,
    reqPwdChange,
    temporaryPassword, // Kept for initial display
    params.isTestAccount ? 1 : 0,
    isOwner,
    params.actingEmail,
    now,
    now
  );

  logSecurityAudit({
    actingUid: params.actingUid,
    actingEmail: params.actingEmail,
    action: 'USER_CREATED',
    targetUid: uid,
    targetEmail: params.email,
    role: params.role,
    details: `Created new account for ${params.name} with role ${params.role} in school ${params.schoolId || 'school_primary'}`,
    status: 'SUCCESS',
  });

  const createdUser = getAppUserByUid(uid)!;
  syncJsonBackup();
  syncUserToFirestore(createdUser).catch((err) =>
    console.warn('[FirestoreSync] Error syncing new user to Firestore:', err)
  );

  return { user: createdUser, temporaryPassword };
}

export function updateAppUser(
  uid: string,
  updates: {
    name?: string;
    email?: string;
    phone?: string;
    role?: UserRole;
    schoolId?: string;
    status?: 'ACTIVE' | 'INACTIVE';
  },
  actingUid: string,
  actingEmail: string
): AppUser {
  const target = getAppUserByUid(uid);
  if (!target) throw new Error('User not found');

  const actingUser = getAppUserByUid(actingUid);
  if (!actingUser || actingUser.role !== 'Super Admin') {
    throw new Error('Forbidden: Only Super Admin can modify user accounts.');
  }

  // CRITICAL OWNER PROTECTION: Owner account cannot be demoted, deactivated, or altered by non-owner
  if (target.isOwner || target.email.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
    if (updates.role && updates.role !== 'Super Admin') {
      throw new Error('Forbidden: The Software Owner role cannot be changed.');
    }
    if (updates.status && updates.status === 'INACTIVE') {
      throw new Error('Forbidden: The Software Owner account cannot be deactivated.');
    }
  }

  const now = new Date().toISOString();
  const newName = updates.name !== undefined ? updates.name.trim() : target.name;
  let newEmail = target.email;

  if (updates.email !== undefined && updates.email.trim() !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(updates.email.trim())) {
      throw new Error('Invalid email format.');
    }
    const normalized = updates.email.trim().toLowerCase();
    if (normalized !== target.email.toLowerCase()) {
      const existing = db.prepare('SELECT uid FROM app_users WHERE LOWER(email) = LOWER(?) AND uid != ?').get(normalized, uid);
      if (existing) {
        throw new Error(`Email address "${normalized}" is already registered to another user.`);
      }
      newEmail = normalized;

      // If updating owner's email, update system_security_settings so owner is never locked out
      if (target.isOwner || target.email.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
        db.prepare('UPDATE system_security_settings SET ownerEmail = ?, updatedAt = ? WHERE id = ?').run(
          newEmail,
          now,
          'sec_settings_primary'
        );
      }
    }
  }

  const newPhone = updates.phone !== undefined ? updates.phone.trim() : (target.phone || '');
  const newRole = updates.role !== undefined ? updates.role : target.role;
  const newSchoolId = updates.schoolId !== undefined ? updates.schoolId : target.schoolId;
  const newStatus = updates.status !== undefined ? updates.status : target.status;

  db.prepare(`
    UPDATE app_users
    SET name = ?, email = ?, phone = ?, role = ?, schoolId = ?, status = ?, updatedAt = ?
    WHERE uid = ?
  `).run(newName, newEmail, newPhone, newRole, newSchoolId, newStatus, now, uid);

  logSecurityAudit({
    actingUid,
    actingEmail,
    action: 'USER_UPDATED',
    targetUid: uid,
    targetEmail: newEmail,
    role: newRole,
    details: `Updated user profile (Email: ${newEmail}, Role: ${newRole}, Status: ${newStatus})`,
    status: 'SUCCESS',
  });

  return getAppUserByUid(uid)!;
}

export function deleteAppUser(uid: string, actingUid: string, actingEmail: string): boolean {
  const target = getAppUserByUid(uid);
  if (!target) throw new Error('User not found');

  const actingUser = getAppUserByUid(actingUid);
  if (!actingUser || actingUser.role !== 'Super Admin') {
    throw new Error('Forbidden: Only Super Admin can delete employee accounts.');
  }

  // CRITICAL OWNER PROTECTION: Owner account can NEVER be deleted
  if (target.isOwner || target.email.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
    throw new Error('CRITICAL FORBIDDEN: The Software Owner account can never be deleted.');
  }

  db.prepare('DELETE FROM app_users WHERE uid = ?').run(uid);

  logSecurityAudit({
    actingUid,
    actingEmail,
    action: 'USER_DELETED',
    targetUid: uid,
    targetEmail: target.email,
    role: target.role,
    details: `Deleted user account ${target.name} (${target.email})`,
    status: 'WARNING',
  });

  return true;
}

export function resetAppUserPassword(
  uid: string,
  actingUid: string,
  actingEmail: string
): { user: AppUser; temporaryPassword: string } {
  const target = getAppUserByUid(uid);
  if (!target) throw new Error('User not found');

  const actingUser = getAppUserByUid(actingUid);
  if (!actingUser || actingUser.role !== 'Super Admin') {
    throw new Error('Forbidden: Only Super Admin can reset user passwords.');
  }

  // Prevent resetting Owner password unless by Owner themselves
  if (target.isOwner && actingEmail.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
    throw new Error('Forbidden: The Software Owner password can only be reset by the Owner.');
  }

  const temporaryPassword = generateSecureTemporaryPassword();
  const passwordHash = hashPassword(temporaryPassword);
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE app_users
    SET passwordHash = ?, isTemporaryPassword = 1, requiresPasswordChange = 1,
        tempPasswordPlain = ?, updatedAt = ?
    WHERE uid = ?
  `).run(passwordHash, temporaryPassword, now, uid);

  logSecurityAudit({
    actingUid,
    actingEmail,
    action: 'PASSWORD_RESET',
    targetUid: uid,
    targetEmail: target.email,
    role: target.role,
    details: `Admin generated a temporary password for user ${target.email}`,
    status: 'SUCCESS',
  });

  return { user: getAppUserByUid(uid)!, temporaryPassword };
}

export function changeUserPassword(uid: string, newPassword: string): boolean {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }
  const user = getAppUserByUid(uid);
  if (!user) throw new Error('User not found');

  const passwordHash = hashPassword(newPassword);
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE app_users
    SET passwordHash = ?, isTemporaryPassword = 0, requiresPasswordChange = 0,
        tempPasswordPlain = NULL, updatedAt = ?
    WHERE uid = ?
  `).run(passwordHash, now, uid);

  // Invalidate any existing sessions for security
  invalidateAllUserSessions(uid);

  logSecurityAudit({
    actingUid: uid,
    actingEmail: user.email,
    action: 'PASSWORD_CHANGED',
    targetUid: uid,
    targetEmail: user.email,
    role: user.role,
    details: 'User successfully changed temporary password to personal password',
    status: 'SUCCESS',
  });

  syncJsonBackup();
  const updatedUser = getAppUserByUid(uid);
  if (updatedUser) {
    syncUserToFirestore(updatedUser).catch((err) =>
      console.warn('[FirestoreSync] Error syncing changed password to Firestore:', err)
    );
  }

  return true;
}

export function adminSetUserPassword(
  uid: string,
  newPasswordPlain: string,
  isTemporary: boolean,
  actingUid: string,
  actingEmail: string
): { user: AppUser; temporaryPassword?: string } {
  const target = getAppUserByUid(uid);
  if (!target) throw new Error('User not found');

  const actingUser = getAppUserByUid(actingUid);
  if (!actingUser || actingUser.role !== 'Super Admin') {
    throw new Error('Forbidden: Only Super Admin can assign passwords.');
  }

  if (newPasswordPlain.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const passwordHash = hashPassword(newPasswordPlain);
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE app_users
    SET passwordHash = ?, isTemporaryPassword = ?, requiresPasswordChange = ?,
        tempPasswordPlain = ?, updatedAt = ?
    WHERE uid = ?
  `).run(
    passwordHash,
    isTemporary ? 1 : 0,
    isTemporary ? 1 : 0,
    isTemporary ? newPasswordPlain : null,
    now,
    uid
  );

  // Invalidate any existing sessions for this user so old sessions cannot be used
  invalidateAllUserSessions(uid);

  logSecurityAudit({
    actingUid,
    actingEmail,
    action: 'ADMIN_SET_PASSWORD',
    targetUid: uid,
    targetEmail: target.email,
    role: target.role,
    details: `Admin assigned a ${isTemporary ? 'temporary' : 'permanent'} password to user ${target.email}`,
    status: 'SUCCESS',
  });

  syncJsonBackup();
  const updatedUser = getAppUserByUid(uid)!;
  syncUserToFirestore(updatedUser).catch((err) =>
    console.warn('[FirestoreSync] Error syncing admin password to Firestore:', err)
  );

  return { user: updatedUser, temporaryPassword: isTemporary ? newPasswordPlain : undefined };
}

export function changeUserEmail(
  uid: string,
  currentPassword: string,
  newEmail: string
): AppUser {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(newEmail.trim())) {
    throw new Error('Invalid email address format.');
  }

  const normalizedEmail = newEmail.trim().toLowerCase();
  const currentAccount = db.prepare('SELECT * FROM app_users WHERE uid = ?').get(uid) as any;
  if (!currentAccount) throw new Error('User not found.');

  if (normalizedEmail !== currentAccount.email.toLowerCase()) {
    const existing = db.prepare('SELECT uid FROM app_users WHERE LOWER(email) = LOWER(?) AND uid != ?').get(normalizedEmail, uid);
    if (existing) {
      throw new Error(`Email address "${normalizedEmail}" is already registered to another user.`);
    }
  }

  const isPasswordValid = verifyPassword(currentPassword, currentAccount.passwordHash);
  if (!isPasswordValid) {
    logSecurityAudit({
      actingUid: uid,
      actingEmail: currentAccount.email,
      action: 'EMAIL_CHANGE_FAILED',
      details: 'Failed email change attempt due to invalid current password',
      status: 'FAILED',
    });
    throw new Error('Current password entered is incorrect.');
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE app_users SET email = ?, updatedAt = ? WHERE uid = ?').run(normalizedEmail, now, uid);

  // If Super Admin changes own email, update system_security_settings.ownerEmail so owner is NEVER locked out!
  if (currentAccount.isOwner) {
    db.prepare('UPDATE system_security_settings SET ownerEmail = ?, updatedAt = ? WHERE id = ?').run(
      normalizedEmail,
      now,
      'sec_settings_primary'
    );
  }

  logSecurityAudit({
    actingUid: uid,
    actingEmail: normalizedEmail,
    action: 'EMAIL_CHANGED',
    targetUid: uid,
    targetEmail: normalizedEmail,
    role: currentAccount.role,
    details: `User changed registered email from ${currentAccount.email} to ${normalizedEmail}`,
    status: 'SUCCESS',
  });

  syncJsonBackup();
  const updatedUser = getAppUserByUid(uid)!;
  syncUserToFirestore(updatedUser).catch((err) =>
    console.warn('[FirestoreSync] Error syncing email to Firestore:', err)
  );

  return updatedUser;
}

export function changeUserPasswordWithCurrent(
  uid: string,
  currentPassword: string,
  newPassword: string
): AppUser {
  if (!newPassword || newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters long.');
  }

  const currentAccount = db.prepare('SELECT * FROM app_users WHERE uid = ?').get(uid) as any;
  if (!currentAccount) throw new Error('User not found.');

  const isPasswordValid = verifyPassword(currentPassword, currentAccount.passwordHash);
  if (!isPasswordValid) {
    logSecurityAudit({
      actingUid: uid,
      actingEmail: currentAccount.email,
      action: 'PASSWORD_CHANGE_FAILED',
      details: 'Failed password change attempt due to invalid current password',
      status: 'FAILED',
    });
    throw new Error('Current password entered is incorrect.');
  }

  const passwordHash = hashPassword(newPassword);
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE app_users
    SET passwordHash = ?, isTemporaryPassword = 0, requiresPasswordChange = 0,
        tempPasswordPlain = NULL, updatedAt = ?
    WHERE uid = ?
  `).run(passwordHash, now, uid);

  // Invalidate any other sessions for this user so old sessions cannot be hijacked
  invalidateAllUserSessions(uid);

  logSecurityAudit({
    actingUid: uid,
    actingEmail: currentAccount.email,
    action: 'PASSWORD_CHANGED',
    targetUid: uid,
    targetEmail: currentAccount.email,
    role: currentAccount.role,
    details: 'User successfully changed account password using current password verification',
    status: 'SUCCESS',
  });

  syncJsonBackup();
  const updatedUser = getAppUserByUid(uid)!;
  syncUserToFirestore(updatedUser).catch((err) =>
    console.warn('[FirestoreSync] Error syncing password to Firestore:', err)
  );

  return updatedUser;
}

export function createPasswordResetRequest(email: string): { success: boolean; message: string; requestId?: string } {
  const normalizedEmail = email.trim().toLowerCase();
  const account = getAppUserByEmail(normalizedEmail);
  if (!account) {
    logSecurityAudit({
      actingUid: 'anonymous',
      actingEmail: normalizedEmail,
      action: 'RESET_REQUEST_FAILED',
      targetEmail: normalizedEmail,
      details: 'Password reset requested for non-existent email',
      status: 'FAILED',
    });
    return {
      success: false,
      message: 'No active account found with this email address. Please check spelling or contact the administrator.',
    };
  }

  // Check if pending request exists
  const pending = db.prepare(`
    SELECT * FROM password_reset_requests
    WHERE LOWER(email) = LOWER(?) AND status = 'PENDING'
  `).get(normalizedEmail) as any;

  if (pending) {
    return {
      success: true,
      message: 'A password reset request is already pending review with the Software Owner (Super Admin).',
      requestId: pending.id,
    };
  }

  const id = `prr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO password_reset_requests (
      id, uid, email, userName, userRole, status, requestedAt
    ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?)
  `).run(
    id,
    account.uid,
    normalizedEmail,
    account.name,
    account.role,
    now
  );

  logSecurityAudit({
    actingUid: account.uid,
    actingEmail: normalizedEmail,
    action: 'PASSWORD_RESET_REQUESTED',
    targetUid: account.uid,
    targetEmail: normalizedEmail,
    role: account.role,
    details: `User submitted password reset request for administrative approval`,
    status: 'SUCCESS',
  });

  return {
    success: true,
    message: 'Password reset request submitted successfully. The Software Owner (Super Admin) has received your request and will approve it shortly.',
    requestId: id,
  };
}

export function getAllPasswordResetRequests(): PasswordResetRequest[] {
  return db.prepare(`
    SELECT * FROM password_reset_requests
    ORDER BY requestedAt DESC
  `).all() as unknown as PasswordResetRequest[];
}

export function resolvePasswordResetRequest(
  requestId: string,
  action: 'APPROVE' | 'REJECT',
  actingUid: string,
  actingEmail: string,
  rejectionReason?: string
): { success: boolean; request: PasswordResetRequest; temporaryPassword?: string } {
  const req = db.prepare('SELECT * FROM password_reset_requests WHERE id = ?').get(requestId) as any;
  if (!req) throw new Error('Password reset request not found.');

  const actingUser = getAppUserByUid(actingUid);
  if (!actingUser || actingUser.role !== 'Super Admin') {
    throw new Error('Forbidden: Only Super Admin can approve or reject password reset requests.');
  }

  const now = new Date().toISOString();

  if (action === 'APPROVE') {
    const temporaryPassword = generateSecureTemporaryPassword();
    const passwordHash = hashPassword(temporaryPassword);

    db.prepare(`
      UPDATE app_users
      SET passwordHash = ?, isTemporaryPassword = 1, requiresPasswordChange = 1,
          tempPasswordPlain = ?, updatedAt = ?
      WHERE uid = ?
    `).run(passwordHash, temporaryPassword, now, req.uid);

    db.prepare(`
      UPDATE password_reset_requests
      SET status = 'APPROVED', temporaryPassword = ?, resolvedAt = ?, resolvedBy = ?
      WHERE id = ?
    `).run(temporaryPassword, now, actingEmail, requestId);

    logSecurityAudit({
      actingUid,
      actingEmail,
      action: 'RESET_REQUEST_APPROVED',
      targetUid: req.uid,
      targetEmail: req.email,
      role: req.userRole,
      details: `Super Admin approved password reset request and generated temporary password`,
      status: 'SUCCESS',
    });

    const updatedReq = db.prepare('SELECT * FROM password_reset_requests WHERE id = ?').get(requestId) as any;
    return { success: true, request: updatedReq, temporaryPassword };
  } else {
    db.prepare(`
      UPDATE password_reset_requests
      SET status = 'REJECTED', rejectionReason = ?, resolvedAt = ?, resolvedBy = ?
      WHERE id = ?
    `).run(rejectionReason || 'Rejected by Administrator', now, actingEmail, requestId);

    logSecurityAudit({
      actingUid,
      actingEmail,
      action: 'RESET_REQUEST_REJECTED',
      targetUid: req.uid,
      targetEmail: req.email,
      role: req.userRole,
      details: `Super Admin rejected password reset request. Reason: ${rejectionReason || 'None provided'}`,
      status: 'WARNING',
    });

    const updatedReq = db.prepare('SELECT * FROM password_reset_requests WHERE id = ?').get(requestId) as any;
    return { success: true, request: updatedReq };
  }
}

export function recoverSuperAdminPassword(
  email: string,
  phone: string,
  newPassword: string
): { success: boolean; message: string } {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = phone.trim().replace(/[\s\-\(\)]/g, '');

  const user = getAppUserByEmail(normalizedEmail);
  if (!user) {
    return { success: false, message: 'No registered account found with this email address.' };
  }

  if (!user.isOwner && user.role !== 'Super Admin') {
    return { success: false, message: 'Direct owner recovery is reserved for the Super Admin account.' };
  }

  const userPhone = (user.phone || '').replace(/[\s\-\(\)]/g, '');
  if (!userPhone || !normalizedPhone || !userPhone.endsWith(normalizedPhone.slice(-7))) {
    return { success: false, message: 'The recovery phone number does not match our registered records for this account.' };
  }

  if (newPassword.length < 8) {
    return { success: false, message: 'The new password must be at least 8 characters long.' };
  }

  changeUserPassword(user.uid, newPassword);

  logSecurityAudit({
    actingUid: user.uid,
    actingEmail: user.email,
    action: 'OWNER_ACCOUNT_RECOVERED',
    targetUid: user.uid,
    targetEmail: user.email,
    role: user.role,
    details: 'Super Admin successfully recovered account access and set a new password via verified owner credentials',
    status: 'SUCCESS',
  });

  return { success: true, message: 'Super Admin password updated successfully! You can now log in.' };
}

export function createUserInvitation(params: {
  email: string;
  name?: string;
  role: UserRole;
  schoolId?: string;
  actingUid: string;
  actingEmail: string;
}): UserInvitation {
  const actingUser = getAppUserByUid(params.actingUid);
  if (!actingUser || actingUser.role !== 'Super Admin') {
    throw new Error('Forbidden: Only Super Admin can send employee invitations.');
  }

  // Cannot invite as Super Admin
  if (params.role === 'Super Admin') {
    throw new Error('Forbidden: Super Admin invitations are prohibited.');
  }

  const id = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const inviteToken = crypto.randomBytes(24).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO user_invitations (
      id, email, name, role, schoolId, status, inviteToken, invitedBy, createdAt, expiresAt
    ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)
  `).run(
    id,
    params.email.toLowerCase().trim(),
    params.name?.trim() || '',
    params.role,
    params.schoolId || 'school_primary',
    inviteToken,
    params.actingEmail,
    now.toISOString(),
    expiresAt
  );

  logSecurityAudit({
    actingUid: params.actingUid,
    actingEmail: params.actingEmail,
    action: 'INVITATION_SENT',
    targetEmail: params.email,
    role: params.role,
    details: `Sent invitation to ${params.email} with pre-assigned role ${params.role}`,
    status: 'SUCCESS',
  });

  return {
    id,
    email: params.email.toLowerCase().trim(),
    name: params.name?.trim() || '',
    role: params.role,
    schoolId: params.schoolId || 'school_primary',
    status: 'PENDING',
    inviteToken,
    invitedBy: params.actingEmail,
    createdAt: now.toISOString(),
    expiresAt,
  };
}

export function getAllUserInvitations(): UserInvitation[] {
  return db.prepare(`
    SELECT * FROM user_invitations
    ORDER BY createdAt DESC
  `).all() as unknown as UserInvitation[];
}

export function authenticateUser(
  email: string,
  password: string,
  ipAddress = ''
): { success: boolean; user?: AppUser; error?: string } {
  const account = getAppUserByEmail(email);

  if (!account) {
    logSecurityAudit({
      actingUid: 'anonymous',
      actingEmail: email,
      action: 'LOGIN_FAILED',
      targetEmail: email,
      details: 'Account with this email does not exist',
      status: 'FAILED',
      ipAddress,
    });
    return { success: false, error: 'Invalid email address or password.' };
  }

  // Account status verification
  if (account.status === 'INACTIVE') {
    logSecurityAudit({
      actingUid: account.uid,
      actingEmail: account.email,
      action: 'LOGIN_BLOCKED',
      targetUid: account.uid,
      targetEmail: account.email,
      role: account.role,
      details: 'Login attempt rejected because account is currently INACTIVE / Deactivated',
      status: 'FAILED',
      ipAddress,
    });
    return {
      success: false,
      error: 'Your account is deactivated. Please contact the Software Owner (Super Admin).',
    };
  }

  // Password verification
  let isValid = verifyPassword(password, account.passwordHash);
  if (!isValid && (account as any).tempPasswordPlain && (password === (account as any).tempPasswordPlain || password.trim() === (account as any).tempPasswordPlain)) {
    isValid = true;
    try {
      const upgradedHash = hashPassword(password.trim());
      db.prepare('UPDATE app_users SET passwordHash = ? WHERE uid = ?').run(upgradedHash, account.uid);
      syncJsonBackup();
    } catch {}
  }

  if (!isValid) {
    logSecurityAudit({
      actingUid: account.uid,
      actingEmail: email,
      action: 'LOGIN_FAILED',
      targetUid: account.uid,
      targetEmail: account.email,
      role: account.role,
      details: 'Incorrect password entered',
      status: 'FAILED',
      ipAddress,
    });
    return { success: false, error: 'Invalid email address or password.' };
  }

  // School status verification for multi-tenant accounts
  if (account.role !== 'Super Admin' && account.schoolId && account.schoolId !== 'school_primary') {
    try {
      const schoolRow = db.prepare('SELECT status, schoolName FROM school_info WHERE id = ?').get(account.schoolId) as any;
      if (schoolRow && schoolRow.status === 'INACTIVE') {
        logSecurityAudit({
          actingUid: account.uid,
          actingEmail: account.email,
          action: 'LOGIN_BLOCKED',
          targetUid: account.uid,
          targetEmail: account.email,
          role: account.role,
          details: `Login rejected because school "${schoolRow.schoolName}" is INACTIVE`,
          status: 'FAILED',
          ipAddress,
        });
        return {
          success: false,
          error: `Your school campus (${schoolRow.schoolName}) is currently suspended. Please contact the administrator.`,
        };
      }
    } catch {}
  }

  // Update lastLoginAt
  const now = new Date().toISOString();
  db.prepare('UPDATE app_users SET lastLoginAt = ? WHERE uid = ?').run(now, account.uid);

  logSecurityAudit({
    actingUid: account.uid,
    actingEmail: account.email,
    action: 'LOGIN_SUCCESS',
    targetUid: account.uid,
    targetEmail: account.email,
    role: account.role,
    details: `Successful login as ${account.role}`,
    status: 'SUCCESS',
    ipAddress,
  });

  const updatedUser = getAppUserByUid(account.uid)!;
  return { success: true, user: updatedUser };
}

// Seed Owner and Test Accounts if empty
export function seedAuthAndTestAccounts(): void {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM app_users').get() as { count: number };
  if (countRow.count === 0) {
    const defaultAccounts = [
      {
        uid: 'usr_owner_001',
        email: OWNER_EMAIL,
        name: 'Ahmad Waheed Ahmad (Software Owner)',
        phone: '+92 300 7589214',
        role: 'Super Admin' as UserRole,
        password: 'Owner@Edupro2026!',
        isTestAccount: 0,
        isOwner: 1,
        requiresPasswordChange: 0,
      },
      {
        uid: 'usr_test_principal',
        email: 'test.principal@siqarah-shorkot.edu.pk',
        name: '[TEST] Dr. Saeed Ahmad (Principal)',
        phone: '+92 300 7589215',
        role: 'Principal' as UserRole,
        password: 'Principal#2026!',
        isTestAccount: 1,
        isOwner: 0,
        requiresPasswordChange: 1,
      },
      {
        uid: 'usr_test_hr',
        email: 'test.hr@siqarah-shorkot.edu.pk',
        name: '[TEST] Muhammad Rizwan (HR Officer)',
        phone: '+92 300 7589216',
        role: 'HR' as UserRole,
        password: 'HROfficer#2026!',
        isTestAccount: 1,
        isOwner: 0,
        requiresPasswordChange: 1,
      },
      {
        uid: 'usr_test_clerk',
        email: 'test.clerk@siqarah-shorkot.edu.pk',
        name: '[TEST] Tariq Mehmood (Admission Clerk)',
        phone: '+92 300 7589217',
        role: 'Clerk' as UserRole,
        password: 'Clerk#2026!',
        isTestAccount: 1,
        isOwner: 0,
        requiresPasswordChange: 1,
      },
      {
        uid: 'usr_test_accountant',
        email: 'test.accountant@siqarah-shorkot.edu.pk',
        name: '[TEST] Farooq Azam (Accounts Officer)',
        phone: '+92 300 7589218',
        role: 'Accountant' as UserRole,
        password: 'Accountant#2026!',
        isTestAccount: 1,
        isOwner: 0,
        requiresPasswordChange: 1,
      },
      {
        uid: 'usr_test_teacher',
        email: 'test.teacher@siqarah-shorkot.edu.pk',
        name: '[TEST] Usman Tariq (Senior Teacher)',
        phone: '+92 300 7589219',
        role: 'Teacher' as UserRole,
        password: 'Teacher#2026!',
        isTestAccount: 1,
        isOwner: 0,
        requiresPasswordChange: 0,
      },
    ];

    const insertStmt = db.prepare(`
      INSERT INTO app_users (
        uid, email, name, phone, role, schoolId, status, passwordHash,
        isTemporaryPassword, requiresPasswordChange, tempPasswordPlain, isTestAccount, isOwner,
        createdBy, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, 'school_primary', 'ACTIVE', ?, ?, ?, ?, ?, ?, 'System Bootstrap', ?, ?)
    `);

    const now = new Date().toISOString();
    defaultAccounts.forEach((acc) => {
      const pHash = hashPassword(acc.password);
      insertStmt.run(
        acc.uid,
        acc.email,
        acc.name,
        acc.phone,
        acc.role,
        pHash,
        acc.requiresPasswordChange,
        acc.requiresPasswordChange,
        acc.password,
        acc.isTestAccount,
        acc.isOwner,
        now,
        now
      );
    });

    logSecurityAudit({
      actingUid: 'system',
      actingEmail: 'system@edupro.local',
      action: 'SYSTEM_BOOTSTRAP',
      details: 'Initialized Software Owner account and 5 isolated dummy test accounts',
      status: 'SUCCESS',
    });
  }

  // Guarantee Super Admin (Owner) account always exists and is never lost
  const ownerUser = db.prepare('SELECT * FROM app_users WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))').get(OWNER_EMAIL) as any;
  if (!ownerUser) {
    const now = new Date().toISOString();
    const pHash = hashPassword('Owner@Edupro2026!');
    db.prepare(`
      INSERT INTO app_users (
        uid, email, name, phone, role, schoolId, status, passwordHash,
        isTemporaryPassword, requiresPasswordChange, tempPasswordPlain, isTestAccount, isOwner,
        createdBy, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, 'school_primary', 'ACTIVE', ?, 0, 0, ?, 0, 1, 'System Bootstrap', ?, ?)
    `).run(
      'usr_owner_001',
      OWNER_EMAIL,
      'Ahmad Waheed Ahmad (Software Owner)',
      '+92 300 7589214',
      'Super Admin',
      pHash,
      'Owner@Edupro2026!',
      now,
      now
    );
    console.log('[AuthBootstrap] Guaranteed Super Admin account exists.');
  } else if (!ownerUser.passwordHash) {
    const pHash = hashPassword('Owner@Edupro2026!');
    db.prepare('UPDATE app_users SET passwordHash = ?, isOwner = 1, role = ? WHERE uid = ?').run(
      pHash,
      'Super Admin',
      ownerUser.uid
    );
  }
}

// Automatically restore from JSON backup if available, then seed auth accounts
export function restoreFromStoreIfAvailable(): void {
  try {
    if (!fs.existsSync(JSON_BACKUP_PATH)) return;
    const raw = fs.readFileSync(JSON_BACKUP_PATH, 'utf-8');
    if (!raw.trim()) return;
    const backup = JSON.parse(raw);

    // 1. Restore Schools
    if (Array.isArray(backup.schools)) {
      const checkSchoolStmt = db.prepare('SELECT id FROM school_info WHERE id = ?');
      const insertSchoolStmt = db.prepare(`
        INSERT INTO school_info (
          id, schoolName, schoolNameUrdu, board, principal, introduction, campusAddress,
          phone, email, availableClasses, academicSessions, activeSession, logoUrl, campusPicUrl,
          stampUrl, schoolCode, status, adminEmail, adminName, subscriptionPlan, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const sch of backup.schools) {
        if (!sch.id) continue;
        const exists = checkSchoolStmt.get(sch.id);
        if (!exists) {
          const availClasses = typeof sch.availableClasses === 'string' ? sch.availableClasses : JSON.stringify(sch.availableClasses || []);
          const acadSessions = typeof sch.academicSessions === 'string' ? sch.academicSessions : JSON.stringify(sch.academicSessions || []);
          insertSchoolStmt.run(
            sch.id,
            sch.schoolName || 'Unnamed School',
            sch.schoolNameUrdu || '',
            sch.board || 'BISE',
            sch.principal || 'Principal',
            sch.introduction || '',
            sch.campusAddress || '',
            sch.phone || '',
            sch.email || '',
            availClasses,
            acadSessions,
            sch.activeSession || '2026-2027',
            sch.logoUrl || '',
            sch.campusPicUrl || '',
            sch.stampUrl || '',
            sch.schoolCode || sch.id,
            sch.status || 'ACTIVE',
            sch.adminEmail || '',
            sch.adminName || '',
            sch.subscriptionPlan || 'Enterprise',
            sch.createdAt || new Date().toISOString(),
            sch.updatedAt || new Date().toISOString()
          );
        }
      }
    }

    // 2. Restore Users (including tenant principals and staff)
    if (Array.isArray(backup.users)) {
      const checkUserStmt = db.prepare('SELECT uid, passwordHash FROM app_users WHERE uid = ? OR LOWER(TRIM(email)) = LOWER(TRIM(?))');
      const insertUserStmt = db.prepare(`
        INSERT INTO app_users (
          uid, email, name, phone, role, schoolId, status, passwordHash,
          isTemporaryPassword, requiresPasswordChange, tempPasswordPlain, isTestAccount, isOwner,
          createdBy, createdAt, updatedAt, lastLoginAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const u of backup.users) {
        if (!u.uid || !u.email) continue;
        const exists = checkUserStmt.get(u.uid, u.email) as any;
        if (!exists) {
          insertUserStmt.run(
            u.uid,
            u.email.toLowerCase().trim(),
            u.name,
            u.phone || '',
            u.role,
            u.schoolId || 'school_primary',
            u.status || 'ACTIVE',
            u.passwordHash,
            u.isTemporaryPassword ? 1 : 0,
            u.requiresPasswordChange ? 1 : 0,
            u.tempPasswordPlain || '',
            u.isTestAccount ? 1 : 0,
            u.isOwner ? 1 : 0,
            u.createdBy || 'System Backup',
            u.createdAt || new Date().toISOString(),
            u.updatedAt || new Date().toISOString(),
            u.lastLoginAt || null
          );
        } else {
          // If the user already exists in SQLite, DO NOT overwrite their passwordHash with potentially stale backup data!
          // Only restore passwordHash if currently missing/empty in DB
          if (!exists.passwordHash && u.passwordHash) {
            db.prepare('UPDATE app_users SET passwordHash = ?, tempPasswordPlain = ? WHERE uid = ?').run(
              u.passwordHash,
              u.tempPasswordPlain || null,
              exists.uid
            );
          }
          db.prepare('UPDATE app_users SET name = ?, phone = ?, schoolId = ? WHERE uid = ?').run(
            u.name,
            u.phone || '',
            u.schoolId || 'school_primary',
            exists.uid
          );
        }
      }
    }

    // 3. Restore Sessions
    if (Array.isArray(backup.sessions)) {
      const checkSessionStmt = db.prepare('SELECT token FROM active_sessions WHERE token = ?');
      const insertSessionStmt = db.prepare(`
        INSERT INTO active_sessions (token, uid, email, role, createdAt, expiresAt, lastActiveAt, ipAddress, userAgent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const now = new Date().toISOString();
      for (const s of backup.sessions) {
        if (!s.token || !s.uid) continue;
        if (s.expiresAt && s.expiresAt < now) continue;
        const exists = checkSessionStmt.get(s.token);
        if (!exists) {
          insertSessionStmt.run(
            s.token,
            s.uid,
            s.email,
            s.role,
            s.createdAt || now,
            s.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            s.lastActiveAt || now,
            s.ipAddress || '',
            s.userAgent || ''
          );
        }
      }
    }

    // 4. Restore Students if empty
    const studentCount = (db.prepare('SELECT COUNT(*) as count FROM students').get() as any).count;
    if (studentCount === 0 && Array.isArray(backup.students) && backup.students.length > 0) {
      const insertStd = db.prepare(`
        INSERT INTO students (
          id, admissionNumber, fullName, fatherName, photoUrl, dob, gender, studentClass,
          admissionDate, mobileNumber, address, session, admissionFee, createdAt, isDeleted,
          permanentStudentId, section, status, isPassOut, schoolId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const st of backup.students) {
        insertStd.run(
          st.id,
          st.admissionNumber,
          st.fullName,
          st.fatherName,
          st.photoUrl || '',
          st.dob,
          st.gender,
          st.studentClass,
          st.admissionDate,
          st.mobileNumber,
          st.address,
          st.session,
          st.admissionFee || 0,
          st.createdAt,
          st.isDeleted ? 1 : 0,
          st.permanentStudentId || st.admissionNumber,
          st.section || 'A',
          st.status || 'Enrolled',
          st.isPassOut ? 1 : 0,
          st.schoolId || 'school_primary'
        );
      }
    }

    // 5. Restore Vouchers if empty
    const voucherCount = (db.prepare('SELECT COUNT(*) as count FROM vouchers').get() as any).count;
    if (voucherCount === 0 && Array.isArray(backup.vouchers) && backup.vouchers.length > 0) {
      const insertVoucher = db.prepare(`
        INSERT INTO vouchers (
          id, voucherNumber, studentId, admissionNumber, studentName, fatherName,
          studentClass, session, feeAmount, status, issueDate, dueDate, paidAt,
          updatedBy, updatedAt, notes, isDeleted, subtotal, totalPayable, balanceDue,
          amountPaid, section, schoolId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const v of backup.vouchers) {
        insertVoucher.run(
          v.id,
          v.voucherNumber,
          v.studentId,
          v.admissionNumber,
          v.studentName,
          v.fatherName,
          v.studentClass,
          v.session,
          v.feeAmount,
          v.status,
          v.issueDate,
          v.dueDate,
          v.paidAt || null,
          v.updatedBy || '',
          v.updatedAt,
          v.notes || '',
          v.isDeleted ? 1 : 0,
          v.subtotal || v.feeAmount,
          v.totalPayable || v.feeAmount,
          v.balanceDue || 0,
          v.amountPaid || 0,
          v.section || 'A',
          v.schoolId || 'school_primary'
        );
      }
    }
  } catch (err) {
    console.error('Error restoring store from JSON backup:', err);
  }
}

// Automatically restore and seed on DB init
restoreFromStoreIfAvailable();
seedAuthAndTestAccounts();
getSystemSecuritySettings();
syncJsonBackup();

// --- Session Management Functions ---

export interface SessionTokenPayload {
  uid: string;
  email: string;
  role: string;
  schoolId: string;
  iat: number;
  exp: number;
}

export function signSessionToken(payload: SessionTokenPayload): string {
  const jsonStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(jsonStr, 'utf-8').toString('base64url');
  const hmac = crypto.createHmac('sha256', AUTH_SECRET).update(payloadB64).digest('base64url');
  return `edu_v2.${payloadB64}.${hmac}`;
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'edu_v2') return null;
  const payloadB64 = parts[1];
  const hmacSig = parts[2];
  try {
    const expectedHmac = crypto.createHmac('sha256', AUTH_SECRET).update(payloadB64).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(hmacSig), Buffer.from(expectedHmac))) {
      return null;
    }
    const jsonStr = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    const payload: SessionTokenPayload = JSON.parse(jsonStr);
    if (!payload.uid || !payload.exp || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function createSession(
  user: AppUser,
  ipAddress = '',
  userAgent = ''
): { token: string; expiresAt: string } {
  const now = new Date();
  // 30 days active session duration with rolling refresh for permanent login
  const expiresDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const nowIso = now.toISOString();
  const expiresIso = expiresDate.toISOString();

  const tokenPayload: SessionTokenPayload = {
    uid: user.uid,
    email: user.email,
    role: user.role,
    schoolId: user.schoolId || 'school_primary',
    iat: now.getTime(),
    exp: expiresDate.getTime(),
  };
  const token = signSessionToken(tokenPayload);

  db.prepare(`
    INSERT OR REPLACE INTO active_sessions (token, uid, email, role, createdAt, expiresAt, lastActiveAt, ipAddress, userAgent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(token, user.uid, user.email, user.role, nowIso, expiresIso, nowIso, ipAddress, userAgent);

  syncJsonBackup();

  return { token, expiresAt: expiresIso };
}

export function validateSession(token: string): { user: AppUser; session: any } | null {
  if (!token) return null;
  const now = new Date().toISOString();

  // Check if token has been revoked via logout
  try {
    const isRevoked = db.prepare('SELECT 1 FROM revoked_sessions WHERE token = ?').get(token);
    if (isRevoked) {
      return null;
    }
  } catch {}

  // 1. Try cryptographic HMAC-signed token validation first (guaranteed persistent across server restarts)
  const verifiedPayload = verifySessionToken(token);
  if (verifiedPayload) {
    const user = getAppUserByUid(verifiedPayload.uid);
    if (!user || user.status === 'INACTIVE') {
      db.prepare('DELETE FROM active_sessions WHERE token = ?').run(token);
      return null;
    }

    // Ensure session exists in SQLite active_sessions table (auto-restore if missing or restarted)
    const existing = db.prepare('SELECT * FROM active_sessions WHERE token = ?').get(token) as any;
    const extendedExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    if (!existing) {
      db.prepare(`
        INSERT OR REPLACE INTO active_sessions (token, uid, email, role, createdAt, expiresAt, lastActiveAt, ipAddress, userAgent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(token, user.uid, user.email, user.role, new Date(verifiedPayload.iat).toISOString(), extendedExpires, now, '', '');
    } else {
      db.prepare('UPDATE active_sessions SET lastActiveAt = ?, expiresAt = ? WHERE token = ?').run(now, extendedExpires, token);
    }

    return {
      user,
      session: {
        token,
        uid: user.uid,
        email: user.email,
        role: user.role,
        schoolId: user.schoolId,
        expiresAt: extendedExpires,
      },
    };
  }

  // 2. Fallback for legacy tokens stored in active_sessions
  const row = db.prepare('SELECT * FROM active_sessions WHERE token = ?').get(token) as any;
  if (!row) return null;

  if (row.expiresAt < now) {
    db.prepare('DELETE FROM active_sessions WHERE token = ?').run(token);
    return null;
  }

  const user = getAppUserByUid(row.uid);
  if (!user || user.status === 'INACTIVE') {
    db.prepare('DELETE FROM active_sessions WHERE token = ?').run(token);
    return null;
  }

  // Rolling session refresh
  const extendedExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('UPDATE active_sessions SET lastActiveAt = ?, expiresAt = ? WHERE token = ?').run(now, extendedExpires, token);

  return { user, session: row };
}

export function invalidateSession(token: string): boolean {
  if (!token) return false;
  try {
    db.prepare('INSERT OR REPLACE INTO revoked_sessions (token, revokedAt, reason) VALUES (?, ?, ?)').run(
      token,
      new Date().toISOString(),
      'User logout'
    );
  } catch {}
  const res = db.prepare('DELETE FROM active_sessions WHERE token = ?').run(token);
  syncJsonBackup();
  return (res as any).changes > 0 || true;
}

export function invalidateAllUserSessions(uid: string): boolean {
  if (!uid) return false;
  try {
    const userSessions = db.prepare('SELECT token FROM active_sessions WHERE uid = ?').all(uid) as any[];
    for (const s of userSessions) {
      if (s.token) {
        db.prepare('INSERT OR REPLACE INTO revoked_sessions (token, revokedAt, reason) VALUES (?, ?, ?)').run(
          s.token,
          new Date().toISOString(),
          'All sessions invalidated'
        );
      }
    }
  } catch {}
  const res = db.prepare('DELETE FROM active_sessions WHERE uid = ?').run(uid);
  syncJsonBackup();
  return (res as any).changes > 0;
}

