import React from 'react';
import { DrumStockCardItem } from '../types';
import { 
  X, 
  Layers, 
  Calendar, 
  Gauge, 
  CheckCircle2, 
  AlertTriangle, 
  Printer, 
  Download, 
  Scale, 
  TrendingDown,
  Sparkles,
  Info,
  Edit3,
  Trash2
} from 'lucide-react';
import { formatMeters, round2 } from '../utils/formatters';

interface ChemicalStockCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  drumCard: DrumStockCardItem | null;
  onEditDrum?: (drum: DrumStockCardItem) => void;
  onDeleteDrum?: (drumNumber: string, chemicalName: string) => void;
}

export const ChemicalStockCardModal: React.FC<ChemicalStockCardModalProps> = ({
  isOpen,
  onClose,
  drumCard,
  onEditDrum,
  onDeleteDrum,
}) => {
  if (!isOpen || !drumCard) return null;

  const isPoly = drumCard.chemicalType === 'part_a';

  const handlePrint = () => {
    window.print();
  };

  const handleExportStockCardCSV = () => {
    if (!drumCard) return;

    const headers = [
      'วันที่',
      'เลขที่ SO',
      'สูตรน้ำยา',
      'สายพาน (ม./นาที)',
      'งานดี ผลิตจริง (ม.)',
      'งานเสีย NG (ม.)',
      'รวมความยาว (ม.)',
      'ตัดน้ำยาออกจากถังนี้ (กก.)',
      'น้ำยาคงเหลือในถัง (กก.)',
      'ผู้บันทึก',
      'หมายเหตุ',
    ];

    const rows = drumCard.cuts.map(c => [
      `"${c.date}"`,
      `"${c.soNumber}"`,
      `"${c.formulaName}"`,
      c.lineSpeedMPerMin,
      c.usedMeters,
      c.ngMeters,
      c.totalMeters,
      c.cutKg,
      c.remainingInDrumKg,
      `"${c.recordedBy}"`,
      `"${(c.notes || '').replace(/"/g, '""')}"`,
    ]);

    // บรรทัดสุดท้ายสรุปค่าทั้งหมด
    const summaryRow = [
      '"-- สรุปค่าทั้งหมด --"',
      `"ใช้ไปทั้งหมด ${drumCard.cuts.length} SO"`,
      '""',
      '""',
      drumCard.totalUsedMeters,
      drumCard.totalNgMeters,
      drumCard.totalAllMeters,
      drumCard.totalCutKg,
      drumCard.remainingKg,
      `"คงเหลือในถัง ${drumCard.remainingPercent}%"`,
      '""',
    ];

    const csvContent = '\uFEFF' + [
      `"บัตรสต๊อกถังน้ำยา (Drum Stock Card): ${drumCard.drumNumber}"`,
      `"ชื่อน้ำยา: ${drumCard.chemicalName} (${isPoly ? 'Poly' : 'ISO'})"`,
      `"วันที่รับเข้า: ${drumCard.receivedDate} | บรรจุตั้งต้น: ${drumCard.initialKg} กก."`,
      '',
      headers.join(','),
      ...rows.map(e => e.join(',')),
      summaryRow.join(','),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `StockCard_${drumCard.drumNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/90">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${isPoly ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-mono">
                  {drumCard.drumNumber}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isPoly ? 'bg-emerald-100 text-emerald-900' : 'bg-indigo-100 text-indigo-900'}`}>
                  {isPoly ? 'Poly (Part A)' : 'ISO (Part B)'}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  drumCard.status === 'empty' 
                    ? 'bg-rose-100 text-rose-800' 
                    : drumCard.status === 'low' 
                    ? 'bg-amber-100 text-amber-800' 
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {drumCard.status === 'empty' ? 'น้ำยาหมดถัง' : drumCard.status === 'low' ? 'ใกล้หมดถัง' : 'ใช้งานอยู่'}
                </span>
                {drumCard.supportedDensities && drumCard.supportedDensities.length > 0 && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-950 border border-amber-300">
                    ผลิตได้: {drumCard.supportedDensities.join(', ')}
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                บัตรสต๊อกถังน้ำยา: {drumCard.chemicalName}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onEditDrum && (
              <button
                type="button"
                onClick={() => onEditDrum(drumCard)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title="แก้ไขข้อมูลถังนี้"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">แก้ไขถัง</span>
              </button>
            )}
            {onDeleteDrum && (
              <button
                type="button"
                onClick={() => onDeleteDrum(drumCard.drumNumber, drumCard.chemicalName)}
                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title="ลบถังนี้ออกจากระบบ"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">ลบถัง</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleExportStockCardCSV}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors cursor-pointer"
              title="ส่งออกบัตรสต๊อกถังนี้เป็น CSV"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* Drum Spec & Status Banner */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 font-mono">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center sm:text-left">
              <div>
                <span className="text-[11px] text-slate-400 block">วันที่รับเข้า:</span>
                <span className="text-sm font-bold text-slate-200">{drumCard.receivedDate || '-'}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">น้ำหนักตั้งต้นในถัง:</span>
                <span className="text-sm font-bold text-slate-200">{drumCard.initialKg} กก.</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">ตัดใช้ไปแล้วทั้งหมด:</span>
                <span className="text-sm font-bold text-rose-400">-{drumCard.totalCutKg} กก.</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block">เหลือน้ำยาในถังนี้:</span>
                <span className="text-base sm:text-lg font-bold text-amber-300">
                  {drumCard.remainingKg} กก. ({drumCard.remainingPercent}%)
                </span>
              </div>
            </div>

            {/* Visual Tank Gauge */}
            <div className="space-y-1 pt-1 border-t border-slate-800">
              <div className="flex justify-between text-[11px] text-slate-400 font-sans">
                <span>ปริมาณน้ำยาคงเหลือในถังเบอร์นี้:</span>
                <span className="font-mono font-bold text-white">{drumCard.remainingKg} / {drumCard.initialKg} กก.</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-700">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    drumCard.remainingPercent <= 15
                      ? 'bg-rose-500'
                      : drumCard.remainingPercent <= 30
                      ? 'bg-amber-500'
                      : isPoly ? 'bg-emerald-500' : 'bg-indigo-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, drumCard.remainingPercent))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Table: Stock Card Movements by SO */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-amber-600" />
                <span>รายการเคลื่อนไหวตัดสต๊อกถังนี้ (แยกตาม SO)</span>
              </span>
              <span className="text-xs font-mono text-slate-500">
                {drumCard.cuts.length} รายการตัด
              </span>
            </div>

            {drumCard.cuts.length === 0 ? (
              <div className="text-center py-10 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                <p className="text-xs font-semibold text-slate-600">
                  ถังเบอร์นี้ยังไม่มีประวัติการตัดสต๊อกไปใช้กับ SO ใด
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  เมื่อคุณตัดสต๊อกน้ำยาจาก SO และระบุเบอร์ถังนี้ รายการจะปรากฏในบัตรสต๊อกนี้ทันที
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">วันที่ตัด</th>
                      <th className="py-2.5 px-3">เลขที่ SO</th>
                      <th className="py-2.5 px-3">สูตรน้ำยา</th>
                      <th className="py-2.5 px-3 text-right">สายพาน (ม./นาที)</th>
                      <th className="py-2.5 px-3 text-right font-bold text-emerald-800">งานดี (เมตร)</th>
                      <th className="py-2.5 px-3 text-right font-bold text-rose-700">งานเสีย NG (เมตร)</th>
                      <th className="py-2.5 px-3 text-right">รวมความยาว (ม.)</th>
                      <th className="py-2.5 px-3 text-right font-bold text-amber-900">ตัดออกจากถัง (กก.)</th>
                      <th className="py-2.5 px-3 text-right font-bold text-blue-900">คงเหลือในถัง (กก.)</th>
                      <th className="py-2.5 px-3">ผู้บันทึก</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {drumCard.cuts.map((cut, idx) => (
                      <tr key={cut.cutId || idx} className="hover:bg-amber-50/30 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                          {cut.date}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-900 whitespace-nowrap">
                          <span className="font-bold">{cut.soNumber}</span>
                          {cut.densityK && (
                            <span className="ml-1.5 px-1.5 py-0.2 rounded bg-amber-200 text-amber-950 font-bold text-[10px]">
                              {cut.densityK}
                            </span>
                          )}
                          {cut.soNumbers && cut.soNumbers.length > 1 && (
                            <span className="ml-1 px-1 py-0.2 rounded bg-slate-200 text-slate-700 text-[10px]">
                              ({cut.soNumbers.length} SO)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {cut.formulaName}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600 whitespace-nowrap">
                          {cut.lineSpeedMPerMin}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                          {formatMeters(cut.usedMeters)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-rose-600 whitespace-nowrap">
                          {cut.ngMeters > 0 ? formatMeters(cut.ngMeters) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700 whitespace-nowrap">
                          {formatMeters(cut.totalMeters)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-900 whitespace-nowrap bg-amber-50/50">
                          -{cut.cutKg}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-900 whitespace-nowrap">
                          {cut.remainingInDrumKg}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                          {cut.recordedBy}
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  {/* บรรทัดสุดท้ายของสต๊อก: สรุปค่าทั้งหมด */}
                  <tfoot className="bg-slate-900 text-white font-mono text-xs font-bold border-t-2 border-slate-700">
                    <tr>
                      <td colSpan={4} className="py-3 px-3 text-amber-300 font-sans tracking-wide">
                        ★ สรุปค่าทั้งหมดของถังนี้ ({drumCard.cuts.length} SO):
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-400 whitespace-nowrap text-sm">
                        {formatMeters(drumCard.totalUsedMeters)} ม.
                        <span className="block text-[10px] font-sans font-normal text-slate-400">งานดีรวม</span>
                      </td>
                      <td className="py-3 px-3 text-right text-rose-400 whitespace-nowrap text-sm">
                        {formatMeters(drumCard.totalNgMeters)} ม.
                        <span className="block text-[10px] font-sans font-normal text-slate-400">งานเสีย NG</span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-300 whitespace-nowrap">
                        {formatMeters(drumCard.totalAllMeters)} ม.
                        <span className="block text-[10px] font-sans font-normal text-slate-400">เมตรทั้งหมด</span>
                      </td>
                      <td className="py-3 px-3 text-right text-amber-300 whitespace-nowrap text-sm bg-slate-800">
                        -{drumCard.totalCutKg} กก.
                        <span className="block text-[10px] font-sans font-normal text-slate-400">น้ำยาตัดรวม</span>
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-300 whitespace-nowrap text-sm bg-slate-800">
                        {drumCard.remainingKg} กก.
                        <span className="block text-[10px] font-sans font-normal text-emerald-400">
                          เหลือ ({drumCard.remainingPercent}%)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[10px] font-sans font-normal">
                        {drumCard.supplier || ''}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-slate-400" />
            <span>บัตรสต๊อกนี้คำนวณและตัดยอดแบบ Realtime ตาม SO ที่ผูกกับเบอร์ถังนี้</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์บัตรสต๊อก</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              ปิด
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
