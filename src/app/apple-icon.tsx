import { ImageResponse } from "next/og";

// Image metadata for Apple devices
export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

// Image generation - SM logo with brand colors
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 90,
          background: "#143009",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 32,
        }}
      >
        <span
          style={{
            color: "#DBC16F",
            fontWeight: 700,
            letterSpacing: "-2px",
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
