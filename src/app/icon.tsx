import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1565a8 0%, #0c3d6e 48%, #1f8f6a 100%)",
          borderRadius: 8,
          color: "#f4fbf8",
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: "-0.04em",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        FL
      </div>
    ),
    { ...size },
  );
}
