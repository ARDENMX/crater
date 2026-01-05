
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { SSEServerTransport } = require("@modelcontextprotocol/sdk/server/sse.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const express = require('express');
const cors = require('cors');
const z = require('zod');
const CraterApiClient = require('./src/api_client');
require('dotenv').config();

const app = express();
app.use(cors());

// Initialize API Client
const CRATER_URL = process.env.CRATER_URL || 'http://localhost';
const CRATER_EMAIL = process.env.CRATER_EMAIL;
const CRATER_PASSWORD = process.env.CRATER_PASSWORD;
const CRATER_API_TOKEN = process.env.CRATER_API_TOKEN;
const MCP_SERVER_TOKEN = process.env.MCP_SERVER_TOKEN;

const api = new CraterApiClient(CRATER_URL, CRATER_EMAIL, CRATER_PASSWORD, CRATER_API_TOKEN);

// Middleware for Auth
const authMiddleware = (req, res, next) => {
    if (!MCP_SERVER_TOKEN) {
        // If no token is set, assume open access (DEV ONLY) or internal network trust.
        // However, for production with Nginx exposure, this should be set.
        return next();
    }

    const authHeader = req.headers['authorization'] || req.headers['x-mcp-token'];
    
    // Support "Bearer <token>" or just "<token>"
    const token = authHeader && authHeader.startsWith('Bearer ') 
        ? authHeader.slice(7) 
        : authHeader;

    if (token === MCP_SERVER_TOKEN) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized: Invalid MCP Server Token' });
    }
};

// Create MCP Server
const server = new McpServer({
  name: "Crater MCP",
  version: "1.0.0",
});

// Define Tools

