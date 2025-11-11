import React, { useEffect, useMemo, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Card, CardHeader, CardContent, CardActions, Grid, TextField, Table, TableHead, TableRow, TableCell, TableBody } from "@material-ui/core";
import { TrButton } from "../../../components/ui";
import MainContainer from "../../../components/MainContainer";
import MainHeader from "../../../components/MainHeader";
import Title from "../../../components/Title";
import api from "../../../services/api";
import toastError from "../../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  card: { borderRadius: 12 },
  header: {
    borderRadius: 12,
    padding: theme.spacing(3),
    color: "#fff",
    background: "linear-gradient(135deg, #3f51b5 0%, #7c4dff 100%)",
    marginBottom: theme.spacing(2),
  },
}));

export default function PlansAdmin() {
  const classes = useStyles();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState({ id: 0, name: "", users: 0, connections: 0, campaigns: false, schedules: false, price: 0 });
  const isEditing = useMemo(() => !!edit.id, [edit.id]);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/plans/list");
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      toastError(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function resetForm() {
    setEdit({ id: 0, name: "", users: 0, connections: 0, campaigns: false, schedules: false, price: 0 });
  }

  async function save() {
    try {
      const payload = { ...edit, users: Number(edit.users || 0), connections: Number(edit.connections || 0), price: Number(edit.price || 0) };
      if (isEditing) {
        await api.put(`/plans/${edit.id}`, payload);
      } else {
        await api.post("/plans", payload);
      }
      resetForm();
      await load();
    } catch (e) {
      toastError(e);
    }
  }

  async function remove(id) {
    try {
      await api.delete(`/plans/${id}`);
      await load();
    } catch (e) {
      toastError(e);
    }
  }

  return (
    <MainContainer>
      <div className={classes.header}>
        <Title>Planos</Title>
        <div>Gerencie os planos oferecidos no seu SaaS.</div>
      </div>
      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Card className={classes.card} elevation={3}>
            <CardHeader title={isEditing ? "Editar plano" : "Novo plano"} />
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField label="Nome" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} fullWidth variant="outlined" />
                </Grid>
                <Grid item xs={6}>
                  <TextField label="Usuários" type="number" value={edit.users} onChange={(e) => setEdit({ ...edit, users: e.target.value })} fullWidth variant="outlined" />
                </Grid>
                <Grid item xs={6}>
                  <TextField label="Conexões" type="number" value={edit.connections} onChange={(e) => setEdit({ ...edit, connections: e.target.value })} fullWidth variant="outlined" />
                </Grid>
                <Grid item xs={6}>
                  <TextField label="Campanhas (true/false)" value={String(edit.campaigns)} onChange={(e) => setEdit({ ...edit, campaigns: e.target.value === "true" })} fullWidth variant="outlined" />
                </Grid>
                <Grid item xs={6}>
                  <TextField label="Agendamentos (true/false)" value={String(edit.schedules)} onChange={(e) => setEdit({ ...edit, schedules: e.target.value === "true" })} fullWidth variant="outlined" />
                </Grid>
                <Grid item xs={12}>
                  <TextField label="Preço (R$)" type="number" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} fullWidth variant="outlined" />
                </Grid>
              </Grid>
            </CardContent>
            <CardActions>
              <TrButton onClick={save} disabled={loading || !edit.name}>Salvar</TrButton>
              <TrButton variant="outlined" onClick={resetForm}>Limpar</TrButton>
            </CardActions>
          </Card>
        </Grid>
        <Grid item xs={12} md={7}>
          <Card className={classes.card} elevation={3}>
            <CardHeader title="Planos cadastrados" />
            <CardContent>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Nome</TableCell>
                    <TableCell align="right">Usuários</TableCell>
                    <TableCell align="right">Conexões</TableCell>
                    <TableCell align="center">Campanhas</TableCell>
                    <TableCell align="center">Agend.</TableCell>
                    <TableCell align="right">Preço</TableCell>
                    <TableCell align="center">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {list.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell align="right">{p.users}</TableCell>
                      <TableCell align="right">{p.connections}</TableCell>
                      <TableCell align="center">{String(p.campaigns) === "true" || p.campaigns ? "Sim" : "Não"}</TableCell>
                      <TableCell align="center">{String(p.schedules) === "true" || p.schedules ? "Sim" : "Não"}</TableCell>
                      <TableCell align="right">R$ {Number(p.price || 0).toFixed(2)}</TableCell>
                      <TableCell align="center">
                        <TrButton size="small" onClick={() => setEdit({ id: p.id, name: p.name || "", users: p.users || 0, connections: p.connections || 0, campaigns: !!p.campaigns, schedules: !!p.schedules, price: p.price || 0 })}>Editar</TrButton>
                        <TrButton size="small" variant="outlined" onClick={() => remove(p.id)}>Excluir</TrButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </MainContainer>
  );
}


