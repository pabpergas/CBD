import { createTheme } from "@mui/material/styles";

// Sistema de diseño: "The Intelligence Layer" - Curador Digital
const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#b6a0ff", dark: "#7e51ff", light: "#a98fff" },
    secondary: { main: "#cfe6f2", dark: "#c1d8e4" },
    error: { main: "#ff6e84", dark: "#d73357" },
    background: {
      default: "#0e0e0e", // superficie
      paper: "#1a1a1a", // contenedor de superficie
    },
    text: {
      primary: "#ffffff",
      secondary: "#adaaaa", // variante sobre superficie
    },
    divider: "rgba(72,72,71,0.15)", // variante de contorno con opacidad fantasma
  },
  typography: {
    fontFamily: "'Inter', sans-serif",
    h5: { fontFamily: "'Manrope', sans-serif", fontWeight: 700 },
    h6: { fontFamily: "'Manrope', sans-serif", fontWeight: 700 },
    subtitle1: { fontFamily: "'Manrope', sans-serif", fontWeight: 700 },
    subtitle2: { fontFamily: "'Manrope', sans-serif", fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          borderRadius: 9999,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 9999 },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: { fontFamily: "'Inter', sans-serif" },
      },
    },
  },
});

export default theme;
