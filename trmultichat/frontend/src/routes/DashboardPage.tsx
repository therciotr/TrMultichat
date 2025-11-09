import React, { useEffect, useState } from "react";
import api from "../services/api";
import MainContainer from "../components/MainContainer";
import MainHeader from "../components/MainHeader";
import Title from "../components/Title";
import { Grid } from "@material-ui/core";
import CardCounter from "../components/Dashboard/CardCounter";
import ForumIcon from "@material-ui/icons/Forum";
import PeopleAltOutlinedIcon from "@material-ui/icons/PeopleAltOutlined";
import MessageIcon from "@material-ui/icons/Message";
import AccountTreeOutlinedIcon from "@material-ui/icons/AccountTreeOutlined";

const DashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<{ openTickets: number; messagesToday: number; onlineAgents: number } | null>(null);

  useEffect(() => {
    api.get("/metrics").then(r => setMetrics(r.data)).catch(() => setMetrics({ openTickets: 0, messagesToday: 0, onlineAgents: 0 }));
  }, []);

  return (
    <MainContainer>
      <MainHeader>
        <Title>TR Multichat</Title>
      </MainHeader>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <CardCounter icon={<ForumIcon />} title="Conversas ativas" value={String(metrics?.openTickets ?? 0)} loading={!metrics} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <CardCounter icon={<PeopleAltOutlinedIcon />} title="Atendentes online" value={String(metrics?.onlineAgents ?? 0)} loading={!metrics} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <CardCounter icon={<MessageIcon />} title="Mensagens hoje" value={String(metrics?.messagesToday ?? 0)} loading={!metrics} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <CardCounter icon={<AccountTreeOutlinedIcon />} title="Filas pendentes" value={"0"} loading={!metrics} />
        </Grid>
      </Grid>
    </MainContainer>
  );
};

export default DashboardPage;



