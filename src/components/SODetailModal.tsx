import React, { useState } from 'react';
import { StockCutRecord, FoilRoll, WIDTH_SPECIFICATIONS } from '../types';
import { 
  X, 
  ArrowLeft, 
  Calendar, 
  User, 
  FileText, 
  Layers, 
  Scissors, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight,
  Clock,
  Tag,
  Copy,
  Check,
  Trash2,
  Lock
} from 'lucide-react';
import { formatMeters } from '../utils/formatters';
import { getPatternStyle } from '../utils/patternStyles';
import { UserMode } from '../utils/auth';

interface SODetailModalProps {
  record: StockCutRecord | null;
  rolls: FoilRoll[];
  records: StockCutRecord[];
  onClose: () => void;
  onDeleteRecord?: (recordId: string) => void;
  userMode?: UserMode;
  onRequestUnlock?: () => void;
}

export const SODetailModal: React.FC<SODetailModalProps> = ({
  record,
  rolls,
  records,
  onClose,
  onDeleteRecord,
  userMode = 'visitor',
  onRequestUnlock,
}) => {
  const [currentView, setCurrentView] = useState<'so' | 'roll'>('so');
  const [copied, setCopied] = useState(false);

  if (!record) return null;

  // Find the matching foil roll
  const matchedRoll = rolls.find(
    (r) => r.id === record.foilId || (r.lotNumber === record.lotNumber && r.rollNumber === record.rollNumber)
  );

  const patternStyle = getPatternStyle(record.pattern);

  // All cuts for this roll
  const rollCuts = records.filter(
    (r) =>
      r.foilId === (matchedRoll?.id || record.foilId) ||
      (r.lotNumber === (matchedRoll?.lotNumber || record.lotNumber) &&
        r.rollNumber === (matchedRoll?.rollNumber || record.rollNumber))
  );

  const handleCopyLine = () => {
    const sideText = record.isSilverSide ? ' [ท้องเงิน]' : record.isWhiteSide ? ' [ท้องขาว]' : '';
    const dateText = record.usageDate || record.recordedDate || (record.createdAt ? record.createdAt.slice(0, 10) : '');
    const text = [
      `📋 รายละเอียดตัดฟอยล์ SO: ${record.soNumber}`,
      `📅 วันที่ตัด: ${dateText}`,
      `🏷️ ม้วน: ล็อต ${record.lotNumber} | เบอร์ #${record.rollNumber}`,
      `📐 หน้ากว้าง: ${record.width} มม. (${WIDTH_SPECIFICATIONS[record.width] || ''})`,
      `🎨 ลายฟอยล์: ${record.pattern}${sideText}`,
      `✂️ ยอดตัดใช้งาน: ${formatMeters(record.usedMeters)} ม.` +
        (record.ngMeters > 0 ? ` (NG เสีย: ${formatMeters(record.ngMeters)} ม.)` : ''),
      `📉 รวมตัดออกสุทธิ: ${formatMeters(record.totalDeducted)} ม.`,
      `📊 คงเหลือในม้วน: ${formatMeters(record.remainingAfter)} ม.`,
      `👤 ผู้บันทึก: ${record.recordedBy || '-'}`,
      record.notes ? `📝 หมายเหตุ: ${record.notes}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const currentRollRemaining = matchedRoll ? matchedRoll.remainingMeters : record.remainingAfter;
  const currentRollTotal = matchedRoll ? matchedRoll.totalMeters : (record.remainingBefore || record.remainingAfter + record.totalDeducted);
  const rollPercentLeft = currentRollTotal > 0 ? Math.round((currentRollRemaining / currentRollTotal) * 100) : 0;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#060d1a]/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header: ปุ้มย้อนกลับเหลือไว้แค่ซ้ายบนของหน้าต่าง */}
        <div className="px-4 sm:px-5 py-3.5 bg-gradient-to-r from-[#0b1b36] via-[#0d2144] to-[#102952] border-b border-blue-900/40 text-white flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0">
            {/* ปุ้มย้อนกลับซ้ายบน */}
            {currentView === 'roll' ? (
              <button
                type="button"
                onClick={() => setCurrentView('so')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-xs transition-transform active:scale-95 cursor-pointer shrink-0"
                title="ย้อนกลับไปหน้าข้อมูล SO"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>ย้อนกลับ</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-blue-100 hover:text-white font-medium text-xs transition-colors cursor-pointer shrink-0"
                title="ย้อนกลับ / ปิดหน้าต่าง"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>ย้อนกลับ</span>
              </button>
            )}
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white leading-tight truncate">
                {currentView === 'so' ? (
                  <span>ใบสั่งผลิต SO: <strong className="text-amber-400 font-mono">{record.soNumber}</strong></span>
                ) : (
                  <span>รายละเอียดม้วนฟอยล์ที่ใช้</span>
                )}
              </h2>
              <p className="text-[11px] text-blue-200/80 truncate">
                {currentView === 'so'
                  ? `วันที่: ${record.usageDate || '-'} • บันทึก: ${record.recordedDate || '-'}`
                  : `ล็อต ${record.lotNumber} เบอร์ #${record.rollNumber}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {currentView === 'so' && (
              <button
                type="button"
                onClick={handleCopyLine}
                title="คัดลอกเพื่อส่ง LINE"
                className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-blue-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="ปิด"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {currentView === 'so' ? (
            /* VIEW 1: SO Cut Record Details */
            <div className="space-y-4">
              {/* SO Highlight Banner */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50/60 p-4 rounded-2xl border border-amber-200">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">
                      รหัสคำสั่งผลิต (SO)
                    </span>
                    <span className="font-mono font-black text-2xl text-amber-950 tracking-tight">
                      {record.soNumber}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-semibold text-slate-500 block">วันที่ใช้งาน</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {record.usageDate || '-'}
                    </span>
                  </div>
                </div>

                {record.notes && (
                  <div className="mt-2.5 pt-2.5 border-t border-amber-200/70 text-xs text-amber-900 bg-amber-100/50 p-2 rounded-xl">
                    <span className="font-bold">หมายเหตุ:</span> {record.notes}
                  </div>
                )}
              </div>

              {/* Cutting Amounts Grid */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-amber-600" />
                  <span>ข้อมูลยอดตัดสต๊อก</span>
                </h3>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">เมตรที่ใช้จริง</span>
                    <span className="font-mono font-extrabold text-slate-900 text-lg">
                      {formatMeters(record.usedMeters)}{' '}
                      <span className="text-xs font-normal text-slate-500">ม.</span>
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200">
                    <span className="text-[11px] text-rose-700 font-semibold block">เศษ NG เสีย</span>
                    <span className="font-mono font-extrabold text-rose-600 text-lg">
                      {formatMeters(record.ngMeters)}{' '}
                      <span className="text-xs font-normal text-slate-500">ม.</span>
                    </span>
                  </div>
                </div>

                {/* Remaining Flow */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 block text-[10px]">คงเหลือก่อนตัด</span>
                    <span className="font-bold text-slate-700">
                      {record.remainingBefore !== undefined ? `${formatMeters(record.remainingBefore)} ม.` : '-'}
                    </span>
                  </div>
                  <div className="text-slate-300 font-sans">➔</div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10px]">คงเหลือหลังตัด</span>
                    <span className="font-bold text-emerald-700 text-sm">
                      {formatMeters(record.remainingAfter)} ม.
                    </span>
                  </div>
                </div>
              </div>

              {/* FOIL ROLL USED SECTION - CLICKABLE TO VIEW FULL ROLL DETAILS */}
              <div className="bg-white rounded-2xl border-2 border-amber-300 shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-600" />
                    <span>ม้วนฟอยล์ที่ใช้ในใบงานนี้</span>
                  </h3>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full animate-pulse">
                    คลิกเพื่อดูละเอียด
                  </span>
                </div>

                {/* Interactive Card */}
                <button
                  type="button"
                  onClick={() => setCurrentView('roll')}
                  className="w-full text-left p-3.5 rounded-xl bg-gradient-to-r from-amber-50/80 via-white to-amber-50/40 border border-amber-200/90 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer group active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 text-base">
                          ล็อต {record.lotNumber}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-950 bg-amber-400 px-2 py-0.5 rounded-md border border-amber-500 shadow-2xs">
                          #{record.rollNumber}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                          หน้า {record.width} มม.
                        </span>
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${patternStyle.dotClass}`} />
                          <span>ลาย{record.pattern}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-amber-800 font-bold text-xs bg-amber-200/80 group-hover:bg-amber-300 px-3 py-2 rounded-xl transition-colors shrink-0 shadow-2xs">
                      <span>ดูข้อมูลม้วนนี้</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </button>
              </div>

              {/* Recorded Info Footer */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 truncate">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-[11px]">
                    ผู้บันทึก: <strong className="text-slate-900">{record.recordedBy || '-'}</strong>
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono shrink-0">
                  {record.recordedDate || record.createdAt ? `เวลา: ${record.recordedDate || record.createdAt}` : ''}
                </div>
              </div>

              {/* Action Buttons: Delete */}
              {onDeleteRecord && (
                <div className="pt-2 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (userMode === 'visitor') {
                        onRequestUnlock?.();
                        return;
                      }
                      if (
                        confirm(
                          `ต้องการยกเลิกรายการตัดสต๊อก SO: ${record.soNumber} หรือไม่?\n(ระบบจะคืนยอด ${record.totalDeducted.toLocaleString()} เมตร กลับเข้าม้วนฟอยล์อัตโนมัติ)`
                        )
                      ) {
                        onDeleteRecord(record.id);
                        onClose();
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 cursor-pointer transition-colors"
                  >
                    {userMode === 'visitor' ? <Lock className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                    <span>ยกเลิกรายการนี้ (คืนยอดเข้าม้วน)</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* VIEW 2: FULL DETAILS OF THIS FOIL ROLL */
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
              {/* Roll Overview Card */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 text-lg">
                      ล็อต {record.lotNumber}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-950 bg-amber-400 px-2 py-0.5 rounded-md border border-amber-500 shadow-2xs">
                      #{record.rollNumber}
                    </span>
                  </div>

                  {/* Status Badge */}
                  {currentRollRemaining <= 0 ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-700">
                      หมดแล้ว
                    </span>
                  ) : currentRollRemaining <= 50 ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                      ใกล้หมด (≤ 50 ม.)
                    </span>
                  ) : currentRollRemaining <= 200 ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      เหลือน้อย (≤ 200 ม.)
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      พร้อมใช้
                    </span>
                  )}
                </div>

                {/* Specs row */}
                <div className="flex flex-wrap items-center gap-2 text-xs pt-1 border-t border-slate-200/80">
                  <span className="font-mono bg-white px-2 py-1 rounded-lg border border-slate-200 font-bold text-slate-800">
                    หน้า {record.width} มม. {WIDTH_SPECIFICATIONS[record.width] ? `(${WIDTH_SPECIFICATIONS[record.width]})` : ''}
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${patternStyle.dotClass}`} />
                    <span>ลาย{record.pattern}</span>
                  </span>
                  {record.isSilverSide && (
                    <span className="inline-flex items-center font-bold text-slate-800 bg-gradient-to-r from-slate-100 to-zinc-200 px-2 py-1 rounded-lg border border-slate-300 shadow-2xs">
                      ท้องเงิน
                    </span>
                  )}
                  {record.isWhiteSide && (
                    <span className="inline-flex items-center font-bold text-slate-800 bg-white px-2 py-1 rounded-lg border border-slate-300 shadow-2xs">
                      ท้องขาว
                    </span>
                  )}
                  {matchedRoll?.dateReceived && (
                    <span className="text-[11px] text-slate-500 font-mono ml-auto">
                      รับเข้า: {matchedRoll.dateReceived}
                    </span>
                  )}
                </div>

                {/* Meter Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-2">
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-medium">เมตรลูกเต็ม</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {formatMeters(currentRollTotal)} ม.
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-medium">ใช้สะสม</span>
                    <span className="font-mono font-bold text-blue-700 text-sm">
                      {formatMeters(matchedRoll ? matchedRoll.usedMeters : record.usedMeters)} ม.
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-medium">NG สะสม</span>
                    <span className="font-mono font-bold text-rose-600 text-sm">
                      {formatMeters(matchedRoll ? matchedRoll.ngMeters : record.ngMeters)} ม.
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-medium">คงเหลือปัจจุบัน</span>
                    <span className="font-mono font-extrabold text-emerald-700 text-sm">
                      {formatMeters(currentRollRemaining)} ม.
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px] font-mono text-slate-500">
                    <span>คงเหลือในม้วน</span>
                    <span className="font-bold text-slate-800">{rollPercentLeft}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        currentRollRemaining <= 50
                          ? 'bg-rose-500'
                          : currentRollRemaining <= 200
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${rollPercentLeft}%` }}
                    />
                  </div>
                </div>

                {matchedRoll?.notes && (
                  <p className="text-xs text-slate-500 bg-white p-2 rounded-lg border border-slate-200">
                    <span className="font-semibold">หมายเหตุม้วน:</span> {matchedRoll.notes}
                  </p>
                )}
              </div>

              {/* Complete Cutting Timeline for this roll */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    <span>ประวัติการตัดของม้วนนี้ ({rollCuts.length} ครั้ง)</span>
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">
                    เรียงตามลำดับล่าสุด
                  </span>
                </div>

                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white overflow-hidden max-h-56 overflow-y-auto">
                  {rollCuts.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      ไม่มีประวัติการตัดอื่น
                    </div>
                  ) : (
                    rollCuts.map((cut) => {
                      const isCurrentCut = cut.id === record.id;
                      return (
                        <div
                          key={cut.id}
                          className={`p-3 text-xs flex items-center justify-between gap-2 transition-colors ${
                            isCurrentCut ? 'bg-amber-50/80 font-semibold' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-amber-950 bg-amber-100 px-1.5 py-0.5 rounded text-[11px]">
                                {cut.soNumber}
                              </span>
                              {isCurrentCut && (
                                <span className="text-[9px] font-bold text-amber-800 bg-amber-200/90 px-1.5 py-0.2 rounded">
                                  ใบงานปัจจุบัน
                                </span>
                              )}
                              <span className="font-mono text-slate-500 text-[10px]">
                                {cut.usageDate || cut.recordedDate || '-'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 truncate mt-0.5">
                              ผู้บันทึก: {cut.recordedBy || '-'}
                            </div>
                          </div>

                          <div className="text-right font-mono shrink-0">
                            <span className="font-bold text-slate-900 block">
                              -{formatMeters(cut.totalDeducted)} ม.
                            </span>
                            <span className="text-[10px] text-slate-400">
                              เหลือ {formatMeters(cut.remainingAfter)} ม.
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
