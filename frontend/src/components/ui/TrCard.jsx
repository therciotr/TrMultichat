import React from "react";
import { Paper, Typography } from "@material-ui/core";

const TrCard = ({ title, elevation = 1, className = "", children, titleAlign = "center", ...rest }) => {
  return (
    <Paper elevation={elevation} className={`${className} tr-card-border`.trim()} {...rest}>
      {title ? (
        <div style={{ padding: 12 }}>
          <Typography variant="h6" align={titleAlign} style={{ color: "var(--tr-primary)", fontWeight: 600 }}>
            {title}
          </Typography>
        </div>
      ) : null}
      <div>
        {children}
      </div>
    </Paper>
  );
};

export default TrCard;





