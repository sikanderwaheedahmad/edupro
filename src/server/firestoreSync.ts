/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, query, where, limit } from 'firebase/firestore';
import fs from 'node:fs';
import path from 'node:path';
import { SchoolRecord, SchoolProfile } from '../types/school.ts';
import { AppUser } from '../types/auth.ts';

const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firestoreDb: any = null;

try {
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const app = getApps().length === 0 ? initializeApp(config) : getApp();
    firestoreDb = config.firestoreDatabaseId
      ? getFirestore(app, config.firestoreDatabaseId)
      : getFirestore(app);
    console.log('[FirestoreSync] Initialized cloud Firestore database:', config.firestoreDatabaseId);
  }
} catch (err) {
  console.warn('[FirestoreSync] Failed to initialize Firestore SDK:', err);
}

export function isFirestoreReady(): boolean {
  return firestoreDb !== null;
}

/**
 * Permanently syncs a school record, its settings, and its administrator user to Firebase Firestore.
 */
export async function syncSchoolToFirestore(school: SchoolRecord, user?: AppUser): Promise<boolean> {
  if (!firestoreDb) return false;
  try {
    const now = new Date().toISOString();
    const schoolPayload = {
      id: school.id,
      schoolCode: school.schoolCode || 'SCH001',
      schoolName: school.schoolName,
      schoolNameUrdu: school.schoolNameUrdu || '',
      board: school.board || 'BISE Faisalabad',
      principal: school.principal || school.adminName || 'Dr. Principal',
      introduction: school.introduction || `Welcome to ${school.schoolName}`,
      campusAddress: school.campusAddress || '',
      phone: school.phone || '',
      email: school.email || school.adminEmail || '',
      adminEmail: school.adminEmail || '',
      adminName: school.adminName || '',
      subscriptionPlan: school.subscriptionPlan || 'Enterprise',
      status: school.status || 'ACTIVE',
      logoUrl: school.logoUrl || '',
      campusPicUrl: school.campusPicUrl || '',
      stampUrl: school.stampUrl || '',
      website: school.website || '',
      principalPhotoUrl: school.principalPhotoUrl || '',
      availableClasses: typeof school.availableClasses === 'string' ? school.availableClasses : JSON.stringify(school.availableClasses || []),
      academicSessions: typeof school.academicSessions === 'string' ? school.academicSessions : JSON.stringify(school.academicSessions || []),
      activeSession: school.activeSession || '2026-2027',
      createdAt: school.createdAt || now,
      updatedAt: school.updatedAt || now,
    };

    // 1. Save to /schools/{schoolId}
    await setDoc(doc(firestoreDb, 'schools', school.id), schoolPayload, { merge: true });

    // 2. Save to /school_settings/{schoolId}
    await setDoc(doc(firestoreDb, 'school_settings', school.id), {
      schoolId: school.id,
      schoolCode: school.schoolCode,
      schoolName: school.schoolName,
      introduction: school.introduction || '',
      board: school.board,
      principal: school.principal,
      campusAddress: school.campusAddress,
      phone: school.phone,
      email: school.email,
      activeSession: school.activeSession,
      logoUrl: school.logoUrl || '',
      campusPicUrl: school.campusPicUrl || '',
      stampUrl: school.stampUrl || '',
      website: school.website || '',
      updatedAt: now,
    }, { merge: true });

    // 3. Save admin user to /users/{uid} if present
    if (user && user.uid) {
      await setDoc(doc(firestoreDb, 'users', user.uid), {
        uid: user.uid,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        schoolId: school.id,
        status: user.status || 'ACTIVE',
        isTemporaryPassword: user.isTemporaryPassword ? 1 : 0,
        requiresPasswordChange: user.requiresPasswordChange ? 1 : 0,
        isTestAccount: user.isTestAccount ? 1 : 0,
        isOwner: user.isOwner ? 1 : 0,
        createdBy: user.createdBy || 'System',
        createdAt: user.createdAt || now,
        updatedAt: now,
      }, { merge: true });
    }

    console.log(`[FirestoreSync] School "${school.schoolName}" (${school.id}) synced successfully to Firestore`);
    return true;
  } catch (err) {
    console.warn(`[FirestoreSync] Failed to sync school ${school.id} to Firestore:`, err);
    return false;
  }
}

/**
 * Permanently syncs school profile updates to /schools and /school_settings in Firestore
 */
