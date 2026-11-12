/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Layers,
  Users,
  Check,
  X,
  Plus,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  Settings,
  Filter,
  Search,
} from 'lucide-react';
import { StudentRecord, SchoolProfile, ClassSectionInfo, SectionSetting } from '../types/school.ts';

interface ClassSectionManagerProps {
  students: StudentRecord[];
  schoolProfile: SchoolProfile;
  onRefreshStudents: () => void;
}

export const ClassSectionManager: React.FC<ClassSectionManagerProps> = ({
  students,
  schoolProfile,
  onRefreshStudents,
}) => {
  const [classSections, setClassSections] = useState<ClassSectionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string>('Class 1');
  const [savingClass, setSavingClass] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Bulk Transfer State
  const [transferFromClass, setTransferFromClass] = useState<string>('Class 1');
  const [transferFromSection, setTransferFromSection] = useState<string>('A');
  const [transferToSection, setTransferToSection] = useState<string>('B');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [transferReason, setTransferReason] = useState('Academic section re-organization');
  const [isTransferring, setIsTransferring] = useState(false);

  // New Class State
  const [newClassName, setNewClassName] = useState('');
  const [showAddClass, setShowAddClass] = useState(false);

  const fetchClassSections = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/classes-sections');
      if (res.ok) {
        const data = await res.json();
        setClassSections(data);
      }
    } catch (err) {
      console.error('Failed to fetch class sections:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassSections();
  }, []);

  const currentClassInfo = classSections.find((c) => c.className === selectedClass) || {
    className: selectedClass,
    sections: [
      { section: 'A', enabled: true, maxStudents: 40 },
      { section: 'B', enabled: true, maxStudents: 40 },
      { section: 'C', enabled: false, maxStudents: 40 },
      { section: 'D', enabled: false, maxStudents: 40 },
    ],
  };

  const handleToggleSection = async (sectionKey: string) => {
    const updatedSections = currentClassInfo.sections.map((s) => {
      if (s.section === sectionKey) {
        return { ...s, enabled: !s.enabled };
      }
      return s;
    });

    try {
      setSavingClass(selectedClass);
      const res = await fetch('/api/classes-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          className: selectedClass,
          sections: updatedSections,
        }),
      });
      if (res.ok) {
        setClassSections((prev) =>
          prev.map((c) => (c.className === selectedClass ? { ...c, sections: updatedSections } : c))
        );
        setActionMessage({
          text: `Section ${sectionKey} ${
            updatedSections.find((s) => s.section === sectionKey)?.enabled ? 'Enabled' : 'Disabled'
          } for ${selectedClass}`,
          type: 'success',
        });
      }
    } catch (err) {
      console.error(err);
      setActionMessage({ text: 'Failed to update section settings', type: 'error' });
    } finally {
      setSavingClass(null);
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  // Filter students eligible for section transfer
  const eligibleStudents = students.filter(
    (s) =>
      s.studentClass === transferFromClass &&
      (s.section || 'A').toUpperCase() === transferFromSection.toUpperCase() &&
      !s.isPassOut
  );

  const handleSelectAllStudents = () => {
    if (selectedStudentIds.length === eligibleStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(eligibleStudents.map((s) => s.id));
    }
  };

  const handleToggleSelectStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkTransfer = async () => {
    if (selectedStudentIds.length === 0) {
      setActionMessage({ text: 'Please select at least one student to transfer.', type: 'error' });
      return;
    }
    if (transferFromSection.toUpperCase() === transferToSection.toUpperCase()) {
      setActionMessage({ text: 'Destination section must be different from current section.', type: 'error' });
      return;
    }

    try {
      setIsTransferring(true);
      const res = await fetch('/api/sections/transfer-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentIds: selectedStudentIds,
          newSection: transferToSection,
          reason: transferReason,
          adminName: 'Dr. Saeed Ahmad (Principal)',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setActionMessage({
          text: `Successfully transferred ${data.transferredCount} student(s) from Section ${transferFromSection} to Section ${transferToSection}!`,
          type: 'success',
        });
        setSelectedStudentIds([]);
        onRefreshStudents();
      } else {
        const err = await res.json();
        setActionMessage({ text: err.error || 'Failed to transfer students', type: 'error' });
      }
    } catch (err) {
      setActionMessage({ text: 'Error connecting to server', type: 'error' });
    } finally {
      setIsTransferring(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  // Add custom class
  const handleAddClass = () => {
    if (!newClassName.trim()) return;
    const trimmed = newClassName.trim();
    if (classSections.some((c) => c.className.toLowerCase() === trimmed.toLowerCase())) {
      setActionMessage({ text: 'Class name already exists.', type: 'error' });
      return;
    }

    const defaultSections: SectionSetting[] = [
      { section: 'A', enabled: true, maxStudents: 40 },
      { section: 'B', enabled: true, maxStudents: 40 },
      { section: 'C', enabled: false, maxStudents: 40 },
      { section: 'D', enabled: false, maxStudents: 40 },
    ];

    fetch('/api/classes-sections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        className: trimmed,
        sections: defaultSections,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(() => {
        setClassSections((prev) => [...prev, { className: trimmed, sections: defaultSections }]);
        setSelectedClass(trimmed);
        setNewClassName('');
        setShowAddClass(false);
        setActionMessage({ text: `Class ${trimmed} added successfully!`, type: 'success' });
      });
  };

  // Calculate Student Count by Class and Section
  const getSectionStudentCount = (className: string, sectionLetter: string) => {
    return students.filter(
      (s) =>
        s.studentClass === className &&
        (s.section || 'A').toUpperCase() === sectionLetter.toUpperCase() &&
        !s.isPassOut
    ).length;
  };

  const getClassTotalStudents = (className: string) => {
    return students.filter((s) => s.studentClass === className && !s.isPassOut).length;
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
            <Layers className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Class & Section Management</h1>
            <p className="text-sm text-slate-500">
              Configure Sections A, B, C, D per class · Student Distribution · Multi-Student Section Transfer
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddClass(!showAddClass)}
          className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add New Class
        </button>
      </div>

      {actionMessage && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Add Class Form Modal / Drawer */}
      {showAddClass && (
        <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-3">
          <input
            type="text"
            placeholder="e.g. Class 11 / Pre-Medical"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            className="text-xs bg-white rounded-xl border border-blue-300 px-3 py-2 w-full sm:w-64 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <button
            onClick={handleAddClass}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs shadow-sm"
          >
            Confirm Add Class
          </button>
          <button
            onClick={() => setShowAddClass(false)}
            className="px-3 py-2 text-xs text-slate-500 hover:text-slate-800"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Two Column Layout: Section Configuration on Left, Bulk Section Transfer on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 Columns): Classes and Section Toggles */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Settings className="w-4 h-4 text-blue-600" /> Class Sections Configuration
              </h3>
              <span className="text-xs text-slate-500">
                Total Classes: {classSections.length}
              </span>
            </div>

            {/* Class Pill Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {classSections.map((cls) => {
                const isSelected = selectedClass === cls.className;
                const totalStudents = getClassTotalStudents(cls.className);
                return (
                  <button
                    key={cls.className}
                    onClick={() => setSelectedClass(cls.className)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-blue-50/60 border-blue-500 shadow-sm ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-xs text-slate-900">{cls.className}</div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                      <Users className="w-3 h-3 text-slate-400" />
                      <span>{totalStudents} student{totalStudents === 1 ? '' : 's'}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Section Toggles for Selected Class */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Sections for <span className="text-blue-700 font-extrabold">{selectedClass}</span>
                </span>
                <span className="text-xs text-slate-500">
                  Click on a section to enable or disable it
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(['A', 'B', 'C', 'D'] as const).map((secKey) => {
                  const secConfig = currentClassInfo.sections.find((s) => s.section === secKey) || {
                    section: secKey,
                    enabled: false,
                  };
                  const count = getSectionStudentCount(selectedClass, secKey);

                  return (
                    <div
                      key={secKey}
                      className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                        secConfig.enabled
                          ? 'bg-emerald-50/50 border-emerald-300'
                          : 'bg-slate-50 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono font-black text-base text-slate-900">
                          Section {secKey}
                        </span>
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            secConfig.enabled ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        ></span>
                      </div>

                      <div className="text-xs font-semibold text-slate-600 mb-3">
                        {count} enrolled
                      </div>

                      <button
                        onClick={() => handleToggleSection(secKey)}
                        disabled={savingClass === selectedClass}
                        className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                          secConfig.enabled
                            ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                        }`}
                      >
                        {secConfig.enabled ? 'Disable Section' : 'Enable Section'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (5 Columns): Multi-Student Section Transfer */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-blue-600" /> Multi-Student Section Transfer
            </h3>
            <p className="text-xs text-slate-500">
              Transfer multiple students between sections in bulk while preserving all historical records, fees, and exam cards.
            </p>

            {/* Class & Section Selectors */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Class
                </label>
                <select
                  value={transferFromClass}
                  onChange={(e) => {
                    setTransferFromClass(e.target.value);
                    setSelectedStudentIds([]);
                  }}
                  className="w-full text-xs rounded-xl border border-slate-300 px-2.5 py-2 bg-white"
                >
                  {classSections.map((c) => (
                    <option key={c.className} value={c.className}>
                      {c.className}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  From Sec
                </label>
                <select
                  value={transferFromSection}
                  onChange={(e) => {
                    setTransferFromSection(e.target.value);
                    setSelectedStudentIds([]);
                  }}
                  className="w-full text-xs rounded-xl border border-slate-300 px-2.5 py-2 bg-white font-bold"
                >
                  <option value="A">Sec A</option>
                  <option value="B">Sec B</option>
                  <option value="C">Sec C</option>
                  <option value="D">Sec D</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-blue-700 uppercase mb-1">
                  To Sec
                </label>
                <select
                  value={transferToSection}
                  onChange={(e) => setTransferToSection(e.target.value)}
                  className="w-full text-xs rounded-xl border border-blue-400 px-2.5 py-2 bg-blue-50/50 font-bold text-blue-900"
                >
                  <option value="A">Sec A</option>
                  <option value="B">Sec B</option>
                  <option value="C">Sec C</option>
                  <option value="D">Sec D</option>
                </select>
              </div>
            </div>

            {/* Transfer Reason */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Transfer Reason
              </label>
              <input
                type="text"
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="Reason for section change..."
                className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white"
              />
            </div>

            {/* Student Checklist */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700">
                  Select Students ({selectedStudentIds.length} of {eligibleStudents.length} selected)
                </span>
                {eligibleStudents.length > 0 && (
                  <button
                    onClick={handleSelectAllStudents}
                    className="text-xs text-blue-600 font-bold hover:underline"
                  >
                    {selectedStudentIds.length === eligibleStudents.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>

              <div className="border border-slate-200 rounded-xl max-h-56 overflow-y-auto divide-y divide-slate-100 bg-slate-50/50 p-1">
                {eligibleStudents.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400">
                    No active students enrolled in {transferFromClass} - Section {transferFromSection}
                  </div>
                ) : (
                  eligibleStudents.map((s) => {
                    const isSelected = selectedStudentIds.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-100/70' : 'hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectStudent(s.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{s.fullName}</p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            Roll #{s.rollNumber || 'N/A'} · Adm: {s.admissionNumber}
                          </p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Transfer Action Button */}
            <button
              onClick={handleBulkTransfer}
              disabled={isTransferring || selectedStudentIds.length === 0}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Transfer {selectedStudentIds.length} Student(s) to Section {transferToSection}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
