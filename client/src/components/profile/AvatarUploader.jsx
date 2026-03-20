import React, { useState, useRef, useEffect, useCallback } from 'react';
import { uploadPhoto } from '../../api/usersApi.js';
import { useAuth } from '../../context/AuthContext.jsx';

const CROP_SIZE = 280; // px — diameter of circular crop window

export default function AvatarUploader() {
  const { user, setUser } = useAuth();
  const [uploading, setUploading] = useState(false);

  // Crop state
  const [cropUrl, setCropUrl] = useState(null);
  const [cropFile, setCropFile] = useState(null);

  const inputRef = useRef(null);

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    setCropFile(file);
    setCropUrl(URL.createObjectURL(file));
    // reset input so same file can be re-selected
    e.target.value = '';
  }

  async function handleCropConfirm(blob) {
    setCropUrl(null);
    setCropFile(null);
    setUploading(true);
    const fd = new FormData();
    fd.append('photo', blob, 'avatar.jpg');
    try {
      const res = await uploadPhoto(user.id, fd);
      setUser((u) => ({ ...u, photo_path: res.data.photo_path }));
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  function handleCropCancel() {
    setCropUrl(null);
    setCropFile(null);
  }

  const src = user?.photo_path ? `/${user.photo_path}?t=${Date.now()}` : null;
  const initials = user?.name ? user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : '?';

  return (
    <>
      <label className="cursor-pointer flex flex-col items-center gap-2">
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
        <div
          className="w-24 h-24 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden border-2 border-gray-700 hover:border-emerald-500 transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          {src
            ? <img src={src} alt="avatar" className="w-full h-full object-cover" />
            : <span className="text-2xl font-bold text-gray-300">{initials}</span>}
        </div>
        <span className="text-xs text-gray-400">{uploading ? 'Uploading...' : 'Change Photo'}</span>
      </label>

      {cropUrl && (
        <CropModal
          src={cropUrl}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </>
  );
}

// ─── Crop Modal ──────────────────────────────────────────────────────────────

function CropModal({ src, onConfirm, onCancel }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(new Image());

  // pan/zoom state stored in ref to avoid re-render loops
  const state = useRef({ x: 0, y: 0, scale: 1, dragging: false, lastX: 0, lastY: 0 });
  const rafRef = useRef(null);

  const [ready, setReady] = useState(false);

  // Load image
  useEffect(() => {
    const img = imgRef.current;
    img.onload = () => {
      // Initial fit: fill the circle (cover)
      const s = state.current;
      const shortSide = Math.min(img.naturalWidth, img.naturalHeight);
      s.scale = CROP_SIZE / shortSide;
      s.x = (CROP_SIZE - img.naturalWidth * s.scale) / 2;
      s.y = (CROP_SIZE - img.naturalHeight * s.scale) / 2;
      setReady(true);
    };
    img.src = src;
    return () => { img.onload = null; };
  }, [src]);

  // Draw loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = imgRef.current;
    const { x, y, scale } = state.current;
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Draw image
    ctx.drawImage(img, x, y, img.naturalWidth * scale, img.naturalHeight * scale);

    // Dark overlay outside circle
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, W, H);
    // Cut circle out of overlay
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, CROP_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Circle border
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, CROP_SIZE / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }, []);

  useEffect(() => {
    if (ready) draw();
  }, [ready, draw]);

  // ── Pointer events ──────────────────────────────────────────────────────────
  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    state.current.dragging = true;
    state.current.lastX = e.clientX;
    state.current.lastY = e.clientY;
  }

  function onPointerMove(e) {
    if (!state.current.dragging) return;
    const dx = e.clientX - state.current.lastX;
    const dy = e.clientY - state.current.lastY;
    state.current.lastX = e.clientX;
    state.current.lastY = e.clientY;
    state.current.x += dx;
    state.current.y += dy;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
  }

  function onPointerUp() {
    state.current.dragging = false;
  }

  function onWheel(e) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const s = state.current;
    const factor = e.deltaY < 0 ? 1.08 : 0.93;
    const newScale = Math.max(0.1, Math.min(10, s.scale * factor));
    // Zoom toward cursor
    s.x = mx - (mx - s.x) * (newScale / s.scale);
    s.y = my - (my - s.y) * (newScale / s.scale);
    s.scale = newScale;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
  }

  // ── Confirm: render cropped circle to offscreen canvas ──────────────────────
  function handleConfirm() {
    const OUTPUT = 400; // output px (square — server will serve as-is)
    const off = document.createElement('canvas');
    off.width = OUTPUT;
    off.height = OUTPUT;
    const ctx = off.getContext('2d');
    const img = imgRef.current;
    const s = state.current;
    const mainCanvas = canvasRef.current;
    const W = mainCanvas.width;
    const H = mainCanvas.height;

    // Translate from canvas-space to output-space
    const ratio = OUTPUT / CROP_SIZE;
    const cx = W / 2 - CROP_SIZE / 2; // left edge of crop circle in canvas
    const cy = H / 2 - CROP_SIZE / 2; // top edge of crop circle in canvas

    // Clip to circle
    ctx.beginPath();
    ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2);
    ctx.clip();

    // Draw the portion of the image that falls inside the crop circle
    ctx.drawImage(
      img,
      (s.x - cx) * ratio,
      (s.y - cy) * ratio,
      img.naturalWidth * s.scale * ratio,
      img.naturalHeight * s.scale * ratio,
    );

    off.toBlob((blob) => onConfirm(blob), 'image/jpeg', 0.92);
  }

  const CANVAS_W = CROP_SIZE + 120;
  const CANVAS_H = CROP_SIZE + 80;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-gray-900 rounded-2xl p-6 flex flex-col items-center gap-4 shadow-2xl">
        <h2 className="text-white font-bold text-lg">Crop Photo</h2>
        <p className="text-gray-400 text-sm">Drag to reposition · scroll to zoom</p>

        {/* Canvas */}
        <div className="rounded-xl overflow-hidden cursor-grab active:cursor-grabbing select-none">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onWheel={onWheel}
            style={{ display: 'block', touchAction: 'none' }}
          />
        </div>

        <div className="flex gap-3 w-full">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors text-sm font-bold"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
