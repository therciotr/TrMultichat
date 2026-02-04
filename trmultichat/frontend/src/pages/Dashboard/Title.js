import React from "react";
import Typography from "@material-ui/core/Typography";

const Title = props => {
	return (
		<Typography
			component="h2"
			variant="h6"
			gutterBottom
			style={{ color: "var(--tr-heading, var(--tr-primary))", fontWeight: 900, letterSpacing: "-0.01em" }}
		>
			{props.children}
		</Typography>
	);
};

export default Title;
