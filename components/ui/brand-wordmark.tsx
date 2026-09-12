import Image from "next/image";

function LogoImages() {
  return (
    <>
      <Image
        className="brand-logo brand-logo-light"
        src="/brand/time-eight-light.png"
        alt=""
        width={1774}
        height={887}
        unoptimized
        loading="eager"
      />
      <Image
        className="brand-logo brand-logo-dark"
        src="/brand/time-eight-dark.png"
        alt=""
        width={1774}
        height={887}
        unoptimized
        loading="eager"
      />
    </>
  );
}

export function BrandWordmark() {
  return (
    <span className="brand-artwork" aria-hidden="true">
      <span className="brand-icon-box">
        <span className="brand-frame brand-mark">
          <LogoImages />
        </span>
      </span>
      <span className="brand-frame brand-text">
        <LogoImages />
      </span>
    </span>
  );
}
