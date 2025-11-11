import React, { useEffect, useMemo, useState, useContext } from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Card, CardHeader, CardContent, CardActions, Grid, TextField, Chip } from "@material-ui/core";
import VerifiedUserIcon from "@material-ui/icons/VerifiedUser";
import WarningIcon from "@material-ui/icons/Warning";
import VpnKeyIcon from "@material-ui/icons/VpnKey";
import { TrButton } from "../../../components/ui";
import MainContainer from "../../../components/MainContainer";
import MainHeader from "../../../components/MainHeader";
import Title from "../../../components/Title";
import api from "../../../services/api";
import toastError from "../../../errors/toastError";
import moment from "moment";
import { AuthContext } from "../../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
  header: {
    borderRadius: 12,
    padding: theme.spacing(3),
    color: "#fff",
    background: "linear-gradient(135deg, #3f51b5 0%, #7c4dff 100%)",
    marginBottom: theme.spacing(2),
  },
  chipOk: { backgroundColor: "#2e7d32", color: "#fff", fontWeight: 600 },
  chipWarn: { backgroundColor: "#d32f2f", color: "#fff", fontWeight: 600 },
  tokenField: { fontFamily: "monospace" },
  card: { borderRadius: 12 },
}));

export default function LicenseManager() {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const companyId = user?.companyId;
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState(null);
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/companies/${companyId}/license`);
      setInfo(data);
    } catch (e) {
      toastError(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function save() {
    if (!token.trim()) return;
    setSaving(true);
    try {
      await api.put(`/companies/${companyId}/license`, { token: token.trim() });
      setToken("");
      await refresh();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  }

  const statusChip = useMemo(() => {
    if (!info) return null;
    if (info.valid) {
      return (
        <Chip
          className={classes.chipOk}
          icon={<VerifiedUserIcon style={{ color: "#fff" }} />}
          label="Licença válida"
        />
      );
    }
    return (
      <Chip
        className={classes.chipWarn}
        icon={<WarningIcon style={{ color: "#fff" }} />}
        label="Licença ausente ou inválida"
      />
    );
  }, [info, classes.chipOk, classes.chipWarn]);

  return (
    <MainContainer>
      <div className={classes.header}>
        <Title>Gerenciar Licença</Title>
        <div>Ative ou atualize a licença da sua empresa com um token assinado.</div>
      </div>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card className={classes.card} elevation={3}>
            <CardHeader title="Status da Licença" action={statusChip} />
            <CardContent>
              {loading ? (
                <div>Carregando...</div>
              ) : info ? (
                <>
                  <div><b>Empresa:</b> {user?.companyId}</div>
                  <div><b>Assunto:</b> {info.subject || "-"}</div>
                  <div><b>Plano:</b> {info.plan || "-"}</div>
                  <div><b>Máx. Usuários:</b> {info.maxUsers || 0}</div>
                  <div><b>Expira em:</b> {info.exp ? moment.unix(info.exp).format("DD/MM/YYYY") : "-"}</div>
                </>
              ) : (
                <div>Sem dados.</div>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card className={classes.card} elevation={3}>
            <CardHeader title="Ativar/Atualizar Token" avatar={<VpnKeyIcon />} />
            <CardContent>
              <TextField
                label="Token de Licença (JWT RS256)"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="cole aqui o token..."
                variant="outlined"
                fullWidth
                multiline
                minRows={4}
                InputProps={{ className: classes.tokenField }}
              />
            </CardContent>
            <CardActions>
              <TrButton onClick={save} disabled={saving || !token.trim()}>
                Salvar
              </TrButton>
              <TrButton variant="outlined" onClick={refresh} disabled={loading}>
                Atualizar
              </TrButton>
            </CardActions>
          </Card>
        </Grid>
      </Grid>
    </MainContainer>
  );
}


