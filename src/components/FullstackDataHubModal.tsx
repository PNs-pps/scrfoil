import React, { useState, useEffect } from 'react';
import {
  X,
  Server,
  Activity,
  Database,
  RefreshCw,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Code2,
  Copy,
  Clock,
  Cpu,
  Radio,
  FileJson,
  ArrowRight,
  Sparkles,
  Trash2,
  ArrowDownToLine,
  ArrowUpToLine,
  Check,
} from 'lucide-react';
import {
  checkServerHealth,
  getServerStats,
  getServerInfo,
  syncWithServer,
  downloadServerBackup,
  restoreServerBackup,
  seedServerData,
  getFullstackData,
  saveFullstackData,
  clearFullstackData,
  ServerHealthResponse,
  ServerStatsResponse,
  ServerInfoResponse,
} from '../lib/serverApi';
import { FoilRoll, StockCutRecord, PuSandwichCutRecord } from '../types';
import { confirmAction } from '../utils/confirmAction';

interface FullstackDataHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  rolls: FoilRoll[];
  cutRecords: StockCutRecord[];
  puRecords?: PuSandwichCutRecord[];
  onSyncComplete?: (data: any) => void;
  onApplyData?: (data: { rolls: FoilRoll[]; cutRecords: StockCutRecord[]; puSandwichCuts?: PuSandwichCutRecord[] }) => void;
}

