import { cn } from "@/lib/utils";

interface RadialBackgroundProps {
  className?: string;
}

export const RadialBackground = ({ className }: RadialBackgroundProps) => {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "fixed inset-0 -z-10 size-full pointer-events-none transition-colors duration-300",
        "bg-white [background:radial-gradient(125%_125%_at_50%_10%,#fff_40%,#63e_100%)]",
        "dark:bg-[#050608] dark:[background:radial-gradient(125%_125%_at_50%_10%,#090b10_45%,#281458_100%)]",
        className
      )}
    />
  );
};
