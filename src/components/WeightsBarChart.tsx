// import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { BarChart, Bar, XAxis, YAxis } from "recharts";
import { computePointColor } from "../utilities/computePointColor";
import { rgbToString } from "../utilities/hexToRgb";
import type { MapTheme } from "../App";

interface WeightsBarChartProps {
  data: Array<{ metabolite: string; p1: number }>;
  theme: MapTheme;
}

export const WeightsBarChart = ({ data, theme }: WeightsBarChartProps) => {
// Transform data to include computed colors
  const coloredData = data.map(d => ({
    ...d,
    fill: rgbToString(computePointColor(d.p1, theme)),
  }));

return (
//   <ResponsiveContainer width="100%" height={300}>
    <BarChart 
    // style={{ width: '100%', maxWidth: '700px', maxHeight: '100vh', aspectRatio: 0.25 }}
    style={{ width: '40vh', height: '75vh' }}
    responsive
    data={coloredData}
    layout="vertical"
    margin={{
        top: 1,
        right: 1,
        left: 1,
        bottom: 1,
      }}
    >
      <XAxis
      hide
      width="auto"
      type="number"
      axisLine={false}
      tickLine={false}
      />
      <YAxis 
      dataKey="metabolite" 
      type = "category" 
      textAnchor="end" 
      width={200}
      axisLine={false}
      tickLine={false}
      fontSize="rem"
    //   niceTicks="none"
      interval={0}
      />
      {/* <Tooltip /> */}
      {/* <Bar dataKey="p1" fill="#22c55e" />  // Use your theme color */}
      <Bar dataKey="p1" fill="inherit" />
    </BarChart>
//   </ResponsiveContainer>
      );
};