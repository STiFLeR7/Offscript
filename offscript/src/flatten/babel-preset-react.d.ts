// @babel/preset-react ships no types; we only pass it as a preset reference.
declare module '@babel/preset-react' {
  const preset: unknown;
  export default preset;
}
