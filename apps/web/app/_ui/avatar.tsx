/** A round avatar inside a solid royal ring with a white gap; the creator's photo or their initial. */
export function Avatar({ src, name, size = 64, live }: { src: string | null; name: string; size?: number; live?: boolean }) {
  return (
    <span className="relative inline-grid shrink-0 place-items-center rounded-full bg-royal p-[3px]" style={{ width: size, height: size }}>
      <span className="grid size-full place-items-center overflow-hidden rounded-full bg-white p-[2px]">
        {src ? (
          <img src={src} alt={name} className="size-full rounded-full object-cover" />
        ) : (
          <span className="display grid size-full place-items-center rounded-full bg-lilac text-royal-deep" style={{ fontSize: size * 0.4 }} aria-hidden>
            {name.slice(0, 1)}
          </span>
        )}
      </span>
      {live && <span className="rec-dot absolute right-0.5 bottom-0.5 size-3.5 rounded-full bg-spark ring-2 ring-white" aria-label="Live" />}
    </span>
  );
}
