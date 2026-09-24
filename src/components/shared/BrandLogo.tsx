type BrandLogoProps = {
  compact?: boolean;
};

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <img
      className={`nt-logo-image${compact ? " compact" : ""}`}
      src="/img/neurotech-logo.jpeg"
      alt="Neurotech"
    />
  );
}
