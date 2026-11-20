import Image from "next/image";

import { cn } from "@/lib/utils";

type LogoProps = {
  src: string;
  alt?: string;
  className?: string;
  priority?: boolean;
};

/**
 * Logotipo da marca. O caminho vem das configurações (upload) e cai
 * no arquivo padrão de /public/brand quando não houver upload.
 */
export function Logo({
  src,
  alt = "JH7 Marketing",
  className,
  priority = false,
}: LogoProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={366}
      height={210}
      priority={priority}
      unoptimized
      className={cn("h-auto w-auto object-contain", className)}
    />
  );
}
