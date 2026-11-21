
import "dotenv/config";
import express from "express";
import type { ErrorRequestHandler } from "express";
import cors from "cors";
import prisma from "./lib/prisma.js";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "healthy",
    application: "MilkDesk API"
  });
});

// Get customers by status
app.get("/api/customers", async (req, res) => {
  try {
    const status = req.query.status ?? "active";

    if (
      typeof status !== "string" ||
      !["active", "inactive", "all"].includes(status)
    ) {
      return res.status(400).json({
        error: "Status must be active, inactive, or all"
      });
    }

    const customers = await prisma.customer.findMany({
      where:
        status === "all"
          ? {}
          : { isActive: status === "active" },
      orderBy: { name: "asc" }
    });

    res.json(customers);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to fetch customers"
    });
  }
});

// Create a customer
app.post("/api/customers", async (req, res) => {
  try {
    const { name, phone, address, defaultRatePaise } = req.body ?? {};

    if (
      typeof name !== "string" ||
      !name.trim() ||
      !Number.isSafeInteger(defaultRatePaise) ||
      defaultRatePaise <= 0
    ) {
      return res.status(400).json({
        error: "Name and a valid milk rate are required"
      });
    }

    if (
      (phone !== undefined && phone !== null && typeof phone !== "string") ||
      (address !== undefined && address !== null && typeof address !== "string")
    ) {
      return res.status(400).json({
        error: "Phone and address must be text"
      });
    }

    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        defaultRatePaise
      }
    });

    res.status(201).json(customer);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to create customer"
    });
  }
});

// Edit a customer
app.patch("/api/customers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body ?? {};

    const existingCustomer = await prisma.customer.findUnique({
      where: { id }
    });

    if (!existingCustomer) {
      return res.status(404).json({
        error: "Customer not found"
      });
    }

    const data: {
      name?: string;
      phone?: string | null;
      address?: string | null;
      defaultRatePaise?: number;
    } = {};

    if ("name" in body) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return res.status(400).json({
          error: "Customer name cannot be empty"
        });
      }

      data.name = body.name.trim();
    }

    if ("phone" in body) {
      if (body.phone !== null && typeof body.phone !== "string") {
        return res.status(400).json({
          error: "Phone must be text or null"
        });
      }

      data.phone = body.phone?.trim() || null;
    }

    if ("address" in body) {
      if (body.address !== null && typeof body.address !== "string") {
        return res.status(400).json({
          error: "Address must be text or null"
        });
      }

      data.address = body.address?.trim() || null;
    }

    if ("defaultRatePaise" in body) {
      if (
        !Number.isSafeInteger(body.defaultRatePaise) ||
        body.defaultRatePaise <= 0
      ) {
        return res.status(400).json({
          error: "Milk rate must be a positive valid amount in paise"
        });
      }

      data.defaultRatePaise = body.defaultRatePaise;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        error: "Provide at least one customer field to update"
      });
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data
    });

    res.json({
      message: "Customer updated successfully",
      customer: updatedCustomer
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to update customer"
    });
  }
});

// Permanently delete a customer only if they have no transaction history
app.delete("/api/customers/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              deliveries: true,
              invoices: true,
              payments: true
            }
          }
        }
      });

      if (!customer) {
        return { type: "not_found" as const };
      }

      const counts = customer._count;

      if (
        counts.deliveries > 0 ||
        counts.invoices > 0 ||
        counts.payments > 0
      ) {
        return {
          type: "has_history" as const,
          name: customer.name,
          counts
        };
      }

      await tx.customer.delete({
        where: { id }
      });

      return {
        type: "deleted" as const,
        name: customer.name
      };
    });

    if (result.type === "not_found") {
      return res.status(404).json({
        error: "Customer not found"
      });
    }

    if (result.type === "has_history") {
      return res.status(409).json({
        error: "This customer has transaction history and cannot be permanently deleted. Deactivate the customer instead.",
        customer: result.name,
        history: result.counts
      });
    }

    res.json({
      message: "Customer permanently deleted",
      customer: result.name
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to delete customer"
    });
  }
});

