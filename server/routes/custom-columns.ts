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
      .select()
      .from(customColumns)
      .where(eq(customColumns.tripId, tripId));
    
    if (columns.length === 0) {
      console.log(`No custom columns found for trip ${tripId}`);
      return res.json({});
    }
    
    console.log(`Found ${columns.length} custom columns for trip ${tripId}:`, columns);
    
    // Get all values from the database - we'll do filtering in memory 
    // to avoid SQL issues
    const allValues = await db.select().from(customValues);
    console.log(`Found ${allValues.length} total custom values in database`);
    
    // Create a Set of column IDs for faster lookup
    const columnIdSet = new Set(columns.map(col => col.columnId));
    
    // Filter values for this trip's column IDs
    const filteredValues = allValues.filter(value => columnIdSet.has(value.columnId));
    console.log(`Filtered to ${filteredValues.length} values for this trip:`, filteredValues);
    
    // Convert array to object with keys like '{participantId}-{columnId}'
    const valuesObject: Record<string, any> = {};
    filteredValues.forEach(v => {
      const key = `${v.participantId}-${v.columnId}`;
      valuesObject[key] = v.value;
      console.log(`Setting value for ${key} to "${v.value}"`);
    });
    
    console.log("Returning values object:", valuesObject);
    res.json(valuesObject);
  } catch (error) {
    console.error("Error fetching custom values:", error);
    res.status(500).json({ error: "Failed to fetch custom values" });
  }
});

// Set a custom value
router.post("/trips/:tripId/custom-values", async (req, res) => {
  try {
    console.log("Received custom value request:", req.body);
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
    
    console.log("Existing value check:", existingValue);
    
    let result;
    
    if (existingValue.length > 0) {
      console.log("Updating existing value:", existingValue[0]);
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
      console.log("Inserting new value for", columnId, participantId);
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
    
    console.log("Save result:", result);
    
    // Force refresh of the values
    const values = await db.select().from(customValues);
    console.log("All values after save:", values);
    
    res.json(result[0]);
  } catch (error) {
    console.error("Error setting custom value:", error);
    res.status(500).json({ error: "Failed to set custom value" });
  }
});

export default router;