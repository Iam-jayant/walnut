"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

import styles from "./magic-bento.module.css";

export interface BentoCardProps {
  color?: string;
  title?: string;
  description?: string;
  label?: string;
  textAutoHide?: boolean;
  disableAnimations?: boolean;
}

export interface BentoProps {
  cards: BentoCardProps[];
  textAutoHide?: boolean;
  enableStars?: boolean;
  enableSpotlight?: boolean;
  enableBorderGlow?: boolean;
  disableAnimations?: boolean;
  spotlightRadius?: number;
  particleCount?: number;
  enableTilt?: boolean;
  glowColor?: string;
  clickEffect?: boolean;
  enableMagnetism?: boolean;
}

const DEFAULT_PARTICLE_COUNT = 12;
const DEFAULT_SPOTLIGHT_RADIUS = 300;
const DEFAULT_GLOW_COLOR = "255, 255, 255";
const MOBILE_BREAKPOINT = 768;

const createParticleElement = (x: number, y: number, color: string = DEFAULT_GLOW_COLOR): HTMLDivElement => {
  const el = document.createElement("div");
  el.style.cssText = `
    position: absolute;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: rgba(${color}, 1);
    box-shadow: 0 0 8px rgba(${color}, 0.75);
    pointer-events: none;
    z-index: 30;
    left: ${x}px;
    top: ${y}px;
  `;
  return el;
};

const updateCardGlowProperties = (card: HTMLElement, mouseX: number, mouseY: number, glow: number, radius: number) => {
  const rect = card.getBoundingClientRect();
  const relativeX = ((mouseX - rect.left) / rect.width) * 100;
  const relativeY = ((mouseY - rect.top) / rect.height) * 100;

  card.style.setProperty("--glow-x", `${relativeX}%`);
  card.style.setProperty("--glow-y", `${relativeY}%`);
  card.style.setProperty("--glow-intensity", glow.toString());
  card.style.setProperty("--glow-radius", `${radius}px`);
};

const useMobileDetection = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
};

const ParticleCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  disableAnimations?: boolean;
  style?: React.CSSProperties;
  particleCount?: number;
  glowColor?: string;
  enableTilt?: boolean;
  clickEffect?: boolean;
  enableMagnetism?: boolean;
}> = ({
  children,
  className = "",
  disableAnimations = false,
  style,
  particleCount = DEFAULT_PARTICLE_COUNT,
  glowColor = DEFAULT_GLOW_COLOR,
  enableTilt = true,
  clickEffect = false,
  enableMagnetism = false,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement[]>([]);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isHoveredRef = useRef(false);
  const memoizedParticles = useRef<HTMLDivElement[]>([]);

  const clearAllParticles = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    particlesRef.current.forEach((particle) => {
      gsap.to(particle, {
        scale: 0,
        opacity: 0,
        duration: 0.2,
        onComplete: () => {
          particle.remove();
        },
      });
    });

    particlesRef.current = [];
  }, []);

  const animateParticles = useCallback(() => {
    if (!cardRef.current || !isHoveredRef.current) return;

    if (memoizedParticles.current.length === 0) {
      const { width, height } = cardRef.current.getBoundingClientRect();
      memoizedParticles.current = Array.from({ length: particleCount }, () =>
        createParticleElement(Math.random() * width, Math.random() * height, glowColor)
      );
    }

    memoizedParticles.current.forEach((particle, index) => {
      const timeoutId = setTimeout(() => {
        if (!cardRef.current || !isHoveredRef.current) return;

        const clone = particle.cloneNode(true) as HTMLDivElement;
        cardRef.current.appendChild(clone);
        particlesRef.current.push(clone);

        gsap.fromTo(clone, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25 });
        gsap.to(clone, {
          x: (Math.random() - 0.5) * 90,
          y: (Math.random() - 0.5) * 90,
          duration: 2.2 + Math.random() * 1.4,
          repeat: -1,
          yoyo: true,
          ease: "none",
        });
      }, index * 70);

      timeoutsRef.current.push(timeoutId);
    });
  }, [particleCount, glowColor]);

  useEffect(() => {
    if (disableAnimations || !cardRef.current) return;

    const element = cardRef.current;

    const handleMouseEnter = () => {
      isHoveredRef.current = true;
      animateParticles();
    };

    const handleMouseLeave = () => {
      isHoveredRef.current = false;
      clearAllParticles();
      gsap.to(element, { rotateX: 0, rotateY: 0, x: 0, y: 0, duration: 0.25, ease: "power2.out" });
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      if (enableTilt) {
        gsap.to(element, {
          rotateX: ((y - centerY) / centerY) * -8,
          rotateY: ((x - centerX) / centerX) * 8,
          duration: 0.12,
          transformPerspective: 1000,
          ease: "power2.out",
        });
      }

      if (enableMagnetism) {
        gsap.to(element, {
          x: (x - centerX) * 0.05,
          y: (y - centerY) * 0.05,
          duration: 0.2,
          ease: "power2.out",
        });
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (!clickEffect) return;

      const rect = element.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const maxDistance = Math.max(
        Math.hypot(x, y),
        Math.hypot(x - rect.width, y),
        Math.hypot(x, y - rect.height),
        Math.hypot(x - rect.width, y - rect.height)
      );

      const ripple = document.createElement("div");
      ripple.style.cssText = `
        position: absolute;
        width: ${maxDistance * 2}px;
        height: ${maxDistance * 2}px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(${glowColor}, 0.36) 0%, rgba(${glowColor}, 0.18) 30%, transparent 70%);
        left: ${x - maxDistance}px;
        top: ${y - maxDistance}px;
        pointer-events: none;
        z-index: 40;
      `;

      element.appendChild(ripple);

      gsap.fromTo(ripple, { scale: 0, opacity: 1 }, {
        scale: 1,
        opacity: 0,
        duration: 0.6,
        ease: "power2.out",
        onComplete: () => ripple.remove(),
      });
    };

    element.addEventListener("mouseenter", handleMouseEnter);
    element.addEventListener("mouseleave", handleMouseLeave);
    element.addEventListener("mousemove", handleMouseMove);
    element.addEventListener("click", handleClick);

    return () => {
      element.removeEventListener("mouseenter", handleMouseEnter);
      element.removeEventListener("mouseleave", handleMouseLeave);
      element.removeEventListener("mousemove", handleMouseMove);
      element.removeEventListener("click", handleClick);
      clearAllParticles();
    };
  }, [animateParticles, clearAllParticles, clickEffect, disableAnimations, enableMagnetism, enableTilt, glowColor]);

  return (
    <div ref={cardRef} className={`${className} ${styles.particleContainer}`} style={style}>
      {children}
    </div>
  );
};

const GlobalSpotlight: React.FC<{
  gridRef: React.RefObject<HTMLDivElement | null>;
  disableAnimations?: boolean;
  enabled?: boolean;
  spotlightRadius?: number;
  glowColor?: string;
}> = ({
  gridRef,
  disableAnimations = false,
  enabled = true,
  spotlightRadius = DEFAULT_SPOTLIGHT_RADIUS,
  glowColor = DEFAULT_GLOW_COLOR,
}) => {
  const spotlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (disableAnimations || !gridRef.current || !enabled) return;

    const spotlight = document.createElement("div");
    spotlight.style.cssText = `
      position: fixed;
      width: 860px;
      height: 860px;
      border-radius: 50%;
      pointer-events: none;
      background: radial-gradient(circle,
        rgba(${glowColor}, 0.14) 0%,
        rgba(${glowColor}, 0.08) 20%,
        rgba(${glowColor}, 0.03) 42%,
        transparent 70%
      );
      z-index: 60;
      opacity: 0;
      transform: translate(-50%, -50%);
      mix-blend-mode: screen;
    `;

    document.body.appendChild(spotlight);
    spotlightRef.current = spotlight;

    const handleMouseMove = (e: MouseEvent) => {
      if (!spotlightRef.current || !gridRef.current) return;

      const section = gridRef.current.closest("section");
      const rect = section?.getBoundingClientRect();
      const inside = Boolean(
        rect &&
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
      );

      const cards = gridRef.current.querySelectorAll("[data-magic-card='true']");

      if (!inside) {
        gsap.to(spotlightRef.current, { opacity: 0, duration: 0.25, ease: "power2.out" });
        cards.forEach((card) => {
          (card as HTMLElement).style.setProperty("--glow-intensity", "0");
        });
        return;
      }

      cards.forEach((card) => {
        const cardEl = card as HTMLElement;
        const cardRect = cardEl.getBoundingClientRect();
        const centerX = cardRect.left + cardRect.width / 2;
        const centerY = cardRect.top + cardRect.height / 2;
        const distance = Math.hypot(e.clientX - centerX, e.clientY - centerY);
        const glow = Math.max(0, 1 - distance / spotlightRadius);
        updateCardGlowProperties(cardEl, e.clientX, e.clientY, glow, spotlightRadius);
      });

      gsap.to(spotlightRef.current, { left: e.clientX, top: e.clientY, opacity: 0.85, duration: 0.12, ease: "power2.out" });
    };

    document.addEventListener("mousemove", handleMouseMove);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      spotlightRef.current?.remove();
    };
  }, [disableAnimations, enabled, glowColor, gridRef, spotlightRadius]);

  return null;
};

