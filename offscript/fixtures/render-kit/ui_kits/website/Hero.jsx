// Hero.jsx — simple heading + text with inline styles
const Hero = () => {
  return (
    <section data-screen-label="01 Hero" style={{ background: "#0E0E0E", color: "#fff", padding: "40px 100px" }}>
      <h1 style={{ fontFamily: "Manrope", fontWeight: 700, fontSize: 54, margin: 0 }}>Autonomous Profit Engines</h1>
      <p style={{ fontFamily: "Inter", fontSize: 20, color: "#A5A5A5", marginTop: 40 }}>
        We deploy AI agents that handle the operational work.
      </p>
      <i data-lucide="arrow-right" style={{ width: 16, height: 16 }}></i>
    </section>
  );
};
window.Hero = Hero;
