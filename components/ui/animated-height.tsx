"use client";

import { useLayoutEffect, useRef, useState } from "react";

export function AnimatedHeight({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const updateHeight = () => setHeight(content.scrollHeight);
    updateHeight();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`animated-height${className ? ` ${className}` : ""}`}
      style={height === undefined ? undefined : { height }}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  );
}