export async function syncSchoolProfileToFirestore(schoolId: string, profile: SchoolProfile): Promise<boolean> {
  if (!firestoreDb) return false;
  try {
    const now = new Date().toISOString();
    const payload = {
      schoolName: profile.schoolName,
      schoolNameUrdu: profile.schoolNameUrdu || '',
      board: profile.board,
      principal: profile.principal,
      introduction: profile.introduction || '',
      campusAddress: profile.campusAddress,
      phone: profile.phone,
      email: profile.email,
      website: profile.website || '',
      logoUrl: profile.logoUrl || '',
      campusPicUrl: profile.campusPicUrl || '',
      stampUrl: profile.stampUrl || '',
      principalPhotoUrl: profile.principalPhotoUrl || '',
      activeSession: profile.activeSession,
      updatedAt: now,
    };

    await setDoc(doc(firestoreDb, 'schools', schoolId), payload, { merge: true });
    await setDoc(doc(firestoreDb, 'school_settings', schoolId), {
      schoolId,
      ...payload,
    }, { merge: true });

    console.log(`[FirestoreSync] Updated school profile for ${schoolId} in Firestore`);
    return true;
  } catch (err) {
    console.warn(`[FirestoreSync] Failed to update school profile for ${schoolId} in Firestore:`, err);
    return false;
  }
}

/**
 * Syncs a user profile to /users/{uid} in Firestore
 */
export async function syncUserToFirestore(user: AppUser): Promise<boolean> {
  if (!firestoreDb || !user.uid) return false;
  try {
    const now = new Date().toISOString();
    await setDoc(doc(firestoreDb, 'users', user.uid), {
      uid: user.uid,
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      schoolId: user.schoolId || 'school_primary',
      status: user.status || 'ACTIVE',
      isTemporaryPassword: user.isTemporaryPassword ? 1 : 0,
      requiresPasswordChange: user.requiresPasswordChange ? 1 : 0,
      isTestAccount: user.isTestAccount ? 1 : 0,
      isOwner: user.isOwner ? 1 : 0,
      createdBy: user.createdBy || 'System',
      createdAt: user.createdAt || now,
      updatedAt: now,
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn(`[FirestoreSync] Failed to sync user ${user.uid} to Firestore:`, err);
    return false;
  }
}

/**
 * Retrieves school document from Firestore directly to verify existence
 */
export async function getSchoolFromFirestore(schoolId: string): Promise<any | null> {
  if (!firestoreDb) return null;
  try {
    const snap = await getDoc(doc(firestoreDb, 'schools', schoolId));
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    console.warn(`[FirestoreSync] Error reading school ${schoolId} from Firestore:`, err);
    return null;
  }
}

/**
 * Retrieves all schools saved in Firestore
 */
export async function getAllSchoolsFromFirestore(): Promise<any[]> {
  if (!firestoreDb) return [];
  try {
    const snap = await getDocs(collection(firestoreDb, 'schools'));
    const list: any[] = [];
    snap.forEach((d) => list.push(d.data()));
    return list;
  } catch (err) {
    console.warn('[FirestoreSync] Error getting all schools from Firestore:', err);
    return [];
  }
}

/**
 * Permanently saves an uploaded file reference to Firestore under /schools/{schoolId}/files/{fileId}
 */
export async function syncUploadedFileToFirestore(schoolId: string, fileMeta: {
  id: string;
  fileName: string;
  category: string;
  url: string;
  size: number;
  mimeType: string;
  schoolId: string;
  createdAt: string;
}): Promise<boolean> {
  if (!firestoreDb) return false;
  try {
    await setDoc(doc(firestoreDb, 'schools', schoolId, 'files', fileMeta.id), fileMeta, { merge: true });
    return true;
  } catch (err) {
    console.warn(`[FirestoreSync] Failed to sync file record ${fileMeta.id} to Firestore:`, err);
    return false;
  }
}

/**
 * Retrieves all uploaded files recorded in Firestore for a school
 */
export async function getSchoolFilesFromFirestore(schoolId: string): Promise<any[]> {
  if (!firestoreDb) return [];
  try {
    const snap = await getDocs(collection(firestoreDb, 'schools', schoolId, 'files'));
    const files: any[] = [];
    snap.forEach((d) => files.push(d.data()));
    return files;
  } catch (err) {
    console.warn(`[FirestoreSync] Error getting files for school ${schoolId} from Firestore:`, err);
    return [];
  }
}

/**
 * Searches for a user profile in Firestore by email or UID
 */
export async function getUserFromFirestore(identifier: string): Promise<any | null> {
  if (!firestoreDb || !identifier) return null;
  try {
    const normalized = identifier.trim().toLowerCase();
    // 1. Direct doc lookup by UID
    const directSnap = await getDoc(doc(firestoreDb, 'users', identifier.trim()));
    if (directSnap.exists()) {
      return directSnap.data();
    }
    // 2. Query by email
    const q = query(collection(firestoreDb, 'users'), where('email', '==', normalized), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs[0].data();
    }
    return null;
  } catch (err) {
    console.warn(`[FirestoreSync] Error getting user ${identifier} from Firestore:`, err);
    return null;
  }
}


