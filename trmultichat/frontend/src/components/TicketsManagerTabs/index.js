import React, { useContext, useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import SearchOutlinedIcon from "@material-ui/icons/SearchOutlined";
import InputBase from "@material-ui/core/InputBase";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import Badge from "@material-ui/core/Badge";
import InboxOutlinedIcon from "@material-ui/icons/InboxOutlined";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import AddIcon from "@material-ui/icons/Add";
import TuneOutlinedIcon from "@material-ui/icons/TuneOutlined";

import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";

import NewTicketModal from "../NewTicketModal";
import TicketsList from "../TicketsListCustom";
import TabPanel from "../TabPanel";

import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../Can";
import TicketsQueueSelect from "../TicketsQueueSelect";
import { Button } from "@material-ui/core";
import { TagsFilter } from "../TagsFilter";
import { UsersFilter } from "../UsersFilter";
import useQueues from "../../hooks/useQueues";
import api from "../../services/api";

const useStyles = makeStyles(theme => ({
	ticketsWrapper: {
		position: "relative",
		display: "flex",
		height: "100%",
		flexDirection: "column",
		overflow: "hidden",
		borderTopRightRadius: 0,
		borderBottomRightRadius: 0,
		borderRadius: 0,
	},

	tabsHeader: {
		flex: "none",
		backgroundColor: "#fff",
		borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
	},

	tabsInternal: {
		flex: "none",
		backgroundColor: "#fff",
		borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
	},

	settingsIcon: {
		alignSelf: "center",
		marginLeft: "auto",
		padding: 8,
	},

	tab: {
		minWidth: 120,
		width: 120,
		textTransform: "none",
		fontWeight: 600,
		letterSpacing: 0,
	},

	internalTab: {
		minWidth: 120,
		width: 120,
		padding: 5,
		textTransform: "none",
		fontWeight: 600,
	},

	ticketOptionsBox: {
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		background: "#fff",
		padding: theme.spacing(1.25, 1.25),
		gap: theme.spacing(1),
		borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
	},

	ticketSearchLine: {
		padding: theme.spacing(1),
	},

	serachInputWrapper: {
		flex: 1,
		background: "rgba(15, 23, 42, 0.04)",
		display: "flex",
		borderRadius: 12,
		padding: theme.spacing(0.75, 1),
		marginRight: theme.spacing(1),
		border: "1px solid rgba(15, 23, 42, 0.08)",
		transition: "box-shadow 120ms ease, border-color 120ms ease",
		"&:focus-within": {
			borderColor: "rgba(59, 130, 246, 0.55)",
			boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.18)",
		},
	},

	searchIcon: {
		color: "rgba(15, 23, 42, 0.55)",
		marginRight: 8,
		alignSelf: "center",
	},

	searchInput: {
		flex: 1,
		border: "none",
		borderRadius: 10,
	},

	insiderTabPanel: {
		height: '100%',
		marginTop: "-72px",
		paddingTop: "72px"
	},

	insiderDoubleTabPanel: {
		display:"flex",
		flexDirection: "column",
		marginTop: "-72px",
		paddingTop: "72px",
		height: "100%"
	},

	labelContainer: {
		width: "auto",
		padding: 0
	},
	iconLabelWrapper: {
		flexDirection: "row",
		'& > *:first-child': {
			marginBottom: '3px !important',
			marginRight: 12
		}
	},
	insiderTabLabel: {
		[theme.breakpoints.down(1600)]: {
			display:'none'
		}
	},
	smallFormControl: {
		'& .MuiOutlinedInput-input': {
			padding: "12px 10px",
		},
		'& .MuiInputLabel-outlined': {
			marginTop: "-6px"
		}
	},
	primaryActions: {
		display: "flex",
		alignItems: "center",
		gap: theme.spacing(1),
	},
	newTicketButton: {
		borderRadius: 12,
		textTransform: "none",
		fontWeight: 700,
	},
	queueWrap: {
		display: "flex",
		alignItems: "center",
		gap: 6,
	},
	queueLabel: {
		display: "flex",
		alignItems: "center",
		gap: 6,
		fontSize: 12,
		fontWeight: 700,
		color: "rgba(15, 23, 42, 0.62)",
		whiteSpace: "nowrap",
	}
}));

