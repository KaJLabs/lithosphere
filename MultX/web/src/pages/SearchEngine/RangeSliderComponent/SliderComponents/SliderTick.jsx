import "../styles/styles.scss";


export function SliderTick({ tick, count, format }) {
	return (
		<div>
			<div className="tick" style={{ left: `${tick.percent}%` }} />
			<div
				className="label"
				style={{
					marginLeft: `${-(100 / count) / 2}%`,
					width: `${100 / count}%`,
					left: `${tick.percent}%`,
				}}
			>
				{format(tick.value)}
			</div>
		</div>
	);
}
SliderTick.defaultProps = {
	format: (d) => d,
};
