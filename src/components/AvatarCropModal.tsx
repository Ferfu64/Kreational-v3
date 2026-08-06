import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Check, Sparkles, Layers, Sliders, AlertCircle } from 'lucide-react';
import { User } from '../types';
import { SFX } from '../utils/sfx';

interface AvatarCropModalProps {
  imageSrc: string;
  user: User;
  onConfirm: (croppedDataUrl: string, paymentMethod: 'shards' | 'krests' | 'admin') => void;
  onClose: () => void;
}

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  imageSrc,
  user,
  onConfirm,
  onClose,
}) => {
  const [zoom, setZoom] = useState<number>(1.0);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [rotation, setRotation] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const iconShards = user.iconShards || 0;
  const krests = user.krests || 0;
  const isAdmin = user.role === 'admin';

  const canPayShards = iconShards >= 10;
  const canPayKrests = krests >= 25;
  const canAfford = isAdmin || canPayShards || canPayKrests;

  // Determine default payment method
  const defaultMethod: 'shards' | 'krests' | 'admin' = isAdmin
    ? 'admin'
    : canPayShards
    ? 'shards'
    : 'krests';

  const [paymentMethod, setPaymentMethod] = useState<'shards' | 'krests' | 'admin'>(defaultMethod);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      imageRef.current = img;
      renderCanvas();
    };
  }, [imageSrc]);

  useEffect(() => {
    renderCanvas();
  }, [zoom, offsetX, offsetY, rotation]);

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 256;
    canvas.width = size;
    canvas.height = size;

    ctx.clearRect(0, 0, size, size);

    // Save context state
    ctx.save();

    // Center point
    ctx.translate(size / 2 + offsetX, size / 2 + offsetY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    // Draw centered image
    const aspect = img.width / img.height;
    let drawW = size;
    let drawH = size;

    if (aspect > 1) {
      drawW = size * aspect;
      drawH = size;
    } else {
      drawW = size;
      drawH = size / aspect;
    }

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

    ctx.restore();
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    renderCanvas();
    const dataUrl = canvas.toDataURL('image/png', 0.95);

    SFX.playCoin();
    onConfirm(dataUrl, paymentMethod);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-lg rounded-3xl bg-slate-950 border border-purple-500/40 shadow-2xl shadow-purple-950/80 overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-mono">Scale & Adjust Avatar</h3>
              <p className="text-xs text-slate-400">Zoom, position, and customize your profile photo</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Canvas Preview Area */}
          <div className="relative w-48 h-48 mx-auto rounded-full overflow-hidden border-4 border-purple-500/60 shadow-2xl shadow-purple-950/80 bg-slate-900 shrink-0">
            <canvas ref={canvasRef} className="w-full h-full object-cover" />
            <div className="absolute inset-0 rounded-full border border-white/20 pointer-events-none" />
          </div>

          {/* Controls: Zoom & Position Sliders */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
            {/* Zoom Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-mono text-slate-300">
                <span className="flex items-center gap-1.5 font-bold">
                  <ZoomIn className="w-3.5 h-3.5 text-purple-400" /> Scale / Zoom
                </span>
                <span className="text-purple-300 font-bold">{zoom.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>

            {/* Position X Offset */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-mono text-slate-300">
                <span className="font-bold">Horizontal Position (X)</span>
                <span className="text-slate-400">{offsetX}px</span>
              </div>
              <input
                type="range"
                min="-120"
                max="120"
                step="2"
                value={offsetX}
                onChange={(e) => setOffsetX(parseInt(e.target.value, 10))}
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>

            {/* Position Y Offset */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-mono text-slate-300">
                <span className="font-bold">Vertical Position (Y)</span>
                <span className="text-slate-400">{offsetY}px</span>
              </div>
              <input
                type="range"
                min="-120"
                max="120"
                step="2"
                value={offsetY}
                onChange={(e) => setOffsetY(parseInt(e.target.value, 10))}
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>

            {/* Rotate Button */}
            <button
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Rotate 90° ({rotation}°)</span>
            </button>
          </div>

          {/* Payment Method & Credit Requirement Section */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/60 to-slate-900 border border-purple-500/30 space-y-3">
            <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider flex items-center justify-between">
              <span>Avatar Customization Cost</span>
              <span className="text-amber-300 font-normal">Requires 10 Shards OR 25 Krests</span>
            </h4>

            {!isAdmin && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => canPayShards && setPaymentMethod('shards')}
                  disabled={!canPayShards}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    paymentMethod === 'shards'
                      ? 'bg-purple-600/30 border-purple-400 text-white shadow-md'
                      : 'bg-white/[0.02] border-white/10 text-slate-400'
                  } ${!canPayShards ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-purple-400" /> Pay 10 Shards
                    </span>
                    {paymentMethod === 'shards' && <Check className="w-3.5 h-3.5 text-purple-300" />}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Balance: {iconShards} / 10 Shards
                  </span>
                </button>

                <button
                  onClick={() => canPayKrests && setPaymentMethod('krests')}
                  disabled={!canPayKrests}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    paymentMethod === 'krests'
                      ? 'bg-amber-600/30 border-amber-400 text-white shadow-md'
                      : 'bg-white/[0.02] border-white/10 text-slate-400'
                  } ${!canPayKrests ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Pay 25 Krests
                    </span>
                    {paymentMethod === 'krests' && <Check className="w-3.5 h-3.5 text-amber-300" />}
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Balance: {krests} Krests
                  </span>
                </button>
              </div>
            )}

            {isAdmin && (
              <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold font-mono text-center">
                👑 Admin Privilege: Free Unlimited Avatar Uploads
              </div>
            )}

            {!canAfford && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>You need at least 10 Icon Shards or 25 Krests to change custom photo.</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-white/10 bg-slate-900/60 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={!canAfford}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
              canAfford
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-950/80 cursor-pointer'
                : 'bg-slate-800 text-slate-500 border border-white/10 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>
              {isAdmin
                ? 'Apply Avatar'
                : paymentMethod === 'shards'
                ? 'Apply (-10 Shards)'
                : 'Apply (-25 Krests)'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
