"use client";
import React, { useEffect, useRef } from 'react';

/**
 * MedicalMatrixRain
 * Minimal Cyber-Medical Matrix Rain background effect featuring falling pills, capsules,
 * medicine delivery bags, first-aid kits, vials, and matrix medical telemetry glyphs.
 */
export default function MedicalMatrixRain() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let width = 0;
    let height = 0;

    const colSpacing = 28; // Spacing between vertical matrix rain streams
    let columns = [];
    let heroItems = [];

    // Medical Matrix Glyphs (Pills, Medicines, Bags, and Minimal Telemetry)
    const matrixChars = [
      '💊', '⬭', 'Rx', '⚕', '✚', '0', '1', '·', 'mg', 'ml', '10', '01',
      '🛍️', '📦', '💼', '💉', '🧪', '🧬', '🩹', '🩺', '⬬', '++'
    ];

    // Floating Hero Items (Pills, Medicine Bags, Delivery Boxes, First Aid)
    const heroTypes = [
      { type: 'pill', emoji: '💊', size: 22 },
      { type: 'bag', emoji: '🛍️', size: 25 },
      { type: 'capsule', emoji: '💊', size: 20 },
      { type: 'firstaid', emoji: '💼', size: 23 },
      { type: 'parcel', emoji: '📦', size: 22 },
      { type: 'dna', emoji: '🧬', size: 21 },
      { type: 'syringe', emoji: '💉', size: 20 },
      { type: 'vial', emoji: '🧪', size: 21 },
      { type: 'vector_capsule', size: 24 }
    ];

    const initMatrixColumns = () => {
      const numCols = Math.floor(width / colSpacing) + 1;
      columns = [];
      for (let i = 0; i < numCols; i++) {
        columns.push({
          x: i * colSpacing + (colSpacing / 2),
          y: Math.random() * -120 - 20,
          speed: 0.9 + Math.random() * 1.5,
          length: 10 + Math.floor(Math.random() * 14),
          headChar: matrixChars[Math.floor(Math.random() * matrixChars.length)],
          tick: 0,
          changeInterval: 4 + Math.floor(Math.random() * 6),
          opacity: 0.2 + Math.random() * 0.4
        });
      }
    };

    const initHeroItems = () => {
      const count = Math.max(12, Math.floor(width / 95));
      heroItems = [];
      for (let i = 0; i < count; i++) {
        const itemType = heroTypes[Math.floor(Math.random() * heroTypes.length)];
        heroItems.push({
          x: Math.random() * width,
          y: Math.random() * height,
          speedY: 0.4 + Math.random() * 0.8,
          swayFreq: 0.008 + Math.random() * 0.015,
          swayAmp: 16 + Math.random() * 24,
          baseX: Math.random() * width,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.018,
          item: itemType,
          scale: 0.8 + Math.random() * 0.45,
          opacity: 0.22 + Math.random() * 0.38,
          seed: Math.random() * 1000
        });
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      initMatrixColumns();
      initHeroItems();
    };

    // Draw minimalist vector dual-tone capsule
    const drawVectorCapsule = (x, y, scale, angle, opacity) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.scale(scale, scale);
      ctx.globalAlpha = opacity;

      const w = 26;
      const h = 12;
      const r = h / 2;

      ctx.shadowColor = '#14b8a6';
      ctx.shadowBlur = 8;

      // Left half (Mint Teal)
      ctx.fillStyle = '#14b8a6';
      ctx.beginPath();
      ctx.moveTo(-w / 2 + r, -r);
      ctx.lineTo(0, -r);
      ctx.lineTo(0, r);
      ctx.lineTo(-w / 2 + r, r);
      ctx.arc(-w / 2 + r, 0, r, Math.PI / 2, (Math.PI * 3) / 2);
      ctx.closePath();
      ctx.fill();

      // Right half (Crisp White)
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(w / 2 - r, -r);
      ctx.arc(w / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(0, r);
      ctx.closePath();
      ctx.fill();

      // Divider line
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(0, r);
      ctx.stroke();

      ctx.restore();
    };

    resize();
    window.addEventListener('resize', resize);

    let frame = 0;

    const render = () => {
      frame++;

      // 1. Semi-transparent dark clear creates authentic Matrix trailing blur
      ctx.fillStyle = 'rgba(7, 10, 17, 0.16)';
      ctx.fillRect(0, 0, width, height);

      // 2. Draw Matrix Rain Streams
      ctx.font = '13px monospace';
      ctx.textAlign = 'center';

      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        col.tick++;

        if (col.tick % col.changeInterval === 0) {
          col.headChar = matrixChars[Math.floor(Math.random() * matrixChars.length)];
        }

        // Render stream characters
        for (let j = 0; j < col.length; j++) {
          const charY = col.y - j * 19;
          if (charY < -20 || charY > height + 20) continue;

          const progress = 1 - j / col.length;
          const alpha = progress * col.opacity;

          if (j === 0) {
            // Head of the stream - glowing mint neon
            ctx.shadowColor = '#5eead4';
            ctx.shadowBlur = 10;
            ctx.fillStyle = '#5eead4';
            ctx.globalAlpha = Math.min(0.95, col.opacity * 1.6);
            ctx.fillText(col.headChar, col.x, charY);
            ctx.shadowBlur = 0;
          } else {
            // Trailing characters fading down smoothly
            ctx.globalAlpha = Math.max(0.04, alpha);
            if (j % 3 === 0) {
              ctx.fillStyle = '#2dd4bf';
            } else if (j % 3 === 1) {
              ctx.fillStyle = '#14b8a6';
            } else {
              ctx.fillStyle = '#0f766e';
            }

            const charIdx = (i * 7 + j * 13 + Math.floor(frame / 6)) % matrixChars.length;
            const trailChar = matrixChars[charIdx];
            ctx.fillText(trailChar, col.x, charY);
          }
        }

        col.y += col.speed * 2.2;

        if (col.y - col.length * 19 > height) {
          col.y = -20 - Math.random() * 80;
          col.speed = 0.9 + Math.random() * 1.5;
          col.length = 10 + Math.floor(Math.random() * 14);
          col.opacity = 0.2 + Math.random() * 0.4;
        }
      }

      // 3. Draw Falling Hero Pills, Medicine Bags & First Aid Kits
      for (let k = 0; k < heroItems.length; k++) {
        const h = heroItems[k];
        h.y += h.speedY;
        h.rotation += h.rotSpeed;

        const sway = Math.sin(frame * h.swayFreq + h.seed) * h.swayAmp;
        const currentX = (h.baseX + sway + width) % width;

        if (h.item.type === 'vector_capsule') {
          drawVectorCapsule(currentX, h.y, h.scale, h.rotation, h.opacity);
        } else {
          ctx.save();
          ctx.translate(currentX, h.y);
          ctx.rotate(h.rotation);
          ctx.scale(h.scale, h.scale);
          ctx.globalAlpha = h.opacity;
          ctx.font = `${h.item.size}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          ctx.shadowColor = h.item.emoji === '💊' ? 'rgba(45, 212, 191, 0.45)' : 'rgba(16, 185, 129, 0.35)';
          ctx.shadowBlur = 8;
          ctx.fillText(h.item.emoji, 0, 0);
          ctx.restore();
        }

        if (h.y > height + 40) {
          h.y = -40;
          h.baseX = Math.random() * width;
          h.speedY = 0.4 + Math.random() * 0.8;
        }
      }

      ctx.globalAlpha = 1;
      animationFrameId = requestAnimationFrame(render);
    };

    // Initial background paint
    ctx.fillStyle = '#070a11';
    ctx.fillRect(0, 0, width, height);

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />
      {/* Subtle Matrix Ambient Glow & Vignette Overlay */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 1,
          background: 'radial-gradient(ellipse at 50% 45%, rgba(13, 148, 136, 0.08) 0%, rgba(7, 10, 17, 0.65) 65%, rgba(4, 7, 13, 0.92) 100%)'
        }}
      />
    </>
  );
}

