import React, { useState } from "react";
import { Container, TextField, Typography } from "@material-ui/core";
import { TrButton } from "../../components/ui";
import api from "../../services/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    setMessage("");
    setError("");
    try {
      // tenta rota principal; se 404, tenta aliases
      let resp;
      try {
        resp = await api.post("/auth/forgot-password", { email });
      } catch (err) {
        try { resp = await api.post("/auth/password/forgot", { email }); } catch (_) {
          try { resp = await api.post("/auth/forgot_password", { email }); } catch (__e) {
            throw __e;
          }
        }
      }
      if (resp && resp.data && resp.data.ok) {
        setMessage("Se o e-mail estiver cadastrado, enviaremos um link de redefinição em até alguns minutos.");
      } else {
        setMessage("Se o e-mail estiver cadastrado, enviaremos um link de redefinição.");
      }
    } catch (_) {
      setError("Não foi possível enviar o link de redefinição. Tente novamente em instantes.");
    }
    setSending(false);
  };
  return (
    <Container maxWidth="xs" style={{ paddingTop: 48 }}>
      <Typography variant="h6" gutterBottom>Recuperar senha</Typography>
      <form onSubmit={handleSend}>
        <TextField
          label="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          fullWidth
          variant="outlined"
          margin="normal"
          required
        />
        <TrButton type="submit" fullWidth disabled={sending || !email}>
          {sending ? "Enviando..." : "Enviar link"}
        </TrButton>
      </form>
      {message && (
        <div style={{ marginTop: 16 }}>
          <Typography variant="body2" style={{ color: "#0b9488" }}>
            {message}
          </Typography>
        </div>
      )}
      {error && (
        <div style={{ marginTop: 16 }}>
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        </div>
      )}
    </Container>
  );
}