// Deactivate a customer
app.patch("/api/customers/:id/deactivate", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body ?? {};

    if (
      typeof reason !== "string" ||
      !reason.trim() ||
      reason.trim().length > 500
    ) {
      return res.status(400).json({
        error: "A deactivation reason is required (maximum 500 characters)"
      });
    }

    const customer = await prisma.customer.findUnique({
      where: { id }
    });

    if (!customer) {
      return res.status(404).json({
        error: "Customer not found"
      });
    }

    if (!customer.isActive) {
      return res.status(409).json({
        error: "Customer is already inactive"
      });
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: {
        isActive: false,
        deactivatedAt: new Date(),
        deactivationReason: reason.trim()
      }
    });

    res.json({
      message: "Customer deactivated successfully",
      customer: updatedCustomer
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to deactivate customer"
    });
  }
});

// Reactivate a customer
app.patch("/api/customers/:id/reactivate", async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await prisma.customer.findUnique({
      where: { id }
    });

    if (!customer) {
      return res.status(404).json({
        error: "Customer not found"
      });
    }

    if (customer.isActive) {
      return res.status(409).json({
        error: "Customer is already active"
      });
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: {
        isActive: true
      }
    });

    res.json({
      message: "Customer reactivated successfully",
      customer: updatedCustomer
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to reactivate customer"
    });
  }
});

// Get recent milk deliveries
app.get("/api/deliveries", async (_req, res) => {
  try {
    const deliveries = await prisma.delivery.findMany({
      take: 100,
      orderBy: {
        deliveredAt: "desc"
      },
      include: {
        customer: {
          select: {
            name: true,
            phone: true
          }
        }
      }
    });

    res.json(deliveries);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to fetch deliveries"
    });
  }
});

// Record a milk delivery
app.post("/api/deliveries", async (req, res) => {
  try {
    const { customerId, quantityMl, deliveredAt, notes } = req.body ?? {};

    if (
      typeof customerId !== "string" ||
      !customerId.trim() ||
      !Number.isSafeInteger(quantityMl) ||
      quantityMl <= 0
    ) {
      return res.status(400).json({
        error: "A valid customer and milk quantity are required"
      });
    }

    if (notes !== undefined && notes !== null && typeof notes !== "string") {
      return res.status(400).json({
        error: "Notes must be text"
      });
    }

    if (deliveredAt !== undefined && typeof deliveredAt !== "string") {
      return res.status(400).json({
        error: "Invalid delivery date"
      });
    }

    const deliveryDate =
      deliveredAt === undefined ? new Date() : new Date(deliveredAt);

    if (Number.isNaN(deliveryDate.getTime())) {
      return res.status(400).json({
        error: "Invalid delivery date"
      });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    });

    if (!customer || !customer.isActive) {
      return res.status(404).json({
        error: "Active customer not found"
      });
    }

    const ratePerLitrePaise = customer.defaultRatePaise;

    const amountPaise = Math.round(
      (quantityMl * ratePerLitrePaise) / 1000
    );

    if (!Number.isSafeInteger(amountPaise)) {
      return res.status(400).json({
        error: "Delivery amount is too large"
      });
    }

    const delivery = await prisma.delivery.create({
      data: {
        customerId: customer.id,
        quantityMl,
        ratePerLitrePaise,
        amountPaise,
        deliveredAt: deliveryDate,
        notes: notes?.trim() || null
      },
      include: {
        customer: {
          select: {
            name: true,
            phone: true
          }
        }
      }
    });

    res.status(201).json(delivery);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to record milk delivery"
    });
  }
});

