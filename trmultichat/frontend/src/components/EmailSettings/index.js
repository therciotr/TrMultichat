import React, { useEffect, useState } from "react";
import { TextField, FormControlLabel, Checkbox, Button, Typography } from "@material-ui/core";
import api from "../../services/api";

const EmailSettings = () => {
  const [form, setForm] = useState({
    mail_host: "",
    mail_port: "",
    mail_user: "",
    mail_pass: "",
    mail_from: "",
    mail_secure: false
  });
  const [hasPassword, setHasPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const { data } = await api.get("/settings/email");
        if (!mounted) return;
        setForm(prev => ({
          ...prev,
          mail_host: data.mail_host || "",
          mail_port: data.mail_port != null ? String(data.mail_port) : "",
          mail_user: data.mail_user || "",
          mail_from: data.mail_from || "",
          mail_secure: !!data.mail_secure,
          mail_pass: ""
        }));
        setHasPassword(!!data.has_password);
      } catch {
        setError("Não foi possível carregar as configurações de e-mail.");
      }
      setLoading(false);
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleChange = field => e => {
    const value = field === "mail_secure" ? e.target.checked : e.target.value;
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const payload = {
        mail_host: form.mail_host || null,
        mail_port: form.mail_port ? Number(form.mail_port) : null,
        mail_user: form.mail_user || null,
        mail_pass: form.mail_pass || "",
        mail_from: form.mail_from || null,
        mail_secure: form.mail_secure
      };
      await api.put("/settings/email", payload);
      setMessage("Configurações salvas com sucesso.");
      if (form.mail_pass) setHasPassword(true);
      setForm(prev => ({ ...prev, mail_pass: "" }));
    } catch {
      setError("Não foi possível salvar as configurações de e-mail.");
    }
    setSaving(false);
  };

  if (loading) {
    return <Typography>Carregando configurações de e-mail...</Typography>;
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <TextField
        label="Host SMTP"
        fullWidth
        margin="normal"
        value={form.mail_host}
        onChange={handleChange("mail_host")}
      />
      <TextField
        label="Porta"
        fullWidth
        margin="normal"
        value={form.mail_port}
        onChange={handleChange("mail_port")}
      />
      <TextField
        label="Usuário"
        fullWidth
        margin="normal"
        value={form.mail_user}
        onChange={handleChange("mail_user")}
      />
      <TextField
        label="Remetente (From)"
        fullWidth
        margin="normal"
        value={form.mail_from}
        onChange={handleChange("mail_from")}
      />
      <FormControlLabel
        control={
          <Checkbox
            checked={form.mail_secure}
            onChange={handleChange("mail_secure")}
            color="primary"
          />
        }
        label="Secure (TLS/SSL)"
      />
      <TextField
        label="Senha SMTP"
        type="password"
        fullWidth
        margin="normal"
        value={form.mail_pass}
        onChange={handleChange("mail_pass")}
        helperText={hasPassword ? "Senha já configurada. Deixe em branco para manter." : ""}
      />

      {message && (
        <Typography style={{ color: "#0b9488", marginTop: 12 }}>{message}</Typography>
      )}
      {error && (
        <Typography color="error" style={{ marginTop: 12 }}>
          {error}
        </Typography>
      )}

      <Button
        variant="contained"
        color="primary"
        onClick={handleSave}
        disabled={saving}
        style={{ marginTop: 16 }}
      >
        {saving ? "Salvando..." : "Salvar"}
      </Button>
    </div>
  );
};

export default EmailSettings;



