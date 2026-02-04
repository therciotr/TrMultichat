import React from "react";
import { useParams } from "react-router-dom";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import { makeStyles } from "@material-ui/core/styles";

import TicketsManager from "../../components/TicketsManagerTabs/";
import Ticket from "../../components/Ticket/";
import { i18n } from "../../translate/i18n";
import TechBackground from "../../components/TechBackground";
import Typography from "@material-ui/core/Typography";
import { useThemeBranding } from "../../context/ThemeContext";

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  const border = `1px solid ${theme.palette.divider}`;

  return ({
	chatContainer: {
		flex: 1,
		// deixa o fundo do body (branding) aparecer por trás
		backgroundColor: "transparent",
		padding: theme.spacing(2),
		height: `calc(100% - 48px)`,
		overflowY: "hidden",
	},

	chatPapper: {
		display: "flex",
		height: "100%",
		borderRadius: 14,
		overflow: "hidden",
		border,
		boxShadow: isDark ? "0 10px 26px rgba(0,0,0,0.35)" : "0 2px 12px rgba(15, 23, 42, 0.06)",
		backgroundColor: theme.palette.background.paper,
	},

	contactsWrapper: {
		display: "flex",
		height: "100%",
		flexDirection: "column",
		overflowY: "hidden",
		borderRight: `1px solid ${theme.palette.divider}`,
	},
	messagesWrapper: {
		display: "flex",
		height: "100%",
		flexDirection: "column",
	},
	welcomeMsg: {
		display: "flex",
		justifyContent: "center",
		alignItems: "center",
		height: "100%",
		padding: theme.spacing(3),
		background: isDark
			? "linear-gradient(135deg, rgba(15,23,42,0.92) 0%, rgba(2,6,23,0.92) 60%, rgba(15,23,42,0.88) 100%)"
			: "linear-gradient(135deg, rgba(var(--tr-primary-rgb, 11,76,70),0.10) 0%, rgba(var(--tr-secondary-rgb, 43,169,165),0.10) 55%, rgba(255,255,255,0.92) 100%)",
	},
	logoWrap: {
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		gap: theme.spacing(1.5),
	},
	logoImg: {
		width: "min(420px, 75%)",
		height: "auto",
		opacity: isDark ? 0.92 : 1,
		filter: isDark ? "drop-shadow(0 18px 40px rgba(0,0,0,0.55))" : "none",
	},
	helperText: {
		maxWidth: 420,
		color: theme.palette.text.secondary,
		fontSize: 14,
		lineHeight: 1.5,
	},
})});

const TicketsCustom = () => {
	const classes = useStyles();
	const { ticketId } = useParams();
  const { branding } = useThemeBranding();
  const logoSrc = branding?.logoUrl;
  const title = branding?.appTitle || "TR Multichat";

	return (
		<div className={classes.chatContainer}>
			<div className={classes.chatPapper}>
				<Grid container spacing={0}>
					<Grid item xs={4} className={classes.contactsWrapper}>
						<TicketsManager />
					</Grid>
					<Grid item xs={8} className={classes.messagesWrapper}>
						{ticketId ? (
							<>
								<Ticket />
							</>
						) : (
							<Paper square elevation={0} className={classes.welcomeMsg}>
								<TechBackground>
									<div className={classes.logoWrap}>
										{logoSrc ? (
											<img className={classes.logoImg} src={logoSrc} alt={title} />
										) : (
											<div style={{ fontWeight: 1000, fontSize: 22, color: "rgba(15,23,42,0.55)" }}>
												{title}
											</div>
										)}
										<Typography className={classes.helperText}>
											{i18n.t("chat.noTicketMessage")}
										</Typography>
									</div>
								</TechBackground>
							</Paper>
						)}
					</Grid>
				</Grid>
			</div>
		</div>
	);
};

export default TicketsCustom;
