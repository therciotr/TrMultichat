import React from "react";

import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import Select from "@material-ui/core/Select";
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
	select: {
		backgroundColor: "rgba(15, 23, 42, 0.04)",
		borderRadius: 12,
	},
	outlined: {
		"& .MuiOutlinedInput-notchedOutline": {
			borderColor: "rgba(15, 23, 42, 0.10)",
		},
		"&:hover .MuiOutlinedInput-notchedOutline": {
			borderColor: "rgba(15, 23, 42, 0.18)",
		},
		"&.Mui-focused .MuiOutlinedInput-notchedOutline": {
			borderColor: "rgba(59, 130, 246, 0.60)",
			boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.18)",
		},
	},
	input: {
		paddingTop: 10,
		paddingBottom: 10,
		fontSize: 13,
	},
}));

const TicketsQueueSelect = ({
	userQueues,
	selectedQueueIds = [],
	onChange,
}) => {
	const classes = useStyles();
	const handleChange = e => {
		onChange(e.target.value);
	};

	return (
		<div className={classes.root}>
			<FormControl className={classes.formControl} fullWidth margin="dense">
				<Select
					multiple
					displayEmpty
					variant="outlined"
					value={selectedQueueIds}
					onChange={handleChange}
					className={classes.outlined}
					classes={{ outlined: classes.select }}
					inputProps={{ className: classes.input }}
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
