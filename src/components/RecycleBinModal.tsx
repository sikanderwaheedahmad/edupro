/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  X,
  Search,
  Filter,
  CheckCircle2,
  ShieldAlert,
  Calendar,
  User,
  FileText,
  DollarSign,
  Award,
  RefreshCw,
} from 'lucide-react';
import { RecycleBinItem, UserRole } from '../types/school.ts';
import { formatDateTime } from '../utils/voucherHelpers.ts';

interface RecycleBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: UserRole;
  onItemRestored: () => void;
}

export const RecycleBinModal: React.FC<RecycleBinModalProps> = ({
  isOpen,
  onClose,
  userRole,
  onItemRestored,
}) => {
  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Permanent Delete Confirmation Modal state
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<RecycleBinItem | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/recycle-bin');
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (err) {
      console.error('Failed to fetch recycle bin items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchItems();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRestore = async (item: RecycleBinItem) => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/recycle-bin/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordType: item.recordType, id: item.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({
          text: `Successfully restored "${item.title}" (${item.referenceNumber}) to active database.`,
          type: 'success',
        });
        fetchItems();
        onItemRestored();
      } else {
        setActionMessage({ text: data.error || 'Failed to restore record.', type: 'error' });
      }
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Network error restoring record.', type: 'error' });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handlePermanentDelete = async () => {
    if (!permanentDeleteTarget) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/recycle-bin/permanent', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordType: permanentDeleteTarget.recordType,
          id: permanentDeleteTarget.id,
          adminName: 'Dr. Saeed Ahmad (Super Admin)',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage({
          text: `Record "${permanentDeleteTarget.title}" has been permanently purged from storage.`,
          type: 'success',
        });
        setPermanentDeleteTarget(null);
        fetchItems();
        onItemRestored();
      } else {
        setActionMessage({ text: data.error || 'Failed to permanently delete.', type: 'error' });
      }
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Network error.', type: 'error' });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const filteredItems = items.filter((item) => {
    if (typeFilter !== 'ALL' && item.recordType !== typeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        item.title.toLowerCase().includes(q) ||
        item.referenceNumber.toLowerCase().includes(q) ||
        item.dataSummary.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const isSuperAdmin = userRole === 'Super Admin' || userRole === 'Principal';

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'student':
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">Student</span>;
      case 'staff':
        return <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded">Staff</span>;
      case 'voucher':
        return <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded">Fee Voucher</span>;
      case 'certificate':
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">Certificate</span>;
      case 'staff_letter':
        return <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded">HR Letter</span>;
      case 'exam_result':
        return <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded">Result Card</span>;
      default:
        return <span className="bg-slate-100 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded">{type}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Recycle Bin & Recently Deleted Records
                <span className="text-xs font-semibold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-tabular">
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Safeguard against accidental deletion. Restore any student, staff, fee voucher, or certificate record.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action message */}
        {actionMessage && (
          <div
            className={`mt-4 p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
              actionMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* Filter / Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 my-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search deleted records by title, ref number, or details..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-400"
            />
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium"
            >
              <option value="ALL">All Categories ({items.length})</option>
              <option value="student">Students</option>
              <option value="staff">Staff Members</option>
              <option value="voucher">Fee Vouchers</option>
              <option value="staff_letter">HR Letters</option>
              <option value="certificate">Certificates</option>
              <option value="exam_result">Exam Results</option>
            </select>
            <button
              onClick={fetchItems}
              disabled={loading}
              className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
              title="Refresh Recycle Bin"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[250px]">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading recycle bin contents...</div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
              <Trash2 className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-600">The Recycle Bin is empty</p>
              <p className="text-[11px] text-slate-400 mt-0.5">No archived or deleted records found in this category.</p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={`${item.recordType}-${item.id}`}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-white transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {getTypeBadge(item.recordType)}
                    <span className="text-xs font-bold text-slate-900 truncate">{item.title}</span>
                    <span className="text-[11px] font-tabular font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                      {item.referenceNumber}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">{item.dataSummary}</p>
                  <div className="flex items-center gap-3 text-[10px] text-slate-400">
                    <span>Deleted: {formatDateTime(item.deletedAt)}</span>
                    <span>·</span>
                    <span>By: {item.deletedBy}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => handleRestore(item)}
                    disabled={isProcessing}
                    className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg shadow-xs transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </button>

                  {isSuperAdmin && (
                    <button
                      onClick={() => setPermanentDeleteTarget(item)}
                      disabled={isProcessing}
                      className="inline-flex items-center gap-1 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1.5 rounded-lg transition-colors"
                      title="Permanently remove from database (Super Admin only)"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Purge</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="pt-4 border-t border-slate-200 mt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-1.5 text-slate-600">
            <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Restoring a student also restores linked fee vouchers and historical certificates.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Permanent Delete Confirmation Warning Modal */}
      {permanentDeleteTarget && (
        <div className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-300 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-7 h-7" />
              <div>
                <h3 className="text-base font-bold text-slate-900">Permanently Delete Record?</h3>
                <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">
                  Irreversible Action · Non-Recoverable
                </span>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-xs text-rose-900 space-y-1">
              <p>
                You are about to permanently purge:
              </p>
              <p className="font-bold text-sm text-slate-950">
                {permanentDeleteTarget.title} ({permanentDeleteTarget.referenceNumber})
              </p>
              <p className="text-[11px] text-rose-700 pt-1">
                This record will be completely erased from the school database. It cannot be recovered later.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPermanentDeleteTarget(null)}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePermanentDelete}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Permanently Purge</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
