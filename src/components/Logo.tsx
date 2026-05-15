interface LogoProps {
  className?: string;
}

export function Logo({ className = "" }: LogoProps) {
  return (
    <div
      className={`font-display tracking-wide leading-none select-none ${className}`}
    >
      <span className="text-foreground font-bold">Motor</span>
      <span className="text-primary font-bold">ON</span>
      <span className="text-accent font-bold">.ai</span>
    </div>
  );
}
