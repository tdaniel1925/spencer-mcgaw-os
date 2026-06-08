import { ImageResponse } from "next/og";

// Image metadata
export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

// Image generation - AF logo with brand colors
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 16,
          background: "#0a1628",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
        }}
      >
        <span
          style={{
            color: "#3b82f6",
            fontWeight: 700,
            letterSpacing: "-0.5px",
          }}
        >
          AF
        </span>
      </div>
    ),
    {
      ...size,
    }
  );
}
