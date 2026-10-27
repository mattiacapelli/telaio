import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata = { title: "Accedi" };

export default async function LoginPage() {
  if (await getSession()) redirect("/");
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexWrap: "wrap",
        gap: 14,
        padding: 14,
        background:
          "radial-gradient(700px 500px at 92% 8%, #ddd9cf, transparent 70%), radial-gradient(600px 420px at 70% 105%, #e4e0d7, transparent 70%), #f4f3f0",
      }}
    >
      <section
        style={{
          flex: "1 1 440px",
          minHeight: 620,
          position: "relative",
          overflow: "hidden",
          borderRadius: 28,
          background: "#17150f",
          color: "#f4f3f0",
          padding: "clamp(28px, 4vw, 48px)",
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
          gap: 32,
        }}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 600 600"
          style={{
            position: "absolute",
            right: -160,
            top: -120,
            width: 640,
            height: 640,
            pointerEvents: "none",
          }}
        >
          <g fill="none" stroke="#f4f3f0" strokeOpacity=".14" strokeWidth="1">
            <circle cx="300" cy="300" r="150" />
            <circle cx="300" cy="300" r="220" />
            <circle cx="300" cy="300" r="290" strokeDasharray="2 8" />
          </g>
          <path
            d="M-40 470 C 120 380, 260 600, 420 480 S 620 330, 700 400"
            fill="none"
            stroke="#f4f3f0"
            strokeOpacity=".18"
            strokeDasharray="6 12"
          />
        </svg>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            position: "relative",
          }}
        >
          <span className="d" style={{ fontWeight: 600, fontSize: 17, letterSpacing: "-.01em" }}>
            Telaio{" "}
            <span style={{ fontWeight: 400, color: "rgba(244,243,240,.62)" }}>
              / Mattia Capelli
            </span>
          </span>
          <span
            style={{
              font: "500 12px/1 Inter, sans-serif",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "rgba(244,243,240,.62)",
            }}
          >
            Area riservata
          </span>
        </div>
      </section>
      <section
        style={{
          flex: "1 1 440px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: 32,
          padding: "clamp(20px, 4vw, 56px)",
        }}
      >
        <div />
        <LoginForm />
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: 12,
            fontSize: 13,
            color: "#6b675c",
          }}
        >
          <span>© {new Date().getFullYear()} Mattia Capelli · Bergamo</span>
        </div>
      </section>
    </div>
  );
}
