import { google } from 'googleapis';
import { db } from '../db';
import { activities, googleCalendarSync } from '../db/schema';
import { eq, and } from 'drizzle-orm';

const calendar = google.calendar('v3');

// Initialize OAuth2 client
function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPLIT_CLUSTER}.replit.dev` : 'http://localhost:5000'}/api/google/calendar/callback`
  );
}

// Convert Google Calendar event to our activity format
function googleEventToActivity(event: any, tripId: number): Partial<typeof activities.$inferInsert> {
  return {
    tripId,
    title: event.summary || 'Untitled Event',
    description: event.description || null,
    location: event.location || null,
    startTime: new Date(event.start.dateTime || event.start.date),
    endTime: new Date(event.end.dateTime || event.end.date),
    googleEventId: event.id,
  };
}

// Convert our activity to Google Calendar event format
function activityToGoogleEvent(activity: any) {
  return {
    summary: activity.title,
    description: activity.description || `Activity from trip`,
    location: activity.location || '',
    start: {
      dateTime: activity.startTime,
      timeZone: 'UTC',
    },
    end: {
      dateTime: activity.endTime,
      timeZone: 'UTC',
    },
  };
}

// Sync events from Google Calendar to our database
export async function syncFromGoogleCalendar(
  tripId: number,
  accessToken: string,
  calendarId: string,
  syncToken?: string
) {
  try {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    // Get sync record
    const [syncRecord] = await db
      .select()
      .from(googleCalendarSync)
      .where(and(
        eq(googleCalendarSync.tripId, tripId),
        eq(googleCalendarSync.calendarId, calendarId)
      ))
      .limit(1);

    // Fetch events from Google Calendar
    const response = await calendar.events.list({
      auth: oauth2Client,
      calendarId,
      syncToken: syncRecord?.syncToken || undefined,
      showDeleted: true,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];
    const newSyncToken = response.data.nextSyncToken;

    // Process each event
    for (const event of events) {
      if (event.status === 'cancelled') {
        // Delete cancelled events
        if (event.id) {
          await db
            .delete(activities)
            .where(and(
              eq(activities.tripId, tripId),
              eq(activities.googleEventId, event.id)
            ));
        }
      } else {
        // Check if event already exists
        const [existingActivity] = await db
          .select()
          .from(activities)
          .where(and(
            eq(activities.tripId, tripId),
            eq(activities.googleEventId, event.id)
          ))
          .limit(1);

        if (existingActivity) {
          // Update existing activity
          const activityData = googleEventToActivity(event, tripId);
          await db
            .update(activities)
            .set({
              ...activityData,
              startTime: activityData.startTime,
              endTime: activityData.endTime,
            })
            .where(eq(activities.id, existingActivity.id));
        } else {
          // Create new activity
          const activityData = googleEventToActivity(event, tripId);
          await db
            .insert(activities)
            .values({
              ...activityData,
              createdAt: new Date(),
            });
        }
      }
    }

    // Update sync token
    if (newSyncToken) {
      if (syncRecord) {
        await db
          .update(googleCalendarSync)
          .set({ 
            syncToken: newSyncToken, 
            lastSyncedAt: new Date() 
          })
          .where(eq(googleCalendarSync.id, syncRecord.id));
      } else {
        await db
          .insert(googleCalendarSync)
          .values({
            tripId,
            calendarId,
            syncToken: newSyncToken,
            webhookChannelId: null,
            webhookResourceId: null,
            lastSyncedAt: new Date(),
            createdAt: new Date(),
          });
      }
    }

    return { synced: events.length, token: newSyncToken };
  } catch (error) {
    console.error('Error syncing from Google Calendar:', error);
    throw error;
  }
}

// Sync activity to Google Calendar
export async function syncActivityToGoogle(
  activity: any,
  accessToken: string,
  calendarId: string
) {
  try {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const event = activityToGoogleEvent(activity);

    let response;
    if (activity.googleEventId) {
      // Update existing event
      response = await calendar.events.update({
        auth: oauth2Client,
        calendarId,
        eventId: activity.googleEventId,
        requestBody: event,
      });
    } else {
      // Create new event
      response = await calendar.events.insert({
        auth: oauth2Client,
        calendarId,
        requestBody: event,
      });

      // Update activity with Google event ID
      await db
        .update(activities)
        .set({ googleEventId: response.data.id })
        .where(eq(activities.id, activity.id));
    }

    return response.data;
  } catch (error) {
    console.error('Error syncing activity to Google:', error);
    throw error;
  }
}

// Delete activity from Google Calendar
export async function deleteActivityFromGoogle(
  googleEventId: string,
  accessToken: string,
  calendarId: string
) {
  try {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    await calendar.events.delete({
      auth: oauth2Client,
      calendarId,
      eventId: googleEventId,
    });
  } catch (error) {
    console.error('Error deleting activity from Google:', error);
    // Don't throw error if event is already deleted
    if ((error as any).code !== 410) {
      throw error;
    }
  }
}

// Set up webhook for real-time sync
export async function setupGoogleCalendarWebhook(
  tripId: number,
  accessToken: string,
  calendarId: string
) {
  try {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const channelId = `trip-${tripId}-${Date.now()}`;
    const webhookUrl = `${process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPLIT_CLUSTER}.replit.dev` : 'http://localhost:5000'}/api/google/calendar/webhook`;

    const response = await calendar.events.watch({
      auth: oauth2Client,
      calendarId,
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
        token: `trip-${tripId}`,
      },
    });

    // Store webhook info
    await db
      .update(googleCalendarSync)
      .set({
        webhookChannelId: response.data.id,
        webhookResourceId: response.data.resourceId,
        webhookExpiration: response.data.expiration ? new Date(parseInt(response.data.expiration)) : null,
      })
      .where(and(
        eq(googleCalendarSync.tripId, tripId),
        eq(googleCalendarSync.calendarId, calendarId)
      ));

    return response.data;
  } catch (error) {
    console.error('Error setting up webhook:', error);
    throw error;
  }
}

// Stop webhook
export async function stopGoogleCalendarWebhook(
  channelId: string,
  resourceId: string,
  accessToken: string
) {
  try {
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    await calendar.channels.stop({
      auth: oauth2Client,
      requestBody: {
        id: channelId,
        resourceId: resourceId,
      },
    });
  } catch (error) {
    console.error('Error stopping webhook:', error);
    // Don't throw if channel is already stopped
  }
}