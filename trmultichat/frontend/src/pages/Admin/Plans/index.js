import React, { useContext } from "react";
import { Redirect } from "react-router-dom";
import MainContainer from "../../../components/MainContainer";
import MainHeader from "../../../components/MainHeader";
import Title from "../../../components/Title";
import PlansManager from "../../../components/PlansManager";
import { AuthContext } from "../../../context/Auth/AuthContext";

export default function PlansAdmin() {
  const { user } = useContext(AuthContext);
  const email = String(user?.email || "").toLowerCase();
  const isMasterEmail = email === "thercio@trtecnologias.com.br";
  const isSuper = Boolean(user?.super || isMasterEmail);

  if (!isSuper) {
    return <Redirect to="/" />;
  }

  return (
    <MainContainer>
      <MainHeader>
        <Title>Planos</Title>
      </MainHeader>
      <PlansManager />
    </MainContainer>
  );
}


