// FAQ.jsx — uses React.useState; renders at INITIAL active = 0
const FAQ = () => {
  const qs = ["First question", "Second question"];
  const [active, setActive] = React.useState(0);
  return (
    <section data-screen-label="06 FAQ" style={{ background: "#fff", padding: "80px 100px" }}>
      <h2 style={{ fontFamily: "Manrope", fontWeight: 700, fontSize: 44, margin: 0 }}>FAQ</h2>
      {qs.map((q, i) => (
        <div key={i} onClick={() => setActive(i)} data-active={i === active ? "yes" : "no"}>{q}</div>
      ))}
      <div className="answer">Showing answer for: {qs[active]}</div>
    </section>
  );
};
window.FAQ = FAQ;