// Customer Tools
server.tool(
  "create_customer",
  "Create a new customer in Crater.",
  {
    name: z.string().describe("Customer Name"),
    email: z.string().email().optional().describe("Customer Email"),
    currency_id: z.number().optional(),
    password: z.string().optional(),
    phone: z.string().optional(),
    company_name: z.string().optional(),
    contact_name: z.string().optional(),
    website: z.string().optional(),
    enable_portal: z.boolean().optional(),
    billing: z.object({
        name: z.string().optional(),
        address_street_1: z.string().optional(),
        address_street_2: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country_id: z.number().optional(),
        zip: z.string().optional(),
        phone: z.string().optional()
    }).optional(),
    shipping: z.object({
        name: z.string().optional(),
        address_street_1: z.string().optional(),
        address_street_2: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country_id: z.number().optional(),
        zip: z.string().optional(),
        phone: z.string().optional()
    }).optional()
  },
  async (args) => {
    try {
      const customer = await api.createCustomer(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(customer, null, 2),
          },
        ],
      };
    } catch (error) {
       return {
        content: [{ type: "text", text: `Error creating customer: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "list_customers",
  "List all customers.",
  {
    limit: z.number().optional(),
    page: z.number().optional(),
    query: z.string().optional().describe("Search query")
  },
  async (args) => {
     try {
      const customers = await api.listCustomers(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(customers, null, 2),
          },
        ],
      };
    } catch (error) {
       return {
        content: [{ type: "text", text: `Error listing customers: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_customer",
  "Get a specific customer by ID.",
  {
    id: z.number().describe("Customer ID")
  },
  async ({ id }) => {
    try {
      const customer = await api.getCustomer(id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(customer, null, 2),
          },
        ],
      };
    } catch (error) {
       return {
        content: [{ type: "text", text: `Error getting customer: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "update_customer",
  "Update a specific customer.",
  {
    id: z.number().describe("Customer ID"),
    name: z.string().optional(),
    email: z.string().email().optional(),
    currency_id: z.number().optional(),
    phone: z.string().optional(),
    company_name: z.string().optional(),
    contact_name: z.string().optional(),
    website: z.string().optional(),
    enable_portal: z.boolean().optional(),
  },
  async (args) => {
    const { id, ...data } = args;
    try {
      const customer = await api.updateCustomer(id, data);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(customer, null, 2),
          },
        ],
      };
    } catch (error) {
       return {
        content: [{ type: "text", text: `Error updating customer: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
    "delete_customer",
    "Delete one or more customers",
    {
        ids: z.array(z.number()).describe("Array of Customer IDs to delete")
    },
    async ({ids}) => {
        try {
            const result = await api.deleteCustomer(ids);
            return {
                content: [{type: "text", text: JSON.stringify(result, null, 2)}]
            }
        } catch (error) {
            return {
                content: [{ type: "text", text: `Error deleting customer: ${error.message}` }],
                isError: true,
            };
        }
    }
)


// Invoice Tools
server.tool(
  "create_invoice",
  "Create a new invoice.",
  {
    invoice_date: z.string().describe("Invoice Date (YYYY-MM-DD)"),
    due_date: z.string().optional().describe("Due Date (YYYY-MM-DD)"),
    customer_id: z.number().describe("Customer ID"),
    invoice_number: z.string().describe("Invoice Number"),
    discount: z.number().optional(),
    discount_val: z.number().optional(),
    sub_total: z.number().optional(),
    total: z.number().optional(),
    tax: z.number().optional(),
    template_name: z.string().optional().default('Invoice'),
    items: z.array(z.object({
        name: z.string(),
        quantity: z.number(),
        price: z.number(),
        description: z.string().optional(),
        unit_id: z.number().optional()
    })).describe("List of items")
  },
  async (args) => {
    try {
      const invoice = await api.createInvoice(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(invoice, null, 2),
          },
        ],
      };
    } catch (error) {
       return {
        content: [{ type: "text", text: `Error creating invoice: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "list_invoices",
  "List all invoices.",
  {
    limit: z.number().optional(),
    page: z.number().optional(),
    query: z.string().optional()
  },
  async (args) => {
    try {
      const invoices = await api.listInvoices(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(invoices, null, 2),
          },
        ],
      };
    } catch (error) {
       return {
        content: [{ type: "text", text: `Error listing invoices: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_invoice",
  "Get a specific invoice by ID.",
  {
    id: z.number().describe("Invoice ID")
  },
  async ({ id }) => {
    try {
      const invoice = await api.getInvoice(id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(invoice, null, 2),
          },
        ],
      };
    } catch (error) {
       return {
        content: [{ type: "text", text: `Error getting invoice: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "update_invoice",
  "Update a specific invoice.",
  {
    id: z.number().describe("Invoice ID"),
    invoice_date: z.string().optional(),
    due_date: z.string().optional(),
    customer_id: z.number().optional(),
    invoice_number: z.string().optional(),
    discount: z.number().optional(),
    discount_val: z.number().optional(),
    sub_total: z.number().optional(),
    total: z.number().optional(),
    tax: z.number().optional(),
    items: z.array(z.object({
        name: z.string(),
        quantity: z.number(),
        price: z.number(),
        description: z.string().optional(),
        unit_id: z.number().optional()
    })).optional()
  },
  async (args) => {
    const { id, ...data } = args;
    try {
      const invoice = await api.updateInvoice(id, data);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(invoice, null, 2),
          },
        ],
      };
    } catch (error) {
       return {
        content: [{ type: "text", text: `Error updating invoice: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
    "delete_invoice",
    "Delete one or more invoices",
    {
        ids: z.array(z.number()).describe("Array of Invoice IDs to delete")
    },
    async ({ids}) => {
        try {
            const result = await api.deleteInvoice(ids);
            return {
                content: [{type: "text", text: JSON.stringify(result, null, 2)}]
            }
        } catch (error) {
            return {
                content: [{ type: "text", text: `Error deleting invoice: ${error.message}` }],
                isError: true,
            };
        }
    }
)

server.tool(
  "send_invoice",
  "Send an invoice via email.",
  {
    id: z.number().describe("Invoice ID"),
    to: z.string().email().optional(),
    subject: z.string().optional(),
    message: z.string().optional()
  },
  async (args) => {
      const { id, ...data } = args;
    try {
      const result = await api.sendInvoice(id, data);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
       return {
        content: [{ type: "text", text: `Error sending invoice: ${error.message}` }],
        isError: true,
      };
    }
  }
);

// Estimate Tools
server.tool(
    "create_estimate",
    "Create a new estimate.",
    {
      estimate_date: z.string().describe("Estimate Date (YYYY-MM-DD)"),
      expiry_date: z.string().optional().describe("Expiry Date (YYYY-MM-DD)"),
      customer_id: z.number().describe("Customer ID"),
      estimate_number: z.string().describe("Estimate Number"),
      discount: z.number().optional(),
      discount_val: z.number().optional(),
      sub_total: z.number().optional(),
      total: z.number().optional(),
      tax: z.number().optional(),
      template_name: z.string().optional().default('Estimate'),
      items: z.array(z.object({
          name: z.string(),
          quantity: z.number(),
          price: z.number(),
          description: z.string().optional(),
          unit_id: z.number().optional()
      })).describe("List of items")
    },
    async (args) => {
      try {
        const estimate = await api.createEstimate(args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(estimate, null, 2),
            },
          ],
        };
      } catch (error) {
         return {
          content: [{ type: "text", text: `Error creating estimate: ${error.message}` }],
          isError: true,
        };
      }
    }
  );

server.tool(
  "list_estimates",
  "List all estimates.",
  {
    limit: z.number().optional(),
    page: z.number().optional(),
    query: z.string().optional()
  },
  async (args) => {
    try {
      const estimates = await api.listEstimates(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(estimates, null, 2),
          },
        ],
      };
    } catch (error) {
       return {
        content: [{ type: "text", text: `Error listing estimates: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_estimate",
  "Get a specific estimate by ID.",
  {
    id: z.number().describe("Estimate ID")
  },
  async ({ id }) => {
    try {
      const estimate = await api.getEstimate(id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(estimate, null, 2),
          },
        ],
      };
    } catch (error) {
       return {
        content: [{ type: "text", text: `Error getting estimate: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "update_estimate",
  "Update a specific estimate.",
  {
    id: z.number().describe("Estimate ID"),
    estimate_date: z.string().optional(),
    expiry_date: z.string().optional(),
    customer_id: z.number().optional(),
    estimate_number: z.string().optional(),
    discount: z.number().optional(),
    discount_val: z.number().optional(),
    sub_total: z.number().optional(),
    total: z.number().optional(),
    tax: z.number().optional(),
    items: z.array(z.object({
        name: z.string(),
        quantity: z.number(),
        price: z.number(),
        description: z.string().optional(),
        unit_id: z.number().optional()
    })).optional()
  },
  async (args) => {
    const { id, ...data } = args;
    try {
      const estimate = await api.updateEstimate(id, data);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(estimate, null, 2),
          },
        ],
      };
    } catch (error) {
       return {
        content: [{ type: "text", text: `Error updating estimate: ${error.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
    "delete_estimate",
    "Delete one or more estimates",
    {
        ids: z.array(z.number()).describe("Array of Estimate IDs to delete")
    },
    async ({ids}) => {
        try {
            const result = await api.deleteEstimate(ids);
            return {
                content: [{type: "text", text: JSON.stringify(result, null, 2)}]
            }
        } catch (error) {
            return {
                content: [{ type: "text", text: `Error deleting estimate: ${error.message}` }],
                isError: true,
            };
        }
    }
)

// Expense Tools
server.tool(
    "create_expense",
    "Create a new expense.",
    {
        expense_category_id: z.number(),
        amount: z.number(),
        expense_date: z.string(),
        notes: z.string().optional(),
        customer_id: z.number().optional(),
        currency_id: z.number()
    },
    async (args) => {
        try {
            const expense = await api.createExpense(args);
            return {
                content: [{type: "text", text: JSON.stringify(expense, null, 2)}]
            }
        } catch (error) {
            return {
                content: [{ type: "text", text: `Error creating expense: ${error.message}` }],
                isError: true,
            };
        }
    }
)

server.tool(
    "list_expenses",
    "List all expenses.",
    {
        limit: z.number().optional(),
        page: z.number().optional(),
        query: z.string().optional()
    },
    async (args) => {
        try {
            const expenses = await api.listExpenses(args);
            return {
                content: [{type: "text", text: JSON.stringify(expenses, null, 2)}]
            }
        } catch (error) {
            return {
                content: [{ type: "text", text: `Error listing expenses: ${error.message}` }],
                isError: true,
            };
        }
    }
)

server.tool(
    "get_expense",
    "Get a specific expense by ID.",
    {
        id: z.number().describe("Expense ID")
    },
    async ({ id }) => {
        try {
            const expense = await api.getExpense(id);
            return {
                content: [{type: "text", text: JSON.stringify(expense, null, 2)}]
            }
        } catch (error) {
            return {
                content: [{ type: "text", text: `Error getting expense: ${error.message}` }],
                isError: true,
            };
        }
    }
)

server.tool(
    "delete_expense",
    "Delete one or more expenses.",
    {
        ids: z.array(z.number()).describe("Array of Expense IDs to delete")
    },
    async ({ids}) => {
        try {
            const result = await api.deleteExpense(ids);
            return {
                content: [{type: "text", text: JSON.stringify(result, null, 2)}]
            }
        } catch (error) {
            return {
                content: [{ type: "text", text: `Error deleting expense: ${error.message}` }],
                isError: true,
            };
        }
    }
)

// Payment Tools
server.tool(
    "create_payment",
    "Record a payment.",
    {
        payment_date: z.string(),
        customer_id: z.number(),
        amount: z.number(),
        payment_number: z.string(),
        invoice_id: z.number().optional(),
        payment_method_id: z.number().optional(),
        notes: z.string().optional()
    },
    async (args) => {
        try {
            const payment = await api.createPayment(args);
            return {
                content: [{type: "text", text: JSON.stringify(payment, null, 2)}]
            }
        } catch(error) {
            return {
                content: [{ type: "text", text: `Error creating payment: ${error.message}` }],
                isError: true,
            };
        }
    }
)

server.tool(
    "list_payments",
    "List all payments.",
    {
        limit: z.number().optional(),
        page: z.number().optional(),
        query: z.string().optional()
    },
    async (args) => {
        try {
            const payments = await api.listPayments(args);
            return {
                content: [{type: "text", text: JSON.stringify(payments, null, 2)}]
            }
        } catch(error) {
            return {
                content: [{ type: "text", text: `Error listing payments: ${error.message}` }],
                isError: true,
            };
        }
    }
)


// Item Tools
server.tool(
    "create_item",
    "Create a new item/product.",
    {
        name: z.string(),
        price: z.number(),
        unit_id: z.number().optional(),
        description: z.string().optional()
    },
    async (args) => {
        try {
            const item = await api.createItem(args);
             return {
                content: [{type: "text", text: JSON.stringify(item, null, 2)}]
            }
        } catch (error) {
             return {
                content: [{ type: "text", text: `Error creating item: ${error.message}` }],
                isError: true,
            };
        }
    }
)

server.tool(
    "list_items",
    "List all items",
    {
        limit: z.number().optional(),
        page: z.number().optional(),
        query: z.string().optional()
    },
    async (args) => {
         try {
            const items = await api.listItems(args);
             return {
                content: [{type: "text", text: JSON.stringify(items, null, 2)}]
            }
        } catch (error) {
             return {
                content: [{ type: "text", text: `Error listing items: ${error.message}` }],
                isError: true,
            };
        }
    }
)

server.tool(
  "get_settings",
  "Get company settings.",
  {},
  async () => {
    try {
      const settings = await api.getSettings();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(settings, null, 2),
          },
        ],
      };
    } catch (error) {
       return {
        content: [{ type: "text", text: `Error getting settings: ${error.message}` }],
        isError: true,
      };
    }
  }
);


// Start Server
if (process.argv.includes('--stdio')) {
    const transport = new StdioServerTransport();
    server.connect(transport).catch(console.error);
} else {
    // SSE Server
    app.get('/sse', authMiddleware, async (req, res) => {
        // The transport endpoint must be the public URL that clients (like Claude Desktop) use to send messages.
        // Since Nginx proxies /mcp/ to this service, the client needs to POST to /mcp/messages.
        const transport = new SSEServerTransport("/mcp/messages", res);
        await server.connect(transport);
    });

    app.post('/messages', authMiddleware, async (req, res) => {
        await server.handlePostMessage(req, res);
    });

    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`MCP Server running on port ${PORT}`);
        console.log(`SSE Endpoint: http://localhost:${PORT}/sse`);
    });
}
