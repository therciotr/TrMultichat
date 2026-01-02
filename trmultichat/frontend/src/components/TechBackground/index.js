import React from "react";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  root: {
    position: "relative",
    width: "100%",
    height: "100%",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#fff",
    border: "1px solid rgba(15, 23, 42, 0.08)",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
  },
  bg: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    backgroundImage: [
      "radial-gradient(circle at 18% 22%, rgba(59, 130, 246, 0.10) 0%, rgba(59, 130, 246, 0.00) 38%)",
      "radial-gradient(circle at 78% 18%, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.00) 42%)",
      "radial-gradient(circle at 75% 78%, rgba(99, 102, 241, 0.10) 0%, rgba(99, 102, 241, 0.00) 46%)",
      "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,1) 55%)",
    ].join(","),
  },
  grid: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    opacity: 0.55,
    backgroundImage: [
      "linear-gradient(rgba(15, 23, 42, 0.05) 1px, transparent 1px)",
      "linear-gradient(90deg, rgba(15, 23, 42, 0.05) 1px, transparent 1px)",
    ].join(","),
    backgroundSize: "32px 32px",
    maskImage:
      "radial-gradient(circle at 50% 45%, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.00) 70%)",
  },
  content: {
    position: "relative",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing(4),
    textAlign: "center",
  },
}));

const TechBackground = ({ children }) => {
  const classes = useStyles();

  return (
    <div className={classes.root}>
      <div className={classes.bg} />
      <div className={classes.grid} />
      <div className={classes.content}>{children}</div>
    </div>
  );
};

export default TechBackground;


