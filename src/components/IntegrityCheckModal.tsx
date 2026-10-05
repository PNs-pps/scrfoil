import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  Wrench, 
  ShieldCheck, 
  RefreshCw, 
  CheckSquare, 
  Square, 
  HelpCircle,
  Scissors,
  Layers,
  ArrowRight,
  Sparkles,
  Info,
  Bug
} from 'lucide-react';
import { IntegrityMismatch } from '../utils/integrityCheck';
import { formatMeters } from '../utils/formatters';

interface IntegrityCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  mismatches: IntegrityMismatch[];
  checkedAt: string;
  onFixRoll: (rollId: string, correctRemaining: number, sumUsed?: number, sumNg?: number) => Promise<void>;
  onFixMultipleRolls: (
    adjustments: Array<{ rollId: string; expectedRemaining: number; sumUsed: number; sumNg: number }>
  ) => Promise<void>;
  canEdit: boolean;
  onOpenSOAudit?: (rollId?: string) => void;
}

export const IntegrityCheckModal: React.FC<IntegrityCheckModalProps> = ({
  isOpen,
  onClose,
  mismatches,
  checkedAt,
  onFixRoll,
  onFixMultipleRolls,
  canEdit,
  onOpenSOAudit,
}) => {
  // Filter eligible rolls vs excluded zeroed-out rolls
  const eligibleRolls = mismatches.filter((m) => m.canAutoAdjust && !m.isZeroedOut);
  const zeroedOutRolls = mismatches.filter((m) => m.isZeroedOut);

  // Selected roll IDs for auto-adjustment
  const [selectedRollIds, setSelectedRollIds] = useState<string[]>(() =>
    eligibleRolls.map((m) => m.rollId)
  );

  // Consent confirmation step state
  const [showConsentConfirm, setShowConsentConfirm] = useState(false);
  const [isConsentChecked, setIsConsentChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fixingSingleId, setFixingSingleId] = useState<string | null>(null);

  if (!isOpen) return null;

  const isAllGood = mismatches.length === 0;

  const handleToggleSelectAll = () => {
    if (selectedRollIds.length === eligibleRolls.length) {
      setSelectedRollIds([]);
    } else {
      setSelectedRollIds(eligibleRolls.map((m) => m.rollId));
    }
  };

  const handleToggleSelectRoll = (rollId: string) => {
    setSelectedRollIds((prev) =>
      prev.includes(rollId) ? prev.filter((id) => id !== rollId) : [...prev, rollId]
    );
  };

  // Perform bulk auto-adjustment with user consent
  const handleExecuteConsentAutoFix = async () => {
    if (selectedRollIds.length === 0) return;
    setIsSubmitting(true);
    try {
      const adjustments = eligibleRolls
        .filter((m) => selectedRollIds.includes(m.rollId))
        .map((m) => ({
          rollId: m.rollId,
          expectedRemaining: m.expectedRemaining,
          sumUsed: m.sumUsedMeters,
          sumNg: m.sumNgMeters,
        }));

      await onFixMultipleRolls(adjustments);
      setShowConsentConfirm(false);
      setIsConsentChecked(false);
      onClose();
    } catch (err) {
      console.error('Failed to auto-reconcile rolls:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Perform single roll adjustment
  const handleFixSingle = async (m: IntegrityMismatch) => {
    setFixingSingleId(m.rollId);
    try {
      await onFixRoll(m.rollId, m.expectedRemaining, m.sumUsedMeters, m.sumNgMeters);
    } finally {
      setFixingSingleId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[70] flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
              isAllGood ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
            }`}>
              {isAllGood ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                  ตรวจสอบและปรับยอดคงเหลือตามใบตัด SO
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-medium">
                  Auto-Reconcile
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                ตรวจสอบล่าสุด: {checkedAt ? new Date(checkedAt).toLocaleString('th-TH') : '-'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {isAllGood ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <p className="text-slate-900 font-bold text-base">ยอดคงเหลือของทุกม้วนตรงกับใบสั่งตัด SO ทั้งหมด</p>
              <p className="text-slate-500 text-xs mt-1 max-w-md mx-auto">
                ระบบคำนวณจากยอดรับเข้า ลบด้วยผลรวมรายการตัดจริงของแต่ละม้วน ไม่พบความคลาดเคลื่อน
              </p>
              {onOpenSOAudit && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenSOAudit();
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition-colors"
                >
                  <Bug className="w-3.5 h-3.5 text-amber-600" />
                  <span>ตรวจหาบัค SO เชิงลึกเพิ่มเติม</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Rule Banner: Zeroed-Out Rolls Excluded Notice */}
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold block">เงื่อนไขการปรับยอดอัตโนมัติ:</span>
                  <p className="text-slate-700 leading-relaxed">
                    ระบบจะคำนวณ <strong>ยอดรับเข้า &minus; ผลรวมที่ตัดจริงทุกใบ SO</strong> โดยจะ{' '}
                    <span className="font-bold text-rose-700 bg-rose-100/70 px-1 py-0.5 rounded">
                      ยกเว้นม้วนที่กดตัดเป็น 0 แล้ว (isZeroedOut)
                    </span>{' '}
                    โดยอัตโนมัติ เพื่อคงสถานะจบม้วนตามที่ผู้ใช้งานได้ระบุไว้
                  </p>
                </div>
              </div>

              {/* Eligible Rolls for Auto Adjustment */}
              {eligibleRolls.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                    <div className="text-xs text-slate-600">
                      พบ <strong className="text-rose-600 font-bold">{eligibleRolls.length} ม้วน</strong> ที่ยอดไม่ตรงกับใบสั่งตัด SO 
                      {selectedRollIds.length > 0 && (
                        <span className="text-slate-500 ml-1">
                          (เลือกแล้ว {selectedRollIds.length} ม้วน)
                        </span>
                      )}
                    </div>
                    {canEdit && eligibleRolls.length > 1 && (
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        className="text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                      >
                        {selectedRollIds.length === eligibleRolls.length ? (
                          <>
                            <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
                            <span>ยกเลิกเลือกทั้งหมด</span>
                          </>
                        ) : (
                          <>
                            <Square className="w-3.5 h-3.5 text-slate-400" />
                            <span>เลือกทั้งหมด ({eligibleRolls.length} ม้วน)</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* List of Eligible Rolls */}
                  <div className="space-y-2.5">
                    {eligibleRolls.map((m) => {
                      const isSelected = selectedRollIds.includes(m.rollId);
                      const isFixing = fixingSingleId === m.rollId;

                      return (
                        <div 
                          key={m.rollId} 
                          className={`border rounded-xl p-3.5 transition-all ${
                            isSelected 
                              ? 'border-amber-400 bg-amber-50/40 shadow-xs' 
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              {canEdit && (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectRoll(m.rollId)}
                                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
                                />
                              )}
                              <div>
                                <div className="font-mono font-bold text-sm text-slate-900 flex items-center gap-2">
                                  <span>ล็อต {m.lotNumber}</span>
                                  <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded text-xs">
                                    #{m.rollNumber}
                                  </span>
                                  <span className="text-xs font-sans text-slate-600 font-normal">
                                    ลาย {m.pattern} · {m.width} มม.
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-500">
                                  ม้วนเต็ม: {formatMeters(m.totalMeters)} ม. · ประวัติการตัด {m.recordCount} ใบงาน SO
                                </span>
                              </div>
                            </div>

                            {onOpenSOAudit && (
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onOpenSOAudit(m.rollId);
                                }}
                                className="text-[11px] text-slate-500 hover:text-amber-700 flex items-center gap-1 font-medium underline"
                              >
                                <Bug className="w-3 h-3" />
                                <span>ตรวจประวัติ SO ม้วนนี้</span>
                              </button>
                            )}
                          </div>

                          {/* Meters Before & After Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2.5 text-xs bg-white p-2.5 rounded-lg border border-slate-200">
                            <div>
                              <span className="text-slate-400 block text-[11px]">ยอดในระบบตอนนี้:</span>
                              <div className="font-bold text-slate-900 font-mono text-sm">
                                {formatMeters(m.actualRemaining)} ม.
                              </div>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[11px]">ยอดจริงตามใบตัด SO:</span>
                              <div className="font-bold text-emerald-700 font-mono text-sm">
                                {formatMeters(m.expectedRemaining)} ม.
                              </div>
                            </div>
                            <div className="col-span-2 sm:col-span-1">
                              <span className="text-slate-400 block text-[11px]">ผลต่างที่ต้องปรับ:</span>
                              <div className={`font-bold font-mono text-sm ${
                                m.diff > 0 ? 'text-rose-600' : 'text-blue-600'
                              }`}>
                                {m.diff > 0 ? `เกินจริงอยู่ +${formatMeters(m.diff)}` : `ต่ำกว่าจริง ${formatMeters(m.diff)}`} ม.
                              </div>
                            </div>
                          </div>

                          {/* Individual Fix Button */}
                          {canEdit && (
                            <div className="mt-2.5 flex items-center justify-between">
                              <span className="text-[11px] text-slate-500">
                                รวมตัดจริง: ใช้ {formatMeters(m.sumUsedMeters)} ม. + NG {formatMeters(m.sumNgMeters)} ม.
                              </span>
                              <button
                                type="button"
                                onClick={() => handleFixSingle(m)}
                                disabled={isFixing || isSubmitting}
                                className="inline-flex items-center gap-1 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                              >
                                {isFixing ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Wrench className="w-3 h-3 text-amber-600" />
                                )}
                                <span>ปรับม้วนนี้ม้วนเดียว ({formatMeters(m.expectedRemaining)} ม.)</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Zeroed-out Rolls (Excluded by Rule) */}
              {zeroedOutRolls.length > 0 && (
                <div className="pt-2">
                  <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-slate-500" />
                    <span>ม้วนที่ถูกตัดเป็น 0 แล้ว ({zeroedOutRolls.length} ม้วน — ยกเว้นการปรับยอด)</span>
                  </div>
                  <div className="space-y-2">
                    {zeroedOutRolls.map((m) => (
                      <div key={m.rollId} className="border border-slate-200 bg-slate-50/80 rounded-xl p-3 text-xs opacity-80">
                        <div className="flex items-center justify-between">
                          <div className="font-mono font-semibold text-slate-800">
                            ล็อต {m.lotNumber} · #{m.rollNumber} · {m.pattern} ({m.width} มม.)
                          </div>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-medium">
                            ตัดเป็น 0 แล้ว (คงค่าเดิม)
                          </span>
                        </div>
                        <div className="text-slate-500 text-[11px] mt-1">
                          ยอดคงเหลือ: 0 ม. (คำนวณจาก SO: {formatMeters(m.expectedRemaining)} ม. แต่ถูกตัดเป็น 0 ด้วยตนเอง จึงยกเว้น)
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* User Consent Confirmation Dialog Box */}
          {showConsentConfirm && (
            <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-400 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    ยืนยันความยินยอมในการปรับยอดสต๊อกอัตโนมัติ
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    คุณกำลังจะปรับยอดคงเหลือของฟอยล์จำนวน <strong>{selectedRollIds.length} ม้วน</strong> ให้ตรงกับผลรวมของใบสั่งตัด SO ทั้งหมดในฐานข้อมูลกลาง Firebase (ทำงานผ่าน Transaction เพื่อความปลอดภัย ข้อมูลจะซิงค์ตรงกันทุกเครื่อง)
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white border border-amber-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isConsentChecked}
                  onChange={(e) => setIsConsentChecked(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800">
                  ข้าพเจ้ายินยอมให้ระบบปรับปรุงยอดคงเหลือของ {selectedRollIds.length} ม้วนที่เลือก
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowConsentConfirm(false)}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleExecuteConsentAutoFix}
                  disabled={!isConsentChecked || isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>ยืนยันและปรับปรุงยอดทันที</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
          {onOpenSOAudit && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSOAudit();
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-amber-800 transition-colors"
            >
              <Bug className="w-3.5 h-3.5 text-amber-600" />
              <span>ตรวจหาบัคจากประวัติ SO แต่ละลูก</span>
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold transition-colors text-xs cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>

            {canEdit && eligibleRolls.length > 0 && !showConsentConfirm && (
              <button
                type="button"
                onClick={() => setShowConsentConfirm(true)}
                disabled={selectedRollIds.length === 0}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all shadow-xs text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>ปรับยอดอัตโนมัติตาม SO ({selectedRollIds.length} ม้วน)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
