import React, { useState } from 'react';
import { Lock, Key, X, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { verifyPassword } from '../utils/auth';

interface PasswordPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  actionTitle?: string;
}

export const PasswordPromptModal: React.FC<PasswordPromptModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  actionTitle = 'เพื่อเข้าสู่โหมดคีย์ข้อมูล',
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (verifyPassword(password)) {
      setPassword('');
      setError(null);
      onSuccess();
    } else {
      setError('รหัสผ่านไม่ถูกต้อง ติดต่อนอต');
    }
  };

  const handleClose = () => {
    setPassword('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
      <div 
        id="modal-password-prompt"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                ยืนยันรหัสผ่านโหมดคีย์ข้อมูล
              </h3>
              <p className="text-xs text-slate-400">
                {actionTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <Key className="w-4 h-4 text-amber-600 shrink-0" />
              <span>โหมดผู้รับชม (Visitor)</span>
            </div>
            <p className="text-amber-800 leading-relaxed">
              ปัจจุบันคุณอยู่ใน <strong>โหมดผู้เข้าชม (Visitor)</strong> สำหรับดูยอดคงเหลือและประวัติ หากต้องการเพิ่มฟอยล์ ตัดสต๊อก หรือแก้ไขข้อมูล กรุณาใส่รหัสผ่านผู้ดูแล
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="input-operator-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
              รหัสผ่านสำหรับคีย์ข้อมูล <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                id="input-operator-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่านเพื่อปลดล็อค"
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-xs active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Key className="w-4 h-4 stroke-[2.5]" />
              <span>ปลดล็อคโหมดคีย์ข้อมูล</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
