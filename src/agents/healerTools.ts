export const healerTools = [
  {
    type: "function",
    function: {
      name: "close_position",
      description: "Closes the position completely, removing liquidity and claiming fees. Used for stop-loss or take-profit.",
      parameters: {
        type: "object",
        properties: {
          positionId: {
            type: "string",
            description: "The Pubkey of the position to close"
          },
          reason: {
            type: "string",
            description: "Reason for closing"
          }
        },
        required: ["positionId", "reason"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "redeploy_position",
      description: "Closes the current position and deploys a new one centered on the current active bin.",
      parameters: {
        type: "object",
        properties: {
          positionId: {
            type: "string",
            description: "The Pubkey of the position to redeploy"
          },
          reason: {
            type: "string",
            description: "Reason for redeploying"
          }
        },
        required: ["positionId", "reason"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "stay_position",
      description: "Do nothing to the position, letting it range accrue.",
      parameters: {
        type: "object",
        properties: {
          positionId: {
            type: "string",
            description: "The Pubkey of the position"
          },
          reason: {
            type: "string",
            description: "Reason for holding"
          }
        },
        required: ["positionId", "reason"]
      }
    }
  }
];
