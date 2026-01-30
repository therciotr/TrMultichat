import React, { useState, useEffect } from "react";
import qs from 'query-string'

import * as Yup from "yup";
import { useHistory } from "react-router-dom";
import { Link as RouterLink } from "react-router-dom";
import { toast } from "react-toastify";
import { Formik, Form, Field } from "formik";
import usePlans from "../../hooks/usePlans";
import { TrButton } from "../../components/ui";
import CssBaseline from "@material-ui/core/CssBaseline";
import TextField from "@material-ui/core/TextField";
import Link from "@material-ui/core/Link";
import Grid from "@material-ui/core/Grid";
import Box from "@material-ui/core/Box";
import {
	InputLabel,
	MenuItem,
	Select,
} from "@material-ui/core";
import Typography from "@material-ui/core/Typography";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import Container from "@material-ui/core/Container";
import logo from "../../assets/logo-tr.png";
import { i18n } from "../../translate/i18n";

import { openApi } from "../../services/api";
import toastError from "../../errors/toastError";
import moment from "moment";
import { InputAdornment, IconButton, FormControl } from "@material-ui/core";
import { Visibility, VisibilityOff } from "@material-ui/icons";
import brandLogoFallback from "../../assets/logo-tr.png";
import { useThemeBranding } from "../../context/ThemeContext";
import "../Login/login.css";

const useStyles = makeStyles(theme => ({
  containerWrapper: {
    display: "flex",
    justifyContent: "space-between",
    gap: theme.spacing(4),
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
  paper: {
    marginTop: theme.spacing(8),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: theme.spacing(2.25),
    borderRadius: theme.spacing(2),
    position: "relative",
    overflow: "hidden",
    background:
      theme.palette.type === "dark"
        ? "linear-gradient(180deg, rgba(15,23,42,0.78), rgba(15,23,42,0.55))"
        : "linear-gradient(180deg, rgba(255,255,255,0.97), rgba(255,255,255,0.92))",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    border:
      theme.palette.type === "dark"
        ? "1px solid rgba(148,163,184,0.24)"
        : "1px solid rgba(var(--tr-primary-rgb, 11,76,70), 0.22)",
    boxShadow:
      theme.palette.type === "dark"
        ? "0px 22px 60px rgba(0, 0, 0, 0.60)"
        : "0px 22px 60px rgba(15, 23, 42, 0.18)",
    '&::before': {
      content: '""',
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      height: 4,
      background: "linear-gradient(90deg, var(--tr-primary), var(--tr-secondary))",
      opacity: theme.palette.type === "dark" ? 0.85 : 0.95,
    },
  },
  form: {
    width: "100%",
    marginTop: theme.spacing(1.25),
  },
  inputRoot: {
    borderRadius: 12,
    '& fieldset': {
      borderColor: theme.palette.type === "dark" ? "rgba(255,255,255,0.22)" : "rgba(15,23,42,0.18)",
    },
    '&:hover fieldset': {
      borderColor: theme.palette.primary.main
    },
    '&.Mui-focused fieldset': {
      borderColor: theme.palette.primary.main
    }
  },
  field: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 12,
    }
  },
  submit: {
    margin: theme.spacing(2.5, 0, 1.25),
  },
}));

const UserSchema = Yup.object().shape({
	name: Yup.string()
		.min(2, "Too Short!")
		.max(50, "Too Long!")
		.required("Required"),
  phone: Yup.string().min(8, "Too Short!").max(30, "Too Long!").required("Required"),
	password: Yup.string().min(6, "Too Short!").max(50, "Too Long!").required("Required"),
	email: Yup.string().email("Invalid email").required("Required"),
  planId: Yup.string().required("Required"),
});

