import React, { useState, useMemo } from 'react';
import { FoilRoll, StockCutRecord, PuSandwichCutRecord, SOAuditLogItem } from '../types';
import { auditAllRollsSOHistory, getSOAuditOverallSummary, RollSOAuditResult } from '../utils/soHistoryAudit';
import { formatThaiDate, formatThaiDateTime, formatMeters } from '../utils/formatters';
import { exportAuditLogsToCSV } from '../utils/auditLogger';
import { getPatternStyle } from '../utils/patternStyles';
import { 
  ArrowLeft, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  History, 
  FileSpreadsheet, 
  Search, 
  RefreshCw, 
  ArrowRight, 
  Filter, 
  User, 
  Clock, 
  Layers, 
  Bug, 
  Eye, 
  Sparkles,
  ChevronRight,
  ShieldAlert,
  AlertCircle,
  FileCheck2,
  Check
} from 'lucide-react';

interface SOAuditHubViewProps {
  rolls: FoilRoll[];
  records: StockCutRecord[];
  puRecords: PuSandwichCutRecord[];
  auditLogs: SOAuditLogItem[];
  currentUserEmail?: string | null;
  onBack?: () => void;
  onOpenSODetail?: (record: StockCutRecord) => void;
  onOpenSandwichDetail?: (record: PuSandwichCutRecord) => void;
  onVerifyRecord?: (recordType: 'foil' | 'sandwich', recordId: string, soNumber: string, rollInfo?: any) => Promise<void>;
  onInspectRollBugs?: (rollId?: string) => void;
}

type HubTab = 'discrepancy' | 'audit_trail' | 'verification_roster';

