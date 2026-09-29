"use client";
import React, { useState, useEffect, useRef } from 'react';

// Live Web Audio Synthesizer for Cartoon Sound Effects (zero external files, 0 bytes)
class CartoonAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }
  
  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  // Cartoon "Boing" bounce sound
  playBoing() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.18);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.35);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.38);
    } catch (e) {}
  }

  // Cartoon "Whoosh / Pop"
  playPop() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {}
  }

  // Grand Fanfare Chime on Boot Completion
  playFanfare() {
    if (this.muted) return;
    try {
      this.init();
      if (!this.ctx) return;
      const notes = [440, 554.37, 659.25, 880]; // A major arpeggio
      notes.forEach((freq, idx) => {
        const now = this.ctx.currentTime + idx * 0.08;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.42);
      });
    } catch (e) {}
  }
}

const soundFx = new CartoonAudio();

export default function CartoonBootup({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(0); // 0: sky dive, 1: mascot bouncing, 2: drone arrives, 3: turbo rocket launch, 4: complete
  const [dialogue, setDialogue] = useState("Hi! I'm Capso! Let's get healthy! 🚀");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [mascotMood, setMascotMood] = useState('happy'); // 'happy', 'wink', 'surprised', 'super'
  const [clickCount, setClickCount] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  // Cartoon dialogue lines
  const funLines = [
    "Whoosh! 10-Minute Medicine Drops Active! ⚡",
    "Calibrating AI Prescription Scanner... 🔍",
    "Connecting Hyperlocal Dark-Stores! 🏥",
    "Vital Signs 100% Healthy & Happy! 💖",
    "Super-Capsules Ready For Launch! 💊✨"
  ];

  const handleMascotClick = () => {
    soundFx.playBoing();
    setClickCount(prev => prev + 1);
    setMascotMood(prev => prev === 'wink' ? 'super' : 'wink');
    const randomLine = funLines[Math.floor(Math.random() * funLines.length)];
    setDialogue(randomLine);
  };

  const toggleSound = () => {
    soundFx.muted = soundEnabled;
    setSoundEnabled(!soundEnabled);
  };

  const handleSkip = () => {
    setIsExiting(true);
    soundFx.playFanfare();
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 600);
  };

  useEffect(() => {
    // Play initial cartoon bounce sound
    const t0 = setTimeout(() => {
      soundFx.playBoing();
    }, 400);

    // Boot progress sequence (smooth ~3.2s)
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        const next = prev + 2.5;
        if (next > 30 && stage < 1) {
          setStage(1);
          setDialogue("Scanning nearby pharmacies within 3.5km... 📡");
          soundFx.playPop();
        }
        if (next > 65 && stage < 2) {
          setStage(2);
          setDialogue("Summoning express delivery drone fleet! 🛵💨");
          soundFx.playPop();
        }
        if (next >= 95 && stage < 3) {
          setStage(3);
          setDialogue("All systems GO! Welcome to MEDORA! ✨");
          soundFx.playFanfare();
        }
        return next;
      });
    }, 70);

    return () => {
      clearTimeout(t0);
      clearInterval(interval);
    };
  }, [stage]);

  useEffect(() => {
    if (progress >= 100) {
      const exitTimer = setTimeout(() => {
        handleSkip();
      }, 700);
      return () => clearTimeout(exitTimer);
    }
  }, [progress]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'linear-gradient(135deg, #04121a 0%, #06222e 45%, #073846 100%)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1.5rem',
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? 'scale(1.08)' : 'scale(1)',
        filter: isExiting ? 'blur(8px)' : 'none',
        transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        userSelect: 'none',
        fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif"
      }}
    >
      {/* Cartoon Background Animated Stars & Crosses */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {[...Array(24)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: `${(i * 19) % 95}%`,
              left: `${(i * 29) % 95}%`,
              color: i % 3 === 0 ? '#2dd4bf' : i % 2 === 0 ? '#38bdf8' : '#fbbf24',
              fontSize: `${0.8 + (i % 4) * 0.3}rem`,
              opacity: 0.6,
              animation: `cartoonFloat ${2.5 + (i % 3)}s ease-in-out infinite alternate`,
              animationDelay: `${(i * 0.15)}s`
            }}
          >
            {i % 4 === 0 ? '✨' : i % 4 === 1 ? '➕' : i % 4 === 2 ? '💖' : '⭐'}
          </div>
        ))}

        {/* Dynamic cartoon cloud puffs */}
        <div style={{
          position: 'absolute',
          bottom: '-40px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '120%',
          height: '140px',
          background: 'radial-gradient(ellipse at center, rgba(13, 148, 136, 0.25) 0%, transparent 70%)',
          filter: 'blur(30px)'
        }} />
      </div>

      {/* Top Header: Brand & Controls */}
      <div style={{
        width: '100%',
        maxWidth: '720px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10
      }}>
        {/* Animated Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(45, 212, 191, 0.3)',
          padding: '6px 14px',
          borderRadius: '99px',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 20px rgba(0, 242, 254, 0.15)'
        }}>
          <span style={{ fontSize: '0.9rem', animation: 'spinSlow 4s linear infinite', display: 'inline-block' }}>🧬</span>
          <span style={{
            fontSize: '0.78rem',
            fontWeight: '800',
            letterSpacing: '0.08em',
            background: 'linear-gradient(90deg, #b8f7e4, #38bdf8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textTransform: 'uppercase'
          }}>
            Medora Live Toon OS
          </span>
        </div>

        {/* Sound & Skip Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={toggleSound}
            title={soundEnabled ? "Mute audio" : "Unmute audio"}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              borderRadius: '50%',
              width: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'all 0.2s ease'
            }}
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>

          <button
            onClick={handleSkip}
            style={{
              background: 'linear-gradient(135deg, rgba(45, 212, 191, 0.25) 0%, rgba(56, 189, 248, 0.25) 100%)',
              border: '1px solid rgba(45, 212, 191, 0.6)',
              color: '#ffffff',
              padding: '6px 16px',
              borderRadius: '99px',
              fontSize: '0.82rem',
              fontWeight: '700',
              cursor: 'pointer',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(45, 212, 191, 0.2)'
            }}
          >
            <span>Skip</span>
            <span style={{ fontSize: '0.9rem' }}>⏩</span>
          </button>
        </div>
      </div>

      {/* Main Cartoon Stage: Capso & Droni */}
      <div style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        width: '100%',
        maxWidth: '500px',
        zIndex: 5
      }}>
        {/* Cartoon Speech Bubble */}
        <div
          onClick={handleMascotClick}
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            color: '#0f172a',
            padding: '10px 20px',
            borderRadius: '24px',
            fontSize: '0.92rem',
            fontWeight: '800',
            boxShadow: '0 12px 35px rgba(0, 0, 0, 0.3), 0 0 20px rgba(45, 212, 191, 0.4)',
            marginBottom: '1rem',
            position: 'relative',
            cursor: 'pointer',
            textAlign: 'center',
            maxWidth: '320px',
            animation: 'speechBubblePop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
            border: '2px solid #2dd4bf',
            transform: 'translateY(0)'
          }}
        >
          {dialogue}
          {/* Speech Bubble Arrow */}
          <div style={{
            position: 'absolute',
            bottom: '-10px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '10px solid transparent',
            borderRight: '10px solid transparent',
            borderTop: '10px solid rgba(255, 255, 255, 0.95)'
          }} />
        </div>

        {/* Mascot Interactive Wrapper with Cartoon Squash & Stretch */}
        <div
          onClick={handleMascotClick}
          title="Tap Capso!"
          style={{
            position: 'relative',
            cursor: 'pointer',
            animation: stage === 3 ? 'capsoRocketLaunch 0.8s ease-in forwards' : 'capsoLiveSquash 2.4s ease-in-out infinite',
            transformOrigin: 'bottom center',
            filter: 'drop-shadow(0 15px 30px rgba(13, 148, 136, 0.45))',
            transition: 'transform 0.15s ease'
          }}
        >
          {/* SVG Vector Mascot: CAPSO */}
          <svg
            width="220"
            height="260"
            viewBox="0 0 220 260"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ overflow: 'visible' }}
          >
            <defs>
              {/* Capso Teal Gradient */}
              <linearGradient id="capsoTeal" x1="40" y1="20" x2="180" y2="140" gradientUnits="userSpaceOnUse">
                <stop stopColor="#2dd4bf" />
                <stop offset="0.6" stopColor="#0d9488" />
                <stop offset="1" stopColor="#0f766e" />
              </linearGradient>

              {/* Capso Pearl Bottom */}
              <linearGradient id="capsoWhite" x1="40" y1="130" x2="180" y2="240" gradientUnits="userSpaceOnUse">
                <stop stopColor="#ffffff" />
                <stop offset="0.8" stopColor="#ccfbf1" />
                <stop offset="1" stopColor="#99f6e4" />
              </linearGradient>

              {/* Shiny Gloss Reflection */}
              <linearGradient id="capsoGloss" x1="60" y1="30" x2="60" y2="120" gradientUnits="userSpaceOnUse">
                <stop stopColor="#ffffff" stopOpacity="0.85" />
                <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>

              {/* Cape Gradient */}
              <linearGradient id="capsoCape" x1="140" y1="90" x2="210" y2="190" gradientUnits="userSpaceOnUse">
                <stop stopColor="#fbbf24" />
                <stop offset="1" stopColor="#f59e0b" />
              </linearGradient>
            </defs>

            {/* Fluttering Golden Superhero Cape */}
            <path
              d="M130 95 C170 110, 205 130, 200 175 C190 200, 160 185, 140 180 C125 175, 120 150, 125 110 Z"
              fill="url(#capsoCape)"
              style={{
                animation: 'capeFlutter 1.6s ease-in-out infinite alternate',
                transformOrigin: '125px 95px'
              }}
            />

            {/* Main Capsule Body */}
            {/* Top Half (Teal) */}
            <path
              d="M 50 120 L 50 75 C 50 35, 170 35, 170 75 L 170 120 Z"
              fill="url(#capsoTeal)"
            />

            {/* Bottom Half (Pearl Mint) */}
            <path
              d="M 50 120 L 50 165 C 50 205, 170 205, 170 165 L 170 120 Z"
              fill="url(#capsoWhite)"
            />

            {/* Center Waist Ring */}
            <rect x="47" y="116" width="126" height="8" rx="4" fill="#042f2e" opacity="0.3" />

            {/* Glossy Curved Highlight */}
            <path
              d="M 65 55 C 65 42, 90 40, 110 40 C 95 48, 80 65, 75 90 C 72 105, 68 115, 65 115 Z"
              fill="url(#capsoGloss)"
            />

            {/* Expressive Cartoon Eyes */}
            {mascotMood === 'wink' ? (
              <>
                {/* Left Eye: Big Open Star */}
                <ellipse cx="85" cy="90" rx="16" ry="19" fill="#0f172a" />
                <circle cx="81" cy="85" r="7" fill="#ffffff" />
                <circle cx="92" cy="97" r="3.5" fill="#ffffff" />
                {/* Star sparkle in left eye */}
                <path d="M85 76 L87 80 L91 80 L88 83 L89 87 L85 84 L81 87 L82 83 L79 80 L83 80 Z" fill="#38bdf8" />

                {/* Right Eye: Playful Winking Arch */}
                <path
                  d="M 122 92 Q 135 80 148 92"
                  stroke="#0f172a"
                  strokeWidth="5"
                  strokeLinecap="round"
                  fill="none"
                />
              </>
            ) : (
              <>
                {/* Both Big Anime Cartoon Eyes */}
                {/* Left Eye */}
                <g style={{ animation: 'cartoonBlink 3.6s infinite' }}>
                  <ellipse cx="85" cy="90" rx="16" ry="19" fill="#0f172a" />
                  <ellipse cx="85" cy="90" rx="14" ry="17" fill="#042f2e" />
                  <circle cx="80" cy="84" r="7" fill="#ffffff" />
                  <circle cx="92" cy="96" r="3.5" fill="#ffffff" />
                  <path d="M86 86 Q88 89 88 92" stroke="#2dd4bf" strokeWidth="2.5" strokeLinecap="round" />
                </g>

                {/* Right Eye */}
                <g style={{ animation: 'cartoonBlink 3.6s infinite' }}>
                  <ellipse cx="135" cy="90" rx="16" ry="19" fill="#0f172a" />
                  <ellipse cx="135" cy="90" rx="14" ry="17" fill="#042f2e" />
                  <circle cx="130" cy="84" r="7" fill="#ffffff" />
                  <circle cx="142" cy="96" r="3.5" fill="#ffffff" />
                  <path d="M136 86 Q138 89 138 92" stroke="#2dd4bf" strokeWidth="2.5" strokeLinecap="round" />
                </g>
              </>
            )}

            {/* Cute Rosy Blushing Cheeks */}
            <ellipse cx="68" cy="106" rx="10" ry="6" fill="#f43f5e" opacity="0.55" />
            <ellipse cx="152" cy="106" rx="10" ry="6" fill="#f43f5e" opacity="0.55" />

            {/* Cartoon Happy Mouth */}
            <path
              d="M 98 106 Q 110 124 122 106"
              stroke="#0f172a"
              strokeWidth="4"
              strokeLinecap="round"
              fill="#ef4444"
            />
            {/* Cute White Tooth */}
            <path d="M 104 107 Q 110 114 116 107 Z" fill="#ffffff" />

            {/* Doctor Stethoscope accessory */}
            <path
              d="M 72 118 C 70 145, 95 160, 110 160 C 125 160, 150 145, 148 118"
              stroke="#38bdf8"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
            {/* Stethoscope glowing heart chestpiece */}
            <circle cx="110" cy="160" r="10" fill="#0d9488" stroke="#ffffff" strokeWidth="2.5" />
            <path
              d="M 106 160 L 109 157 C 111 155, 113 158, 110 162 C 107 158, 109 155, 111 157 Z"
              fill="#fbbf24"
            />

            {/* Cartoon Gloved Little Hands Waving */}
            {/* Left Arm waving */}
            <g style={{ animation: 'leftHandWave 1.4s ease-in-out infinite alternate', transformOrigin: '48px 125px' }}>
              <path d="M 50 125 Q 30 115 22 95" stroke="#0d9488" strokeWidth="6" strokeLinecap="round" fill="none" />
              <circle cx="20" cy="92" r="11" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
              <circle cx="16" cy="85" r="4.5" fill="#ffffff" />
            </g>

            {/* Right Arm */}
            <g style={{ animation: 'rightHandWave 1.8s ease-in-out infinite alternate', transformOrigin: '170px 125px' }}>
              <path d="M 170 125 Q 190 120 200 105" stroke="#0d9488" strokeWidth="6" strokeLinecap="round" fill="none" />
              <circle cx="202" cy="102" r="11" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
              <circle cx="206" cy="95" r="4.5" fill="#ffffff" />
            </g>

            {/* Bouncy Shadow Cloud Beneath */}
            <ellipse
              cx="110"
              cy="235"
              rx="65"
              ry="14"
              fill="rgba(0, 0, 0, 0.35)"
              filter="blur(5px)"
              style={{
                animation: 'shadowScale 2.4s ease-in-out infinite',
                transformOrigin: 'center'
              }}
            />
          </svg>

          {/* Droni - Cute Flying Companion Drone */}
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-45px',
            animation: 'droneOrbit 3s ease-in-out infinite alternate',
            transformOrigin: 'center'
          }}>
            <svg width="80" height="70" viewBox="0 0 80 70" fill="none">
              {/* Spinning Propellers */}
              <ellipse cx="22" cy="18" rx="18" ry="3" fill="#38bdf8" opacity="0.7" style={{ animation: 'propellerSpin 0.15s linear infinite' }} />
              <ellipse cx="58" cy="18" rx="18" ry="3" fill="#38bdf8" opacity="0.7" style={{ animation: 'propellerSpin 0.15s linear infinite' }} />

              {/* Drone Body */}
              <rect x="24" y="22" width="32" height="22" rx="11" fill="#0f172a" stroke="#2dd4bf" strokeWidth="2" />
              {/* Cyan Visor LED Eye */}
              <rect x="29" y="27" width="22" height="8" rx="4" fill="#2dd4bf" />
              <circle cx="36" cy="31" r="2.5" fill="#ffffff" />

              {/* Drone Tiny First-Aid Box Hanging */}
              <rect x="33" y="46" width="14" height="14" rx="3" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
              <path d="M 40 49 L 40 57 M 36 53 L 44 53" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Mascot Tap Prompt */}
        <div style={{
          marginTop: '0.8rem',
          fontSize: '0.78rem',
          color: 'rgba(255, 255, 255, 0.6)',
          letterSpacing: '0.04em',
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '4px 12px',
          borderRadius: '99px',
          border: '1px dashed rgba(255, 255, 255, 0.2)'
        }}>
          💡 Tap Capso for cartoon tricks! ({clickCount} boings)
        </div>
      </div>

      {/* Bottom Control & High-Tech Progress HUD */}
      <div style={{
        width: '100%',
        maxWidth: '560px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.9rem',
        zIndex: 10
      }}>
        {/* Animated Medora Logo Reveal */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ fontSize: '1.8rem', filter: 'drop-shadow(0 0 12px #2dd4bf)' }}>🧬</span>
          <h2 style={{
            fontSize: '2.4rem',
            margin: 0,
            fontWeight: '900',
            letterSpacing: '-0.03em',
            background: 'linear-gradient(135deg, #ffffff 0%, #b8f7e4 60%, #38bdf8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 0 30px rgba(45, 212, 191, 0.5)'
          }}>
            MEDORA
          </h2>
        </div>

        {/* Heartbeat EKG Neon Pulse Line */}
        <div style={{ width: '100%', height: '24px', position: 'relative', overflow: 'hidden' }}>
          <svg width="100%" height="24" viewBox="0 0 400 24" preserveAspectRatio="none">
            <path
              d="M 0 12 L 140 12 L 155 3 L 165 21 L 175 6 L 185 18 L 195 12 L 400 12"
              fill="none"
              stroke="#2dd4bf"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                strokeDasharray: '400',
                strokeDashoffset: '400',
                animation: 'ekgLineAnim 2s linear infinite'
              }}
            />
          </svg>
        </div>

        {/* Progress Bar with Turbo Energy Glow */}
        <div style={{ width: '100%', position: 'relative' }}>
          <div style={{
            width: '100%',
            height: '10px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '99px',
            overflow: 'hidden',
            border: '1px solid rgba(45, 212, 191, 0.25)',
            boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, progress)}%`,
              background: 'linear-gradient(90deg, #0d9488 0%, #2dd4bf 50%, #38bdf8 100%)',
              borderRadius: '99px',
              transition: 'width 0.1s linear',
              boxShadow: '0 0 18px rgba(45, 212, 191, 0.8)'
            }} />
          </div>

          {/* Progress Percent Pill */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '6px',
            fontSize: '0.78rem',
            color: 'rgba(255, 255, 255, 0.75)',
            fontWeight: '600'
          }}>
            <span>⚡ Express Diagnostic Boot</span>
            <span style={{ color: '#2dd4bf', fontWeight: '800' }}>{Math.floor(progress)}%</span>
          </div>
        </div>
      </div>

      {/* Embedded Cartoon Keyframe Animations */}
      <style jsx>{`
        @keyframes capsoLiveSquash {
          0% { transform: translateY(0) scale(1, 1); }
          30% { transform: translateY(-24px) scale(0.92, 1.1); }
          50% { transform: translateY(0) scale(1.14, 0.86); }
          65% { transform: translateY(-8px) scale(0.98, 1.03); }
          80% { transform: translateY(0) scale(1.04, 0.96); }
          100% { transform: translateY(0) scale(1, 1); }
        }

        @keyframes capsoRocketLaunch {
          0% { transform: scale(1.1, 0.9) translateY(0); }
          30% { transform: scale(0.85, 1.25) translateY(20px); }
          100% { transform: scale(0.7, 1.4) translateY(-800px); opacity: 0; }
        }

        @keyframes shadowScale {
          0% { transform: scale(1); opacity: 0.35; }
          30% { transform: scale(0.65); opacity: 0.15; }
          50% { transform: scale(1.2); opacity: 0.45; }
          100% { transform: scale(1); opacity: 0.35; }
        }

        @keyframes capeFlutter {
          0% { transform: rotate(0deg) skewX(0deg); }
          100% { transform: rotate(-8deg) skewX(-10deg); }
        }

        @keyframes cartoonBlink {
          0%, 94%, 100% { transform: scaleY(1); }
          97% { transform: scaleY(0.08); }
        }

        @keyframes leftHandWave {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(26deg); }
        }

        @keyframes rightHandWave {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(-22deg); }
        }

        @keyframes droneOrbit {
          0% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(-15px, -18px) rotate(-6deg); }
          100% { transform: translate(12px, -8px) rotate(8deg); }
        }

        @keyframes propellerSpin {
          0% { transform: scaleX(1); }
          50% { transform: scaleX(0.1); }
          100% { transform: scaleX(1); }
        }

        @keyframes cartoonFloat {
          0% { transform: translateY(0) rotate(0deg); }
          100% { transform: translateY(-16px) rotate(15deg); }
        }

        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes speechBubblePop {
          0% { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes ekgLineAnim {
          0% { stroke-dashoffset: 400; }
          100% { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}
