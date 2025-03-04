declare module 'react-chartjs-2' {
  import { ChartComponent, ChartData, ChartOptions } from 'chart.js';
  
  export interface ChartComponentProps {
    data: ChartData;
    options?: ChartOptions;
  }

  export const Line: React.FC<ChartComponentProps>;
  export const Bar: React.FC<ChartComponentProps>;
  export const Pie: React.FC<ChartComponentProps>;
}