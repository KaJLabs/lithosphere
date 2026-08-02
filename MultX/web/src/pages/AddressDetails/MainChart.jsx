import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import { useContext, useEffect, useRef } from 'react';
import { ThemeContext } from '../../context';

export const MainChartComponent = (props) => {
  const { theme } = useContext(ThemeContext);

  const {
    data,
    colors: {
      backgroundColor = theme ? '#fff' : '#151429',
      lineColor = '#25A50E',
      textColor = '#85828F',
      areaTopColor = 'rgba(37, 165, 14, 0.80)',
      areaBottomColor = theme ? '#FDFDFD' : 'rgba(21, 20, 41, 0.50)',
      horzLinesColor = theme ? 'rgba(146, 160, 186, 0.15)' : 'rgba(254, 254, 254, 0.05)'
    } = {}
  } = props;

  const chartContainerRef = useRef();

  useEffect(() => {
    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    };

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: backgroundColor },
        textColor
      },
      grid: {
        vertLines: {
          visible: false
        },
        horzLines: {
          color: horzLinesColor
        }
      },
      rightPriceScale: {
        borderColor: theme ? 'rgba(146, 160, 186, 0.15)' : 'rgba(254, 254, 254, 0.05)'
      },
      timeScale: {
        borderVisible: false,
      },
      crosshair: {
        mode: CrosshairMode.Magnet,

        vertLine: {
          color: '#5A588B',
          labelVisible: false
        },
        horzLine: {
          color: '#5A588B',
          labelVisible: false
        }
      },
      width: chartContainerRef.current.clientWidth,
      height: 600
    });

    chart.timeScale().fitContent();

    const newSeries = chart.addAreaSeries({
      crosshairMarkerBorderColor: theme ? '#333333' : '#fff',
      lineColor,
      topColor: areaTopColor,
      bottomColor: areaBottomColor,
      horzLinesColor
    });
    newSeries.setData(data);

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#00000000',
      downColor: '#00000000',
      borderVisible: false,
      wickDownColor: '#0B85FF'
    });
    candlestickSeries.setData(data);

    window.addEventListener('resize', handleResize);

    const toolTipWidth = 80;
    const toolTipHeight = 80;
    const toolTipMargin = 15;

    // Create and style the tooltip html element
    const toolTip = document.createElement('div');
    toolTip.style = `width: 300px; height: 118px; position: absolute; display: none; padding: 21px; box-sizing: border-box; font-size: 13px; z-index: 1000; top: 12px; left: 12px; pointer-events: none; border: 1px solid; border-radius: 5px; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;`;
    toolTip.style.background = theme
      ? '#FDFDFD'
      : 'linear-gradient(133deg, #151429 0%, #0D0D1F 100%)';
    toolTip.style.color = theme ? '#333333' : '#FFFFFF';
    toolTip.style.borderColor = theme ? 'rgba(146, 160, 186, 0.15)' : 'rgba(254, 254, 254, 0.05)';
    chartContainerRef.current.appendChild(toolTip);

    // update tooltip
    chart.subscribeCrosshairMove((param) => {
      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > chartContainerRef.current.clientWidth ||
        param.point.y < 0 ||
        param.point.y > chartContainerRef.current.clientHeight
      ) {
        toolTip.style.display = 'none';
      } else {
        // time will be in the same format that we supplied to setData.
        // thus it will be YYYY-MM-DD
        const dateStr = param.time;
        toolTip.style.display = 'block';
        const data = param.seriesData.get(newSeries);
        const price = data.value !== undefined ? data.value : data.close;
        toolTip.innerHTML = `
        <div style="display: flex; justify-content: space-between">
          <div>${new Date(dateStr * 1000).toLocaleDateString("en-US")}</div>
          <div style="color: ${theme ? '#85828f' : '#B2B2D9'}">${new Date(dateStr).toLocaleTimeString("en-US")}</div>
        </div>

        <div style="margin-top: 22px; display: flex; justify-content: space-between">
          <div style="color: ${theme ? '#85828f' : '#B2B2D9'}; display: flex; gap: 8px">
            <div style="width: 11px; height: 11px; background: #25A50E; border: 2px solid ${
              theme ? '#333333' : '#fff'
            }; border-radius: 50%"></div>

            Daily ROI:
          </div>

          ${(price + '').slice(1)[0]}%
        </div>

        <div style="margin-top: 16px; display: flex; justify-content: space-between">
          <div style="color: ${theme ? '#85828f' : '#B2B2D9'}; display: flex; gap: 8px">
            <div style="width: 11px; height: 11px; background: ${
              theme ? '#85828F' : '#B2B2D9'
            }; border: 2px solid ${theme ? '#333333' : '#fff'}; border-radius: 50%"></div>

            Vol 24h:
          </div>

          23.${(price + '')[0] + (price + '')[1]}M
        </div>
        `;

        const coordinate = newSeries.priceToCoordinate(price);
        let shiftedCoordinate = param.point.x - 50;
        if (coordinate === null) {
          return;
        }
        shiftedCoordinate = Math.max(
          0,
          Math.min(chartContainerRef.current.clientWidth - toolTipWidth, shiftedCoordinate)
        );
        const coordinateY =
          coordinate - toolTipHeight - toolTipMargin > 0
            ? coordinate - toolTipHeight - toolTipMargin
            : Math.max(
                0,
                Math.min(
                  chartContainerRef.current.clientHeight - toolTipHeight - toolTipMargin,
                  coordinate + toolTipMargin
                )
              );
        toolTip.style.left = shiftedCoordinate + 'px';
        toolTip.style.top = coordinateY + 'px';
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);

      chart.remove();
    };
  }, [
    data,
    backgroundColor,
    lineColor,
    textColor,
    areaTopColor,
    areaBottomColor,
    horzLinesColor,
    theme
  ]);

  return <div ref={chartContainerRef} />;
};

export const MainChart = (props) => {
  return <MainChartComponent {...props}></MainChartComponent>;
};
