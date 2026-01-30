import React from "react";
import { useParams } from "react-router-dom";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import { makeStyles } from "@material-ui/core/styles";

import TicketsManager from "../../components/TicketsManagerTabs/";
import Ticket from "../../components/Ticket/";
import logo from "../../assets/logo-tr.png"; //PLW DESIGN LOGO//
import { i18n } from "../../translate/i18n";
import TechBackground from "../../components/TechBackground";
import Typography from "@material-ui/core/Typography";

const useStyles = makeStyles((theme) => {
  const isDark = theme.palette.type === "dark";
  const border = `1px solid ${theme.palette.divider}`;

  return ({
	chatContainer: {
		flex: 1,
		backgroundColor: theme.palette.background.default,
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
			: "linear-gradient(135deg, #f0f7f6 0%, #eaf5f3 50%, #f6fbfa 100%)",
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
										<img className={classes.logoImg} src={logo} alt="logologin" />
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
