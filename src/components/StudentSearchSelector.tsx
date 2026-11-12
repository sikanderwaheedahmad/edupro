/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  User,
  X,
  Check,
  Calendar,
  Phone,
  ShieldCheck,
  ChevronDown,
  Clock,
  AlertCircle,
  Hash,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { StudentRecord, StudentHistoryItem, StudentStatus } from '../types/school.ts';

export interface SelectedEnrollmentInfo {
  studentClass: string;
  section: string;
  session: string;
  rollNumber: string;
  isHistorical: boolean;
  historyNote?: string;
}

interface StudentSearchSelectorProps {
  onSelectStudent: (student: StudentRecord, enrollment?: SelectedEnrollmentInfo) => void;
  selectedStudentId?: string | null;
  selectedStudent?: StudentRecord | null;
  onClear?: () => void;
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
  compact?: boolean;
  includeHistorySelection?: boolean;
  disabled?: boolean;
}

export const StudentSearchSelector: React.FC<StudentSearchSelectorProps> = ({
  onSelectStudent,
  selectedStudentId,
  selectedStudent: externalSelectedStudent,
  onClear,
  label = 'Search & Select Student',
  placeholder = 'Search by Name, Permanent ID (SPHS-...), Roll #, Father Name, Mobile...',
  compact = false,
  includeHistorySelection = false,
  disabled = false,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeStudent, setActiveStudent] = useState<StudentRecord | null>(externalSelectedStudent || null);
  const [studentHistory, setStudentHistory] = useState<StudentHistoryItem[]>([]);
  const [selectedEnrollment, setSelectedEnrollment] = useState<SelectedEnrollmentInfo | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync external selected student
  useEffect(() => {
    if (externalSelectedStudent) {
      setActiveStudent(externalSelectedStudent);
    } else if (!selectedStudentId) {
      setActiveStudent(null);
      setSelectedEnrollment(null);
    }
  }, [externalSelectedStudent, selectedStudentId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Debounced search query
  useEffect(() => {
    let isCancelled = false;
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/students/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok && !isCancelled) {
          const data = await res.json();
          setResults(Array.isArray(data) ? data : []);
          setIsOpen(true);
        }
      } catch (err) {
        console.error('Search query failed:', err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }, 200);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  // Fetch history when student is selected and includeHistorySelection is true
  useEffect(() => {
    if (!activeStudent || !includeHistorySelection) {
      setStudentHistory([]);
      return;
    }

    let isMounted = true;
    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/students/${activeStudent.id}/history`);
        if (res.ok && isMounted) {
          const data: StudentHistoryItem[] = await res.json();
          setStudentHistory(data || []);
        }
      } catch (err) {
        console.error('Failed to load student history enrollments:', err);
      }
    };
    fetchHistory();

    return () => {
      isMounted = false;
    };
  }, [activeStudent, includeHistorySelection]);

  // Historical enrollment choices (deduplicated)
  const historicalOptions = useMemo<SelectedEnrollmentInfo[]>(() => {
    if (!activeStudent) return [];

    const list: SelectedEnrollmentInfo[] = [];

    // Current enrollment
    list.push({
      studentClass: activeStudent.studentClass,
      section: activeStudent.section || 'A',
      session: activeStudent.session,
      rollNumber: activeStudent.rollNumber || '—',
      isHistorical: false,
      historyNote: 'Current Enrolled Class',
    });

    // Check history items for promotions or transfers
    for (const h of studentHistory) {
      if (h.fromClass && h.fromSession) {
        const key = `${h.fromClass}_${h.fromSession}`;
        const alreadyAdded = list.some(
          (item) => `${item.studentClass}_${item.session}` === key
        );
        if (!alreadyAdded) {
          list.push({
            studentClass: h.fromClass,
            section: h.fromSection || 'A',
            session: h.fromSession,
            rollNumber: h.fromRollNumber || '—',
            isHistorical: true,
            historyNote: `Prior Record: ${h.title}`,
          });
        }
      }
    }

    // Previous school/class if recorded
    if (activeStudent.previousClass && !list.some((i) => i.studentClass === activeStudent.previousClass)) {
      list.push({
        studentClass: activeStudent.previousClass,
        section: 'A',
        session: 'Previous',
        rollNumber: activeStudent.previousRollNumber || '—',
        isHistorical: true,
        historyNote: `Admission Previous Class (${activeStudent.previousSchool || 'Prior School'})`,
      });
    }

    return list;
  }, [activeStudent, studentHistory]);

  const handleSelect = (student: StudentRecord) => {
    setActiveStudent(student);
    setIsOpen(false);
    setQuery('');

    const defaultEnrollment: SelectedEnrollmentInfo = {
      studentClass: student.studentClass,
      section: student.section || 'A',
      session: student.session,
      rollNumber: student.rollNumber || '—',
      isHistorical: false,
      historyNote: 'Current Enrolled Class',
    };
    setSelectedEnrollment(defaultEnrollment);
    onSelectStudent(student, defaultEnrollment);
  };

  const handleEnrollmentChange = (enrollment: SelectedEnrollmentInfo) => {
    setSelectedEnrollment(enrollment);
    if (activeStudent) {
      onSelectStudent(activeStudent, enrollment);
    }
  };

  const handleClear = () => {
    setActiveStudent(null);
    setSelectedEnrollment(null);
    setQuery('');
    setResults([]);
    if (onClear) onClear();
    if (searchInputRef.current) searchInputRef.current.focus();
  };

  const getStatusBadge = (status?: StudentStatus) => {
    const s = status || 'Enrolled';
    switch (s) {
      case 'Enrolled':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Enrolled</span>;
      case 'Stuck':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">Stuck</span>;
      case 'Expired':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Expired</span>;
      case 'SLC':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">SLC</span>;
      default:
        return null;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-slate-700">{label}</label>
          {activeStudent && (
            <button
              type="button"
              onClick={handleClear}
              className="text-[11px] text-amber-700 hover:text-amber-900 font-semibold cursor-pointer"
            >
              Change Student
            </button>
          )}
        </div>
      )}

      {/* Selected Student Display Card */}
      {activeStudent ? (
        <div className="bg-slate-50 border-2 border-amber-400/80 rounded-xl p-3.5 shadow-xs transition-all">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {activeStudent.photoUrl ? (
                <img
                  src={activeStudent.photoUrl}
                  alt={activeStudent.fullName}
                  className="w-12 h-12 rounded-lg object-cover border border-slate-300 shrink-0 bg-white"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0 border border-amber-200">
                  {activeStudent.fullName.charAt(0)}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 text-sm">{activeStudent.fullName}</span>
                  {getStatusBadge(activeStudent.status)}
                  <span className="text-[10px] font-mono px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded font-bold">
                    {activeStudent.permanentStudentId || activeStudent.admissionNumber}
                  </span>
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  S/O <strong>{activeStudent.fatherName}</strong>
                  {activeStudent.motherName ? ` · M/O ${activeStudent.motherName}` : ''}
                </div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>Class: <strong>{activeStudent.studentClass}</strong> ({activeStudent.section || 'A'})</span>
                  <span>·</span>
                  <span>Roll #{activeStudent.rollNumber || '—'}</span>
                  <span>·</span>
                  <span>Session: {activeStudent.session}</span>
                  <span>·</span>
                  <span>Adm #{activeStudent.admissionNumber}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-200/60 cursor-pointer"
              title="Deselect Student"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Historical Session Selector (Required for Certificates / Old Records) */}
          {includeHistorySelection && historicalOptions.length > 1 && (
            <div className="mt-3 pt-3 border-t border-slate-200/80">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Certificate Academic Enrollment:</span>
                </span>
                <span className="text-[10px] text-slate-500">
                  {selectedEnrollment?.isHistorical ? 'Historical Record Selected' : 'Active Class Selected'}
                </span>
              </div>
              <select
                value={
                  selectedEnrollment
                    ? `${selectedEnrollment.studentClass}_${selectedEnrollment.session}`
                    : ''
                }
                onChange={(e) => {
                  const found = historicalOptions.find(
                    (opt) => `${opt.studentClass}_${opt.session}` === e.target.value
                  );
                  if (found) handleEnrollmentChange(found);
                }}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-hidden focus:ring-1 focus:ring-amber-500"
              >
                {historicalOptions.map((opt, i) => (
                  <option key={i} value={`${opt.studentClass}_${opt.session}`}>
                    {opt.studentClass} (Sec {opt.section}) · Session {opt.session} · Roll #{opt.rollNumber} — {opt.historyNote}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      ) : (
        /* Search Input */
        <div className="relative">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!isOpen) setIsOpen(true);
              }}
              onFocus={() => {
                if (query.trim()) setIsOpen(true);
              }}
              placeholder={placeholder}
              disabled={disabled}
              className={`w-full pl-9 pr-9 ${
                compact ? 'py-1.5 text-xs' : 'py-2.5 text-xs sm:text-sm'
              } bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 shadow-2xs`}
            />
            {loading ? (
              <RefreshCw className="w-4 h-4 text-amber-500 animate-spin absolute right-3 top-2.5" />
            ) : query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setResults([]);
                }}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>

          {/* Search Dropdown Results */}
          {isOpen && query.trim().length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto divide-y divide-slate-100">
              {loading && results.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
                  <span>Searching student database...</span>
                </div>
              ) : results.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 space-y-1">
                  <AlertCircle className="w-4 h-4 text-slate-400 mx-auto" />
                  <p className="font-semibold text-slate-700">No student record found matching "{query}"</p>
                  <p className="text-[11px] text-slate-400">
                    Try searching by full name, Permanent ID (e.g. SPHS-2026-0001), class roll #, father name, or mobile.
                  </p>
                </div>
              ) : (
                results.map((student) => {
                  return (
                    <div
                      key={student.id}
                      onClick={() => handleSelect(student)}
                      className="p-3 hover:bg-amber-50/80 cursor-pointer transition-colors flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {student.photoUrl ? (
                          <img
                            src={student.photoUrl}
                            alt={student.fullName}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 bg-white"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 font-bold flex items-center justify-center shrink-0 border border-slate-200">
                            {student.fullName.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 truncate">{student.fullName}</span>
                            {getStatusBadge(student.status)}
                            <span className="font-mono text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 font-bold">
                              {student.permanentStudentId || student.admissionNumber}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            S/O {student.fatherName} · Phone: {student.mobileNumber}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-semibold text-slate-800 block">
                          {student.studentClass} ({student.section || 'A'})
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Roll #{student.rollNumber || '—'} · {student.session}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
