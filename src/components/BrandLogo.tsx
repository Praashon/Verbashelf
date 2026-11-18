import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2 select-none sm:gap-2.5", className)}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="h-6 w-6 shrink-0 sm:h-7 sm:w-7"
      >
        <rect
          x="2"
          y="2"
          width="24"
          height="24"
          rx="6"
          className="fill-foreground/5 stroke-border"
          strokeWidth="1.25"
        />
        <path
          d="M7.5 8.5L11.75 18.5L16 8.5"
          className="stroke-foreground"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M17.5 19.5H21.5"
          stroke="#1d9bf0"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M19.5 8.5V15.5"
          stroke="#1d9bf0"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      </svg>

      <span className="text-[15px] tracking-tight leading-none sm:text-[17px]">
        <span className="font-bold text-foreground">Verba</span>
        <span className="font-medium text-primary">Shelf</span>
      </span>
    </span>
  );
}
