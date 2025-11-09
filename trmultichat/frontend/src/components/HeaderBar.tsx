import React, { useContext } from "react";
import styled from "styled-components";
import { AuthContext } from "../context/Auth/AuthContext";
import ThemeToggle from "./ThemeToggle";

const Bar = styled.header`
  height: 56px;
  background: #0b1220;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
`;

const Right = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

export const HeaderBar: React.FC = () => {
  const { user, handleLogout } = useContext(AuthContext) as any;
  return (
    <Bar>
      <div>{user?.tenantId ? `Tenant: ${user?.tenantId}` : "TR MultiChat"}</div>
      <Right>
        <ThemeToggle />
        <div>{user?.name}</div>
        <button onClick={handleLogout}>Sair</button>
      </Right>
    </Bar>
  );
};

export default HeaderBar;



