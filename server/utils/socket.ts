
import { Server } from "socket.io";
import type { Server as HTTPServer } from "http";
import { db } from "@db";
import { participants } from "@db/schema";
import { eq } from "drizzle-orm";

export function setupWebSocket(httpServer: HTTPServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    socket.on("join-trip", async (tripId: number) => {
      // Join trip-specific room
      socket.join(`trip-${tripId}`);
    });

    socket.on("leave-trip", (tripId: number) => {
      socket.leave(`trip-${tripId}`);
    });
  });

  return io;
}

export function emitTripUpdate(tripId: number, type: string, data: any) {
  const io = global.io;
  if (io) {
    io.to(`trip-${tripId}`).emit("trip-update", {
      type,
      data
    });
  }
}
