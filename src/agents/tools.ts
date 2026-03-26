export const hunterTools = [
  {
    type: "function",
    function: {
      name: "execute_deployment",
      description: "Deploys capital into the specified DLMM pool using the calculated strategy.",
      parameters: {
        type: "object",
        properties: {
          poolAddress: {
            type: "string",
            description: "The Solana address of the DLMM pool"
          },
          strategyType: {
            type: "number",
            description: "0 for Spot, 1 for Curve, 2 for BidAsk"
          },
          binWidth: {
            type: "number",
            description: "Total number of bins to spread liquidity across (must be even for BidAsk)"
          },
          lamports: {
            type: "number",
            description: "Amount of capital to deploy in lamports (1 SOL = 1,000,000,000 lamports)"
          }
        },
        required: ["poolAddress", "strategyType", "binWidth", "lamports"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "reject_pool",
      description: "Rejects the current pool and logs the reason to memory.",
      parameters: {
        type: "object",
        properties: {
          poolAddress: {
            type: "string",
            description: "The Solana address of the DLMM pool"
          },
          reason: {
            type: "string",
            description: "Detailed reason for rejecting the pool deployment"
          }
        },
        required: ["poolAddress", "reason"]
      }
    }
  }
];
