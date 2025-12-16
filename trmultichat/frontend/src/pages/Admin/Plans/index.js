import React from "react";
import MainContainer from "../../../components/MainContainer";
import MainHeader from "../../../components/MainHeader";
import Title from "../../../components/Title";
import PlansManager from "../../../components/PlansManager";

export default function PlansAdmin() {
  return (
    <MainContainer>
      <MainHeader>
        <Title>Planos</Title>
      </MainHeader>
      <PlansManager />
    </MainContainer>
  );
}


