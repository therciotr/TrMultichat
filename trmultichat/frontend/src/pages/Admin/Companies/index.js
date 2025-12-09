import React from "react";
import MainContainer from "../../../components/MainContainer";
import MainHeader from "../../../components/MainHeader";
import Title from "../../../components/Title";
import CompaniesManager from "../../../components/CompaniesManager";

export default function CompaniesAdmin() {
  return (
    <MainContainer>
      <MainHeader>
        <Title>Cadastro de Empresas</Title>
      </MainHeader>
      <CompaniesManager />
    </MainContainer>
  );
}


