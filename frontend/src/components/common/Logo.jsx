import React from 'react';

/**
 * Reusable high-fidelity vector logo component for SkillProof.
 * Renders the accurate brain shape with transparent sulci/grooves using SVG masking,
 * along with the orbital ring and 4-pointed sparkle stars.
 */
export default function Logo({ size = 32, className = '', color = 'currentColor' }) {
  // Unique mask ID in case multiple logos are rendered on the same page
  const maskId = `brain-mask-${size}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <defs>
        {/* Mask to cut out the branching sulci (grooves) to make them transparent */}
        <mask id={maskId}>
          {/* Base: keep everything inside the white mask */}
          <rect x="0" y="0" width="200" height="200" fill="white" />

          {/* Vertical central split between hemispheres (black cuts out) */}
          <line x1="100" y1="45" x2="100" y2="155" stroke="black" strokeWidth="6" strokeLinecap="round" />

          {/* Left Hemisphere Grooves (black cuts out) */}
          <path
            d="M 100 70 C 85 70 78 68 76 58"
            stroke="black"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 88 70 C 82 78 74 78 66 78"
            stroke="black"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 100 96 C 85 96 74 96 66 94"
            stroke="black"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 88 96 C 85 106 82 114 74 120"
            stroke="black"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 100 122 C 86 122 80 126 78 136"
            stroke="black"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />

          {/* Right Hemisphere Grooves (black cuts out) */}
          <path
            d="M 100 70 C 115 70 122 68 124 58"
            stroke="black"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 112 70 C 118 78 126 78 134 78"
            stroke="black"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 100 96 C 115 96 126 96 134 94"
            stroke="black"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 112 96 C 115 106 118 114 126 120"
            stroke="black"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 100 122 C 114 122 120 126 122 136"
            stroke="black"
            strokeWidth="6"
            strokeLinecap="round"
            fill="none"
          />
        </mask>
      </defs>

      {/* Orbital Ring / Electron path (passes behind the brain) */}
      <ellipse
        cx="100"
        cy="100"
        rx="90"
        ry="30"
        transform="rotate(-28 100 100)"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray="270 80" /* Breaks to pass behind the brain */
      />

      {/* Orbit Node/Planet 1 (Top-Left) */}
      <circle cx="34" cy="74" r="9" fill={color} />

      {/* Orbit Node/Planet 2 (Bottom-Right) */}
      <circle cx="166" cy="126" r="9" fill={color} />

      {/* Brain Hemispheres with mask applied */}
      <g mask={`url(#${maskId})`}>
        {/* Left Hemisphere Base */}
        <circle cx="80" cy="70" r="23" fill={color} />
        <circle cx="71" cy="95" r="23" fill={color} />
        <circle cx="78" cy="120" r="21" fill={color} />
        {/* Fill center gap */}
        <rect x="78" y="47" width="22" height="96" fill={color} />

        {/* Right Hemisphere Base */}
        <circle cx="120" cy="70" r="23" fill={color} />
        <circle cx="129" cy="95" r="23" fill={color} />
        <circle cx="122" cy="120" r="21" fill={color} />
        {/* Fill center gap */}
        <rect x="100" y="47" width="22" height="96" fill={color} />
      </g>

      {/* 4-Pointed Sparkle Stars */}
      {/* Top-Right Star */}
      <path d="M152 20 L155 31 L166 34 L155 37 L152 48 L149 37 L138 34 L149 31 Z" fill={color} />

      {/* Bottom-Center Star */}
      <path d="M110 156 L112 165 L121 167 L112 169 L110 178 L108 169 L99 167 L108 165 Z" fill={color} />

      {/* Bottom-Left Star */}
      <path d="M40 130 L42 138 L50 140 L42 142 L40 150 L38 142 L30 140 L38 138 Z" fill={color} />
    </svg>
  );
}
