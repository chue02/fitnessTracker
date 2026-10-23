import LineChart from './LineChart.jsx'

// A PR progression as a step line: each record holds until the next one beats
// it, and the last runs on to today because it still stands.
//
// Takes LineChart's props (`points`, `label`, `time`, `lowerIsBetter`, …);
// this only fixes the PR-specific drawing mode.
export default function PrChart(props) {
  return <LineChart step extendToToday {...props} label={`${props.label} PR`} />
}
