import { useEffect, useMemo, useState } from "react";
import { useListBanners } from "@workspace/api-client-react";

export function BannerCarousel({ fallbackSrc }: { fallbackSrc: string }) {
  const { data } = useListBanners();

  const banners = useMemo(
    () =>
      (data ?? [])
        .filter((b) => b.active)
        .sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id),
    [data],
  );

  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const current = banners[index] ?? banners[0];
    const seconds =
      current && current.durationSeconds > 0 ? current.durationSeconds : 5;
    const timer = window.setTimeout(() => {
      setIndex((prev) => (prev + 1) % banners.length);
    }, seconds * 1000);
    return () => window.clearTimeout(timer);
  }, [banners, index]);

  if (banners.length === 0) {
    return (
      <img
        src={fallbackSrc}
        alt="베트남 제조산업의 새로운 미래, 당신의 파트너십을 연결합니다"
        className="w-full rounded-lg border"
      />
    );
  }

  const active = banners[Math.min(index, banners.length - 1)];

  const image = (
    <img
      src={active.imageUrl}
      alt={active.title || "배너"}
      className="w-full rounded-lg border object-cover"
    />
  );

  return (
    <div className="relative">
      {active.linkUrl ? (
        <a
          href={active.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          {image}
        </a>
      ) : (
        image
      )}
      {banners.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              aria-label={`배너 ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === index
                  ? "w-6 bg-white shadow"
                  : "w-2 bg-white/60 hover:bg-white/80"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
