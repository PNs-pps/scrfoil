import React from 'react';
import { FoilRoll, StockCutRecord } from '../types';
import { calculateRollReservationMetrics } from '../utils/reservationHelpers';
import { formatMeters } from '../utils/formatters';

interface FoilStatusTubeProps {
  roll: FoilRoll;
  records?: StockCutRecord[];
  showStats?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showLabels?: boolean;
}

export const FoilStatusTube: React.FC<FoilStatusTubeProps> = ({
  roll,
  records = [],
  showStats = true,
  size = 'md',
  className = '',
  showLabels = true,
}) => {
  const metrics = calculateRollReservationMetrics(roll, records);

  const tubeHeight = size === 'sm' ? 'h-2' : size === 'lg' ? 'h-4' : 'h-2.5';

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      {/* หลอดไทม์ไลน์สถานะ 3 สี: เขียว (เหลือว่าง) / เหลือง (จอง) / เทา (ใช้แล้ว) */}
      <div
        className={`w-full ${tubeHeight} bg-slate-100 rounded-full overflow-hidden flex shadow-inner border border-slate-200/80`}
        title={`ใช้ไปแล้ว: ${formatMeters(metrics.usedMeters)} ม. (${Math.round(metrics.usedPercent)}%) | จองคิว: ${formatMeters(metrics.reservedMeters)} ม. (${Math.round(metrics.reservedPercent)}%) | เหลือว่าง: ${formatMeters(metrics.projectedRemainingMeters)} ม. (${Math.round(metrics.availablePercent)}%)`}
      >
        {/* ส่วนสีเขียว: เหลือจริงพร้อมใช้หลังหักจอง (Available Remaining - อยู่ฝั่งซ้าย) */}
        {metrics.availablePercent > 0 && (
          <div
            style={{ width: `${metrics.availablePercent}%` }}
            className="bg-emerald-500 transition-all duration-300 relative group/avail"
          />
        )}

        {/* ส่วนสีเหลือง: จองรอตัด (Reserved - อยู่ตรงกลาง) */}
        {metrics.reservedPercent > 0 && (
          <div
            style={{ width: `${metrics.reservedPercent}%` }}
            className="bg-amber-400 transition-all duration-300 animate-pulse relative group/res"
          />
        )}

        {/* ส่วนสีเทา: ใช้ไปแล้ว (Used - อยู่ฝั่งขวา) */}
        {metrics.usedPercent > 0 && (
          <div
            style={{ width: `${metrics.usedPercent}%` }}
            className="bg-slate-300 transition-all duration-300 relative group/used"
          />
        )}
      </div>

      {/* แถบสรุปสถานะ 3 ค่าตามข้อกำหนด: จองกี่เมตร / เหลือจริงกี่เมตร / ผลิตจริงแล้วจะเหลือกี่เมตร */}
      {showStats && (
        <div className="grid grid-cols-3 gap-1 pt-0.5 text-[11px] sm:text-xs">
          {/* 1. จองกี่เมตร (สีเหลือง) */}
          <div className="flex flex-col bg-amber-50/80 px-2 py-1 rounded border border-amber-200">
            <span className="text-[10px] text-amber-800 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 inline-block" />
              มีการจอง
            </span>
            <span className="font-mono font-bold text-amber-950 truncate">
              {formatMeters(metrics.reservedMeters)} <span className="text-[10px] font-normal text-amber-800">ม.</span>
            </span>
          </div>

          {/* 2. เหลือจริงกี่เมตร */}
          <div className="flex flex-col bg-slate-50 px-2 py-1 rounded border border-slate-200">
            <span className="text-[10px] text-slate-600 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0 inline-block" />
              เหลือจริง
            </span>
            <span className="font-mono font-bold text-slate-900 truncate">
              {formatMeters(metrics.remainingMeters)} <span className="text-[10px] font-normal text-slate-500">ม.</span>
            </span>
          </div>

          {/* 3. ผลิตจริงแล้วจะเหลือกี่เมตร (สีเขียว) */}
          <div className="flex flex-col bg-emerald-50/80 px-2 py-1 rounded border border-emerald-200">
            <span className="text-[10px] text-emerald-800 font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 inline-block" />
              ผลิตแล้วจะเหลือ
            </span>
            <span className={`font-mono font-bold truncate ${metrics.projectedRemainingMeters <= 50 ? 'text-rose-600' : 'text-emerald-950'}`}>
              {formatMeters(metrics.projectedRemainingMeters)} <span className="text-[10px] font-normal text-emerald-800">ม.</span>
            </span>
          </div>
        </div>
      )}

      {/* คำอธิบายสัญลักษณ์สีแบบย่อ (ถ้าเปิด showLabels) */}
      {showLabels && !showStats && (
        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono px-0.5">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            เหลือว่าง {formatMeters(metrics.projectedRemainingMeters)}ม.
          </span>
          {metrics.reservedMeters > 0 && (
            <span className="flex items-center gap-1 text-amber-700 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              จอง {formatMeters(metrics.reservedMeters)}ม.
            </span>
          )}
          <span className="flex items-center gap-1 text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            ใช้แล้ว {formatMeters(metrics.usedMeters)}ม.
          </span>
        </div>
      )}
    </div>
  );
};
