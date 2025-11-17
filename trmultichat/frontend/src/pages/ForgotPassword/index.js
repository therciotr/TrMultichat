import React, { useState } from "react";
import { Container, TextField, Typography } from "@material-ui/core";
import { TrButton } from "../../components/ui";
import api from "../../services/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [sending, setSending] = useState(false);
  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    setLink("");
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
      const data = resp && resp.data;
      if (data && data.link) setLink(data.link);
      else setLink("");
    } catch (_) {
      setLink("");
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
      {link ? (
        <div style={{ marginTop: 16 }}>
          <Typography variant="body2">
            Link de redefinição (válido por 30 minutos):
          </Typography>
          <div style={{ wordBreak: "break-all", fontFamily: "monospace", background: "#f5f5f5", padding: 8, borderRadius: 6 }}>
            {link}
          </div>
        </div>
      ) : null}
    </Container>
  );
}


