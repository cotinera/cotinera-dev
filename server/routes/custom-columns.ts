import express from "express";
import { db } from "@db";
import { customColumns, customValues } from "@db/schema";
import { and, eq, sql } from "drizzle-orm";

const router = express.Router();

// Get all custom columns for a trip
router.get("/trips/:tripId/custom-columns", async (req, res) => {
  try {
    const tripId = parseInt(req.params.tripId);
    const columns = await db.select().from(customColumns).where(eq(customColumns.tripId, tripId));
    res.json(columns);
  } catch (error) {
    console.error("Error fetching custom columns:", error);
    res.status(500).json({ error: "Failed to fetch custom columns" });
  }
});

// Create a new custom column
router.post("/trips/:tripId/custom-columns", async (req, res) => {
  try {
    const tripId = parseInt(req.params.tripId);
    const { name, type } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ error: "Column name and type are required" });
    }
    
    // Generate a unique ID for the column
    const columnId = `col_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    const newColumn = await db.insert(customColumns).values({
      tripId,
      name,
      type,
      columnId,
    }).returning();
    
    res.status(201).json(newColumn[0]);
  } catch (error) {
    console.error("Error creating custom column:", error);
    res.status(500).json({ error: "Failed to create custom column" });
  }
});

// Delete a custom column
router.delete("/trips/:tripId/custom-columns/:columnId", async (req, res) => {
  try {
    const tripId = parseInt(req.params.tripId);
    const columnId = req.params.columnId;
    
    // Delete the custom column
    await db.delete(customColumns).where(
      and(
        eq(customColumns.tripId, tripId),
        eq(customColumns.columnId, columnId)
      )
    );
    
    // Also delete all values for this column
    await db.delete(customValues).where(eq(customValues.columnId, columnId));
    
    res.status(200).json({ message: "Custom column deleted successfully" });
  } catch (error) {
    console.error("Error deleting custom column:", error);
    res.status(500).json({ error: "Failed to delete custom column" });
  }
});

// Get all custom values for a trip
router.get("/trips/:tripId/custom-values", async (req, res) => {
  try {
    // First get all column IDs for this trip
    const tripId = parseInt(req.params.tripId);
    const columns = await db
      .select({ columnId: customColumns.columnId })
      .from(customColumns)
      .where(eq(customColumns.tripId, tripId));
    
    const columnIds = columns.map(c => c.columnId);
    
    if (columnIds.length === 0) {
      return res.json({});
    }
    
    // Then get all values for these column IDs - handle empty array case
    let values: any[] = [];
    if (columnIds.length > 0) {
      values = await db
        .select()
        .from(customValues)
        .where(sql`${customValues.columnId} IN (${columnIds.join(',')})`);    
    }
    
    // Convert array to object with keys like '{participantId}-{columnId}'
    const valuesObject: Record<string, any> = {};
    values.forEach(v => {
      valuesObject[`${v.participantId}-${v.columnId}`] = v.value;
    });
    
    res.json(valuesObject);
  } catch (error) {
    console.error("Error fetching custom values:", error);
    res.status(500).json({ error: "Failed to fetch custom values" });
  }
});

// Set a custom value
router.post("/trips/:tripId/custom-values", async (req, res) => {
  try {
    const { columnId, participantId, value } = req.body;
    
    if (!columnId || !participantId || value === undefined) {
      return res.status(400).json({ error: "Column ID, participant ID, and value are required" });
    }
    
    // Check if value already exists
    const existingValue = await db
      .select()
      .from(customValues)
      .where(
        and(
          eq(customValues.columnId, columnId),
          eq(customValues.participantId, participantId)
        )
      );
    
    let result;
    
    if (existingValue.length > 0) {
      // Update existing value
      result = await db
        .update(customValues)
        .set({ value: String(value), updatedAt: new Date() })
        .where(
          and(
            eq(customValues.columnId, columnId),
            eq(customValues.participantId, participantId)
          )
        )
        .returning();
    } else {
      // Insert new value
      result = await db
        .insert(customValues)
        .values({
          columnId,
          participantId,
          value: String(value),
        })
        .returning();
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error("Error setting custom value:", error);
    res.status(500).json({ error: "Failed to set custom value" });
  }
});

export default router;