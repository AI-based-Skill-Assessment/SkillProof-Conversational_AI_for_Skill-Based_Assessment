import React from 'react';
import './TechBackground.css';

// Background: Cyber dot-matrix grid with ambient lighting
export default function TechBackground({ className = '' }) {
  return (
    <div
      className={`tech-bg-container ${className}`.trim()}
      aria-hidden="true"
    >
      {/* Top Ambient Cyber Light Beam */}
      <div className="tech-bg__beam" />

      {/* Bottom Ambient Subtle Glow */}
      <div className="tech-bg__bottom-glow" />

      {/* Secondary Ambient Accent Orb */}
      <div className="tech-bg__orb" />

      {/* Full-Height Cyber Grid Lines */}
      <div className="tech-bg__grid-lines" />

      {/* Full-Height Tech Dot Matrix */}
      <div className="tech-bg__dot-matrix" />
    </div>
  );
}
