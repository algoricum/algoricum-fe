import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat"; // Optional for better formatting
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";

// Load plugins
dayjs.extend(utc);
dayjs.extend(localizedFormat);

// Extend Day.js with the relativeTime plugin
dayjs.extend(relativeTime);

export function getTimeSinceCreation(creationDate: string) {
  const createdAt = dayjs.utc(creationDate).local(); // Adjusts UTC to local timezone

  // Calculate the difference in human-readable format
  const timeAgo = createdAt.fromNow();

  return timeAgo;
}
