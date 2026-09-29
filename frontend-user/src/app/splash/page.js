"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import s from "./splash.module.css";

/* ═══════════════════════════════════════════════════════
   MEDORA — Space-Triggered Presentation & 3D Showcase
   Critically Damped Spring Physics with Zero Frame-Jank
   ═══════════════════════════════════════════════════════ */

const TOTAL_FRAMES = 480;
const CDN_BASE = (process.env.NEXT_PUBLIC_ANIMATION_CDN_URL || "").replace(/\/$/, "");
const getFrameUrl = (frameNum) => {
  const pad = String(frameNum).padStart(5, "0");
  return CDN_BASE ? `${CDN_BASE}/${pad}.png` : `/Animation/${pad}.png`;
};

// The 6 core feature stops ("textual content places") mapped to their focal frame
const STOPS = [
  {
    id: "emergency",
    icon: "🚨",
    title: "Emergency Assistant",
    desc: "Critical care medications bypassed to top priority. Connects users immediately to nearby emergency coordinators with zero dispatch friction.",
    tags: ["Panic Dispatch Queue", "Direct Support Line", "Fast-lane Shipping"],
    targetFrame: 155,
    frameRange: [120, 185],
    positionClass: s.emergency,
    chipLabel: "🚨 Emergency",
    stepNum: 1,
  },
  {
    id: "location",
    icon: "📍",
    title: "Location Intelligence",
    desc: "PostGIS-powered routing tracks client proximity, locates nearest partner pharmacies, and automates optimal rider-delivery dispatching.",
    tags: ["Auto-Location", "PostGIS Routing", "Proximity Check"],
    targetFrame: 215,
    frameRange: [195, 245],
    positionClass: s.location,
    chipLabel: "📍 Radar",
    stepNum: 2,
  },
  {
    id: "delivery",
    icon: "⚡",
    title: "Smart Delivery Routing",
    desc: "Rider routes optimized using live traffic metrics. Real-time updates push live tracker coordinate changes to customers in under 50ms.",
    tags: ["Live GPX Tracking", "ETA Math", "Rider App Integration"],
    targetFrame: 280,
    frameRange: [255, 305],
    positionClass: s.delivery,
    chipLabel: "⚡ 10m Delivery",
    stepNum: 3,
  },
  {
    id: "ocr",
    icon: "🔍",
    title: "OCR Intelligence",
    desc: "Scan handwritten or printed doctor prescriptions. A dual client-side Tesseract.js and AI pipeline extracts compound names and dosages.",
    tags: ["99.8% Accuracy", "Client-Server Parse", "One-Click Cart"],
    targetFrame: 350,
    frameRange: [325, 370],
    positionClass: s.ocr,
    chipLabel: "🔍 OCR Scan",
    stepNum: 4,
  },
  {
    id: "availability",
    icon: "💊",
    title: "Medicine Availability",
    desc: "Live inventory scanning for tablets, capsules, and syrups. Instantly queries supplier dark-store nodes in real-time across your city perimeter.",
    tags: ["Real-time Stock", "Bottle & Capsule Counting", "Alternate Suggestions"],
    targetFrame: 400,
    frameRange: [375, 420],
    positionClass: s.availability,
    chipLabel: "💊 Live Stock",
    stepNum: 5,
  },
  {
    id: "prescription",
    icon: "🤖",
    title: "AI Clinical Pharmacist",
    desc: "Gemini 3.1 Flash LLMs cross-reference symptoms, extracted compounds against allergic profiles, and provide verified dosage safety recommendations.",
    tags: ["Gemini 3.1 Flash", "Allergy Protection", "Dosage Safety"],
    targetFrame: 450,
    frameRange: [425, 478],
    positionClass: s.prescription,
    chipLabel: "🤖 AI Doctor",
    stepNum: 6,
  },
];

// Initial keyframes to preload before start
const initialIndices = [1, 15, 30, 50, 75, 100, 125, 140, 155];

