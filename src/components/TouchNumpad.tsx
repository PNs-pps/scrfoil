import React from 'react';
import { 
  Delete, 
  RotateCcw, 
  CornerDownLeft, 
  ArrowRight,
  Plus,
  Hash,
  X
} from 'lucide-react';

export interface TouchNumpadTarget {
  id: string;
  label: string;
  value: string;
  unit?: string;
  isAccent?: boolean;
}

interface TouchNumpadProps {
  targets: TouchNumpadTarget[];
  activeTargetId: string;
  onSelectTarget: (id: string) => void;
  onValueChange: (targetId: string, newValue: string) => void;
  onClose?: () => void;
  onNextTarget?: () => void;
}

export const TouchNumpad: React.FC<TouchNumpadProps> = ({
  targets,
  activeTargetId,
  onSelectTarget,
  onValueChange,
  onClose,
  onNextTarget,
}) => {
  const activeTarget = targets.find(t => t.id === activeTargetId) || targets[0];
  const currentValue = activeTarget ? activeTarget.value : '';

  const triggerHaptic = () => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(12);
      } catch {}
    }
  };

  const handleKeyPress = (key: string) => {
    triggerHaptic();
    if (!activeTarget) return;

    if (key === 'clear') {
      onValueChange(activeTarget.id, '');
      return;
    }

    if (key === 'backspace') {
      const nextVal = currentValue.length > 0 ? currentValue.slice(0, -1) : '';
      onValueChange(activeTarget.id, nextVal);
      return;
    }

    if (key === '.') {
      if (currentValue.includes('.')) return; // Don't allow multiple decimals
      const nextVal = currentValue === '' ? '0.' : `${currentValue}.`;
      onValueChange(activeTarget.id, nextVal);
      return;
    }

    // Number keys
    // If value is just '0' and key is not '.', replace with key
    let nextVal = currentValue;
    if (currentValue === '0' && key !== '.') {
      nextVal = key;
    } else {
      nextVal = `${currentValue}${key}`;
    }

    // Limit to 2 decimal places if dot present
    if (nextVal.includes('.')) {
      const [intPart, decPart] = nextVal.split('.');
      if (decPart && decPart.length > 2) {
        nextVal = `${intPart}.${decPart.slice(0, 2)}`;
      }
    }

    onValueChange(activeTarget.id, nextVal);
  };

  const handleAddQuick = (amount: number) => {
    triggerHaptic();
    if (!activeTarget) return;
    const currentNum = parseFloat(currentValue) || 0;
    const nextNum = Math.max(0, currentNum + amount);
    // Format to 2 decimals or integer
    const formatted = Number.isInteger(nextNum) ? String(nextNum) : nextNum.toFixed(2);
    onValueChange(activeTarget.id, formatted);
  };

  return (
    <div className="bg-slate-900 border-2 border-slate-700/80 text-white rounded-2xl shadow-2xl p-2.5 sm:p-3.5 select-none animate-in fade-in slide-in-from-bottom-2 duration-150">
      
      {/* Top Header: Target Switcher & Close button */}
      <div className="flex items-center justify-between gap-1.5 pb-2 mb-2 border-b border-slate-800">
        <div className="flex items-center gap-1 overflow-x-auto py-0.5 flex-1 min-w-0 scrollbar-none">
          {targets.map(target => {
            const isActive = target.id === activeTargetId;
            return (
              <button
                key={target.id}
                type="button"
                onClick={() => {
                  triggerHaptic();
                  onSelectTarget(target.id);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? target.isAccent 
                      ? 'bg-rose-600 text-white shadow-xs ring-1 ring-rose-400'
                      : 'bg-amber-500 text-slate-950 shadow-xs ring-1 ring-amber-300'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white'
                }`}
              >
                <span>{target.label}</span>
                <span className={`px-1.5 py-0.2 rounded-md font-mono text-[11px] ${
                  isActive 
                    ? target.isAccent ? 'bg-rose-700 text-white' : 'bg-amber-600 text-slate-950'
                    : 'bg-slate-700 text-slate-200'
                }`}>
                  {target.value !== '' ? target.value : '0'} {target.unit || ''}
                </span>
              </button>
            );
          })}
        </div>

        {onClose && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic();
              onClose();
            }}
            title="ย่อแป้นพิมพ์"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Active Display Screen */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 mb-2.5 flex items-baseline justify-between shadow-inner">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          {activeTarget?.label || 'ตัวเลข'}:
        </span>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-amber-400">
            {currentValue !== '' ? currentValue : '0'}
          </span>
          {activeTarget?.unit && (
            <span className="text-xs font-medium text-slate-400">
              {activeTarget.unit}
            </span>
          )}
        </div>
      </div>

      {/* Quick Add Pills */}
      <div className="grid grid-cols-4 gap-1.5 mb-2">
        <button
          type="button"
          onClick={() => handleAddQuick(10)}
          className="h-10 rounded-xl bg-slate-800 hover:bg-slate-750 active:scale-95 text-amber-300 font-bold text-xs flex items-center justify-center gap-0.5 border border-slate-700 cursor-pointer transition-all shadow-2xs"
        >
          <Plus className="w-3 h-3" /> 10
        </button>
        <button
          type="button"
          onClick={() => handleAddQuick(50)}
          className="h-10 rounded-xl bg-slate-800 hover:bg-slate-750 active:scale-95 text-amber-300 font-bold text-xs flex items-center justify-center gap-0.5 border border-slate-700 cursor-pointer transition-all shadow-2xs"
        >
          <Plus className="w-3 h-3" /> 50
        </button>
        <button
          type="button"
          onClick={() => handleAddQuick(100)}
          className="h-10 rounded-xl bg-slate-800 hover:bg-slate-750 active:scale-95 text-amber-300 font-bold text-xs flex items-center justify-center gap-0.5 border border-slate-700 cursor-pointer transition-all shadow-2xs"
        >
          <Plus className="w-3 h-3" /> 100
        </button>
        <button
          type="button"
          onClick={() => handleKeyPress('clear')}
          className="h-10 rounded-xl bg-rose-950/80 hover:bg-rose-900 active:scale-95 text-rose-300 font-bold text-xs flex items-center justify-center gap-1 border border-rose-800/80 cursor-pointer transition-all shadow-2xs"
        >
          <RotateCcw className="w-3.5 h-3.5" /> ล้าง (C)
        </button>
      </div>

      {/* Keypad Grid (4 columns: 7 8 9 ⌫ / 4 5 6 + / 1 2 3 Next / 0 00 . Next) */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {/* Row 1 */}
        <button
          type="button"
          onClick={() => handleKeyPress('7')}
          className="h-12 sm:h-14 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 active:scale-95 text-xl font-bold font-mono text-white flex items-center justify-center border border-slate-700 cursor-pointer shadow-xs transition-all"
        >
          7
        </button>
        <button
          type="button"
          onClick={() => handleKeyPress('8')}
          className="h-12 sm:h-14 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 active:scale-95 text-xl font-bold font-mono text-white flex items-center justify-center border border-slate-700 cursor-pointer shadow-xs transition-all"
        >
          8
        </button>
        <button
          type="button"
          onClick={() => handleKeyPress('9')}
          className="h-12 sm:h-14 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 active:scale-95 text-xl font-bold font-mono text-white flex items-center justify-center border border-slate-700 cursor-pointer shadow-xs transition-all"
        >
          9
        </button>
        <button
          type="button"
          onClick={() => handleKeyPress('backspace')}
          className="h-12 sm:h-14 rounded-xl bg-slate-750 hover:bg-slate-700 active:bg-slate-650 active:scale-95 text-amber-400 flex items-center justify-center border border-slate-700 cursor-pointer shadow-xs transition-all"
          title="ลบตัวสุดท้าย"
        >
          <Delete className="w-5 h-5" />
        </button>

        {/* Row 2 */}
        <button
          type="button"
          onClick={() => handleKeyPress('4')}
          className="h-12 sm:h-14 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 active:scale-95 text-xl font-bold font-mono text-white flex items-center justify-center border border-slate-700 cursor-pointer shadow-xs transition-all"
        >
          4
        </button>
        <button
          type="button"
          onClick={() => handleKeyPress('5')}
          className="h-12 sm:h-14 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 active:scale-95 text-xl font-bold font-mono text-white flex items-center justify-center border border-slate-700 cursor-pointer shadow-xs transition-all"
        >
          5
        </button>
        <button
          type="button"
          onClick={() => handleKeyPress('6')}
          className="h-12 sm:h-14 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 active:scale-95 text-xl font-bold font-mono text-white flex items-center justify-center border border-slate-700 cursor-pointer shadow-xs transition-all"
        >
          6
        </button>
        <button
          type="button"
          onClick={() => handleKeyPress('00')}
          className="h-12 sm:h-14 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 active:scale-95 text-lg font-bold font-mono text-slate-300 flex items-center justify-center border border-slate-700 cursor-pointer shadow-xs transition-all"
        >
          00
        </button>

        {/* Row 3 */}
        <button
          type="button"
          onClick={() => handleKeyPress('1')}
          className="h-12 sm:h-14 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 active:scale-95 text-xl font-bold font-mono text-white flex items-center justify-center border border-slate-700 cursor-pointer shadow-xs transition-all"
        >
          1
        </button>
        <button
          type="button"
          onClick={() => handleKeyPress('2')}
          className="h-12 sm:h-14 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 active:scale-95 text-xl font-bold font-mono text-white flex items-center justify-center border border-slate-700 cursor-pointer shadow-xs transition-all"
        >
          2
        </button>
        <button
          type="button"
          onClick={() => handleKeyPress('3')}
          className="h-12 sm:h-14 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 active:scale-95 text-xl font-bold font-mono text-white flex items-center justify-center border border-slate-700 cursor-pointer shadow-xs transition-all"
        >
          3
        </button>
        {/* Next Target / Tab Button spanning 2 rows */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic();
            if (onNextTarget) onNextTarget();
          }}
          className="row-span-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 active:scale-95 text-white flex flex-col items-center justify-center gap-1 border border-emerald-500 font-bold text-xs sm:text-sm cursor-pointer shadow-md transition-all"
        >
          <ArrowRight className="w-5 h-5" />
          <span>ถัดไป</span>
        </button>

        {/* Row 4 */}
        <button
          type="button"
          onClick={() => handleKeyPress('0')}
          className="h-12 sm:h-14 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 active:scale-95 text-xl font-bold font-mono text-white flex items-center justify-center border border-slate-700 cursor-pointer shadow-xs transition-all"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => handleKeyPress('.')}
          className="h-12 sm:h-14 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 active:scale-95 text-2xl font-bold font-mono text-amber-400 flex items-center justify-center border border-slate-700 cursor-pointer shadow-xs transition-all"
        >
          .
        </button>
        <button
          type="button"
          onClick={() => handleKeyPress('5')}
          className="h-12 sm:h-14 rounded-xl bg-slate-800/60 hover:bg-slate-700 active:bg-slate-600 active:scale-95 text-xs font-semibold text-slate-400 flex items-center justify-center border border-slate-700 cursor-pointer shadow-xs transition-all"
        >
          .50
        </button>
      </div>

    </div>
  );
};
