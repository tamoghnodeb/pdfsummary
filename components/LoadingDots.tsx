"use client";

interface Props {
  size?: "small" | "medium";
}

export default function LoadingDots({ size = "medium" }: Props) {
  const dotSize = size === "small" ? "6px" : "8px";
  const gap = size === "small" ? "4px" : "5px";

  return (
    <div
      className="loading-dots"
      style={{ gap }}
      aria-label="Loading"
      role="status"
    >
      <div
        className="loading-dot"
        style={{ width: dotSize, height: dotSize }}
      />
      <div
        className="loading-dot"
        style={{ width: dotSize, height: dotSize }}
      />
      <div
        className="loading-dot"
        style={{ width: dotSize, height: dotSize }}
      />
    </div>
  );
}
