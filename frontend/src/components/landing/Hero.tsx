'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Compass, Layers, Box } from 'lucide-react';

interface HeroProps {
  onLaunchDesigner: () => void;
  onExplorePackages: () => void;
  onExploreTiles?: () => void;
  onBrowseProducts?: () => void;
}

interface Slide {
  id: number;
  tag: string;
  tagIcon: React.ReactNode;
  heading: React.ReactNode;
  description: string;
  bg: string; // fallback gradient while no image is set
  imageUrl: string | null; // set to null = placeholder, user will replace later
  btn1Label: string;
  btn1Action: () => void;
  btn2Label: string;
  btn2Action: () => void;
}

const AUTO_SLIDE_INTERVAL = 6000; // 6 seconds

export const Hero: React.FC<HeroProps> = ({
  onLaunchDesigner,
  onExplorePackages,
  onExploreTiles,
  onBrowseProducts,
}) => {
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const slides: Slide[] = [
    // ── SLIDE 1 — Main brand hero (existing) ──────────────────────────────
    {
      id: 0,
      tag: 'VIRTUAL SHOWROOM EXPERIENCE',
      tagIcon: <Compass size={11} />,
      heading: (
        <>
          Design Your Perfect Space,{' '}
          <br />
          <span className="font-semibold text-white">Before You Build It.</span>
        </>
      ),
      description:
        "Explore premium tiles, bathware, and accessories with TileVista's interactive 3D design experience. Visualize your ideas, compare products, and create spaces that match your style with confidence.",
      bg: 'from-[#1A1A1A] via-[#2a2520] to-[#1A1A1A]',
      imageUrl: '/images/hero/slide1.jpg',
      btn1Label: 'BROWSE PRODUCTS',
      btn1Action: onBrowseProducts ?? (() => {}),
      btn2Label: 'EXPLORE PACKAGES',
      btn2Action: onExplorePackages,
    },

    // ── SLIDE 2 — Tile Collections ─────────────────────────────────────────
    {
      id: 1,
      tag: 'PREMIUM TILE COLLECTIONS',
      tagIcon: <Layers size={11} />,
      heading: (
        <>
          Discover Tiles That{' '}
          <br />
          <span className="font-semibold text-white">Define Every Space.</span>
        </>
      ),
      description:
        'Explore our extensive collection of wall tiles, floor tiles, outdoor tiles, and mosaic designs. Find the perfect combination of style, texture, and durability to transform any interior or exterior space.',
      bg: 'from-[#1A1A1A] via-[#201c18] to-[#2a2015]',
      imageUrl: '/images/hero/slide2.jpg',
      btn1Label: 'EXPLORE TILE COLLECTIONS',
      btn1Action: onExploreTiles ?? (() => {}),
      btn2Label: 'BROWSE ALL PRODUCTS',
      btn2Action: onBrowseProducts ?? (() => {}),
    },

    // ── SLIDE 3 — 3D Designer ──────────────────────────────────────────────
    {
      id: 2,
      tag: 'INTERACTIVE 3D DESIGNER',
      tagIcon: <Box size={11} />,
      heading: (
        <>
          Bring Your Dream Space{' '}
          <br />
          <span className="font-semibold text-white">to Life in 3D.</span>
        </>
      ),
      description:
        'Create your own room layout, experiment with tiles, customize colors, and place products in a realistic 3D environment. Explore different designs and make confident decisions before visiting the showroom.',
      bg: 'from-[#111827] via-[#1a1f2e] to-[#1A1A1A]',
      imageUrl: '/images/hero/slide3.jpg',
      btn1Label: 'LAUNCH 3D DESIGNER',
      btn1Action: onLaunchDesigner,
      btn2Label: 'EXPLORE CURATED PACKAGES',
      btn2Action: onExplorePackages,
    },
  ];

  const total = slides.length;

  // ── Auto-slide timer ────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      goTo('right');
    }, AUTO_SLIDE_INTERVAL);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer]);

  // ── Navigate ────────────────────────────────────────────────────────────
  const goTo = useCallback(
    (dir: 'left' | 'right', targetIndex?: number) => {
      if (animating) return;
      setDirection(dir);
      setAnimating(true);
      setTimeout(() => {
        setCurrent((prev) => {
          if (targetIndex !== undefined) return targetIndex;
          return dir === 'right' ? (prev + 1) % total : (prev - 1 + total) % total;
        });
        setAnimating(false);
      }, 500);
    },
    [animating, total]
  );

  const handlePrev = () => {
    goTo('left');
    startTimer();
  };

  const handleNext = () => {
    goTo('right');
    startTimer();
  };

  const handleDot = (i: number) => {
    if (i === current || animating) return;
    goTo(i > current ? 'right' : 'left', i);
    startTimer();
  };

  const slide = slides[current];

  // ── Slide-in class helpers ──────────────────────────────────────────────
  const contentClass = animating
    ? direction === 'right'
      ? 'opacity-0 -translate-x-8'
      : 'opacity-0 translate-x-8'
    : 'opacity-100 translate-x-0';

  const bgClass = animating ? 'opacity-0 scale-100' : 'opacity-100 scale-105';

  return (
    <section className="relative w-full h-[calc(100vh-104px)] min-h-[600px] flex items-center justify-start overflow-hidden bg-[#1A1A1A]">

      {/* ── Background layer ── */}
      {slide.imageUrl ? (
        <div
          className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700 ${bgClass}`}
          style={{ backgroundImage: `url('${slide.imageUrl}')` }}
        />
      ) : (
        // Placeholder gradient when no image is set (user replaces later)
        <div
          className={`absolute inset-0 bg-gradient-to-br ${slide.bg} transition-all duration-700 ${bgClass}`}
        >
          {/* Subtle texture pattern overlay for placeholder slides */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)',
              backgroundSize: '20px 20px',
            }}
          />
        </div>
      )}

      {/* ── Dark gradient overlay (always present) ── */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/20 z-[1]" />

      {/* ── Slide content ── */}
      <div
        className={`relative max-w-7xl w-full mx-auto px-4 md:px-8 z-10 text-white flex flex-col items-start gap-5 font-sans transition-all duration-500 ease-out ${contentClass}`}
      >
        {/* Main heading */}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight max-w-3xl leading-[1.1] md:leading-[1.08]">
          {slide.heading}
        </h1>

        {/* Description */}
        <p className="text-sm md:text-base text-gray-300 tracking-wide font-light max-w-2xl leading-relaxed">
          {slide.description}
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mt-2 w-full sm:w-auto">
          <button
            onClick={slide.btn1Action}
            className="group flex items-center justify-center gap-2.5 bg-[#D4C5B9] text-[#1A1A1A] font-semibold text-xs tracking-[0.15em] uppercase px-8 py-4 rounded-none hover:bg-[#C5B4A6] active:scale-[0.98] transition-all duration-300"
          >
            <span>{slide.btn1Label}</span>
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={slide.btn2Action}
            className="flex items-center justify-center gap-2 border border-white/60 text-white font-semibold text-xs tracking-[0.15em] uppercase px-8 py-4 rounded-none hover:bg-white hover:text-[#1A1A1A] hover:border-white active:scale-[0.98] transition-all duration-300"
          >
            <span>{slide.btn2Label}</span>
          </button>
        </div>
      </div>

      {/* ── Prev / Next arrows ── */}
      <button
        onClick={handlePrev}
        aria-label="Previous slide"
        className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center border border-white/20 bg-black/20 backdrop-blur-sm text-white hover:bg-white hover:text-[#1A1A1A] transition-all duration-300 group"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        onClick={handleNext}
        aria-label="Next slide"
        className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center border border-white/20 bg-black/20 backdrop-blur-sm text-white hover:bg-white hover:text-[#1A1A1A] transition-all duration-300 group"
      >
        <ChevronRight size={18} />
      </button>

      {/* ── Dot indicators ── */}
      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => handleDot(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`transition-all duration-400 rounded-none ${
              i === current
                ? 'w-8 h-[3px] bg-[#D4C5B9]'
                : 'w-3 h-[3px] bg-white/35 hover:bg-white/60'
            }`}
          />
        ))}
      </div>

      {/* ── Slide counter ── */}
      <div className="absolute bottom-7 right-6 z-20 text-[10px] font-mono tracking-widest text-white/30 select-none hidden md:block">
        {String(current + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </div>

      {/* ── Auto-progress bar ── */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10 z-20">
        <div
          key={current}
          className="h-full bg-[#D4C5B9]/60"
          style={{
            animation: `heroProgress ${AUTO_SLIDE_INTERVAL}ms linear forwards`,
          }}
        />
      </div>

      {/* ── Decorative coordinates (bottom-right, only on large screens) ── */}
      <div className="absolute right-6 bottom-16 hidden lg:flex flex-col items-end gap-1.5 text-white/15 text-[9px] tracking-widest font-mono select-none pointer-events-none">
        <span>LAT: 5.9549° N</span>
        <span>LON: 80.5550° E</span>
        <span>MATARA, SRI LANKA</span>
      </div>

      {/* ── Progress bar keyframe (injected inline) ── */}
      <style>{`
        @keyframes heroProgress {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </section>
  );
};