export const FullstackDataHubModal: React.FC<FullstackDataHubModalProps> = ({
  isOpen,
  onClose,
  rolls,
  cutRecords,
  puRecords = [],
  onSyncComplete,
  onApplyData,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'explorer' | 'backup'>('overview');
  const [health, setHealth] = useState<ServerHealthResponse | null>(null);
  const [stats, setStats] = useState<ServerStatsResponse | null>(null);
  const [info, setInfo] = useState<ServerInfoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // API Explorer State
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('/api/health');
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiDuration, setApiDuration] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchFullstackState = async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, s, inf] = await Promise.all([
        checkServerHealth().catch((e) => {
          console.warn('Health check error:', e);
          return null;
        }),
        getServerStats().catch(() => null),
        getServerInfo().catch(() => null),
      ]);
      setHealth(h);
      setStats(s);
      setInfo(inf);
    } catch (err: any) {
      setError(err?.message || 'ไม่สามารถเชื่อมต่อ Express Server ได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFullstackState();
      testEndpoint('/api/health');
    }
  }, [isOpen]);

  // 1-Click Seed Production Dataset
  const handleSeedProductionData = async () => {
    setSeeding(true);
    setSyncMessage(null);
    setError(null);
    try {
      const result = await seedServerData(true);
      setSyncMessage(`สร้างชุดข้อมูล Full-Stack โรงงานสำเร็จ! (${result.counts.rolls} ม้วน, ${result.counts.cutRecords} รายการตัด, ${result.counts.puSandwichCuts} PU แซนวิช)`);
      if (onApplyData && result.data) {
        onApplyData({
          rolls: result.data.rolls || [],
          cutRecords: result.data.cutRecords || [],
          puSandwichCuts: result.data.puSandwichCuts || [],
        });
      }
      if (onSyncComplete) onSyncComplete(result);
      await fetchFullstackState();
    } catch (err: any) {
      setError(`สร้างข้อมูล Full-Stack ไม่สำเร็จ: ${err?.message || err}`);
    } finally {
      setSeeding(false);
    }
  };

  // Pull server data into client
  const handlePullFromServer = async () => {
    setSyncing(true);
    setSyncMessage(null);
    setError(null);
    try {
      const result = await getFullstackData();
      if (onApplyData) {
        onApplyData({
          rolls: result.rolls || [],
          cutRecords: result.cutRecords || [],
          puSandwichCuts: result.puSandwichCuts || [],
        });
      }
      setSyncMessage(`ดึงข้อมูลจาก Server เรียบร้อย (${(result.rolls || []).length} ม้วน, ${(result.cutRecords || []).length} ใบตัด, ${(result.puSandwichCuts || []).length} PU แซนวิช)`);
      await fetchFullstackState();
    } catch (err: any) {
      setError(`ดึงข้อมูลไม่สำเร็จ: ${err?.message || err}`);
    } finally {
      setSyncing(false);
    }
  };

  // Push client data to server
  const handlePushToServer = async () => {
    setSyncing(true);
    setSyncMessage(null);
    setError(null);
    try {
      const result = await saveFullstackData({
        rolls,
        cutRecords,
        puSandwichCuts: puRecords,
      });
      setSyncMessage(`ส่งข้อมูลขึ้น Server เรียบร้อย (${result.counts.rolls} ม้วน, ${result.counts.cutRecords} ใบตัด, ${result.counts.puSandwichCuts} PU แซนวิช)`);
      await fetchFullstackState();
    } catch (err: any) {
      setError(`ส่งข้อมูลไม่สำเร็จ: ${err?.message || err}`);
    } finally {
      setSyncing(false);
    }
  };

  // Clear server data
  const handleClearServerData = async () => {
    const ok = await confirmAction({
      title: 'ยกเลิกและล้างข้อมูล Full-Stack ทั้งหมด',
      message: 'ต้องการยกเลิกและล้างข้อมูลบน Server ให้ว่างเปล่า (0 รายการ) หรือไม่?\nข้อมูลม้วนฟอยล์และการตัดตัวอย่างจะถูกล้างออกทั้งหมด',
      confirmLabel: 'ยกเลิกข้อมูล Full-Stack',
    });
    if (!ok) return;
    setSyncing(true);
    setError(null);
    try {
      await clearFullstackData();
      if (onApplyData) {
        onApplyData({
          rolls: [],
          cutRecords: [],
          puSandwichCuts: [],
        });
      }
      setSyncMessage('ยกเลิกข้อมูล Full-Stack บน Server เรียบร้อย (สต๊อกสะอาด 0 รายการ)');
      await fetchFullstackState();
    } catch (err: any) {
      setError(`ล้างข้อมูลไม่สำเร็จ: ${err?.message || err}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncWithServer = async () => {
    setSyncing(true);
    setSyncMessage(null);
    setError(null);
    try {
      const result = await syncWithServer({
        rolls,
        cutRecords,
        puSandwichCuts: puRecords,
      });
      setSyncMessage(`ซิงค์ข้อมูลกับ Backend สำเร็จ (${result.serverCounts.rolls} ม้วน, ${result.serverCounts.cutRecords} ใบตัด, ${result.serverCounts.puSandwichCuts} PU แซนวิช)`);
      if (onApplyData) {
        onApplyData({
          rolls: result.rolls || [],
          cutRecords: result.cutRecords || [],
          puSandwichCuts: result.puSandwichCuts || [],
        });
      }
      if (onSyncComplete) onSyncComplete(result);
      await fetchFullstackState();
    } catch (err: any) {
      setError(`ซิงค์ข้อมูลไม่สำเร็จ: ${err?.message || err}`);
    } finally {
      setSyncing(false);
    }
  };

  const testEndpoint = async (path: string) => {
    setSelectedEndpoint(path);
    setApiLoading(true);
    setCopied(false);
    const start = performance.now();
    try {
      const res = await fetch(path, { headers: { Accept: 'application/json' } });
      const duration = Math.round(performance.now() - start);
      setApiDuration(duration);
      if (path.includes('export')) {
        const json = await res.json();
        setApiResponse({
          note: 'ไฟล์ JSON สำรองฐานข้อมูลพร้อมดาวน์โหลด',
          preview: json,
        });
      } else {
        const json = await res.json();
        setApiResponse(json);
      }
    } catch (err: any) {
      setApiResponse({ error: err?.message || 'Call failed' });
    } finally {
      setApiLoading(false);
    }
  };

  const handleCopyJson = () => {
    if (!apiResponse) return;
    navigator.clipboard.writeText(JSON.stringify(apiResponse, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadBackup = async () => {
    try {
      await downloadServerBackup();
    } catch (err: any) {
      alert(`ดาวน์โหลดไฟล์สำรองไม่สำเร็จ: ${err?.message || err}`);
    }
  };

  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await restoreServerBackup(parsed);
      alert('นำเข้าข้อมูลสำเร็จและบันทึกสู่ Server เรียบร้อย');
      await fetchFullstackState();
    } catch (err: any) {
      alert(`นำเข้าไฟล์ไม่สำเร็จ: ${err?.message || err}`);
    } finally {
      e.target.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92dvh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold leading-tight">
                  ระบบข้อมูล Full-Stack (Backend Data Hub)
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Node Express :3000
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                REST API · Cloud Firestore Sync · Server Data Store · Realtime Architecture
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchFullstackState}
              disabled={loading}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="รีเฟรชสถานะเซิร์ฟเวอร์"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-4 sm:px-5 gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3.5 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>ภาพรวม & สถานะระบบ</span>
            {health && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-mono">
                {health.latencyMs}ms
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('explorer')}
            className={`py-3 px-3.5 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'explorer'
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>API Explorer (ทดสอบ REST API)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`py-3 px-3.5 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === 'backup'
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-2xs rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileJson className="w-4 h-4" />
            <span>สำรอง & ซิงค์ฐานข้อมูล (Backup & Sync)</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 text-sm bg-slate-50/50">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {syncMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{syncMessage}</span>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Primary Fullstack Operations Card */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-emerald-500/10 border-2 border-indigo-200 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-500 fill-amber-400" />
                      <span>จัดการชุดข้อมูล Full-Stack โรงงานหลังคาเย็นสยาม ร่มเกล้า</span>
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      สร้างข้อมูลเริ่มต้นเสมือนจริงของโรงงาน หรือซิงค์ข้อมูลระหว่างหน่วยความจำเครื่องกับ Server JSON Store
                    </p>
                  </div>
                  <span className="self-start sm:self-center px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">
                    REST API + JSON Store
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                  {/* Button: Seed Production Data */}
                  <button
                    type="button"
                    onClick={handleSeedProductionData}
                    disabled={seeding || syncing}
                    className="p-3 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl font-bold text-xs flex flex-col justify-between shadow-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 text-left space-y-1.5"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className={`w-4 h-4 ${seeding ? 'animate-spin' : ''}`} />
                        <span>สร้างข้อมูล Full-Stack (Seed)</span>
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/40 text-amber-100">
                        ตัวอย่าง
                      </span>
                    </div>
                    <span className="text-[11px] font-normal text-amber-100 leading-tight">
                      สร้าง 12 ม้วนฟอยล์, 9 รายการตัด SO, 4 แซนวิช (NG เมตร), พร้อมรอบนับสต๊อก
                    </span>
                  </button>

                  {/* Button: Pull From Server */}
                  <button
                    type="button"
                    onClick={handlePullFromServer}
                    disabled={syncing || seeding}
                    className="p-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl font-bold text-xs flex flex-col justify-between shadow-2xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 text-left space-y-1.5"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="flex items-center gap-1.5">
                        <ArrowDownToLine className={`w-4 h-4 text-emerald-600 ${syncing ? 'animate-bounce' : ''}`} />
                        <span>ดึงข้อมูลจาก Server เข้าเครื่อง</span>
                      </span>
                    </div>
                    <span className="text-[11px] font-normal text-slate-500 leading-tight">
                      โหลดข้อมูลจาก .server_data/database.json มาแสดงผลบนหน้าจอทันที
                    </span>
                  </button>

                  {/* Button: Push To Server */}
                  <button
                    type="button"
                    onClick={handlePushToServer}
                    disabled={syncing || seeding}
                    className="p-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl font-bold text-xs flex flex-col justify-between shadow-2xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 text-left space-y-1.5"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="flex items-center gap-1.5">
                        <ArrowUpToLine className={`w-4 h-4 text-indigo-600 ${syncing ? 'animate-bounce' : ''}`} />
                        <span>ส่งข้อมูลจากเครื่องขึ้น Server</span>
                      </span>
                    </div>
                    <span className="text-[11px] font-normal text-slate-500 leading-tight">
                      บันทึกข้อมูลหน้าจอปัจจุบันไปยัง Server Persistent Storage ถาวร
                    </span>
                  </button>

                  {/* Button: Clear Fullstack Data */}
                  <button
                    type="button"
                    onClick={handleClearServerData}
                    disabled={syncing || seeding}
                    className="p-3 bg-rose-50 hover:bg-rose-100 text-rose-950 border border-rose-300 rounded-xl font-bold text-xs flex flex-col justify-between shadow-2xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 text-left space-y-1.5"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="flex items-center gap-1.5 text-rose-700">
                        <Trash2 className="w-4 h-4 text-rose-600" />
                        <span>ยกเลิกข้อมูล Full-Stack</span>
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-200/60 text-rose-800 font-semibold">
                        ล้างค่า
                      </span>
                    </div>
                    <span className="text-[11px] font-normal text-rose-800 leading-tight">
                      ล้างข้อมูลบน Server เป็น 0 รายการ คืนสถานะสต๊อกสะอาดให้โรงงาน
                    </span>
                  </button>
                </div>
              </div>

              {/* Status Banner */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-emerald-600" />
                    สถานะเซิร์ฟเวอร์
                  </span>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>{health?.server || 'Express Active'}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Port {health?.port || 3000}</span>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    Uptime & Latency
                  </span>
                  <div className="font-bold font-mono text-slate-900 text-sm">
                    {health?.uptimeSeconds ? `${health.uptimeSeconds} วิ` : '—'}
                  </div>
                  <span className="text-[10px] text-emerald-600 font-mono">
                    ตอบสนอง: {health?.latencyMs !== undefined ? `${health.latencyMs} ms` : '—'}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-purple-600" />
                    Memory & Runtime
                  </span>
                  <div className="font-bold font-mono text-slate-900 text-sm">
                    {health?.memoryUsageMB ? `${health.memoryUsageMB} MB` : '—'}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{health?.nodeVersion || process.version}</span>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-amber-600" />
                    Firestore Target
                  </span>
                  <div className="font-bold text-slate-900 text-xs truncate" title={health?.database.projectId}>
                    {health?.database.projectId || 'stock-foil'}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono truncate block" title={health?.database.firestoreDatabaseId}>
                    DB: {health?.database.firestoreDatabaseId || '(default)'}
                  </span>
                </div>
              </div>

              {/* Data Collections Metrics */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    ยอดข้อมูลในระบบ Full-Stack ทั้งหมด
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSyncWithServer}
                      disabled={syncing}
                      className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-indigo-200"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                      <span>ซิงค์สองทาง (Two-Way Sync)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleClearServerData}
                      disabled={syncing}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="ล้างข้อมูลบน Server ให้เป็น 0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[11px] text-slate-500 block">ม้วนฟอยล์ทั้งหมด</span>
                    <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                      {health?.database.counts.totalRolls ?? rolls.length}
                    </div>
                    <span className="text-[10px] text-emerald-600">
                      พร้อมใช้ {health?.database.counts.activeRolls ?? rolls.filter((r) => r.status === 'active').length} ม้วน
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[11px] text-slate-500 block">รายการตัดฟอยล์ (Cuts)</span>
                    <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                      {health?.database.counts.cutRecords ?? cutRecords.length}
                    </div>
                    <span className="text-[10px] text-slate-400">ประวัติตัดและคืนสต๊อก</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[11px] text-slate-500 block">ตัด PU แซนวิช</span>
                    <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                      {health?.database.counts.puSandwichCuts ?? puRecords.length}
                    </div>
                    <span className="text-[10px] text-slate-400">ใบงานตัดไม่ใช้ฟอยล์</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[11px] text-slate-500 block">นับสต๊อกรอบเดือน</span>
                    <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                      {health?.database.counts.cycleCounts ?? 0}
                    </div>
                    <span className="text-[10px] text-slate-400">Cycle Count Sessions</span>
                  </div>
                </div>
              </div>

              {/* Inventory Meter Breakdown */}
              {stats?.inventory && (
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-600" />
                    เมตรคงเหลือแยกตามหน้ากว้าง (Inventory By Width)
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                    {stats.inventory.byWidth.map((bw) => (
                      <div key={bw.width} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-xs font-bold text-slate-800 flex justify-between items-center">
                          <span>{bw.width} มม.</span>
                          <span className="text-[10px] font-normal text-slate-500">{bw.activeRollCount} ม้วน</span>
                        </div>
                        <div className="text-base font-bold text-emerald-700 mt-1">
                          {bw.remainingMeters.toLocaleString('th-TH')} <span className="text-xs font-normal">ม.</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          ตัดใช้สะสม: {bw.usedMeters.toLocaleString('th-TH')} ม.
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: API EXPLORER */}
          {activeTab === 'explorer' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <span className="text-xs font-bold text-slate-700 block">เลือก REST Endpoint เพื่อทดสอบ:</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { method: 'GET', path: '/api/health', label: 'Health' },
                    { method: 'GET', path: '/api/stats', label: 'Stats' },
                    { method: 'GET', path: '/api/info', label: 'Info' },
                    { method: 'GET', path: '/api/data', label: 'All Data' },
                    { method: 'POST', path: '/api/seed', label: 'Seed Data' },
                    { method: 'GET', path: '/api/rolls?limit=10', label: 'Rolls (10)' },
                    { method: 'GET', path: '/api/cuts?limit=10', label: 'Cuts (10)' },
                    { method: 'GET', path: '/api/sandwich?limit=10', label: 'Sandwich (10)' },
                    { method: 'GET', path: '/api/cycle-counts', label: 'Cycle Counts' },
                    { method: 'GET', path: '/api/audit-logs', label: 'Audit Logs' },
                    { method: 'GET', path: '/api/backup/export', label: 'Backup Export' },
                  ].map((ep) => (
                    <button
                      key={ep.path}
                      type="button"
                      onClick={() => testEndpoint(ep.path)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                        selectedEndpoint === ep.path
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-700 font-bold">
                        {ep.method}
                      </span>
                      <span>{ep.label}</span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs font-mono text-slate-500 bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                  <span className="flex items-center gap-1.5">
                    <span className="font-bold text-emerald-700">GET</span>
                    <span>{selectedEndpoint}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {apiDuration !== null && <span className="text-slate-500">{apiDuration} ms</span>}
                    <button
                      type="button"
                      onClick={handleCopyJson}
                      className="px-2 py-1 bg-white hover:bg-slate-200 rounded border border-slate-300 text-[10px] font-sans font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอก JSON'}</span>
                    </button>
                  </div>
                </div>

                {/* Response Code Block */}
                <div className="relative">
                  <pre className="p-4 bg-slate-900 text-emerald-300 rounded-2xl text-xs font-mono overflow-x-auto max-h-[340px] border border-slate-800 select-text leading-relaxed">
                    {apiLoading ? 'กำลังเรียก REST API...' : JSON.stringify(apiResponse, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BACKUP & SYNC */}
          {activeTab === 'backup' && (
            <div className="space-y-4">
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <FileJson className="w-5 h-5 text-indigo-600" />
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">ดาวน์โหลด & กู้คืนฐานข้อมูลจากเซิร์ฟเวอร์</h3>
                    <p className="text-xs text-slate-500">
                      รองรับการสำรองข้อมูลโครงสร้างครบทุก Collection เป็นไฟล์ .json
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Download Backup */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
                    <div>
                      <span className="font-bold text-slate-900 text-sm block flex items-center gap-1.5">
                        <Download className="w-4 h-4 text-emerald-600" />
                        ดาวน์โหลดข้อมูลทั้งระบบ (Full JSON Dump)
                      </span>
                      <p className="text-xs text-slate-500 mt-1">
                        ดาวน์โหลดไฟล์ JSON สำรองข้อมูลม้วนฟอยล์, การตัด SO, และ PU แซนวิชจากเซิร์ฟเวอร์โดยตรง
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadBackup}
                      className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>ดาวน์โหลดสำรองข้อมูล JSON</span>
                    </button>
                  </div>

                  {/* Restore Backup */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
                    <div>
                      <span className="font-bold text-slate-900 text-sm block flex items-center gap-1.5">
                        <Upload className="w-4 h-4 text-indigo-600" />
                        นำเข้าไฟล์สำรองเพื่อกู้คืน (Restore JSON)
                      </span>
                      <p className="text-xs text-slate-500 mt-1">
                        เลือกไฟล์ JSON สำรองเพื่ออัปเดตและเขียนทับฐานข้อมูลบนเซิร์ฟเวอร์
                      </p>
                    </div>
                    <label className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer text-center">
                      <Upload className="w-4 h-4" />
                      <span>เลือกไฟล์ JSON เพื่อนำเข้า</span>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImportJsonFile}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Endpoints Documentation */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-indigo-600" />
                  ตาราง REST API Endpoints ทั้งหมด
                </h3>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                      <tr>
                        <th className="py-2 px-3 w-20">Method</th>
                        <th className="py-2 px-3">Endpoint Path</th>
                        <th className="py-2 px-3 font-sans">รายละเอียดการทำงาน</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {[
                        { m: 'GET', p: '/api/health', d: 'ตรวจสอบสถานะ Server, Uptime, Memory, และการเชื่อมต่อ Firestore' },
                        { m: 'GET', p: '/api/stats', d: 'สรุปเมทริกซ์และสถิติเมตรคงเหลือแยกตามหน้ากว้างและท้อง' },
                        { m: 'GET', p: '/api/rolls', d: 'ดึงรายการม้วนฟอยล์พร้อมเงื่อนไขค้นหา status, width, pattern, search' },
                        { m: 'POST', p: '/api/rolls', d: 'ลงทะเบียนรับเข้าม้วนฟอยล์ใหม่ลงฐานข้อมูล' },
                        { m: 'PUT', p: '/api/rolls/:id', d: 'อัปเดตข้อมูลม้วนฟอยล์, ปรับสถานะ หรือบันทึกตัดเป็น 0' },
                        { m: 'GET', p: '/api/cuts', d: 'ดึงประวัติการตัดสต๊อก SO และยอดตัดไม่ใช้ SO' },
                        { m: 'POST', p: '/api/cuts', d: 'บันทึกการตัด SO พร้อมคำนวณหักยอดม้วนฟอยล์อัตโนมัติ' },
                        { m: 'GET', p: '/api/sandwich', d: 'ดึงประวัติการตัด SO แซนวิช (ไม่ใช้ฟอยล์)' },
                        { m: 'POST', p: '/api/sandwich', d: 'บันทึกการตัดแซนวิช พร้อมสัดส่วนเหล็กและ NG รายใบงาน' },
                        { m: 'GET', p: '/api/backup/export', d: 'สตรีมดาวน์โหลดฐานข้อมูลทั้งหมดเป็นไฟล์ JSON' },
                        { m: 'POST', p: '/api/sync', d: 'ซิงค์ข้อมูลสองทาง (Two-Way Sync) ระหว่าง Client กับ Backend' },
                      ].map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono font-bold text-emerald-700">{item.m}</td>
                          <td className="py-2 px-3 font-mono text-slate-800">{item.p}</td>
                          <td className="py-2 px-3 text-slate-600 text-[11px]">{item.d}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Full-Stack Architecture: Express + Vite Middleware บน Port 3000</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-colors cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
