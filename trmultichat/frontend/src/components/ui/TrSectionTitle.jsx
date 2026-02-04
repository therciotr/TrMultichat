import React from "react";
import { Typography } from "@material-ui/core";

const TrSectionTitle = ({
  title,
  subtitle,
  align = "left",
  icon = null,
}) => {
  return (
    <div
      style={{
        marginBottom: 16,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon ? <span style={{ color: "var(--tr-heading, var(--tr-primary))" }}>{icon}</span> : null}
        <Typography
          variant="h5"
          align={align}
          style={{
            color: "var(--tr-heading, var(--tr-primary))",
            fontWeight: 700,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </Typography>
      </div>
      {subtitle && (
        <Typography
          variant="body2"
          align={align}
          style={{ color: "var(--tr-text)", opacity: 0.8 }}
        >
          {subtitle}
        </Typography>
      )}
    </div>
  );
};

export default TrSectionTitle;

