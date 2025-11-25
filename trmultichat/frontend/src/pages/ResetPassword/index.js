import React, { useState, useEffect } from "react";
import { Container, TextField, Typography } from "@material-ui/core";
import { TrButton } from "../../components/ui";
import api from "../../services/api";

export default function ResetPassword() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const t = url.searchParams.get("token");
      if (t) setToken(t);
    } catch (_) {}
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token || !password || password !== confirm) return;
    setSaving(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
    } catch (_) {
      setDone(false);
    }
    setSaving(false);
  };

  if (done) {
    return (
      <Container maxWidth="xs" style={{ paddingTop: 48 }}>
        <Typography variant="h6" gutterBottom>Senha alterada com sucesso.</Typography>
        <Typography variant="body2">Você já pode voltar para a tela de login.</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="xs" style={{ paddingTop: 48 }}>
      <Typography variant="h6" gutterBottom>Definir nova senha</Typography>
      <form onSubmit={handleSubmit}>
        <TextField
          label="Nova senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          fullWidth
          variant="outlined"
          margin="normal"
          required
        />
        <TextField
          label="Confirmar senha"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          fullWidth
          variant="outlined"
          margin="normal"
          required
          error={!!confirm && confirm !== password}
          helperText={confirm && confirm !== password ? "As senhas não conferem" : ""}
        />
        <TrButton type="submit" fullWidth disabled={saving || !password || password !== confirm}>
          {saving ? "Salvando..." : "Salvar"}
        </TrButton>
      </form>
    </Container>
  );
}




