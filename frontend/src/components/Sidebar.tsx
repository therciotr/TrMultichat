import React from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";

const Wrapper = styled.aside`
  width: 260px;
  min-height: 100vh;
  background: #0f172a;
  color: #fff;
  position: sticky;
  top: 0;
`;

const Item = styled.div`
  padding: 14px 16px;
  &:hover {
    background: rgba(255, 255, 255, 0.06);
  }
`;

const Title = styled.div`
  padding: 20px 16px;
  font-weight: 700;
  font-size: 16px;
`;

export const Sidebar: React.FC = () => {
  return (
    <Wrapper>
      <Title>TR MultiChat</Title>
      <Item>
        <Link to="/" style={{ color: "#fff", textDecoration: "none" }}>Dashboard</Link>
      </Item>
      <Item>
        <Link to="/tickets" style={{ color: "#fff", textDecoration: "none" }}>Conversas</Link>
      </Item>
      <Item>
        <Link to="/settings" style={{ color: "#fff", textDecoration: "none" }}>Configurações</Link>
      </Item>
    </Wrapper>
  );
};

export default Sidebar;



