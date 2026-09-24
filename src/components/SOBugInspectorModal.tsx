import React, { useState, useMemo } from 'react';
import { FoilRoll, StockCutRecord } from '../types';
import { 
  X, 
  Bug, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  Filter, 
  Wrench, 
  ChevronDown, 
  ChevronRight, 
  Layers, 
  Clock, 
  Scissors, 
  ArrowRight,
  Info,
  Sparkles,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { 
  auditAllRollsSOHistory, 
  getSOAuditOverallSummary, 
  RollSOAuditResult, 
  SOBugIssue 
} from '../utils/soHistoryAudit';
import { formatMeters } from '../utils/formatters';

interface SOBugInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  rolls: FoilRoll[];
  records: StockCutRecord[];
  initialRollId?: string | null;
  onFixRoll: (rollId: string, correctRemaining: number, sumUsed?: number, sumNg?: number) => Promise<void>;
  onFixMultipleRolls: (
    adjustments: Array<{ rollId: string; expectedRemaining: number; sumUsed: number; sumNg: number }>
  ) => Promise<void>;
  canEdit: boolean;
}

type FilterTab = 'all' | 'issues_only' | 'duplicates' | 'jumps' | 'mismatches' | 'zeroed';

export const SOBugInspectorModal: React.FC<SOBugInspectorModalProps> = ({
  isOpen,
  onClose,
  rolls,
  records,
  initialRollId,
  onFixRoll,
  onFixMultipleRolls,
  canEdit,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('issues_only');
  const [expandedRollId, setExpandedRollId] = useState<string | null>(initialRollId || null);
  const [fixingRollId, setFixingRollId] = useState<string | null>(null);
  const [isBulkFixing, setIsBulkFixing] = useState(false);
  const [showBulkConsent, setShowBulkConsent] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

  // Run audit engine on all rolls
  const auditResults = useMemo(() => {
    return auditAllRollsSOHistory(rolls, records);
  }, [rolls, records]);

  // Overall summary
  const summary = useMemo(() => {
    return getSOAuditOverallSummary(auditResults);
  }, [auditResults]);

  // Filter rolls by tab and search query
  const filteredAuditResults = useMemo(() => {
    return auditResults.filter((res) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      let matchQuery = true;
      if (q) {
        const matchesLot = res.lotNumber.toLowerCase().includes(q);
        const matchesRoll = res.rollNumber.toLowerCase().includes(q);
        const matchesPattern = res.pattern.toLowerCase().includes(q);
        const matchesSO = res.timeline.some((t) => t.record.soNumber.toLowerCase().includes(q));
        matchQuery = matchesLot || matchesRoll || matchesPattern || matchesSO;
      }

      // Tab filter
      let matchTab = true;
      if (activeFilter === 'issues_only') {
        matchTab = res.issues.length > 0;
      } else if (activeFilter === 'duplicates') {
        matchTab = res.issues.some((i) => i.type === 'DUPLICATE_SO_EXACT' || i.type === 'DUPLICATE_SO_MULTIPLE');
      } else if (activeFilter === 'jumps') {
        matchTab = res.issues.some((i) => i.type === 'METER_JUMP');
      } else if (activeFilter === 'mismatches') {
        matchTab = res.canAutoAdjust;
      } else if (activeFilter === 'zeroed') {
        matchTab = res.isZeroedOut;
      }

      return matchQuery && matchTab;
    });
  }, [auditResults, searchQuery, activeFilter]);

  if (!isOpen) return null;

  // Single roll fix handler
  const handleFixSingleRoll = async (res: RollSOAuditResult) => {
    if (!canEdit) return;
    setFixingRollId(res.rollId);
    try {
      await onFixRoll(
        res.rollId,
        res.calculatedRemaining,
        res.totalUsedMeters,
        res.totalNgMeters
      );
    } finally {
      setFixingRollId(null);
    }
  };

  // Bulk fix for all eligible rolls with user consent
  const handleExecuteBulkFix = async () => {
    const eligible = auditResults.filter((r) => r.canAutoAdjust && !r.isZeroedOut);
    if (eligible.length === 0) return;
    setIsBulkFixing(true);
    try {
      const adjustments = eligible.map((r) => ({
        rollId: r.rollId,
        expectedRemaining: r.calculatedRemaining,
        sumUsed: r.totalUsedMeters,
        sumNg: r.totalNgMeters,
      }));
      await onFixMultipleRolls(adjustments);
      setShowBulkConsent(false);
      setConsentChecked(false);
    } finally {
      setIsBulkFixing(false);
    }
  };

  const eligibleForFixCount = auditResults.filter((r) => r.canAutoAdjust && !r.isZeroedOut).length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[70] flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                  ระบบตรวจหาบัคและวิเคราะห์ประวัติ SO รายม้วน
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold">
                  Roll SO Diagnostics
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                ตรวจสอบความถูกต้องของรายการตัด SO, ตรวจสอบการบันทึกซ้ำ, และตรวจสอบยอดคงเหลือโซ่ขาด
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

        {/* Top Metric Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-4 bg-slate-50 border-b border-slate-200 text-center text-xs">
          <div className="p-2.5 rounded-xl bg-white border border-slate-200">
            <span className="text-slate-500 block text-[11px]">ม้วนทั้งหมด</span>
            <span className="font-mono font-bold text-slate-900 text-base">{summary.totalRolls}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-white border border-slate-200">
            <span className="text-slate-500 block text-[11px]">พบข้อสังเกต/บัค</span>
            <span className={`font-mono font-bold text-base ${summary.rollsWithIssues > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {summary.rollsWithIssues} ม้วน
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-white border border-slate-200">
            <span className="text-slate-500 block text-[11px]">SO บันทึกซ้ำ</span>
            <span className={`font-mono font-bold text-base ${summary.duplicateSOIssuesCount > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
              {summary.duplicateSOIssuesCount} จุด
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-white border border-slate-200">
            <span className="text-slate-500 block text-[11px]">ยอดคงเหลือไม่ตรง</span>
            <span className={`font-mono font-bold text-base ${summary.masterMismatchCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {summary.masterMismatchCount} ม้วน
            </span>
          </div>
          <div className="col-span-2 sm:col-span-1 p-2.5 rounded-xl bg-white border border-slate-200">
            <span className="text-slate-500 block text-[11px]">กดตัดเป็น 0 แล้ว (ยกเว้น)</span>
            <span className="font-mono font-bold text-slate-700 text-base">{summary.zeroedOutExcludedCount} ม้วน</span>
          </div>
        </div>

        {/* Search & Filter Tabs Bar */}
        <div className="p-3 sm:px-5 sm:py-3 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="ค้นหา ล็อต, เบอร์ม้วน, ลาย, รหัส SO..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-xs">
            <button
              onClick={() => setActiveFilter('issues_only')}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeFilter === 'issues_only'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              เฉพาะม้วนที่พบบัค ({summary.rollsWithIssues})
            </button>
            <button
              onClick={() => setActiveFilter('duplicates')}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeFilter === 'duplicates'
                  ? 'bg-amber-500 text-slate-950 shadow-2xs font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              SO ซ้ำซ้อน ({summary.duplicateSOIssuesCount})
            </button>
            <button
              onClick={() => setActiveFilter('jumps')}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeFilter === 'jumps'
                  ? 'bg-amber-500 text-slate-950 shadow-2xs font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ยอดกระโดด ({summary.meterJumpIssuesCount})
            </button>
            <button
              onClick={() => setActiveFilter('mismatches')}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeFilter === 'mismatches'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ยอดไม่ตรงกับสต๊อก ({summary.readyToAdjustCount})
            </button>
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-slate-800 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ทั้งหมด ({summary.totalRolls})
            </button>
          </div>
        </div>

        {/* Rolls List Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3.5 bg-slate-50/50">
          
          {/* Bulk Action Consent Panel if triggered */}
          {showBulkConsent && (
            <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-400 space-y-3 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    ยืนยันความยินยอมในการปรับยอดสต๊อกให้ตรงตามประวัติ SO ({eligibleForFixCount} ม้วน)
                  </h4>
                  <p className="text-xs text-slate-600 mt-1">
                    ระบบจะอัปเดตยอดคงเหลือของทุกม้วนที่พบความคลาดเคลื่อนให้ตรงตามผลรวมของรายการตัดจริงในฐานข้อมูลกลาง 
                    <strong>โดยจะไม่ปรับม้วนที่กดตัดเป็น 0 แล้ว (isZeroedOut)</strong>
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-amber-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800">
                  ข้าพเจ้ายินยอมให้ปรับปรุงยอดคงเหลือตามใบสั่งตัด SO จริง
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowBulkConsent(false)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleExecuteBulkFix}
                  disabled={!consentChecked || isBulkFixing}
                  className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isBulkFixing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>ยืนยันและเริ่มปรับยอดทันที</span>
                </button>
              </div>
            </div>
          )}

          {filteredAuditResults.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-200">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
              <p className="font-bold text-slate-800 text-sm">ไม่พบข้อผิดพลาดตามเงื่อนไขที่เลือก</p>
              <p className="text-xs text-slate-400 mt-1">
                {activeFilter === 'issues_only' 
                  ? 'ประวัติ SO ของทุกม้วนถูกต้องสมบูรณ์ ไม่มีบัคหรือความคลาดเคลื่อน' 
                  : 'ลองเปลี่ยนคำค้นหาหรือตัวกรองด้านบน'}
              </p>
            </div>
          ) : (
            filteredAuditResults.map((res) => {
              const isExpanded = expandedRollId === res.rollId;
              const hasErrors = res.hasErrors;
              const hasWarnings = res.hasWarnings;
              const isFixing = fixingRollId === res.rollId;

              return (
                <div
                  key={res.rollId}
                  className={`bg-white rounded-xl border transition-all overflow-hidden ${
                    hasErrors 
                      ? 'border-rose-300 shadow-2xs' 
                      : hasWarnings 
                        ? 'border-amber-300 shadow-2xs' 
                        : 'border-slate-200'
                  }`}
                >
                  {/* Roll Summary Card Header */}
                  <div className="p-4 sm:p-4.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      
                      {/* Left specs & badges */}
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-sm text-slate-900">
                            ล็อต: {res.lotNumber}
                          </span>
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 font-mono font-bold text-xs rounded-md">
                            เบอร์ #{res.rollNumber}
                          </span>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded-md font-medium">
                            ลาย {res.pattern} · หน้า {res.width} มม.
                          </span>
                          {res.isZeroedOut ? (
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-700 font-bold text-[11px] rounded-md">
                              ตัดเป็น 0 แล้ว (ยกเว้นการปรับยอด)
                            </span>
                          ) : res.canAutoAdjust ? (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 font-bold text-[11px] rounded-md">
                              ยอดไม่ตรง ({res.diff > 0 ? '+' : ''}{formatMeters(res.diff)} ม.)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] rounded-md font-medium">
                              ยอดตรงกับ SO ✅
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-500 font-mono">
                          ม้วนเต็ม: {formatMeters(res.totalMeters)} ม. | ตัดลงแผ่นจริงสะสม: {formatMeters(res.totalUsedMeters)} ม. | NG: {formatMeters(res.totalNgMeters)} ม. | ประวัติ {res.totalCutsCount} ใบตัด
                        </div>
                      </div>

                      {/* Right meters & action */}
                      <div className="flex items-center gap-3 self-start sm:self-center">
                        <div className="text-right text-xs">
                          <span className="text-slate-400 block text-[11px]">คงเหลือในระบบ:</span>
                          <span className="font-mono font-bold text-slate-900 text-sm">
                            {formatMeters(res.currentRemaining)} ม.
                          </span>
                        </div>

                        <ArrowRight className="w-4 h-4 text-slate-300" />

                        <div className="text-right text-xs">
                          <span className="text-slate-400 block text-[11px]">คำนวณจาก SO:</span>
                          <span className="font-mono font-bold text-emerald-700 text-sm">
                            {formatMeters(res.calculatedRemaining)} ม.
                          </span>
                        </div>

                        {canEdit && res.canAutoAdjust && (
                          <button
                            type="button"
                            onClick={() => handleFixSingleRoll(res)}
                            disabled={isFixing}
                            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            title="ปรับยอดคงเหลือม้วนนี้ให้ตรงกับประวัติ SO"
                          >
                            {isFixing ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Wrench className="w-3.5 h-3.5" />
                            )}
                            <span className="hidden sm:inline">ปรับยอดม้วนนี้</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setExpandedRollId(isExpanded ? null : res.rollId)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="ดูรายละเอียดประวัติ SO และไทม์ไลน์"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Detected Issues Badges */}
                    {res.issues.length > 0 && (
                      <div className="mt-3 space-y-1.5 pt-3 border-t border-slate-100">
                        {res.issues.map((iss) => (
                          <div 
                            key={iss.id} 
                            className={`p-2.5 rounded-lg text-xs flex items-start gap-2 ${
                              iss.severity === 'error'
                                ? 'bg-rose-50 text-rose-900 border border-rose-200'
                                : iss.severity === 'warning'
                                  ? 'bg-amber-50 text-amber-900 border border-amber-200'
                                  : 'bg-slate-50 text-slate-700 border border-slate-200'
                            }`}
                          >
                            <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${
                              iss.severity === 'error' ? 'text-rose-600' : 'text-amber-600'
                            }`} />
                            <div className="space-y-0.5 flex-1">
                              <span className="font-bold block">{iss.title}</span>
                              <p className="text-[11px] leading-relaxed opacity-90">{iss.description}</p>
                              {iss.suggestedAction && (
                                <span className="text-[10px] font-semibold block text-slate-500 mt-0.5">
                                  💡 แนะนำ: {iss.suggestedAction}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Expanded Timeline Table */}
                  {isExpanded && (
                    <div className="bg-slate-50 p-4 border-t border-slate-200 animate-in fade-in">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>ไทม์ไลน์การตัดเรียงตามลำดับเวลา ({res.timeline.length} รายการ)</span>
                        </h4>
                        <span className="text-[11px] text-slate-500">
                          ตรวจสอบความต่อเนื่องของยอดคงเหลือแต่ละใบงาน
                        </span>
                      </div>

                      {res.timeline.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400 bg-white rounded-lg border border-slate-200">
                          ยังไม่มีประวัติการตัดในม้วนนี้
                        </div>
                      ) : (
                        <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 text-[11px]">
                              <tr>
                                <th className="p-2.5">ลำดับ</th>
                                <th className="p-2.5">รหัส SO</th>
                                <th className="p-2.5 text-right">ตัดลงแผ่น</th>
                                <th className="p-2.5 text-right">NG</th>
                                <th className="p-2.5 text-right">รวมตัดออก</th>
                                <th className="p-2.5 text-right">ก่อนตัด &rarr; หลังตัด</th>
                                <th className="p-2.5">สถานะความต่อเนื่อง (Chain)</th>
                                <th className="p-2.5">วันที่ใช้งาน</th>
                                <th className="p-2.5">ผู้บันทึก</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {res.timeline.map((step) => {
                                const rec = step.record;
                                return (
                                  <tr key={rec.id} className="hover:bg-slate-50">
                                    <td className="p-2.5 text-slate-400 font-mono">{step.index}</td>
                                    <td className="p-2.5 font-mono font-bold text-slate-900">
                                      <div className="flex items-center gap-1.5">
                                        <span>{rec.soNumber}</span>
                                        {step.isDuplicateSO && (
                                          <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-semibold">
                                            ซ้ำ {step.duplicateCount}x
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="p-2.5 text-right font-mono font-bold text-slate-800">
                                      {formatMeters(rec.usedMeters)} ม.
                                    </td>
                                    <td className="p-2.5 text-right font-mono text-rose-600">
                                      {rec.ngMeters > 0 ? `${formatMeters(rec.ngMeters)} ม.` : '-'}
                                    </td>
                                    <td className="p-2.5 text-right font-mono font-bold text-amber-900">
                                      -{formatMeters(rec.totalDeducted)} ม.
                                    </td>
                                    <td className="p-2.5 text-right font-mono text-[11px]">
                                      <span className="text-slate-500">{formatMeters(rec.remainingBefore ?? 0)}</span>
                                      <span className="text-slate-300 mx-1">&rarr;</span>
                                      <span className="font-bold text-emerald-700">{formatMeters(rec.remainingAfter ?? 0)} ม.</span>
                                    </td>
                                    <td className="p-2.5">
                                      {step.isChainValid ? (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                                          ต่อเนื่องปกติ ✅
                                        </span>
                                      ) : (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 font-bold border border-rose-300 animate-pulse">
                                          กระโดด {step.jumpDiff > 0 ? `+${formatMeters(step.jumpDiff)}` : formatMeters(step.jumpDiff)} ม. ⚠️
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-2.5 font-mono text-slate-600 whitespace-nowrap text-[11px]">
                                      {rec.usageDate || rec.recordedDate || '-'}
                                    </td>
                                    <td className="p-2.5 text-slate-600 truncate max-w-[100px] text-[11px]">
                                      {rec.recordedBy || 'ช่างคุมเครื่อง'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-slate-400" />
            <span>
              ม้วนที่ถูกตัดเป็น 0 แล้ว (isZeroedOut) จะได้รับการยกเว้นจากการปรับยอดอัตโนมัติทุกกรณี
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs transition-colors cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>

            {canEdit && eligibleForFixCount > 0 && !showBulkConsent && (
              <button
                type="button"
                onClick={() => setShowBulkConsent(true)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>ปรับยอดอัตโนมัติตาม SO ({eligibleForFixCount} ม้วน)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
