import React from 'react';

interface IVilnaMenuIconProps {
  isActive: boolean;
  style?: React.CSSProperties;
}

export default function VilnaMenuIcon({ isActive = false, style }: IVilnaMenuIconProps) {
  if (isActive) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        style={style}
      >
        <path
          d="M18 6L6 18M6 6L18 18"
          stroke="#969B9D"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      style={style}
    >
      <path
        d="M3 12H21M3 6H21M9 18H21"
        stroke="#969B9D"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

VilnaMenuIcon.defaultProps = {
  style: {},
};