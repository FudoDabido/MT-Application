'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { uploadPhoto } from '../../api/usersApi.js';
import { useAuth } from '../../context/AuthContext.jsx';

const OUTPUT_SIZE = 400;

export default function AvatarUploader({ size = 'md' }) {
  const { user, setUser } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [cropUrl, setCropUrl] = useState(null);
  const inputRef = useRef(null);

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    setCropUrl(URL.createObjectURL(file));
    setError('');
    e.target.value = '';
  }

  async function handleCropConfirm(blob) {
    setCropUrl(null);
    setUploading(true);
    setError('');
    const fd = new FormData();
    fd.append('photo', blob, 'avatar.jpg');
    try {
      const res = await uploadPhoto(user.id, fd);
      setUser(u => ({ ...u, photo_path: res.data.photo_path }));
    } catch (err) {
      setError('Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  }

  const src = user?.photo_path ? `/uploads/${user.photo_path.replace(/^uploads\//, '')}?t=${Date.now()}` : null;
  const initials = user?.name ? user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : '?';

  return (
    <>
      <div className="flex flex-col items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden border-2 border-gray-700 hover:border-emerald-500 transition-colors focus:outline-none"
        >
          {src
            ? <img src={src} alt="avatar" className="w-full h-full object-cover" />
            : <span className="text-2xl font-bold text-gray-300">{initials}</span>}
        </button>
        <span className="text-xs text-gray-500">
          {uploading ? 'Uploading…' : 'Tap to change'}
        </span>
        {error && <span className="text-xs text-red-400">{error}</span>}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {cropUrl && (
        <CropModal
          src={cropUrl}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropUrl(null)}
        />
      )}
    </>
  );
}

// ─── Crop Modal ───────────────────────────────────────────────────────────────

function CropModal({ src, onConfirm, onCancel }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(new Image());
  const stateRef = useRef({ x: 0, y: 0, scale: 1 });
  const [ready, setReady] = useState(false);

  // Track touch for pinch-zoom
  const touchRef = useRef({ touches: [], dist: 0 });

  // Canvas dimensions — fit mobile screen
  const SIZE = Math.min(typeof window !== 'undefined' ? window.innerWidth - 48 : 320, 320);

  useEffect(() => {
    const img = imgRef.current;
    img.onload = () => {
      const s = stateRef.current;
      const short = Math.min(img.naturalWidth, img.naturalHeight);
      s.scale = SIZE / short;
      s.x = (SIZE - img.naturalWidth * s.scale) / 2;
      s.y = (SIZE - img.naturalHeight * s.scale) / 2;
      setReady(true);
    };
    img.src = src;
    return () => { img.onload = null; };
  }, [src, SIZE]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = imgRef.current;
    const { x, y, scale } = stateRef.current;

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.drawImage(img, x, y, img.naturalWidth * scale, img.naturalHeight * scale);

    // Dark overlay with circle cutout
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.rect(0, 0, SIZE, SIZE);
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 4, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.restore();

    // Circle border
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }, [SIZE]);

  useEffect(() => { if (ready) draw(); }, [ready, draw]);

  // ── Pointer / Touch events ──────────────────────────────────────────────────

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    stateRef.current.dragging = true;
    stateRef.current.lastX = e.clientX;
    stateRef.current.lastY = e.clientY;
  }

  function onPointerMove(e) {
    if (!stateRef.current.dragging) return;
    const dx = e.clientX - stateRef.current.lastX;
    const dy = e.clientY - stateRef.current.lastY;
    stateRef.current.lastX = e.clientX;
    stateRef.current.lastY = e.clientY;
    stateRef.current.x += dx;
    stateRef.current.y += dy;
    draw();
  }

  function onPointerUp() { stateRef.current.dragging = false; }

  function onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.93;
    zoom(factor, SIZE / 2, SIZE / 2);
  }

  function onTouchStart(e) {
    if (e.touches.length === 2) {
      touchRef.current.dist = getTouchDist(e.touches);
    }
  }

  function onTouchMove(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const newDist = getTouchDist(e.touches);
      const factor = newDist / (touchRef.current.dist || newDist);
      touchRef.current.dist = newDist;
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const rect = canvasRef.current.getBoundingClientRect();
      zoom(factor, mx - rect.left, my - rect.top);
    }
  }

  function getTouchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function zoom(factor, cx, cy) {
    const s = stateRef.current;
    const newScale = Math.max(0.1, Math.min(10, s.scale * factor));
    s.x = cx - (cx - s.x) * (newScale / s.scale);
    s.y = cy - (cy - s.y) * (newScale / s.scale);
    s.scale = newScale;
    draw();
  }

  // Zoom buttons for mobile convenience
  function zoomIn()  { zoom(1.15, SIZE / 2, SIZE / 2); }
  function zoomOut() { zoom(0.87, SIZE / 2, SIZE / 2); }

  // ── Confirm ─────────────────────────────────────────────────────────────────

  function handleConfirm() {
    const off = document.createElement('canvas');
    off.width = OUTPUT_SIZE;
    off.height = OUTPUT_SIZE;
    const ctx = off.getContext('2d');
    const img = imgRef.current;
    const { x, y, scale } = stateRef.current;
    const ratio = OUTPUT_SIZE / SIZE;

    ctx.beginPath();
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    ctx.drawImage(img, x * ratio, y * ratio, img.naturalWidth * scale * ratio, img.naturalHeight * scale * ratio);
    off.toBlob(blob => onConfirm(blob), 'image/jpeg', 0.92);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80" onClick={onCancel}>
      <div
        className="bg-gray-900 rounded-t-2xl sm:rounded-2xl p-5 flex flex-col items-center gap-4 w-full sm:w-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-700 rounded-full sm:hidden" />
        <p className="text-white font-bold text-base">Crop Photo</p>
        <p className="text-gray-400 text-xs text-center">Drag to reposition · pinch or use buttons to zoom</p>

        <div className="rounded-full overflow-hidden" style={{ width: SIZE, height: SIZE }}>
          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onWheel={onWheel}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            style={{ display: 'block', touchAction: 'none', cursor: 'grab' }}
          />
        </div>

        {/* Zoom buttons */}
        <div className="flex gap-3">
          <button type="button" onClick={zoomOut}
            className="w-10 h-10 rounded-full bg-gray-800 text-white text-xl font-bold flex items-center justify-center hover:bg-gray-700">−</button>
          <button type="button" onClick={zoomIn}
            className="w-10 h-10 rounded-full bg-gray-800 text-white text-xl font-bold flex items-center justify-center hover:bg-gray-700">+</button>
        </div>

        <div className="flex gap-3 w-full">
          <button type="button" onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 text-sm font-medium hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleConfirm}
            className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 transition-colors">
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
