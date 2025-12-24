const TradeSymbols = [
    { symbol: "GBP/CAD", img: "gbpcad.svg" },
    { symbol: "GBP/USD", img: "gbpusd.svg" },
    { symbol: "GBP/NZD", img: "gbpnzd.svg" },
    { symbol: "GBP/CHF", img: "gbpchf.svg" },
    { symbol: "GBP/AUD", img: "gbpaud.svg" },
    { symbol: "EUR/USD", img: "eurusd.svg" },
    { symbol: "USD/CAD", img: "usdcad.svg" },
    { symbol: "AUD/CAD", img: "audcad.svg" },
    { symbol: "EUR/GBP", img: "eurgbp.svg" },
    { symbol: "EUR/AUD", img: "euraud.svg" },
    { symbol: "EUR/NZD", img: "eurnzd.svg" },
    { symbol: "EUR/CHF", img: "eurchf.svg" },
    { symbol: "USD/CHF", img: "usdchf.svg" },
    { symbol: "NZD/USD", img: "nzdusd.svg" },
    { symbol: "GBP/JPY", img: "gbpjpy.svg" },
    { symbol: "USD/JPY", img: "usdjpy.svg" },
    { symbol: "NZD/JPY", img: "nzdjpy.svg" },
    { symbol: "NZD/CAD", img: "nzdcad.svg" },
    { symbol: "NZD/CHF", img: "nzdchf.svg" },
    { symbol: "EUR/JPY", img: "eurjpy.svg" },
    { symbol: "EUR/CAD", img: "eurcad.svg" },
    { symbol: "CAD/JPY", img: "cadjpy.svg" },
    { symbol: "CAD/CHF", img: "cadchf.svg" },
    { symbol: "AUD/USD", img: "audusd.svg" },
    { symbol: "AUD/NZD", img: "audnzd.svg" },
    { symbol: "AUD/JPY", img: "audjpy.svg" },
    { symbol: "AUD/CHF", img: "audchf.svg" },
    { symbol: "XAU/USD", img: "gold.png" },
    { symbol: "XAG/USD", img: "silver.png" },
    { symbol: "BTC/USD", img: "bitcoin.svg" },
    { symbol: "ETH/USD", img: "ethereum.svg" },
];

export const TradeSymbolIconMap = TradeSymbols.reduce((acc, item) => {
    acc[item.symbol] = `${item.img}`;
    return acc;
}, {});

export default TradeSymbols;