const TicketsManagerTabs = () => {
  const classes = useStyles();
  const history = useHistory();

  const [searchParam, setSearchParam] = useState("");
  const [tab, setTab] = useState("open");
  const [tabOpen, setTabOpen] = useState("open");
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [showAllTickets, setShowAllTickets] = useState(false);
  const searchInputRef = useRef();
  const { user } = useContext(AuthContext);
  const { profile } = user || {};

  const [openCount, setOpenCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  const userQueueIds = (user?.queues || []).map((q) => q.id);
  const [selectedQueueIds, setSelectedQueueIds] = useState(userQueueIds || []);
  const [allQueues, setAllQueues] = useState([]);
  const { findAll } = useQueues();
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);

  useEffect(() => {
    const p = (user?.profile || "").toString().toUpperCase();
    if (p === "ADMIN") {
      setShowAllTickets(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When user data loads async, keep queue filter in sync (without changing any fetch logic)
  useEffect(() => {
    if (Array.isArray(userQueueIds) && userQueueIds.length > 0) {
      setSelectedQueueIds((prev) => {
        if (Array.isArray(prev) && prev.length > 0) return prev;
        return userQueueIds;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userQueueIds.join(",")]);

  // Admin can see all queues in the filter even if user.queues is empty
  useEffect(() => {
    const p = (user?.profile || "").toString().toUpperCase();
    if (p !== "ADMIN") return;
    (async () => {
      try {
        let data = await findAll();
        if (!Array.isArray(data) || data.length === 0) {
          try {
            const alt = await api.get("/queue-list");
            data = alt.data;
          } catch (_) {}
        }
        setAllQueues(Array.isArray(data) ? data : []);
      } catch (_) {
        setAllQueues([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.profile]);

  const pUpper = (user?.profile || "").toString().toUpperCase();
  const queuesForSelect =
    pUpper === "ADMIN"
      ? (Array.isArray(allQueues) && allQueues.length > 0 ? allQueues : (user?.queues || []))
      : (user?.queues || []);

  useEffect(() => {
    if (tab === "search" && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [tab]);

  let searchTimeout;

  const handleSearch = (e) => {
    const searchedTerm = e.target.value.toLowerCase();

    clearTimeout(searchTimeout);

    if (searchedTerm === "") {
      setSearchParam(searchedTerm);
      setTab("open");
      return;
    }

    searchTimeout = setTimeout(() => {
      setSearchParam(searchedTerm);
    }, 500);
  };

  const handleChangeTab = (e, newValue) => {
    setTab(newValue);
  };

  const handleChangeTabOpen = (e, newValue) => {
    setTabOpen(newValue);
  };

  const applyPanelStyle = (status) => {
    if (tabOpen !== status) {
      return { width: 0, height: 0 };
    }
  };

  const handleCloseOrOpenTicket = (ticket) => {
    setNewTicketModalOpen(false);
    if (ticket !== undefined && ticket.uuid !== undefined) {
      history.push(`/tickets/${ticket.uuid}`);
    }
  };

  const handleSelectedTags = (selecteds) => {
    const tags = selecteds.map((t) => t.id);
    setSelectedTags(tags);
  };

  const handleSelectedUsers = (selecteds) => {
    const users = selecteds.map((t) => t.id);
    setSelectedUsers(users);
  };

  return (
    <Paper elevation={0} variant="outlined" className={classes.ticketsWrapper}>
      <NewTicketModal
        modalOpen={newTicketModalOpen}
        onClose={(ticket) => {
          
          handleCloseOrOpenTicket(ticket);
        }}
      />
      <Paper elevation={0} square className={classes.tabsHeader}>
        <Tabs
          value={tab}
          onChange={handleChangeTab}
          variant="fullWidth"
          indicatorColor="primary"
          textColor="primary"
          aria-label="icon label tabs example"
        >
          <Tab
            value={"open"}
            icon={<InboxOutlinedIcon />}
            label={i18n.t("tickets.tabs.open.title")}
            classes={{ root: classes.tab, wrapper: classes.iconLabelWrapper }}
          />
          <Tab
            value={"closed"}
            icon={<CheckCircleOutlineIcon />}
            label={i18n.t("tickets.tabs.closed.title")}
            classes={{ root: classes.tab, wrapper: classes.iconLabelWrapper }}
          />
          <Tab
            value={"search"}
            icon={<SearchOutlinedIcon />}
            label={i18n.t("tickets.tabs.search.title")}
            classes={{ root: classes.tab, wrapper: classes.iconLabelWrapper }}
          />
        </Tabs>
      </Paper>
      <Paper square elevation={0} className={classes.ticketOptionsBox}>
        {tab === "search" ? (
          <div className={classes.serachInputWrapper}>
            <SearchOutlinedIcon className={classes.searchIcon} />
            <InputBase
              className={classes.searchInput}
              inputRef={searchInputRef}
              placeholder={i18n.t("tickets.search.placeholder")}
              type="search"
              onChange={handleSearch}
            />
          </div>
        ) : (
          <>
            <div className={classes.primaryActions}>
              <Button
                className={classes.newTicketButton}
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={() => setNewTicketModalOpen(true)}
              >
                {i18n.t("ticketsManager.buttons.newTicket")}
              </Button>
            </div>
            <Can
              role={user?.profile || "user"}
              perform="tickets-manager:showall"
              yes={() => (
                <FormControlLabel
                  label={i18n.t("tickets.buttons.showAll")}
                  labelPlacement="start"
                  control={
                    <Switch
                      size="small"
                      checked={showAllTickets}
                      onChange={() =>
                        setShowAllTickets((prevState) => !prevState)
                      }
                      name="showAllTickets"
                      color="primary"
                    />
                  }
                />
              )}
            />
          </>
        )}
        <div className={classes.queueWrap}>
          <div className={classes.queueLabel}>
            <TuneOutlinedIcon style={{ fontSize: 18 }} />
            {i18n.t("ticketsQueueSelect.placeholder")}
          </div>
          <TicketsQueueSelect
            style={{ marginLeft: 0 }}
            selectedQueueIds={selectedQueueIds}
            userQueues={queuesForSelect}
            onChange={(values) => setSelectedQueueIds(values)}
          />
        </div>
      </Paper>
      <TabPanel value={tab} name="open" className={classes.ticketsWrapper}>
        <Tabs
          value={tabOpen}
          onChange={handleChangeTabOpen}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab
            label={
              <Badge
                className={classes.badge}
                badgeContent={openCount}
                color="primary"
              >
                {i18n.t("ticketsList.assignedHeader")}
              </Badge>
            }
            value={"open"}
          />
          <Tab
            label={
              <Badge
                className={classes.badge}
                badgeContent={pendingCount}
                color="secondary"
              >
                {i18n.t("ticketsList.pendingHeader")}
              </Badge>
            }
            value={"pending"}
          />
        </Tabs>
        <Paper className={classes.ticketsWrapper}>
          <TicketsList
            status="open"
            showAll={showAllTickets}
            selectedQueueIds={selectedQueueIds}
            updateCount={(val) => setOpenCount(val)}
            style={applyPanelStyle("open")}
          />
          <TicketsList
            status="pending"
            selectedQueueIds={selectedQueueIds}
            updateCount={(val) => setPendingCount(val)}
            style={applyPanelStyle("pending")}
          />
        </Paper>
      </TabPanel>
      <TabPanel value={tab} name="closed" className={classes.ticketsWrapper}>
        <TicketsList
          status="closed"
          showAll={true}
          selectedQueueIds={selectedQueueIds}
        />
      </TabPanel>
      <TabPanel value={tab} name="search" className={classes.ticketsWrapper}>
        <TagsFilter onFiltered={handleSelectedTags} />
        {profile === "admin" && (
          <UsersFilter onFiltered={handleSelectedUsers} />
        )}
        <TicketsList
          searchParam={searchParam}
          showAll={true}
          tags={selectedTags}
          users={selectedUsers}
          selectedQueueIds={selectedQueueIds}
        />
      </TabPanel>
    </Paper>
  );
};

export default TicketsManagerTabs;
