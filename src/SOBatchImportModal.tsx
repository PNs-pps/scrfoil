import React, { useState, useRef } from 'react';
import { FoilRoll, StockCutRecord } from '../types';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle,
  Download, 
  Trash2, 
  FileText,
  HelpCircle,
  Scissors
} from 'lucide-react';
import { formatMeters, round2 } from '../utils/formatters';

interface ParsedCutRow {
  index: number;
  soNumber: string;
  lotNumber: string;
  rollNumber: string;
  usedMeters: number;
  ngMeters: number;
  totalDeducted: number;
  usageDate: string;
  recordedBy: string;
  notes: string;
  matchedRoll?: FoilRoll;
  status: 'valid' | 'roll_not_found' | 'insufficient_meters' | 'invalid_meters';
  statusMessage: string;
}

interface SOBatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  rolls: FoilRoll[];
  onConfirmBatchCut: (batch: Omit<StockCutRecord, 'id' | 'createdAt'>[]) => Promise<void> | void;
}

export const SOBatchImportModal: React.FC<SOBatchImportModalProps> = ({
  isOpen,
  onClose,
  rolls,
  onConfirmBatchCut,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedCutRow[]>([]);
  const [rawText, setRawText] = useState<string>('');
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Download CSV template
  const handleDownloadTemplate = () => {
    const templateRows = [
      'รหัส SO,เลขล็อต,เบอร์ม้วน,เมตรที่ใช้ลงแผ่นจริง,NG ที่เสีย,วันที่ใช้งาน(YYYY-MM-DD),ผู้บันทึก,หมายเหตุ',
      'SO6909501,LOT-6909-A,01,150.5,2.0,2026-09-18,ช่างหนึ่ง,ผลิตหลังคาลอนสเปน',
      'SO6909502,LOT-6909-A,02,80.0,0,2026-09-18,ช่างกิต,ลอนมาตรฐาน 760',
      'สาขายืมพัทยา,LOT-6909-B,01,50.0,0,2026-09-18,หัวหน้าแผนก,สาขายืมด่วน'
    ];

    const csvContent = '\uFEFF' + templateRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'ตัวอย่างไฟล์_อัปโหลดSOตัดฟอยล์.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Parse CSV / text content into validated rows
  const parseCSVContent = (content: string) => {
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      setParsedRows([]);
      return;
    }

    // Check if first line is header
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes('so') || firstLine.includes('ล็อต') || firstLine.includes('lot') || firstLine.includes('รหัส');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const todayStr = new Date().toISOString().slice(0, 10);
    const rows: ParsedCutRow[] = [];

    // Track cumulative deductions per roll so we don't allow over-cutting in the same batch
    const cumulativeDeductions = new Map<string, number>();

    dataLines.forEach((line, idx) => {
      // Split by comma or tab or semicolon
      const cols = line.split(/[,;\t]/).map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 3) return; // skip empty or incomplete lines

      const soNumber = cols[0] || `SO-${Date.now().toString().slice(-4)}`;
      const lotNumber = cols[1] || '';
      const rollNumber = cols[2] || '';
      // Ensure positive values mathematically
      const usedMeters = round2(Math.abs(parseFloat(cols[3]) || 0));
      const ngMeters = round2(Math.abs(parseFloat(cols[4]) || 0));
      const usageDate = cols[5] && /^\d{4}-\d{2}-\d{2}$/.test(cols[5]) ? cols[5] : todayStr;
      const recordedBy = cols[6] || 'นำเข้าไฟล์ SO';
      const notes = cols[7] || '';

      const totalDeducted = round2(usedMeters + ngMeters);

      // Find roll
      const matched = rolls.find((r) => 
        r.lotNumber.toLowerCase().trim() === lotNumber.toLowerCase().trim() &&
        r.rollNumber.toLowerCase().trim() === rollNumber.toLowerCase().trim()
      );

      let status: ParsedCutRow['status'] = 'valid';
      let statusMessage = 'พร้อมตัดสต๊อก';

      if (usedMeters <= 0 && ngMeters <= 0) {
        status = 'invalid_meters';
        statusMessage = 'จำนวนเมตรที่ใช้ต้องมากกว่า 0';
      } else if (!matched) {
        status = 'roll_not_found';
        statusMessage = `ไม่พบม้วนฟอยล์ ล็อต ${lotNumber} เบอร์ ${rollNumber} ในระบบ`;
      } else {
        const key = matched.id;
        const currentDeductedSoFar = cumulativeDeductions.get(key) || 0;
        const totalAfterThis = round2(currentDeductedSoFar + totalDeducted);

        if (totalAfterThis > matched.remainingMeters) {
          status = 'insufficient_meters';
          statusMessage = `ยอดตัดเกินคงเหลือ (ต้องการตัดรวม ${totalAfterThis} ม. / คงเหลือ ${matched.remainingMeters} ม.)`;
        } else {
          cumulativeDeductions.set(key, totalAfterThis);
        }
      }

      rows.push({
        index: idx + 1,
        soNumber,
        lotNumber,
        rollNumber,
        usedMeters,
        ngMeters,
        totalDeducted,
        usageDate,
        recordedBy,
        notes,
        matchedRoll: matched,
        status,
        statusMessage,
      });
    });

    setParsedRows(rows);
  };

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSVContent(text);
    };
    reader.readAsText(selected);
  };

  // Handle drag & drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    setFile(dropped);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSVContent(text);
    };
    reader.readAsText(dropped);
  };

  // Handle text area paste change
  const handleTextChange = (text: string) => {
    setRawText(text);
    parseCSVContent(text);
  };

  // Valid rows count
  const validRows = parsedRows.filter(r => r.status === 'valid');
  const totalMetersToCut = round2(validRows.reduce((sum, r) => sum + r.totalDeducted, 0));
  const uniqueRollsCount = new Set(validRows.map(r => r.matchedRoll?.id).filter(Boolean)).size;

  // Confirm import and execute batch cut
  const handleConfirmImport = async () => {
    if (validRows.length === 0) return;
    setIsProcessing(true);
    setImportError(null);

    const todayStr = new Date().toISOString().slice(0, 10);

    // Group valid rows by rollId to process cuts sequentially per roll
    const cutsToExecute: Omit<StockCutRecord, 'id' | 'createdAt'>[] = [];

    // Map to keep track of remaining meters per roll as we generate the records
    const remainingTracker = new Map<string, number>();
    validRows.forEach((row) => {
      const roll = row.matchedRoll!;
      if (!remainingTracker.has(roll.id)) {
        remainingTracker.set(roll.id, roll.remainingMeters);
      }
    });

    validRows.forEach((row) => {
      const roll = row.matchedRoll!;
      const currentRem = remainingTracker.get(roll.id) || roll.remainingMeters;
      const remainingAfter = Math.max(0, round2(currentRem - row.totalDeducted));
      remainingTracker.set(roll.id, remainingAfter);

      const isNonSo = row.soNumber.toLowerCase().includes('สาขา') || 
                      row.soNumber.toLowerCase().includes('ยืม') || 
                      row.soNumber.toLowerCase().includes('ซ่อม');

      cutsToExecute.push({
        foilId: roll.id,
        lotNumber: roll.lotNumber,
        rollNumber: roll.rollNumber,
        width: roll.width,
        pattern: roll.pattern,
        isSilverSide: !!(row.notes?.toLowerCase().includes('ท้องเงิน') || row.soNumber?.toLowerCase().includes('ท้องเงิน')),
        soNumber: row.soNumber,
        cutType: isNonSo ? 'non_so' : 'so',
        nonSoReason: isNonSo ? row.soNumber : '',
        usedMeters: Math.abs(row.usedMeters),
        ngMeters: Math.abs(row.ngMeters),
        totalDeducted: Math.abs(row.totalDeducted),
        remainingBefore: Math.max(0, currentRem),
        remainingAfter,
        usageDate: row.usageDate || todayStr,
        recordedDate: todayStr,
        recordedBy: row.recordedBy || 'อัปโหลด SO',
        notes: row.notes || 'ตัดสต๊อกผ่านการอัปโหลดไฟล์ SO รวม',
      });
    });

    try {
      await onConfirmBatchCut(cutsToExecute);
      setIsProcessing(false);
      onClose();
    } catch (err: any) {
      console.error('Batch SO cut failed:', err);
      setImportError(err?.message || 'บันทึกไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อ');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs">
      <div 
        id="modal-so-batch-import"
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-bold">
                  นำเข้าข้อมูลใบงาน
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  BATCH SO CUT IMPORT
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight mt-0.5">
                อัปโหลดข้อมูล SO ที่ใช้ตัดฟอยล์แต่ละลูก
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher & Template Download */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setInputMode('file')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                inputMode === 'file'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
              }`}
            >
              อัปโหลดไฟล์ (.CSV / .TXT)
            </button>
            <button
              type="button"
              onClick={() => setInputMode('text')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                inputMode === 'text'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
              }`}
            >
              วางข้อความ (Paste CSV)
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ดาวน์โหลดแม่แบบ CSV ตัวอย่าง</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {importError && (
            <div className="p-3.5 bg-rose-50 border border-rose-300 text-rose-900 rounded-xl text-xs flex items-start gap-2.5 font-medium animate-in fade-in">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-rose-950 text-sm">{importError}</p>
                <p className="text-rose-800 text-[11px] leading-relaxed">
                  ระบบได้ระงับการบันทึกและไม่ได้ตัดสต๊อก ม้วนฟอยล์ทุกม้วนยังคงมียอดคงเหลือเท่าเดิม กรุณาตรวจสอบสัญญาณอินเทอร์เน็ตหรือสถานะ Firebase แล้วลองใหม่อีกครั้ง
                </p>
              </div>
            </div>
          )}

          {/* File Upload Zone */}
          {inputMode === 'file' ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
                isDragging 
                  ? 'border-amber-500 bg-amber-50/50' 
                  : file 
                    ? 'border-emerald-400 bg-emerald-50/20' 
                    : 'border-slate-300 hover:border-amber-400 bg-slate-50/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center space-y-2">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  file ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                }`}>
                  {file ? <FileSpreadsheet className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {file ? file.name : 'ลากไฟล์ CSV มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    รองรับไฟล์ .csv ที่มีคอลัมน์: รหัส SO, ล็อต, เบอร์ม้วน, เมตรที่ใช้, NG, วันที่, ผู้บันทึก
                  </p>
                </div>
                {file && (
                  <span className="text-[11px] font-mono text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-semibold">
                    อ่านข้อมูลสำเร็จ ({parsedRows.length} แถว)
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                วางข้อความ CSV (คั่นด้วยจุลภาคหรือแท็บ):
              </label>
              <textarea
                rows={5}
                value={rawText}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="SO6909501,LOT-6909-A,01,150,0,2026-09-18,ช่างกิต,หมายเหตุ&#10;SO6909502,LOT-6909-A,02,80,2,2026-09-18,ช่างกิต,หมายเหตุ"
                className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          {/* Validation & Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-amber-600" />
                    <span>รายการที่ตรวจสอบแล้ว ({parsedRows.length} รายการ)</span>
                  </h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    ถูกต้อง {validRows.length} รายการ
                  </span>
                  {parsedRows.length - validRows.length > 0 && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                      มีข้อผิดพลาด {parsedRows.length - validRows.length} รายการ
                    </span>
                  )}
                </div>

                <div className="text-xs font-mono text-slate-600">
                  รวมตัดที่ถูกต้อง: <strong className="text-slate-900 font-bold">{formatMeters(totalMetersToCut)}</strong> ม. จาก <strong className="text-slate-900 font-bold">{uniqueRollsCount}</strong> ม้วน
                </div>
              </div>

              {/* Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px] sticky top-0">
                    <tr>
                      <th className="p-2.5">แถว</th>
                      <th className="p-2.5">สถานะ</th>
                      <th className="p-2.5">รหัส SO</th>
                      <th className="p-2.5">ล็อต & เบอร์</th>
                      <th className="p-2.5 text-right">ตัดลงแผ่นจริง</th>
                      <th className="p-2.5 text-right">NG</th>
                      <th className="p-2.5 text-right">รวมตัด</th>
                      <th className="p-2.5 text-right">คงเหลือม้วน</th>
                      <th className="p-2.5">วันที่</th>
                      <th className="p-2.5">ผู้บันทึก</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((row) => (
                      <tr 
                        key={row.index} 
                        className={row.status !== 'valid' ? 'bg-rose-50/40' : 'hover:bg-slate-50'}
                      >
                        <td className="p-2.5 font-mono text-slate-400">
                          {row.index}
                        </td>
                        <td className="p-2.5">
                          {row.status === 'valid' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              พร้อมตัด
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200" title={row.statusMessage}>
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span className="truncate max-w-[140px]">{row.statusMessage}</span>
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-slate-900">
                          {row.soNumber}
                        </td>
                        <td className="p-2.5 font-mono">
                          <span className="font-semibold text-slate-800">{row.lotNumber}</span>
                          <span className="text-slate-500 ml-1">#{row.rollNumber}</span>
                          {row.matchedRoll && (
                            <span className="text-[10px] text-slate-400 block">
                              ลาย {row.matchedRoll.pattern} ({row.matchedRoll.width}มม.)
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-blue-800">
                          {formatMeters(row.usedMeters)} <span className="text-slate-400 font-normal">ม.</span>
                        </td>
                        <td className="p-2.5 text-right font-mono text-rose-600">
                          {row.ngMeters > 0 ? `${formatMeters(row.ngMeters)} ม.` : '-'}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-amber-900">
                          {formatMeters(row.totalDeducted)} <span className="text-slate-400 font-normal">ม.</span>
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {row.matchedRoll ? (
                            <span className={row.matchedRoll.remainingMeters < row.totalDeducted ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                              {formatMeters(row.matchedRoll.remainingMeters)} ม.
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="p-2.5 font-mono text-slate-600 text-[11px]">
                          {row.usageDate}
                        </td>
                        <td className="p-2.5 text-slate-600 text-[11px] truncate max-w-[100px]">
                          {row.recordedBy}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>

          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={validRows.length === 0 || isProcessing}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                <span>กำลังบันทึกลง Firebase...</span>
              </>
            ) : (
              <>
                <Scissors className="w-4 h-4 stroke-[2.5]" />
                <span>ยืนยันตัดสต๊อก {validRows.length} รายการ (บันทึกขึ้นคลาวด์)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
