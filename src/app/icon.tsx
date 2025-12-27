import { ImageResponse } from "next/og";

// Image metadata
export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

// Image generation - SM logo with brand colors
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 16,
          background: "#143009",
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
            color: "#DBC16F",
            fontWeight: 700,
            letterSpacing: "-0.5px",
          }}
        >
          SM
        </span>
      </div>
    ),
    {
      ...size,
    }
  );
}
