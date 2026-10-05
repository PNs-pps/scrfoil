import React, { useState, useEffect } from 'react';
import { 
  parseSONumber, 
  buildSONumber, 
  getCurrentThaiYearBE2Digits, 
  getCurrentMonth2Digits, 
  getRealtimeSOExample,
  THAI_MONTHS 
} from '../utils/soFormatter';
import { CheckCircle2, AlertCircle, Sparkles, SlidersHorizontal, RotateCcw } from 'lucide-react';

interface SOInputHelperProps {
  value: string;
  onChange: (val: string) => void;
  id?: string;
  label?: string;
  required?: boolean;
}

export const SOInputHelper: React.FC<SOInputHelperProps> = ({ 
  value, 
  onChange, 
  id = 'so-number-input',
  label = 'รหัสคำสั่งซื้อ SO',
  required = true
}) => {
  const currentYearBE = getCurrentThaiYearBE2Digits();
  const currentMonth = getCurrentMonth2Digits();
  const realtimeExample = getRealtimeSOExample('___');

  // Mode: 'structured' (default with dedicated 3-digit input, editable year & month) vs 'full' (single text input)
  const [mode, setMode] = useState<'structured' | 'full'>('structured');
  
  // Internal structured fields
  const [yearBE, setYearBE] = useState(currentYearBE);
  const [month, setMonth] = useState(currentMonth);
  const [orderNo, setOrderNo] = useState('');

  // Parse current value
  const parsed = parseSONumber(value);

  // Sync internal state when external value changes
  useEffect(() => {
    if (value && value.toLowerCase().startsWith('so')) {
      const p = parseSONumber(value);
      if (p.isValid && p.components) {
        setYearBE(p.components.yearBE);
        setMonth(p.components.month);
        setOrderNo(p.components.orderNo);
      } else {
        const raw = value.slice(2);
        if (raw.length >= 2) setYearBE(raw.slice(0, 2));
        if (raw.length >= 4) setMonth(raw.slice(2, 4));
        if (raw.length > 4) setOrderNo(raw.slice(4));
      }
    } else if (!value) {
      // Empty value: keep current year and month, clear orderNo
      setYearBE(currentYearBE);
      setMonth(currentMonth);
      setOrderNo('');
    }
  }, [value, currentYearBE, currentMonth]);

  const handleFieldChange = (newYear: string, newMonth: string, newOrder: string) => {
    const cleanY = newYear.replace(/\D/g, '').slice(0, 2);
    const cleanM = newMonth.replace(/\D/g, '').slice(0, 2);
    const cleanO = newOrder.replace(/\D/g, '').slice(0, 4);

    setYearBE(cleanY);
    setMonth(cleanM);
    setOrderNo(cleanO);

    // Update combined value
    const combined = buildSONumber(cleanY || currentYearBE, cleanM || currentMonth, cleanO);
    onChange(combined);
  };

  const handleResetToCurrent = () => {
    handleFieldChange(currentYearBE, currentMonth, orderNo || '001');
  };

  const selectedMonthLabel = THAI_MONTHS.find(m => m.value === month)?.label.split('-')[1]?.trim() || month;

  return (
    <div className="space-y-2">
      {/* Label and Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <label htmlFor={`${id}-order`} className="block text-xs font-semibold text-slate-800">
          {label} <span className="text-amber-600 font-mono font-normal">(so + ปี + เดือน + เลข 3 ตัวท้าย)</span>
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
        
        <div className="flex items-center gap-2 text-xs">
          {/* Example with current year & month, 3 digits blanked */}
          <span 
            className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200"
            title={`ตัวอย่างตามเวลาจริง: ปี พ.ศ. 25${currentYearBE} เดือน ${currentMonth}`}
          >
            <Sparkles className="w-3 h-3 text-amber-600" />
            ตัวอย่าง: <strong className="tracking-wide">{realtimeExample}</strong>
          </span>

          <span className="text-slate-300">|</span>

          <button
            type="button"
            onClick={() => setMode(mode === 'structured' ? 'full' : 'structured')}
            className="text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer font-medium text-[11px]"
          >
            <SlidersHorizontal className="w-3 h-3" />
            {mode === 'structured' ? 'พิมพ์รหัสเต็ม' : 'แยกกรอก 3 ตัวท้าย'}
          </button>
        </div>
      </div>

      {mode === 'structured' ? (
        /* Structured Mode with dedicated 3-digit order number input */
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">
              ใส่ปี/เดือน (ตั้งต้นตามเวลาจริง แก้ได้) และกรอก <strong className="text-slate-900">เลข 3 ตัวท้าย</strong>:
            </span>
            {(yearBE !== currentYearBE || month !== currentMonth) && (
              <button
                type="button"
                onClick={handleResetToCurrent}
                className="text-[11px] text-amber-700 hover:text-amber-800 flex items-center gap-1 underline cursor-pointer"
                title="รีเซ็ตปีและเดือนเป็นปัจจุบัน"
              >
                <RotateCcw className="w-3 h-3" />
                รีเซ็ตปี/เดือนปัจจุบัน
              </button>
            )}
          </div>

          {/* Input Group: [so] [xx] [yy] [zzz (dedicated input)] */}
          <div className="grid grid-cols-12 gap-1.5 sm:gap-2 items-center">
            {/* Fixed 'so' prefix */}
            <div className="col-span-2 sm:col-span-2">
              <span className="block text-[10px] text-slate-400 font-mono text-center mb-0.5">prefix</span>
              <div className="w-full py-2 bg-slate-200/90 text-slate-700 font-mono font-bold text-sm text-center rounded-lg border border-slate-300 select-none">
                so
              </div>
            </div>

            {/* Year BE (xx) - 2 digits, editable */}
            <div className="col-span-3 sm:col-span-2">
              <label htmlFor={`${id}-year`} className="block text-[10px] text-slate-500 font-mono text-center mb-0.5">
                ปี xx (พ.ศ.)
              </label>
              <input
                id={`${id}-year`}
                type="text"
                inputMode="numeric"
                maxLength={2}
                value={yearBE}
                onChange={(e) => handleFieldChange(e.target.value, month, orderNo)}
                placeholder={currentYearBE}
                title="ปี พ.ศ. 2 หลัก (ค่าเริ่มต้นตามปีปัจจุบัน แก้ไขได้)"
                className="w-full py-2 px-1 text-center font-mono font-bold text-sm bg-white border border-slate-300 rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-slate-900"
              />
            </div>

            {/* Month (yy) - 2 digits, editable */}
            <div className="col-span-3 sm:col-span-3">
              <label htmlFor={`${id}-month`} className="block text-[10px] text-slate-500 font-mono text-center mb-0.5">
                เดือน yy (01-12)
              </label>
              <select
                id={`${id}-month`}
                value={month}
                onChange={(e) => handleFieldChange(yearBE, e.target.value, orderNo)}
                title="เดือน 2 หลัก (ค่าเริ่มต้นตามเดือนปัจจุบัน แก้ไขได้)"
                className="w-full py-2 px-1.5 text-center font-mono font-bold text-xs bg-white border border-slate-300 rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-slate-900 cursor-pointer"
              >
                {THAI_MONTHS.map(m => (
                  <option key={m.value} value={m.value}>
                    {m.value} ({m.label.split('-')[1]?.trim()})
                  </option>
                ))}
              </select>
            </div>

            {/* Dedicated 3-digit order number input (zzz) */}
            <div className="col-span-4 sm:col-span-5">
              <label htmlFor={`${id}-order`} className="block text-[10px] text-amber-800 font-semibold mb-0.5 truncate">
                เลข 3 ตัวท้าย (zzz) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id={`${id}-order`}
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={orderNo}
                  onChange={(e) => handleFieldChange(yearBE, month, e.target.value)}
                  placeholder="เช่น 500, 001"
                  autoFocus={!orderNo}
                  className={`w-full py-2 px-3 font-mono font-bold text-base bg-white border rounded-lg transition-colors ${
                    orderNo.length >= 3
                      ? 'border-emerald-400 bg-emerald-50/30 text-emerald-950 focus:border-emerald-500'
                      : 'border-amber-400 bg-amber-50/20 text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Real-time preview & breakdown banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200/80 text-xs">
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-slate-500 text-[11px]">รหัส SO ที่ได้:</span>
              <span className={`px-2 py-0.5 rounded font-bold text-sm ${
                orderNo ? 'bg-amber-100 text-amber-950 border border-amber-300' : 'bg-slate-200 text-slate-600'
              }`}>
                {buildSONumber(yearBE || currentYearBE, month || currentMonth, orderNo || '___')}
              </span>
              {orderNo.length >= 3 && (
                <span className="text-emerald-600 flex items-center gap-0.5 text-[11px] font-sans font-medium ml-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  ครบถ้วน
                </span>
              )}
            </div>

            <div className="text-[11px] text-slate-500">
              ปี 25{yearBE || currentYearBE} • เดือน {selectedMonthLabel}
            </div>
          </div>
        </div>
      ) : (
        /* Full Text Single Input Mode */
        <div className="space-y-1">
          <div className="relative">
            <input
              id={`${id}-full`}
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value.toLowerCase().replace(/\s/g, ''))}
              placeholder={`เช่น so${currentYearBE}${currentMonth}500`}
              className={`w-full px-3.5 py-2.5 rounded-lg border font-mono text-base tracking-wide transition-colors ${
                parsed.isValid
                  ? 'border-emerald-400 bg-emerald-50/20 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-900'
                  : value
                  ? 'border-rose-300 bg-rose-50/20 focus:border-rose-400 focus:ring-1 focus:ring-rose-400 text-slate-900'
                  : 'border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-slate-900'
              }`}
            />
            {parsed.isValid ? (
              <div className="absolute right-3 top-2.5 text-emerald-600 flex items-center gap-1 text-xs font-sans">
                <CheckCircle2 className="w-4 h-4" />
                <span className="font-medium hidden sm:inline">รูปแบบถูกต้อง</span>
              </div>
            ) : value ? (
              <div className="absolute right-3 top-2.5 text-rose-500 flex items-center gap-1 text-xs font-sans" title={parsed.error}>
                <AlertCircle className="w-4 h-4" />
              </div>
            ) : null}
          </div>
          <p className="text-[11px] text-slate-500">
            รูปแบบ: <span className="font-mono text-slate-700">so</span> + 
            <span className="text-amber-700 font-mono font-medium"> {currentYearBE}</span> (ปี) + 
            <span className="text-blue-700 font-mono font-medium"> {currentMonth}</span> (เดือน) + 
            <span className="text-purple-700 font-mono font-medium"> 500</span> (เลขคำสั่งซื้อ)
          </p>
        </div>
      )}
    </div>
  );
};
