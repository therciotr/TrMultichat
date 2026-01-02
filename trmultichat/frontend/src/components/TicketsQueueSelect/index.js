import React from "react";

import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import Select from "@material-ui/core/Select";
import OutlinedInput from "@material-ui/core/OutlinedInput";
import { Checkbox, ListItemText } from "@material-ui/core";
import { i18n } from "../../translate/i18n";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
	root: {
		width: 160,
	},
	formControl: {
		margin: 0,
	},
	input: {
		paddingTop: 10,
		paddingBottom: 10,
		paddingLeft: 12,
		paddingRight: 32,
		fontSize: 13,
	},
	notchedOutline: {
		borderColor: "rgba(15, 23, 42, 0.10)",
	},
	outlinedRoot: {
		borderRadius: 12,
		backgroundColor: "rgba(15, 23, 42, 0.04)",
		"&:hover $notchedOutline": {
			borderColor: "rgba(15, 23, 42, 0.18)",
		},
		"&.Mui-focused $notchedOutline": {
			borderColor: "rgba(59, 130, 246, 0.60)",
		},
		"&.Mui-focused": {
			boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.18)",
		},
	},
	menuPaper: {
		marginTop: 8,
		borderRadius: 12,
		border: "1px solid rgba(15, 23, 42, 0.10)",
		boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12)",
	},
}));

const TicketsQueueSelect = ({
	userQueues,
	selectedQueueIds = [],
	onChange,
	style,
}) => {
	const classes = useStyles();
	const handleChange = e => {
		onChange(e.target.value);
	};

	return (
		<div className={classes.root} style={style}>
			<FormControl className={classes.formControl} fullWidth margin="dense">
				<Select
					multiple
					displayEmpty
					variant="outlined"
					value={selectedQueueIds}
					onChange={handleChange}
					input={
						<OutlinedInput
							classes={{
								root: classes.outlinedRoot,
								notchedOutline: classes.notchedOutline,
								input: classes.input,
							}}
						/>
					}
					MenuProps={{
						anchorOrigin: {
							vertical: "bottom",
							horizontal: "left",
						},
						transformOrigin: {
							vertical: "top",
							horizontal: "left",
						},
						getContentAnchorEl: null,
						PaperProps: { className: classes.menuPaper },
					}}
					renderValue={() => i18n.t("ticketsQueueSelect.placeholder")}
				>
					{userQueues?.length > 0 &&
						userQueues.map(queue => (
							<MenuItem dense key={queue.id} value={queue.id}>
								<Checkbox
									style={{
										color: queue.color,
									}}
									size="small"
									color="primary"
									checked={selectedQueueIds.indexOf(queue.id) > -1}
								/>
								<ListItemText primary={queue.name} />
							</MenuItem>
						))}
				</Select>
			</FormControl>
		</div>
	);
};

export default TicketsQueueSelect;
