export const rateSetterAbi = [
  {
    type: "function",
    name: "setRate",
    inputs: [
      { name: "usdcPerDot", type: "uint256" },
      { name: "dotPerUsdc", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "priceUpdatedAt",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getUsdcPerDot",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;
