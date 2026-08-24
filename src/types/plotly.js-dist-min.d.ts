declare module "plotly.js-dist-min" {
  const Plotly: {
    newPlot: (...args: any[]) => Promise<any>;
    toImage: (element: any, options: any) => Promise<string>;
    react: (...args: any[]) => Promise<any>;
    [key: string]: any;
  };
  export default Plotly;
}
