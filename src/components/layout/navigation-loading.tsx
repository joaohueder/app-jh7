"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { LoadingOverlay } from "@/components/ui/loading-overlay";

const MESSAGES = [
  "Negociando com a Meta…",
  "Ajustando os cabos da campanha…",
  "Contando cliques sem perder nenhum…",
  "Quase lá — sem impulsionar o café.",
];

function isInternalAnchor(anchor: HTMLAnchorElement): boolean {
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  if (anchor.dataset.noLoading !== undefined) return false;
  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return false;
  try {
    const url = new URL(href, window.location.href);
    return url.origin === window.location.origin && url.href !== window.location.href;
  } catch {
    return false;
  }
}

export function NavigationLoading() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const targetRef = useRef<string | null>(null);
  const releaseTimer = useRef<number | null>(null);

  useEffect(() => {
    const current = `${window.location.pathname}?${searchParams.toString()}`;
    if (targetRef.current && (current === targetRef.current || pathname === targetRef.current.split("?")[0])) {
      targetRef.current = null;
      setVisible(false);
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    const release = () => {
      if (releaseTimer.current) window.clearTimeout(releaseTimer.current);
      releaseTimer.current = window.setTimeout(() => {
        targetRef.current = null;
        setVisible(false);
      }, 15000);
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const element = event.target as Element | null;
      const anchor = element?.closest("a");
      if (!(anchor instanceof HTMLAnchorElement) || !isInternalAnchor(anchor)) return;
      const url = new URL(anchor.href);
      targetRef.current = `${url.pathname}${url.search}`;
      setMessageIndex((index) => (index + 1) % MESSAGES.length);
      setVisible(true);
      release();
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      if (releaseTimer.current) window.clearTimeout(releaseTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setInterval(() => setMessageIndex((index) => (index + 1) % MESSAGES.length), 2200);
    return () => window.clearInterval(timer);
  }, [visible]);

  return <LoadingOverlay visible={visible} message={MESSAGES[messageIndex]} />;
}
