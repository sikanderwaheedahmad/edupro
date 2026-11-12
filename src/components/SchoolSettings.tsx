/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  Building,
  Image as ImageIcon,
  Upload,
  CheckCircle2,
  AlertCircle,
  Save,
  Globe,
  Mail,
  Phone,
  MapPin,
  User,
  FileText,
  Cloud,
  Check,
} from 'lucide-react';
import { SchoolProfile, UserRole } from '../types/school.ts';
import { canEditSchoolSettings } from '../utils/permissions.ts';
import { getSchoolLogoSrc } from '../utils/schoolBranding.ts';
import { db } from '../lib/firebase.ts';
import { doc, setDoc } from 'firebase/firestore';
import { fastUpload } from '../utils/fastUpload.ts';

interface SchoolSettingsProps {
  schoolProfile: SchoolProfile;
  onUpdateSchoolProfile: (updated: Partial<SchoolProfile>) => Promise<void>;
  currentUserRole?: UserRole;
}

export const SchoolSettings: React.FC<SchoolSettingsProps> = ({
  schoolProfile,
  onUpdateSchoolProfile,
  currentUserRole = 'Principal',
}) => {
  const isEditable = canEditSchoolSettings(currentUserRole);

  const schoolId =
    (schoolProfile as any).id ||
    (schoolProfile as any).schoolCode ||
    localStorage.getItem('edupro_active_school_id') ||
    'school_primary';

  // State values
  const [schoolName, setSchoolName] = useState(schoolProfile.schoolName || '');
  const [board, setBoard] = useState(schoolProfile.board || 'BISE Faisalabad');
  const [principal, setPrincipal] = useState(schoolProfile.principal || '');
  const [phone, setPhone] = useState(schoolProfile.phone || '');
  const [email, setEmail] = useState(schoolProfile.email || '');
  const [website, setWebsite] = useState(schoolProfile.website || '');
  const [introduction, setIntroduction] = useState(
    schoolProfile.introduction ||
      'Dedicated to providing exemplary academic instruction, moral values, and character development.'
  );
  const [campusAddress, setCampusAddress] = useState(schoolProfile.campusAddress || '');
  const [activeSession, setActiveSession] = useState(schoolProfile.activeSession || '2026-2027');

  // Asset preview states
  const [logoPreview, setLogoPreview] = useState(
    schoolProfile.logoUrl || getSchoolLogoSrc(schoolProfile)
  );
  const [campusPicPreview, setCampusPicPreview] = useState(
    schoolProfile.campusPicUrl || '/assets/school_building.jpg'
  );
  const [stampPreview, setStampPreview] = useState(
    schoolProfile.stampUrl || '/assets/school_stamp.jpg'
  );
  const [principalPhotoPreview, setPrincipalPhotoPreview] = useState(
    schoolProfile.principalPhotoUrl || ''
  );

  // Upload file references
  const logoFileRef = useRef<HTMLInputElement | null>(null);
  const campusFileRef = useRef<HTMLInputElement | null>(null);
  const stampFileRef = useRef<HTMLInputElement | null>(null);
  const principalPhotoRef = useRef<HTMLInputElement | null>(null);

  // File upload progress states
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoProgress, setLogoProgress] = useState(0);

  const [uploadingCampus, setUploadingCampus] = useState(false);
  const [campusProgress, setCampusProgress] = useState(0);

  const [uploadingStamp, setUploadingStamp] = useState(false);
  const [stampProgress, setStampProgress] = useState(0);

  const [uploadingPrincipalPhoto, setUploadingPrincipalPhoto] = useState(false);
  const [principalPhotoProgress, setPrincipalPhotoProgress] = useState(0);

  // Save states
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fast upload handler with real-time percentage, client optimization, and auto-retry
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    assetType: 'logo' | 'campus' | 'stamp' | 'principal',
    setPreview: (url: string) => void,
    setLoadingState: (loading: boolean) => void,
    setProgressState: (pct: number) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingState(true);
    setProgressState(0);
    setErrorMsg('');

    try {
      const categoryMap = {
        logo: 'logos',
        campus: 'campus',
        stamp: 'stamps',
        principal: 'principal',
      } as const;

      const result = await fastUpload({
        file,
        category: categoryMap[assetType] || 'general',
        schoolId,
        onProgress: (pct) => setProgressState(pct),
      });

      if (result.success && result.url) {
        setPreview(result.url);
      } else {
        throw new Error('Upload returned unsuccessful status.');
      }
    } catch (uploadErr: any) {
      console.error('[SchoolSettings] Fast upload failed:', uploadErr);
      setErrorMsg(uploadErr.message || 'File upload failed. Please try again.');
    } finally {
      setLoadingState(false);
      setProgressState(0);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSavedSuccess(false);

    const updatedProfileData: Partial<SchoolProfile> = {
      schoolName: schoolName.trim(),
      schoolNameUrdu: schoolProfile.schoolNameUrdu || '',
      board: board.trim(),
      principal: principal.trim(),
      introduction: introduction.trim(),
      campusAddress: campusAddress.trim(),
      phone: phone.trim(),
      email: email.trim(),
      website: website.trim(),
      activeSession,
      logoUrl: logoPreview,
      campusPicUrl: campusPicPreview,
      stampUrl: stampPreview,
      principalPhotoUrl: principalPhotoPreview,
    };

    try {
      // 1. Save via backend API (persists in SQLite and syncs JSON backup)
      await onUpdateSchoolProfile(updatedProfileData);

      // 2. Persist directly to Firebase Cloud Firestore for multi-tenant cloud storage
      try {
        await setDoc(
          doc(db, 'schools', schoolId),
          {
            id: schoolId,
            schoolCode: schoolProfile.schoolCode || 'SCH001',
            ...updatedProfileData,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        await setDoc(
          doc(db, 'school_settings', schoolId),
          {
            schoolId,
            ...updatedProfileData,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (firestoreErr) {
        console.warn('Firestore cloud document sync note:', firestoreErr);
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update school settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>System Configuration</span>
            <span>·</span>
            <span>Multi-School Tenant</span>
            <span>·</span>
            <span className="font-mono text-amber-700 font-bold">{schoolProfile.schoolCode || 'SCH001'}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-1">
            Official School Settings & Cloud Assets
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Configure school identity, contact information, official rubber stamp, branding logo, and academic credentials.
          </p>
        </div>

        {savedSuccess && (
          <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200 shadow-xs animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Settings & Assets Saved Permanently to Cloud!</span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-2 text-red-800 text-xs sm:text-sm">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {!isEditable && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-amber-900 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-amber-950">Read-Only Institutional Oversight</div>
            <p className="mt-0.5 leading-relaxed">
              Official school operational parameters (School Name, Principal, Board Affiliation, Logo, Stamp, and Class structures) are managed exclusively by School Leadership and Principal. As {currentUserRole}, you have read-only oversight to verify credentials.
            </p>
          </div>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 space-y-8">
        {/* Section 1: Visual Assets Management (Logo, Building Photo, Stamp, Principal Photo) */}
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-slate-500" />
              <span>1. Official Visual Assets & Institutional Media</span>
            </h2>
            <div className="flex items-center gap-1.5 text-[11px] text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md font-semibold">
              <Cloud className="w-3.5 h-3.5" />
              <span>Firebase Cloud Storage Enabled</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-5">
            {/* Asset A: School Logo */}
            <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2.5">
              <span className="text-xs font-bold text-slate-800">Official School Logo</span>
              <div className="w-24 h-24 rounded-xl bg-white border border-slate-300 p-1 flex items-center justify-center overflow-hidden shadow-xs">
                <img
                  src={logoPreview}
                  alt="School Logo"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <button
                type="button"
                disabled={uploadingLogo || !isEditable}
                onClick={() => logoFileRef.current?.click()}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 transition-colors shadow-2xs disabled:opacity-50"
              >
                <Upload className="w-3 h-3" />
                <span>{uploadingLogo ? `Uploading ${logoProgress}%` : 'Upload Logo'}</span>
              </button>
              <input
                ref={logoFileRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, 'logo', setLogoPreview, setUploadingLogo, setLogoProgress)}
                className="hidden"
              />
              <span className="text-[10px] text-slate-400">Used on all certificates, fee challans, & receipts</span>
            </div>

            {/* Asset B: Campus Building Photograph */}
            <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2.5">
              <span className="text-xs font-bold text-slate-800">Campus Building Photo</span>
              <div className="w-36 h-24 rounded-xl bg-white border border-slate-300 p-1 flex items-center justify-center overflow-hidden shadow-xs">
                <img
                  src={campusPicPreview}
                  alt="School Building"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <button
                type="button"
                disabled={uploadingCampus || !isEditable}
                onClick={() => campusFileRef.current?.click()}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 transition-colors shadow-2xs disabled:opacity-50"
              >
                <Upload className="w-3 h-3" />
                <span>{uploadingCampus ? `Uploading ${campusProgress}%` : 'Change Photo'}</span>
              </button>
              <input
                ref={campusFileRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, 'campus', setCampusPicPreview, setUploadingCampus, setCampusProgress)}
                className="hidden"
              />
              <span className="text-[10px] text-slate-400">Displayed on Welcome Screen & Portal</span>
            </div>

            {/* Asset C: Official Rubber Stamp */}
            <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2.5">
              <span className="text-xs font-bold text-slate-800">Official Rubber Stamp</span>
              <div className="w-24 h-24 rounded-xl bg-white border border-slate-300 p-1 flex items-center justify-center overflow-hidden shadow-xs">
                <img
                  src={stampPreview}
                  alt="School Stamp"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <button
                type="button"
                disabled={uploadingStamp || !isEditable}
                onClick={() => stampFileRef.current?.click()}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 transition-colors shadow-2xs disabled:opacity-50"
              >
                <Upload className="w-3 h-3" />
                <span>{uploadingStamp ? `Uploading ${stampProgress}%` : 'Change Stamp'}</span>
              </button>
              <input
                ref={stampFileRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, 'stamp', setStampPreview, setUploadingStamp, setStampProgress)}
                className="hidden"
              />
              <span className="text-[10px] text-slate-400">Applied on vouchers and certificates</span>
            </div>

            {/* Asset D: Principal Photograph */}
            <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-2.5">
              <span className="text-xs font-bold text-slate-800">Principal Photo (Optional)</span>
              <div className="w-24 h-24 rounded-xl bg-white border border-slate-300 p-1 flex items-center justify-center overflow-hidden shadow-xs">
                {principalPhotoPreview ? (
                  <img
                    src={principalPhotoPreview}
                    alt="Principal"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User className="w-10 h-10 text-slate-300" />
                )}
              </div>
              <button
                type="button"
                disabled={uploadingPrincipalPhoto || !isEditable}
                onClick={() => principalPhotoRef.current?.click()}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-lg border border-slate-300 transition-colors shadow-2xs disabled:opacity-50"
              >
                <Upload className="w-3 h-3" />
                <span>{uploadingPrincipalPhoto ? `Uploading ${principalPhotoProgress}%` : 'Upload Photo'}</span>
              </button>
              <input
                ref={principalPhotoRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e, 'principal', setPrincipalPhotoPreview, setUploadingPrincipalPhoto, setPrincipalPhotoProgress)}
                className="hidden"
              />
              <span className="text-[10px] text-slate-400">Institutional leadership profile</span>
            </div>
          </div>
        </div>

        {/* Section 2: School Identification & Profile Details */}
        <div>
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider pb-3 border-b border-slate-100 flex items-center gap-2">
            <Building className="w-4 h-4 text-slate-500" />
            <span>2. Institutional Identity & Accreditation</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Official School Name (English) *
              </label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
                required
                disabled={!isEditable}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Affiliation Board *
              </label>
              <input
                type="text"
                value={board}
                onChange={(e) => setBoard(e.target.value)}
                placeholder="e.g. BISE Faisalabad"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white font-medium"
                required
                disabled={!isEditable}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Head of Institution (Principal) *
              </label>
              <input
                type="text"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                placeholder="e.g. Dr. Saeed Ahmad"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white font-bold text-slate-900"
                required
                disabled={!isEditable}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Official School Email *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@school.edu.pk"
                  className="w-full pl-9 pr-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white font-medium"
                  required
                  disabled={!isEditable}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Administrative Telephone / Mobile *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+92 300 7589214"
                  className="w-full pl-9 pr-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white font-tabular"
                  required
                  disabled={!isEditable}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Official School Website URL
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://siqarah-shorkot.edu.pk"
                  className="w-full pl-9 pr-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white font-medium"
                  disabled={!isEditable}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Active Academic Session *
              </label>
              <select
                value={activeSession}
                onChange={(e) => setActiveSession(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white font-medium"
                disabled={!isEditable}
              >
                {schoolProfile.academicSessions.map((sess) => (
                  <option key={sess} value={sess}>
                    {sess}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Campus Physical Address *
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={campusAddress}
                  onChange={(e) => setCampusAddress(e.target.value)}
                  placeholder="Main Campus, Model Town, Shorkot, District Jhang"
                  className="w-full pl-9 pr-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                  required
                  disabled={!isEditable}
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Institutional Introduction & Vision Statement
              </label>
              <textarea
                rows={3}
                value={introduction}
                onChange={(e) => setIntroduction(e.target.value)}
                placeholder="Enter official institutional philosophy, background, or motto..."
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white leading-relaxed"
                disabled={!isEditable}
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>Updates sync automatically to Firebase Firestore & Local Database.</span>
          </div>

          {isEditable ? (
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-7 py-3 rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4 text-amber-400" />
              <span>{saving ? 'Saving to Firebase & Database...' : 'Save School Settings'}</span>
            </button>
          ) : (
            <span className="text-xs text-slate-500 font-semibold px-4 py-2 bg-slate-100 rounded-lg border border-slate-200">
              Settings Modification Reserved for Principal or Super Admin
            </span>
          )}
        </div>
      </form>
    </div>
  );
};