const SignUp = () => {
	const classes = useStyles();
	const history = useHistory();
  const theme = useTheme();
  const { branding } = useThemeBranding();
  const isDark = String(branding?.parentMode || "").toLowerCase() === "dark";
  const [showPassword, setShowPassword] = useState(false);
	let companyId = null

	const params = qs.parse(window.location.search)
	if (params.companyId !== undefined) {
		companyId = params.companyId
	}

	const initialState = { name: "", email: "", phone: "", password: "", planId: "", };

	const [user] = useState(initialState);
	const dueDate = moment().add(3, "day").format();
	const handleSignUp = async values => {
		Object.assign(values, { recurrence: "MENSAL" });
		Object.assign(values, { dueDate: dueDate });
		Object.assign(values, { status: "t" });
		Object.assign(values, { campaignsEnabled: true });
    if (companyId != null) Object.assign(values, { companyId });
    const payload = { ...values };
		try {
			await openApi.post("/companies/cadastro", payload);
			toast.success(i18n.t("signup.toasts.success"));
			history.push("/login");
		} catch (err) {
			toastError(err);
		}
	};

	const [plans, setPlans] = useState([]);
	const { list: listPlans } = usePlans();

	useEffect(() => {
		async function fetchData() {
			const list = await listPlans();
			setPlans(list);
		}
		fetchData();
	}, [listPlans]);


	return (
    <div className="loginRoot">
      <Container component="main" maxWidth="md" className="loginContent">
        <CssBaseline />
        <div className={classes.containerWrapper}>
          <Container component="div" maxWidth="xs" className={`${classes.mobileContainer} ${classes.hideOnMobile}`}>
            <img
              src={(branding.logoUrl || brandLogoFallback) + '?v=20251103'}
              style={{ width: '70%' }}
              alt={process.env.REACT_APP_TITLE || 'TR Multichat'}
            />
          </Container>

          <Container component="div" maxWidth="xs" className={classes.mobileContainer}>
            <div className={classes.paper}>
              <img
                src={(branding.logoUrl || logo) + '?v=20251103'}
                alt="TR TECNOLOGIAS"
                style={{ width: 120, marginTop: 8, marginBottom: 8, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))' }}
              />
              <div className="tr-login-title-group">
                <Typography component="h1" variant="h5" style={{ fontWeight: 800 }}>
                  Criar conta
                </Typography>
                <Typography variant="body2" style={{ color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(15,23,42,0.72)' }}>
                  Cadastre sua empresa e comece a usar o TR Multichat.
                </Typography>
              </div>

              <Formik
                initialValues={user}
                enableReinitialize={true}
                validationSchema={UserSchema}
                onSubmit={(values, actions) => {
                  setTimeout(() => {
                    handleSignUp(values);
                    actions.setSubmitting(false);
                  }, 250);
                }}
              >
                {({ touched, errors, values }) => (
                  <Form className={classes.form}>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <Field
                          as={TextField}
                          className={classes.field}
                          autoComplete="organization"
                          name="name"
                          error={touched.name && Boolean(errors.name)}
                          helperText={touched.name && errors.name}
                          variant="outlined"
                          fullWidth
                          id="name"
                          label="Nome da Empresa"
                          size="small"
                          InputProps={{ classes: { root: classes.inputRoot } }}
                        />
                      </Grid>

                      <Grid item xs={12}>
                        <Field
                          as={TextField}
                          className={classes.field}
                          variant="outlined"
                          fullWidth
                          id="email"
                          label={i18n.t("signup.form.email")}
                          name="email"
                          error={touched.email && Boolean(errors.email)}
                          helperText={touched.email && errors.email}
                          autoComplete="email"
                          required
                          size="small"
                          InputProps={{ classes: { root: classes.inputRoot } }}
                        />
                      </Grid>

                      <Grid item xs={12}>
                        <Field
                          as={TextField}
                          className={classes.field}
                          variant="outlined"
                          fullWidth
                          id="phone"
                          label="Telefone com (DDD)"
                          name="phone"
                          error={touched.phone && Boolean(errors.phone)}
                          helperText={touched.phone && errors.phone}
                          autoComplete="tel"
                          required
                          size="small"
                          InputProps={{ classes: { root: classes.inputRoot } }}
                        />
                      </Grid>

                      <Grid item xs={12}>
                        <Field
                          as={TextField}
                          className={classes.field}
                          variant="outlined"
                          fullWidth
                          name="password"
                          error={touched.password && Boolean(errors.password)}
                          helperText={touched.password && errors.password}
                          label={i18n.t("signup.form.password")}
                          type={showPassword ? "text" : "password"}
                          id="password"
                          autoComplete="new-password"
                          required
                          size="small"
                          InputProps={{
                            classes: { root: classes.inputRoot },
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  aria-label="toggle password visibility"
                                  onClick={() => setShowPassword((v) => !v)}
                                >
                                  {showPassword ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                              </InputAdornment>
                            )
                          }}
                        />
                      </Grid>

                      <Grid item xs={12}>
                        <FormControl variant="outlined" fullWidth size="small" className={classes.field} error={touched.planId && Boolean(errors.planId)}>
                          <InputLabel id="plan-selection-label">Plano</InputLabel>
                          <Field
                            as={Select}
                            labelId="plan-selection-label"
                            variant="outlined"
                            fullWidth
                            id="plan-selection"
                            label="Plano"
                            name="planId"
                            required
                            value={values.planId}
                            classes={{ root: classes.inputRoot }}
                          >
                            {(plans || []).map((plan) => (
                              <MenuItem key={plan.id} value={String(plan.id)}>
                                {plan.name} • Atendentes: {plan.users} • WhatsApp: {plan.connections} • Filas: {plan.queues} • R$ {plan.value}
                              </MenuItem>
                            ))}
                          </Field>
                          {touched.planId && errors.planId ? (
                            <Typography variant="caption" style={{ marginTop: 6, color: theme.palette.error.main }}>
                              {String(errors.planId)}
                            </Typography>
                          ) : null}
                        </FormControl>
                      </Grid>
                    </Grid>

                    <TrButton type="submit" fullWidth className={`${classes.submit} tr-login-button`}>
                      {i18n.t("signup.buttons.submit")}
                    </TrButton>

                    <Grid container justifyContent="flex-end">
                      <Grid item>
                        <Link
                          variant="body2"
                          component={RouterLink}
                          to="/login"
                          style={{
                            color: isDark ? '#fff' : 'rgba(15,23,42,0.78)',
                            textDecorationColor: isDark ? '#fff' : 'rgba(15,23,42,0.45)'
                          }}
                        >
                          Já tem uma conta? Entre!
                        </Link>
                      </Grid>
                    </Grid>
                  </Form>
                )}
              </Formik>

              <Typography variant="caption" style={{ marginTop: 10, color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(15,23,42,0.62)' }}>
                © {new Date().getFullYear()} TR TECNOLOGIAS. Suporte: suporte@trtecnologias.com.br
              </Typography>
            </div>
          </Container>
        </div>
        <Box mt={5} />
      </Container>
    </div>
	);
};

export default SignUp;