const MagicBento: React.FC<BentoProps> = ({
  cards,
  textAutoHide = true,
  enableStars = false,
  enableSpotlight = true,
  enableBorderGlow = true,
  disableAnimations = false,
  spotlightRadius = DEFAULT_SPOTLIGHT_RADIUS,
  particleCount = DEFAULT_PARTICLE_COUNT,
  enableTilt = true,
  glowColor = DEFAULT_GLOW_COLOR,
  clickEffect = true,
  enableMagnetism = true,
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const isMobile = useMobileDetection();
  const shouldDisableAnimations = disableAnimations || isMobile;

  return (
    <div className={styles.bentoSection}>
      {enableSpotlight && (
        <GlobalSpotlight
          gridRef={gridRef}
          disableAnimations={shouldDisableAnimations}
          enabled={enableSpotlight}
          spotlightRadius={spotlightRadius}
          glowColor={glowColor}
        />
      )}

      <div className={styles.cardGrid} ref={gridRef}>
        {cards.map((card, index) => {
          const cardClass = [
            styles.magicBentoCard,
            textAutoHide ? styles.magicBentoCardTextAutohide : "",
            enableBorderGlow ? styles.magicBentoCardBorderGlow : "",
          ]
            .filter(Boolean)
            .join(" ");

          const content = (
            <>
              <div className={styles.magicBentoCardHeader}>
                <div className={styles.magicBentoCardLabel}>{card.label ?? "Feature"}</div>
              </div>
              <div className={styles.magicBentoCardContent}>
                <h3 className={`${styles.magicBentoCardTitle} font-display`}>{card.title ?? "Untitled"}</h3>
                <p className={styles.magicBentoCardDescription}>{card.description ?? ""}</p>
              </div>
            </>
          );

          const style = {
            backgroundColor: card.color,
            ["--glow-color" as string]: glowColor,
          } as React.CSSProperties;

          if (enableStars) {
            return (
              <ParticleCard
                key={`${card.title}-${index}`}
                className={cardClass}
                style={style}
                disableAnimations={shouldDisableAnimations}
                particleCount={particleCount}
                glowColor={glowColor}
                enableTilt={enableTilt}
                clickEffect={clickEffect}
                enableMagnetism={enableMagnetism}
              >
                <div data-magic-card="true" style={{ height: "100%" }}>
                  {content}
                </div>
              </ParticleCard>
            );
          }

          return (
            <ParticleCard
              key={`${card.title}-${index}`}
              className={cardClass}
              style={style}
              disableAnimations={shouldDisableAnimations}
              particleCount={0}
              glowColor={glowColor}
              enableTilt={enableTilt}
              clickEffect={clickEffect}
              enableMagnetism={enableMagnetism}
            >
              <div data-magic-card="true" style={{ height: "100%" }}>
                {content}
              </div>
            </ParticleCard>
          );
        })}
      </div>
    </div>
  );
};

export default MagicBento;
