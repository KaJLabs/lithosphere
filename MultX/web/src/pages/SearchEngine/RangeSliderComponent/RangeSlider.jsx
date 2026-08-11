import React from "react";
// import { Grid, button, input, InputAdornment } from "@material-ui/core";
import { Slider, Rail, Handles, Tracks } from "react-compound-slider";
import { SliderHandle } from "./SliderComponents/SliderHandle.jsx";
import { SliderTrack } from "./SliderComponents/SliderTrack.jsx";
import { SliderRail } from "./SliderComponents/SliderRail.jsx";
import BarChart from "./SliderComponents/BarChart";

import CloseIcon from '../../../assets/icons/close.svg?react';
import DeleteIcon from '../../../assets/icons/delete-btn.svg?react';

class RangeSlider extends React.Component {
	constructor(props) {
		super(props);
		const range = props.range;

		this.state = {
			domain: range,
			update: range,
			values: range,
			inputValues: range,
		};
	}

	render() {
		const { domain, values, update, inputValues } = this.state;
		const { label, unit, range, handleFilterDelete, id } = this.props;

		return (
			<div className="rangeSlider">
				<div className="rangeSlider-wrapper">
					<span className="rangeSlider-wrapper-title">
						{label}{unit && `, ${unit}`}
						<span className="rangeSlider-wrapper-subtitle">
							{` `}(from-to)
						</span>
					</span>
					<div className="rangeSlider-input-wrapper">
						<div className="input-wrap">
							<input
								className="rangeSlider-input"
								label="starting_price"
								value={inputValues[0]}
								onChange={(evt) => {
									const value = evt.target.value;
									const newState = [value, inputValues[1]];
									this.setState({
										inputValues: newState,
									});
									if (value && value >= domain[0]) {
										this.setState({ values: newState });
									}
								}}
							/>
							<div className={`btn-wrap ${inputValues[0] !== range[0] ? "active" : ""}`} onClick={() => {
								const newState = [range[0], inputValues[1]];
								this.setState({
									inputValues: newState,
									values: newState,
									update: newState,
								})
							}} >
								<DeleteIcon />
							</div>
						</div>
						<div className="input-wrap">
							<input
								className="rangeSlider-input"
								label="max_price"
								value={inputValues[1]}
								onChange={(evt) => {
									const value = evt.target.value;
									const newState = [inputValues[0], value];
									this.setState({
										inputValues: newState,
									});
									if (
										value &&
										value <= domain[1] &&
										value >= values[0]
									) {
										this.setState({ values: newState });
									}
								}}
							/>
							<div className={`btn-wrap ${inputValues[1] !== range[1] ? "active" : ""}`} onClick={() => {
								const newState = [inputValues[0], range[1]];
								this.setState({
									inputValues: newState,
									values: newState,
									update: newState,
								})
							}} >
								<DeleteIcon />
							</div>
						</div>
					</div>
				</div>
				<div className="rangeSlider-main">
					<BarChart
						data={this.props.data}
						highlight={update}
						domain={domain}
					/>
					<Slider
						mode={3}
						step={1}
						domain={domain}
						rootStyle={{
							position: "relative",
							width: "100%",
						}}
						onUpdate={(update) =>
							this.setState({ update, inputValues: update })
						}
						onChange={(values) => this.setState({ values })}
						values={values}
					>
						<Rail>
							{({ getRailProps }) => (
								<SliderRail getRailProps={getRailProps} />
							)}
						</Rail>
						<Handles>
							{({ handles, getHandleProps }) => (
								<div className="slider-handles">
									{handles.map((handle) => (
										<SliderHandle
											key={handle.id}
											handle={handle}
											domain={domain}
											getHandleProps={getHandleProps}
										/>
									))}
								</div>
							)}
						</Handles>
						<Tracks left={false} right={false}>
							{({ tracks, getTrackProps }) => (
								<div className="slider-tracks">
									{tracks.map(({ id, source, target }) => (
										<SliderTrack
											key={id}
											source={source}
											target={target}
											getTrackProps={getTrackProps}
										/>
									))}
								</div>
							)}
						</Tracks>
					</Slider>
				</div>
					<CloseIcon className="rangeSlider-close" onClick={() => handleFilterDelete(id)}/>
			</div>
		);
	}
}

export default RangeSlider;
