/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { X, History, UserCheck, Clock, FileText } from 'lucide-react';
import { FeeVoucher, VoucherAuditEntry } from '../types/school.ts';
import { formatDateTime } from '../utils/voucherHelpers.ts';

interface VoucherAuditModalProps {
  voucher: FeeVoucher | null;
  isOpen: boolean;
  onClose: () => void;
}

export const VoucherAuditModal: React.FC<VoucherAuditModalProps> = ({
  voucher,
  isOpen,
  onClose,
}) => {
  const [logs, setLogs] = useState<VoucherAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !voucher) return;
    const fetchAudit = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/vouchers/${voucher.id}/audit`);
        if (res.ok) {
          const data = await res.json();
          setLogs(data);
        }
      } catch (err) {
        console.error('Failed to load audit history:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAudit();
  }, [isOpen, voucher]);

  if (!isOpen || !voucher) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Payment Audit Trail
              </h3>
              <p className="text-xs text-slate-500 font-tabular">
                Voucher {voucher.voucherNumber} · {voucher.studentName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current State Indicator */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
          <span className="text-slate-500">Current Payment Status:</span>
          <span
            className={`font-bold px-2 py-0.5 rounded uppercase ${
              voucher.status === 'PAID'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {voucher.status}
          </span>
        </div>

        {/* Audit Log Entries */}
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading audit history...</div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">No status changes recorded yet.</div>
          ) : (
            logs.map((entry) => (
              <div
                key={entry.id}
                className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5 text-xs shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-600 uppercase text-[10px]">
                      {entry.previousStatus}
                    </span>
                    <span className="text-slate-400">→</span>
                    <span
                      className={`font-bold uppercase text-[10px] px-1.5 py-0.2 rounded ${
                        entry.newStatus === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {entry.newStatus}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-tabular">
                    {formatDateTime(entry.timestamp)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Authorized by: <strong>{entry.changedBy}</strong></span>
                </div>

                {entry.notes && (
                  <p className="text-[11px] text-slate-500 italic bg-slate-50 p-1.5 rounded">
                    "{entry.notes}"
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        <div className="pt-2 border-t border-slate-100 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
