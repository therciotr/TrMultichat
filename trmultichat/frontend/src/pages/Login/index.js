import React, { useState, useContext, useEffect } from "react";
import { Link as RouterLink } from "react-router-dom";
import { CssBaseline, TextField, Grid, Typography, Container, InputAdornment, IconButton, Link } from '@material-ui/core';
import { TrButton } from "../../components/ui";
import { Visibility, VisibilityOff } from '@material-ui/icons';
import { makeStyles } from "@material-ui/core/styles";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import brandLogoFallback from "../../assets/logo-tr.png";
import "./login.css";
import { useThemeBranding } from "../../context/ThemeContext";

//import loginBackground from "../../assets/bg.jpg";
// Removed WhatsApp icon to keep only brand identity

const brand = {
  dark: "#0B4C46",
  teal: "#2BA9A5"
};

const useStyles = makeStyles((theme) => ({
  paper: {
    marginTop: theme.spacing(8),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: theme.spacing(2),
    borderRadius: theme.spacing(2),
    backgroundColor: theme.palette.type === "dark" ? "rgba(15,23,42,0.55)" : "rgba(255,255,255,0.88)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    border: theme.palette.type === "dark" ? "1px solid rgba(148,163,184,0.22)" : "1px solid rgba(15,23,42,0.10)",
    boxShadow: theme.palette.type === "dark" ? "0px 18px 50px rgba(0, 0, 0, 0.55)" : "0px 16px 44px rgba(15, 23, 42, 0.14)",

  },
  avatar: {
    margin: theme.spacing(1),
    backgroundColor: brand.dark,
  },
  whatsapp: {
    backgroundColor: brand.dark
  },
  form: {
    width: "100%", // Fix IE 11 issue.
    marginTop: theme.spacing(1),
  },
  submit: {
    margin: theme.spacing(3, 0, 2),
  },
  brandButton: {
    background: `linear-gradient(135deg, ${brand.dark} 0%, ${brand.teal} 100%)`,
    color: "#fff",
    '&:hover': {
      filter: 'brightness(1.05)'
    }
  },
  inputRoot: {
    borderRadius: 12,
    '& fieldset': {
      borderColor: theme.palette.type === "dark" ? "rgba(255,255,255,0.30)" : "rgba(15,23,42,0.18)",
    },
    '&:hover fieldset': {
      borderColor: theme.palette.primary.main
    },
    '&.Mui-focused fieldset': {
      borderColor: theme.palette.primary.main
    }
  },
  containerWrapper: {
    display: "flex",
    justifyContent: "space-between",
    gap: theme.spacing(4),
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
  },
  mobileContainer: {
    flex: 1,
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    minHeight: '100vh'
  },
  hideOnMobile: {
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    minHeight: '100vh',
    [theme.breakpoints.down('sm')]: {
      display: 'none',
    },
  },
}));

const Login = () => {
  const classes = useStyles();
  const { branding } = useThemeBranding();
  const isDark = String(branding?.parentMode || "").toLowerCase() === "dark";

  const [user, setUser] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  const { handleLogin, loading } = useContext(AuthContext);

  // Prefill email when remembered
  useEffect(() => {
    try {
      const saved = localStorage.getItem("rememberEmail");
      if (saved) setUser((u) => ({ ...u, email: saved }));
    } catch (_) {}
  }, []);

  const handleChangeInput = (e) => {
    setUser({ ...user, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    try {
      if (remember && user?.email) localStorage.setItem("rememberEmail", user.email);
      if (!remember) localStorage.removeItem("rememberEmail");
    } catch (_) {}
    handleLogin(user);
  };

  return (
    <div className="loginRoot">
      <Container component="main" maxWidth="md" className="loginContent">
        <CssBaseline />
        <div className={classes.containerWrapper}>
          <Container component="div" maxWidth="xs" className={`${classes.mobileContainer} ${classes.hideOnMobile}`}>
            <img src={(branding.logoUrl || brandLogoFallback) + '?v=20251103'} style={{width:'70%'}} alt={process.env.REACT_APP_TITLE || 'TR Multichat'} />
          </Container>
          <Container component="div" maxWidth="xs" className={classes.mobileContainer}>
            <div className={classes.paper}>
              <img src={(branding.logoUrl || brandLogoFallback) + '?v=20251103'} alt="TR TECNOLOGIAS" style={{ width: 120, marginTop: 8, marginBottom: 8, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))' }} />
              <div className="tr-login-title-group">
              <Typography component="h1" variant="h5" style={{ fontWeight: 700 }}>
                TR Multichat
              </Typography>
              <Typography variant="body2" style={{ color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(15,23,42,0.72)' }}>
                Centro de atendimento unificado
              </Typography>
              </div>
              <form className={classes.form} noValidate onSubmit={handleSubmit}>
                <TextField
                  variant="outlined"
                  margin="normal"
                  required
                  fullWidth
                  id="email"
                  label={i18n.t("login.form.email")}
                  name="email"
                  value={user.email}
                  onChange={handleChangeInput}
                  autoComplete="email"
                  autoFocus
                  InputProps={{ classes: { root: classes.inputRoot } }}
                />
                <TextField
                  variant="outlined"
                  margin="normal"
                  required
                  fullWidth
                  name="password"
                  label={i18n.t("login.form.password")}
                  id="password"
                  value={user.password}
                  onChange={handleChangeInput}
                  autoComplete="current-password"
                  type={showPassword ? 'text' : 'password'}
                  InputProps={{
                    classes: { root: classes.inputRoot },
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle password visibility"
                          onClick={() => setShowPassword((e) => !e)}
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
                <Grid container alignItems="center" justifyContent="space-between">
                  <Grid item>
                    <label style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        style={{ marginRight: 8 }}
                      />
                      Lembrar e-mail
                    </label>
                  </Grid>
                  <Grid item>
                    <Link component={RouterLink} to="/forgot-password" variant="body2" style={{ color: '#fff', textDecorationColor: '#fff' }}>
                      Esqueceu a senha?
                    </Link>
                  </Grid>
                </Grid>
                <TrButton
                  type="submit"
                  fullWidth
                  className={`${classes.submit} tr-login-button`}
                  disabled={loading}
                >
                  {loading ? "Entrando..." : i18n.t("login.buttons.submit")}
                </TrButton>
                <Grid container justifyContent="flex-end">
                  <Grid item>
                    <Link
                      variant="body2"
                      component={RouterLink}
                      to="/signup"
                      style={{ color: isDark ? '#fff' : 'rgba(15,23,42,0.78)', textDecorationColor: isDark ? '#fff' : 'rgba(15,23,42,0.45)' }}
                    >
                      {i18n.t("login.buttons.register")}
                    </Link>
                  </Grid>
                </Grid>
              </form>
              <Typography variant="caption" style={{ marginTop: 8, color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(15,23,42,0.62)' }}>
                © {new Date().getFullYear()} TR TECNOLOGIAS. Suporte: suporte@trtecnologias.com.br
              </Typography>
            </div>
          </Container>       
        </div>
      </Container>
    </div>
  );
};

export default Login;