export const SOAuditHubView: React.FC<SOAuditHubViewProps> = ({
  rolls,
  records,
  puRecords,
  auditLogs,
  currentUserEmail,
  onBack,
  onOpenSODetail,
  onOpenSandwichDetail,
  onVerifyRecord,
  onInspectRollBugs,
}) => {
  const [activeTab, setActiveTab] = useState<HubTab>('discrepancy');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'pending' | 'issues'>('all');
  const [materialFilter, setMaterialFilter] = useState<'all' | 'foil' | 'sandwich'>('all');
  const [isVerifyingId, setIsVerifyingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 1. Audit Roll SO History Analysis
  const auditResults: RollSOAuditResult[] = useMemo(() => {
    return auditAllRollsSOHistory(rolls, records);
  }, [rolls, records]);

  const auditSummary = useMemo(() => {
    return getSOAuditOverallSummary(auditResults);
  }, [auditResults]);

  // Actionable Issues (ไม่นับแบ่งรอบปกติ)
  const rollsWithActionableIssues = useMemo(() => {
    return auditResults.filter((r) =>
      r.issues.some((i) => i.type !== 'SPLIT_PRODUCTION_BATCH')
    );
  }, [auditResults]);

  // Total Actionable Issues Count
  const totalIssueCount = useMemo(() => {
    return rollsWithActionableIssues.reduce(
      (sum, r) => sum + r.issues.filter((i) => i.type !== 'SPLIT_PRODUCTION_BATCH').length,
      0
    );
  }, [rollsWithActionableIssues]);

  // Verified records count
  const verifiedFoilCount = useMemo(() => {
    return records.filter((r) => r.verificationStatus === 'verified').length;
  }, [records]);

  const verifiedSandwichCount = useMemo(() => {
    return puRecords.filter((r) => r.verificationStatus === 'verified').length;
  }, [puRecords]);

  const totalVerifiedCount = verifiedFoilCount + verifiedSandwichCount;
  const totalRecordsCount = records.length + puRecords.length;

  // Data Health Score (0 - 100%)
  const healthScore = useMemo(() => {
    if (totalRecordsCount === 0) return 100;
    const penalty = totalIssueCount * 5;
    return Math.max(0, Math.min(100, Math.round(100 - penalty)));
  }, [totalRecordsCount, totalIssueCount]);

  // Unified SO list for Verification Roster
  const unifiedSOList = useMemo(() => {
    const list: Array<{
      id: string;
      recordType: 'foil' | 'sandwich';
      soNumber: string;
      date: string;
      operator: string;
      detailText: string;
      amountDisplay: string;
      verificationStatus: 'verified' | 'pending' | 'flagged';
      verifiedBy?: string;
      verifiedAt?: string;
      hasIssue?: boolean;
      rawFoil?: StockCutRecord;
      rawSandwich?: PuSandwichCutRecord;
    }> = [];

    // Map rolls that have issues by rollId
    const issueRollIds = new Set(rollsWithActionableIssues.map((r) => r.rollId));

    // Foil Cuts
    records.forEach((r) => {
      const isVerified = r.verificationStatus === 'verified';
      const hasIssue = issueRollIds.has(r.foilId);
      list.push({
        id: r.id,
        recordType: 'foil',
        soNumber: r.soNumber,
        date: r.usageDate || r.recordedDate || (r.createdAt ? r.createdAt.slice(0, 10) : ''),
        operator: r.recordedBy || 'ช่างคุมเครื่อง',
        detailText: `ม้วน #${r.rollNumber} ล็อต ${r.lotNumber} (${r.pattern}${r.isSilverSide ? ' [เงิน]' : r.isWhiteSide ? ' [ขาว]' : ''})`,
        amountDisplay: `${formatMeters(r.usedMeters)} ม.`,
        verificationStatus: isVerified ? 'verified' : hasIssue ? 'flagged' : 'pending',
        verifiedBy: r.verifiedBy,
        verifiedAt: r.verifiedAt,
        hasIssue,
        rawFoil: r,
      });
    });

    // Sandwich Cuts
    puRecords.forEach((r) => {
      const isVerified = r.verificationStatus === 'verified';
      list.push({
        id: r.id,
        recordType: 'sandwich',
        soNumber: r.soNumber,
        date: r.productionDate || (r.createdAt ? r.createdAt.slice(0, 10) : ''),
        operator: r.recordedBy || 'ช่างคุมเครื่อง',
        detailText: `คอยล์ #${r.coilNumber || '-'} สี: ${r.coilColor} (${r.steelOrigin})`,
        amountDisplay: `${formatMeters(r.soLengthMeters || r.lengthMeters || 0)} ม.`,
        verificationStatus: isVerified ? 'verified' : 'pending',
        verifiedBy: r.verifiedBy,
        verifiedAt: r.verifiedAt,
        hasIssue: false,
        rawSandwich: r,
      });
    });

    // Sort: newest first
    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return list;
  }, [records, puRecords, rollsWithActionableIssues]);

  // Filtered Roster
  const filteredRoster = useMemo(() => {
    let result = unifiedSOList;
    if (materialFilter !== 'all') {
      result = result.filter((item) => item.recordType === materialFilter);
    }
    if (statusFilter !== 'all') {
      if (statusFilter === 'verified') {
        result = result.filter((item) => item.verificationStatus === 'verified');
      } else if (statusFilter === 'pending') {
        result = result.filter((item) => item.verificationStatus === 'pending');
      } else if (statusFilter === 'issues') {
        result = result.filter((item) => item.hasIssue || item.verificationStatus === 'flagged');
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.soNumber.toLowerCase().includes(q) ||
          item.operator.toLowerCase().includes(q) ||
          item.detailText.toLowerCase().includes(q)
      );
    }
    return result;
  }, [unifiedSOList, materialFilter, statusFilter, searchQuery]);

  // Handle Verify Action
  const handleVerify = async (
    recordType: 'foil' | 'sandwich',
    recordId: string,
    soNumber: string,
    rollInfo?: any
  ) => {
    if (!onVerifyRecord) return;
    try {
      setIsVerifyingId(recordId);
      await onVerifyRecord(recordType, recordId, soNumber, rollInfo);
      showToast(`รับรองความถูกต้องของ SO: ${soNumber} เรียบร้อยแล้ว`);
    } catch (err) {
      console.error('Verify error:', err);
      showToast('เกิดข้อผิดพลาดในการบันทึกการรับรอง');
    } finally {
      setIsVerifyingId(null);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-xl border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 shrink-0"
              >
                <ArrowLeft className="w-4 h-4 text-slate-700" />
                <span>ย้อนกลับ</span>
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-amber-600 shrink-0" />
                <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                  ศูนย์ตรวจสอบและรับรองข้อมูล SO (SO Audit Hub)
                </h1>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                ตรวจสอบความถูกต้อง ป้องกันยอดตัดซ้ำซ้อน บันทึกประวัติการเปลี่ยนแปลง (Audit Trail) และรับรองใบงาน
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => exportAuditLogsToCSV(auditLogs)}
              className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-950 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              title="ส่งออกรายงานประวัติการตรวจสอบเป็นไฟล์ CSV / Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>ส่งออกรายงาน Audit</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Health Overview Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Data Health Score */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">คะแนนความสมบูรณ์ข้อมูล</span>
            <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
              healthScore >= 95
                ? 'bg-emerald-100 text-emerald-900'
                : healthScore >= 80
                ? 'bg-amber-100 text-amber-900'
                : 'bg-rose-100 text-rose-900'
            }`}>
              {healthScore >= 95 ? 'สมบูรณ์ดีเยี่ยม' : healthScore >= 80 ? 'ควรตรวจสอบ' : 'พบข้อผิดพลาด'}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-900">
              {healthScore}%
            </span>
            <span className="text-xs text-slate-500 font-medium">
              จาก {totalRecordsCount} รายการตัด
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                healthScore >= 95 ? 'bg-emerald-500' : healthScore >= 80 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${healthScore}%` }}
            />
          </div>
        </div>

        {/* Card 2: Discrepancies & Bugs */}
        <div className={`rounded-2xl border p-4 shadow-xs transition-all ${
          totalIssueCount > 0
            ? 'bg-rose-50/60 border-rose-200'
            : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">ข้อผิดปกติ / บัคที่ตรวจพบ</span>
            <AlertTriangle className={`w-4 h-4 ${totalIssueCount > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
              totalIssueCount > 0 ? 'text-rose-600' : 'text-slate-900'
            }`}>
              {totalIssueCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              จุด ใน {rollsWithActionableIssues.length} ม้วน
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">
            {totalIssueCount > 0 ? 'มียอดตัดไม่ตรงหรือพบความผิดปกติ' : 'ยอดเมตรและประวัติสอดคล้อง 100%'}
          </p>
        </div>

        {/* Card 3: Audit Trail & Edit Diffs */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">ประวัติการแก้ไขข้อมูล (Diffs)</span>
            <History className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-900">
              {auditLogs.length}
            </span>
            <span className="text-xs text-slate-500 font-medium">บันทึกเหตุการณ์</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">
            บันทึกค่าเดิม vs ค่าใหม่ พร้อมชื่อผู้แก้ไข
          </p>
        </div>

        {/* Card 4: Verified SOs */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">ผ่านการรับรองแล้ว (Verified)</span>
            <FileCheck2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-emerald-700">
              {totalVerifiedCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              / {totalRecordsCount} ใบงาน
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">
            {totalRecordsCount - totalVerifiedCount > 0
              ? `รอการตรวจสอบอีก ${totalRecordsCount - totalVerifiedCount} รายการ`
              : 'ตรวจสอบครบถ้วนทุกรายการ'}
          </p>
        </div>
      </div>

      {/* Main Mode Tabs Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3 sm:p-4">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('discrepancy')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === 'discrepancy'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className={`w-4 h-4 ${activeTab === 'discrepancy' ? 'text-rose-400' : 'text-slate-500'}`} />
            <span>ตรวจจับข้อผิดปกติ & บัค (Inspector)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              activeTab === 'discrepancy'
                ? totalIssueCount > 0 ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-200'
                : totalIssueCount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-700'
            }`}>
              {totalIssueCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit_trail')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === 'audit_trail'
                ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className={`w-4 h-4 ${activeTab === 'audit_trail' ? 'text-amber-950' : 'text-amber-600'}`} />
            <span>ประวัติการแก้ไขข้อมูล (Audit Trail & Diff)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              activeTab === 'audit_trail' ? 'bg-amber-950 text-amber-200' : 'bg-amber-100 text-amber-950'
            }`}>
              {auditLogs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('verification_roster')}
            className={`px-3 sm:px-4 py-2 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
              activeTab === 'verification_roster'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className={`w-4 h-4 ${activeTab === 'verification_roster' ? 'text-emerald-300' : 'text-emerald-600'}`} />
            <span>ทะเบียน SO ทั้งหมด & ตรวจรับรอง (Verification Roster)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              activeTab === 'verification_roster' ? 'bg-emerald-900 text-emerald-200' : 'bg-slate-200 text-slate-700'
            }`}>
              {totalRecordsCount}
            </span>
          </button>
        </div>
      </div>

      {/* TAB CONTENT 1: DISCREPANCY INSPECTOR */}
      {activeTab === 'discrepancy' && (
        <div className="space-y-3">
          {rollsWithActionableIssues.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="text-lg font-bold text-slate-900">
                ข้อมูล SO และประวัติการตัดสต๊อกถูกต้องสมบูรณ์ 100%
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                ระบบได้ตรวจสอบเทียบยอดเมตรคงเหลือ ประวัติการตัด และรอบผลิตของทุกม้วนแล้ว ไม่พบข้อผิดพลาดหรือยอดตัดซ้ำซ้อน
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-slate-700">
                  พบ {rollsWithActionableIssues.length} ม้วนที่ต้องตรวจสอบ ({totalIssueCount} รายการข้อสังเกต):
                </span>
                <span className="text-xs text-slate-500">
                  คลิกที่ม้วนเพื่อเปิดตัวตรวจสอบเชิงลึก
                </span>
              </div>

              {rollsWithActionableIssues.map((res) => {
                const actionableIssues = res.issues.filter(
                  (i) => i.type !== 'SPLIT_PRODUCTION_BATCH'
                );

                return (
                  <div
                    key={res.rollId}
                    className="bg-white rounded-2xl border-2 border-rose-200/90 shadow-xs p-4 sm:p-5 space-y-3 transition-all hover:border-rose-400"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-900 font-mono font-black text-xs border border-rose-200">
                          ม้วน #{res.rollNumber}
                        </span>
                        <div>
                          <span className="font-bold text-slate-900 text-sm">
                            ล็อต {res.lotNumber} · ลาย{res.pattern} ({res.width} มม.)
                          </span>
                          <span className="text-xs text-slate-500 block">
                            คงเหลือระบบ: {formatMeters(res.currentRemaining)} ม. | คำนวณจากประวัติ: {formatMeters(res.calculatedRemaining)} ม.
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {onInspectRollBugs && (
                          <button
                            type="button"
                            onClick={() => onInspectRollBugs(res.rollId)}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                          >
                            <Bug className="w-3.5 h-3.5 text-amber-400" />
                            <span>วิเคราะห์ม้วนนี้</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Issue Bullet Cards */}
                    <div className="space-y-2">
                      {actionableIssues.map((issue, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-rose-50/70 border border-rose-200 rounded-xl text-xs"
                        >
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-rose-950">
                                  {issue.title}
                                </span>
                                {issue.soNumber && (
                                  <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-rose-200 text-rose-900 text-[11px]">
                                    SO: {issue.soNumber}
                                  </span>
                                )}
                              </div>
                              <p className="text-slate-600 mt-0.5">
                                {issue.description}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            {issue.soNumber && (
                              <button
                                type="button"
                                onClick={() => {
                                  const matchingCut = records.find(
                                    (rec) => rec.soNumber === issue.soNumber && rec.foilId === res.rollId
                                  );
                                  if (matchingCut && onOpenSODetail) {
                                    onOpenSODetail(matchingCut);
                                  }
                                }}
                                className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-600" />
                                <span>ดูใบตัด SO</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 2: AUDIT TRAIL & DIFF FEED */}
      {activeTab === 'audit_trail' && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหารหัส SO, ช่างผู้แก้ไข, หรือรายละเอียดการเปลี่ยนแปลง..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportAuditLogsToCSV(auditLogs)}
                  className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
                  <span>ส่งออก CSV</span>
                </button>
              </div>
            </div>
          </div>

          {auditLogs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs space-y-2">
              <History className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-700">
                ยังไม่มีรายการประวัติการแก้ไข SO (Audit Logs)
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                เมื่อมีช่างหรือหัวหน้างานแก้ไขยอดตัด, ข้อมูล SO หรือตรวจรับรอง ระบบจะบันทึกประวัติก่อน-หลังแก้ไข (Diff) อัตโนมัติที่นี่
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {auditLogs.map((log) => {
                const isFoil = log.recordType === 'foil';
                const isVerifyAction = log.action === 'VERIFY';

                return (
                  <div
                    key={log.id}
                    className={`bg-white rounded-2xl border p-4 shadow-xs space-y-2.5 transition-all ${
                      isVerifyAction
                        ? 'border-emerald-200 bg-emerald-50/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-100 pb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                          isVerifyAction
                            ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                            : 'bg-amber-100 text-amber-950 border border-amber-300'
                        }`}>
                          {isVerifyAction ? '✓ ตรวจรับรองแล้ว' : 'แก้ไขข้อมูล'}
                        </span>
                        <span className="font-mono font-black text-sm text-slate-900">
                          SO: {log.soNumber}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          ({isFoil ? 'ตัดฟอยล์' : 'ตัดแซนวิช'})
                        </span>
                        {log.rollInfo && (
                          <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-mono">
                            {isFoil
                              ? `ม้วน #${log.rollInfo.rollNumber} ล็อต ${log.rollInfo.lotNumber}`
                              : `คอยล์ #${log.rollInfo.coilNumber} (${log.rollInfo.coilColor})`}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatThaiDateTime(log.timestamp)}</span>
                        <span>·</span>
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-semibold text-slate-700">{log.operator}</span>
                      </div>
                    </div>

                    {/* Diff Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {log.diffs.map((diff, dIdx) => (
                        <div
                          key={dIdx}
                          className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1"
                        >
                          <span className="font-bold text-slate-600 block">
                            {diff.label}
                          </span>
                          <div className="flex items-center gap-2 font-mono">
                            <span className="line-through text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                              {String(diff.oldValue ?? '-')}
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              {String(diff.newValue ?? '-')}
                            </span>
                            {diff.delta !== undefined && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                diff.delta > 0
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-emerald-100 text-emerald-900'
                              }`}>
                                {diff.delta > 0 ? `+${diff.delta}` : diff.delta} {diff.unit || ''}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {log.reason && (
                      <p className="text-xs text-slate-500 italic bg-slate-50/60 p-2 rounded-lg border border-slate-100">
                        หมายเหตุ / เหตุผล: {log.reason}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 3: SO VERIFICATION ROSTER */}
      {activeTab === 'verification_roster' && (
        <div className="space-y-3">
          {/* Filters Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหารหัส SO, ช่างผู้ตัด, ม้วนฟอยล์..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Material Filter */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setMaterialFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      materialFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ทั้งหมด
                  </button>
                  <button
                    type="button"
                    onClick={() => setMaterialFilter('foil')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      materialFilter === 'foil'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ฟอยล์
                  </button>
                  <button
                    type="button"
                    onClick={() => setMaterialFilter('sandwich')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      materialFilter === 'sandwich'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    แซนวิช
                  </button>
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      statusFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    ทุกสถานะ
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('pending')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      statusFilter === 'pending'
                        ? 'bg-white text-amber-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    รอตรวจ
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('verified')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      statusFilter === 'verified'
                        ? 'bg-white text-emerald-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    รับรองแล้ว
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                  <tr>
                    <th className="py-3 px-4">รหัส SO</th>
                    <th className="py-3 px-3">ประเภท</th>
                    <th className="py-3 px-3">รายละเอียดม้วน/คอยล์</th>
                    <th className="py-3 px-3 text-right">จำนวนตัด</th>
                    <th className="py-3 px-3">วันที่ตัด</th>
                    <th className="py-3 px-3">ช่างผู้ตัด</th>
                    <th className="py-3 px-3 text-center">สถานะการตรวจรับรอง</th>
                    <th className="py-3 px-4 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredRoster.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        ไม่พบรายการตามเงื่อนไขที่ค้นหา
                      </td>
                    </tr>
                  ) : (
                    filteredRoster.map((item) => {
                      const isVerified = item.verificationStatus === 'verified';
                      const isFoil = item.recordType === 'foil';

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            <button
                              type="button"
                              onClick={() => {
                                if (isFoil && item.rawFoil && onOpenSODetail) {
                                  onOpenSODetail(item.rawFoil);
                                } else if (!isFoil && item.rawSandwich && onOpenSandwichDetail) {
                                  onOpenSandwichDetail(item.rawSandwich);
                                }
                              }}
                              className="text-amber-900 hover:underline cursor-pointer flex items-center gap-1 font-black"
                              title="คลิกเพื่อดูรายละเอียด SO"
                            >
                              <span>{item.soNumber}</span>
                              <Eye className="w-3 h-3 text-slate-400" />
                            </button>
                          </td>

                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              isFoil
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            }`}>
                              {isFoil ? 'ฟอยล์' : 'แซนวิช'}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-slate-700 font-medium">
                            {isFoil && item.rawFoil ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>ม้วน #{item.rawFoil.rollNumber} ล็อต {item.rawFoil.lotNumber}</span>
                                <span className="text-slate-400">•</span>
                                <span className="font-semibold text-slate-800">ลาย{item.rawFoil.pattern}</span>
                                {item.rawFoil.isSilverSide && (
                                  <span className="inline-flex items-center gap-1 font-black text-slate-900 bg-gradient-to-r from-slate-200 via-zinc-100 to-slate-200 px-1.5 py-0.5 rounded text-[10px] border border-slate-400 shadow-2xs">
                                    <span className="w-2 h-2 rounded-full bg-gradient-to-br from-slate-400 via-white to-slate-600 ring-1 ring-slate-500 shrink-0" />
                                    <span>เงิน</span>
                                  </span>
                                )}
                                {item.rawFoil.isWhiteSide && (
                                  <span className="inline-flex items-center gap-1 font-black text-slate-950 bg-white px-1.5 py-0.5 rounded text-[10px] border border-slate-400 shadow-2xs">
                                    <span className="w-2 h-2 rounded-full bg-white ring-1.5 ring-slate-700 shrink-0" />
                                    <span>ขาว</span>
                                  </span>
                                )}
                              </div>
                            ) : (
                              item.detailText
                            )}
                          </td>

                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                            {item.amountDisplay}
                          </td>

                          <td className="py-3 px-3 font-mono text-slate-600">
                            {item.date || '-'}
                          </td>

                          <td className="py-3 px-3 text-slate-700">
                            {item.operator}
                          </td>

                          <td className="py-3 px-3 text-center">
                            {isVerified ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-950 font-bold text-[11px] border border-emerald-300">
                                <Check className="w-3 h-3 text-emerald-700 stroke-[3]" />
                                <span>รับรองแล้ว</span>
                              </span>
                            ) : item.hasIssue ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-900 font-bold text-[11px] border border-rose-300">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                <span>พบข้อสังเกต</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium text-[11px]">
                                รอตรวจสอบ
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center">
                            {isVerified ? (
                              <span className="text-[10px] text-slate-400 font-mono block">
                                โดย {item.verifiedBy || 'เจ้าหน้าที่'}
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={isVerifyingId === item.id}
                                onClick={() =>
                                  handleVerify(
                                    item.recordType,
                                    item.id,
                                    item.soNumber,
                                    isFoil && item.rawFoil
                                      ? {
                                          lotNumber: item.rawFoil.lotNumber,
                                          rollNumber: item.rawFoil.rollNumber,
                                          pattern: item.rawFoil.pattern,
                                        }
                                      : item.rawSandwich
                                      ? {
                                          coilColor: item.rawSandwich.coilColor,
                                          coilNumber: item.rawSandwich.coilNumber,
                                        }
                                      : undefined
                                  )
                                }
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs transition-all flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 mx-auto"
                              >
                                {isVerifyingId === item.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                )}
                                <span>รับรองความถูกต้อง</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
