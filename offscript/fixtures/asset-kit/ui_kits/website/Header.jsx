const Header = () => (
  <header>
    <img src="../../assets/logo.svg" alt="Logo" />
    <img src="https://example.com/remote.png" alt="Remote" />
    <img src="data:image/png;base64,iVBORw0KGgo=" alt="Already data" />
    <img src="../../assets/missing.svg" alt="Missing" />
    <div style={{ backgroundImage: 'url("../../assets/bg.png")' }}>styled</div>
  </header>
);
window.Header = Header;
