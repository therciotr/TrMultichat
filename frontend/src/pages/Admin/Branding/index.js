import React, { useEffect, useMemo, useState } from "react";
import { Container, Typography, Grid, TextField, MenuItem, Paper, Slider, Select, InputLabel, FormControl } from "@material-ui/core";
import { TrButton, TrSectionTitle, TrCard } from "../../../components/ui";
import { makeStyles } from "@material-ui/core/styles";
import api from "../../../services/api";
import { useThemeBranding } from "../../../context/ThemeContext";

const useStyles = makeStyles((theme) => ({
  root: { padding: theme.spacing(2) },
  section: { padding: theme.spacing(2), marginTop: theme.spacing(2) },
  previewLogo: { maxHeight: 80 },
  previewBg: { maxHeight: 120, maxWidth: 200, objectFit: "cover", borderRadius: 6, border: "1px solid #ddd" },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing(2) },
  oneCol: { display: 'grid', gridTemplateColumns: '1fr', gap: theme.spacing(2) }
}));

const AdminBranding = () => {
  const classes = useStyles();
  const { branding, updateBranding, refreshBranding } = useThemeBranding();
  const [form, setForm] = useState(branding);

  useEffect(() => { setForm(branding); }, [branding]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleUpload = async (e, key) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    const data = new FormData();
    data.append("file", file);
    const res = await api.post("/branding/upload", data, { headers: { "Content-Type": "multipart/form-data" } });
    const url = res?.data?.url;
    if (url) setForm((f) => ({ ...f, [key]: url }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await updateBranding(form);
  };

  const isImageBg = useMemo(() => form.backgroundType === "image", [form.backgroundType]);

  const BrandingPreview = ({ data }) => {
    const bgStyle = data.backgroundType === "image" && data.backgroundImage
      ? { background: `url(${data.backgroundImage}) center/cover no-repeat` }
      : { background: data.backgroundColor };
    return (
      <div style={{
        ...bgStyle,
        borderRadius: 12,
        padding: "1.25rem",
        minHeight: 280,
        border: `1px solid ${data.primaryColor}30`,
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        fontFamily: data.fontFamily || "Inter, sans-serif"
      }}>
        <div style={{
          background: data.primaryColor,
          height: 44,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          padding: "0 1rem",
          color: "#fff",
          gap: "0.5rem"
        }}>
          {data.logoUrl && <img src={data.logoUrl} alt="logo" style={{ height: 26, objectFit: "contain" }} />}
          <span style={{ fontWeight: 600 }}>TR Multichat</span>
        </div>
        <div style={{
          background: "#fff",
          borderRadius: data.borderRadius ? Number(data.borderRadius) : 12,
          padding: "1rem 1.2rem",
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
          maxWidth: 280
        }}>
          <h3 style={{ margin: 0, color: data.primaryColor }}>Login</h3>
          <p style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>Acesse o painel com suas credenciais</p>
          <button style={{
            marginTop: 12,
            background: `linear-gradient(135deg, ${data.primaryColor}, ${data.secondaryColor})`,
            border: "none",
            color: "#fff",
            padding: "0.45rem 0.8rem",
            borderRadius: data.borderRadius ? Number(data.borderRadius) : 12,
            cursor: "pointer",
            width: "100%",
            fontWeight: 600
          }}>
            Entrar
          </button>
        </div>
      </div>
    );
  };

  return (
    <Container maxWidth="md" className={classes.root}>
      <Typography variant="h5"><b>Configurações de Branding</b></Typography>
      <Paper className={classes.section}>
        <form onSubmit={handleSubmit}>
          <div className={classes.twoCol}>
            <div>
              <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField type="color" fullWidth label="Primary Color" name="primaryColor" value={form.primaryColor} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField type="color" fullWidth label="Secondary Color" name="secondaryColor" value={form.secondaryColor} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField type="color" fullWidth label="Button Color" name="buttonColor" value={form.buttonColor} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField type="color" fullWidth label="Text Color" name="textColor" value={form.textColor} onChange={handleChange} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="Background Type" name="backgroundType" value={form.backgroundType} onChange={handleChange}>
                <MenuItem value="color">Cor</MenuItem>
                <MenuItem value="image">Imagem</MenuItem>
              </TextField>
            </Grid>
            {isImageBg ? (
              <Grid item xs={12} sm={6}>
                <TrButton variant="outlined" component="label">Enviar imagem de fundo
                  <input type="file" hidden onChange={(e) => handleUpload(e, "backgroundImage")} accept="image/*" />
                </TrButton>
                {form.backgroundImage && <div><img alt="bg" className={classes.previewBg} src={form.backgroundImage} /></div>}
              </Grid>
            ) : (
              <Grid item xs={12} sm={6}>
                <TextField type="color" fullWidth label="Background Color" name="backgroundColor" value={form.backgroundColor} onChange={handleChange} />
              </Grid>
            )}
            <Grid item xs={12}>
              <TrButton variant="outlined" component="label">Enviar logomarca
                <input type="file" hidden onChange={(e) => handleUpload(e, "logoUrl")} accept="image/*" />
              </TrButton>
              {form.logoUrl && <div><img alt="logo" className={classes.previewLogo} src={form.logoUrl} /></div>}
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel id="fontFamily">Font Family</InputLabel>
                <Select labelId="fontFamily" name="fontFamily" value={form.fontFamily || "Inter, sans-serif"} onChange={handleChange}>
                  <MenuItem value={"Inter, sans-serif"}>Inter, sans-serif</MenuItem>
                  <MenuItem value={"Roboto, sans-serif"}>Roboto, sans-serif</MenuItem>
                  <MenuItem value={"Nunito, sans-serif"}>Nunito, sans-serif</MenuItem>
                  <MenuItem value={"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', Arial, sans-serif"}>System</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>Border Radius</Typography>
              <Slider value={Number(form.borderRadius || 12)} min={4} max={16} step={1} onChange={(_, val) => setForm((f) => ({ ...f, borderRadius: Number(val) }))} valueLabelDisplay="auto" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="Sidebar Variant" name="sidebarVariant" value={form.sidebarVariant || "gradient"} onChange={handleChange}>
                <MenuItem value="solid">Solid</MenuItem>
                <MenuItem value="gradient">Gradient</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select fullWidth label="Login Background Type" name="loginBackgroundType" value={form.loginBackgroundType || form.backgroundType} onChange={handleChange}>
                <MenuItem value="color">Color</MenuItem>
                <MenuItem value="image">Image</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TrButton type="submit">Salvar</TrButton>
              <TrButton style={{ marginLeft: 8 }} variant="text" onClick={() => refreshBranding()}>Recarregar</TrButton>
            </Grid>
              </Grid>
            </div>
            <div>
              <BrandingPreview data={form} />
              <div style={{ marginTop: 16 }}>
                <TrCard
                  title="Pré-visualização de componentes"
                  style={{
                    background:
                      "radial-gradient(circle at top, rgba(43,169,165,0.18) 0%, rgba(7,31,29,0.8) 100%)",
                    backdropFilter: "blur(2px)",
                  }}
                >
                  <div style={{ padding: 16 }}>
                    <TrSectionTitle
                      title="TR Multichat – Identidade Visual"
                      subtitle="Esse título está usando as cores definidas no painel de branding."
                    />

                    <p style={{ color: "#fff", opacity: 0.9, marginTop: 6 }}>
                      Altere a cor primária, fonte ou raio no painel ao lado e veja esse bloco
                      mudar em tempo real.
                    </p>

                    <div
                      style={{
                        marginTop: 14,
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <TrCard
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.06)",
                          color: "#fff",
                          minWidth: 180,
                        }}
                      >
                        <div style={{ padding: 12 }}>
                          <h4 style={{ margin: 0, fontSize: 14 }}>Botão padrão</h4>
                          <p style={{ margin: "4px 0 10px", fontSize: 12, opacity: 0.85 }}>
                            Usa TrButton e tema dinâmico.
                          </p>
                        </div>
                      </TrCard>
                    </div>
                  </div>
                </TrCard>
              </div>
            </div>
          </div>
        </form>
      </Paper>
    </Container>
  );
};

export default AdminBranding;


