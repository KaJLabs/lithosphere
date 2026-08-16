import "../styles/styles.scss";

export function SliderRail({ getRailProps }) {
	return (
		<>
			<div className="railHotspot" {...getRailProps()} />
			<div className="rail" />
		</>
	);
}
