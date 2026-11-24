type DecorativeIconName = "quill" | "credits";

export function DecorativeIcon({
  name,
  className = "",
}: {
  name: DecorativeIconName;
  className?: string;
}) {
  return (
    <img
      src={`/images/lavender-${name}.png`}
      className={`icon-illustration ${className}`}
      alt=""
      aria-hidden="true"
      width={128}
      height={128}
      decoding="async"
      draggable={false}
    />
  );
}
