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

const useStyles = makeStyles(theme => ({
	chatContainer: {
		flex: 1,
		backgroundColor: "#F5F7FB",
		padding: theme.spacing(2),
		height: `calc(100% - 48px)`,
		overflowY: "hidden",
	},

	chatPapper: {
		display: "flex",
		height: "100%",
		borderRadius: 14,
		overflow: "hidden",
		border: "1px solid rgba(15, 23, 42, 0.08)",
		boxShadow: "0 2px 12px rgba(15, 23, 42, 0.06)",
		backgroundColor: "#fff",
	},

	contactsWrapper: {
		display: "flex",
		height: "100%",
		flexDirection: "column",
		overflowY: "hidden",
		borderRight: "1px solid rgba(15, 23, 42, 0.08)",
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
		backgroundColor: "#f0f7f6",
		background:
			"linear-gradient(135deg, #f0f7f6 0%, #eaf5f3 50%, #f6fbfa 100%)",
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
	},
	helperText: {
		maxWidth: 420,
		color: "rgba(15, 23, 42, 0.65)",
		fontSize: 14,
		lineHeight: 1.5,
	},
}));

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
