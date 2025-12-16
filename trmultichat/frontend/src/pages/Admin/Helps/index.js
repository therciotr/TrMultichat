import React from "react";
import MainContainer from "../../../components/MainContainer";
import MainHeader from "../../../components/MainHeader";
import Title from "../../../components/Title";
import HelpsManager from "../../../components/HelpsManager";

export default function HelpsAdmin() {
  return (
    <MainContainer>
      <MainHeader>
        <Title>Ajuda</Title>
      </MainHeader>
      <HelpsManager />
    </MainContainer>
  );
}


