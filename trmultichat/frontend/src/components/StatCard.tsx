import React from "react";
import styled from "styled-components";

const Card = styled.div`
  background: #111827;
  color: #fff;
  padding: 16px;
  border-radius: 12px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
  min-width: 180px;
`;

const Label = styled.div`
  font-size: 12px;
  opacity: 0.8;
`;

const Value = styled.div`
  font-size: 28px;
  font-weight: 700;
`;

type Props = { label: string; value: number | string };

const StatCard: React.FC<Props> = ({ label, value }) => {
  return (
    <Card>
      <Label>{label}</Label>
      <Value>{value}</Value>
    </Card>
  );
};

export default StatCard;



