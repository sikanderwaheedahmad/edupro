/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SchoolProfile } from '../types/school.ts';

/**
 * Returns the effective logo source for a school.
 * - If the school has an uploaded or configured logoUrl, returns it.
 * - If the school is the primary legacy campus (SCH001 / school_primary), returns its historical asset.
 * - For any newly created or multi-tenant school without a configured logo, generates a clean,
 *   crisp institutional educational crest SVG with the school's unique initials.
 *   This ensures NEW schools NEVER inherit Siqarah High School's logo!
 */
export function getSchoolLogoSrc(schoolProfile: Partial<SchoolProfile> | null | undefined): string {
  if (!schoolProfile) return '';

  if (schoolProfile.logoUrl && schoolProfile.logoUrl.trim() !== '' && schoolProfile.logoUrl !== '/assets/school_logo.jpg') {
    return schoolProfile.logoUrl;
  }

  // Primary school retains its historical logo asset
  const profileId = (schoolProfile as any).id;
  if (profileId === 'school_primary' || schoolProfile.schoolCode === 'SCH001') {
    return schoolProfile.logoUrl || '/assets/school_logo.jpg';
  }

  // Multi-tenant schools without configured logo get a clean institutional crest
  const name = schoolProfile.schoolName || 'School Campus';
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => w[0].toUpperCase())
    .join('') || 'EDU';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="crestGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="20" fill="url(#crestGrad)" stroke="#d97706" stroke-width="4"/>
  <path d="M64 22 L96 38 L64 54 L32 38 Z" fill="#f59e0b"/>
  <path d="M44 46 L44 70 Q64 86 84 70 L84 46" fill="none" stroke="#f59e0b" stroke-width="3" stroke-linecap="round"/>
  <text x="64" y="104" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="2">${initials}</text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
