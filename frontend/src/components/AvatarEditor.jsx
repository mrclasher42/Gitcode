import { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, X } from "lucide-react";

export function AvatarEditor({ file, onSave, onCancel }) {
  const [imgSrc, setImgSrc] = useState("");
  const [imgDims, setImgDims] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [drag, setDrag] = useState(null);
  const canvasRef = useRef(null);
  const previewRef = useRef(null);

  const SIZE = 256; // canvas size for saving
  const PREVIEW = 280; // preview box size

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImgSrc(url);
    // Load image to get dimensions
    const img = new Image();
    img.onload = () => {
      setImgDims({ w: img.width, h: img.height });
      // Fit image inside preview on first load
      const fit = Math.min(PREVIEW / img.width, PREVIEW / img.height);
      setZoom(fit);
      setOffsetX(0);
      setOffsetY(0);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function clampZoom(z) {
    return Math.max(0.1, Math.min(5, z));
  }

  function handleMouseDown(e) {
    e.preventDefault();
    const t = e.touches ? e.touches[0] : e;
    setDrag({ sx: t.clientX, sy: t.clientY, ox: offsetX, oy: offsetY });
  }

  function handleMouseMove(e) {
    if (!drag) return;
    const t = e.touches ? e.touches[0] : e;
    setOffsetX(drag.ox + (t.clientX - drag.sx));
    setOffsetY(drag.oy + (t.clientY - drag.sy));
  }

  function handleMouseUp() {
    setDrag(null);
  }

  function onWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => clampZoom(z * delta));
  }

  async function save() {
    const img = new Image();
    img.src = imgSrc;
    await new Promise((r) => { img.onload = r; });

    const canvas = canvasRef.current;
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    // Scale factor: preview → canvas
    const scale = SIZE / PREVIEW;
    const iw = img.width * zoom * scale;
    const ih = img.height * zoom * scale;
    const dx = SIZE / 2 - iw / 2 + offsetX * scale;
    const dy = SIZE / 2 - ih / 2 + offsetY * scale;

    ctx.drawImage(img, dx, dy, iw, ih);
    ctx.restore();

    canvas.toBlob((blob) => onSave(blob), "image/png");
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
    >
      <div className="w-full max-w-md rounded-lg border border-[var(--color-border-default)] bg-[var(--color-canvas-default)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Adjust avatar</h2>
          <button
            onClick={onCancel}
            className="rounded-md p-1.5 hover:bg-[var(--color-btn-hover-bg)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Preview */}
        <div
          ref={previewRef}
          className="relative mx-auto mb-4 cursor-move overflow-hidden rounded-full border border-[var(--color-border-default)] bg-[var(--color-canvas-subtle)]"
          style={{ width: PREVIEW, height: PREVIEW, touchAction: "none" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
          onWheel={onWheel}
        >
          {imgSrc && (
            <img
              src={imgSrc}
              alt="preview"
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 select-none"
              style={{
                width: imgDims.w * zoom,
                height: imgDims.h * zoom,
                transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`,
                maxWidth: "none",
              }}
            />
          )}
        </div>

        {/* Zoom controls */}
        <div className="mb-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setZoom((z) => clampZoom(z / 1.15))}
            className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-btn-bg)] p-1.5"
          >
            <ZoomOut size={16} />
          </button>
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => setZoom((z) => clampZoom(z * 1.15))}
            className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-btn-bg)] p-1.5"
          >
            <ZoomIn size={16} />
          </button>
        </div>

        <p className="mb-3 text-center text-xs text-[var(--color-fg-muted)]">
          Drag to move · Scroll or use slider to zoom
        </p>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-[var(--color-border-default)] bg-[var(--color-btn-bg)] px-4 py-1.5 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="rounded-md border border-[rgba(31,35,40,0.15)] bg-[var(--color-btn-primary-bg)] px-4 py-1.5 text-sm font-medium text-[var(--color-btn-primary-fg)]"
          >
            Save avatar
          </button>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
