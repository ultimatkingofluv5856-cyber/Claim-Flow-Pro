import type { SVGProps } from 'react';

export default function RupeeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <text
        x="12"
        y="17"
        textAnchor="middle"
        fontSize="18"
        fontWeight="700"
        fill="currentColor"
        fontFamily="Arial, Helvetica, sans-serif"
      >
        ₹
      </text>
    </svg>
  );
}