// Preview monthly customer bills
app.get("/api/billing/preview", async (req, res) => {
  try {
    const month = req.query.month;

    if (
      typeof month !== "string" ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
    ) {
      return res.status(400).json({
        error: "A valid month is required in YYYY-MM format"
      });
    }

    const year = Number(month.slice(0, 4));
    const monthNumber = Number(month.slice(5, 7));

    // India-local calendar month boundaries
    const periodStart = new Date(`${month}-01T00:00:00+05:30`);

    const nextMonthStart =
      monthNumber === 12
        ? new Date(`${year + 1}-01-01T00:00:00+05:30`)
        : new Date(
            `${year}-${String(monthNumber + 1).padStart(2, "0")}-01T00:00:00+05:30`
          );

    const periodEnd = new Date(nextMonthStart.getTime() - 1);

    const deliveries = await prisma.delivery.findMany({
      where: {
        deliveredAt: {
          gte: periodStart,
          lt: nextMonthStart
        }
      },
      orderBy: [
        { customer: { name: "asc" } },
        { deliveredAt: "asc" }
      ],
      select: {
        id: true,
        quantityMl: true,
        ratePerLitrePaise: true,
        amountPaise: true,
        deliveredAt: true,
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true
          }
        }
      }
    });

    const customerBills = new Map<
      string,
      {
        customer: {
          id: string;
          name: string;
          phone: string | null;
          address: string | null;
        };
        deliveryCount: number;
        totalQuantityMl: number;
        totalAmountPaise: number;
        deliveries: typeof deliveries;
      }
    >();

    for (const delivery of deliveries) {
      const customerId = delivery.customer.id;

      if (!customerBills.has(customerId)) {
        customerBills.set(customerId, {
          customer: delivery.customer,
          deliveryCount: 0,
          totalQuantityMl: 0,
          totalAmountPaise: 0,
          deliveries: []
        });
      }

      const bill = customerBills.get(customerId)!;

      bill.deliveryCount += 1;
      bill.totalQuantityMl += delivery.quantityMl;
      bill.totalAmountPaise += delivery.amountPaise;
      bill.deliveries.push(delivery);
    }

    const invoices = await prisma.invoice.findMany({
      where: {
        periodStart
      },
      select: {
        id: true,
        customerId: true,
        invoiceNumber: true,
        totalPaise: true,
        status: true
      }
    });

    const invoiceMap = new Map(
      invoices.map((invoice) => [invoice.customerId, invoice])
    );

    const bills = Array.from(customerBills.values()).map((bill) => {
      const invoice = invoiceMap.get(bill.customer.id);

      return {
        customer: bill.customer,
        deliveryCount: bill.deliveryCount,
        totalQuantityMl: bill.totalQuantityMl,
        totalQuantityLitres: bill.totalQuantityMl / 1000,
        totalAmountPaise: bill.totalAmountPaise,
        totalAmountRupees: bill.totalAmountPaise / 100,
        invoice: invoice
          ? {
              id: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              totalPaise: invoice.totalPaise,
              status: invoice.status
            }
          : null,
        deliveries: bill.deliveries
      };
    });

    const totalQuantityMl = bills.reduce(
      (sum, bill) => sum + bill.totalQuantityMl,
      0
    );

    const totalAmountPaise = bills.reduce(
      (sum, bill) => sum + bill.totalAmountPaise,
      0
    );

    res.json({
      month,
      timezone: "Asia/Kolkata",
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      customerCount: bills.length,
      totalDeliveryCount: deliveries.length,
      totalQuantityMl,
      totalQuantityLitres: totalQuantityMl / 1000,
      totalAmountPaise,
      totalAmountRupees: totalAmountPaise / 100,
      bills
    });
  } catch (error) {
    console.error("MONTHLY BILLING ERROR:");

    if (error instanceof Error) {
      console.error(error.name);
      console.error(error.message);
      console.error(error.stack);
    } else {
      console.error(error);
    }

    res.status(500).json({
      error: "Failed to generate monthly billing preview"
    });
  }
});

// Malformed JSON and other middleware errors
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({
      error: "Invalid JSON body"
    });
  }

  console.error(err);

  res.status(500).json({
    error: "Internal server error"
  });
};

app.use(errorHandler);

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`MilkDesk API listening on port ${PORT}`);
});
