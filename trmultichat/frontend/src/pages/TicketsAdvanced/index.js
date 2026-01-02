import React, { useState, useEffect, useContext } from "react";
import { useParams } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import { TrButton } from "../../components/ui";
import Box from '@material-ui/core/Box';
import BottomNavigation from '@material-ui/core/BottomNavigation';
import BottomNavigationAction from '@material-ui/core/BottomNavigationAction';
import QuestionAnswerOutlinedIcon from "@material-ui/icons/QuestionAnswerOutlined";
import ChatBubbleOutlineIcon from "@material-ui/icons/ChatBubbleOutline";

import TicketsManagerTabs from "../../components/TicketsManagerTabs/";
import Ticket from "../../components/Ticket/";
import TicketAdvancedLayout from "../../components/TicketAdvancedLayout";
import logo from "../../assets/logo-tr.png"; //PLW DESIGN LOGO//
import { TicketsContext } from "../../context/Tickets/TicketsContext";
import TechBackground from "../../components/TechBackground";
import Typography from "@material-ui/core/Typography";

import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
    header: {
    },
    content: {
        overflow: "auto"
    },
    placeholderContainer: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
		backgroundColor: "#f0f7f6",
        background:
            "linear-gradient(135deg, #f0f7f6 0%, #eaf5f3 50%, #f6fbfa 100%)",
        padding: theme.spacing(2),
    },
    placeholderItem: {
    }
}));

const TicketAdvanced = (props) => {
	const classes = useStyles();
	const { ticketId } = useParams();
	const [option, setOption] = useState(0);
    const { currentTicket, setCurrentTicket } = useContext(TicketsContext)

    useEffect(() => {
        if(currentTicket.id !== null) {
            setCurrentTicket({ id: currentTicket.id, code: '#open' })
        }
        if (!ticketId) {
            setOption(1)
        }
        return () => {
            setCurrentTicket({ id: null, code: null })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (currentTicket.id !== null) {
            setOption(0)
        }
    }, [currentTicket])

	const renderPlaceholder = () => {
		return <Box className={classes.placeholderContainer}>
            <TechBackground>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                    <img style={{ width: "min(360px, 75%)", height: "auto" }} src={logo} alt="logologin" />
                    <Typography style={{ maxWidth: 420, color: "rgba(15, 23, 42, 0.65)", fontSize: 14, lineHeight: 1.5 }}>
                        {i18n.t("chat.noTicketMessage")}
                    </Typography>
                    <TrButton onClick={() => setOption(1)}>
                        Selecionar Ticket
                    </TrButton>
                </div>
            </TechBackground>
        </Box>
	}

	const renderMessageContext = () => {
		if (ticketId) {
			return <Ticket />
		}
		return renderPlaceholder()
	}

	const renderTicketsManagerTabs = () => {
		return <TicketsManagerTabs />
	}

	return (
        <TicketAdvancedLayout>
            <Box className={classes.header}>
                <BottomNavigation
                    value={option}
                    onChange={(event, newValue) => {
                        setOption(newValue);
                    }}
                    showLabels
                    className={classes.root}
                >
                    <BottomNavigationAction label="Ticket" icon={<ChatBubbleOutlineIcon />} />
                    <BottomNavigationAction label="Atendimentos" icon={<QuestionAnswerOutlinedIcon />} />
                </BottomNavigation>
            </Box>
            <Box className={classes.content}>
                { option === 0 ? renderMessageContext() : renderTicketsManagerTabs() }
            </Box>
        </TicketAdvancedLayout>
	);
};

export default TicketAdvanced;
