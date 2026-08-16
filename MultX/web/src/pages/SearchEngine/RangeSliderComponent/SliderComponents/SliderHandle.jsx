import "../styles/styles.scss";


export function SliderHandle({
	domain: [min, max],
	handle: { id, value, percent },
	getHandleProps,
}) {
	const newId = id[3] == 0 ? "SliderDotLeft" : "SliderDotRigth";
	return (
		<div
			role="slider"
			aria-valuemin={min}
			aria-valuemax={max}
			aria-valuenow={value}
			className="root"
			id={newId}
			style={{ left: `${percent}%` }}
			{...getHandleProps(id)}
		/>
	);
}
