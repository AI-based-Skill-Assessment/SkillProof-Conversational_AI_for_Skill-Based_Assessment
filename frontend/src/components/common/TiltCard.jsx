import { useState, useRef, useCallback, useEffect } from 'react';
import '../../styles/common/card.css';

/**
 * TiltCard: High-performance 3D interactive physics card.
 * Depresses the side under the cursor (pressed in that place) while the opposite side lifts forward.
 * Features dynamic 3D drop-shadows and 3D parallax depth (without white glare circles).
 */
export default function TiltCard({
  children,
  className = '',
  style = {},
  maxTilt = 12,
  perspective = 1000,
  scale = 1.025,
  glare = false,
  glareOpacity = 0.18,
  accentColor,
  disabled = false,
  as: Component = 'div',
  ...props
}) {
  const cardRef = useRef(null);
  const [transformStyle, setTransformStyle] = useState({
    transform: `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) translateZ(0) scale3d(1, 1, 1)`,
    boxShadow: '',
    transition: 'transform 450ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 450ms ease',
  });

  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });
  const rafId = useRef(null);
  const isHovered = useRef(false);

  // Clean up RAF on unmount
  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (disabled || !cardRef.current) return;
    isHovered.current = true;

    if (rafId.current) cancelAnimationFrame(rafId.current);

    rafId.current = requestAnimationFrame(() => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const clientX = e.clientX;
      const clientY = e.clientY;

      const x = clientX - rect.left;
      const y = clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Normalized coordinates from -1 to 1
      const percentX = (x - centerX) / (rect.width / 2);
      const percentY = (y - centerY) / (rect.height / 2);

      // Clamped
      const clampedX = Math.max(-1, Math.min(1, percentX));
      const clampedY = Math.max(-1, Math.min(1, percentY));

      // 3D physics:
      // Hover at top (clampedY < 0) => top presses in => rotateX < 0
      // Hover at bottom (clampedY > 0) => bottom presses in => rotateX > 0
      // Hover at right (clampedX > 0) => right presses in => rotateY < 0
      // Hover at left (clampedX < 0) => left presses in => rotateY > 0
      const rotateX = clampedY * maxTilt;
      const rotateY = -clampedX * maxTilt;

      // Dynamic shadow offset: shadow casts in opposite direction of tilt
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const shadowX = -clampedX * (isDark ? 14 : 8);
      const shadowY = -clampedY * (isDark ? 14 : 8) + (isDark ? 16 : 10);
      const shadowBlur = isDark ? 32 : 18;
      const shadowSpread = isDark ? -4 : -2;

      const glowStyle = accentColor 
        ? `, 0 0 ${isDark ? 28 : 16}px ${accentColor}`
        : (isDark ? ', 0 10px 30px rgba(14, 165, 233, 0.12)' : ', 0 6px 16px rgba(2, 132, 199, 0.08)');

      const shadowColor = isDark ? 'rgba(3, 12, 24, 0.45)' : 'rgba(15, 23, 42, 0.09)';
      const calculatedShadow = `${shadowX.toFixed(1)}px ${shadowY.toFixed(1)}px ${shadowBlur}px ${shadowSpread}px ${shadowColor}${glowStyle}`;

      setTransformStyle({
        transform: `perspective(${perspective}px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateZ(8px) scale3d(${scale}, ${scale}, ${scale})`,
        boxShadow: calculatedShadow,
        transition: 'transform 80ms ease-out, box-shadow 80ms ease-out',
      });

      if (glare) {
        const glarePercentX = (x / rect.width) * 100;
        const glarePercentY = (y / rect.height) * 100;
        setGlarePos({
          x: glarePercentX,
          y: glarePercentY,
          opacity: glareOpacity,
        });
      }
    });
  }, [disabled, maxTilt, perspective, scale, glare, glareOpacity, accentColor]);

  const handleMouseEnter = useCallback((e) => {
    if (disabled) return;
    isHovered.current = true;
    if (props.onMouseEnter) props.onMouseEnter(e);
  }, [disabled, props]);

  const handleMouseLeave = useCallback((e) => {
    if (disabled) return;
    isHovered.current = false;
    if (rafId.current) cancelAnimationFrame(rafId.current);

    setTransformStyle({
      transform: `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) translateZ(0) scale3d(1, 1, 1)`,
      boxShadow: '',
      transition: 'transform 550ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 550ms cubic-bezier(0.2, 0.8, 0.2, 1)',
    });

    if (glare) {
      setGlarePos(prev => ({ ...prev, opacity: 0 }));
    }

    if (props.onMouseLeave) props.onMouseLeave(e);
  }, [disabled, perspective, glare, props]);

  return (
    <Component
      ref={cardRef}
      className={`tilt-card ${className}`}
      style={{
        ...style,
        ...transformStyle,
        transformStyle: 'preserve-3d',
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {/* 3D Depth ambient border */}
      <div className="tilt-card__ambient-border" aria-hidden="true" />
      
      {/* Content wrapper with preserve-3d */}
      <div className="tilt-card__content">
        {children}
      </div>

      {/* Dynamic Specular Glare Layer (only if explicitly enabled) */}
      {glare && (
        <div
          className="tilt-card__glare"
          aria-hidden="true"
          style={{
            background: `radial-gradient(circle 280px at ${glarePos.x}% ${glarePos.y}%, rgba(255, 255, 255, ${glarePos.opacity}), rgba(255, 255, 255, 0) 70%)`,
            opacity: glarePos.opacity > 0 ? 1 : 0,
          }}
        />
      )}
    </Component>
  );
}