export default function SplashScreen() {
  const canvasRef = useRef(null);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Presentation State
  const [showStartModal, setShowStartModal] = useState(true);
  const [showFinaleModal, setShowFinaleModal] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(1);
  const [activeStopIndex, setActiveStopIndex] = useState(-1); // -1 = initial, 0..5 = stops, 6 = finale
  const [isWaitingForSpace, setIsWaitingForSpace] = useState(false);
  const [isGliding, setIsGliding] = useState(false);

  // Performance caches
  const imageCacheRef = useRef(new Map());
  const currentFrameRef = useRef(1);
  const lastDrawnFrameRef = useRef(-1);
  const loadingImagesRef = useRef(new Set());

  // ═══════════════════════════════════════════════════════════
  // CRITICALLY DAMPED SPRING PHYSICS ENGINE REFS
  // Mathematical Formulation: x''(t) + 2*zeta*omega*x'(t) + omega^2*(x - target) = 0
  // zeta = 1.0 (Critically Damped: zero oscillation, smooth deceleration)
  // omega = 3.6 (Natural angular frequency: cinematic fluid travel)
  // ═══════════════════════════════════════════════════════════
  const currentFrameFloatRef = useRef(1.0);
  const targetFrameRef = useRef(1.0);
  const velocityRef = useRef(0.0);
  const animFrameIdRef = useRef(null);
  const lastTimestampRef = useRef(null);

  const OMEGA = 3.6; // Frequency
  const ZETA = 1.0;  // Critical Damping Ratio

  // Helper to store image in memory cache
  const setCachedImage = useCallback((frameNum, img) => {
    imageCacheRef.current.set(frameNum, img);
  }, []);

  // Frame Drawer logic
  const drawFrame = useCallback((frameNum) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let img = imageCacheRef.current.get(frameNum);
    if (!img) {
      // Find nearest cached frame
      let nearest = null;
      let minDiff = Infinity;
      for (const [k, v] of imageCacheRef.current.entries()) {
        const diff = Math.abs(frameNum - k);
        if (diff < minDiff) {
          minDiff = diff;
          nearest = v;
        }
      }
      img = nearest;

      // Lazy fetch missing frame
      if (!loadingImagesRef.current.has(frameNum)) {
        loadingImagesRef.current.add(frameNum);
        const lazyImg = new Image();
        lazyImg.src = getFrameUrl(frameNum);
        lazyImg.onload = () => {
          setCachedImage(frameNum, lazyImg);
          loadingImagesRef.current.delete(frameNum);
          if (currentFrameRef.current === frameNum) {
            drawFrame(frameNum);
          }
        };
        lazyImg.onerror = () => {
          loadingImagesRef.current.delete(frameNum);
        };
      }
    }

    const width = canvas.width;
    const height = canvas.height;

    if (img) {
      const hRatio = width / img.width;
      const vRatio = height / img.height;
      const ratio = Math.min(hRatio, vRatio) * 1.05;
      const centerShift_x = (width - img.width * ratio) / 2;
      const centerShift_y = (height - img.height * ratio) / 2;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "medium";

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(
        img,
        0, 0, img.width, img.height,
        centerShift_x, centerShift_y, img.width * ratio, img.height * ratio
      );
    } else {
      // Sleek fallback ambient graphics when frames are offline/loading
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * 0.25;

      const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius * 1.6);
      grad.addColorStop(0, "rgba(0, 242, 254, 0.22)");
      grad.addColorStop(0.6, "rgba(79, 172, 254, 0.06)");
      grad.addColorStop(1, "rgba(10, 15, 30, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.6, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(0, 242, 254, 0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = "rgba(0, 242, 254, 0.2)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([10, 14]);
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.72, frameNum * 0.05, frameNum * 0.05 + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [setCachedImage]);

  // Preload a specific range of frames into RAM in advance
  const preloadSegment = useCallback((fromF, toF) => {
    const start = Math.max(1, Math.min(TOTAL_FRAMES, fromF));
    const end = Math.max(1, Math.min(TOTAL_FRAMES, toF));
    for (let f = start; f <= end; f++) {
      if (!imageCacheRef.current.has(f) && !loadingImagesRef.current.has(f)) {
        loadingImagesRef.current.add(f);
        const img = new Image();
        img.src = getFrameUrl(f);
        img.onload = () => {
          setCachedImage(f, img);
          loadingImagesRef.current.delete(f);
          if (currentFrameRef.current === f) drawFrame(f);
        };
        img.onerror = () => loadingImagesRef.current.delete(f);
      }
    }
  }, [setCachedImage, drawFrame]);

  // Canvas Resizer
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    const width = parent.clientWidth;
    const height = parent.clientHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    lastDrawnFrameRef.current = -1;
    drawFrame(currentFrameRef.current);
  }, [drawFrame]);

  // Initial Preloading
  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Failsafe timeout to unlock UI even if frame network fails
    const failsafe = setTimeout(() => {
      setLoading(false);
      drawFrame(1);
    }, 2500);

    const img1 = new Image();
    img1.src = getFrameUrl(1);
    img1.onload = () => {
      setCachedImage(1, img1);
      drawFrame(1);

      let loadedCount = 0;
      const totalToLoad = initialIndices.length;

      initialIndices.forEach((frameNum) => {
        if (frameNum === 1) {
          loadedCount++;
          setLoadingProgress(Math.round((loadedCount / totalToLoad) * 100));
          if (loadedCount === totalToLoad) {
            clearTimeout(failsafe);
            setTimeout(() => setLoading(false), 200);
          }
          return;
        }

        const img = new Image();
        img.src = getFrameUrl(frameNum);
        img.onload = () => {
          setCachedImage(frameNum, img);
          loadedCount++;
          setLoadingProgress(Math.round((loadedCount / totalToLoad) * 100));
          if (loadedCount === totalToLoad) {
            clearTimeout(failsafe);
            setTimeout(() => setLoading(false), 200);
          }
        };
        img.onerror = () => {
          loadedCount++;
          setLoadingProgress(Math.round((loadedCount / totalToLoad) * 100));
          if (loadedCount === totalToLoad) {
            clearTimeout(failsafe);
            setTimeout(() => setLoading(false), 200);
          }
        };
      });
    };
    img1.onerror = () => {
      clearTimeout(failsafe);
      setLoading(false);
      drawFrame(1);
    };

    return () => {
      clearTimeout(failsafe);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [resizeCanvas, drawFrame, setCachedImage]);

  // Update canvas to a specific integer frame cleanly
  const jumpToFrame = useCallback((frameNum) => {
    const bounded = Math.max(1, Math.min(TOTAL_FRAMES, Math.round(frameNum)));
    currentFrameRef.current = bounded;
    setCurrentFrame(bounded);
    if (lastDrawnFrameRef.current !== bounded) {
      drawFrame(bounded);
      lastDrawnFrameRef.current = bounded;
    }
  }, [drawFrame]);

  const idleStartTimestampRef = useRef(null);

  // ═══════════════════════════════════════════════════════════
  // ANIMATION LOOP: Spring Glide + Ambient Background Motion
  // (Background keeps moving smoothly while text card stays still)
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    const tick = (timestamp) => {
      if (!lastTimestampRef.current) lastTimestampRef.current = timestamp;
      const dt = Math.min((timestamp - lastTimestampRef.current) / 1000, 0.035);
      lastTimestampRef.current = timestamp;

      if (isGliding) {
        // ─── STATE A: SPRING GLIDE TO NEXT STOP ───
        idleStartTimestampRef.current = null;
        const current = currentFrameFloatRef.current;
        const target = targetFrameRef.current;
        const displacement = current - target;

        // 2nd Order ODE: Spring Force + Critical Damping Force
        const springForce = -OMEGA * OMEGA * displacement;
        const dampingForce = -2 * ZETA * OMEGA * velocityRef.current;
        const accel = springForce + dampingForce;

        velocityRef.current += accel * dt;
        currentFrameFloatRef.current += velocityRef.current * dt;

        // Arrival threshold: softly cushion and lock onto target frame
        if (Math.abs(currentFrameFloatRef.current - target) < 0.35 && Math.abs(velocityRef.current) < 1.2) {
          currentFrameFloatRef.current = target;
          velocityRef.current = 0.0;
          jumpToFrame(target);
          setIsGliding(false);

          // Check if we arrived at finale
          if (target >= TOTAL_FRAMES) {
            setShowFinaleModal(true);
            setIsWaitingForSpace(false);
          } else {
            setIsWaitingForSpace(true);
            idleStartTimestampRef.current = timestamp;
          }
        } else {
          jumpToFrame(currentFrameFloatRef.current);
        }
      } else if (isWaitingForSpace && activeStopIndex >= 0 && activeStopIndex < STOPS.length) {
        // ─── STATE B: CONTINUOUS 3D BACKGROUND MOTION (Text stays 100% still) ───
        if (!idleStartTimestampRef.current) idleStartTimestampRef.current = timestamp;
        const elapsed = (timestamp - idleStartTimestampRef.current) / 1000;

        const baseTarget = STOPS[activeStopIndex].targetFrame;
        // Subtle sinusoidal camera float: +/- 6 frames, 6-second fluid cycle
        const idleAmplitude = 6.0;
        const idleSpeed = 1.05;
        const idleOffset = Math.sin(elapsed * idleSpeed) * idleAmplitude;
        const idleFrame = Math.min(TOTAL_FRAMES, Math.max(1, Math.round(baseTarget + idleOffset)));

        jumpToFrame(idleFrame);
        currentFrameFloatRef.current = baseTarget + idleOffset;
      }

      animFrameIdRef.current = requestAnimationFrame(tick);
    };

    animFrameIdRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [isGliding, isWaitingForSpace, activeStopIndex, jumpToFrame]);

  // ═══════════════════════════════════════════════════════════
  // TRANSITION DRIVER: Smoothly glide forward to specified stop
  // ═══════════════════════════════════════════════════════════
  const glideToStop = useCallback((stopIndex) => {
    if (stopIndex < 0) return;

    if (stopIndex < STOPS.length) {
      const stop = STOPS[stopIndex];
      setActiveStopIndex(stopIndex);
      targetFrameRef.current = stop.targetFrame;
      setIsWaitingForSpace(false);
      setIsGliding(true);

      // Preload next upcoming segment during this transit
      const nextTarget = stopIndex + 1 < STOPS.length ? STOPS[stopIndex + 1].targetFrame : TOTAL_FRAMES;
      preloadSegment(stop.targetFrame, nextTarget);
    } else {
      // Reached finale
      setActiveStopIndex(STOPS.length);
      targetFrameRef.current = TOTAL_FRAMES;
      setIsWaitingForSpace(false);
      setIsGliding(true);
    }
  }, [preloadSegment]);

  // Advance to next stop
  const advanceToNext = useCallback(() => {
    if (showStartModal) {
      setShowStartModal(false);
      glideToStop(0); // Start -> glide to Emergency Assistant (Pillar 1)
      return;
    }

    if (showFinaleModal) {
      window.location.href = "/";
      return;
    }

    const nextIndex = activeStopIndex + 1;
    glideToStop(nextIndex);
  }, [showStartModal, showFinaleModal, activeStopIndex, glideToStop]);

  // Retreat to previous stop
  const retreatToPrev = useCallback(() => {
    if (activeStopIndex > 0) {
      glideToStop(activeStopIndex - 1);
    }
  }, [activeStopIndex, glideToStop]);

  // ═══════════════════════════════════════════════════════════
  // KEYBOARD TRIGGER: Space, ArrowRight, Enter
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space" || e.code === "Enter" || e.code === "ArrowRight") {
        e.preventDefault();
        advanceToNext();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        retreatToPrev();
      } else if (e.code === "Escape") {
        window.location.href = "/";
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [advanceToNext, retreatToPrev]);

  const handleEnterApp = () => {
    window.location.href = "/";
  };

  // Identify active feature for the current display
  const activeFeature = activeStopIndex >= 0 && activeStopIndex < STOPS.length ? STOPS[activeStopIndex] : null;

  return (
    <div className={s.splashRoot}>
      {/* ─── SKIP TO STORE BUTTON ─── */}
      {!loading && !showFinaleModal && (
        <button
          onClick={handleEnterApp}
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(13, 148, 136, 0.25)',
            color: '#0d9488',
            padding: '8px 18px',
            borderRadius: '99px',
            fontWeight: '700',
            fontSize: '0.82rem',
            cursor: 'pointer',
            zIndex: 500,
            boxShadow: '0 4px 14px rgba(15, 23, 42, 0.08)',
            transition: 'all 0.2s ease'
          }}
          title="Skip to Pharmacy Store (Esc)"
        >
          Skip to Store ➔
        </button>
      )}

      {/* ─── 3D VIEWPORT CANVAS ─── */}
      <main className={s.viewportContainer}>
        <div className={s.canvasContainer}>
          <canvas ref={canvasRef} />
        </div>
        <div className={s.heroOverlay} />

        {/* ─── ACTIVE FEATURE CARD (Holds waiting for Space) ─── */}
        {activeFeature && (
          <div className={s.featureOverlayWrapper}>
            <div
              key={activeFeature.id}
              className={`${s.featureCard} ${activeFeature.positionClass}`}
            >
              <div className={s.cardHeaderRow}>
                <div className={s.featureIconBox}>{activeFeature.icon}</div>
                <span className={s.slidePill}>Pillar {activeFeature.stepNum} of 6</span>
              </div>
              <h2 className={s.featureTitle}>{activeFeature.title}</h2>
              <p className={s.featureDesc}>{activeFeature.desc}</p>
              <ul className={s.bulletPoints}>
                {activeFeature.tags.map((tag) => (
                  <li key={tag}>
                    <span className={s.bulletDot} />
                    <span>{tag}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </main>

      {/* ─── 6 Step Indicators (Progress Dots) ─── */}
      {!loading && !showStartModal && !showFinaleModal && (
        <div className={s.spaceTriggerContainer}>
          <div className={s.spaceStepIndicators}>
            {STOPS.map((stop, idx) => {
              const isCurrent = idx === activeStopIndex;
              const isPassed = idx < activeStopIndex;
              return (
                <div
                  key={stop.id}
                  className={`${s.stepDot} ${isCurrent ? s.stepDotActive : isPassed ? s.stepDotPassed : ""}`}
                  title={`${stop.stepNum}. ${stop.title}`}
                  onClick={() => glideToStop(idx)}
                  style={{ cursor: 'pointer' }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ─── START PRESENTATION MODAL ─── */}
      {showStartModal && !loading && (
        <div className={s.startOverlay}>
          <div className={s.startCard}>
            <span className={s.startBadge}>⚡ Next-Gen AI Pharmacy</span>
            <h1 className={s.startTitle}>Experience MEDORA in Motion</h1>
            <p className={s.startSubtitle}>
              Walk through the 6 pillars of MEDORA at your own pace. The showcase glides to each feature and waits for you to press Space.
            </p>

            <div className={s.startFeatureList}>
              <div className={s.startFeatureItem}>🚨 Emergency Assistant</div>
              <div className={s.startFeatureItem}>📍 PostGIS Radar</div>
              <div className={s.startFeatureItem}>⚡ 10-Min Dispatch</div>
              <div className={s.startFeatureItem}>🔍 Dual OCR Scan</div>
              <div className={s.startFeatureItem}>💊 Dark-Store Sync</div>
              <div className={s.startFeatureItem}>🤖 Gemini 3.1 Doctor</div>
            </div>

            <div className={s.startActionGroup}>
              <button className={s.startBtnPrimary} onClick={advanceToNext}>
                <span className={s.spaceKeyBadge} style={{ background: '#ffffff', color: '#0d9488' }}>SPACE ␣</span>
                <span>Start Experience</span>
              </button>

              <button className={s.startBtnSecondary} onClick={handleEnterApp}>
                <span>Skip Directly to Store</span>
                <span>➔</span>
              </button>
            </div>

            <p className={s.keyboardHint}>Space-triggered · Holds at each feature · Space moves on</p>
          </div>
        </div>
      )}

      {/* ─── FINALE CELEBRATION MODAL ─── */}
      {showFinaleModal && (
        <div className={s.finaleOverlay}>
          <div className={s.finaleCard}>
            <span className={s.finaleIcon}>🎉</span>
            <h2 className={s.finaleTitle}>Showcase Complete</h2>
            <p className={s.finaleSubtitle}>
              You have experienced all 6 pillars of MEDORA. Order essentials with sub-10 minute delivery or explore the AI pharmacist.
            </p>

            <div className={s.finaleActionRow}>
              <button className={s.startBtnPrimary} onClick={handleEnterApp}>
                <span>🚀</span>
                <span>Launch MEDORA Pharmacy</span>
                <span className={s.spaceKeyBadge} style={{ background: 'rgba(255,255,255,0.25)', marginLeft: '8px' }}>SPACE ␣</span>
              </button>
              <button
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  padding: '8px',
                  textDecoration: 'underline'
                }}
                onClick={() => {
                  setShowFinaleModal(false);
                  glideToStop(0);
                }}
              >
                ↺ Replay Experience
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── PRELOADER ─── */}
      {loading && (
        <div className={s.preloader}>
          <div className={s.preloaderContent}>
            <div className={s.preloaderRing}>
              <div className={s.preloaderCapsule}>💊</div>
            </div>
            <h2 className={s.preloaderTitle}>MEDORA</h2>
            <p className={s.preloaderSubtitle}>Preparing interactive showcase frames...</p>
            <div className={s.progressBarTrack}>
              <div className={s.progressBarFill} style={{ width: `${loadingProgress}%` }} />
            </div>
            <span className={s.progressText}>{loadingProgress}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
